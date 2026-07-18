"use strict";

(() => {
  const RANDOM = window.CrossroadsSeededRandom;
  const SCATTER = window.CrossroadsPolygonScatter;
  const ROWS = window.CrossroadsRowGenerator;
  if (!RANDOM || !SCATTER || !ROWS) throw new Error("Generation modules must load before woodland-generator.js.");

  const PRESETS = Object.freeze(["balanced", "broad", "tall", "left", "right"]);

  function decorate(candidates, generator, styleId) {
    const seed = Math.trunc(Number(generator.seed) || 0);
    const scaleVariation = Math.max(0, Number(generator.scaleVariation) || 0);
    const rotationVariation = Math.max(0, Number(generator.rotationVariation) || 0);
    const baseScale = styleId === "woods_dense" ? .9 : styleId === "orchard" ? .82 : 1;
    return candidates.map(candidate => ({
      id:candidate.id,
      x:candidate.x,
      y:candidate.y,
      scale:baseScale * (1 + RANDOM.range(seed, candidate.cellX ?? candidate.row, candidate.cellY ?? candidate.column, 10, -scaleVariation, scaleVariation)),
      rotation:styleId === "orchard" ? 0 : RANDOM.range(seed, candidate.cellX, candidate.cellY, 11, -rotationVariation, rotationVariation),
      preset:styleId === "orchard" ? "balanced" : PRESETS[RANDOM.integer(seed, candidate.cellX, candidate.cellY, 12, 0, PRESETS.length)],
      variant:RANDOM.integer(seed, candidate.cellX ?? candidate.row, candidate.cellY ?? candidate.column, 13, 0, 3)
    }));
  }

  function generate(patch) {
    const generator = patch?.generator ?? {};
    const styleId = patch?.styleId || "woods";
    const options = {
      points:patch?.points ?? [],
      seed:generator.seed,
      density:generator.density,
      spacing:generator.spacing,
      edgePadding:generator.edgePadding
    };
    const candidates = styleId === "orchard"
      ? ROWS.generate({ ...options, rowSpacing:generator.rowSpacing, rowAngle:generator.rowAngle })
      : SCATTER.generate(options);
    return decorate(candidates, generator, styleId);
  }

  function isWoodland(styleId) {
    return styleId === "woods" || styleId === "woods_dense" || styleId === "orchard";
  }

  window.CrossroadsWoodlandGenerator = Object.freeze({ PRESETS, generate, isWoodland });
})();
