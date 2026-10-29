"use strict";
// v0.9.4a: A unit's logical center does not necessarily coincide with the
// visible miniatures after cover formation. Labels, selection, tap targets
// and starting poses must all use the actual live miniature footprint.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const window={};
for(const file of ["src/diorama/visual-anchor.js",
 "src/diorama/cover-positions.js","src/diorama/formation-layout.js"])
 vm.runInNewContext(read(file),{window},{filename:file});
const A=window.Crossroads3DVisualAnchor;
function soldier(x,z,visible=true,pendingRemoval=false){
 return {figure:{position:{x,z},visible},pendingRemoval};
}
const logical={x:12,z:8};
const soldiers=[
 soldier(-1.4,-.70),soldier(-1.0,-.65),soldier(-.6,-.55),
 soldier(-1.4,-.28),soldier(-1.0,-.27),soldier(-.6,-.25)
];
const formation=A.resolve(soldiers,6,{minRadius:.58});
assert(formation.x<-0.8&&formation.z<-.35,
 "physical group shifted into cover away from unit center");
const visual=A.toWorld(logical,formation);
assert(visual.x<logical.x-.8&&visual.z<logical.z-.35,
 "ring and label must not stay at logical unit center");
assert(Math.hypot(visual.x-logical.x,visual.z-logical.z)>.95,
 "source screenshot regression: selector would visibly float away");
for(const sol of soldiers){
 const d=Math.hypot(sol.figure.position.x-formation.x,
   sol.figure.position.z-formation.z);
 assert(d<=formation.radius-.30+1e-8,
 "all surviving miniatures fit within the visual selector footprint");
}
const casualty=A.resolve([...soldiers.slice(0,5),
 soldier(90,90,false)],6);
assert(casualty.radius<2,"hidden casualty cannot drag selector off board");
const pending=A.resolve([soldier(0,0),soldier(50,50,true,true)],2);
assert.equal(pending.count,1,"pending casualty is not a living anchor");
const missing=A.resolve([],0,{fallback:{x:.5,z:-.25},minRadius:.53});
assert.equal(missing.x,.5);assert.equal(missing.z,-.25);
assert.equal(missing.count,0);
const moved=[soldier(.33,.2),soldier(.59,.25)];
const after=A.resolve(moved,2);
assert(after.x>.4,"anchor follows models as they move");
assert(Math.abs(A.toWorld(logical,after).x-
 (logical.x+after.x))<1e-8);
const scene=read("src/diorama/scenario-scene.js");
for(const marker of [
 "const visualAnchor=window.Crossroads3DVisualAnchor",
 "function syncSquadVisualAnchor(squad)",
 "function squadVisualWorld(squad)",
 "function snapSquadToFormation(squad)",
 "const center=squadVisualWorld(squad);",
 "squad.hitBox.position.x=anchor.x",
 "squad.hitBox.position.z=anchor.z",
 "squad.eligibleRing.position.set(anchor.x",
 "squad.ring.position.set(anchor.x",
 "for(const squad of squads)snapSquadToFormation(squad);",
 "syncSquadVisualAnchor(squad);",
 "cameraFocus=squadVisualWorld(next);",
 "for(const squad of squads)snapSquadToFormation(squad);\n      selectSquad(null)"
])assert(scene.includes(marker),"scene missing visual-alignment path "+marker);
for(const page of ["battle3d.html","diorama.html","editor3d.html"]){
 const html=read(page);
 const version=page==="diorama.html"?"0.9.4a":"0.9.31";
 assert(html.includes("visual-anchor.js?v="+version),
 page+" does not load visual anchor");
 assert(html.indexOf("formation-layout.js?v="+version)<
 html.indexOf("visual-anchor.js?v="+version));
 assert(html.indexOf("visual-anchor.js?v="+version)<
 html.indexOf("scenario-scene.js?v="+version));
}
assert.equal(JSON.parse(read("release-manifest.json")).threeDCacheVersion,
 "0.9.31");
console.log("PASS — initial/replay cover positions, selected label, ring, eligibility halo, tap hitbox and camera share the living model footprint");
