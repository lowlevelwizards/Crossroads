"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const COMPILER = window.CrossroadsLinearTerrain;
  const PATHS = window.CrossroadsPathGeometry;
  const MATERIALS = window.CROSSROADS_LINEAR_TERRAIN_MATERIALS ?? {};
  const LAYERS = window.CrossroadsLayerPolicy;

  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function node(name, attrs = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    return element;
  }

  function pathData(points) {
    return points.map((point, index) => `${index ? "L" : "M"}${number(point.x).toFixed(3)} ${number(point.y).toFixed(3)}`).join(" ");
  }

  function stroke(parent, points, className, width, attrs = {}) {
    const element = node("path", {
      d:pathData(points),
      fill:"none",
      "stroke-width":width,
      "stroke-linejoin":attrs["stroke-linejoin"] ?? "round",
      "stroke-linecap":attrs["stroke-linecap"] ?? "round",
      class:className,
      ...attrs
    });
    parent.appendChild(element);
    return element;
  }

  function circle(parent, x, y, radius, className, attrs = {}) {
    const element = node("circle", { cx:x, cy:y, r:radius, class:className, ...attrs });
    parent.appendChild(element);
    return element;
  }

  function rect(parent, x, y, width, height, angle, className, rx = 0, attrs = {}) {
    const element = node("rect", {
      x:x - width / 2,
      y:y - height / 2,
      width,
      height,
      rx,
      class:className,
      transform:`rotate(${angle} ${x} ${y})`,
      ...attrs
    });
    parent.appendChild(element);
    return element;
  }

  function polygon(parent, points, className, attrs = {}) {
    const element = node("polygon", {
      points:points.map(point => `${number(point.x).toFixed(3)},${number(point.y).toFixed(3)}`).join(" "),
      class:className,
      "stroke-linejoin":"round",
      ...attrs
    });
    parent.appendChild(element);
    return element;
  }

  function seeded(index, salt = 0) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function originalDistances(definition) {
    const points = definition.points ?? [];
    const distances = [0];
    for (let index = 1; index < points.length; index += 1) {
      distances.push(distances[index - 1] + Math.hypot(number(points[index].x) - number(points[index - 1].x), number(points[index].y) - number(points[index - 1].y)));
    }
    return distances;
  }

  function widthAt(compiled, distance) {
    const fallback = number(compiled.definition.width, compiled.style.width);
    const points = compiled.definition.points ?? [];
    if (!points.length || !points.some(point => Number.isFinite(Number(point.width)))) return fallback;
    const distances = originalDistances(compiled.definition);
    const total = distances[distances.length - 1] || 1;
    const target = Math.max(0, Math.min(1, number(distance) / Math.max(.001, compiled.path.length))) * total;
    let right = 1;
    while (right < distances.length && distances[right] < target) right += 1;
    right = Math.min(right, points.length - 1);
    const left = Math.max(0, right - 1);
    const span = distances[right] - distances[left];
    const t = span <= 1e-6 ? 0 : (target - distances[left]) / span;
    const a = number(points[left]?.width, fallback);
    const b = number(points[right]?.width, fallback);
    return a + (b - a) * t;
  }

  function endpointDefinition(compiled, start) {
    return start ? compiled.definition.start ?? {} : compiled.definition.end ?? {};
  }

  function renderPath(compiled) {
    const points = compiled.path.points.map(point => ({ x:point.x, y:point.y }));
    const extension = Math.max(4, number(compiled.width) * 2.2);
    if (endpointDefinition(compiled, true).cap === "off_table") {
      const sample = PATHS.sampleAt(compiled.path, 0);
      points[0] = { x:points[0].x - sample.tangent.x * extension, y:points[0].y - sample.tangent.y * extension };
    }
    if (endpointDefinition(compiled, false).cap === "off_table") {
      const sample = PATHS.sampleAt(compiled.path, compiled.path.length);
      points[points.length - 1] = { x:points[points.length - 1].x + sample.tangent.x * extension, y:points[points.length - 1].y + sample.tangent.y * extension };
    }
    if (points.every((point, index) => point.x === compiled.path.points[index]?.x && point.y === compiled.path.points[index]?.y)) return compiled.path;
    return PATHS.createPath({ id:`${compiled.definition.id}-render`, points, smoothing:0 });
  }

  function sampleVariable(compiled, spacing = .55) {
    const path = renderPath(compiled);
    const samples = PATHS.samplePath(path, spacing);
    const startExtended = endpointDefinition(compiled, true).cap === "off_table";
    const endExtended = endpointDefinition(compiled, false).cap === "off_table";
    const extension = Math.max(4, number(compiled.width) * 2.2);
    return samples.map(sample => {
      const sourceDistance = startExtended ? sample.distance - extension : sample.distance;
      const clampedDistance = Math.max(0, Math.min(compiled.path.length, sourceDistance));
      return { ...sample, sourceDistance:clampedDistance, width:widthAt(compiled, clampedDistance) };
    }).map((sample, index, source) => {
      if (endExtended && index === source.length - 1) sample.sourceDistance = compiled.path.length;
      return sample;
    });
  }

  function corridor(samples, widthForSample) {
    const left = [];
    const right = [];
    for (const sample of samples) {
      const half = Math.max(.02, number(widthForSample(sample), sample.width) / 2);
      left.push({ x:sample.x + sample.normal.x * half, y:sample.y + sample.normal.y * half });
      right.push({ x:sample.x - sample.normal.x * half, y:sample.y - sample.normal.y * half });
    }
    return [...left, ...right.reverse()];
  }

  function offsetSamples(samples, amountForSample) {
    return samples.map(sample => {
      const amount = number(amountForSample(sample));
      return { x:sample.x + sample.normal.x * amount, y:sample.y + sample.normal.y * amount };
    });
  }

  function materialFor(compiled) {
    const choices = MATERIALS[compiled.definition.styleId] ?? {};
    const defaults = { dirt_road:"dirt", stream:"clear", railway_embankment:"standard" };
    const id = compiled.definition.material || defaults[compiled.definition.styleId] || Object.keys(choices)[0];
    return choices[id] ?? Object.values(choices)[0] ?? {};
  }

  function applyMaterial(group, compiled) {
    const material = materialFor(compiled);
    const values = {
      "--linear-surface":material.surface,
      "--linear-shoulder":material.shoulder,
      "--linear-detail":material.detail,
      "--linear-water":material.water,
      "--linear-bank":material.bank,
      "--linear-ballast":material.ballast,
      "--linear-ballast-stripe":material.stripe,
      "--linear-sleeper":material.sleeper,
      "--linear-sleeper-edge":material.sleeperEdge,
      "--linear-rail":material.rail,
      "--linear-rail-edge":material.railEdge
    };
    for (const [key, value] of Object.entries(values)) if (value) group.style.setProperty(key, value);
    group.dataset.material = compiled.definition.material || material.id || "default";
  }

  function endpointSample(compiled, start) {
    return PATHS.sampleAt(compiled.path, start ? 0 : compiled.path.length);
  }

  function taperPolygon(compiled, start, width, lengthScale = 1, tipScale = .08) {
    const sample = endpointSample(compiled, start);
    const direction = start ? -1 : 1;
    const length = Math.max(1.2, width * .8) * lengthScale;
    const half = width / 2;
    const tip = Math.max(.02, half * tipScale);
    const outer = { x:sample.x + sample.tangent.x * length * direction, y:sample.y + sample.tangent.y * length * direction };
    return [
      { x:sample.x + sample.normal.x * half, y:sample.y + sample.normal.y * half },
      { x:sample.x - sample.normal.x * half, y:sample.y - sample.normal.y * half },
      { x:outer.x - sample.normal.x * tip, y:outer.y - sample.normal.y * tip },
      { x:outer.x + sample.normal.x * tip, y:outer.y + sample.normal.y * tip }
    ];
  }

  function renderRoadCaps(group, compiled, shoulderRatio) {
    for (const start of [true, false]) {
      const cap = endpointDefinition(compiled, start).cap ?? "none";
      const width = widthAt(compiled, start ? 0 : compiled.path.length);
      if (cap === "grass" || cap === "taper") {
        if (cap === "grass") polygon(group, taperPolygon(compiled, start, width * shoulderRatio, 1.12, .04), "linear-road-cap-shoulder");
        polygon(group, taperPolygon(compiled, start, width, 1, .05), "linear-road-cap-surface");
      } else if (cap === "junction") {
        const sample = endpointSample(compiled, start);
        circle(group, sample.x, sample.y, width * shoulderRatio * .52, "linear-road-junction-shoulder");
        circle(group, sample.x, sample.y, width * .51, "linear-road-junction-surface");
      }
    }
  }

  function renderRoad(group, compiled) {
    applyMaterial(group, compiled);
    const presentation = compiled.style.presentation;
    const shoulderRatio = number(presentation.shoulderWidth, compiled.width + .38) / Math.max(.01, number(compiled.style.width, compiled.width));
    const samples = sampleVariable(compiled, .42);
    polygon(group, corridor(samples, sample => sample.width * shoulderRatio), "linear-road-shoulder");
    polygon(group, corridor(samples, sample => sample.width), "linear-road-surface");
    stroke(group, offsetSamples(samples, sample => -sample.width * .20), "linear-road-track linear-road-track-a", .085, { "stroke-linecap": "butt", "stroke-dasharray":"1.25 2.65 .55 3.15", "stroke-dashoffset":".35" });
    stroke(group, offsetSamples(samples, sample => sample.width * .20), "linear-road-track linear-road-track-b", .085, { "stroke-dasharray":".7 3.0 1.45 2.35", "stroke-dashoffset":"1.1" });
    samples.filter((_, index) => index > 1 && index < samples.length - 2 && index % 6 === 0).forEach((sample, index) => {
      if (seeded(index, 3) < .38) return;
      const side = seeded(index, 7) < .5 ? -1 : 1;
      const lateral = sample.width * (.15 + seeded(index, 11) * .27) * side;
      circle(group, sample.x + sample.normal.x * lateral, sample.y + sample.normal.y * lateral, .045 + seeded(index, 13) * .035, "linear-road-pebble");
    });
    renderRoadCaps(group, compiled, shoulderRatio);
  }

  function renderStreamCaps(group, compiled, bankRatio) {
    for (const start of [true, false]) {
      const cap = endpointDefinition(compiled, start).cap ?? "none";
      const width = widthAt(compiled, start ? 0 : compiled.path.length);
      const sample = endpointSample(compiled, start);
      if (cap === "taper" || cap === "grass") {
        polygon(group, taperPolygon(compiled, start, width * bankRatio, 1.05, .05), "linear-stream-taper-bank");
        polygon(group, taperPolygon(compiled, start, width, 1, .03), "linear-stream-taper-water");
      } else if (cap === "junction") {
        circle(group, sample.x, sample.y, width * bankRatio * .52, "linear-stream-junction-bank");
        circle(group, sample.x, sample.y, width * .51, "linear-stream-junction-water");
      }
    }
  }

  function renderStream(group, compiled) {
    applyMaterial(group, compiled);
    const presentation = compiled.style.presentation;
    const bankRatio = number(presentation.bankWidth, compiled.width + .65) / Math.max(.01, number(compiled.style.width, compiled.width));
    const samples = sampleVariable(compiled, .38);
    polygon(group, corridor(samples, sample => sample.width * bankRatio), "linear-stream-bank");
    polygon(group, corridor(samples, sample => sample.width), "linear-stream-water");
    stroke(group, offsetSamples(samples, sample => -sample.width * .12), "linear-stream-highlight", .10, { "stroke-dasharray":"2.2 2.8" });
    samples.filter((_, index) => index > 2 && index < samples.length - 3 && index % 15 === 0).forEach((sample, index) => {
      if (seeded(index, 19) < .45) return;
      const side = index % 2 ? -1 : 1;
      const offset = (sample.width / 2 + .28 + seeded(index, 23) * .18) * side;
      circle(group, sample.x + sample.normal.x * offset, sample.y + sample.normal.y * offset, .045 + seeded(index, 29) * .035, "linear-stream-stone");
    });
    renderStreamCaps(group, compiled, bankRatio);
  }

  function renderDitch(group, compiled) {
    const samples = sampleVariable(compiled, .45);
    polygon(group, corridor(samples, sample => sample.width + .36), "linear-ditch-bank");
    polygon(group, corridor(samples, sample => sample.width * .46), "linear-ditch-channel");
    stroke(group, samples, "linear-ditch-highlight", .07, { "stroke-dasharray":"1.3 2.1" });
  }

  function renderRailCaps(group, compiled, ballastRatio) {
    for (const start of [true, false]) {
      const cap = endpointDefinition(compiled, start).cap ?? "none";
      const width = widthAt(compiled, start ? 0 : compiled.path.length);
      const sample = endpointSample(compiled, start);
      if (cap === "taper" || cap === "grass") {
        polygon(group, taperPolygon(compiled, start, width * ballastRatio, 1.0, .08), "linear-rail-cap-ballast");
      } else if (cap === "junction") {
        circle(group, sample.x, sample.y, width * ballastRatio * .52, "linear-rail-junction-ballast");
      }
    }
  }

  function renderRail(group, compiled) {
    applyMaterial(group, compiled);
    const presentation = compiled.style.presentation;
    const ballastRatio = number(presentation.ballastWidth, 3.18) / Math.max(.01, number(compiled.style.width, compiled.width));
    const samples = sampleVariable(compiled, .34);
    polygon(group, corridor(samples, sample => sample.width * ballastRatio), "linear-rail-ballast");
    const sleeperSpacing = number(presentation.sleeperSpacing, 1.28);
    const sleeperLengthRatio = number(presentation.sleeperLength, 2.78) / Math.max(.01, number(compiled.style.width, compiled.width));
    const sleeperHeight = number(presentation.sleeperHeight, .42);
    const sleeperSamples = PATHS.samplePath(renderPath(compiled), sleeperSpacing);
    sleeperSamples.forEach((sample, index) => {
      const sourceDistance = Math.max(0, Math.min(compiled.path.length, (sample.distance / Math.max(.001, renderPath(compiled).length)) * compiled.path.length));
      const localWidth = widthAt(compiled, sourceDistance);
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, localWidth * sleeperLengthRatio, sleeperHeight, angle, "linear-rail-sleeper", .12);
      if (index % 2 === 0) rect(group, sample.x, sample.y - .018, localWidth * sleeperLengthRatio * .84, .055, angle, "linear-rail-sleeper-highlight", .025);
    });
    const gaugeRatio = number(presentation.railGauge, 1.02) / Math.max(.01, number(compiled.style.width, compiled.width));
    const left = offsetSamples(samples, sample => -sample.width * gaugeRatio / 2);
    const right = offsetSamples(samples, sample => sample.width * gaugeRatio / 2);
    stroke(group, left, "linear-rail-line-edge", .24, { "stroke-linecap":"butt" });
    stroke(group, right, "linear-rail-line-edge", .24, { "stroke-linecap":"butt" });
    stroke(group, left, "linear-rail-line linear-rail-line-left", .12, { "stroke-linecap":"butt" });
    stroke(group, right, "linear-rail-line linear-rail-line-right", .12, { "stroke-linecap":"butt" });
    renderRailCaps(group, compiled, ballastRatio);
  }

  function renderHedge(group, compiled) {
    const samples = sampleVariable(compiled, compiled.style.presentation.repeatSpacing ?? 1.35);
    stroke(group, samples, "linear-hedge-base", Math.max(.18, compiled.width * .62));
    samples.forEach((sample, index) => {
      const scale = [0.92, 1.05, .98, 1.10][index % 4];
      const wobble = [-.10, .08, .02, -.05][index % 4];
      circle(group, sample.x + sample.normal.x * wobble, sample.y + sample.normal.y * wobble, sample.width * .45 * scale, "linear-hedge-dark");
      circle(group, sample.x - sample.normal.x * .05, sample.y - sample.normal.y * .05, sample.width * .31 * scale, "linear-hedge-mid");
      circle(group, sample.x - sample.normal.x * .10, sample.y - sample.normal.y * .10, sample.width * .17 * scale, "linear-hedge-light");
    });
  }

  function renderFence(group, compiled) {
    const samples = sampleVariable(compiled, compiled.style.presentation.postSpacing ?? 2.1);
    for (let index = 0; index < samples.length - 1; index += 1) {
      const a = samples[index];
      const b = samples[index + 1];
      stroke(group, [a, b], "linear-fence-rail linear-fence-rail-top", .10, { "stroke-linecap":"round" });
      const lowerA = { x:a.x + a.normal.x * .20, y:a.y + a.normal.y * .20 };
      const lowerB = { x:b.x + b.normal.x * .20, y:b.y + b.normal.y * .20 };
      stroke(group, [lowerA, lowerB], "linear-fence-rail linear-fence-rail-bottom", .10, { "stroke-linecap":"round" });
    }
    samples.forEach(sample => {
      const angle = Math.atan2(sample.normal.y, sample.normal.x) * 180 / Math.PI;
      rect(group, sample.x, sample.y, .62, Math.max(.16, sample.width * .24), angle, "linear-fence-post", .05);
    });
  }

  function renderWall(group, compiled) {
    const samples = sampleVariable(compiled, .86);
    samples.forEach((sample, index) => {
      const angle = Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI;
      const width = index === 0 || index === samples.length - 1 ? 1.05 : .88 + (index % 3) * .07;
      const height = sample.width * (.82 + (index % 2) * .10);
      rect(group, sample.x, sample.y, width, height, angle, `linear-wall-stone linear-wall-stone-${index % 3}`, .16);
    });
  }

  const RENDERERS = Object.freeze({ road:renderRoad, stream:renderStream, ditch:renderDitch, rail:renderRail, hedge:renderHedge, fence:renderFence, wall:renderWall });

  function renderJunction(group, junction) {
    const style = window.CROSSROADS_LINEAR_TERRAIN_STYLES?.[junction.styleId ?? "dirt_road"];
    const width = number(junction.width, style?.width || 3.6);
    const shoulderWidth = number(style?.presentation?.shoulderWidth, width + .45);
    const arm = number(junction.armLength, width * 1.35);
    const pieces = junction.type === "tee"
      ? [{ w:arm * 2, h:shoulderWidth }, { w:shoulderWidth, h:arm, y:arm * .5 }]
      : [{ w:arm * 2, h:shoulderWidth }, { w:shoulderWidth, h:arm * 2 }];
    for (const piece of pieces) rect(group, number(junction.x) + (piece.x || 0), number(junction.y) + (piece.y || 0), piece.w, piece.h, 0, "linear-junction-shoulder", .18);
    const surfaces = junction.type === "tee"
      ? [{ w:arm * 2, h:width }, { w:width, h:arm, y:arm * .5 }]
      : [{ w:arm * 2, h:width }, { w:width, h:arm * 2 }];
    for (const piece of surfaces) rect(group, number(junction.x) + (piece.x || 0), number(junction.y) + (piece.y || 0), piece.w, piece.h, 0, "linear-junction-surface", .14);
  }

  function renderCrossing(group, crossing, compiledById) {
    const first = compiledById.get(crossing.pathIds?.[0]);
    const second = compiledById.get(crossing.pathIds?.[1]);
    if (!first || !second) return;
    const hit = PATHS.pathIntersections(first.path, second.path)[0];
    if (!hit) return;
    const distance = first.path.distances[hit.segmentA] ?? 0;
    const sample = PATHS.sampleAt(first.path, distance);
    const length = number(crossing.length, 4.4);
    const width = number(crossing.width, first.width);
    const angle = Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI;
    rect(group, hit.x, hit.y, length, width, angle, `linear-crossing linear-crossing-${crossing.type ?? "bridge"}`, .24);
  }

  function makeLinearSvg(scenario, className, layerOrder, data = {}) {
    const svg = node("svg", {
      class:`linear-terrain-svg ${className}`,
      viewBox:`0 0 ${scenario.table.width} ${scenario.table.height}`,
      preserveAspectRatio:"none",
      "aria-hidden":"true",
      ...data
    });
    svg.style.zIndex = String(layerOrder);
    const identity = String(data["data-linear-id"] ?? data["data-linear-aux"] ?? "shared")
      .replace(/[^a-zA-Z0-9_-]/g, "-");
    const ballastPatternId = `linear-rail-ballast-pattern-${identity}`;
    svg.style.setProperty("--linear-rail-ballast-fill", `url(#${ballastPatternId})`);
    const defs = node("defs");
    const ballastPattern = node("pattern", { id:ballastPatternId, width:1.2, height:1.2, patternUnits:"userSpaceOnUse", patternTransform:"rotate(35)" });
    ballastPattern.appendChild(node("rect", { width:1.2, height:1.2, fill:"var(--linear-ballast, #8f918b)" }));
    ballastPattern.appendChild(node("rect", { width:.32, height:1.2, fill:"var(--linear-ballast-stripe, #73766f)", opacity:.36 }));
    defs.appendChild(ballastPattern);
    svg.appendChild(defs);
    return svg;
  }

  function renderScenarioLinearTerrain({ layer, scenario }) {
    if (!layer || !scenario) return;
    layer.querySelectorAll(":scope > .linear-terrain-svg").forEach(element => element.remove());
    const visible = item => item?.visible !== false && item?.hidden !== true;
    const renderScenario = {
      ...scenario,
      linearTerrain:(scenario.linearTerrain ?? []).filter(visible),
      junctions:(scenario.junctions ?? []).filter(visible),
      crossings:(scenario.crossings ?? []).filter(visible)
    };
    const compiled = COMPILER.compileScenario(renderScenario);
    if (!compiled.paths.length && !renderScenario.junctions.length && !renderScenario.crossings.length) return;

    [...compiled.paths]
      .sort((a, b) => (LAYERS?.linearLayer(a.definition, a.style) ?? 220) - (LAYERS?.linearLayer(b.definition, b.style) ?? 220))
      .forEach(item => {
        const layerOrder = LAYERS?.linearLayer(item.definition, item.style) ?? 220;
        const svg = makeLinearSvg(scenario, `linear-terrain-object linear-${item.style.renderer}-object`, layerOrder, {
          "data-linear-id":item.definition.id,
          "data-linear-style":item.definition.styleId
        });
        const group = node("g", {
          class:`linear-path linear-${item.style.renderer}`,
          "data-linear-id":item.definition.id,
          "data-linear-layer":layerOrder
        });
        RENDERERS[item.style.renderer]?.(group, item);
        svg.appendChild(group);
        layer.appendChild(svg);
      });

    if (renderScenario.junctions.length) {
      const junctionLayerOrder = LAYERS?.BANDS?.transport ?? 220;
      const svg = makeLinearSvg(scenario, "linear-terrain-junctions", junctionLayerOrder, { "data-linear-aux":"junctions" });
      const group = node("g", { class:"linear-junction-layer" });
      renderScenario.junctions.forEach(junction => renderJunction(group, junction));
      svg.appendChild(group);
      layer.appendChild(svg);
    }

    if (renderScenario.crossings.length) {
      const crossingLayerOrder = (LAYERS?.BANDS?.transport ?? 220) + 25;
      const svg = makeLinearSvg(scenario, "linear-terrain-crossings", crossingLayerOrder, { "data-linear-aux":"crossings" });
      const group = node("g", { class:"linear-crossing-layer" });
      const byId = new Map(compiled.paths.map(item => [item.definition.id, item]));
      renderScenario.crossings.forEach(crossing => renderCrossing(group, crossing, byId));
      svg.appendChild(group);
      layer.appendChild(svg);
    }
  }

  window.CrossroadsLinearTerrainPresentation = Object.freeze({ renderScenarioLinearTerrain, widthAt });
})();
