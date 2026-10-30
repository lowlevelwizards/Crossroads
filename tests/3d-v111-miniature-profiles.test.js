"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm"),
 fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const data={};
const localStorage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v};
const w={localStorage};
vm.runInNewContext(read("src/diorama/miniature-profiles.js"),{window:w});
const profile=w.Crossroads3DMiniatureProfiles;
assert.equal(profile.read("poland_1939","rifleSquad",0).headSize,1.25);
assert.equal(profile.read("poland_1939","rifleSquad",0).bootSize,.8);
profile.write("poland_1939","rifleSquad",0,{headSize:1.2,bodyWidth:10,
  helmet:"off",uniform:"khaki"});
assert.equal(profile.read("poland_1939","rifleSquad",0).headSize,1.2);
assert.equal(profile.read("poland_1939","rifleSquad",0).bodyWidth,1.28);
assert.equal(profile.read("poland_1939","rifleSquad",0).uniform,"khaki");
assert.equal(profile.read("poland_1939","rifleSquad",1).headSize,1.25);
assert.equal(profile.read("germany_1939","rifleSquad",0).helmet,"on");
profile.reset("poland_1939","rifleSquad",0);
assert.equal(profile.read("poland_1939","rifleSquad",0).headSize,1.25);
const model=read("src/diorama/miniature-model.js");
assert(model.includes("soldier.applyProfile=")&&model.includes("soldier.applyLook(saved)"));
assert(model.includes(".clone()"),"Pigment materials must not be shared");
const studio=read("miniature-studio.html");
for(const field of ["studioHeadSize","studioBodyWidth","studioPackSize","studioBootSize"])
 assert(studio.includes(field),"Missing morphology slider "+field);
for(const page of ["battle3d.html","editor3d.html","miniature-studio.html"]){
 const html=read(page);
 assert(html.indexOf("miniature-profiles.js")<html.indexOf("miniature-model.js"));
}
console.log("PASS — shared per-kit miniature proportions, persistence and painter isolation");
