"use strict";
// Short physical contact gestures driven only by completed rules-engine assault
// events. Decorative displacement never modifies the game-space coordinates.
(() => {
  const ease=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u)};
  function create(from,to,{defender=false}={}) {
    const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1;
    return {dx:dx/len,dz:dz/len,age:0,peak:defender?.17:.38,
      duration:defender?.97:1.39};
  }
  function displacement(gesture) {
    const p=gesture.age/gesture.duration;
    if(p<=0||p>=1)return 0;
    if(p<.23)return gesture.peak*ease(p/.23);
    if(p<.58)return gesture.peak;
    return gesture.peak*(1-ease((p-.58)/.42));
  }
  // Stagger miniature contact, avoiding a single rigid squad-wide translation.
  function individualDisplacement(gesture,index=0){
    if(!gesture)return 0;
    const lead=gesture.peak>.20 ? Math.min(.25,index*.032) : Math.min(.19,index*.028);
    const age=gesture.age-lead;
    if(age<=0)return 0;
    const duration=Math.max(.35,gesture.duration-lead);
    const p=age/duration;
    if(p>=1)return 0;
    if(p<.27)return gesture.peak*ease(p/.27);
    if(p<.56)return gesture.peak;
    return gesture.peak*(1-ease((p-.56)/.44));
  }
  // Cosmetic upper-body bracing in the same clock as displacement. The
  // authoritative assault event, dice and survivors are never re-resolved.
  function individualPose(gesture,index=0){
    if(!gesture)return {lean:0,crouch:0,brace:0};
    const lead=Math.min(.24,index*.032);
    const q=Math.max(0,Math.min(1,
      (gesture.age-lead)/Math.max(.3,gesture.duration-lead)));
    const push=q<.28?ease(q/.28):q<.58?1:1-ease((q-.58)/.42);
    return {lean:push*(gesture.peak>.2?.20:.13),
      crouch:push*.14,brace:push*(gesture.peak>.2?1:.6)};
  }
  window.Crossroads3DAssaultMotion=Object.freeze({
    create,displacement,individualDisplacement,individualPose
  });
})();
