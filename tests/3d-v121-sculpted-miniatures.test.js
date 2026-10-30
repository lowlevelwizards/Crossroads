"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const v2=read("src/diorama/miniature-v2.js");
const model=read("src/diorama/miniature-model.js");
const battle=read("src/diorama/scenario-scene.js");
const studio=read("src/diorama/miniature-studio.js");
const studioPage=read("miniature-studio.html");
const battlePage=read("battle3d.html");
const editorPage=read("editor3d.html");
const context={window:{}};
vm.runInNewContext(v2,context,{filename:"miniature-v2.js"});
assert.equal(typeof context.window.Crossroads3DMiniatureV2.create,"function");
for(const term of [
  "flatShading:false","const body=new THREE.Group()",
  "const base=new THREE.Group()","figure.add(base)","figure.add(body)",
  "const equipmentRoot=new THREE.Group()","const helmetParts=[]",
  "soldier.applyPose=","soldier.applyProfile=","soldier.updateMuzzle=",
  "soldier.setGunDeployed=","Crossroads3DSoldierIK",
  "const right=toTorso(gripRight)","left=toTorso(gripLeft)"
])assert(v2.includes(term),"Missing sculpted miniature feature: "+term);
assert(model.includes("Crossroads3DMiniatureV2?.create"));
assert(model.includes("Crossroads3DForceClassicMiniature"));
assert(studio.includes("soldier.applyPose("));
assert(studio.includes("studioClassicModel"));
assert(battle.includes("soldier.applyPose({"));
assert(battle.includes("if(record.soldier.applyPose)"));
for(const [page,html] of Object.entries({
  "studio":studioPage,"battle":battlePage,"editor":editorPage
})){
  assert(html.includes("miniature-v2.js?v=0.9.46"),page+" missing V2 loader");
  assert(html.indexOf("miniature-v2.js")<html.indexOf("miniature-model.js"),
    page+" must load the new builder before its shared factory");
}
const poseContext={window:{}};
vm.runInNewContext(read("src/diorama/miniature-studio-poses.js"),poseContext);
const poses=poseContext.window.Crossroads3DSoldierActions;
assert(poses.frame("down",0,{}).crouch>.8);
assert(poses.frame("down",0,{}).lean<.5);
assert.equal(poses.frame("casualty",100,{}).fall,1);
assert.equal(poses.frame("casualty",1000,{}).fall,1);
assert(poses.frame("fire",0,{}).aim);
const manifest=JSON.parse(read("release-manifest.json"));
assert.equal(manifest.threeDCacheVersion,"0.9.46");
assert(manifest.requiredFiles.includes("src/diorama/miniature-v2.js"));

// Exercise every soldier role without depending on WebGL in the Node runner.
class V {
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  clone(){return new V(this.x,this.y,this.z)}
  copy(p){return this.set(p.x,p.y,p.z)}
  add(p){return this.set(this.x+p.x,this.y+p.y,this.z+p.z)}
  subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z)}
  multiplyScalar(n){return this.set(this.x*n,this.y*n,this.z*n)}
  length(){return Math.hypot(this.x,this.y,this.z)}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
  lerp(v,t){return this.set(this.x+(v.x-this.x)*t,
    this.y+(v.y-this.y)*t,this.z+(v.z-this.z)*t)}
  setScalar(n){return this.set(n,n,n)}
}
class Rotation {
  constructor(){this.set(0,0,0)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(o){return this.set(o.x,o.y,o.z)}
}
class Object3D {
  constructor(){this.position=new V();this.rotation=new Rotation();
    this.scale=new V(1,1,1);this.quaternion={setFromUnitVectors(){}};
    this.userData={};this.children=[];this.visible=true;}
  add(x){x.parent=this;this.children.push(x);return this}
  updateWorldMatrix(){}
  localToWorld(v){return v}
  worldToLocal(v){return v}
}
class Mesh extends Object3D {
  constructor(geometry,material){super();this.geometry=geometry;
    this.material=material;this.isMesh=true}
}
class Material {
  constructor(p={}){this.color={value:p.color,setHex(x){this.value=x}};
    this.flatShading=p.flatShading}
}
class Geometry {constructor(...args){this.args=args}}
const THREE={Vector3:V,Group:Object3D,Mesh,MeshStandardMaterial:Material,
  MeshBasicMaterial:Material,BoxGeometry:Geometry,CylinderGeometry:Geometry,
  SphereGeometry:Geometry,RingGeometry:Geometry,DoubleSide:2};
const w={
  Crossroads3DMiniatureProfiles:{
    normalize:p=>({headSize:1,bodyWidth:1,packSize:1,bootSize:1,...p}),
    read:()=>({})
  },
  Crossroads3DSoldierIK:{solve:()=>({
    hip:{y:.60,z:0},knee:{y:.42,z:-.10},ankle:{y:.23,z:-.05}
  })}
};
vm.runInNewContext(v2,{window:w},{filename:"miniature-v2.js"});
const make=w.Crossroads3DMiniatureV2.create({
  THREE,miniatureScale:1,motion:{gaitFor:()=>({stepLength:.48,bob:.08})},
  shape:(parent,geometry,material,x,y,z)=>{
    const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);
    parent.add(mesh);return mesh;
  }
});
for(const role of ["rifle","smg","lmg","mmg","crew","officer","loader"]){
  const squad={root:new Object3D(),soldiers:[],index:0,
    unit:{type:"rifleSquad",mmgDeployed:true}};
  make(squad,0,0,0,{role,kit:{id:"poland_1939",factionId:"poland"}},0,0);
  const soldier=squad.soldiers[0];
  assert.equal(soldier.modelVersion,2);
  // Regression: the appearance slider multiplies the existing chest radius.
  // The broken implementation replaced 0.31 with ~1.02 and inflated the
  // entire torso into a horizontal oval, even for a near-default profile.
  const initialRadius=soldier.torso.scale.x;
  assert(Math.abs(initialRadius-.285)<.0001);
  soldier.applyProfile({bodyWidth:1.02});
  assert(Math.abs(soldier.torso.scale.x-.285*1.02)<.0001,
    "Torso width slider must not overwrite the sculpted base radius");
  soldier.applyProfile({bodyWidth:1.28});
  assert(soldier.torso.scale.x<.37,
    "Even the widest torso option stays within heroic miniature proportions");
  soldier.applyProfile({bodyWidth:1.02});
  assert(Math.abs(soldier.torso.scale.x-.285*1.02)<.0001,
    "Successive slider updates must not accumulate scaling");
  for(const arm of soldier.arms){
    assert(Math.abs(arm.shoulder.x)<.27,
      "Shoulder joints stay near the torso rather than outside the silhouette");
    assert(arm.upper.geometry.args[0]<.12 &&
      arm.lower.geometry.args[0]<.10,
      "Sleeve radius is authored directly, never a full-size unit cylinder");
    assert(arm.upper.scale.x===1&&arm.lower.scale.z===1,
      "Posing only changes the limb length, not the authored sleeve thickness");
  }
  assert.notEqual(soldier.body,soldier.base);
  assert.equal(soldier.base.rotation.z,0);
  soldier.applyPose({fall:1,crouch:.28,lean:.22});
  assert.notEqual(soldier.body.rotation.z,0);
  assert.equal(soldier.base.rotation.z,0);
  soldier.setInspectionMode("body");
  assert.equal(soldier.equipmentRoot.visible,false);
  soldier.setInspectionMode("equipped");
  assert.equal(soldier.equipmentRoot.visible,true);
  soldier.setGunDeployed(false);
  soldier.applyLook({headSize:1.1,bootSize:1.05});
  assert(Number.isFinite(soldier.muzzleLocal.z));
}

console.log("PASS — V2 sculpted soldiers, separate casualty bodies, authored gear, shared lab/battle factory, and held action contract");
