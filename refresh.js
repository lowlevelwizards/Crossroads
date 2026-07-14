"use strict";

// Foundation 2B.1: coordinator factory. Existing render calls remain untouched.
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
