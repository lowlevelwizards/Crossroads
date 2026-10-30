"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
for(const file of ["miniature-sdf-transitions.js",
  "miniature-faction-gear.js","miniature-sculpt-shapes.js"]){
  new vm.Script(read("src/diorama/"+file),{filename:file})
    .runInNewContext({window});
}
const sdf=window.Crossroads3DSDFTransitions;
const gear=window.Crossroads3DFactionGear;
const shape=window.Crossroads3DSculptShapes;
assert.equal(typeof shape.create,"function");
const samples=[
  [[0,.245,-.16],[0,.245,.16]],
  [[.10,.25,-.15],[.10,.25,.15]]
];
for(const side of ["poland","germany"]){
  for(const [front,back] of samples){
    assert(Number.isFinite(sdf.helmetField(front,side)));
    assert(Number.isFinite(sdf.helmetField(back,side)));
    assert(sdf.helmetField(front,side)>sdf.helmetField(back,side),
      side+" helmet must be cut higher at front than rear to reveal eyes");
  }
}
assert(sdf.helmetField([.24,.20,.14],"germany")!==
  sdf.helmetField([.24,.20,.14],"poland"));
assert(sdf.jointField([.085,0,0],"elbow")>0,
  "small elbow blend should not read as separate armor puck");
// Chest-facing, width-aware strap attachment follows surface shape.
for(const width of [.78,1,1.28])for(const y of [-.18,-.03,.12,.24]){
  for(const x of [-.17,0,.17]){
    const z=gear.torsoSurface(x,y,width);
    assert(Number.isFinite(z));
    assert(z<=0&&z>-.30);
  }
}
assert.notEqual(gear.torsoSurface(.16,.10,.78),
  gear.torsoSurface(.16,.10,1.28),
  "strap points must respond to tunic width adjustments");
const soldier=read("src/diorama/miniature-heroic-character.js");
for(const term of ["shapeSource===","soldier.approvedShapesUsed",
  "gear.setBodyWidth?.","S.clothedShin(","setEquipmentPreset=",
  "sdf?.joint","hat.position.set(0,-.055,-.006)",
  "head-silhouette-v6"]){
  assert(soldier.includes(term),term);
}
assert(!soldier.includes('"polish-puttee-'));
const gearCode=read("src/diorama/miniature-faction-gear.js");
assert(gearCode.includes("S.surfaceRibbon("));
assert(gearCode.includes("setBodyWidth"));
const sculpt=read("src/diorama/miniature-sculpt-shapes.js");
assert(sculpt.includes("refreshRibbon"));
assert(sculpt.includes("g.addGroup")&&sculpt.includes("clothedShin"));
const studio=read("src/diorama/miniature-studio.js");
for(const term of ["studioShapeSource","studioLoadout","studioBattleScale",
  "shapeSource:comparingSource","studioShapeStatus",
  "setEquipmentPreset","renderer.setScissorTest(true)"]){
  assert(studio.includes(term),term);
}
for(const id of ["studioShapeSource","studioShapeStatus","studioLoadout",
  "studioBattleScale","studioBattleLabel"]){
  assert(read("miniature-studio.html").includes('id="'+id+'"'),id);
}
const shapes=read("src/diorama/miniature-shape-library.js");
assert(shapes.includes('KEY_DRAFT="crossroads-workbench-drafts-v1"'));
assert(shapes.includes('KEY_APPROVED="crossroads-workbench-approved-v1"'));
const renderer=read("src/diorama/miniature-studio.js");
assert(!renderer.includes("new THREE.WebGLRenderer({canvas:preview"),
  "battle preview must not allocate second iPhone graphics context");
for(const file of ["battle3d.html","miniature-studio.html"]){
  assert(read(file).includes("miniature-faction-gear.js?v=0.9.71"));
}
assert(read("editor3d.html").includes("miniature-faction-gear.js?v=0.9.70"));
console.log("PASS — v0.9.70 shaped helmet clearance, dynamic gear, unified legwear, saved canon comparison and studio presets");
