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
  function chooseUnit(s,faction) {
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
          (balance.advantage>0?2:0)+(u.down?-3:0);
      };
      return value(b)-value(a)||a.id.localeCompare(b.id);
    })[0]||null;
  }
  function chooseOrder(s,unit,legal,previewTarget,failed) {
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
    if(supportWeapon&&holding&&has("Ambush"))return "Ambush";
    if(visible.length&&has("Fire")&&!failed.fire.has(unit.id))
      return "Fire";
    if(holding&&has("Ambush"))return "Ambush";
    if(has("Advance")&&!failed.move.has(unit.id))return "Advance";
    if(has("Run")&&!failed.move.has(unit.id))return "Run";
    if(has("Ambush")&&enemy.some(u=>dist(u,unit)<22))return "Ambush";
    if(has("Down"))return "Down";
    return legal[0]||null;
  }
  function mmgRotation(unit,enemies){
    if(!unit?.mmgDeployed||!Number.isFinite(unit.mmgFacing))return 0;
    const candidates=(enemies||[]).filter(u=>u.soldiers>0&&dist(u,unit)<36);
    const nearestTarget=nearest(unit,candidates);
    if(!nearestTarget)return 0;
    const bearing=((Math.atan2(nearestTarget.y-unit.y,
      nearestTarget.x-unit.x)*180/Math.PI)%360+360)%360;
    const difference=((bearing-unit.mmgFacing+540)%360)-180;
    // Rotate only when no longer inside the engine's 90-degree sector.
    if(Math.abs(difference)<=44)return 0;
    return difference>0?45:-45;
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
  function chooseMove(s,unit,previewMove) {
    const enemies=s.units.filter(u=>u.faction!==unit.faction&&u.soldiers>0);
    const objective=nearest(unit,objectivePoint(s,unit.faction));
    const enemy=nearest(unit,enemies);
    const board=s.table||{width:72,height:48};
    const friendly=s.units.filter(u=>u.faction===unit.faction&&
      u.id!==unit.id&&u.soldiers>0);
    // Officers move toward pinned units to extend real 6-inch command support.
    // The legal preview decides where they may actually finish.
    const pinnedAlly=unit.role==="officer"?nearest(unit,friendly.filter(u=>
      u.pins>0&&!u.activated&&dist(u,unit)>5.5)):null;
    const target=pinnedAlly||objective||enemy||{x:board.width/2,y:board.height/2};
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
        const objectiveRange=objective?dist(endpoint,objective):Infinity;
        const objectiveHold=objectiveRange<2.7?4:0;
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
        const score=progress*4+(objective?4:0)+objectiveHold+
          threat+outnumbered+support+efficiency-supportPenalty-retreatPenalty+
          commandBenefit-crowdPenalty+coverBenefit-exposurePenalty+
          (preview.shortened?-1.5:0)+Math.min(.5,step*.03);
        options.push({point:endpoint,score});
      }
    }
    return options.sort((a,b)=>b.score-a.score)[0]?.point||null;
  }
  window.Crossroads3DAITactics=Object.freeze({
    chooseUnit,chooseOrder,chooseTarget,chooseMove,forceBalance,mmgRotation,
    defensiveCover
  });
})();