"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const lab=read("src/diorama/miniature-lab.js");
const scene=read("src/diorama/scenario-scene.js");
for(const text of ["Inspection pose","Isolate selected miniature",
  "helmetTint","leatherTint","previewPose","adapter.isolate"])
 assert(lab.includes(text),"Mini Lab missing "+text);
for(const text of ["soldier.labPose","soldier.labPose===\\"walk\\"",
  "leather.color.setHex","root.visible=!on||s.unit.id===id",
  "figure.visible=i<s.unit.soldiers"])
 assert(scene.includes(text),"3D scene missing "+text);
console.log("PASS — lab pose inspection, individual isolation and cosmetic finish options");
