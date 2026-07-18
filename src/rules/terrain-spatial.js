"use strict";

(() => {
  const EPSILON = 1e-7;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function pointInPolygon(point, points = []) {
    if (!point || points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      const intersects = ((number(a.y) > number(point.y)) !== (number(b.y) > number(point.y))) &&
        (number(point.x) < (number(b.x) - number(a.x)) * (number(point.y) - number(a.y)) / ((number(b.y) - number(a.y)) || EPSILON) + number(a.x));
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function segmentIntersectionT(start, end, a, b) {
    const rx = number(end.x) - number(start.x);
    const ry = number(end.y) - number(start.y);
    const sx = number(b.x) - number(a.x);
    const sy = number(b.y) - number(a.y);
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < EPSILON) return null;
    const qpx = number(a.x) - number(start.x);
    const qpy = number(a.y) - number(start.y);
    const t = (qpx * sy - qpy * sx) / denominator;
    const u = (qpx * ry - qpy * rx) / denominator;
    if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
    return Math.max(0, Math.min(1, t));
  }

  function pointAt(start, end, t) {
    return { x:number(start.x) + (number(end.x) - number(start.x)) * t, y:number(start.y) + (number(end.y) - number(start.y)) * t };
  }

  function polygonClip(start, end, points = []) {
    if (points.length < 3) return null;
    const cuts = [0, 1];
    for (let index = 0; index < points.length; index += 1) {
      const t = segmentIntersectionT(start, end, points[index], points[(index + 1) % points.length]);
      if (t !== null) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    const unique = cuts.filter((value, index) => index === 0 || Math.abs(value - cuts[index - 1]) > EPSILON);
    const intervals = [];
    for (let index = 0; index < unique.length - 1; index += 1) {
      const a = unique[index];
      const b = unique[index + 1];
      if (b - a < EPSILON) continue;
      if (pointInPolygon(pointAt(start, end, (a + b) / 2), points)) intervals.push({ start:a, end:b });
    }
    if (!intervals.length) return null;
    const insideFraction = intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
    const tEnter = intervals[0].start;
    const tExit = intervals[intervals.length - 1].end;
    return Object.freeze({
      tEnter,
      tExit,
      insideFraction,
      entry:pointAt(start, end, tEnter),
      exit:pointAt(start, end, tExit),
      intervals:Object.freeze(intervals.map(interval => Object.freeze({ ...interval })))
    });
  }

  function segmentClip(start, end, instance, rectClip) {
    if (!instance) return null;
    if (instance.shape === "polygon" || Array.isArray(instance.points)) return polygonClip(start, end, instance.points ?? []);
    return typeof rectClip === "function" ? rectClip(start, end, instance) : null;
  }

  function pointInside(point, instance, rectPointInside) {
    if (!instance) return false;
    if (instance.shape === "polygon" || Array.isArray(instance.points)) return pointInPolygon(point, instance.points ?? []);
    return typeof rectPointInside === "function" ? rectPointInside(point, instance) : false;
  }

  function distanceInside(start, end, instance, rectClip) {
    const clip = segmentClip(start, end, instance, rectClip);
    if (!clip) return 0;
    return Math.hypot(number(end.x) - number(start.x), number(end.y) - number(start.y)) * number(clip.insideFraction, number(clip.tExit) - number(clip.tEnter));
  }

  window.CrossroadsTerrainSpatial = Object.freeze({ pointInPolygon, polygonClip, segmentClip, pointInside, distanceInside });
})();
