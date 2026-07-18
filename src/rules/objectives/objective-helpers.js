"use strict";

(() => {
  function active(unit) {
    return Boolean(unit && unit.soldiers > 0 && (unit.outcome ?? "active") === "active");
  }

  function units(context) {
    return (context?.units ?? []).filter(active);
  }

  function pointInObjective(unit, objective) {
    if (objective.shape === "rect") {
      return unit.x >= Number(objective.x ?? 0) && unit.x <= Number(objective.x ?? 0) + Number(objective.width ?? 0) &&
        unit.y >= Number(objective.y ?? 0) && unit.y <= Number(objective.y ?? 0) + Number(objective.height ?? 0);
    }
    const radius = Number(objective.radius ?? 0);
    return Math.hypot(Number(unit.x) - Number(objective.x), Number(unit.y) - Number(objective.y)) <= radius + .001;
  }

  function controlState(objective, context) {
    const present = units(context).filter(unit => pointInObjective(unit, objective));
    const blue = present.some(unit => unit.faction === "blue");
    const red = present.some(unit => unit.faction === "red");
    return blue && red ? "contested" : blue ? "blue" : red ? "red" : "none";
  }

  function scoreRule(rule, snapshot, context) {
    const faction = rule.faction;
    const opponent = rule.opponent ?? (faction === "blue" ? "red" : "blue");
    if (!faction) return { blue:0, red:0 };
    let awarded = 0;
    if (rule.rule === "controller") {
      if (snapshot.state === faction) awarded = Number(rule.points ?? 0);
    } else if (rule.rule === "per_controlled") {
      awarded = Number(snapshot.controlled?.[faction] ?? 0) * Number(rule.points ?? 0);
    } else if (rule.rule === "opponent_none") {
      if (Number(snapshot.controlled?.[opponent] ?? 0) === 0) awarded = Number(rule.points ?? 0);
    } else if (rule.rule === "faction_present") {
      if ((snapshot.present?.[faction] ?? 0) > 0) awarded = Number(rule.points ?? 0);
    } else if (rule.rule === "opponent_absent") {
      if ((snapshot.present?.[opponent] ?? 0) === 0) awarded = Number(rule.points ?? 0);
    }
    if (Number.isFinite(Number(rule.maxPoints)) && Number(rule.maxPoints) > 0) awarded = Math.min(awarded, Number(rule.maxPoints));
    return { blue:faction === "blue" ? awarded : 0, red:faction === "red" ? awarded : 0 };
  }

  function sumScores(entries) {
    return entries.reduce((total, item) => ({ blue:total.blue + Number(item.blue ?? 0), red:total.red + Number(item.red ?? 0) }), { blue:0, red:0 });
  }

  function findTarget(context, id) {
    const key = String(id || "");
    return (context?.units ?? []).find(unit => String(unit.id) === key) ??
      (context?.terrain ?? []).find(item => String(item.id) === key) ?? null;
  }

  window.CrossroadsObjectiveHelpers = Object.freeze({ active, units, pointInObjective, controlState, scoreRule, sumScores, findTarget });
})();
