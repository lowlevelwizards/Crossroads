"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={},ctx=vm.createContext({window:w});
for(const file of ["src/diorama/study-motion.js","src/diorama/miniature-studio-poses.js"])
 vm.runInContext(read(file),ctx,{filename:file});
const motion=w.CrossroadsDioramaMotion,actions=w.Crossroads3DSoldierActions;
assert.equal(actions,w.Crossroads3DStudioPoses);
for(const run of [false,true]){
 const cycle=.48*(run?1.14:1),duty=run?.53:.61;
 const before=motion.plantedGait(0,.48,1,0,run);
 const after=motion.plantedGait(cycle*duty*.8,.48,1,0,run);
 assert(before.leftPlanted&&after.leftPlanted);
 assert(Math.abs(after.leftReach-before.leftReach-cycle*duty*.8)<.001,
  "stance compensates world movement");
 assert.equal(after.leftLift,0);
 const swing=motion.plantedGait(cycle*(duty+(1-duty)*.5),.48,1,0,run);
 assert(swing.leftLift>.05&&!swing.leftPlanted);
}
for(const action of ["down","walk","run","fire","deploy","pack","casualty"]){
 assert(actions.ACTIONS.some(a=>a[0]===action));
 assert(Number.isFinite(actions.duration(action)));
}
assert(actions.frame("down",0,motion).crouch>.6);
const scene=read("src/diorama/scenario-scene.js");
assert(scene.includes("const sharedPose=soldierActions?.frame"));
assert(scene.includes("const feet=motion.plantedGait("));
console.log("PASS — distance-anchored stance, shared actions and role transitions");
