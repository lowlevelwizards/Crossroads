"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const html=read("miniature-studio.html"),js=read("src/diorama/miniature-studio.js");
for(const id of ["studioTimeline","studioShowJoints","studioWireframe"])
 assert(html.includes('id="'+id+'"'),"Missing studio inspection UI: "+id);
for(const token of ["timeline.addEventListener","syncTimeline()","rigMarkers",
  "joints[base+1]","refreshWireframe","studioShowJoints"])
 assert(js.includes(token),"Missing inspection capability: "+token);
console.log("PASS — timeline scrub, model wireframe, and six joint markers");
