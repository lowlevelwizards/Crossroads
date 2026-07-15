"use strict";

// Foundation 2D: active coordinator factory. The battle renderer now runs through one ordered pipeline.
window.CrossroadsRefresh = Object.freeze({
  create(steps = []) {
    const pipeline = [...steps];
    return function refresh(context = {}) {
      for (const step of pipeline) {
        if (typeof step === "function") step(context);
      }
    };
  }
});
