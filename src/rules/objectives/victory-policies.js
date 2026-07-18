"use strict";

(() => {
  function tiebreakMetric(faction, context, metric) {
    const living = (context?.units ?? []).filter(unit => unit.faction === faction && unit.soldiers > 0 && (unit.outcome ?? "active") === "active");
    return metric === "survivingSoldiers" ? living.reduce((sum, unit) => sum + unit.soldiers, 0) : living.length;
  }

  function points(victory, scores, context) {
    if (scores.blue > scores.red) return { winner:"blue", reason:"score", message:`${context.factions.blue.name} wins ${scores.blue}–${scores.red}.` };
    if (scores.red > scores.blue) return { winner:"red", reason:"score", message:`${context.factions.red.name} wins ${scores.red}–${scores.blue}.` };
    const metric = victory.tiebreaker ?? "survivingUnits";
    const blueMetric = tiebreakMetric("blue", context, metric);
    const redMetric = tiebreakMetric("red", context, metric);
    if (blueMetric > redMetric) return { winner:"blue", reason:"tiebreak", message:`Score tied ${scores.blue}–${scores.red}; ${context.factions.blue.name} wins the ${metric === "survivingSoldiers" ? "surviving-soldiers" : "surviving-units"} tiebreak ${blueMetric}–${redMetric}.` };
    if (redMetric > blueMetric) return { winner:"red", reason:"tiebreak", message:`Score tied ${scores.blue}–${scores.red}; ${context.factions.red.name} wins the ${metric === "survivingSoldiers" ? "surviving-soldiers" : "surviving-units"} tiebreak ${redMetric}–${blueMetric}.` };
    return { winner:null, reason:"draw", message:`The battle is a draw: ${scores.blue}–${scores.red}, with the tiebreak also even.` };
  }

  function asymmetric(victory, scores, context) {
    const blueTarget = Number(victory.thresholds?.blue ?? Infinity);
    const redTarget = Number(victory.thresholds?.red ?? Infinity);
    if (scores.blue >= blueTarget && scores.red >= redTarget) return points(victory, scores, context);
    if (scores.blue >= blueTarget) return { winner:"blue", reason:"threshold", message:`${context.factions.blue.name} reaches its victory threshold.` };
    if (scores.red >= redTarget) return { winner:"red", reason:"threshold", message:`${context.factions.red.name} reaches its victory threshold.` };
    return null;
  }

  function resolve(victory, scores, context, options = {}) {
    if (options.immediateWinner) return { winner:options.immediateWinner, reason:"objective", message:`${context.factions[options.immediateWinner].name} completes a decisive objective.` };
    if (victory.policy === "asymmetric_thresholds") return asymmetric(victory, scores, context) ?? (options.final ? points(victory, scores, context) : null);
    return options.final ? points(victory, scores, context) : null;
  }

  window.CrossroadsVictoryPolicies = Object.freeze({ resolve, points, asymmetric, tiebreakMetric });
})();
