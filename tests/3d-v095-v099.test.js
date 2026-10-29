"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sandbox={window:{}};
function load(p){vm.runInNewContext(read(p),sandbox,{filename:p})}
load("src/diorama/study-motion.js");
const motion=sandbox.window.CrossroadsDioramaMotion;
const idle=motion.gaitPose(0,.48,0,0);
assert.equal(idle.bob,0,"no idle bob");
assert.equal(idle.leftLift,0);
assert.equal(idle.rightLift,0);
assert(motion.gaitPose(.12,.48,1,0).leftLift>0,"swing foot lift");
assert(motion.gaitPose(.36,.48,1,0).rightLift>0,"alternating swing foot");
assert(motion.travelDuration(2,true)<motion.travelDuration(2,false),"run is faster");
load("src/diorama/shot-explanation.js");
const shot=sandbox.window.Crossroads3DShotExplanation;
assert.match(shot.summarize({legal:false,reason:"Wall"}),/BLOCKED.*Wall/);
const detail=shot.describe({legal:true,distance:12,
  weapons:[{shots:3,label:"Rifles",hitTarget:5}],
  cover:{label:"Hard cover",saveTarget:5}});
assert(detail.includes("Hard cover")&&detail.includes("5+"));
load("src/diorama/ai-tactics.js");
const ai=sandbox.window.Crossroads3DAITactics;
const mmg={id:"gun",role:"support",type:"mmgTeam",faction:"red",soldiers:3,pins:0,x:10,y:10};
const snapshot={units:[mmg,{id:"foe",faction:"blue",soldiers:6,x:19,y:10}],
  objectives:[{state:"red",x:10,y:10}]};
assert.equal(ai.chooseOrder(snapshot,mmg,["Ambush","Advance","Fire"],()=>null,
  {fire:new Set(),move:new Set()}),"Ambush");
const scene=read("src/diorama/scenario-scene.js");
for(const marker of ["miniatureLab?.attach(","shotExplanation.summarize",
  "feet.leftLift","squad.arcIndicator","Crossroads3DMiniatureModel?.create"])
  assert(scene.includes(marker),marker+" not wired into 3D scene");
const html=read("battle3d.html");
for(const script of ["src/diorama/study-motion.js","src/diorama/shot-explanation.js",
  "src/diorama/miniature-model.js","src/diorama/scenario-scene.js"])
  assert(html.includes(script),"Missing entry script "+script);
assert(html.indexOf("miniature-model.js")<html.indexOf("scenario-scene.js"));
assert(!html.includes("miniature-lab.js"),"The lab must not load inside battles");
console.log("PASS — 3D v0.9.5–0.9.21 preview gait, legal shot detail, support AI and lab integration");
