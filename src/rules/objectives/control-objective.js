"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective registry and helpers must load before control objectives.");

  function pointsFor(objective) {
    return objective.type === "control_group" ? [...(objective.points ?? [])] : [objective];
  }

  function evaluate(objective, state, context) {
    const points = pointsFor(objective).map(point => ({ ...point, state:HELPERS.controlState(point, context) }));
    const controlled = {
      blue:points.filter(point => point.state === "blue").length,
      red:points.filter(point => point.state === "red").length,
      contested:points.filter(point => point.state === "contested").length,
      none:points.filter(point => point.state === "none").length
    };
    const present = {
      blue:HELPERS.units(context).filter(unit => unit.faction === "blue" && points.some(point => HELPERS.pointInObjective(unit, point))).length,
      red:HELPERS.units(context).filter(unit => unit.faction === "red" && points.some(point => HELPERS.pointInObjective(unit, point))).length
    };
    const single = points.length === 1 ? points[0].state : null;
    return { status:"active", state:single, points, controlled, present, summary:points.length === 1 ? single : `Blue ${controlled.blue} · Red ${controlled.red}` };
  }

  function scoringRules(objective, event) {
    if (event.type === "round_ended") {
      if (Array.isArray(objective.roundScoring)) return objective.roundScoring;
      if (Number(objective.roundPoints ?? 0) > 0) return [
        { faction:"blue", rule:"controller", points:Number(objective.roundPoints) },
        { faction:"red", rule:"controller", points:Number(objective.roundPoints) }
      ];
    }
    if (event.type === "battle_ended") {
      if (Array.isArray(objective.finalScoring)) return objective.finalScoring;
      if (Number(objective.finalPoints ?? 0) > 0) return [
        { faction:"blue", rule:"controller", points:Number(objective.finalPoints) },
        { faction:"red", rule:"controller", points:Number(objective.finalPoints) }
      ];
    }
    return [];
  }

  function handleEvent(objective, state, event, context) {
    const snapshot = evaluate(objective, state, context);
    const rules = scoringRules(objective, event).filter(rule => {
      const round = Number(event.round ?? context?.round ?? 1);
      return round >= Number(rule.startRound ?? 1) && round <= Number(rule.endRound ?? Infinity);
    });
    const score = HELPERS.sumScores(rules.map(rule => HELPERS.scoreRule(rule, snapshot, context)));
    return { score, snapshot };
  }

  function validate(objective) {
    const issues = [];
    if (objective.type === "control_group" && (!Array.isArray(objective.points) || objective.points.length === 0)) issues.push("Control groups need at least one point.");
    return issues;
  }

  REGISTRY.register("control_zone", { evaluate, handleEvent, validate });
  REGISTRY.register("control_group", { evaluate, handleEvent, validate });
  REGISTRY.register("presence_zone", { evaluate, handleEvent, validate });
  REGISTRY.register("crossing", { evaluate, handleEvent, validate });
})();
