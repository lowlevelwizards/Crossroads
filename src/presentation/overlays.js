"use strict";

(() => {
  function create({
    battlefield,
    battlefieldViewport,
    battlefieldScreenOverlay,
    targetReadout,
    tableWidth,
    tableHeight
  }) {
    const anchor = document.createElement("span");
    anchor.className = "screen-overlay-world-anchor";
    anchor.hidden = true;
    battlefield.appendChild(anchor);

    let current = null;

    function place() {
      if (!current || targetReadout.hidden) return;

      anchor.hidden = false;
      anchor.style.left = `${(current.point.x / tableWidth) * 100}%`;
      anchor.style.top = `${(current.point.y / tableHeight) * 100}%`;

      const viewportRect = battlefieldViewport.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();

      targetReadout.style.left = "0px";
      targetReadout.style.top = "0px";
      const cardRect = targetReadout.getBoundingClientRect();

      const anchorX =
        anchorRect.left + anchorRect.width / 2 - viewportRect.left;
      const anchorY =
        anchorRect.top + anchorRect.height / 2 - viewportRect.top;

      const gap = 18;
      const margin = 8;
      const roomRight = viewportRect.width - anchorX;
      const preferRight = roomRight >= cardRect.width + gap + margin;

      let x = preferRight
        ? anchorX + gap
        : anchorX - cardRect.width - gap;
      let y = anchorY - cardRect.height / 2;

      x = Math.max(
        margin,
        Math.min(viewportRect.width - cardRect.width - margin, x)
      );
      y = Math.max(
        margin,
        Math.min(viewportRect.height - cardRect.height - margin, y)
      );

      targetReadout.style.left = `${Math.round(x)}px`;
      targetReadout.style.top = `${Math.round(y)}px`;
    }

    function show(point, state, heading, lines) {
      if (!point) return;

      current = {
        point: { x: point.x, y: point.y },
        state,
        heading,
        lines: [...lines]
      };

      targetReadout.className = `target-readout ${state}`;
      targetReadout.innerHTML =
        `<strong>${heading}</strong>` +
        lines.map(line => `<div>${line}</div>`).join("");
      targetReadout.hidden = false;

      requestAnimationFrame(place);
    }

    function clear() {
      current = null;
      anchor.hidden = true;
      targetReadout.hidden = true;
      targetReadout.textContent = "";
      targetReadout.removeAttribute("style");
    }

    function refresh() {
      if (!current) return;
      requestAnimationFrame(place);
    }

    return Object.freeze({
      show,
      clear,
      refresh
    });
  }

  window.CrossroadsScreenOverlays = Object.freeze({ create });
})();
