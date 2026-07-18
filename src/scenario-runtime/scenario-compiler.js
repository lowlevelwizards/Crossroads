"use strict";

(() => {
  const SCHEMA = window.CrossroadsScenarioSchema;
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  if (!SCHEMA || !REGISTRY) throw new Error("Scenario schema and objective registry must load before the scenario compiler.");

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function compile(source) {
    const scenario = SCHEMA.normalize(source);
    const objectives = (scenario.objectives ?? []).filter(objective => objective.visible !== false).map(objective => {
      const type = objective.type ?? "control_zone";
      if (!REGISTRY.has(type)) throw new Error(`Scenario ${scenario.id} uses unsupported objective type ${type}.`);
      return Object.freeze({ ...clone(objective), type });
    });
    return Object.freeze({
      scenario,
      objectives:Object.freeze(objectives),
      victory:Object.freeze({ policy:"points", tiebreaker:"survivingUnits", elimination:false, ...(scenario.victory ?? {}) })
    });
  }

  window.CrossroadsScenarioCompiler = Object.freeze({ compile });
})();
