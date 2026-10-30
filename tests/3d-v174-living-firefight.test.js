"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm"),
 fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={},ctx=vm.createContext({window:w});
for(const file of ["src/diorama/weapon-presentation.js",
 "src/diorama/combat-presentation.js","src/diorama/soldier-pose-controller.js",
 "src/diorama/miniature-studio-poses.js"])
 vm.runInContext(read(file),ctx,{filename:file});
const W=w.Crossroads3DWeaponPresentation,P=w.Crossroads3DCombatPresentation,
  poses=w.Crossroads3DStudioPoses;
const roster=[{role:"rifle"},{role:"lmg"},{role:"loader"},
 {role:"smg"},{role:"mmg"},{role:"officer"}];
const groups=[{key:"rifle",shots:2},{key:"lmg",shots:3},
 {key:"smg",shots:4},{key:"mmg",shots:5},{key:"pistol",shots:1}];
const shots=W.schedule(groups,roster);
assert.equal(shots.length,15);
assert.equal(shots.filter(x=>x.role==="mmg").length,5);
for(let i=1;i<shots.length;i++)
 assert(shots[i].delay>shots[i-1].delay,"shots must have unique ordered timestamps");
for(const shot of shots){
 assert.equal(shot.shotIndex,shots.indexOf(shot));
 assert.equal(roster[shot.soldierIndex].role,shot.role);
}
assert(W.duration(groups,[])>=shots[shots.length-1].delay+.20,
 "a combat director without the full roster must retain every flash");
assert.equal(W.schedule([{key:"rifle",shots:0}],roster).length,0);
assert.equal(W.schedule([{key:"rifle",shots:1000}],roster).length,96,
 "mobile visual budget cannot emit unlimited cosmetic effects");
for(const role of ["rifle","officer","smg","lmg","mmg"]){
 const m=W.mechanics[role];
 for(const time of [0,.01,.12,.3,.5,1.0,5]){
  const result=W.motionAt(role,time);
  assert(result.recoil>=0&&result.recoil<=m.recoil+1e-9);
  assert(result.weaponCycle>=0&&result.weaponCycle<=1);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),
    JSON.parse(JSON.stringify(W.motionAt(role,time))),
    "mechanical actions must replay deterministically");
 }
 assert.equal(W.motionAt(role,2).weaponCycle,0,
   "no residual weapon animation after recoil recovery");
}
const saved=W.impactPlan({hits:3,saved:2,casualties:1},6);
assert.equal(saved.length,3);
assert.equal(saved.filter(x=>x.kind==="casualty").length,1);
assert.equal(saved.filter(x=>x.kind==="cover").length,2);
assert.equal(W.impactPlan({hits:0,pinDelta:3},6).length,0,
 "misses and pins must not invent hits");
const stage=[];
const director=P.create(s=>stage.push(s));
const e={id:74,type:"shooting",groups};
assert(director.enqueue(e));
assert(!director.enqueue(e),"replayed combat event may not discharge twice");
director.update(.02);
assert.equal(stage[0].phase,"aim");
for(let i=0;i<250&&director.active;i++)director.update(.05);
assert.equal(director.active,false);
assert.deepEqual(stage.map(x=>x.phase),
 ["aim","fire","hit-dice","damage-dice","save-dice","impact","settle"]);
const skipped=[];
const fast=P.create(s=>skipped.push(s));
fast.setSpeed(2.8);
fast.enqueue({id:75,type:"shooting",groups});
fast.update(.01);fast.skip();
assert.equal(skipped[skipped.length-1].phase,"settle");
assert.equal(skipped[skipped.length-1].skipped,true);
assert.equal(fast.pending,0);
const motion={gaitPose:()=>({bob:0,lean:0}),
 plantedGait:()=>({leftLift:0,rightLift:0,leftReach:0,rightReach:0})};
for(const role of ["rifle","smg","lmg","mmg","officer"]){
 const frame=poses.frame("fire-sequence",.53,motion,role);
 assert.equal(frame.aim,true);
 assert(frame.weaponReadiness>.9);
 assert(Number.isFinite(frame.weaponCycle||0));
 assert.deepEqual(JSON.parse(JSON.stringify(frame)),
  JSON.parse(JSON.stringify(poses.frame("fire-sequence",.53,motion,role)));
}
assert(poses.ACTIONS.some(x=>x[0]==="fire-sequence"));
assert(poses.ACTIONS.some(x=>x[0]==="burst-sequence"));
assert(poses.ACTIONS.some(x=>x[0]==="impact-sequence"));
const fire=poses.frame("fire-sequence",.44,motion,"rifle");
assert(fire.flash,"lab flash must coincide with the first real discharge");
const scene=read("src/diorama/scenario-scene.js"),
 client=read("src/diorama/battle-client.js");
for(const s of ["weaponPresentation?.schedule","weaponPresentation?.impactPlan",
 "weaponPresentation?.motionAt","burst.shotIndex","playShot?.",
 "combatDt","presentationSpeed","weaponMechanic","ejectCasing(",
 'stage.phase==="settle"&&stage.skipped'])
 assert(scene.includes(s),"scene not wired: "+s);
assert(!client.includes("audio?.playShooting(stage.event)"),
 "whole-volley audio must not duplicate per-discharge sound");
assert(client.includes("get presentationSpeed()"));
for(const file of ["src/diorama/scenario-scene.js",
 "src/diorama/miniature-heroic-character.js",
 "src/diorama/miniature-historical-weapons.js",
 "src/diorama/miniature-studio.js","src/diorama/combat-audio.js",
 "src/diorama/battle-client.js"])
 assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
const html=read("battle3d.html"),lab=read("miniature-studio.html");
assert(html.includes("weapon-presentation.js?v=0.9.74"));
assert(lab.includes("weapon-presentation.js?v=0.9.74"));
assert(lab.indexOf("weapon-presentation.js")<
 lab.indexOf("miniature-studio-poses.js"));
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,
 "0.9.74");
console.log("PASS — v0.9.74 deterministic firing, mechanical weapon loops, impacts, skip, Lab previews and cache discipline");
