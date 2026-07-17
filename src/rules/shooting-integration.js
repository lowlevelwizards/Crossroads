"use strict";

(() => {
  // Foundation 4A staged integration seam.
  //
  // This file installs the pure shooting module when engine.js constructs the
  // battlefield renderer. It deliberately keeps engine-owned logging, stats,
  // casualty mutation, effects, outcomes, and activation flow in the engine.
  // The previous engine calculations remain dormant during this test stage so
  // the extraction can be rolled back without affecting unrelated systems.

  const presentation = window.CrossroadsBattlefieldPresentation;
  const shootingModule = window.CrossroadsShootingRules;

  if (!presentation?.createUnitLayerRenderer || !shootingModule?.create) {
    throw new Error("Shooting integration loaded before its dependencies.");
  }

  let installed = false;
  let shootingRules = null;

  function installPureShootingRules() {
    if (installed) return shootingRules;

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
      getTerrainInstance: id => TERRAIN_GEOMETRY.get(id)
    });

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
    window.CROSSROADS_SHOOTING_EXTRACTION = Object.freeze({
      active: true,
      stage: "Foundation 4A",
      mode: "pure-rules-with-engine-commit"
    });

    return shootingRules;
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    ...presentation,
    createUnitLayerRenderer(dependencies) {
      const rules = installPureShootingRules();
      return presentation.createUnitLayerRenderer({
        ...dependencies,
        isMMGTeam: rules.isMMGTeam,
        analyzeShot: rules.analyzeShot,
        availableFireGroups: rules.availableFireGroups
      });
    }
  });

  window.CrossroadsShootingIntegration = Object.freeze({
    isInstalled: () => installed,
    getRules: () => shootingRules
  });
})();
