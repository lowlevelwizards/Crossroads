"use strict";

(() => {
  const MODES = Object.freeze({
    SELECT:"select",
    PAN:"pan",
    PLACE:"place",
    DRAW_LINEAR:"draw-linear",
    DRAW_PATCH:"draw-patch",
    EDIT_POINTS:"edit-points",
    SCALE:"scale"
  });

  function mode(state) {
    if (state?.placement) return MODES.PLACE;
    if (state?.drawingPath) return MODES.DRAW_LINEAR;
    if (state?.drawingPatch) return MODES.DRAW_PATCH;
    if (state?.scaleSession) return MODES.SCALE;
    if (state?.pointEdit) return MODES.EDIT_POINTS;
    if (state?.pan) return MODES.PAN;
    return MODES.SELECT;
  }

  function clearTransient(state, options = {}) {
    if (!state) return;
    state.drag = null;
    state.marquee = null;
    state.pan = null;
    state.scaleSession = null;
    if (options.keepPointEdit !== true) state.pointEdit = null;
    if (options.keepPlacement !== true) state.placement = null;
  }

  function beginPath(state, payload) {
    clearTransient(state);
    state.drawingPatch = null;
    state.drawingPath = payload;
    state.drawingCursor = null;
    return state.drawingPath;
  }

  function beginPatch(state, payload) {
    clearTransient(state);
    state.drawingPath = null;
    state.drawingPatch = payload;
    state.drawingCursor = null;
    return state.drawingPatch;
  }

  function cancelDrawing(state) {
    if (!state) return;
    state.drawingPath = null;
    state.drawingPatch = null;
    state.drawingCursor = null;
  }

  function beginPlacement(state, payload) {
    clearTransient(state);
    cancelDrawing(state);
    state.placement = {
      ...payload,
      point:null,
      rotation:Number(payload?.rotation) || 0,
      scale:Math.max(.1, Number(payload?.scale) || 1)
    };
    return state.placement;
  }

  function cancelPlacement(state) {
    if (state) state.placement = null;
  }

  function beginPointEdit(state, selection) {
    if (!state || !selection) return null;
    state.pointEdit = {
      kind:selection.kind,
      id:selection.id,
      faction:selection.faction,
      zoneId:selection.zoneId
    };
    return state.pointEdit;
  }

  function leavePointEdit(state) {
    if (state) state.pointEdit = null;
  }

  function isPointEditing(state, selection) {
    const active = state?.pointEdit;
    if (!active || !selection) return false;
    return active.kind === selection.kind &&
      String(active.id ?? "") === String(selection.id ?? "") &&
      String(active.faction ?? "") === String(selection.faction ?? "") &&
      String(active.zoneId ?? "") === String(selection.zoneId ?? "");
  }

  function nudgeDistance({ snap = true, shift = false, alt = false } = {}) {
    if (alt) return .05;
    if (shift) return 1;
    return snap ? .25 : .1;
  }

  window.CrossroadsEditorTools = Object.freeze({
    MODES,
    mode,
    clearTransient,
    beginPath,
    beginPatch,
    cancelDrawing,
    beginPlacement,
    cancelPlacement,
    beginPointEdit,
    leavePointEdit,
    isPointEditing,
    nudgeDistance
  });
})();
