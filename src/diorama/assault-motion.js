"use strict";
// Short physical contact gestures driven only by completed rules-engine assault
// events. Decorative displacement never modifies the game-space coordinates.
(() => {
  const ease=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u)};
  function create(from,to,{defender=false}={}) {
    const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1;
    return {dx:dx/len,dz:dz/len,age:0,peak:defender?.085:.20,
      duration:defender?.64:1.32};
  }
  function displacement(gesture) {
    const p=gesture.age/gesture.duration;
    if(p<=0||p>=1)return 0;
    if(p<.23)return gesture.peak*ease(p/.23);
    if(p<.58)return gesture.peak;
    return gesture.peak*(1-ease((p-.58)/.42));
  }
  window.Crossroads3DAssaultMotion=Object.freeze({create,displacement});
})();
