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
const S=window.Crossroads3DSculptShapes.create(THREE);
const body=new Node();
const ribbon=S.surfaceRibbon(body,{},[[.12,.27],[.16,.15],[.14,-.08]],
  (x,y,width)=>-.18-.014*x*width,.065);
const attr=ribbon.geometry.attributes.position;
assert(attr.array.some(v=>v!==0),"new strap must have nonzero GPU positions");
assert(attr.array[2]<-.18,"strap must sit outward from tunic");
const before=Array.from(attr.array);
ribbon.userData.refreshRibbon(1.25);
assert(attr.needsUpdate===true);
assert.notDeepEqual(Array.from(attr.array),before,
 "refresh must update the actual BufferAttribute array (not a discarded input)");
assert(ribbon.geometry.normals>=2,"refresh computes normals");
assert(ribbon.geometry.index.length===12);
assert(attr.array.every(Number.isFinite));
const skin=S.clothedShin(body,{},{},"germany");
const polish=S.clothedShin(body,{},{},"poland");
assert.equal(skin.geometry.groups.length,10);
assert.equal(skin.geometry.groups[0].materialIndex,0,
 "German trouser starts at knee");
assert.equal(skin.geometry.groups[7].materialIndex,1,
 "German boot extends to ankle");
assert.equal(polish.geometry.groups[6].materialIndex,1,
 "Polish puttees have deliberate, continuous lower-leg material bands");
const mat={pack:{},straps:{},hardware:{},uniform:{},trousers:{},
 boots:{},steel:{}};
const gear=window.Crossroads3DFactionGear.create(THREE,S);
for(const faction of ["poland","germany"]){
 const equipmentRoot=new Node(),packGroup=new Node();
 const p=gear.outfit({faction,role:"rifle",mat,equipmentRoot,packGroup,legs:[]});
 assert(p.webbing.children.length>=5);
 const fitted=p.webbing.children.find(x=>x.userData.refreshRibbon);
 assert(fitted);
 const narrow=Array.from(fitted.geometry.attributes.position.array);
 p.setBodyWidth(1.28);
 assert.notDeepEqual(Array.from(fitted.geometry.attributes.position.array),narrow);
 assert(fitted.geometry.attributes.position.array.every(Number.isFinite));
 assert.equal(typeof p.setDebug,"function");
 p.setDebug(true);
 const markers=p.webbing.children.find(x=>x.children.length>=12);
 assert(markers&&markers.visible===true);
 assert(markers.children.every(x=>Number.isFinite(x.position.z)));
 p.setDebug(false);assert.equal(markers.visible,false);
}
const hero=read("src/diorama/miniature-heroic-character.js");
assert(hero.includes('if(kneel){')&&hero.includes("rear?.199:.410"));
assert(hero.includes("head-silhouette-v6"));
assert(hero.includes("setAttachmentDebug"));
const weapon=read("src/diorama/miniature-historical-weapons.js");
assert(!weapon.includes(".022*bore,-.082"),"floating gas tube removed");
assert(weapon.includes("G.block(bipod,hardware,[.073,.062,.080]"),
 "bipod hinge should visibly connect to gun");
for(const page of ["miniature-studio.html","battle3d.html"])
 assert(read(page).includes("miniature-sculpt-shapes.js?v=0.9.71"));
assert(read("editor3d.html").includes("miniature-sculpt-shapes.js?v=0.9.71"));
assert(read("miniature-studio.html").includes('id="studioAttachmentDebug"'));
assert(read("src/diorama/miniature-studio.js").includes("setAttachmentDebug?."));
const poses=window.Crossroads3DStudioPoses;
assert(poses.frame("kneel",0,{gaitPose(){}}).crouch<.6);
console.log("PASS — v0.9.70 live webbing buffers, faction legwear, debug markers, kneel and attached weapon parts");
