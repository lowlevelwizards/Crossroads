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
    assaultDistance: 12,
    reactionFireThreshold: 6
  };
  const features = { ambush: true };
  const terrain = { instances: [] };
  const unitQuality = {
    inexperienced: { assaultDamageTarget: 5 },
    regular: { assaultDamageTarget: 4 },
    veteran: { assaultDamageTarget: 3 }
  };

  function distanceBetweenPoints(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function analyzeMovementPath(attacker) {
    return attacker.blockPath
      ? { legal: false, reason: "blocked path" }
      : { legal: true, reason: "", cost: 1, allowance: 12 };
  }

  function analyzeShot(defender) {
    return {
      inRange: defender.shotInRange !== false,
      blocked: Boolean(defender.shotBlocked)
    };
  }

  function segmentRectClip(a, b, instance) {
    return instance.intersects ? { tEnter: 0.2, tExit: 0.4 } : null;
  }

  function buildingDoorPoint(buildingId) {
    return buildingId === "farm" ? { x: 12, y: 0 } : { x: 0, y: 0 };
  }

  const assault = window.CrossroadsAssaultRules.create({
    rules,
    features,
    terrain,
    unitQuality,
    distanceBetweenPoints,
    distanceBetweenUnits: distanceBetweenPoints,
    analyzeMovementPath,
    analyzeShot,
    segmentRectClip,
    buildingDoorPoint
  });

  function unit(overrides = {}) {
    return {
      id: overrides.id ?? "unit",
      faction: overrides.faction ?? "blue",
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      soldiers: overrides.soldiers ?? 3,
      quality: overrides.quality ?? "regular",
      down: overrides.down ?? false,
      ambush: overrides.ambush ?? false,
      inBuilding: overrides.inBuilding ?? null,
      blockPath: overrides.blockPath ?? false,
      shotInRange: overrides.shotInRange ?? true,
      shotBlocked: overrides.shotBlocked ?? false
    };
  }

  test("Charge exactly at twelve inches is legal", () => {
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 12 }));
    equal(result.legal, true);
    equal(result.distance, 12);
  });

  test("Charge beyond twelve inches is illegal", () => {
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 12.01 }));
    equal(result.legal, false);
    assert(result.reason.includes("exceeds 12"));
  });

  test("Blocked movement path rejects assault", () => {
    const result = assault.analyzeAssault(
      unit({ blockPath: true }),
      unit({ id: "d", x: 5 })
    );
    equal(result.legal, false);
    equal(result.reason, "blocked path");
  });

  test("Clear defender fires reaction beyond six inches", () => {
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 7 }));
    equal(result.reactionFire, true);
    equal(result.ambushReaction, false);
  });

  test("Normal defender does not reaction fire at six inches", () => {
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 6 }));
    equal(result.reactionFire, false);
  });

  test("Ambush enables close reaction fire", () => {
    const result = assault.analyzeAssault(
      unit(),
      unit({ id: "d", x: 4, ambush: true })
    );
    equal(result.ambushReaction, true);
    equal(result.reactionFire, true);
  });

  test("Down defender cannot reaction fire", () => {
    const result = assault.analyzeAssault(
      unit(),
      unit({ id: "d", x: 8, down: true, ambush: true })
    );
    equal(result.reactionFire, false);
  });

  test("Crossing woods gives a Defensive Position", () => {
    terrain.instances = [{ rules: { movement: "rough" }, intersects: true }];
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 5 }));
    equal(result.crossesWoods, true);
    equal(result.defensivePosition, true);
    terrain.instances = [];
  });

  test("Crossing a wall gives a Defensive Position", () => {
    terrain.instances = [{ rules: { movement: "crossing" }, intersects: true }];
    const result = assault.analyzeAssault(unit(), unit({ id: "d", x: 5 }));
    equal(result.crossesWall, true);
    equal(result.defensivePosition, true);
    terrain.instances = [];
  });

  test("Down defender loses terrain Defensive Position", () => {
    terrain.instances = [{ rules: { movement: "rough" }, intersects: true }];
    const result = assault.analyzeAssault(
      unit(),
      unit({ id: "d", x: 5, down: true })
    );
    equal(result.crossesWoods, true);
    equal(result.defensivePosition, false);
    terrain.instances = [];
  });

  test("Building assault targets the doorway", () => {
    const result = assault.analyzeAssault(
      unit({ x: 0 }),
      unit({ id: "d", inBuilding: "farm", x: 50 })
    );
    equal(result.legal, true);
    equal(result.distance, 12);
    equal(result.buildingAssault, true);
    equal(result.buildingId, "farm");
    equal(result.defensivePosition, true);
  });

  test("Attacker inside a building must exit before assaulting", () => {
    const result = assault.analyzeAssault(
      unit({ inBuilding: "shed" }),
      unit({ id: "d", inBuilding: "farm" })
    );
    equal(result.legal, false);
    assert(result.reason.includes("Exit the building"));
  });

  test("Building defender has reaction fire whenever clear", () => {
    const result = assault.analyzeAssault(
      unit({ x: 10 }),
      unit({ id: "d", inBuilding: "farm" })
    );
    equal(result.distance, 2);
    equal(result.reactionFire, true);
  });

  test("Defensive Position lets defender strike first", () => {
    const attacker = unit({ soldiers: 3 });
    const defender = unit({ id: "d", soldiers: 2 });
    const rolls = diceQueue([4, 1], [6, 6]);
    const result = assault.resolveCloseCombat({
      attacker,
      defender,
      defensivePosition: true,
      rollDice: rolls
    });
    equal(result.rounds[0].mode, "defender-first");
    equal(result.rounds[0].defenderKills, 1);
    equal(result.rounds[0].attackerRolls.length, 2);
    equal(rolls.consumed[0], 2);
    equal(rolls.consumed[1], 2);
  });

  test("Defender-first wipe prevents attacker dice", () => {
    const rolls = diceQueue([6, 6]);
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 2 }),
      defender: unit({ id: "d", soldiers: 2 }),
      defensivePosition: true,
      rollDice: rolls
    });
    equal(result.winner, "defender");
    equal(result.rounds[0].attackerRolls.length, 0);
    equal(rolls.consumed.length, 1);
  });

  test("Open combat rolls attacker before defender", () => {
    const rolls = diceQueue([6, 1, 1], [1, 1, 1]);
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 3 }),
      defender: unit({ id: "d", soldiers: 3 }),
      rollDice: rolls
    });
    equal(result.winner, "attacker");
    equal(result.rounds[0].attackerKills, 1);
    equal(result.rounds[0].defenderKills, 0);
    equal(rolls.consumed[0], 3);
    equal(rolls.consumed[1], 3);
  });

  test("Simultaneous attacks can mutually destroy both units", () => {
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 1 }),
      defender: unit({ id: "d", soldiers: 1 }),
      rollDice: diceQueue([6], [6])
    });
    equal(result.winner, "mutual");
    equal(result.finalAttackerSoldiers, 0);
    equal(result.finalDefenderSoldiers, 0);
  });

  test("Unit quality supplies separate assault targets", () => {
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 1, quality: "veteran" }),
      defender: unit({ id: "d", soldiers: 1, quality: "inexperienced" }),
      rollDice: diceQueue([3], [4])
    });
    equal(result.attackerTarget, 3);
    equal(result.defenderTarget, 5);
    equal(result.winner, "attacker");
  });

  test("Tied round starts another combat round", () => {
    const rolls = diceQueue([1], [1], [6], [1]);
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 1 }),
      defender: unit({ id: "d", soldiers: 1 }),
      rollDice: rolls
    });
    equal(result.combatRounds, 2);
    equal(result.rounds[0].winnerAfterRound, null);
    equal(result.winner, "attacker");
  });

  test("Winner cleanup removes all surviving losers", () => {
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 3 }),
      defender: unit({ id: "d", soldiers: 3 }),
      rollDice: diceQueue([6, 6, 1], [6, 1, 1])
    });
    equal(result.winner, "attacker");
    equal(result.defenderSurvivorsBeforeCleanup, 1);
    equal(result.defenderRemovedAfterCombat, 1);
    equal(result.finalDefenderSoldiers, 0);
  });

  test("Thirty tied rounds use the existing survivor fallback", () => {
    const batches = [];
    for (let i = 0; i < 30; i++) batches.push([1], [1]);
    const result = assault.resolveCloseCombat({
      attacker: unit({ soldiers: 1 }),
      defender: unit({ id: "d", soldiers: 1 }),
      rollDice: diceQueue(...batches)
    });
    equal(result.maxRoundsReached, true);
    equal(result.winner, "attacker");
    equal(result.combatRounds, 30);
  });

  test("Pure assault resolution does not mutate either unit", () => {
    const attacker = unit({ soldiers: 2, quality: "veteran" });
    const defender = unit({ id: "d", soldiers: 2 });
    const beforeAttacker = JSON.stringify(attacker);
    const beforeDefender = JSON.stringify(defender);
    assault.resolveCloseCombat({
      attacker,
      defender,
      rollDice: diceQueue([6, 1], [1, 1])
    });
    equal(JSON.stringify(attacker), beforeAttacker);
    equal(JSON.stringify(defender), beforeDefender);
  });

  const passed = results.filter(result => result.ok).length;
  const failed = results.length - passed;

  if (typeof document !== "undefined") {
    const summary = document.getElementById("summary");
    const report = document.getElementById("report");
    if (summary) {
      summary.className = failed ? "fail" : "ok";
      summary.textContent = `${failed ? "FAIL" : "PASS"} — ${passed}/${results.length} assault-rule tests passed.`;
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
      console.log(`PASS — ${passed}/${results.length} assault-rule tests passed.`);
    }
  }
})();
