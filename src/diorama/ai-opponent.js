"use strict";
(() => {
  // Opt-in ?solo=1, Germany only, all actions through legal game commands.
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function create(client){
    let scheduled=false,acting=false;
    const fireFailed=new Set(),moveFailed=new Set();
    function enemyOf(u,s){return s.units.filter(x=>x.faction!==u.faction&&x.soldiers>0)
      .sort((a,b)=>dist(u,a)-dist(u,b))[0]}
    function valid(s){return s&&!s.battleEnded&&(
      s.faction==="red"&&["choose-unit","choose-order","plan-movement","choose-target"].includes(s.phase)||
      s.phase==="ambush-reaction"&&s.units.some(u=>u.id===s.reaction?.ambusherId&&u.faction==="red"))}
    function observe(s){
      if(scheduled||acting||!valid(s))return;
      scheduled=true;
      setTimeout(async()=>{
        scheduled=false;if(acting||!valid(client.snapshot))return;
        acting=true;
        try{await move(client.snapshot)}catch(e){console.warn("Solo turn:",e)}
        finally{acting=false;setTimeout(()=>observe(client.snapshot),350)}
      },480);
    }
    async function move(s){
      if(s.phase==="ambush-reaction"){await client.send("reaction-fire");return}
      const allies=s.units.filter(u=>u.faction==="red"&&u.soldiers>0);
      if(s.phase==="choose-unit"){
        const ready=allies.filter(u=>!u.activated).sort((a,b)=>
          dist(a,{x:36,y:24})-dist(b,{x:36,y:24}));
        if(ready[0])await client.send("select",{id:ready[0].id});
        return;
      }
      const u=allies.find(u=>u.id===s.selectedUnitId);if(!u)return;
      const enemy=enemyOf(u,s);
      if(s.phase==="choose-order"){
        const legal=new Set(s.orders.filter(o=>o.available).map(o=>o.order));
        let order=u.pins>=2&&legal.has("Rally")?"Rally":
          enemy&&dist(u,enemy)<22&&!fireFailed.has(u.id)&&legal.has("Fire")?"Fire":
          !moveFailed.has(u.id)&&legal.has("Advance")?"Advance":
          legal.has("Down")?"Down":[...legal][0];
        if(order)await client.send("order",{order});
      }else if(s.phase==="plan-movement"){
        const target=enemy||{x:36,y:24};
        const bearing=Math.atan2(target.y-u.y,target.x-u.x);
        for(const angle of [0,.45,-.45,1,-1,2.1]){
          for(const step of [5,3,1.5]){
            const point={x:Math.max(1,Math.min(71,u.x+step*Math.cos(bearing+angle))),
              y:Math.max(1,Math.min(47,u.y+step*Math.sin(bearing+angle)))};
            if(client.previewMove(point)?.legal){await client.send("move",{point});return}
          }
        }
        moveFailed.add(u.id);await client.send("cancel");
      }else if(s.phase==="choose-target"){
        const legal=s.units.filter(v=>v.faction!=="red"&&v.soldiers>0)
          .filter(v=>client.previewTarget(v.id)?.legal)
          .sort((a,b)=>dist(u,a)-dist(u,b));
        if(legal[0])await client.send("target",{id:legal[0].id});
        else if(s.chosenOrder==="Advance")await client.send("finish-advance");
        else{fireFailed.add(u.id);await client.send("cancel")}
      }
    }
    return Object.freeze({observe});
  }
  window.Crossroads3DAIOpponent=Object.freeze({create});
})();