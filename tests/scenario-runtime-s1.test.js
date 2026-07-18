"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window:{}, Date });
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename:file });
}
for (const file of [
  "src/scenario/scenario-visibility.js",
  "src/scenario/scenario-migrations.js",
  "src/scenario/scenario-schema.js",
  "src/rules/objectives/objective-registry.js",
  "src/rules/objectives/objective-helpers.js",
  "src/rules/objectives/control-objective.js",
  "src/rules/objectives/exit-objective.js",
  "src/rules/objectives/casualty-objective.js",
  "src/rules/objectives/destroy-objective.js",
  "src/rules/objectives/protect-objective.js",
  "src/rules/objectives/hold-objective.js",
  "src/rules/objectives/passive-objective.js",
  "src/rules/objectives/victory-policies.js",
  "src/scenario-runtime/scenario-compiler.js",
  "src/scenario-runtime/scenario-events.js",
  "src/scenario-runtime/scenario-runtime.js"
]) load(file);

const Runtime = context.window.CrossroadsScenarioRuntime;
const Schema = context.window.CrossroadsScenarioSchema;
const base = {
  schemaVersion:2,
  id:"runtime-test", title:"Runtime Test", rounds:3,
  table:{width:72,height:48,mat:"grass_temperate"},
  factions:{blue:{name:"Blue"},red:{name:"Red"}},
  forces:{blue:[],red:[]}, terrain:[], linearTerrain:[], terrainPatches:[], junctions:[], crossings:[],
  deployment:{mode:"fixed",order:[],zones:{}},
  victory:{policy:"points",tiebreaker:"survivingUnits",elimination:false},
  objectives:[]
};
const unit = (id,faction,x,y,outcome="active") => ({id,faction,x,y,soldiers:6,outcome});

const migrated = Schema.normalize({ ...base, schemaVersion:1, scoring:{roundControl:1,finalControl:2}, objectives:[{id:"center",x:36,y:24,radius:3,label:"Center"}], victory:{tiebreaker:"survivingUnits"} });
assert.strictEqual(migrated.schemaVersion, 2, "legacy scenarios migrate to schema v2");
assert.strictEqual(migrated.objectives[0].type, "control_zone", "legacy point objectives become control zones");
assert.strictEqual(migrated.objectives[0].roundPoints, 1, "legacy round scoring migrates into the objective");
assert.strictEqual(migrated.scoring, undefined, "legacy scoring container is removed after migration");

const controlScenario = { ...base, objectives:[{id:"center",type:"control_zone",label:"Center",x:36,y:24,radius:3,roundPoints:1,finalPoints:2}] };
const controlSession = Runtime.createSession(controlScenario);
let units = [unit("b","blue",36,24),unit("r","red",60,24)];
let result = controlSession.dispatch("round_ended", {round:1}, {units,allUnits:units,round:1});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:1,red:0}, "control objectives score at round end");
result = controlSession.finalize({units,allUnits:units,round:3});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:2,red:0}, "control objectives score at battle end");

const exitScenario = { ...base, objectives:[{id:"exit",type:"exit_unit",label:"Exit",edge:"blue",faction:"red",depth:3,pointsPerUnit:2,containmentPointsPerUnit:1}] };
const exitSession = Runtime.createSession(exitScenario);
units = [unit("r1","red",2,20),unit("r2","red",20,20),unit("b1","blue",40,20)];
const exitObjective = exitSession.exitObjectiveFor(units[0], {units,allUnits:units,round:1});
assert.strictEqual(exitObjective.id, "exit", "exit objective detects eligible units");
result = exitSession.dispatch("unit_exited", {unitId:"r1",objectiveId:"exit",round:1}, {units,allUnits:units,round:1});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:0,red:2}, "exit objective scores immediately");
result = exitSession.finalize({units,allUnits:units,round:3});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:1,red:0}, "exit objective scores contained attackers at battle end");

const missionScenario = {
  ...base,
  objectives:[
    {id:"destroy",type:"destroy_target",label:"Destroy HQ",targetId:"red-hq",faction:"blue",points:4,immediateVictory:true},
    {id:"protect",type:"protect_target",label:"Protect Blue HQ",targetId:"blue-hq",faction:"blue",points:2},
    {id:"hold",type:"hold",label:"Hold Bridge",x:30,y:20,radius:3,faction:"blue",checkpointRound:2,points:3}
  ]
};
const missionSession = Runtime.createSession(missionScenario);
units = [unit("blue-hq","blue",30,20),unit("red-hq","red",50,20)];
result = missionSession.dispatch("round_ended", {round:2}, {units,allUnits:units,round:2});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:3,red:0}, "hold objective scores at its checkpoint");
result = missionSession.dispatch("unit_destroyed", {unitId:"red-hq",targetId:"red-hq",causedByFactionId:"blue",round:2}, {units,allUnits:units,round:2});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:4,red:0}, "destroy target scores the assigned faction");
assert.strictEqual(result.immediateWinner, "blue", "decisive objective reports an immediate winner");
result = missionSession.finalize({units,allUnits:units,round:3});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.score)), {blue:2,red:0}, "protect target scores when it survives");

const decisiveScenario = {
  ...base,
  victory:{policy:"immediate",tiebreaker:"survivingUnits",elimination:false},
  objectives:[{id:"decisive-exit",type:"exit_unit",label:"Escape",edge:"blue",faction:"red",depth:3,minimumUnits:1,pointsPerUnit:0}]
};
const decisiveSession = Runtime.createSession(decisiveScenario);
units = [unit("decisive-red", "red", 2, 20)];
result = decisiveSession.dispatch("unit_exited", {unitId:"decisive-red",objectiveId:"decisive-exit",round:1}, {units,allUnits:units,round:1});
assert.strictEqual(result.immediateWinner, "red", "immediate victory policy ends the battle when an assigned objective completes");

const validation = Runtime.createSession({ ...base, objectives:[{id:"bad",type:"destroy_target",label:"Bad",targetId:"missing",faction:"blue",points:1}] }).validate();
assert(validation.some(issue => issue.objectiveId === "bad"), "runtime validation catches missing target references");

// Continuous hold defaults to the beginning of the battle, not only the checkpoint.
const continuousScenario = {
  ...base,
  rounds:3,
  objectives:[{ id:"continuous", type:"hold", label:"Hold", x:20, y:20, radius:3, faction:"blue", checkpointRound:3, continuous:true, points:4 }]
};
const continuousSession = Runtime.createSession(continuousScenario);
const earlyUnits = [unit("red-early", "red", 20, 20)];
const lostEarly = continuousSession.dispatch("round_ended", { round:1 }, { units:earlyUnits, allUnits:earlyUnits, round:1 });
assert.strictEqual(lostEarly.updates[0].status, "failed", "continuous hold must fail when control is lost before the checkpoint");

console.log("PASS — Scenario Runtime S1.0 objective registry, migration, scoring, victory, exit, destroy, protect, and hold checks passed.");
