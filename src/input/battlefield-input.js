"use strict";

(() => {
  function install({
    battlefield,
    cursorReadout,
    eventToTablePoint,
    handleBattlefieldClick,
    handleBattlefieldHover,
    clearGhostPreview
  }) {
    battlefield.addEventListener("click", handleBattlefieldClick);

    battlefield.addEventListener("mousemove", event => {
      const point = eventToTablePoint(event);
      cursorReadout.textContent =
        `Cursor: ${point.x.toFixed(1)}″, ${point.y.toFixed(1)}″`;
      handleBattlefieldHover(point);
    });

    battlefield.addEventListener("mouseleave", () => {
      cursorReadout.textContent = "Cursor: —";
      clearGhostPreview();
    });
  }

  window.CrossroadsBattlefieldInput = Object.freeze({ install });
})();
