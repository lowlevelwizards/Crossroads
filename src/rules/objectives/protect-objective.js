"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective registry and helpers must load before protect objectives.");

  function createState() { return { failed:false, scored:false }; }
  function evaluate(objective, state, context) {
    return { status:state.failed ? "failed" : state.scored ? "complete" : "active", progress:{current:state.failed ? 0 : 1,required:1}, target:HELPERS.findTarget(context, objective.targetId), summary:state.failed ? "Target lost" : state.scored ? "Target protected" : "Target surviving" };
  }
  function handleEvent(objective, state, event, context) {
    let score = { blue:0, red:0 };
    const destroyedId = event.targetId ?? event.unitId ?? event.terrainId;
    if ((event.type === "unit_destroyed" || event.type === "terrain_destroyed") && String(destroyedId) === String(objective.targetId)) state.failed = true;
    if (event.type === "battle_ended" && !state.failed && !state.scored) {
      state.scored = true;
      const points = Number(objective.points ?? 0);
      score = objective.faction === "blue" ? {blue:points,red:0} : objective.faction === "red" ? {blue:0,red:points} : score;
    }
    return { score, snapshot:evaluate(objective, state, context) };
  }
  function validate(objective, scenario) {
    if (!String(objective.targetId || "").trim()) return ["Protect objectives need a target."];
    const ids = new Set([...(scenario?.forces?.blue ?? []), ...(scenario?.forces?.red ?? []), ...(scenario?.terrain ?? [])].map(item => String(item.id)));
    return ids.has(String(objective.targetId)) ? [] : ["Protect objective target does not exist."];
  }
  REGISTRY.register("protect_target", { createState, evaluate, handleEvent, validate });
})();
