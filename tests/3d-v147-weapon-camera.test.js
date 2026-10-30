"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
vm.runInNewContext(read("src/diorama/weapon-lab-camera.js"),{window});
const api=window.Crossroads3DWeaponCameraControls;
assert.equal(typeof api.create,"function");
const near=(a,b,tolerance=1e-5)=>assert(Math.abs(a-b)<=tolerance,
  "expected "+a+" approximately equal to "+b);
const cam=api.create({fov:35,height:700});
const original=cam.snapshot();
assert(original.position.every(Number.isFinite));
assert.equal(original.activeView,"three");
assert(cam.view("side"));
near(cam.snapshot().theta,Math.PI/2);
near(cam.snapshot().polar,Math.PI/2);
// Orbit: one finger rotates camera around stable object, not translating target.
assert(cam.pointerDown(1,100,100));
const start=cam.snapshot();
assert(cam.pointerMove(1,150,120,1));
const rotated=cam.snapshot();
assert(rotated.theta<start.theta);
assert(rotated.polar<start.polar);
near(rotated.target[0],start.target[0]);
near(rotated.target[1],start.target[1]);
near(rotated.target[2],start.target[2]);
// A second finger must switch to pinch+pan, not mix one-finger orbit.
assert(cam.pointerDown(2,200,100));
const twoStart=cam.snapshot();
cam.pointerMove(2,220,140,1);
const twoEnd=cam.snapshot();
near(twoEnd.theta,twoStart.theta);
near(twoEnd.polar,twoStart.polar);
assert(twoEnd.radius<twoStart.radius);
assert(twoEnd.target.some((x,i)=>Math.abs(x-twoStart.target[i])>1e-6),
  "two-finger gesture pans around camera-relative axes");
// Pinch both outward, and retain finite pivots.
cam.pointerMove(1,70,70,1);
assert(cam.snapshot().radius<twoEnd.radius);
assert(cam.snapshot().position.every(Number.isFinite));
// Lifting the second finger resumes a smooth single-pointer orbit.
cam.pointerUp(2);
const resumed=cam.snapshot();
cam.pointerMove(1,76,70,1);
assert(cam.snapshot().theta!==resumed.theta);
assert.equal(cam.snapshot().pointerCount,1);
cam.pointerUp(1);
assert.equal(cam.snapshot().pointerCount,0);
// Right mouse drag pans in screen space and does not orbit.
cam.view("side");
const beforePan=cam.snapshot();
cam.pointerDown(3,20,30,2);
cam.pointerMove(3,70,30,2);
const afterPan=cam.snapshot();
near(afterPan.theta,beforePan.theta);
assert(Math.abs(afterPan.target[2]-beforePan.target[2])>1e-4);
near(afterPan.target[1],beforePan.target[1]);
cam.pointerUp(3);
cam.view("front");
const beforeFront=cam.snapshot();
cam.pan(20,35);
assert(cam.snapshot().target[1]>beforeFront.target[1]);
assert(cam.snapshot().position.every(Number.isFinite));
// Named view button re-centers after a pan and preserves focus.
cam.view("rear");
near(cam.snapshot().target[0],0);
assert.equal(cam.snapshot().activeView,"rear");
cam.view("top");
assert(cam.snapshot().polar<.2);
cam.zoom(.000001);near(cam.snapshot().radius,.67);
cam.zoom(1e9);near(cam.snapshot().radius,12);
cam.setViewportHeight(0);
cam.pan(0,30);
assert(cam.snapshot().target.every(Number.isFinite));
// Compare and mount modes have predictable automatic framing.
cam.setContext({compare:true,mount:false});
near(cam.snapshot().radius,3.55);
cam.setContext({compare:false,mount:true});
near(cam.snapshot().radius,2.95);
assert(cam.snapshot().target[1]>.05);
cam.reset();
assert.equal(cam.snapshot().activeView,"three");
assert.equal(cam.snapshot().pointerCount,0);
near(cam.snapshot().target[0],0);
// Prevent loading regressions in the HTML (camera must load before module).
const html=read("weapon-lab.html");
assert(html.includes('id="weaponFit"'));
assert(html.indexOf("weapon-lab-camera.js")<html.indexOf('weapon-lab.js'));
assert(html.includes("touch")||html.includes("DRAG ORBIT"));
const lab=read("src/diorama/weapon-lab.js");
new vm.Script(lab);
assert(lab.includes("cameraModel.pointerMove("));
assert(lab.includes('cameraModel.setContext({'));
assert(lab.includes('canvas.setPointerCapture('));
assert(lab.includes('cameraModel.setViewportHeight(h)'));
assert(!lab.includes('target.x-='));
console.log("PASS — Weapon Lab camera orbit, 2-finger pinch + pan, presets and frame reset");
