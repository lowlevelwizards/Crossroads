"use strict";
// Environmental gait characteristics only; movement allowance remains with
// InfantryCore. Do not change authoritative distances or collision checks.
(() => {
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
  function contact(point,regions,step,run){
    const amount=roughness(point,regions);
    const extraLift=(step.leftLift>0||step.rightLift>0)?amount*(run?.022:.035):0;
    return Object.freeze({
      roughness:amount,
      bobScale:1+amount*.24,
      leftLift:step.leftLift>0?extraLift:0,
      rightLift:step.rightLift>0?extraLift:0,
      sway:amount*.018
    });
  }
  window.Crossroads3DTerrainContact=Object.freeze({roughness,contact});
})();