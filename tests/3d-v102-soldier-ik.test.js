"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("src/diorama/soldier-ik.js"),sandbox);
const ik=sandbox.window.Crossroads3DSoldierIK;
for(const z of [0,-.18,.1]){
 const pose=ik.solve({hipY:.54,footY:.22,footZ:z});
 assert(Math.abs(Math.hypot(pose.knee.y-pose.hip.y,pose.knee.z-pose.hip.z)-.255)<.0005);
 assert(Math.abs(Math.hypot(pose.knee.y-pose.ankle.y,pose.knee.z-pose.ankle.z)-.255)<.0005);
 assert(pose.knee.z<0);
}
const wall=[{a:{x:0,z:-1},b:{x:0,z:1},kind:"wall"}];
assert(ik.crossingLift({x:0,z:0},{x:-2,z:0},{x:2,z:0},wall)>.15);
assert.equal(ik.crossingLift({x:0,z:0},{x:-2,z:2},{x:2,z:2},wall),0);
assert.equal(ik.crossingLift({x:0,z:0},{x:0,z:-2},{x:0,z:2},wall),0);
const scene=read("src/diorama/scenario-scene.js");
for(const marker of ["soldierIK.solve","soldierIK.crossingLift","soldier.crossingLift=0","leg.shin"])
 assert(scene.includes(marker));
console.log("PASS — two-bone soldier IK and crossing-specific step-up.");
