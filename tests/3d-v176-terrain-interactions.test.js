"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
 vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const context=vm.createContext({window:{}});
for(const f of ["src/diorama/terrain-interactions.js",
 "src/diorama/terrain-contact.js","src/diorama/building-visuals.js",
 "src/diorama/ai-tactics.js","src/diorama/miniature-studio-poses.js"])
 vm.runInContext(read(f),context,{filename:f});
const T=context.window.Crossroads3DTerrainInteractions,
 G=context.window.Crossroads3DTerrainContact,
 B=context.window.Crossroads3DBuildingVisuals,
 A=context.window.Crossroads3DAITactics,
 P=context.window.Crossroads3DStudioPoses;
const wall={id:"w",kind:"wall",a:{x:-2,z:0},b:{x:2,z:0}};
const fence={id:"f",kind:"fence",a:{x:4,z:-2},b:{x:4,z:2}};
const hedge={id:"h",kind:"hedge",a:{x:-3,z:2},b:{x:3,z:2}};
const near={x:0,z:-.25},enemy={x:0,z:1.5};
assert(T.cover(near,[wall],enemy).active);
assert.equal(T.cover(near,[wall],enemy).kind,"wall");
assert(T.cover(near,[wall],enemy).crouch>0);
assert(!T.cover(near,[wall],{x:0,z:-2}).active,
 "cover behind the enemy must never be presented as protective");
assert(!T.cover({x:0,z:-1.5},[wall],enemy).active,
 "a distant wall must not produce a fake cover stance");
assert(!T.cover(near,[wall],null).active);
assert(T.cover({x:0,z:1.7},[hedge],{x:0,z:3}).active);
assert.equal(T.cover({x:0,z:1.7},[hedge],{x:0,z:3}).stance,"kneel");
const crossed=T.crossings([{x:0,z:-2},{x:0,z:2}],[wall]);
assert.equal(crossed.length,1);
assert(Math.abs(crossed[0].at-.5)<1e-7);
assert.equal(crossed[0].kind,"wall");
assert.equal(T.crossings([{x:-2,z:-1},{x:2,z:-1}],[wall]).length,0);
assert.equal(T.crossings([{x:0,z:-2},{x:0,z:-.2}],[wall]).length,0);
const middle=T.traverse(.5,crossed);
assert(middle.active&&middle.lift>0);
assert(middle.leftLift>0||middle.rightLift>0);
assert.equal(T.traverse(.1,crossed).active,false);
assert.equal(T.traverse(.5,crossed,{reducedMotion:true}).lift,0);
assert.equal(T.traverse(.5,crossed,{reducedMotion:true}).active,false);
const fCross=T.crossings([{x:2,z:0},{x:6,z:0}],[fence]);
assert.equal(fCross[0].kind,"fence");
const rough=[{x:0,z:0,width:2,depth:2,difficulty:1.6}];
const step={leftLift:.10,rightLift:0};
const contact=G.contact({x:0,z:0},rough,step,false,{crossing:middle});
assert(contact.roughness>1.5);
assert(contact.leftLift>0,"rough ground must contribute positive foot clearance");
assert.equal(contact.crossingLift,middle.lift);
assert.equal(G.contact({x:10,z:10},rough,step,false).roughness,0);
const bounds={x:0,z:0,width:5,depth:4};
const door=B.doorFor(bounds,{x:5,z:0});
assert(door&&Number.isFinite(door.x));
const begin=B.at({x:3,z:0},door,{x:0,z:0},0),
 end=B.at({x:3,z:0},door,{x:0,z:0},1);
assert.equal(begin.x,3);assert.equal(end.x,0);
const threshold=B.threshold(.53,true);
assert(threshold.doorway&&threshold.crouch>0);
assert(!B.threshold(0,true).doorway);
assert.equal(B.threshold(.5,false).action,"exit");
assert(B.roofOpacity(true,true)<B.roofOpacity(true,false));
assert.equal(B.roofOpacity(false,false),1);
assert(!T.windowPosture(false,{kind:"building"}).active);
assert(!T.windowPosture(true,{kind:"wall"}).active);
assert(T.windowPosture(true,{kind:"building",look:enemy}).active);
assert.equal(T.windowPosture(true,{kind:"building"}).authoritative,false);
const terrain=[{x:12,y:12,width:4,height:2,cover:"hard",
 movement:"crossing"}];
const enemies=[{x:14,y:18,soldiers:5,faction:"red"}];
assert(Number.isFinite(A.tacticalShelter({x:13,y:13},terrain,enemies)));
const fakeMove=()=>({legal:true,path:[],cost:2});
const unit={id:"friendly",faction:"blue",role:"infantry",
 soldiers:6,x:8,y:8,pins:1};
const preview=A.chooseMove({units:[unit,...enemies],
 terrain,objectives:[{x:22,y:22,state:"red"}],
 table:{width:72,height:48}},unit,fakeMove,true);
assert(preview.candidates.length>0);
const motion={gaitPose:()=>({bob:.05,leftLift:.1,rightLift:0,
 leftReach:0,rightReach:.08,lean:.09}),
 plantedGait:()=>({bob:.05,leftLift:.12,rightLift:0,
 leftReach:0,rightReach:.08,lean:.09})};
for(const mode of ["terrain-brace","terrain-kneel",
 "terrain-cross-wall","terrain-cross-fence","terrain-cross-hedge",
 "terrain-rough","terrain-window","terrain-door-enter",
 "terrain-door-exit"]){
 assert(P.ACTIONS.some(a=>a[0]===mode),"Lab missing "+mode);
 for(const t of [0,.27,.7,1.4,2.4]){
  const f=P.frame(mode,t,motion);
  for(const value of Object.values(f))if(typeof value==="number")
   assert(Number.isFinite(value),"Nonfinite "+mode);
 }
}
const battle=read("src/diorama/scenario-scene.js");
for(const t of ["terrainInteractions.cover","terrainInteractions.crossings",
 "terrainInteractions?.traverse","terrainInteractions?.windowPosture",
 "buildingVisuals.threshold","soldier.entryPose",
 "terrainTraverse?.crouch","moving.plan?.path",
 "soldier.terrainCover?.stance"])
 assert(battle.includes(t),"battle missing "+t);
assert(!read("src/diorama/terrain-interactions.js").includes("unit.x="));
for(const page of ["battle3d.html","editor3d.html"]){
 const html=read(page);
 assert(html.includes("terrain-interactions.js?v=0.9.76"));
 assert(html.indexOf("terrain-interactions.js")<
        html.indexOf("scenario-scene.js"));
}
assert(read("miniature-studio.html").includes(
 "terrain-interactions.js?v=0.9.76"));
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,
 "0.9.76");
for(const f of ["src/diorama/scenario-scene.js",
 "src/diorama/miniature-heroic-character.js",
 "src/diorama/miniature-studio.js"])
 assert.doesNotThrow(()=>new vm.Script(read(f),{filename:f}));
console.log("PASS — v0.9.76 authorized cover, crossings, terrain gait, garrison display, AI and Lab");
