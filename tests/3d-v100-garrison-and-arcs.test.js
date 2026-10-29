"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("src/diorama/garrison-windows.js"),sandbox);
const windows=sandbox.window.Crossroads3DGarrisonWindows;
const house={x:4,z:3,width:5,depth:2};
const forward=windows.slots(house,{x:12,z:3},6);
assert.equal(forward.length,6);
assert(forward.every(x=>x.x>house.x&&x.x<house.x+house.width/2));
assert(forward.every(x=>x.look.x>x.x&&x.kind==="building"));
assert(forward.every(x=>Math.abs(x.z-house.z)<house.depth/2));
const west=windows.slots(house,{x:-12,z:3},4);
assert(west.every(x=>x.x<house.x&&x.look.x<x.x));
const north=windows.slots(house,{x:4,z:-8},4);
assert(north.every(x=>x.z<house.z&&x.look.z<x.z));
const muzzle=windows.outlet(house,{x:6,z:3.3},{x:12,z:3});
assert(muzzle.x>house.x+house.width/2);
assert(muzzle.z<house.z+house.depth/2);
const layout=read("src/diorama/formation-layout.js"),
  scene=read("src/diorama/scenario-scene.js");
for(const x of ["Crossroads3DGarrisonWindows?.slots","garrisonWindows?.outlet",
  "soldier.windowArc","squad.unit.mmgFacing","u.mmgDeployed"])
  assert((layout+scene).includes(x),"Missing garrison/arc wiring "+x);
for(const p of ["battle3d.html","editor3d.html"]){
  const h=read(p);
  assert(h.indexOf("garrison-windows.js")<h.indexOf("formation-layout.js"));
}
console.log("PASS — facade windows, consistent muzzle outlets and deployed gun facing.");
