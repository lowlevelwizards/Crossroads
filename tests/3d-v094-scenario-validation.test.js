"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
vm=require("node:vm"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const context=vm.createContext({window:{},Date});
const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),
 context,{filename:file});
for(const p of [
 "data/formations.js","src/rules/model-geometry.js",
 "data/scenarios.js","src/scenario/scenario-visibility.js",
 "src/scenario/scenario-migrations.js","src/scenario/scenario-schema.js",
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
])load(p);
const W=context.window;
const ids=["hold_the_farm","take_the_crossroads","breakthrough",
 "mokra","meeting_engagement","village_holdout"];
for(const id of ids){
 const scenario=W.CROSSROADS_SCENARIOS[id];
 assert(scenario,"missing scenario "+id);
 const session=W.CrossroadsScenarioRuntime.createSession(scenario);
 const issues=session.validate();
 assert.equal(issues.length,0,id+" validation: "+JSON.stringify(issues));
}
// A formation model overlaps the northern capture edge even though the
// abstract unit center is outside. The runtime must count it for scoring.
const scenario={...W.CROSSROADS_SCENARIOS.meeting_engagement,
 objectives:[{id:"point",type:"control_zone",x:36,y:24,radius:2,
 label:"Point",roundPoints:1,finalPoints:0}]};
const models=W.CrossroadsModelGeometry.models({
 id:"patrol",role:"line",soldiers:6,x:33.3,y:24});
const near=models.find(p=>Math.hypot(p.x-36,p.y-24)<2.5);
assert(near,"test formation has a base overlapping objective");
const unit={id:"patrol",role:"line",faction:"blue",soldiers:6,x:33.3,y:24};
const session=W.CrossroadsScenarioRuntime.createSession(scenario);
const results=session.dispatch("round_ended",{round:1},{
 units:[unit],allUnits:[unit],round:1
});
assert.equal(results.score.blue,1,"model-base occupation earns round VP");
assert.equal(results.score.red,0);
console.log("PASS — all six mission scenarios validate and edge-overlapping model bases actually score");
