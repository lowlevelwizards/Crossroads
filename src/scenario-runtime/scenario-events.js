"use strict";

(() => {
  const TYPES = Object.freeze([
    "round_started",
    "round_ended",
    "unit_destroyed",
    "terrain_destroyed",
    "unit_exited",
    "battle_ended"
  ]);
  const TYPE_SET = new Set(TYPES);

  function create(type, details = {}) {
    if (!TYPE_SET.has(type)) throw new Error(`Unknown scenario event type: ${type}`);
    return Object.freeze({ type, timestamp:Date.now(), ...details });
  }

  window.CrossroadsScenarioEvents = Object.freeze({ TYPES, create, isKnown:type => TYPE_SET.has(type) });
})();
