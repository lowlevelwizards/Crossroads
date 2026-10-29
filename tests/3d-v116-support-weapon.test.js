"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const model=read("src/diorama/miniature-model.js");
const battle=read("src/diorama/scenario-scene.js");
const studio=read("src/diorama/miniature-studio.js");
for(const text of ["gunParts.push(muzzle)","packedBundle","soldier.setGunDeployed",
  "soldier.gunDeployed"])
 assert(model.includes(text),text);
assert(battle.includes("squad.gunTransition"));
assert(battle.includes("wasDeployed!==Boolean(squad.unit.mmgDeployed)"));
assert(battle.includes('mode:squad.unit.mmgDeployed?"deploy":"pack"'));
assert(studio.includes('poseSelect.value==="deploy"'));
console.log("PASS — support-weapon carrying/deploy transition uses engine state");
