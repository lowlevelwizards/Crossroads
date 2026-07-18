"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STYLES = window.CROSSROADS_TERRAIN_PATCH_STYLES ?? {};
  const LAYERS = window.CrossroadsLayerPolicy;
  const WOODLAND = window.CrossroadsWoodlandGenerator;
  const TREES = window.CrossroadsWoodlandTreePresentation;
  const VISIBILITY = window.CrossroadsScenarioVisibility;

  const PALETTES = Object.freeze({
    field_tilled:Object.freeze({ brown:["#92724e", "#6f5138", "#b18d60"], dark:["#6a543f", "#493b30", "#89705a"], dry:["#a88e63", "#806b4e", "#c2ac7d"] }),
    field_wheat:Object.freeze({ gold:["#b9954e", "#8d703d", "#d2b66a"], green:["#728450", "#52683f", "#9baa65"], cut:["#a98b57", "#7d6948", "#c0a477"] }),
    field_cabbage:Object.freeze({ green:["#7c8952", "#4d6e43", "#9aaa65"], dark:["#5f7148", "#3e5d3b", "#82945c"] }),
    concrete:Object.freeze({ weathered:["#9b9a90", "#77776f", "#b4b2a7"], pale:["#b7b5aa", "#8d8c84", "#cfcdc1"], dark:["#777872", "#595c58", "#91938c"] }),
    cobblestone:Object.freeze({ grey:["#898a82", "#666962", "#a5a69c"], warm:["#918576", "#6e6255", "#afa18f"], dark:["#696b67", "#4b4e4b", "#858783"] }),
    mud:Object.freeze({ wet:["#65513f", "#493b31", "#80684e"], churned:["#745d44", "#574532", "#927457"], dry:["#92775a", "#6f5b46", "#ac9271"] }),
    pond:Object.freeze({ blue:["#72afc0", "#587f8b", "#b9d9df", "#697d57"], dark:["#557f90", "#3d606f", "#9fc2cc", "#5d7154"], marsh:["#78998e", "#5f7c72", "#bfd0b7", "#6b7851"] })
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

  function visible(item) {
    return VISIBILITY?.isVisible ? VISIBILITY.isVisible(item) : item?.visible !== false && item?.hidden !== true;
  }

  function patternFor(defs, patch, style) {
    const material = patch.material || style.material;
    const palette = PALETTES[style.id]?.[material] ?? PALETTES[style.id]?.[style.material] ?? ["#888", "#666", "#aaa", "#555"];
    const id = `patch-pattern-${safe(patch.id)}`;
    const pattern = node("pattern", { id, width:4, height:4, patternUnits:"userSpaceOnUse", patternTransform:`rotate(${Number(patch.patternRotation) || 0})` });
    pattern.appendChild(node("rect", { width:4, height:4, fill:palette[0] }));

    if (style.id === "field_tilled" || style.id === "field_wheat") {
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

  function woodlandFloor(patch, style) {
    const palette = TREES?.paletteFor(patch.material || style.material) ?? { floor:"#516f48", edge:"#405c3e" };
    const dense = style.id === "woods_dense";
    return { fill:palette.floor, edge:palette.edge, opacity:dense ? .72 : style.id === "orchard" ? .44 : .56 };
  }

  function renderGround(layer, scenario, patch, style) {
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
    const polygonAttributes = { points:pointsAttribute(patch.points), class:"terrain-patch-shape", "stroke-linejoin":"round" };

    if (WOODLAND?.isWoodland(style.id)) {
      const floor = woodlandFloor(patch, style);
      Object.assign(polygonAttributes, { fill:floor.fill, "fill-opacity":floor.opacity, stroke:floor.edge, "stroke-width":Number(patch.edgeWidth) || .16 });
    } else {
      const defs = node("defs");
      const pattern = patternFor(defs, patch, style);
      svg.appendChild(defs);
      Object.assign(polygonAttributes, { fill:`url(#${pattern.id})` });
      if (style.id === "pond") Object.assign(polygonAttributes, { stroke:pattern.palette[3] || "#697d57", "stroke-width":Number(patch.bankWidth) || .78 });
      else Object.assign(polygonAttributes, { stroke:pattern.palette[1], "stroke-width":Number(patch.edgeWidth) || .12 });
    }
    svg.appendChild(node("polygon", polygonAttributes));
    layer.appendChild(svg);
  }

  function renderWoodlandTrees(battlefield, scenario, patch) {
    if (!battlefield || !WOODLAND?.isWoodland(patch.styleId) || !TREES?.createTableTree) return;
    for (const placement of WOODLAND.generate(patch)) TREES.createTableTree(battlefield, placement, scenario.table, patch);
  }

  function renderScenarioTerrainPatches({ layer, scenario, battlefield = null }) {
    if (!layer || !scenario) return;
    const board = battlefield ?? layer.closest?.(".battlefield");
    layer.querySelectorAll(":scope > .terrain-patch-svg").forEach(element => element.remove());
    board?.querySelectorAll?.(":scope > .terrain-patch-generated-tree").forEach(element => element.remove());
    for (const patch of scenario.terrainPatches ?? []) {
      if (!visible(patch) || !Array.isArray(patch.points) || patch.points.length < 3) continue;
      const style = STYLES[patch.styleId];
      if (!style) continue;
      renderGround(layer, scenario, patch, style);
      renderWoodlandTrees(board, scenario, patch);
    }
  }

  window.CrossroadsTerrainPatchPresentation = Object.freeze({ renderScenarioTerrainPatches, renderWoodlandTrees });
})();
