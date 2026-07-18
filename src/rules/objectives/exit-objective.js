"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective registry and helpers must load before exit objectives.");

  function inside(unit, objective, context) {
    const width = Number(context?.table?.width ?? 72);
    const height = Number(context?.table?.height ?? 48);
    const depth = Number(objective.depth ?? 3);
    if (objective.edge === "blue") return unit.x <= depth + .001;
    if (objective.edge === "red") return unit.x >= width - depth - .001;
    if (objective.edge === "top") return unit.y <= depth + .001;
    if (objective.edge === "bottom") return unit.y >= height - depth - .001;
    return false;
  }

  function createState() {
    return { exitedUnitIds:[] };
  }

  function evaluate(objective, state, context) {
    const eligible = (context?.allUnits ?? context?.units ?? []).filter(unit => unit.faction === objective.faction);
    const exited = state.exitedUnitIds.length;
    return {
      status:Number(objective.minimumUnits ?? Infinity) <= exited ? "complete" : "active",
      progress:{ current:exited, required:Number(objective.minimumUnits ?? eligible.length) },
      exitedUnitIds:[...state.exitedUnitIds],
      summary:`${exited} unit${exited === 1 ? "" : "s"} exited`
    };
  }

  function handleEvent(objective, state, event, context) {
    let score = { blue:0, red:0 };
    if (event.type === "unit_exited" && event.objectiveId === objective.id && !state.exitedUnitIds.includes(event.unitId)) {
      state.exitedUnitIds.push(event.unitId);
      const points = Number(objective.pointsPerUnit ?? 0);
      score = objective.faction === "blue" ? { blue:points, red:0 } : { blue:0, red:points };
    }
    if (event.type === "battle_ended" && Number(objective.containmentPointsPerUnit ?? 0) > 0) {
      const defender = objective.faction === "blue" ? "red" : "blue";
      const total = (context?.allUnits ?? []).filter(unit => unit.faction === objective.faction).length;
      const contained = Math.max(0, total - state.exitedUnitIds.length);
      const points = contained * Number(objective.containmentPointsPerUnit);
      score = defender === "blue" ? { blue:points, red:0 } : { blue:0, red:points };
    }
    return { score, snapshot:evaluate(objective, state, context) };
  }

  function validate(objective) {
    const issues = [];
    if (!["blue", "red", "top", "bottom"].includes(objective.edge)) issues.push("Exit objectives need a valid table edge.");
    if (!["blue", "red"].includes(objective.faction)) issues.push("Exit objectives need an assigned faction.");
    return issues;
  }

  REGISTRY.register("exit_unit", { createState, evaluate, handleEvent, validate, inside });
})();
