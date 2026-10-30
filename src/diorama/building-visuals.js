"use strict";
// A figure follows a two-leg path via the facade entrance before settling at
// its authoritative unit's occupied-space presentation slot.
(() => {
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=x=>{const t=clamp(x);return t*t*(3-2*t)};
  function doorFor(bounds,from){
    if(!bounds||!from)return null;
    const hx=bounds.width/2,hz=bounds.depth/2;
    const x=Math.max(-hx,Math.min(hx,from.x-bounds.x));
    const z=Math.max(-hz,Math.min(hz,from.z-bounds.z));
    const dx=Math.abs(from.x-bounds.x)-hx;
    const dz=Math.abs(from.z-bounds.z)-hz;
    if(dx>dz)return {x:bounds.x+Math.sign(from.x-bounds.x||1)*hx,
      z:bounds.z+z};
    return {x:bounds.x+x,
      z:bounds.z+Math.sign(from.z-bounds.z||1)*hz};
  }
  function at(from,door,to,p){
    if(!from||!to)return to||from;
    if(!door)return {x:from.x+(to.x-from.x)*ease(p),
      z:from.z+(to.z-from.z)*ease(p)};
    if(p<.53){
      const u=ease(p/.53);
      return {x:from.x+(door.x-from.x)*u,z:from.z+(door.z-from.z)*u};
    }
    const u=ease((p-.53)/.47);
    return {x:door.x+(to.x-door.x)*u,z:door.z+(to.z-door.z)*u};
  }
  // The rules change building-level occupancy immediately. This only drives
  // the two-legged approach/threshold animation for the visible miniature.
  function threshold(progress,entering=true){
    const q=clamp(progress),near=1-Math.abs(q-.53)/.53;
    const move=Math.max(0,near);
    const first=clamp((q-.08)/.39),second=clamp((q-.49)/.41);
    return Object.freeze({
      action:entering?"enter":"exit",
      crouch:.12*move,lean:.12*move,
      headDuck:.08*move,
      leftLift:Math.sin(first*Math.PI)*.075,
      rightLift:Math.sin(second*Math.PI)*.075,
      doorway:move>.20,
      // Occupancy and line of sight are not evaluated here.
      authoritative:false
    });
  }
  function roofOpacity(occupied,focused){
    return occupied?(focused?.09:.23):1;
  }
  window.Crossroads3DBuildingVisuals=Object.freeze({
    doorFor,at,threshold,roofOpacity
  });
})();
