"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm"),
 fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const ctx=vm.createContext({window:{}});
for(const f of ["src/diorama/crew-presentation.js",
 "src/diorama/suppression-posture.js","src/diorama/ai-tactics.js",
 "src/diorama/miniature-studio-poses.js"])
 vm.runInContext(read(f),ctx,{filename:f});
const C=ctx.window.Crossroads3DCrewPresentation,
 S=ctx.window.Crossroads3DSuppressionPosture,
 A=ctx.window.Crossroads3DAITactics,
 Lab=ctx.window.Crossroads3DStudioPoses;
const full={id:"mg",type:"mmgTeam",role:"support",
 soldiers:3,mmgDeployed:true,mmgFacing:0,
 weapons:{mmg:1},faction:"red",x:15,y:24,pins:0};
assert.equal(C.describe(full).crewCount,3);
assert.equal(C.describe(full).roles[1],"loader");
assert.equal(C.describe({...full,soldiers:2}).reduced,true);
assert.equal(C.describe({...full,soldiers:1}).canOperate,false);
assert.equal(C.describe({...full,mmgDeployed:false}).canOperate,false);
assert.equal(C.describe({...full,mmgDeployed:false}).deployed,false);
const deploy=C.frame(full,"deploy",1.15,0);
assert(deploy.crouch>.2);
assert.equal(C.frame(full,"deploy",0,0).setup,0);
assert.equal(C.frame(full,"deploy",1.15,0).setup,1);
assert.equal(C.frame(full,"pack",1.15,0).setup,0);
const loader=C.frame(full,"fire",.25,1);
assert.equal(loader.role,"loader");
assert(loader.feed>.5);
assert.equal(C.frame({...full,soldiers:1},"fire",.25,1).active,false);
assert(C.reach({x:0,z:0},{x:.2,z:.1}).reachable);
assert(!C.reach({x:0,z:0},{x:2,z:0}).reachable);
assert(read("src/diorama/miniature-heroic-character.js").includes(
  "near<.53"),"loader feed attachment must be physically reach-limited");
assert(C.sector(full,{x:30,y:24}).inside);
assert(!C.sector(full,{x:0,y:24}).inside);
assert(C.sector(full,{x:30,y:30}).inside);
const calm=S.evaluate({pins:0}),one=S.evaluate({pins:1}),
 three=S.evaluate({pins:3});
assert(three.crouch>one.crouch&&one.crouch>calm.crouch);
assert(three.headDuck>one.headDuck);
assert(S.evaluate({down:true,pins:2}).crouch>.8);
assert.equal(S.evaluate({casualty:true,down:true}).priority,"casualty");
assert(S.evaluate({pins:3,walking:true}).crouch<three.crouch);
assert(S.evaluate({pins:3,firing:true}).crouch<three.crouch);
const p=S.transition(null,three,.02),p2=S.transition(p,calm,.02);
assert(p.crouch>0&&p.crouch<three.crouch);
assert(p2.crouch<p.crouch);
assert(S.evaluate({officer:true,recovery:.7}).gesture>.6);
const enemies=[{id:"e1",faction:"blue",soldiers:5,x:30,y:22,visible:true},
{id:"e2",faction:"blue",soldiers:5,x:31,y:26,visible:true}];
assert.equal(A.mmgRotation(full,enemies),0,
 "MMG should hold when a valuable target group is already in its 90-degree arc");
assert.equal(Math.abs(A.mmgRotation({...full,mmgFacing:180},enemies)),45,
 "MMG must rotate by one legal step, not rotate the whole team instantly");
assert(A.sectorScore(full,enemies,0)>A.sectorScore(full,enemies,180));
assert.equal(A.mmgRotation({...full,mmgDeployed:false},enemies),0);
const game={units:[full,...enemies],objectives:[{x:23,y:24,state:"blue"}],
 terrain:[],table:{width:72,height:48}};
assert(A.supportPositionScore(full,full,game)>0);
assert(A.shouldHoldSupport(full,game));
assert(!A.shouldHoldSupport({...full,mmgDeployed:false},game));
const legal=()=>({legal:true,cost:4,allowance:6,path:[]});
const move=A.chooseMove(game,{...full,mmgDeployed:false},legal,true);
assert(move.candidates.length>0);
for(const pose of ["crew-deploy","crew-ready","crew-traverse","crew-fire",
 "crew-pack","crew-pinned","crew-rally"]){
 assert(Lab.ACTIONS.some(x=>x[0]===pose),pose+" missing");
 const before=Lab.frame(pose,.55,{gaitPose:()=>({bob:0,lean:0})},"mmg");
 assert(Number.isFinite(before.crouch));
}
const scene=read("src/diorama/scenario-scene.js");
const mini=read("src/diorama/miniature-heroic-character.js");
const weapons=read("src/diorama/miniature-historical-weapons.js");
const lab=read("src/diorama/miniature-studio.js");
for(const needle of ["crewPresentation?.describe","crewPresentation.frame",
 "suppressionPosture?.evaluate","suppressionPosture.transition",
 "setGunTraverse?.","debugCrew","moraleRecoverUntil"])
 assert(scene.includes(needle),"scene is missing "+needle);
assert(mini.includes("mountParent:role"));
assert(weapons.includes("mountParent?mountParent:figure"));
assert(lab.includes("crewActors.push(assistant)"));
assert(lab.includes("studioCrewCount")&&lab.includes("studioCrewMode"));
for(const page of ["battle3d.html","editor3d.html","miniature-studio.html"]){
 const html=read(page);
 assert(html.includes("crew-presentation.js?v=0.9.76"));
 assert(html.includes("suppression-posture.js?v=0.9.76"));
 assert(html.indexOf("crew-presentation.js")<html.indexOf("miniature-heroic-character.js"));
}
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,"0.9.76");
for(const f of ["src/diorama/scenario-scene.js",
 "src/diorama/miniature-historical-weapons.js",
 "src/diorama/miniature-heroic-character.js",
 "src/diorama/miniature-studio.js","src/diorama/ai-opponent.js"])
 assert.doesNotThrow(()=>new vm.Script(read(f),{filename:f}));
console.log("PASS — v0.9.76 crew authority, mounted arcs, morale, support AI and 3-soldier Lab contract");
