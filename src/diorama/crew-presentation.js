"use strict";
// Describes a crew without relocating ANY authoritative individual model
// bases, assigning weapon attacks, or inventing targetable crew members.
(() => {
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  const positions=Object.freeze(["gunner","loader","observer"]);
  const socketLabels=Object.freeze(["stock","trigger","feed","support","muzzle"]);
  function describe(unit){
    const count=Math.max(0,Math.min(3,Math.floor(unit?.soldiers||0)));
    const deployed=!!unit?.mmgDeployed;
    const isMMG=unit?.type==="mmgTeam"||
      (unit?.role==="support"&&unit?.weapons?.mmg>0);
    return Object.freeze({
      isMMG,deployed:isMMG&&deployed,
      canOperate:isMMG&&deployed&&count>=2,
      reduced:count===2,crewCount:count,
      facing:Number.isFinite(unit?.mmgFacing)?unit.mmgFacing:0,
      roles:Object.freeze(positions.slice(0,count))
    });
  }
  // Presentation-only (no rules-firing state or timing). This is deliberately
  // a pure, analytically sampled timeline, supporting Lab scrubbing/replay.
  function frame(unit,mode="ready",seconds=0,index=0){
    const crew=describe(unit),role=crew.roles[index]||"absent";
    const duration=mode==="deploy"||mode==="pack"?1.15:
      mode==="fire"?1.0:.72;
    const q=clamp(seconds/duration);
    const smooth=q*q*(3-2*q);
    const setup=mode==="deploy"?smooth:mode==="pack"?1-smooth:
      crew.deployed?1:0;
    const gunner=role==="gunner",loader=role==="loader";
    const activity=mode==="fire"&&crew.canOperate?
      Math.pow(Math.max(0,Math.sin(q*Math.PI*5)),4):0;
    const crouch=gunner?.37*setup:loader?.48*setup:.29*setup;
    const lean=gunner?.12*setup:loader?.19*setup:.11*setup;
    return Object.freeze({role,setup,activity,mode,
      crouch,lean,readiness:gunner?setup:0,
      shoulder:gunner?.05*activity:loader?.035*activity:0,
      feed:loader&&crew.canOperate?setup*(.85+.15*activity):0,
      observing:role==="observer"&&crew.deployed,
      active:role!=="absent"});
  }
  // Readable geometric reach, with a conservative upper-body reach limit;
  // no stretching limbs or translating model bases to fake contact.
  function reach(crewPoint,socket,{maxReach=.83}={}){
    if(!crewPoint||!socket)return {reachable:false,distance:Infinity};
    const d=Math.hypot(crewPoint.x-socket.x,
      (crewPoint.y||0)-(socket.y||0),crewPoint.z-socket.z);
    return Object.freeze({reachable:d<=maxReach,distance:d});
  }
  function sector(unit,target){
    const crew=describe(unit);
    if(!crew.deployed||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))
      return Object.freeze({inside:false,angle:0,offset:0});
    const a=((Math.atan2(target.y-unit.y,target.x-unit.x)*180/Math.PI)%360+360)%360;
    const delta=((a-crew.facing+540)%360)-180;
    return Object.freeze({inside:Math.abs(delta)<=45+.001,angle:a,offset:delta});
  }
  window.Crossroads3DCrewPresentation=Object.freeze({
    describe,frame,reach,sector,socketLabels,positions
  });
})();