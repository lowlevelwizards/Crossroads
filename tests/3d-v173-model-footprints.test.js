"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
 path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sandbox={window:{}},w=sandbox.window;
for(const file of ["data/formations.js","src/rules/model-geometry.js",
  "src/diorama/cover-positions.js","src/diorama/garrison-windows.js",
  "src/diorama/formation-layout.js","src/diorama/physical-footprints.js"])
 new vm.Script(read(file),{filename:file}).runInNewContext(sandbox);
const G=w.CrossroadsModelGeometry,P=w.Crossroads3DPhysicalFootprints,
 F=w.Crossroads3DFormationLayout,C=w.Crossroads3DCoverPositions;
const inch=.30,toWorld=p=>({x:(p.x-36)*inch,z:(p.y-24)*inch});
const unit={id:"squad",role:"line",soldiers:6,x:12,y:20};
const models=G.models(unit),origin=toWorld(unit);
assert.equal(models.length,6);
// Canonical 1-inch bases must never intersect each other. Unlike the old
// percentage layout this is true for all current infantry archetypes.
for(const role of ["line","assault","officer","support"]){
 const count=role==="officer"?2:role==="support"?3:6;
 for(const deployed of [false,true]){
  const u={...unit,role,soldiers:count,mmgDeployed:deployed};
  const points=G.models(u);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
   assert(G.edgeGap(points[i],points[j])>=-.001,
    role+" has overlapping authoritative bases ("+i+", "+j+")");
 }
}
const world=P.project(models,origin,toWorld);
const slots=world.map(m=>({x:m.x,z:m.z}));
const wall={id:"wall",kind:"wall",a:{x:origin.x-2,z:origin.z+.15},
  b:{x:origin.x+2,z:origin.z+.15}};
const resolved=F.resolve({origin,slots,living:6,segments:[wall],
 coverPositions:C,threat:{x:origin.x,z:origin.z+3},
 modelPoints:world});
assert.equal(resolved.source,"rules-models");
assert.equal(resolved.points.length,6);
for(let i=0;i<6;i++){
 assert.equal(resolved.points[i].x,slots[i].x,
   "rules base X may never cover snap or cohere");
 assert.equal(resolved.points[i].z,slots[i].z,
   "rules base Z may never cover snap or cohere");
 assert(resolved.points[i].authoritative);
}
// Preview and final pose must use the same translated authoritative bases.
const destination={x:20,y:24},end=toWorld(destination);
const predicted=G.models(unit,destination),projection=P.project(predicted,end,toWorld);
const ghost=F.resolve({origin:end,slots,living:6,modelPoints:projection});
assert.equal(ghost.source,"rules-models");
for(let i=0;i<6;i++){
 assert(Math.abs(ghost.points[i].x-resolved.points[i].x)<1e-10);
 assert(Math.abs(ghost.points[i].z-resolved.points[i].z)<1e-10);
}
// Casualty reflow uses the engine's survivors rather than moving bases.
const casualty={...unit,soldiers:4};
const cropped=P.project(G.models(casualty),origin,toWorld);
const survivors=F.resolve({origin,slots,living:4,modelPoints:cropped});
assert.equal(survivors.points.length,4);
for(let i=0;i<4;i++)assert.equal(survivors.points[i].x,slots[i].x);
const mmg={id:"mg",role:"support",soldiers:3,x:12,y:20,
 mmgDeployed:false};
const packed=G.models(mmg);
const deployed=G.models({...mmg,mmgDeployed:true});
assert.notDeepEqual(packed.map(p=>p.y),deployed.map(p=>p.y),
 "crew positions are derived from the current rules-owned gun state");
const pair=P.closestPair([{x:2,y:0,radius:.5,index:0},
  {x:5,y:0,radius:.5,index:1}],
 [{x:8,y:0,radius:.5,index:0}]);
assert.equal(pair.shooter.index,1);
assert.equal(pair.gap,2);
const fake={unit:{models},soldiers:models.map(m=>({
 figure:{position:{x:slots[m.index].x,z:slots[m.index].z},visible:true}
}))};
const audit=P.compare(fake,origin,toWorld);
assert.equal(audit.mismatches,0);
fake.soldiers[1].figure.position.x+=.25;
assert.equal(P.compare(fake,origin,toWorld).mismatches,1);
// Building facade positions are visibly presented as an abstraction,
// never promoted to the shooting model positions.
const bounds={x:origin.x,z:origin.z,width:2,depth:1.3};
const building=F.resolve({origin,slots,living:6,modelPoints:world,
 buildingBounds:bounds,threat:{x:origin.x+4,z:origin.z}});
assert.equal(building.source,"garrison-display");
assert(building.points.every(p=>p.authoritative===false&&p.rulesPoint));
assert(building.points.some((p,i)=>
 Math.hypot(p.x-world[i].x,p.z-world[i].z)>.05));
const engine=read("src/engine.js"),scene=read("src/diorama/scenario-scene.js");
assert(engine.includes("models:window.CrossroadsModelGeometry?.models(unit)"));
assert(engine.includes("shooterModels:window.CrossroadsModelGeometry?.models(unit)"));
assert(engine.includes("targetModels:window.CrossroadsModelGeometry?.models(target)"));
assert(scene.includes("physicalFootprints?.project(authority"));
assert(scene.includes("models:plan.models||null"));
assert(scene.includes('source:"authoritative-models"'));
assert(scene.includes("physicalFootprints?.closestPair("));
assert(scene.includes("GARRISON: BUILDING-LEVEL FIRE"));
assert(scene.includes("debugFootprints"));
assert(read("classic-session.html").includes("model-geometry.js?v=3d107"),
 "the embedded coordinator must not reuse stale cached model geometry");
for(const page of ["battle3d.html","editor3d.html"]){
 const html=read(page);
 assert(html.includes("physical-footprints.js?v=0.9.73"));
 assert(html.indexOf("formation-layout.js")<html.indexOf("physical-footprints.js"));
 assert(html.indexOf("physical-footprints.js")<html.indexOf("scenario-scene.js"));
}
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,
 "0.9.73");
for(const file of ["src/diorama/scenario-scene.js",
 "src/diorama/physical-footprints.js","src/engine.js"])
 assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
console.log("PASS — v0.9.73 model-base parity, movement ghost, aim lanes, gun deployment, casualty and garrison audits");
