"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};const ctx=vm.createContext(sandbox);
for(const path of ["src/diorama/study-motion.js","src/diorama/miniature-studio-poses.js"])
 vm.runInContext(read(path),ctx);
const poses=sandbox.window.Crossroads3DSoldierActions;
const motion=sandbox.window.CrossroadsDioramaMotion;
const down=poses.frame("down",0,motion);
assert(down.crouch>.8&&down.lean>.8&&down.forward>.1);
const rally=poses.frame("rally",.6,motion);
assert(rally.gesture>.3);
const model=read("src/diorama/miniature-model.js");
assert(model.includes("soldier.applyGesture="));
const battle=read("src/diorama/scenario-scene.js");
assert(battle.includes("officer.commandGestureUntil=performance.now()+1100"));
assert(battle.includes("soldier.applyGesture?."));
console.log("PASS — forward-facing Down silhouette and physical officer rally gestures");
