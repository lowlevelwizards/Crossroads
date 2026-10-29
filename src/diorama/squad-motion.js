"use strict";
// Cosmetic movement tracks: never change a unit's authoritative game coordinates.
(() => {
  function createTracks() {
    const tracks=new Map();
    return Object.freeze({
      get(id){return tracks.get(id)},
      set(id,track){tracks.set(id,track);return track},
      delete(id){return tracks.delete(id)},
      clear(){tracks.clear()},
      get size(){return tracks.size},
      [Symbol.iterator](){return tracks[Symbol.iterator]()}
    });
  }
  function lateralOffset(unitIndex,soldierIndex,progress,distance) {
    if(progress<=0||progress>=1||distance<=0)return 0;
    const seed=Math.sin((unitIndex*11+soldierIndex*7+3)*1.73);
    return Math.sin(Math.PI*progress)*Math.sin(progress*2*Math.PI+seed)*
      Math.min(.06,distance*.01);
  }
  function movementFinished(track) {
    return track.phase==="travel"&&track.elapsed>=track.finishTime;
  }
  window.Crossroads3DSquadMotion=Object.freeze({createTracks,lateralOffset,movementFinished});
})();
