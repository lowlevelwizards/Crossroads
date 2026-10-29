"use strict";
// Independent Three.js miniature inspection scene. No battle iframe, terrain,
// orders, rules controller or mutable live-game state is loaded.
(async () => {
  const canvas=document.getElementById("studioCanvas");
  const stage=document.getElementById("studioStage");
  const loading=document.getElementById("studioLoading");
  const $=id=>document.getElementById(id);
  const motion=window.CrossroadsDioramaMotion;
  const ik=window.Crossroads3DSoldierIK;
  const poses=window.Crossroads3DStudioPoses;
  const catalogue=window.Crossroads3DStudioCatalog;
  const factory=window.Crossroads3DMiniatureModel;
  if(!canvas||!motion||!ik||!poses||!catalogue||!factory){
    if(loading)loading.textContent="Miniature studio dependencies missing.";
    return;
  }
  // Comparison mode lives in the studio, never mutates combat rules.
  const classicCheckbox=document.getElementById("studioClassicModel");
  const silhouetteMode=document.getElementById("studioDisplayMode");
  window.Crossroads3DForceClassicMiniature=false;
  const morphFields={
    headSize:$("studioHeadSize"),bodyWidth:$("studioBodyWidth"),
    packSize:$("studioPackSize"),bootSize:$("studioBootSize")
  };
  const fields={
    uniform:$("studioUniform"),helmet:$("studioHeadwear"),
    pack:$("studioPack"),helmetTint:$("studioHelmetTint"),
    leatherTint:$("studioLeatherTint")
  };
  const kitSelect=$("studioKit"),unitSelect=$("studioUnit"),
    soldierSelect=$("studioSoldier"),poseSelect=$("studioPose");
  const playButton=$("studioPlay"),speed=$("studioSpeed");
  const projectionButton=$("studioProjection");
  const viewButtons=[...document.querySelectorAll("[data-view]")];
  const choices=(select,values)=>select.replaceChildren(
    ...values.map(([value,label])=>{
      const node=document.createElement("option");
      node.value=value;node.textContent=label;return node;
    })
  );
  choices(kitSelect,catalogue.kits().map(kit=>[kit.id,kit.label]));
  choices(unitSelect,catalogue.units().map(unit=>[unit.id,unit.label]));
  choices(poseSelect,poses.ACTIONS);
  kitSelect.value=catalogue.kits().find(x=>x.faction==="poland")?.id||
    catalogue.kits()[0].id;
  unitSelect.value=catalogue.units().find(x=>x.id==="rifleSquad")?.id||
    catalogue.units()[0].id;
  poseSelect.value="idle";
  const profiles=window.Crossroads3DMiniatureProfiles;
  if(!profiles)throw Error("Shared miniature profiles are required");
  const readLook=()=>profiles.read(kitSelect.value,unitSelect.value,
    Number(soldierSelect.value)||0);
  const saveLook=look=>profiles.write(kitSelect.value,unitSelect.value,
    Number(soldierSelect.value)||0,look);
  let THREE;
  try{
    try{THREE=await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js")}
    catch(_){THREE=await import("https://unpkg.com/three@0.180.0/build/three.module.js")}
  }catch(error){
    console.error("Three.js miniature studio could not load",error);
    loading.textContent="WebGL and a network connection are required to inspect miniatures.";
    return;
  }
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
  }catch(error){
    console.error(error);
    loading.textContent="Unable to initialize WebGL on this device.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xe9ecea);
  const hemisphere=new THREE.HemisphereLight(0xffffff,0xbfc3c0,2.2);
  scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffffff,2.2);
  key.position.set(-3,7,-5);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-4;key.shadow.camera.right=4;
  key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
  key.shadow.normalBias=.012;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.8);
  fill.position.set(4,3,6);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),
    new THREE.MeshStandardMaterial({color:0xe9ecea,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.025;
  floor.receiveShadow=true;scene.add(floor);

  // The shared factory uses the exact mesh recipes as the 3D battle scene.
  const material=(hex,metalness=0)=>new THREE.MeshStandardMaterial({
    color:hex,roughness:.91,metalness,flatShading:true
  });
  const block=(parent,width,height,depth,mat,x,y,z)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  };
  const shape=(parent,geometry,mat,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  };
  const sharedWood=material(0x664836);
  const makeSoldier=factory.create({THREE,miniatureScale:1,mat:material,
    block,shape,wood:sharedWood,motion,
    between:(a,b)=>(a+b)/2,miniatureLab:null});
  const actorRoot=new THREE.Group();scene.add(actorRoot);
  let activeFigure=null,activeSoldier=null,flash=null;
  const rigMarkers=new THREE.Group();scene.add(rigMarkers);
  const jointMaterials=[0x486f66,0x8b6e51].map(color=>
    new THREE.MeshBasicMaterial({color,depthTest:false}));
  const joints=[];
  for(let i=0;i<6;i++){
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),
      jointMaterials[i%2]);
    marker.renderOrder=100;rigMarkers.add(marker);joints.push(marker);
  }
  rigMarkers.visible=false;
  function refreshWireframe(){
    if(!activeFigure)return;
    const checked=$("studioWireframe").checked;
    activeFigure.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(mesh.material&&typeof mesh.material.wireframe==="boolean"){
        mesh.material.wireframe=checked;
      }
    });
  }
  const disposeActor=()=>{
    actorRoot.traverse(node=>{
      // Shared sculpture geometry is reused by future soldier builds.
      if(!node.userData?.sharedMiniatureGeometry)node.geometry?.dispose?.();
      if(node.material){
        const array=Array.isArray(node.material)?node.material:[node.material];
        for(const mat of array)if(mat!==sharedWood)mat.dispose?.();
      }
    });
    actorRoot.clear();activeFigure=null;activeSoldier=null;flash=null;
  };
  const refreshPaintInputs=()=>{
    const look=readLook();
    for(const [name,select] of Object.entries(fields))
      select.value=look[name]||((name==="uniform")?"field":
        (name==="helmetTint"||name==="leatherTint")?"issue":"on");
    for(const [name,input] of Object.entries(morphFields)){
      input.value=look[name]||1;
      $(input.dataset.output).textContent=Number(input.value).toFixed(2)+"×";
    }
  };
  const updateRecipe=recipe=>{
    const role=recipe.role==="mmg"?"MMG gunner":recipe.role==="crew"?"Support crew":
      recipe.role==="lmg"?"LMG gunner":recipe.role==="loader"?"LMG loader":
      recipe.role==="officer"?"Officer":recipe.role==="smg"?"Submachine gunner":"Rifleman";
    $("studioRecipe").textContent=role+"  ·  "+recipe.kit.label+
      "  ·  "+(recipe.weaponProfile||"unarmed").replaceAll("-"," ");
  };
  const build=()=>{
    window.Crossroads3DForceClassicMiniature=!!classicCheckbox?.checked;
    const unit=catalogue.buildUnit(unitSelect.value,kitSelect.value);
    const index=Math.max(0,Math.min(unit.soldiers-1,Number(soldierSelect.value)||0));
    disposeActor();
    const recipe=catalogue.soldier(unit.type,unit.kitId,index);
    const squad={root:actorRoot,soldiers:[],unit,index:0};
    activeFigure=makeSoldier(squad,0,0,0,recipe,index,index);
    activeSoldier=squad.soldiers[0];
    // The battlefield uses this figure's own world-space forward (-Z).
    activeSoldier.applyLook(readLook());
    if(activeSoldier.modelVersion===2)applyDisplayMode();
    activeSoldier.setGunDeployed?.(true);
    // The shared factory emits a selection ring, unused in the standalone lab.
    activeSoldier.inspectRing.visible=false;
    activeSoldier.windowArc.visible=false;
    const muzzle=activeSoldier.muzzleLocal;
    flash=new THREE.Mesh(new THREE.SphereGeometry(.125,12,8),
      new THREE.MeshBasicMaterial({color:0xffd78e}));
    flash.position.copy(muzzle);
    activeSoldier.breathing.add(flash);flash.visible=false;
    updateRecipe(recipe);
    refreshWireframe();
    elapsed=0;
    renderPose(0);
  };
  function applyDisplayMode(){
    if(!activeSoldier||activeSoldier.modelVersion!==2)return;
    const mode=silhouetteMode?.value||"equipped";
    if(activeSoldier.equipmentRoot)
      activeSoldier.equipmentRoot.visible=mode==="equipped";
    if(activeSoldier.uniformRoot)
      activeSoldier.uniformRoot.visible=mode!=="body";
  }
  classicCheckbox?.addEventListener("change",build);
  silhouetteMode?.addEventListener("change",applyDisplayMode);
    const refreshSoldierList=()=>{
    const unit=catalogue.buildUnit(unitSelect.value,kitSelect.value);
    choices(soldierSelect,Array.from({length:unit.soldiers},(_,i)=>{
      const recipe=catalogue.soldier(unit.type,unit.kitId,i);
      const title=recipe.role==="mmg"?"MMG gunner":recipe.role==="crew"?"Crew":
        recipe.role==="lmg"?"LMG gunner":recipe.role==="loader"?"Loader":
        recipe.role==="smg"?"SMG":recipe.role==="officer"?"Officer":"Rifle";
      return [String(i),("0"+(i+1)).slice(-2)+" / "+title];
    }));
    soldierSelect.value="0";
    refreshPaintInputs();build();
  };
  kitSelect.addEventListener("change",refreshSoldierList);
  unitSelect.addEventListener("change",refreshSoldierList);
  soldierSelect.addEventListener("change",()=>{refreshPaintInputs();build()});
  for(const [name,select] of Object.entries(fields)){
    select.addEventListener("change",()=>{
      const look={...readLook(),[name]:select.value};
      saveLook(look);activeSoldier?.applyLook(look);
    });
  }
  for(const [name,input] of Object.entries(morphFields)){
    input.addEventListener("input",()=>{
      const look=saveLook({...readLook(),[name]:Number(input.value)});
      $(input.dataset.output).textContent=Number(look[name]).toFixed(2)+"×";
      activeSoldier?.applyLook(look);
    });
  }
  $("studioClearPaint").addEventListener("click",()=>{
    profiles.reset(kitSelect.value,unitSelect.value,Number(soldierSelect.value)||0);
    refreshPaintInputs();activeSoldier?.applyLook(readLook());
  });

  const perspective=new THREE.PerspectiveCamera(34,1,.03,100);
  const orthographic=new THREE.OrthographicCamera(-2,2,2,-2,.03,100);
  let isOrtho=false;
  let orbitTheta=Math.PI,orbitPolar=1.21,radius=4.5,orthoHeight=2.55;
  let target=new THREE.Vector3(0,.84,-.10),currentCamera=perspective;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function applyCamera(){
    currentCamera=isOrtho?orthographic:perspective;
    const sin=Math.sin(orbitPolar);
    currentCamera.position.set(
      target.x+radius*sin*Math.sin(orbitTheta),
      target.y+radius*Math.cos(orbitPolar),
      target.z+radius*sin*Math.cos(orbitTheta)
    );
    currentCamera.lookAt(target);
    currentCamera.updateProjectionMatrix();
    viewButtons.forEach(button=>button.classList.remove("active"));
  }
  function cameraView(name){
    const points={
      front:[Math.PI,Math.PI/2],back:[0,Math.PI/2],
      right:[Math.PI/2,Math.PI/2],left:[-Math.PI/2,Math.PI/2],
      top:[Math.PI,.07]
    };
    const point=points[name]||points.front;
    orbitTheta=point[0];orbitPolar=point[1];applyCamera();
    viewButtons.forEach(button=>
      button.classList.toggle("active",button.dataset.view===name));
  }
  function zoom(factor){
    radius=clamp(radius*factor,1.45,14);
    orthoHeight=clamp(orthoHeight*factor,.66,8);
    resize();
  }
  function pan(dx,dy){
    applyCamera();
    const height=Math.max(1,stage.clientHeight);
    const amount=isOrtho?orthoHeight:radius*Math.tan(perspective.fov*Math.PI/360)*2;
    const right=new THREE.Vector3(1,0,0).applyQuaternion(currentCamera.quaternion);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(currentCamera.quaternion);
    target.addScaledVector(right,-dx*amount/height);
    target.addScaledVector(up,dy*amount/height);
    applyCamera();
  }
  function resetView(){
    target.set(0,.84,-.10);radius=4.5;orthoHeight=2.55;
    cameraView("front");orbitPolar=1.21;applyCamera();
  }
  for(const button of viewButtons)
    button.addEventListener("click",()=>cameraView(button.dataset.view));
  projectionButton.addEventListener("click",()=>{
    isOrtho=!isOrtho;projectionButton.setAttribute("aria-pressed",String(isOrtho));
    projectionButton.textContent=isOrtho?"PERSPECTIVE":"ORTHOGRAPHIC";
    resize();applyCamera();
  });
  $("studioReset").addEventListener("click",resetView);

  const pointers=new Map();
  canvas.addEventListener("pointerdown",event=>{
    if(event.pointerType==="mouse"&&event.button!==0&&event.button!==1&&event.button!==2)return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,button:event.button});
  });
  canvas.addEventListener("pointermove",event=>{
    const previous=pointers.get(event.pointerId);
    if(!previous)return;
    const before=[...pointers.values()];
    const updated={...previous,x:event.clientX,y:event.clientY};
    pointers.set(event.pointerId,updated);
    const after=[...pointers.values()];
    const dx=updated.x-previous.x,dy=updated.y-previous.y;
    if(after.length===1){
      if(event.buttons===2||previous.button===2||previous.button===1)pan(dx,dy);
      else{
        orbitTheta-=dx*.008;
        orbitPolar=clamp(orbitPolar-dy*.007,.045,Math.PI-.06);
        applyCamera();
      }
    }else if(after.length>=2){
      const a=before.slice(0,2),b=after.slice(0,2);
      const length=pair=>Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y);
      const beforeLength=length(a),afterLength=length(b);
      if(beforeLength>5&&afterLength>5)zoom(beforeLength/afterLength);
      pan(((b[0].x+b[1].x)-(a[0].x+a[1].x))/2,
        ((b[0].y+b[1].y)-(a[0].y+a[1].y))/2);
    }
  },{passive:false});
  const clearPointer=e=>pointers.delete(e.pointerId);
  for(const name of ["pointerup","pointercancel","lostpointercapture"])
    canvas.addEventListener(name,clearPointer);
  canvas.addEventListener("wheel",event=>{
    event.preventDefault();zoom(Math.exp(event.deltaY*.0014));
  },{passive:false});
  canvas.addEventListener("contextmenu",event=>event.preventDefault());
  canvas.addEventListener("dblclick",resetView);
  window.addEventListener("blur",()=>pointers.clear());
  const resize=()=>{
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    renderer.setSize(w,h,false);
    perspective.aspect=w/h;perspective.updateProjectionMatrix();
    orthographic.left=-orthoHeight*w/h/2;orthographic.right=orthoHeight*w/h/2;
    orthographic.top=orthoHeight/2;orthographic.bottom=-orthoHeight/2;
    orthographic.updateProjectionMatrix();
    applyCamera();
  };
  window.addEventListener("resize",resize);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(resize).observe(stage);
  resize();resetView();

  let elapsed=0,playing=true,playSpeed=1;
  const timeline=$("studioTimeline"),timelineValue=$("studioTimelineValue");
  function syncTimeline(){
    const duration=poses.duration(poseSelect.value);
    timeline.value=Math.round((elapsed%duration)/duration*1000);
    timelineValue.textContent=elapsed.toFixed(2)+"s";
  }
  $("studioShowJoints").addEventListener("change",()=>{
    rigMarkers.visible=$("studioShowJoints").checked;
  });
  $("studioWireframe").addEventListener("change",refreshWireframe);
  function renderPose(t){
    const soldier=activeSoldier;
    if(!soldier)return;
    const pose=poses.frame(poseSelect.value,t,motion);
    if(soldier.setGunDeployed)
      soldier.setGunDeployed(poseSelect.value==="pack"?t<.9:
        poseSelect.value==="deploy"?t>=.9:true);
    if(soldier.applyPose){
      // The body falls independently of the fixed miniature base.
      const isFall=poseSelect.value==="casualty";
      soldier.figure.rotation.set(0,pose.yaw||0,0);
      soldier.figure.position.set(0,0,0);
      soldier.applyPose({...pose,
        aim:["aim","ambush","fire","reload"].includes(poseSelect.value),
        recoil:poseSelect.value==="fire"?Math.max(0,.18-(t%.62))/.18:0,
        fall:isFall?Math.min(1,t/poses.duration("casualty")):0});
      if(flash)flash.visible=pose.flash;
      // Existing joint guides remain available, augmented by arm markers.
      const body=soldier.body;
      for(let i=0;i<soldier.legs.length;i++){
        const leg=soldier.legs[i],side=leg.side;
        joints[i*3].position.set(side*.15,.60-pose.crouch*.18,0);
        joints[i*3+1].position.copy(leg.mesh.position);
        joints[i*3+2].position.copy(leg.boot.position);
      }
      rigMarkers.position.copy(soldier.figure.position);
      rigMarkers.rotation.copy(body.rotation);
      return;
    }
    const figure=soldier.figure,torso=soldier.breathing;
    figure.rotation.set(0,pose.yaw,pose.roll);
    figure.position.set(0,pose.footOffset,0);
    torso.position.set(0,soldier.baseY-pose.crouch*.31+pose.bob,-pose.forward);
    torso.rotation.set(-pose.lean,0,0);
    soldier.applyGesture?.(pose.gesture);
    for(const leg of soldier.legs){
      const side=leg.side;
      const lift=side<0?pose.leftLift:pose.rightLift;
      const reach=side<0?pose.leftReach:pose.rightReach;
      const footY=.17+lift;
      const footZ=-.055+reach;
      leg.boot.position.set(side*.125,footY,footZ);
      const solved=ik.solve({hipY:.54-pose.crouch*.20,
        footY:footY+.07,footZ,upper:.255,lower:.255});
      for(const [mesh,segment] of [[leg.mesh,solved.thigh],[leg.shin,solved.shin]]){
        mesh.position.set(side*.125,segment.y,segment.z);
        mesh.rotation.set(segment.rotation,0,0);
        mesh.scale.set(1,segment.length/.255,1);
      }
      const base=side<0?0:3;
      joints[base].position.set(side*.125,solved.hip.y,solved.hip.z);
      joints[base+1].position.set(side*.125,solved.knee.y,solved.knee.z);
      joints[base+2].position.set(side*.125,solved.ankle.y,solved.ankle.z);
    }
    if(flash)flash.visible=pose.flash;
    rigMarkers.position.copy(figure.position);
    rigMarkers.rotation.copy(figure.rotation);
  }
  poseSelect.addEventListener("change",()=>{elapsed=0;renderPose(0);syncTimeline()});
  timeline.addEventListener("input",()=>{
    elapsed=Number(timeline.value)/1000*poses.duration(poseSelect.value);
    playing=false;
    playButton.textContent="▶ PLAY";
    playButton.setAttribute("aria-pressed","false");
    renderPose(elapsed);syncTimeline();
  });
  playButton.addEventListener("click",()=>{
    playing=!playing;
    playButton.textContent=playing?"❚❚ PAUSE":"▶ PLAY";
    playButton.setAttribute("aria-pressed",String(playing));
  });
  $("studioReplay").addEventListener("click",()=>{elapsed=0;renderPose(0);syncTimeline()});
  speed.addEventListener("input",()=>{
    playSpeed=Number(speed.value)||1;
    $("studioSpeedValue").textContent=playSpeed.toFixed(2).replace(/\.?0+$/,"")+"×";
  });

  refreshSoldierList();
  loading.hidden=true;
  let last=performance.now();
  function animate(now){
    const dt=clamp((now-last)/1000,0,.05);
    last=now;
    if(playing)elapsed+=dt*playSpeed;
    renderPose(elapsed);
    if(playing)syncTimeline();
    renderer.render(scene,currentCamera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
