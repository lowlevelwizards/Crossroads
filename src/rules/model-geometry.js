"use strict";
// Bolt Action-style infantry bases in *tabletop inches*. Shared by the 2D
// coordinator and 3D display; the logical unit center is not a firing point.
(() => {
  const BASE_RADIUS=.50;
  const FORMATIONS=()=>window.CROSSROADS_FORMATIONS?.formations||{};
  function slots(unit){
    const f=FORMATIONS();
    const preset=unit?.role==="support"?
      (unit?.mmgDeployed?f.supportDeployed:f.supportPacked):
      f[unit?.role]||f.line;
    if(!preset)return [{x:0,y:0}];
    return preset.slots.slice(0,Math.max(0,unit?.soldiers||0))
      .map(([x,y])=>({x:(x-50)*.025,y:(y-50)*.0135}));
  }
  function models(unit,center=unit){
    return slots(unit).map((p,index)=>({
      x:center.x+p.x,y:center.y+p.y,
      radius:BASE_RADIUS,index,unitId:unit.id
    }));
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function edgeGap(a,b){
    return distance(a,b)-(a.radius??BASE_RADIUS)-(b.radius??BASE_RADIUS);
  }
  function unitGap(a,b,ac=a,bc=b){
    if(a?.inBuilding&&b?.inBuilding&&a.inBuilding===b.inBuilding)
      return a.id===b.id?Infinity:-Infinity;
    const am=models(a,ac),bm=models(b,bc);
    if(!am.length||!bm.length)return Infinity;
    let nearest=Infinity;
    for(const x of am)for(const y of bm)
      nearest=Math.min(nearest,edgeGap(x,y));
    return nearest;
  }
  function closestRange(shooter,target){
    let closest=Infinity;
    for(const a of models(shooter))for(const b of models(target))
      closest=Math.min(closest,Math.max(0,edgeGap(a,b)));
    return closest;
  }
  function distanceToSegment(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,mag=dx*dx+dy*dy;
    const t=mag>0?Math.max(0,Math.min(1,
      ((point.x-a.x)*dx+(point.y-a.y)*dy)/mag)):0;
    return {distance:Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t),t};
  }
  function friendlyFire(shooter,target,units,clearance=1){
    const shooterModels=models(shooter),targetModels=models(target);
    const friends=(units||[]).filter(u=>u?.soldiers>0&&
      u.faction===shooter.faction&&u.id!==shooter.id&&u.id!==target.id)
      .flatMap(u=>models(u));
    let clear=0,blocked=0,nearest=Infinity;
    for(const start of shooterModels){
      for(const end of targetModels){
        let obstructed=false;
        for(const other of friends){
          const gap=distanceToSegment(other,start,end);
          nearest=Math.min(nearest,gap.distance-(other.radius??BASE_RADIUS));
          if(gap.t>0&&gap.t<1&&gap.distance<
            clearance+(other.radius??BASE_RADIUS)-1e-5){
            obstructed=true;break;
          }
        }
        if(obstructed)blocked++;
        else clear++;
      }
    }
    return Object.freeze({blocked:clear===0&&blocked>0,
      clearLines:clear,blockedLines:blocked,nearestFriendlyGap:nearest});
  }
  function destinationClearance(unit,destination,allUnits,clearance=1){
    for(const other of allUnits||[]){
      if(other.id===unit.id||other.soldiers<=0)continue;
      const gap=unitGap(unit,other,destination,other);
      if(gap<clearance-.001)
        return {legal:false,otherId:other.id,gap,
          reason:"A model would finish within "+clearance+
            "″ of "+other.name+"; leave a gap between bases."};
    }
    return {legal:true};
  }
  window.CrossroadsModelGeometry=Object.freeze({
    BASE_RADIUS,slots,models,edgeGap,unitGap,closestRange,
    distanceToSegment,friendlyFire,destinationClearance
  });
})();
