"use strict";

(() => {
  const COMPILER = window.CrossroadsScenarioCompiler;
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  const EVENTS = window.CrossroadsScenarioEvents;
  const VICTORY = window.CrossroadsVictoryPolicies;
  if (!COMPILER || !REGISTRY || !EVENTS || !VICTORY) throw new Error("Scenario runtime dependencies are missing.");

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function addScore(total, delta) {
    total.blue += Number(delta?.blue ?? 0);
    total.red += Number(delta?.red ?? 0);
  }

  function createSession(source) {
    const compiled = COMPILER.compile(source);
    const objectiveStates = new Map();
    const events = [];
    let immediateWinner = null;
    let finalized = false;

    for (const objective of compiled.objectives) {
      const evaluator = REGISTRY.get(objective.type);
      objectiveStates.set(objective.id, evaluator.createState ? evaluator.createState(objective, compiled.scenario) : {});
    }

    function contextWith(base = {}) {
      const units = base.units ?? [];
      return {
        ...base,
        units,
        allUnits:base.allUnits ?? units,
        table:compiled.scenario.table,
        factions:compiled.scenario.factions,
        maxRounds:compiled.scenario.rounds,
        scenario:compiled.scenario
      };
    }

    function snapshot(baseContext = {}) {
      const context = contextWith(baseContext);
      return compiled.objectives.map(objective => {
        const evaluator = REGISTRY.get(objective.type);
        const state = objectiveStates.get(objective.id);
        return Object.freeze({ objective, ...clone(evaluator.evaluate(objective, state, context)) });
      });
    }

    function dispatch(type, details = {}, baseContext = {}) {
      const event = EVENTS.create(type, details);
      const context = contextWith(baseContext);
      const score = { blue:0, red:0 };
      const updates = [];
      events.push(event);
      for (const objective of compiled.objectives) {
        const evaluator = REGISTRY.get(objective.type);
        const state = objectiveStates.get(objective.id);
        const result = evaluator.handleEvent ? evaluator.handleEvent(objective, state, event, context) : { score:{blue:0,red:0}, snapshot:evaluator.evaluate(objective, state, context) };
        const objectiveSnapshot = result.snapshot ?? evaluator.evaluate(objective, state, context);
        addScore(score, result.score);
        const decisiveFaction = result.immediateVictory ?? (
          compiled.victory.policy === "immediate" &&
          objectiveSnapshot.status === "complete" &&
          (objective.faction === "blue" || objective.faction === "red")
            ? objective.faction
            : null
        );
        if (decisiveFaction === "blue" || decisiveFaction === "red") immediateWinner = decisiveFaction;
        updates.push(Object.freeze({ objective, ...objectiveSnapshot, score:result.score ?? {blue:0,red:0} }));
      }
      return Object.freeze({ event, score:Object.freeze(score), updates:Object.freeze(updates), immediateWinner });
    }

    function finalize(baseContext = {}) {
      if (finalized) return Object.freeze({ score:{blue:0,red:0}, updates:snapshot(baseContext), immediateWinner });
      finalized = true;
      return dispatch("battle_ended", { round:baseContext.round ?? compiled.scenario.rounds }, baseContext);
    }

    function resolveVictory(scores, baseContext = {}, options = {}) {
      return VICTORY.resolve(compiled.victory, scores, contextWith(baseContext), { final:options.final === true, immediateWinner });
    }

    function exitObjectiveFor(unit, baseContext = {}) {
      const context = contextWith(baseContext);
      return compiled.objectives.find(objective => {
        if (objective.type !== "exit_unit" || objective.faction !== unit?.faction) return false;
        return REGISTRY.get("exit_unit").inside(unit, objective, context);
      }) ?? null;
    }

    function validate() {
      const issues = [];
      for (const objective of compiled.objectives) {
        const evaluator = REGISTRY.get(objective.type);
        for (const message of evaluator.validate?.(objective, compiled.scenario) ?? []) issues.push({ objectiveId:objective.id, message });
      }
      return issues;
    }

    return Object.freeze({
      compiled,
      dispatch,
      finalize,
      snapshot,
      resolveVictory,
      exitObjectiveFor,
      validate,
      events:() => [...events],
      isFinalized:() => finalized
    });
  }

  window.CrossroadsScenarioRuntime = Object.freeze({ createSession });
})();
