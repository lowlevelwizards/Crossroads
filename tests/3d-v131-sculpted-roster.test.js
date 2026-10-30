"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
class Vec {
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(o){return this.set(o.x,o.y,o.z)}
  clone(){return new Vec(this.x,this.y,this.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  multiplyScalar(s){return this.set(this.x*s,this.y*s,this.z*s)}
  length(){return Math.hypot(this.x,this.y,this.z)}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
  lerp(v,t){return this.set(this.x+(v.x-this.x)*t,this.y+(v.y-this.y)*t,
    this.z+(v.z-this.z)*t)}
  setScalar(s){return this.set(s,s,s)}
}
class Rotation{
  constructor(){this.set(0,0,0)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Node{
  constructor(){this.position=new Vec();this.rotation=new Rotation();
    this.scale=new Vec(1,1,1);this.visible=true;this.children=[];
    this.userData={};this.quaternion={setFromUnitVectors(){}}}
  add(child){this.children.push(child);child.parent=this;return this}
  traverse(cb){cb(this);for(const child of this.children)child.traverse(cb)}
  updateWorldMatrix(){}
  localToWorld(v){return v}
  worldToLocal(v){return v}
}
class Mesh extends Node{constructor(g,m){super();this.isMesh=true;
  this.geometry=g;this.material=m}}
class Mat{constructor(o={}){Object.assign(this,o);
  this.color={value:o.color,setHex(v){this.value=v}}}}
class Geo{
  constructor(...args){this.args=args;this.attributes={}}
  setAttribute(n,v){this.attributes[n]=v;return this}
  setIndex(i){this.index=i;return this}
  computeVertexNormals(){}
  computeBoundingSphere(){}
}
class Attribute{constructor(a,size){this.array=a;this.itemSize=size}}
const THREE={Vector3:Vec,Group:Node,Mesh,BoxGeometry:Geo,
  SphereGeometry:Geo,CylinderGeometry:Geo,RingGeometry:Geo,
  BufferGeometry:Geo,Float32BufferAttribute:Attribute,
  MeshStandardMaterial:Mat,MeshBasicMaterial:Mat,DoubleSide:2};
const win={
  Crossroads3DMiniatureProfiles:{
    normalize:p=>({headSize:1,bodyWidth:1,packSize:1,bootSize:1,...p}),
    read:()=>({})
  },
  Crossroads3DSoldierIK:{solve:({hipY,hipZ,footY,footZ})=>({
    hip:{y:hipY,z:hipZ},knee:{y:(hipY+footY)/2,z:(hipZ+footZ)/2-.06},
    ankle:{y:footY,z:footZ}
  })}
};
for(const name of ["miniature-sculpt-shapes.js",
  "weapon-archetypes.js","weapon-geometry.js",
  "miniature-weapon-library.js","miniature-historical-weapons.js",
  "miniature-faction-gear.js","miniature-sdf-transitions.js",
  "miniature-heroic-character.js"]){
  const script=read("src/diorama/"+name);
  new vm.Script(script,{filename:name}).runInNewContext({window:win});
}
assert.equal(typeof win.Crossroads3DHeroicMiniature.create,"function");
const make=win.Crossroads3DHeroicMiniature.create({
  THREE,miniatureScale:.37,motion:{gaitFor:()=>({stepLength:.48,bob:.05})},
  shape:(parent,g,m,x,y,z)=>{const o=new Mesh(g,m);
    o.position.set(x,y,z);parent.add(o);return o}
});
assert.equal(typeof make,"function");
const kinds=new Set();
for(const faction of ["poland","germany"]){
  for(const role of ["rifle","smg","lmg","mmg","crew","officer","loader"]){
    const squad={root:new Node(),soldiers:[],index:0,
      unit:{type:"rifleSquad",mmgDeployed:true}};
    const kit=faction==="poland"?"poland_1939":"germany_1939";
    make(squad,0,0,0,{kit:{factionId:faction,id:kit},role},0,1);
    const s=squad.soldiers[0];
    assert(s.gear&&s.gear.faction===faction,
      "every sculpted soldier loads country-specific gear");
    assert(s.gear.gait.length===0&&s.legs.every(l=>Array.isArray(l.shin.material)),
      "lower leg garments are one joined material-banded shin, without extra floating sleeves");
    assert(s.gear.webbing.children.length>=5,
      "raised front ammunition pouches and thick pack supports visible");
    assert.equal(s.modelVersion,3);
    assert(s.arms.every(a=>a.seam&&a.seam.geometry.userData.sdfBaked),
      "elbow transition sleeves must be SDF baked");
    assert(s.legs.every(l=>l.seam&&l.seam.geometry.userData.sdfBaked),
      "knee transition sleeves must be SDF baked");
    assert(s.arms.every(a=>a.skinHand.scale.y<a.skinHand.scale.x),
      "hands should be a single flat mitten rather than a sphere");
    assert(Math.abs(s.headGroup.position.y-.406)<.001);
    const hat=s.headGroup.children.find(n=>n.children?.length>0);
    assert(hat?.position.y<-.045&&hat?.position.z<-.02,
      "helmet must sit lower and forward on the skull");
    assert(hat.scale.x>1,"helmet shell is slightly larger");
    assert(s.headGroup.scale.x>1,
      "default heroic head is visibly enlarged");
    if(role!=="officer"){
      const helmet=s.editableParts.get("helmet")[0];
      assert(helmet?.geometry.userData?.sdfBaked,
        "helmet shell and brim must share one SDF surface");
      assert(helmet.geometry.attributes.normal.array.every(Number.isFinite),
        "baked helmet normals must be finite");
    }
    // Intentional low-mesh mannequin: no second jaw, eye spheres, helmet
    // chinstraps, loose thumbs/cuffs, or disconnected boot trim.
    assert.equal(s.headGroup.children.length,6,
      "one cranium, two ears, two flat eyes and the headwear group");
    assert(s.arms.every(a=>a.hand.children.length===1),
      "hands use one mesh, not floating thumb/cuff geometry");
    assert(s.legs.every(l=>l.boot.children.length===1),
      "boots have a single contiguous mesh, no extra soles/heels/cuffs");
    assert(s.legs.every(l=>l.bootModel.upper.geometry.index.length<=400),
      "simple boot geometry stays under the triangle budget");
    s.setMannequin(true);
    s.applyPose({action:"idle"});
    assert.equal(s.equipmentRoot.visible,false,
      "editor mannequin must stay stripped across animation frames");
    s.setMannequin(false);
    s.applyPose({action:"idle"});
    assert.equal(s.equipmentRoot.visible,true,
      "equipped figure returns without hidden-kit leakage");
    assert(s.base.parent===s.figure&&s.body.parent===s.figure,
      "miniature base is separate from animated body");
    assert.equal(s.torso.geometry.attributes.position.itemSize,3);
    assert(s.torso.geometry.index.length>30);
    // The primary inspection poses must expose the real proportions.
    s.applyPose({action:"reference"});
    assert.equal(s.weapon.visible,false,
      "unarmed neutral pose hides carried weapon");
    assert.equal(s.equipmentRoot.visible,false,
      "unarmed reference avoids gear obscuring the silhouette");
    assert(Math.abs(s.breathing.position.y-.90)<.001,
      "standing torso must be vertically extended, not compressed");
    assert(s.legs.every(leg=>leg.mesh.position.y>.55),
      "standing knees remain beneath extended hips");
    s.applyPose({action:"tpose"});
    assert(s.arms[0].hand.position.x<-.5&&
      s.arms[1].hand.position.x>.5,
      "T pose extends both arms away from the torso");
    assert(Math.abs(s.arms[0].hand.position.y-.210)<.001,
      "T pose hands are at shoulder level");
    s.applyPose({action:"idle"});
    assert.equal(s.equipmentRoot.visible,true,
      "battle-ready idle restores field kit");
    s.applyPose({action:"idle"});
    assert(s.legs[0].mesh.position.z<0,
      "idle knee has a little natural forward bend");
    s.applyPose({action:"walk",leftLift:.13,rightReach:.11,lean:.12});
    s.applyPose({action:"kneel",crouch:.69,aim:true});
    s.applyPose({action:"down",crouch:.84,lean:.24,forward:.08});
    s.applyPose({action:"casualty",fall:1});
    assert.equal(s.base.rotation.z,0,"fall must not roll the base");
    assert(s.body.rotation.z<-.6);
    assert(Number.isFinite(s.muzzleLocal.z),"valid muzzle anchor");
    s.applyProfile({headSize:1.2,bodyWidth:1.02,bootSize:1.05});
    assert.equal(s.torso.scale.x,1.08*1.02);
    assert.equal(s.torso.scale.y,.91);
    assert(s.legs.every(l=>l.boot.scale.x<1));
    s.applyProfile({bodyWidth:1.12});
    assert.equal(s.torso.scale.x,1.08*1.12,
      "profiles are multipliers and must not accumulate");
    s.setInspectionMode("body");
    assert(s.uniformGroup.visible===true&&
      s.equipmentRoot.visible===false,
      "body inspection uses the real torso, not duplicate mannequin blobs");
    s.setInspectionMode("silhouette");
    assert(s.equipmentRoot.visible===true);
    s.setInspectionMode("equipped");
    assert(s.equipmentRoot.visible===true);
    if(role==="mmg"){
      s.setGunDeployed(true);
      const mount=s.figure.children.find(c=>c!==s.base&&
        c!==s.body&&c.visible&&c.children.some(n=>n.children?.length));
      assert(mount,"mounted support weapon must remain a figure sibling");
      s.setGunDeployed(false);
    }
    const before=s.figure.children.length;
    for(const arm of s.arms)
      assert(arm.seam?.position&&Number.isFinite(arm.seam.position.y));
    for(const leg of s.legs)
      assert(leg.seam?.position&&Number.isFinite(leg.seam.position.y));
    s.applyLook({uniform:"olive",helmet:"off",pack:"off"});
    assert(s.figure.children.length===before);
    s.figure.traverse(node=>{
      if(node.isMesh){
        const geometry=node.geometry;
        if(geometry?.attributes?.position){
          assert([...geometry.attributes.position.array].every(Number.isFinite),
            "no invalid sculpture vertices");
        }
      }
    });
  }
}
const src=read("src/diorama/miniature-historical-weapons.js");
assert(src.includes("wz28")&&src.includes("kar98k")&&src.includes("mg34"));
assert(src.includes("mp38")&&src.includes("mors39"));
assert(src.includes('weapon.visible=!deployed'));
const factory=read("src/diorama/miniature-model.js");
assert(factory.includes("Crossroads3DHeroicMiniature?.create"));
for(const p of ["miniature-studio.html","battle3d.html","editor3d.html"]){
  const html=read(p);
  for(const file of ["miniature-sculpt-shapes.js",
    "miniature-historical-weapons.js","miniature-heroic-character.js"])
    assert(html.includes(file+"?v=0.9.62"),p+" missing "+file);
  assert(html.indexOf("miniature-sculpt-shapes.js")<
    html.indexOf("miniature-heroic-character.js"),"load order");
}
// Pose actions are declared once and lab-specific poses do not mutate rules.
const poseSrc=read("src/diorama/miniature-studio-poses.js");
const poseContext={window:{}};
vm.runInNewContext(poseSrc,poseContext);
const poseNames=poseContext.window.Crossroads3DSoldierActions.ACTIONS.map(a=>a[0]);
assert(poseNames.includes("reference")&&poseNames.includes("tpose"));
assert.equal(poseContext.window.Crossroads3DSoldierActions.frame("tpose",0,{}).crouch,0);
console.log("PASS — sculpted soldier variants, geometry, stances, held weapons, equipment and stable base");
