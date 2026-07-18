"use strict";

(() => {
  function active(state) {
    if (state?.drawingPath) return "draw-linear";
    if (state?.drawingPatch) return "draw-patch";
    if (state?.pan) return "pan";
    return "select";
  }

  function beginPath(state, payload) {
    state.drawingPatch = null;
    state.drawingPath = payload;
    state.drawingCursor = null;
    return state.drawingPath;
  }

  function beginPatch(state, payload) {
    state.drawingPath = null;
    state.drawingPatch = payload;
    state.drawingCursor = null;
    return state.drawingPatch;
  }

  function cancelDrawing(state) {
    state.drawingPath = null;
    state.drawingPatch = null;
    state.drawingCursor = null;
  }

  window.CrossroadsEditorTools = Object.freeze({ active, beginPath, beginPatch, cancelDrawing });
})();
