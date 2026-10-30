"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const values={};
const window={localStorage:{
  getItem:key=>values[key]||null,
  setItem:(key,value)=>{values[key]=value},
  removeItem:key=>{delete values[key]}
}};
for(const file of ["weapon-archetypes.js","miniature-weapon-library.js","miniature-faction-gear.js",
  "miniature-sdf-transitions.js"]){
  new vm.Script(read("src/diorama/"+file),{filename:file})
    .runInNewContext({window});
}
const weapons=window.Crossroads3DWeaponLibrary,
  gear=window.Crossroads3DFactionGear,
  sdf=window.Crossroads3DSDFTransitions;
assert.equal(weapons.kinds.length,7);
for(const kind of weapons.kinds){
  const p=weapons.read(kind);
  assert(p.length<1,"new guns should be slightly shorter");
  assert(p.stock>1&&p.barrel>1,
    "wood and steel must be bolder than the bare reference");
  assert(Object.keys(p).length>=10,"parametric recipes expose named connected dimensions");
  assert(weapons.apply(null,kind).length>0,
    "legacy apply facade must not scale disconnected part groups");
}
assert(weapons.write("wz29",{length:.81,stock:1.45}));
assert.equal(weapons.read("wz29").length,.81);
assert.equal(weapons.read("kar98k").length,weapons.defaults.kar98k.length,
  "different nation rifle is not changed when Polish weapon is saved");
weapons.reset("wz29");
assert.equal(weapons.read("wz29").length,weapons.defaults.wz29.length);
assert.throws(()=>weapons.parse("unknown",{}));
assert.equal(gear.specs.poland.helmet,"wz31");
assert.equal(gear.specs.germany.helmet,"m35");
assert.equal(gear.specs.poland.lower,"ankle-boots-puttees");
assert.equal(gear.specs.germany.lower,"jackboots");
assert(gear.specs.poland.pouchY>-.14);
assert(gear.specs.germany.pouchY>-.14);
assert(sdf.helmetField([.268,.23,.12],"germany")!==
  sdf.helmetField([.268,.23,.12],"poland"),
  "M35 and wz31 shells must differ geometrically, not just paint");
const gearCode=read("src/diorama/miniature-faction-gear.js");
for(const term of ["surfaceRibbon","setBodyWidth",
  "m35-gasmask-1939","wz33-blanket-roll","tornister-blanket-roll",
  "pouchHeight","role"])assert(gearCode.includes(term));
const model=read("src/diorama/miniature-heroic-character.js");
assert(model.includes("Crossroads3DFactionGear?.create"));
assert(model.includes("gearFactory?.outfit"));
assert(model.includes("for(const mesh of gear.gait||[])"));
const historical=read("src/diorama/miniature-historical-weapons.js");
assert(historical.includes("weaponKind||kindFor"));
assert(historical.includes("const recipe=settings||lib.read(kind)"));
assert(historical.includes("deployedSections:deployedGrips?.parts"));
const studio=read("src/diorama/miniature-studio.js");
assert(studio.includes('compareCheckbox?.addEventListener("change",()=>{'));
assert(studio.includes("compareSoldier.applyPose(posed)"));
const lab=read("src/diorama/weapon-lab.js");
new vm.Script(lab,{filename:"weapon-lab.js"});
assert(lab.includes("requestAnimationFrame(animate)"));
assert(lab.includes("lib.write(kind,settings)"));
assert(lab.includes('$("weaponCompare").checked'));
assert(lab.includes("weaponMounted"));
for(const page of ["miniature-studio.html","battle3d.html","editor3d.html"]){
  const source=read(page);
  for(const file of ["miniature-faction-gear.js","miniature-weapon-library.js"])
    assert(source.includes(file+"?v=0.9.54"),"missing "+file+" from "+page);
  assert(source.indexOf("miniature-faction-gear.js")<
    source.indexOf("miniature-heroic-character.js"));
}
const html=read("weapon-lab.html");
for(const id of ["weaponKind","weaponCompare","weaponMounted","weaponSave",
  "weaponExport","weaponImport","weaponDisplayMode","weaponFields"])
  assert(html.includes('id="'+id+'"'));
const release=JSON.parse(read("release-manifest.json"));
assert.equal(release.threeDCacheVersion,"0.9.54");
for(const file of ["weapon-lab.html","src/diorama/weapon-lab.js",
  "src/diorama/miniature-weapon-library.js",
  "src/diorama/miniature-faction-gear.js"])
  assert(release.requiredFiles.includes(file),file+" missing from manifest");
console.log("PASS — 1939 faction identity, adjustable weapons, labs, and load order");
