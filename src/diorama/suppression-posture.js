"use strict";
// Pure, presentation-only morale postures. No simulated penalties, detection,
// order tests, damage, movement, morale changes or second set of Pins.
(() => {
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  function evaluate({pins=0,down=false,walking=false,firing=false,
    casualty=false,recentHit=0,recovery=0,officer=false}={}){
    const level=Math.min(3,Math.max(0,Math.floor(pins||0)));
    const shock=clamp(recentHit),rally=clamp(recovery);
    if(casualty)return Object.freeze({priority:"casualty",crouch:0,
      lean:0,headDuck:0,roll:0,readiness:0,gesture:0});
    if(down)return Object.freeze({priority:"down",crouch:.87,
      lean:.28,headDuck:.18,roll:0,readiness:0,gesture:0});
    const busy=walking||firing;
    const crouch=(busy?.035:.085)*level+shock*.075;
    const lean=(busy?.020:.065)*level+shock*.07;
    const duck=(busy?.018:.045)*level+shock*.08;
    return Object.freeze({
      priority:walking?"movement":firing?"firing":level?"pinned":"idle",
      crouch:clamp(crouch,0,busy?.2:.42),
      lean:clamp(lean,0,.28),headDuck:clamp(duck,0,.21),
      roll:shock*.06*(officer?-1:1),readiness:level?clamp(.65-level*.12):1,
      // Gestures use an existing arm control; officer never invents
      // a Rally effect or command-radius bonus.
      gesture:officer?rally*.92:0
    });
  }
  function transition(previous,desired,dt,{attack=.18,release=.43}={}){
    const d=clamp(dt,0,.15),keys=["crouch","lean","headDuck","roll","gesture"];
    const result={priority:desired.priority,readiness:desired.readiness};
    for(const key of keys){
      const a=Number(previous?.[key])||0,b=Number(desired[key])||0;
      const duration=b>a?attack:release;
      result[key]=a+(b-a)*Math.min(1,d/Math.max(.04,duration));
    }
    return Object.freeze(result);
  }
  window.Crossroads3DSuppressionPosture=Object.freeze({evaluate,transition});
})();