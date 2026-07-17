"use strict";

(() => {
  function active(unit) {
    return Boolean(unit && unit.soldiers > 0 && (unit.outcome ?? "active") === "active");
  }

  function pointsFor(objective) {
    return objective?.type === "control_group"
      ? [...(objective.points ?? [])]
      : objective ? [objective] : [];
  }

  function pointState(point, units, distanceBetweenPoints) {
    const present = (units ?? []).filter(unit =>
      active(unit) && distanceBetweenPoints(unit, point) <= Number(point.radius ?? 0)
    );
    const blue = present.some(unit => unit.faction === "blue");
    const red = present.some(unit => unit.faction === "red");
    return blue && red ? "contested" : blue ? "blue" : red ? "red" : "none";
  }

  function snapshot(objective, units, distanceBetweenPoints) {
    const points = pointsFor(objective).map(point => Object.freeze({
      ...point,
      state: pointState(point, units, distanceBetweenPoints)
    }));
    const controlled = Object.freeze({
      blue: points.filter(point => point.state === "blue").length,
      red: points.filter(point => point.state === "red").length,
      contested: points.filter(point => point.state === "contested").length,
      none: points.filter(point => point.state === "none").length
    });
    return Object.freeze({ points: Object.freeze(points), controlled });
  }

  function roundScore(objective, scoring, round, units, distanceBetweenPoints) {
    const state = snapshot(objective, units, distanceBetweenPoints);
    const result = { blue: 0, red: 0, state };
    if (objective?.type !== "control_group") return Object.freeze(result);
    if (round < Number(scoring?.startRound ?? 1)) return Object.freeze(result);

    result.red = Math.min(
      Number(scoring?.maxCrossingPoints ?? state.controlled.red),
      state.controlled.red * Number(scoring?.pointsPerCrossing ?? 1)
    );
    if (state.controlled.red === 0) result.blue = Number(scoring?.delayPoints ?? 0);
    return Object.freeze(result);
  }

  function finalScore(objective, scoring, units) {
    if (objective?.type !== "control_group") return Object.freeze({ blue: 0, red: 0 });
    const lineX = Number(scoring?.breakthroughLineX ?? Infinity);
    const germanBreakthrough = (units ?? []).some(unit => active(unit) && unit.faction === "red" && unit.x > lineX);
    return Object.freeze(germanBreakthrough
      ? { blue: 0, red: Number(scoring?.breakthroughPoints ?? 0) }
      : { blue: Number(scoring?.denialPoints ?? 0), red: 0 });
  }

  window.CrossroadsObjectiveRules = Object.freeze({
    pointsFor,
    pointState,
    snapshot,
    roundScore,
    finalScore
  });
})();
