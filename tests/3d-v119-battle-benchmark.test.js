"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};vm.runInNewContext(read("src/diorama/benchmark-audit.js"),{window:w});
const audit=w.Crossroads3DBenchmark.create();
const units=[{id:"a",x:5,y:5,pins:0},{id:"b",x:20,y:20,pins:0}];
let result=audit.observe({scenarioId:"hold_the_farm",phase:"choose-unit",
 round:1,units,objectives:[{id:"farm",state:"neutral"}],combatEvents:[]});
assert(result.checked.includes("deploy"));assert(!result.checked.includes("move"));
const events=[{id:1,type:"shooting",casualties:1}];
result=audit.observe({round:2,units:[{id:"a",x:9,y:5,pins:1},units[1]],
 objectives:[{id:"farm",state:"red"}],combatEvents:events});
for(const task of ["deploy","move","fire","pin","casualty","objective","round"])
 assert(result.checked.includes(task),task);
result=audit.observe({round:3,battleEnded:true,result:{winner:"blue"},units,
 combatEvents:events});
assert.equal(result.progress,8);assert.equal(result.winner,"blue");
assert.equal(audit.snapshot().total,8);
assert(read("battle3d.html").includes("benchmark-audit.js"));
console.log("PASS — read-only complete-battle audit of orders, combat, morale and objectives");
