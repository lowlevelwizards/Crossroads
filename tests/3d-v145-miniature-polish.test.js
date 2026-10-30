"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const window={};
vm.runInNewContext(read("src/diorama/miniature-sdf-transitions.js"),{window});
const sdf=window.Crossroads3DSDFTransitions;
assert.equal(typeof sdf.bake,"function");
const sample=(field,coords)=>coords.map(p=>field(p));
const rim=sample(p=>sdf.helmetField(p,"poland"),[
  [0,.20,-.30],[0,.22,-.30],[0,.24,-.30],[0,.26,-.30]]);
assert(rim.every(Number.isFinite),"helmet lip field must be smooth and finite");
assert(Math.max(...rim)-Math.min(...rim)<.12,
  "helmet lip should not contain a discontinuous step");
assert(sdf.jointField([.088,0,0],"elbow")>0,
  "slimmed elbow transitions should not bulge well outside the sleeve");
assert(sdf.jointField([.088,0,0],"knee")<.04,
  "knee transitions retain their established volume");
class BufferGeometry {
  constructor(){this.attributes={};this.userData={}}
  setAttribute(name,attribute){this.attributes[name]=attribute;return this}
  computeBoundingSphere(){}
}
class FloatAttribute {constructor(a,itemSize){this.array=a;this.itemSize=itemSize}}
const THREE={BufferGeometry,Float32BufferAttribute:FloatAttribute};
const baked=sdf.bake(THREE,p=>sdf.helmetField(p,"poland"),
  [[-.325,.171,-.329],[.325,.563,.325]],28);
const position=baked.attributes.position.array,
  normals=baked.attributes.normal.array;
assert(baked.userData.triangleCount>800,
  "refined lip must contain enough triangles for continuous shading");
assert(baked.userData.triangleCount<60000,
  "baked helmet must respect performance ceiling");
assert(position.length===normals.length&&position.length%9===0);
assert(position.every(Number.isFinite)&&normals.every(Number.isFinite));
assert(normals.some((x,i)=>i%3===1&&Math.abs(x)>.2),
  "analytical normal gradients must preserve curvature");
const model=read("src/diorama/miniature-heroic-character.js");
assert(model.includes("hat.position.set(0,-.069,-.031)"));
assert(model.includes("Crossroads3DFactionGear?.create"));
const kit=read("src/diorama/miniature-faction-gear.js");
assert(kit.includes("polish-roll-1939")&&kit.includes("german-roll-1939"));
assert(kit.includes("polish-puttee")&&kit.includes("german-marching-boot"));
assert(model.includes("mat.eyes,[side*.071,.163,-.184]"));
const weapons=read("src/diorama/miniature-historical-weapons.js");
assert(weapons.includes("window.Crossroads3DWeaponGeometry.create"));
assert(weapons.includes('def.family==="bolt"'));
assert(weapons.includes('def.family==="mg"'));
assert(weapons.includes('def.family==="mp"'));
const profileContext={window:{}};
vm.runInNewContext(read("src/diorama/miniature-profiles.js"),profileContext);
const p=profileContext.window.Crossroads3DMiniatureProfiles;
assert.equal(p.normalize().headSize,1.25);
assert.equal(p.normalize().bootSize,.8);
assert.equal(p.normalize({headSize:1.18,bootSize:.93}).headSize,1.18,
  "existing explicit profile scales must not be overridden");
console.log("PASS — v0.9.47 SDF lip, reduced elbows, historical kit, grips and profile defaults");
