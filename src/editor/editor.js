"use strict";

(() => {
  const DOCUMENT = window.CrossroadsEditorDocument;
  const VALIDATION = window.CrossroadsEditorValidation;
  const SCENARIOS = window.CROSSROADS_SCENARIOS;
  const TERRAIN_TYPES = window.CROSSROADS_TERRAIN_TYPES;
  const LINEAR_STYLES = window.CROSSROADS_LINEAR_TERRAIN_STYLES;
  const LINEAR_MATERIALS = window.CROSSROADS_LINEAR_TERRAIN_MATERIALS ?? {};
  const PATCH_STYLES = window.CROSSROADS_TERRAIN_PATCH_STYLES ?? {};
  const UNIT_TYPES = window.CROSSROADS_UNIT_TYPES;
  const TERRAIN_PRESENTATION = window.CrossroadsTerrainPresentation;
  const BUILDINGS = window.CrossroadsBuildingPresentation;
  const GEOMETRY = window.CrossroadsEditorGeometry;
  const LAYERS = window.CrossroadsLayerPolicy;
  const VISIBILITY = window.CrossroadsScenarioVisibility;
  const EDITOR_STATE = window.CrossroadsEditorState;
  const SELECTION = window.CrossroadsEditorSelection;
  const MULTI = window.CrossroadsEditorMultiSelect;
  const TOOLS = window.CrossroadsEditorTools;
  const WOODLAND = window.CrossroadsWoodlandGenerator;
  const SCHEMA = window.CrossroadsScenarioSchema;
  const SEMANTICS = window.CrossroadsTerrainSemantics;
  const PERSISTENCE = window.CrossroadsEditorPersistence;
  const SHELL = window.CrossroadsEditorShell;
  const TABLE_VIEWPORT = window.CrossroadsTableViewport;

  if (!DOCUMENT || !VALIDATION || !SCENARIOS || !TERRAIN_TYPES || !LINEAR_STYLES || !PATCH_STYLES || !UNIT_TYPES || !TERRAIN_PRESENTATION || !GEOMETRY || !LAYERS || !VISIBILITY || !EDITOR_STATE || !SELECTION || !MULTI || !TOOLS || !WOODLAND || !SCHEMA || !SEMANTICS || !PERSISTENCE || !SHELL || !TABLE_VIEWPORT) {
    throw new Error("Scenario Composer S1.1.1 dependencies did not load.");
  }

  const EDITOR_PIXELS_PER_INCH = 40 / 3;
  const HISTORY_LIMIT = 40;
  const scenarioSources = new Map(Object.entries(SCENARIOS));

  const refs = Object.freeze({
    scenarioSelect: document.getElementById("editorScenarioSelect"),
    scenarioTypeSelect: document.getElementById("scenarioTypeSelect"),
    victoryPolicySelect: document.getElementById("victoryPolicySelect"),
    victoryTiebreakerSelect: document.getElementById("victoryTiebreakerSelect"),
    victoryBlueThreshold: document.getElementById("victoryBlueThreshold"),
    victoryRedThreshold: document.getElementById("victoryRedThreshold"),
    eliminationVictoryToggle: document.getElementById("eliminationVictoryToggle"),
    newScenarioButton: document.getElementById("newScenarioButton"),
    renameScenarioButton: document.getElementById("renameScenarioButton"),
    deleteScenarioButton: document.getElementById("deleteScenarioButton"),
    returnToGameLink: document.getElementById("returnToGameLink"),
    unitFactionSelect: document.getElementById("unitFactionSelect"),
    linearDrawActions: document.getElementById("linearDrawActions"),
    finishLinearButton: document.getElementById("finishLinearButton"),
    cancelLinearButton: document.getElementById("cancelLinearButton"),
    patchDrawActions: document.getElementById("patchDrawActions"),
    finishPatchButton: document.getElementById("finishPatchButton"),
    cancelPatchButton: document.getElementById("cancelPatchButton"),
    resetScenarioButton: document.getElementById("resetScenarioButton"),
    fitButton: document.getElementById("fitButton"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomReadout: document.getElementById("zoomReadout"),
    showGridToggle: document.getElementById("showGridToggle"),
    showPatchesToggle: document.getElementById("showPatchesToggle"),
    showObjectsToggle: document.getElementById("showObjectsToggle"),
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
    assetFilterInput: document.getElementById("assetFilterInput"),
    assetLibrary: document.getElementById("assetLibrary"),
    assetCount: document.getElementById("assetCount"),
    assetFactionRow: document.getElementById("assetFactionRow"),
    assetCategoryButtons: [...document.querySelectorAll("[data-asset-category]")],
    openObjectiveLibraryButton: document.getElementById("openObjectiveLibraryButton"),
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
    placementLayer: document.getElementById("editorPlacementLayer"),
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
    copySelectionButton: document.getElementById("copySelectionButton"),
    pasteSelectionButton: document.getElementById("pasteSelectionButton"),
    duplicateSelectionButton: document.getElementById("duplicateSelectionButton"),
    deleteSelectionButton: document.getElementById("deleteSelectionButton"),
    validationCount: document.getElementById("validationCount"),
    validationStatusButton: document.getElementById("validationStatusButton"),
    validationStatusCount: document.getElementById("validationStatusCount"),
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
    newScenarioStartingFaction: document.getElementById("newScenarioStartingFaction"),
    renameScenarioDialog: document.getElementById("renameScenarioDialog"),
    renameScenarioForm: document.getElementById("renameScenarioForm"),
    renameScenarioTitle: document.getElementById("renameScenarioTitle"),
    renameScenarioIdReadout: document.getElementById("renameScenarioIdReadout")
  });

  const state = EDITOR_STATE.create();
  let hierarchyDragSelection = null;
  let editorStorage = null;
  try { editorStorage = window.localStorage; } catch (_error) { /* Storage is optional. */ }
  const persistence = PERSISTENCE.create({
    documentModel:DOCUMENT,
    builtInScenarios:SCENARIOS,
    scenarioSources,
    storage:editorStorage
  });
  state.clipboard = persistence.loadClipboard();
  const shell = SHELL.create({
    root:document.body,
    storage:editorStorage,
    onWorkspaceChange:workspace => {
      TOOLS.leavePointEdit(state);
      if (workspace !== "build") {
        TOOLS.cancelPlacement(state);
        TOOLS.cancelDrawing(state);
      }
      if (state.document) renderAll();
    },
    onLayoutChange:() => {
      if (!state.document) return;
      requestAnimationFrame(() => {
        setupBoardGeometry();
        ensureBoardInView();
      });
    }
  });

  function option(value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function isBuiltInScenario(id = state.sourceScenarioId) {
    return Boolean(id && SCENARIOS[id]);
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

  function initializeSelects() {
    persistence.loadCustomScenarios();
    refreshScenarioSelect(persistence.requestedScenarioId(window.location.search));
  }

  const OBJECTIVE_LIBRARY = Object.freeze([
    { id:"control_zone", label:"Control point", detail:"Score or hold a position" },
    { id:"control_group", label:"Control group", detail:"Link several positions" },
    { id:"crossing", label:"Crossing", detail:"Control a route crossing" },
    { id:"exit_unit", label:"Exit edge", detail:"Break through or withdraw" },
    { id:"destroy_target", label:"Destroy target", detail:"Eliminate a chosen object" },
    { id:"protect_target", label:"Protect target", detail:"Keep a chosen object alive" },
    { id:"hold", label:"Hold until round", detail:"Delay or defend over time" },
    { id:"casualty", label:"Casualty scoring", detail:"Score destroyed force" },
    { id:"custom", label:"Custom marker", detail:"Author a bespoke objective" }
  ]);

  function titleCase(value) {
    return String(value ?? "").replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
  }

  function terrainLibraryGroup(definition) {
    if (definition.family === "building") return "Buildings";
    if (definition.family === "defensive") return "Fortifications";
    if (definition.family === "scatter") return "Battlefield clutter";
    if (definition.family === "ground") return "Fields and ground";
    if (definition.family === "water") return "Water";
    if (definition.family === "transport") return definition.renderer === "rail" || definition.renderer === "rail_crossing" ? "Railway pieces" : "Road pieces";
    if (definition.renderer === "woods" || definition.renderer === "orchard") return "Trees and woods";
    if (definition.family === "linear") return "Walls, fences, and cover";
    return titleCase(definition.family || "Terrain");
  }

  function libraryAssets() {
    const assets = [];
    for (const definition of Object.values(TERRAIN_TYPES)) {
      assets.push({
        key:`terrain:${definition.id}`,
        kind:"terrain",
        id:definition.id,
        category:"terrain",
        group:terrainLibraryGroup(definition),
        label:titleCase(definition.label),
        detail:titleCase(definition.family),
        definition
      });
    }
    for (const style of Object.values(LINEAR_STYLES)) {
      assets.push({
        key:`linear:${style.id}`,
        kind:"linear",
        id:style.id,
        category:"paths",
        group:style.renderer === "rail" ? "Railways" : style.family === "water" ? "Waterways" : "Paths and barriers",
        label:titleCase(style.label),
        detail:"Draw path",
        definition:style
      });
    }
    for (const style of Object.values(PATCH_STYLES)) {
      assets.push({
        key:`patch:${style.id}`,
        kind:"patch",
        id:style.id,
        category:"patches",
        group:style.family === "water" ? "Water patches" : style.family === "natural" ? "Natural patches" : "Ground patches",
        label:titleCase(style.label),
        detail:"Draw polygon",
        definition:style
      });
    }
    for (const [id, definition] of Object.entries(UNIT_TYPES)) {
      assets.push({
        key:`unit:${id}`,
        kind:"unit",
        id,
        category:"units",
        group:"Units",
        label:definition.name,
        detail:"Place unit",
        definition
      });
    }
    for (const definition of OBJECTIVE_LIBRARY) {
      assets.push({
        key:`objective:${definition.id}`,
        kind:"objective",
        id:definition.id,
        category:"scenario",
        group:"Objectives",
        label:definition.label,
        detail:definition.detail,
        definition
      });
    }
    return assets;
  }

  function libraryPreview(asset) {
    const preview = document.createElement("span");
    preview.className = "editor-asset-preview";
    if (asset.kind === "terrain") {
      const definition = asset.definition;
      if (definition.renderer === "building" && BUILDINGS?.createArt) {
        try {
          preview.appendChild(BUILDINGS.createArt({
            definition,
            instance:{ id:`library-${definition.id}`, terrainId:definition.id, x:0, y:0, width:8, height:5, rotation:0 }
          }));
          return preview;
        } catch (_error) { /* CSS fallback below. */ }
      }
      preview.classList.add("is-terrain");
      const fills = { ground:"#a58d57", water:"#72afc0", natural:"#6f8259", linear:"#7c865c", defensive:"#8b765d", scatter:"#9b805b", transport:"#9c835c" };
      preview.style.setProperty("--asset-fill", fills[definition.family] ?? "#887c68");
      return preview;
    }
    if (asset.kind === "linear") {
      preview.classList.add("is-linear");
      const materialId = defaultLinearMaterial(asset.id);
      const material = LINEAR_MATERIALS[asset.id]?.[materialId] ?? LINEAR_MATERIALS[asset.definition.renderer]?.[materialId] ?? {};
      preview.style.setProperty("--asset-base", material.surface ?? material.water ?? material.ballast ?? "#94805b");
      preview.style.setProperty("--asset-detail", material.detail ?? material.rail ?? "#d0bd8d");
      return preview;
    }
    if (asset.kind === "patch") {
      preview.classList.add("is-patch");
      const fills = { woods:"#657f4c", woods_dense:"#3f6142", orchard:"#78915a", field_tilled:"#92724e", field_wheat:"#b9954e", field_cabbage:"#7c8952", concrete:"#9b9a90", cobblestone:"#898a82", mud:"#65513f", pond:"#72afc0" };
      preview.style.setProperty("--asset-fill", fills[asset.id] ?? "#728450");
      return preview;
    }
    if (asset.kind === "unit") {
      preview.classList.add("is-unit");
      preview.style.setProperty("--asset-color", refs.unitFactionSelect.value === "red" ? "#a85850" : "#527da6");
      return preview;
    }
    preview.classList.add("is-objective");
    return preview;
  }

  function activeLibraryAssetKey() {
    if (state.placement?.assetKey) return state.placement.assetKey;
    if (state.drawingPath) return `linear:${state.drawingPath.styleId}`;
    if (state.drawingPatch) return `patch:${state.drawingPatch.styleId}`;
    return null;
  }

  function syncAssetLibraryActiveState() {
    const activeKey = activeLibraryAssetKey();
    for (const card of refs.assetLibrary.querySelectorAll("[data-library-asset]")) {
      card.classList.toggle("is-active", card.dataset.libraryAsset === activeKey);
    }
  }

  function renderAssetLibrary() {
    refs.assetLibrary.replaceChildren();
    const category = state.assetCategory;
    const filter = state.assetFilter.trim().toLowerCase();
    refs.assetFactionRow.hidden = category !== "units";
    for (const button of refs.assetCategoryButtons) {
      const active = button.dataset.assetCategory === category;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }

    let assets = libraryAssets();
    if (category !== "all") assets = assets.filter(asset => asset.category === category);
    if (filter) assets = assets.filter(asset => `${asset.label} ${asset.detail} ${asset.group} ${asset.id}`.toLowerCase().includes(filter));

    const groups = new Map();
    for (const asset of assets) {
      if (!groups.has(asset.group)) groups.set(asset.group, []);
      groups.get(asset.group).push(asset);
    }

    for (const [title, items] of groups) {
      const section = document.createElement("section");
      section.className = "editor-asset-group";
      const heading = document.createElement("h3");
      heading.className = "editor-asset-group-heading";
      heading.textContent = title;
      const grid = document.createElement("div");
      grid.className = "editor-asset-grid";
      for (const asset of items.sort((a, b) => a.label.localeCompare(b.label))) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "editor-asset-card";
        card.classList.toggle("is-active", activeLibraryAssetKey() === asset.key);
        card.dataset.libraryAsset = asset.key;
        card.title = asset.kind === "linear" || asset.kind === "patch" ? `Draw ${asset.label}` : `Place ${asset.label}`;
        const copy = document.createElement("span");
        copy.className = "editor-asset-copy";
        const label = document.createElement("strong");
        label.textContent = asset.label;
        const detail = document.createElement("small");
        detail.textContent = asset.detail;
        copy.append(label, detail);
        card.append(libraryPreview(asset), copy);
        grid.appendChild(card);
      }
      section.append(heading, grid);
      refs.assetLibrary.appendChild(section);
    }

    if (!assets.length) {
      const empty = document.createElement("div");
      empty.className = "editor-asset-empty";
      empty.textContent = "No library objects match this search.";
      refs.assetLibrary.appendChild(empty);
    }
    refs.assetCount.textContent = String(assets.length);
  }

  function setAssetCategory(category) {
    state.assetCategory = ["all", "terrain", "paths", "patches", "units", "scenario"].includes(category) ? category : "all";
    renderAssetLibrary();
  }

  function activateLibraryAsset(key) {
    const asset = libraryAssets().find(entry => entry.key === key);
    if (!asset) return;
    if (asset.kind === "linear") {
      TOOLS.cancelPlacement(state);
      addLinear(asset.id);
      return;
    }
    if (asset.kind === "patch") {
      TOOLS.cancelPlacement(state);
      addPatch(asset.id);
      return;
    }
    setSelection(null);
    TOOLS.cancelDrawing(state);
    TOOLS.beginPlacement(state, {
      assetKey:asset.key,
      kind:asset.kind,
      id:asset.id,
      faction:asset.kind === "unit" ? refs.unitFactionSelect.value : null,
      label:asset.label
    });
    state.status = `Place ${asset.label} · click the table · hold Shift to stamp · R rotate · Esc cancel`;
    renderAll();
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

  function isItemVisible(item) {
    return VISIBILITY.isVisible(item);
  }

  function isItemLocked(item) {
    return VISIBILITY.isLocked(item);
  }

  function scenarioType(scenario = state.document) {
    const explicit = String(scenario?.structure?.templateId || "");
    if (["control", "breakthrough", "delay", "elimination", "survival", "escort", "raid", "custom"].includes(explicit)) return explicit;
    return scenario?.id === "breakthrough" ? "breakthrough" : "control";
  }

  function saveCustomDraft() {
    if (!state.document || SCENARIOS[state.sourceScenarioId]) return;
    const draft = persistence.persistScenario(state.document);
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
    setSelection(null);
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
    setSelection(null);
    state.drawingPath = null;
    state.drawingPatch = null;
    state.drawingCursor = null;
    state.placement = null;
    state.pointEdit = null;
    state.scaleSession = null;
    state.keyboardTransform = null;
    state.history = [];
    state.future = [];
    state.status = `Loaded ${source.title}`;
    refs.scenarioSelect.value = id;
    refs.scenarioTypeSelect.value = scenarioType(state.document);
    refs.victoryPolicySelect.value = state.document.victory?.policy ?? "points";
    refs.victoryTiebreakerSelect.value = state.document.victory?.tiebreaker ?? "survivingUnits";
    refs.victoryBlueThreshold.value = state.document.victory?.thresholds?.blue ?? 5;
    refs.victoryRedThreshold.value = state.document.victory?.thresholds?.red ?? 5;
    refs.victoryBlueThreshold.disabled = refs.victoryPolicySelect.value !== "asymmetric_thresholds";
    refs.victoryRedThreshold.disabled = refs.victoryPolicySelect.value !== "asymmetric_thresholds";
    refs.eliminationVictoryToggle.checked = state.document.victory?.elimination === true;
    if (refs.returnToGameLink) refs.returnToGameLink.href = `index.html?fromEditor=1&scenario=${encodeURIComponent(id)}`;
    persistence.rememberScenario(id);
    renderAll();
    requestAnimationFrame(fitTable);
  }

  function resetScenario() {
    if (!state.sourceDocument) return;
    const before = beforeMutation();
    state.document = DOCUMENT.create(state.sourceDocument);
    setSelection(null);
    commit(before, "Reset to source scenario");
  }

  function selectionKey(selection) {
    return SELECTION.key(selection);
  }

  function selectedObjectSelections() {
    return MULTI.unique(state.selectionSet?.length ? state.selectionSet : (state.selection ? [state.selection] : []));
  }

  function isObjectSelected(selection) {
    return MULTI.contains(selectedObjectSelections(), selection);
  }

  function setSelection(selection, options = {}) {
    const normalized = SELECTION.normalize(selection);
    if (!normalized) {
      state.selection = null;
      state.selectionSet = [];
      TOOLS.leavePointEdit(state);
      return null;
    }
    if (!SELECTION.sameObject(state.selection, normalized)) TOOLS.leavePointEdit(state);
    if (options.additive && !normalized.component) {
      TOOLS.leavePointEdit(state);
      state.selectionSet = MULTI.toggle(selectedObjectSelections(), normalized);
      state.selection = state.selectionSet.length ? state.selectionSet[state.selectionSet.length - 1] : null;
      return state.selection;
    }
    state.selection = normalized;
    state.selectionSet = [SELECTION.objectOnly(normalized)];
    return state.selection;
  }

  function select(selection, options = {}) {
    setSelection(selection, options);
    if (selection && shell.panel() !== "inspector") shell.setPanel("inspector");
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
    if (selection.kind === "linear" || selection.kind === "patch") return item.points?.[selection.pointIndex] ?? null;
    if (selection.kind === "objective" && item.type === "control_group") return item.points?.[selection.pointIndex] ?? null;
    return null;
  }

  function pointsForSelection(selection = state.selection) {
    const item = itemForSelection(selection);
    if (!item || !Array.isArray(item.points)) return null;
    if (selection?.kind === "linear" || selection?.kind === "patch") return item.points;
    return null;
  }

  function geometryBoundsFor(item, selection = state.selection) {
    if (!item || !selection) return null;
    if (selection.kind === "linear" || selection.kind === "patch") {
      const base = GEOMETRY.bounds(item.points ?? []);
      if (!base) return null;
      const pad = selection.kind === "linear" ? Math.max(.25, Math.max(...(item.points ?? []).map(point => number(point.width, number(item.width, 2)))) / 2) : .2;
      return { x:base.x - pad, y:base.y - pad, width:base.width + pad * 2, height:base.height + pad * 2 };
    }
    return null;
  }

  function objectBoundsFor(selection) {
    const normalized = SELECTION.objectOnly(selection);
    const item = itemFromSelection(normalized);
    if (!normalized || !item) return null;
    if (normalized.kind === "terrain") return { x:number(item.x), y:number(item.y), width:number(item.width), height:number(item.height) };
    if (normalized.kind === "linear" || normalized.kind === "patch") return geometryBoundsFor(item, normalized);
    if (normalized.kind === "unit") return { x:number(item.x)-.9, y:number(item.y)-.9, width:1.8, height:1.8 };
    if (normalized.kind === "objective") {
      const radius = Math.max(.7, number(item.radius, 2));
      return { x:number(item.x)-radius, y:number(item.y)-radius, width:radius*2, height:radius*2 };
    }
    if (normalized.kind === "zone") return { x:number(item.xMin), y:number(item.yMin), width:number(item.xMax)-number(item.xMin), height:number(item.yMax)-number(item.yMin) };
    return null;
  }

  function selectedBounds() {
    return MULTI.unionBounds(selectedObjectSelections().map(objectBoundsFor));
  }

  function materialChoicesForLinear(styleId) {
    const registry = LINEAR_MATERIALS[styleId] ?? LINEAR_MATERIALS[LINEAR_STYLES[styleId]?.renderer] ?? [];
    const source = Array.isArray(registry) ? registry : registry.choices ?? registry.materials ?? registry;
    if (Array.isArray(source)) return source.map(entry => typeof entry === "string" ? { value:entry, label:entry.replaceAll("_", " ") } : { value:entry.id ?? entry.value, label:entry.label ?? entry.id ?? entry.value });
    return Object.entries(source ?? {}).map(([value, entry]) => ({ value, label:entry?.label ?? value.replaceAll("_", " ") }));
  }

  function defaultLinearMaterial(styleId) {
    const registry = LINEAR_MATERIALS[styleId] ?? LINEAR_MATERIALS[LINEAR_STYLES[styleId]?.renderer];
    if (registry?.default) return registry.default;
    const choices = materialChoicesForLinear(styleId);
    return choices[0]?.value ?? "default";
  }

  function materialChoicesForPatch(styleId) {
    const style = PATCH_STYLES[styleId];
    const source = style?.materials ?? style?.materialChoices ?? [];
    if (Array.isArray(source)) return source.map(entry => {
      const value = typeof entry === "string" ? entry : entry.id ?? entry.value;
      return { value, label:typeof entry === "string" ? entry.replaceAll("_", " ") : entry.label ?? value };
    });
    return Object.entries(source).map(([value, label]) => ({ value, label:typeof label === "string" ? label : label?.label ?? value.replaceAll("_", " ") }));
  }

  function defaultLayerFor(item, selection = state.selection) {
    if (!item || !selection) return 0;
    if (selection.kind === "terrain") return LAYERS.terrainLayer({ ...item, inheritLayer:true }, TERRAIN_TYPES[item.terrainId], table().height);
    if (selection.kind === "linear") return LAYERS.linearLayer({ ...item, inheritLayer:true }, LINEAR_STYLES[item.styleId]);
    if (selection.kind === "patch") return LAYERS.patchLayer({ ...item, inheritLayer:true }, PATCH_STYLES[item.styleId]);
    if (selection.kind === "unit") return LAYERS.unitLayer({ ...item, inheritLayer:true }, table().height);
    return 0;
  }

  function normalizePointData(item) {
    if (!item?.points) return;
    item.points = item.points.map(point => {
      const clean = { ...point, x:Math.round(number(point.x) * 1000) / 1000, y:Math.round(number(point.y) * 1000) / 1000 };
      if (point.width !== undefined) clean.width = Math.max(.1, Math.round(number(point.width) * 1000) / 1000);
      return clean;
    });
  }

  function scaleLinearWidths(item, sourceItem, scale) {
    if (!item || !sourceItem || !Number.isFinite(scale) || scale <= 0) return;
    item.width = Math.max(.1, number(sourceItem.width, LINEAR_STYLES[item.styleId]?.width ?? 2) * scale);
    item.points = (item.points ?? []).map((point, index) => {
      const sourcePoint = sourceItem.points?.[index];
      if (sourcePoint?.width === undefined) {
        const copy = { ...point };
        delete copy.width;
        return copy;
      }
      return { ...point, width:Math.max(.1, number(sourcePoint.width) * scale) };
    });
  }

  function setupBoardGeometry() {
    const size = TABLE_VIEWPORT.normalizeTable(table());
    const board = TABLE_VIEWPORT.boardPixels(size, EDITOR_PIXELS_PER_INCH);
    const geometry = TABLE_VIEWPORT.surfaceGeometry({
      viewportWidth:Math.max(1, refs.viewport.clientWidth),
      viewportHeight:Math.max(1, refs.viewport.clientHeight),
      boardWidth:board.width,
      boardHeight:board.height,
      zoom:state.zoom,
      minimumMargin:96,
      marginRatio:.5
    });
    state.viewportGeometry = { ...geometry, boardWidth:board.width, boardHeight:board.height };

    refs.board.style.width = `${board.width}px`;
    refs.board.style.height = `${board.height}px`;
    refs.board.style.left = `${geometry.boardLeft}px`;
    refs.board.style.top = `${geometry.boardTop}px`;
    refs.board.style.transform = `scale(${state.zoom})`;
    refs.stage.style.width = `${geometry.surfaceWidth}px`;
    refs.stage.style.height = `${geometry.surfaceHeight}px`;
    refs.interactionSvg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
    refs.gridLayer.style.setProperty("--editor-grid-x", `${100 / size.width}%`);
    refs.gridLayer.style.setProperty("--editor-grid-y", `${100 / size.height}%`);
    refs.gridLayer.hidden = !state.showGrid;
    refs.deploymentLayer.hidden = !state.showZones;
    refs.footprintLayer.hidden = !state.showFootprints;
    refs.objectiveLayer.hidden = !state.showObjectives;
    refs.unitLayer.hidden = !state.showUnits;
    refs.placementLayer.hidden = !state.placement;

    const mode = TOOLS.mode(state);
    refs.board.dataset.editorMode = mode;
    refs.board.classList.toggle("is-drawing-path", mode === TOOLS.MODES.DRAW_LINEAR);
    refs.board.classList.toggle("is-drawing-patch", mode === TOOLS.MODES.DRAW_PATCH);
    refs.board.classList.toggle("is-placing-object", mode === TOOLS.MODES.PLACE);
    refs.board.classList.toggle("is-panning", Boolean(state.pan));
    refs.board.classList.toggle("can-pan", mode === TOOLS.MODES.SELECT && !state.pan);
    refs.viewport.classList.toggle("is-panning", Boolean(state.pan));
    refs.zoomReadout.textContent = `${Math.round(state.zoom * 100)}%`;
    document.body.classList.toggle("editor-table-portrait", size.height > size.width);
  }

  function renderTerrain() {
    TERRAIN_PRESENTATION.renderScenarioTerrain({ layer:refs.terrainLayer, battlefield:refs.board, scenario:state.document });
    const terrainById = new Map((state.document.terrain ?? []).map(item => [String(item.id), item]));
    for (const element of refs.terrainLayer.querySelectorAll(".terrain-piece")) {
      const item = terrainById.get(String(element.dataset.terrainInstanceId));
      const definition = TERRAIN_TYPES[item?.terrainId];
      element.hidden = !state.showObjects || !isItemVisible(item);
      element.style.display = element.hidden ? "none" : "";
      element.dataset.editorKind = "terrain";
      element.style.zIndex = String(LAYERS.terrainLayer(item, definition, table().height));
      element.classList.toggle("is-editor-selected", state.selection?.kind === "terrain" && String(state.selection.id) === String(element.dataset.terrainInstanceId));
      element.classList.toggle("is-editor-locked", isItemLocked(item));
      element.dataset.editorLocked = String(isItemLocked(item));
    }
    const patchesById = new Map((state.document.terrainPatches ?? []).map(item => [String(item.id), item]));
    for (const patchSvg of refs.terrainLayer.querySelectorAll(".terrain-patch-svg")) {
      const patch = patchesById.get(String(patchSvg.dataset.patchId));
      patchSvg.hidden = !state.showPatches || !isItemVisible(patch);
      patchSvg.style.display = patchSvg.hidden ? "none" : "";
      patchSvg.dataset.editorLocked = String(isItemLocked(patch));
      patchSvg.classList.toggle("is-editor-locked", isItemLocked(patch));
    }
    for (const tree of refs.board.querySelectorAll(":scope > .terrain-patch-generated-tree")) {
      const patch = patchesById.get(String(tree.dataset.patchId));
      tree.hidden = !state.showPatches || !isItemVisible(patch);
      tree.style.display = tree.hidden ? "none" : "";
      tree.classList.toggle("is-editor-locked", isItemLocked(patch));
    }
    const pathsById = new Map((state.document.linearTerrain ?? []).map(item => [String(item.id), item]));
    for (const linearSvg of refs.terrainLayer.querySelectorAll(".linear-terrain-svg")) {
      const path = pathsById.get(String(linearSvg.dataset.linearId));
      linearSvg.hidden = !state.showLinear || !isItemVisible(path);
      linearSvg.style.display = linearSvg.hidden ? "none" : "";
      linearSvg.dataset.editorLocked = String(isItemLocked(path));
      linearSvg.classList.toggle("is-editor-locked", isItemLocked(path));
    }

    for (const element of refs.board.querySelectorAll(":scope > .scene-promoted-terrain, :scope > .scene-building-foreground")) {
      const item = terrainById.get(String(element.dataset.terrainInstanceId));
      const hidden = !state.showObjects || !isItemVisible(item);
      element.hidden = hidden;
      element.style.display = hidden ? "none" : "";
      element.dataset.editorLocked = String(isItemLocked(item));
      element.classList.toggle("is-editor-locked", isItemLocked(item));
    }
    for (const patchSvg of refs.board.querySelectorAll(":scope > .scene-promoted-object.terrain-patch-svg")) {
      const patch = patchesById.get(String(patchSvg.dataset.patchId));
      const hidden = !state.showPatches || !isItemVisible(patch);
      patchSvg.hidden = hidden;
      patchSvg.style.display = hidden ? "none" : "";
      patchSvg.dataset.editorLocked = String(isItemLocked(patch));
      patchSvg.classList.toggle("is-editor-locked", isItemLocked(patch));
    }
    for (const linearSvg of refs.board.querySelectorAll(":scope > .scene-promoted-object.linear-terrain-svg")) {
      const path = pathsById.get(String(linearSvg.dataset.linearId));
      const hidden = !state.showLinear || !isItemVisible(path);
      linearSvg.hidden = hidden;
      linearSvg.style.display = hidden ? "none" : "";
      linearSvg.dataset.editorLocked = String(isItemLocked(path));
      linearSvg.classList.toggle("is-editor-locked", isItemLocked(path));
    }
  }

  function renderZones() {
    refs.deploymentLayer.replaceChildren();
    if (!state.showZones) return;
    for (const faction of ["blue", "red"]) {
      const root = state.document.deployment?.zones?.[faction];
      if (!root) continue;
      if (isItemVisible(root)) appendZone(root, faction, "__main", false);
      for (const subzone of root.subzones ?? []) if (isItemVisible(subzone)) appendZone(subzone, faction, subzone.id, true);
    }
  }

  function appendZone(zone, faction, zoneId, isSubzone) {
    const node = document.createElement("div");
    node.className = `editor-zone ${faction}${isSubzone ? " is-subzone" : ""}`;
    node.dataset.editorKind = "zone";
    node.dataset.faction = faction;
    node.dataset.zoneId = zoneId;
    node.classList.toggle("is-editor-locked", isItemLocked(zone));
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
        if (!isItemVisible(unit)) continue;
        const node = document.createElement("div");
        node.className = `editor-unit ${faction}`;
        node.dataset.editorKind = "unit";
        node.dataset.unitId = unit.id;
        node.dataset.faction = faction;
        node.classList.toggle("is-editor-locked", isItemLocked(unit));
        node.style.left = percent(unit.x, table().width);
        node.style.top = percent(unit.y, table().height);
        node.style.zIndex = String(LAYERS.unitLayer(unit, table().height));
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
      if (!isItemVisible(objective)) continue;
      const points = objective.type === "control_group" ? objective.points ?? [] : [objective];
      points.forEach((point, pointIndex) => {
        const node = document.createElement("div");
        const radius = Math.max(0.7, number(point.radius, number(objective.radius, 2)));
        node.className = "editor-objective";
        node.dataset.editorKind = "objective";
        node.dataset.objectiveId = objective.id;
        node.dataset.objectiveType = objective.type || "control_zone";
        node.classList.toggle("is-editor-locked", isItemLocked(objective));
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
    const showAnything = state.showLinear || state.showPatches || state.drawingPath || state.drawingPatch;
    refs.interactionSvg.hidden = !showAnything;
    if (!showAnything) return;

    if (state.showPatches || state.drawingPatch) {
      for (const patch of state.document.terrainPatches ?? []) {
        if (!state.showPatches || !isItemVisible(patch) || !Array.isArray(patch.points) || patch.points.length < 3) continue;
        const objectSelection = { kind:"patch", id:patch.id };
        const selected = isObjectSelected(objectSelection);
        const primary = SELECTION.sameObject(state.selection, objectSelection);
        const pointEditing = primary && TOOLS.isPointEditing(state, objectSelection);
        const interactive = !isItemLocked(patch);
        const points = patch.points.map(point => `${number(point.x)},${number(point.y)}`).join(" ");

        if (interactive) refs.interactionSvg.appendChild(svgNode("polygon", {
          points,
          class:"editor-patch-hit",
          "data-editor-kind":"patch",
          "data-patch-id":patch.id
        }));
        if (selected) refs.interactionSvg.appendChild(svgNode("polygon", { points, class:"editor-patch-highlight" }));

        if (pointEditing) {
          for (let index = 0; index < patch.points.length; index += 1) {
            const a = patch.points[index];
            const b = patch.points[(index + 1) % patch.points.length];
            const sectionSelected = state.selection.segmentIndex === index;
            if (sectionSelected) refs.interactionSvg.appendChild(svgNode("line", {
              x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-linear-segment-highlight"
            }));
            if (interactive) refs.interactionSvg.appendChild(svgNode("line", {
              x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-patch-edge-hit",
              "data-editor-kind":"patch-segment", "data-patch-id":patch.id, "data-segment-index":index
            }));
          }
          if (interactive) patch.points.forEach((point, index) => {
            refs.interactionSvg.appendChild(svgNode("circle", {
              cx:number(point.x), cy:number(point.y), r:.62,
              class:`editor-patch-point${state.selection.pointIndex === index ? " is-selected" : ""}`,
              "data-editor-kind":"patch-point", "data-patch-id":patch.id, "data-point-index":index
            }));
          });
        }
      }
    }

    if (state.showLinear || state.drawingPath) {
      for (const path of state.document.linearTerrain ?? []) {
        if (!state.showLinear || !isItemVisible(path) || !Array.isArray(path.points) || path.points.length < 2) continue;
        const objectSelection = { kind:"linear", id:path.id };
        const selected = isObjectSelected(objectSelection);
        const primary = SELECTION.sameObject(state.selection, objectSelection);
        const pointEditing = primary && TOOLS.isPointEditing(state, objectSelection);
        const interactive = !isItemLocked(path);
        const points = path.points.map(point => `${number(point.x)},${number(point.y)}`).join(" ");

        if (selected) {
          refs.interactionSvg.appendChild(svgNode("polyline", {
            points,
            class:"editor-linear-group-highlight",
            "stroke-width":Math.max(.6, Math.max(...path.points.map(point => number(point.width, number(path.width, 2)))) + .45)
          }));
          refs.interactionSvg.appendChild(svgNode("polyline", { points, class:"editor-linear-highlight" }));
        }

        for (let index = 0; index < path.points.length - 1; index += 1) {
          const a = path.points[index];
          const b = path.points[index + 1];
          if (pointEditing && state.selection.segmentIndex === index) refs.interactionSvg.appendChild(svgNode("line", {
            x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-linear-segment-highlight"
          }));
          if (interactive) {
            const segmentHitWidth = Math.max(1.15, (number(a.width, number(path.width, 2)) + number(b.width, number(path.width, 2))) / 2);
            refs.interactionSvg.appendChild(svgNode("line", {
              x1:number(a.x), y1:number(a.y), x2:number(b.x), y2:number(b.y), class:"editor-linear-segment-hit",
              "stroke-width":segmentHitWidth,
              "data-editor-kind":"segment", "data-linear-id":path.id, "data-segment-index":index
            }));
          }
        }

        if (pointEditing && interactive) path.points.forEach((point, index) => {
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

    if (state.drawingPath) {
      const preview = [...state.drawingPath.points];
      if (state.drawingCursor && preview.length) preview.push(state.drawingCursor);
      if (preview.length >= 2) refs.interactionSvg.appendChild(svgNode("polyline", {
        points:preview.map(point => `${number(point.x)},${number(point.y)}`).join(" "), class:"editor-drawing-path"
      }));
      state.drawingPath.points.forEach(point => refs.interactionSvg.appendChild(svgNode("circle", {
        cx:number(point.x), cy:number(point.y), r:.48, class:"editor-drawing-waypoint"
      })));
    }

    if (state.drawingPatch) {
      const preview = [...state.drawingPatch.points];
      if (state.drawingCursor && preview.length) preview.push(state.drawingCursor);
      if (preview.length >= 2) refs.interactionSvg.appendChild(svgNode("polygon", {
        points:preview.map(point => `${number(point.x)},${number(point.y)}`).join(" "), class:"editor-drawing-patch"
      }));
      state.drawingPatch.points.forEach(point => refs.interactionSvg.appendChild(svgNode("circle", {
        cx:number(point.x), cy:number(point.y), r:.48, class:"editor-drawing-patch-point"
      })));
    }
  }

  function renderFootprints() {
    refs.footprintLayer.replaceChildren();
    if (!state.showFootprints) return;
    for (const terrain of state.document.terrain ?? []) {
      if (!isItemVisible(terrain)) continue;
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
    if (state.marquee) {
      const x = Math.min(state.marquee.start.x, state.marquee.current.x);
      const y = Math.min(state.marquee.start.y, state.marquee.current.y);
      const width = Math.abs(state.marquee.current.x - state.marquee.start.x);
      const height = Math.abs(state.marquee.current.y - state.marquee.start.y);
      const marquee = document.createElement("div");
      marquee.className = "editor-selection-marquee";
      marquee.style.left = percent(x, table().width);
      marquee.style.top = percent(y, table().height);
      marquee.style.width = percent(width, table().width);
      marquee.style.height = percent(height, table().height);
      refs.selectionLayer.appendChild(marquee);
    }
    const selections = selectedObjectSelections();
    if (!selections.length || !state.selection) return;

    function allowed(selection, item) {
      if (!item || !isItemVisible(item)) return false;
      if (selection.kind === "terrain" && !state.showObjects) return false;
      if (selection.kind === "patch" && !state.showPatches) return false;
      if (selection.kind === "linear" && !state.showLinear) return false;
      if (selection.kind === "unit" && !state.showUnits) return false;
      if (selection.kind === "objective" && !state.showObjectives) return false;
      if (selection.kind === "zone" && !state.showZones) return false;
      return true;
    }

    function appendRect(rect, className) {
      if (!rect) return null;
      const node = document.createElement("div");
      node.className = className;
      node.style.left = percent(rect.x, table().width);
      node.style.top = percent(rect.y, table().height);
      node.style.width = percent(rect.width, table().width);
      node.style.height = percent(rect.height, table().height);
      refs.selectionLayer.appendChild(node);
      return node;
    }

    if (selections.length > 1) {
      const visibleSelections = selections.filter(selection => allowed(selection, itemFromSelection(selection)));
      for (const selection of visibleSelections) appendRect(objectBoundsFor(selection), "editor-multi-selection-member");
      const bounds = MULTI.unionBounds(visibleSelections.map(objectBoundsFor));
      if (!bounds) return;
      const locked = visibleSelections.every(selection => isItemLocked(itemFromSelection(selection)));
      const node = appendRect(bounds, `editor-selection-box is-multi${locked ? " is-locked" : ""}`);
      node.dataset.selectionCount = String(visibleSelections.length);
      if (!locked) {
        const resize = document.createElement("span");
        resize.className = "editor-selection-handle editor-resize-handle";
        resize.dataset.editorAction = "resize";
        const stem = document.createElement("span");
        stem.className = "editor-rotate-stem";
        const rotate = document.createElement("span");
        rotate.className = "editor-selection-handle editor-rotate-handle";
        rotate.dataset.editorAction = "rotate";
        node.append(resize, stem, rotate);
      }
      return;
    }

    const selection = state.selection;
    const item = itemForSelection();
    if (!allowed(selection, item)) return;
    let rect = null;
    let pointLike = false;
    let rotation = 0;
    let resizable = false;
    let rotatable = false;
    const locked = isItemLocked(item);

    if (selection.kind === "terrain") {
      rect = { x:number(item.x), y:number(item.y), width:number(item.width), height:number(item.height) };
      rotation = number(item.rotation);
      const definition = TERRAIN_TYPES[item.terrainId];
      resizable = Boolean(definition?.editor?.resizable);
      rotatable = Boolean(definition?.editor?.rotatable);
    } else if (selection.kind === "linear" || selection.kind === "patch") {
      rect = geometryBoundsFor(item, selection);
      resizable = true;
      rotatable = true;
    } else if (selection.kind === "unit") {
      rect = { x:number(item.x), y:number(item.y), width:1.8, height:1.8 };
      pointLike = true;
    } else if (selection.kind === "objective") {
      const point = pointForSelection() ?? item;
      const radius = Math.max(.7, number(point.radius, number(item.radius, 2)));
      rect = { x:number(point.x), y:number(point.y), width:radius*2, height:radius*2 };
      pointLike = true;
      resizable = true;
    } else if (selection.kind === "zone") {
      rect = { x:number(item.xMin), y:number(item.yMin), width:number(item.xMax)-number(item.xMin), height:number(item.yMax)-number(item.yMin) };
      resizable = true;
    }

    if (!rect) return;
    const node = appendRect(rect, `editor-selection-box${pointLike ? " is-point" : ""}${selection.kind === "linear" ? " is-linear" : ""}${selection.kind === "patch" ? " is-patch" : ""}${locked ? " is-locked" : ""}`);
    if (rotation) node.style.transform = `rotate(${rotation}deg)`;
    if (resizable && !locked) {
      const handle = document.createElement("span");
      handle.className = "editor-selection-handle editor-resize-handle";
      handle.dataset.editorAction = selection.kind === "objective" ? "resize-objective" : "resize";
      node.appendChild(handle);
    }
    if (rotatable && !locked) {
      const stem = document.createElement("span");
      stem.className = "editor-rotate-stem";
      const handle = document.createElement("span");
      handle.className = "editor-selection-handle editor-rotate-handle";
      handle.dataset.editorAction = "rotate";
      node.append(stem, handle);
    }
  }

  function makeObjectThumbnail(entry) {
    const thumb = document.createElement("span");
    thumb.className = "editor-object-thumb";
    const item = entry.item;
    if (entry.selection.kind === "terrain") {
      const definition = TERRAIN_TYPES[item?.terrainId];
      if (definition?.renderer === "building" && BUILDINGS?.createArt) {
        thumb.classList.add("editor-object-thumb-building");
        try { thumb.appendChild(BUILDINGS.createArt({ definition, instance:{ ...item, id:`thumb-${item.id}` } })); }
        catch (_error) { thumb.classList.add("editor-object-thumb-terrain"); }
      } else {
        thumb.classList.add("editor-object-thumb-terrain");
        const fill = definition?.renderer === "field" ? "#a58d57" : definition?.renderer === "woods" || definition?.renderer === "orchard" ? "#6f8259" : "#887c68";
        thumb.style.setProperty("--thumb-fill", fill);
      }
    } else if (entry.selection.kind === "linear") {
      const style = LINEAR_STYLES[item?.styleId];
      const material = LINEAR_MATERIALS[item?.styleId]?.[item?.material] ?? {};
      thumb.classList.add("editor-object-thumb-linear");
      if (style?.renderer === "rail") thumb.classList.add("is-rail");
      thumb.style.setProperty("--thumb-base", material.surface ?? material.water ?? material.ballast ?? "#94805b");
      thumb.style.setProperty("--thumb-detail", material.detail ?? material.rail ?? "#d0bd8d");
    } else if (entry.selection.kind === "patch") {
      thumb.classList.add("editor-object-thumb-patch");
      const fills = { woods:"#657f4c", woods_dense:"#3f6142", orchard:"#78915a", field_tilled:"#92724e", field_wheat:"#b9954e", field_cabbage:"#7c8952", concrete:"#9b9a90", cobblestone:"#898a82", mud:"#65513f", pond:"#72afc0" };
      thumb.style.setProperty("--thumb-fill", fills[item?.styleId] ?? "#728450");
    } else if (entry.selection.kind === "unit") {
      thumb.classList.add("editor-object-thumb-unit");
      thumb.style.setProperty("--thumb-color", entry.selection.faction === "red" ? "#a85850" : "#527da6");
    } else if (entry.selection.kind === "objective") thumb.classList.add("editor-object-thumb-objective");
    else if (entry.selection.kind === "zone") thumb.classList.add("editor-object-thumb-zone");
    return thumb;
  }

  function supportsLayering(selection) {
    return ["terrain", "linear", "patch", "unit"].includes(selection?.kind);
  }

  function effectiveLayer(selection, item = itemForSelection(selection)) {
    if (!supportsLayering(selection) || !item) return null;
    return item.inheritLayer === false ? number(item.layerOrder, defaultLayerFor(item, selection)) : defaultLayerFor(item, selection);
  }

  function nudgeHierarchyLayer(selection, direction) {
    const item = itemForSelection(selection);
    if (!supportsLayering(selection) || !item || isItemLocked(item)) return;
    const before = beforeMutation();
    const current = effectiveLayer(selection, item);
    item.inheritLayer = false;
    item.layerOrder = clamp(current + (direction === "up" ? 10 : -10), 0, 6999);
    setSelection(selection);
    commit(before, `Moved ${direction === "up" ? "forward" : "backward"} to layer ${item.layerOrder}`);
  }

  function reorderHierarchyLayer(sourceSelection, targetSelection, placeBefore) {
    const source = itemForSelection(sourceSelection);
    const target = itemForSelection(targetSelection);
    if (!supportsLayering(sourceSelection) || !supportsLayering(targetSelection) || !source || !target || source === target || isItemLocked(source)) return;
    const before = beforeMutation();
    const targetLayer = effectiveLayer(targetSelection, target);
    source.inheritLayer = false;
    source.layerOrder = clamp(targetLayer + (placeBefore ? 10 : -10), 0, 6999);
    setSelection(sourceSelection);
    commit(before, `Reordered ${source.id || sourceSelection.kind} to layer ${source.layerOrder}`);
  }

  function objectGroups() {
    const groups = new Map([
      ["ground", { id:"ground", title:"Ground patches", items:[] }],
      ["water", { id:"water", title:"Water", items:[] }],
      ["roads", { id:"roads", title:"Roads and paths", items:[] }],
      ["rail", { id:"rail", title:"Railways", items:[] }],
      ["low", { id:"low", title:"Low cover and scatter", items:[] }],
      ["buildings", { id:"buildings", title:"Buildings", items:[] }],
      ["woods", { id:"woods", title:"Woods and orchards", items:[] }],
      ["objectives", { id:"objectives", title:"Objectives", items:[] }],
      ["zones", { id:"zones", title:"Deployment zones", items:[] }],
      ["blue", { id:"blue", title:"Polish / Blue units", items:[] }],
      ["red", { id:"red", title:"German / Red units", items:[] }]
    ]);

    function add(groupId, entry) {
      groups.get(groupId)?.items.push(entry);
    }

    for (const item of state.document.terrain ?? []) {
      const definition = TERRAIN_TYPES[item.terrainId];
      const renderer = definition?.renderer;
      let groupId = "low";
      if (definition?.family === "building") groupId = "buildings";
      else if (renderer === "woods" || renderer === "orchard") groupId = "woods";
      else if (definition?.family === "ground") groupId = "ground";
      else if (definition?.family === "water" || renderer === "stream" || renderer === "ditch") groupId = "water";
      else if (renderer === "rail" || renderer === "rail_crossing") groupId = "rail";
      else if (definition?.family === "transport") groupId = "roads";
      add(groupId, { selection:{kind:"terrain", id:item.id}, item, label:item.id, detail:definition?.label || item.terrainId });
    }

    for (const item of state.document.terrainPatches ?? []) {
      const style = PATCH_STYLES[item.styleId];
      const groupId = WOODLAND.isWoodland(item.styleId) ? "woods" : style?.family === "water" ? "water" : "ground";
      add(groupId, { selection:{kind:"patch", id:item.id}, item, label:item.id, detail:style?.label || item.styleId });
    }

    for (const item of state.document.linearTerrain ?? []) {
      const style = LINEAR_STYLES[item.styleId];
      const groupId = style?.renderer === "rail" ? "rail" : ["stream", "ditch"].includes(style?.renderer) ? "water" : ["road", "path"].includes(style?.renderer) ? "roads" : "low";
      add(groupId, { selection:{kind:"linear", id:item.id}, item, label:item.id, detail:`${style?.label || item.styleId} · ${item.material || defaultLinearMaterial(item.styleId)}` });
    }

    for (const item of state.document.objectives ?? []) add("objectives", { selection:{kind:"objective", id:item.id}, item, label:item.label || item.id, detail:(item.type || "control_zone").replaceAll("_", " ") });

    for (const faction of ["blue", "red"]) {
      const root = state.document.deployment?.zones?.[faction];
      if (root) {
        add("zones", { selection:{kind:"zone", faction, zoneId:"__main"}, item:root, label:root.label || `${faction} deployment`, detail:"zone" });
        for (const zone of root.subzones ?? []) add("zones", { selection:{kind:"zone", faction, zoneId:zone.id}, item:zone, label:zone.label || zone.id, detail:`${faction} subzone` });
      }
      for (const item of state.document.forces?.[faction] ?? []) add(faction, { selection:{kind:"unit", id:item.id, faction}, item, label:item.name || item.id, detail:unitAbbreviation(item) });
    }
    for (const group of groups.values()) {
      if (!group.items.some(entry => supportsLayering(entry.selection))) continue;
      group.items.sort((a, b) => {
        const layerDifference = number(effectiveLayer(b.selection, b.item), -1) - number(effectiveLayer(a.selection, a.item), -1);
        return layerDifference || String(a.label).localeCompare(String(b.label));
      });
    }
    return [...groups.values()];
  }

  function renderObjectList() {
    refs.objectList.replaceChildren();
    const filter = state.objectFilter.trim().toLowerCase();
    let count = 0;
    for (const group of objectGroups()) {
      const items = filter ? group.items.filter(entry => `${entry.label} ${entry.detail} ${group.title}`.toLowerCase().includes(filter)) : group.items;
      if (!items.length) continue;
      const collapsed = Boolean(state.collapsedGroups[group.id]) && !filter;
      const heading = document.createElement("div");
      heading.className = "editor-object-group-heading";
      heading.dataset.groupId = group.id;
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "editor-object-group-toggle";
      collapse.dataset.groupToggle = group.id;
      collapse.textContent = collapsed ? "▸" : "▾";
      collapse.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${group.title}`);
      const title = document.createElement("span");
      title.className = "editor-object-group-title";
      title.textContent = group.title;
      const tally = document.createElement("small");
      tally.textContent = String(items.length);
      const showAll = document.createElement("button");
      showAll.type = "button";
      showAll.className = "editor-object-group-action";
      showAll.dataset.groupVisibility = group.id;
      showAll.title = "Show or hide this group";
      showAll.textContent = items.every(entry => isItemVisible(entry.item)) ? "◉" : "○";
      const lockAll = document.createElement("button");
      lockAll.type = "button";
      lockAll.className = "editor-object-group-action";
      lockAll.dataset.groupLock = group.id;
      lockAll.title = "Lock or unlock this group";
      lockAll.textContent = items.every(entry => isItemLocked(entry.item)) ? "▣" : "▢";
      heading.append(collapse, title, tally, showAll, lockAll);
      refs.objectList.appendChild(heading);
      count += items.length;
      if (collapsed) continue;

      for (const entry of items) {
        const row = document.createElement("div");
        const visible = isItemVisible(entry.item);
        const locked = isItemLocked(entry.item);
        row.className = `editor-object-row${visible ? "" : " is-hidden-object"}${locked ? " is-locked-object" : ""}${isObjectSelected(entry.selection) ? " is-selected" : ""}`;
        row.dataset.rowSelection = JSON.stringify(entry.selection);
        row.draggable = supportsLayering(entry.selection) && !locked;
        if (row.draggable) row.title = "Drag to change layer order";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "editor-object-item";
        button.dataset.selection = JSON.stringify(entry.selection);
        const copy = document.createElement("span");
        copy.className = "editor-object-copy";
        const label = document.createElement("span");
        label.textContent = entry.label;
        const detail = document.createElement("small");
        detail.textContent = entry.detail;
        copy.append(label, detail);
        const layer = document.createElement("small");
        layer.className = "editor-object-layer-readout";
        if (entry.item?.inheritLayer === false) layer.textContent = `L${number(entry.item.layerOrder)}`;
        button.append(makeObjectThumbnail(entry), copy, layer);

        const lock = document.createElement("button");
        lock.type = "button";
        lock.className = `editor-object-lock${locked ? " is-locked" : ""}`;
        lock.dataset.lockSelection = JSON.stringify(entry.selection);
        lock.setAttribute("aria-label", `${locked ? "Unlock" : "Lock"} ${entry.label}`);
        lock.title = `${locked ? "Unlock" : "Lock"} ${entry.label}`;
        lock.textContent = locked ? "▣" : "▢";

        const visibility = document.createElement("button");
        visibility.type = "button";
        visibility.className = `editor-object-visibility${visible ? " is-visible" : " is-hidden"}`;
        visibility.dataset.visibilitySelection = JSON.stringify(entry.selection);
        visibility.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${entry.label}`);
        visibility.title = `${visible ? "Hide" : "Show"} ${entry.label}`;
        visibility.textContent = visible ? "◉" : "○";
        const layerStack = document.createElement("span");
        layerStack.className = "editor-object-layer-stack";
        if (supportsLayering(entry.selection)) {
          const layerUp = document.createElement("button");
          layerUp.type = "button";
          layerUp.className = "editor-object-layer-button";
          layerUp.dataset.layerSelection = JSON.stringify(entry.selection);
          layerUp.dataset.layerDirection = "up";
          layerUp.title = "Move forward";
          layerUp.setAttribute("aria-label", `Move ${entry.label} forward`);
          layerUp.textContent = "▲";
          const layerDown = document.createElement("button");
          layerDown.type = "button";
          layerDown.className = "editor-object-layer-button";
          layerDown.dataset.layerSelection = JSON.stringify(entry.selection);
          layerDown.dataset.layerDirection = "down";
          layerDown.title = "Move backward";
          layerDown.setAttribute("aria-label", `Move ${entry.label} backward`);
          layerDown.textContent = "▼";
          layerUp.disabled = locked;
          layerDown.disabled = locked;
          layerStack.append(layerUp, layerDown);
        }
        row.append(button, layerStack, lock, visibility);
        refs.objectList.appendChild(row);
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
      const selected = refs.objectList.querySelector(".editor-object-row.is-selected");
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

  function checkboxField(label, path, checked, options = {}) {
    const classes = options.full ? " editor-field-full" : "";
    return `<label class="editor-checkbox-field${classes}"><input type="checkbox" data-field="${escapeHtml(path)}"${checked ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`;
  }

  function rangeField(label, path, value, min, max, step = .1) {
    const safeLabel = escapeHtml(label);
    const safePath = escapeHtml(path);
    const safeValue = escapeHtml(value);
    return `<label class="editor-range-field"><span>${safeLabel}</span><div class="editor-range-controls"><input type="range" data-field="${safePath}" value="${safeValue}" min="${min}" max="${max}" step="${step}"><input class="editor-range-number" type="number" data-field="${safePath}" data-range-number value="${safeValue}" min="${min}" max="${max}" step="${step}" aria-label="${safeLabel} exact value"></div></label>`;
  }

  function boundsFields(item, selection) {
    const bounds = Array.isArray(item?.points) ? GEOMETRY.bounds(item.points) : geometryBoundsFor(item, selection);
    if (!bounds) return "";
    return field("Bounds X", "@bounds.x", Math.round(bounds.x * 100) / 100) +
      field("Bounds Y", "@bounds.y", Math.round(bounds.y * 100) / 100) +
      field("Bounds width", "@bounds.width", Math.round(bounds.width * 100) / 100, { min:.5 }) +
      field("Bounds height", "@bounds.height", Math.round(bounds.height * 100) / 100, { min:.5 });
  }

  function terrainRulesNote(rules, context = {}) {
    const normalized = SEMANTICS.normalize(rules ?? {}, context);
    const access = normalized.infantryAccess ? "infantry passable" : "infantry impassable";
    const vehicle = `vehicles ${normalized.vehicleAccess}`;
    return `<h3 class="editor-inspector-subheading">Gameplay</h3><p class="editor-inspector-note editor-field-full"><strong>${escapeHtml(SEMANTICS.describe(normalized))}</strong><br>${escapeHtml(access)} · ${escapeHtml(vehicle)}${normalized.defensivePosition ? " · defensive position" : ""}</p>`;
  }

  function layerControls(item) {
    const inherited = item.inheritLayer !== false;
    const layer = inherited ? defaultLayerFor(item) : number(item.layerOrder, defaultLayerFor(item));
    return `<h3 class="editor-inspector-subheading">Layering</h3>` +
      checkboxField("Inherit terrain-type layer", "inheritLayer", inherited, { full:true }) +
      field("Layer order", "layerOrder", layer, { step:"1", min:0 }) +
      `<div class="editor-layer-actions"><button class="editor-button" type="button" data-editor-command="layer-back">Send to back</button><button class="editor-button" type="button" data-editor-command="layer-down">Move down</button><button class="editor-button" type="button" data-editor-command="layer-up">Move up</button><button class="editor-button" type="button" data-editor-command="layer-front">Bring to front</button></div>`;
  }

  function transformActions(kind) {
    const label = kind === "terrain" ? "Bake visual scale" : "Normalize point data";
    return `<div class="editor-transform-actions"><button class="editor-button" type="button" data-editor-command="normalize-transform">${label}</button><button class="editor-button" type="button" data-editor-command="center-selection">Center on table</button></div>`;
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
      ["hold", "Hold until round"],
      ["casualty", "Casualty scoring"],
      ["custom", "Custom marker"]
    ].map(([value, label]) => ({ value, label }));
  }

  function renderInspector() {
    const selection = state.selection;
    const item = itemForSelection();
    const selectionCount = selectedObjectSelections().length;
    refs.selectionKindBadge.textContent = selectionCount > 1 ? `${selectionCount} OBJECTS` : selection ? (SELECTION.componentLabel(selection)?.toUpperCase() || `WHOLE ${selection.kind}`.toUpperCase()) : "NONE";
    refs.inspectorEmpty.hidden = Boolean(item);
    refs.inspectorForm.hidden = !item;
    refs.selectionActions.hidden = !item && !state.clipboard;
    refs.copySelectionButton.disabled = !selectionCount;
    refs.pasteSelectionButton.disabled = !state.clipboard;
    refs.duplicateSelectionButton.disabled = !item || (selectionCount === 1 && (selection.kind === "zone" || selection.pointIndex !== undefined || selection.segmentIndex !== undefined));
    refs.deleteSelectionButton.disabled = !item || (selectionCount === 1 && (selection.kind === "zone" || (selection.kind === "objective" && selection.pointIndex !== undefined)));
    if (!item) {
      refs.inspectorForm.innerHTML = "";
      return;
    }
    if (selectionCount > 1) {
      const lockedCount = selectedObjectSelections().filter(entry => isItemLocked(itemFromSelection(entry))).length;
      refs.inspectorForm.innerHTML = `<p class="editor-inspector-note editor-field-full"><strong>${selectionCount} objects selected.</strong> Drag the group bounds to move them together. Use the corner and rotation handles to scale or rotate around their shared center. ${lockedCount ? `${lockedCount} locked object${lockedCount === 1 ? " is" : "s are"} excluded from transforms.` : ""}</p>` +
        `<div class="editor-transform-actions editor-field-full"><button class="editor-button" type="button" data-editor-command="show-selected">Show all</button><button class="editor-button" type="button" data-editor-command="hide-selected">Hide all</button><button class="editor-button" type="button" data-editor-command="lock-selected">Lock all</button><button class="editor-button" type="button" data-editor-command="unlock-selected">Unlock all</button></div>`;
      return;
    }

    let html = checkboxField("Visible in editor and playtest", "@visible", isItemVisible(item), { full:true });
    html += checkboxField("Lock object on battlefield", "@locked", isItemLocked(item), { full:true });
    if (!isItemVisible(item)) html += `<p class="editor-inspector-note editor-hidden-note">This object is hidden on the table but remains available here and in the object list.</p>`;
    if (isItemLocked(item)) html += `<p class="editor-inspector-note editor-locked-note">Locked objects remain visible and selectable from this inspector, but battlefield clicks pass through them.</p>`;
    if (selection.kind === "terrain") {
      const definition = TERRAIN_TYPES[item.terrainId];
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Terrain type", "terrainId", item.terrainId, { choices:choiceEntries(TERRAIN_TYPES), full:true });
      if (definition?.renderer === "building" && BUILDINGS?.appearanceIds?.length) {
        html += field("Material / color", "appearance", item.appearance ?? definition.presentation?.defaultAppearance, {
          choices:BUILDINGS.appearanceIds.map(value => ({ value, label:value.replaceAll("_", " ") })), full:true
        });
      }
      html += terrainRulesNote(definition?.rules);
      html += field("X", "x", item.x);
      html += field("Y", "y", item.y);
      html += field("Width", "width", item.width, { min:.25 });
      html += field("Height", "height", item.height, { min:.25 });
      html += field("Rotation", "rotation", item.rotation ?? 0, { step:"1" });
      html += rangeField("Visual scale", "visualScale", item.visualScale ?? 1, .25, 2.5, .05);
      html += transformActions("terrain");
      html += layerControls(item);
    } else if (selection.kind === "linear") {
      const style = LINEAR_STYLES[item.styleId];
      const materials = materialChoicesForLinear(item.styleId);
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Style", "styleId", item.styleId, { choices:choiceEntries(LINEAR_STYLES), full:true });
      if (materials.length) html += field("Material", "material", item.material ?? defaultLinearMaterial(item.styleId), { choices:materials, full:true });
      html += terrainRulesNote(style?.rules, { width:item.width ?? style?.width ?? 2, family:style?.family, renderer:style?.renderer });
      html += rangeField("Path width", "width", item.width ?? style?.width ?? 2, .25, 12, .1);
      html += field("Smoothing", "smoothing", item.smoothing ?? 0, { step:".05", min:0 });
      html += field("Start cap", "start.cap", item.start?.cap ?? "none", { choices:capChoices() });
      html += field("End cap", "end.cap", item.end?.cap ?? "none", { choices:capChoices() });
      html += boundsFields(item, selection);
      html += transformActions("linear");
      if (selection.pointIndex !== undefined) {
        const point = pointForSelection();
        html += `<p class="editor-inspector-note">Waypoint ${selection.pointIndex + 1} of ${item.points.length}. Its width overrides the path width and interpolates into neighboring sections.</p>`;
        html += field("Waypoint X", "@point.x", point?.x ?? 0);
        html += field("Waypoint Y", "@point.y", point?.y ?? 0);
        html += rangeField("Waypoint width", "@point.width", point?.width ?? item.width ?? style?.width ?? 2, .15, 14, .1);
        html += `<div class="editor-waypoint-actions"><button class="editor-button" type="button" data-editor-command="insert-waypoint">Insert after</button><button class="editor-button" type="button" data-editor-command="branch-linear">Branch here</button><button class="editor-button" type="button" data-editor-command="clear-point-width">Use path width</button><button class="editor-button editor-button-danger" type="button" data-editor-command="remove-waypoint"${item.points.length <= 2 ? " disabled" : ""}>Remove point</button></div>`;
      } else if (selection.segmentIndex !== undefined) {
        html += `<p class="editor-inspector-note">Section ${selection.segmentIndex + 1} of ${item.points.length - 1}. Deleting an end section shortens the path; deleting a middle section splits it into two independent paths.</p>`;
        html += `<div class="editor-segment-actions"><button class="editor-button" type="button" data-editor-command="insert-segment-waypoint">Add midpoint</button><button class="editor-button editor-button-danger" type="button" data-editor-command="delete-segment">Delete section</button></div>`;
      } else {
        html += `<p class="editor-inspector-note">Drag inside the highlighted bounds to move the complete path. Use the corner and rotation handles to scale or rotate it. Click the selected path again to choose a section or waypoint.</p>`;
      }
      html += `<div class="editor-transform-actions"><button class="editor-button editor-button-danger" type="button" data-editor-command="delete-whole-selection">Delete entire path</button><button class="editor-button" type="button" data-editor-command="duplicate-whole-selection">Duplicate path</button></div>`;
      html += layerControls(item);
    } else if (selection.kind === "patch") {
      const style = PATCH_STYLES[item.styleId];
      const materials = materialChoicesForPatch(item.styleId);
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Patch type", "styleId", item.styleId, { choices:choiceEntries(PATCH_STYLES), full:true });
      if (materials.length) html += field("Material", "material", item.material ?? style?.material, { choices:materials, full:true });
      html += terrainRulesNote(style?.rules, { family:style?.family, renderer:"patch" });
      if (WOODLAND.isWoodland(item.styleId)) {
        const generator = item.generator ?? {};
        html += `<h3 class="editor-inspector-subheading">Generated trees</h3>`;
        html += rangeField("Density", "generator.density", generator.density ?? .7, .1, 1, .05);
        html += rangeField("Tree spacing", "generator.spacing", generator.spacing ?? 2.3, .6, 6, .1);
        html += rangeField("Edge padding", "generator.edgePadding", generator.edgePadding ?? .8, 0, 4, .1);
        html += rangeField("Scale variation", "generator.scaleVariation", generator.scaleVariation ?? .12, 0, .4, .01);
        if (item.styleId !== "orchard") html += rangeField("Rotation variation", "generator.rotationVariation", generator.rotationVariation ?? 10, 0, 90, 1);
        if (item.styleId === "orchard") {
          html += rangeField("Row spacing", "generator.rowSpacing", generator.rowSpacing ?? 3.1, .8, 8, .1);
          html += rangeField("Row angle", "generator.rowAngle", generator.rowAngle ?? 0, -90, 90, 1);
        }
        html += field("Seed", "generator.seed", generator.seed ?? 1842, { step:"1", min:0 });
        html += `<div class="editor-generator-actions"><button class="editor-button" type="button" data-editor-command="reroll-generator">Reroll trees</button><span>${WOODLAND.generate(item).length} generated tree${WOODLAND.generate(item).length === 1 ? "" : "s"}</span></div>`;
      } else html += field("Pattern rotation", "patternRotation", item.patternRotation ?? 0, { step:"1" });
      if (item.styleId === "pond") html += rangeField("Bank width", "bankWidth", item.bankWidth ?? .78, .1, 2.5, .05);
      html += boundsFields(item, selection);
      html += transformActions("patch");
      if (selection.pointIndex !== undefined) {
        const point = pointForSelection();
        html += `<p class="editor-inspector-note">Patch vertex ${selection.pointIndex + 1} of ${item.points.length}. Drag it freely to reshape the patch.</p>`;
        html += field("Vertex X", "@point.x", point?.x ?? 0);
        html += field("Vertex Y", "@point.y", point?.y ?? 0);
        html += `<div class="editor-waypoint-actions"><button class="editor-button" type="button" data-editor-command="insert-patch-point">Insert after</button><button class="editor-button editor-button-danger" type="button" data-editor-command="remove-patch-point"${item.points.length <= 3 ? " disabled" : ""}>Remove vertex</button></div>`;
      } else if (selection.segmentIndex !== undefined) {
        html += `<p class="editor-inspector-note">Patch edge ${selection.segmentIndex + 1}. Add a midpoint here, then drag it to create a new contour.</p>`;
        html += `<div class="editor-segment-actions"><button class="editor-button" type="button" data-editor-command="insert-patch-segment-point">Add midpoint</button></div>`;
      } else {
        html += `<p class="editor-inspector-note">Drag the patch to move it as one object. Resize and rotate with the selection handles. Click the selected patch again to expose its vertices and edges.</p>`;
      }
      html += `<div class="editor-transform-actions"><button class="editor-button editor-button-danger" type="button" data-editor-command="delete-whole-selection">Delete entire patch</button><button class="editor-button" type="button" data-editor-command="duplicate-whole-selection">Duplicate patch</button></div>`;
      html += layerControls(item);
    } else if (selection.kind === "unit") {
      html += field("ID", "id", item.id, { type:"text", full:true });
      html += field("Name", "name", item.name ?? "", { type:"text", full:true });
      html += field("Unit type", "unitType", item.unitType, { choices:choiceEntries(UNIT_TYPES, "name"), full:true });
      html += field("Quality", "quality", item.quality ?? "regular", { choices:["inexperienced","regular","veteran"].map(value => ({ value, label:value })) });
      html += field("Faction", "@faction", selection.faction, { type:"text", readonly:true });
      html += field("X", "x", item.x);
      html += field("Y", "y", item.y);
      html += field("Deployment zone", "deploymentZone", item.deploymentZone ?? "", { type:"text", full:true });
      html += layerControls(item);
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
        html += field("Scoring starts round", "roundScoring.0.startRound", item.roundScoring?.[0]?.startRound ?? 1, { min:1 });
        html += field("Points / controlled point", "roundScoring.0.points", item.roundScoring?.[0]?.points ?? 1, { min:0 });
        html += field("Maximum points / round", "roundScoring.0.maxPoints", item.roundScoring?.[0]?.maxPoints ?? 0, { min:0 });
      } else if (item.type === "control_zone" || item.type === "crossing") {
        html += field("Points each round", "roundPoints", item.roundPoints ?? 0, { min:0 });
        html += field("Points at battle end", "finalPoints", item.finalPoints ?? 0, { min:0 });
      } else if (item.type === "exit_unit") {
        html += field("Exit edge", "edge", item.edge ?? "red", { choices:["blue","red","top","bottom"].map(value => ({value,label:value})) });
        html += field("Faction", "faction", item.faction ?? "red", { choices:[{value:"blue",label:"blue"},{value:"red",label:"red"}] });
        html += field("Zone depth", "depth", item.depth ?? 3, { min:.25 });
        html += field("Points / exited unit", "pointsPerUnit", item.pointsPerUnit ?? 2, { min:0 });
        html += field("Opponent points / contained unit", "containmentPointsPerUnit", item.containmentPointsPerUnit ?? 0, { min:0 });
        html += field("Minimum units", "minimumUnits", item.minimumUnits ?? 0, { min:0 });
      } else if (item.type === "destroy_target" || item.type === "protect_target") {
        html += field("Assigned faction", "faction", item.faction ?? "blue", { choices:[{value:"blue",label:"blue"},{value:"red",label:"red"}] });
        html += field("Target object ID", "targetId", item.targetId ?? "", { type:"text", full:true, readonly:true });
        html += `<div class="editor-waypoint-actions editor-field-full"><button class="editor-button" type="button" data-editor-command="choose-objective-target">${state.targetPickerObjectiveId === item.id ? "Click a unit or terrain object…" : "Choose target on table"}</button><button class="editor-button editor-button-quiet" type="button" data-editor-command="clear-objective-target">Clear</button></div>`;
        html += field("Points", "points", item.points ?? 3, { min:0 });
        html += checkboxField("Immediate victory", "immediateVictory", item.immediateVictory === true, { full:true });
      } else if (item.type === "hold") {
        html += field("Assigned faction", "faction", item.faction ?? "blue", { choices:[{value:"blue",label:"blue"},{value:"red",label:"red"}] });
        html += field("Checkpoint round", "checkpointRound", item.checkpointRound ?? state.document.rounds, { min:1, max:state.document.rounds });
        html += field("Points", "points", item.points ?? 3, { min:0 });
        html += checkboxField("Continuous hold", "continuous", item.continuous === true, { full:true });
        html += checkboxField("Immediate victory", "immediateVictory", item.immediateVictory === true, { full:true });
      } else if (item.type === "casualty") {
        html += field("Points / destroyed unit", "pointsPerUnit", item.pointsPerUnit ?? 1, { min:0 });
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
    refs.validationStatusCount.textContent = String(state.issues.length);
    refs.validationList.replaceChildren();
    const errors = state.issues.filter(item => item.level === "error").length;
    const warnings = state.issues.length - errors;
    refs.validationStatusButton.classList.toggle("has-errors", errors > 0);
    refs.validationStatusButton.classList.toggle("has-warnings", warnings > 0);
    refs.validationStatusButton.title = state.issues.length ? `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}` : "Scenario passes validation";
    refs.validationSummary.className = `editor-validation-summary${errors ? " has-errors" : state.issues.length ? "" : " is-clean"}`;
    refs.validationSummary.textContent = state.issues.length ? `${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"}` : "Scenario passes validation.";
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
    const count = selectedObjectSelections().length;
    refs.selectionReadout.textContent = count > 1 ? `${count} objects selected` : SELECTION.describe(state.selection, itemForSelection());
  }

  function renderDataPreview() {
    refs.scenarioDataPreview.value = DOCUMENT.serialize(state.document, 2);
  }

  function renderPlacementGhost() {
    refs.placementLayer.replaceChildren();
    const placement = state.placement;
    const asset = placementAsset();
    if (!placement || !asset || !placement.point) return;

    const ghost = document.createElement("div");
    ghost.className = `editor-placement-ghost is-${asset.kind}`;
    ghost.style.left = percent(placement.point.x, table().width);
    ghost.style.top = percent(placement.point.y, table().height);
    ghost.style.setProperty("--placement-rotation", `${number(placement.rotation, 0)}deg`);

    if (asset.kind === "terrain") {
      const size = defaultTerrainSize(asset.definition);
      const scale = Math.max(.1, number(placement.scale, 1));
      ghost.style.width = percent(size.width * scale, table().width);
      ghost.style.height = percent(size.height * scale, table().height);
      if (asset.definition.renderer === "building" && BUILDINGS?.createArt) {
        try {
          ghost.appendChild(BUILDINGS.createArt({
            definition:asset.definition,
            instance:{ id:"placement-preview", terrainId:asset.id, x:0, y:0, width:size.width * scale, height:size.height * scale, rotation:number(placement.rotation, 0) }
          }));
        } catch (_error) { ghost.textContent = asset.label; }
      } else {
        ghost.textContent = asset.label;
      }
    } else if (asset.kind === "unit") {
      ghost.textContent = asset.definition?.name?.slice(0, 2).toUpperCase() || "U";
      ghost.classList.toggle("red", placement.faction === "red");
      ghost.classList.toggle("blue", placement.faction !== "red");
    } else {
      ghost.textContent = "◆";
      ghost.title = asset.label;
    }
    refs.placementLayer.appendChild(ghost);
  }

  function renderAll() {
    setupBoardGeometry();
    refs.scenarioTitleReadout.textContent = state.document.title || state.document.id;
    refs.scenarioSizeReadout.textContent = `${table().width}″ × ${table().height}″`;
    refs.scenarioTypeSelect.value = scenarioType(state.document);
    refs.victoryPolicySelect.value = state.document.victory?.policy ?? "points";
    refs.victoryTiebreakerSelect.value = state.document.victory?.tiebreaker ?? "survivingUnits";
    refs.victoryBlueThreshold.value = state.document.victory?.thresholds?.blue ?? 5;
    refs.victoryRedThreshold.value = state.document.victory?.thresholds?.red ?? 5;
    refs.victoryBlueThreshold.disabled = refs.victoryPolicySelect.value !== "asymmetric_thresholds";
    refs.victoryRedThreshold.disabled = refs.victoryPolicySelect.value !== "asymmetric_thresholds";
    refs.eliminationVictoryToggle.checked = state.document.victory?.elimination === true;
    const customScenario = !isBuiltInScenario();
    refs.renameScenarioButton.disabled = !customScenario;
    refs.deleteScenarioButton.disabled = !customScenario;
    refs.saveReadout.textContent = state.status;
    refs.linearDrawActions.hidden = !state.drawingPath;
    refs.finishLinearButton.disabled = (state.drawingPath?.points.length ?? 0) < 2;
    refs.patchDrawActions.hidden = !state.drawingPatch;
    refs.finishPatchButton.disabled = (state.drawingPatch?.points.length ?? 0) < 3;
    renderZones();
    renderTerrain();
    renderFootprints();
    renderObjectives();
    renderUnits();
    renderLinearInteraction();
    renderPlacementGhost();
    syncAssetLibraryActiveState();
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

  function captureTransformEntry(selection) {
    const normalized = SELECTION.objectOnly(selection);
    const item = itemFromSelection(normalized);
    if (!item || isItemLocked(item)) return null;
    return {
      selection:normalized,
      original:DOCUMENT.clone(item),
      originalPoints:Array.isArray(item.points) ? GEOMETRY.clonePoints(item.points) : null,
      bounds:objectBoundsFor(normalized)
    };
  }

  function applyGroupTranslation(entry, dx, dy) {
    const item = itemFromSelection(entry.selection);
    const original = entry.original;
    if (!item) return;
    if (Array.isArray(entry.originalPoints)) {
      item.points = GEOMETRY.translate(entry.originalPoints, dx, dy).map(point => ({ ...point, x:snap(point.x), y:snap(point.y) }));
    } else if (entry.selection.kind === "zone") {
      item.xMin = snap(number(original.xMin)+dx); item.xMax = snap(number(original.xMax)+dx);
      item.yMin = snap(number(original.yMin)+dy); item.yMax = snap(number(original.yMax)+dy);
    } else {
      if (Number.isFinite(Number(original.x))) item.x = snap(number(original.x)+dx);
      if (Number.isFinite(Number(original.y))) item.y = snap(number(original.y)+dy);
    }
  }

  function applyGroupScale(entry, origin, scaleX, scaleY) {
    const item = itemFromSelection(entry.selection);
    const original = entry.original;
    if (!item) return;
    const scalePoint = point => ({ ...point, x:snap(origin.x+(number(point.x)-origin.x)*scaleX), y:snap(origin.y+(number(point.y)-origin.y)*scaleY) });
    if (Array.isArray(entry.originalPoints)) {
      item.points = entry.originalPoints.map(scalePoint);
      if (entry.selection.kind === "linear") scaleLinearWidths(item, original, Math.sqrt(Math.max(.01, Math.abs(scaleX*scaleY))));
    } else if (entry.selection.kind === "terrain") {
      item.x = snap(origin.x+(number(original.x)-origin.x)*scaleX);
      item.y = snap(origin.y+(number(original.y)-origin.y)*scaleY);
      item.width = snap(Math.max(.25, number(original.width)*Math.abs(scaleX)));
      item.height = snap(Math.max(.25, number(original.height)*Math.abs(scaleY)));
    } else if (entry.selection.kind === "zone") {
      const a = scalePoint({ x:original.xMin, y:original.yMin });
      const b = scalePoint({ x:original.xMax, y:original.yMax });
      item.xMin = Math.min(a.x,b.x); item.xMax = Math.max(a.x,b.x);
      item.yMin = Math.min(a.y,b.y); item.yMax = Math.max(a.y,b.y);
    } else if (Number.isFinite(Number(original.x)) && Number.isFinite(Number(original.y))) {
      const point = scalePoint(original);
      item.x = point.x; item.y = point.y;
      if (entry.selection.kind === "objective" && Number.isFinite(Number(original.radius))) item.radius = snap(Math.max(.25, number(original.radius)*Math.sqrt(Math.max(.01, Math.abs(scaleX*scaleY)))));
    }
  }

  function applyGroupRotation(entry, center, degrees) {
    const item = itemFromSelection(entry.selection);
    const original = entry.original;
    if (!item) return;
    if (Array.isArray(entry.originalPoints)) {
      item.points = entry.originalPoints.map(point => {
        const rotated = MULTI.rotatePoint(point, center, degrees);
        return { ...rotated, x:snap(rotated.x), y:snap(rotated.y) };
      });
    } else if (entry.selection.kind === "terrain") {
      const originalCenter = { x:number(original.x)+number(original.width)/2, y:number(original.y)+number(original.height)/2 };
      const nextCenter = MULTI.rotatePoint(originalCenter, center, degrees);
      item.x = snap(nextCenter.x-number(original.width)/2);
      item.y = snap(nextCenter.y-number(original.height)/2);
      item.rotation = Math.round(number(original.rotation)+degrees);
    } else if (entry.selection.kind === "zone") {
      const corners = [
        { x:original.xMin, y:original.yMin }, { x:original.xMax, y:original.yMin },
        { x:original.xMax, y:original.yMax }, { x:original.xMin, y:original.yMax }
      ].map(point => MULTI.rotatePoint(point, center, degrees));
      item.xMin = snap(Math.min(...corners.map(point => point.x))); item.xMax = snap(Math.max(...corners.map(point => point.x)));
      item.yMin = snap(Math.min(...corners.map(point => point.y))); item.yMax = snap(Math.max(...corners.map(point => point.y)));
    } else if (Number.isFinite(Number(original.x)) && Number.isFinite(Number(original.y))) {
      const point = MULTI.rotatePoint(original, center, degrees);
      item.x = snap(point.x); item.y = snap(point.y);
    }
  }

  function transformableEntries() {
    return selectedObjectSelections().map(captureTransformEntry).filter(Boolean);
  }

  function nudgeSelection(dx, dy) {
    if (!state.selection) return;
    if (!state.keyboardTransform) state.keyboardTransform = { before:beforeMutation(), action:"move" };

    const component = pointForSelection();
    if (component && state.selection?.component) {
      component.x = snap(clamp(number(component.x) + dx, 0, table().width));
      component.y = snap(clamp(number(component.y) + dy, 0, table().height));
    } else {
      for (const entry of transformableEntries()) applyGroupTranslation(entry, dx, dy);
    }
    state.status = `Moved selection ${Math.abs(dx || dy).toFixed(2)}″`;
    renderAll();
  }

  function finishKeyboardTransform() {
    const session = state.keyboardTransform;
    if (!session) return;
    state.keyboardTransform = null;
    commit(session.before, "Moved selection");
  }

  function rotateSelection(degrees) {
    const entries = transformableEntries();
    if (!entries.length) return;
    const bounds = MULTI.unionBounds(entries.map(entry => entry.bounds));
    if (!bounds) return;
    const before = beforeMutation();
    const center = { x:bounds.centerX, y:bounds.centerY };
    for (const entry of entries) applyGroupRotation(entry, center, degrees);
    commit(before, `Rotated selection ${degrees > 0 ? "+" : ""}${degrees}°`);
  }

  function beginScaleMode() {
    const entries = transformableEntries();
    if (!entries.length) return;
    const bounds = MULTI.unionBounds(entries.map(entry => entry.bounds));
    if (!bounds) return;
    state.scaleSession = {
      before:beforeMutation(),
      entries,
      bounds,
      factor:1
    };
    state.status = "Scale mode · Arrow Up/Right grows · Down/Left shrinks · Enter confirms · Esc cancels";
    renderAll();
  }

  function adjustScaleMode(delta) {
    const session = state.scaleSession;
    if (!session) return;
    session.factor = clamp(session.factor + delta, .1, 8);
    const origin = { x:session.bounds.centerX, y:session.bounds.centerY };
    for (const entry of session.entries) applyGroupScale(entry, origin, session.factor, session.factor);
    state.status = `Scale mode · ${Math.round(session.factor * 100)}% · Enter confirms · Esc cancels`;
    renderAll();
  }

  function finishScaleMode() {
    const session = state.scaleSession;
    if (!session) return;
    state.scaleSession = null;
    commit(session.before, `Scaled selection to ${Math.round(session.factor * 100)}%`);
  }

  function cancelScaleMode() {
    const session = state.scaleSession;
    if (!session) return;
    state.document = DOCUMENT.create(JSON.parse(session.before));
    state.scaleSession = null;
    state.status = "Scale cancelled";
    renderAll();
  }

  function startDrag(event, action, selection, options = {}) {
    const normalized = SELECTION.normalize(selection);
    const preserveGroup = normalized && !normalized.component && isObjectSelected(normalized) && selectedObjectSelections().length > 1;
    if (normalized && !preserveGroup) setSelection(normalized);
    else if (normalized && preserveGroup) state.selection = SELECTION.objectOnly(normalized);
    const item = itemForSelection();
    if (!item || isItemLocked(item)) return;
    const start = boardPoint(event);
    const point = pointForSelection();
    const originalPoints = Array.isArray(item.points) ? GEOMETRY.clonePoints(item.points) : null;
    const originalBounds = originalPoints ? GEOMETRY.bounds(originalPoints) : null;
    const group = !state.selection?.component && selectedObjectSelections().length > 1
      ? selectedObjectSelections().map(captureTransformEntry).filter(Boolean)
      : [];
    const groupBounds = MULTI.unionBounds(group.map(entry => entry.bounds));
    state.drag = {
      pointerId:event.pointerId,
      action,
      start,
      before:beforeMutation(),
      original:DOCUMENT.clone(item),
      originalPoint:point ? DOCUMENT.clone(point) : null,
      originalPoints,
      originalBounds,
      group,
      groupBounds,
      pendingDetail:options.pendingDetail ?? null,
      moved:false
    };
    if (action === "rotate") {
      if (groupBounds && group.length > 1) {
        state.drag.center = { x:groupBounds.centerX, y:groupBounds.centerY };
      } else if (originalBounds && (state.selection.kind === "linear" || state.selection.kind === "patch")) {
        state.drag.center = { x:originalBounds.centerX, y:originalBounds.centerY };
      } else {
        const rect = objectBoundsFor(state.selection) ?? { x:number(item.x), y:number(item.y), width:number(item.width), height:number(item.height) };
        state.drag.center = { x:rect.x + rect.width / 2, y:rect.y + rect.height / 2 };
      }
      state.drag.startAngle = Math.atan2(start.y - state.drag.center.y, start.x - state.drag.center.x) * 180 / Math.PI;
    }
    refs.viewport.setPointerCapture?.(event.pointerId);
    renderSelectionAndInspector();
    renderObjectList();
  }

  function selectionFromTarget(target) {
    const patchPoint = target.closest?.("[data-editor-kind='patch-point']");
    if (patchPoint) return { kind:"patch", id:patchPoint.dataset.patchId, pointIndex:Number(patchPoint.dataset.pointIndex) };
    const patchSegment = target.closest?.("[data-editor-kind='patch-segment']");
    if (patchSegment) return { kind:"patch", id:patchSegment.dataset.patchId, segmentIndex:Number(patchSegment.dataset.segmentIndex) };
    const patch = target.closest?.("[data-editor-kind='patch']");
    if (patch) return { kind:"patch", id:patch.dataset.patchId };
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

  function canvasCategoryVisible(selection) {
    if (!selection) return false;
    if (selection.kind === "terrain") return state.showObjects;
    if (selection.kind === "patch") return state.showPatches;
    if (selection.kind === "linear") return state.showLinear;
    if (selection.kind === "unit") return state.showUnits;
    if (selection.kind === "objective") return state.showObjectives;
    if (selection.kind === "zone") return state.showZones;
    return true;
  }

  function selectionItem(selection) {
    if (!selection) return null;
    return selection.kind === "zone" ? zoneForSelection(selection) : DOCUMENT.find(state.document, selection);
  }

  function selectionCandidatesAt(event, options = {}) {
    const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [event.target];
    const candidates = [];
    const seen = new Set();
    for (const element of elements) {
      if (!refs.board.contains(element) && element !== refs.board) continue;
      const selection = selectionFromTarget(element);
      if (!selection || !canvasCategoryVisible(selection)) continue;
      const item = selectionItem(selection);
      if (!item || !isItemVisible(item) || isItemLocked(item)) continue;
      const key = selectionKey(selection);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(selection);
    }
    if (state.selection && options.preferSelected !== false) {
      candidates.sort((left, right) => {
        const leftSelected = SELECTION.sameObject(left, state.selection) ? 1 : 0;
        const rightSelected = SELECTION.sameObject(right, state.selection) ? 1 : 0;
        return rightSelected - leftSelected;
      });
    }
    return candidates;
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

  function startMarquee(event) {
    const start = boardPoint(event);
    state.marquee = {
      pointerId:event.pointerId,
      start,
      current:start,
      base:selectedObjectSelections()
    };
    refs.viewport.setPointerCapture?.(event.pointerId);
    renderSelectionBox();
  }

  function finishMarquee() {
    const marquee = state.marquee;
    if (!marquee) return;
    const rect = {
      x:Math.min(marquee.start.x, marquee.current.x),
      y:Math.min(marquee.start.y, marquee.current.y),
      width:Math.abs(marquee.current.x-marquee.start.x),
      height:Math.abs(marquee.current.y-marquee.start.y)
    };
    const candidates = objectGroups().flatMap(group => group.items.map(entry => entry.selection));
    const hits = candidates.filter(selection => {
      const item = itemFromSelection(selection);
      return item && !isItemLocked(item) && isItemVisible(item) && canvasCategoryVisible(selection) && MULTI.intersects(rect, objectBoundsFor(selection));
    });
    state.selectionSet = MULTI.unique([...marquee.base, ...hits]);
    state.selection = state.selectionSet.length ? state.selectionSet[state.selectionSet.length - 1] : null;
    state.marquee = null;
    renderSelectionAndInspector();
    renderObjectList();
  }

  function addDrawingPoint(event) {
    const drawing = state.drawingPath ?? state.drawingPatch;
    if (!drawing) return;
    const point = boardPoint(event);
    const placed = { x:snap(clamp(point.x, 0, table().width)), y:snap(clamp(point.y, 0, table().height)) };
    const previous = drawing.points[drawing.points.length - 1];
    if (previous && Math.hypot(number(previous.x) - placed.x, number(previous.y) - placed.y) < .2) return;
    drawing.points.push(placed);
    state.drawingCursor = placed;
    const noun = state.drawingPatch ? "vertex" : "waypoint";
    state.status = `${drawing.points.length} ${noun}${drawing.points.length === 1 ? "" : "s"} placed · Enter to finish`;
    refs.saveReadout.textContent = state.status;
    refs.finishLinearButton.disabled = (state.drawingPath?.points.length ?? 0) < 2;
    refs.finishPatchButton.disabled = (state.drawingPatch?.points.length ?? 0) < 3;
    renderLinearInteraction();
  }

  function onBoardPointerDown(event) {
    const isMiddle = event.button === 1;
    const isLeft = event.button === 0 || event.button === undefined;
    if (!isMiddle && !isLeft) return;

    if (isMiddle || (isLeft && state.spacePressed)) {
      event.preventDefault();
      startPan(event);
      return;
    }

    if (state.placement && isLeft) {
      if (!refs.board.contains(event.target)) return;
      event.preventDefault();
      placeActiveAsset(boardPoint(event), event.shiftKey);
      return;
    }

    if ((state.drawingPath || state.drawingPatch) && isLeft) {
      if (!refs.board.contains(event.target)) return;
      event.preventDefault();
      addDrawingPoint(event);
      return;
    }

    const action = event.target.dataset?.editorAction;
    if (action && state.selection) {
      event.preventDefault();
      startDrag(event, action, state.selection);
      return;
    }

    const candidates = selectionCandidatesAt(event, { preferSelected:!event.shiftKey });
    const rawSelection = candidates[0] ?? null;

    if (state.targetPickerObjectiveId && rawSelection && ["unit", "terrain"].includes(rawSelection.kind)) {
      event.preventDefault();
      assignObjectiveTarget(rawSelection);
      return;
    }

    if (!rawSelection) {
      event.preventDefault();
      if (event.shiftKey) {
        startMarquee(event);
        return;
      }
      if (state.selection) select(null);
      startPan(event);
      return;
    }

    event.preventDefault();
    if (event.shiftKey) {
      select(SELECTION.objectOnly(rawSelection), { additive:true });
      return;
    }

    if (rawSelection.kind === "linear" || rawSelection.kind === "patch") {
      const objectSelection = { kind:rawSelection.kind, id:rawSelection.id };
      const currentMatches = SELECTION.sameObject(state.selection, objectSelection);
      const pointEditing = TOOLS.isPointEditing(state, objectSelection);

      if (!currentMatches) {
        startDrag(event, "move", objectSelection);
        return;
      }

      if (!pointEditing) {
        TOOLS.beginPointEdit(state, objectSelection);
        setSelection(objectSelection);
        state.status = `Editing ${rawSelection.kind === "linear" ? "path waypoints" : "patch vertices"} · click a point to move it · Esc leaves point edit`;
        renderAll();
        return;
      }

      if (rawSelection.pointIndex !== undefined) {
        startDrag(event, "move", rawSelection);
      } else if (rawSelection.segmentIndex !== undefined) {
        startDrag(event, "move", objectSelection, { pendingDetail:rawSelection });
      } else {
        startDrag(event, "move", objectSelection);
      }
      return;
    }

    startDrag(event, "move", rawSelection);
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
    if (Math.hypot(dx, dy) > .08) drag.moved = true;

    if (drag.group?.length > 1 && drag.groupBounds) {
      if (drag.action === "move") {
        drag.group.forEach(entry => applyGroupTranslation(entry, dx, dy));
      } else if (drag.action === "resize") {
        const targetWidth = Math.max(.5, drag.groupBounds.width + dx);
        const targetHeight = Math.max(.5, drag.groupBounds.height + dy);
        const scaleX = targetWidth / Math.max(.01, drag.groupBounds.width);
        const scaleY = targetHeight / Math.max(.01, drag.groupBounds.height);
        drag.group.forEach(entry => applyGroupScale(entry, { x:drag.groupBounds.x, y:drag.groupBounds.y }, scaleX, scaleY));
      } else if (drag.action === "rotate") {
        const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x) * 180 / Math.PI;
        const delta = angle - drag.startAngle;
        drag.group.forEach(entry => applyGroupRotation(entry, drag.center, delta));
      }
      renderAll();
      return;
    }

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
      } else if (selection.kind === "linear" || selection.kind === "patch") {
        const target = pointForSelection();
        if (target && drag.originalPoint) {
          target.x = snap(clamp(number(drag.originalPoint.x) + dx, 0, width));
          target.y = snap(clamp(number(drag.originalPoint.y) + dy, 0, height));
        } else if (drag.originalPoints) {
          item.points = GEOMETRY.translate(drag.originalPoints, dx, dy).map(source => ({ ...source, x:snap(source.x), y:snap(source.y) }));
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
      } else if (selection.kind === "linear" || selection.kind === "patch") {
        const original = drag.originalBounds;
        if (original) {
          const target = { x:original.x, y:original.y, width:Math.max(.5, original.width + dx), height:Math.max(.5, original.height + dy) };
          item.points = GEOMETRY.scaleToBounds(drag.originalPoints, original, target).map(source => ({ ...source, x:snap(source.x), y:snap(source.y) }));
          if (selection.kind === "linear") {
            const scaleX = target.width / Math.max(.01, original.width);
            const scaleY = target.height / Math.max(.01, original.height);
            scaleLinearWidths(item, drag.original, Math.sqrt(Math.max(.01, scaleX * scaleY)));
          }
        }
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
      const delta = angle - drag.startAngle;
      if (selection.kind === "linear" || selection.kind === "patch") {
        item.points = GEOMETRY.rotate(drag.originalPoints, drag.center, delta).map(source => ({ ...source, x:snap(source.x), y:snap(source.y) }));
      } else {
        item.rotation = Math.round(number(drag.original.rotation) + delta);
      }
    }
    renderAll();
  }

  function onBoardPointerMove(event) {
    const point = boardPoint(event);
    refs.cursorReadout.textContent = `Cursor: ${point.x.toFixed(1)}″, ${point.y.toFixed(1)}″`;
    if (state.placement) {
      state.placement.point = { x:snap(clamp(point.x, 0, table().width)), y:snap(clamp(point.y, 0, table().height)) };
      renderPlacementGhost();
    }
    if (state.drawingPath || state.drawingPatch) {
      state.drawingCursor = { x:snap(clamp(point.x, 0, table().width)), y:snap(clamp(point.y, 0, table().height)) };
      renderLinearInteraction();
    }
    if (state.marquee && state.marquee.pointerId === event.pointerId) {
      event.preventDefault();
      state.marquee.current = { x:clamp(point.x, 0, table().width), y:clamp(point.y, 0, table().height) };
      renderSelectionBox();
      return;
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
    if (state.marquee && state.marquee.pointerId === event.pointerId) {
      refs.viewport.releasePointerCapture?.(event.pointerId);
      finishMarquee();
      return;
    }
    if (state.pan && state.pan.pointerId === event.pointerId) {
      const moved = state.pan.moved;
      state.pan = null;
      refs.viewport.releasePointerCapture?.(event.pointerId);
      if (!moved) select(null);
      return;
    }
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const before = state.drag.before;
    const action = state.drag.action;
    const pendingDetail = state.drag.pendingDetail;
    const moved = state.drag.moved;
    state.drag = null;
    refs.viewport.releasePointerCapture?.(event.pointerId);
    if (pendingDetail && !moved) {
      select(pendingDetail);
      return;
    }
    commit(before, `${action.charAt(0).toUpperCase()}${action.slice(1)} committed`);
  }

  function setByPath(target, path, value) {
    const parts = path.split(".");
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      const nextPart = parts[index + 1];
      cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : /^\d+$/.test(nextPart) ? [] : {};
      cursor = cursor[part];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function parseControlValue(control) {
    if (control.type === "checkbox") return control.checked;
    if (control.type === "number" || control.type === "range") {
      const value = number(control.value);
      const min = control.min === "" ? -Infinity : number(control.min, -Infinity);
      const max = control.max === "" ? Infinity : number(control.max, Infinity);
      return clamp(value, min, max);
    }
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

    if (fieldPath === "@visible") {
      VISIBILITY.setVisible(item, value);
    } else if (fieldPath === "@locked") {
      VISIBILITY.setLocked(item, value);
    } else if (fieldPath.startsWith("@bounds.")) {
      const key = fieldPath.slice(8);
      const original = GEOMETRY.bounds(item.points ?? []);
      let target = { x:original.x, y:original.y, width:original.width, height:original.height };
      target[key] = value;
      if (key === "x" || key === "y") {
        const dx = target.x - original.x;
        const dy = target.y - original.y;
        item.points = GEOMETRY.translate(item.points, dx, dy);
      } else {
        target.width = Math.max(.5, target.width);
        target.height = Math.max(.5, target.height);
        const sourceItem = DOCUMENT.clone(item);
        item.points = GEOMETRY.scaleToBounds(item.points, original, target);
        if (state.selection.kind === "linear") {
          const scaleX = target.width / Math.max(.01, original.width);
          const scaleY = target.height / Math.max(.01, original.height);
          scaleLinearWidths(item, sourceItem, Math.sqrt(Math.max(.01, scaleX * scaleY)));
        }
      }
      normalizePointData(item);
    } else if (state.selection.kind === "objective" && fieldPath === "type") {
      normalizeObjectiveType(item, value);
    } else if (fieldPath.startsWith("@point.")) {
      const point = pointForSelection();
      if (point) setByPath(point, fieldPath.slice(7), value);
    } else {
      setByPath(item, fieldPath, value);
    }

    if (fieldPath === "terrainId") {
      const definition = TERRAIN_TYPES[item.terrainId];
      if (definition?.presentation?.defaultAppearance) item.appearance = definition.presentation.defaultAppearance;
    }
    if (fieldPath === "styleId" && state.selection.kind === "linear") {
      const choices = materialChoicesForLinear(item.styleId);
      if (!choices.some(choice => String(choice.value) === String(item.material))) item.material = defaultLinearMaterial(item.styleId);
      item.width = number(item.width, LINEAR_STYLES[item.styleId]?.width ?? 2);
    }
    if (fieldPath === "styleId" && state.selection.kind === "patch") {
      const style = PATCH_STYLES[item.styleId];
      const choices = materialChoicesForPatch(item.styleId);
      if (!choices.some(choice => String(choice.value) === String(item.material))) item.material = style?.material;
      if (WOODLAND.isWoodland(item.styleId)) SCHEMA.normalizeWoodlandGenerator(item);
      else delete item.generator;
    }
    if (fieldPath === "layerOrder") item.inheritLayer = false;
    if (fieldPath === "id" && state.selection.id === oldId) setSelection({ ...state.selection, id:value });
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
      ? { x:(number(current.x) + number(next.x)) / 2, y:(number(current.y) + number(next.y)) / 2, ...(current.width !== undefined || next.width !== undefined ? { width:(number(current.width, path.width) + number(next.width, path.width)) / 2 } : {}) }
      : { x:number(current.x) + (number(current.x) - number(previous.x) || 4), y:number(current.y) + (number(current.y) - number(previous.y)) };
    path.points.splice(index + 1, 0, point);
    setSelection({ ...state.selection, pointIndex:index + 1 });
    commit(before, "Inserted waypoint");
  }

  function removeWaypoint() {
    const path = itemForSelection();
    const index = state.selection?.pointIndex;
    if (!path || state.selection.kind !== "linear" || index === undefined || path.points.length <= 2) return;
    const before = beforeMutation();
    path.points.splice(index, 1);
    setSelection({ ...state.selection, pointIndex:Math.max(0, Math.min(index, path.points.length - 1)) });
    commit(before, "Removed waypoint");
  }

  function insertPatchPoint(afterIndex) {
    const patch = itemForSelection();
    if (!patch || state.selection?.kind !== "patch" || !Array.isArray(patch.points)) return;
    const index = Number(afterIndex);
    const nextIndex = (index + 1) % patch.points.length;
    const a = patch.points[index];
    const b = patch.points[nextIndex];
    if (!a || !b) return;
    const before = beforeMutation();
    patch.points.splice(index + 1, 0, { x:(number(a.x) + number(b.x)) / 2, y:(number(a.y) + number(b.y)) / 2 });
    setSelection({ kind:"patch", id:patch.id, pointIndex:index + 1 });
    commit(before, "Inserted patch vertex");
  }

  function removePatchPoint() {
    const patch = itemForSelection();
    const index = state.selection?.pointIndex;
    if (!patch || state.selection?.kind !== "patch" || index === undefined || patch.points.length <= 3) return;
    const before = beforeMutation();
    patch.points.splice(index, 1);
    setSelection({ ...state.selection, pointIndex:Math.max(0, Math.min(index, patch.points.length - 1)) });
    commit(before, "Removed patch vertex");
  }

  function branchLinear() {
    const path = itemForSelection();
    const point = pointForSelection();
    if (!path || !point || state.selection?.kind !== "linear") return;
    TOOLS.beginPath(state, {
      styleId:path.styleId,
      material:path.material ?? defaultLinearMaterial(path.styleId),
      width:number(point.width, number(path.width, LINEAR_STYLES[path.styleId]?.width ?? 2)),
      points:[{ x:number(point.x), y:number(point.y) }],
      start:{ cap:"junction" },
      end:{ cap:"taper" },
      before:beforeMutation(),
      branchOf:path.id
    });
    state.drawingCursor = { x:number(point.x), y:number(point.y) };
    setSelection(null);
    state.status = `Branching from ${path.id} · click to place more waypoints`;
    renderAll();
  }

  function clearPointWidth() {
    const point = pointForSelection();
    if (!point || state.selection?.kind !== "linear") return;
    const before = beforeMutation();
    delete point.width;
    commit(before, "Waypoint now inherits path width");
  }

  function changeLayer(command) {
    const item = itemForSelection();
    if (!item || !["terrain", "linear", "patch", "unit"].includes(state.selection?.kind)) return;
    const before = beforeMutation();
    const current = item.inheritLayer === false ? number(item.layerOrder, defaultLayerFor(item)) : defaultLayerFor(item);
    item.inheritLayer = false;
    if (command === "layer-back") item.layerOrder = 0;
    else if (command === "layer-front") item.layerOrder = 6999;
    else if (command === "layer-down") item.layerOrder = Math.max(0, current - 10);
    else item.layerOrder = Math.min(6999, current + 10);
    commit(before, `Layer set to ${item.layerOrder}`);
  }

  function normalizeTransform() {
    const item = itemForSelection();
    if (!item) return;
    const before = beforeMutation();
    if (state.selection.kind === "terrain") {
      const scale = Math.max(.01, number(item.visualScale, 1));
      item.width = number(item.width) * scale;
      item.height = number(item.height) * scale;
      item.visualScale = 1;
    } else if (state.selection.kind === "linear" || state.selection.kind === "patch") normalizePointData(item);
    commit(before, "Transform normalized into scenario data");
  }

  function centerSelection() {
    const item = itemForSelection();
    if (!item) return;
    const before = beforeMutation();
    if (state.selection.kind === "terrain") {
      item.x = table().width / 2 - number(item.width) / 2;
      item.y = table().height / 2 - number(item.height) / 2;
    } else if (state.selection.kind === "linear" || state.selection.kind === "patch") {
      const bounds = GEOMETRY.bounds(item.points ?? []);
      item.points = GEOMETRY.translate(item.points, table().width / 2 - bounds.centerX, table().height / 2 - bounds.centerY);
      normalizePointData(item);
    }
    commit(before, "Selection centered on table");
  }

  function deleteWholeSelection() {
    if (!state.selection || state.selection.kind === "zone") return;
    const whole = { kind:state.selection.kind, id:state.selection.id, faction:state.selection.faction };
    const before = beforeMutation();
    if (!DOCUMENT.remove(state.document, whole)) return;
    setSelection(null);
    commit(before, `Deleted ${whole.id}`);
  }

  function duplicateWholeSelection() {
    if (!state.selection) return;
    const whole = { kind:state.selection.kind, id:state.selection.id, faction:state.selection.faction };
    const before = beforeMutation();
    const copy = DOCUMENT.duplicate(state.document, whole);
    if (!copy) return;
    setSelection({ ...whole, id:copy.id });
    commit(before, `Duplicated ${copy.id}`);
  }

  function defaultTerrainSize(definition) {
    if (definition.family === "building") return { width:10, height:7 };
    if (definition.renderer === "woods" || definition.renderer === "orchard") return { width:12, height:9 };
    if (definition.renderer === "field") return { width:12, height:8 };
    if (definition.family === "scatter") return { width:3.5, height:3.5 };
    if (definition.family === "defensive") return { width:7, height:3.5 };
    return { width:9, height:2.5 };
  }

  function createTerrainAt(terrainId, point, placement = {}) {
    const definition = TERRAIN_TYPES[terrainId];
    if (!definition) return null;
    const scale = Math.max(.1, number(placement.scale, 1));
    const baseSize = defaultTerrainSize(definition);
    const size = { width:baseSize.width * scale, height:baseSize.height * scale };
    const item = {
      id:DOCUMENT.nextId(state.document, terrainId),
      terrainId,
      x:snap(clamp(number(point.x) - size.width / 2, -size.width * .75, table().width - size.width * .25)),
      y:snap(clamp(number(point.y) - size.height / 2, -size.height * .75, table().height - size.height * .25)),
      width:size.width,
      height:size.height,
      rotation:number(placement.rotation, 0),
      visible:true,
      locked:false,
      inheritLayer:true
    };
    if (definition.presentation?.defaultAppearance) item.appearance = definition.presentation.defaultAppearance;
    state.document.terrain.push(item);
    return { item, selection:{ kind:"terrain", id:item.id }, label:definition.label };
  }

  function addTerrain(terrainId) {
    const before = beforeMutation();
    const created = createTerrainAt(terrainId, { x:table().width / 2, y:table().height / 2 });
    if (!created) return;
    setSelection(created.selection);
    commit(before, `Added ${created.label}`);
  }

  function addLinear(styleId) {
    if (state.drawingPath || state.drawingPatch) return;
    const style = LINEAR_STYLES[styleId];
    if (!style) return;
    setSelection(null);
    TOOLS.beginPath(state, {
      styleId,
      material:defaultLinearMaterial(styleId),
      width:style.width,
      points:[],
      start:{ cap:"taper" },
      end:{ cap:"taper" },
      before:beforeMutation()
    });
    state.status = `Drawing ${style.label} · click to place waypoints`;
    renderAll();
  }

  function finishLinearDraw() {
    const drawing = state.drawingPath;
    if (!drawing || drawing.points.length < 2) return;
    const style = LINEAR_STYLES[drawing.styleId];
    const item = {
      id:DOCUMENT.nextId(state.document, drawing.branchOf ? `${drawing.branchOf}-branch` : drawing.styleId),
      styleId:drawing.styleId,
      material:drawing.material ?? defaultLinearMaterial(drawing.styleId),
      width:drawing.width,
      points:drawing.points.map(point => ({ ...point, x:point.x, y:point.y })),
      start:{ ...(drawing.start ?? { cap:"taper" }) },
      end:{ ...(drawing.end ?? { cap:"taper" }) },
      visible:true,
      locked:false,
      inheritLayer:true
    };
    if (drawing.branchOf) item.branchOf = drawing.branchOf;
    state.document.linearTerrain.push(item);
    setSelection({ kind:"linear", id:item.id });
    TOOLS.cancelDrawing(state);
    commit(drawing.before, `Drew ${style?.label || drawing.styleId}`);
  }

  function cancelLinearDraw() {
    if (!state.drawingPath) return;
    TOOLS.cancelDrawing(state);
    state.status = "Path drawing cancelled";
    renderAll();
  }

  function addPatch(styleId) {
    if (state.drawingPath || state.drawingPatch) return;
    const style = PATCH_STYLES[styleId];
    if (!style) return;
    setSelection(null);
    TOOLS.beginPatch(state, { styleId, material:style.material, points:[], before:beforeMutation() });
    state.status = `Drawing ${style.label} · click around its boundary`;
    renderAll();
  }

  function finishPatchDraw() {
    const drawing = state.drawingPatch;
    if (!drawing || drawing.points.length < 3) return;
    const style = PATCH_STYLES[drawing.styleId];
    const item = {
      id:DOCUMENT.nextId(state.document, `${drawing.styleId}-patch`),
      styleId:drawing.styleId,
      material:drawing.material ?? style?.material,
      points:drawing.points.map(point => ({ x:point.x, y:point.y })),
      inheritLayer:true,
      visible:true,
      locked:false
    };
    if (WOODLAND.isWoodland(item.styleId)) SCHEMA.normalizeWoodlandGenerator(item);
    state.document.terrainPatches.push(item);
    setSelection({ kind:"patch", id:item.id });
    TOOLS.cancelDrawing(state);
    commit(drawing.before, `Drew ${style?.label || drawing.styleId}`);
  }

  function cancelPatchDraw() {
    if (!state.drawingPatch) return;
    TOOLS.cancelDrawing(state);
    state.status = "Patch drawing cancelled";
    renderAll();
  }

  function insertSegmentWaypoint() {
    const selection = state.selection;
    if (selection?.kind !== "linear" || selection.segmentIndex === undefined) return;
    const before = beforeMutation();
    const inserted = DOCUMENT.insertLinearWaypoint(state.document, selection.id, selection.segmentIndex);
    if (!inserted) return;
    setSelection({ kind:"linear", id:selection.id, pointIndex:selection.segmentIndex + 1 });
    commit(before, "Added waypoint to section");
  }

  function deleteSegment() {
    const selection = state.selection;
    if (selection?.kind !== "linear" || selection.segmentIndex === undefined) return;
    const before = beforeMutation();
    const result = DOCUMENT.deleteLinearSegment(state.document, selection.id, selection.segmentIndex);
    if (!result) return;
    setSelection(result.selection);
    commit(before, result.split ? "Deleted section and split path" : result.deleted ? "Deleted path section" : "Deleted path section");
  }

  function createUnitAt(unitType, faction, point) {
    const definition = UNIT_TYPES[unitType];
    if (!definition) return null;
    const item = {
      id:DOCUMENT.nextId(state.document, `${faction}-${unitType}`),
      name:definition.name,
      unitType,
      quality:definition.quality || "regular",
      x:snap(clamp(number(point.x), 0, table().width)),
      y:snap(clamp(number(point.y), 0, table().height)),
      visible:true,
      locked:false,
      inheritLayer:true
    };
    state.document.forces[faction].push(item);
    return { item, selection:{ kind:"unit", id:item.id, faction }, label:definition.name };
  }

  function addUnit(unitType, faction = refs.unitFactionSelect.value) {
    const before = beforeMutation();
    const zone = state.document.deployment?.zones?.[faction];
    const point = zone
      ? { x:(number(zone.xMin) + number(zone.xMax)) / 2, y:(number(zone.yMin) + number(zone.yMax)) / 2 }
      : { x:table().width / 2, y:table().height / 2 };
    const created = createUnitAt(unitType, faction, point);
    if (!created) return;
    setSelection(created.selection);
    commit(before, `Added ${created.label}`);
  }

  function objectiveForType(type, point = null) {
    const x = snap(clamp(number(point?.x, table().width / 2), 0, table().width));
    const y = snap(clamp(number(point?.y, table().height / 2), 0, table().height));
    const item = { id:DOCUMENT.nextId(state.document, type === "control_zone" ? "objective" : type), type, label:"New Objective", x, y, radius:3 };
    if (type === "control_group") {
      item.label = "Objective Group";
      item.points = [
        { id:`${item.id}-a`, label:"Point A", x:snap(x - 5), y, radius:3 },
        { id:`${item.id}-b`, label:"Point B", x, y, radius:3 },
        { id:`${item.id}-c`, label:"Point C", x:snap(x + 5), y, radius:3 }
      ];
      item.roundScoring = [{ faction:"blue", rule:"per_controlled", points:1, maxPoints:0, startRound:1 }];
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
      item.faction = "blue";
      item.points = 3;
    } else if (type === "protect_target") {
      item.label = "Protect Target";
      item.targetId = "";
      item.faction = "blue";
      item.points = 3;
    } else if (type === "hold") {
      item.label = "Hold Until Round";
      item.faction = "blue";
      item.checkpointRound = state.document.rounds;
      item.points = 3;
    } else if (type === "casualty") {
      item.label = "Enemy Losses";
      item.pointsPerUnit = 1;
    } else if (type === "custom") {
      item.label = "Custom Objective";
    }
    return item;
  }

  function createObjectiveAt(type, point) {
    const item = objectiveForType(type, point);
    state.document.objectives.push(item);
    return { item, selection:{ kind:"objective", id:item.id }, label:item.label };
  }

  function addObjective(type = "control_zone") {
    const before = beforeMutation();
    const created = createObjectiveAt(type, { x:table().width / 2, y:table().height / 2 });
    setSelection(created.selection);
    commit(before, `Added ${created.label}`);
  }

  function placementAsset() {
    const key = state.placement?.assetKey;
    return key ? libraryAssets().find(entry => entry.key === key) ?? null : null;
  }

  function placeActiveAsset(point, keepStamp = false) {
    const placement = state.placement;
    const asset = placementAsset();
    if (!placement || !asset) return;
    const before = beforeMutation();
    let created = null;
    if (asset.kind === "terrain") created = createTerrainAt(asset.id, point, placement);
    else if (asset.kind === "unit") created = createUnitAt(asset.id, placement.faction ?? refs.unitFactionSelect.value, point);
    else if (asset.kind === "objective") created = createObjectiveAt(asset.id, point);
    if (!created) return;

    setSelection(created.selection);
    if (!keepStamp) TOOLS.cancelPlacement(state);
    else state.placement.point = { x:number(point.x), y:number(point.y) };
    commit(before, keepStamp
      ? `Stamped ${created.label} · click again · release Shift on the last placement`
      : `Placed ${created.label}`);
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
    setSelection({ ...state.selection, pointIndex:item.points.length - 1 });
    commit(before, "Added control point");
  }

  function removeLastObjectivePoint() {
    const item = itemForSelection();
    if (!item || item.type !== "control_group" || (item.points?.length ?? 0) <= 1) return;
    const before = beforeMutation();
    item.points.pop();
    if (state.selection.pointIndex !== undefined) setSelection({ ...state.selection, pointIndex:Math.min(state.selection.pointIndex, item.points.length - 1) });
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
      setSelection(SELECTION.objectOnly(state.selection));
    }
    if (type === "exit_unit") {
      item.edge = item.edge || "blue";
      item.faction = item.faction || "red";
      item.depth = number(item.depth, 3);
      item.pointsPerUnit = number(item.pointsPerUnit, 2);
    }
  }

  function copySelection() {
    const selections = selectedObjectSelections();
    if (!selections.length) return;
    const payload = DOCUMENT.copySelections(state.document, selections);
    if (!payload.items.length) return;
    state.clipboard = payload;
    persistence.saveClipboard(payload);
    state.status = `Copied ${payload.items.length} object${payload.items.length === 1 ? "" : "s"}`;
    renderSelectionAndInspector();
    refs.saveReadout.textContent = state.status;
  }

  function pasteSelection() {
    if (!state.clipboard?.items?.length) return;
    const before = beforeMutation();
    const pasted = DOCUMENT.pasteSelections(state.document, state.clipboard, { x:1.5, y:1.5 });
    if (!pasted.length) return;
    state.selectionSet = MULTI.unique(pasted);
    state.selection = state.selectionSet[state.selectionSet.length - 1] ?? null;
    commit(before, `Pasted ${pasted.length} object${pasted.length === 1 ? "" : "s"}`);
  }

  function duplicateSelection() {
    const selections = selectedObjectSelections();
    if (!selections.length || (selections.length === 1 && (state.selection.kind === "zone" || state.selection.pointIndex !== undefined || state.selection.segmentIndex !== undefined))) return;
    const before = beforeMutation();
    const payload = DOCUMENT.copySelections(state.document, selections);
    const copies = DOCUMENT.pasteSelections(state.document, payload, { x:1, y:1 });
    if (!copies.length) return;
    state.selectionSet = MULTI.unique(copies);
    state.selection = state.selectionSet[state.selectionSet.length - 1] ?? null;
    commit(before, `Duplicated ${copies.length} object${copies.length === 1 ? "" : "s"}`);
  }

  function deleteSelection() {
    const selections = selectedObjectSelections();
    if (!selections.length) return;
    if (selections.length === 1) {
      if (state.selection.kind === "zone") return;
      if (state.selection.kind === "linear" && state.selection.pointIndex !== undefined) { removeWaypoint(); return; }
      if (state.selection.kind === "linear" && state.selection.segmentIndex !== undefined) { deleteSegment(); return; }
      if (state.selection.kind === "patch" && state.selection.pointIndex !== undefined) { removePatchPoint(); return; }
      if (state.selection.kind === "patch" && state.selection.segmentIndex !== undefined) { insertPatchPoint(state.selection.segmentIndex); return; }
    }
    const deletable = selections.filter(selection => selection.kind !== "zone");
    if (!deletable.length) return;
    const before = beforeMutation();
    let deleted = 0;
    for (const selection of deletable) if (DOCUMENT.remove(state.document, selection)) deleted += 1;
    if (!deleted) return;
    setSelection(null);
    commit(before, `Deleted ${deleted} object${deleted === 1 ? "" : "s"}`);
  }

  function itemFromSelection(selection) {
    return selection?.kind === "zone" ? zoneForSelection(selection) : DOCUMENT.find(state.document, selection);
  }

  function toggleObjectVisibility(selection) {
    if (!selection) return;
    const item = itemFromSelection(selection);
    if (!item) return;
    const before = beforeMutation();
    const nextVisible = !isItemVisible(item);
    VISIBILITY.setVisible(item, nextVisible);
    setSelection(selection);
    commit(before, `${nextVisible ? "Showed" : "Hid"} ${selection.id || selection.zoneId || "object"}`);
  }

  function toggleObjectLock(selection) {
    if (!selection) return;
    const item = itemFromSelection(selection);
    if (!item) return;
    const before = beforeMutation();
    const nextLocked = !isItemLocked(item);
    VISIBILITY.setLocked(item, nextLocked);
    setSelection(selection);
    commit(before, `${nextLocked ? "Locked" : "Unlocked"} ${selection.id || selection.zoneId || "object"}`);
  }

  function mutateGroup(groupId, mode) {
    const group = objectGroups().find(entry => entry.id === groupId);
    if (!group?.items.length) return;
    const before = beforeMutation();
    if (mode === "visibility") {
      const nextVisible = !group.items.every(entry => isItemVisible(entry.item));
      group.items.forEach(entry => VISIBILITY.setVisible(entry.item, nextVisible));
      commit(before, `${nextVisible ? "Showed" : "Hid"} ${group.title}`);
    } else {
      const nextLocked = !group.items.every(entry => isItemLocked(entry.item));
      group.items.forEach(entry => VISIBILITY.setLocked(entry.item, nextLocked));
      commit(before, `${nextLocked ? "Locked" : "Unlocked"} ${group.title}`);
    }
  }

  function mutateSelected(mode) {
    const selections = selectedObjectSelections();
    if (!selections.length) return;
    const before = beforeMutation();
    const makeVisible = mode === "show-selected";
    const makeLocked = mode === "lock-selected";
    for (const selection of selections) {
      const item = itemFromSelection(selection);
      if (!item) continue;
      if (mode === "show-selected" || mode === "hide-selected") VISIBILITY.setVisible(item, makeVisible);
      else VISIBILITY.setLocked(item, makeLocked);
    }
    commit(before, mode.replace("-selected", " selected objects"));
  }

  function rerollGenerator() {
    const item = itemForSelection();
    if (state.selection?.kind !== "patch" || !item || !WOODLAND.isWoodland(item.styleId)) return;
    const before = beforeMutation();
    item.generator = item.generator ?? {};
    item.generator.seed = (Math.trunc(number(item.generator.seed, 0)) + 1 + Math.floor(Math.random() * 9999)) % 2147483647;
    commit(before, `Rerolled ${item.id} tree layout`);
  }

  function assignObjectiveTarget(selection) {
    const objective = state.document.objectives.find(item => String(item.id) === String(state.targetPickerObjectiveId));
    if (!objective) { state.targetPickerObjectiveId = null; return; }
    const before = beforeMutation();
    objective.targetId = selection.id;
    objective.targetKind = selection.kind;
    state.targetPickerObjectiveId = null;
    setSelection({ kind:"objective", id:objective.id });
    commit(before, `Assigned ${selection.id} to ${objective.label}`);
  }

  function chooseObjectiveTarget() {
    const objective = itemForSelection();
    if (state.selection?.kind !== "objective" || !objective || !["destroy_target", "protect_target"].includes(objective.type)) return;
    state.targetPickerObjectiveId = objective.id;
    state.status = "Choose a unit or discrete terrain object on the table or in the object list.";
    renderAll();
  }

  function clearObjectiveTarget() {
    const objective = itemForSelection();
    if (state.selection?.kind !== "objective" || !objective) return;
    const before = beforeMutation();
    objective.targetId = "";
    delete objective.targetKind;
    state.targetPickerObjectiveId = null;
    commit(before, `Cleared target for ${objective.label}`);
  }

  function updateScenarioType(type) {
    const before = beforeMutation();
    state.document.structure = state.document.structure ?? {};
    state.document.structure.templateId = type;
    state.document.victory = state.document.victory ?? { policy:"points", tiebreaker:"survivingUnits" };
    if (type === "elimination") state.document.victory.elimination = true;
    commit(before, `Scenario template set to ${type}`);
  }

  function updateVictoryField(field, value) {
    const before = beforeMutation();
    state.document.victory = state.document.victory ?? { policy:"points", tiebreaker:"survivingUnits", elimination:false };
    if (field === "blueThreshold" || field === "redThreshold") {
      state.document.victory.thresholds = state.document.victory.thresholds ?? {};
      state.document.victory.thresholds[field === "blueThreshold" ? "blue" : "red"] = Math.max(1, Number(value) || 1);
    } else state.document.victory[field] = value;
    commit(before, `Victory ${field} updated`);
  }

  function editorBoardPixels() {
    return TABLE_VIEWPORT.boardPixels(table(), EDITOR_PIXELS_PER_INCH);
  }

  function editorFitZoom() {
    const board = editorBoardPixels();
    return TABLE_VIEWPORT.fitZoom({
      viewportWidth:Math.max(1, refs.viewport.clientWidth),
      viewportHeight:Math.max(1, refs.viewport.clientHeight),
      boardWidth:board.width,
      boardHeight:board.height,
      margin:28,
      min:.1,
      max:4.5
    });
  }

  function setZoom(value, clientX = null, clientY = null) {
    const previousZoom = state.zoom;
    const fit = editorFitZoom();
    const nextZoom = clamp(value, Math.max(.1, fit * .35), Math.min(5, fit * 8));
    if (Math.abs(nextZoom - previousZoom) < .001) return;

    if (!state.viewportGeometry) setupBoardGeometry();
    const previousGeometry = state.viewportGeometry;
    const viewportRect = refs.viewport.getBoundingClientRect();
    const viewportWidth = Math.max(1, refs.viewport.clientWidth);
    const viewportHeight = Math.max(1, refs.viewport.clientHeight);
    const anchorX = clientX == null ? viewportWidth / 2 : clientX - viewportRect.left;
    const anchorY = clientY == null ? viewportHeight / 2 : clientY - viewportRect.top;
    const previousScrollLeft = refs.viewport.scrollLeft;
    const previousScrollTop = refs.viewport.scrollTop;

    state.zoom = nextZoom;
    setupBoardGeometry();
    const target = TABLE_VIEWPORT.anchoredScroll({
      previous:previousGeometry,
      next:state.viewportGeometry,
      scrollLeft:previousScrollLeft,
      scrollTop:previousScrollTop,
      anchorX,
      anchorY,
      viewportWidth,
      viewportHeight
    });
    refs.viewport.scrollLeft = target.left;
    refs.viewport.scrollTop = target.top;
  }

  function onViewportWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * .0015);
    setZoom(state.zoom * factor, event.clientX, event.clientY);
  }

  function centerEditorBoard() {
    const geometry = state.viewportGeometry;
    if (!geometry) return;
    const centered = TABLE_VIEWPORT.boardCenteredScroll({
      contentWidth:geometry.surfaceWidth,
      contentHeight:geometry.surfaceHeight,
      boardLeft:geometry.boardLeft,
      boardTop:geometry.boardTop,
      visualWidth:geometry.visualWidth,
      visualHeight:geometry.visualHeight,
      viewportWidth:Math.max(1, refs.viewport.clientWidth),
      viewportHeight:Math.max(1, refs.viewport.clientHeight)
    });
    refs.viewport.scrollLeft = centered.left;
    refs.viewport.scrollTop = centered.top;
  }

  function boardIntersectsViewport() {
    const geometry = state.viewportGeometry;
    if (!geometry) return false;
    const left = refs.viewport.scrollLeft;
    const top = refs.viewport.scrollTop;
    const right = left + Math.max(1, refs.viewport.clientWidth);
    const bottom = top + Math.max(1, refs.viewport.clientHeight);
    return geometry.boardLeft + geometry.visualWidth > left + 8
      && geometry.boardLeft < right - 8
      && geometry.boardTop + geometry.visualHeight > top + 8
      && geometry.boardTop < bottom - 8;
  }

  function ensureBoardInView() {
    if (boardIntersectsViewport()) return;
    centerEditorBoard();
  }

  function fitTable() {
    state.zoom = editorFitZoom();
    setupBoardGeometry();
    centerEditorBoard();
    requestAnimationFrame(centerEditorBoard);
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
    if (type === "breakthrough") return { id:"exit-edge", type:"exit_unit", label:"Breakthrough Edge", edge:"blue", faction:"red", depth:3, pointsPerUnit:2, containmentPointsPerUnit:1, x:0, y, radius:1 };
    if (type === "control") return { id:"center-objective", type:"control_zone", label:"Central Objective", x, y, radius:3, roundPoints:1, finalPoints:0 };
    if (type === "delay") return { id:"hold-line", type:"hold", label:"Hold the Line", x, y, radius:4, faction:"blue", checkpointRound:scenario.rounds, points:4 };
    if (type === "raid") return { id:"raid-target", type:"destroy_target", label:"Destroy Target", x, y, radius:2, faction:"red", targetId:"", points:4 };
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
      scenario.structure = { ...(scenario.structure ?? {}), templateId:type };
      scenario.description = `${scenario.description || ""} Duplicated in Terrain Editor S1.0.`.trim();
    } else {
      scenario = DOCUMENT.createBlankScenario({ id, title, width, height, rounds, type, startingFaction:refs.newScenarioStartingFaction.value });
      const objective = defaultObjectiveForScenario(type, scenario);
      if (objective) scenario.objectives.push(objective);
    }
    persistence.persistScenario(scenario);
    refreshScenarioSelect(id);
    refs.newScenarioDialog.close();
    loadScenario(id);
  }

  function openRenameScenarioDialog() {
    if (isBuiltInScenario()) return;
    refs.renameScenarioTitle.value = state.document.title || state.document.id;
    refs.renameScenarioIdReadout.value = state.document.id;
    refs.renameScenarioDialog.showModal();
    refs.renameScenarioTitle.focus();
    refs.renameScenarioTitle.select();
  }

  function renameCustomScenario(event) {
    event.preventDefault();
    if (isBuiltInScenario()) return;
    const title = refs.renameScenarioTitle.value.trim();
    if (!title) return;
    state.document.title = title;
    if (state.sourceDocument) state.sourceDocument.title = title;
    persistence.persistScenario(state.document);
    refreshScenarioSelect(state.sourceScenarioId);
    refs.renameScenarioDialog.close();
    state.status = `Renamed scenario to ${title}`;
    renderAll();
  }

  function deleteCustomScenario() {
    const id = state.sourceScenarioId;
    if (isBuiltInScenario(id)) return;
    const title = state.document.title || id;
    if (!window.confirm(`Delete custom scenario “${title}”? This removes its locally saved editor copy.`)) return;
    persistence.deleteScenario(id);
    const fallback = scenarioSources.has("mokra") ? "mokra" : scenarioSources.keys().next().value;
    persistence.rememberScenario(fallback || "");
    refreshScenarioSelect(fallback);
    if (fallback) loadScenario(fallback);
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
    setSelection(null);
    commit(before, `Imported ${file.name}`);
  }

  function launchPlaytest() {
    const scenario = DOCUMENT.playtestScenario(state.document);
    if (!persistence.savePlaytest(scenario)) {
      state.status = "Playtest could not be saved in this browser";
      refs.saveReadout.textContent = state.status;
      return;
    }
    state.status = "Playtest scenario saved";
    refs.saveReadout.textContent = state.status;
    window.open("index.html?editorPlaytest=1", "_blank", "noopener");
  }

  function bindEvents() {
    refs.scenarioSelect.addEventListener("change", () => loadScenario(refs.scenarioSelect.value));
    refs.scenarioTypeSelect.addEventListener("change", () => updateScenarioType(refs.scenarioTypeSelect.value));
    refs.victoryPolicySelect.addEventListener("change", () => updateVictoryField("policy", refs.victoryPolicySelect.value));
    refs.victoryTiebreakerSelect.addEventListener("change", () => updateVictoryField("tiebreaker", refs.victoryTiebreakerSelect.value));
    refs.victoryBlueThreshold.addEventListener("change", () => updateVictoryField("blueThreshold", refs.victoryBlueThreshold.value));
    refs.victoryRedThreshold.addEventListener("change", () => updateVictoryField("redThreshold", refs.victoryRedThreshold.value));
    refs.eliminationVictoryToggle.addEventListener("change", () => updateVictoryField("elimination", refs.eliminationVictoryToggle.checked));
    refs.newScenarioButton.addEventListener("click", openNewScenarioDialog);
    refs.renameScenarioButton.addEventListener("click", openRenameScenarioDialog);
    refs.deleteScenarioButton.addEventListener("click", deleteCustomScenario);
    refs.newScenarioForm.addEventListener("submit", createScenarioFromDialog);
    refs.renameScenarioForm.addEventListener("submit", renameCustomScenario);
    refs.newScenarioDialog.addEventListener("click", event => {
      if (event.target === refs.newScenarioDialog || event.target.closest("[data-dialog-close]")) refs.newScenarioDialog.close();
    });
    refs.renameScenarioDialog.addEventListener("click", event => {
      if (event.target === refs.renameScenarioDialog || event.target.closest("[data-dialog-close]")) refs.renameScenarioDialog.close();
    });
    refs.newScenarioTitle.addEventListener("input", () => {
      if (!refs.newScenarioId.dataset.edited) refs.newScenarioId.value = slugify(refs.newScenarioTitle.value);
    });
    refs.newScenarioId.addEventListener("input", () => { refs.newScenarioId.dataset.edited = "true"; });
    refs.finishLinearButton.addEventListener("click", finishLinearDraw);
    refs.cancelLinearButton.addEventListener("click", cancelLinearDraw);
    refs.finishPatchButton.addEventListener("click", finishPatchDraw);
    refs.cancelPatchButton.addEventListener("click", cancelPatchDraw);
    refs.resetScenarioButton.addEventListener("click", resetScenario);
    refs.fitButton.addEventListener("click", fitTable);
    refs.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - .1));
    refs.zoomInButton.addEventListener("click", () => setZoom(state.zoom + .1));
    refs.viewport.addEventListener("wheel", onViewportWheel, { passive:false });
    refs.showGridToggle.addEventListener("change", () => { state.showGrid = refs.showGridToggle.checked; renderAll(); });
    refs.showPatchesToggle.addEventListener("change", () => { state.showPatches = refs.showPatchesToggle.checked; renderAll(); });
    refs.showObjectsToggle.addEventListener("change", () => { state.showObjects = refs.showObjectsToggle.checked; renderAll(); });
    refs.showLinearToggle.addEventListener("change", () => { state.showLinear = refs.showLinearToggle.checked; renderAll(); });
    refs.showUnitsToggle.addEventListener("change", () => { state.showUnits = refs.showUnitsToggle.checked; renderAll(); });
    refs.showUnitLabelsToggle.addEventListener("change", () => { state.showUnitLabels = refs.showUnitLabelsToggle.checked; renderAll(); });
    refs.showObjectivesToggle.addEventListener("change", () => { state.showObjectives = refs.showObjectivesToggle.checked; renderAll(); });
    refs.showFootprintsToggle.addEventListener("change", () => { state.showFootprints = refs.showFootprintsToggle.checked; renderAll(); });
    refs.showZonesToggle.addEventListener("change", () => { state.showZones = refs.showZonesToggle.checked; renderAll(); });
    refs.snapToggle.addEventListener("change", () => { state.snap = refs.snapToggle.checked; });
    refs.assetFilterInput.addEventListener("input", () => {
      state.assetFilter = refs.assetFilterInput.value;
      renderAssetLibrary();
    });
    for (const button of refs.assetCategoryButtons) {
      button.addEventListener("click", () => setAssetCategory(button.dataset.assetCategory));
    }
    refs.assetLibrary.addEventListener("click", event => {
      const card = event.target.closest("[data-library-asset]");
      if (card) activateLibraryAsset(card.dataset.libraryAsset);
    });
    refs.unitFactionSelect.addEventListener("change", renderAssetLibrary);
    refs.openObjectiveLibraryButton.addEventListener("click", () => {
      shell.setWorkspace("build");
      state.assetFilter = "";
      refs.assetFilterInput.value = "";
      setAssetCategory("scenario");
    });
    refs.validationStatusButton.addEventListener("click", shell.showValidation);
    refs.objectFilterInput.addEventListener("input", () => { state.objectFilter = refs.objectFilterInput.value; renderObjectList(); });
    refs.objectList.addEventListener("click", event => {
      const layerButton = event.target.closest("[data-layer-selection]");
      if (layerButton) {
        event.preventDefault();
        event.stopPropagation();
        nudgeHierarchyLayer(JSON.parse(layerButton.dataset.layerSelection), layerButton.dataset.layerDirection);
        return;
      }
      const groupToggle = event.target.closest("[data-group-toggle]");
      if (groupToggle) {
        const id = groupToggle.dataset.groupToggle;
        state.collapsedGroups[id] = !state.collapsedGroups[id];
        renderObjectList();
        return;
      }
      const groupVisibility = event.target.closest("[data-group-visibility]");
      if (groupVisibility) { mutateGroup(groupVisibility.dataset.groupVisibility, "visibility"); return; }
      const groupLock = event.target.closest("[data-group-lock]");
      if (groupLock) { mutateGroup(groupLock.dataset.groupLock, "lock"); return; }
      const lockButton = event.target.closest("[data-lock-selection]");
      if (lockButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleObjectLock(JSON.parse(lockButton.dataset.lockSelection));
        return;
      }
      const visibilityButton = event.target.closest("[data-visibility-selection]");
      if (visibilityButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleObjectVisibility(JSON.parse(visibilityButton.dataset.visibilitySelection));
        return;
      }
      const button = event.target.closest("[data-selection]");
      if (button) {
        const selection = JSON.parse(button.dataset.selection);
        if (state.targetPickerObjectiveId && ["unit", "terrain"].includes(selection.kind)) assignObjectiveTarget(selection);
        else select(selection, { additive:event.shiftKey });
      }
    });
    refs.objectList.addEventListener("dragstart", event => {
      const row = event.target.closest("[data-row-selection]");
      if (!row?.draggable) return;
      hierarchyDragSelection = JSON.parse(row.dataset.rowSelection);
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.rowSelection);
    });
    refs.objectList.addEventListener("dragover", event => {
      const row = event.target.closest("[data-row-selection]");
      if (!row || !hierarchyDragSelection) return;
      const targetSelection = JSON.parse(row.dataset.rowSelection);
      if (!supportsLayering(targetSelection)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      for (const candidate of refs.objectList.querySelectorAll(".is-drop-target")) candidate.classList.remove("is-drop-target");
      row.classList.add("is-drop-target");
    });
    refs.objectList.addEventListener("drop", event => {
      const row = event.target.closest("[data-row-selection]");
      if (!row || !hierarchyDragSelection) return;
      event.preventDefault();
      const targetSelection = JSON.parse(row.dataset.rowSelection);
      const bounds = row.getBoundingClientRect();
      reorderHierarchyLayer(hierarchyDragSelection, targetSelection, event.clientY < bounds.top + bounds.height / 2);
      hierarchyDragSelection = null;
    });
    refs.objectList.addEventListener("dragend", () => {
      hierarchyDragSelection = null;
      for (const row of refs.objectList.querySelectorAll(".is-dragging, .is-drop-target")) row.classList.remove("is-dragging", "is-drop-target");
    });
    refs.validationList.addEventListener("click", event => {
      const button = event.target.closest("[data-selection]");
      if (button) select(JSON.parse(button.dataset.selection));
    });
    refs.viewport.addEventListener("pointerdown", onBoardPointerDown);
    refs.viewport.addEventListener("pointermove", onBoardPointerMove);
    refs.viewport.addEventListener("pointerup", onBoardPointerUp);
    refs.viewport.addEventListener("pointercancel", onBoardPointerUp);
    refs.inspectorForm.addEventListener("input", event => {
      const range = event.target.closest("input[type='range'][data-field]");
      if (range) {
        const exact = range.closest(".editor-range-controls")?.querySelector("[data-range-number]");
        if (exact) exact.value = range.value;
        return;
      }
      const exact = event.target.closest("input[data-range-number][data-field]");
      if (exact) {
        const slider = exact.closest(".editor-range-controls")?.querySelector("input[type='range']");
        if (slider && exact.value !== "") slider.value = exact.value;
      }
    });
    refs.inspectorForm.addEventListener("change", onInspectorChange);
    refs.inspectorForm.addEventListener("click", event => {
      const command = event.target.closest("[data-editor-command]")?.dataset.editorCommand;
      if (command === "insert-waypoint") insertWaypoint();
      if (command === "remove-waypoint") removeWaypoint();
      if (command === "insert-segment-waypoint") insertSegmentWaypoint();
      if (command === "delete-segment") deleteSegment();
      if (command === "branch-linear") branchLinear();
      if (command === "clear-point-width") clearPointWidth();
      if (command === "insert-patch-point") insertPatchPoint(state.selection?.pointIndex);
      if (command === "insert-patch-segment-point") insertPatchPoint(state.selection?.segmentIndex);
      if (command === "remove-patch-point") removePatchPoint();
      if (["layer-back", "layer-down", "layer-up", "layer-front"].includes(command)) changeLayer(command);
      if (command === "normalize-transform") normalizeTransform();
      if (command === "center-selection") centerSelection();
      if (command === "delete-whole-selection") deleteWholeSelection();
      if (command === "duplicate-whole-selection") duplicateWholeSelection();
      if (command === "add-objective-point") addObjectivePoint();
      if (command === "remove-last-objective-point") removeLastObjectivePoint();
      if (command === "reroll-generator") rerollGenerator();
      if (command === "choose-objective-target") chooseObjectiveTarget();
      if (command === "clear-objective-target") clearObjectiveTarget();
      if (["show-selected", "hide-selected", "lock-selected", "unlock-selected"].includes(command)) mutateSelected(command);
    });
    refs.copySelectionButton.addEventListener("click", copySelection);
    refs.pasteSelectionButton.addEventListener("click", pasteSelection);
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
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) finishKeyboardTransform();
    });
    window.addEventListener("blur", () => {
      state.spacePressed = false;
      finishKeyboardTransform();
    });
    window.addEventListener("keydown", event => {
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (event.code === "Space" && !editable) {
        state.spacePressed = true;
        event.preventDefault();
      }
      if (editable) return;

      if (command && key === "c") {
        event.preventDefault();
        copySelection();
        return;
      }
      if (command && key === "v") {
        event.preventDefault();
        pasteSelection();
        return;
      }
      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (command && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (command && key === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (state.placement) {
        if (event.key === "Escape") {
          event.preventDefault();
          TOOLS.cancelPlacement(state);
          state.status = "Placement cancelled";
          renderAll();
        } else if (key === "r") {
          event.preventDefault();
          state.placement.rotation += event.shiftKey ? -15 : 15;
          state.status = `Place ${state.placement.label} · rotation ${state.placement.rotation}°`;
          renderPlacementGhost();
          refs.saveReadout.textContent = state.status;
        } else if (key === "s") {
          event.preventDefault();
          state.placement.scale = clamp(state.placement.scale * (event.shiftKey ? .9 : 1.1), .2, 5);
          state.status = `Place ${state.placement.label} · scale ${Math.round(state.placement.scale * 100)}%`;
          renderPlacementGhost();
          refs.saveReadout.textContent = state.status;
        }
        return;
      }

      if (state.drawingPath || state.drawingPatch) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (state.drawingPath) finishLinearDraw(); else finishPatchDraw();
        } else if (event.key === "Escape") {
          event.preventDefault();
          if (state.drawingPath) cancelLinearDraw(); else cancelPatchDraw();
        }
        return;
      }

      if (state.scaleSession) {
        if (event.key === "Enter") {
          event.preventDefault();
          finishScaleMode();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelScaleMode();
        } else if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) {
          event.preventDefault();
          const direction = ["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1;
          adjustScaleMode(direction * (event.shiftKey ? .15 : .05));
        }
        return;
      }

      if (TOOLS.isPointEditing(state, state.selection) && (event.key === "Escape" || event.key === "Enter")) {
        event.preventDefault();
        const whole = SELECTION.objectOnly(state.selection);
        TOOLS.leavePointEdit(state);
        setSelection(whole);
        state.status = "Left point-edit mode";
        renderAll();
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && state.selection) {
        event.preventDefault();
        const distance = TOOLS.nudgeDistance({ snap:state.snap, shift:event.shiftKey, alt:event.altKey });
        const dx = event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0;
        const dy = event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0;
        nudgeSelection(dx, dy);
        return;
      }

      if (key === "r" && state.selection) {
        event.preventDefault();
        rotateSelection(event.shiftKey ? -15 : 15);
        return;
      }
      if (key === "s" && state.selection) {
        event.preventDefault();
        beginScaleMode();
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        fitTable();
        return;
      }
      if ((event.key === "Escape" || event.key === "Enter") && state.selection) {
        event.preventDefault();
        select(null);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      }
    });
  }

  initializeSelects();
  renderAssetLibrary();
  bindEvents();
  loadScenario(refs.scenarioSelect.value);
  window.CrossroadsStartupDiagnostics?.complete();
})();
