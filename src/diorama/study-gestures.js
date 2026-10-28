"use strict";

// Small, browser-independent touch gesture geometry. Perspective / tabletop
// projection stays owned by the 3D camera, never by a separate game ruler.
(() => {
  function twoFingerGesture(previous, next) {
    if (previous?.length !== 2 || next?.length !== 2) return null;
    const [a,b] = previous, [c,d] = next;
    if (![a,b,c,d].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const oldDistance = Math.hypot(a.x - b.x, a.y - b.y);
    const newDistance = Math.hypot(c.x - d.x, c.y - d.y);
    return {
      previousCenter: {x:(a.x + b.x)/2, y:(a.y + b.y)/2},
      nextCenter: {x:(c.x + d.x)/2, y:(c.y + d.y)/2},
      zoomFactor: oldDistance > 8 && newDistance > 8
        ? Math.max(.5, Math.min(2, newDistance / oldDistance))
        : 1
    };
  }
  function targetShift(previousWorld, currentWorld) {
    if (!previousWorld || !currentWorld) return null;
    return { x: previousWorld.x-currentWorld.x, z: previousWorld.z-currentWorld.z };
  }
  window.CrossroadsDioramaGestures = Object.freeze({twoFingerGesture,targetShift});
})();
