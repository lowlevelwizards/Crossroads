"use strict";
/* Pure, deterministic tactical heuristics. This only SELECTS legal commands.
   The original InfantryCore session validates and commits every action. */
(() => {
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function nearby(point,units,radius){
    return (units||[]).filter(u=>u.soldiers>0&&dist(point,u)<=radius);
  }
  function forceBalance(point,allies,enemies){
    const support=nearby(point,allies,9).reduce((v,u)=>v+
      Math.min(8,u.soldiers)*(u.pins>=2?.5:1),0);
    const opposition=nearby(point,enemies,9).reduce((v,u)=>v+
      Math.min(8,u.soldiers)*(u.down?.65:1),0);
    return {support,opposition,advantage:support-opposition};
  }
  function objectivePoint(s,faction) {
    const objectives=(s.objectives||[]).filter(o=>
      Number.isFinite(o.x)&&Number.isFinite(o.y)&&
      (o.type==="exit_unit"?o.faction===faction:o.state!==faction));
    // In asymmetric exit scenarios, defend the line rather than marching
    // the non-exiting army toward the attacker's own exit marker.
    return objectives.length?objectives:null;
  }
  function nearest(origin,things){
    return things?.slice().sort((a,b)=>dist(origin,a)-dist(origin,b))[0]||null;
  }
  // Round-scale intentions: distribute non-support units across objectives
  // instead of treating every activation as an unrelated nearest-target move.
  // The plan contains only current public snapshot data, never hidden rolls.
  function makePlan(s,faction){
    const allies=(s.units||[]).filter(u=>u.faction===faction&&u.soldiers>0)
      .slice().sort((a,b)=>a.id.localeCompare(b.id));
    const enemies=(s.units||[]).filter(u=>u.faction!==faction&&u.soldiers>0);
    const goals=objectivePoint(s,faction)||[];
    const assignments={};
    const load={};
    for(const unit of allies){
      const pinned=unit.role==="officer"?
        nearest(unit,allies.filter(u=>u.id!==unit.id&&u.pins>0)):null;
      if(pinned&&dist(unit,pinned)>4.5){
        assignments[unit.id]={task:"support",point:{x:pinned.x,y:pinned.y},
          targetId:pinned.id};
        continue;
      }
      const target=goals.slice().sort((a,b)=>
        (dist(unit,a)+(load[a.id]||0)*15)-(dist(unit,b)+(load[b.id]||0)*15)||
        String(a.id).localeCompare(String(b.id)))[0];
      if(!target){
        const enemy=nearest(unit,enemies);
        assignments[unit.id]={task:unit.role==="support"?"establish":"engage",
          point:enemy?{x:enemy.x,y:enemy.y}:null,targetId:enemy?.id||null};
        continue;
      }
      load[target.id]=(load[target.id]||0)+
        (unit.role==="support"?.4:1);
      assignments[unit.id]={task:unit.role==="support"?"establish":
        dist(unit,target)<3.5?"hold":"advance",
        point:{x:target.x,y:target.y},targetId:target.id};
    }
    return Object.freeze({round:s.round,assignments});
  }
  function chooseUnit(s,faction,plan=null) {
    const ready=s.units.filter(u=>u.faction===faction&&u.soldiers>0&&!u.activated&&
      (!s.snap||s.snap.eligibleIds?.includes(u.id)));
    const enemies=s.units.filter(u=>u.faction!==faction&&u.soldiers>0);
    const objectives=objectivePoint(s,faction);
    const allies=s.units.filter(u=>u.faction===faction&&u.soldiers>0);
    return ready.sort((a,b)=>{
      const value=u=>{
        const enemy=nearest(u,enemies),obj=nearest(u,objectives);
        const balance=forceBalance(u,allies,enemies);
        return (obj?Math.max(0,22-dist(u,obj))*1.8:0)+
          (enemy?Math.max(0,18-dist(u,enemy))*.6:0)+
          (u.pins>=2?-8:0)+(u.role==="officer"?
          4+allies.filter(v=>v.id!==u.id&&!v.activated&&v.pins>=1&&
            dist(v,u)<=6).length*3:0)+
          (balance.advantage>0?2:0)+(u.down?-3:0)+
          (plan?.assignments?.[u.id]?.task==="hold"?2.5:0);
      };
      return value(b)-value(a)||a.id.localeCompare(b.id);
    })[0]||null;
  }
  function chooseOrder(s,unit,legal,previewTarget,failed,plan=null) {
    const enemy=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    // During choose-order the engine intentionally disallows previewTarget;
    // choose likely firing ranges here, then confirm legal LOS in target phase.
    const visible=enemy.filter(u=>dist(u,unit)<23);
    const objectives=objectivePoint(s,unit.faction)||[];
    const holding=(s.objectives||[]).some(o=>o.state===unit.faction&&
      Number.isFinite(o.x)&&dist(unit,o)<3);
    const has=o=>legal.includes(o);
    const allies=s.units.filter(u=>u.faction===unit.faction&&u.soldiers>0);
    const balance=forceBalance(unit,allies,enemy);
    if(unit.pins>=2&&has("Rally"))return "Rally";
    if(unit.soldiers<=2&&balance.advantage<-3&&
      !visible.length&&has("Down"))return "Down";
    // A packed fixed weapon must establish itself before it can shoot.
    // The real coordinator's Fire order owns deployment and dice.
    const supportWeapon=unit.role==="support"||/mmg|mortar|atgun/i.test(unit.type||"");
    if(supportWeapon&&!unit.mmgDeployed&&unit.weapons?.mmg&&has("Fire")&&
       (visible.length||holding))return "Fire";
    if(supportWeapon&&unit.mmgDeployed&&
       (shouldHoldSupport(unit,s)||holding)){
      if(visible.length&&has("Fire")&&!failed.fire.has(unit.id))
        return "Fire";
      if(has("Ambush"))return "Ambush";
    }
    if(supportWeapon&&holding&&has("Ambush"))return "Ambush";
    if(visible.length&&has("Fire")&&!failed.fire.has(unit.id))
      return "Fire";
    if((holding||plan?.assignments?.[unit.id]?.task==="hold")&&
      has("Ambush"))return "Ambush";
    if(has("Advance")&&!failed.move.has(unit.id))return "Advance";
    if(has("Run")&&!failed.move.has(unit.id))return "Run";
    if(has("Ambush")&&enemy.some(u=>dist(u,unit)<22))return "Ambush";
    if(has("Down"))return "Down";
    return legal[0]||null;
  }
  function sectorScore(unit,enemies,facing){
    const targets=(enemies||[]).filter(e=>e.soldiers>0&&e.visible!==false);
    return targets.reduce((total,e)=>{
      const range=dist(unit,e);
      if(range>36||range<.2)return total;
      const bearing=(Math.atan2(e.y-unit.y,e.x-unit.x)*180/Math.PI+360)%360;
      const deviation=Math.abs(((bearing-facing+540)%360)-180);
      if(deviation>45+.001)return total;
      // Broad sectors protect several approaches; stable neutral tie breaks.
      return total+(1.4+Math.min(5,e.soldiers)*.28+
        (e.role==="officer"?.6:0))*
        Math.max(.2,1-range/44)*(1-deviation/160);
    },0);
  }
  function mmgRotation(unit,enemies){
    if(!unit?.mmgDeployed||!Number.isFinite(unit.mmgFacing))return 0;
    const current=sectorScore(unit,enemies,unit.mmgFacing);
    const left=sectorScore(unit,enemies,(unit.mmgFacing+315)%360);
    const right=sectorScore(unit,enemies,(unit.mmgFacing+45)%360);
    const gain=Math.max(left,right)-current;
    // At most one legal 45-degree turn. A hysteresis margin avoids the
    // aim left / aim right loop that previously ate successive AI actions.
    if(gain<=Math.max(.45,current*.18))return 0;
    return right>=left?45:-45;
  }
  function supportPositionScore(point,unit,s){
    const enemies=(s.units||[]).filter(e=>e.faction!==unit.faction&&
      e.soldiers>0&&e.visible!==false);
    const allies=(s.units||[]).filter(a=>a.faction===unit.faction&&
      a.id!==unit.id&&a.soldiers>0);
    const targets=enemies.filter(e=>dist(point,e)<=35);
    const lanes=targets.reduce((n,e)=>{
      const range=dist(point,e);
      return n+Math.max(0,1-Math.abs(range-17)/26)*2.4;
    },0);
    const cover=defensiveCover(point,s.terrain,enemies);
    const infantry=allies.some(a=>dist(a,point)<11)?2:0;
    const objective=(s.objectives||[]).some(o=>
      Number.isFinite(o.x)&&Number.isFinite(o.y)&&dist(point,o)<13)?3:0;
    const exposed=enemies.filter(e=>dist(point,e)<6).length;
    return lanes+cover*1.4+infantry+objective-exposed*5;
  }
  function shouldHoldSupport(unit,s){
    if(!unit||!unit.mmgDeployed)return false;
    const score=supportPositionScore(unit,unit,s);
    const threats=(s.units||[]).filter(e=>e.faction!==unit.faction&&
      e.soldiers>0&&e.visible!==false);
    return score>=3.2||threats.some(e=>dist(unit,e)<31);
  }
  function chooseTarget(s,unit,previewTarget) {
    const enemies=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    const evaluated=enemies.map(u=>({unit:u,shot:previewTarget(u.id)}))
      .filter(item=>item.shot?.legal);
    const value=({unit:u,shot})=>{
      const output=(shot.weapons||[]).reduce((n,g)=>
        n+(g.shots||0)*Math.max(.1,(7-(g.hitTarget||6))/6),0);
      const save=shot.cover?.saveTarget;
      const coverPenalty=save!=null?Math.max(.30,(save-1)/6):1;
      return output*coverPenalty*8-dist(unit,u)*.6+
        (u.pins||0)*1.5+(u.soldiers<=3?5:0)+(u.role==="officer"?5:0);
    };
    return evaluated.sort((a,b)=>value(b)-value(a)||
      a.unit.id.localeCompare(b.unit.id))[0]?.unit||null;
  }
  function defensiveCover(point,terrain=[],enemies=[]){
    let benefit=0;
    for(const entry of terrain||[]){
      if(!entry?.cover)continue;
      const x=Number(entry.x),y=Number(entry.y),
        w=Number(entry.width),h=Number(entry.height);
      if(![x,y,w,h].every(Number.isFinite))continue;
      const inside=point.x>=x&&point.x<=x+w&&
        point.y>=y&&point.y<=y+h;
      if(entry.movement!=="crossing"){
        if(inside)benefit=Math.max(benefit,entry.cover==="hard"?6:3);
        continue;
      }
      // Walls/hedges only help if the defender is near the obstacle
      // and a nearby opponent is on its far side.
      if(!enemies?.length)continue;
      const cx=x+w/2,cy=y+h/2;
      const horizontal=w>=h;
      const offset=horizontal?point.y-cy:point.x-cx;
      const along=horizontal?point.x:point.y;
      const start=horizontal?x:y,end=start+(horizontal?w:h);
      if(along<start-.6||along>end+.6||Math.abs(offset)>3.5)continue;
      if(enemies.some(enemy=>{
        const opposite=horizontal?enemy.y-cy:enemy.x-cx;
        return opposite*offset<0&&Math.abs(opposite)>.2;
      }))benefit=Math.max(benefit,entry.cover==="hard"?5:2.5);
    }
    return benefit;
  }
  function chooseMove(s,unit,previewMove,explain=false,plan=null) {
    const enemies=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    const assignment=plan?.assignments?.[unit.id]||null;
    const objective=nearest(unit,objectivePoint(s,unit.faction));
    const enemy=nearest(unit,enemies);
    const board=s.table||{width:72,height:48};
    const friendly=s.units.filter(u=>u.faction===unit.faction&&
      u.id!==unit.id&&u.soldiers>0);
    // Officers move toward pinned units to extend real 6-inch command support.
    // The legal preview decides where they may actually finish.
    const pinnedAlly=unit.role==="officer"?nearest(unit,friendly.filter(u=>
      u.pins>0&&!u.activated&&dist(u,unit)>5.5)):null;
    const target=pinnedAlly||assignment?.point||objective||enemy||
      {x:board.width/2,y:board.height/2};
    const supportWeapon=unit.role==="support"||/mmg|mortar|atgun/i.test(unit.type||"");
    const theta=Math.atan2(target.y-unit.y,target.x-unit.x);
    const options=[];
    for(const angle of [0,.32,-.32,.7,-.7,1.08,-1.08,1.6,-1.6,Math.PI]){
      for(const step of [5.5,4,2.5,1.2]){
        const point={x:Math.max(1,Math.min(board.width-1,unit.x+step*Math.cos(theta+angle))),
          y:Math.max(1,Math.min(board.height-1,unit.y+step*Math.sin(theta+angle)))};
        const preview=previewMove(point);
        if(!preview?.legal)continue;
        const endpoint=preview.path?.at(-1)||point;
        const progress=dist(unit,target)-dist(endpoint,target);
        const nearestEnemy=nearest(endpoint,enemies);
        const enemyDist=nearestEnemy?dist(endpoint,nearestEnemy):20;
        // Reward objectives and useful firing proximity, discourage exposed
        // suicidal charges and movement that makes no tactical progress.
        const vulnerable=(unit.pins||0)>=2||unit.soldiers<=2;
        const allies=s.units.filter(other=>other.faction===unit.faction&&
          other.id!==unit.id&&other.soldiers>0);
        const balance=forceBalance(endpoint,allies,enemies);
        const threat=enemyDist<3?(vulnerable?-17:-8):
          enemyDist<7?(vulnerable?-7:-2):0;
        const outnumbered=balance.advantage< -4?
          (vulnerable?-6:-3):0;
        const support=Math.max(0,Math.min(3,balance.advantage*.25));
        const objectiveRange=assignment?.point?
          dist(endpoint,assignment.point):objective?dist(endpoint,objective):Infinity;
        const objectiveHold=objectiveRange<2.7?4:0;
        const intentBenefit=assignment?.task==="hold"?
          -Math.max(0,dist(endpoint,unit)-2)*1.1:
          assignment?.task==="support"&&pinnedAlly?3:0;
        const coverBenefit=defensiveCover(endpoint,s.terrain,enemies)*
          ((unit.pins||0)>0||unit.soldiers<=3?1.9:1.15);
        const exposed=enemies.filter(e=>dist(e,endpoint)<18).length;
        const exposurePenalty=Math.min(6,exposed*1.1)*
          (coverBenefit>2?.36:1);
        // Legal previews remain authoritative for every candidate endpoint.
        const supportPenalty=supportWeapon?
          Math.max(0,step-3)*1.3+(enemyDist<5?4:0):0;
        const retreatPenalty=enemyDist<4&&unit.pins>=2?6:0;
        const commandBenefit=pinnedAlly&&dist(endpoint,pinnedAlly)<=6?
          8:0;
        const crowdPenalty=pinnedAlly&&dist(endpoint,pinnedAlly)<1.5?
          8:0;
        // An actual legal preview supplies all path costs. Never guess cover or LOS.
        const efficiency=Number.isFinite(preview.cost)?
          -Math.max(0,preview.cost-step)*.15:0;
        const laneBenefit=supportWeapon?
          supportPositionScore(endpoint,unit,s)-
          supportPositionScore(unit,unit,s)*.65:0;
        const score=progress*4+(objective?4:0)+objectiveHold+
          threat+outnumbered+support+efficiency-supportPenalty-retreatPenalty+
          commandBenefit-crowdPenalty+coverBenefit-exposurePenalty+
          intentBenefit+laneBenefit+
          (preview.shortened?-1.5:0)+Math.min(.5,step*.03);
        options.push({point:endpoint,score,progress,cover:coverBenefit,
          exposure:exposurePenalty,command:commandBenefit,
          objective:objectiveHold,support,threat});
      }
    }
    const ranked=options.sort((a,b)=>b.score-a.score||
      a.point.x-b.point.x||a.point.y-b.point.y);
    return explain?{
      point:ranked[0]?.point||null,candidates:ranked.slice(0,3).map(c=>({...c}))
    }:ranked[0]?.point||null;
  }
  window.Crossroads3DAITactics=Object.freeze({
    chooseUnit,chooseOrder,chooseTarget,chooseMove,forceBalance,mmgRotation,
    defensiveCover,makePlan,supportPositionScore,shouldHoldSupport,sectorScore
  });
})();