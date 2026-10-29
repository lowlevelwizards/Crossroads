"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const window={};
vm.runInNewContext(fs.readFileSync(path.join(root,"src/diorama/movement-intent.js"),"utf8"),{window});
const make=()=>window.Crossroads3DMovementIntent.create();
const i=make();
const one={x:24.75,y:18.4};
assert.equal(i.pending,null);
assert.equal(i.remember(one,1000),true);
assert.deepEqual(JSON.stringify(i.pending),JSON.stringify(one));
assert.equal(i.consumeIfMatch({x:27,y:18.4},1100),null,"a different tap must not commit");
assert.deepEqual(JSON.stringify(i.pending),JSON.stringify(one),"nearby miss must preserve intent");
assert.deepEqual(JSON.stringify(i.consumeIfMatch({x:24.91,y:18.25},1400)),
  JSON.stringify(one),"second tap must commit the original previewed point");
assert.equal(i.pending,null,"confirmation consumes pending destination");
assert.equal(i.consumeIfMatch(one,1500),null,"a third tap must not re-commit");
assert.equal(i.remember(one,2000),true);
assert.equal(i.consumeIfMatch(one,11101),null,"stale previews must expire");
assert.equal(i.pending,null);
assert.equal(i.remember(one,13000),true);
i.clear();
assert.equal(i.pending,null,"order/cancel must discard a stale preview");
assert.equal(i.remember({x:NaN,y:5},15000),false,"invalid position rejected");
const scene=fs.readFileSync(path.join(root,"src/diorama/scenario-scene.js"),"utf8");
assert(scene.includes("clearMovePreview(false)"),"ruler redraw must preserve move intent");
assert(scene.includes("movementIntent.consumeIfMatch(position,Date.now())"),"tap handler consumes staged intent");
assert(scene.includes('battle.send("move",{point:destination,waypoint})'),
  "commit exact previewed point with optional waypoint");
assert(scene.includes("battle.previewMove(position,stagedWaypoint)"),
  "waypoints must use original movement preview rules");
assert(scene.includes("clearWaypoint();"),
  "waypoint must be discarded after move confirmation");
assert(scene.indexOf("movementIntent.consumeIfMatch(position,Date.now())")<
  scene.indexOf("const analysis=battle.previewMove(position);"),
  "confirmation must be processed before testing a potentially different second tap");
console.log("PASS — 3D movement first tap previews, nearby second tap commits original point, expiration and cancellation reset correctly");
