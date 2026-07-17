"use strict";

(() => {
  const EPSILON = 1e-6;

  function point(value) {
    return { x:Number(value?.x) || 0, y:Number(value?.y) || 0 };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function lerp(a, b, t) {
    return { x:a.x + (b.x - a.x) * t, y:a.y + (b.y - a.y) * t };
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x:0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
      y:0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
    };
  }

  function smoothPoints(points, smoothing = 0, subdivisions = 8) {
    const source = (points ?? []).map(point);
    if (source.length < 3 || smoothing <= 0) return source;
    const result = [source[0]];
    for (let index = 0; index < source.length - 1; index += 1) {
      const p0 = source[Math.max(0, index - 1)];
      const p1 = source[index];
      const p2 = source[index + 1];
      const p3 = source[Math.min(source.length - 1, index + 2)];
      for (let step = 1; step <= subdivisions; step += 1) {
        const t = step / subdivisions;
        const curve = catmullRom(p0, p1, p2, p3, t);
        const straight = lerp(p1, p2, t);
        result.push(lerp(straight, curve, Math.min(1, Math.max(0, smoothing))));
      }
    }
    return result;
  }

  function cumulative(points) {
    const distances = [0];
    for (let index = 1; index < points.length; index += 1) {
      distances.push(distances[index - 1] + distance(points[index - 1], points[index]));
    }
    return distances;
  }

  function createPath(definition) {
    const points = smoothPoints(definition?.points, Number(definition?.smoothing) || 0);
    if (points.length < 2) throw new Error(`Linear terrain ${definition?.id ?? "path"} requires at least two points.`);
    const distances = cumulative(points);
    return Object.freeze({
      id:String(definition.id),
      points:Object.freeze(points.map(item => Object.freeze(item))),
      distances:Object.freeze(distances),
      length:distances[distances.length - 1]
    });
  }

  function sampleAt(path, targetDistance) {
    const target = Math.max(0, Math.min(path.length, Number(targetDistance) || 0));
    let index = 1;
    while (index < path.distances.length && path.distances[index] < target) index += 1;
    const right = Math.min(index, path.points.length - 1);
    const left = Math.max(0, right - 1);
    const span = path.distances[right] - path.distances[left];
    const t = span <= EPSILON ? 0 : (target - path.distances[left]) / span;
    const position = lerp(path.points[left], path.points[right], t);
    const dx = path.points[right].x - path.points[left].x;
    const dy = path.points[right].y - path.points[left].y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const tangent = { x:dx / magnitude, y:dy / magnitude };
    return { ...position, distance:target, tangent, normal:{ x:-tangent.y, y:tangent.x } };
  }

  function samplePath(path, spacing = 1) {
    const step = Math.max(0.1, Number(spacing) || 1);
    const result = [];
    for (let distanceValue = 0; distanceValue < path.length; distanceValue += step) {
      result.push(sampleAt(path, distanceValue));
    }
    result.push(sampleAt(path, path.length));
    return result;
  }

  function nearestPoint(path, target) {
    const p = point(target);
    let best = null;
    for (let index = 1; index < path.points.length; index += 1) {
      const a = path.points[index - 1];
      const b = path.points[index];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const denominator = dx*dx + dy*dy;
      const t = denominator <= EPSILON ? 0 : Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / denominator));
      const candidate = { x:a.x + dx*t, y:a.y + dy*t };
      const d = distance(candidate, p);
      if (!best || d < best.distance) best = { ...candidate, distance:d, segmentIndex:index-1, t };
    }
    return best;
  }

  function segmentIntersection(a, b, c, d) {
    const denominator = (b.x-a.x)*(d.y-c.y) - (b.y-a.y)*(d.x-c.x);
    if (Math.abs(denominator) <= EPSILON) return null;
    const t = ((c.x-a.x)*(d.y-c.y) - (c.y-a.y)*(d.x-c.x)) / denominator;
    const u = ((c.x-a.x)*(b.y-a.y) - (c.y-a.y)*(b.x-a.x)) / denominator;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x:a.x + t*(b.x-a.x), y:a.y + t*(b.y-a.y), t, u };
  }

  function pathIntersections(pathA, pathB) {
    const hits = [];
    for (let a = 1; a < pathA.points.length; a += 1) {
      for (let b = 1; b < pathB.points.length; b += 1) {
        const hit = segmentIntersection(pathA.points[a-1], pathA.points[a], pathB.points[b-1], pathB.points[b]);
        if (hit) hits.push({ ...hit, segmentA:a-1, segmentB:b-1 });
      }
    }
    return hits;
  }

  window.CrossroadsPathGeometry = Object.freeze({
    createPath, sampleAt, samplePath, nearestPoint, pathIntersections, distance
  });
})();
