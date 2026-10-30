"use strict";
// Cosmetic-only layered posture controller shared by Crossroads battle and
// independent Miniature Lab. Never owns rules, target legality or shots.
(() => {
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const mix=(a,b,t)=>a+(b-a)*clamp(t);
  const profiles=Object.freeze({
    rifle:Object.freeze({raise:.30,lower:.65,ads:.23,recoil:.15,cycle:.52}),
    smg:Object.freeze({raise:.19,lower:.43,ads:.17,recoil:.10,cycle:.13}),
    lmg:Object.freeze({raise:.45,lower:.76,ads:.34,recoil:.28,cycle:.26}),
    mmg:Object.freeze({raise:.52,lower:.92,ads:.43,recoil:.34,cycle:.25}),
    officer:Object.freeze({raise:.20,lower:.48,ads:.19,recoil:.09,cycle:.17})
  });
  const profile=role=>profiles[role]||profiles.rifle;
  const stagger=index=>((index*37+11)%13)*.011;
  function create({faction="poland",role="rifle",index=0}={}){
    const tune=profile(role);
    let readiness=0,ads=0,head=0,torso=0,linger=0;
    let memoryYaw=null,reaction=0,cycle=0,time=0;
    const offset=stagger(index);
    function reset(){
      readiness=0;ads=0;head=0;torso=0;linger=0;
      memoryYaw=null;reaction=0;cycle=0;time=0;
    }
    function step(dt,input={}){
      const d=clamp(Number(dt)||0,0,.1);
      time+=d;
      const walking=!!input.walking,down=!!input.down,casualty=!!input.casualty;
      const pinned=Number(input.pins)||0;
      const engaged=!!input.preview||!!input.firing;
      // Last *known* target may only be supplied by the authoritative scene.
      if(Number.isFinite(input.targetYaw)){
        memoryYaw=input.targetYaw;
        linger=engaged?3.0:Math.max(linger,1.3);
      }else linger=Math.max(0,linger-d);
      if(linger<=0)memoryYaw=null;
      const attention=memoryYaw!==null&&!walking&&!down&&!casualty;
      const combatReady=input.order==="Fire"||input.order==="Ambush"||
        input.order==="Advance"||input.order==="Assault";
      const desiredReady=casualty||down?0:
        walking?.55:engaged?1:combatReady?.68:
          pinned?.30:input.cover?.38:linger>0?.48:0;
      const desiredADS=!walking&&!down&&!casualty&&
        (engaged||!!input.ambushTrigger)?1:0;
      const raise=desiredReady>readiness?tune.raise:tune.lower;
      readiness=mix(readiness,desiredReady,Math.min(1,d/Math.max(.06,raise+offset)));
      ads=mix(ads,desiredADS,Math.min(1,d/Math.max(.07,tune.ads+offset)));
      if(!engaged&&linger===0&&ads<.002)ads=0;
      if(input.recoil>0.015)reaction=Math.max(reaction,input.recoil);
      reaction=Math.max(0,reaction-d*2.0);
      if(input.shot&&tune.cycle>.16)cycle=1;
      cycle=Math.max(0,cycle-d/Math.max(.12,tune.cycle));
      const turn=attention?angle(memoryYaw-(Number(input.facing)||0)):0;
      // Ambush scans an empty assigned sector. It NEVER samples hidden
      // enemies: attention always originates from a known target yaw.
      const scanning=input.order==="Ambush"&&!attention&&!walking&&
        !down&&!casualty;
      const phase=time*1.15+index*.63;
      const desiredHead=attention?clamp(turn,-.42,.42):
        scanning?Math.sin(phase)*.14:0;
      const desiredTorso=attention?clamp(turn*.48,-.22,.22):
        scanning?Math.sin(phase*.65)*.045:0;
      head=mix(head,desiredHead,Math.min(1,d*8.0));
      torso=mix(torso,desiredTorso,Math.min(1,d*4.8));
      const sideCarry=walking&&faction==="germany"&&
        !["lmg","mmg","officer"].includes(role);
      return Object.freeze({
        weaponReadiness:readiness,weaponBlend:ads,
        weaponCarry:sideCarry?"german-side":
          walking&&faction!=="germany"?"polish-two":null,
        headYaw:head,torsoYaw:torso,weaponCycle:cycle,
        reaction,alert:engaged||readiness>.48,
        memoryYaw,hasKnownTarget:attention
      });
    }
    return Object.freeze({step,reset,get state(){
      return {readiness,ads,head,torso,linger,memoryYaw,reaction,cycle};
    }});
  }
  // Pure deterministic stage poses are appropriate for scrubbed Lab timelines.
  function lab(action,t=0){
    const u=clamp(t,0,1);
    if(action==="acquire")return {weaponReadiness:1,
      weaponBlend:u*u*(3-2*u),headDuck:.01*u};
    if(action==="recover")return {weaponReadiness:mix(1,.56,u),
      weaponBlend:1-u};
    if(action==="relaxed")return {weaponReadiness:0,weaponBlend:0};
    if(action==="ready")return {weaponReadiness:1,weaponBlend:0};
    if(action==="scan")return {weaponReadiness:.65,weaponBlend:0,
      headYaw:Math.sin(u*2*Math.PI)*.32,
      torsoYaw:Math.sin(u*2*Math.PI)*.13};
    return {};
  }
  window.Crossroads3DSoldierPose=Object.freeze({
    create,profile,stagger,lab,angle,clamp
  });
})();