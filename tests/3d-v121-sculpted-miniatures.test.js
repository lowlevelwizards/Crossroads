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
  "const right=toTorso(gripRight)","const left=toTorso(gripLeft)"
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
  assert(html.includes("miniature-v2.js?v=0.9.20"),page+" missing V2 loader");
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
assert.equal(manifest.threeDCacheVersion,"0.9.20");
assert(manifest.requiredFiles.includes("src/diorama/miniature-v2.js"));
console.log("PASS — V2 sculpted soldiers, separate casualty bodies, authored gear, shared lab/battle factory, and held action contract");
