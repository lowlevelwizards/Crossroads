"use strict";

(() => {
  // Foundation 4B.1: pure morale, command-support, Order Test, Rally,
  // and incoming-Pin interpretation. This module never renders, logs,
  // updates statistics, or mutates battle state.

  function create({ rules, distanceBetweenUnits }) {
    if (!rules || typeof distanceBetweenUnits !== "function") {
      throw new Error("Crossroads morale rules require rule and distance dependencies.");
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function findCommandSupport(unit, candidates = []) {
      if (!unit || unit.role === "officer") return null;
      return candidates.find(other =>
        other &&
        other.faction === unit.faction &&
        other.role === "officer" &&
        other.id !== unit.id &&
        distanceBetweenUnits(unit, other) <= rules.commandRadius + 0.001
      ) ?? null;
    }

    function commandBonus(unit, candidates = []) {
      return findCommandSupport(unit, candidates)
        ? rules.commandMoraleBonus
        : 0;
    }

    function analyzeOrderTest({ unit, order, support = null }) {
      if (!unit) throw new Error("Order Test analysis requires a unit.");

      const pins = Math.max(0, Number(unit.pins) || 0);
      const ignoresPins = order === "Rally";
      const required = ignoresPins || pins > 0;
      const officerBonus = support ? rules.commandMoraleBonus : 0;
      const pinPenalty = ignoresPins ? 0 : pins;
      const baseMorale = Number(unit.morale) || 0;
      const target = clamp(baseMorale + officerBonus - pinPenalty, 2, 11);

      return Object.freeze({
        required,
        order,
        ignoresPins,
        baseMorale,
        officerBonus,
        pinPenalty,
        target,
        supportUnit: support,
        pinsBefore: pins
      });
    }

    function resolveOrderTest({ analysis, unit, order, rollDice }) {
      if (!analysis || !unit) {
        throw new Error("Order Test resolution requires analysis and a unit.");
      }
      if (typeof rollDice !== "function") {
        throw new Error("Order Test resolution requires an injected rollDice function.");
      }

      const pinsBefore = Math.max(0, Number(unit.pins) || 0);
      if (!analysis.required) {
        return Object.freeze({
          status: "not-required",
          order,
          required: false,
          dice: Object.freeze([]),
          total: null,
          target: analysis.target,
          passed: true,
          pinsBefore,
          pinsRemovedOnPass: 0,
          pinsAfterPass: pinsBefore,
          failureState: null
        });
      }

      const dice = Object.freeze([...rollDice(2)]);
      const total = dice[0] + dice[1];
      const passed = total <= analysis.target;
      const pinsRemovedOnPass = passed
        ? analysis.ignoresPins
          ? pinsBefore
          : Math.min(1, pinsBefore)
        : 0;
      const pinsAfterPass = Math.max(0, pinsBefore - pinsRemovedOnPass);

      return Object.freeze({
        status: passed ? "passed" : "failed",
        order,
        required: true,
        dice,
        total,
        target: analysis.target,
        passed,
        pinsBefore,
        pinsRemovedOnPass,
        pinsAfterPass,
        failureState: passed
          ? null
          : Object.freeze({
              down: true,
              activated: true,
              order: "Down · Failed"
            })
      });
    }

    function analyzeIncomingPins(unit, pinDelta) {
      const pinsBefore = Math.max(0, Number(unit?.pins) || 0);
      const normalizedDelta = Math.max(0, Number(pinDelta) || 0);
      const pinsAfter = pinsBefore + normalizedDelta;
      const morale = Number(unit?.morale);
      const routed =
        normalizedDelta > 0 &&
        Number.isFinite(morale) &&
        pinsAfter >= morale;

      return Object.freeze({
        pinsBefore,
        pinDelta: normalizedDelta,
        pinsAfter,
        morale: Number.isFinite(morale) ? morale : null,
        routed
      });
    }

    return Object.freeze({
      findCommandSupport,
      commandBonus,
      analyzeOrderTest,
      resolveOrderTest,
      analyzeIncomingPins
    });
  }

  window.CrossroadsMoraleRules = Object.freeze({ create });
})();
