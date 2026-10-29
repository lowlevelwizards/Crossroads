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
  window.Crossroads3DMovementIntent=Object.freeze({create});
})();
