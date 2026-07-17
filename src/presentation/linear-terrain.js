"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const COMPILER = window.CrossroadsLinearTerrain;
  const PATHS = window.CrossroadsPathGeometry;

  function node(name, attrs = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    return element;
  }

  function pathData(points) {
    return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ");
  }

  function stroke(parent, points, className, width, attrs = {}) {
    const element = node("path", {
      d: pathData(points),
      fill: "none",
      "stroke-width": width,
      "stroke-linejoin": attrs["stroke-linejoin"] ?? "round",
      "stroke-linecap": attrs["stroke-linecap"] ?? "round",
      class: className,
      ...attrs
    });
    parent.appendChild(element);
    return element;
  }

  function circle(parent, x, y, radius, className) {
    const element = node("circle", { cx: x, cy: y, r: radius, class: className });
    parent.appendChild(element);
    return element;
  }

  function rect(parent, x, y, width, height, angle, className, rx = 0) {
    const element = node("rect", {
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      rx,
      class: className,
      transform: `rotate(${angle} ${x} ${y})`
    });
    parent.appendChild(element);
    return element;
  }

  function polygon(parent, points, className) {
    const element = node("polygon", {
      points: points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" "),
      class: className
    });
    parent.appendChild(element);
    return element;
  }

  function seeded(index, salt = 0) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function taperedCap(group, compiled, endpoint, className, widthScale = 1) {
    const atStart = endpoint.at === 0;
    const sample = PATHS.sampleAt(compiled.path, endpoint.at);
    const direction = atStart ? -1 : 1;
    const length = Math.max(1.6, compiled.width * 0.72);
    const outer = {
      x: sample.x + sample.tangent.x * length * direction,
      y: sample.y + sample.tangent.y * length * direction
    };
    const half = compiled.width * widthScale / 2;
    const tip = Math.max(0.14, half * 0.16);
    polygon(group, [
      { x: sample.x + sample.normal.x * half, y: sample.y + sample.normal.y * half },
      { x: sample.x - sample.normal.x * half, y: sample.y - sample.normal.y * half },
      { x: outer.x - sample.normal.x * tip, y: outer.y - sample.normal.y * tip },
      { x: outer.x + sample.normal.x * tip, y: outer.y + sample.normal.y * tip }
    ], className);
  }

  function offsetPath(path, amount) {
    return PATHS.samplePath(path, 0.65).map(sample => ({
      x: sample.x + sample.normal.x * amount,
      y: sample.y + sample.normal.y * amount
    }));
  }

  function renderRoad(group, compiled) {
    const p = compiled.path.points;
    const presentation = compiled.style.presentation;
    const shoulder = presentation.shoulderWidth ?? compiled.width + 0.38;
    stroke(group, p, "linear-road-shoulder", shoulder, { "stroke-linecap": "butt" });
    stroke(group, p, "linear-road-surface", compiled.width, { "stroke-linecap": "butt" });
    stroke(group, offsetPath(compiled.path, -compiled.width * 0.20), "linear-road-track linear-road-track-a", 0.085, { "stroke-dasharray": "1.25 2.65 .55 3.15", "stroke-dashoffset": ".35" });
    stroke(group, offsetPath(compiled.path, compiled.width * 0.20), "linear-road-track linear-road-track-b", 0.085, { "stroke-dasharray": ".7 3.0 1.45 2.35", "stroke-dashoffset": "1.1" });

    PATHS.samplePath(compiled.path, 2.75).slice(1, -1).forEach((sample, index) => {
      if (seeded(index, 3) < 0.38) return;
      const side = seeded(index, 7) < 0.5 ? -1 : 1;
      const lateral = compiled.width * (0.15 + seeded(index, 11) * 0.27) * side;
      circle(group, sample.x + sample.normal.x * lateral, sample.y + sample.normal.y * lateral, 0.045 + seeded(index, 13) * 0.035, "linear-road-pebble");
    });

    const endpoints = [
      { definition: compiled.definition.start, at: 0 },
      { definition: compiled.definition.end, at: compiled.path.length }
    ];
    for (const endpoint of endpoints) {
      if (endpoint.definition?.cap !== "grass") continue;
      taperedCap(group, compiled, endpoint, "linear-road-cap-shoulder", shoulder / compiled.width);
      taperedCap(group, compiled, endpoint, "linear-road-cap-surface", 1);
    }
  }

  function renderStream(group, compiled) {
    const p = compiled.path.points;
    const presentation = compiled.style.presentation;
    stroke(group, p, "linear-stream-bank", presentation.bankWidth ?? compiled.width + 0.65, { "stroke-linecap": "butt" });
    stroke(group, p, "linear-stream-water", compiled.width, { "stroke-linecap": "butt" });
    stroke(group, offsetPath(compiled.path, -compiled.width * 0.12), "linear-stream-highlight", 0.10, { "stroke-dasharray": "2.2 2.8" });

    PATHS.samplePath(compiled.path, 6.8).slice(1, -1).forEach((sample, index) => {
      if (seeded(index, 19) < 0.45) return;
      const side = index % 2 ? -1 : 1;
      const offset = (compiled.width / 2 + 0.28 + seeded(index, 23) * 0.18) * side;
      circle(group, sample.x + sample.normal.x * offset, sample.y + sample.normal.y * offset, 0.045 + seeded(index, 29) * 0.035, "linear-stream-stone");
    });

    const endpoints = [
      { definition: compiled.definition.start, at: 0, direction: 1 },
      { definition: compiled.definition.end, at: compiled.path.length, direction: -1 }
    ];
    for (const endpoint of endpoints) {
      if (endpoint.definition?.cap !== "taper") continue;
      const sample = PATHS.sampleAt(compiled.path, endpoint.at);
      for (let step = 1; step <= 5; step += 1) {
        const progress = step / 5;
        const distance = progress * compiled.width * 0.95 * endpoint.direction;
        circle(
          group,
          sample.x + sample.tangent.x * distance,
          sample.y + sample.tangent.y * distance,
          Math.max(0.05, compiled.width * 0.46 * (1 - progress)),
          "linear-stream-taper-water"
        );
      }
    }
  }

  function renderDitch(group, compiled) {
    stroke(group, compiled.path.points, "linear-ditch-bank", compiled.width + 0.36, { "stroke-linecap": "butt" });
    stroke(group, compiled.path.points, "linear-ditch-channel", compiled.width * 0.46, { "stroke-linecap": "butt" });
    stroke(group, compiled.path.points, "linear-ditch-highlight", 0.07, { "stroke-dasharray": "1.3 2.1" });
  }

  function renderRail(group, compiled) {
    const presentation = compiled.style.presentation;
    const ballastWidth = presentation.ballastWidth ?? 3.05;
    const sleeperSpacing = presentation.sleeperSpacing ?? 2.35;
    const sleeperLength = presentation.sleeperLength ?? 2.65;
    const gauge = presentation.railGauge ?? 0.92;
    stroke(group, compiled.path.points, "linear-rail-ballast", ballastWidth, { "stroke-linecap": "butt" });
    PATHS.samplePath(compiled.path, sleeperSpacing).forEach(sample => {
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, sleeperLength, 0.30, angle, "linear-rail-sleeper", 0.055);
      rect(group, sample.x, sample.y - 0.025, sleeperLength * 0.86, 0.045, angle, "linear-rail-sleeper-highlight", 0.02);
    });
    stroke(group, offsetPath(compiled.path, -gauge / 2), "linear-rail-line linear-rail-line-left", 0.115, { "stroke-linecap": "butt" });
    stroke(group, offsetPath(compiled.path, gauge / 2), "linear-rail-line linear-rail-line-right", 0.115, { "stroke-linecap": "butt" });
  }

  function renderHedge(group, compiled) {
    stroke(group, compiled.path.points, "linear-hedge-base", compiled.width * 0.62);
    PATHS.samplePath(compiled.path, compiled.style.presentation.repeatSpacing ?? 1.42).forEach((sample, index) => {
      const scale = [0.92, 1.05, 0.98, 1.10][index % 4];
      const wobble = [-0.10, 0.08, 0.02, -0.05][index % 4];
      circle(group, sample.x + sample.normal.x * wobble, sample.y + sample.normal.y * wobble, compiled.width * 0.45 * scale, "linear-hedge-dark");
      circle(group, sample.x - sample.normal.x * 0.05, sample.y - sample.normal.y * 0.05, compiled.width * 0.31 * scale, "linear-hedge-mid");
      circle(group, sample.x - sample.normal.x * 0.10, sample.y - sample.normal.y * 0.10, compiled.width * 0.17 * scale, "linear-hedge-light");
    });
  }

  function renderFence(group, compiled) {
    const samples = PATHS.samplePath(compiled.path, compiled.style.presentation.postSpacing ?? 2.2);
    for (let index = 0; index < samples.length - 1; index += 1) {
      const a = samples[index];
      const b = samples[index + 1];
      stroke(group, [a, b], "linear-fence-rail linear-fence-rail-top", 0.10, { "stroke-linecap": "round" });
      const lowerA = { x:a.x + a.normal.x * 0.20, y:a.y + a.normal.y * 0.20 };
      const lowerB = { x:b.x + b.normal.x * 0.20, y:b.y + b.normal.y * 0.20 };
      stroke(group, [lowerA, lowerB], "linear-fence-rail linear-fence-rail-bottom", 0.10, { "stroke-linecap": "round" });
    }
    samples.forEach(sample => {
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, 0.62, 0.18, angle, "linear-fence-post", 0.05);
    });
  }

  function renderWall(group, compiled) {
    const samples = PATHS.samplePath(compiled.path, 0.86);
    samples.forEach((sample, index) => {
      const angle = Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI;
      const width = index === 0 || index === samples.length - 1 ? 1.05 : 0.88 + (index % 3) * 0.07;
      const height = compiled.width * (0.82 + (index % 2) * 0.10);
      rect(group, sample.x, sample.y, width, height, angle, `linear-wall-stone linear-wall-stone-${index % 3}`, 0.16);
    });
  }

  const RENDERERS = Object.freeze({
    road: renderRoad,
    stream: renderStream,
    ditch: renderDitch,
    rail: renderRail,
    hedge: renderHedge,
    fence: renderFence,
    wall: renderWall
  });

  function renderJunction(group, junction) {
    const style = window.CROSSROADS_LINEAR_TERRAIN_STYLES?.[junction.styleId ?? "dirt_road"];
    const width = Number(junction.width) || style?.width || 3.6;
    const shoulderWidth = Number(style?.presentation?.shoulderWidth) || width + 0.45;
    const arm = Number(junction.armLength) || width * 1.35;
    const pieces = junction.type === "tee"
      ? [{ w:arm * 2, h:shoulderWidth }, { w:shoulderWidth, h:arm, y:arm * 0.5 }]
      : [{ w:arm * 2, h:shoulderWidth }, { w:shoulderWidth, h:arm * 2 }];
    for (const piece of pieces) {
      rect(group, junction.x + (piece.x || 0), junction.y + (piece.y || 0), piece.w, piece.h, 0, "linear-junction-shoulder", 0.18);
    }
    const surfaces = junction.type === "tee"
      ? [{ w:arm * 2, h:width }, { w:width, h:arm, y:arm * 0.5 }]
      : [{ w:arm * 2, h:width }, { w:width, h:arm * 2 }];
    for (const piece of surfaces) {
      rect(group, junction.x + (piece.x || 0), junction.y + (piece.y || 0), piece.w, piece.h, 0, "linear-junction-surface", 0.14);
    }
  }

  function renderCrossing(group, crossing, compiledById) {
    const first = compiledById.get(crossing.pathIds?.[0]);
    const second = compiledById.get(crossing.pathIds?.[1]);
    if (!first || !second) return;
    const hit = PATHS.pathIntersections(first.path, second.path)[0];
    if (!hit) return;
    const distance = first.path.distances[hit.segmentA] ?? 0;
    const sample = PATHS.sampleAt(first.path, distance);
    const length = Number(crossing.length) || 4.4;
    const width = Number(crossing.width) || first.width;
    const angle = Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI;
    rect(group, hit.x, hit.y, length, width, angle, `linear-crossing linear-crossing-${crossing.type ?? "bridge"}`, 0.24);
  }

  function renderScenarioLinearTerrain({ layer, scenario }) {
    if (!layer || !scenario) return;
    layer.querySelector(".linear-terrain-svg")?.remove();
    const compiled = COMPILER.compileScenario(scenario);
    if (!compiled.paths.length && !(scenario.junctions?.length)) return;

    const svg = node("svg", {
      class: "linear-terrain-svg",
      viewBox: `0 0 ${scenario.table.width} ${scenario.table.height}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true"
    });
    const junctionLayer = node("g", { class: "linear-junction-layer" });
    const pathLayer = node("g", { class: "linear-path-layer" });
    const crossingLayer = node("g", { class: "linear-crossing-layer" });
    svg.append(junctionLayer, pathLayer, crossingLayer);

    (scenario.junctions ?? []).forEach(junction => renderJunction(junctionLayer, junction));

    const order = { stream: 1, ditch: 2, road: 3, rail: 4, hedge: 5, fence: 6, wall: 7 };
    [...compiled.paths]
      .sort((a, b) => (order[a.style.renderer] ?? 9) - (order[b.style.renderer] ?? 9))
      .forEach(item => {
        const group = node("g", {
          class: `linear-path linear-${item.style.renderer}`,
          "data-linear-id": item.definition.id
        });
        RENDERERS[item.style.renderer]?.(group, item);
        pathLayer.appendChild(group);
      });

    const byId = new Map(compiled.paths.map(item => [item.definition.id, item]));
    (scenario.crossings ?? []).forEach(crossing => renderCrossing(crossingLayer, crossing, byId));
    layer.prepend(svg);
  }

  window.CrossroadsLinearTerrainPresentation = Object.freeze({ renderScenarioLinearTerrain });
})();
