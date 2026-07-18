"use strict";

(() => {
  const RANDOM = window.CrossroadsSeededRandom;
  const POLYGON = window.CrossroadsPolygonGeometry;
  if (!RANDOM || !POLYGON) throw new Error("Generation dependencies must load before row-generator.js.");

  function generate(options = {}) {
    const points = options.points ?? [];
    const box = POLYGON.bounds(points);
    if (!box || points.length < 3) return [];
    const seed = Math.trunc(Number(options.seed) || 0);
    const spacing = Math.max(.4, Number(options.spacing) || 2.8);
    const rowSpacing = Math.max(.4, Number(options.rowSpacing) || spacing);
    const edgePadding = Math.max(0, Number(options.edgePadding) || 0);
    const angle = Number(options.rowAngle) || 0;
    const diagonal = Math.hypot(box.width, box.height) + spacing * 4;
    const center = { x:box.centerX, y:box.centerY };
    const result = [];
    const rows = Math.ceil(diagonal / rowSpacing);
    const columns = Math.ceil(diagonal / spacing);

    for (let row = -rows; row <= rows; row += 1) {
      for (let column = -columns; column <= columns; column += 1) {
        const local = { x:center.x + column * spacing, y:center.y + row * rowSpacing };
        const point = POLYGON.rotate(local, center, angle);
        if (!POLYGON.contains(points, point)) continue;
        if (POLYGON.distanceToEdge(points, point) < edgePadding) continue;
        result.push({
          id:`row-${row}:${column}`,
          x:point.x,
          y:point.y,
          row,
          column,
          random:RANDOM.unit(seed, row, column, 0)
        });
      }
    }
    return result.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  window.CrossroadsRowGenerator = Object.freeze({ generate });
})();
