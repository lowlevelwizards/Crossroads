"use strict";
const assert=require("node:assert/strict"),vm=require("node:vm"),
 fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const manifest=JSON.parse(read("release-manifest.json"));
assert.equal(manifest.threeDCacheVersion,"0.9.71");
for(const page of ["battle3d.html","editor3d.html","miniature-studio.html"]){
 const html=read(page);
 const tokens=[...html.matchAll(/[?&]v=(0\.9\.[0-9]+)/g)].map(m=>m[1]);
 assert(tokens.length>5&&tokens.every(token=>token==="0.9.71"),
   page+" stale cache detected");
}
const battle=read("battle3d.html"),editor=read("editor3d.html"),lab=read("miniature-studio.html");
for(const p of [battle,editor])assert(p.includes("miniature-studio-poses.js"));
assert(battle.indexOf("miniature-profiles.js")<battle.indexOf("miniature-model.js"));
assert(lab.indexOf("miniature-profiles.js")<lab.indexOf("miniature-model.js"));
assert(battle.indexOf("terrain-contact.js")<battle.indexOf("scenario-scene.js"));
assert(battle.indexOf("benchmark-audit.js")<battle.indexOf("scenario-scene.js"));
assert(!lab.includes("battle-client.js"));
for(const name of ["miniature-profiles","terrain-contact","ai-inspector","benchmark-audit",
 "miniature-studio-poses","miniature-model","garrison-windows"]){
 const code=read("src/diorama/"+name+".js");
 assert.doesNotThrow(()=>new vm.Script(code,{filename:name}));
}
console.log("PASS — soldier foundation v0.9.71 entrypoints, shared modules and cache discipline");
