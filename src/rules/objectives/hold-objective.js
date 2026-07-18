"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective registry and helpers must load before hold objectives.");

  function createState() { return { failed:false, completed:false, lastState:"none" }; }
  function evaluate(objective, state, context) {
    const current = HELPERS.controlState(objective, context);
    return { status:state.failed ? "failed" : state.completed ? "complete" : "active", state:current, progress:{current:Number(context?.round ?? 1),required:Number(objective.checkpointRound ?? context?.maxRounds ?? 1)}, summary:`${current} · checkpoint Round ${Number(objective.checkpointRound ?? context?.maxRounds ?? 1)}` };
  }
  function handleEvent(objective, state, event, context) {
    let score = { blue:0, red:0 };
    if (event.type !== "round_ended") return { score, snapshot:evaluate(objective, state, context) };
    const current = HELPERS.controlState(objective, context);
    state.lastState = current;
    const faction = objective.faction;
    const startRound = Number(objective.startRound ?? 1);
    const checkpoint = Number(objective.checkpointRound ?? context?.maxRounds ?? 1);
    if (objective.continuous === true && event.round >= startRound && event.round <= checkpoint && current !== faction) state.failed = true;
    if (event.round >= checkpoint && !state.failed && current === faction && !state.completed) {
      state.completed = true;
      const points = Number(objective.points ?? 0);
      score = faction === "blue" ? {blue:points,red:0} : faction === "red" ? {blue:0,red:points} : score;
    }
    if (event.round >= checkpoint && !state.completed && current !== faction) state.failed = true;
    return { score, snapshot:evaluate(objective, state, context), immediateVictory:state.completed && objective.immediateVictory === true ? faction : null };
  }
  function validate(objective, scenario) {
    const issues = [];
    if (!["blue", "red"].includes(objective.faction)) issues.push("Hold objectives need an assigned faction.");
    if (Number(objective.checkpointRound ?? 0) < 1 || Number(objective.checkpointRound ?? 0) > Number(scenario?.rounds ?? 1)) issues.push("Hold checkpoint must fall within the scenario round limit.");
    return issues;
  }
  REGISTRY.register("hold", { createState, evaluate, handleEvent, validate });
})();
