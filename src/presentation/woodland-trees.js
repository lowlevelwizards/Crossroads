"use strict";

(() => {
  const LAYERS = window.CrossroadsLayerPolicy;

  const PALETTES = Object.freeze({
    temperate:Object.freeze({ dark:"#35513d", mid:"#58784f", light:"#98ad78", trunk:"#73583c", floor:"#516f48", edge:"#405c3e" }),
    dry:Object.freeze({ dark:"#565b3b", mid:"#7f8050", light:"#aaa26c", trunk:"#72543a", floor:"#6e7046", edge:"#565b3b" }),
    dark:Object.freeze({ dark:"#263d31", mid:"#46634a", light:"#71865a", trunk:"#654b36", floor:"#354f3b", edge:"#2a4032" }),
    autumn:Object.freeze({ dark:"#5e4d35", mid:"#9a6840", light:"#c38a50", trunk:"#694b32", floor:"#75633f", edge:"#584832" })
  });

  function createGroup(parent, className) {
    const group = document.createElement("span");
    group.className = className;
    group.setAttribute("aria-hidden", "true");
    parent.appendChild(group);
    return group;
  }

  function addCircles(parent, className, count) {
    const layer = createGroup(parent, `woods-tree-layer ${className}`);
    for (let index = 0; index < count; index += 1) createGroup(layer, `woods-tree-circle woods-tree-circle-${index + 1}`);
  }

  function buildTree(parent, options = {}) {
    const styleId = options.styleId || "woods";
    const material = options.material || "temperate";
    const palette = PALETTES[material] ?? PALETTES.temperate;
    const fragment = options.fragment || "complete";
    const tree = createGroup(parent, `woods-tree procedural-woodland-tree tree-preset-${options.preset || "balanced"}`);
    tree.classList.add(`procedural-${styleId}`, `tree-fragment-${fragment}`);
    if (options.className) tree.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
    tree.dataset.generatedId = String(options.id || "tree");
    if (options.patchId) tree.dataset.patchId = String(options.patchId);
    tree.dataset.treeFragment = fragment;
    tree.style.setProperty("--tree-x", options.xCss || "0%");
    tree.style.setProperty("--tree-y", options.yCss || "0%");
    tree.style.setProperty("--tree-size", options.sizeCss || "4%");
    tree.style.setProperty("--tree-scale", String(Number(options.scale) || 1));
    tree.style.setProperty("--tree-rotation", `${Number(options.rotation) || 0}deg`);
    tree.style.setProperty("--tree-dark", palette.dark);
    tree.style.setProperty("--tree-mid", palette.mid);
    tree.style.setProperty("--tree-light", palette.light);
    tree.style.setProperty("--tree-trunk", palette.trunk);
    if (options.zIndex !== undefined) tree.style.zIndex = String(options.zIndex);

    if (fragment === "complete" || fragment === "body") {
      createGroup(tree, "woods-tree-shadow");
      createGroup(tree, "woods-tree-trunk");
      addCircles(tree, "woods-tree-layer-dark", 5);
    }
    if (fragment === "complete" || fragment === "canopy") {
      addCircles(tree, "woods-tree-layer-mid", 5);
      addCircles(tree, "woods-tree-layer-light", 4);
    }
    return tree;
  }

  function createPercentTree(parent, placement, index, options = {}) {
    return buildTree(parent, {
      ...options,
      id:options.id || `tree-${index + 1}`,
      preset:placement.preset,
      xCss:`${placement.x}%`,
      yCss:`${placement.y}%`,
      sizeCss:`${placement.size}%`,
      scale:placement.scale,
      rotation:placement.rotation
    });
  }

  function tableTreeOptions(placement, table, patch) {
    const styleId = patch.styleId || "woods";
    const baseSize = styleId === "woods_dense" ? 3.55 : styleId === "orchard" ? 3.0 : 4.0;
    const size = baseSize * (Number(placement.scale) || 1);
    return {
      id:placement.id,
      patchId:patch.id,
      styleId,
      material:patch.material,
      preset:placement.preset,
      xCss:`${(Number(placement.x) - size / 2) / Number(table.width) * 100}%`,
      yCss:`${(Number(placement.y) - size / 2) / Number(table.height) * 100}%`,
      sizeCss:`${size / Number(table.width) * 100}%`,
      scale:1,
      rotation:placement.rotation,
      className:"terrain-patch-generated-tree scene-depth-object"
    };
  }

  function createTableTreeFragments(parent, placement, table, patch) {
    const base = tableTreeOptions(placement, table, patch);
    const bodyLayer = LAYERS?.woodlandBodyLayer(patch, placement.y, table.height) ?? 5000;
    const canopyLayer = LAYERS?.woodlandCanopyLayer(patch, placement.y, table.height) ?? bodyLayer + 56;
    const body = buildTree(parent, { ...base, fragment:"body", zIndex:bodyLayer, className:`${base.className} woodland-tree-body` });
    const canopy = buildTree(parent, { ...base, fragment:"canopy", zIndex:canopyLayer, className:`${base.className} woodland-tree-canopy` });
    return Object.freeze({ body, canopy });
  }

  function createTableTree(parent, placement, table, patch) {
    return createTableTreeFragments(parent, placement, table, patch).body;
  }

  function paletteFor(material) {
    return PALETTES[material] ?? PALETTES.temperate;
  }

  window.CrossroadsWoodlandTreePresentation = Object.freeze({ PALETTES, paletteFor, buildTree, createPercentTree, createTableTree, createTableTreeFragments });
})();
