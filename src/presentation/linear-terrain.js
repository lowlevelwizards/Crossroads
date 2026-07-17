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

  function offsetPath(path, amount) {
    return PATHS.samplePath(path, 0.65).map(sample => ({
      x: sample.x + sample.normal.x * amount,
      y: sample.y + sample.normal.y * amount
    }));
  }

  function renderRoad(group, compiled) {
    const p = compiled.path.points;
    const presentation = compiled.style.presentation;
    stroke(group, p, "linear-road-shoulder", presentation.shoulderWidth ?? compiled.width + 0.65);
    stroke(group, p, "linear-road-surface", compiled.width);
    stroke(group, offsetPath(compiled.path, -compiled.width * 0.20), "linear-road-track", 0.10, { "stroke-dasharray": "1.4 2.15" });
    stroke(group, offsetPath(compiled.path, compiled.width * 0.20), "linear-road-track", 0.10, { "stroke-dasharray": "1.25 2.35" });

    const endpoints = [
      { definition: compiled.definition.start, at: 0 },
      { definition: compiled.definition.end, at: compiled.path.length }
    ];
    for (const endpoint of endpoints) {
      if (endpoint.definition?.cap !== "grass") continue;
      const sample = PATHS.sampleAt(compiled.path, endpoint.at);
      const direction = endpoint.at === 0 ? -1 : 1;
      for (let step = 0; step < 5; step += 1) {
        const progress = step / 4;
        const distance = progress * compiled.width * 0.95 * direction;
        const width = compiled.width * (1 - progress * 0.82);
        rect(
          group,
          sample.x + sample.tangent.x * distance,
          sample.y + sample.tangent.y * distance,
          Math.max(0.18, width),
          compiled.width * 0.34,
          Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI,
          "linear-road-fade",
          0.10
        );
      }
    }
  }

  function renderStream(group, compiled) {
    const p = compiled.path.points;
    const presentation = compiled.style.presentation;
    stroke(group, p, "linear-stream-bank", presentation.bankWidth ?? compiled.width + 0.85);
    stroke(group, p, "linear-stream-water", compiled.width);
    stroke(group, offsetPath(compiled.path, -compiled.width * 0.12), "linear-stream-highlight", 0.10, { "stroke-dasharray": "2.2 2.8" });

    PATHS.samplePath(compiled.path, 7.2).slice(1, -1).forEach((sample, index) => {
      if (index % 2 !== 0) return;
      const offset = index % 4 === 0 ? -0.25 : 0.25;
      circle(group, sample.x + sample.normal.x * offset, sample.y + sample.normal.y * offset, 0.085, "linear-stream-stone");
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
    stroke(group, compiled.path.points, "linear-ditch-bank", compiled.width + 0.42);
    stroke(group, compiled.path.points, "linear-ditch-channel", compiled.width * 0.52);
    stroke(group, compiled.path.points, "linear-ditch-highlight", 0.07, { "stroke-dasharray": "1.3 2.1" });
  }

  function renderRail(group, compiled) {
    const presentation = compiled.style.presentation;
    stroke(group, compiled.path.points, "linear-rail-ballast", presentation.ballastWidth ?? compiled.width + 0.72, { "stroke-linecap": "butt" });
    const sleeperSpacing = presentation.sleeperSpacing ?? 2.75;
    const sleeperLength = presentation.sleeperLength ?? 3.55;
    PATHS.samplePath(compiled.path, sleeperSpacing).forEach(sample => {
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, sleeperLength, 0.42, angle, "linear-rail-sleeper", 0.10);
    });
    stroke(group, offsetPath(compiled.path, -0.58), "linear-rail-line", 0.14, { "stroke-linecap": "butt" });
    stroke(group, offsetPath(compiled.path, 0.58), "linear-rail-line", 0.14, { "stroke-linecap": "butt" });
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
    stroke(group, offsetPath(compiled.path, -0.16), "linear-fence-rail", 0.13);
    stroke(group, offsetPath(compiled.path, 0.16), "linear-fence-rail", 0.13);
    PATHS.samplePath(compiled.path, compiled.style.presentation.postSpacing ?? 2.0).forEach(sample => {
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, 0.78, 0.26, angle, "linear-fence-post", 0.08);
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
    const radius = Number(junction.radius) || width * 0.92;
    const shoulder = circle(group, junction.x, junction.y, radius, "linear-junction-shoulder");
    shoulder.dataset.junctionId = junction.id;
    circle(group, junction.x, junction.y, radius * 0.83, "linear-junction-surface");
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
