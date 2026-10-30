"use strict";
// All footing offsets are cosmetic. InfantryCore owns movement allowance,
// difficult-terrain legality and final model locations.
(() => {
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  function roughness(point,regions){
    let value=0;
    for(const region of regions||[]){
      if(point.x>=region.x-region.width/2&&
         point.x<=region.x+region.width/2&&
         point.z>=region.z-region.depth/2&&
         point.z<=region.z+region.depth/2){
        value=Math.max(value,region.difficulty||1);
      }
    }
    return value;
  }
  function contact(point,regions,step,run,extra={}){
    const amount=roughness(point,regions),cross=extra.crossing||null;
    const footLeft=step.leftLift>0,footRight=step.rightLift>0;
    const rough=amount*(run?.022:.035);
    // Height comes from terrain contact, not from extra world movement.
    return Object.freeze({
      roughness:amount,bobScale:1+amount*.24,
      leftLift:footLeft?rough+(cross?.leftLift||0):cross?.leftLift||0,
      rightLift:footRight?rough+(cross?.rightLift||0):cross?.rightLift||0,
      sway:amount*.018,lean:cross?.lean||0,
      crossingLift:cross?.lift||0,crouch:cross?.crouch||0
    });
  }
  window.Crossroads3DTerrainContact=Object.freeze({roughness,contact});
})();