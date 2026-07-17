"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STYLES = window.CROSSROADS_TERRAIN_PATCH_STYLES ?? {};
  const LAYERS = window.CrossroadsLayerPolicy;

  const PALETTES = Object.freeze({
    woods:Object.freeze({
      temperate:["#516f48", "#78915a", "#9aaa67", "#405c3e"],
      dry:["#6e7046", "#96905c", "#b2a66d", "#565b3b"],
      dark:["#354f3b", "#58704a", "#71865a", "#2a4032"]
    }),
    woods_dense:Object.freeze({
      temperate:["#3f6142", "#617c4d", "#83975c", "#2f4d36"],
      dry:["#5c633e", "#7d8050", "#9b925d", "#454d35"],
      dark:["#294537", "#466146", "#607955", "#20372d"]
    }),
    orchard:Object.freeze({
      temperate:["#657f4c", "#91a665", "#b2bb76", "#4a623d"],
      autumn:["#7a653f", "#b17b48", "#d09a56", "#5e4d35"]
    }),
    field_tilled:Object.freeze({
      brown:["#92724e", "#6f5138", "#b18d60"],
      dark:["#6a543f", "#493b30", "#89705a"],
      dry:["#a88e63", "#806b4e", "#c2ac7d"]
    }),
    field_wheat:Object.freeze({
      gold:["#b9954e", "#8d703d", "#d2b66a"],
      green:["#728450", "#52683f", "#9baa65"],
      cut:["#a98b57", "#7d6948", "#c0a477"]
    }),
    field_cabbage:Object.freeze({
      green:["#7c8952", "#4d6e43", "#9aaa65"],
      dark:["#5f7148", "#3e5d3b", "#82945c"]
    }),
    concrete:Object.freeze({
      weathered:["#9b9a90", "#77776f", "#b4b2a7"],
      pale:["#b7b5aa", "#8d8c84", "#cfcdc1"],
      dark:["#777872", "#595c58", "#91938c"]
    }),
    cobblestone:Object.freeze({
      grey:["#898a82", "#666962", "#a5a69c"],
      warm:["#918576", "#6e6255", "#afa18f"],
      dark:["#696b67", "#4b4e4b", "#858783"]
    }),
    mud:Object.freeze({
      wet:["#65513f", "#493b31", "#80684e"],
      churned:["#745d44", "#574532", "#927457"],
      dry:["#92775a", "#6f5b46", "#ac9271"]
    }),
    pond:Object.freeze({
      blue:["#72afc0", "#587f8b", "#b9d9df", "#697d57"],
      dark:["#557f90", "#3d606f", "#9fc2cc", "#5d7154"],
      marsh:["#78998e", "#5f7c72", "#bfd0b7", "#6b7851"]
    })
  });

  function node(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  }

  function safe(value) {
    return String(value ?? "patch").replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function pointsAttribute(points) {
    return (points ?? []).map(point => `${Number(point.x) || 0},${Number(point.y) || 0}`).join(" ");
  }

  function patternFor(defs, patch, style) {
    const material = patch.material || style.material;
    const palette = PALETTES[style.id]?.[material] ?? PALETTES[style.id]?.[style.material] ?? ["#888", "#666", "#aaa", "#555"];
    const id = `patch-pattern-${safe(patch.id)}`;
    const pattern = node("pattern", { id, width:4, height:4, patternUnits:"userSpaceOnUse", patternTransform:`rotate(${Number(patch.patternRotation) || 0})` });
    pattern.appendChild(node("rect", { width:4, height:4, fill:palette[0] }));

    if (style.id === "woods" || style.id === "woods_dense" || style.id === "orchard") {
      const positions = style.id === "woods_dense" ? [[.7,.7],[2.1,.8],[3.2,1.1],[1.2,2.4],[2.8,2.8],[.4,3.5]] : [[.9,.9],[3.0,1.0],[1.7,2.8],[3.5,3.4]];
      for (const [x, y] of positions) {
        pattern.appendChild(node("circle", { cx:x, cy:y, r:style.id === "orchard" ? .55 : .72, fill:palette[3] || palette[1], opacity:.96 }));
        pattern.appendChild(node("circle", { cx:x-.08, cy:y-.10, r:style.id === "orchard" ? .40 : .52, fill:palette[1] }));
        pattern.appendChild(node("circle", { cx:x-.16, cy:y-.22, r:style.id === "orchard" ? .22 : .29, fill:palette[2] }));
      }
    } else if (style.id === "field_tilled" || style.id === "field_wheat") {
      pattern.setAttribute("width", "3.2");
      pattern.setAttribute("height", "3.2");
      pattern.setAttribute("patternTransform", `rotate(${Number(patch.patternRotation) || -12})`);
      pattern.appendChild(node("path", { d:"M0 .55H3.2M0 1.55H3.2M0 2.55H3.2", stroke:palette[1], "stroke-width":.22, opacity:.7 }));
      pattern.appendChild(node("path", { d:"M0 .3H3.2M0 1.3H3.2M0 2.3H3.2", stroke:palette[2], "stroke-width":.08, opacity:.6 }));
    } else if (style.id === "field_cabbage") {
      for (let y=.55; y<4; y+=1.25) for (let x=.55; x<4; x+=1.25) {
        pattern.appendChild(node("circle", { cx:x, cy:y, r:.38, fill:palette[1] }));
        pattern.appendChild(node("circle", { cx:x-.08, cy:y-.08, r:.21, fill:palette[2] }));
      }
    } else if (style.id === "cobblestone") {
      pattern.setAttribute("width", "2.6");
      pattern.setAttribute("height", "1.7");
      pattern.appendChild(node("path", { d:"M0 .85H2.6M0 0V.85M1.3 .85V1.7M2.6 0V.85", stroke:palette[1], "stroke-width":.12, opacity:.78 }));
      pattern.appendChild(node("path", { d:"M.15 .15H1.1M1.5 1.05H2.45", stroke:palette[2], "stroke-width":.09, opacity:.38 }));
    } else if (style.id === "concrete") {
      pattern.appendChild(node("circle", { cx:.8, cy:1.0, r:.10, fill:palette[1], opacity:.45 }));
      pattern.appendChild(node("circle", { cx:2.9, cy:2.7, r:.13, fill:palette[2], opacity:.4 }));
      pattern.appendChild(node("path", { d:"M.4 3.4L1.5 3.1M2.2 .5L3.5 .9", stroke:palette[1], "stroke-width":.07, opacity:.32 }));
    } else if (style.id === "mud") {
      pattern.appendChild(node("ellipse", { cx:1.0, cy:1.1, rx:.7, ry:.35, fill:palette[1], opacity:.34 }));
      pattern.appendChild(node("ellipse", { cx:3.1, cy:2.8, rx:.65, ry:.28, fill:palette[2], opacity:.22 }));
    } else if (style.id === "pond") {
      pattern.appendChild(node("path", { d:"M.3 1.0C1.1 .6 1.8 .6 2.6 1M1.4 3C2.1 2.7 2.9 2.7 3.7 3", fill:"none", stroke:palette[2], "stroke-width":.10, opacity:.7 }));
    }
    defs.appendChild(pattern);
    return { id, palette };
  }

  function renderPatch(layer, scenario, patch, style) {
    if (!Array.isArray(patch.points) || patch.points.length < 3) return;
    const svg = node("svg", {
      class:`terrain-patch-svg terrain-patch-${safe(style.id)}`,
      viewBox:`0 0 ${scenario.table.width} ${scenario.table.height}`,
      preserveAspectRatio:"none",
      "aria-hidden":"true",
      "data-patch-id":patch.id,
      "data-patch-style":style.id,
      "data-patch-material":patch.material || style.material
    });
    svg.style.zIndex = String(LAYERS?.patchLayer(patch, style) ?? 110);
    const defs = node("defs");
    const { id, palette } = patternFor(defs, patch, style);
    svg.appendChild(defs);
    const polygon = node("polygon", {
      points:pointsAttribute(patch.points),
      fill:`url(#${id})`,
      class:"terrain-patch-shape",
      "stroke-linejoin":"round"
    });
    if (style.id === "pond") {
      polygon.setAttribute("stroke", palette[3] || "#697d57");
      polygon.setAttribute("stroke-width", String(Number(patch.bankWidth) || .78));
    } else {
      polygon.setAttribute("stroke", palette[1]);
      polygon.setAttribute("stroke-width", String(Number(patch.edgeWidth) || .12));
    }
    svg.appendChild(polygon);
    layer.appendChild(svg);
  }

  function renderScenarioTerrainPatches({ layer, scenario }) {
    if (!layer || !scenario) return;
    layer.querySelectorAll(":scope > .terrain-patch-svg").forEach(node => node.remove());
    for (const patch of scenario.terrainPatches ?? []) {
      if (patch?.visible === false || patch?.hidden === true) continue;
      const style = STYLES[patch.styleId];
      if (style) renderPatch(layer, scenario, patch, style);
    }
  }

  window.CrossroadsTerrainPatchPresentation = Object.freeze({ renderScenarioTerrainPatches });
})();
