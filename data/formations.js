"use strict";

(() => {
  // Authored local-space formation slots. Percentages are relative to the
  // formation canvas and preserve unit identity across zoom levels.
  const formations = Object.freeze({
    officer: Object.freeze([
      Object.freeze([34, 40]),
      Object.freeze([66, 60])
    ]),
    line: Object.freeze([
      Object.freeze([18, 35]),
      Object.freeze([43, 24]),
      Object.freeze([72, 34]),
      Object.freeze([28, 69]),
      Object.freeze([56, 61]),
      Object.freeze([82, 74])
    ]),
    assault: Object.freeze([
      Object.freeze([30, 24]),
      Object.freeze([58, 31]),
      Object.freeze([77, 50]),
      Object.freeze([56, 73]),
      Object.freeze([27, 66]),
      Object.freeze([16, 47])
    ]),
    supportPacked: Object.freeze([
      Object.freeze([28, 38]),
      Object.freeze([55, 27]),
      Object.freeze([74, 66])
    ])
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
