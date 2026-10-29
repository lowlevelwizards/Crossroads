"use strict";
/* German solo: uses the same command transaction as human actions.
   No hidden unit mutations, dice, or bespoke movement legality. */
(() => {
  function create(client,{delayMs=360}={}) {
    const tactical=window.Crossroads3DAITactics;
    let scheduled=false,acting=false,disposed=false;
    const failed={fire:new Set(),move:new Set()};
    let lastRound=null;
    const isAI=s=>s&&!s.battleEnded&&(
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
      if(s.phase==="choose-unit"){
        const candidate=tactical.chooseUnit(s,"red");
        if(candidate)await command("select",{id:candidate.id});
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