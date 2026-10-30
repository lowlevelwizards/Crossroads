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
  const mechanics=Object.freeze({
    rifle:Object.freeze({interval:.19,action:.59,cycleStart:.18,cycleEnd:.85,recoil:.16}),
    officer:Object.freeze({interval:.18,action:.32,cycleStart:.20,cycleEnd:.55,recoil:.11}),
    smg:Object.freeze({interval:.095,action:.24,cycleStart:.22,cycleEnd:.62,recoil:.23}),
    lmg:Object.freeze({interval:.088,action:.31,cycleStart:.21,cycleEnd:.65,recoil:.30}),
    mmg:Object.freeze({interval:.078,action:.27,cycleStart:.20,cycleEnd:.62,recoil:.34})
  });
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  // A stable, absolute presentation clock for one already resolved attack.
  function schedule(groups,soldiers,{maxShots=96}={}) {
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
      const count=Math.min(Math.max(0,group.shots||0),maxShots-events.length);
      for(let i=0;i<count;i++){
        const s=preferred[(prior+i)%preferred.length];
        const priorShot=events[events.length-1];
        const spacing=mechanics[role].interval;
        const delay=priorShot?priorShot.delay+spacing:0;
        events.push(Object.freeze({
          soldierIndex:s.index,role,heavy,
          recoil:mechanics[role].recoil,delay,shotIndex:events.length
        }));
      }
      firedByRole.set(role,prior+count);
    }
    return events;
  }
  // Reproducible at arbitrary replay times, frame rates and speed settings.
  // Bolt cycling only applies to rifles; recoil is physical but never an
  // extra attack. The recoil waveform is bounded and decays to zero.
  function motionAt(role,elapsed){
    const m=mechanics[role]||mechanics.rifle;
    const t=clamp((Number(elapsed)||0)/m.action);
    const impulse=t<.15?1-t/.15:0;
    const cycle=m.cycleEnd>m.cycleStart&&t>=m.cycleStart&&t<=m.cycleEnd?
      Math.sin(Math.PI*(t-m.cycleStart)/(m.cycleEnd-m.cycleStart)):0;
    return Object.freeze({
      recoil:m.recoil*impulse,
      weaponCycle:cycle,
      bolt:role==="rifle"?cycle:0,
      actionComplete:t>=1
    });
  }
  function duration(groups,soldiers){
    const shots=schedule(groups,soldiers);
    if(shots.length)return Math.max(.42,shots[shots.length-1].delay+.25);
    // Battle timeline only receives adjudicated event metadata, not the
    // physical model roster. Never shorten it merely for lack of a roster.
    const count=(groups||[]).reduce((n,g)=>
      n+Math.max(0,Math.floor(g?.shots||0)),0);
    return Math.max(.42,Math.min(96,count)*.19+.25);
  }
  // Decorative results originate strictly from adjudicated results.
  function impactPlan(event,visibleCount=6){
    const hits=Math.max(0,Math.floor(event?.hits||0));
    const saved=Math.max(0,Math.floor(event?.saved||0));
    const casualties=Math.max(0,Math.floor(event?.casualties||0));
    const total=Math.min(8,hits);
    const n=Math.max(0,Math.floor(visibleCount));
    return Object.freeze(Array.from({length:total},(_,index)=>Object.freeze({
      index,modelIndex:n?index%n:0,
      kind:index<Math.min(casualties,total)?"casualty":
        index<Math.min(casualties+saved,total)?"cover":"dirt",
      intensity:.78+(index%3)*.10
    })));
  }
  window.Crossroads3DWeaponPresentation=Object.freeze({
    roleFor,schedule,mechanics,motionAt,duration,impactPlan
  });
})();
