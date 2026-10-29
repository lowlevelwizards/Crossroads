"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
for(const file of ["src/rules/shooting.js","src/engine.js","src/diorama/study-motion.js",
  "src/diorama/garrison-windows.js","src/diorama/formation-layout.js",
  "src/diorama/soldier-ik.js","src/diorama/ai-tactics.js",
  "src/diorama/ai-opponent.js","src/diorama/miniature-lab.js",
  "src/diorama/shot-explanation.js","src/diorama/miniature-model.js",
  "src/diorama/miniature-studio-data.js","src/diorama/miniature-studio-poses.js",
  "src/diorama/miniature-studio.js","src/diorama/scenario-scene.js"]){
 const source=fs.readFileSync(path.join(root,file),"utf8");
 assert.doesNotThrow(()=>new vm.Script(source,{filename:file}),file+" must parse");
}
const client=fs.readFileSync(path.join(root,"src/diorama/battle-client.js"),"utf8");
assert(client.includes("u.mmgFacing,u.mmgDeployed"),
  "deployed gun facing must invalidate the 3D snapshot signature");
const html=fs.readFileSync(path.join(root,"battle3d.html"),"utf8");
assert(html.includes("classic-session.html?scenario=hold_the_farm&amp;v=0.9.32"));
const classic=fs.readFileSync(path.join(root,"classic-session.html"),"utf8");
assert(classic.includes("src/engine.js?v=3d104"));
assert(classic.includes("src/rules/shooting.js?v=3d104"));
console.log("PASS — updated 3D source parses and battle host cache references are fresh.");
