"use strict";
/* Solo AI: handles battle and scenario-specific deployment via legal commands.
   No hidden unit mutations, dice, or bespoke movement legality. */
(() => {
  function create(client,{delayMs=360}={}) {
    const tactical=window.Crossroads3DAITactics;
    let scheduled=false,acting=false,disposed=false;
    const failed={fire:new Set(),move:new Set()};
    let lastRound=null;
    const isAI=s=>s&&!s.battleEnded&&(
      (s.phase==="deployment"&&s.deploymentFaction==="red")||
      (s.faction==="red"&&["choose-unit","choose-order","plan-movement",
        "choose-target","choose-assault-target"].includes(s.phase))||
      (s.phase==="ambush-reaction"&&s.units?.some(u=>
        u.id===s.reaction?.ambusherId&&u.faction==="red")));
    async function command(name,payload={}) {
      const response=await client.send(name,payload);
      return response?.ok!==false;
    }
    async function act(s) {
      if(s.round!==lastRound){
        lastRound=s.round;failed.fire.clear();failed.move.clear();
      }
      if(s.phase==="ambush-reaction"){await command("reaction-fire");return}
      if(s.phase==="deployment"){
        if(s.deployment?.valid){await command("confirm-deployment");return}
        const zone=s.deployment?.zones?.red;
        const friendly=(s.units||[]).filter(u=>u.faction==="red"&&u.soldiers>0);
        // Revalidate every placement via the 2D coordinator. The planner
        // never bypasses deployment zones or model-base separation.
        for(const unit of friendly){
          const within=zone&&unit.x>=zone.xMin&&unit.x<=zone.xMax&&
            unit.y>=zone.yMin&&unit.y<=zone.yMax;
          if(within&&!s.deployment?.selectedId)continue;
          if(client.snapshot?.deployment?.selectedId!==unit.id)
            await command("deploy-select",{id:unit.id});
          const centerY=(zone.yMin+zone.yMax)/2;
          for(const yOffset of [0,-9,9,-15,15,-20,20]){
            const point={x:(zone.xMin+zone.xMax)/2,
              y:Math.max(zone.yMin+1,Math.min(zone.yMax-1,
                centerY+yOffset+(friendly.indexOf(unit)-friendly.length/2)*2.4))};
            await command("deploy-place",{point});
            const after=client.snapshot?.units?.find(u=>u.id===unit.id);
            if(after&&Math.hypot(after.x-point.x,after.y-point.y)<.15)break;
          }
          return;
        }
        // Even if every unit starts inside its zone, placement can be
        // invalid because of separation or terrain. Try legal positions.
        const unit=friendly.find(u=>u.id===s.deployment?.selectedId)||friendly[0];
        if(unit&&zone){
          if(client.snapshot?.deployment?.selectedId!==unit.id)
            await command("deploy-select",{id:unit.id});
          for(let i=0;i<18;i++){
            const point={x:zone.xMin+2+(i%3)*3.5,
              y:zone.yMin+2+Math.floor(i/3)*5.3};
            if(point.x>zone.xMax-1||point.y>zone.yMax-1)continue;
            await command("deploy-place",{point});
            if(client.snapshot?.deployment?.valid)break;
          }
        }
        return;
      }
      if(s.phase==="choose-unit"){
        const candidate=tactical.chooseUnit(s,"red");
        if(candidate)await command("select",{id:candidate.id});
        else if(s.snap)await command("end-snap");
        return;
      }
      const unit=s.units.find(u=>u.id===s.selectedUnitId&&u.faction==="red");
      if(!unit)return;
      if(s.phase==="choose-order"){
        const legal=(s.orders||[]).filter(o=>o.available).map(o=>o.order);
        const selected=tactical.chooseOrder(s,unit,legal,id=>client.previewTarget(id),failed);
        if(selected)await command("order",{order:selected});
      } else if(s.phase==="plan-movement"){
        const point=tactical.chooseMove(s,unit,p=>client.previewMove(p));
        if(point&&await command("move",{point}))return;
        failed.move.add(unit.id);
        await command("cancel");
      } else if(s.phase==="choose-target"){
        const target=tactical.chooseTarget(s,unit,id=>client.previewTarget(id));
        if(target&&await command("target",{id:target.id}))return;
        if(s.chosenOrder==="Advance")await command("finish-advance");
        else{failed.fire.add(unit.id);await command("cancel")}
      } else if(s.phase==="choose-assault-target"){
        const target=tactical.chooseTarget(s,unit,id=>client.previewTarget(id));
        if(target&&await command("target",{id:target.id}))return;
        await command("cancel");
      }
    }
    function observe(s){
      if(disposed||scheduled||acting||!isAI(s))return;
      scheduled=true;
      setTimeout(async()=>{
        scheduled=false;
        if(disposed||acting||!isAI(client.snapshot))return;
        acting=true;
        try{await act(client.snapshot)}catch(error){console.warn("Crossroads solo",error)}
        finally{acting=false;
          if(!disposed)setTimeout(()=>observe(client.snapshot),180);
        }
      },delayMs);
    }
    return Object.freeze({observe,dispose(){disposed=true}});
  }
  window.Crossroads3DAIOpponent=Object.freeze({create});
})();