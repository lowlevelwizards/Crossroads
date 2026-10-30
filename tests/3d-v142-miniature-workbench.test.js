"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const storage=new Map();
const window={
  localStorage:{
    getItem:k=>storage.get(k)??null,
    setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)
  }
};
const context=vm.createContext({window});
for(const file of ["miniature-shape-library.js","miniature-shape-geometry.js",
  "miniature-shape-history.js"]){
  const code=read("src/diorama/"+file);
  new vm.Script(code,{filename:file}).runInContext(context);
}
const lib=window.Crossroads3DShapeLibrary,
  geometry=window.Crossroads3DShapeGeometry,
  historyApi=window.Crossroads3DShapeHistory;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
assert.equal(lib.ids.length,8);
const torso=lib.resolve("torso");
assert.equal(torso.axis,"y");
assert(torso.contours.length>=5);
const head=lib.resolve("head");
assert.equal(head.radialSegments,12);
const bad=lib.clone(torso);bad.contours[1].width=NaN;
assert.throws(()=>lib.validate(bad),/Nonfinite/);
const crossing=lib.clone(torso);
crossing.contours[2].height=crossing.contours[1].height;
assert.throws(()=>lib.validate(crossing),/increase/);
const h=historyApi.create(torso);
h.begin();
const changed=h.get();changed.contours[2].width*=1.14;
h.update(changed);h.commit();
assert(h.canUndo());assert(h.undo());
assert(eq(h.get(),torso));
assert(h.redo());
assert(h.get().contours[2].width>torso.contours[2].width);
const draft=lib.put(h.get(),"draft");
assert(draft.persisted);
assert(lib.resolve("torso","draft").contours[2].width>
  lib.resolve("torso").contours[2].width);
assert.equal(lib.approved("torso"),null,
  "drafts must never affect the shared battle factory");
const exported=lib.exportDocument(h.get());
assert(eq(lib.importDocument(exported),lib.validate(h.get())));
assert.throws(()=>lib.importDocument('{"bad": 123}'));
assert(lib.put(h.get(),"approved").persisted);
assert(lib.approved("torso")!==null);
assert.equal(window.localStorage.getItem(lib.KEY_DRAFT)!==null,true);
assert(lib.clear("torso","approved"));
assert.equal(lib.approved("torso"),null);
const ids=lib.ids;
for(const id of ids){
  const d=lib.resolve(id);
  const p=d.contours[1];
  assert(Number.isFinite(geometry.field(d,[p.width,p.height,0])));
}
class FloatAttribute{
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize}
}
class MeshGeometry{
  constructor(){this.attributes={};this.userData={}}
  setAttribute(key,a){this.attributes[key]=a;return this}
  setIndex(indices){this.index=indices;return this}
  computeVertexNormals(){}
  computeBoundingSphere(){}
  scale(){return this}
  rotateX(){return this}
  rotateY(){return this}
  rotateZ(){return this}
  translate(){return this}
}
const THREE={BufferGeometry:MeshGeometry,Float32BufferAttribute:FloatAttribute};
const baseMesh=geometry.make(THREE,torso,{resolution:16});
assert(baseMesh.index.length>10);
assert(baseMesh.attributes.position.array.every(Number.isFinite));
const blended=lib.clone(torso);
blended.blend.enabled=true;blended.blend.strength=.10;
const raw=geometry.field(torso,[.24,-.30,0]);
const merged=geometry.field(blended,[.24,-.30,0]);
assert(merged<=raw+1e-6,"smooth union should not shrink the shape");
const bake=geometry.make(THREE,blended,{resolution:18});
assert(bake.userData.sdfBaked);
assert(bake.userData.triangles>10);
assert(bake.userData.triangles<48001);
assert(bake.attributes.position.array.every(Number.isFinite));
assert(bake.attributes.normal.array.every(Number.isFinite));
assert.equal(bake.attributes.normal.array.length,bake.attributes.position.array.length);
assert.equal(bake.attributes.position.array.length%9,0);
assert(geometry.make(THREE,torso,{published:true})===
  geometry.make(THREE,torso,{published:true}),
  "published buffer is cached by complete shape content");
const changed2=lib.clone(torso);changed2.contours[1].width+=.05;
assert.notEqual(geometry.make(THREE,changed2,{published:true}),
  geometry.make(THREE,torso,{published:true}),
  "altered shape content must not return a stale geometry");
for(const page of ["miniature-studio.html","battle3d.html","editor3d.html"]){
  const html=read(page);
  assert(html.includes("miniature-shape-library.js?v=0.9.47"));
  assert(html.includes("miniature-shape-geometry.js?v=0.9.47"));
  assert(html.indexOf("miniature-shape-library.js")<
    html.indexOf("miniature-model.js"),"shape library must precede factory usage");
}
for(const id of ["wbPart","wbToggle","wbBlend","wbBlendStrength",
  "wbExportGLB","wbImportGLB","wbClearGLB","wbBlendRx","wbBlendRy","wbBlendRz",
  "wbDiscardDraft","wbRevertPublished",
  "wbImport","wbExport","wbUndo","wbRedo","wbPublish"]){
  assert(read("miniature-studio.html").includes('id="'+id+'"'));
}
const factory=read("src/diorama/miniature-heroic-character.js");
assert(factory.includes('bindPart("torso"'));
assert(factory.includes('bindPart("boot"'));
assert(factory.includes('shapeLibrary?.approved(id)'));
assert(factory.includes('soldier.setMannequin='));
const studio=read("src/diorama/miniature-studio.js");
assert(studio.includes("workbench?.pointerDown(event)"));
assert(studio.includes("workbench?.pointerMove(event)"));
assert(studio.includes("workbench?.pointerUp(e)"));
const workbenchScript=read("src/diorama/miniature-workbench.js");
assert(workbenchScript.includes('lib.clear(part,"draft")'));
assert(workbenchScript.includes('lib.clear(part,"approved")'));
assert(workbenchScript.includes('if(onBase)return'),
  "editing isolation must preserve the miniature base");
const manifest=JSON.parse(read("release-manifest.json"));
assert.equal(manifest.threeDCacheVersion,"0.9.47");
console.log("PASS — versioned shapes, contour loft, cached meshes, SDF blend, history, persistence, runtime and studio integration");
