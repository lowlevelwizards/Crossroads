"use strict";

(() => {
  const DOCUMENT = window.CrossroadsEditorDocument;
  const VALIDATION = window.CrossroadsEditorValidation;
  const SCENARIOS = window.CROSSROADS_SCENARIOS;
  const TERRAIN_TYPES = window.CROSSROADS_TERRAIN_TYPES;
  const LINEAR_STYLES = window.CROSSROADS_LINEAR_TERRAIN_STYLES;
  const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES;
  const TERRAIN_PRESENTATION = window.CrossroadsTerrainPresentation;

  if (!DOCUMENT || !VALIDATION || !SCENARIOS || !TERRAIN_TYPES || !LINEAR_STYLES || !UNIT_TYPES || !TERRAIN_PRESENTATION) {
    throw new Error("Terrain Editor E1.2 dependencies did not load.");
  }

  const BASE_BOARD_WIDTH = 960;
  const HISTORY_LIMIT = 40;
  const PLAYTEST_STORAGE_KEY = "crossroads.editor.playtest";
  const LAST_SCENARIO_STORAGE_KEY = "crossroads.editor.lastScenario";
  const CUSTOM_SCENARIOS_STORAGE_KEY = "crossroads.editor.customScenarios";
  const scenarioSources = new Map(Object.entries(SCENARIOS));

  const refs = Object.freeze({
    scenarioSelect: document.getElementById("editorScenarioSelect"),
    scenarioTypeSelect: document.getElementById("scenarioTypeSelect"),
    newScenarioButton: document.getElementById("newScenarioButton"),
    returnToGameLink: document.getElementById("returnToGameLink"),
    terrainTypeSelect: document.getElementById("terrainTypeSelect"),
    linearStyleSelect: document.getElementById("linearStyleSelect"),
    unitFactionSelect: document.getElementById("unitFactionSelect"),
    unitTypeSelect: document.getElementById("unitTypeSelect"),
    addTerrainButton: document.getElementById("addTerrainButton"),
    addLinearButton: document.getElementById("addLinearButton"),
    linearDrawActions: document.getElementById("linearDrawActions"),
    finishLinearButton: document.getElementById("finishLinearButton"),
    cancelLinearButton: document.getElementById("cancelLinearButton"),
    addUnitButton: document.getElementById("addUnitButton"),
    addObjectiveButton: document.getElementById("addObjectiveButton"),
    objectiveTypeSelect: document.getElementById("objectiveTypeSelect"),
    resetScenarioButton: document.getElementById("resetScenarioButton"),
    fitButton: document.getElementById("fitButton"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomReadout: document.getElementById("zoomReadout"),
    showGridToggle: document.getElementById("showGridToggle"),
    showTerrainToggle: document.getElementById("showTerrainToggle"),
    showLinearToggle: document.getElementById("showLinearToggle"),
    showUnitsToggle: document.getElementById("showUnitsToggle"),
    showUnitLabelsToggle: document.getElementById("showUnitLabelsToggle"),
    showObjectivesToggle: document.getElementById("showObjectivesToggle"),
    showFootprintsToggle: document.getElementById("showFootprintsToggle"),
    showZonesToggle: document.getElementById("showZonesToggle"),
    snapToggle: document.getElementById("snapToggle"),
    objectList: document.getElementById("objectList"),
    objectFilterInput: document.getElementById("objectFilterInput"),
    objectCount: document.getElementById("objectCount"),
    viewport: document.getElementById("editorViewport"),
    stage: document.getElementById("editorStage"),
    board: document.getElementById("editorBoard"),
    gridLayer: document.getElementById("editorGridLayer"),
    terrainLayer: document.getElementById("terrainLayer"),
    deploymentLayer: document.getElementById("editorDeploymentLayer"),
    footprintLayer: document.getElementById("editorFootprintLayer"),
    objectiveLayer: document.getElementById("editorObjectiveLayer"),
    unitLayer: document.getElementById("editorUnitLayer"),
    interactionSvg: document.getElementById("editorInteractionSvg"),
    selectionLayer: document.getElementById("editorSelectionLayer"),
    scenarioTitleReadout: document.getElementById("scenarioTitleReadout"),
    scenarioSizeReadout: document.getElementById("scenarioSizeReadout"),
    cursorReadout: document.getElementById("cursorReadout"),
    selectionReadout: document.getElementById("selectionReadout"),
    saveReadout: document.getElementById("saveReadout"),
    selectionKindBadge: document.getElementById("selectionKindBadge"),
    inspectorEmpty: document.getElementById("inspectorEmpty"),
    inspectorForm: document.getElementById("inspectorForm"),
    selectionActions: document.getElementById("selectionActions"),
    duplicateSelectionButton: document.getElementById("duplicateSelectionButton"),
    deleteSelectionButton: document.getElementById("deleteSelectionButton"),
    validationCount: document.getElementById("validationCount"),
    validationSummary: document.getElementById("validationSummary"),
    validationList: document.getElementById("validationList"),
    scenarioDataPreview: document.getElementById("scenarioDataPreview"),
    copyJsonButton: document.getElementById("copyJsonButton"),
    copyJsButton: document.getElementById("copyJsButton"),
    downloadJsonButton: document.getElementById("downloadJsonButton"),
    importJsonButton: document.getElementById("importJsonButton"),
    importFileInput: document.getElementById("importFileInput"),
    playtestButton: document.getElementById("playtestButton"),
    undoButton: document.getElementById("undoButton"),
    redoButton: document.getElementById("redoButton"),
    newScenarioDialog: document.getElementById("newScenarioDialog"),
    newScenarioForm: document.getElementById("newScenarioForm"),
    newScenarioTemplate: document.getElementById("newScenarioTemplate"),
    newScenarioTitle: document.getElementById("newScenarioTitle"),
    newScenarioId: document.getElementById("newScenarioId"),
    newScenarioWidth: document.getElementById("newScenarioWidth"),
    newScenarioHeight: document.getElementById("newScenarioHeight"),
    newScenarioRounds: document.getElementById("newScenarioRounds"),
    newScenarioType: document.getElementById("newScenarioType"),
    newScenarioStartingFaction: document.getElementById("newScenarioStartingFaction")
  });

  const state = {
    sourceScenarioId: "mokra",
    sourceDocument: null,
    document: null,
    selection: null,
    zoom: 1,
    history: [],
    future: [],
    drag: null,
    pan: null,
    drawingPath: null,
    drawingCursor: null,
    issues: [],
    showGrid: true,
    showTerrain: true,
    showLinear: true,
    showUnits: true,
    showUnitLabels: true,
    showObjectives: true,
    showFootprints: false,
    showZones: true,
    snap: true,
    objectFilter: "",
    spacePressed: false,
    status: "Source loaded"
  };

  function option(value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function loadCustomScenarioSources() {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_SCENARIOS_STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return;
      for (const source of saved) {
        try {
          const scenario = DOCUMENT.create(source);
          scenarioSources.set(scenario.id, scenario);
        } catch (_error) { /* Ignore invalid saved drafts. */ }
      }
    } catch (_error) { /* Storage is optional. */ }
  }

  function persistCustomScenario(source) {
    try {
      const builtInIds = new Set(Object.keys(SCENARIOS));
      const custom = [...scenarioSources.values()].filter(item => !builtInIds.has(item.id));
      const index = custom.findIndex(item => item.id === source.id);
      if (index >= 0) custom[index] = DOCUMENT.create(source);
      else custom.push(DOCUMENT.create(source));
      localStorage.setItem(CUSTOM_SCENARIOS_STORAGE_KEY, JSON.stringify(custom));
    } catch (_error) { /* Storage is optional. */ }
  }

  function refreshScenarioSelect(selectedId = refs.scenarioSelect.value) {
    refs.scenarioSelect.replaceChildren();
    const scenarios = [...scenarioSources.values()].sort((a, b) => {
      const aBuiltIn = Boolean(SCENARIOS[a.id]);
      const bBuiltIn = Boolean(SCENARIOS[b.id]);
      if (aBuiltIn !== bBuiltIn) return aBuiltIn ? -1 : 1;
      return String(a.title).localeCompare(String(b.title));
    });
    for (const scenario of scenarios) refs.scenarioSelect.appendChild(option(scenario.id, scenario.title));
    refs.scenarioSelect.value = scenarioSources.has(selectedId) ? selectedId : scenarios[0]?.id || "";
  }

  function requestedScenarioId() {
    const fallback = scenarioSources.has("mokra") ? "mokra" : scenarioSources.keys().next().value;
    const fromUrl = new URLSearchParams(window.location.search).get("scenario");
    if (fromUrl && scenarioSources.has(fromUrl)) return fromUrl;
    try {
      const remembered = localStorage.getItem(LAST_SCENARIO_STORAGE_KEY);
      if (remembered && scenarioSources.has(remembered)) return remembered;
    } catch (_error) { /* Storage is optional. */ }
    return fallback;
  }

  function initializeSelects() {
    loadCustomScenarioSources();
    refreshScenarioSelect(requestedScenarioId());
    const terrainEntries = Object.values(TERRAIN_TYPES).sort((a, b) => `${a.family} ${a.label}`.localeCompare(`${b.family} ${b.label}`));
    for (const definition of terrainEntries) refs.terrainTypeSelect.appendChild(option(definition.id, `${definition.family} · ${definition.label}`));
    for (const style of Object.values(LINEAR_STYLES)) refs.linearStyleSelect.appendChild(option(style.id, `${style.family} · ${style.label}`));
    for (const [id, definition] of Object.entries(UNIT_TYPES)) refs.unitTypeSelect.appendChild(option(id, definition.name));
  }

  function table() {
    return state.document.table;
  }

  function percent(value, total) {
    return `${number(value) / number(total, 1) * 100}%`;
  }

  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function snap(value) {
    if (!state.snap) return value;
    return Math.round(value * 4) / 4;
  }

  function scenarioType(scenario = state.document) {
    const explicit = String(scenario?.victory?.type || "");
    if (["control", "breakthrough", "delay", "elimination", "survival", "escort", "custom"].includes(explicit)) return explicit;
    if (scenario?.id === "breakthrough") return "breakthrough";
    if (scenario?.scoring?.type === "breakthrough") return "breakthrough";
    return "control";
  }

  function saveCustomDraft() {
    if (!state.document || SCENARIOS[state.sourceScenarioId]) return;
    const draft = DOCUMENT.create(state.document);
    scenarioSources.set(draft.id, draft);
    persistCustomScenario(draft);
    state.sourceScenarioId = draft.id;
    refreshScenarioSelect(draft.id);
  }

  function beforeMutation() {
    return DOCUMENT.serialize(state.document, 0);
  }

  function commit(before, message) {
    const after = DOCUMENT.serialize(state.document, 0);
    if (before === after) return;
    state.history.push(before);
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.future = [];
    state.status = message;
    saveCustomDraft();
    renderAll();
  }

  function restoreSerialized(serialized, message) {
    state.document = DOCUMENT.create(JSON.parse(serialized));
    state.selection = null;
    state.status = message;
    renderAll();
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(DOCUMENT.serialize(state.document, 0));
    restoreSerialized(state.history.pop(), "Undo applied");
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(DOCUMENT.serialize(state.document, 0));
    restoreSerialized(state.future.pop(), "Redo applied");
  }

  function loadScenario(id) {
    const source = scenarioSources.get(id);
    if (!source) return;
    state.sourceScenarioId = id;
    state.sourceDocument = DOCUMENT.create(source);
    state.document = DOCUMENT.create(source);
    state.selection = null;
    state.drawingPath = null;
    state.drawingCursor = null;
    state.history = [];
    state.future = [];
    state.status = `Loaded ${source.title}`;
    refs.scenarioSelect.value = id;
    refs.scenarioTypeSelect.value = scenarioType(state.document);
    if (refs.returnToGameLink) refs.returnToGameLink.href = `index.html?fromEditor=1&scenario=${encodeURIComponent(id)}`;
    try { localStorage.setItem(LAST_SCENARIO_STORAGE_KEY, id); } catch (error) { /* Storage is optional. */ }
    renderAll();
    requestAnimationFrame(fitTable);
  }

  function resetScenario() {
    if (!state.sourceDocument) return;
    const before = beforeMutation();
    state.document = DOCUMENT.create(state.sourceDocument);
    state.selection = null;
    commit(before, "Reset to source scenario");
  }

  function selectionKey(selection) {
    if (!selection) return "";
    return [selection.kind, selection.faction, selection.id, selection.zoneId, selection.pointIndex, selection.segmentIndex].filter(value => value !== undefined && value !== null).join(":");
  }

  function select(selection) {
    state.selection = selection ? { ...selection } : null;
    renderSelectionAndInspector();
    renderObjectList();
    renderValidation();
  }

  function zoneForSelection(selection = state.selection) {
    if (selection?.kind !== "zone") return null;
    const root = state.document.deployment?.zones?.[selection.faction];
    if (!root) return null;
    if (!selection.zoneId || selection.zoneId === "__main") return root;
    return (root.subzones ?? []).find(zone => String(zone.id) === String(selection.zoneId)) ?? null;
  }

  function itemForSelection(selection = state.selection) {
    if (!selection) return null;
    if (selection.kind === "zone") return zoneForSelection(selection);
    return DOCUMENT.find(state.document, selection);
  }

  function pointForSelection(selection = state.selection) {
    const item = itemForSelection(selection);
    if (!item || selection?.pointIndex === undefined || selection?.pointIndex === null) return null;
    if (selection.kind === "linear") return item.points?.[selection.pointIndex] ?? null;
    if (selection.kind === "objective" && item.type === "control_group") return item.points?.[selection.pointIndex] ?? null;
    return null;
  }

  function setupBoardGeometry() {
    const width = number(table().width, 72);
    const height = number(table().height, 48);
    const boardHeight = BASE_BOARD_WIDTH * height / width;
    refs.board.style.width = `${BASE_BOARD_WIDTH}px`;
    refs.board.style.height = `${boardHeight}px`;
    refs.board.style.transform = `scale(${state.zoom})`;
    refs.stage.style.width = `${BASE_BOARD_WIDTH * state.zoom}px`;
    refs.stage.style.height = `${boardHeight * state.zoom}px`;
    refs.interactionSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    refs.gridLayer.style.setProperty("--editor-grid-x", `${100 / width}%`);
    refs.gridLayer.style.setProperty("--editor-grid-y", `${100 / height}%`);
    refs.gridLayer.hidden = !state.showGrid;
    refs.deploymentLayer.hidden = !state.showZones;
    refs.footprintLayer.hidden = !state.showFootprints;
    refs.objectiveLayer.hidden = !state.showObjectives;
    refs.unitLayer.hidden = !state.showUnits;
    refs.board.classList.toggle("is-drawing-path", Boolean(state.drawingPath));
    refs.board.classList.toggle("is-panning", Boolean(state.pan));
    refs.board.classList.toggle("can-pan", !state.drawingPath && !state.pan);
    refs.viewport.classList.toggle("is-panning", Boolean(state.pan));
    refs.zoomReadout.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function renderTerrain() {
    TERRAIN_PRESENTATION.renderScenarioTerrain({ layer:refs.terrainLayer, scenario:state.document });
    for (const element of refs.terrainLayer.querySelectorAll(".terrain-piece")) {
      element.hidden = !state.showTerrain;
      element.dataset.editorKind = "terrain";
      if (state.selection?.kind === "terrain" && String(state.selection.id) === String(element.dataset.terrainInstanceId)) element.classList.add("is-editor-selected");
    }
    const linearSvg = refs.terrainLayer.querySelector(".linear-terrain-svg");
    if (linearSvg) linearSvg.hidden = !state.showLinear;
  }

  function renderZones() {
    refs.deploymentLayer.replaceChildren();
    if (!state.showZones) return;
    for (const faction of ["blue", "red"]) {
      const root = state.document.deployment?.zones?.[faction];
      if (!root) continue;
      appendZone(root, faction, "__main", false);
      for (const subzone of root.subzones ?? []) appendZone(subzone, faction, subzone.id, true);
    }
  }

  function appendZone(zone, faction, zoneId, isSubzone) {
    const node = document.createElement("div");
    node.className = `editor-zone ${faction}${isSubzone ? " is-subzone" : ""}`;
    node.dataset.editorKind = "zone";
    node.dataset.faction = faction;
    node.dataset.zoneId = zoneId;
    node.style.left = percent(zone.xMin, table().width);
    node.style.top = percent(zone.yMin, table().height);
    node.style.width = percent(number(zone.xMax) - number(zone.xMin), table().width);
    node.style.height = percent(number(zone.yMax) - number(zone.yMin), table().height);
    const label = document.createElement("span");
    label.className = "editor-zone-label";
    label.textContent = zone.label || `${faction} zone`;
    node.appendChild(label);
    refs.deploymentLayer.appendChild(node);
  }

  function unitAbbreviation(unit) {
    return UNIT_TYPES[unit.unitType]?.short ?? "?";
  }

  function renderUnits() {
    refs.unitLayer.replaceChildren();
    for (const faction of ["blue", "red"]) {
      for (const unit of state.document.forces?.[faction] ?? []) {
        const node = document.createElement("div");
        node.className = `editor-unit ${faction}`;
        node.dataset.editorKind = "unit";
        node.dataset.unitId = unit.id;
        node.dataset.faction = faction;
        node.style.left = percent(unit.x, table().width);
        node.style.top = percent(unit.y, table().height);
        node.textContent = unitAbbreviation(unit);
        node.title = unit.name || UNIT_TYPES[unit.unitType]?.name || unit.id;
        const label = document.createElement("span");
        label.className = `editor-unit-label${state.showUnitLabels ? "" : " is-hidden"}`;
        label.textContent = unit.name || unit.id;
        node.appendChild(label);
        refs.unitLayer.appendChild(node);
      }
    }
  }

  function renderObjectives() {
    refs.objectiveLayer.replaceChildren();
    for (const objective of state.document.objectives ?? []) {
      const points = objective.type === "control_group" ? objective.points ?? [] : [objective];
      points.forEach((point, pointIndex) => {
        const node = document.createElement("div");
        const radius = Math.max(0.7, number(point.radius, number(objective.radius, 2)));
        node.className = "editor-objective";
        node.dataset.editorKind = "objective";
        node.dataset.objectiveId = objective.id;
        node.dataset.objectiveType = objective.type || "control_zone";
        if (objective.type === "control_group") node.dataset.pointIndex = String(pointIndex);
        node.style.left = percent(point.x, table().width);
        node.style.top = percent(point.y, table().height);
        node.style.width = percent(radius * 2, table().width);
        node.style.height = percent(radius * 2, table().height);
        const label = document.createElement("span");
        label.className = "editor-objective-label";
        label.textContent = point.label || objective.label || objective.id;
        node.appendChild(label);
        refs.objectiveLayer.appendChild(node);
      });
    }
  }

  function svgNode(name, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function renderLinearInteraction() {
    refs.interactionSvg.replaceChildren();
    refs.interactionSvg.hidden = !state.showLinear && !state.drawingPath;
    if (refs.interactionSvg.hidden) return;
    for (const path of state.document.linearTerrain ?? []) {
      if (!Array.isArray(path.points) || path.points.length < 2) continue;
      const selected = state.selection?.kind === "linear" && String(state.selection.id) === String(path.id);
      const points = path.points.map(point => `${number(point.x)},${number(point.y)}`).join(" ");
      if (selected) refs.interactionSvg.appendChild(svgNode("polyline", { points, class:"editor-linear-highlight" }));
      for (let index = 0; index < path.points.length - 1; index += 1) {
        const a = path.points[index];
        const b = path.points[index + 1];
        const segmentSelected = selected && state.selection.segmentIndex === index;
        if (segmentSelected) {
          refs.interactionSvg.appendChild(svgNode("line", { x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-linear-segment-highlight" }));
        }
        refs.interactionSvg.appendChild(svgNode("line", {
          x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-linear-segment-hit",
          "data-editor-kind":"segment", "data-linear-id":path.id, "data-segment-index":index
        }));
      }
      if (!selected) continue;
      path.points.forEach((point, index) => {
        const circle = svgNode("circle", {
          cx:number(point.x), cy:number(point.y), r:.62,
          class:`editor-waypoint${state.selection.pointIndex === index ? " is-selected" : ""}`,
          "data-editor-kind":"waypoint", "data-linear-id":path.id, "data-point-index":index
        });
        const text = svgNode("text", { x:number(point.x), y:number(point.y) + .05, class:"editor-waypoint-index" });
        text.textContent = String(index + 1);
        refs.interactionSvg.append(circle, text);
      });
    }
    if (state.drawingPath) {
      const preview = [...state.drawingPath.points];
      if (state.drawingCursor && preview.length) preview.push(state.drawingCursor);
      if (preview.length >= 2) {
        refs.interactionSvg.appendChild(svgNode("polyline", {
          points:preview.map(point => `${number(point.x)},${number(point.y)}`).join(" "),
          class:"editor-drawing-path"
        }));
      }
      state.drawingPath.points.forEach(point => refs.interactionSvg.appendChild(svgNode("circle", {
        cx:number(point.x), cy:number(point.y), r:.48, class:"editor-drawing-waypoint"
      })));
    }
  }

  function renderFootprints() {
    refs.footprintLayer.replaceChildren();
    if (!state.showFootprints) return;
    for (const terrain of state.document.terrain ?? []) {
      const definition = TERRAIN_TYPES[terrain.terrainId];
      if (!definition || (definition.rules?.movement !== "impassable" && !definition.rules?.cover)) continue;
      const rect = VALIDATION.rulesRect(terrain, TERRAIN_TYPES);
      const node = document.createElement("div");
      node.className = "editor-footprint";
      node.style.left = percent(rect.x, table().width);
      node.style.top = percent(rect.y, table().height);
      node.style.width = percent(rect.width, table().width);
      node.style.height = percent(rect.height, table().height);
      refs.footprintLayer.appendChild(node);
    }
  }

  function renderSelectionBox() {
    refs.selectionLayer.replaceChildren();
    const selection = state.selection;
    const item = itemForSelection();
    if (!selection || !item) return;
    if ((selection.kind === "terrain" && !state.showTerrain) ||
        (selection.kind === "unit" && !state.showUnits) ||
        (selection.kind === "objective" && !state.showObjectives) ||
        (selection.kind === "zone" && !state.showZones)) return;
    let rect = null;
    let pointLike = false;
    let rotation = 0;
    let resizable = false;
    let rotatable = false;

    if (selection.kind === "terrain") {
      rect = { x:number(item.x), y:number(item.y), width:number(item.width), height:number(item.height) };
      rotation = number(item.rotation);
      const definition = TERRAIN_TYPES[item.terrainId];
      resizable = Boolean(definition?.editor?.resizable);
      rotatable = Boolean(definition?.editor?.rotatable);
    } else if (selection.kind === "unit") {
      rect = { x:number(item.x), y:number(item.y), width:1.8, height:1.8 };
      pointLike = true;
    } else if (selection.kind === "objective") {
      const point = pointForSelection() ?? item;
      const radius = Math.max(.7, number(point.radius, number(item.radius, 2)));
      rect = { x:number(point.x), y:number(point.y), width:radius * 2, height:radius * 2 };
      pointLike = true;
      resizable = true;
    } else if (selection.kind === "zone") {
      rect = { x:number(item.xMin), y:number(item.yMin), width:number(item.xMax) - number(item.xMin), height:number(item.yMax) - number(item.yMin) };
      resizable = true;
    }

    if (!rect) return;
    const node = document.createElement("div");
    node.className = `editor-selection-box${pointLike ? " is-point" : ""}`;
    if (pointLike) {
      node.style.left = percent(rect.x, table().width);
      node.style.top = percent(rect.y, table().height);
    } else {
      node.style.left = percent(rect.x, table().width);
      node.style.top = percent(rect.y, table().height);
    }
    node.style.width = percent(rect.width, table().width);
    node.style.height = percent(rect.height, table().height);
    if (rotation) node.style.transform = `rotate(${rotation}deg)`;
    if (resizable) {
      const handle = document.createElement("span");
      handle.className = "editor-selection-handle editor-resize-handle";
      handle.dataset.editorAction = selection.kind === "objective" ? "resize-objective" : "resize";
      node.appendChild(handle);
    }
    if (rotatable) {
      const stem = document.createElement("span");
      stem.className = "editor-rotate-stem";
      const handle = document.createElement("span");
      handle.className = "editor-selection-handle editor-rotate-handle";
      handle.dataset.editorAction = "rotate";
      node.append(stem, handle);
    }
    refs.selectionLayer.appendChild(node);
  }

  function renderObjectList() {
    refs.objectList.replaceChildren();
    const zones = [];
    for (const faction of ["blue", "red"]) {
      const root = state.document.deployment?.zones?.[faction];
      if (!root) continue;
      zones.push({ selection:{kind:"zone", faction, zoneId:"__main"}, label:root.label || `${faction} deployment`, detail:"zone" });
      for (const zone of root.subzones ?? []) zones.push({ selection:{kind:"zone", faction, zoneId:zone.id}, label:zone.label || zone.id, detail:`${faction} subzone` });
    }
    const groups = [
      ["Discrete terrain", (state.document.terrain ?? []).map(item => ({ selection:{kind:"terrain", id:item.id}, label:item.id, detail:TERRAIN_TYPES[item.terrainId]?.label || item.terrainId }))],
      ["Linear terrain", (state.document.linearTerrain ?? []).map(item => ({ selection:{kind:"linear", id:item.id}, label:item.id, detail:LINEAR_STYLES[item.styleId]?.label || item.styleId }))],
      ["Objectives", (state.document.objectives ?? []).map(item => ({ selection:{kind:"objective", id:item.id}, label:item.label || item.id, detail:(item.type || "control_zone").replaceAll("_", " ") }))],
      ["Deployment zones", zones],
      ["Polish / Blue units", (state.document.forces?.blue ?? []).map(item => ({ selection:{kind:"unit", id:item.id, faction:"blue"}, label:item.name || item.id, detail:unitAbbreviation(item) }))],
      ["German / Red units", (state.document.forces?.red ?? []).map(item => ({ selection:{kind:"unit", id:item.id, faction:"red"}, label:item.name || item.id, detail:unitAbbreviation(item) }))]
    ];
    const filter = state.objectFilter.trim().toLowerCase();
    let count = 0;
    for (const [title, sourceItems] of groups) {
      const items = filter ? sourceItems.filter(entry => `${entry.label} ${entry.detail} ${title}`.toLowerCase().includes(filter)) : sourceItems;
      if (!items.length) continue;
      const heading = document.createElement("div");
      heading.className = "editor-object-group-title";
      heading.textContent = title;
      refs.objectList.appendChild(heading);
      for (const entry of items) {
        count += 1;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `editor-object-item${selectionKey(entry.selection) === selectionKey(state.selection) ? " is-selected" : ""}`;
        button.dataset.selection = JSON.stringify(entry.selection);
        button.innerHTML = `<span>${escapeHtml(entry.label)}</span><small>${escapeHtml(entry.detail)}</small>`;
        refs.objectList.appendChild(button);
      }
    }
    if (!count) {
      const empty = document.createElement("div");
      empty.className = "editor-object-empty";
      empty.textContent = filter ? "No objects match this filter." : "This scenario has no objects yet.";
      refs.objectList.appendChild(empty);
    }
    refs.objectCount.textContent = String(count);
    requestAnimationFrame(() => {
      const selected = refs.objectList.querySelector(".is-selected");
      if (!selected) return;
      const top = selected.offsetTop;
      const bottom = top + selected.offsetHeight;
      if (top < refs.objectList.scrollTop) refs.objectList.scrollTop = top;
      else if (bottom > refs.objectList.scrollTop + refs.objectList.clientHeight) refs.objectList.scrollTop = bottom - refs.objectList.clientHeight;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[character]);
  }

  function field(label, path, value, options = {}) {
    const classes = options.full ? " class=\"editor-field-full\"" : "";
    const type = options.type || "number";
    if (options.choices) {
      const choices = options.choices.map(choice => `<option value="${escapeHtml(choice.value)}"${String(choice.value) === String(value) ? " selected" : ""}>${escapeHtml(choice.label)}</option>`).join("");
      return `<label${classes}>${escapeHtml(label)}<select data-field="${escapeHtml(path)}">${choices}</select></label>`;
    }
    const step = options.step ?? (type === "number" ? ".25" : undefined);
    const attributes = [
      `type="${type}"`,
      `data-field="${escapeHtml(path)}"`,
      `value="${escapeHtml(value ?? "")}"`,
      step ? `step="${step}"` : "",
      options.min !== undefined ? `min="${options.min}"` : "",
      options.readonly ? "readonly" : ""
    ].filter(Boolean).join(" ");
    return `<label${classes}>${escapeHtml(label)}<input ${attributes}></label>`;
  }

  function choiceEntries(source, labelKey = "label") {
    return Object.entries(source).map(([value, item]) => ({ value, label:item[labelKey] || item.name || value }));
  }

  function capChoices() {
    return ["none", "grass", "taper", "off_table", "junction"].map(value => ({ value, label:value.replace("_", " ") }));
  }

  function objectiveTypeChoices() {
    return [
      ["control_zone", "Control point"],
      ["control_group", "Control group"],
      ["crossing", "Crossing"],
      ["exit_unit", "Exit edge"],
      ["destroy_target", "Destroy target"],
      ["protect_target", "Protect target"],
      ["unit_objective", "Unit objective"],
      ["custom", "Custom marker"]
    ].map(([value, label]) => ({ value, label }));
  }

  function renderInspector() {
    const selection = state.selection;
    const item = itemForSelection();
    refs.selectionKindBadge.textContent = selection?.kind?.toUpperCase() || "NONE";
    refs.inspectorEmpty.hidden = Boolean(item);
    refs.inspectorForm.hidden = !item;
    refs.selectionActions.hidden = !item;
    refs.duplicateSelectionButton.disabled = !item || selection.kind === "zone" || selection.pointIndex !== undefined || selection.segmentIndex !== undefined;
    refs.deleteSelectionButton.disabled = !item || selection.kind === "zone" || (selection.kind === "objective" && selection.pointIndex !== undefined);
    if (!item) {
      refs.inspectorForm.innerHTML = "";
      return;
    }

    let html = "";
    if (selection.kind === "terrain") {
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Terrain type", "terrainId", item.terrainId, { choices:choiceEntries(TERRAIN_TYPES) , full:true });
      html += field("X", "x", item.x);
      html += field("Y", "y", item.y);
      html += field("Width", "width", item.width, { min:.25 });
      html += field("Height", "height", item.height, { min:.25 });
      html += field("Rotation", "rotation", item.rotation ?? 0, { step:"1" });
      html += field("Visual scale", "visualScale", item.visualScale ?? 1, { step:".05", min:.25 });
    } else if (selection.kind === "linear") {
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Style", "styleId", item.styleId, { choices:choiceEntries(LINEAR_STYLES), full:true });
      html += field("Width", "width", item.width ?? LINEAR_STYLES[item.styleId]?.width ?? 2, { min:.25 });
      html += field("Smoothing", "smoothing", item.smoothing ?? 0, { step:".05", min:0 });
      html += field("Start cap", "start.cap", item.start?.cap ?? "none", { choices:capChoices() });
      html += field("End cap", "end.cap", item.end?.cap ?? "none", { choices:capChoices() });
      if (selection.pointIndex !== undefined) {
        const point = pointForSelection();
        html += `<p class="editor-inspector-note">Waypoint ${selection.pointIndex + 1} of ${item.points.length}. Drag it on the table or edit its coordinates.</p>`;
        html += field("Waypoint X", "@point.x", point?.x ?? 0);
        html += field("Waypoint Y", "@point.y", point?.y ?? 0);
        html += `<div class="editor-waypoint-actions"><button class="editor-button" type="button" data-editor-command="insert-waypoint">Insert after</button><button class="editor-button editor-button-danger" type="button" data-editor-command="remove-waypoint"${item.points.length <= 2 ? " disabled" : ""}>Remove point</button></div>`;
      } else if (selection.segmentIndex !== undefined) {
        html += `<p class="editor-inspector-note">Section ${selection.segmentIndex + 1} of ${item.points.length - 1}. Deleting an end section shortens the path; deleting a middle section splits it into two paths.</p>`;
        html += `<div class="editor-segment-actions"><button class="editor-button" type="button" data-editor-command="insert-segment-waypoint">Add midpoint</button><button class="editor-button editor-button-danger" type="button" data-editor-command="delete-segment">Delete section</button></div>`;
      } else {
        html += `<p class="editor-inspector-note">Select a numbered waypoint to move it, or click an individual section to insert a midpoint or delete that section.</p>`;
      }
    } else if (selection.kind === "unit") {
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Name", "name", item.name ?? "", { type:"text", full:true });
      html += field("Unit type", "unitType", item.unitType, { choices:choiceEntries(UNIT_TYPES, "name"), full:true });
      html += field("Quality", "quality", item.quality ?? "regular", { choices:["inexperienced","regular","veteran"].map(value => ({ value, label:value })) });
      html += field("Faction", "@faction", selection.faction, { type:"text", readonly:true });
      html += field("X", "x", item.x);
      html += field("Y", "y", item.y);
      html += field("Deployment zone", "deploymentZone", item.deploymentZone ?? "", { type:"text", full:true });
    } else if (selection.kind === "objective") {
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Label", "label", item.label ?? "", { type:"text", full:true });
      html += field("Objective type", "type", item.type ?? "control_zone", { choices:objectiveTypeChoices(), full:true });
      const selectedPoint = pointForSelection();
      const point = selectedPoint ?? item;
      const prefix = selectedPoint ? "@point." : "";
      html += field("X", `${prefix}x`, point.x ?? table().width / 2);
      html += field("Y", `${prefix}y`, point.y ?? table().height / 2);
      html += field("Radius", `${prefix}radius`, point.radius ?? item.radius ?? 2, { min:.25 });
      if (item.type === "control_group") {
        if (selectedPoint) html += `<p class="editor-inspector-note">Editing control point ${selection.pointIndex + 1} of ${item.points.length}.</p>`;
        else html += `<div class="editor-waypoint-actions"><button class="editor-button" type="button" data-editor-command="add-objective-point">Add control point</button><button class="editor-button editor-button-danger" type="button" data-editor-command="remove-last-objective-point"${(item.points?.length ?? 0) <= 1 ? " disabled" : ""}>Remove last</button></div>`;
      } else if (item.type === "exit_unit") {
        html += field("Exit edge", "edge", item.edge ?? "red", { choices:["blue","red","top","bottom"].map(value => ({value,label:value})) });
        html += field("Faction", "faction", item.faction ?? "red", { choices:[{value:"blue",label:"blue"},{value:"red",label:"red"}] });
        html += field("Zone depth", "depth", item.depth ?? 3, { min:.25 });
        html += field("Points / unit", "pointsPerUnit", item.pointsPerUnit ?? 2, { min:0 });
      } else if (item.type === "destroy_target" || item.type === "protect_target") {
        html += field("Target object ID", "targetId", item.targetId ?? "", { type:"text", full:true });
      } else if (item.type === "unit_objective") {
        html += field("Target unit ID", "unitId", item.unitId ?? "", { type:"text", full:true });
      } else if (item.type === "crossing") {
        html += field("Path / crossing ID", "pathId", item.pathId ?? "", { type:"text", full:true });
      }
    } else if (selection.kind === "zone") {
      html += field("Label", "label", item.label ?? "", { type:"text", full:true });
      html += field("X min", "xMin", item.xMin);
      html += field("X max", "xMax", item.xMax);
      html += field("Y min", "yMin", item.yMin);
      html += field("Y max", "yMax", item.yMax);
      html += `<p class="editor-inspector-note">Deployment zones can be moved and resized. Unit validation uses named subzones when a unit has a deploymentZone value.</p>`;
    }
    refs.inspectorForm.innerHTML = html;
  }

  function renderValidation() {
    state.issues = VALIDATION.validateScenario(state.document);
    refs.validationCount.textContent = String(state.issues.length);
    refs.validationList.replaceChildren();
    const errors = state.issues.filter(item => item.level === "error").length;
    const warnings = state.issues.length - errors;
    refs.validationSummary.className = `editor-validation-summary${errors ? " has-errors" : state.issues.length ? "" : " is-clean"}`;
    refs.validationSummary.textContent = state.issues.length ? `${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"}` : "Scenario passes current E1 validation.";
    for (const item of state.issues) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `editor-validation-item ${item.level}`;
      button.textContent = item.message;
      if (item.selection) button.dataset.selection = JSON.stringify(item.selection);
      refs.validationList.appendChild(button);
    }
  }

  function renderSelectionAndInspector() {
    renderSelectionBox();
    renderInspector();
    refs.selectionReadout.textContent = state.selection ? `Selected: ${selectionKey(state.selection)}` : "Nothing selected";
  }

  function renderDataPreview() {
    refs.scenarioDataPreview.value = DOCUMENT.serialize(state.document, 2);
  }

  function renderAll() {
    setupBoardGeometry();
    refs.scenarioTitleReadout.textContent = state.document.title || state.document.id;
    refs.scenarioSizeReadout.textContent = `${table().width}″ × ${table().height}″`;
    refs.scenarioTypeSelect.value = scenarioType(state.document);
    refs.saveReadout.textContent = state.status;
    refs.linearDrawActions.hidden = !state.drawingPath;
    refs.finishLinearButton.disabled = (state.drawingPath?.points.length ?? 0) < 2;
    renderZones();
    renderTerrain();
    renderFootprints();
    renderObjectives();
    renderUnits();
    renderLinearInteraction();
    renderSelectionAndInspector();
    renderObjectList();
    renderValidation();
    renderDataPreview();
    refs.undoButton.disabled = !state.history.length;
    refs.redoButton.disabled = !state.future.length;
  }

  function boardPoint(event) {
    const rect = refs.board.getBoundingClientRect();
    return {
      x:(event.clientX - rect.left) / rect.width * table().width,
      y:(event.clientY - rect.top) / rect.height * table().height
    };
  }

  function startDrag(event, action, selection) {
    if (selection) state.selection = { ...selection };
    const item = itemForSelection();
    if (!item) return;
    const start = boardPoint(event);
    const point = pointForSelection();
    state.drag = {
      pointerId:event.pointerId,
      action,
      start,
      before:beforeMutation(),
      original:DOCUMENT.clone(item),
      originalPoint:point ? DOCUMENT.clone(point) : null
    };
    if (action === "rotate") {
      const rect = { x:number(item.x), y:number(item.y), width:number(item.width), height:number(item.height) };
      state.drag.center = { x:rect.x + rect.width / 2, y:rect.y + rect.height / 2 };
      state.drag.startAngle = Math.atan2(start.y - state.drag.center.y, start.x - state.drag.center.x) * 180 / Math.PI;
    }
    refs.viewport.setPointerCapture?.(event.pointerId);
    renderSelectionAndInspector();
    renderObjectList();
  }

  function selectionFromTarget(target) {
    const segment = target.closest?.("[data-editor-kind='segment']");
    if (segment) return { kind:"linear", id:segment.dataset.linearId, segmentIndex:Number(segment.dataset.segmentIndex) };
    const waypoint = target.closest?.("[data-editor-kind='waypoint']");
    if (waypoint) return { kind:"linear", id:waypoint.dataset.linearId, pointIndex:Number(waypoint.dataset.pointIndex) };
    const linear = target.closest?.("[data-editor-kind='linear']");
    if (linear) return { kind:"linear", id:linear.dataset.linearId };
    const unit = target.closest?.("[data-editor-kind='unit']");
    if (unit) return { kind:"unit", id:unit.dataset.unitId, faction:unit.dataset.faction };
    const objective = target.closest?.("[data-editor-kind='objective']");
    if (objective) {
      const selection = { kind:"objective", id:objective.dataset.objectiveId };
      if (objective.dataset.pointIndex !== undefined) selection.pointIndex = Number(objective.dataset.pointIndex);
      return selection;
    }
    const zone = target.closest?.("[data-editor-kind='zone']");
    if (zone) return { kind:"zone", faction:zone.dataset.faction, zoneId:zone.dataset.zoneId };
    const terrain = target.closest?.(".terrain-piece[data-terrain-instance-id]");
    if (terrain) return { kind:"terrain", id:terrain.dataset.terrainInstanceId };
    return null;
  }

  function startPan(event) {
    state.pan = {
      pointerId:event.pointerId,
      startClientX:event.clientX,
      startClientY:event.clientY,
      startScrollLeft:refs.viewport.scrollLeft,
      startScrollTop:refs.viewport.scrollTop,
      moved:false
    };
    refs.viewport.setPointerCapture?.(event.pointerId);
    setupBoardGeometry();
  }

  function addDrawingPoint(event) {
    const point = boardPoint(event);
    const placed = { x:snap(clamp(point.x, 0, table().width)), y:snap(clamp(point.y, 0, table().height)) };
    const previous = state.drawingPath.points[state.drawingPath.points.length - 1];
    if (previous && Math.hypot(number(previous.x) - placed.x, number(previous.y) - placed.y) < .2) return;
    state.drawingPath.points.push(placed);
    state.drawingCursor = placed;
    state.status = `${state.drawingPath.points.length} waypoint${state.drawingPath.points.length === 1 ? "" : "s"} placed · Enter to finish`;
    refs.saveReadout.textContent = state.status;
    refs.finishLinearButton.disabled = state.drawingPath.points.length < 2;
    renderLinearInteraction();
  }

  function onBoardPointerDown(event) {
    const isMiddle = event.button === 1;
    const isLeft = event.button === 0 || event.button === undefined;
    if (!isMiddle && !isLeft) return;
    if (state.drawingPath && isLeft) {
      if (!refs.board.contains(event.target)) return;
      event.preventDefault();
      addDrawingPoint(event);
      return;
    }
    if (isMiddle || (isLeft && state.spacePressed)) {
      event.preventDefault();
      startPan(event);
      return;
    }
    const action = event.target.dataset?.editorAction;
    if (action && state.selection) {
      event.preventDefault();
      startDrag(event, action, state.selection);
      return;
    }
    const selection = selectionFromTarget(event.target);
    if (!selection) {
      event.preventDefault();
      startPan(event);
      return;
    }
    event.preventDefault();
    const selectsOnly = selection.kind === "linear" && selection.pointIndex === undefined;
    if (selectsOnly) select(selection);
    else startDrag(event, "move", selection);
  }

  function moveSelected(point) {
    const drag = state.drag;
    const selection = state.selection;
    const item = itemForSelection();
    if (!drag || !selection || !item) return;
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const width = table().width;
    const height = table().height;

    if (drag.action === "move") {
      if (selection.kind === "terrain") {
        item.x = snap(clamp(number(drag.original.x) + dx, -number(item.width) * .75, width - number(item.width) * .25));
        item.y = snap(clamp(number(drag.original.y) + dy, -number(item.height) * .75, height - number(item.height) * .25));
      } else if (selection.kind === "unit") {
        item.x = snap(clamp(number(drag.original.x) + dx, 0, width));
        item.y = snap(clamp(number(drag.original.y) + dy, 0, height));
      } else if (selection.kind === "objective") {
        const target = pointForSelection() ?? item;
        const original = drag.originalPoint ?? drag.original;
        target.x = snap(clamp(number(original.x) + dx, 0, width));
        target.y = snap(clamp(number(original.y) + dy, 0, height));
      } else if (selection.kind === "linear") {
        const target = pointForSelection();
        if (target && drag.originalPoint) {
          target.x = snap(clamp(number(drag.originalPoint.x) + dx, 0, width));
          target.y = snap(clamp(number(drag.originalPoint.y) + dy, 0, height));
        }
      } else if (selection.kind === "zone") {
        const zoneWidth = number(drag.original.xMax) - number(drag.original.xMin);
        const zoneHeight = number(drag.original.yMax) - number(drag.original.yMin);
        item.xMin = snap(clamp(number(drag.original.xMin) + dx, 0, width - zoneWidth));
        item.yMin = snap(clamp(number(drag.original.yMin) + dy, 0, height - zoneHeight));
        item.xMax = snap(item.xMin + zoneWidth);
        item.yMax = snap(item.yMin + zoneHeight);
      }
    } else if (drag.action === "resize") {
      if (selection.kind === "terrain") {
        item.width = snap(Math.max(.5, number(drag.original.width) + dx));
        item.height = snap(Math.max(.5, number(drag.original.height) + dy));
      } else if (selection.kind === "zone") {
        item.xMax = snap(clamp(number(drag.original.xMax) + dx, number(item.xMin) + .5, width));
        item.yMax = snap(clamp(number(drag.original.yMax) + dy, number(item.yMin) + .5, height));
      }
    } else if (drag.action === "resize-objective") {
      const target = pointForSelection() ?? item;
      const original = drag.originalPoint ?? drag.original;
      const center = { x:number(original.x), y:number(original.y) };
      target.radius = snap(Math.max(.25, Math.hypot(point.x - center.x, point.y - center.y)));
    } else if (drag.action === "rotate") {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x) * 180 / Math.PI;
      item.rotation = Math.round(number(drag.original.rotation) + angle - drag.startAngle);
    }
    renderAll();
  }

  function onBoardPointerMove(event) {
    const point = boardPoint(event);
    refs.cursorReadout.textContent = `Cursor: ${point.x.toFixed(1)}″, ${point.y.toFixed(1)}″`;
    if (state.drawingPath) {
      state.drawingCursor = { x:snap(clamp(point.x, 0, table().width)), y:snap(clamp(point.y, 0, table().height)) };
      renderLinearInteraction();
    }
    if (state.pan && state.pan.pointerId === event.pointerId) {
      event.preventDefault();
      const dx = event.clientX - state.pan.startClientX;
      const dy = event.clientY - state.pan.startClientY;
      if (Math.hypot(dx, dy) > 3) state.pan.moved = true;
      refs.viewport.scrollLeft = state.pan.startScrollLeft - dx;
      refs.viewport.scrollTop = state.pan.startScrollTop - dy;
      return;
    }
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    moveSelected(point);
  }

  function onBoardPointerUp(event) {
    if (state.pan && state.pan.pointerId === event.pointerId) {
      const moved = state.pan.moved;
      state.pan = null;
      refs.viewport.releasePointerCapture?.(event.pointerId);
      setupBoardGeometry();
      if (!moved) select(null);
      return;
    }
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const before = state.drag.before;
    const action = state.drag.action;
    state.drag = null;
    refs.viewport.releasePointerCapture?.(event.pointerId);
    commit(before, `${action.charAt(0).toUpperCase()}${action.slice(1)} committed`);
  }

  function setByPath(target, path, value) {
    const parts = path.split(".");
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {};
      cursor = cursor[part];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function parseControlValue(control) {
    if (control.type === "number") return number(control.value);
    return control.value;
  }

  function onInspectorChange(event) {
    const control = event.target.closest("[data-field]");
    if (!control || !state.selection) return;
    const item = itemForSelection();
    if (!item) return;
    const fieldPath = control.dataset.field;
    if (fieldPath === "@faction") return;
    const before = beforeMutation();
    const oldId = item.id;
    const value = parseControlValue(control);
    if (state.selection.kind === "objective" && fieldPath === "type") {
      normalizeObjectiveType(item, value);
    } else if (fieldPath.startsWith("@point.")) {
      const point = pointForSelection();
      if (point) setByPath(point, fieldPath.slice(7), value);
    } else {
      setByPath(item, fieldPath, value);
    }
    if (fieldPath === "id" && state.selection.id === oldId) state.selection.id = value;
    commit(before, `Updated ${fieldPath}`);
  }

  function insertWaypoint() {
    const path = itemForSelection();
    const index = state.selection?.pointIndex;
    if (!path || state.selection.kind !== "linear" || index === undefined) return;
    const before = beforeMutation();
    const current = path.points[index];
    const next = path.points[index + 1];
    const previous = path.points[Math.max(0, index - 1)];
    const point = next
      ? { x:(number(current.x) + number(next.x)) / 2, y:(number(current.y) + number(next.y)) / 2 }
      : { x:number(current.x) + (number(current.x) - number(previous.x) || 4), y:number(current.y) + (number(current.y) - number(previous.y)) };
    path.points.splice(index + 1, 0, point);
    state.selection.pointIndex = index + 1;
    commit(before, "Inserted waypoint");
  }

  function removeWaypoint() {
    const path = itemForSelection();
    const index = state.selection?.pointIndex;
    if (!path || state.selection.kind !== "linear" || index === undefined || path.points.length <= 2) return;
    const before = beforeMutation();
    path.points.splice(index, 1);
    state.selection.pointIndex = Math.max(0, Math.min(index, path.points.length - 1));
    commit(before, "Removed waypoint");
  }

  function defaultTerrainSize(definition) {
    if (definition.family === "building") return { width:10, height:7 };
    if (definition.renderer === "woods" || definition.renderer === "orchard") return { width:12, height:9 };
    if (definition.renderer === "field") return { width:12, height:8 };
    if (definition.family === "scatter") return { width:3.5, height:3.5 };
    if (definition.family === "defensive") return { width:7, height:3.5 };
    return { width:9, height:2.5 };
  }

  function addTerrain() {
    const terrainId = refs.terrainTypeSelect.value;
    const definition = TERRAIN_TYPES[terrainId];
    if (!definition) return;
    const before = beforeMutation();
    const size = defaultTerrainSize(definition);
    const item = {
      id:DOCUMENT.nextId(state.document, terrainId),
      terrainId,
      x:snap(table().width / 2 - size.width / 2),
      y:snap(table().height / 2 - size.height / 2),
      width:size.width,
      height:size.height
    };
    if (definition.presentation?.defaultAppearance) item.appearance = definition.presentation.defaultAppearance;
    state.document.terrain.push(item);
    state.selection = { kind:"terrain", id:item.id };
    commit(before, `Added ${definition.label}`);
  }

  function addLinear() {
    if (state.drawingPath) return;
    const styleId = refs.linearStyleSelect.value;
    const style = LINEAR_STYLES[styleId];
    if (!style) return;
    state.selection = null;
    state.drawingPath = { styleId, width:style.width, points:[], before:beforeMutation() };
    state.drawingCursor = null;
    state.status = `Drawing ${style.label} · click to place waypoints`;
    renderAll();
  }

  function finishLinearDraw() {
    const drawing = state.drawingPath;
    if (!drawing || drawing.points.length < 2) return;
    const style = LINEAR_STYLES[drawing.styleId];
    const item = {
      id:DOCUMENT.nextId(state.document, drawing.styleId),
      styleId:drawing.styleId,
      width:drawing.width,
      points:drawing.points.map(point => ({ x:point.x, y:point.y })),
      start:{ cap:"taper" },
      end:{ cap:"taper" }
    };
    state.document.linearTerrain.push(item);
    state.selection = { kind:"linear", id:item.id };
    state.drawingPath = null;
    state.drawingCursor = null;
    commit(drawing.before, `Drew ${style?.label || drawing.styleId}`);
  }

  function cancelLinearDraw() {
    if (!state.drawingPath) return;
    state.drawingPath = null;
    state.drawingCursor = null;
    state.status = "Path drawing cancelled";
    renderAll();
  }

  function insertSegmentWaypoint() {
    const selection = state.selection;
    if (selection?.kind !== "linear" || selection.segmentIndex === undefined) return;
    const before = beforeMutation();
    const inserted = DOCUMENT.insertLinearWaypoint(state.document, selection.id, selection.segmentIndex);
    if (!inserted) return;
    state.selection = { kind:"linear", id:selection.id, pointIndex:selection.segmentIndex + 1 };
    commit(before, "Added waypoint to section");
  }

  function deleteSegment() {
    const selection = state.selection;
    if (selection?.kind !== "linear" || selection.segmentIndex === undefined) return;
    const before = beforeMutation();
    const result = DOCUMENT.deleteLinearSegment(state.document, selection.id, selection.segmentIndex);
    if (!result) return;
    state.selection = result.selection;
    commit(before, result.split ? "Deleted section and split path" : result.deleted ? "Deleted path section" : "Deleted path section");
  }

  function addUnit() {
    const faction = refs.unitFactionSelect.value;
    const unitType = refs.unitTypeSelect.value;
    const definition = UNIT_TYPES[unitType];
    if (!definition) return;
    const before = beforeMutation();
    const zone = state.document.deployment?.zones?.[faction];
    const x = zone ? (number(zone.xMin) + number(zone.xMax)) / 2 : table().width / 2;
    const y = zone ? (number(zone.yMin) + number(zone.yMax)) / 2 : table().height / 2;
    const item = {
      id:DOCUMENT.nextId(state.document, `${faction}-${unitType}`),
      name:definition.name,
      unitType,
      quality:definition.quality || "regular",
      x:snap(x),
      y:snap(y)
    };
    state.document.forces[faction].push(item);
    state.selection = { kind:"unit", id:item.id, faction };
    commit(before, `Added ${definition.name}`);
  }

  function objectiveForType(type) {
    const x = snap(table().width / 2);
    const y = snap(table().height / 2);
    const item = { id:DOCUMENT.nextId(state.document, type === "control_zone" ? "objective" : type), type, label:"New Objective", x, y, radius:3 };
    if (type === "control_group") {
      item.label = "Objective Group";
      item.points = [
        { id:`${item.id}-a`, label:"Point A", x:snap(x - 5), y, radius:3 },
        { id:`${item.id}-b`, label:"Point B", x, y, radius:3 },
        { id:`${item.id}-c`, label:"Point C", x:snap(x + 5), y, radius:3 }
      ];
    } else if (type === "crossing") {
      item.label = "Crossing";
      item.pathId = "";
    } else if (type === "exit_unit") {
      item.label = "Exit Edge";
      item.edge = "blue";
      item.faction = "red";
      item.depth = 3;
      item.pointsPerUnit = 2;
      item.x = 0;
    } else if (type === "destroy_target") {
      item.label = "Destroy Target";
      item.targetId = "";
    } else if (type === "protect_target") {
      item.label = "Protect Target";
      item.targetId = "";
    } else if (type === "unit_objective") {
      item.label = "Unit Objective";
      item.unitId = "";
    } else if (type === "custom") {
      item.label = "Custom Objective";
    }
    return item;
  }

  function addObjective() {
    const before = beforeMutation();
    const item = objectiveForType(refs.objectiveTypeSelect.value || "control_zone");
    state.document.objectives.push(item);
    state.selection = { kind:"objective", id:item.id };
    commit(before, `Added ${item.label}`);
  }

  function addObjectivePoint() {
    const item = itemForSelection();
    if (!item || state.selection?.kind !== "objective" || item.type !== "control_group") return;
    const before = beforeMutation();
    item.points = Array.isArray(item.points) ? item.points : [];
    const previous = item.points[item.points.length - 1] ?? item;
    item.points.push({
      id:DOCUMENT.nextId(state.document, `${item.id}-point`),
      label:`Point ${item.points.length + 1}`,
      x:snap(clamp(number(previous.x) + 5, 0, table().width)),
      y:snap(clamp(number(previous.y), 0, table().height)),
      radius:number(previous.radius, number(item.radius, 3))
    });
    state.selection.pointIndex = item.points.length - 1;
    commit(before, "Added control point");
  }

  function removeLastObjectivePoint() {
    const item = itemForSelection();
    if (!item || item.type !== "control_group" || (item.points?.length ?? 0) <= 1) return;
    const before = beforeMutation();
    item.points.pop();
    if (state.selection.pointIndex !== undefined) state.selection.pointIndex = Math.min(state.selection.pointIndex, item.points.length - 1);
    commit(before, "Removed control point");
  }

  function normalizeObjectiveType(item, type) {
    const center = item.points?.[0] ?? item;
    item.type = type;
    item.x = number(item.x, number(center.x, table().width / 2));
    item.y = number(item.y, number(center.y, table().height / 2));
    item.radius = number(item.radius, number(center.radius, 3));
    if (type === "control_group") {
      if (!Array.isArray(item.points) || !item.points.length) {
        item.points = [{ id:`${item.id}-a`, label:"Point A", x:item.x, y:item.y, radius:item.radius }];
      }
    } else {
      delete item.points;
      delete state.selection.pointIndex;
    }
    if (type === "exit_unit") {
      item.edge = item.edge || "blue";
      item.faction = item.faction || "red";
      item.depth = number(item.depth, 3);
      item.pointsPerUnit = number(item.pointsPerUnit, 2);
    }
  }

  function duplicateSelection() {
    if (!state.selection || state.selection.kind === "zone" || state.selection.pointIndex !== undefined || state.selection.segmentIndex !== undefined) return;
    const before = beforeMutation();
    const copy = DOCUMENT.duplicate(state.document, state.selection);
    if (!copy) return;
    state.selection = { ...state.selection, id:copy.id };
    commit(before, `Duplicated ${copy.id}`);
  }

  function deleteSelection() {
    if (!state.selection || state.selection.kind === "zone") return;
    if (state.selection.kind === "linear" && state.selection.pointIndex !== undefined) {
      removeWaypoint();
      return;
    }
    if (state.selection.kind === "linear" && state.selection.segmentIndex !== undefined) {
      deleteSegment();
      return;
    }
    const before = beforeMutation();
    const label = state.selection.id;
    if (!DOCUMENT.remove(state.document, state.selection)) return;
    state.selection = null;
    commit(before, `Deleted ${label}`);
  }

  function updateScenarioType(type) {
    const before = beforeMutation();
    state.document.victory = state.document.victory ?? {};
    state.document.scoring = state.document.scoring ?? {};
    state.document.victory.type = type;
    state.document.scoring.type = type;
    if (type === "elimination") state.document.victory.elimination = true;
    commit(before, `Scenario type set to ${type}`);
  }

  function setZoom(value, clientX = null, clientY = null) {
    const previous = state.zoom;
    const next = clamp(value, .35, 2.5);
    if (Math.abs(next - previous) < .001) return;
    const viewportRect = refs.viewport.getBoundingClientRect();
    const anchorX = clientX == null ? viewportRect.width / 2 : clientX - viewportRect.left;
    const anchorY = clientY == null ? viewportRect.height / 2 : clientY - viewportRect.top;
    const stageLeft = refs.stage.offsetLeft;
    const stageTop = refs.stage.offsetTop;
    const contentX = refs.viewport.scrollLeft + anchorX;
    const contentY = refs.viewport.scrollTop + anchorY;
    const boardX = (contentX - stageLeft) / previous;
    const boardY = (contentY - stageTop) / previous;
    state.zoom = next;
    setupBoardGeometry();
    refs.viewport.scrollLeft = stageLeft + boardX * next - anchorX;
    refs.viewport.scrollTop = stageTop + boardY * next - anchorY;
  }

  function onViewportWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * .0015);
    setZoom(state.zoom * factor, event.clientX, event.clientY);
  }

  function fitTable() {
    const horizontal = Math.max(200, refs.viewport.clientWidth - 56) / BASE_BOARD_WIDTH;
    const boardHeight = BASE_BOARD_WIDTH * table().height / table().width;
    const vertical = Math.max(160, refs.viewport.clientHeight - 56) / boardHeight;
    state.zoom = clamp(Math.min(1.4, horizontal, vertical), .35, 2.5);
    setupBoardGeometry();
    refs.viewport.scrollLeft = Math.max(0, (refs.viewport.scrollWidth - refs.viewport.clientWidth) / 2);
    refs.viewport.scrollTop = Math.max(0, (refs.viewport.scrollHeight - refs.viewport.clientHeight) / 2);
  }

  function slugify(value) {
    return String(value || "scenario").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scenario";
  }

  function uniqueScenarioId(requested) {
    const base = slugify(requested);
    if (!scenarioSources.has(base)) return base;
    let suffix = 2;
    while (scenarioSources.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  function openNewScenarioDialog() {
    refs.newScenarioTemplate.value = "blank";
    delete refs.newScenarioId.dataset.edited;
    refs.newScenarioTitle.value = "Untitled Scenario";
    refs.newScenarioId.value = "untitled-scenario";
    refs.newScenarioWidth.value = table().width;
    refs.newScenarioHeight.value = table().height;
    refs.newScenarioRounds.value = state.document.rounds ?? 6;
    refs.newScenarioType.value = scenarioType(state.document);
    refs.newScenarioStartingFaction.value = state.document.deployment?.order?.[0] || "blue";
    refs.newScenarioDialog.showModal();
    refs.newScenarioTitle.focus();
    refs.newScenarioTitle.select();
  }

  function defaultObjectiveForScenario(type, scenario) {
    const x = scenario.table.width / 2;
    const y = scenario.table.height / 2;
    if (type === "breakthrough") return { id:"exit-edge", type:"exit_unit", label:"Breakthrough Edge", edge:"blue", faction:"red", depth:3, pointsPerUnit:2, x:0, y, radius:1 };
    if (type === "control" || type === "delay") return { id:"center-objective", type:"control_zone", label:"Central Objective", x, y, radius:3 };
    return null;
  }

  function createScenarioFromDialog(event) {
    event.preventDefault();
    const id = uniqueScenarioId(refs.newScenarioId.value || refs.newScenarioTitle.value);
    const title = refs.newScenarioTitle.value.trim() || "Untitled Scenario";
    const width = Math.max(12, number(refs.newScenarioWidth.value, 72));
    const height = Math.max(12, number(refs.newScenarioHeight.value, 48));
    const rounds = Math.max(1, number(refs.newScenarioRounds.value, 6));
    const type = refs.newScenarioType.value || "control";
    let scenario;
    if (refs.newScenarioTemplate.value === "duplicate") {
      scenario = DOCUMENT.create(state.document);
      scenario.id = id;
      scenario.title = title;
      scenario.table.width = width;
      scenario.table.height = height;
      scenario.rounds = rounds;
      scenario.victory = { ...(scenario.victory ?? {}), type };
      scenario.scoring = { ...(scenario.scoring ?? {}), type };
      scenario.description = `${scenario.description || ""} Duplicated in Terrain Editor E1.2.`.trim();
    } else {
      scenario = DOCUMENT.createBlankScenario({ id, title, width, height, rounds, type, startingFaction:refs.newScenarioStartingFaction.value });
      const objective = defaultObjectiveForScenario(type, scenario);
      if (objective) scenario.objectives.push(objective);
    }
    scenarioSources.set(id, scenario);
    persistCustomScenario(scenario);
    refreshScenarioSelect(id);
    refs.newScenarioDialog.close();
    loadScenario(id);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    state.status = message;
    refs.saveReadout.textContent = message;
  }

  function downloadJson() {
    const blob = new Blob([DOCUMENT.serialize(state.document, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.document.id || "scenario"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    state.status = "Downloaded scenario JSON";
    refs.saveReadout.textContent = state.status;
  }

  async function importJson(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const before = beforeMutation();
    state.document = DOCUMENT.create(parsed);
    state.selection = null;
    commit(before, `Imported ${file.name}`);
  }

  function launchPlaytest() {
    const scenario = DOCUMENT.playtestScenario(state.document);
    localStorage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(scenario));
    state.status = "Playtest scenario saved";
    refs.saveReadout.textContent = state.status;
    window.open("index.html?editorPlaytest=1", "_blank", "noopener");
  }

  function bindEvents() {
    refs.scenarioSelect.addEventListener("change", () => loadScenario(refs.scenarioSelect.value));
    refs.scenarioTypeSelect.addEventListener("change", () => updateScenarioType(refs.scenarioTypeSelect.value));
    refs.newScenarioButton.addEventListener("click", openNewScenarioDialog);
    refs.newScenarioForm.addEventListener("submit", createScenarioFromDialog);
    refs.newScenarioDialog.addEventListener("click", event => {
      if (event.target === refs.newScenarioDialog || event.target.closest("[data-dialog-close]")) refs.newScenarioDialog.close();
    });
    refs.newScenarioTitle.addEventListener("input", () => {
      if (!refs.newScenarioId.dataset.edited) refs.newScenarioId.value = slugify(refs.newScenarioTitle.value);
    });
    refs.newScenarioId.addEventListener("input", () => { refs.newScenarioId.dataset.edited = "true"; });
    refs.addTerrainButton.addEventListener("click", addTerrain);
    refs.addLinearButton.addEventListener("click", addLinear);
    refs.finishLinearButton.addEventListener("click", finishLinearDraw);
    refs.cancelLinearButton.addEventListener("click", cancelLinearDraw);
    refs.addUnitButton.addEventListener("click", addUnit);
    refs.addObjectiveButton.addEventListener("click", addObjective);
    refs.resetScenarioButton.addEventListener("click", resetScenario);
    refs.fitButton.addEventListener("click", fitTable);
    refs.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - .1));
    refs.zoomInButton.addEventListener("click", () => setZoom(state.zoom + .1));
    refs.viewport.addEventListener("wheel", onViewportWheel, { passive:false });
    refs.showGridToggle.addEventListener("change", () => { state.showGrid = refs.showGridToggle.checked; renderAll(); });
    refs.showTerrainToggle.addEventListener("change", () => { state.showTerrain = refs.showTerrainToggle.checked; renderAll(); });
    refs.showLinearToggle.addEventListener("change", () => { state.showLinear = refs.showLinearToggle.checked; renderAll(); });
    refs.showUnitsToggle.addEventListener("change", () => { state.showUnits = refs.showUnitsToggle.checked; renderAll(); });
    refs.showUnitLabelsToggle.addEventListener("change", () => { state.showUnitLabels = refs.showUnitLabelsToggle.checked; renderAll(); });
    refs.showObjectivesToggle.addEventListener("change", () => { state.showObjectives = refs.showObjectivesToggle.checked; renderAll(); });
    refs.showFootprintsToggle.addEventListener("change", () => { state.showFootprints = refs.showFootprintsToggle.checked; renderAll(); });
    refs.showZonesToggle.addEventListener("change", () => { state.showZones = refs.showZonesToggle.checked; renderAll(); });
    refs.snapToggle.addEventListener("change", () => { state.snap = refs.snapToggle.checked; });
    refs.objectFilterInput.addEventListener("input", () => { state.objectFilter = refs.objectFilterInput.value; renderObjectList(); });
    refs.objectList.addEventListener("click", event => {
      const button = event.target.closest("[data-selection]");
      if (button) select(JSON.parse(button.dataset.selection));
    });
    refs.validationList.addEventListener("click", event => {
      const button = event.target.closest("[data-selection]");
      if (button) select(JSON.parse(button.dataset.selection));
    });
    refs.viewport.addEventListener("pointerdown", onBoardPointerDown);
    refs.viewport.addEventListener("pointermove", onBoardPointerMove);
    refs.viewport.addEventListener("pointerup", onBoardPointerUp);
    refs.viewport.addEventListener("pointercancel", onBoardPointerUp);
    refs.inspectorForm.addEventListener("change", onInspectorChange);
    refs.inspectorForm.addEventListener("click", event => {
      const command = event.target.closest("[data-editor-command]")?.dataset.editorCommand;
      if (command === "insert-waypoint") insertWaypoint();
      if (command === "remove-waypoint") removeWaypoint();
      if (command === "insert-segment-waypoint") insertSegmentWaypoint();
      if (command === "delete-segment") deleteSegment();
      if (command === "add-objective-point") addObjectivePoint();
      if (command === "remove-last-objective-point") removeLastObjectivePoint();
    });
    refs.duplicateSelectionButton.addEventListener("click", duplicateSelection);
    refs.deleteSelectionButton.addEventListener("click", deleteSelection);
    refs.copyJsonButton.addEventListener("click", () => copyText(DOCUMENT.serialize(state.document, 2), "Copied scenario JSON"));
    refs.copyJsButton.addEventListener("click", () => copyText(`window.CROSSROADS_EDITOR_SCENARIO = ${DOCUMENT.serialize(state.document, 2)};\n`, "Copied scenario JavaScript"));
    refs.downloadJsonButton.addEventListener("click", downloadJson);
    refs.importJsonButton.addEventListener("click", () => refs.importFileInput.click());
    refs.importFileInput.addEventListener("change", async () => {
      const file = refs.importFileInput.files?.[0];
      if (!file) return;
      try { await importJson(file); }
      catch (error) { state.status = `Import failed: ${error.message}`; refs.saveReadout.textContent = state.status; }
      refs.importFileInput.value = "";
    });
    refs.playtestButton.addEventListener("click", launchPlaytest);
    refs.undoButton.addEventListener("click", undo);
    refs.redoButton.addEventListener("click", redo);
    window.addEventListener("resize", () => requestAnimationFrame(fitTable));
    window.addEventListener("keyup", event => {
      if (event.code === "Space") state.spacePressed = false;
    });
    window.addEventListener("keydown", event => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (event.code === "Space" && !editable) {
        state.spacePressed = true;
        event.preventDefault();
      }
      if (editable) return;
      if (state.drawingPath && event.key === "Enter") {
        event.preventDefault();
        finishLinearDraw();
      } else if (state.drawingPath && event.key === "Escape") {
        event.preventDefault();
        cancelLinearDraw();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
      }
    });
  }

  initializeSelects();
  bindEvents();
  loadScenario(refs.scenarioSelect.value);
})();
