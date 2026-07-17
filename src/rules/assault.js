"use strict";

(() => {
  // Foundation 4B.2: pure assault legality and close-combat resolution.
  //
  // This module describes legal charges, reaction-fire eligibility, defensive
  // positions, dice, casualties, and the winner. It never renders, logs,
  // mutates units, moves models, changes building occupancy, or advances turns.

  function create({
    rules,
    features,
    terrain,
    unitQuality,
    distanceBetweenPoints,
    distanceBetweenUnits,
    analyzeMovementPath,
    analyzeShot,
    segmentRectClip,
    buildingDoorPoint
  }) {
    const requiredFunctions = {
      distanceBetweenPoints,
      distanceBetweenUnits,
      analyzeMovementPath,
      analyzeShot,
      segmentRectClip,
      buildingDoorPoint
    };

    if (!rules || !features || !terrain || !unitQuality) {
      throw new Error("Crossroads assault rules require rules, features, terrain, and quality data.");
    }
    for (const [name, value] of Object.entries(requiredFunctions)) {
      if (typeof value !== "function") {
        throw new Error(`Crossroads assault rules require ${name}().`);
      }
    }

    function qualityProfile(unitOrQuality) {
      const qualityId =
        typeof unitOrQuality === "string"
          ? unitOrQuality
          : unitOrQuality?.quality;
      return unitQuality[qualityId] ?? unitQuality.regular;
    }

    function normalizedSoldiers(unit) {
      return Math.max(0, Math.floor(Number(unit?.soldiers) || 0));
    }

    function frozenDice(values) {
      return Object.freeze([...values]);
    }

    function analyzeAssault(attacker, defender) {
      if (!attacker || !defender) {
        return Object.freeze({
          legal: false,
          reason: "Assault analysis requires an attacker and defender.",
          distance: 0
        });
      }

      if (defender.inBuilding) {
        const assaultedBuildingId = defender.inBuilding;
        const door = buildingDoorPoint(assaultedBuildingId);
        const distance = distanceBetweenPoints(attacker, door);

        if (attacker.inBuilding) {
          return Object.freeze({
            legal: false,
            reason: "Exit the building before assaulting.",
            distance
          });
        }

        if (distance > rules.assaultDistance + 0.001) {
          return Object.freeze({
            legal: false,
            reason:
              `Doorway is ${distance.toFixed(1)}″ away; ` +
              `assault range is ${rules.assaultDistance}″.`,
            distance
          });
        }

        const pathAnalysis = analyzeMovementPath(
          attacker,
          [attacker, door],
          "Run",
          defender.id
        );
        if (!pathAnalysis.legal) {
          return Object.freeze({
            legal: false,
            reason: pathAnalysis.reason,
            distance
          });
        }

        const shotTrace = analyzeShot(defender, attacker);
        const reactionFire =
          !defender.down && shotTrace.inRange && !shotTrace.blocked;

        return Object.freeze({
          legal: true,
          reason: "",
          distance,
          pathAnalysis,
          reactionFire,
          ambushReaction: Boolean(defender.ambush),
          defensivePosition: true,
          buildingAssault: true,
          buildingId: assaultedBuildingId,
          crossesWoods: false,
          crossesWall: false,
          shotTrace
        });
      }

      const distance = distanceBetweenUnits(attacker, defender);
      if (distance > rules.assaultDistance + 0.001) {
        return Object.freeze({
          legal: false,
          reason:
            `Out of assault range: ${distance.toFixed(1)}″ exceeds ` +
            `${rules.assaultDistance}″.`,
          distance
        });
      }

      const pathAnalysis = analyzeMovementPath(
        attacker,
        [attacker, defender],
        "Run",
        defender.id
      );
      if (!pathAnalysis.legal) {
        return Object.freeze({
          legal: false,
          reason: pathAnalysis.reason,
          distance
        });
      }

      const shotTrace = analyzeShot(defender, attacker);
      const ambushReaction = Boolean(
        features.ambush &&
        defender.ambush &&
        shotTrace.inRange &&
        !shotTrace.blocked
      );
      const reactionFire = Boolean(
        !defender.down &&
        shotTrace.inRange &&
        !shotTrace.blocked &&
        (ambushReaction || distance > rules.reactionFireThreshold)
      );

      const terrainInstances = Array.isArray(terrain.instances)
        ? terrain.instances
        : [];
      const crossesWoods = terrainInstances.some(instance =>
        instance.rules?.movement === "rough" &&
        segmentRectClip(attacker, defender, instance) !== null
      );
      const crossesWall = terrainInstances.some(instance =>
        instance.rules?.movement === "crossing" &&
        segmentRectClip(attacker, defender, instance) !== null
      );
      const defensivePosition = Boolean(
        !defender.down && (crossesWoods || crossesWall)
      );

      return Object.freeze({
        legal: true,
        reason: "",
        distance,
        pathAnalysis,
        reactionFire,
        ambushReaction,
        defensivePosition,
        crossesWoods,
        crossesWall,
        buildingAssault: false,
        buildingId: null,
        shotTrace
      });
    }

    function resolveCloseCombat({
      attacker,
      defender,
      defensivePosition = false,
      rollDice,
      maxRounds = 30
    }) {
      if (!attacker || !defender) {
        throw new Error("Close-combat resolution requires an attacker and defender.");
      }
      if (typeof rollDice !== "function") {
        throw new Error("Close-combat resolution requires an injected rollDice function.");
      }

      const attackerTarget = qualityProfile(attacker).assaultDamageTarget;
      const defenderTarget = qualityProfile(defender).assaultDamageTarget;
      const attackerStarted = normalizedSoldiers(attacker);
      const defenderStarted = normalizedSoldiers(defender);
      let attackerSoldiers = attackerStarted;
      let defenderSoldiers = defenderStarted;
      let combatRound = 1;
      let winner = null;
      const rounds = [];

      while (
        !winner &&
        combatRound <= maxRounds &&
        attackerSoldiers > 0 &&
        defenderSoldiers > 0
      ) {
        const attackerBefore = attackerSoldiers;
        const defenderBefore = defenderSoldiers;
        let attackerRolls = [];
        let defenderRolls = [];
        let attackerKills = 0;
        let defenderKills = 0;
        const defenderFirst = defensivePosition && combatRound === 1;

        if (defenderFirst) {
          defenderRolls = frozenDice(rollDice(defenderSoldiers));
          defenderKills = Math.min(
            attackerSoldiers,
            defenderRolls.filter(value => value >= defenderTarget).length
          );
          attackerSoldiers -= defenderKills;

          if (attackerSoldiers > 0) {
            attackerRolls = frozenDice(rollDice(attackerSoldiers));
            attackerKills = Math.min(
              defenderSoldiers,
              attackerRolls.filter(value => value >= attackerTarget).length
            );
            defenderSoldiers -= attackerKills;
          } else {
            attackerRolls = Object.freeze([]);
          }
        } else {
          attackerRolls = frozenDice(rollDice(attackerSoldiers));
          defenderRolls = frozenDice(rollDice(defenderSoldiers));
          attackerKills = Math.min(
            defenderSoldiers,
            attackerRolls.filter(value => value >= attackerTarget).length
          );
          defenderKills = Math.min(
            attackerSoldiers,
            defenderRolls.filter(value => value >= defenderTarget).length
          );
          attackerSoldiers -= defenderKills;
          defenderSoldiers -= attackerKills;
        }

        if (attackerSoldiers === 0 && defenderSoldiers === 0) {
          winner = "mutual";
        } else if (attackerKills > defenderKills || defenderSoldiers === 0) {
          winner = "attacker";
        } else if (defenderKills > attackerKills || attackerSoldiers === 0) {
          winner = "defender";
        }

        rounds.push(Object.freeze({
          number: combatRound,
          mode: defenderFirst ? "defender-first" : "simultaneous",
          defensivePosition: defenderFirst,
          attackerBefore,
          defenderBefore,
          attackerTarget,
          defenderTarget,
          attackerRolls,
          defenderRolls,
          attackerKills,
          defenderKills,
          attackerAfter: attackerSoldiers,
          defenderAfter: defenderSoldiers,
          winnerAfterRound: winner
        }));

        if (!winner) combatRound += 1;
      }

      const maxRoundsReached = !winner;
      if (!winner) {
        winner = attackerSoldiers >= defenderSoldiers
          ? "attacker"
          : "defender";
      }

      const attackerRemovedAfterCombat =
        winner === "defender" || winner === "mutual"
          ? attackerSoldiers
          : 0;
      const defenderRemovedAfterCombat =
        winner === "attacker" || winner === "mutual"
          ? defenderSoldiers
          : 0;

      const finalAttackerSoldiers =
        winner === "defender" || winner === "mutual"
          ? 0
          : attackerSoldiers;
      const finalDefenderSoldiers =
        winner === "attacker" || winner === "mutual"
          ? 0
          : defenderSoldiers;

      return Object.freeze({
        winner,
        defensivePosition: Boolean(defensivePosition),
        maxRounds,
        maxRoundsReached,
        attackerTarget,
        defenderTarget,
        attackerStarted,
        defenderStarted,
        rounds: Object.freeze(rounds),
        combatRounds: rounds.length,
        attackerCasualtiesDuringRounds: attackerStarted - attackerSoldiers,
        defenderCasualtiesDuringRounds: defenderStarted - defenderSoldiers,
        attackerSurvivorsBeforeCleanup: attackerSoldiers,
        defenderSurvivorsBeforeCleanup: defenderSoldiers,
        attackerRemovedAfterCombat,
        defenderRemovedAfterCombat,
        finalAttackerSoldiers,
        finalDefenderSoldiers
      });
    }

    return Object.freeze({
      analyzeAssault,
      resolveCloseCombat
    });
  }

  window.CrossroadsAssaultRules = Object.freeze({ create });
})();
