"use strict";
(async()=>{
  const $=id=>document.getElementById(id);
  const lib=window.Crossroads3DWeaponLibrary;
  const archetypes=window.Crossroads3DWeaponArchetypes;
  if(!lib||!archetypes||!window.Crossroads3DWeaponGeometry||
    !window.Crossroads3DSculptShapes||!window.Crossroads3DHistoricalWeapons)return;
  let THREE;
  try{
    try{THREE=await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js")}
    catch(_){THREE=await import("https://unpkg.com/three@0.180.0/build/three.module.js")}
  }catch(err){$("weaponLoading").textContent="Unable to load Three.js";return}
  const canvas=$("weaponCanvas"),stage=$("weaponStage");
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"})}
  catch(_){$("weaponLoading").textContent="WebGL unavailable";return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xe9ecea);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb9c0b9,1.8));
  const light=new THREE.DirectionalLight(0xffffff,2.4);
  light.position.set(-3,5,-4);scene.add(light);
  const S=window.Crossroads3DSculptShapes.create(THREE);
  const W=window.Crossroads3DHistoricalWeapons.create(THREE,S);
  const mats={
    steel:S.material(0x343a38,.76),wood:S.material(0x72523b,.91),
    hardware:S.material(0x4d5650,.87)
  };
  const stageRoot=new THREE.Group();scene.add(stageRoot);
  let kind="wz29",settings=lib.read(kind),pending=false;
  const silhouette=S.material(0x24332c,1);
  const camera=new THREE.PerspectiveCamera(35,1,.04,30);
  const cameraModel=window.Crossroads3DWeaponCameraControls?.create({
    fov:camera.fov,height:Math.max(1,stage.clientHeight)
  });
  if(!cameraModel){$("weaponLoading").textContent="Camera unavailable";return}
  const labels={
    wz29:"POLAND 1939 · wz.29/98a family",kar98k:"GERMANY 1939 · Kar98k",
    wz28:"POLAND 1939 · Browning wz.28",mg34:"GERMANY 1939 · MG34",
    mors39:"POLAND · Mors prototype",mp38:"GERMANY 1939 · MP38",
    pistol:"OFFICERS · early-war pistol"
  };
  for(const name of lib.kinds){
    const option=document.createElement("option");
    option.value=name;option.textContent=labels[name];
    $("weaponKind").append(option);
  }
  const factionFor=name=>archetypes.defs[name].nation==="poland"?"poland":"germany";
  const roleFor=name=>name==="pistol"?"officer":
    ["wz28","mg34"].includes(name)?($("weaponMounted").checked?"mmg":"lmg"):
    ["mors39","mp38"].includes(name)?"smg":"rifle";
  function makeWeapon(compare=false){
    const root=new THREE.Group();stageRoot.add(root);
    const breathing=new THREE.Group();root.add(breathing);
    const values=compare?lib.defaults[kind]:settings;
    const gun=W.build({figure:root,breathing,faction:factionFor(kind),
      role:roleFor(kind),weaponKind:kind,mats,settings:values});
    gun.weapon.position.set(0,0,0);gun.weapon.rotation.set(0,0,0);
    const mount=$("weaponMounted").checked&&["wz28","mg34"].includes(kind);
    gun.setDeployed(mount);
    root.position.x=compare?.74:($("weaponCompare").checked?-.74:0);
    return {root,gun};
  }
  function makeSoldier(){
    const factory=window.Crossroads3DHeroicMiniature?.create({
      THREE,miniatureScale:.9,
      motion:{gaitFor:()=>({stepLength:.48,bob:.05})},
      shape:(parent,g,m,x,y,z)=>{
        const mesh=new THREE.Mesh(g,m);
        mesh.position.set(x,y,z);parent.add(mesh);return mesh;
      }
    });
    if(!factory)return false;
    const faction=factionFor(kind),role=roleFor(kind);
    const squad={root:stageRoot,soldiers:[],index:0,
      unit:{type:"rifleSquad",mmgDeployed:false}};
    factory(squad,0,0,0,{
      kit:{id:faction+"_1939",factionId:faction},role,
      weaponSettings:settings
    },0,0);
    const soldier=squad.soldiers[0];
    if(!soldier)return false;
    soldier.setGunDeployed?.(false);
    soldier.applyPose({action:"idle"});
    soldier.inspectRing&&(soldier.inspectRing.visible=false);
    soldier.applyLook?.({headSize:1.25,bootSize:.8});
    return true;
  }
  function syncFields(){
    const el=$("weaponFields");el.replaceChildren();
    const family=archetypes.defs[kind].family;
    for(const field of archetypes.controls[family]){
      const spec=archetypes.fields[field];
      const wrap=document.createElement("div");wrap.className="weapon-control";
      const label=document.createElement("label");
      const id="weaponField-"+field;label.htmlFor=id;
      label.textContent=spec.label+" ";
      const output=document.createElement("output");
      output.textContent=settings[field].toFixed(2)+"×";
      label.append(output);
      const input=document.createElement("input");
      input.type="range";input.id=id;input.min=spec.min;
      input.max=spec.max;input.step=".01";input.value=settings[field];
      input.addEventListener("input",()=>{
        settings[field]=Number(input.value);
        output.textContent=settings[field].toFixed(2)+"×";
        scheduleRebuild();
      });
      wrap.append(label,input);el.append(wrap);
    }
  }
  function setCamera(){
    const state=cameraModel.snapshot();
    camera.position.set(...state.position);camera.lookAt(...state.target);
    for(const button of document.querySelectorAll("[data-weapon-view]")){
      const active=button.dataset.weaponView===state.activeView;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    }
  }
  function fitWeapon(){
    // Actual geometry bounds, including comparison and the assembled figure.
    const bounds=new THREE.Box3().setFromObject(stageRoot);
    if(!bounds.isEmpty()&&Number.isFinite(bounds.min.x)){
      const center=bounds.getCenter(new THREE.Vector3());
      const size=bounds.getSize(new THREE.Vector3());
      cameraModel.fitBounds({
        center:[center.x,center.y,center.z],
        size:[size.x,size.y,size.z],aspect:Math.max(.35,camera.aspect)
      });
    }else cameraModel.setContext({
      compare:$("weaponCompare").checked,mount:$("weaponMounted").checked
    });
    setCamera();
  }
  function rebuild(refit=false){
    stageRoot.clear();
    const preview=$("weaponDisplayMode").value;
    if(preview==="miniature"){
      if(!makeSoldier())makeWeapon(false);
    }else{
      makeWeapon(false);
      if($("weaponCompare").checked)makeWeapon(true);
    }
    if(preview==="silhouette")stageRoot.traverse(o=>{
      if(o.isMesh)o.material=silhouette;
    });
    $("weaponInfo").textContent=archetypes.defs[kind].note;
    $("weaponMounted").disabled=!["wz28","mg34"].includes(kind)||
      preview==="miniature";
    $("weaponCompare").disabled=preview==="miniature";
    if(refit)fitWeapon();
  }
  function scheduleRebuild(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;rebuild(false)});
  }
  $("weaponKind").addEventListener("change",e=>{
    kind=e.target.value;settings=lib.read(kind);
    syncFields();rebuild(true);
  });
  $("weaponDisplayMode").addEventListener("change",()=>rebuild(true));
  $("weaponCompare").addEventListener("change",()=>rebuild(true));
  $("weaponMounted").addEventListener("change",()=>rebuild(true));
  $("weaponSave").addEventListener("click",()=>{
    $("weaponStatus").textContent=lib.write(kind,settings)?
      "Approved on this device. Reload battle/miniature lab to use this model.":
      "Storage blocked: export this profile as JSON to preserve it.";
  });
  $("weaponReset").addEventListener("click",()=>{
    lib.reset(kind);settings={...lib.defaults[kind]};
    syncFields();rebuild(true);
    $("weaponStatus").textContent="Built-in archetype restored.";
  });
  $("weaponExport").addEventListener("click",()=>{
    const source={format:"crossroads-weapon-v2",version:2,kind,
      settings:lib.parse(kind,settings)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(source,null,2)],
      {type:"application/json"}));
    const link=document.createElement("a");link.href=url;
    link.download="crossroads-weapon-"+kind+"-v2.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),800);
  });
  $("weaponImport").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>8000)throw Error("File too large");
      const obj=JSON.parse(await file.text());
      if(!lib.kinds.includes(obj.kind))throw Error("Unknown weapon archetype");
      if(obj.version!==2&&obj.format!=="crossroads-weapon-v2"&&
         obj.version!==undefined)throw Error("Unsupported format version");
      kind=obj.kind;
      settings=obj.version===2||obj.format==="crossroads-weapon-v2"?
        lib.parse(kind,obj.settings):lib.migrate(kind,obj.settings);
      $("weaponKind").value=kind;syncFields();rebuild(true);
      $("weaponStatus").textContent="Imported as unsaved preview. Approve to keep it.";
    }catch(err){$("weaponStatus").textContent="Import rejected: "+err.message}
    e.target.value="";
  });
  for(const button of document.querySelectorAll("[data-weapon-view]")){
    button.addEventListener("click",()=>{
      cameraModel.view(button.dataset.weaponView);setCamera();
    });
  }
  $("weaponFit").addEventListener("click",()=>{
    cameraModel.reset();fitWeapon();
  });
  canvas.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&![0,1,2].includes(e.button))return;
    if(!cameraModel.pointerDown(e.pointerId,e.clientX,e.clientY,e.button))return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",e=>{
    if(!cameraModel.pointerMove(e.pointerId,e.clientX,e.clientY,e.buttons))return;
    e.preventDefault();setCamera();
  },{passive:false});
  const release=e=>{
    cameraModel.pointerUp(e.pointerId);
    if(e.type!=="lostpointercapture"&&canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  for(const type of ["pointerup","pointercancel","lostpointercapture"])
    canvas.addEventListener(type,release);
  canvas.addEventListener("wheel",e=>{
    e.preventDefault();cameraModel.zoom(Math.exp(e.deltaY*.0013));
    setCamera();
  },{passive:false});
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.addEventListener("dblclick",()=>{
    cameraModel.reset();fitWeapon();
  });
  window.addEventListener("blur",()=>cameraModel.clearPointers());
  function resize(){
    const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    cameraModel.setViewportHeight(h);setCamera();
  }
  window.addEventListener("resize",resize);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(resize).observe(stage);
  $("weaponKind").value=kind;
  $("weaponLoading").hidden=true;
  syncFields();resize();rebuild(true);
  function animate(){renderer.render(scene,camera);requestAnimationFrame(animate)}
  animate();
})();