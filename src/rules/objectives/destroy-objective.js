"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective registry and helpers must load before destroy objectives.");

  function createState() { return { destroyed:false, completedRound:null }; }
  function evaluate(objective, state, context) {
    return { status:state.destroyed ? "complete" : "active", progress:{current:state.destroyed ? 1 : 0,required:1}, target:HELPERS.findTarget(context, objective.targetId), summary:state.destroyed ? "Target destroyed" : "Target intact" };
  }
  function handleEvent(objective, state, event, context) {
    let score = { blue:0, red:0 };
    if ((event.type === "unit_destroyed" || event.type === "terrain_destroyed") && String(event.targetId ?? event.unitId ?? event.terrainId) === String(objective.targetId) && !state.destroyed) {
      state.destroyed = true;
      state.completedRound = event.round ?? null;
      const faction = objective.faction ?? event.causedByFactionId;
      const points = Number(objective.points ?? 0);
      score = faction === "blue" ? {blue:points,red:0} : faction === "red" ? {blue:0,red:points} : score;
    }
    return { score, snapshot:evaluate(objective, state, context), immediateVictory:state.destroyed && objective.immediateVictory === true ? objective.faction : null };
  }
  function validate(objective, scenario) {
    if (!String(objective.targetId || "").trim()) return ["Destroy objectives need a target."];
    const ids = new Set([...(scenario?.forces?.blue ?? []), ...(scenario?.forces?.red ?? []), ...(scenario?.terrain ?? [])].map(item => String(item.id)));
    return ids.has(String(objective.targetId)) ? [] : ["Destroy objective target does not exist."];
  }
  REGISTRY.register("destroy_target", { createState, evaluate, handleEvent, validate });
})();
