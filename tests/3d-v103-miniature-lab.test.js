"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const lab=read("src/diorama/miniature-lab.js");
const scene=read("src/diorama/scenario-scene.js");
for(const token of ["Inspection pose","Isolate selected miniature",
  "helmetTint","leatherTint","previewPose","adapter.isolate"])
 assert(lab.includes(token),"Mini Lab missing "+token);
for(const token of ["soldier.labPose","soldier.labPose===",
  "leather.color.setHex","root.visible=!on||s.unit.id===id",
  "figure.visible=i<s.unit.soldiers"])
 assert(scene.includes(token),"3D scene missing "+token);
console.log("PASS — Miniature Lab poses, isolation and finishes.");
