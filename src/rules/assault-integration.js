"use strict";

(() => {
  // Foundation 4B.2 staged assault integration seam.
  //
  // Assault analysis and close-combat dice now come from the pure assault
  // module. Reaction-fire coordination, casualty mutation, movement,
  // building occupancy, statistics, logs, effects, and activation flow remain
  // engine-owned. Installation occurs before the battlefield renderer captures
  // its target-analysis callbacks.

  const presentation = window.CrossroadsBattlefieldPresentation;
  const assaultModule = window.CrossroadsAssaultRules;

  if (!presentation?.createUnitLayerRenderer || !assaultModule?.create) {
    throw new Error("Assault integration loaded before its dependencies.");
  }

  let installed = false;
  let assaultRules = null;

  function installPureAssaultRules() {
    if (installed) return assaultRules;

    assaultRules = assaultModule.create({
      rules: RULES,
      features: FEATURES,
      terrain: TERRAIN,
      unitQuality: UNIT_QUALITY,
      distanceBetweenPoints,
      distanceBetweenUnits,
      // These wrappers intentionally resolve the engine bindings at call time.
      // Shooting and movement install their pure implementations during the
      // same bootstrap sequence, after this factory is constructed.
      analyzeMovementPath: (...args) => analyzeMovementPath(...args),
      analyzeShot: (...args) => analyzeShot(...args),
      segmentRectClip,
      buildingDoorPoint
    });

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
    return assaultRules;
  }

  function publishExtractionState() {
    const state = Object.freeze({
      active: true,
      stage: "Foundation 4B.2",
      mode: "pure-shooting-morale-and-assault-with-engine-commit"
    });
    window.CROSSROADS_COMBAT_EXTRACTION = state;
    window.CROSSROADS_SHOOTING_EXTRACTION = state;
    window.CROSSROADS_MORALE_EXTRACTION = state;
    window.CROSSROADS_ASSAULT_EXTRACTION = state;
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    ...presentation,
    createUnitLayerRenderer(dependencies) {
      const rules = installPureAssaultRules();
      const renderer = presentation.createUnitLayerRenderer({
        ...dependencies,
        analyzeAssault: rules.analyzeAssault
      });
      publishExtractionState();
      return renderer;
    }
  });

  window.CrossroadsAssaultIntegration = Object.freeze({
    isInstalled: () => installed,
    getAssaultRules: () => assaultRules
  });
})();
