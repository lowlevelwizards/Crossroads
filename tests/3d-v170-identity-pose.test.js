"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
 path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
class Vec{
 constructor(x=0,y=0,z=0){this.set(x,y,z)}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Node{
 constructor(){this.position=new Vec;this.scale=new Vec(1,1,1);
  this.rotation={x:0,y:0,z:0};this.userData={};this.children=[];this.visible=true}
 add(child){this.children.push(child);child.parent=this}
}
class Mesh extends Node{
 constructor(g,m){super();this.geometry=g;this.material=m}
}
class Geo{
 constructor(){this.attributes={};this.groups=[];this.userData={};this.normals=0}
 setAttribute(k,a){this.attributes[k]=a;return this}
 setIndex(i){this.index=i;return this}
 clearGroups(){this.groups=[]}
 addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})}
 computeVertexNormals(){this.normals++}
 computeBoundingSphere(){}
}
class Attr{
 constructor(data,size){this.array=new Float32Array(data);this.itemSize=size;this.needsUpdate=false}
}
const THREE={Vector3:Vec,Group:Node,Mesh,BufferGeometry:Geo,
 SphereGeometry:Geo,BoxGeometry:Geo,Float32BufferAttribute:Attr,
 MeshBasicMaterial:class {constructor(options){this.options=options}},
 MeshStandardMaterial:class {constructor(options){this.options=options}},
 DoubleSide:2};
const window={};
for(const name of ["miniature-sculpt-shapes.js","miniature-faction-gear.js",
 "miniature-sdf-transitions.js","miniature-studio-poses.js"]){
 new vm.Script(read("src/diorama/"+name),{filename:name})
   .runInNewContext({window});
}

const sdf=window.Crossroads3DSDFTransitions;
const gear=window.Crossroads3DFactionGear;
const S=window.Crossroads3DSculptShapes.create(THREE);
function samples(faction){
  const g=sdf.helmetPatternGeometry(THREE,faction);
  const a=g.attributes.position.array,ring=37,hem=7,verts=9;
  const at=(r,s)=>Array.from(a.slice((r*ring+s)*3,(r*ring+s)*3+3));
  const front=at(hem,27),rear=at(hem,9),side=at(hem,0);
  assert(g.userData.helmetPattern===faction);
  assert(g.userData.triangleCount<700,
    "helmet must stay below 700 triangles at gameplay scale");
  assert(g.index.length>0&&a.every(Number.isFinite));
  assert(front[1]>rear[1],"helmet has eyebrow clearance and lower nape");
  assert(at(0,0)[1]>front[1]+.18,"crown forms coherent high dome");
  assert(Math.abs(front[0])<.001&&Math.abs(rear[0])<.001);
  assert(verts*ring*3===a.length);
  return {front,rear,side,vertices:a.length/3};
}
const pol=samples("poland"),ger=samples("germany");
assert(ger.side[0]>pol.side[0],
  "German M35 has a broad wrapping skirt");
assert(ger.rear[1]<pol.rear[1]-.05,
  "German M35 skirts visibly lower at rear than Polish wz.31");
assert(Math.abs(pol.front[2]-ger.front[2])>.012,
  "Polish wz.31 and German M35 front silhouettes differ noticeably");
const mat={pack:{},straps:{},hardware:{},uniform:{},trousers:{},
 boots:{},steel:{}};
const factory=gear.create(THREE,S);
for(const faction of ["poland","germany"]){
 const e=new Node(),p=new Node(),g=factory.outfit({
    faction,role:"rifle",mat,equipmentRoot:e,packGroup:p,legs:[]
 });
 assert(g.rearHarness,"rear rig is a separate removable visual layer");
 assert.equal(g.rearHarness.children.length,3,
   "two rear rails and one period-specific cross/Y bridge");
 g.setPackPresent(true);assert.equal(g.rearHarness.visible,false);
 g.setPackPresent(false);assert.equal(g.rearHarness.visible,true);
 const first=g.rearHarness.children[0];
 const before=Array.from(first.geometry.attributes.position.array);
 g.setBodyWidth(1.24);
 assert.notDeepEqual(Array.from(first.geometry.attributes.position.array),before,
   "rear straps follow live torso proportions");
 assert(first.geometry.attributes.position.array.every(Number.isFinite));
}
const hero=read("src/diorama/miniature-heroic-character.js");
for(const token of ["silhouette-helmet-v7","setPackPresent?.",
  'carry==="german-side"','carry==="polish-two"',
  "weapon.userData.carryMode=carry",
  "armaments.anchors.butt","stockPocket.sub(butt)",
  "moving&&faction==="+"\"germany\"","headGroup.rotation.x-=sight*.11"]){
 // The cache key is declared in the SDF builder, not the soldier module.
 if(token==="silhouette-helmet-v7"){
   assert(read("src/diorama/miniature-sdf-transitions.js").includes(token));
 }else assert(hero.includes(token),token);
}
assert(hero.includes("side*.071,.132,-.184"),
  "eyes lower on the fuller heroic face");
assert(!hero.includes("weapon.position.set(.028,"),
  "old fixed stomach-height weapon pose must be gone");
for(const js of ["src/diorama/miniature-sdf-transitions.js",
 "src/diorama/miniature-faction-gear.js",
 "src/diorama/miniature-heroic-character.js",
 "src/diorama/miniature-studio-poses.js",
 "src/diorama/miniature-historical-weapons.js"])
 new vm.Script(read(js),{filename:js});
for(const page of ["miniature-studio.html","battle3d.html"])
 assert(read(page).includes("miniature-sdf-transitions.js?v=0.9.71"));
assert(read("editor3d.html").includes("miniature-sdf-transitions.js?v=0.9.70"));
console.log("PASS — v0.9.70 independent historical helmet contours, rear field harness and shoulder-first poses");
