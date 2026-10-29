"use strict";
// Show only authoritative values returned by the coordinator's target preview.
(() => {
  function describe(a) {
    if(!a)return "";
    if(!a.legal)return "Target blocked · "+(a.reason||"no legal shot");
    const rows=[];
    if(Number.isFinite(a.distance))rows.push(a.distance.toFixed(1)+"″ range");
    for(const group of a.weapons||[]){
      const label=group.label||group.key||"weapon";
      const toHit=Number.isFinite(group.hitTarget)?" · hits "+group.hitTarget+"+":"";
      rows.push((group.shots||0)+" "+label+toHit);
    }
    if(a.cover?.label)rows.push(a.cover.label);
    if(a.cover?.saveTarget!=null)rows.push("cover save "+a.cover.saveTarget+"+");
    if(a.cover?.label==null&&a.cover?.saveTarget==null)rows.push("open ground");
    return rows.join(" · ");
  }
  function summarize(a){
    if(!a?.legal)return "BLOCKED · "+(a?.reason||"No legal shot");
    const guns=(a.weapons||[]).map(w=>(w.shots||0)+" "+(w.label||w.key||"shots")).join(" · ");
    return (Number.isFinite(a.distance)?a.distance.toFixed(1)+"″ · ":"")+
      (guns||"LEGAL FIRE")+
      (a.cover?.saveTarget!=null?" · COVER "+a.cover.saveTarget+"+":" · OPEN");
  }
  window.Crossroads3DShotExplanation=Object.freeze({describe,summarize});
})();