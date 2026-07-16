"use strict";

(() => {
  // Authored formation canvases only. Unit names and abbreviations belong to
  // unit types; visual kit choices belong to data/faction-kits.js.
  const formations = Object.freeze({
    officer: Object.freeze({
      width: 58,
      height: 54,
      slots: Object.freeze([
        Object.freeze([39, 36]),
        Object.freeze([63, 64])
      ])
    }),

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

  window.CROSSROADS_FORMATIONS = Object.freeze({ formations });
})();
