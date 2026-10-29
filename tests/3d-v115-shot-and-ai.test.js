"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={},ctx=vm.createContext({window:w});
for(const file of ["src/diorama/shot-explanation.js","src/diorama/ai-tactics.js"])
 vm.runInContext(read(file),ctx);
const shot=w.Crossroads3DShotExplanation;
assert.equal(shot.hitChance(4),.5);assert.equal(shot.hitChance(7),0);
const preview={legal:true,distance:12,weapons:[
 {shots:4,hitTarget:5,label:"LMG",modifiers:["firer pinned"]}],
 cover:{label:"Soft cover",saveTarget:5}};
assert(Math.abs(shot.expectedHits(preview)-4/3)<.01);
assert(shot.describe(preview).includes("33% per shot"));
assert(shot.describe(preview).includes("firer pinned"));
const ai=w.Crossroads3DAITactics;
const unit={id:"us",faction:"red",role:"line",soldiers:6,x:5,y:5};
const e={id:"enemy",faction:"blue",soldiers:6,x:25,y:5};
const state={units:[unit,e],objectives:[],table:{width:72,height:48}};
const legal=p=>({legal:true,cost:3,allowance:6,path:[p]});
const plain=ai.chooseMove(state,unit,legal),detailed=ai.chooseMove(state,unit,legal,true);
assert.equal(plain.x,detailed.point.x);assert.equal(plain.y,detailed.point.y);
assert(Number.isFinite(detailed.candidates[0].score));
assert(read("battle3d.html").includes("ai-inspector.js"));
assert(read("src/diorama/ai-opponent.js").includes('trace("MOVE"'));
console.log("PASS — firing odds and traceable tactical AI move decisions");
