"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};
for(const p of ["src/diorama/cover-positions.js",
 "src/diorama/building-visuals.js","src/diorama/tabletop-dice.js",
 "src/diorama/assault-motion.js"])
 vm.runInNewContext(read(p),{window:w},{filename:p});
const cover=w.Crossroads3DCoverPositions;
const wall={id:"stone",kind:"wall",a:{x:-2,z:0},b:{x:2,z:0}};
const slots=Array.from({length:7},(_,i)=>({x:(i-3)*.31,z:0}));
const plan=cover.arrange({x:0,z:-.48},slots,[wall],{x:0,z:4});
assert(plan&&plan.segmentId==="stone");
assert.equal(plan.points.length,7);
const covered=plan.points.filter(p=>p.cover);
assert(covered.length>=5);
for(const p of covered){
 assert(p.z<.48,"figures stay on unit's side of wall");
 assert(p.x>=-2.25&&p.x<=2.25,"figures must remain along wall span");
}
for(let i=0;i<covered.length;i++)for(let j=i+1;j<covered.length;j++)
 assert(Math.hypot(covered[i].x-covered[j].x,covered[i].z-covered[j].z)>.29,
   "bases must not overlap");
const edge=cover.arrange({x:1.85,z:-.35},slots,[wall],null);
const front=edge.points.filter(p=>p.cover&&p.frontRow);
for(let i=1;i<front.length;i++)
 assert(Math.abs(front[i].x-front[i-1].x)>.30,"end clamps cannot stack models");
assert.equal(cover.arrange({x:0,z:-3},slots,[wall],null),null);
assert.equal(cover.projection({x:0,z:1},wall).distance,1);
const building=w.Crossroads3DBuildingVisuals;
const bounds={x:0,z:0,width:2,depth:2};
const door=building.doorFor(bounds,{x:0,z:-3});
assert.equal(door.z,-1);
const from={x:0,z:-3},to={x:0,z:0};
assert.equal(building.at(from,door,to,0).z,-3);
assert.equal(building.at(from,door,to,1).z,0);
assert(Math.abs(building.at(from,door,to,.53).z-door.z)<.0001);
const dice=w.Crossroads3DTabletopDice;
const shooting={type:"shooting",groups:[{rolls:[1,3,7,6]},{rolls:[2]}],
 damageRolls:[4,5],saveRolls:[6,1]};
assert.equal(JSON.stringify(dice.valuesFor(shooting,"hit-dice")),
 JSON.stringify([1,3,6,2]));
assert.equal(dice.valuesFor(shooting,"save-dice").length,2);
assert.equal(dice.pips(6).length,6);
assert.equal(dice.pips(1).length,1);
assert.equal(dice.valuesFor({type:"assault",rounds:[{attackerRolls:[2],defenderRolls:[5]}]},"dice").length,2);
const assault=w.Crossroads3DAssaultMotion.create({x:0,z:0},{x:2,z:0});
assault.age=.12;
assert(w.Crossroads3DAssaultMotion.individualDisplacement(assault,0)>0);
assert.equal(w.Crossroads3DAssaultMotion.individualDisplacement(assault,7),0);
const scene=read("src/diorama/scenario-scene.js");
for(const x of ["coverSegments.push(", "formationLayout.resolve(", "resolveSquadFormation(",
 "squad.entrySequence", "buildingVisuals.at(", "garrisonFiringOutlet(", "showPhysicalDice(stage)",
 "orderTexture(u.order)", "animatePhysicalDice(dt)",
 "individualDisplacement?.(assault,soldierIndex)"])
 assert(scene.includes(x),"3D scene missing "+x);
for(const page of ["battle3d.html","diorama.html"]){
 const html=read(page);
 const version=page==="diorama.html"?"0.9.4a":"0.9.47";
 for(const script of ["cover-positions.js","building-visuals.js","tabletop-dice.js"])
   assert(html.includes(script+"?v="+version),page+" must load "+script);
 assert(html.includes("scenario-scene.js?v="+version));
}
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,"0.9.47");
console.log("PASS — cover spacing, same-side stance, building door routes, engine dice mapping, individual assault and v0.9 wiring");
