"use strict";

// Deliberately independent of the existing 2D game/rules bootstraps.
(async function startDiorama() {
  const loading = document.getElementById("loadingState");
  try {
    let THREE;
    try {
      THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
    } catch (primaryError) {
      THREE = await import("https://unpkg.com/three@0.180.0/build/three.module.js");
    }
    initialize(THREE);
    loading.hidden = true;
  } catch (error) {
    console.error("Crossroads 3D scene failed to start:", error);
    loading.textContent = "The 3D scene could not start. WebGL and an internet connection are required.";
  }
})();

function initialize(THREE) {
  const canvas = document.getElementById("dioramaCanvas");
  const stage = document.getElementById("stage");
  const bridge = window.CrossroadsDioramaBridge;
  const scenarioAdapter = window.Crossroads3DScenarioAdapter;
  const scaleSpec = window.Crossroads3DScale;
  const battle = window.CrossroadsBattle3D ?? null;
  const shotExplanation=window.Crossroads3DShotExplanation;
  const miniatureLab=window.Crossroads3DMiniatureLab;
  if(!scaleSpec)throw new Error("Shared miniature scale reference missing.");
  if(!scenarioAdapter)throw new Error("3D scenario adapter not loaded.");
  const requestedScenario=new URLSearchParams(window.location.search).get("scenario")||"hold_the_farm";
  const layout=scenarioAdapter.loadScenario(requestedScenario);
  const authoredTerrain=layout.entries;
  const motion = window.CrossroadsDioramaMotion;
  const soldierActions=window.Crossroads3DSoldierActions;
  const soldierIK=window.Crossroads3DSoldierIK;
  const squadMotion=window.Crossroads3DSquadMotion;
  const weaponPresentation=window.Crossroads3DWeaponPresentation;
  const assaultMotion=window.Crossroads3DAssaultMotion;
  const coverPositions=window.Crossroads3DCoverPositions;
  const formationLayout=window.Crossroads3DFormationLayout;
  const visualAnchor=window.Crossroads3DVisualAnchor;
  if(!visualAnchor)throw new Error("3D visual formation anchor missing.");
  const tabletopDice=window.Crossroads3DTabletopDice;
  const buildingVisuals=window.Crossroads3DBuildingVisuals;
  const garrisonWindows=window.Crossroads3DGarrisonWindows;
  if(!squadMotion)throw new Error("3D squad motion helper missing");
  const gestures = window.CrossroadsDioramaGestures;
  const pointerRecovery = window.Crossroads3DPointerRecovery;
  if (!gestures) throw new Error("Crossroads 3D touch gestures were not loaded.");
  if (!pointerRecovery) throw new Error("Crossroads 3D pointer recovery was not loaded.");
  if (!motion) throw new Error("Crossroads 3D motion helpers were not loaded.");
  if (!bridge) throw new Error("Crossroads 3D movement bridge was not loaded.");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6f7d73);
  scene.fog = new THREE.Fog(0x6f7d73, 44, 82);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.27;

  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 150);
  const target = new THREE.Vector3(0, 0.75, 0);
  // Smooth focus has no effect on game coordinates. Manual pan/orbit interrupts.
  let cameraFocus=null;
  let focusZoom=null;
  function stopCameraFocus(){cameraFocus=null;focusZoom=null;}
  const initialYaw = Math.PI / 4;
  let yaw = initialYaw;
  let zoom = 1;
  let baseHeight = 20;
  let viewportWidth = 1;
  let viewportHeight = 1;
  const elevation = THREE.MathUtils.degToRad(51);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const worldWidth = bridge.table.width * bridge.table.worldUnitsPerInch;
  const worldDepth = bridge.table.height * bridge.table.worldUnitsPerInch;

  const hemi = new THREE.HemisphereLight(0xf5f0dc, 0x5e6554, 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe5b8, 3);
  sun.position.set(-9, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  const materials = new Map();
  function mat(color, metalness) {
    const key = String(color) + "-" + String(metalness || 0);
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color: color, roughness: 0.91, metalness: metalness || 0, flatShading: true
      }));
    }
    return materials.get(key);
  }
  const wood = mat(0x664836);
  const darkWood = mat(0x382e26);
  const roofMat = mat(0x8f4b38);
  const stonePalette = [0x8d8a7b, 0xa29b83, 0xb0a992, 0x7f8275];
  const leafPalette = [0x566d46, 0x6a7b4a, 0x7b8450, 0x536748];
  const terrainY = (x, z) => 0.19 + Math.sin(x * 0.64) * Math.cos(z * 0.53) * 0.075 + Math.sin(x * 1.34 + z * 0.42) * 0.025;
  let seed = 39045;
  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function between(a, b) { return a + random() * (b - a); }
  function block(parent, width, height, depth, material, x, y, z) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function shape(parent, geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  // A physical slice of battlefield, complete with layered wooden edges.
  block(scene, worldWidth + .3, 0.17, worldDepth + .3, mat(0x2b2a25), 0, -0.73, 0);
  block(scene, worldWidth + .15, 0.69, worldDepth + .15, darkWood, 0, -0.37, 0);
  block(scene, worldWidth, 0.13, worldDepth, wood, 0, 0.015, 0);
  block(scene, worldWidth - .25, 0.1, worldDepth - .25, mat(0x777f50), 0, 0.085, 0);
  for (const z of [-(worldDepth + .15) / 2, (worldDepth + .15) / 2]) {
    block(scene, worldWidth + .15, 0.14, 0.085, mat(0x926847), 0, -0.28, z);
    block(scene, worldWidth + .15, 0.04, 0.035, mat(0xb38c5c), 0, -0.06, z);
  }
  for (const x of [-(worldWidth + .15) / 2, (worldWidth + .15) / 2]) {
    block(scene, 0.09, 0.14, worldDepth + .15, mat(0x926847), x, -0.28, 0);
  }
  for(const x of [-worldWidth/2+.99,worldWidth/2-.99]){
    for(const z of [-worldDepth/2+.55,worldDepth/2-.55]){
      shape(scene, new THREE.CylinderGeometry(0.09, 0.09, 0.045, 8), mat(0xb19b76, 0.22), x, 0.09, z);
    }
  }

  const groundGeometry = new THREE.PlaneGeometry(worldWidth - .30, worldDepth - .30, 52, 38);
  groundGeometry.rotateX(-Math.PI / 2);
  const position = groundGeometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, terrainY(position.getX(i), position.getZ(i)));
  }
  groundGeometry.computeVertexNormals();
  const ground = shape(scene, groundGeometry,
    mat(layout.scenario.table.mat==="grass_dry"?0x899464:0x72865c), 0, 0, 0);
  // Early 3D terrain editor: visual draft terrain stays separate from the
  // authoritative scenario, and exports compatible terrain record shapes.
  const editorDraftMeshes=new Map();
  const editorDraftStyle={
    wall:{color:0xb4a58e,height:.36},hedge:{color:0x5e7e52,height:.52},
    fence_wood:{color:0x79654d,height:.45},road_straight:{color:0xb0a17e,height:.042},
    woods:{color:0x607a51,height:.50},medium_cottage:{color:0xc2aa8d,height:1.42},
    barn:{color:0x76664f,height:1.35},field_wheat:{color:0xb6a06b,height:.10}
  };
  function editorDraftRemove(id){
    const group=editorDraftMeshes.get(id);
    if(!group)return false;
    scene.remove(group);
    group.traverse(child=>{
      if(child.isMesh){child.geometry?.dispose();child.material?.dispose()}
    });
    editorDraftMeshes.delete(id);return true;
  }
  function editorDraftPlace(entry){
    if(!window.Crossroads3DEditor?.enabled||
       !entry?.id||!editorDraftStyle[entry.terrainId])return false;
    editorDraftRemove(entry.id);
    const style=editorDraftStyle[entry.terrainId];
    const inch=bridge.table.worldUnitsPerInch;
    const width=Math.max(.15,entry.width*inch);
    const depth=Math.max(.15,entry.height*inch);
    const center=bridge.toWorld({x:entry.x+entry.width/2,
      y:entry.y+entry.height/2});
    const group=new THREE.Group();
    group.position.set(center.x,terrainY(center.x,center.z),center.z);
    group.rotation.y=-(Number(entry.rotation)||0)*Math.PI/180;
    scene.add(group);
    const surface=new THREE.MeshStandardMaterial({color:style.color,
      transparent:true,opacity:.73,roughness:.95,depthWrite:false});
    const height=style.height;
    const base=block(group,width,height,depth,surface,0,height/2,0);
    base.castShadow=false;base.receiveShadow=false;
    if(entry.terrainId==="medium_cottage"||entry.terrainId==="barn"){
      const roof=new THREE.Mesh(new THREE.ConeGeometry(
        Math.max(width,depth)*.73,.55,4),
        new THREE.MeshStandardMaterial({color:0x8b5e4a,
          transparent:true,opacity:.78,roughness:1}));
      roof.position.set(0,height+.26,0);
      roof.rotation.y=Math.PI/4;group.add(roof);
    }
    if(entry.terrainId==="woods"){
      for(const [x,z] of [[-.24,-.16],[.19,-.04],[.02,.25]]){
        const top=new THREE.Mesh(new THREE.DodecahedronGeometry(.31,0),
          new THREE.MeshStandardMaterial({color:0x527047,
            transparent:true,opacity:.76}));
        top.position.set(x*width,height+.22,z*depth);
        group.add(top);
      }
    }
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(
      new THREE.BoxGeometry(width,height,depth)),
      new THREE.LineBasicMaterial({color:0xffdf87,transparent:true,opacity:.80}));
    outline.position.y=height/2;group.add(outline);
    editorDraftMeshes.set(entry.id,group);
    return true;
  }
  window.Crossroads3DEditorBridge=Object.freeze({
    place:editorDraftPlace,remove:editorDraftRemove,
    clear(){for(const id of [...editorDraftMeshes.keys()])editorDraftRemove(id)},
    get ids(){return [...editorDraftMeshes.keys()]}
  });

  ground.castShadow = false;
  // Sample the actual visible triangles (not the analytical height estimate).
  // Includes grass-color overlays and road surfaces, which sit higher than soil.
  const walkableSurfaceMeshes = [ground];

  // Tonal field patches: no repeating photo texture, no noisy realism.
  const patchColors = [0x6b7c50, 0x87915d, 0x708052, 0x8e9565];
  for (let i = 0; i < 27; i++) {
    const x=between(-worldWidth/2+.7,worldWidth/2-.7);
    const z=between(-worldDepth/2+.6,worldDepth/2-.6);
    const patch = shape(scene, new THREE.CircleGeometry(1, 11), mat(patchColors[i % patchColors.length]), x, terrainY(x, z) + 0.028, z);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(between(0.65, 2.4), between(0.48, 1.7), 1);
    patch.castShadow = false;
    walkableSurfaceMeshes.push(patch);
  }

  // Exact authored scenario rectangles, converted through the shared inch
  // transform. Layered painted strips are sampled by the same base-footing ray.
  const roadEntries=authoredTerrain.filter(e=>e.renderer==="road");
  function onRoad(x,z,padding=0) {
    return roadEntries.some(e=>{
      const r=scenarioAdapter.boundsWorld(e.visualRect);
      return Math.abs(x-r.x)<r.width/2+padding &&
        Math.abs(z-r.z)<r.depth/2+padding;
    });
  }
  function roadRibbon(entry, widthFraction, sideOffset, materialColor, lift) {
    const rect=scenarioAdapter.boundsWorld(entry.visualRect);
    const alongX=rect.width>=rect.depth;
    const totalLength=alongX?rect.width:rect.depth;
    const totalWidth=alongX?rect.depth:rect.width;
    const width=totalWidth*widthFraction;
    const N=Math.max(10,Math.ceil(totalLength/.32));
    const vertices=[],indices=[];
    for(let i=0;i<=N;i++) {
      const progress=i/N-.5;
      for(const edge of [-.5,.5]){
        const perpendicular=sideOffset*totalWidth+edge*width;
        const x=rect.x+(alongX?progress*totalLength:perpendicular);
        const z=rect.z+(alongX?perpendicular:progress*totalLength);
        vertices.push(x,terrainY(x,z)+lift,z);
      }
      if(i<N) {
        const k=i*2;
        indices.push(k,k+1,k+2,k+1,k+3,k+2);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh=shape(scene,geo,new THREE.MeshStandardMaterial({
      color:materialColor,roughness:1,side:THREE.DoubleSide
    }),0,0,0);
    mesh.castShadow=false;
    mesh.userData.terrainId=entry.id;
    walkableSurfaceMeshes.push(mesh);
  }
  // Paint the same crossroads, not the prototype's diagonal path.
  roadEntries.forEach((entry,index)=>{
    roadRibbon(entry,1,0,0x938567,.043+index*.003);
    roadRibbon(entry,.89,0,0xb4a47c,.055+index*.003);
    for(const offset of [-.26,.26])
      roadRibbon(entry,.06,offset,0x8c7e60,.063+index*.003);
  });

  // Angular low-poly stones and seasonal miniature vegetation.
  const grassBlade = new THREE.ConeGeometry(0.055, 0.20, 3);
  const grassMaterials = [mat(0x8b9c62), mat(0x536f46), mat(0xabb171)];
  for (let p = 0; p < grassMaterials.length; p++) {
    const field = new THREE.InstancedMesh(grassBlade, grassMaterials[p], 220);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 220; i++) {
      let x = 0, z = 0, tries = 0;
      do {
        x = between(-9.75, 9.75);
        z = between(-6.9, 6.9);
        tries++;
       } while(tries<20 && (onRoad(x,z,.12) ||
        authoredTerrain.some(entry=>entry.renderer==="building"&&
          Math.abs(x-scenarioAdapter.boundsWorld(entry.rulesRect).x) <
            scenarioAdapter.boundsWorld(entry.rulesRect).width/2+.25 &&
          Math.abs(z-scenarioAdapter.boundsWorld(entry.rulesRect).z) <
            scenarioAdapter.boundsWorld(entry.rulesRect).depth/2+.25)));
      dummy.position.set(x, terrainY(x, z) + 0.095, z);
      dummy.rotation.set(0, between(0, Math.PI * 2), between(-0.22, 0.22));
      const scale = between(0.55, 1.55);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      field.setMatrixAt(i, dummy.matrix);
    }
    field.instanceMatrix.needsUpdate = true;
    field.castShadow = false;
    scene.add(field);
  }

  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.10, 0), mat(0x9a9880), 94);
  const pebbleMatrix = new THREE.Object3D();
  for (let i = 0; i < 94; i++) {
    const road=roadEntries[i%Math.max(1,roadEntries.length)];
    const r=road?scenarioAdapter.boundsWorld(road.visualRect):{x:0,z:0,width:2,depth:2};
    const x=r.x+between(-r.width*.46,r.width*.46);
    const z=r.z+between(-r.depth*.46,r.depth*.46);
    pebbleMatrix.position.set(x, terrainY(x, z) + 0.056, z);
    pebbleMatrix.rotation.set(between(-1, 1), between(0, 6), between(-1, 1));
    pebbleMatrix.scale.set(between(.35, 1.25), between(.3, .65), between(.4, 1.3));
    pebbleMatrix.updateMatrix();
    pebbles.setMatrixAt(i, pebbleMatrix.matrix);
  }
  pebbles.castShadow = false;
  scene.add(pebbles);

  const roofMaterials=[];
  function registerRoof(entry,material){
    const r=scenarioAdapter.boundsWorld(entry.rulesRect);
    const token=new THREE.Mesh(new THREE.RingGeometry(.21,.28,26),
      new THREE.MeshBasicMaterial({color:0xdac784,transparent:true,opacity:.9,
        side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
    token.rotation.x=-Math.PI/2;
    token.position.set(r.x,terrainY(r.x,r.z)+.09,r.z);
    token.renderOrder=12;token.visible=false;
    scene.add(token);
    roofMaterials.push({
      ids:[entry.id,entry.terrainId].filter(Boolean),
      material,bounds:r,occupied:false,focused:false,token
    });
  }
  function updateBuildingRoofs(snapshot) {
    for(const roof of roofMaterials){
      const units=(snapshot.units||[]).filter(u=>u.inBuilding&&u.soldiers>0&&
        roof.ids.some(id=>String(id)===String(u.inBuilding)));
      const inside=units.length>0;
      roof.token.visible=inside;
      if(inside)roof.token.material.color.setHex(units[0].faction==="red"?
        0xd68f71:0x8ac1cc);
      const focused=inside&&units.some(u=>u.id===snapshot.selectedUnitId);
      roof.token.scale.setScalar(focused?1.22:1);
      if(inside===roof.occupied&&focused===roof.focused)continue;
      roof.occupied=inside;roof.focused=focused;
      roof.material.transparent=inside;
      roof.material.opacity=inside?(focused?.09:.22):1;
      roof.material.depthWrite=!inside;
      roof.material.needsUpdate=true;
    }
  }
  // Real longhouse: independent structural bays, NOT scaled model geometry.
  // The game rules footprint remains authoritative; every decorative piece
  // is constructed directly in physical world units from that footprint.
  function makeFarmhouse(entry) {
    const rect=scenarioAdapter.boundsWorld(entry.rulesRect);
    const dim=scaleSpec.houseDimensions(rect,6);
    const group=new THREE.Group();
    group.position.set(rect.x,terrainY(rect.x,rect.z),rect.z);
    group.rotation.y=(rect.width>=rect.depth?0:-Math.PI/2) -
      (entry.rotation||0)*Math.PI/180;
    group.userData.terrainId=entry.id;
    group.userData.rulesRect=entry.rulesRect;
    scene.add(group);
    const wallMat=mat(entry.appearance?.includes("peach")?0xcdb39c:0xddd2b6);
    const masonry=mat(0xada28a),lintel=mat(0x988a70);
    const tiledRoof=mat(entry.appearance?.includes("thatch")?0x948866:0xb54f36);
    registerRoof(entry,tiledRoof);
    const timber=mat(0x66503a),windowGlass=mat(0x687978),shutter=mat(0x61724f);
    const L=dim.length, D=dim.depth;
    const eave=dim.eaveHeight, rise=dim.roofRise;
    const halfL=L/2,halfD=D/2;
    // A single, solid load-bearing structure with foundations in scale.
    block(group,L,.085,D,masonry,0,.035,0);
    block(group,L-.055,eave-.13,D-.09,wallMat,0,eave/2+.04,0);
    block(group,L,.075,D,masonry,0,.16,0);
    // Separate bay posts/rhythm at sensible regular intervals.
    for(let i=0;i<=dim.bays;i++){
      const x=-halfL+i*dim.bayWidth;
      const corrected=Math.max(-halfL+.036,Math.min(halfL-.036,x));
      for(const side of [-1,1]){
        block(group,.045,eave-.12,.042,lintel,corrected,eave/2+.055,side*(halfD+.002));
      }
    }
    // Physically pitched two-panel roof with correct rise on a narrow,
    // elongated longhouse; no width-dependent stretching of the roof slope.
    const pitch=Math.atan2(rise,halfD+.11);
    const slope=Math.hypot(rise,halfD+.11);
    for(const side of [-1,1]){
      const panel=block(group,L+.19,.074,slope+.09,tiledRoof,0,eave+rise/2,side*(halfD+.11)/2);
      panel.rotation.x=side*pitch;
      block(group,L+.16,.055,.040,mat(0x71402f),0,eave-.045,side*(halfD+.16));
    }
    block(group,L+.23,.065,.085,mat(0x6a3d2e),0,eave+rise,0);
    // Triangular gables are architecturally independent, not scaled windows.
    for(const side of [-1,1]){
      const x=side*(halfL-.017);
      const triangle=new THREE.BufferGeometry();
      triangle.setAttribute("position",new THREE.Float32BufferAttribute([
        x,eave,-halfD, x,eave,halfD, x,eave+rise,0
      ],3));
      triangle.computeVertexNormals();
      shape(group,triangle,new THREE.MeshStandardMaterial({
        color:0xd3c4a4,roughness:1,side:THREE.DoubleSide
      }),0,0,0);
    }
    // Five regular window bays and one real human-scale doorway.
    const doorwayBay=Math.floor(dim.bays/2);
    for(let i=0;i<dim.bays;i++){
      const x=-halfL+(i+.5)*dim.bayWidth;
      for(const side of [-1,1]){
        const z=side*(halfD+.025);
        const isDoor=side===1&&i===doorwayBay;
        if(isDoor){
          const doorWidth=Math.min(.285,dim.bayWidth*.56);
          const doorHeight=Math.min(.57,eave*.88);
          block(group,doorWidth+.055,doorHeight+.062,.065,timber,x,doorHeight/2+.09,z);
          block(group,doorWidth,doorHeight,.073,mat(0x805d3d),x,doorHeight/2+.07,z+side*.038);
          block(group,.022,.030,.08,mat(0xbca06a),x+doorWidth*.34,doorHeight*.53,z+side*.085);
          block(group,doorWidth+.22,.055,.20,masonry,x,.09,z+side*.12);
        }else{
          const width=Math.min(.255,dim.bayWidth*.43);
          const height=.31;
          const centerY=eave*.54;
          block(group,width+.06,height+.055,.055,timber,x,centerY,z);
          block(group,width,height,.064,windowGlass,x,centerY,z+side*.032);
          block(group,.024,height+.06,.072,mat(0xe1cfac),x,centerY,z+side*.065);
          block(group,width+.04,.028,.073,mat(0xe1cfac),x,centerY,z+side*.065);
          for(const shutterSide of [-1,1])
            block(group,.085,height+.04,.048,shutter,x+shutterSide*(width/2+.075),
              centerY,z+side*.043);
          block(group,width+.11,.041,.13,masonry,x,centerY-height/2-.043,z+side*.055);
        }
      }
    }
    // A sensible chimney stack through the roof at one end.
    block(group,.27,.46,.27,mat(0x998873),
      halfL-dim.bayWidth*.72,eave+rise+.03,-D*.10);
    block(group,.33,.068,.33,mat(0x756655),
      halfL-dim.bayWidth*.72,eave+rise+.27,-D*.10);
  }
  function makeBarn(entry) {
    const rect=scenarioAdapter.boundsWorld(entry.rulesRect);
    const group=new THREE.Group();
    group.position.set(rect.x,terrainY(rect.x,rect.z),rect.z);
    group.scale.set(rect.width/3.65,.78,rect.depth/2.65);
    group.rotation.y=-(entry.rotation||0)*Math.PI/180;
    group.userData.terrainId=entry.id;
    scene.add(group);
    const plank=mat(0x655e51),trim=mat(0x4c443c),roof=mat(0x464c48);
    registerRoof(entry,roof);
    block(group,3.65,.20,2.65,mat(0x918b78),0,.09,0);
    block(group,3.55,1.85,2.53,plank,0,1.02,0);
    // Strong gable and crisp overlapping roof panels.
    const left=block(group,3.98,.13,1.68,roof,0,2.30,.68);
    const right=block(group,3.98,.13,1.68,roof,0,2.30,-.68);
    const pitch=Math.atan2(.95,1.34);
    left.rotation.x=pitch;
    right.rotation.x=-pitch;
    block(group,4,.14,.16,trim,0,2.77,0);
    for(const x of [-1.58,1.58]) {
      block(group,.16,1.92,.14,trim,x,1.02,1.31);
      block(group,.16,1.92,.14,trim,x,1.02,-1.31);
    }
    for(const z of [-1.28,1.28]) {
      for(const x of [-1.1,0,1.1])
        block(group,.09,1.82,.07,trim,x,1.04,z);
    }
    // Paired barn doors and iron braces; visible and functionally readable.
    for(const x of [-.53,.53]) {
      block(group,.98,1.50,.09,mat(0x6c5744),x,.88,1.34);
      block(group,.07,1.42,.11,trim,x+.34,.88,1.39);
      const diagonal=block(group,.075,1.43,.12,trim,x,.88,1.40);
      diagonal.rotation.z=x<0?-.48:.48;
    }
    block(group,.18,.12,.09,mat(0xaaa084),0,1.04,1.45);
    for(const x of [-1.20,1.20])
      block(group,.47,.56,.09,mat(0x343f41),x,1.36,-1.35);
  }
  function makeCompactBuilding(entry) {
    const r=scenarioAdapter.boundsWorld(entry.rulesRect);
    const alongX=r.width>=r.depth;
    const L=Math.max(r.width,r.depth),D=Math.min(r.width,r.depth);
    const group=new THREE.Group();
    group.position.set(r.x,terrainY(r.x,r.z),r.z);
    group.rotation.y=(alongX?0:-Math.PI/2)-(entry.rotation||0)*Math.PI/180;
    group.userData.terrainId=entry.id;
    scene.add(group);
    const church=entry.terrainId==="church",shed=entry.terrainId==="shed";
    const eave=church?.90:shed?.48:.62;
    const rise=church?.50:.33;
    const walls=mat(church?0xc1b6a0:shed?0x7d6851:0xd9c9ae);
    const roof=mat(shed?0x5a5045:entry.appearance?.includes("thatch")?0x8a8062:0xb0583c);
    registerRoof(entry,roof);
    block(group,L,.085,D,mat(0x998e79),0,.04,0);
    block(group,L-.08,eave-.06,D-.09,walls,0,eave/2+.06,0);
    const pitch=Math.atan2(rise,D/2+.09);
    const roofLength=Math.hypot(rise,D/2+.12);
    for(const side of [-1,1]){
      const panel=block(group,L+.12,.055,roofLength+.06,roof,
        0,eave+rise/2,side*(D/2+.12)/2);
      panel.rotation.x=side*pitch;
    }
    block(group,L+.12,.062,.065,mat(0x534236),0,eave+rise,0);
    const doorWidth=Math.min(.28,L*.20);
    block(group,doorWidth,Math.min(.49,eave*.85),.065,mat(0x74563b),
      0,.26,D/2+.04);
    const bays=Math.max(1,Math.floor(L/.65));
    for(let i=0;i<bays;i++){
      const x=-L/2+(i+.5)*L/bays;
      if(Math.abs(x)<doorWidth*.78)continue;
      const height=Math.min(.25,eave*.38);
      for(const side of [-1,1]){
        const z=side*(D/2+.04);
        block(group,.20,height,.055,mat(0x586b70),x,eave*.60,z);
        block(group,.025,height+.03,.07,mat(0xd4c6a8),x,eave*.60,z+side*.023);
      }
    }
    if(church){
      const at=-L*.29;
      block(group,.55,1.25,.58,walls,at,1.03,0);
      const cap=block(group,.72,.08,.72,roof,at,1.69,0);
      cap.rotation.y=Math.PI/4;
      block(group,.055,.38,.055,mat(0x796b54),at,1.92,0);
      block(group,.21,.055,.055,mat(0x796b54),at,1.97,0);
    }
  }
  for(const entry of authoredTerrain.filter(e=>e.renderer==="building")) {
    if(entry.terrainId==="barn")makeBarn(entry);
    else if(entry.terrainId==="long_farmhouse")makeFarmhouse(entry);
    else makeCompactBuilding(entry);
  }

  // Indexed physical cover edges, not the larger abstract collision regions.
  // Only the miniatures use these; the original rules continue to own cover.
  const coverSegments=[];
  // The 2.5-inch movement zone is deliberately NOT a 2.5-inch thick wall.
  // Preserve the invisible rules region for the live movement/cover modules;
  // draw genuinely narrow, hand-laid physical masonry at its centerline.
  function makeAuthoredWall(entry) {
    const r=scenarioAdapter.boundsWorld(entry.rulesRect);
    const dims=scaleSpec.wallDimensions(r);
    const group=new THREE.Group();
    group.position.set(r.x,terrainY(r.x,r.z),r.z);
    group.rotation.y=(dims.alongX?0:-Math.PI/2)-
      (entry.rotation||0)*Math.PI/180;
    group.userData.terrainId=entry.id;
    group.userData.rulesRect=entry.rulesRect;
    scene.add(group);
    const L=dims.length, thick=dims.visibleThickness, height=dims.height;
    const direction=group.rotation.y;
    const tangent={x:Math.cos(direction),z:-Math.sin(direction)};
    coverSegments.push({id:entry.id,kind:"wall",
      a:{x:r.x-tangent.x*L/2,z:r.z-tangent.z*L/2},
      b:{x:r.x+tangent.x*L/2,z:r.z+tangent.z*L/2}});
    const courses=3;
    const stoneHeight=(height-.04)/courses;
    const stoneLength=.22;
    const variants=[0x9e9a88,0xb2ac94,0x8f9081,0xbdb59b,0xaaa18a];
    // No continuous wide base/slab; each stone is part of the actual wall.
    for(let course=0;course<courses;course++){
      const rowCount=Math.ceil(L/stoneLength)+1;
      for(let i=0;i<rowCount;i++){
        const left=-L/2+i*stoneLength+(course%2?stoneLength*.5:0);
        const right=Math.min(L/2,left+stoneLength-.009);
        const boundedLeft=Math.max(-L/2,left);
        if(right<=boundedLeft+.018)continue;
        const cx=(right+boundedLeft)/2, length=right-boundedLeft;
        const color=variants[(i*7+course*3)%variants.length];
        const stone=block(group,length,stoneHeight-.008,
          thick*(.88+((i+course)%3)*.045),mat(color),
          cx,.015+(course+.5)*stoneHeight,0);
        stone.rotation.y=Math.sin(i*1.91+course*5)*.018;
      }
    }
    // Cap is a line of individual coping stones; no giant lid.
    const count=Math.ceil(L/.27);
    for(let i=0;i<count;i++){
      const width=Math.min(.27,L-i*.27);
      block(group,width-.012,.047,Math.min(scaleSpec.model.wallCapThickness,thick+.06),
        mat(variants[(i+2)%variants.length]),
        -L/2+i*.27+width/2,height-.003,0);
    }
  }
  authoredTerrain.filter(e=>e.renderer==="wall").forEach(makeAuthoredWall);

  // Deeply faceted canopies keep trees recognizable as painted model trees.
  function makeTree(x, z, size, paletteIndex) {
    const group = new THREE.Group();
    group.position.set(x, terrainY(x, z), z);
    group.scale.setScalar(.78);
    scene.add(group);
    const bark = mat(0x65503b);
    shape(group, new THREE.CylinderGeometry(.18 * size, .28 * size, 1.5 * size, 7), bark, 0, .75 * size, 0);
    const positions = [
      [0, 2.06, 0, .94],
      [-.62, 1.72, -.20, .72],
      [.61, 1.73, .11, .72],
      [-.10, 1.76, .60, .68],
      [0, 2.49, -.18, .59]
    ];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const color = leafPalette[(paletteIndex + i) % leafPalette.length];
      const leaves = shape(group, new THREE.DodecahedronGeometry(p[3] * size, 0), mat(color), p[0] * size, p[1] * size, p[2] * size);
      leaves.rotation.y = i * .53;
      leaves.rotation.z = i * .1;
    }
    // Tiny exposed roots make it read as model terrain rather than floating foliage.
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const root = block(group, .12 * size, .16 * size, .65 * size, bark, Math.sin(a) * .14 * size, .09 * size, Math.cos(a) * .23 * size);
      root.rotation.y = a;
    }
  }
  // Woods share the authored terrain polygon/rect boundaries.
  // Tree positions are deterministic per unique terrain id.
  function seeded(id) {
    let n=2166136261;
    for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);
    return ()=>{
      n=(Math.imul(n,1664525)+1013904223)>>>0;
      return n/4294967296;
    };
  }
  function makeWoods(entry) {
    const rect=scenarioAdapter.boundsWorld(entry.visualRect);
    const rand=seeded(entry.id);
    const geo=new THREE.PlaneGeometry(rect.width,rect.depth,8,8);
    geo.rotateX(-Math.PI/2);
    const vertices=geo.attributes.position;
    for(let i=0;i<vertices.count;i++){
      const x=rect.x+vertices.getX(i),z=rect.z+vertices.getZ(i);
      vertices.setY(i,terrainY(x,z)+.04);
    }
    geo.computeVertexNormals();
    const floor=shape(scene,geo,mat(0x64774d),rect.x,0,rect.z);
    floor.castShadow=false;
    floor.userData.terrainId=entry.id;
    walkableSurfaceMeshes.push(floor);
    const count=Math.max(7,Math.min(18,Math.round(rect.width*rect.depth*.55)));
    const spawns=Object.values(layout.forces).flatMap(a=>a)
      .map(p=>bridge.toWorld({x:p.x,y:p.y}));
    for(let i=0;i<count;i++){
      let x=rect.x,z=rect.z;
      for(let attempt=0;attempt<26;attempt++){
        x=rect.x+(rand()-.5)*Math.max(.12,rect.width-.5);
        z=rect.z+(rand()-.5)*Math.max(.12,rect.depth-.5);
        if(spawns.every(p=>Math.hypot(p.x-x,p.z-z)>.65))break;
      }
      makeTree(x,z,.48+rand()*.34,i%leafPalette.length);
    }
    for(let i=0;i<count*2;i++){
      const x=rect.x+(rand()-.5)*rect.width*.85;
      const z=rect.z+(rand()-.5)*rect.depth*.85;
      const shrub=shape(scene,new THREE.DodecahedronGeometry(.12+rand()*.13,0),
        mat(leafPalette[(i+2)%leafPalette.length]),
        x,terrainY(x,z)+.14,z);
      shrub.scale.set(1,.72,1);
      shrub.castShadow=false;
    }
  }
  authoredTerrain.filter(e=>["woods","orchard"].includes(e.renderer)).forEach(makeWoods);

  // Reusable field crop renderer for any other authored scenario.
  function makeField(entry) {
    const rect=scenarioAdapter.boundsWorld(entry.visualRect);
    const rows=Math.max(2,Math.round(rect.depth/.3));
    const cols=Math.max(2,Math.round(rect.width/.2));
    const stems=new THREE.InstancedMesh(new THREE.ConeGeometry(.035,.27,4),
      mat(0xbda769),rows*cols);
    const v=new THREE.Object3D();
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=rect.x+(col/(cols-1)-.5)*rect.width*.88;
      const z=rect.z+(row/(rows-1)-.5)*rect.depth*.88;
      v.position.set(x,terrainY(x,z)+.14,z);
      v.rotation.y=((col*7+row*13)%9)*.21;
      v.scale.setScalar(.8+((row*5+col*11)%7)*.045);
      v.updateMatrix();
      stems.setMatrixAt(row*cols+col,v.matrix);
    }
    stems.instanceMatrix.needsUpdate=true;
    stems.castShadow=false;
    scene.add(stems);
  }
  authoredTerrain.filter(e=>e.renderer==="field").forEach(makeField);
  // Stage 14: the same authored linear and polygon definitions the existing
  // terrain geometry module uses are also rendered physically, not flattened
  // into the individual collision rectangles used by game rules.
  function renderPolylineStrip(path, compiled, color, lift=.04, widthMultiplier=1) {
    const samples=window.CrossroadsPathGeometry.samplePath(path,.48);
    const vertices=[],indices=[];
    for(let i=0;i<samples.length;i++){
      const point=samples[i];
      const width=window.CrossroadsLinearTerrain.widthAt(
        compiled.definition,compiled.style,path,point.distance)*bridge.table.worldUnitsPerInch*widthMultiplier;
      const center=bridge.toWorld(point);
      for(const sign of [-1,1]){
        const x=center.x+point.normal.x*width*sign/2;
        const z=center.z+point.normal.y*width*sign/2;
        vertices.push(x,terrainY(x,z)+lift,z);
      }
      if(i<samples.length-1){
        const n=i*2;
        indices.push(n,n+1,n+2,n+1,n+3,n+2);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const surface=shape(scene,geo,new THREE.MeshStandardMaterial({
      color,roughness:1,side:THREE.DoubleSide
    }),0,0,0);
    surface.castShadow=false;
    surface.userData.terrainId=compiled.definition.id;
    walkableSurfaceMeshes.push(surface);
  }
  function renderAuthoredLinearTerrain(){
    const linear=window.CrossroadsLinearTerrain;
    const paths=window.CrossroadsPathGeometry;
    if(!linear||!paths)return;
    const compiled=linear.compileScenario(layout.scenario);
    for(const item of compiled.paths){
      const style=item.style,renderer=style.renderer;
      if(["road","stream","ditch","rail","rail_crossing"].includes(renderer)){
        const color=renderer==="road"?0xae9c74:
          renderer==="stream"?0x697f7c:
          renderer==="rail"?0x83796b:0x857e67;
        renderPolylineStrip(item.path,item,color,.045,renderer==="rail"?.78:1);
        if(renderer==="road")renderPolylineStrip(item.path,item,0xc0ad82,.055,.78);
      }else if(["wall","fence","hedge"].includes(renderer)){
        const steps=paths.samplePath(item.path,.70);
        for(let i=1;i<steps.length;i++){
          const from=bridge.toWorld(steps[i-1]);
          const to=bridge.toWorld(steps[i]);
          const dx=to.x-from.x,dz=to.z-from.z;
          const distance=Math.hypot(dx,dz);
          if(distance<.02)continue;
          const centerX=(from.x+to.x)/2,centerZ=(from.z+to.z)/2;
          coverSegments.push({id:item.path.id||item.definition.id||renderer,
            kind:renderer,a:{x:from.x,z:from.z},b:{x:to.x,z:to.z}});
          const segment=new THREE.Group();
          segment.position.set(centerX,terrainY(centerX,centerZ),centerZ);
          segment.rotation.y=-Math.atan2(dz,dx);
          scene.add(segment);
          const wall=renderer==="wall",hedge=renderer==="hedge";
          block(segment,distance,wall?.33:hedge?.34:.23,
            wall?.18:hedge?.23:.07,
            mat(wall?0xaaa18b:hedge?0x667852:0x806949),
            0,wall?.17:hedge?.19:.28,0);
          if(renderer==="fence"){
            // Layer posts and two independent rails instead of one flat plank.
            for(const x of [-distance/2,distance/2]){
              block(segment,.105,.52,.12,mat(0x5c4938),x,.30,0);
              block(segment,.14,.06,.14,mat(0x897557),x,.56,0);
            }
            for(const y of [.22,.40])
              block(segment,distance,.055,.072,mat(0x786448),0,y,.01);
          }
          if(renderer==="hedge"){
            // Faceted, offset clumps break the large rectangular hedge silhouette.
            const count=Math.min(7,Math.max(2,Math.ceil(distance/.24)));
            for(let k=0;k<count;k++){
              const x=-distance/2+(k+.5)*distance/count;
              const blob=shape(segment,new THREE.DodecahedronGeometry(.15+(k%3)*.025,0),
                mat([0x607448,0x708457,0x516b43][k%3]),
                x,.36+((k%2)*.045),(k%2?-.065:.068));
              blob.scale.set(1.12,.74,.92);
            }
          }
          if(renderer==="wall"){
            // Individual coping stones give physical scale to short stone sections.
            const count=Math.min(12,Math.max(2,Math.ceil(distance/.29)));
            for(let k=0;k<count;k++)
              block(segment,distance/count-.012,.045,.235,
                mat([0xbdb39a,0xa39c86,0xc8b9a0][k%3]),
                -distance/2+(k+.5)*distance/count,.355,0);
          }
        }
      }
    }
  }
  function renderAuthoredTerrainPatches(){
    for(const patch of layout.auxiliary.filter(item=>item.sourceKind==="patch")){
      if(!Array.isArray(patch.points)||patch.points.length<3)continue;
      const shape2d=new THREE.Shape();
      patch.points.forEach((point,i)=>{
        const world=bridge.toWorld(point);
        if(i===0)shape2d.moveTo(world.x,-world.z);
        else shape2d.lineTo(world.x,-world.z);
      });
      shape2d.closePath();
      const geo=new THREE.ShapeGeometry(shape2d);
      geo.rotateX(-Math.PI/2);
      const positions=geo.attributes.position;
      for(let i=0;i<positions.count;i++)
        positions.setY(i,terrainY(positions.getX(i),positions.getZ(i))+.035);
      geo.computeVertexNormals();
      const patchColor=patch.definition.family==="natural"?0x667b55:
        patch.definition.family==="ground"?0xb1a276:0x80816d;
      const mesh=shape(scene,geo,new THREE.MeshStandardMaterial({
        color:patchColor,side:THREE.DoubleSide,roughness:1
      }),0,0,0);
      mesh.castShadow=false;
      mesh.userData.terrainId=patch.id;
      walkableSurfaceMeshes.push(mesh);
    }
  }
  function renderAuthoredScatter(){
    for(const entry of authoredTerrain.filter(e=>
      ["foxholes","haystack","woodpile"].includes(e.renderer))){
      const bounds=scenarioAdapter.boundsWorld(entry.rulesRect);
      const group=new THREE.Group();
      group.position.set(bounds.x,terrainY(bounds.x,bounds.z),bounds.z);
      group.rotation.y=-(entry.rotation||0)*Math.PI/180;
      scene.add(group);
      const width=bounds.width,depth=bounds.depth;
      if(entry.renderer==="foxholes"){
        // Discrete depressions with broken earthen berms, not a giant box.
        const n=Math.max(2,Math.min(5,Math.round(width/.85)));
        for(let i=0;i<n;i++){
          const cx=-width/2+(i+.5)*width/n;
          const pit=shape(group,new THREE.CylinderGeometry(.28,.30,.025,13),
            mat(0x4d4838),cx,.018,0);
          pit.castShadow=false;
          for(let k=0;k<10;k++){
            const theta=k*Math.PI/5;
            const mound=shape(group,new THREE.DodecahedronGeometry(.115+(k%3)*.018,0),
              mat([0x665a42,0x73664c,0x564e3a][k%3]),
              cx+Math.sin(theta)*.29,.065,Math.cos(theta)*.25);
            mound.scale.y=.37;
          }
        }
      } else if(entry.renderer==="haystack"){
        const r=Math.min(width,depth)*.43;
        const hay=shape(group,new THREE.ConeGeometry(r,Math.max(.4,r*1.9),9),
          mat(0xb7a06a),0,Math.max(.4,r*1.9)/2,0);
        hay.rotation.y=.20;
        for(let k=0;k<7;k++){
          const a=k*Math.PI*2/7;
          const tuft=shape(group,new THREE.ConeGeometry(.12,.30,4),
            mat(k%2?0xc6b17a:0xa58c59),
            Math.sin(a)*r*.69,.24,Math.cos(a)*r*.69);
          tuft.rotation.z=Math.sin(a)*.4;
        }
      } else {
        // Short round logs with visible cut ends and staggered stack rows.
        const layers=3;
        for(let layer=0;layer<layers;layer++)
          for(let i=0;i<Math.min(5,Math.max(2,Math.floor(width/.20)-layer));i++){
            const length=Math.min(depth*.88,.80);
            const log=shape(group,new THREE.CylinderGeometry(.085,.087,length,9),
              mat((i+layer)%2?0x6e563d:0x896a48),
              (i-2)*.17+layer*.09,.10+layer*.14,0);
            log.rotation.x=Math.PI/2;
          }
      }
    }
  }
  renderAuthoredLinearTerrain();
  renderAuthoredTerrainPatches();
  renderAuthoredScatter();


  // Stage 6: all real units load at their authored scenario coordinates.
  // No study-specific deployments or unit identities remain in this scene.
  const units=bridge.createScenarioUnits(layout.scenario);
  // Stage 7: the pure 2D movement module receives the SAME normalized
  // terrain instances that the 3D scenery renderers consume.
  const scenarioTerrain=layout.normalized;
  const squads=[];
  const hitBoxes=[];
  const getLivingUnits=()=>units;
  let selectedSquad=null;
  const activeMovements=squadMotion.createTracks();
  window.Crossroads3DAnimationGate=Object.freeze({
    isReady(event){
      if(event?.type!=="shooting")return true;
      const squad=unitLookup.get(event.shooterId);
      return !squad||(!squad.moving&&!activeMovements.get(event.shooterId));
    }
  });
  let pendingTargetId=null,pendingTargetAssessment=null;
  let lastTargetTap=0;
  const movementIntent=window.Crossroads3DMovementIntent.create();
  const movePlanner=window.Crossroads3DMovementIntent.createPlanner();
  let waypointArmed=false,stagedWaypoint=null,waypointDragId=null;
  let waypointDragLast=0;
  const quickMoveEnabled=new URLSearchParams(location.search).get("quickmove")==="1";
  const visualEffects=[];
  const delayedMuzzleBursts=[];
  const casualtyAnimations=[];
  const physicalDice={tray:null,items:[],elapsed:0};
  const orderTextures=new Map();
  function orderTexture(order){
    const label={Advance:"A",Run:"R",Fire:"F",Ambush:"!",Down:"D",
      Rally:"+",Assault:"X"}[order]||"◆";
    if(orderTextures.has(label))return orderTextures.get(label);
    const image=document.createElement("canvas");image.width=64;image.height=64;
    const c=image.getContext("2d");
    c.fillStyle="#f6e4bd";c.font="900 49px system-ui,sans-serif";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText(label,32,33);
    const texture=new THREE.CanvasTexture(image);
    texture.colorSpace=THREE.SRGBColorSpace;
    orderTextures.set(label,texture);
    return texture;
  }
  function clearPhysicalDice(){
    if(physicalDice.tray){
      scene.remove(physicalDice.tray);
      physicalDice.tray.geometry.dispose();
      physicalDice.tray=null;
    }
    for(const die of physicalDice.items){
      scene.remove(die.group);
      die.group.traverse(obj=>obj.geometry?.dispose());
    }
    physicalDice.items.length=0;physicalDice.elapsed=0;
  }
  function showPhysicalDice(stage){
    if(stage.phase==="settle"){clearPhysicalDice();return}
    const numbers=tabletopDice?.valuesFor(stage.event,stage.phase,7)||[];
    if(!numbers.length)return;
    clearPhysicalDice();
    const event=stage.event;
    const focus=unitLookup.get(event.targetId||event.defenderId||event.unitId)||
      unitLookup.get(event.shooterId||event.attackerId);
    const root=focus?.root.position||{x:0,z:0};
    const px=clamp(root.x+1.9,-worldWidth/2+1.3,worldWidth/2-1.3);
    const pz=clamp(root.z+1.4,-worldDepth/2+.8,worldDepth/2-.8);
    const ground=terrainY(px,pz)+.1;
    physicalDice.tray=shape(scene,new THREE.BoxGeometry(2.05,.075,1.05),
      mat(0x5e4c37),px,ground,pz);
    physicalDice.tray.castShadow=false;
    for(let i=0;i<numbers.length;i++){
      const die=new THREE.Group();
      const x=px+((i%4)-1.5)*.40;
      const z=pz+(Math.floor(i/4)-.5)*.40;
      die.position.set(x,ground+.17,z);scene.add(die);
      shape(die,new THREE.BoxGeometry(.255,.255,.255),
        mat(0xe8ddba),0,0,0);
      for(const dot of tabletopDice.pips(numbers[i]))
        shape(die,new THREE.CylinderGeometry(.018,.018,.004,9),
          mat(0x3a4038),dot.x*.070,.129,dot.y*.070);
      physicalDice.items.push({group:die,base:ground+.17,
        index:i,age:0});
    }
  }
  function animatePhysicalDice(dt){
    if(!physicalDice.items.length)return;
    physicalDice.elapsed+=dt;
    for(const item of physicalDice.items){
      item.age+=dt;
      const u=Math.min(1,item.age/.42);
      const k=(1-u);
      item.group.position.y=item.base+k*k*.28;
      item.group.rotation.x=k*k*(item.index%2?-2.2:2.6);
      item.group.rotation.z=k*k*(item.index%3?-1.7:1.9);
      item.group.rotation.y=k*k*(item.index+1)*.8;
    }
    if(physicalDice.elapsed>2.3)clearPhysicalDice();
  }
  // Small shared visual budgets protect mobile WebGL when a whole squad fires.
  const MAX_PARTICLES=84;
  function scheduleFire(origin,target,role="rifle",index=0,soldier=null,recoil=.18){
    delayedMuzzleBursts.push({origin,target,role,soldier,recoil,
      heavy:role==="lmg"||role==="mmg",delay:index*.052});
  }
  function addShotEffect(geometry,color,x,y,z,duration,extra={}){
    if(visualEffects.length>=MAX_PARTICLES)return;
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,
      depthWrite:false,side:THREE.DoubleSide});
    const mesh=shape(scene,geometry,material,x,y,z);
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=10;
    visualEffects.push({mesh,duration,age:0,initialOpacity:material.opacity,...extra});
    return mesh;
  }
  function muzzleBurst(burst){
    const start=burst.origin,end=burst.target;
    const direction=new THREE.Vector3().subVectors(end,start);
    const distance=direction.length();
    if(distance<.05)return;
    direction.normalize();
    const size=burst.heavy?.13:burst.role==="smg"?.10:.085;
    const flash=addShotEffect(new THREE.ConeGeometry(size,size*2.8,5),
      0xffcf75,start.x+direction.x*size,start.y+direction.y*size,
      start.z+direction.z*size,.12);
    if(flash)flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
      direction);
    const spark=addShotEffect(new THREE.SphereGeometry(size*.53,6,4),
      0xffe5a4,start.x,start.y,start.z,.095);
    // Short, irregular streaks are feedback rather than a ballistics simulation.
    if(delayedMuzzleBursts.length%3===0||burst.role==="rifle"){
      const visible=Math.min(distance*.66,3.4);
      const at=start.clone().addScaledVector(direction,visible*.55);
      const streak=addShotEffect(new THREE.BoxGeometry(.024,.024,visible),
        0xe9c989,at.x,at.y,at.z,.065);
      if(streak)streak.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),
        direction);
    }
    const smoke=addShotEffect(new THREE.SphereGeometry(size*.94,7,6),
      0x92958c,start.x+direction.x*.09,start.y+.045,start.z+direction.z*.09,
      burst.heavy?.61:.40,{velocity:{x:direction.x*.12,y:.23,z:direction.z*.12},
        expansion:2.6});
    if(smoke)smoke.material.opacity=.48;
  }
  function impactDust(x,y,z,kind="dirt",scale=1){
    const cover=kind==="cover",hit=kind==="casualty";
    const color=cover?0xb2a891:hit?0xc3aa87:0x9c9277;
    for(let n=0;n<3;n++){
      const theta=n*2.4+scale;
      const offset=.08+n*.035;
      const mesh=addShotEffect(new THREE.DodecahedronGeometry(.065*scale,0),
        color,x+Math.sin(theta)*offset,y+.08,z+Math.cos(theta)*offset,
        .43+n*.07,{velocity:{x:Math.sin(theta)*.24,y:.24+n*.12,
          z:Math.cos(theta)*.24},expansion:2.1});
      if(mesh)mesh.material.opacity=.65;
    }
    const ring=addShotEffect(new THREE.RingGeometry(.09*scale,.13*scale,14),
      cover?0xe0c49c:0xaaa08a,x,y+.03,z,.31,{expansion:2.9});
    if(ring)ring.rotation.x=-Math.PI/2;
  }

  function beginCasualtyRemovals(squad){
    if(!squad)return;
    for(const soldier of squad.soldiers) {
      if(!soldier.pendingRemoval||soldier.casualtyAnimating)continue;
      soldier.casualtyAnimating=true;
      casualtyAnimations.push({soldier,elapsed:0,duration:.58,linger:1.15});
    }
  }
  let frameIndex=0;
  const unitLookup=new Map();
  const markerLayer=document.createElement("div");
  markerLayer.className="miniature-markers";
  markerLayer.setAttribute("aria-hidden","true");
  stage.appendChild(markerLayer);
  const outcomeChip=document.createElement("div");
  outcomeChip.className="mini-impact-outcome";outcomeChip.hidden=true;
  markerLayer.appendChild(outcomeChip);
  let outcomeTarget=null,outcomeUntil=0;
  function showStatus(target,message,color="neutral",duration=1650){
    if(!target)return;
    outcomeTarget=target;
    outcomeChip.textContent=message;
    outcomeChip.className="mini-impact-outcome status-"+color;
    outcomeChip.hidden=false;outcomeUntil=performance.now()+duration;
  }
  function showOutcome(target,event){
    const parts=[];
    if(event.saved>0)parts.push(event.saved+" COVER SAVED");
    if(event.casualties>0)parts.push(event.casualties+" CASUALT"+(event.casualties===1?"Y":"IES"));
    if(event.pinDelta>0)parts.push("+"+event.pinDelta+" PIN");
    if(!parts.length&&event.hits>0)parts.push(event.hits+" HITS");
    outcomeChip.textContent=parts.join(" · ");
    outcomeChip.className="mini-impact-outcome";
    outcomeChip.classList.toggle("casualty",Boolean(event.casualties));
    outcomeChip.hidden=false;
    outcomeTarget=target;outcomeUntil=performance.now()+1700;
  }
  function markerPart(className){
    const item=document.createElement("span");
    item.className=className;
    return item;
  }
  function makeUnitMarker(squad){
    const item=document.createElement("div");
    item.className="miniature-marker";
    const title=markerPart("mini-chip");
    const row=document.createElement("div");row.className="mini-row";
    const pins=markerPart("mini-pins"),order=markerPart("mini-order");
    row.append(pins,order);item.append(title,row);
    markerLayer.append(item);
    squad.marker={item,title,pins,order};
  }
  function updateUnitPresentation(snapshot){
    for(const squad of squads){
      const u=squad.unit;
      const selected=selectedSquad===squad;
      const eligible=snapshot?.phase==="choose-unit"&&
        u.faction===snapshot.faction&&!u.activated&&u.soldiers>0&&
        (!snapshot.snap||snapshot.snap.eligibleIds.includes(u.id));
      const destroyed=u.soldiers<=0;
      if(squad.eligibleRing){
        squad.eligibleRing.visible=eligible&&!selected;
        squad.eligibleRing.material.opacity=eligible?.8:0;
      }
      squad.ring.visible=selected&&!squad.moving&&!destroyed;
      if(squad.commandAura)squad.commandAura.visible=!destroyed&&(
        selected||snapshot?.snap?.officerId===u.id);
      if(squad.eligibleRing&&squad.alertUntil>performance.now())
        squad.eligibleRing.visible=true;
      // Used dice appear only once the soldiers have finished moving.
      squad.orderToken.visible=Boolean(u.order)&&Boolean(u.activated)&&
        !destroyed&&!squad.moving;
      squad.orderFace.visible=squad.orderToken.visible;
      if(squad.arcIndicator)squad.arcIndicator.visible=selected&&!squad.moving&&
        !destroyed&&!u.inBuilding&&u.mmgDeployed&&(!snapshot||["choose-order","choose-target",
        "choose-unit","ambush-reaction"].includes(snapshot.phase));
      if(squad.orderFace.userData.lastOrder!==u.order){
        squad.orderFace.material.map=orderTexture(u.order);
        squad.orderFace.material.needsUpdate=true;
        squad.orderFace.userData.lastOrder=u.order;
      }
      for(let i=0;i<squad.pinTokens.length;i++)
        squad.pinTokens[i].visible=i<Math.min(u.pins||0,5)&&!destroyed;
      const m=squad.marker;
      if(!m)continue;
      // Hide stale labels immediately. The projection pass only unhides the
      // current selected unit, preventing detached unselected text.
      m.item.hidden=true;
      m.item.className="miniature-marker"+(selected?" selected":"")+
        (eligible?" eligible":"")+(destroyed?" destroyed":"");
      m.title.textContent=destroyed?u.name+" · LOST":
        selected?u.name+" · "+u.soldiers+" SOLDIERS"+
          (u.role==="officer"?" · +2 COMMAND":""):
        eligible?u.name+" · READY":u.name;
      m.pins.hidden=!u.pins;
      m.pins.textContent=u.pins+" PIN"+(u.pins===1?"":"S");
      m.order.hidden=!u.order&&!u.activated;
      m.order.textContent=u.order||"USED";
    }
  }
  // Only selected units get a nameplate, at useful zoom and interaction phases.
  // Project every render frame so the single label cannot lag behind its base.
  function placeUnitMarkers(){
    const width=stage.clientWidth,height=stage.clientHeight;
    const state=battle?.snapshot;
    for(const squad of squads){
      const marker=squad.marker?.item;
      if(!marker)continue;
      const show=squad===selectedSquad&&squad.unit.soldiers>0&&
        zoom>=1.12&&(!state||["choose-order","plan-movement",
          "choose-target","choose-assault-target","deployment"].includes(state.phase));
      if(!show){marker.hidden=true;marker.style.display="none";continue}
      const center=squadVisualWorld(squad);
      const ground=terrainY(center.x,center.z);
      const at=new THREE.Vector3(center.x,ground+.92,center.z);
      at.project(camera);
      const x=(at.x*.5+.5)*width,y=(-at.y*.5+.5)*height;
      if(at.z<-1||at.z>1||x<20||x>width-20||y<30||y>height-30){
        marker.hidden=true;marker.style.display="none";continue;
      }
      marker.hidden=false;marker.style.display="flex";
      marker.style.left=x.toFixed(1)+"px";
      marker.style.top=y.toFixed(1)+"px";
    }
    if(outcomeTarget){
      const showing=performance.now()<outcomeUntil;
      if(!showing){outcomeChip.hidden=true;outcomeTarget=null;}
      else{
        const pos=squadVisualWorld(outcomeTarget);
        const at=new THREE.Vector3(pos.x,terrainY(pos.x,pos.z)+1.65,pos.z).project(camera);
        const x=(at.x*.5+.5)*width,y=(-at.y*.5+.5)*height;
        outcomeChip.hidden=!(at.z>=-1&&at.z<=1&&x>=12&&x<=width-12&&y>=32&&y<=height-60);
        if(!outcomeChip.hidden){
          outcomeChip.style.left=Math.max(90,Math.min(width-90,x)).toFixed(1)+"px";
          outcomeChip.style.top=y.toFixed(1)+"px";
        }
      }
    }
    if(previewUnit){
      const pos=squadVisualWorld(previewUnit);
      const view=new THREE.Vector3(pos.x,terrainY(pos.x,pos.z)+1.23,pos.z).project(camera);
      const x=(view.x*.5+.5)*width,y=(-view.y*.5+.5)*height;
      const visible=view.z>=-1&&view.z<=1&&x>30&&x<width-30&&y>40&&y<height-75;
      fireTag.hidden=!visible;
      if(visible){
        fireTag.style.left=Math.max(88,Math.min(width-88,x)).toFixed(1)+"px";
        fireTag.style.top=Math.max(45,Math.min(height-80,y)).toFixed(1)+"px";
      }
    }
  }
  function spawnBriefFlash(x,y,z,color,size=.08,duration=.22) {
    if(visualEffects.length>=MAX_PARTICLES)return;
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.94,depthWrite:false});
    const particle=shape(scene,new THREE.SphereGeometry(size,8,6),material,x,y,z);
    particle.castShadow=false;particle.receiveShadow=false;
    visualEffects.push({mesh:particle,duration,age:0});
  }
  // This director listens to ACTUAL resolved engine events. The old
  // before/after guessed-effects callback is intentionally retired.
  // Place the visual muzzle at an occupied building's visible firing facade.
  // The actual shooting calculation and line-of-sight remain engine-owned.
  function garrisonFiringOutlet(squad,soldier,enemyPosition){
    const id=squad?.unit.inBuilding;
    if(!id||!enemyPosition)return null;
    const roof=roofMaterials.find(r=>r.ids.some(key=>String(key)===String(id)));
    const b=roof?.bounds;
    if(!b)return null;
    const point=new THREE.Vector3();
    soldier.figure.getWorldPosition(point);
    const outlet=garrisonWindows?.outlet(b,point,enemyPosition);
    if(outlet){
      point.x=outlet.x;point.z=outlet.z;
    }else{
    const dx=enemyPosition.x-b.x,dz=enemyPosition.z-b.z;
    if(Math.abs(dx)>Math.abs(dz)){
      point.x=b.x+Math.sign(dx||1)*(b.width/2+.055);
      point.z=clamp(point.z,b.z-b.depth/2+.21,b.z+b.depth/2-.21);
    }else{
      point.x=clamp(point.x,b.x-b.width/2+.21,b.x+b.width/2-.21);
      point.z=b.z+Math.sign(dz||1)*(b.depth/2+.055);
    }
    }
    point.y=terrainY(point.x,point.z)+.66;
    return point;
  }
  function showCombatStage(stage) {
    showPhysicalDice(stage);
    const e=stage.event;
    if(stage.type==="ambush"){
      const squad=unitLookup.get(e.ambusherId);
      if(squad&&stage.phase==="alert"){
        squad.alertUntil=performance.now()+950;
        spawnBriefFlash(squad.root.position.x,.76,squad.root.position.z,
          0xe8bb69,.23,.50);
        if(e.moverId){
          const mover=unitLookup.get(e.moverId);
          if(mover)spawnBriefFlash(mover.root.position.x,.66,mover.root.position.z,
            0xd0896e,.15,.35);
        }
      }
      return;
    }
    if(stage.type==="round-score"){
      if(stage.phase==="score")
        for(const marker of objectiveMarkers)
          spawnBriefFlash(marker.position.x,marker.position.y+.06,marker.position.z,
            0xe5ce78,.19,.65);
      return;
    }
    if(stage.type==="rally"){
      if(stage.phase==="recover"){
        const recovering=unitLookup.get(e.unitId);
        if(recovering){
          spawnBriefFlash(recovering.root.position.x,.64,
            recovering.root.position.z,0xa8cf9e,.30,.70);
          showStatus(recovering,"RALLY · "+(e.removedPins||0)+
            " PINS REMOVED","rally");
          recovering.soldiers.forEach(sol=>{
            sol.crouch=0;sol.hitShock=0;
          });
        }
      }
      return;
    }
    if(stage.type==="order-test"){
      if(stage.phase==="impact"){
        const u=unitLookup.get(e.unitId);
        if(u){
          spawnBriefFlash(u.root.position.x,.58,u.root.position.z,
            e.passed?0xa4c49a:0xcf876f,e.passed?.22:.36,.60);
          showStatus(u,e.passed?
            "ORDER PASSED · "+e.total+"/"+e.target:
            "ORDER FAILED · DOWN",""+(e.passed?"rally":"failed"),2000);
          if(!e.passed){
            u.suppressionImpulse=1;
            u.soldiers.forEach(sol=>sol.hitShock=.5);
          }
        }
      }
      return;
    }
    if(stage.type==="assault"){
      const attacker=unitLookup.get(e.attackerId);
      if(stage.phase==="charge"&&attacker){
        attacker.assaultCharge=.42;
        const defender=unitLookup.get(e.defenderId);
        if(defender&&assaultMotion){
          attacker.assaultVisual=assaultMotion.create(attacker.root.position,
            defender.root.position);
          defender.suppressionImpulse=Math.max(defender.suppressionImpulse||0,.38);
          const aimAttack=motion.heading(attacker.root.position,defender.root.position);
          const aimDefense=motion.heading(defender.root.position,attacker.root.position);
          attacker.soldiers.forEach((soldier,i)=>{
            soldier.aimTarget=aimAttack;soldier.aimDelay=i*.045;
          });
          defender.soldiers.forEach((soldier,i)=>{
            soldier.aimTarget=aimDefense;soldier.aimDelay=i*.038;
          });
        }
        spawnBriefFlash(attacker.root.position.x,.55,attacker.root.position.z,
          0xe3b36b,.19,.42);
      }
      if(stage.phase==="dice"&&attacker){
        const defender=unitLookup.get(e.defenderId);
        if(defender&&assaultMotion&&!defender.assaultVisual)
          defender.assaultVisual=assaultMotion.create(defender.root.position,
            attacker.root.position,{defender:true});
      }
      if(stage.phase!=="impact")return;
      beginCasualtyRemovals(unitLookup.get(e.attackerId));
      beginCasualtyRemovals(unitLookup.get(e.defenderId));
      const defender=unitLookup.get(e.defenderId);
      if(defender&&attacker&&assaultMotion&&!defender.assaultVisual)
        defender.assaultVisual=assaultMotion.create(defender.root.position,
          attacker.root.position,{defender:true});
      for(const id of [e.attackerId,e.defenderId]){
        const squad=unitLookup.get(id);
        if(squad){
          spawnBriefFlash(squad.root.position.x,.50,squad.root.position.z,
            0xc9b693,.26,.52);
          squad.soldiers.forEach((soldier,i)=>{
            if(soldier.figure.visible&&i%2===0)soldier.hitShock=.36;
          });
        }
      }
      const winner=e.winner==="attacker"?attacker:
        e.winner==="defender"?defender:null;
      if(winner){
        outcomeTarget=winner;
        outcomeChip.textContent="ASSAULT WON · "+
          (winner===attacker?e.attackerRemaining:e.defenderRemaining)+" SURVIVORS";
        outcomeChip.classList.remove("casualty");
        outcomeChip.hidden=false;outcomeUntil=performance.now()+1800;
      }
      return;
    }
    if(stage.type!=="shooting")return;
    const shooter=unitLookup.get(e.shooterId);
    const target=unitLookup.get(e.targetId);
    if(stage.phase==="aim"&&shooter&&target){
      const facing=motion.heading(
        {x:shooter.root.position.x,z:shooter.root.position.z},
        {x:target.root.position.x,z:target.root.position.z});
      shooter.soldiers.forEach((soldier,i)=>{
        if(soldier.figure.visible){
          soldier.aimTarget=facing;
          soldier.aimDelay=i*.020;
        }
      });
      if(!pointers.size&&!cameraFocus){
        // Quietly suggest attention without changing the board-centered pivot.
        const x=(shooter.root.position.x+target.root.position.x)/2;
        const z=(shooter.root.position.z+target.root.position.z)/2;
        cameraFocus={x,z};
        focusZoom=zoom;
      }
    }else if(stage.phase==="fire"&&shooter){
      const groups=e.groups||[];
      const firing=weaponPresentation?.schedule(groups,shooter.soldiers.map(s=>
        ({role:s.role,visible:s.figure.visible})))||[];
      shooter.root.updateMatrixWorld(true);
      for(const shot of firing){
        const soldier=shooter.soldiers[shot.soldierIndex];
        // Each shot's recoil is applied when its flash is actually emitted.
        // The muzzle belongs to the actual figure and its rotated weapon.
        const muzzle=soldier.breathing.localToWorld(soldier.muzzleLocal.clone());
        const origin=garrisonFiringOutlet(shooter,soldier,target?.root.position)||muzzle;
        const end=target?target.root.position.clone():shooter.root.position.clone();
        end.x+=Math.sin(shot.soldierIndex*2.37)*.16;
        end.z+=Math.cos(shot.soldierIndex*1.91)*.13;
        end.y=terrainY(end.x,end.z)+.53;
        scheduleFire(origin,end,shot.role,shot.delay/.052,soldier,shot.recoil);
      }
    }else if(stage.phase==="impact"&&target){
      beginCasualtyRemovals(target);
      if(e.hits>0)target.soldiers.forEach((soldier,index)=>{
        if(soldier.figure.visible)
          soldier.hitShock=Math.max(soldier.hitShock||0,
            index%3===0?.40:.22);
      });
      if(e.hits>0){
        const impactKind=e.saved>0?"cover":e.casualties>0?"casualty":"dirt";
        const count=Math.min(5,Math.max(1,e.hits));
        for(let n=0;n<count;n++){
          const dx=Math.sin((n+1)*2.81)*.43;
          const dz=Math.cos((n+1)*2.81)*.39;
          const x=target.root.position.x+dx,z=target.root.position.z+dz;
          impactDust(x,terrainY(x,z),z,impactKind,.8+(n%2)*.3);
        }
        showOutcome(target,e);
      }
      if(e.pinDelta>0){
        target.suppressionImpulse=.85;
        spawnBriefFlash(target.root.position.x,.77,target.root.position.z,
          0xd4a75d,.12,.48);
      }
      if(e.casualties>0){
        const amount=Math.min(e.casualties,6);
        for(let i=0;i<amount;i++)
          spawnBriefFlash(target.root.position.x+Math.sin(i*2.4)*.23,.20,
            target.root.position.z+Math.cos(i*2.4)*.23,0x877563,.13,.55);
      }
    }
  }
  // A physical, thick painted measuring strip—not a one-pixel WebGL line.
  const firePreview=new THREE.Group();
  firePreview.visible=false;firePreview.renderOrder=14;scene.add(firePreview);
  const fireTag=document.createElement("div");
  fireTag.className="mini-fire-preview";
  fireTag.hidden=true;
  markerLayer.appendChild(fireTag);
  let previewUnit=null;
  function clearFirePreview(){
    previewUnit=null;pendingTargetAssessment=null;pendingTargetId=null;
    fireTag.hidden=true;
    firePreview.visible=false;
    for(const m of [...firePreview.children]){
      firePreview.remove(m);m.geometry.dispose();m.material.dispose();
    }
  }
  function showFirePreview(squad,assessment){
    clearFirePreview();
    if(!selectedSquad)return;
    previewUnit=squad;
    pendingTargetId=squad.unit.id;pendingTargetAssessment=assessment;
    fireTag.textContent=shotExplanation?
      shotExplanation.summarize(assessment):
      (assessment.legal?"Legal target":"BLOCKED · "+(assessment.reason||"No legal shot"));
    fireTag.classList.toggle("blocked",!assessment.legal);
    fireTag.hidden=false;
    const a=selectedSquad.root.position,b=squad.root.position;
    const distance=Math.hypot(b.x-a.x,b.z-a.z);
    const color=!assessment.legal?0xc37b65:
      assessment.cover?.saveTarget!=null?0xd2ae64:0xe7c16b;
    const material=new THREE.MeshBasicMaterial({
      color,transparent:true,opacity:.92,depthTest:false
    });
    const count=assessment.legal?1:11;
    for(let i=0;i<count;i++){
      if(!assessment.legal&&i%2)continue;
      const partLength=distance/count;
      const mid=(i+.5)/count;
      const x=a.x+(b.x-a.x)*mid,z=a.z+(b.z-a.z)*mid;
      const line=new THREE.Mesh(new THREE.BoxGeometry(partLength,.026,.095),material.clone());
      line.position.set(x,terrainY(x,z)+.13,z);
      line.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
      line.renderOrder=14;firePreview.add(line);
    }
    const r=squad.unit.role==="officer"?.49:.98;
    const circle=new THREE.Mesh(new THREE.RingGeometry(r,r+.18,44),material.clone());
    circle.rotation.x=-Math.PI/2;
    circle.position.set(b.x,terrainY(b.x,b.z)+.13,b.z);
    circle.renderOrder=14;firePreview.add(circle);
    firePreview.visible=true;
  }
  function confirmTarget(){
    if(!battle||!["choose-target","choose-assault-target"].includes(battle.snapshot?.phase)||
       !pendingTargetId)return false;
    const id=pendingTargetId;
    const assessment=battle.previewTarget(id);
    if(!assessment.legal){
      battle.setHint(assessment.reason||"Target no longer legal");
      const squad=unitLookup.get(id);
      if(squad)showFirePreview(squad,assessment);
      return false;
    }
    clearFirePreview();
    void battle.send("target",{id}).then(reply=>{
      if(reply?.ok===false)battle.setHint(reply.reason||"Target rejected");
    });
    return true;
  }
  window.Crossroads3DTargetTools=Object.freeze({
    getState(){return {id:pendingTargetId,legal:Boolean(pendingTargetAssessment?.legal),
      details:pendingTargetAssessment&&shotExplanation?.describe(pendingTargetAssessment)}},
    confirmTarget,reset:clearFirePreview
  });
  const movePreviewLine=new THREE.Group();
  const rulerMaterial=new THREE.MeshBasicMaterial({
    color:0xe7c16b,transparent:true,opacity:.95,depthTest:false
  });
  movePreviewLine.visible=false;
  movePreviewLine.renderOrder=13;
  scene.add(movePreviewLine);
  const waypointMarker=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.035,20),
    new THREE.MeshBasicMaterial({color:0xd4b56a,depthTest:false}));
  waypointMarker.visible=false;waypointMarker.renderOrder=14;scene.add(waypointMarker);

  function clearWaypoint(){
    stagedWaypoint=null;waypointArmed=false;waypointDragId=null;
    waypointMarker.visible=false;movePlanner.reset();clearMovePreview();
  }
  function positionWaypoint(point){
    const at=bridge.toWorld(point);
    waypointMarker.position.set(at.x,terrainY(at.x,at.z)+.10,at.z);
    waypointMarker.visible=true;
  }
  function visualEndpointClearance(squad,plan){
    if(!squad||!plan?.path?.length)return {legal:true};
    const end=bridge.toWorld(plan.path[plan.path.length-1]);
    const inch=bridge.table.worldUnitsPerInch,origin=squad.root.position;
    const proposed=resolveSquadFormation(squad,end,false,{
      startOrigin:{x:origin.x,z:origin.z},
      startPoints:squad.soldiers.map(sol=>({
        x:sol.figure.position.x,z:sol.figure.position.z
      })),
      end,maxDistance:(plan.allowance||6)*inch,
      forwardBudget:Math.max(0,(plan.allowance||6)-(plan.cost||0))*inch
    });
    const required=inch+2*.42*.37-.008;
    for(const point of proposed.points)
      for(const other of squads){
        if(other===squad||other.unit.faction!==squad.unit.faction||
          other.unit.soldiers<=0)continue;
        for(let i=0;i<Math.min(other.unit.soldiers,other.soldiers.length);i++){
          const model=other.soldiers[i];
          if(!model.figure.visible||model.pendingRemoval)continue;
          const distance=Math.hypot(
            end.x+point.x-other.root.position.x-model.figure.position.x,
            end.z+point.z-other.root.position.z-model.figure.position.z);
          if(distance<required)
            return {legal:false,reason:"A miniature would finish within 1″ "+
              "of "+other.unit.name+". Adjust the destination."};
        }
      }
    return {legal:true};
  }
  function previewMoveDestination(point){
    const assessment=battle.previewMove(point,stagedWaypoint);
    if(!assessment.legal){
      battle.setHint(assessment.reason||"Move blocked by the rules");return false;
    }
    const clearance=visualEndpointClearance(selectedSquad,assessment);
    if(!clearance.legal){battle.setHint(clearance.reason);return false}
    movePlanner.stageDestination(point,assessment);
    movementIntent.remember(point,Date.now());
    showMovePreview(assessment);
    battle.setHint("MOVE "+assessment.cost.toFixed(1)+" / "+assessment.allowance+
      " inches"+(assessment.shortened?" · LIMITED":"")+
      " · Confirm Move or adjust destination");
    return true;
  }
  function previewWaypoint(point){
    const destination=movePlanner.snapshot().destination;
    if(!destination){battle.setHint("Choose a destination first");return false}
    const assessment=battle.previewMove(destination,point);
    if(!assessment.legal){
      battle.setHint(assessment.reason||"Waypoint route blocked");return false;
    }
    const clearance=visualEndpointClearance(selectedSquad,assessment);
    if(!clearance.legal){battle.setHint(clearance.reason);return false}
    if(!movePlanner.stageWaypoint(point,assessment))return false;
    stagedWaypoint=point;waypointArmed=false;
    positionWaypoint(point);showMovePreview(assessment);
    battle.setHint("WAYPOINT · "+assessment.cost.toFixed(1)+" / "+
      assessment.allowance+" inches · Confirm Move");
    return true;
  }
  function confirmMove(){
    if(!battle||battle.snapshot?.phase!=="plan-movement")return false;
    const request=movePlanner.commit();
    if(!request){battle.setHint("Choose a destination first");return false}
    // An authoritative read-only recheck immediately precedes commitment.
    const check=battle.previewMove(request.point,request.waypoint);
    if(!check.legal){
      battle.setHint(check.reason||"This move is no longer legal");return false;
    }
    const clearance=visualEndpointClearance(selectedSquad,check);
    if(!clearance.legal){battle.setHint(clearance.reason);return false}
    if(selectedSquad&&check.path?.length){
      const end=bridge.toWorld(check.path[check.path.length-1]);
      const inch=bridge.table.worldUnitsPerInch;
      selectedSquad.lastMoveConstraints={
        startOrigin:{x:selectedSquad.root.position.x,z:selectedSquad.root.position.z},
        startPoints:selectedSquad.soldiers.map(sol=>({
          x:sol.figure.position.x,z:sol.figure.position.z
        })),
        end,maxDistance:(check.allowance||6)*inch,
        forwardBudget:Math.max(0,(check.allowance||6)-(check.cost||0))*inch
      };
      selectedSquad.formationCache=null;
    }
    clearWaypoint();
    battle.setHint("Movement confirmed — soldiers advancing");
    void battle.send("move",request).then(reply=>{
      if(reply?.ok===false)battle.setHint(reply.reason||"Move rejected");
    });
    return true;
  }
  window.Crossroads3DMoveTools=Object.freeze({
    getState(){return {...movePlanner.snapshot(),placingWaypoint:waypointArmed}},
    confirmMove,
    armWaypoint(){
      if(!battle||battle.snapshot?.phase!=="plan-movement")return false;
      if(!movePlanner.snapshot().destination){
        battle.setHint("Choose a destination first");return false;
      }
      waypointArmed=true;
      battle.setHint("Tap route to place waypoint, or drag existing waypoint");
      return true;
    },
    clearWaypoint(){
      const destination=movePlanner.snapshot().destination;
      if(!destination){clearWaypoint();return}
      const assessment=battle.previewMove(destination,null);
      if(!movePlanner.removeWaypoint(assessment)){
        battle.setHint(assessment.reason||"Direct route blocked");return;
      }
      stagedWaypoint=null;waypointArmed=false;waypointMarker.visible=false;
      showMovePreview(assessment);
      battle.setHint("Waypoint removed · Confirm Move or adjust destination");
    },
    reset(){clearWaypoint();battle?.setHint("Tap ground for a destination")}
  });
  function clearMovePreview(forgetIntent=true){
    if(forgetIntent)movementIntent.clear();
    movePreviewLine.visible=false;
    for(const child of [...movePreviewLine.children]){
      movePreviewLine.remove(child);
      child.geometry?.dispose();
      if(child.material!==rulerMaterial)child.material?.dispose();
    }
  }
  function showMovePreview(plan) {
    if(!selectedSquad||!plan.path?.length)return;
    // Updating ruler meshes must never erase the staged two-tap destination.
    clearMovePreview(false);
    const from=selectedSquad.root.position;
    const checkpoints=[{x:from.x,z:from.z},...plan.path.slice(1).map(bridge.toWorld)];
    for(let i=1;i<checkpoints.length;i++){
      const a=checkpoints[i-1],b=checkpoints[i];
      const fullLength=Math.hypot(b.x-a.x,b.z-a.z);
      const segments=Math.max(1,Math.ceil(fullLength/.32));
      for(let j=0;j<segments;j++){
        const f0=j/segments,f1=(j+1)/segments;
        const x0=a.x+(b.x-a.x)*f0,z0=a.z+(b.z-a.z)*f0;
        const x1=a.x+(b.x-a.x)*f1,z1=a.z+(b.z-a.z)*f1;
        const length=Math.hypot(x1-x0,z1-z0);
        const midX=(x0+x1)/2,midZ=(z0+z1)/2;
        const stripe=new THREE.Mesh(
          new THREE.BoxGeometry(length+.008,.026,.115),rulerMaterial);
        stripe.position.set(midX,terrainY(midX,midZ)+.065,midZ);
        stripe.rotation.y=-Math.atan2(z1-z0,x1-x0);
        stripe.renderOrder=14;
        movePreviewLine.add(stripe);
      }
    }
    const last=checkpoints[checkpoints.length-1];
    // A formation footprint makes the squad's destination legible on the table.
    const radius=selectedSquad.unit.role==="officer"?.51:1.23;
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.105,36),
      new THREE.MeshBasicMaterial({color:0xf0d38a,transparent:true,opacity:.89,
        depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;
    ring.position.set(last.x,terrainY(last.x,last.z)+.083,last.z);
    ring.renderOrder=14;movePreviewLine.add(ring);
    const inch=bridge.table.worldUnitsPerInch;
    const prediction={
      startOrigin:{x:from.x,z:from.z},
      startPoints:selectedSquad.soldiers.map(sol=>({
        x:sol.figure.position.x,z:sol.figure.position.z
      })),
      end:{x:last.x,z:last.z},
      maxDistance:(plan.allowance||6)*inch,
      forwardBudget:Math.max(0,(plan.allowance||6)-(plan.cost||0))*inch
    };
    const predicted=resolveSquadFormation(selectedSquad,last,false,prediction);
    for(let i=0;i<predicted.points.length;i++){
      const slot=predicted.points[i];
      const x=last.x+slot.x,z=last.z+slot.z;
      const ghost=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.025,10),
        new THREE.MeshBasicMaterial({color:0xf1dcac,transparent:true,opacity:.56,
          depthTest:false,depthWrite:false}));
      ghost.position.set(x,terrainY(x,z)+.09,z);
      ghost.renderOrder=14;movePreviewLine.add(ghost);
    }
    movePreviewLine.visible=true;
  }
  const groundRay=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,20);
  // Quantized, bounded cache: terrain surfaces are static throughout a battle.
  // Keeps base-height calculations from raycasting all ground layers at 60fps.
  const footingCache=new Map();
  let groundingRaycasts=0;
  const MINIATURE_SCALE=.37;
  const baseSampleRadius=.42*MINIATURE_SCALE;
  const baseSamples=[
    [0,0],[baseSampleRadius,0],[-baseSampleRadius,0],
    [0,baseSampleRadius],[0,-baseSampleRadius],
    [.707*baseSampleRadius,.707*baseSampleRadius],[-.707*baseSampleRadius,.707*baseSampleRadius],
    [.707*baseSampleRadius,-.707*baseSampleRadius],[-.707*baseSampleRadius,-.707*baseSampleRadius]
  ];
  function footingHeight(x,z) {
    const key=Math.round(x*40)+":"+Math.round(z*40);
    const known=footingCache.get(key);
    if(known!==undefined)return known;
    let top=-Infinity;
    for(const [ox,oz] of baseSamples) {
      groundRay.ray.origin.set(x+ox,8,z+oz);
      const hits=groundRay.intersectObjects(walkableSurfaceMeshes,false);
      groundingRaycasts++;
      if(hits.length)top=Math.max(top,hits[0].point.y);
    }
    const height=Number.isFinite(top)?top:terrainY(x,z);
    if(footingCache.size>2200)footingCache.clear();
    footingCache.set(key,height);
    return height;
  }
  // Use ?perf3d=1 to inspect draw cost and ground-ray count in the console.
  const perfEnabled=new URLSearchParams(location.search).get("perf3d")==="1";
  let perfStart=performance.now(),perfFrames=0,perfDuration=0;
  function squadVisualWorld(squad){
    const anchor=squad?.visualAnchor||{x:0,z:0};
    return visualAnchor.toWorld(squad.root.position,anchor);
  }
  function syncSquadVisualAnchor(squad){
    // The authoritative unit center is never moved. Selection and picking
    // instead follow the actual visible miniature bases.
    const anchor=visualAnchor.resolve(squad.soldiers,squad.unit.soldiers,{
      minRadius:squad.unit.role==="officer"?.50:.58,margin:.31
    });
    const prior=squad.visualAnchor;
    squad.visualAnchor=anchor;
    const center=squadVisualWorld(squad);
    const last=squad.visualAnchorWorld;
    const changed=!prior||!last||
      Math.hypot(prior.x-anchor.x,prior.z-anchor.z)>.025||
      Math.hypot(last.x-center.x,last.z-center.z)>.025;
    squad.visualAnchorWorld=center;
    const height=changed||!Number.isFinite(squad.visualAnchorHeight)?
      footingHeight(center.x,center.z)+.035:squad.visualAnchorHeight;
    squad.visualAnchorHeight=height;
    const scale=anchor.radius/squad.ringBaseRadius;
    const pulse=squad.selectionPulse>0?
      1+Math.sin((1-squad.selectionPulse)*Math.PI)*.17:1;
    squad.ring.position.set(anchor.x,height,anchor.z);
    squad.ring.scale.setScalar(scale*pulse);
    squad.ring.userData.grounded=true;
    squad.eligibleRing.position.set(anchor.x,height+.01,anchor.z);
    squad.eligibleRing.scale.setScalar(
      (anchor.radius+.16)/(squad.ringBaseRadius+.18));
    if(squad.arcIndicator&&squad.soldiers[0]){
      const gun=squad.soldiers[0];
      const wx=squad.root.position.x+gun.figure.position.x;
      const wz=squad.root.position.z+gun.figure.position.z;
      squad.arcIndicator.position.set(gun.figure.position.x,
        footingHeight(wx,wz)+.07,gun.figure.position.z);
      squad.arcIndicator.rotation.y=
        squad.unit.mmgDeployed&&Number.isFinite(squad.unit.mmgFacing)?
          -Math.PI/2-squad.unit.mmgFacing*Math.PI/180:
          gun.figure.rotation.y;
    }
    squad.hitBox.position.x=anchor.x;
    squad.hitBox.position.z=anchor.z;
    const side=Math.max(1.12,anchor.radius*2+.35);
    squad.hitBox.scale.x=side/squad.hitBoxBaseWidth;
    squad.hitBox.scale.z=side/squad.hitBoxBaseDepth;
    // Keep the physical dice beside the painted figures rather than
    // beside an empty origin from which the soldiers reformed.
    const tokenX=anchor.x+anchor.radius+.36;
    squad.orderToken.position.x=tokenX;
    squad.orderToken.position.z=anchor.z-.23;
    squad.orderFace.position.x=tokenX;
    squad.orderFace.position.z=anchor.z-.23;
    for(const pin of squad.pinTokens){
      pin.position.x=anchor.x+anchor.radius+.46;
      pin.position.z=anchor.z+.40;
    }
  }
  function snapSquadToFormation(squad){
    // Initial and replay poses are the settled formation. Never animate
    // a cosmetic spawn from the unit center to a nearby wall or foxhole.
    squad.formationCache=null;
    const resolved=resolveSquadFormation(squad,squad.root.position,false);
    for(let i=0;i<squad.soldiers.length;i++){
      const soldier=squad.soldiers[i];
      const point=resolved.points[i];
      if(!point||i>=squad.unit.soldiers)continue;
      soldier.figure.position.x=point.x;
      soldier.figure.position.z=point.z;
      const wx=squad.root.position.x+point.x;
      const wz=squad.root.position.z+point.z;
      soldier.figure.position.y=footingHeight(wx,wz)-
        (.02-.11/2)*MINIATURE_SCALE+.016;
      soldier.grounded=true;
    }
    squad.formationCache=null;
    syncSquadVisualAnchor(squad);
  }
  function selectSquad(next) {
    const changed=selectedSquad!==next;
    selectedSquad=next;
    for(const squad of squads) {
      squad.ring.visible=squad===next&&!squad.moving&&squad.unit.soldiers>0;
      squad.ring.userData.grounded=false;
    }
    if(next&&changed){
      next.selectionPulse=1;
      cameraFocus=squadVisualWorld(next);
      focusZoom=Math.max(zoom,1.50);
    }
    if(battle)updateUnitPresentation(battle.snapshot);
  }
  const makeSoldier=window.Crossroads3DMiniatureModel?.create({
    THREE,miniatureScale:MINIATURE_SCALE,mat,block,shape,wood,motion,
    miniatureLab,between
  });
  if(!makeSoldier)throw Error("Shared Crossroads 3D miniature model builder missing.");

  // Shared output is used by both the ghost preview and settled soldiers.
  function resolveSquadFormation(squad,world,allowCache=true,plannedMove=null){
    if(!formationLayout)return {points:squad.soldiers.map(s=>
      ({x:s.slotX,z:s.slotZ})),source:"open"};
    const cache=squad.formationCache;
    const living=squad.unit.soldiers;
    if(allowCache&&cache&&frameIndex-cache.frame<20&&cache.living===living&&
       cache.building===(squad.unit.inBuilding||null)&&
       Math.hypot(cache.x-world.x,cache.z-world.z)<.025)
      return cache.value;
    let nearest=null,best=Infinity;
    for(const other of squads){
      if(other===squad||other.unit.faction===squad.unit.faction||
          other.unit.soldiers<=0)continue;
      const d=other.root.position.distanceToSquared(new THREE.Vector3(world.x,0,world.z));
      if(d<best){best=d;nearest=other}
    }
    const threat=nearest?{x:nearest.root.position.x,z:nearest.root.position.z}:null;
    const building=squad.unit.inBuilding;
    const roof=building?roofMaterials.find(r=>r.ids.some(id=>
      String(id)===String(building))):null;
    const movement=plannedMove||squad.lastMoveConstraints;
    const move=movement&&Math.hypot(world.x-movement.end.x,
      world.z-movement.end.z)<.08?movement:null;
    const value=formationLayout.resolve({
      origin:{x:world.x,z:world.z},
      slots:squad.unit.type==="mmgTeam"?
        squad.soldiers.map((s,i)=>[
          {x:0,z:-.16},{x:-.39,z:.22},{x:.42,z:.23}
        ][i]||{x:s.slotX,z:s.slotZ}):
        squad.soldiers.map(s=>({x:s.slotX,z:s.slotZ})),
      living,
      segments:coverSegments,coverPositions,
      buildingBounds:roof?.bounds||null,threat,
      cohesion:bridge.table.worldUnitsPerInch*1.85,move
    });
    if(allowCache)squad.formationCache={
      frame:frameIndex,x:world.x,z:world.z,living,
      building:building||null,value
    };
    return value;
  }
  function createSquadRenderer(unit,index) {
    const root=new THREE.Group(),world=bridge.toWorld(unit);
    root.position.set(world.x,0,world.z);
    scene.add(root);
    const squad={unit,index,root,soldiers:[],moving:false,ring:null,hitBox:null,
      coverCache:null,garrisonCache:null,formationCache:null,
      lastMoveConstraints:null,entrySequence:null,
      controller:bridge.createMovementController(unit,scenarioTerrain,getLivingUnits)};
    for(const slot of bridge.slotsFor(unit))
      makeSoldier(squad,slot.dx,slot.dz,(unit.faction==="red"?Math.PI/2:-Math.PI/2)+.045*(slot.index-2),
        slot.recipe,slot.index,slot.index);
    const radius=unit.role==="officer"?.53:1.27;
    squad.ringBaseRadius=radius;
    if(unit.role==="officer"){
      const r=6*bridge.table.worldUnitsPerInch;
      const aura=shape(root,new THREE.RingGeometry(r-.04,r,72),
        new THREE.MeshBasicMaterial({color:unit.faction==="red"?0xe7a98a:0x8ec9cf,
          transparent:true,opacity:.42,depthWrite:false,depthTest:false,
          side:THREE.DoubleSide}),0,.28,0);
      aura.rotation.x=-Math.PI/2;aura.visible=false;
      aura.castShadow=false;squad.commandAura=aura;
    }
    const ring=shape(root,new THREE.RingGeometry(radius,radius+.13,48),
      new THREE.MeshBasicMaterial({color:0xe7c16b,
        transparent:true,opacity:.96,side:THREE.DoubleSide,
        depthWrite:false,depthTest:false}),0,.32,0);
    ring.rotation.x=-Math.PI/2;
    ring.castShadow=false;
    ring.receiveShadow=false;
    ring.visible=false;
    squad.ring=ring;
    const eligibleRing=shape(root,new THREE.RingGeometry(radius+.18,radius+.27,40),
      new THREE.MeshBasicMaterial({
        color:unit.faction==="red"?0xdc8c71:0x80becb,
        transparent:true,opacity:.78,side:THREE.DoubleSide,
        depthWrite:false,depthTest:false
      }),0,.33,0);
    eligibleRing.rotation.x=-Math.PI/2;
    eligibleRing.visible=false;
    eligibleRing.castShadow=false;
    eligibleRing.receiveShadow=false;
    squad.eligibleRing=eligibleRing;
    // Cosmetic 90 degree guide only: InfantryCore owns all firing legality.
    if(unit.type==="mmgTeam"||unit.role==="support"){
      const sector=new THREE.Group();root.add(sector);
      const fan=shape(sector,new THREE.RingGeometry(.57,4.6,48,1,
        Math.PI/4,Math.PI/2),new THREE.MeshBasicMaterial({
          color:0xdcc287,transparent:true,opacity:.12,side:THREE.DoubleSide,
          depthWrite:false,depthTest:false}),0,0,0);
      fan.rotation.x=-Math.PI/2;fan.renderOrder=5;
      sector.visible=false;squad.arcIndicator=sector;
    }
    // Physical markers remain on the board instead of becoming a large HUD.
    // Order and pin count text is projected separately at low frequency.
    const orderToken=block(root,.265,.235,.265,
      mat(unit.faction==="red"?0xa5614d:0x598c99),radius+.40,.20,-.23);
    orderToken.visible=false;
    squad.orderToken=orderToken;
    const orderFace=shape(root,new THREE.PlaneGeometry(.213,.213),
      new THREE.MeshBasicMaterial({map:orderTexture(unit.order),
        transparent:true,side:THREE.DoubleSide}),
      radius+.40,.323,-.23);
    orderFace.rotation.x=-Math.PI/2;
    orderFace.visible=false;squad.orderFace=orderFace;
    squad.pinTokens=[];
    for(let i=0;i<5;i++){
      const pin=shape(root,new THREE.CylinderGeometry(.105,.112,.050,10),
        mat(0xc99c4d),radius+.48,.17+i*.053,.40);
      pin.visible=false;
      squad.pinTokens.push(pin);
    }
    const hitBox=shape(root,new THREE.BoxGeometry(unit.role==="officer"?1.2:3.1,
      1.3,unit.role==="officer"?1.05:1.85),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false}),
      0,.50,0);
    hitBox.castShadow=false;
    hitBox.receiveShadow=false;
    hitBox.userData.squad=squad;
    squad.hitBox=hitBox;
    squad.hitBoxBaseWidth=unit.role==="officer"?1.2:3.1;
    squad.hitBoxBaseDepth=unit.role==="officer"?1.05:1.85;
    hitBoxes.push(hitBox);
    squads.push(squad);
    unitLookup.set(unit.id,squad);
    makeUnitMarker(squad);
    return squad;
  }
  units.forEach(createSquadRenderer);
  for(const squad of squads)snapSquadToFormation(squad);
  selectSquad(battle ? null : squads[0]);
  miniatureLab?.attach({
    list:()=>squads.map(s=>({id:s.unit.id,name:s.unit.name,count:s.soldiers.length})),
    focus(id,index){
      const squad=unitLookup.get(id);if(!squad)return;
      selectSquad(squad);
      for(const s of squads)for(let i=0;i<s.soldiers.length;i++)
        s.soldiers[i].inspectRing.visible=s===squad&&i===index;
      const soldier=squad.soldiers[index]||squad.soldiers[0];
      cameraFocus={x:squad.root.position.x+soldier.figure.position.x,
        z:squad.root.position.z+soldier.figure.position.z};
      focusZoom=Math.max(zoom,3.2);
    },
    look(id,index,appearance){
      unitLookup.get(id)?.soldiers[index]?.applyLook(appearance);
    },
    pose(id,index,pose){
      for(const s of squads)for(let i=0;i<s.soldiers.length;i++)
        s.soldiers[i].labPose=s.unit.id===id&&i===index?pose:null;
    },
    isolate(id,index,on){
      for(const s of squads){
        s.root.visible=!on||s.unit.id===id;
        for(let i=0;i<s.soldiers.length;i++)
          s.soldiers[i].figure.visible=i<s.unit.soldiers&&
            (!on||(s.unit.id===id&&i===index));
      }
    },
    close(){
      for(const s of squads){
        s.root.visible=true;
        for(let i=0;i<s.soldiers.length;i++){
          const soldier=s.soldiers[i];
          soldier.inspectRing.visible=false;soldier.labPose=null;
          soldier.figure.visible=i<s.unit.soldiers;
        }
      }
    }
  });

  // The original 2D coordinator owns state, rules, activation and dice.
  // When this optional mode is present, the scene only projects snapshots
  // to miniature positions/poses; it never commits logical unit mutations.
  const objectiveMarkers=[];
  if(battle) {
    let lastSnapSignal=null,seenBattleEpoch=null;
    function resetBattlePresentation(snapshot){
      // Restart is not a Run/Advance. Tear down transient state and
      // reconstruct every surviving model from the authoritative snapshot.
      activeMovements.clear();
      delayedMuzzleBursts.length=0;
      casualtyAnimations.length=0;
      for(const e of visualEffects){
        scene.remove(e.mesh);
        e.mesh.geometry?.dispose();e.mesh.material?.dispose();
      }
      visualEffects.length=0;
      clearPhysicalDice();
      clearWaypoint();clearFirePreview();clearMovePreview();
      outcomeChip.hidden=true;outcomeTarget=null;outcomeUntil=0;
      lastSnapSignal=null;
      for(const squad of squads){
        const state=snapshot.units.find(u=>u.id===squad.unit.id);
        if(!state)continue;
        Object.assign(squad.unit,state);
        const dest=bridge.toWorld(state);
        squad.root.position.set(dest.x,0,dest.z);
        squad.moving=false;squad.entrySequence=null;squad.assaultVisual=null;
        squad.assaultCharge=0;squad.suppressionImpulse=0;
        squad.formationCache=null;squad.lastMoveConstraints=null;
        squad.selectionPulse=0;squad.alertUntil=0;
        squad.soldiers.forEach((soldier,i)=>{
          soldier.figure.visible=i<state.soldiers;
          soldier.figure.position.set(soldier.slotX,0,soldier.slotZ);
          soldier.figure.rotation.set(0,
            (state.faction==="red"?Math.PI/2:-Math.PI/2)+.045*(i-2),0);
          soldier.figure.scale.setScalar(MINIATURE_SCALE);
          soldier.breathing.rotation.set(0,0,0);
          soldier.crouch=0;soldier.coverPose=0;
          soldier.hitShock=0;soldier.recoil=0;
          soldier.pendingRemoval=false;soldier.casualtyAnimating=false;
          soldier.aimTarget=null;soldier.grounded=false;
          for(const leg of soldier.legs){
          leg.mesh.rotation.x=leg.side*.08;
          leg.boot.position.y=.17;leg.boot.position.z=-.055;
          leg.shin.rotation.x=0;leg.mesh.scale.y=1;leg.shin.scale.y=1;
        }
        });
      }
      for(const squad of squads)snapSquadToFormation(squad);
      selectSquad(null);
      cameraFocus={x:0,z:0};focusZoom=1;
      stage.classList.remove("battle-resetting");
      // A single-frame board wipe prevents backwards interpolation while
      // the initial footprints settle to the original cover formation.
      stage.classList.add("battle-resetting");
      requestAnimationFrame(()=>stage.classList.remove("battle-resetting"));
    }
    function applyAuthoritativeSnapshot(snapshot) {
      if(!snapshot)return;
      if(seenBattleEpoch===null)seenBattleEpoch=snapshot.battleEpoch??0;
      else if((snapshot.battleEpoch??0)!==seenBattleEpoch){
        seenBattleEpoch=snapshot.battleEpoch??0;
        resetBattlePresentation(snapshot);
      }
      if(snapshot.phase!=="choose-target"&&snapshot.phase!=="choose-assault-target"){
        pendingTargetId=null;
        clearFirePreview();
      }
      if(snapshot.phase!=="plan-movement")clearWaypoint();
      for(const stateUnit of snapshot.units || []) {
        const squad=unitLookup.get(stateUnit.id);
        if(!squad)continue;
        const before={x:squad.root.position.x,z:squad.root.position.z};
        const previousBuilding=squad.unit.inBuilding||null;
        if(buildingVisuals&&previousBuilding!==(stateUnit.inBuilding||null)){
          const buildingId=stateUnit.inBuilding||previousBuilding;
          const roof=roofMaterials.find(r=>r.ids.some(id=>String(id)===String(buildingId)));
          const door=roof&&buildingVisuals.doorFor(roof.bounds,before);
          squad.entrySequence=door?{elapsed:0,duration:.88,
            entering:Boolean(stateUnit.inBuilding),
            door:{x:door.x-before.x,z:door.z-before.z},
            from:squad.soldiers.map(sol=>({x:sol.figure.position.x,z:sol.figure.position.z}))}:null;
        }
        if(squad.unit.soldiers!==stateUnit.soldiers||
           previousBuilding!==(stateUnit.inBuilding||null))
          squad.formationCache=null;
        Object.assign(squad.unit,stateUnit);
        const hasUnshownCasualties=(snapshot.combatEvents||[]).some(e=>
          (e.type==="shooting"&&e.targetId===stateUnit.id&&e.casualties>0)||
          (e.type==="assault"&&
            (e.attackerId===stateUnit.id||e.defenderId===stateUnit.id)));
        squad.soldiers.forEach((soldier,index)=>{
          const alive=index<stateUnit.soldiers;
          if(alive){
            soldier.pendingRemoval=false;
            soldier.figure.visible=true;
            soldier.figure.rotation.z=0;
          } else if(hasUnshownCasualties&&soldier.figure.visible){
            soldier.pendingRemoval=true;
            soldier.pendingRemovalAt=performance.now();
          } else if(!soldier.pendingRemoval){
            soldier.figure.visible=false;
          }
          if(stateUnit.down) soldier.breathing.rotation.x=-.62;
        });
        const end=bridge.toWorld(stateUnit);
        const displacement=Math.hypot(end.x-before.x,end.z-before.z);
        if(displacement>.025) {
          if(!squad.lastMoveConstraints||
             Math.hypot(squad.lastMoveConstraints.end.x-end.x,
               squad.lastMoveConstraints.end.z-end.z)>.08){
            const allowance=(stateUnit.order==="Run"?12:6)*bridge.table.worldUnitsPerInch;
            squad.lastMoveConstraints={
              startOrigin:before,
              startPoints:squad.soldiers.map(sol=>({
                x:sol.figure.position.x,z:sol.figure.position.z
              })),end:{x:end.x,z:end.z},maxDistance:allowance,
              forwardBudget:Math.max(0,allowance-displacement)
            };
          }
          squad.formationCache=null;
          const existing=activeMovements.get(squad.unit.id);
          // A repeated snapshot must not restart an animation already en route.
          if(!existing||Math.hypot(existing.end.x-end.x,existing.end.z-end.z)>.025) {
            const turn=motion.makeTurn(squad.soldiers.map(s=>s.figure.rotation.y),
              motion.heading(before,end));
            const run=stateUnit.order==="Run";
            const duration=motion.travelDuration(displacement,run);
            activeMovements.set(squad.unit.id,{
              squad,plan:null,remote:true,start:before,end,phase:"turn",
              elapsed:0,turn,run,travelDuration:duration,centerProgress:0,
              finishTime:motion.finishTime(duration,squad.soldiers.map(s=>s.gait))
            });
            squad.moving=true;
          }
        }
      }
      const selected=unitLookup.get(snapshot.selectedUnitId||snapshot.deploymentUnitId)||null;
      if(!miniatureLab?.isOpen()&&selectedSquad!==selected)selectSquad(selected);
      updateUnitPresentation(snapshot);
      const signal=snapshot.snap?
        snapshot.snap.officerId+":"+snapshot.snap.remaining:null;
      if(signal&&signal!==lastSnapSignal){
        const officer=unitLookup.get(snapshot.snap.officerId);
        if(officer)spawnBriefFlash(officer.root.position.x,.75,
          officer.root.position.z,0xe9c37b,.35,.83);
        for(const id of snapshot.snap.eligibleIds||[]){
          const squad=unitLookup.get(id);
          if(squad)squad.alertUntil=performance.now()+1050;
        }
      }
      lastSnapSignal=signal;
      updateBuildingRoofs(snapshot);
      updateObjectiveMarkers(snapshot);
      miniatureLab?.refreshIsolation?.();
    }
    battle.subscribe(applyAuthoritativeSnapshot);
    battle.onCombatStage(showCombatStage);
  }

  // Stage 8: real objective markers, painted directly onto the tabletop.
  // These don't resolve objective control; scoring remains owned by the engine.
  const markerPoints=layout.objectives.flatMap(objective=>
    Array.isArray(objective.points)&&objective.points.length?
      objective.points.map(point=>({...point,parentId:objective.id})):
      [objective]);
  for(const objective of markerPoints) {
    if(objective.showMarker===false||!Number.isFinite(objective.x)||
       !Number.isFinite(objective.y))continue;
    const at=bridge.toWorld(objective);
    const radius=Math.max(.22,(objective.radius||1)*bridge.table.worldUnitsPerInch);
    const y=footingHeight(at.x,at.z)+.035;
    const marker=shape(scene,new THREE.RingGeometry(radius-.038,radius,48),
      new THREE.MeshBasicMaterial({color:0xd6be89,transparent:true,opacity:.48,
        depthWrite:false,side:THREE.DoubleSide}),at.x,y,at.z);
    marker.rotation.x=-Math.PI/2;
    marker.castShadow=false;marker.receiveShadow=false;
    marker.userData.objectiveId=objective.id;
    marker.userData.parentObjectiveId=objective.parentId||objective.id;
    objectiveMarkers.push(marker);
    const pole=shape(scene,new THREE.CylinderGeometry(.017,.019,.58,7),
      mat(0x948571),at.x,y+.29,at.z);
    pole.castShadow=false;
    const flag=block(scene,.30,.14,.025,mat(0xb49b72),
      at.x+.15,y+.47,at.z);
    flag.castShadow=false;
    marker.userData.flag=flag;
  }
  function updateObjectiveMarkers(snapshot){
    for(const marker of objectiveMarkers){
      const objective=(snapshot?.objectives||[]).find(o=>
        o.id===marker.userData.parentObjectiveId);
      const point=objective?.points?.find?.(p=>p.id===marker.userData.objectiveId);
      const state=point?.state||objective?.state||"none";
      const color=state==="blue"?0x72c5da:
        state==="red"?0xd89475:state==="contested"?0xf1ca6a:0xd6be89;
      if(marker.userData.lastState!==state){
        marker.userData.lastState=state;
        marker.material.color.setHex(color);
        marker.userData.flag?.material?.color.setHex(color);
        marker.material.opacity=state==="none"?.48:.90;
      }
    }
  }

  if(battle)updateObjectiveMarkers(battle.snapshot);

  // Optional comparison overlay for mapping/debug only; normal players
  // see neither panels nor rectangles. Enable with ?debugTerrain=1.
  if(new URLSearchParams(window.location.search).get("debugTerrain")==="1") {
    console.table(layout.entries.map(e=>({
      id:e.id,type:e.terrainId,x:e.rulesRect.x,y:e.rulesRect.y,
      width:e.rulesRect.width,height:e.rulesRect.height,
      visualWidth:e.visualRect.width,visualHeight:e.visualRect.height
    })));
    for(const entry of layout.entries) {
      const p=scenarioAdapter.boundsWorld(entry.rulesRect);
      const mesh=shape(scene,new THREE.BoxGeometry(p.width,.014,p.depth),
        new THREE.MeshBasicMaterial({
          color:entry.renderer==="building"?0xd6af6e:0x57e5c1,
          wireframe:true,transparent:true,opacity:.92,depthTest:false
        }),p.x,footingHeight(p.x,p.z)+.06,p.z);
      mesh.castShadow=false;
      mesh.receiveShadow=false;
      mesh.rotation.y=-(entry.rotation||0)*Math.PI/180;
    }
  }

  // The ground has subtle negative space; a few wartime props provide scale.
  function crate(x, z, size) {
    const y = terrainY(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    block(g, size, size * .72, size, mat(0x88714c), 0, size * .36, 0);
    for (const side of [-1, 1]) {
      block(g, .06, size * .72, .06, darkWood, side * size * .38, size * .36, size * .50);
      block(g, size, .06, .06, darkWood, 0, size * .36, side * size * .50);
    }
  }
  const barnForCrates=authoredTerrain.find(item=>item.terrainId==="barn");
  if(barnForCrates) {
    const footprint=scenarioAdapter.boundsWorld(barnForCrates.rulesRect);
    crate(footprint.x-.70,footprint.z+footprint.depth/2+.53,.37);
    crate(footprint.x-.20,footprint.z+footprint.depth/2+.56,.30);
  }

  // Camera: horizontal orbit only, locked isometric elevation, orthographic zoom.
  function updateCamera() {
    const radius = 31;
    // Always orbit the board center. Focus and two-finger pan translate the
    // orthographic window, not the camera's orbital pivot.
    camera.position.set(
      Math.sin(yaw)*Math.cos(elevation)*radius,
      .75+Math.sin(elevation)*radius,
      Math.cos(yaw)*Math.cos(elevation)*radius
    );
    camera.lookAt(0,.75,0);
    const h=baseHeight/zoom,aspect=viewportWidth/viewportHeight;
    const dx=target.x,dz=target.z,dy=target.y-.75;
    const horizontal=dx*Math.cos(yaw)-dz*Math.sin(yaw);
    const vertical=dy*Math.cos(elevation)-
      (dx*Math.sin(yaw)+dz*Math.cos(yaw))*Math.sin(elevation);
    camera.left=-h*aspect/2+horizontal;
    camera.right=h*aspect/2+horizontal;
    camera.top=h/2+vertical;
    camera.bottom=-h/2+vertical;
    camera.updateProjectionMatrix();
    window.Crossroads3DCombatAudio?.setListener({yaw,x:target.x,z:target.z});
    // A gesture may query the camera before the next rendered frame.
    camera.updateMatrixWorld();
  }
  function setZoom(value) {
    zoom = clamp(value, .70, 6.75);
    updateCamera();
  }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    viewportWidth = Math.max(1, Math.floor(bounds.width));
    viewportHeight = Math.max(1, Math.floor(bounds.height));
    const aspect = viewportWidth / viewportHeight;
    // On narrow screens, fit the full board rather than clip its wooden edges.
    const diagonal=Math.hypot(worldWidth,worldDepth);
    baseHeight=Math.max(diagonal*.80,
      diagonal*1.00/Math.max(aspect,.28));
    renderer.setSize(viewportWidth, viewportHeight, false);
    updateCamera();
  }
  // Intersect an orthographic screen ray with the physical tabletop. Panning
  // uses the same world coordinates as the 72 x 48-inch board and stays exact
  // at every zoom or camera yaw, including while pinching.
  const panPlane = new THREE.Plane(new THREE.Vector3(0,1,0), -.20);
  const panRay = new THREE.Raycaster();
  const panNdc = new THREE.Vector2();
  function groundAtScreen(clientX,clientY) {
    const rect=canvas.getBoundingClientRect();
    panNdc.set((clientX-rect.left)/rect.width*2-1,
      1-(clientY-rect.top)/rect.height*2);
    panRay.setFromCamera(panNdc,camera);
    return panRay.ray.intersectPlane(panPlane,new THREE.Vector3());
  }
  function moveCameraTarget(delta) {
    if(!delta)return;
    stopCameraFocus();
    target.x=clamp(target.x+delta.x,-worldWidth/2-3,worldWidth/2+3);
    target.z=clamp(target.z+delta.z,-worldDepth/2-3,worldDepth/2+3);
    updateCamera();
  }
  // Suppress Safari's browser double-tap zoom only over the game view.
  canvas.addEventListener("dblclick",event=>{
    event.preventDefault();event.stopPropagation();
  });
  canvas.addEventListener("touchend",event=>{
    if(event.cancelable)event.preventDefault();
  },{passive:false});
  stage.addEventListener("gesturestart",event=>{
    if(event.cancelable)event.preventDefault();
  },{passive:false});
  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    stopCameraFocus();
    const anchored=groundAtScreen(event.clientX,event.clientY);
    setZoom(zoom * Math.exp(-event.deltaY * .0014));
    moveCameraTarget(gestures.targetShift(anchored,groundAtScreen(event.clientX,event.clientY)));
  }, { passive: false });
  // Pointer events can be abandoned by the iOS home/app-switch gesture.
  // Keep native camera state, but never let an abandoned ID masquerade
  // as a second finger when the player returns to the battlefield.
  const pointerGuard=pointerRecovery.createPointerGuard(id=>{
    if(waypointDragId===id){
      waypointDragId=null;waypointArmed=false;
    }
    try{
      if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    }catch(e){/* iOS may already have discarded the capture */}
  });
  const pointers=pointerGuard.pointers;
  const tapStarts=pointerGuard.tapStarts;
  const raycaster = new THREE.Raycaster();
  const tapNdc = new THREE.Vector2();

  function tapGround(clientX,clientY) {
    const rect=canvas.getBoundingClientRect();
    tapNdc.set(((clientX-rect.left)/rect.width)*2-1,
      1-((clientY-rect.top)/rect.height)*2);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(tapNdc,camera);
    if(window.Crossroads3DEditor?.enabled){
      const terrain=raycaster.intersectObject(ground,false);
      if(terrain.length)window.Crossroads3DEditor.handleGround({
        x:terrain[0].point.x,z:terrain[0].point.z});
      return;
    }
    const picked=raycaster.intersectObjects(hitBoxes,false);
    if(picked.length) {
      const pickedSquad=picked[0].object.userData.squad;
      if(miniatureLab?.isOpen()){
        miniatureLab.focusUnit(pickedSquad.unit.id);return;
      }
      if(battle) {
        const phase=battle.snapshot?.phase;
        if(phase==="choose-target"||phase==="choose-assault-target") {
          const assessment=battle.previewTarget(pickedSquad.unit.id);
          showFirePreview(pickedSquad,assessment);
          const weapons=(assessment.weapons||[]).map(g=>g.shots+" "+g.label).join(" · ");
          battle.setHint(assessment.legal?
            (weapons?weapons+" · ":"")+(assessment.cover?.label||"Open ground")+
            " · Confirm Fire/Assault":assessment.reason||"Target blocked");
        }
        else if(phase==="deployment")
          void battle.send("deploy-select",{id:pickedSquad.unit.id});
        else if(phase==="choose-unit"||phase==="choose-order")
          void battle.send("select",{id:pickedSquad.unit.id});
        return;
      }
      selectSquad(pickedSquad);
      return;
    }
    if(battle) {
      const phase=battle.snapshot?.phase;
      if(phase!=="plan-movement"&&phase!=="deployment")return;
      const groundHits=raycaster.intersectObject(ground,false);
      if(!groundHits.length)return;
      const position=bridge.toTable({x:groundHits[0].point.x,z:groundHits[0].point.z});
      if(phase==="deployment") {
        void battle.send("deploy-place",{point:position});
        return;
      }
      if(waypointArmed){previewWaypoint(position);return;}
      // Double-tap remains an optional shortcut. Button confirmation is primary.
      const destination=movementIntent.consumeIfMatch(position,Date.now());
      if(quickMoveEnabled&&destination&&movePlanner.snapshot().destination){
        confirmMove();return;
      }
      previewMoveDestination(position);
      return;
    }
    if(!selectedSquad||activeMovements.size)return;
    const hits=raycaster.intersectObject(ground,false);
    if(!hits.length)return;
    const point=hits[0].point,squad=selectedSquad;
    const plan=squad.controller.planMove({x:point.x,z:point.z},"Advance");
    if(!plan.legal)return; // Shared obstacle, distance and unit separation rules.
    const start={x:squad.root.position.x,z:squad.root.position.z};
    const end=plan.worldEnd,dx=end.x-start.x,dz=end.z-start.z;
    const turn=motion.makeTurn(squad.soldiers.map(s=>s.figure.rotation.y),
      motion.heading(start,end));
    const duration=motion.travelDuration(Math.hypot(dx,dz),false);
    activeMovements.set(squad.unit.id,{squad,plan,start,end,phase:"turn",
      elapsed:0,turn,travelDuration:duration,centerProgress:0,
      finishTime:motion.finishTime(duration,squad.soldiers.map(s=>s.gait))});
    squad.moving=true;
    squad.ring.visible=false;
    squad.ring.userData.grounded=false;
  }
  function waypointScreenDistance(x,y){
    if(!waypointMarker.visible||battle?.snapshot?.phase!=="plan-movement")return Infinity;
    const at=waypointMarker.position.clone().project(camera);
    const bounds=canvas.getBoundingClientRect();
    return Math.hypot((at.x*.5+.5)*bounds.width+bounds.left-x,
      (-at.y*.5+.5)*bounds.height+bounds.top-y);
  }
  function pointerToGroundPoint(x,y){
    const bounds=canvas.getBoundingClientRect();
    tapNdc.set(((x-bounds.left)/bounds.width)*2-1,
      1-((y-bounds.top)/bounds.height)*2);
    raycaster.setFromCamera(tapNdc,camera);
    const hits=raycaster.intersectObject(ground,false);
    return hits.length?bridge.toTable({x:hits[0].point.x,z:hits[0].point.z}):null;
  }
  canvas.addEventListener("pointerdown", function (event) {
    // A native iPhone edge swipe may belong to iOS, not this game.
    // Leave small edge gutters so it cannot capture a half-started orbit.
    if(pointerRecovery.startsInSystemEdge(event,canvas.getBoundingClientRect()))
      return;
    stopCameraFocus();
    pointerGuard.begin(event);
    if(waypointScreenDistance(event.clientX,event.clientY)<38&&
       pointers.size===1){
      waypointDragId=event.pointerId;waypointArmed=true;
    }
    try{canvas.setPointerCapture(event.pointerId)}
    catch(e){pointerGuard.end(event.pointerId)}
  });
  canvas.addEventListener("pointermove", function (event) {
    const tracked=pointerGuard.move(event);
    if(!tracked)return;
    const {old,previousPair,tap}=tracked;
    if(waypointDragId===event.pointerId){
      if(tap)tap.dragged=true;
      const now=performance.now();
      if(now-waypointDragLast>80){
        waypointDragLast=now;
        const point=pointerToGroundPoint(event.clientX,event.clientY);
        if(point)previewWaypoint(point);
      }
      return;
    }
    if (pointers.size === 1) {
      yaw -= (event.clientX-old.x) * .0085;
      updateCamera();
    } else if (pointers.size === 2) {
      const gesture=gestures.twoFingerGesture(previousPair,[...pointers.values()]);
      if (!gesture) return;
      const anchored=groundAtScreen(gesture.previousCenter.x,gesture.previousCenter.y);
      // Pan and pinch stay locked to the current two *real* fingers.
      if (gesture.zoomFactor !== 1) setZoom(zoom*gesture.zoomFactor);
      moveCameraTarget(gestures.targetShift(
        anchored,groundAtScreen(gesture.nextCenter.x,gesture.nextCenter.y)
      ));
    }
  });
  function endPointer(event) {
    if(!pointers.has(event.pointerId))return;
    if(waypointDragId===event.pointerId){
      // An interrupted waypoint drag must not place a point on cancel.
      if(event.type==="pointerup"){
        const point=pointerToGroundPoint(event.clientX,event.clientY);
        if(point)previewWaypoint(point);
      }
      waypointDragId=null;waypointArmed=false;
      pointerGuard.end(event.pointerId);
      return;
    }
    const tap = tapStarts.get(event.pointerId);
    if(event.type==="pointerup" && tap && !tap.dragged && pointers.size===1)
      tapGround(event.clientX,event.clientY);
    pointerGuard.end(event.pointerId);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", function (event) {
    pointerGuard.end(event.pointerId);
  });

  // Mobile Safari sometimes omits pointerup/cancel for an OS edge gesture.
  // Compare pointer identities to real TouchEvent contacts (rather than
  // assuming that every pointer capture eventually produces a release).
  function reconcileNativeTouches(event){
    pointerGuard.reconcileTouches(event.touches);
  }
  canvas.addEventListener("touchstart",reconcileNativeTouches,{passive:true});
  canvas.addEventListener("touchmove",function(event){
    reconcileNativeTouches(event);
    if(pointers.size&&event.cancelable)event.preventDefault();
  },{passive:false});
  window.addEventListener("touchend",function(event){
    // Pointerup may arrive after touchend on some WebKit versions. Wait
    // a turn, and ignore stale checks if a new touch sequence began.
    const generation=pointerGuard.generation;
    const touches=Array.from(event.touches,t=>({
      clientX:t.clientX,clientY:t.clientY
    }));
    setTimeout(()=>{
      if(generation===pointerGuard.generation)
        pointerGuard.reconcileTouches(touches);
    },0);
  },{passive:true});
  window.addEventListener("touchcancel",()=>pointerGuard.reset(true),{passive:true});
  function abandonGesture(){
    pointerGuard.reset();
  }
  window.addEventListener("blur",abandonGesture);
  window.addEventListener("pagehide",abandonGesture);
  window.addEventListener("orientationchange",abandonGesture);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)abandonGesture();
  });

  window.addEventListener("keydown", function (event) {
    const el = event.target;
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
    if (event.key === "ArrowLeft") { stopCameraFocus();yaw -= .13; updateCamera(); }
    if (event.key === "ArrowRight") { stopCameraFocus();yaw += .13; updateCamera(); }
    if (event.key === "+" || event.key === "=") {stopCameraFocus();setZoom(zoom * 1.12);}
    if (event.key === "-" || event.key === "_") {stopCameraFocus();setZoom(zoom / 1.12);}
    if (event.key === "0" || event.key === "Home") {
      yaw=initialYaw;
      target.set(0,.75,0);
      setZoom(1);
    }
  });

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize();

  const clock = new THREE.Clock();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = true;
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) { clock.getDelta(); render(); }
  });
  function render() {
    if (!running) return;
    requestAnimationFrame(render);
    const frameBegin=perfEnabled?performance.now():0;
    const dt = Math.min(clock.getDelta(), .05);
    const t=clock.elapsedTime;
    frameIndex++;
    if(cameraFocus){
      // Camera eases toward a selected unit; never resets orbit/zoom.
      const k=1-Math.exp(-dt*5.8);
      target.x+=(cameraFocus.x-target.x)*k;
      target.z+=(cameraFocus.z-target.z)*k;
      if(focusZoom!==null)zoom+=(focusZoom-zoom)*k;
      if(Math.hypot(cameraFocus.x-target.x,cameraFocus.z-target.z)<.015&&
          (focusZoom===null||Math.abs(focusZoom-zoom)<.015))
        cameraFocus=null;
      updateCamera();
    }
    // Per-squad tracks prevent the old snap-to-end behavior when the
    // coordinator updates a second unit during another unit's presentation.
    for(const [unitId,moving] of activeMovements) {
      const squad=moving.squad;
      moving.elapsed+=dt;
      if(moving.phase==="turn"){
        const u=Math.min(1,moving.elapsed/moving.turn.duration);
        for(let i=0;i<squad.soldiers.length;i++)
          squad.soldiers[i].figure.rotation.y=motion.headingAt(moving.turn.turns[i],u);
        if(u>=1){moving.phase="travel";moving.elapsed=0;}
      }else{
        moving.centerProgress=motion.travelProgress(moving.elapsed,moving.travelDuration);
        squad.root.position.set(
          moving.start.x+(moving.end.x-moving.start.x)*moving.centerProgress,
          0,
          moving.start.z+(moving.end.z-moving.start.z)*moving.centerProgress
        );
        if(squadMotion.movementFinished(moving)){
          squad.root.position.set(moving.end.x,0,moving.end.z);
          // Preserve the last walking poses until the shared formation
          // resolver settles every survivor onto the previewed footprints.
          squad.formationCache=null;
          if(!moving.remote&&moving.plan)squad.controller.commitMove(moving.plan);
          squad.moving=false;
          squad.orderToken.visible=Boolean(squad.unit.order)&&
            Boolean(squad.unit.activated)&&squad.unit.soldiers>0;
          squad.orderFace.visible=squad.orderToken.visible;
          squad.ring.visible=selectedSquad===squad;
          squad.ring.userData.grounded=false;
          for(const soldier of squad.soldiers)soldier.grounded=false;
          activeMovements.delete(unitId);
        }
      }
    }
    for(const squad of squads) {
      const moving=activeMovements.get(squad.unit.id);
      const isWalking=Boolean(moving&&moving.phase==="travel");
      if(squad.alertUntil&&performance.now()>=squad.alertUntil){
        squad.alertUntil=0;
        squad.eligibleRing.visible=false;
      }
      if(squad.assaultCharge>0)squad.assaultCharge=Math.max(0,squad.assaultCharge-dt);
      if(squad.entrySequence&&!isWalking){
        squad.entrySequence.elapsed+=dt;
        if(squad.entrySequence.elapsed>
            squad.entrySequence.duration+(squad.soldiers.length-1)*.10)
          squad.entrySequence=null;
      }
      if(squad.assaultVisual){
        squad.assaultVisual.age+=dt;
        if(squad.assaultVisual.age>=squad.assaultVisual.duration)
          squad.assaultVisual=null;
      }
      if(squad.suppressionImpulse>0)
        squad.suppressionImpulse=Math.max(0,squad.suppressionImpulse-dt*2);
      if(squad.selectionPulse>0)
        squad.selectionPulse=Math.max(0,squad.selectionPulse-dt*2.0);
      for(let soldierIndex=0;soldierIndex<squad.soldiers.length;soldierIndex++){
        const soldier=squad.soldiers[soldierIndex];
        const selection=squad.selectionPulse||0;
        const wiggle=selection>0?
          Math.sin((1-selection)*Math.PI*4+soldierIndex*.4)*
          Math.sin((1-selection)*Math.PI)*.045:0;
        soldier.figure.scale.setScalar(MINIATURE_SCALE*
          (1+(selection>0?Math.sin((1-selection)*Math.PI)*.095:0)));
        if(!soldier.casualtyAnimating)soldier.figure.rotation.z=wiggle;
        if(Number.isFinite(soldier.aimTarget)&&!isWalking){
          if(soldier.aimDelay>0)soldier.aimDelay-=dt;
          else{
            const difference=motion.shortestDelta(soldier.figure.rotation.y,soldier.aimTarget);
            soldier.figure.rotation.y+=difference*Math.min(1,dt*(5.6+soldierIndex%3));
            if(Math.abs(difference)<.014)soldier.aimTarget=null;
          }
        }
        if(battle&&squad.unit.mmgDeployed&&soldierIndex===0&&!isWalking&&
            Number.isFinite(squad.unit.mmgFacing)){
          const facing=-Math.PI/2-squad.unit.mmgFacing*Math.PI/180;
          soldier.figure.rotation.y+=motion.shortestDelta(soldier.figure.rotation.y,
            facing)*Math.min(1,dt*8);
        }
        const ownProgress=isWalking?moving.centerProgress:1;
        const takingSteps=isWalking&&moving.elapsed<moving.travelDuration;
        if(!isWalking){
          const assault=squad.assaultVisual;
          const displacement=assault&&assaultMotion?
            (assaultMotion.individualDisplacement?.(assault,soldierIndex) ??
              assaultMotion.displacement(assault)):0;
          const formation=resolveSquadFormation(squad,squad.root.position);
          const slot=formation.points[soldierIndex]||null;
          let x=(slot?.x??soldier.slotX)+(assault?.dx||0)*displacement;
          let z=(slot?.z??soldier.slotZ)+(assault?.dz||0)*displacement;
          const entry=squad.entrySequence;
          if(entry&&buildingVisuals){
            const progress=Math.max(0,Math.min(1,
              (entry.elapsed-soldierIndex*.10)/entry.duration));
            const at=buildingVisuals.at(entry.from[soldierIndex],
              entry.door,{x,z},progress);
            x=at.x;z=at.z;
            soldier.entryStep=progress>0&&progress<1?Math.sin(progress*Math.PI):0;
          }else soldier.entryStep=0;
          soldier.coverPose=squad.unit.type==="mmgTeam"?
            (soldierIndex===0?.34:.23):
            slot?.cover?(slot.frontRow?.19:.32):0;
          // The selected unit's occupied window shows the active firing facade.
          if(soldier.windowArc){
            soldier.windowArc.visible=Boolean(slot?.kind==="building"&&
              selectedSquad===squad&&!squad.moving);
            if(soldier.windowArc.visible){
              const wx=squad.root.position.x+soldier.figure.position.x;
              const wz=squad.root.position.z+soldier.figure.position.z;
              soldier.windowArc.position.set(soldier.figure.position.x,
                footingHeight(wx,wz)+.07,soldier.figure.position.z);
              soldier.windowArc.rotation.y=motion.heading(
                {x:wx,z:wz},slot.look);
            }
          }
          if(slot?.look&&!assault&&soldier.aimTarget==null&&soldier.recoil<.02){
            const at={x:squad.root.position.x+soldier.figure.position.x,
              z:squad.root.position.z+soldier.figure.position.z};
            const facing=motion.heading(at,slot.look);
            soldier.figure.rotation.y+=motion.shortestDelta(soldier.figure.rotation.y,facing)*
              Math.min(1,dt*2.9);
          }
          const blend=entry?1:slot?Math.min(1,dt*6.5):1;
          const shift=Math.hypot(x-soldier.figure.position.x,z-soldier.figure.position.z);
          soldier.figure.position.x+=(x-soldier.figure.position.x)*blend;
          soldier.figure.position.z+=(z-soldier.figure.position.z)*blend;
          if(slot&&frameIndex%4===0&&shift>.015)soldier.grounded=false;
        }
        if(isWalking) {
          if(soldier.windowArc)soldier.windowArc.visible=false;
          const delta=ownProgress-moving.centerProgress;
          const dx=moving.end.x-moving.start.x,dz=moving.end.z-moving.start.z;
          const length=Math.hypot(dx,dz)||1;
          const lateral=squadMotion.lateralOffset(squad.index,soldierIndex,ownProgress,length);
          soldier.figure.position.x=soldier.slotX+dx*delta-dz/length*lateral;
          soldier.figure.position.z=soldier.slotZ+dz*delta+dx/length*lateral;
          soldier.coverPose=0;
        }
        if(soldier.crossingLift){
          soldier.figure.position.y-=soldier.crossingLift;
          soldier.crossingLift=0;
        }
        if(isWalking||!soldier.grounded){
          const fx=squad.root.position.x+soldier.figure.position.x;
          const fz=squad.root.position.z+soldier.figure.position.z;
          const baseBottom=(.02-.11/2)*MINIATURE_SCALE;
          const nextHeight=footingHeight(fx,fz)-baseBottom+.016;
          soldier.figure.position.y+=(nextHeight-soldier.figure.position.y)*
            (isWalking?Math.min(1,dt*19):1);
          soldier.grounded=!isWalking;
          soldier.lastFootingFrame=frameIndex;
        }
        if(isWalking&&soldierIK&&!reducedMotion){
          const lift=soldierIK.crossingLift({
            x:squad.root.position.x+soldier.figure.position.x,
            z:squad.root.position.z+soldier.figure.position.z
          },moving.start,moving.end,coverSegments);
          soldier.figure.position.y+=lift;
          soldier.crossingLift=lift;
        }
        soldier.breathing.position.y=soldier.baseY-
          (soldier.crouch||0)*.31+(soldier.entryStep||0)*.025;
        if(squad.assaultCharge>0&&!isWalking)
          soldier.breathing.position.y+=Math.sin((.42-squad.assaultCharge)/.42*Math.PI)*.07;
        soldier.hitShock=Math.max(0,(soldier.hitShock||0)-dt*1.7);
        soldier.breathing.rotation.z=(squad.suppressionImpulse||0)*
          Math.sin(soldierIndex*2.7+1)*.13+
          soldier.hitShock*Math.sin(soldierIndex*2.23+1)*.3;
        for(const leg of soldier.legs){
          leg.mesh.rotation.x=leg.side*.08;
          leg.boot.position.y=.17;leg.boot.position.z=-.055;
          leg.shin.rotation.x=0;leg.mesh.scale.y=1;leg.shin.scale.y=1;
        }
        if(takingSteps&&!reducedMotion) {
          const totalDistance=Math.hypot(moving.end.x-moving.start.x,
            moving.end.z-moving.start.z);
          const speed=motion.travelVelocity(moving.elapsed,moving.travelDuration);
          const pose=motion.gaitPose(totalDistance*ownProgress,
            soldier.gait.stepLength,speed/1.2,soldier.gait.phase,moving.run);
          const feet=motion.plantedGait(totalDistance*ownProgress,
            soldier.gait.stepLength,speed/1.2,soldier.gait.phase,moving.run);
          soldier.breathing.position.y+=pose.bob*soldier.gait.bob;
          soldier.breathing.rotation.x=-pose.lean;
          for(const leg of soldier.legs){
            leg.mesh.rotation.x+=pose.legs*leg.side;
            leg.boot.position.y=.17+(leg.side===-1?feet.leftLift:feet.rightLift);
            leg.boot.position.z=-.055+(leg.side===-1?feet.leftReach:feet.rightReach);
          }
        } else {
          soldier.recoil=Math.max(0,(soldier.recoil||0)-dt*1.7);
          const action=squad.unit.down?"down":
            squad.unit.pins>0?"pinned":squad.unit.mmgDeployed?"ambush":"idle";
          const sharedPose=soldierActions?.frame(action,t+soldierIndex*.08,motion);
          const crouch=battle&&squad.unit.down?(sharedPose?.crouch??.69):
            Math.max(soldier.coverPose||0,
              (battle&&squad.unit.pins)?Math.min(.39,
                sharedPose?.crouch??squad.unit.pins*.087):0);
          soldier.crouch+=(crouch-soldier.crouch)*Math.min(1,dt*8);
          if(!soldier.casualtyAnimating){
            for(const leg of soldier.legs)
              leg.mesh.rotation.x+=soldier.crouch*
                (leg.side===-1?1.35:-1.15);
          }
          // Lean into prone/Down cover rather than bending backward.
          soldier.breathing.rotation.x=-Math.max(soldier.crouch*.92,
            sharedPose?.lean||0)-soldier.recoil;
          if(battle&&squad.unit.down){
            soldier.breathing.position.y-=soldier.crouch*.10;
            soldier.figure.rotation.z=0;
          }else if(squad.unit.pins>0&&!soldier.casualtyAnimating){
            soldier.breathing.rotation.z=(sharedPose?.roll||0)*
              Math.min(1,squad.unit.pins/3);
          }
          // Stationary painted miniatures hold a stable physical pose. No
          // breathing/sway loop that looks like jogging in place.
        }
        if(miniatureLab?.isOpen()&&!isWalking&&soldier.labPose){
          if(soldier.labPose==="walk"){
            const gait=motion.gaitPose(t*.75,.47,1,soldier.gait.phase,false);
            soldier.breathing.position.y+=gait.bob*soldier.gait.bob;
            for(const leg of soldier.legs){
              leg.boot.position.y=.17+(leg.side===-1?gait.leftLift:gait.rightLift);
              leg.boot.position.z=-.055+(leg.side===-1?gait.leftReach:gait.rightReach);
            }
          }else if(soldier.labPose==="down"){
            soldier.breathing.position.y=soldier.baseY-.30;
            soldier.breathing.rotation.x=-.64;
          }else if(soldier.labPose==="aim"){
            soldier.breathing.rotation.x=-.13;
          }else if(soldier.labPose==="fire"){
            soldier.breathing.rotation.x=-.13-Math.pow(Math.max(0,
              Math.sin(t*10)),3)*.20;
          }
        }
        if(soldierIK){
          for(const leg of soldier.legs){
            const solved=soldierIK.solve({
              hipY:.54-(soldier.crouch||0)*.20,
              footY:leg.boot.position.y+.07,
              footZ:leg.boot.position.z,
              upper:.255,lower:.255
            });
            for(const [part,segment] of [[leg.mesh,solved.thigh],[leg.shin,solved.shin]]){
              part.position.y=segment.y;
              part.position.z=segment.z;
              part.rotation.x=segment.rotation;
              part.scale.y=segment.length/.255;
            }
          }
        }
      }
      if(!isWalking&&frameIndex%18===0&&squad.orderToken.visible){
        const x=squad.root.position.x+squad.orderToken.position.x;
        const z=squad.root.position.z+squad.orderToken.position.z;
        squad.orderToken.position.y=footingHeight(x,z)+.145;
        squad.orderFace.position.y=squad.orderToken.position.y+.125;
      }
      // The anchored ring, eligible halo, tap hitbox and nameplate must
      // always describe the same rendered figures, even after cover reflow.
      syncSquadVisualAnchor(squad);
    }
    for(let i=delayedMuzzleBursts.length-1;i>=0;i--){
      const burst=delayedMuzzleBursts[i];
      burst.delay-=dt;
      if(burst.delay>0)continue;
      if(burst.soldier)burst.soldier.recoil=Math.max(
        burst.soldier.recoil||0,burst.recoil);
      muzzleBurst(burst);
      delayedMuzzleBursts.splice(i,1);
    }
    for(let i=casualtyAnimations.length-1;i>=0;i--){
      const record=casualtyAnimations[i];
      record.elapsed+=dt;
      const u=Math.min(1,record.elapsed/record.duration);
      record.soldier.figure.rotation.z=-u*1.29;
      record.soldier.breathing.rotation.x=u*.43;
      if(record.elapsed>=record.duration+record.linger){
        record.soldier.figure.visible=false;
        record.soldier.figure.rotation.z=0;
        record.soldier.breathing.rotation.x=0;
        record.soldier.pendingRemoval=false;
        record.soldier.casualtyAnimating=false;
        casualtyAnimations.splice(i,1);
      }
    }
    for(const squad of squads)for(const soldier of squad.soldiers)
      if(soldier.pendingRemoval&&!soldier.casualtyAnimating&&
        performance.now()-(soldier.pendingRemovalAt||0)>2600){
        soldier.figure.visible=false;
        soldier.pendingRemoval=false;
      }
    for(let i=visualEffects.length-1;i>=0;i--){
      const effect=visualEffects[i];
      effect.age+=dt;
      const fraction=Math.min(1,effect.age/effect.duration);
      effect.mesh.material.opacity=Math.max(0,(effect.initialOpacity??.92)*(1-fraction));
      effect.mesh.scale.setScalar(1+fraction*(effect.expansion??.6));
      if(effect.velocity){
        effect.mesh.position.x+=effect.velocity.x*dt;
        effect.mesh.position.y+=effect.velocity.y*dt;
        effect.mesh.position.z+=effect.velocity.z*dt;
      }
      if(effect.age>=effect.duration){
        scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
        visualEffects.splice(i,1);
      }
    }
    animatePhysicalDice(dt);
    // One label max: keep synchronized with camera and soldiers at 60fps.
    placeUnitMarkers();
    if(frameIndex%12===0&&battle?.snapshot?.objectives){
      // Objective tint follows the original scenario-runtime evaluator.
      for(const marker of objectiveMarkers){
        const authoritative=battle.snapshot.objectives.find(o=>
          o.id===marker.userData.objectiveId);
        const owner=authoritative?.state;
        const color=owner==="blue"?0xb7d2a1:
          owner==="red"?0xc89173:
          owner==="contested"?0xe2a66c:0xd6be89;
        if(marker.userData.previousOwner!==owner){
          marker.material.color.setHex(color);
          marker.userData.previousOwner=owner;
        }
      }
    }
    renderer.render(scene, camera);
    if(perfEnabled){
      perfDuration+=performance.now()-frameBegin;
      perfFrames++;
      if(performance.now()-perfStart>3000){
        console.info("[Crossroads 3D perf]",{
          frameMs:(perfDuration/perfFrames).toFixed(2),frames:perfFrames,
          groundRaycasts:groundingRaycasts,cache:footingCache.size,
          drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
          squadTracks:activeMovements.size,
          particles:visualEffects.length,queuedMuzzles:delayedMuzzleBursts.length,
          pendingCasualties:casualtyAnimations.length
        });
        perfFrames=0;perfDuration=0;groundingRaycasts=0;perfStart=performance.now();
      }
    }
  }
  render();
}
