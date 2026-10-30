"use strict";
// Pure tabletop-inches -> world-space adapter. Never changes InfantryCore
// positions, performs model movement or overrides combat legality.
(() => {
  const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
  function project(models,origin,toWorld){
    if(!Array.isArray(models))return [];
    return models.filter(finite).map(m=>{
      const w=toWorld({x:m.x,y:m.y});
      return Object.freeze({index:m.index,radius:m.radius,
        x:w.x-origin.x,z:w.z-origin.z,
        worldX:w.x,worldZ:w.z,unitId:m.unitId});
    });
  }
  function closestPair(shooters,targets){
    if(!Array.isArray(shooters)||!Array.isArray(targets))return null;
    let best=null,score=Infinity;
    for(const s of shooters){
      if(!finite(s))continue;
      for(const t of targets){
        if(!finite(t))continue;
        const d=Math.hypot(t.x-s.x,t.y-s.y)-
          (Number(s.radius)||0)-(Number(t.radius)||0);
        if(d<score){score=d;best={shooter:s,target:t,gap:Math.max(0,d)};}
      }
    }
    return best?Object.freeze(best):null;
  }
  function compare(squad,world,toWorld){
    const rules=project(squad.unit?.models||[],world,toWorld);
    let count=0,max=0,total=0,mismatches=0;
    for(const model of rules){
      const soldier=squad.soldiers?.[model.index];
      if(!soldier||soldier.figure.visible===false||soldier.pendingRemoval)continue;
      const dx=model.x-soldier.figure.position.x;
      const dz=model.z-soldier.figure.position.z;
      const d=Math.hypot(dx,dz);
      count++;max=Math.max(max,d);total+=d;
      if(d>.06)mismatches++;
    }
    return Object.freeze({count,max,mean:count?total/count:0,mismatches,
      garrison:Boolean(squad.unit?.inBuilding)});
  }
  window.Crossroads3DPhysicalFootprints=Object.freeze({
    project,closestPair,compare
  });
})();
