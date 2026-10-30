"use strict";
// v2: parameter recipes, not independent Mesh group scales. Safely migrate
// the previous device-only v1 settings into bounded starter dimensions.
(() => {
  const schema=window.Crossroads3DWeaponArchetypes;
  const KEY="crossroads-weapon-recipes-v2";
  const LEGACY_KEY="crossroads-weapon-recipes-v1";
  const defaults=Object.freeze(Object.fromEntries(schema.kinds.map(kind=>
    [kind,Object.freeze(Object.fromEntries(
      Object.entries(schema.fields).map(([key,field])=>[key,field.default])))])));
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function parse(kind,raw={}){
    if(!Object.prototype.hasOwnProperty.call(schema.defs,kind))throw Error("Unknown weapon kind");
    if(!raw||typeof raw!=="object"||Array.isArray(raw))raw={};
    const out={...defaults[kind]};
    for(const [name,spec] of Object.entries(schema.fields)){
      if(!Object.prototype.hasOwnProperty.call(raw,name))continue;
      const value=Number(raw[name]);
      if(Number.isFinite(value))out[name]=clamp(value,spec.min,spec.max);
    }
    return out;
  }
  function store(key){
    try{
      const value=window.localStorage?.getItem(key);
      const result=value?JSON.parse(value):{};
      return result&&typeof result==="object"&&!Array.isArray(result)?result:{};
    }catch(_){return {}}
  }
  // Preserve the user's v1 data; new v2 names are separately persisted.
  // Do not multiply old absolute group scales into the new generated geometry.
  function migrate(kind,old){
    const out={...defaults[kind]};
    for(const key of ["length","stock","receiver","barrel","magazine"]){
      const v=Number(old?.[key]);
      if(!Number.isFinite(v))continue;
      const baseline={length:.91,stock:1.18,receiver:1.16,barrel:1.32,magazine:1}[key];
      const f=schema.fields[key];
      out[key]=clamp(f.default*(v/baseline),f.min,f.max);
    }
    return out;
  }
  function read(kind){
    if(!Object.prototype.hasOwnProperty.call(schema.defs,kind))throw Error("Unknown weapon kind");
    const saved=store(KEY);
    if(saved[kind])return parse(kind,saved[kind]);
    const legacy=store(LEGACY_KEY);
    return legacy[kind]?migrate(kind,legacy[kind]):parse(kind);
  }
  function write(kind,values){
    const all=store(KEY);all[kind]=parse(kind,values);
    try{window.localStorage?.setItem(KEY,JSON.stringify(all));return true}
    catch(_){return false}
  }
  function reset(kind){
    if(!Object.prototype.hasOwnProperty.call(schema.defs,kind))return false;
    const all=store(KEY);delete all[kind];
    try{window.localStorage?.setItem(KEY,JSON.stringify(all));
      // Also suppress legacy settings for explicitly reset archetypes.
      const legacy=store(LEGACY_KEY);
      if(legacy[kind]){
        delete legacy[kind];
        window.localStorage?.setItem(LEGACY_KEY,JSON.stringify(legacy));
      }
      return true;
    }catch(_){return false}
  }
  // Kept as compatibility facade for earlier lab/tests. It must NOT scale
  // independent physical parts: doing so disconnects wood/steel surfaces.
  function apply(parts,kind,values=read(kind)){
    return parse(kind,values);
  }
  const kinds=Object.freeze([...schema.kinds]);
  window.Crossroads3DWeaponLibrary=Object.freeze({
    KEY,LEGACY_KEY,version:2,defaults,fields:schema.fields,
    controls:schema.controls,kinds,parse,read,write,reset,migrate,apply
  });
})();