"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const emitted=[];
const example={
  status:"resolved",groups:[{key:"rifle",profile:{label:"Rifle"},models:6,
  shots:6,hitTarget:4,modifiers:[{label:"Moving"}],
  rolls:[1,2,3,4,5,6],hits:3}],
  totalShots:6,totalHits:3,pinDelta:1,pinsAfter:1,routedByPins:false,
  damageTarget:4,damageRolls:[3,5,6],potentialCasualties:2,
  coverSaveTarget:5,saveRolls:[2,6],saved:1,
  requestedCasualties:1
};
const fakeWindow={
  CrossroadsMoraleRules:{create:()=>({
    findCommandSupport:()=>null,commandBonus:()=>0,
    analyzeOrderTest:()=>({required:true,officerBonus:0,ignoresPins:false}),
    resolveOrderTest:()=>({passed:true,dice:[3,4],total:7,target:9,
      pinsBefore:1,pinsAfterPass:0,pinsRemovedOnPass:1})
  })},
  CrossroadsShootingRules:{create:()=>({
    isMMGTeam:()=>false,analyzeMMGFireArc:()=>true,
    targetInsideMMGArc:()=>true,
    availableFireGroups:()=>example.groups,weaponRange:()=>24,
    determineLineCover:()=>({saveTarget:5}),
    analyzeShot:()=>({distance:4,cover:{label:"Stone wall",saveTarget:5}}),
    analyzeShotAtPoint:()=>({distance:4,cover:{label:"Stone wall",saveTarget:5}}),
    resolveAttack:()=>example
  })},
  CrossroadsAssaultRules:{create:()=>({
    analyzeAssault:()=>({legal:true}),
    resolveCloseCombat:()=>({winner:"attacker",rounds:[]})
  })}
};
const runtimeSource=read("src/rules/combat-runtime.js");
vm.runInNewContext(runtimeSource,{window:fakeWindow});
const deps=Object.fromEntries([...runtimeSource.matchAll(
  /requireFunction\(dependencies, "([^"]+)"\)/g)].map(x=>[x[1],()=>{}]));
const shooter={id:"b",name:"Blue",faction:"blue",soldiers:6,pins:0};
const target={id:"r",name:"Red",faction:"red",soldiers:6,pins:0};
const stats={blue:{shotsFired:0,hitsScored:0,pinsInflicted:0},red:{}};
Object.assign(deps,{
  rules:{},features:{},weaponProfiles:{rifle:{}},unitQuality:{regular:{}},
  terrain:{},mmgRules:{},getBattleStats:()=>stats,
  getLivingUnits:()=>[shooter,target],
  addLog(){},capitalize:s=>s,recordCasualties(){},
  applyCasualties:(unit,n)=>(unit.soldiers-=n,n),
  recordUnitDestroyed(){},destroyUnit:u=>{u.soldiers=0},
  fullLoadout:()=>"",qualityLabel:()=>"",qualityProfile:()=>({assaultDamageTarget:4}),
  findSafeAssaultPosition:()=>({x:0,y:0}),
  emitBattleEvent:(type,payload)=>emitted.push({type,payload}),
  rollDice:n=>Array(n).fill(4)
});
const core=fakeWindow.CrossroadsCombatRuntime.create(deps);
const shot=core.resolveShootingCore(shooter,target,{
  distance:4,cover:{label:"Stone wall",saveTarget:5}
},{label:"Fire"});
assert.equal(shot.hits,3);
assert.equal(shot.casualties,1);
assert.equal(target.soldiers,5);
assert.equal(stats.blue.shotsFired,6);
assert.equal(emitted.length,1);
assert.equal(emitted[0].type,"shooting");
assert.equal(emitted[0].payload.groups[0].rolls.join(","),"1,2,3,4,5,6");
assert.equal(emitted[0].payload.saveRolls.join(","),"2,6");
assert.equal(emitted[0].payload.casualties,1);
assert.equal(emitted[0].payload.pinsAfter,1);
assert.equal(emitted[0].payload.shooterPosition.x,undefined); // stub unit has no location
shooter.pins=1;
core.attemptOrder(shooter,"Fire");
assert.equal(emitted.length,2);
assert.equal(emitted[1].type,"order-test");
assert.equal(emitted[1].payload.dice.join(","),"3,4");
const presentWindow={};
vm.runInNewContext(read("src/diorama/combat-presentation.js"),{window:presentWindow});
const stages=[];
const d=presentWindow.Crossroads3DCombatPresentation.create(e=>stages.push(e.phase));
assert.equal(d.enqueue({id:1,type:"shooting"}),true);
assert.equal(d.enqueue({id:1,type:"shooting"}),false);
for(let n=0;n<120;n++)d.update(.05);
assert.equal(stages.join(","),"aim,fire,hit-dice,damage-dice,save-dice,impact,settle");
assert.equal(d.active,false);
console.log("PASS — authoritative combat event payload, morale dice and idempotent 3D timeline");
