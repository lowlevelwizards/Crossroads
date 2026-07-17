"use strict";

(() => {
  // Foundation 4B.1 staged combat integration seam.
  //
  // The pure morale module owns command support, Order Test calculation,
  // Rally outcomes, and incoming-Pin routing. The pure shooting module owns
  // firing analysis and attack calculation. The engine remains responsible
  // for logs, statistics, state mutation, effects, outcomes, and activation
  // flow. Installation occurs before the battlefield renderer captures its
  // rule callbacks.

  const presentation = window.CrossroadsBattlefieldPresentation;
  const moraleModule = window.CrossroadsMoraleRules;
  const shootingModule = window.CrossroadsShootingRules;

  if (
    !presentation?.createUnitLayerRenderer ||
    !moraleModule?.create ||
    !shootingModule?.create
  ) {
    throw new Error("Combat integration loaded before its dependencies.");
  }

  let installed = false;
  let moraleRules = null;
  let shootingRules = null;

  function installPureCombatRules() {
    if (installed) return { moraleRules, shootingRules };

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

    commandSupport = function commandSupportWithPureMorale(unit) {
      return moraleRules.findCommandSupport(unit, livingUnits());
    };

    commandBonus = function commandBonusWithPureMorale(unit) {
      return moraleRules.commandBonus(unit, livingUnits());
    };

    attemptOrder = function attemptOrderWithPureMorale(unit, order) {
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

      // Rally clearing remains engine-owned after its presentation effect.
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

      const casualties = applyCasualties(
        target,
        result.requestedCasualties
      );
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

    installed = true;
    window.CROSSROADS_COMBAT_EXTRACTION = Object.freeze({
      active: true,
      stage: "Foundation 4B.1",
      mode: "pure-shooting-and-morale-with-engine-commit"
    });
    window.CROSSROADS_SHOOTING_EXTRACTION = window.CROSSROADS_COMBAT_EXTRACTION;
    window.CROSSROADS_MORALE_EXTRACTION = window.CROSSROADS_COMBAT_EXTRACTION;

    return { moraleRules, shootingRules };
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    ...presentation,
    createUnitLayerRenderer(dependencies) {
      const rules = installPureCombatRules();
      return presentation.createUnitLayerRenderer({
        ...dependencies,
        isMMGTeam: rules.shootingRules.isMMGTeam,
        analyzeShot: rules.shootingRules.analyzeShot,
        availableFireGroups: rules.shootingRules.availableFireGroups,
        commandSupport
      });
    }
  });

  const integrationApi = Object.freeze({
    isInstalled: () => installed,
    getMoraleRules: () => moraleRules,
    getShootingRules: () => shootingRules,
    getRules: () => shootingRules
  });

  window.CrossroadsCombatIntegration = integrationApi;
  // Compatibility alias for the already tested Foundation 4A diagnostic.
  window.CrossroadsShootingIntegration = integrationApi;
})();
