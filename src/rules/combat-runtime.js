"use strict";

(() => {
  // Foundation 4C permanent combat runtime boundary.
  //
  // The pure rules modules own calculation. This runtime installs their active
  // engine bindings once, immediately before the battlefield renderer captures
  // combat callbacks. Engine-owned adapters retain all state mutation, logs,
  // effects, statistics, building occupancy, movement, and activation flow.

  const presentation = window.CrossroadsBattlefieldPresentation;
  const moraleModule = window.CrossroadsMoraleRules;
  const shootingModule = window.CrossroadsShootingRules;
  const assaultModule = window.CrossroadsAssaultRules;

  if (
    !presentation?.createUnitLayerRenderer ||
    !moraleModule?.create ||
    !shootingModule?.create ||
    !assaultModule?.create
  ) {
    throw new Error("Combat runtime loaded before its dependencies.");
  }

  let installed = false;
  let moraleRules = null;
  let shootingRules = null;
  let assaultRules = null;

  function installCombatRules() {
    if (installed) {
      return { moraleRules, shootingRules, assaultRules };
    }

    moraleRules = moraleModule.create({
      rules: RULES,
      distanceBetweenUnits
    });

    shootingRules = shootingModule.create({
      rules: RULES,
      weaponProfiles: WEAPON_PROFILES,
      unitQuality: UNIT_QUALITY,
      terrain: TERRAIN,
      mmgRules: MMG_RULES,
      distanceBetweenPoints,
      segmentRectClip,
      resolveShooterPoint: (shooter, targetPoint) =>
        shooter?.inBuilding
          ? buildingWindowPointToward(shooter.inBuilding, targetPoint)
          : shooter,
      resolveTargetPoint: targetPoint => {
        const unit = targetPoint?.id ? targetPoint : null;
        const buildingId = unit?.inBuilding ?? null;
        return {
          unit,
          buildingId,
          point: buildingId ? buildingCenterPoint(buildingId) : targetPoint
        };
      },
      getTerrainInstance: id => TERRAIN_GEOMETRY.get(id),
      analyzeIncomingPins: moraleRules.analyzeIncomingPins
    });

    assaultRules = assaultModule.create({
      rules: RULES,
      features: FEATURES,
      terrain: TERRAIN,
      unitQuality: UNIT_QUALITY,
      distanceBetweenPoints,
      distanceBetweenUnits,
      analyzeMovementPath: (...args) => analyzeMovementPath(...args),
      analyzeShot: (...args) => shootingRules.analyzeShot(...args),
      segmentRectClip,
      buildingDoorPoint
    });

    commandSupport = function commandSupportWithMoraleRules(unit) {
      return moraleRules.findCommandSupport(unit, livingUnits());
    };

    commandBonus = function commandBonusWithMoraleRules(unit) {
      return moraleRules.commandBonus(unit, livingUnits());
    };

    attemptOrder = function attemptOrderWithMoraleRules(unit, order) {
      const support = commandSupport(unit);
      const analysis = moraleRules.analyzeOrderTest({
        unit,
        order,
        support
      });

      if (!analysis.required) {
        addLog(
          `${capitalize(unit.faction)} ${unit.name}: ${order} ` +
          "requires no Order Test."
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

      // A successful Rally clears all Pins after its presentation effect in the
      // existing chooseOrder flow. Ordinary passed tests remove one Pin here.
      if (!analysis.ignoresPins && result.pinsRemovedOnPass > 0) {
        unit.pins = result.pinsAfterPass;
        addLog(
          `${unit.name} passes and removes 1 Pin; ${unit.pins} remain.`,
          "morale"
        );
      }

      return true;
    };

    isMMGTeam = shootingRules.isMMGTeam;
    analyzeMMGFireArc = shootingRules.analyzeMMGFireArc;
    targetInsideMMGArc = shootingRules.targetInsideMMGArc;
    availableFireGroups = shootingRules.availableFireGroups;
    weaponRange = shootingRules.weaponRange;
    determineLineCover = shootingRules.determineLineCover;
    analyzeShot = shootingRules.analyzeShot;
    analyzeShotAtPoint = shootingRules.analyzeShotAtPoint;

    resolveShootingCore = function resolveShootingWithPureRules(
      shooter,
      target,
      trace,
      options
    ) {
      lockActivationTransaction(`${options?.label ?? "Shooting"} dice rolled`);

      const result = shootingRules.resolveAttack({
        shooter,
        target,
        trace,
        movingPenalty: Boolean(options?.movingPenalty),
        rollDice
      });

      if (result.status === "no-weapons") {
        addLog(
          `${capitalize(shooter.faction)} ${shooter.name} has no weapon able ` +
          `to fire at ${trace.distance.toFixed(1)}″` +
          `${options?.movingPenalty ? " after moving" : ""}.`,
          "fail"
        );
        return { destroyed: false, hits: 0, casualties: 0 };
      }

      const shooterStats = battleStats?.[shooter.faction];
      addLog(
        `${capitalize(shooter.faction)} ${shooter.name} uses ${options.label} ` +
        `at ${target.name} from ${trace.distance.toFixed(1)}″.`,
        options.label.includes("Ambush") ? "ambush" : "hit"
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

      if (
        result.potentialCasualties > 0 &&
        result.coverSaveTarget !== null
      ) {
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
        recordUnitDestroyed(
          target,
          shooter.faction,
          `${options.label} casualties`
        );
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
    };

    analyzeAssault = assaultRules.analyzeAssault;

    resolveCloseCombat = function resolveCloseCombatWithPureRules(
      attacker,
      defender,
      analysis
    ) {
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

      if (result.winner === "attacker") {
        const removed = defender.soldiers;
        recordCasualties(attacker.faction, defender.faction, removed);
        recordUnitDestroyed(
          defender,
          attacker.faction,
          "Defeated in close combat"
        );
        if (battleStats) battleStats[attacker.faction].assaultsWon += 1;
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
        recordUnitDestroyed(
          attacker,
          defender.faction,
          "Defeated in close combat"
        );
        if (battleStats) battleStats[defender.faction].assaultsWon += 1;
        destroyUnit(attacker);
        addLog(
          `${capitalize(defender.faction)} ${defender.name} wins; ` +
          "the assaulting unit is destroyed.",
          "assault"
        );
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
        if (!checkElimination()) finishActivationState();
      } else {
        const attackerRemoved = attacker.soldiers;
        const defenderRemoved = defender.soldiers;
        recordCasualties(
          defender.faction,
          attacker.faction,
          attackerRemoved
        );
        recordCasualties(
          attacker.faction,
          defender.faction,
          defenderRemoved
        );
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
        selectedUnitId = null;
        chosenOrder = null;
        activationSnapshot = null;
        if (!checkElimination()) finishActivationState();
      }

      renderUnits();
      return result;
    };

    installed = true;

    const state = Object.freeze({
      active: true,
      stage: "Foundation 4C",
      mode: "permanent-pure-combat-runtime-with-engine-commit"
    });
    window.CROSSROADS_COMBAT_EXTRACTION = state;
    window.CROSSROADS_SHOOTING_EXTRACTION = state;
    window.CROSSROADS_MORALE_EXTRACTION = state;
    window.CROSSROADS_ASSAULT_EXTRACTION = state;

    return { moraleRules, shootingRules, assaultRules };
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    ...presentation,
    createUnitLayerRenderer(dependencies) {
      const rules = installCombatRules();
      return presentation.createUnitLayerRenderer({
        ...dependencies,
        isMMGTeam: rules.shootingRules.isMMGTeam,
        analyzeShot: rules.shootingRules.analyzeShot,
        availableFireGroups: rules.shootingRules.availableFireGroups,
        commandSupport,
        analyzeAssault: rules.assaultRules.analyzeAssault
      });
    }
  });

  const runtimeApi = Object.freeze({
    isInstalled: () => installed,
    install: installCombatRules,
    getMoraleRules: () => moraleRules,
    getShootingRules: () => shootingRules,
    getAssaultRules: () => assaultRules,
    getRules: () => Object.freeze({
      moraleRules,
      shootingRules,
      assaultRules
    })
  });

  window.CrossroadsCombatRuntime = runtimeApi;

  // Stable diagnostic aliases prevent old test bookmarks or console checks from
  // failing, while the two temporary integration source files are retired.
  window.CrossroadsCombatIntegration = runtimeApi;
  window.CrossroadsShootingIntegration = runtimeApi;
  window.CrossroadsAssaultIntegration = runtimeApi;
})();
