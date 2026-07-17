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
    throw new Error("Terrain Editor E1 dependencies did not load.");
  }

  const BASE_BOARD_WIDTH = 960;
  const HISTORY_LIMIT = 40;
  const PLAYTEST_STORAGE_KEY = "crossroads.editor.playtest";

  const refs = Object.freeze({
    scenarioSelect: document.getElementById("editorScenarioSelect"),
    terrainTypeSelect: document.getElementById("terrainTypeSelect"),
    linearStyleSelect: document.getElementById("linearStyleSelect"),
    unitFactionSelect: document.getElementById("unitFactionSelect"),
    unitTypeSelect: document.getElementById("unitTypeSelect"),
    addTerrainButton: document.getElementById("addTerrainButton"),
    addLinearButton: document.getElementById("addLinearButton"),
    addUnitButton: document.getElementById("addUnitButton"),
    addObjectiveButton: document.getElementById("addObjectiveButton"),
    resetScenarioButton: document.getElementById("resetScenarioButton"),
    fitButton: document.getElementById("fitButton"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomReadout: document.getElementById("zoomReadout"),
    showGridToggle: document.getElementById("showGridToggle"),
    showFootprintsToggle: document.getElementById("showFootprintsToggle"),
    showZonesToggle: document.getElementById("showZonesToggle"),
    snapToggle: document.getElementById("snapToggle"),
    objectList: document.getElementById("objectList"),
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
    redoButton: document.getElementById("redoButton")
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
    issues: [],
    showGrid: true,
    showFootprints: false,
    showZones: true,
    snap: true,
    status: "Source loaded"
  };

  function option(value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function initializeSelects() {
    for (const scenario of Object.values(SCENARIOS)) refs.scenarioSelect.appendChild(option(scenario.id, scenario.title));
    refs.scenarioSelect.value = SCENARIOS.mokra ? "mokra" : Object.keys(SCENARIOS)[0];

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
    const source = SCENARIOS[id];
    if (!source) return;
    state.sourceScenarioId = id;
    state.sourceDocument = DOCUMENT.create(source);
    state.document = DOCUMENT.create(source);
    state.selection = null;
    state.history = [];
    state.future = [];
    state.status = `Loaded ${source.title}`;
    refs.scenarioSelect.value = id;
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
    return [selection.kind, selection.faction, selection.id, selection.zoneId, selection.pointIndex].filter(value => value !== undefined && value !== null).join(":");
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
    refs.zoomReadout.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function renderTerrain() {
    TERRAIN_PRESENTATION.renderScenarioTerrain({ layer:refs.terrainLayer, scenario:state.document });
    for (const element of refs.terrainLayer.querySelectorAll(".terrain-piece")) {
      element.dataset.editorKind = "terrain";
      if (state.selection?.kind === "terrain" && String(state.selection.id) === String(element.dataset.terrainInstanceId)) element.classList.add("is-editor-selected");
    }
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
        label.className = "editor-unit-label";
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
    for (const path of state.document.linearTerrain ?? []) {
      const points = (path.points ?? []).map(point => `${number(point.x)},${number(point.y)}`).join(" ");
      const hit = svgNode("polyline", { points, class:"editor-linear-hit", "data-editor-kind":"linear", "data-linear-id":path.id });
      refs.interactionSvg.appendChild(hit);
      const selected = state.selection?.kind === "linear" && String(state.selection.id) === String(path.id);
      if (!selected) continue;
      refs.interactionSvg.appendChild(svgNode("polyline", { points, class:"editor-linear-highlight" }));
      (path.points ?? []).forEach((point, index) => {
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
    const groups = [
      ["Discrete terrain", (state.document.terrain ?? []).map(item => ({ selection:{kind:"terrain", id:item.id}, label:item.id, detail:TERRAIN_TYPES[item.terrainId]?.label || item.terrainId }))],
      ["Linear terrain", (state.document.linearTerrain ?? []).map(item => ({ selection:{kind:"linear", id:item.id}, label:item.id, detail:LINEAR_STYLES[item.styleId]?.label || item.styleId }))],
      ["Objectives", (state.document.objectives ?? []).map(item => ({ selection:{kind:"objective", id:item.id}, label:item.label || item.id, detail:item.type || "point" }))],
      ["Polish units", (state.document.forces?.blue ?? []).map(item => ({ selection:{kind:"unit", id:item.id, faction:"blue"}, label:item.name || item.id, detail:unitAbbreviation(item) }))],
      ["German units", (state.document.forces?.red ?? []).map(item => ({ selection:{kind:"unit", id:item.id, faction:"red"}, label:item.name || item.id, detail:unitAbbreviation(item) }))]
    ];
    let count = 0;
    for (const [title, items] of groups) {
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
    refs.objectCount.textContent = String(count);
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

  function renderInspector() {
    const selection = state.selection;
    const item = itemForSelection();
    refs.selectionKindBadge.textContent = selection?.kind?.toUpperCase() || "NONE";
    refs.inspectorEmpty.hidden = Boolean(item);
    refs.inspectorForm.hidden = !item;
    refs.selectionActions.hidden = !item;
    refs.duplicateSelectionButton.disabled = !item || selection.kind === "zone" || selection.pointIndex !== undefined;
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
      } else {
        html += `<p class="editor-inspector-note">Select a numbered waypoint to move, insert, or remove path points.</p>`;
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
      const point = pointForSelection() ?? item;
      const prefix = pointForSelection() ? "@point." : "";
      html += field("X", `${prefix}x`, point.x);
      html += field("Y", `${prefix}y`, point.y);
      html += field("Radius", `${prefix}radius`, point.radius ?? item.radius ?? 2, { min:.25 });
      if (item.type === "control_group") html += `<p class="editor-inspector-note">Editing control point ${selection.pointIndex + 1} of ${item.points.length}.</p>`;
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
    refs.saveReadout.textContent = state.status;
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
    refs.board.setPointerCapture?.(event.pointerId);
    renderSelectionAndInspector();
    renderObjectList();
  }

  function selectionFromTarget(target) {
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

  function onBoardPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const action = event.target.dataset?.editorAction;
    if (action && state.selection) {
      event.preventDefault();
      startDrag(event, action, state.selection);
      return;
    }
    const selection = selectionFromTarget(event.target);
    if (!selection) {
      select(null);
      return;
    }
    event.preventDefault();
    const dragAction = selection.kind === "linear" && selection.pointIndex === undefined ? "select" : "move";
    if (dragAction === "select") select(selection);
    else startDrag(event, dragAction, selection);
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
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    moveSelected(point);
  }

  function onBoardPointerUp(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const before = state.drag.before;
    const action = state.drag.action;
    state.drag = null;
    refs.board.releasePointerCapture?.(event.pointerId);
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
    if (fieldPath.startsWith("@point.")) {
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
    const next = path.points[Math.min(path.points.length - 1, index + 1)];
    path.points.splice(index + 1, 0, { x:(number(current.x) + number(next.x)) / 2, y:(number(current.y) + number(next.y)) / 2 });
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
    const styleId = refs.linearStyleSelect.value;
    const style = LINEAR_STYLES[styleId];
    if (!style) return;
    const before = beforeMutation();
    const center = { x:table().width / 2, y:table().height / 2 };
    const item = {
      id:DOCUMENT.nextId(state.document, styleId),
      styleId,
      width:style.width,
      points:[{ x:snap(center.x - 6), y:snap(center.y) }, { x:snap(center.x + 6), y:snap(center.y) }],
      start:{ cap:"taper" },
      end:{ cap:"taper" }
    };
    state.document.linearTerrain.push(item);
    state.selection = { kind:"linear", id:item.id, pointIndex:0 };
    commit(before, `Added ${style.label}`);
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

  function addObjective() {
    const before = beforeMutation();
    const item = {
      id:DOCUMENT.nextId(state.document, "objective"),
      label:"New Objective",
      x:snap(table().width / 2),
      y:snap(table().height / 2),
      radius:3
    };
    state.document.objectives.push(item);
    state.selection = { kind:"objective", id:item.id };
    commit(before, "Added objective");
  }

  function duplicateSelection() {
    if (!state.selection || state.selection.kind === "zone" || state.selection.pointIndex !== undefined) return;
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
    const before = beforeMutation();
    const label = state.selection.id;
    if (!DOCUMENT.remove(state.document, state.selection)) return;
    state.selection = null;
    commit(before, `Deleted ${label}`);
  }

  function setZoom(value) {
    state.zoom = clamp(value, .35, 2.5);
    setupBoardGeometry();
  }

  function fitTable() {
    const horizontal = Math.max(200, refs.viewport.clientWidth - 56) / BASE_BOARD_WIDTH;
    const boardHeight = BASE_BOARD_WIDTH * table().height / table().width;
    const vertical = Math.max(160, refs.viewport.clientHeight - 56) / boardHeight;
    setZoom(Math.min(1.4, horizontal, vertical));
    refs.viewport.scrollLeft = 0;
    refs.viewport.scrollTop = 0;
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
    refs.addTerrainButton.addEventListener("click", addTerrain);
    refs.addLinearButton.addEventListener("click", addLinear);
    refs.addUnitButton.addEventListener("click", addUnit);
    refs.addObjectiveButton.addEventListener("click", addObjective);
    refs.resetScenarioButton.addEventListener("click", resetScenario);
    refs.fitButton.addEventListener("click", fitTable);
    refs.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - .1));
    refs.zoomInButton.addEventListener("click", () => setZoom(state.zoom + .1));
    refs.showGridToggle.addEventListener("change", () => { state.showGrid = refs.showGridToggle.checked; renderAll(); });
    refs.showFootprintsToggle.addEventListener("change", () => { state.showFootprints = refs.showFootprintsToggle.checked; renderAll(); });
    refs.showZonesToggle.addEventListener("change", () => { state.showZones = refs.showZonesToggle.checked; renderAll(); });
    refs.snapToggle.addEventListener("change", () => { state.snap = refs.snapToggle.checked; });
    refs.objectList.addEventListener("click", event => {
      const button = event.target.closest("[data-selection]");
      if (button) select(JSON.parse(button.dataset.selection));
    });
    refs.validationList.addEventListener("click", event => {
      const button = event.target.closest("[data-selection]");
      if (button) select(JSON.parse(button.dataset.selection));
    });
    refs.board.addEventListener("pointerdown", onBoardPointerDown);
    refs.board.addEventListener("pointermove", onBoardPointerMove);
    refs.board.addEventListener("pointerup", onBoardPointerUp);
    refs.board.addEventListener("pointercancel", onBoardPointerUp);
    refs.inspectorForm.addEventListener("change", onInspectorChange);
    refs.inspectorForm.addEventListener("click", event => {
      const command = event.target.closest("[data-editor-command]")?.dataset.editorCommand;
      if (command === "insert-waypoint") insertWaypoint();
      if (command === "remove-waypoint") removeWaypoint();
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
    window.addEventListener("keydown", event => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (editable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
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
