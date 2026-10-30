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
  // Start with a clean proportion check instead of a combat-ready stance.
  poseSelect.value="reference";
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
  // Balanced, directional studio light reveals sculpted seams without
  // washing matte wool and canvas completely flat.
  const hemisphere=new THREE.HemisphereLight(0xffffff,0xbfc3c0,1.25);
  scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffffff,2.4);
  key.position.set(-3,7,-5);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-4;key.shadow.camera.right=4;
  key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
  key.shadow.normalBias=.012;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.65);
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
  const compareRoot=new THREE.Group();scene.add(compareRoot);
  let compareSoldier=null;
  const compareCheckbox=$("studioCompareFaction");
  const shapeSource=$("studioShapeSource"),loadoutSelect=$("studioLoadout");
  const battleScale=$("studioBattleScale");
  const attachmentDebug=$("studioAttachmentDebug");
  let workbench=null;
  const rigMarkers=new THREE.Group();scene.add(rigMarkers);
  const jointMaterials=[0x486f66,0x8b6e51].map(color=>
    new THREE.MeshBasicMaterial({color,depthTest:false}));
  const joints=[];
  for(let i=0;i<12;i++){
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),
      jointMaterials[i%2]);
    marker.renderOrder=100;rigMarkers.add(marker);joints.push(marker);
  }
  rigMarkers.visible=false;
  // Independent colored weapon contacts: stock, sight, firing grip, support grip.
  const gripMarkers=new THREE.Group();scene.add(gripMarkers);
  const contactColors=[0xd37b5b,0x69b8ca,0xe0b258,0x89a18c];
  const contactGeometry=new THREE.SphereGeometry(.043,10,8);
  const contactDots=contactColors.map(color=>{
    const marker=new THREE.Mesh(contactGeometry,
      new THREE.MeshBasicMaterial({color,depthTest:false}));
    marker.renderOrder=105;gripMarkers.add(marker);return marker;
  });
  gripMarkers.visible=false;
  const transitionFrom=$("studioTransitionFrom"),transitionTo=$("studioTransitionTo");
  const aimDirection=$("studioAimDirection"),gripDebug=$("studioGripDebug");
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
    compareRoot.traverse(node=>{
      if(!node.userData?.sharedMiniatureGeometry)node.geometry?.dispose?.();
      const list=Array.isArray(node.material)?node.material:
        node.material?[node.material]:[];
      for(const mat of list)if(mat!==sharedWood)mat.dispose?.();
    });
    compareRoot.clear();compareSoldier=null;
    actorRoot.position.x=0;compareRoot.position.x=0;
    actorRoot.scale.setScalar(1);compareRoot.scale.setScalar(1);
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
    if(workbench?.isEditing())workbench.leave();
    disposeActor();
    const recipe=catalogue.soldier(unit.type,unit.kitId,index);
    const source=shapeSource?.value||"saved";
    const comparingSource=source==="compare";
    const squad={root:actorRoot,soldiers:[],unit,index:0};
    activeFigure=makeSoldier(squad,0,0,0,
      {...recipe,shapeSource:source==="canon"?"canon":"saved"},index,index);
    activeSoldier=squad.soldiers[0];
    // The battlefield uses this figure's own world-space forward (-Z).
    activeSoldier.applyLook(readLook());
    activeSoldier.setEquipmentPreset?.(loadoutSelect?.value||"marching");
    activeSoldier.setAttachmentDebug?.(!!attachmentDebug?.checked);
    if(compareCheckbox?.checked||comparingSource){
      const currentKit=catalogue.kits().find(k=>k.id===kitSelect.value);
      const other=comparingSource?currentKit:
        catalogue.kits().find(k=>k.faction!==currentKit?.faction);
      if(other){
        const otherUnit=catalogue.buildUnit(unitSelect.value,other.id);
        const otherIndex=Math.min(index,otherUnit.soldiers-1);
        const second=catalogue.soldier(otherUnit.type,other.id,otherIndex);
        const secondarySquad={root:compareRoot,soldiers:[],unit:otherUnit,index:0};
        makeSoldier(secondarySquad,0,0,0,
          {...second,shapeSource:comparingSource?"canon":
            source==="canon"?"canon":"saved"},otherIndex,otherIndex);
        compareSoldier=secondarySquad.soldiers[0];
        compareSoldier.applyLook(comparingSource?readLook():
          profiles.read(other.id,unitSelect.value,otherIndex));
        compareSoldier.setEquipmentPreset?.(loadoutSelect?.value||"marching");
        compareSoldier.setAttachmentDebug?.(!!attachmentDebug?.checked);
        compareSoldier.setInspectionMode?.(silhouetteMode?.value||"equipped");
        compareSoldier.inspectRing.visible=false;
        compareSoldier.windowArc.visible=false;
        actorRoot.position.x=-.66;compareRoot.position.x=.66;
        actorRoot.scale.setScalar(.90);compareRoot.scale.setScalar(.90);
      }
    }
    $("studioCompareLabel").hidden=!compareSoldier;
    $("studioCompareLabel").textContent=comparingSource?
      "Left: your local shapes. Right: repository canon. Both remain unchanged.":
      "Same unit and pose; contrasting Polish and German field equipment.";
    const saved=activeSoldier.approvedShapesUsed||[];
    $("studioShapeStatus").textContent=source==="canon"?
      "Viewing repository canon. Your local approved shapes are untouched.":
      comparingSource?
      "Local overrides on left: "+(saved.join(", ")||"none")+
        ". Canon source on right.":
      "Local approved shapes: "+(saved.join(", ")||"none")+
        ". Built-in geometry fills all other parts.";
    if(activeSoldier.modelVersion>=2)applyDisplayMode();
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
    if(!activeSoldier||activeSoldier.modelVersion<2)return;
    const mode=silhouetteMode?.value||"equipped";
    activeSoldier.setInspectionMode?.(mode);
    compareSoldier?.setInspectionMode?.(mode);
  }
  compareCheckbox?.addEventListener("change",()=>{
    if(compareCheckbox.checked&&shapeSource.value==="compare")
      shapeSource.value="saved";
    build();
  });
  shapeSource?.addEventListener("change",()=>{
    if(shapeSource.value==="compare")compareCheckbox.checked=false;
    build();
  });
  loadoutSelect?.addEventListener("change",()=>{
    activeSoldier?.setEquipmentPreset?.(loadoutSelect.value);
    compareSoldier?.setEquipmentPreset?.(loadoutSelect.value);
    if(loadoutSelect.value==="reference"){
      poseSelect.value="reference";elapsed=0;
    }
    renderPose(elapsed);
  });
  attachmentDebug?.addEventListener("change",()=>{
    activeSoldier?.setAttachmentDebug?.(attachmentDebug.checked);
    compareSoldier?.setAttachmentDebug?.(attachmentDebug.checked);
  });
  battleScale?.addEventListener("change",()=>{
    $("studioBattleLabel").hidden=!battleScale.checked;
  });
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
      applyDisplayMode();
    });
  }
  for(const [name,input] of Object.entries(morphFields)){
    input.addEventListener("input",()=>{
      const look=saveLook({...readLook(),[name]:Number(input.value)});
      $(input.dataset.output).textContent=Number(look[name]).toFixed(2)+"×";
      activeSoldier?.applyLook(look);applyDisplayMode();
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
  const focusSelect=$("studioFocus");
  const focusPresets={
    full:{y:.84,z:0,radius:3.8,height:2.45,theta:Math.PI+.46},
    face:{y:1.30,z:-.06,radius:2.15,height:1.15,theta:Math.PI+.32},
    torso:{y:.89,z:-.09,radius:2.20,height:1.37,theta:Math.PI+.35},
    weapon:{y:.59,z:-.28,radius:2.2,height:1.36,theta:Math.PI+.48},
    boots:{y:.30,z:-.03,radius:2.2,height:1.25,theta:Math.PI+.27},
    pack:{y:.86,z:.20,radius:2.25,height:1.50,theta:-.40}
  };
  focusSelect?.addEventListener("change",()=>{
    const preset=focusPresets[focusSelect.value]||focusPresets.full;
    target.set(0,preset.y,preset.z);
    radius=preset.radius;orthoHeight=preset.height;
    orbitTheta=preset.theta;orbitPolar=1.35;
    resize();applyCamera();
  });
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
    if(workbench?.pointerDown(event))return;
    if(event.pointerType==="mouse"&&event.button!==0&&event.button!==1&&event.button!==2)return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,button:event.button});
  });
  canvas.addEventListener("pointermove",event=>{
    if(workbench?.pointerMove(event))return;
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
  const clearPointer=e=>{
    workbench?.pointerUp(e);
    pointers.delete(e.pointerId);
  };
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
  gripDebug?.addEventListener("change",()=>{gripMarkers.visible=gripDebug.checked;});
  aimDirection?.addEventListener("input",()=>{
    $("studioAimDirectionValue").textContent=aimDirection.value+"°";
    renderPose(elapsed);
  });
  for(const select of [transitionFrom,transitionTo])
    select?.addEventListener("change",()=>renderPose(elapsed));
  function renderPose(t){
    const soldier=activeSoldier;
    if(!soldier)return;
    const pose=poses.frame(poseSelect.value,t,motion);
    const posture=window.Crossroads3DSoldierPose;
    if(poseSelect.value==="transition"&&posture){
      const q=Math.max(0,Math.min(1,
        ((t%poses.duration("transition"))+poses.duration("transition"))%
        poses.duration("transition")/poses.duration("transition")));
      const from=posture.lab(transitionFrom.value,1);
      const to=posture.lab(transitionTo.value,1);
      const ease=q*q*(3-2*q);
      pose.weaponReadiness=(from.weaponReadiness||0)*(1-ease)+
        (to.weaponReadiness||0)*ease;
      pose.weaponBlend=(from.weaponBlend||0)*(1-ease)+
        (to.weaponBlend||0)*ease;
    }
    if(poseSelect.value!=="reference"&&poseSelect.value!=="tpose"){
      const radians=(Number(aimDirection?.value)||0)*Math.PI/180;
      pose.headYaw=(pose.headYaw||0)+radians*.62;
      pose.torsoYaw=(pose.torsoYaw||0)+radians*.30;
    }
    if(soldier.setGunDeployed)
      soldier.setGunDeployed(poseSelect.value==="pack"?t<.9:
        poseSelect.value==="deploy"?t>=.9:true);
    if(soldier.applyPose){
      // The body falls independently of the fixed miniature base.
      const isFall=poseSelect.value==="casualty";
      soldier.figure.rotation.set(0,pose.yaw||0,0);
      soldier.figure.position.set(0,0,0);
      const posed={...pose,action:poseSelect.value,
        aim:["aim","ambush","fire","reload"].includes(poseSelect.value),
        recoil:poseSelect.value==="fire"?Math.max(0,.18-(t%.62))/.18:0,
        fall:isFall?Math.min(1,t/poses.duration("casualty")):0};
      soldier.applyPose(posed);
      if(compareSoldier){
        compareSoldier.figure.rotation.set(0,pose.yaw||0,0);
        compareSoldier.setGunDeployed?.(poseSelect.value==="deploy"?t>=.9:true);
        compareSoldier.applyPose(posed);
      }
      if(flash){
        // Muzzle moves with the sculpted weapon, including recoil and aims.
        flash.position.copy(soldier.muzzleLocal);
        flash.visible=pose.flash;
      }
      // Project all rig pivots into studio world space, even during a fall.
      // Six leg plus six arm markers identify the actual animated joints.
      rigMarkers.position.set(0,0,0);
      rigMarkers.rotation.set(0,0,0);
      const markerAt=(parent,local)=>{
        parent.updateWorldMatrix(true,false);
        return parent.localToWorld(local.clone());
      };
      for(let i=0;i<soldier.legs.length;i++){
        const leg=soldier.legs[i],side=leg.side;
        const hip=new THREE.Vector3(side*.15,.60-pose.crouch*.18,0);
        const knee=leg.mesh.position.clone().multiplyScalar(2).sub(hip);
        joints[i*3].position.copy(markerAt(soldier.body,hip));
        joints[i*3+1].position.copy(markerAt(soldier.body,knee));
        joints[i*3+2].position.copy(markerAt(soldier.body,leg.boot.position));
      }
      for(let i=0;i<soldier.arms.length;i++){
        const arm=soldier.arms[i],shoulder=arm.shoulder;
        const elbow=arm.upper.position.clone().multiplyScalar(2).sub(shoulder);
        joints[6+i*3].position.copy(markerAt(soldier.breathing,shoulder));
        joints[7+i*3].position.copy(markerAt(soldier.breathing,elbow));
        joints[8+i*3].position.copy(markerAt(soldier.breathing,arm.hand.position));
      }
      for(let i=6;i<12;i++)joints[i].visible=true;
      gripMarkers.visible=!!gripDebug?.checked&&!!soldier.weaponSocket;
      if(gripMarkers.visible){
        const locations=[
          soldier.stockSocket?.(),soldier.sightSocket?.(),
          soldier.weaponSocket("primary"),soldier.weaponSocket("secondary")
        ];
        for(let i=0;i<contactDots.length;i++){
          contactDots[i].position.copy(markerAt(
            soldier.breathing,locations[i]||new THREE.Vector3()));
        }
      }
      return;
    }
    for(let i=6;i<12;i++)joints[i].visible=false;
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

  workbench=window.Crossroads3DMiniatureWorkbench?.create({
    THREE,canvas,scene,
    getSoldier:()=>activeSoldier,
    getCamera:()=>currentCamera,
    enterPose:()=>{
      playing=false;elapsed=0;poseSelect.value="tpose";
      playButton.textContent="▶ PLAY";
      playButton.setAttribute("aria-pressed","false");
      renderPose(0);syncTimeline();
      $("studioShowJoints").checked=false;rigMarkers.visible=false;
    },
    exitPose:()=>{
      poseSelect.value="reference";renderPose(0);syncTimeline();
    }
  })||null;
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
    // Optional low-scale inspection uses the SAME WebGL context; never add a
    // second expensive renderer on an iPhone.
    if(battleScale?.checked){
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());
      const w=Math.round(Math.min(size.x*.34,160*(window.devicePixelRatio||1))),
        h=Math.round(w*.90),margin=Math.round(12*(window.devicePixelRatio||1));
      const x=Math.max(0,size.x-w-margin),y=Math.max(0,size.y-h-margin);
      const smallCamera=new THREE.PerspectiveCamera(39,w/h,.03,60);
      smallCamera.position.set(2.8,4.4,7.8);
      smallCamera.lookAt(0,.86,0);
      renderer.setScissorTest(true);
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
      renderer.render(scene,smallCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0,0,size.x,size.y);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
