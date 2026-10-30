"use strict";
// Cosmetic weapon silhouettes shared by the standalone lab and active battles.
// Local approved recipes affect this browser; exports can be committed to ship.
(() => {
  const KEY="crossroads-weapon-recipes-v1";
  const defaults=Object.freeze({
    wz29:{length:.91,stock:1.18,receiver:1.16,barrel:1.32,magazine:1},
    kar98k:{length:.91,stock:1.20,receiver:1.15,barrel:1.28,magazine:1},
    wz28:{length:.88,stock:1.18,receiver:1.23,barrel:1.38,magazine:1.17},
    mg34:{length:.90,stock:1.14,receiver:1.26,barrel:1.38,magazine:1.15},
    mors39:{length:.88,stock:1.18,receiver:1.20,barrel:1.32,magazine:1.18},
    mp38:{length:.89,stock:1.16,receiver:1.22,barrel:1.30,magazine:1.19},
    pistol:{length:.93,stock:1.15,receiver:1.17,barrel:1.22,magazine:1}
  });
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const parse=(kind,raw={})=>{
    if(!Object.prototype.hasOwnProperty.call(defaults,kind))
      throw Error("Unknown weapon kind");
    const out={...defaults[kind]};
    for(const name of Object.keys(out)){
      const n=Number(raw[name]);
      if(raw[name]!==undefined&&Number.isFinite(n))
        out[name]=clamp(n,name==="length"?.65:.70,name==="length"?1.30:1.65);
    }
    return out;
  };
  function saved(){
    try{return JSON.parse(window.localStorage.getItem(KEY)||"{}")||{}}
    catch(_){return {}}
  }
  function read(kind){return parse(kind,saved()[kind])}
  function write(kind,values){
    const all=saved(),v=parse(kind,values);
    all[kind]=v;
    try{window.localStorage.setItem(KEY,JSON.stringify(all));return true}
    catch(_){return false}
  }
  function reset(kind){
    const all=saved();delete all[kind];
    try{window.localStorage.setItem(KEY,JSON.stringify(all));return true}
    catch(_){return false}
  }
  function apply(parts,kind,values=read(kind)){
    const p=parse(kind,values);
    for(const [name,group] of Object.entries(parts||{})){
      if(!group)continue;
      const amount=p[name]||1;
      if(name==="barrel")group.scale.set(p.barrel,p.barrel,p.length);
      else if(name==="stock")group.scale.set(amount,amount,p.length);
      else if(name==="receiver")group.scale.set(amount,amount,1);
      else if(name==="magazine")group.scale.set(amount,amount,1);
    }
    return p;
  }
  window.Crossroads3DWeaponLibrary=Object.freeze({
    KEY,defaults,parse,read,write,reset,apply,kinds:Object.keys(defaults)
  });
})();