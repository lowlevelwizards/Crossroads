"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
  path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
class Vec{
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  clone(){return new Vec(this.x,this.y,this.z)}
  copy(o){return this.set(o.x,o.y,o.z)}
  add(o){return this.set(this.x+o.x,this.y+o.y,this.z+o.z)}
  sub(o){return this.set(this.x-o.x,this.y-o.y,this.z-o.z)}
  multiplyScalar(f){return this.set(this.x*f,this.y*f,this.z*f)}
  length(){return Math.hypot(this.x,this.y,this.z)}
  setScalar(v){return this.set(v,v,v)}
}
class Node{
  constructor(){this.position=new Vec();this.rotation={set(){}};
    this.quaternion={setFromUnitVectors(){}};
    this.scale=new Vec(1,1,1);this.children=[];this.visible=true;this.userData={}}
  add(o){this.children.push(o);o.parent=this}
  updateWorldMatrix(){}
  worldToLocal(o){return o}
  localToWorld(o){return o}
}
class Geo{
  constructor(...args){this.args=args;this.attributes={};this.userData={}}
  setAttribute(k,v){this.attributes[k]=v;return this}
  setIndex(v){this.index=v;return this}
  computeVertexNormals(){}
  computeBoundingSphere(){}
}
const THREE={Group:Node,BufferGeometry:Geo,BoxGeometry:Geo,
  Float32BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n}}};
const mock={
  v:(...p)=>new Vec(...p),
  mesh(parent,geom,mat){const m=new Node();m.isMesh=true;m.geometry=geom;
    m.material=mat;parent.add(m);return m},
  box(parent,mat,size,pos){const m=this.mesh(parent,new Geo(...size),mat);
    m.position.set(...pos);return m},
  loft(parent,mat,key,profile){const m=this.mesh(parent,new Geo(key),mat);return m},
  segment(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5)}
};
const storage={};
const window={localStorage:{
  getItem:key=>storage[key]||null,
  setItem:(key,v)=>{storage[key]=v},
  removeItem:key=>{delete storage[key]}
}};
for(const name of ["weapon-archetypes.js","weapon-geometry.js",
  "miniature-weapon-library.js","miniature-historical-weapons.js",
  "weapon-lab-camera.js"]){
  new vm.Script(read("src/diorama/"+name),{filename:name})
    .runInNewContext({window});
}
const archetypes=window.Crossroads3DWeaponArchetypes;
const library=window.Crossroads3DWeaponLibrary;
const geometry=window.Crossroads3DWeaponGeometry.create(THREE,mock);
const W=window.Crossroads3DHistoricalWeapons.create(THREE,mock);
assert.equal(archetypes.kinds.length,7);
assert.equal(library.version,2);
const materials={wood:{},steel:{},hardware:{}};
for(const kind of library.kinds){
  const model=new THREE.Group(),breathing=new THREE.Group();
  model.add(breathing);
  const built=W.build({figure:model,breathing,
    role:"rifle",faction:archetypes.defs[kind].nation,weaponKind:kind,
    mats:materials,settings:library.read(kind)});
  assert.equal(built.kind,kind);
  const {butt,receiverRear,receiverFront,foreEnd,muzzle}=built.anchors;
  assert(butt>=receiverRear&&receiverRear>receiverFront);
  assert(foreEnd<=receiverFront);
  assert(muzzle<=foreEnd);
  assert(Number.isFinite(built.grip("primary").x));
  assert(Number.isFinite(built.grip("secondary").z));
  assert(Number.isFinite(built.muzzle().z));
  assert(built.sections.receiver.children.length>0);
  assert(built.sections.barrel.children.length>0);
  const extreme=library.parse(kind,{length:1.2,stock:1.38,
    receiverLength:.8,foreEndLength:1.32,barrelLength:1.35});
  const altered=W.profile(new THREE.Group(),materials,kind,extreme);
  assert(altered.anchors.butt>=altered.anchors.receiverRear);
  if(kind!=="pistol")assert(altered.anchors.butt>altered.anchors.receiverRear);
  assert(altered.anchors.muzzle<altered.anchors.foreEnd);
  assert(altered.anchors.receiverRear>altered.anchors.receiverFront);
  assert(altered.dimensions.rear-altered.dimensions.front>0);
  if(["wz28","mg34"].includes(kind))
    assert(built.grips.bipod&&built.grips.bipod.visible===false);
  if(["wz29","kar98k"].includes(kind)){
    assert(built.sections.foreEnd.children.length>0);
    assert(built.sections.magazine.children.length===0);
  }
  if(kind==="mp38")
    assert(built.sections.stock.children.length>=3,
      "MP38 uses a connected folding skeleton stock");
  if(kind==="wz28")
    assert(built.sections.magazine.children.length===1);
  if(kind==="mg34"){
    assert(built.sections.barrel.children.length>=2);
    assert(built.sections.magazine.children.length===1);
  }
}
// Geometry vertices, capped profiles, bounded cache reuse.
const profile=[[-.4,.09,.09],[0,.12,.11],[.4,.08,.09]];
const mesh=geometry.mesh(new THREE.Group(),materials.wood,profile);
const pos=mesh.geometry.attributes.position.array;
assert(pos.every(Number.isFinite));
assert(mesh.geometry.index.length>0);
const cached=geometry.mesh(new THREE.Group(),materials.wood,profile);
assert.equal(mesh.geometry,cached.geometry);
assert(geometry.stats().cachedGeometryCount>0);
// Legacy data kept, migrated but never blindly multiplied into meshes.
storage[library.LEGACY_KEY]=JSON.stringify({
  wz29:{length:.72,stock:1.61,receiver:1.3,barrel:1.4,magazine:1.2}
});
const old=library.read("wz29");
assert(old.length>=archetypes.fields.length.min&&
  old.length<=archetypes.fields.length.max);
assert(old.stock<=archetypes.fields.stock.max);
assert(library.write("wz29",{...old,stockLength:1.19}));
assert.equal(library.read("wz29").stockLength,1.19);
library.reset("wz29");
assert.equal(library.read("wz29").stockLength,library.defaults.wz29.stockLength);
assert(storage[library.LEGACY_KEY]&&!storage[library.LEGACY_KEY].includes("1.61"));
assert.throws(()=>library.parse("__proto__",{}));
// Framing really responds to aspect and long-gun bounds.
const cam=window.Crossroads3DWeaponCameraControls.create();
cam.fitBounds({center:[.1,.2,-.5],size:[1.6,.3,.2],aspect:.55});
const narrow=cam.snapshot();
assert(narrow.radius>2);
assert(Math.abs(narrow.target[0]-.1)<.0001);
cam.fitBounds({center:[0,0,0],size:[.8,.2,.2],aspect:1.5});
assert(cam.snapshot().radius<narrow.radius);
for(const page of ["weapon-lab.html","miniature-studio.html",
  "battle3d.html","editor3d.html"]){
  const html=read(page);
  assert(html.indexOf("weapon-archetypes.js")<
    html.indexOf("miniature-weapon-library.js"));
  assert(html.indexOf("weapon-geometry.js")<
    html.indexOf("miniature-historical-weapons.js"));
}
const lab=read("src/diorama/weapon-lab.js");
assert(lab.includes('preview==="silhouette"'));
assert(lab.includes('preview==="miniature"'));
assert(lab.includes("weaponSettings:settings"));
assert(lab.includes("cameraModel.fitBounds("));
assert(lab.includes("scheduleRebuild"));
console.log("PASS — v0.9.69 seven connected historical weapons, geometry, grip anchors, preset migration, camera and soldier-scale preview");
