"use strict";
/* Pure, deterministic tactical heuristics. This only SELECTS legal commands.
   The original InfantryCore session validates and commits every action. */
(() => {
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function objectivePoint(s,faction) {
    const objectives=(s.objectives||[]).filter(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)
      &&o.state!==faction);
    return objectives.length?objectives:null;
  }
  function nearest(origin,things){
    return things?.slice().sort((a,b)=>dist(origin,a)-dist(origin,b))[0]||null;
  }
  function chooseUnit(s,faction) {
    const ready=s.units.filter(u=>u.faction===faction&&u.soldiers>0&&!u.activated);
    const enemies=s.units.filter(u=>u.faction!==faction&&u.soldiers>0);
    const objectives=objectivePoint(s,faction);
    return ready.sort((a,b)=>{
      const value=u=>{
        const enemy=nearest(u,enemies),obj=nearest(u,objectives);
        return (obj?Math.max(0,20-dist(u,obj))*2:0)+
          (enemy?Math.max(0,18-dist(u,enemy)):0)+
          (u.pins>=2?-8:0)+(u.role==="officer"?4:0);
      };
      return value(b)-value(a)||a.id.localeCompare(b.id);
    })[0]||null;
  }
  function chooseOrder(s,unit,legal,previewTarget,failed) {
    const enemy=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    // During choose-order the engine intentionally disallows previewTarget;
    // choose likely firing ranges here, then confirm legal LOS in target phase.
    const visible=enemy.filter(u=>dist(u,unit)<23);
    const has=o=>legal.includes(o);
    if(unit.pins>=2&&has("Rally"))return "Rally";
    if(visible.length&&has("Fire")&&!failed.fire.has(unit.id))
      return "Fire";
    if(has("Advance")&&!failed.move.has(unit.id))return "Advance";
    if(has("Run")&&!failed.move.has(unit.id))return "Run";
    if(has("Ambush")&&enemy.some(u=>dist(u,unit)<22))return "Ambush";
    if(has("Down"))return "Down";
    return legal[0]||null;
  }
  function chooseTarget(s,unit,previewTarget) {
    const enemies=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    return enemies.filter(u=>previewTarget(u.id)?.legal).sort((a,b)=>{
      const score=u=>100-dist(unit,u)*1.2+(u.pins?u.pins*2:0)+
        (u.soldiers<=3?6:0)+(u.role==="officer"?8:0);
      return score(b)-score(a)||a.id.localeCompare(b.id);
    })[0]||null;
  }
  function chooseMove(s,unit,previewMove) {
    const enemies=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    const objective=nearest(unit,objectivePoint(s,unit.faction));
    const enemy=nearest(unit,enemies);
    const target=objective||enemy||{x:36,y:24};
    const theta=Math.atan2(target.y-unit.y,target.x-unit.x);
    const options=[];
    for(const angle of [0,.32,-.32,.7,-.7,1.08,-1.08,1.6,-1.6,Math.PI]){
      for(const step of [5.5,4,2.5,1.2]){
        const point={x:Math.max(1,Math.min(71,unit.x+step*Math.cos(theta+angle))),
          y:Math.max(1,Math.min(47,unit.y+step*Math.sin(theta+angle)))};
        const preview=previewMove(point);
        if(!preview?.legal)continue;
        const endpoint=preview.path?.at(-1)||point;
        const progress=dist(unit,target)-dist(endpoint,target);
        const nearestEnemy=nearest(endpoint,enemies);
        const enemyDist=nearestEnemy?dist(endpoint,nearestEnemy):20;
        // Reward objectives and useful firing proximity, discourage exposed
        // suicidal charges and movement that makes no tactical progress.
        const threat=enemyDist<3?-10:enemyDist<7?-3:0;
        const score=progress*4+(objective?5:0)+threat+
          (preview.shortened?-1:0)+Math.min(.5,step*.03);
        options.push({point:endpoint,score});
      }
    }
    return options.sort((a,b)=>b.score-a.score)[0]?.point||null;
  }
  window.Crossroads3DAITactics=Object.freeze({chooseUnit,chooseOrder,chooseTarget,chooseMove});
})();