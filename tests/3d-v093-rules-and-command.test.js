"use strict";
// Run: node tests/3d-v093-rules-and-command.test.js
const assert=require("node:assert/strict"),fs=require("node:fs"),
vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
for(const p of ["data/formations.js","src/rules/model-geometry.js",
"src/diorama/formation-layout.js","src/rules/movement.js",
"src/rules/morale.js","src/rules/shooting.js"])
vm.runInNewContext(read(p),{window},{filename:p});
const G=window.CrossroadsModelGeometry;
const rifle=(id,x,y,faction="blue")=>({id,name:id,role:"line",
faction,soldiers:6,x,y,weapons:{rifle:6}});
const a=rifle("a",10,10),other=rifle("screen",20,10),
  enemy=rifle("enemy",30,10,"red");
assert.equal(G.models(a).length,6);
assert(G.closestRange(a,enemy)<20,"range is base edges, not center");
assert(G.friendlyFire(a,enemy,[a,other,enemy]).blocked,
"direct fire cannot cross intervening friendly formation");
assert(!G.friendlyFire(a,enemy,[a,enemy]).blocked);
const move=window.CrossroadsMovementRules.create({
  rules:{runDistance:12,advanceDistance:6,unitSeparation:3.4,
    buildingCollisionClearance:.55},
  terrain:{instances:[]},movementIntegrityEnabled:()=>true,
  livingUnits:()=>[a,other],distanceBetweenPoints:(p,q)=>
    Math.hypot(p.x-q.x,p.y-q.y),
  pointAtSegment:(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t}),
  pointInsideRect:()=>false,expandRect:x=>x,segmentRectClip:()=>null,
  segmentPointDistance:()=>({distance:0,t:.5}),capitalize:x=>x
});
assert(move.analyzeMovementSegment(a,a,{x:23,y:10},null).legal,
 "friendly units may be passed through");
assert(move.analyzeDestinationCollision(a,{x:20,y:10},null).blocked,
 "separate units cannot end within one inch between model bases");
const morale=window.CrossroadsMoraleRules.create({
 rules:{commandRadius:6,commandMoraleBonus:2},
 distanceBetweenUnits:(x,y)=>Math.hypot(x.x-y.x,x.y-y.y)
});
const officer={id:"hq",role:"officer",faction:"blue",
 x:10,y:10,soldiers:2,pins:1,morale:9};
assert.equal(morale.commandBonus(officer,[officer]),2);
assert.equal(morale.commandBonus({...a,x:14,y:10},[officer]),2);
assert.equal(morale.commandBonus({...a,x:19,y:10},[officer]),0);
assert.equal(morale.analyzeOrderTest({unit:officer,order:"Advance",
 support:officer}).target,10);
const F=window.Crossroads3DFormationLayout;
const plan=F.resolve({origin:{x:1.8,z:0},living:2,
 slots:[{x:.6,z:0},{x:.3,z:0}],
 move:{startOrigin:{x:0,z:0},
 startPoints:[{x:0,z:0},{x:-.30,z:0}],
 end:{x:1.8,z:0},maxDistance:1.8,forwardBudget:0}});
for(let i=0;i<plan.points.length;i++){
 const initial=i===0?0:-.30;
 assert(1.8+plan.points[i].x<=initial+1.800001,
   "no miniature shuffles beyond its movement allowance");
}
const engine=read("src/engine.js"),scene=read("src/diorama/scenario-scene.js");
for(const token of ["commandMoraleBonus: 2",
 "function snapEligible()","function nextSnapUnit()",
 "function tryStartSnap(officer,order)","snap:snapSelection?",
 'name==="end-snap"'])
 assert(engine.includes(token),"officer engine missing "+token);
assert(scene.includes("const prediction=")&&scene.includes("lastMoveConstraints"));
assert(scene.includes('canvas.addEventListener("dblclick"')&&
  scene.includes('canvas.addEventListener("touchend"'));
for(const p of ["classic.html","classic-session.html","battle3d.html",
 "diorama.html","editor3d.html"])
 assert(read(p).includes("src/rules/model-geometry.js"),
 p+" missing model geometry loader");
console.log("PASS — model-base ranges and gaps, friendly-fire safety, officer morale, Snap to Action wiring, bounded soldier reflow, Safari zoom");
