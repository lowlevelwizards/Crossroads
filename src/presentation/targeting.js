"use strict";

(() => {
  function create() {
    let confirmedTargetId = null;

    function confirm(targetId) {
      confirmedTargetId = targetId ?? null;
      document.body.classList.toggle(
        "targeting-confirmed",
        Boolean(confirmedTargetId)
      );
    }

    function clear() {
      confirmedTargetId = null;
      document.body.classList.remove("targeting-confirmed");
    }

    function snapshot() {
      return { confirmedTargetId };
    }

    return Object.freeze({
      confirm,
      clear,
      snapshot
    });
  }

  window.CrossroadsTargetingPresentation = Object.freeze({ create });
})();
