"use strict";
// iOS gesture recovery regression. Run: node tests/3d-v092-ios-touch-recovery.test.js
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
vm.runInNewContext(read("src/diorama/pointer-recovery.js"),{window});
vm.runInNewContext(read("src/diorama/study-gestures.js"),{window});
const api=window.Crossroads3DPointerRecovery;
const lost=[];
const guard=api.createPointerGuard(id=>lost.push(id));
const pointer=(id,x,y,isPrimary=false)=>({
  pointerId:id,pointerType:"touch",isPrimary,clientX:x,clientY:y
});
guard.begin(pointer(1,180,230,true));
assert.equal(guard.count,1,"new first touch begins one-finger orbit");
const initial=guard.move(pointer(1,211,230));
assert.equal(initial.count,1);
assert.equal(initial.old.x,180);
assert.equal(guard.tapStarts.get(1).dragged,true);
guard.begin(pointer(2,280,230,false));
assert.equal(guard.count,2,"two simultaneous touches enable pinch");
const second=guard.move(pointer(2,300,245));
const pinch=window.CrossroadsDioramaGestures.twoFingerGesture(
  second.previousPair,[...guard.pointers.values()]);
assert(pinch.zoomFactor>1);
guard.end(2);
assert.equal(guard.count,1);
const single=guard.move(pointer(1,215,233));
assert.equal(single.count,1,"survivor returns to orbit without waiting");
guard.end(1);
assert.equal(guard.count,0);
// iOS home indicator steals first pointer but never sends pointerup/cancel.
guard.begin(pointer(18,160,430,true));
guard.begin(pointer(19,190,432,false));
assert.equal(guard.count,2);
guard.reconcileTouches([{clientX:191,clientY:434}]);
assert.equal(guard.count,1,"native touch count repairs ghost finger");
assert(guard.pointers.has(19),"keep the finger nearest the native contact");
assert(lost.includes(18),"notify scene to clear capture and waypoint drag");
guard.begin(pointer(24,300,275,true));
assert.equal(guard.count,1,"new primary touch discards interrupted session");
assert(guard.pointers.has(24));
assert.equal(guard.tapStarts.get(24).dragged,false);
guard.reconcileTouches([]);
assert.equal(guard.count,0,"native touchend with no contacts clears ghosts");
// Interruption during waypoint edit clears state but never sends tap/commit.
guard.begin(pointer(31,125,225,true));
const gen=guard.generation;
guard.reset();
assert.equal(guard.count,0);
assert.equal(guard.tapStarts.size,0);
guard.begin(pointer(32,140,230,true));
assert(guard.generation>gen,"old delayed touchend must not clear a new gesture");
const rect={left:0,top:0,right:390,bottom:844};
assert(api.startsInSystemEdge(pointer(50,200,834,true),rect));
assert(api.startsInSystemEdge(pointer(51,8,340,true),rect));
assert(api.startsInSystemEdge(pointer(52,382,340,true),rect));
assert(api.startsInSystemEdge(pointer(53,200,9,true),rect));
assert(!api.startsInSystemEdge(pointer(54,200,400,true),rect));
assert(!api.startsInSystemEdge({
  pointerType:"mouse",clientX:1,clientY:842
},rect),"desktop mouse doesn't lose edge controls");
// Guard is actually hooked into all live 3D entry points and resets on lifecycle.
const scene=read("src/diorama/scenario-scene.js");
for(const token of ["pointerGuard.begin(event)","pointerGuard.move(event)",
  "pointerGuard.reconcileTouches(event.touches)",
  "pointerGuard.reset()","pointerGuard.end(event.pointerId)",
  'window.addEventListener("blur",abandonGesture)',
  'window.addEventListener("pagehide",abandonGesture)',
  'window.addEventListener("orientationchange",abandonGesture)',
  'canvas.addEventListener("pointercancel", endPointer)',
  'canvas.addEventListener("lostpointercapture"'])
  assert(scene.includes(token),"scene missing interruption recovery "+token);
for(const page of ["battle3d.html","diorama.html","editor3d.html"]){
  const html=read(page);
  const version=page==="diorama.html"?"0.9.4a":"0.9.11";
  assert(html.includes("pointer-recovery.js?v="+version),page+" not loaded");
  assert(html.includes("scenario-scene.js?v="+version),page+" stale cache");
}
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,"0.9.11");
console.log("PASS — iOS interrupted touch recovery, lone-finger orbit, real pinch, edge guards, lifecycle reset, page wiring");
