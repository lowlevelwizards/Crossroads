"use strict";
// Keep 3D movement confirmation distinct from movement-ruler geometry.
// The first tap stages an exact rules-space destination; a nearby second tap
// consumes that same destination without needing to hit the exact same pixel.
(() => {
  function create({tolerance=.65,expiryMs=9000}={}) {
    let staged=null;
    function clear(){staged=null}
    function remember(point,now) {
      if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return false;
      staged={point:{x:point.x,y:point.y},time:now};
      return true;
    }
    function consumeIfMatch(point,now) {
      if(!staged)return null;
      const previous=staged;
      if(now-previous.time>expiryMs){staged=null;return null}
      if(!point||Math.hypot(previous.point.x-point.x,previous.point.y-point.y)>=tolerance)
        return null;
      staged=null;
      return {...previous.point};
    }
    return Object.freeze({clear,remember,consumeIfMatch,
      get pending(){return staged?{...staged.point}:null}});
  }

  // Pure, persistent cosmetic route preview. Only the coordinator's
  // previewMove may authorize a route; this does not alter game state.
  function createPlanner(){
    let destination=null,waypoint=null,analysis=null;
    const clone=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?
      {x:p.x,y:p.y}:null;
    function reset(){destination=null;waypoint=null;analysis=null}
    function stageDestination(p,result){
      const next=clone(p);
      if(!next||!result?.legal)return false;
      destination=next;analysis=result;return true;
    }
    function stageWaypoint(p,result){
      const next=clone(p);
      if(!destination||!next||!result?.legal)return false;
      waypoint=next;analysis=result;return true;
    }
    function removeWaypoint(result){
      if(!destination||!result?.legal)return false;
      waypoint=null;analysis=result;return true;
    }
    function snapshot(){
      return {destination:clone(destination),waypoint:clone(waypoint),
        legal:Boolean(destination&&analysis?.legal),
        cost:analysis?.cost??null,allowance:analysis?.allowance??null,
        shortened:Boolean(analysis?.shortened)};
    }
    function commit(){
      if(!destination||!analysis?.legal)return null;
      return {point:clone(destination),waypoint:clone(waypoint)};
    }
    return Object.freeze({reset,stageDestination,stageWaypoint,removeWaypoint,
      snapshot,commit});
  }
  window.Crossroads3DMovementIntent=Object.freeze({create,createPlanner});
})();
