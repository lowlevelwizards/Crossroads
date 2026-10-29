"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={};
for(const p of ["data/formations.js","src/rules/model-geometry.js",
 "src/rules/objectives/objective-helpers.js","src/diorama/study-motion.js",
 "data/scenarios.js","data/unit-types.js","src/army/army-planner.js"])
 vm.runInNewContext(read(p),{window:w},{filename:p});
const M=w.CrossroadsDioramaMotion,H=w.CrossroadsObjectiveHelpers;
assert.equal(M.travelProgress(0,2),0);
assert.equal(M.travelProgress(2,2),1);
assert(M.travelProgress(.5,2)<M.travelProgress(1,2));
assert(M.travelDuration(2,false)>M.travelDuration(2,true));
const gait=M.gaitPose(.5,.35,1);
assert(Number.isFinite(gait.legs)&&Number.isFinite(gait.bob));
assert.equal(M.finishTime(1.2,[{pace:1.2,delay:.2}]),1.2,
 "per-soldier gait no longer extends the movement track");
const unit={id:"a",x:10,y:10,role:"line",soldiers:6};
const bases=w.CrossroadsModelGeometry.models(unit);
assert.equal(bases.length,6);
const boundary={x:bases[0].x+.30,y:bases[0].y,radius:.05};
assert(H.pointInObjective(unit,boundary),
 "any model base can enter a scoring zone even if center stays outside");
assert(!H.pointInObjective(unit,{x:60,y:47,radius:1}));
const army=w.CrossroadsArmyDraft;
const force=army.load({name:"Test",faction:"blue",
 units:[{id:"hq",unitType:"officer",quality:"veteran"}]},
 w.CROSSROADS_UNIT_TYPES);
assert.equal(force.units.length,1);
assert(!army.validate({faction:"blue",units:[{id:"bad",
 unitType:"not-a-type",quality:"regular"}]},w.CROSSROADS_UNIT_TYPES).valid);
for(const id of ["hold_the_farm","take_the_crossroads","breakthrough",
 "mokra","meeting_engagement","village_holdout"]){
 const s=w.CROSSROADS_SCENARIOS[id];
 assert(s&&s.objectives.length&&s.forces.blue.length&&s.forces.red.length,
  "scenario missing "+id);
}
const scene=read("src/diorama/scenario-scene.js");
const engine=read("src/engine.js"),client=read("src/diorama/battle-client.js");
for(const token of ["function resetBattlePresentation(snapshot)",
 "seenBattleEpoch","motion.travelProgress(","motion.gaitPose(",
 "updateObjectiveMarkers(snapshot)","showStatus("])
 assert(scene.includes(token),"missing scene feature "+token);
for(const token of ["let battleEpoch=0","battleEpoch++;",
 "battleEpoch,","roundScoring:item.objective?.roundScoring"])
 assert(engine.includes(token),"missing coordinator feature "+token);
assert(client.includes("briefingAcknowledged")&&
 client.includes("battleEpoch:state.battleEpoch"));
const ai=read("src/diorama/ai-opponent.js");
assert(ai.includes('s.phase==="deployment"&&s.deploymentFaction==="red"'));
assert(ai.includes('"confirm-deployment"'));
const picker=read("scenarios3d.html");
assert(picker.includes("meeting_engagement")&&picker.includes("village_holdout"));
assert(picker.includes("actions.append(solo);"));
const editor=read("src/diorama/editor3d-ui.js");
for(const btn of ["Undo","Redo","Duplicate","Import","Snap"])
 assert(editor.includes("buttons."+btn));
assert(read("army3d.html").includes("army-planner.js?v=s111h5"));
console.log("PASS — distance gait, epoch reset, base scoring, six scenarios, solo, briefing, editor and army draft");
