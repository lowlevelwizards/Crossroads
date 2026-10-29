"use strict";
// Deterministic selection of dice already rolled by the authoritative engine.
(() => {
  const normalize=x=>Number.isInteger(x)&&x>=1&&x<=6?x:null;
  function valuesFor(event,phase,limit=7){
    if(!event||!Number.isInteger(limit)||limit<1)return [];
    let rolls=[];
    if(event.type==="shooting"){
      if(phase==="hit-dice")rolls=(event.groups||[]).flatMap(g=>g.rolls||[]);
      if(phase==="damage-dice")rolls=event.damageRolls||[];
      if(phase==="save-dice")rolls=event.saveRolls||[];
    } else if(event.type==="assault"&&phase==="dice"){
      const round=(event.rounds||[])[0];
      rolls=[...(round?.attackerRolls||[]),...(round?.defenderRolls||[])];
    } else if(event.type==="order-test"&&phase==="dice"){
      rolls=event.dice||[];
    }
    return rolls.map(normalize).filter(n=>n!==null).slice(0,Math.min(limit,10));
  }
  function pips(value){
    const xy={1:[[0,0]],2:[[-1,-1],[1,1]],
      3:[[-1,-1],[0,0],[1,1]],
      4:[[-1,-1],[1,-1],[-1,1],[1,1]],
      5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
      6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
    return (xy[value]||[]).map(([x,y])=>({x,y}));
  }
  window.Crossroads3DTabletopDice=Object.freeze({valuesFor,pips});
})();
