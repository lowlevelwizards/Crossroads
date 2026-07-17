"use strict";

(() => {
  const STYLES = window.CROSSROADS_LINEAR_TERRAIN_STYLES;
  const PATHS = window.CrossroadsPathGeometry;

  function validateDefinition(definition) {
    const style = STYLES?.[definition?.styleId];
    if (!style) throw new Error(`Unknown linear terrain style: ${definition?.styleId}`);
    return style;
  }

  function runtimeDefinition(style) {
    return Object.freeze({ id:style.id, family:style.family, renderer:style.renderer, label:style.label, rules:style.rules, presentation:style.presentation });
  }

  function corridorInstances(definition, path, style) {
    if (style.rules?.movement === "open" && !style.rules?.cover && style.rules?.los === "clear") return [];
    const width = Number(definition.width) || style.width;
    const points = PATHS.samplePath(path, Math.max(0.75, width * 0.45));
    const result = [];
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const pad = width / 2;
      result.push(Object.freeze({
        id:`${definition.id}::${index-1}`,
        linearPathId:definition.id,
        terrainId:`linear:${style.id}`,
        x:Math.min(a.x,b.x)-pad,
        y:Math.min(a.y,b.y)-pad,
        width:Math.abs(b.x-a.x)+pad*2,
        height:Math.abs(b.y-a.y)+pad*2,
        rotation:0,
        definition:runtimeDefinition(style),
        rules:style.rules
      }));
    }
    return result;
  }

  function compilePath(definition) {
    const style = validateDefinition(definition);
    const path = PATHS.createPath(definition);
    return Object.freeze({
      definition:Object.freeze({ ...definition }),
      style,
      path,
      width:Number(definition.width) || style.width,
      instances:Object.freeze(corridorInstances(definition, path, style))
    });
  }

  function compileScenario(scenario) {
    const paths = Object.freeze((scenario?.linearTerrain ?? []).map(compilePath));
    return Object.freeze({ paths, instances:Object.freeze(paths.flatMap(item => item.instances)) });
  }

  window.CrossroadsLinearTerrain = Object.freeze({ compilePath, compileScenario });
})();
