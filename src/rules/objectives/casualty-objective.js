"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  if (!REGISTRY) throw new Error("Objective registry must load before casualty objectives.");

  function createState() { return { blue:0, red:0, destroyedUnitIds:[] }; }

  function evaluate(objective, state) {
    return { status:"active", progress:{ blue:state.blue, red:state.red }, summary:`Blue ${state.blue} · Red ${state.red}` };
  }

  function handleEvent(objective, state, event) {
    if (event.type !== "unit_destroyed" || state.destroyedUnitIds.includes(event.unitId)) return { score:{blue:0,red:0}, snapshot:evaluate(objective, state) };
    state.destroyedUnitIds.push(event.unitId);
    const credited = event.causedByFactionId;
    const points = Number(objective.pointsPerUnit ?? 0);
    if (credited === "blue" || credited === "red") state[credited] += points;
    return { score:{ blue:credited === "blue" ? points : 0, red:credited === "red" ? points : 0 }, snapshot:evaluate(objective, state) };
  }

  REGISTRY.register("casualty", { createState, evaluate, handleEvent, validate:() => [] });
})();
