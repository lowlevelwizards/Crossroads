"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const win={};
for(const p of ["src/diorama/cover-positions.js",
  "src/diorama/formation-layout.js","src/diorama/study-motion.js",
  "src/diorama/combat-presentation.js","src/diorama/weapon-presentation.js"])
  vm.runInNewContext(read(p),{window:win},{filename:p});
const F=win.Crossroads3DFormationLayout;
const slots=Array.from({length:6},(_,i)=>({x:(i-3)*.47,z:0}));
const out=F.resolve({origin:{x:0,z:-.36},slots,living:4,
  segments:[{id:"wall",kind:"wall",a:{x:-2,z:0},b:{x:2,z:0}}],
  coverPositions:win.Crossroads3DCoverPositions,threat:{x:0,z:2}});
assert.equal(out.points.length,4);
for(let i=1;i<out.points.length;i++){
  const nearest=Math.min(...out.points.slice(0,i).map(p=>
    Math.hypot(out.points[i].x-p.x,out.points[i].z-p.z)));
  assert(nearest<=.571,"cohesion visual maximum");
}
assert.equal(F.resolve({origin:{x:0,z:0},slots,living:2}).points.length,2);
const m=win.CrossroadsDioramaMotion;
assert(m.travelDuration(.5,false)<m.travelDuration(2,false));
assert(m.travelDuration(3,true)<m.travelDuration(3,false));
const weapons=win.Crossroads3DWeaponPresentation;
const shots=weapons.schedule([{key:"mmg",shots:15}],[
  {role:"mmg",visible:true},{role:"crew",visible:true}]);
assert.equal(shots.length,15,"show every authoritative shot");
assert(shots[1].delay>shots[0].delay);
const stages=[],d=win.Crossroads3DCombatPresentation.create(x=>stages.push(x.phase));
let ready=false;win.Crossroads3DAnimationGate={isReady:()=>ready};
d.enqueue({id:1,type:"shooting",shooterId:"one"});
d.update(.1);assert.deepEqual(stages,[],"firing waits on moving shooter");
ready=true;d.update(.1);assert.equal(stages[0],"aim");
const scene=read("src/diorama/scenario-scene.js"),
  hud=read("src/diorama/battle-client.js");
for(const token of ["resolveSquadFormation(selectedSquad,last,false)",
  "const formation=resolveSquadFormation(squad,squad.root.position)",
  "Crossroads3DAnimationGate","confirmTarget()","garrisonFiringOutlet(",
  "renderAuthoredScatter()","editorDraftPlace(entry)"])
  assert(scene.includes(token),"scene missing "+token);
for(const token of ["CONFIRM FIRE","CONFIRM ASSAULT","SCORE OBJECTIVES & CONTINUE"])
  assert(hud.includes(token),"HUD missing "+token);
for(const page of ["battle3d.html","diorama.html","editor3d.html"]){
  const html=read(page);
  assert(html.includes("formation-layout.js?v=0.9.2"));
  assert(html.includes("scenario-scene.js?v=0.9.2"));
}
assert(read("editor3d.html").includes("editor3d-ui.js?v=0.9.2"));
console.log("PASS — exact preview/live formation resolver, distance-scaled gait, shot parity, advance firing gate, targeting and editor wiring");
