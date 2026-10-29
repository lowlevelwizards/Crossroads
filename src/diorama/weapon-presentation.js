"use strict";
// Cosmetic shot routing only. Actual groups and counts come from the rules engine.
(() => {
  function roleFor(key) {
    const label=String(key||"").toLowerCase();
    if(/lmg|light.machine/.test(label))return "lmg";
    if(/mmg|mg34|machine/.test(label))return "mmg";
    if(/smg|submachine|mp40/.test(label))return "smg";
    if(/pistol|sidearm/.test(label))return "officer";
    return "rifle";
  }
  function schedule(groups,soldiers,{maxShots=48}={}) {
    const events=[],firedByRole=new Map();
    const available=(soldiers||[]).map((s,index)=>({role:s.role,index,visible:s.visible}))
      .filter(s=>s.visible!==false&&!["crew","loader"].includes(s.role));
    for(const group of groups||[]){
      const role=roleFor(group.key||group.weapon);
      const preferred=available.filter(s=>s.role===role||
        (role==="rifle"&&!["smg","lmg","mmg","officer"].includes(s.role)));
      // For mixed squads do not fire a machine gun from a rifleman's hands.
      if(!preferred.length)continue;
      const heavy=role==="lmg"||role==="mmg";
      const prior=firedByRole.get(role)||0;
      const count=Math.min(Math.max(0,group.shots||0),12,maxShots-events.length);
      for(let i=0;i<count;i++){
        const s=preferred[(prior+i)%preferred.length];
        events.push({soldierIndex:s.index,role,heavy,
          recoil:heavy?.32:role==="smg"?.23:.16,delay:events.length*.052});
      }
      firedByRole.set(role,prior+count);
    }
    return events;
  }
  window.Crossroads3DWeaponPresentation=Object.freeze({roleFor,schedule});
})();
