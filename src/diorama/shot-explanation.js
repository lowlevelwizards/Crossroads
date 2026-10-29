"use strict";
// Show only authoritative values returned by the coordinator's target preview.
(() => {
  function hitChance(hitTarget){
    return Number.isFinite(hitTarget)?Math.max(0,Math.min(1,(7-hitTarget)/6)):0;
  }
  function expectedHits(a){
    return (a?.weapons||[]).reduce((n,g)=>
      n+(g.shots||0)*hitChance(g.hitTarget),0);
  }
  function describe(a) {
    if(!a)return "";
    if(!a.legal)return "Target blocked · "+(a.reason||"no legal shot");
    const rows=[];
    if(Number.isFinite(a.distance))rows.push(a.distance.toFixed(1)+"″ range");
    for(const group of a.weapons||[]){
      const label=group.label||group.key||"weapon";
      const toHit=Number.isFinite(group.hitTarget)?" · hits "+group.hitTarget+
        "+ ("+Math.round(hitChance(group.hitTarget)*100)+"% per shot)":"";
      const modifiers=(group.modifiers||[]).length?" ("+group.modifiers.join(", ")+")":"";
      rows.push((group.shots||0)+" "+label+toHit+modifiers);
    }
    if(a.weapons?.length)rows.push("expected "+expectedHits(a).toFixed(1)+
      " hits before saves");
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
      (a.weapons?.every(g=>Number.isFinite(g.hitTarget))?
        " · ~"+expectedHits(a).toFixed(1)+" HITS":"")+
      (a.cover?.saveTarget!=null?" · COVER "+a.cover.saveTarget+"+":" · OPEN");
  }
  window.Crossroads3DShotExplanation=Object.freeze({
    describe,summarize,hitChance,expectedHits
  });
})();