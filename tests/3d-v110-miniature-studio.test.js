"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const w={},context=vm.createContext({window:w});
for(const p of ["data/unit-types.js","data/faction-kits.js","src/presentation/miniatures.js",
  "src/diorama/study-motion.js","src/diorama/miniature-model.js",
  "src/diorama/miniature-studio-data.js","src/diorama/miniature-studio-poses.js"])
  vm.runInContext(read(p),context,{filename:p});
const studio=w.Crossroads3DStudioCatalog;
const units=studio.units(),kits=studio.kits();
assert.equal(units.length,Object.keys(w.CROSSROADS_UNIT_TYPES).length);
assert.equal(kits.length,Object.keys(w.CROSSROADS_FACTION_KITS.kits).length);
for(const kit of kits)for(const unitType of units){
  const unit=studio.buildUnit(unitType.id,kit.id);
  assert.equal(unit.soldiers,unitType.count);
  for(let i=0;i<unit.soldiers;i++){
    const r=studio.soldier(unit.type,unit.kitId,i);
    assert.equal(r.kit.id,kit.id);
    assert(r.role);
    assert(r.weaponProfile);
  }
}
assert.throws(()=>studio.soldier(units[0].id,kits[0].id,-1));
const pose=w.Crossroads3DStudioPoses;
const motion=w.CrossroadsDioramaMotion;
for(const [mode] of pose.ACTIONS){
  for(const t of [0,.34,1,2.75]){
    const frame=pose.frame(mode,t,motion);
    for(const val of Object.values(frame))if(typeof val==="number")
      assert(Number.isFinite(val),mode+" motion must stay finite");
  }
}
assert(pose.frame("walk",.22,motion).leftLift>0||pose.frame("walk",.22,motion).rightLift>0);
assert(pose.frame("run",.22,motion).lean>pose.frame("walk",.22,motion).lean);
assert(pose.frame("down",0,motion).crouch>.6);
const html=read("miniature-studio.html");
assert(!html.includes("battleSessionFrame")&&!html.includes("classic-session.html"));
assert(!html.includes("scenario-scene.js"));
assert(html.includes("miniature-model.js")&&html.includes("miniature-studio.js"));
assert(html.indexOf("src/presentation/miniatures.js")<html.indexOf("miniature-studio-data.js"));
const battle=read("battle3d.html");
assert(!battle.includes("miniature-lab.js"));
assert(!battle.includes("miniature-lab.css"));
const factory=read("src/diorama/miniature-model.js");
const scene=read("src/diorama/scenario-scene.js");
assert(factory.includes('squad.soldiers.push('));
assert(factory.includes('soldier.applyLook('));
assert(!scene.includes('function makeSoldier('),"Battle must use shared model geometry");
assert(scene.includes("Crossroads3DMiniatureModel?.create"));
assert(battle.indexOf("miniature-model.js")<battle.indexOf("scenario-scene.js"));
const studioSource=read("src/diorama/miniature-studio.js");
for(const token of ["new THREE.PerspectiveCamera","new THREE.OrthographicCamera",
 "pointerdown","pointermove","wheel","applyCamera","cameraView",
 "Crossroads3DStudioPoses","renderPose","requestAnimationFrame","activeSoldier.applyLook"])
 assert(studioSource.includes(token),"Studio missing "+token);
assert(read("index.html").includes('href="./miniature-studio.html"'));
console.log("PASS — dedicated lab uses every registry model, actual shared soldier geometry, cameras and pose previews.");
