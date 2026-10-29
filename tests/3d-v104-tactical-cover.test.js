"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("src/diorama/ai-tactics.js"),sandbox);
const tactical=sandbox.window.Crossroads3DAITactics;
const enemy={id:"enemy",x:12,y:5,soldiers:6,faction:"blue"};
const wall={x:5,y:4,width:4,height:.3,cover:"hard",movement:"crossing"};
const hedge={x:1,y:4,width:3,height:.4,cover:"soft",movement:"crossing"};
const woods={x:4,y:2,width:3,height:2,cover:"soft",movement:"rough"};
assert.equal(tactical.defensiveCover({x:6,y:2},[wall],[enemy]),5);
assert.equal(tactical.defensiveCover({x:6,y:5},[wall],[enemy]),0);
assert.equal(tactical.defensiveCover({x:5,y:3},[woods],[]),3);
// The enemy is across this hedge from the defender: soft cover applies.
assert.equal(tactical.defensiveCover({x:2,y:3},[hedge],[enemy]),2.5);
// On the same side as the enemy the hedge provides no protection.
assert.equal(tactical.defensiveCover({x:2,y:5},[hedge],[enemy]),0);
const source=read("src/engine.js");
assert(source.includes("terrain:(TERRAIN.instances||[]).map("));
assert(!source.includes("hiddenEnemyPositions"));
console.log("PASS — cover-aware solo movement uses only public terrain and opposing sides of cover.");
