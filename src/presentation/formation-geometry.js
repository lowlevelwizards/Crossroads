"use strict";

(() => {
  const HOTFIX_STYLE_ID = "crossroads-nameplate-hotfix-3nf4";

  function installNameplateHotfix() {
    if (document.getElementById(HOTFIX_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = HOTFIX_STYLE_ID;
    style.textContent = `
/* ==========================================================================\n   INFANTRY CORE 3N-F.4 — ISOLATED NAMEPLATE HOTFIX\n   The shared nameplate is a compact overlay, never a generic card or button.\n   ========================================================================== */

#battlefield .unit-label {
  all: unset !important;
  position: absolute !important;
  left: 50% !important;
  top: var(--unit-label-offset, 48px) !important;
  right: auto !important;
  bottom: auto !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  width: auto !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 150px !important;
  padding: 4px 8px !important;
  margin: 0 !important;
  transform: translateX(-50%) !important;
  box-sizing: border-box !important;
  border: 1px solid rgba(91, 80, 67, .42) !important;
  border-radius: 7px !important;
  background: rgba(246, 240, 227, .96) !important;
  box-shadow: 0 3px 0 rgba(70, 62, 49, .18) !important;
  color: #2d2b27 !important;
  font: 900 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  letter-spacing: 0 !important;
  text-align: center !important;
  text-transform: none !important;
  white-space: nowrap !important;
  overflow: visible !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  pointer-events: auto !important;
  flex: 0 0 auto !important;
  place-self: auto !important;
  contain: none !important;
}

#battlefield .unit-label > * {
  position: static !important;
  inset: auto !important;
  float: none !important;
  flex: 0 0 auto !important;
  align-self: center !important;
  width: auto !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  transform: none !important;
  box-sizing: border-box !important;
}

#battlefield .unit-label-name {
  display: block !important;
  max-width: 88px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: inherit !important;
  font: inherit !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

#battlefield .quality-nameplate-stripes {
  display: inline-grid !important;
  gap: 1px !important;
  width: 10px !important;
  flex-basis: 10px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

#battlefield .quality-nameplate-stripes i {
  display: block !important;
  width: 10px !important;
  height: 3px !important;
  min-width: 10px !important;
  min-height: 3px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid rgba(63, 55, 43, .68) !important;
  border-radius: 3px !important;
  background: #6f9a63 !important;
  box-shadow: none !important;
}

#battlefield .quality-nameplate-stripes.quality-regular i {
  background: #d2b54f !important;
}

#battlefield .quality-nameplate-stripes.quality-veteran i {
  background: #c9823d !important;
}

#battlefield .unit-label-stats {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: inherit !important;
  font: 900 .82em/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
}

#battlefield .nameplate-order {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 3px !important;
  width: auto !important;
  height: auto !important;
  min-width: 20px !important;
  min-height: 18px !important;
  padding: 2px 5px !important;
  border: 1px solid #6a6254 !important;
  border-radius: 5px !important;
  background: #eee6d6 !important;
  box-shadow: 1px 2px 0 rgba(60, 53, 43, .20) !important;
  color: inherit !important;
  font: 900 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  white-space: nowrap !important;
}

#battlefield .unit-label-medium .nameplate-order span {
  display: none !important;
}

#battlefield .unit-label::before,
#battlefield .unit-label::after,
#battlefield .unit-label > *::before,
#battlefield .unit-label > *::after {
  content: none !important;
  display: none !important;
}

#buildingOccupancyBadge.building-occupancy-nameplate {
  all: unset !important;
  position: absolute !important;
  left: 50% !important;
  top: -15px !important;
  z-index: 28 !important;
  display: block !important;
  width: auto !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: calc(100% - 12px) !important;
  padding: 0 !important;
  margin: 0 !important;
  transform: translateX(-50%) !important;
  overflow: visible !important;
  cursor: pointer !important;
  appearance: none !important;
  -webkit-appearance: none !important;
}

#buildingOccupancyBadge.building-occupancy-nameplate[hidden] {
  display: none !important;
}

#buildingOccupancyBadge .unit-label {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  transform: none !important;
}

@media (max-width: 899px) {
  #battlefield .unit-label {
    max-width: 138px !important;
    padding: 4px 7px !important;
    font-size: 12px !important;
  }

  #battlefield .unit-label-name {
    max-width: 78px !important;
  }
}
`;
    document.head.appendChild(style);
  }

  installNameplateHotfix();

  function screenDeltaBetweenRects(startRect, endRect) {
    return { x: startRect.left - endRect.left, y: startRect.top - endRect.top };
  }
  window.CrossroadsFormationGeometry = Object.freeze({ screenDeltaBetweenRects });
})();
