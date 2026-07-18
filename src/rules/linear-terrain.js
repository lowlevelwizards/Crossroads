"use strict";

(() => {
  const STYLES = window.CROSSROADS_LINEAR_TERRAIN_STYLES;
  const PATHS = window.CrossroadsPathGeometry;
  const SEMANTICS = window.CrossroadsTerrainSemantics;
  const VISIBILITY = window.CrossroadsScenarioVisibility;

  function validateDefinition(definition) {
    const style = STYLES?.[definition?.styleId];
    if (!style) throw new Error(`Unknown linear terrain style: ${definition?.styleId}`);
    return style;
  }

  function runtimeDefinition(style, rules = style.rules) {
    return Object.freeze({ id:style.id, family:style.family, renderer:style.renderer, label:style.label, rules, presentation:style.presentation });
  }

  function sourceDistances(definition) {
    const points = definition.points ?? [];
    const result = [0];
    for (let index = 1; index < points.length; index += 1) {
      result.push(result[index - 1] + Math.hypot(Number(points[index].x) - Number(points[index - 1].x), Number(points[index].y) - Number(points[index - 1].y)));
    }
    return result;
  }

  function widthAt(definition, style, path, distance) {
    const fallback = Number(definition.width) || style.width;
    const points = definition.points ?? [];
    if (!points.some(point => Number.isFinite(Number(point.width)))) return fallback;
    const distances = sourceDistances(definition);
    const total = distances[distances.length - 1] || 1;
    const target = Math.max(0, Math.min(1, Number(distance) / Math.max(.001, path.length))) * total;
    let right = 1;
    while (right < distances.length && distances[right] < target) right += 1;
    right = Math.min(right, points.length - 1);
    const left = Math.max(0, right - 1);
    const span = distances[right] - distances[left];
    const t = span <= 1e-6 ? 0 : (target - distances[left]) / span;
    const a = Number(points[left]?.width) || fallback;
    const b = Number(points[right]?.width) || fallback;
    return a + (b - a) * t;
  }

  function corridorInstances(definition, path, style) {
    if (style.rules?.movement === "open" && !style.rules?.cover && style.rules?.los === "clear") return [];
    const baseWidth = Number(definition.width) || style.width;
    const points = PATHS.samplePath(path, Math.max(.75, baseWidth * .45));
    const result = [];
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const widthA = widthAt(definition, style, path, a.distance);
      const widthB = widthAt(definition, style, path, b.distance);
      const pad = Math.max(widthA, widthB) / 2;
      const localWidth = Math.max(widthA, widthB);
      const rules = SEMANTICS?.normalize(style.rules, { width:localWidth, family:style.family, renderer:style.renderer }) ?? style.rules;
      result.push(Object.freeze({
        id:`${definition.id}::${index-1}`,
        linearPathId:definition.id,
        terrainId:`linear:${style.id}`,
        x:Math.min(a.x,b.x)-pad,
        y:Math.min(a.y,b.y)-pad,
        width:Math.abs(b.x-a.x)+pad*2,
        height:Math.abs(b.y-a.y)+pad*2,
        rotation:0,
        definition:runtimeDefinition(style, rules),
        rules,
        sourceKind:"linear",
        shape:"rect",
        localWidth
      }));
    }
    return result;
  }

  function compilePath(definition) {
    const style = validateDefinition(definition);
    const path = PATHS.createPath(definition);
    const pointWidths = (definition.points ?? []).map(point => Number(point.width)).filter(Number.isFinite);
    const width = Math.max(Number(definition.width) || style.width, ...pointWidths);
    return Object.freeze({
      definition:Object.freeze({ ...definition }),
      style,
      path,
      width,
      instances:Object.freeze(corridorInstances(definition, path, style))
    });
  }

  function compileScenario(scenario) {
    const visible = VISIBILITY?.isVisible ? item => VISIBILITY.isVisible(item) : item => item?.visible !== false && item?.hidden !== true;
    const paths = Object.freeze((scenario?.linearTerrain ?? []).filter(visible).map(compilePath));
    return Object.freeze({ paths, instances:Object.freeze(paths.flatMap(item => item.instances)) });
  }

  window.CrossroadsLinearTerrain = Object.freeze({ compilePath, compileScenario, widthAt });
})();
