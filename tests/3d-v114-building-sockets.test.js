"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("src/diorama/garrison-windows.js"),sandbox);
const g=sandbox.window.Crossroads3DGarrisonWindows;
const bounds={x:0,z:0,width:4,depth:3};
const sockets=[
 {x:-.8,z:-1.2,normal:{x:0,z:-1},outlet:{x:-.8,z:-1.64,y:1}},
 {x:.8,z:-1.2,normal:{x:0,z:-1},outlet:{x:.8,z:-1.64,y:1}},
 {x:0,z:1.2,normal:{x:0,z:1},outlet:{x:0,z:1.64,y:1}}
];
const threat={x:0,z:-8};
const points=g.slots(bounds,threat,4,sockets);
assert.equal(points.length,4);
assert(points.every(p=>p.z<0&&p.windowSocket));
assert(points[0].frontRow);
assert(points[2].z>points[0].z,"second rank stands inside the facade");
const muzzle=g.outlet(bounds,{x:.85,z:-1},threat,sockets);
assert.equal(muzzle.x,.8);assert.equal(muzzle.z,-1.64);
assert.equal(muzzle.y,1);
const scene=read("src/diorama/scenario-scene.js");
assert(scene.includes("registerWindow(entry,group,x,centerY,z,side)"));
assert(scene.includes("registerWindow(entry,group,x,eave*.60,z,side)"));
assert(scene.includes("physicalWindowSockets.get(building)"));
console.log("PASS — authored facade sockets, world outlets and occupied-window placements");
