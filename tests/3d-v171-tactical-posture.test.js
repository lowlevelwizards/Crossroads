"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
  path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
new vm.Script(read("src/diorama/soldier-pose-controller.js"),
  {filename:"soldier-pose-controller.js"}).runInNewContext(sandbox);
const api=sandbox.window.Crossroads3DSoldierPose;
assert(api&&typeof api.create==="function");
const zero=api.create({faction:"germany",role:"rifle",index:0});
let output=zero.step(.016,{order:null,walking:false});
assert.equal(output.weaponBlend,0);
assert(output.weaponReadiness<.1,"relaxed carry should not look shouldered");
const target=.60;
let previous=0;
for(let i=0;i<70;i++){
  output=zero.step(.016,{preview:true,order:"Fire",targetYaw:target,
    facing:0,pins:0});
  assert(output.weaponBlend>=previous-1e-9,"ADS blends monotonically");
  previous=output.weaponBlend;
}
assert(output.weaponBlend>.9,"selected legal target reaches ADS");
assert(output.headYaw>0&&output.torsoYaw>0,"head and torso track known target");
assert(Math.abs(output.headYaw)<=.42001,"look arc remains anatomically bounded");
assert(output.hasKnownTarget);
const rifle=api.profile("rifle"),mg=api.profile("lmg");
assert(mg.raise>rifle.raise&&mg.recoil>rifle.recoil,
  "heavy weapon handling is slower and more forceful");
const right=api.create({faction:"germany",role:"rifle",index:2});
const left=api.create({faction:"poland",role:"rifle",index:2});
assert.equal(right.step(.016,{walking:true}).weaponCarry,"german-side");
assert.equal(left.step(.016,{walking:true}).weaponCarry,"polish-two");
assert(api.stagger(0)!==api.stagger(1),"squad variation is stable");
const waiting=api.create({faction:"poland",role:"rifle",index:3});
for(let i=0;i<70;i++)waiting.step(.016,{order:"Fire"});
assert(waiting.state.readiness>.5&&waiting.state.ads<.05,
  "selecting Fire without a target raises the weapon to ready, not ADS");
const ambush=api.create({faction:"poland",role:"rifle",index:2});
let search;
for(let i=0;i<70;i++)search=ambush.step(.016,{order:"Ambush"});
assert(Math.abs(search.headYaw)>.01,
  "Ambush scanning has an intentional but limited head motion");
assert.equal(ambush.state.memoryYaw,null,
  "non-omniscient scan does not synthesize hidden target positions");
for(let i=0;i<275;i++)output=zero.step(.016,{order:null});
assert(output.weaponBlend<.2,"canceled targeting lowers the weapon");
assert.equal(output.hasKnownTarget,false,
  "last known target expires and must not become omniscience");
zero.reset();assert.equal(zero.state.memoryYaw,null);
assert.equal(zero.state.ads,0);
const acquire=api.lab("acquire",1),recovery=api.lab("recover",1);
assert.equal(acquire.weaponBlend,1);assert.equal(recovery.weaponBlend,0);
for(const file of ["battle3d.html","miniature-studio.html"]){
  const html=read(file);
  assert(html.includes("soldier-pose-controller.js?v=0.9.75"),
    file+" must load the controller with a fresh cache key");
}
const scene=read("src/diorama/scenario-scene.js");
for(const token of ["soldier.poseState?.step(dt", "soldier.previewFacing=facing",
  "soldier.weaponShotPending=true","selectedSquad?.soldiers?.forEach",
  "presentationAimUntil","aim:posture.weaponBlend>.85"])
  assert(scene.includes(token),"battle missing "+token);
const hero=read("src/diorama/miniature-heroic-character.js");
for(const token of ["pose.weaponReadiness","pose.weaponBlend",
 "headGroup.rotation.x-=sight*.11","armaments.animateAction?.",
 "weaponSocket=which","weapon.userData.carryMode=carry"])
 assert(hero.includes(token),"shared rig missing "+token);
const studio=read("src/diorama/miniature-studio.js");
assert(studio.includes('poseSelect.value==="transition"'));
assert(studio.includes("gripMarkers.visible"));
for(const file of ["src/diorama/miniature-heroic-character.js",
  "src/diorama/scenario-scene.js","src/diorama/miniature-studio.js",
  "src/diorama/miniature-studio-poses.js",
  "src/diorama/miniature-historical-weapons.js"])
 new vm.Script(read(file),{filename:file});
console.log("PASS — v0.9.75 layered soldier posture, weapon ADS, preview and lab regression");
