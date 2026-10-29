"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
for(const p of ["src/diorama/movement-intent.js","src/diorama/ai-tactics.js"])
  vm.runInNewContext(read(p),{window},{filename:p});
const planner=window.Crossroads3DMovementIntent.createPlanner();
const ok=(cost=4)=>({legal:true,cost,allowance:6,path:[]});
const denied={legal:false,reason:"Blocked"};
assert.equal(planner.commit(),null);
assert(!planner.stageWaypoint({x:1,y:3},ok()));
assert(planner.stageDestination({x:25,y:18},ok()));
assert(planner.snapshot().legal);
assert.equal(planner.snapshot().waypoint,null);
assert(!planner.stageWaypoint({x:27,y:20},denied));
assert.equal(planner.snapshot().waypoint,null);
assert(planner.stageWaypoint({x:23,y:17},ok(5)));
assert.equal(planner.snapshot().cost,5);
assert(!planner.stageDestination({x:90,y:90},denied));
assert.equal(planner.commit().point.x,25);
assert.equal(planner.commit().waypoint.y,17);
assert(planner.removeWaypoint(ok(3.5)));
assert.equal(planner.commit().waypoint,null);
const result=planner.commit();result.point.x=100;
assert.equal(planner.snapshot().destination.x,25,"returned points must not alias live state");
planner.reset();
assert.equal(planner.commit(),null);
const snapshot={faction:"red",phase:"choose-unit",objectives:[],
 units:[{id:"a",faction:"red",x:8,y:8,soldiers:5,pins:0,activated:false},
        {id:"b",faction:"blue",x:10,y:9,soldiers:5}]};
const ai=window.Crossroads3DAITactics;
assert(ai.forceBalance({x:8,y:8},[snapshot.units[0]],[snapshot.units[1]]));
assert.equal(ai.chooseUnit(snapshot,"red").id,"a");
assert.equal(ai.chooseOrder(snapshot,snapshot.units[0],["Fire","Advance","Rally"],
 ()=>({legal:false}),{fire:new Set(),move:new Set()}),"Fire");
assert(ai.chooseMove({...snapshot,objectives:[{id:"o",x:12,y:8}]},
 snapshot.units[0],p=>({legal:true,path:[{x:8,y:8},p],cost:4,allowance:6})));
const scene=read("src/diorama/scenario-scene.js");
const hud=read("src/diorama/battle-client.js");
for(const term of ["movePlanner.commit()","previewWaypoint(point)",
 "positionWaypoint(point)","waypointDragId","muzzleBurst(burst)",
 "impactDust(","showOutcome(target,e)","resolveSquadFormation(",
 "battle.previewMove(request.point,request.waypoint)"])
 assert(scene.includes(term),"Missing scene interaction: "+term);
assert(hud.includes("CONFIRM MOVE")&&hud.includes("Remove waypoint"));
assert(read("battle3d.html").includes("3D v0.9.32 preview"));
assert(read("diorama.html").includes("movement-intent.js?v=0.9.4a"));
console.log("PASS — persistent routes, legal waypoint editing, target-state safety, solo tactics and firefight wiring");
