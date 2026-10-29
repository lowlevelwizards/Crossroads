"use strict";
// v0.8 pure helper contracts and links. Run with: node tests/3d-v080-living-infantry.test.js
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};
for(const p of ["src/diorama/squad-motion.js","src/diorama/weapon-presentation.js",
  "src/diorama/combat-presentation.js"])
  vm.runInNewContext(read(p),{window:w},{filename:p});
const tracks=w.Crossroads3DSquadMotion.createTracks();
tracks.set("a",{end:{x:1,z:2}});tracks.set("b",{end:{x:3,z:4}});
assert.equal(tracks.size,2,"Two squads may animate independently");
tracks.delete("a");assert.equal(tracks.size,1);
assert.equal(tracks.get("b").end.z,4);
for(const id of [0,1,2]){
  assert.equal(w.Crossroads3DSquadMotion.lateralOffset(2,id,0,2),0);
  assert.equal(w.Crossroads3DSquadMotion.lateralOffset(2,id,1,2),0);
  assert(Math.abs(w.Crossroads3DSquadMotion.lateralOffset(2,id,.5,2))<=.061);
}
assert(w.Crossroads3DSquadMotion.movementFinished({phase:"travel",elapsed:2,finishTime:1}));
assert(!w.Crossroads3DSquadMotion.movementFinished({phase:"turn",elapsed:2,finishTime:1}));
const weapons=w.Crossroads3DWeaponPresentation;
assert.equal(weapons.roleFor("light machine gun"),"lmg");
const roster=[{role:"rifle"},{role:"lmg"},{role:"loader"},{role:"smg"},{role:"mmg"},{role:"crew"}];
const shots=weapons.schedule([{key:"rifle",shots:2},{key:"lmg",shots:4},
  {key:"mmg",shots:5},{key:"smg",shots:2}],roster);
assert.equal(shots.length,13);
for(const shot of shots)assert.equal(roster[shot.soldierIndex].role,shot.role);
const events=[];
const director=w.Crossroads3DCombatPresentation.create(s=>events.push(s.phase));
director.setSpeed(2.8);director.enqueue({id:7,type:"shooting"});
for(let i=0;i<60;i++)director.update(.05);
assert.equal(director.active,false);
assert.equal(events.join(","),"aim,fire,hit-dice,damage-dice,save-dice,impact,settle");
director.enqueue({id:8,type:"shooting"});director.update(.05);director.skip();
assert.equal(director.active,false);
const scene=read("src/diorama/scenario-scene.js");
assert(scene.includes("activeMovements.set(squad.unit.id"),"Both local and remote movement use tracks");
assert(!scene.includes("let activeMovement=null"),"Single active movement slot removed");
assert(scene.includes("weaponPresentation?.schedule"),"Role-based shot presentation wired");
assert(scene.includes("previewUnit"),"Contextual targeting attached to selected target");
assert(scene.includes("movementIntent.consumeIfMatch(position,Date.now())"),"Exact two-tap confirmation intact");
assert(read("battle3d.html").includes("src/diorama/squad-motion.js"));
assert(read("battle3d.html").includes("src/diorama/weapon-presentation.js"));
console.log("PASS — independent squad tracks, final positions, role-specific shots, combat speed/skip and input wiring");
