"use strict";

(() => {
  const RANDOM = window.CrossroadsSeededRandom;
  const POLYGON = window.CrossroadsPolygonGeometry;
  if (!RANDOM || !POLYGON) throw new Error("Seeded random and polygon geometry must load before polygon-scatter.js.");

  function generate(options = {}) {
    const points = options.points ?? [];
    const bounds = POLYGON.bounds(points);
    if (!bounds || points.length < 3) return [];
    const seed = Math.trunc(Number(options.seed) || 0);
    const spacing = Math.max(.25, Number(options.spacing) || 2);
    const density = Math.max(0, Math.min(1.5, Number(options.density) || .7));
    const edgePadding = Math.max(0, Number(options.edgePadding) || 0);
    const jitter = Math.max(0, Math.min(.42, Number(options.jitter) || .28));
    const startX = Math.floor((bounds.x - spacing) / spacing);
    const endX = Math.ceil((bounds.maxX + spacing) / spacing);
    const startY = Math.floor((bounds.y - spacing) / spacing);
    const endY = Math.ceil((bounds.maxY + spacing) / spacing);
    const candidates = [];

    for (let cellY = startY; cellY <= endY; cellY += 1) {
      for (let cellX = startX; cellX <= endX; cellX += 1) {
        if (RANDOM.unit(seed, cellX, cellY, 0) > Math.min(1, density)) continue;
        const point = {
          x:(cellX + .5 + RANDOM.range(seed, cellX, cellY, 1, -jitter, jitter)) * spacing,
          y:(cellY + .5 + RANDOM.range(seed, cellX, cellY, 2, -jitter, jitter)) * spacing
        };
        if (!POLYGON.contains(points, point)) continue;
        if (POLYGON.distanceToEdge(points, point) < edgePadding) continue;
        candidates.push({
          id:`${cellX}:${cellY}`,
          cellX,
          cellY,
          x:point.x,
          y:point.y,
          random:RANDOM.unit(seed, cellX, cellY, 3)
        });
      }
    }

    // Keep a predictable minimum spacing without changing candidate identity.
    const accepted = [];
    const minimum = spacing * .58;
    for (const candidate of candidates.sort((a, b) => a.random - b.random || a.cellY - b.cellY || a.cellX - b.cellX)) {
      if (accepted.some(other => Math.hypot(candidate.x - other.x, candidate.y - other.y) < minimum)) continue;
      accepted.push(candidate);
    }
    return accepted.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  window.CrossroadsPolygonScatter = Object.freeze({ generate });
})();
