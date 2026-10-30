"use strict";
// Appearance and physical model proportions shared between Studio and battle.
// These fields never enter the authoritative combat/movement simulation.
(() => {
  const KEY="crossroads-3d-miniature-profiles-v2";
  const legacyKey="crossroads-3d-miniature-studio-paint-v1";
  const numeric=Object.freeze({
    headSize:[.76,1.25],bodyWidth:[.78,1.28],
    packSize:[.6,1.45],bootSize:[.8,1.25]
  });
  const enumFields=Object.freeze({
    uniform:["field","olive","khaki"],helmet:["on","off"],
    pack:["on","off"],helmetTint:["issue","dark","dust"],
    leatherTint:["issue","dark","russet"]
  });
  const defaults=Object.freeze({
    headSize:1.25,bodyWidth:1,packSize:1,bootSize:.8,
    uniform:"field",helmet:"on",pack:"on",
    helmetTint:"issue",leatherTint:"issue"
  });
  function normalize(input={}){
    const output={...defaults};
    for(const [field,[low,high]] of Object.entries(numeric)){
      const number=Number(input[field]);
      if(Number.isFinite(number))output[field]=Math.max(low,Math.min(high,number));
    }
    for(const [field,options] of Object.entries(enumFields))
      if(options.includes(input[field]))output[field]=input[field];
    return output;
  }
  function identity(kit,unitType,index){
    return [String(kit||"generic_ww2"),String(unitType||"rifleSquad"),
      Math.max(0,Math.floor(Number(index)||0))].join(":");
  }
  function storage(){
    try{return window.localStorage||null}catch(_){return null}
  }
  function load(){
    const st=storage();if(!st)return {};
    try{
      const data=JSON.parse(st.getItem(KEY)||"{}");
      return data&&typeof data==="object"&&!Array.isArray(data)?data:{};
    }catch(_){return {}}
  }
  function read(kit,unitType,index){
    const id=identity(kit,unitType,index),data=load();
    if(data[id])return normalize(data[id]);
    try{
      const old=JSON.parse(storage()?.getItem(legacyKey)||"{}");
      return normalize(old?.[id]);
    }catch(_){return normalize()}
  }
  function write(kit,unitType,index,profile){
    const data=load(),id=identity(kit,unitType,index);
    data[id]=normalize(profile);
    try{storage()?.setItem(KEY,JSON.stringify(data))}catch(_){}
    return data[id];
  }
  function reset(kit,unitType,index){
    const data=load();delete data[identity(kit,unitType,index)];
    try{storage()?.setItem(KEY,JSON.stringify(data))}catch(_){}
    return normalize();
  }
  window.Crossroads3DMiniatureProfiles=Object.freeze({
    KEY,numeric,enumFields,defaults,normalize,identity,read,write,reset
  });
})();