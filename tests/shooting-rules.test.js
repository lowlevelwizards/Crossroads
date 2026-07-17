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

  function near(actual, expected, epsilon = 0.001, message = "Values differ") {
    if (Math.abs(actual - expected) > epsilon) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  function distanceBetweenPoints(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function segmentRectClip(start, end, rect) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let tEnter = 0;
    let tExit = 1;

    for (const [p, q] of [
      [-dx, start.x - rect.x],
      [dx, rect.x + rect.width - start.x],
      [-dy, start.y - rect.y],
      [dy, rect.y + rect.height - start.y]
    ]) {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return null;
        continue;
      }
      const r = q / p;
      if (p < 0) tEnter = Math.max(tEnter, r);
      else tExit = Math.min(tExit, r);
      if (tEnter > tExit) return null;
    }

    return {
      tEnter,
      tExit,
      enter: { x: start.x + dx * tEnter, y: start.y + dy * tEnter },
      exit: { x: start.x + dx * tExit, y: start.y + dy * tExit }
    };
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

  const WEAPONS = window.CROSSROADS_WEAPON_PROFILES ?? Object.freeze({
    rifle: Object.freeze({ key: "rifle", label: "Rifle", short: "R", range: 24, shots: 1, assault: false, fixed: false }),
    smg: Object.freeze({ key: "smg", label: "SMG", short: "S", range: 12, shots: 2, assault: true, fixed: false }),
    lmg: Object.freeze({ key: "lmg", label: "LMG", short: "L", range: 36, shots: 4, assault: false, fixed: false }),
    pistol: Object.freeze({ key: "pistol", label: "Pistol", short: "P", range: 6, shots: 1, assault: true, fixed: false }),
    mmg: Object.freeze({ key: "mmg", label: "MMG", short: "MMG", range: 36, shots: 5, reducedShots: 2, crewRequired: 2, crewWeapon: true, assault: false, fixed: true })
  });

  const QUALITY = window.CROSSROADS_UNIT_QUALITY ?? Object.freeze({
    inexperienced: Object.freeze({ morale: 8, shootingTargetModifier: 1 }),
    regular: Object.freeze({ morale: 9, shootingTargetModifier: 0 }),
    veteran: Object.freeze({ morale: 10, shootingTargetModifier: -1 })
  });

  const rules = {
    baseHitTarget: 4,
    regularDamageTarget: 4,
    wallProtectionDepth: 4
  };

  const mmgRules = {
    arcDegrees: 90,
    fullCrew: 3,
    reducedCrew: 2
  };

  const terrain = { instances: [] };
  const terrainById = new Map();

  function makeRules() {
    return window.CrossroadsShootingRules.create({
      rules,
      weaponProfiles: WEAPONS,
      unitQuality: QUALITY,
      terrain,
      mmgRules,
      distanceBetweenPoints,
      segmentRectClip,
      resolveShooterPoint: shooter => shooter,
      resolveTargetPoint: target => ({
        unit: target?.id ? target : null,
        buildingId: target?.inBuilding ?? null,
        point: target?.inBuilding
          ? terrainById.get(target.inBuilding)?.center ?? target
          : target
      }),
      getTerrainInstance: id => terrainById.get(id) ?? null
    });
  }

  function unit(overrides = {}) {
    return {
      id: overrides.id ?? "unit",
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      soldiers: overrides.soldiers ?? 6,
      weapons: overrides.weapons ?? { rifle: 1 },
      pins: overrides.pins ?? 0,
      morale: overrides.morale ?? 9,
      quality: overrides.quality ?? "regular",
      down: overrides.down ?? false,
      mmgDeployed: overrides.mmgDeployed ?? false,
      mmgFacing: overrides.mmgFacing ?? 0,
      inBuilding: overrides.inBuilding ?? null
    };
  }

  let shooting = makeRules();

  test("Rifle range includes exactly 24 inches", () => {
    const shooter = unit({ weapons: { rifle: 1 } });
    const trace = shooting.analyzeShot(shooter, { x: 24, y: 0 });
    equal(trace.inRange, true);
    near(trace.range, 24);
  });

  test("Rifle range excludes beyond 24 inches", () => {
    const shooter = unit({ weapons: { rifle: 1 } });
    equal(shooting.analyzeShot(shooter, { x: 24.01, y: 0 }).inRange, false);
  });

  test("Weapon ranges remain 6, 12, 24, and 36", () => {
    equal(shooting.weaponRange(unit({ weapons: { pistol: 1 } })), 6);
    equal(shooting.weaponRange(unit({ weapons: { smg: 1 } })), 12);
    equal(shooting.weaponRange(unit({ weapons: { rifle: 1 } })), 24);
    equal(shooting.weaponRange(unit({ weapons: { lmg: 1 } })), 36);
  });

  test("Moving rifle receives +1 hit penalty", () => {
    const shooter = unit({ weapons: { rifle: 1 } });
    const group = shooting.availableFireGroups(shooter, 12, true, true)[0];
    equal(shooting.calculateGroupHitTarget(shooter, group, true).hitTarget, 5);
  });

  test("Moving SMG receives no movement penalty", () => {
    const shooter = unit({ weapons: { smg: 1 } });
    const group = shooting.availableFireGroups(shooter, 12, true, true)[0];
    equal(shooting.calculateGroupHitTarget(shooter, group, true).hitTarget, 4);
  });

  test("Mixed rifle and SMG fire uses separate hit targets", () => {
    const shooter = unit({ weapons: { rifle: 1, smg: 1 } });
    const trace = { distance: 10, cover: { saveTarget: null } };
    const rollDice = diceQueue([5], [4, 4], [4, 4, 4]);
    const result = shooting.resolveAttack({ shooter, target: unit({ id: "target" }), trace, movingPenalty: true, rollDice });
    equal(result.groups.find(group => group.key === "rifle").hitTarget, 5);
    equal(result.groups.find(group => group.key === "smg").hitTarget, 4);
  });

  test("Quality modifiers remain +1, 0, and -1", () => {
    for (const [quality, expected] of [["inexperienced", 5], ["regular", 4], ["veteran", 3]]) {
      const shooter = unit({ quality, weapons: { rifle: 1 } });
      const group = shooting.availableFireGroups(shooter, 12, false, true)[0];
      equal(shooting.calculateGroupHitTarget(shooter, group, false).hitTarget, expected);
    }
  });

  test("Pinned shooter receives one hit penalty", () => {
    const shooter = unit({ pins: 3, weapons: { rifle: 1 } });
    const group = shooting.availableFireGroups(shooter, 12, false, true)[0];
    equal(shooting.calculateGroupHitTarget(shooter, group, false).hitTarget, 5);
  });

  test("Hit targets clamp at 2 and 7", () => {
    const veteran = unit({ quality: "veteran", weapons: { rifle: 1 } });
    const group = shooting.availableFireGroups(veteran, 12, false, true)[0];
    const originalBase = rules.baseHitTarget;
    rules.baseHitTarget = 1;
    shooting = makeRules();
    equal(shooting.calculateGroupHitTarget(veteran, group, false).hitTarget, 2);
    rules.baseHitTarget = 7;
    shooting = makeRules();
    equal(shooting.calculateGroupHitTarget(unit({ quality: "inexperienced", pins: 1 }), group, true).hitTarget, 7);
    rules.baseHitTarget = originalBase;
    shooting = makeRules();
  });

  test("Packed MMG cannot fire", () => {
    const mmg = unit({ soldiers: 3, weapons: { mmg: 1 }, mmgDeployed: false });
    equal(shooting.availableFireGroups(mmg, 12, false, true).length, 0);
  });

  test("Full MMG crew fires five shots", () => {
    const mmg = unit({ soldiers: 3, weapons: { mmg: 1 }, mmgDeployed: true });
    equal(shooting.availableFireGroups(mmg, 12, false, true)[0].shots, 5);
  });

  test("Reduced MMG crew fires two shots", () => {
    const mmg = unit({ soldiers: 2, weapons: { mmg: 1 }, mmgDeployed: true });
    equal(shooting.availableFireGroups(mmg, 12, false, true)[0].shots, 2);
  });

  test("One-man MMG cannot fire", () => {
    const mmg = unit({ soldiers: 1, weapons: { mmg: 1 }, mmgDeployed: true });
    equal(shooting.availableFireGroups(mmg, 12, false, true).length, 0);
  });

  test("MMG arc includes exactly plus 45 degrees", () => {
    const mmg = unit({ soldiers: 3, weapons: { mmg: 1 }, mmgDeployed: true, mmgFacing: 0 });
    equal(shooting.targetInsideMMGArc(mmg, { x: 10, y: 10 }), true);
  });

  test("MMG arc blocks outside 45 degrees", () => {
    const mmg = unit({ soldiers: 3, weapons: { mmg: 1 }, mmgDeployed: true, mmgFacing: 0 });
    equal(shooting.targetInsideMMGArc(mmg, { x: 1, y: 10 }), false);
  });

  test("Intervening building blocks line of sight", () => {
    terrain.instances = [{ id: "blocker", x: 5, y: -2, width: 4, height: 4, rules: { los: "blocking" }, definition: { label: "cottage" } }];
    shooting = makeRules();
    const trace = shooting.analyzeShot(unit({ weapons: { rifle: 1 } }), { x: 15, y: 0 });
    equal(trace.blocked, true);
    assert(trace.blockReason.includes("cottage"));
  });

  test("Shooter and target buildings are excluded as blockers", () => {
    const shooterBuilding = { id: "house-a", x: -2, y: -2, width: 4, height: 4, rules: { los: "blocking", save: 3 }, definition: { label: "house" }, center: { x: 0, y: 0 } };
    const targetBuilding = { id: "house-b", x: 13, y: -2, width: 4, height: 4, rules: { los: "blocking", save: 3 }, definition: { label: "house" }, center: { x: 15, y: 0 } };
    terrain.instances = [shooterBuilding, targetBuilding];
    terrainById.set("house-a", shooterBuilding);
    terrainById.set("house-b", targetBuilding);
    shooting = makeRules();
    const trace = shooting.analyzeShot(
      unit({ inBuilding: "house-a", weapons: { rifle: 1 } }),
      unit({ id: "target", x: 15, inBuilding: "house-b" })
    );
    equal(trace.blocked, false);
    equal(trace.cover.saveTarget, 3);
  });

  test("Woods provide their soft-cover save", () => {
    terrain.instances = [{ id: "woods", x: 5, y: -2, width: 4, height: 4, rules: { cover: "soft", save: 5 }, definition: { label: "woods" } }];
    shooting = makeRules();
    equal(shooting.analyzeShot(unit(), { x: 15, y: 0 }).cover.saveTarget, 5);
  });

  test("Wall protects target within four inches", () => {
    terrain.instances = [{ id: "wall", x: 10, y: -1, width: 1, height: 2, rules: { movement: "crossing", save: 4 }, definition: { label: "stone wall" } }];
    shooting = makeRules();
    equal(shooting.analyzeShot(unit(), { x: 13, y: 0 }).cover.saveTarget, 4);
  });

  test("Wall outside protection depth gives no save", () => {
    terrain.instances = [{ id: "wall", x: 5, y: -1, width: 1, height: 2, rules: { movement: "crossing", save: 4 }, definition: { label: "stone wall" } }];
    shooting = makeRules();
    equal(shooting.analyzeShot(unit(), { x: 13, y: 0 }).cover.saveTarget, null);
  });

  test("Down in open grants a 5+ save", () => {
    terrain.instances = [];
    shooting = makeRules();
    equal(shooting.analyzeShot(unit(), { x: 12, y: 0, down: true }).cover.saveTarget, 5);
  });

  test("Down improves hard cover by two to a minimum of 2+", () => {
    terrain.instances = [{ id: "wall", x: 10, y: -1, width: 1, height: 2, rules: { movement: "crossing", save: 4 }, definition: { label: "wall" } }];
    shooting = makeRules();
    equal(shooting.analyzeShot(unit(), { x: 13, y: 0, down: true }).cover.saveTarget, 2);
  });

  test("Any hit inflicts exactly one Pin", () => {
    terrain.instances = [];
    shooting = makeRules();
    const result = shooting.resolveAttack({
      shooter: unit({ weapons: { rifle: 3 } }),
      target: unit({ id: "target", pins: 2 }),
      trace: { distance: 12, cover: { saveTarget: null } },
      rollDice: diceQueue([4, 5, 6], [1, 1, 1])
    });
    equal(result.totalHits, 3);
    equal(result.pinDelta, 1);
    equal(result.pinsAfter, 3);
  });

  test("Saving every casualty does not remove the Pin", () => {
    const result = shooting.resolveAttack({
      shooter: unit({ weapons: { rifle: 1 } }),
      target: unit({ id: "target", pins: 0 }),
      trace: { distance: 12, cover: { saveTarget: 4 } },
      rollDice: diceQueue([6], [6], [6])
    });
    equal(result.pinDelta, 1);
    equal(result.casualties, 0);
    equal(result.saved, 1);
  });

  test("Pin threshold routes before damage dice", () => {
    const rollDice = diceQueue([6]);
    const result = shooting.resolveAttack({
      shooter: unit({ weapons: { rifle: 1 } }),
      target: unit({ id: "target", pins: 8, morale: 9, soldiers: 4 }),
      trace: { distance: 12, cover: { saveTarget: 3 } },
      rollDice
    });
    equal(result.routedByPins, true);
    equal(result.casualties, 4);
    equal(rollDice.remaining(), 0);
    equal(rollDice.consumed.length, 1);
  });

  test("Casualties are capped by remaining soldiers", () => {
    const result = shooting.resolveAttack({
      shooter: unit({ weapons: { rifle: 4 } }),
      target: unit({ id: "target", soldiers: 2 }),
      trace: { distance: 12, cover: { saveTarget: null } },
      rollDice: diceQueue([6, 6, 6, 6], [6, 6, 6, 6])
    });
    equal(result.requestedCasualties, 4);
    equal(result.casualties, 2);
    equal(result.destroyed, true);
  });

  test("No fire groups consume no dice", () => {
    const rollDice = diceQueue();
    const result = shooting.resolveAttack({
      shooter: unit({ soldiers: 1, weapons: { mmg: 1 }, mmgDeployed: true }),
      target: unit({ id: "target" }),
      trace: { distance: 12, cover: { saveTarget: null } },
      rollDice
    });
    equal(result.status, "no-weapons");
    equal(rollDice.consumed.length, 0);
  });

  const passed = results.filter(result => result.ok).length;
  const failed = results.length - passed;

  if (typeof document !== "undefined") {
    const summary = document.getElementById("summary");
    const report = document.getElementById("report");
    if (summary) {
      summary.className = failed ? "fail" : "ok";
      summary.textContent = `${failed ? "FAIL" : "PASS"} — ${passed}/${results.length} shooting-rule tests passed.`;
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
      console.log(`PASS — ${passed}/${results.length} shooting-rule tests passed.`);
    }
  }
})();
