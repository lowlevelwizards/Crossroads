"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
 path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
for(const file of ["src/diorama/soldier-ik.js","src/diorama/ai-tactics.js",
  "src/diorama/garrison-windows.js","src/diorama/assault-motion.js",
  "src/diorama/cover-positions.js","src/diorama/formation-layout.js",
  "data/scenarios.js"]){
 new vm.Script(read(file),{filename:file}).runInNewContext(sandbox);
}
const w=sandbox.window;
const ik=w.Crossroads3DSoldierIK,env=ik.strideEnvelope(1,.8,true);
assert(env.reach<=.29&&env.lift<=.20);
const extreme=ik.solve({hipY:.2,footY:.2,hipZ:0,footZ:0});
for(const joint of [extreme.hip,extreme.knee,extreme.ankle])
 assert(Number.isFinite(joint.y)&&Number.isFinite(joint.z));
const cover=w.Crossroads3DCoverPositions;
const a={id:"a",a:{x:-1,z:0},b:{x:1,z:0},kind:"wall"};
const safe=cover.arrange({x:0,z:-.6},[{x:0,z:0}],[a],{x:0,z:3});
assert(safe&&safe.points[0].cover);
const wrong=cover.arrange({x:0,z:-.6},[{x:0,z:0}],[a],{x:0,z:-3});
assert(wrong&&!wrong.points[0].cover);
const audit=w.Crossroads3DFormationLayout.deviation(
 [{x:.1,z:0},{x:2,z:0}],[{x:0,z:0},{x:0,z:0}]);
assert.equal(audit.over,1);
const socket={x:1,z:0,normal:{x:1,z:0},outlet:{x:1.1,z:0}};
const inside=w.Crossroads3DGarrisonWindows.authoredSlots([socket],{x:4,z:0},2);
assert(inside.length===2&&inside[1].x<inside[0].x);
const fallback=w.Crossroads3DGarrisonWindows.slots(
 {x:0,z:0,width:5,depth:4},{x:-10,z:0},3,[socket]);
assert.equal(fallback.length,3,
 "unusable authored windows must fall back to safe facade placement");
const assault=w.Crossroads3DAssaultMotion;
const g=assault.create({x:0,z:0},{x:4,z:0});g.age=.35;
assert(assault.individualPose(g,0).lean>0);
const ai=w.Crossroads3DAITactics;
const s={round:2,units:[
 {id:"r1",faction:"red",role:"line",soldiers:6,x:7,y:7},
 {id:"r2",faction:"red",role:"line",soldiers:6,x:8,y:8},
 {id:"e1",faction:"blue",role:"line",soldiers:6,x:30,y:24}],
 objectives:[{id:"east",x:35,y:23},{id:"west",x:4,y:26}]};
const plan=ai.makePlan(s,"red");
assert(plan.assignments.r1&&plan.assignments.r2);
assert.notEqual(plan.assignments.r1.targetId,plan.assignments.r2.targetId,
 "squads should distribute over available objectives");
for(const id of ["patrol_clash","farm_raid"]){
 const scenario=w.CROSSROADS_SCENARIOS[id];
 assert(scenario&&scenario.forces.blue.length===3&&scenario.forces.red.length===3);
 assert(scenario.objectives.length>0&&scenario.terrain.length>0);
}
assert(read("index.html").includes('href="./skirmish.html"'));
assert(read("skirmish.html").includes("CROSSROADS_SCENARIOS"));
assert(JSON.parse(read("release-manifest.json")).entryPoints.includes("skirmish.html"));
for(const file of ["src/diorama/miniature-heroic-character.js",
 "src/diorama/scenario-scene.js","src/diorama/ai-opponent.js",
 "src/diorama/combat-presentation.js"])
 new vm.Script(read(file),{filename:file});
console.log("PASS — v0.9.76 soldier IK, AI goals, cover, garrison, assaults, skirmishes.");
