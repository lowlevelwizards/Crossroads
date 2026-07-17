"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/rules/objectives.js"), "utf8"), context);
const rules = context.window.CrossroadsObjectiveRules;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const objective = {
  type: "control_group",
  points: [
    { id:"n", label:"North", x:10, y:10, radius:3 },
    { id:"c", label:"Centre", x:10, y:20, radius:3 },
    { id:"s", label:"South", x:10, y:30, radius:3 }
  ]
};
const unit = (faction,x,y,extra={}) => ({ faction,x,y,soldiers:6,outcome:"active",...extra });

assert.equal(rules.pointState(objective.points[0], [unit("blue",10,10)], distance), "blue");
assert.equal(rules.pointState(objective.points[0], [unit("red",10,10)], distance), "red");
assert.equal(rules.pointState(objective.points[0], [unit("blue",10,10),unit("red",11,10)], distance), "contested");
assert.equal(rules.pointState(objective.points[0], [unit("blue",20,20)], distance), "none");
assert.equal(rules.pointState(objective.points[0], [unit("blue",10,10,{soldiers:0})], distance), "none");

const scoring = { startRound:2, pointsPerCrossing:1, maxCrossingPoints:2, delayPoints:1, breakthroughLineX:46, breakthroughPoints:2, denialPoints:2 };
let result = rules.roundScore(objective, scoring, 1, [unit("red",10,10)], distance);
assert.deepEqual({blue:result.blue,red:result.red},{blue:0,red:0});
result = rules.roundScore(objective, scoring, 2, [unit("red",10,10),unit("red",10,20),unit("red",10,30)], distance);
assert.deepEqual({blue:result.blue,red:result.red},{blue:0,red:2});
result = rules.roundScore(objective, scoring, 2, [unit("blue",10,10)], distance);
assert.deepEqual({blue:result.blue,red:result.red},{blue:1,red:0});
assert.deepEqual(rules.finalScore(objective, scoring, [unit("red",47,20)]), {blue:0,red:2});
assert.deepEqual(rules.finalScore(objective, scoring, [unit("red",45,20)]), {blue:2,red:0});

console.log("Objective rules: 10/10 passed");
