"use strict";

(() => {
  const presentation = window.CrossroadsTerrainPresentation;
  const objectiveRules = window.CrossroadsObjectiveRules;
  if (!presentation?.renderScenarioTerrain || !objectiveRules) {
    throw new Error("Scenario runtime loaded before its dependencies.");
  }

  let installed = false;
  let originalScoreRoundAndContinue = null;
  let originalApplyFinalScenarioScoring = null;
  let originalUpdateScenarioUI = null;
  let originalInstantiateScenarioUnits = null;
  let originalPointInDeploymentZone = null;

  function groupedObjective() {
    const objective = activeScenario?.objectives?.[0];
    return objective?.type === "control_group" ? objective : null;
  }

  function deploymentZoneFor(unit, faction) {
    const root = activeScenario?.deployment?.zones?.[faction];
    if (!root?.subzones?.length) return root;
    const zoneId = unit?.deploymentZone;
    return root.subzones.find(zone => zone.id === zoneId) ?? root;
  }

  function install() {
    if (installed) return;
    installed = true;

    originalScoreRoundAndContinue = scoreRoundAndContinue;
    originalApplyFinalScenarioScoring = applyFinalScenarioScoring;
    originalUpdateScenarioUI = updateScenarioUI;
    originalInstantiateScenarioUnits = instantiateScenarioUnits;
    originalPointInDeploymentZone = pointInDeploymentZone;

    instantiateScenarioUnits = function instantiateScenarioUnitsWithZones(scenario) {
      const result = originalInstantiateScenarioUnits(scenario);
      const entries = new Map();
      for (const faction of ["blue", "red"]) {
        for (const entry of scenario.forces?.[faction] ?? []) entries.set(entry.id, entry);
      }
      return result.map(unit => ({ ...unit, deploymentZone: entries.get(unit.id)?.deploymentZone ?? null }));
    };

    pointInDeploymentZone = function pointInNamedDeploymentZone(point, faction) {
      const root = activeScenario?.deployment?.zones?.[faction];
      if (!root?.subzones?.length) return originalPointInDeploymentZone(point, faction);
      const unit = point?.id ? point : getUnit(deploymentUnitId);
      const zone = deploymentZoneFor(unit, faction);
      return Boolean(zone) && point.x >= zone.xMin && point.x <= zone.xMax && point.y >= zone.yMin && point.y <= zone.yMax;
    };

    scoreRoundAndContinue = function scoreGroupedObjectiveRound() {
      const objective = groupedObjective();
      if (!objective) return originalScoreRoundAndContinue();
      if (phase !== "round-complete" || battleEnded) return;

      clearActionOverlays();
      const result = objectiveRules.roundScore(objective, activeScenario.scoring, round, livingUnits(), distanceBetweenPoints);
      scores.blue += result.blue;
      scores.red += result.red;
      if (battleStats) {
        if (result.blue > 0) battleStats.blue.objectiveRoundsControlled += 1;
        if (result.red > 0) battleStats.red.objectiveRoundsControlled += 1;
      }

      const detail = result.state.points.map(point => `${point.label}: ${point.state}`).join(" · ");
      if (result.blue || result.red) {
        showBattleAnnouncement(
          result.red ? `GERMANY +${result.red}` : `POLAND +${result.blue}`,
          result.red ? "Railway crossings seized" : "The railway line holds",
          result.red ? "red" : "blue",
          1100
        );
        addLog(`Mokra crossings — ${detail}. Score: Poland +${result.blue}, Germany +${result.red}.`, "objective");
      } else {
        showBattleAnnouncement("NO SCORE", "Crossings contested or uncontrolled", "neutral", 900);
        addLog(`Mokra crossings — ${detail}. Neither side scores.`, "objective");
      }

      updateScenarioUI();
      if (round >= RULES.maxRounds) return endBattleByScore();
      round += 1;
      showBattleAnnouncement(`ROUND ${round}`, `${activeScenario.factions.blue.name} ${scores.blue} — ${scores.red} ${activeScenario.factions.red.name}`, "neutral", 1000);
      for (const unit of livingUnits()) {
        unit.activated = false;
        unit.order = null;
        unit.down = false;
        if (unit.ambush) {
          addLog(`${capitalize(unit.faction)} ${unit.name}'s unused Ambush expires.`, "ambush");
          unit.ambush = false;
        }
      }
      fillBag();
      phase = "ready-to-draw";
      nextRoundButton.disabled = true;
      drawButton.disabled = false;
      drawnDie.textContent = "No die drawn";
      drawnDie.className = "drawn-die";
      setStatus("Press “Draw Order Die.”");
      addLog(`Round ${round} begins. Down and unused Ambush markers clear; the bag is refilled.`);
      renderUnits();
    };

    applyFinalScenarioScoring = function applyGroupedFinalScoring() {
      const objective = groupedObjective();
      if (!objective) return originalApplyFinalScenarioScoring();
      if (finalScenarioScored) return;
      finalScenarioScored = true;
      const result = objectiveRules.finalScore(objective, activeScenario.scoring, livingUnits());
      scores.blue += result.blue;
      scores.red += result.red;
      if (battleStats) {
        if (result.blue > 0) battleStats.blue.finalObjectiveControl += 1;
        if (result.red > 0) battleStats.red.finalObjectiveControl += 1;
      }
      addLog(result.red
        ? `Germany receives ${result.red} final points for breaking east of the railway.`
        : `Poland receives ${result.blue} final points for denying a breakthrough.`, "objective");
    };

    updateScenarioUI = function updateGroupedObjectiveUI() {
      const objective = groupedObjective();
      if (!objective) return originalUpdateScenarioUI();
      blueScore.textContent = scores.blue;
      redScore.textContent = scores.red;
      roundReadout.textContent = `${round} / ${RULES.maxRounds}`;
      const state = objectiveRules.snapshot(objective, livingUnits(), distanceBetweenPoints);
      objectiveOwner.textContent = `Poland ${state.controlled.blue} · Germany ${state.controlled.red}`;
      blueObjectiveDistance.textContent = `${state.controlled.blue} held`;
      redObjectiveDistance.textContent = `${state.controlled.red} held`;
      objectiveLabel.hidden = true;
      objectiveRing.hidden = true;
      objectiveMarker.hidden = true;
      document.body.classList.remove("objective-focus");
      renderObjectiveMarkers(state);
      updateDeploymentProgress();
      updateTransactionBadge();
    };

    window.CROSSROADS_SCENARIO_RUNTIME = Object.freeze({ active: true, stage: "Mokra M1" });
  }

  function markerLayer() {
    const battlefield = document.getElementById("battlefield");
    if (!battlefield) return null;
    let layer = battlefield.querySelector(".scenario-objective-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "scenario-objective-layer";
      battlefield.appendChild(layer);
    }
    return layer;
  }

  function renderObjectiveMarkers(snapshot = null) {
    const layer = markerLayer();
    if (!layer) return;
    const objective = groupedObjective();
    if (!objective) {
      layer.replaceChildren();
      layer.hidden = true;
      return;
    }
    layer.hidden = false;
    const state = snapshot ?? objectiveRules.snapshot(objective, livingUnits(), distanceBetweenPoints);
    layer.replaceChildren(...state.points.map((point, index) => {
      const marker = document.createElement("div");
      marker.className = `scenario-objective-point state-${point.state}`;
      marker.style.left = `${point.x / RULES.tableWidth * 100}%`;
      marker.style.top = `${point.y / RULES.tableHeight * 100}%`;
      marker.style.setProperty("--objective-radius-x", `${point.radius * 2 / RULES.tableWidth * 100}%`);
      marker.style.setProperty("--objective-radius-y", `${point.radius * 2 / RULES.tableHeight * 100}%`);
      marker.dataset.label = point.label;
      marker.innerHTML = `<span>${index + 1}</span><b>${point.label}</b>`;
      return marker;
    }));
  }

  window.CrossroadsTerrainPresentation = Object.freeze({
    ...presentation,
    renderScenarioTerrain(args) {
      install();
      presentation.renderScenarioTerrain(args);
      renderObjectiveMarkers();
    }
  });

  window.CrossroadsScenarioRuntime = Object.freeze({ install, renderObjectiveMarkers, isInstalled: () => installed });
})();
