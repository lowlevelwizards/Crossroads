"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const COMPILER = window.CrossroadsLinearTerrain;
  const PATHS = window.CrossroadsPathGeometry;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  }

  function pathData(points) {
    return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ");
  }

  function stroke(parent, points, className, width, extra = {}) {
    const element = svgElement("path", {
      d:pathData(points), fill:"none", "stroke-width":width,
      "stroke-linejoin":"round", "stroke-linecap":"round", class:className, ...extra
    });
    parent.appendChild(element);
    return element;
  }

  function circle(parent, x, y, radius, className) {
    const element = svgElement("circle", { cx:x, cy:y, r:radius, class:className });
    parent.appendChild(element);
    return element;
  }

  function line(parent, a, b, className, width) {
    const element = svgElement("line", { x1:a.x, y1:a.y, x2:b.x, y2:b.y, class:className, "stroke-width":width, "stroke-linecap":"round" });
    parent.appendChild(element);
    return element;
  }

  function endpoint(path, atEnd) {
    return PATHS.sampleAt(path, atEnd ? path.length : 0);
  }

  function renderRoad(group, compiled) {
    const p = compiled.path.points;
    const style = compiled.style.presentation;
    stroke(group, p, "linear-road-shoulder", style.shoulderWidth ?? compiled.width + .7);
    stroke(group, p, "linear-road-surface", compiled.width);
    stroke(group, p, "linear-road-track linear-road-track-a", .12, { "stroke-dasharray":"1.3 2.2" });
    stroke(group, p, "linear-road-track linear-road-track-b", .12, { "stroke-dasharray":"1.1 2.5", transform:"translate(0 .72)" });
    for (const side of [false, true]) {
      const cap = side ? compiled.definition.end?.cap : compiled.definition.start?.cap;
      if (cap === "grass") {
        const sample = endpoint(compiled.path, side);
        circle(group, sample.x, sample.y, compiled.width * .48, "linear-road-grass-cap");
      }
    }
  }

  function renderStream(group, compiled) {
    const p = compiled.path.points;
    const style = compiled.style.presentation;
    stroke(group, p, "linear-stream-bank", style.bankWidth ?? compiled.width + 1);
    stroke(group, p, "linear-stream-water", compiled.width);
    stroke(group, p, "linear-stream-highlight", .12, { "stroke-dasharray":"2.4 2" });
    const samples = PATHS.samplePath(compiled.path, 5.2);
    samples.slice(1, -1).forEach((sample, index) => {
      const offset = index % 2 ? .38 : -.34;
      circle(group, sample.x + sample.normal.x*offset, sample.y + sample.normal.y*offset, .16, "linear-stream-stone");
    });
    for (const side of [false, true]) {
      const cap = side ? compiled.definition.end?.cap : compiled.definition.start?.cap;
      if (cap === "taper") {
        const sample = endpoint(compiled.path, side);
        circle(group, sample.x, sample.y, compiled.width * .55, "linear-stream-end-bank");
        circle(group, sample.x, sample.y, compiled.width * .34, "linear-stream-end-water");
      }
    }
  }

  function renderDitch(group, compiled) {
    const p = compiled.path.points;
    const style = compiled.style.presentation;
    stroke(group, p, "linear-ditch-bank", style.bankWidth ?? compiled.width + 1);
    stroke(group, p, "linear-ditch-channel", compiled.width * .62);
    stroke(group, p, "linear-ditch-highlight", .1, { "stroke-dasharray":"1.4 1.8" });
  }

  function offsetPath(path, amount) {
    return PATHS.samplePath(path, .7).map(sample => ({ x:sample.x + sample.normal.x*amount, y:sample.y + sample.normal.y*amount }));
  }

  function renderRail(group, compiled) {
    const style = compiled.style.presentation;
    stroke(group, compiled.path.points, "linear-rail-ballast", style.ballastWidth ?? compiled.width + 1.2);
    const sleepers = PATHS.samplePath(compiled.path, style.sleeperSpacing ?? 2.15);
    sleepers.forEach(sample => {
      const half = (style.sleeperLength ?? 4.45) / 2;
      line(group,
        { x:sample.x-sample.normal.x*half, y:sample.y-sample.normal.y*half },
        { x:sample.x+sample.normal.x*half, y:sample.y+sample.normal.y*half },
        "linear-rail-sleeper", .48);
    });
    stroke(group, offsetPath(compiled.path, -.64), "linear-rail-line", .18);
    stroke(group, offsetPath(compiled.path, .64), "linear-rail-line", .18);
  }

  function renderHedge(group, compiled) {
    stroke(group, compiled.path.points, "linear-hedge-base", compiled.width * .72);
    PATHS.samplePath(compiled.path, compiled.style.presentation.repeatSpacing ?? 1.35).forEach((sample, index) => {
      const wobble = (index % 3 - 1) * .12;
      circle(group, sample.x + sample.normal.x*wobble, sample.y + sample.normal.y*wobble, compiled.width*.47, "linear-hedge-dark");
      circle(group, sample.x - sample.normal.x*.06, sample.y - sample.normal.y*.06, compiled.width*.32, "linear-hedge-mid");
      circle(group, sample.x - sample.normal.x*.12, sample.y - sample.normal.y*.12, compiled.width*.19, "linear-hedge-light");
    });
  }

  function renderFence(group, compiled) {
    stroke(group, offsetPath(compiled.path, -.18), "linear-fence-rail", .16);
    stroke(group, offsetPath(compiled.path, .18), "linear-fence-rail", .16);
    PATHS.samplePath(compiled.path, compiled.style.presentation.postSpacing ?? 2.1).forEach(sample => {
      const half = .42;
      line(group,
        { x:sample.x-sample.normal.x*half, y:sample.y-sample.normal.y*half },
        { x:sample.x+sample.normal.x*half, y:sample.y+sample.normal.y*half },
        "linear-fence-post", .34);
    });
  }

  function renderWall(group, compiled) {
    stroke(group, compiled.path.points, "linear-wall-base", compiled.width);
    stroke(group, compiled.path.points, "linear-wall-detail", .12, { "stroke-dasharray":".75 .32" });
  }

  const RENDERERS = Object.freeze({
    road:renderRoad, stream:renderStream, ditch:renderDitch, rail:renderRail,
    hedge:renderHedge, fence:renderFence, wall:renderWall
  });

  function renderJunction(group, junction, scenario) {
    const style = window.CROSSROADS_LINEAR_TERRAIN_STYLES?.[junction.styleId ?? "dirt_road"];
    const width = Number(junction.width) || style?.width || 3.6;
    const shoulder = style?.presentation?.shoulderWidth ?? width + .7;
    const radius = Number(junction.radius) || width * 1.1;
    const base = circle(group, junction.x, junction.y, radius, "linear-junction-shoulder");
    base.dataset.junctionId = junction.id;
    circle(group, junction.x, junction.y, radius * .82, "linear-junction-surface");
  }

  function renderCrossing(group, crossing, compiledById) {
    const road = compiledById.get(crossing.pathIds?.[0]);
    const water = compiledById.get(crossing.pathIds?.[1]);
    if (!road || !water) return;
    const hits = PATHS.pathIntersections(road.path, water.path);
    const hit = hits[0];
    if (!hit) return;
    const sample = PATHS.sampleAt(road.path, road.path.distances[hit.segmentA] ?? 0);
    const length = Number(crossing.length) || 4.4;
    const width = Number(crossing.width) || road.width;
    const angle = Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI;
    const bridge = svgElement("rect", {
      x:hit.x-length/2, y:hit.y-width/2, width:length, height:width, rx:.3,
      class:`linear-crossing linear-crossing-${crossing.type ?? "bridge"}`,
      transform:`rotate(${angle} ${hit.x} ${hit.y})`
    });
    group.appendChild(bridge);
  }

  function renderScenarioLinearTerrain({ layer, scenario }) {
    if (!layer || !scenario) return;
    layer.querySelector(".linear-terrain-svg")?.remove();
    const compiled = COMPILER.compileScenario(scenario);
    if (!compiled.paths.length && !(scenario.junctions?.length)) return;

    const svg = svgElement("svg", {
      class:"linear-terrain-svg", viewBox:`0 0 ${scenario.table.width} ${scenario.table.height}`,
      preserveAspectRatio:"none", "aria-hidden":"true"
    });
    const junctionLayer = svgElement("g", { class:"linear-junction-layer" });
    const pathLayer = svgElement("g", { class:"linear-path-layer" });
    const crossingLayer = svgElement("g", { class:"linear-crossing-layer" });
    svg.append(junctionLayer, pathLayer, crossingLayer);

    (scenario.junctions ?? []).forEach(junction => renderJunction(junctionLayer, junction, scenario));

    const order = { stream:1, ditch:2, road:3, rail:4, hedge:5, fence:6, wall:7 };
    [...compiled.paths].sort((a,b) => (order[a.style.renderer]??9)-(order[b.style.renderer]??9)).forEach(item => {
      const group = svgElement("g", { class:`linear-path linear-${item.style.renderer}`, "data-linear-id":item.definition.id });
      RENDERERS[item.style.renderer]?.(group, item);
      pathLayer.appendChild(group);
    });

    const byId = new Map(compiled.paths.map(item => [item.definition.id, item]));
    (scenario.crossings ?? []).forEach(crossing => renderCrossing(crossingLayer, crossing, byId));
    layer.prepend(svg);
  }

  window.CrossroadsLinearTerrainPresentation = Object.freeze({ renderScenarioLinearTerrain });
})();
