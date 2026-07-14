"use strict";

// Foundation 2B.1: tiny DOM access seam for gradual migration.
window.CrossroadsDOM = Object.freeze({
  byId(id) {
    const element = document.getElementById(id);
    if (!element) console.warn(`[CrossroadsDOM] Missing #${id}`);
    return element;
  },
  all(selector) {
    return [...document.querySelectorAll(selector)];
  }
});
