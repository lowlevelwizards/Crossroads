"use strict";

(() => {
  const moraleModule = window.CrossroadsMoraleRules;
  const shootingModule = window.CrossroadsShootingRules;
  const assaultModule = window.CrossroadsAssaultRules;

  if (!moraleModule?.create || !shootingModule?.create || !assaultModule?.create) {
    throw new Error("Combat runtime loaded before its pure rules modules.");
  }

  function requireFunction(dependencies, name) {
    const value = dependencies[name];
    if (typeof value !== "function") {
      throw new Error(`Combat runtime requires ${name}().`);
    }
    return value;
  }

  function create(dependencies) {
    if (!dependencies?.rules) throw new Error("Combat runtime requires rules.");
    if (!dependencies?.weaponProfiles) throw new Error("Combat runtime requires weaponProfiles.");
    if (!dependencies?.unitQuality) throw new Error("Combat runtime requires unitQuality.");
    if (!dependencies?.terrain) throw new Error("Combat runtime requires terrain.");
    if (!dependencies?.mmgRules) throw new Error("Combat runtime requires mmgRules.");

    const rules = dependencies.rules;
    const features = dependencies.features ?? {};
    const weaponProfiles = dependencies.weaponProfiles;
    const unitQuality = dependencies.unitQuality;
    const terrain = dependencies.terrain;
    const mmgRules = dependencies.mmgRules;

    const distanceBetweenPoints = requireFunction(dependencies, "distanceBetweenPoints");
    const distanceBetweenUnits = requireFunction(dependencies, "distanceBetweenUnits");
    const segmentRectClip = requireFunction(dependencies, "segmentRectClip");
    const segmentTerrainClip = requireFunction(dependencies, "segmentTerrainClip");
    const analyzeMovementPath = requireFunction(dependencies, "analyzeMovementPath");
    const getTerrainInstance = requireFunction(dependencies, "getTerrainInstance");
    const getLivingUnits = requireFunction(dependencies, "getLivingUnits");
    const getBattleStats = requireFunction(dependencies, "getBattleStats");
    const resolveShooterPoint = requireFunction(dependencies, "resolveShooterPoint");
    const resolveTargetPoint = requireFunction(dependencies, "resolveTargetPoint");
    const buildingDoorPoint = requireFunction(dependencies, "buildingDoorPoint");
    const buildingLabel = requireFunction(dependencies, "buildingLabel");
    const occupyBuilding = requireFunction(dependencies, "occupyBuilding");

    const lockActivationTransaction = requireFunction(dependencies, "lockActivationTransaction");
    const recordOrderTest = requireFunction(dependencies, "recordOrderTest");
    const addLog = requireFunction(dependencies, "addLog");
    const capitalize = requireFunction(dependencies, "capitalize");
    const finishActivationState = requireFunction(dependencies, "finishActivationState");
    const recordCasualties = requireFunction(dependencies, "recordCasualties");
    const recordUnitDestroyed = requireFunction(dependencies, "recordUnitDestroyed");
    const destroyUnit = requireFunction(dependencies, "destroyUnit");
    const applyCasualties = requireFunction(dependencies, "applyCasualties");
    const fullLoadout = requireFunction(dependencies, "fullLoadout");
    const renderUnits = requireFunction(dependencies, "renderUnits");
    const qualityLabel = requireFunction(dependencies, "qualityLabel");
    const qualityProfile = requireFunction(dependencies, "qualityProfile");
    const findSafeAssaultPosition = requireFunction(dependencies, "findSafeAssaultPosition");
    const showBattleAnnouncement = requireFunction(dependencies, "showBattleAnnouncement");
    const completeActivation = requireFunction(dependencies, "completeActivation");
    const checkElimination = requireFunction(dependencies, "checkElimination");
    const clearActivationSelection = requireFunction(dependencies, "clearActivationSelection");
    const rollDice = requireFunction(dependencies, "rollDice");

    const moraleRules = moraleModule.create({
      rules,
      distanceBetweenUnits
    });

    const shootingRules = shootingModule.create({
      rules,
      weaponProfiles,
      unitQuality,
      terrain,
      mmgRules,
      distanceBetweenPoints,
      segmentRectClip,
      segmentTerrainClip,
      resolveShooterPoint,
      resolveTargetPoint,
      getTerrainInstance,
      analyzeIncomingPins: moraleRules.analyzeIncomingPins
    });

    const assaultRules = assaultModule.create({
      rules,
      features,
      terrain,
      unitQuality,
      distanceBetweenPoints,
      distanceBetweenUnits,
      analyzeMovementPath,
      analyzeShot: shootingRules.analyzeShot,
      segmentRectClip,
      segmentTerrainClip,
      buildingDoorPoint
    });

    function commandSupport(unit) {
      return moraleRules.findCommandSupport(unit, getLivingUnits());
    }

    function commandBonus(unit) {
      return moraleRules.commandBonus(unit, getLivingUnits());
    }

    function attemptOrder(unit, order) {
      const support = commandSupport(unit);
      const analysis = moraleRules.analyzeOrderTest({ unit, order, support });

      if (!analysis.required) {
        addLog(
          `${capitalize(unit.faction)} ${unit.name}: ${order} requires no Order Test.`
        );
        return true;
      }

      const result = moraleRules.resolveOrderTest({
        analysis,
        unit,
        order,
        rollDice
      });

      lockActivationTransaction("dice rolled for the Order Test");
      recordOrderTest(unit, result.passed);

      addLog(
        `${capitalize(unit.faction)} ${unit.name} (${qualityLabel(unit)}) ` +
        `Order Test for ${order}: ${result.dice[0]} + ${result.dice[1]} = ` +
        `${result.total}, needs ${result.target} or less` +
        `${support ? ` (Officer +${analysis.officerBonus})` : ""}` +
        `${analysis.ignoresPins ? " (Rally ignores Pins)" : ""}.`,
        result.passed ? "morale" : "fail"
      );

      if (!result.passed) {
        unit.down = result.failureState.down;
        unit.order = result.failureState.order;
        unit.activated = result.failureState.activated;
        addLog(
          `${capitalize(unit.faction)} ${unit.name} fails and goes Down.`,
          "fail"
        );
        finishActivationState();
        return false;
      }

      if (!analysis.ignoresPins && result.pinsRemovedOnPass > 0) {
        unit.pins = result.pinsAfterPass;
        addLog(
          `${unit.name} passes and removes 1 Pin; ${unit.pins} remain.`,
          "morale"
        );
      }

      return true;
    }

    function resolveShootingCore(shooter, target, trace, options = {}) {
      const label = options.label ?? "Shooting";
      lockActivationTransaction(`${label} dice rolled`);

      const result = shootingRules.resolveAttack({
        shooter,
        target,
        trace,
        movingPenalty: Boolean(options.movingPenalty),
        rollDice
      });

      if (result.status === "no-weapons") {
        addLog(
          `${capitalize(shooter.faction)} ${shooter.name} has no weapon able ` +
          `to fire at ${trace.distance.toFixed(1)}″` +
          `${options.movingPenalty ? " after moving" : ""}.`,
          "fail"
        );
        return { destroyed: false, hits: 0, casualties: 0, shots: 0 };
      }

      const battleStats = getBattleStats();
      const shooterStats = battleStats?.[shooter.faction];
      addLog(
        `${capitalize(shooter.faction)} ${shooter.name} uses ${label} ` +
        `at ${target.name} from ${trace.distance.toFixed(1)}″.`,
        label.includes("Ambush") ? "ambush" : "hit"
      );

      for (const group of result.groups) {
        const modifierLabels = group.modifiers.map(modifier => modifier.label);
        addLog(
          `${group.profile.label}: ${group.shots} ` +
          `shot${group.shots === 1 ? "" : "s"}, hits on ` +
          `${group.hitTarget > 6 ? "—" : `${group.hitTarget}+`}` +
          `${modifierLabels.length ? ` (${modifierLabels.join(", ")})` : ""}. ` +
          `Rolls: ${group.rolls.join(", ")} → ${group.hits} ` +
          `hit${group.hits === 1 ? "" : "s"}.`,
          group.hits > 0 ? "hit" : ""
        );
      }

      if (shooterStats) {
        shooterStats.shotsFired += result.totalShots;
        shooterStats.hitsScored += result.totalHits;
      }

      if (result.totalHits > 0) {
        if (shooterStats) shooterStats.pinsInflicted += 1;
        target.pins = result.pinsAfter;
        addLog(
          `${target.name} gains 1 Pin and now has ${target.pins}.`,
          "pin"
        );

        if (result.routedByPins) {
          const removed = target.soldiers;
          recordCasualties(shooter.faction, target.faction, removed);
          recordUnitDestroyed(
            target,
            shooter.faction,
            "Routed after reaching its Morale in Pins"
          );
          destroyUnit(target);
          addLog(
            `${capitalize(target.faction)} ${target.name} reaches its ` +
            "Morale in Pins and routes.",
            "kill"
          );
          return {
            destroyed: true,
            hits: result.totalHits,
            casualties: removed,
            shots: result.totalShots
          };
        }
      }

      if (result.totalHits > 0) {
        addLog(
          `Combined damage on ${result.damageTarget}+: ` +
          `${result.damageRolls.join(", ")} → ` +
          `${result.potentialCasualties} potential ` +
          `casualt${result.potentialCasualties === 1 ? "y" : "ies"}.`,
          result.potentialCasualties > 0 ? "kill" : ""
        );
      }

      if (result.potentialCasualties > 0 && result.coverSaveTarget !== null) {
        addLog(
          `${trace.cover.label} ${result.coverSaveTarget}+: ` +
          `${result.saveRolls.join(", ")} → ${result.saved} saved.`,
          result.saved > 0 ? "morale" : ""
        );
      } else if (result.potentialCasualties > 0) {
        addLog("No cover save is available.");
      }

      const casualties = applyCasualties(target, result.requestedCasualties);
      recordCasualties(shooter.faction, target.faction, casualties);

      if (casualties > 0) {
        addLog(
          `${capitalize(target.faction)} ${target.name} suffers ${casualties} ` +
          `casualt${casualties === 1 ? "y" : "ies"}; remaining loadout: ` +
          `${fullLoadout(target)}.`,
          "kill"
        );
      }

      if (target.soldiers === 0) {
        recordUnitDestroyed(target, shooter.faction, `${label} casualties`);
        addLog(
          `${capitalize(target.faction)} ${target.name} is destroyed.`,
          "kill"
        );
      }

      renderUnits();
      return {
        destroyed: target.soldiers === 0,
        hits: result.totalHits,
        casualties,
        shots: result.totalShots
      };
    }

    function resolveCloseCombat(attacker, defender, analysis) {
      lockActivationTransaction("close-combat dice rolled");

      const result = assaultRules.resolveCloseCombat({
        attacker,
        defender,
        defensivePosition: Boolean(analysis?.defensivePosition),
        rollDice
      });

      for (const round of result.rounds) {
        addLog(
          `Close combat round ${round.number}` +
          `${round.defensivePosition ? " — defender has a Defensive Position" : ""}.`,
          "assault"
        );

        if (round.mode === "defender-first") {
          const defenderKills = applyCasualties(attacker, round.defenderKills);
          recordCasualties(defender.faction, attacker.faction, defenderKills);
          addLog(
            `Defender strikes first (${qualityLabel(defender)}, ` +
            `${qualityProfile(defender).assaultDamageTarget}+): ` +
            `${round.defenderRolls.join(", ")} → ${defenderKills} attacker ` +
            `casualt${defenderKills === 1 ? "y" : "ies"}.`,
            "assault"
          );

          if (round.attackerRolls.length > 0) {
            const attackerKills = applyCasualties(defender, round.attackerKills);
            recordCasualties(attacker.faction, defender.faction, attackerKills);
            addLog(
              `Surviving attackers strike (${qualityLabel(attacker)}, ` +
              `${qualityProfile(attacker).assaultDamageTarget}+): ` +
              `${round.attackerRolls.join(", ")} → ${attackerKills} defender ` +
              `casualt${attackerKills === 1 ? "y" : "ies"}.`,
              "assault"
            );
          }
        } else {
          const defenderKills = applyCasualties(attacker, round.defenderKills);
          const attackerKills = applyCasualties(defender, round.attackerKills);
          recordCasualties(defender.faction, attacker.faction, defenderKills);
          recordCasualties(attacker.faction, defender.faction, attackerKills);
          addLog(
            `Simultaneous attacks — attacker ${qualityLabel(attacker)} ` +
            `${qualityProfile(attacker).assaultDamageTarget}+: ` +
            `${round.attackerRolls.join(", ")} → ${attackerKills}; defender ` +
            `${qualityLabel(defender)} ` +
            `${qualityProfile(defender).assaultDamageTarget}+: ` +
            `${round.defenderRolls.join(", ")} → ${defenderKills}.`,
            "assault"
          );
        }

        if (!round.winnerAfterRound) {
          addLog(
            "The round is tied; another close-combat round begins.",
            "assault"
          );
        }
      }

      const battleStats = getBattleStats();
      if (result.winner === "attacker") {
        const removed = defender.soldiers;
        recordCasualties(attacker.faction, defender.faction, removed);
        recordUnitDestroyed(defender, attacker.faction, "Defeated in close combat");
        if (battleStats?.[attacker.faction]) {
          battleStats[attacker.faction].assaultsWon += 1;
        }
        destroyUnit(defender);

        const defenderPosition = { x: defender.x, y: defender.y };
        const attackerStart = { x: attacker.x, y: attacker.y };
        const safe = findSafeAssaultPosition(
          attacker,
          defenderPosition,
          attackerStart
        );
        attacker.x = safe.x;
        attacker.y = safe.y;

        if (analysis.buildingAssault) {
          occupyBuilding(attacker, {
            fromAssault: true,
            buildingId: analysis.buildingId
          });
          showBattleAnnouncement(
            `${buildingLabel(analysis.buildingId).toUpperCase()} CLEARED`,
            `${attacker.name} takes the position`,
            attacker.faction,
            1200
          );
          addLog(
            `${capitalize(attacker.faction)} ${attacker.name} clears and ` +
            `occupies the ${buildingLabel(analysis.buildingId)}.`,
            "assault"
          );
        } else {
          addLog(
            `${capitalize(attacker.faction)} ${attacker.name} wins; ` +
            `${defender.name} is destroyed and the attacker occupies the position.`,
            "assault"
          );
        }
        completeActivation("Assault");
      } else if (result.winner === "defender") {
        const removed = attacker.soldiers;
        recordCasualties(defender.faction, attacker.faction, removed);
        recordUnitDestroyed(attacker, defender.faction, "Defeated in close combat");
        if (battleStats?.[defender.faction]) {
          battleStats[defender.faction].assaultsWon += 1;
        }
        destroyUnit(attacker);
        addLog(
          `${capitalize(defender.faction)} ${defender.name} wins; ` +
          "the assaulting unit is destroyed.",
          "assault"
        );
        clearActivationSelection();
        if (!checkElimination()) finishActivationState();
      } else {
        const attackerRemoved = attacker.soldiers;
        const defenderRemoved = defender.soldiers;
        recordCasualties(defender.faction, attacker.faction, attackerRemoved);
        recordCasualties(attacker.faction, defender.faction, defenderRemoved);
        recordUnitDestroyed(
          attacker,
          defender.faction,
          "Mutual destruction in close combat"
        );
        recordUnitDestroyed(
          defender,
          attacker.faction,
          "Mutual destruction in close combat"
        );
        destroyUnit(attacker);
        destroyUnit(defender);
        addLog("Both units are destroyed in the close combat.", "assault");
        clearActivationSelection();
        if (!checkElimination()) finishActivationState();
      }

      renderUnits();
      return result;
    }

    return Object.freeze({
      diagnostic: Object.freeze({
        active: true,
        stage: "S1.0.1",
        mode: "explicit-pure-rules-with-engine-commit-adapters"
      }),
      moraleRules,
      shootingRules,
      assaultRules,
      commandSupport,
      commandBonus,
      attemptOrder,
      isMMGTeam: shootingRules.isMMGTeam,
      analyzeMMGFireArc: shootingRules.analyzeMMGFireArc,
      targetInsideMMGArc: shootingRules.targetInsideMMGArc,
      availableFireGroups: shootingRules.availableFireGroups,
      weaponRange: shootingRules.weaponRange,
      determineLineCover: shootingRules.determineLineCover,
      analyzeShot: shootingRules.analyzeShot,
      analyzeShotAtPoint: shootingRules.analyzeShotAtPoint,
      resolveShootingCore,
      analyzeAssault: assaultRules.analyzeAssault,
      resolveCloseCombat
    });
  }

  window.CrossroadsCombatRuntime = Object.freeze({ create });
})();
