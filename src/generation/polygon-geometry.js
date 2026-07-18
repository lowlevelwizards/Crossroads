"use strict";

(() => {
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bounds(points = []) {
    if (!points.length) return null;
    const xs = points.map(point => number(point.x));
    const ys = points.map(point => number(point.y));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x:minX, y:minY, width:maxX - minX, height:maxY - minY, maxX, maxY, centerX:(minX + maxX) / 2, centerY:(minY + maxY) / 2 };
  }

  function contains(points, point) {
    if (!Array.isArray(points) || points.length < 3) return false;
    const x = number(point?.x);
    const y = number(point?.y);
    let inside = false;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const a = points[index];
      const b = points[previous];
      const ax = number(a.x);
      const ay = number(a.y);
      const bx = number(b.x);
      const by = number(b.y);
      const intersects = (ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / ((by - ay) || Number.EPSILON) + ax;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToSegment(point, a, b) {
    const px = number(point?.x);
    const py = number(point?.y);
    const ax = number(a?.x);
    const ay = number(a?.y);
    const bx = number(b?.x);
    const by = number(b?.y);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function distanceToEdge(points, point) {
    if (!Array.isArray(points) || points.length < 2) return Infinity;
    let minimum = Infinity;
    for (let index = 0; index < points.length; index += 1) {
      minimum = Math.min(minimum, distanceToSegment(point, points[index], points[(index + 1) % points.length]));
    }
    return minimum;
  }

  function rotate(point, center, degrees) {
    const radians = number(degrees) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dx = number(point.x) - number(center.x);
    const dy = number(point.y) - number(center.y);
    return { x:number(center.x) + dx * cosine - dy * sine, y:number(center.y) + dx * sine + dy * cosine };
  }

  window.CrossroadsPolygonGeometry = Object.freeze({ number, bounds, contains, distanceToSegment, distanceToEdge, rotate });
})();
