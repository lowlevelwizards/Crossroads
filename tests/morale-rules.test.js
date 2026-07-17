"use strict";

(() => {
  const results = [];

  function test(name, callback) {
    try {
      callback();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed.");
  }

  function equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || "Values differ"}: expected ${expected}, got ${actual}`);
    }
  }

  function distanceBetweenUnits(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function diceQueue(...batches) {
    const queue = batches.map(batch => [...batch]);
    const consumed = [];
    const rollDice = count => {
      const batch = queue.shift();
      if (!batch) throw new Error(`Unexpected dice request for ${count} dice.`);
      equal(batch.length, count, "Dice batch length");
      consumed.push(count);
      return batch;
    };
    rollDice.remaining = () => queue.length;
    rollDice.consumed = consumed;
    return rollDice;
  }

  const rules = {
    commandRadius: 6,
    commandMoraleBonus: 1
  };

  const morale = window.CrossroadsMoraleRules.create({
    rules,
    distanceBetweenUnits
  });

  function unit(overrides = {}) {
    return {
      id: overrides.id ?? "unit",
      faction: overrides.faction ?? "blue",
      role: overrides.role ?? "line",
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      pins: overrides.pins ?? 0,
      morale: overrides.morale ?? 9,
      down: overrides.down ?? false,
      activated: overrides.activated ?? false,
      order: overrides.order ?? null
    };
  }

  test("Unpinned ordinary order requires no test", () => {
    const analysis = morale.analyzeOrderTest({ unit: unit(), order: "Run" });
    equal(analysis.required, false);
  });

  test("Rally always requires a test", () => {
    const analysis = morale.analyzeOrderTest({ unit: unit(), order: "Rally" });
    equal(analysis.required, true);
  });

  test("Pins reduce ordinary Order Test target", () => {
    const analysis = morale.analyzeOrderTest({ unit: unit({ pins: 3 }), order: "Advance" });
    equal(analysis.target, 6);
    equal(analysis.pinPenalty, 3);
  });

  test("Rally ignores Pin penalties", () => {
    const analysis = morale.analyzeOrderTest({ unit: unit({ pins: 7 }), order: "Rally" });
    equal(analysis.target, 9);
    equal(analysis.pinPenalty, 0);
    equal(analysis.ignoresPins, true);
  });

  test("Officer exactly six inches away grants support", () => {
    const squad = unit({ id: "squad", x: 0, y: 0 });
    const officer = unit({ id: "officer", role: "officer", x: 6, y: 0 });
    equal(morale.findCommandSupport(squad, [officer]), officer);
    equal(morale.commandBonus(squad, [officer]), 1);
  });

  test("Officer outside six inches grants no support", () => {
    const squad = unit({ id: "squad", x: 0, y: 0 });
    const officer = unit({ id: "officer", role: "officer", x: 6.01, y: 0 });
    equal(morale.findCommandSupport(squad, [officer]), null);
  });

  test("Officer units do not receive officer support", () => {
    const leader = unit({ id: "leader", role: "officer" });
    const other = unit({ id: "other", role: "officer", x: 1 });
    equal(morale.findCommandSupport(leader, [other]), null);
  });

  test("Order Test target clamps to minimum two", () => {
    const analysis = morale.analyzeOrderTest({ unit: unit({ morale: 5, pins: 20 }), order: "Run" });
    equal(analysis.target, 2);
  });

  test("Order Test target clamps to maximum eleven", () => {
    const support = unit({ id: "officer", role: "officer" });
    const analysis = morale.analyzeOrderTest({ unit: unit({ morale: 15, pins: 1 }), order: "Run", support });
    equal(analysis.target, 11);
  });

  test("Roll equal to target passes", () => {
    const actor = unit({ pins: 2, morale: 9 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Run" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Run", rollDice: diceQueue([3, 4]) });
    equal(result.total, 7);
    equal(result.target, 7);
    equal(result.passed, true);
  });

  test("Roll above target fails", () => {
    const actor = unit({ pins: 2, morale: 9 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Run" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Run", rollDice: diceQueue([4, 4]) });
    equal(result.passed, false);
  });

  test("Successful ordinary test removes one Pin", () => {
    const actor = unit({ pins: 3 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Advance" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Advance", rollDice: diceQueue([1, 1]) });
    equal(result.pinsRemovedOnPass, 1);
    equal(result.pinsAfterPass, 2);
  });

  test("Successful Rally describes clearing all Pins", () => {
    const actor = unit({ pins: 5 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Rally" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Rally", rollDice: diceQueue([1, 1]) });
    equal(result.pinsRemovedOnPass, 5);
    equal(result.pinsAfterPass, 0);
  });

  test("Failed test removes no Pins", () => {
    const actor = unit({ pins: 5, morale: 5 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Run" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Run", rollDice: diceQueue([6, 6]) });
    equal(result.pinsRemovedOnPass, 0);
    equal(result.pinsAfterPass, 5);
  });

  test("Failed test reports Down activation state", () => {
    const actor = unit({ pins: 2 });
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Fire" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Fire", rollDice: diceQueue([6, 6]) });
    equal(result.failureState.down, true);
    equal(result.failureState.activated, true);
    equal(result.failureState.order, "Down · Failed");
  });

  test("Incoming Pins below Morale do not route", () => {
    const impact = morale.analyzeIncomingPins(unit({ pins: 4, morale: 9 }), 1);
    equal(impact.pinsAfter, 5);
    equal(impact.routed, false);
  });

  test("Incoming Pins reaching Morale route", () => {
    const impact = morale.analyzeIncomingPins(unit({ pins: 8, morale: 9 }), 1);
    equal(impact.pinsAfter, 9);
    equal(impact.routed, true);
  });

  test("Zero incoming Pins do not trigger routing", () => {
    const impact = morale.analyzeIncomingPins(unit({ pins: 9, morale: 9 }), 0);
    equal(impact.routed, false);
  });

  test("Required Order Test consumes exactly two dice", () => {
    const actor = unit({ pins: 1 });
    const rollDice = diceQueue([2, 3]);
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Run" });
    morale.resolveOrderTest({ analysis, unit: actor, order: "Run", rollDice });
    equal(rollDice.consumed.length, 1);
    equal(rollDice.consumed[0], 2);
    equal(rollDice.remaining(), 0);
  });

  test("No-test order consumes no dice", () => {
    const actor = unit({ pins: 0 });
    const rollDice = diceQueue();
    const analysis = morale.analyzeOrderTest({ unit: actor, order: "Down" });
    const result = morale.resolveOrderTest({ analysis, unit: actor, order: "Down", rollDice });
    equal(result.status, "not-required");
    equal(rollDice.consumed.length, 0);
  });

  const passed = results.filter(result => result.ok).length;
  const failed = results.length - passed;

  if (typeof document !== "undefined") {
    const summary = document.getElementById("summary");
    const report = document.getElementById("report");
    if (summary) {
      summary.className = failed ? "fail" : "ok";
      summary.textContent = `${failed ? "FAIL" : "PASS"} — ${passed}/${results.length} morale-rule tests passed.`;
    }
    if (report) {
      report.textContent = results
        .map(result => `${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.error ? `\n      ${result.error}` : ""}`)
        .join("\n");
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { results, passed, failed };
    if (failed) {
      console.error(results.filter(result => !result.ok));
      process.exitCode = 1;
    } else {
      console.log(`PASS — ${passed}/${results.length} morale-rule tests passed.`);
    }
  }
})();
