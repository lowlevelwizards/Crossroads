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
  if(!scaleSpec)throw new Error("Shared miniature scale reference missing.");
  if(!scenarioAdapter)throw new Error("3D scenario adapter not loaded.");
  const requestedScenario=new URLSearchParams(window.location.search).get("scenario")||"hold_the_farm";
  const layout=scenarioAdapter.loadScenario(requestedScenario);
  const authoredTerrain=layout.entries;
  const motion = window.CrossroadsDioramaMotion;
  const gestures = window.CrossroadsDioramaGestures;
  if (!gestures) throw new Error("Crossroads 3D touch gestures were not loaded.");
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
  for (const x of [-9.8, 9.8]) {
    for (const z of [-6.65, 6.65]) {
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
  ground.castShadow = false;
  // Sample the actual visible triangles (not the analytical height estimate).
  // Includes grass-color overlays and road surfaces, which sit higher than soil.
  const walkableSurfaceMeshes = [ground];

  // Tonal field patches: no repeating photo texture, no noisy realism.
  const patchColors = [0x6b7c50, 0x87915d, 0x708052, 0x8e9565];
  for (let i = 0; i < 27; i++) {
    const x = between(-9.4, 9.4);
    const z = between(-6.5, 6.5);
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
  for(const entry of authoredTerrain.filter(e=>e.renderer==="building")) {
    if(entry.terrainId==="barn")makeBarn(entry);
    else makeFarmhouse(entry);
  }

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
          const segment=new THREE.Group();
          segment.position.set(centerX,terrainY(centerX,centerZ),centerZ);
          segment.rotation.y=-Math.atan2(dz,dx);
          scene.add(segment);
          const wall=renderer==="wall",hedge=renderer==="hedge";
          block(segment,distance,wall?.33:hedge?.34:.23,
            wall?.18:hedge?.23:.07,
            mat(wall?0xaaa18b:hedge?0x667852:0x806949),
            0,wall?.17:hedge?.19:.28,0);
          if(renderer==="fence")for(const x of [-distance/2,distance/2])
            block(segment,.09,.50,.11,mat(0x6c513d),x,.26,0);
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
  renderAuthoredLinearTerrain();
  renderAuthoredTerrainPatches();


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
  let activeMovement=null;
  let pendingTargetId=null;
  let lastTargetTap=0;
  let pendingMovePoint=null;
  let lastMoveTap=0;
  const movePreviewLine=new THREE.Line(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({color:0xdac78b,transparent:true,opacity:.85,depthTest:false}));
  movePreviewLine.visible=false;
  movePreviewLine.renderOrder=13;
  scene.add(movePreviewLine);
  function clearMovePreview(){
    pendingMovePoint=null;
    movePreviewLine.visible=false;
  }
  function showMovePreview(plan) {
    if(!selectedSquad||!plan.path?.length)return;
    const from=selectedSquad.root.position;
    const to=bridge.toWorld(plan.path[plan.path.length-1]);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute([
      from.x,terrainY(from.x,from.z)+.12,from.z,
      to.x,terrainY(to.x,to.z)+.12,to.z
    ],3));
    movePreviewLine.geometry.dispose();
    movePreviewLine.geometry=geo;
    movePreviewLine.visible=true;
  }
  const groundRay=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,20);
  const MINIATURE_SCALE=.37;
  const baseSampleRadius=.42*MINIATURE_SCALE;
  const baseSamples=[
    [0,0],[baseSampleRadius,0],[-baseSampleRadius,0],
    [0,baseSampleRadius],[0,-baseSampleRadius],
    [.707*baseSampleRadius,.707*baseSampleRadius],[-.707*baseSampleRadius,.707*baseSampleRadius],
    [.707*baseSampleRadius,-.707*baseSampleRadius],[-.707*baseSampleRadius,-.707*baseSampleRadius]
  ];
  function footingHeight(x,z) {
    let top=-Infinity;
    for(const [ox,oz] of baseSamples) {
      groundRay.ray.origin.set(x+ox,8,z+oz);
      const hits=groundRay.intersectObjects(walkableSurfaceMeshes,false);
      if(hits.length)top=Math.max(top,hits[0].point.y);
    }
    return Number.isFinite(top)?top:terrainY(x,z);
  }
  function selectSquad(next) {
    selectedSquad=next;
    for(const squad of squads) {
      squad.ring.visible=squad===next&&!squad.moving;
      squad.ring.userData.grounded=false;
    }
  }
  function makeSoldier(squad, x, z, facing, recipe, variant, index) {
    const figure = new THREE.Group();
    figure.position.set(x, 0, z);
    figure.rotation.y = facing;
    // Approximate 1-inch miniature bases on a true 72x48-inch tabletop.
    // Height is intentionally heroic so facial/weapon silhouettes read on phone.
    figure.scale.setScalar(MINIATURE_SCALE);
    squad.root.add(figure);

    const german=recipe.kit.factionId==="germany";
    const officer=recipe.role==="officer";
    const base = shape(figure, new THREE.CylinderGeometry(.39, .42, .11, 18),
      mat(german?0x333e37:0x3d3f34), 0, .02, 0);
    base.castShadow = true;
    shape(figure, new THREE.CylinderGeometry(.345, .345, .019, 18),
      mat(german?0x6c7763:0x6b7851), 0, .086, 0);
    const uniform=mat(german?(variant%2?0x758076:0x606e65)
      :(variant%2?0x787152:0x89805b));
    const trousers=mat(german?0x515d56:0x696249);
    const leather=mat(german?0x453c34:0x674b35);
    const skin=mat(0xc5a17d);
    const helmet=mat(german?0x53625b:0x677154);
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = block(figure, .15, .39, .19, trousers, side * .125, .34, 0);
      leg.rotation.x = side * .08;
      legs.push({ mesh:leg, side });
      block(figure, .175, .16, .26, leather, side * .125, .17, -.055);
    }
    const breathing = new THREE.Group();
    breathing.position.set(0, .78, 0);
    figure.add(breathing);
    block(breathing, .47, .56, .30, uniform, 0, 0, 0);
    block(breathing, .48, .10, .32, leather, 0, -.20, 0);
    block(breathing, .34, .37, .19, mat(0x665e43), 0, -.025, .235);
    for (const side of [-1, 1]) {
      block(breathing, .11, .38, .07, leather, side * .17, .02, -.169).rotation.z = -side * .21;
    }
    // Arms support a weapon across the chest rather than float beside it.
    for (const side of [-1, 1]) {
      const arm = block(breathing, .15, .42, .19, uniform, side * .28, -.04, -.115);
      arm.rotation.x = -.76;
      arm.rotation.z = side * .19;
      shape(breathing, new THREE.SphereGeometry(.085, 8, 6), skin, side * .27, -.20, -.33);
    }
    block(breathing, .17, .15, .16, skin, 0, .37, 0);
    shape(breathing, new THREE.SphereGeometry(.17, 10, 8), skin, 0, .51, -.01);
    if(officer) {
      shape(breathing,new THREE.CylinderGeometry(.187,.195,.18,10),uniform,0,.66,-.01);
      block(breathing,.40,.045,.25,mat(0x343c34),0,.62,-.13); // peaked cloth cap
    } else {
      shape(breathing,new THREE.SphereGeometry(german?.23:.205,12,8,0,Math.PI*2,0,Math.PI/2),
        helmet,0,.63,-.012);
      shape(breathing,new THREE.CylinderGeometry(german?.245:.212,german?.28:.218,
        german?.09:.055,12),helmet,0,.603,-.012);
      if(german) for(const side of [-1,1])
        block(breathing,.06,.09,.26,helmet,side*.228,.57,-.02); // flared Stahlhelm
    }
    // Sling, stock, receiver and forward-pointing rifle.
    const metal=mat(0x353a33,.16);
    const length=officer?.14:recipe.role==="smg"?.24:recipe.role==="lmg"?.64:.54;
    const center=officer?-.46:recipe.role==="smg"?-.59:recipe.role==="lmg"?-.79:-.74;
    block(breathing,.13,.13,officer?.12:.29,officer?metal:wood,.08,-.15,-.19);
    block(breathing,.12,.14,officer?.15:.30,metal,.08,-.13,officer?-.32:-.43);
    shape(breathing,new THREE.CylinderGeometry(.031,.036,length,7),metal,
      .08,-.105,center).rotation.x=Math.PI/2;
    block(breathing,.055,.14,.07,metal,.08,-.09,center-length*.43);
    if(officer)block(breathing,.07,.18,.07,leather,.08,-.27,-.31);
    if(recipe.role==="smg")block(breathing,.09,.27,.10,metal,.08,-.31,-.43);
    if (recipe.role === "mmg") {
      // Heavy receiver, long mounted barrel and a stable three-legged tripod.
      block(breathing,.22,.26,.32,mat(0x343b36),.08,-.19,-.52);
      block(breathing,.24,.27,.14,leather,-.18,-.22,-.47);
      const muzzle=shape(breathing,new THREE.CylinderGeometry(.065,.055,.73,9),
        mat(0x333a36,.22),.08,-.15,-.94);
      muzzle.rotation.x=Math.PI/2;
      for(const a of [-.75,0,.75]){
        const foot=block(figure,.065,.45,.055,mat(0x343b36),
          Math.sin(a)*.26,.31,-.40+Math.cos(a)*.19);
        foot.rotation.z=Math.sin(a)*.7;
        foot.rotation.x=-.55;
      }
    } else if(recipe.role==="crew") {
      block(breathing,.23,.18,.20,leather,-.20,-.25,.16);
      block(breathing,.19,.16,.16,mat(0x64604a),-.23,-.20,.25);
    } else if (recipe.role === "lmg") {
      block(breathing, .18, .23, .21, mat(0x34392e), .08, -.26, -.54);
      block(breathing, .07, .08, .20, mat(0x34392e), .08, -.12, -.98);
    } else if (recipe.role === "loader") {
      block(breathing, .22, .17, .12, leather, -.20, -.19, .16);
    }
    // A tiny painted cartridge pouch, not another interface marker.
    block(breathing, .17, .15, .14, leather, -.22, -.18, -.09);
    squad.soldiers.push({figure,breathing,legs,phase:between(0,Math.PI*2),
      baseY:.78,grounded:false,gait:motion.gaitFor(squad.index,index),slotX:x,slotZ:z});
    return figure;
  }

  function createSquadRenderer(unit,index) {
    const root=new THREE.Group(),world=bridge.toWorld(unit);
    root.position.set(world.x,0,world.z);
    scene.add(root);
    const squad={unit,index,root,soldiers:[],moving:false,ring:null,hitBox:null,
      controller:bridge.createMovementController(unit,scenarioTerrain,getLivingUnits)};
    for(const slot of bridge.slotsFor(unit))
      makeSoldier(squad,slot.dx,slot.dz,(unit.faction==="red"?Math.PI/2:-Math.PI/2)+.045*(slot.index-2),
        slot.recipe,slot.index,slot.index);
    const radius=unit.role==="officer"?.53:1.27;
    const ring=shape(root,new THREE.RingGeometry(radius,radius+.043,32),
      new THREE.MeshBasicMaterial({color:unit.faction==="red"?0xc5a68c:0xc4cfa9,
        transparent:true,opacity:.73,side:THREE.DoubleSide,depthWrite:false}),0,.32,0);
    ring.rotation.x=-Math.PI/2;
    ring.castShadow=false;
    ring.receiveShadow=false;
    ring.visible=false;
    squad.ring=ring;
    const hitBox=shape(root,new THREE.BoxGeometry(unit.role==="officer"?1.2:3.1,
      1.3,unit.role==="officer"?1.05:1.85),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false}),
      0,.50,0);
    hitBox.castShadow=false;
    hitBox.receiveShadow=false;
    hitBox.userData.squad=squad;
    squad.hitBox=hitBox;
    hitBoxes.push(hitBox);
    squads.push(squad);
    return squad;
  }
  units.forEach(createSquadRenderer);
  selectSquad(battle ? null : squads[0]);

  // The original 2D coordinator owns state, rules, activation and dice.
  // When this optional mode is present, the scene only projects snapshots
  // to miniature positions/poses; it never commits logical unit mutations.
  if(battle) {
    function applyAuthoritativeSnapshot(snapshot) {
      if(!snapshot)return;
      if(snapshot.phase!=="choose-target"&&snapshot.phase!=="choose-assault-target")
        pendingTargetId=null;
      if(snapshot.phase!=="plan-movement")clearMovePreview();
      for(const stateUnit of snapshot.units || []) {
        const squad=squads.find(item=>item.unit.id===stateUnit.id);
        if(!squad)continue;
        const before={x:squad.root.position.x,z:squad.root.position.z};
        Object.assign(squad.unit,stateUnit);
        squad.soldiers.forEach((soldier,index)=>{
          soldier.figure.visible=index<stateUnit.soldiers;
          if(stateUnit.down) soldier.breathing.rotation.x=.37;
        });
        const end=bridge.toWorld(stateUnit);
        const displacement=Math.hypot(end.x-before.x,end.z-before.z);
        if(displacement>.025) {
          if(!activeMovement) {
            const turn=motion.makeTurn(squad.soldiers.map(s=>s.figure.rotation.y),
              motion.heading(before,end));
            const duration=Math.max(.4,displacement/.8);
            activeMovement={squad,plan:null,remote:true,start:before,end,phase:"turn",
              elapsed:0,turn,travelDuration:duration,
              finishTime:motion.finishTime(duration,squad.soldiers.map(s=>s.gait))};
            squad.moving=true;
          } else if(activeMovement.squad!==squad) {
            squad.root.position.set(end.x,0,end.z);
            squad.soldiers.forEach(s=>s.grounded=false);
          }
        }
      }
      const selected=squads.find(item=>item.unit.id===snapshot.selectedUnitId)||null;
      if(selectedSquad!==selected)selectSquad(selected);
    }
    battle.subscribe(applyAuthoritativeSnapshot);
  }

  // Stage 8: real objective markers, painted directly onto the tabletop.
  // These don't resolve objective control; scoring remains owned by the engine.
  const objectiveMarkers=[];
  for(const objective of layout.objectives) {
    if(!Number.isFinite(objective.x)||!Number.isFinite(objective.y))continue;
    const at=bridge.toWorld(objective);
    const radius=Math.max(.22,(objective.radius||1)*bridge.table.worldUnitsPerInch);
    const y=footingHeight(at.x,at.z)+.035;
    const marker=shape(scene,new THREE.RingGeometry(radius-.038,radius,48),
      new THREE.MeshBasicMaterial({color:0xd6be89,transparent:true,opacity:.48,
        depthWrite:false,side:THREE.DoubleSide}),at.x,y,at.z);
    marker.rotation.x=-Math.PI/2;
    marker.castShadow=false;
    marker.receiveShadow=false;
    marker.userData.objectiveId=objective.id;
    objectiveMarkers.push(marker);
    // Small flag pin reads as a practical miniature objective marker.
    const pole=shape(scene,new THREE.CylinderGeometry(.017,.019,.58,7),
      mat(0x948571),at.x,y+.29,at.z);
    pole.castShadow=false;
    const flag=block(scene,.30,.14,.025,mat(0xb49b72),
      at.x+.15,y+.47,at.z);
    flag.castShadow=false;
  }

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
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elevation) * radius,
      target.y + Math.sin(elevation) * radius,
      target.z + Math.cos(yaw) * Math.cos(elevation) * radius
    );
    camera.lookAt(target);
    const h = baseHeight / zoom;
    const aspect = viewportWidth / viewportHeight;
    camera.left = -h * aspect / 2;
    camera.right = h * aspect / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
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
    baseHeight = Math.max(20.3, 25.2 / Math.max(aspect, .28));
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
    target.x=clamp(target.x+delta.x,-worldWidth/2-3,worldWidth/2+3);
    target.z=clamp(target.z+delta.z,-worldDepth/2-3,worldDepth/2+3);
    updateCamera();
  }
  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    const anchored=groundAtScreen(event.clientX,event.clientY);
    setZoom(zoom * Math.exp(-event.deltaY * .0014));
    moveCameraTarget(gestures.targetShift(anchored,groundAtScreen(event.clientX,event.clientY)));
  }, { passive: false });
  const pointers = new Map();
  const tapStarts = new Map();
  const raycaster = new THREE.Raycaster();
  const tapNdc = new THREE.Vector2();

  function tapGround(clientX,clientY) {
    const rect=canvas.getBoundingClientRect();
    tapNdc.set(((clientX-rect.left)/rect.width)*2-1,
      1-((clientY-rect.top)/rect.height)*2);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(tapNdc,camera);
    const picked=raycaster.intersectObjects(hitBoxes,false);
    if(picked.length) {
      const pickedSquad=picked[0].object.userData.squad;
      if(battle) {
        const phase=battle.snapshot?.phase;
        if(phase==="choose-target"||phase==="choose-assault-target") {
          const assessment=battle.previewTarget(pickedSquad.unit.id);
          const now=Date.now();
          if(assessment.legal&&pendingTargetId===pickedSquad.unit.id&&now-lastTargetTap<8000) {
            pendingTargetId=null;
            void battle.send("target",{id:pickedSquad.unit.id});
          } else {
            pendingTargetId=pickedSquad.unit.id;
            lastTargetTap=now;
            battle.setHint(assessment.legal
              ? "Target legal — tap the same squad again to confirm"
              : assessment.reason||"Target is obstructed");
          }
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
      const analysis=battle.previewMove(position);
      if(!analysis.legal) {
        clearMovePreview();
        battle.setHint(analysis.reason||"Movement blocked by game rules");
        return;
      }
      const now=Date.now();
      const repeat=pendingMovePoint&&
        Math.hypot(pendingMovePoint.x-position.x,pendingMovePoint.y-position.y)<.65 &&
        now-lastMoveTap<9000;
      if(repeat) {
        clearMovePreview();
        void battle.send("move",{point:position});
      } else {
        pendingMovePoint=position;
        lastMoveTap=now;
        showMovePreview(analysis);
        battle.setHint("Movement "+analysis.cost.toFixed(1)+
          " / "+analysis.allowance+" inches — tap again to commit");
      }
      return;
    }
    if(!selectedSquad||activeMovement)return;
    const hits=raycaster.intersectObject(ground,false);
    if(!hits.length)return;
    const point=hits[0].point,squad=selectedSquad;
    const plan=squad.controller.planMove({x:point.x,z:point.z},"Advance");
    if(!plan.legal)return; // Shared obstacle, distance and unit separation rules.
    const start={x:squad.root.position.x,z:squad.root.position.z};
    const end=plan.worldEnd,dx=end.x-start.x,dz=end.z-start.z;
    const turn=motion.makeTurn(squad.soldiers.map(s=>s.figure.rotation.y),
      motion.heading(start,end));
    const duration=Math.max(.55,Math.hypot(dx,dz)/.68);
    activeMovement={squad,plan,start,end,phase:"turn",elapsed:0,turn,
      travelDuration:duration,
      finishTime:motion.finishTime(duration,squad.soldiers.map(s=>s.gait))};
    squad.moving=true;
    squad.ring.visible=false;
    squad.ring.userData.grounded=false;
  }
  canvas.addEventListener("pointerdown", function (event) {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
    tapStarts.set(event.pointerId, { x:event.clientX, y:event.clientY, dragged:false });
    if (pointers.size > 1) {
      // A pinch/pan must never accidentally become a squad tap on release.
      for (const tap of tapStarts.values()) tap.dragged = true;
    }
  });
  canvas.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) return;
    const previousPair = pointers.size === 2 ? [...pointers.values()] : null;
    const old = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
    const tap = tapStarts.get(event.pointerId);
    if (tap && Math.hypot(event.clientX-tap.x,event.clientY-tap.y) > 9) tap.dragged=true;
    if (pointers.size === 1) {
      yaw -= (event.clientX-old.x) * .0085;
      updateCamera();
    } else if (pointers.size === 2) {
      const gesture=gestures.twoFingerGesture(previousPair,[...pointers.values()]);
      if (!gesture) return;
      const anchored=groundAtScreen(gesture.previousCenter.x,gesture.previousCenter.y);
      // Pan and pinch are intentionally simultaneous. Reprojecting after
      // zoom keeps the tabletop point under the fingers as they travel.
      if (gesture.zoomFactor !== 1) setZoom(zoom*gesture.zoomFactor);
      moveCameraTarget(gestures.targetShift(
        anchored,groundAtScreen(gesture.nextCenter.x,gesture.nextCenter.y)
      ));
    }
  });
  function endPointer(event) {
    const tap = tapStarts.get(event.pointerId);
    if (event.type === "pointerup" && tap && !tap.dragged && pointers.size === 1) {
      tapGround(event.clientX,event.clientY);
    }
    tapStarts.delete(event.pointerId);
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", function (event) {
    pointers.delete(event.pointerId);
    tapStarts.delete(event.pointerId);
  });
  window.addEventListener("keydown", function (event) {
    const el = event.target;
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
    if (event.key === "ArrowLeft") { yaw -= .13; updateCamera(); }
    if (event.key === "ArrowRight") { yaw += .13; updateCamera(); }
    if (event.key === "+" || event.key === "=") setZoom(zoom * 1.12);
    if (event.key === "-" || event.key === "_") setZoom(zoom / 1.12);
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
    const dt = Math.min(clock.getDelta(), .05);
    const t=clock.elapsedTime;
    const moving=activeMovement;
    let walking=false;
    let centerProgress=0;
    if(moving) {
      const squad=moving.squad;
      moving.elapsed+=dt;
      if(moving.phase==="turn") {
        const u=Math.min(1,moving.elapsed/moving.turn.duration);
        for(let i=0;i<squad.soldiers.length;i++)
          squad.soldiers[i].figure.rotation.y=motion.headingAt(moving.turn.turns[i],u);
        if(u>=1) {moving.phase="travel";moving.elapsed=0;}
      } else {
        walking=true;
        centerProgress=Math.min(1,moving.elapsed/moving.travelDuration);
        squad.root.position.set(
          moving.start.x+(moving.end.x-moving.start.x)*centerProgress,
          0,
          moving.start.z+(moving.end.z-moving.start.z)*centerProgress
        );
        if(moving.elapsed>=moving.finishTime) {
          squad.root.position.set(moving.end.x,0,moving.end.z);
          for(const soldier of squad.soldiers) {
            soldier.figure.position.x=soldier.slotX;
            soldier.figure.position.z=soldier.slotZ;
          }
          if(!moving.remote) squad.controller.commitMove(moving.plan);
          squad.moving=false;
          squad.ring.visible=selectedSquad===squad;
          squad.ring.userData.grounded=false;
          activeMovement=null;
          walking=false;
        }
      }
    }
    for(const squad of squads) {
      const isWalking=walking&&moving?.squad===squad;
      for(const soldier of squad.soldiers) {
        if(isWalking) {
          const ownProgress=motion.progressFor(moving.elapsed,moving.travelDuration,soldier.gait);
          const delta=ownProgress-centerProgress;
          soldier.figure.position.x=soldier.slotX+(moving.end.x-moving.start.x)*delta;
          soldier.figure.position.z=soldier.slotZ+(moving.end.z-moving.start.z)*delta;
        }
        if(isWalking||!soldier.grounded) {
          const fx=squad.root.position.x+soldier.figure.position.x;
          const fz=squad.root.position.z+soldier.figure.position.z;
          const baseBottom=(.02-.11/2)*MINIATURE_SCALE;
          soldier.figure.position.y=footingHeight(fx,fz)-baseBottom+.009;
          soldier.grounded=!isWalking;
        }
        soldier.breathing.position.y=soldier.baseY;
        soldier.breathing.rotation.z=0;
        for(const leg of soldier.legs)leg.mesh.rotation.x=leg.side*.08;
        if(isWalking&&!reducedMotion) {
          const stride=Math.sin(t*soldier.gait.stride+soldier.phase);
          soldier.breathing.position.y+=Math.abs(stride)*soldier.gait.bob;
          soldier.breathing.rotation.x=-.07;
          for(const leg of soldier.legs)leg.mesh.rotation.x+=stride*.46*leg.side;
        } else {
          soldier.breathing.rotation.x=(battle&&squad.unit.down)?.32:0;
          if(!reducedMotion) {
            soldier.breathing.position.y+=Math.sin(t*1.45+soldier.phase)*.007;
            soldier.breathing.rotation.z=Math.sin(t*.72+soldier.phase)*.009;
          }
        }
      }
      if(squad.ring.visible&&!squad.ring.userData.grounded) {
        squad.ring.position.y=footingHeight(squad.root.position.x,squad.root.position.z)+.03;
        squad.ring.userData.grounded=true;
      }
    }
    renderer.render(scene, camera);
  }
  render();
}
