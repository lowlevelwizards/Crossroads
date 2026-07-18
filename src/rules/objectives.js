"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const HELPERS = window.CrossroadsObjectiveHelpers;
  if (!REGISTRY || !HELPERS) throw new Error("Objective modules must load before objectives.js.");

  function pointState(point, units, distanceBetweenPoints) {
    if (typeof distanceBetweenPoints === "function") {
      const present = (units ?? []).filter(unit => HELPERS.active(unit) && distanceBetweenPoints(unit, point) <= Number(point.radius ?? 0));
      const blue = present.some(unit => unit.faction === "blue");
      const red = present.some(unit => unit.faction === "red");
      return blue && red ? "contested" : blue ? "blue" : red ? "red" : "none";
    }
    return HELPERS.controlState(point, { units });
  }

  function snapshot(objective, units, distanceBetweenPoints) {
    const evaluator = REGISTRY.get(objective?.type ?? "control_zone");
    const result = evaluator.evaluate(objective, {}, { units, allUnits:units, round:1, table:{width:72,height:48}, distanceBetweenPoints });
    return Object.freeze({ points:Object.freeze(result.points ?? []), controlled:Object.freeze(result.controlled ?? {blue:0,red:0,contested:0,none:0}) });
  }

  function roundScore(objective, scoring, round, units, distanceBetweenPoints) {
    const migrated = {
      ...objective,
      roundScoring:[
        { faction:"red", rule:"per_controlled", points:Number(scoring?.pointsPerCrossing ?? 1), maxPoints:Number(scoring?.maxCrossingPoints ?? 0) || null, startRound:Number(scoring?.startRound ?? 1) },
        { faction:"blue", rule:"opponent_none", opponent:"red", points:Number(scoring?.delayPoints ?? 0), startRound:Number(scoring?.startRound ?? 1) }
      ].filter(rule => rule.points > 0)
    };
    const evaluator = REGISTRY.get(migrated.type ?? "control_group");
    const result = evaluator.handleEvent(migrated, {}, { type:"round_ended", round }, { units, allUnits:units, round, table:{width:72,height:48}, distanceBetweenPoints });
    return Object.freeze({ ...result.score, state:result.snapshot });
  }

  function finalScore(objective, scoring, units) {
    const line = {
      id:"compat-final",
      type:"presence_zone",
      shape:"rect",
      x:Number(scoring?.breakthroughLineX ?? Infinity), y:0,
      width:1000, height:1000,
      finalScoring:[
        { faction:"red", rule:"faction_present", points:Number(scoring?.breakthroughPoints ?? 0) },
        { faction:"blue", rule:"opponent_absent", opponent:"red", points:Number(scoring?.denialPoints ?? 0) }
      ]
    };
    const evaluator = REGISTRY.get("presence_zone");
    const result = evaluator.handleEvent(line, {}, { type:"battle_ended", round:6 }, { units, allUnits:units, round:6, table:{width:72,height:48} });
    return Object.freeze(result.score);
  }

  window.CrossroadsObjectiveRules = Object.freeze({
    pointsFor:objective => objective?.type === "control_group" ? [...(objective.points ?? [])] : objective ? [objective] : [],
    pointState,
    snapshot,
    roundScore,
    finalScore
  });
})();
