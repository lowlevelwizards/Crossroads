"use strict";

(() => {
  function create() {
    const state = { mode: "idle", shooterId: null, hoveredTargetId: null, confirmedTargetId: null };

    function syncBody() {
      document.body.classList.toggle("targeting-browsing", state.mode === "browsing");
      document.body.classList.toggle("targeting-confirmed", state.mode === "confirmed" || state.mode === "resolving");
    }

    function browse(shooterId) {
      state.mode = "browsing"; state.shooterId = shooterId ?? null; state.hoveredTargetId = null; state.confirmedTargetId = null; syncBody();
    }
    function hover(targetId) { if (state.mode === "browsing") state.hoveredTargetId = targetId ?? null; }
    function confirm(targetId) { state.mode = "confirmed"; state.hoveredTargetId = null; state.confirmedTargetId = targetId ?? null; syncBody(); }
    function resolve() { if (state.confirmedTargetId) { state.mode = "resolving"; syncBody(); } }
    function clear() { state.mode = "idle"; state.shooterId = null; state.hoveredTargetId = null; state.confirmedTargetId = null; syncBody(); }
    function snapshot() { return { ...state }; }

    return Object.freeze({ browse, hover, confirm, resolve, clear, snapshot });
  }
  window.CrossroadsTargetingPresentation = Object.freeze({ create });
})();
