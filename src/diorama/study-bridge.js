"use strict";

// Crossroads 3D tabletop adapter. All coordinates in the game remain inches.
// The Three.js scene is merely a projection of game positions onto the table.
(() => {
  const scenario = window.CROSSROADS_SCENARIOS?.hold_the_farm;
  const types = window.CROSSROADS_UNIT_TYPES;
  const formations = window.CROSSROADS_FORMATIONS?.formations;
  const miniatures = window.CrossroadsMiniaturePresentation;
  const terrainTypes = window.CROSSROADS_TERRAIN_TYPES;
  const movementFactory = window.CrossroadsMovementRules;
  if (!scenario || !types || !formations || !miniatures || !terrainTypes || !movementFactory) {
    throw new Error("Diorama bridge requires live Crossroads scenario, unit, formation, miniature and movement modules.");
  }

  const table = Object.freeze({
    width: scenario.table.width,
    height: scenario.table.height,
    worldUnitsPerInch: 0.30
  });
  if (table.width !== 72 || table.height !== 48) {
    throw new Error("3D study requires the 72-by-48-inch Crossroads board.");
  }
  const INCH = table.worldUnitsPerInch;

  function toWorld({ x, y }) {
    return { x: (x - table.width / 2) * INCH, z: (y - table.height / 2) * INCH };
  }
  function toTable({ x, z }) {
    return { x: x / INCH + table.width / 2, y: z / INCH + table.height / 2 };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function inBounds(p, clearance = 0) {
    return Number.isFinite(p?.x) && Number.isFinite(p?.y) &&
      p.x >= clearance && p.x <= table.width - clearance &&
      p.y >= clearance && p.y <= table.height - clearance;
  }
  function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function pointAtSegment(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function insideRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height;
  }
  function expandRect(rect, padding) {
    return { ...rect, x: rect.x - padding, y: rect.y - padding,
      width: rect.width + padding * 2, height: rect.height + padding * 2 };
  }

  // Liang-Barsky clip; mirrors the shape of the 2D segment clip result.
  function segmentRectClip(a, b, r) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - r.x, r.x + r.width - a.x, a.y - r.y, r.y + r.height - a.y];
    let enter = 0, exit = 1;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-10) {
        if (q[i] < 0) return null;
        continue;
      }
      const t = q[i] / p[i];
      if (p[i] < 0) enter = Math.max(enter, t);
      else exit = Math.min(exit, t);
      if (enter > exit) return null;
    }
    return { tEnter: enter, tExit: exit, insideFraction: Math.max(0, exit - enter) };
  }
  function segmentPointDistance(a, b, point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq, 0, 1) : 0;
    return { distance: distance(pointAtSegment(a, b, t), point), t };
  }

  // The farm study is not a full rendering of Hold the Farm. We borrow its
  // authored Polish rifle squad and deliberately place it on this vignette's
  // meadow. No scenario spawn coordinates or authored scenario files change.
  function createSquad(worldStart = { x: 1.85, z: 3.92 }) {
    const source = scenario.forces.blue.find(entry => entry.unitType === "rifleSquad");
    if (!source) throw new Error("Hold the Farm has no Polish rifle squad.");
    const template = types[source.unitType];
    if (!template) throw new Error("Unknown rifle squad template.");
    const start = toTable(worldStart);
    const unit = {
      id: source.id,
      type: source.unitType,
      role: template.role,
      name: source.name ?? template.name,
      faction: "blue",
      quality: source.quality ?? template.quality,
      kitId: scenario.factions.blue.kitId,
      soldiers: template.soldiers,
      weapons: { ...template.weapons },
      x: start.x,
      y: start.y,
      facing: "up",
      pins: 0,
      moved: false,
      order: null
    };
    return unit;
  }

  // Original formation slot percentages now refer to physical inches rather
  // than the CSS canvas. Six soldiers occupy a roughly 8x3-inch formation.
  function slotsFor(unit) {
    const definition = formations[unit.role] ?? formations.line;
    return definition.slots.slice(0, unit.soldiers).map(([x, y], index) =>
      Object.freeze({
        index,
        dx: (x - 50) / 100 * 2.50,
        dz: (y - 50) / 100 * 1.35,
        recipe: miniatures.resolveModelRecipe(unit, index)
      })
    );
  }

  // A semantic footprint for each actual 3D obstacle, in inches. It is built
  // from the same geometry arguments that construct the visual meshes.
  function terrainInstance({ id, type, worldX, worldZ, worldWidth, worldDepth }) {
    const definition = terrainTypes[type];
    if (!definition) throw new Error("Unknown Crossroads terrain: " + type);
    const topLeft = toTable({ x: worldX - worldWidth / 2, z: worldZ - worldDepth / 2 });
    return Object.freeze({
      id, terrainId: type, x: topLeft.x, y: topLeft.y,
      width: worldWidth / INCH, height: worldDepth / INCH,
      definition,
      rules: definition.rules
    });
  }

  // Values mirror the engine's current RULES movement block; the actual
  // legality/cost algorithm is imported, not reimplemented in this study.
  const movementSettings = Object.freeze({
    advanceDistance: 6,
    runDistance: 12,
    buildingCollisionClearance: 0.55,
    unitSeparation: 3.4,
    roughGroundMultiplier: 2,
    wallCrossingCost: 2
  });

  function createMovementController(unit, terrainDefinitions) {
    const terrain = { instances: terrainDefinitions.map(terrainInstance) };
    const movement = movementFactory.create({
      rules: movementSettings,
      terrain,
      movementIntegrityEnabled: () => true,
      livingUnits: () => [unit],
      distanceBetweenPoints: distance,
      pointAtSegment,
      pointInsideRect: insideRect,
      expandRect,
      segmentRectClip,
      segmentTerrainClip: segmentRectClip,
      segmentPointDistance,
      capitalize: text => String(text ?? "").replace(/^./, x => x.toUpperCase())
    });
    function planMove(worldTarget, order = "Advance") {
      if (order !== "Advance" && order !== "Run") return { legal: false, reason: "Unsupported order" };
      const destination = toTable(worldTarget);
      if (!inBounds(destination, 1.2)) return { legal: false, reason: "Outside board" };
      const start = { x: unit.x, y: unit.y };
      if (distance(start, destination) < 0.12) return { legal: false, reason: "Too close" };
      const path = [start, destination];
      const analysis = movement.analyzeMovementPath(unit, path, order);
      const fitted = analysis.legal ? { path, analysis } :
        analysis.kind === "allowance" ? movement.fitMovementPathToAllowance(unit, path, order) : null;
      if (!fitted || !fitted.analysis.legal) {
        return { legal: false, reason: analysis.reason, kind: analysis.kind };
      }
      const endpoint = fitted.path[fitted.path.length - 1];
      // Never let a fitted path exceed the board (not relevant for a wholly
      // in-bounds straight segment, but codified for future waypoint commands).
      if (!inBounds(endpoint, 1.2)) return { legal: false, reason: "Outside board" };
      return { legal: true, order, start, endpoint, worldEnd: toWorld(endpoint),
        cost: fitted.analysis.cost, allowance: fitted.analysis.allowance,
        shortened: Boolean(fitted.analysis.fitted) };
    }
    function commitMove(plan) {
      if (!plan?.legal) throw new Error("Cannot commit illegal move");
      unit.x = plan.endpoint.x;
      unit.y = plan.endpoint.y;
      unit.facing = Math.abs(plan.endpoint.x - plan.start.x) >
        Math.abs(plan.endpoint.y - plan.start.y)
        ? (plan.endpoint.x > plan.start.x ? "right" : "left")
        : (plan.endpoint.y > plan.start.y ? "down" : "up");
      unit.moved = true;
      unit.order = plan.order;
    }
    return Object.freeze({ planMove, commitMove, movement, terrain });
  }

  window.CrossroadsDioramaBridge = Object.freeze({
    table, toWorld, toTable, inBounds, terrainInstance, createSquad,
    slotsFor, createMovementController
  });
})();
