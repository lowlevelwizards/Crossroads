"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("src/diorama/ai-tactics.js"),sandbox);
const ai=sandbox.window.Crossroads3DAITactics;
const gun={id:"mmg",faction:"red",role:"support",type:"mmgTeam",
  soldiers:3,pins:0,mmgDeployed:true,mmgFacing:0,x:10,y:10,weapons:{mmg:1}};
assert.equal(ai.mmgRotation(gun,[{id:"east",x:20,y:10,soldiers:3}]),0);
assert.equal(ai.mmgRotation(gun,[{id:"north",x:10,y:20,soldiers:3}]),45);
assert.equal(ai.mmgRotation(gun,[{id:"south",x:10,y:0,soldiers:3}]),-45);
assert.equal(ai.mmgRotation({...gun,mmgDeployed:false},[{x:10,y:20,soldiers:3}]),0);
const packed={...gun,mmgDeployed:false};
const state={units:[packed,{id:"foe",faction:"blue",x:20,y:10,soldiers:6}],
  objectives:[{x:10,y:10,state:"red"}]};
assert.equal(ai.chooseOrder(state,packed,["Fire","Advance","Ambush"],()=>null,
  {fire:new Set(),move:new Set()}),"Fire");
const officer={id:"officer",faction:"red",role:"officer",type:"hq",
  soldiers:2,pins:0,x:2,y:2};
const sibling={id:"pinned",faction:"red",role:"infantry",
  soldiers:6,pins:2,x:10,y:2};
const move=ai.chooseMove({units:[officer,sibling],objectives:[],
  table:{width:72,height:48}},officer,
  point=>({legal:true,path:[point],cost:1,allowance:6}));
assert(move&&move.x>officer.x,"commander should approach pinned ally");
const engine=read("src/engine.js");
assert(engine.includes('name==="rotate-mmg"')&&engine.includes("Math.abs(delta)!==45"));
const actor=read("src/diorama/ai-opponent.js");
assert(actor.includes('command("building")')&&actor.includes('command("rotate-mmg"'));
console.log("PASS — officer support approach, fixed weapon deployment/traverse and legal garrison command.");
