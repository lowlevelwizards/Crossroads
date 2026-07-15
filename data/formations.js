"use strict";

(() => {
  // Clean, authored formation canvases. Width and height are presentation
  // metadata; slots remain percentages inside that canvas.
  const formations = Object.freeze({
    officer: Object.freeze({
      width: 58,
      height: 54,
      slots: Object.freeze([
        Object.freeze([39, 36]),
        Object.freeze([63, 64])
      ])
    }),

    // Broad horizontal zig-zag: front, rear, front, rear, front, rear.
    line: Object.freeze({
      width: 104,
      height: 64,
      slots: Object.freeze([
        Object.freeze([12, 34]),
        Object.freeze([28, 68]),
        Object.freeze([44, 34]),
        Object.freeze([60, 68]),
        Object.freeze([76, 34]),
        Object.freeze([92, 68])
      ])
    }),

    // Clear three-row wedge with generous separation.
    assault: Object.freeze({
      width: 92,
      height: 80,
      slots: Object.freeze([
        Object.freeze([50, 14]),
        Object.freeze([31, 43]),
        Object.freeze([69, 43]),
        Object.freeze([15, 78]),
        Object.freeze([50, 78]),
        Object.freeze([85, 78])
      ])
    }),

    // Gun carrier at the point; assistants behind left and right.
    supportPacked: Object.freeze({
      width: 76,
      height: 70,
      slots: Object.freeze([
        Object.freeze([50, 18]),
        Object.freeze([24, 70]),
        Object.freeze([76, 70])
      ])
    }),

    supportDeployed: Object.freeze({
      width: 82,
      height: 74,
      slots: Object.freeze([
        Object.freeze([50, 68]),
        Object.freeze([22, 42]),
        Object.freeze([78, 42])
      ])
    })
  });

  const abbreviations = Object.freeze({
    officer: "HQ",
    line: "RIF",
    assault: "SMG",
    support: "MMG"
  });

  window.CROSSROADS_FORMATIONS = Object.freeze({
    formations,
    abbreviations
  });
})();
