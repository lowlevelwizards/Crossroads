"use strict";
(async()=>{
  const $=id=>document.getElementById(id),lib=window.Crossroads3DWeaponLibrary;
  if(!lib||!window.Crossroads3DSculptShapes||!window.Crossroads3DHistoricalWeapons)return;
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
  const mat={
    steel:S.material(0x343a38,.76),wood:S.material(0x72523b,.91),
    hardware:S.material(0x4d5650,.87)
  };
  const base=new THREE.Group();scene.add(base);
  let kind="wz29",settings=lib.read(kind),primary=null,comparison=null;
  const info={
    wz29:["POLAND 1939 · wz.29/98a family","Long timber stock, bolt receiver, short thick front sight"],
    kar98k:["GERMANY 1939 · Kar98k","Mauser-pattern timber butt and full fore-end"],
    wz28:["POLAND 1939 · Browning wz.28","Bottom-feed magazine, bipod, heavy barrel"],
    mg34:["GERMANY 1939 · MG34","Cylindrical barrel jacket and side feed"],
    mors39:["POLAND · Mors prototype","Limited-production SMG; optional specialist"],
    mp38:["GERMANY 1939 · MP38","Compact metal-frame SMG and vertical magazine"],
    pistol:["OFFICERS · early-war pistol","Simple slide, grip and short barrel"]
  };
  for(const id of lib.kinds){
    const option=document.createElement("option");
    option.value=id;option.textContent=info[id]?.[0]||id;
    $("weaponKind").append(option);
  }
  const factionFor=kind=>["wz29","wz28","mors39"].includes(kind)?"poland":"germany";
  const roleFor=kind=>kind==="pistol"?"officer":
    ["wz28","mg34"].includes(kind)?("weaponMounted".checked?"mmg":"lmg"):
    ["mors39","mp38"].includes(kind)?"smg":"rifle";
  // The group structure is shared with the game's live model builder.
  function makeWeapon(compare=false){
    const root=new THREE.Group();base.add(root);
    const breathing=new THREE.Group();root.add(breathing);
    const gun=W.build({figure:root,breathing,
      faction:factionFor(kind),role:roleFor(kind),weaponKind:kind,mats:mat});
    gun.weapon.position.set(0,0,0);gun.weapon.rotation.set(0,0,0);
    gun.setDeployed($("weaponMounted").checked&&["wz28","mg34"].includes(kind));
    if(compare)lib.apply(gun.sections,kind,lib.defaults[kind]);
    else lib.apply(gun.sections,kind,settings);
    root.position.x=compare?.65:($("weaponCompare").checked?-.65:0);
    return {root,gun};
  }
  function updateInfo(){
    $("weaponInfo").textContent=(info[kind]||[kind,""])[1];
    $("weaponMounted").disabled=!["wz28","mg34"].includes(kind);
  }
  const fields=["length","stock","receiver","barrel","magazine"];
  function sync(){
    for(const field of fields){
      const el=$("weapon"+field[0].toUpperCase()+field.slice(1));
      el.value=settings[field];
      $(el.id+"Value").textContent=settings[field].toFixed(2)+"×";
    }
  }
  function rebuild(){
    base.clear();
    primary=makeWeapon(false);
    comparison=$("weaponCompare").checked?makeWeapon(true):null;
    updateInfo();sync();
  }
  $("weaponKind").addEventListener("change",e=>{
    kind=e.target.value;settings=lib.read(kind);rebuild();
  });
  $("weaponCompare").addEventListener("change",rebuild);
  $("weaponMounted").addEventListener("change",rebuild);
  for(const field of fields){
    const id="weapon"+field[0].toUpperCase()+field.slice(1);
    $(id).addEventListener("input",e=>{
      settings[field]=Number(e.target.value);
      $(id+"Value").textContent=settings[field].toFixed(2)+"×";
      lib.apply(primary?.gun.sections,kind,settings);
    });
  }
  $("weaponSave").addEventListener("click",()=>{
    $("weaponStatus").textContent=lib.write(kind,settings)?
      "Approved on this device. Reload miniature lab/battle to use it.":
      "Browser storage blocked. Export JSON to preserve the edit.";
  });
  $("weaponReset").addEventListener("click",()=>{
    lib.reset(kind);settings={...lib.defaults[kind]};
    lib.apply(primary?.gun.sections,kind,settings);sync();
    $("weaponStatus").textContent="Restored built-in archetype on this device.";
  });
  $("weaponExport").addEventListener("click",()=>{
    const bytes=JSON.stringify({kind,settings:lib.parse(kind,settings)},null,2);
    const url=URL.createObjectURL(new Blob([bytes],{type:"application/json"}));
    const a=document.createElement("a");
    a.href=url;a.download="crossroads-weapon-"+kind+".json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),600);
  });
  $("weaponImport").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>6000)throw Error("File too large");
      const payload=JSON.parse(await file.text());
      if(!lib.kinds.includes(payload.kind))throw Error("Unknown weapon type");
      kind=payload.kind;settings=lib.parse(kind,payload.settings);
      $("weaponKind").value=kind;rebuild();
      $("weaponStatus").textContent="Loaded as unsaved preview. Approve to use in battles.";
    }catch(err){$("weaponStatus").textContent="Import rejected: "+err.message}
    e.target.value="";
  });
  const camera=new THREE.PerspectiveCamera(35,1,.04,30);
  let theta=1.0,polar=1.32,radius=2.6;
  const target=new THREE.Vector3(0,-.02,-.25);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function setCamera(){
    camera.position.set(target.x+radius*Math.sin(polar)*Math.sin(theta),
      target.y+radius*Math.cos(polar),
      target.z+radius*Math.sin(polar)*Math.cos(theta));
    camera.lookAt(target);
  }
  const views={
    side:[Math.PI/2,Math.PI/2],front:[Math.PI,Math.PI/2],
    rear:[0,Math.PI/2],three:[Math.PI+.55,1.28],top:[Math.PI,.12]
  };
  for(const button of document.querySelectorAll("[data-weapon-view]")){
    button.addEventListener("click",()=>{
      [theta,polar]=views[button.dataset.weaponView];
      setCamera();
      for(const b of document.querySelectorAll("[data-weapon-view]"))
        b.classList.toggle("active",b===button);
    });
  }
  const pointers=new Map();
  canvas.addEventListener("pointerdown",e=>{
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  });
  canvas.addEventListener("pointermove",e=>{
    const before=pointers.get(e.pointerId);if(!before)return;
    const previous=[...pointers.values()];
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const next=[...pointers.values()];
    if(next.length===1){
      theta-=(e.clientX-before.x)*.008;
      polar=clamp(polar-(e.clientY-before.y)*.007,.08,Math.PI-.08);
    }else{
      const length=a=>Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y);
      const p=length(previous.slice(0,2)),n=length(next.slice(0,2));
      if(p>2&&n>2)radius=clamp(radius*p/n,.7,9);
      target.x-=(next[0].x-before.x)*.002;
    }
    setCamera();e.preventDefault();
  },{passive:false});
  for(const name of ["pointerup","pointercancel","lostpointercapture"])
    canvas.addEventListener(name,e=>pointers.delete(e.pointerId));
  canvas.addEventListener("wheel",e=>{
    e.preventDefault();radius=clamp(radius*Math.exp(e.deltaY*.001),.7,9);
    setCamera();
  },{passive:false});
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  function resize(){
    const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  window.addEventListener("resize",resize);
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(resize).observe(stage);
  $("weaponKind").value=kind;
  $("weaponLoading").hidden=true;
  rebuild();resize();setCamera();
  function animate(){renderer.render(scene,camera);requestAnimationFrame(animate)}
  animate();
})();
