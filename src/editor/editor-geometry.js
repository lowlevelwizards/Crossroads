"use strict";

(() => {
  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function clonePoints(points) {
    return (points ?? []).map(point => ({ ...point, x:number(point.x), y:number(point.y) }));
  }

  function bounds(points, padding = 0) {
    const source = points ?? [];
    if (!source.length) return { x:0, y:0, width:0, height:0, centerX:0, centerY:0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of source) {
      minX = Math.min(minX, number(point.x));
      minY = Math.min(minY, number(point.y));
      maxX = Math.max(maxX, number(point.x));
      maxY = Math.max(maxY, number(point.y));
    }
    const pad = Math.max(0, number(padding));
    return {
      x:minX - pad,
      y:minY - pad,
      width:Math.max(0.01, maxX - minX + pad * 2),
      height:Math.max(0.01, maxY - minY + pad * 2),
      centerX:(minX + maxX) / 2,
      centerY:(minY + maxY) / 2
    };
  }

  function translate(points, dx, dy) {
    return clonePoints(points).map(point => ({ ...point, x:number(point.x) + number(dx), y:number(point.y) + number(dy) }));
  }

  function scaleToBounds(points, originalBounds, targetBounds) {
    const source = clonePoints(points);
    const originalWidth = Math.max(0.001, number(originalBounds.width, 1));
    const originalHeight = Math.max(0.001, number(originalBounds.height, 1));
    const targetWidth = Math.max(0.01, number(targetBounds.width, originalWidth));
    const targetHeight = Math.max(0.01, number(targetBounds.height, originalHeight));
    return source.map(point => ({
      ...point,
      x:number(targetBounds.x) + ((number(point.x) - number(originalBounds.x)) / originalWidth) * targetWidth,
      y:number(targetBounds.y) + ((number(point.y) - number(originalBounds.y)) / originalHeight) * targetHeight
    }));
  }

  function rotate(points, center, degrees) {
    const radians = number(degrees) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const cx = number(center.x);
    const cy = number(center.y);
    return clonePoints(points).map(point => {
      const dx = number(point.x) - cx;
      const dy = number(point.y) - cy;
      return {
        ...point,
        x:cx + dx * cosine - dy * sine,
        y:cy + dx * sine + dy * cosine
      };
    });
  }

  function polygonContains(point, polygon) {
    const x = number(point.x);
    const y = number(point.y);
    let inside = false;
    const source = polygon ?? [];
    for (let i = 0, j = source.length - 1; i < source.length; j = i, i += 1) {
      const xi = number(source[i].x);
      const yi = number(source[i].y);
      const xj = number(source[j].x);
      const yj = number(source[j].y);
      const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function cumulative(points) {
    const source = points ?? [];
    const distances = [0];
    for (let index = 1; index < source.length; index += 1) {
      distances.push(distances[index - 1] + Math.hypot(number(source[index].x) - number(source[index - 1].x), number(source[index].y) - number(source[index - 1].y)));
    }
    return distances;
  }

  function widthAtNormalizedDistance(definition, normalizedDistance, fallbackWidth) {
    const points = definition?.points ?? [];
    if (!points.length) return number(fallbackWidth, 1);
    const distances = cumulative(points);
    const total = distances[distances.length - 1] || 1;
    const target = Math.max(0, Math.min(1, number(normalizedDistance))) * total;
    let right = 1;
    while (right < distances.length && distances[right] < target) right += 1;
    right = Math.min(right, points.length - 1);
    const left = Math.max(0, right - 1);
    const span = distances[right] - distances[left];
    const t = span <= 1e-6 ? 0 : (target - distances[left]) / span;
    const a = number(points[left]?.width, fallbackWidth);
    const b = number(points[right]?.width, fallbackWidth);
    return a + (b - a) * t;
  }

  window.CrossroadsEditorGeometry = Object.freeze({
    number,
    clonePoints,
    bounds,
    translate,
    scaleToBounds,
    rotate,
    polygonContains,
    widthAtNormalizedDistance
  });
})();
