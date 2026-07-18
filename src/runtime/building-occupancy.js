"use strict";

(() => {
  const RULES = Object.freeze({
    capacity: 1,
    entryDistance: 3.5,
    hardCoverSave: 3
  });

  function requireFunction(dependencies, name) {
    const value = dependencies[name];
    if (typeof value !== "function") {
      throw new Error(`Building occupancy requires ${name}().`);
    }
    return value;
  }

  function create(dependencies) {
    if (!dependencies?.terrainGeometry) {
      throw new Error("Building occupancy requires terrainGeometry.");
    }

    const terrainGeometry = dependencies.terrainGeometry;
    const commands = dependencies.commands;
    const terrainPresentation = dependencies.terrainPresentation;
    const terrainLayer = dependencies.terrainLayer;
    const actionButton = dependencies.actionButton ?? null;
    const unitOutcomeActive = dependencies.unitOutcomeActive ?? "active";

    const livingUnits = requireFunction(dependencies, "livingUnits");
    const getUnit = requireFunction(dependencies, "getUnit");
    const getSelectedUnitId = requireFunction(dependencies, "getSelectedUnitId");
    const clearSelectedUnit = requireFunction(dependencies, "clearSelectedUnit");
    const getPhase = requireFunction(dependencies, "getPhase");
    const setChosenOrder = requireFunction(dependencies, "setChosenOrder");
    const analyzeMovementPath = requireFunction(dependencies, "analyzeMovementPath");
    const attemptOrder = requireFunction(dependencies, "attemptOrder");
    const completeActivation = requireFunction(dependencies, "completeActivation");
    const addLog = requireFunction(dependencies, "addLog");
    const capitalize = requireFunction(dependencies, "capitalize");
    const showAnnouncement = requireFunction(dependencies, "showAnnouncement");
    const getActiveScenario = requireFunction(dependencies, "getActiveScenario");
    const unitIsEligibleForCurrentDie = requireFunction(dependencies, "unitIsEligibleForCurrentDie");
    const unitNameplateHtml = requireFunction(dependencies, "unitNameplateHtml");
    const gestureSuppressed = requireFunction(dependencies, "gestureSuppressed");
    const chooseTarget = requireFunction(dependencies, "chooseTarget");
    const chooseAssaultTarget = requireFunction(dependencies, "chooseAssaultTarget");
    const selectDeploymentUnit = requireFunction(dependencies, "selectDeploymentUnit");
    const selectUnit = requireFunction(dependencies, "selectUnit");

    if (!commands?.makeCommand) {
      throw new Error("Building occupancy requires CrossroadsCommands.");
    }
    if (!terrainPresentation?.elementForInstance) {
      throw new Error("Building occupancy requires terrain presentation.");
    }

    function instance(id) {
      return id ? terrainGeometry.get(id) : null;
    }

    function instances() {
      return terrainGeometry.buildings();
    }

    function label(buildingOrId) {
      const building = typeof buildingOrId === "string"
        ? instance(buildingOrId)
        : buildingOrId;
      return building?.definition?.label ?? "building";
    }

    function centerPoint(id) {
      const building = instance(id) ?? instances()[0];
      return building ? terrainGeometry.center(building) : { x: 0, y: 0 };
    }

    function doorPoint(id) {
      const building = instance(id) ?? instances()[0];
      return building ? terrainGeometry.entryPoint(building) : { x: 0, y: 0 };
    }

    function approachPoint(id) {
      const building = instance(id) ?? instances()[0];
      return building
        ? terrainGeometry.approachPoint(building, 1.8)
        : { x: 0, y: 0 };
    }

    function occupant(buildingId = null) {
      return livingUnits().find(unit =>
        buildingId ? unit.inBuilding === buildingId : Boolean(unit.inBuilding)
      ) ?? null;
    }

    function entryAnalysis(unit, requestedBuildingId = null) {
      if (!unit || unit.inBuilding) {
        return {
          legal: false,
          reason: "The selected unit cannot enter a building."
        };
      }

      const candidates = requestedBuildingId
        ? [instance(requestedBuildingId)].filter(Boolean)
        : instances();
      const analyses = [];

      for (const building of candidates) {
        if (occupant(building.id)) continue;
        const approach = approachPoint(building.id);
        const analysis = analyzeMovementPath(
          unit,
          [unit, approach],
          "Advance",
          unit.id
        );
        analyses.push({ ...analysis, building, approach });
      }

      const legal = analyses
        .filter(analysis => analysis.legal)
        .sort((a, b) => a.cost - b.cost)[0];
      if (legal) return legal;

      if (candidates.length && candidates.every(building => occupant(building.id))) {
        return { legal: false, reason: "Every nearby building is occupied." };
      }

      return {
        legal: false,
        reason: "No empty building can be reached with an Advance."
      };
    }

    function windowPointToward(buildingId, target) {
      const building = instance(buildingId);
      if (!building) return target;

      const center = centerPoint(buildingId);
      const dx = (target?.x ?? center.x) - center.x;
      const dy = (target?.y ?? center.y) - center.y;
      const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, value));

      if (Math.abs(dx) >= Math.abs(dy)) {
        return {
          x: dx < 0 ? building.x - 0.15 : building.x + building.width + 0.15,
          y: clamp(
            target?.y ?? center.y,
            building.y + 2,
            building.y + building.height - 2
          )
        };
      }

      return {
        x: clamp(
          target?.x ?? center.x,
          building.x + 2,
          building.x + building.width - 2
        ),
        y: dy < 0 ? building.y - 0.15 : building.y + building.height + 0.15
      };
    }

    function canEnter(unit) {
      return Boolean(entryAnalysis(unit).legal);
    }

    function occupy(unit, options = {}) {
      const analysis = options.buildingId
        ? { legal: true, building: instance(options.buildingId) }
        : entryAnalysis(unit);
      const building = analysis.building;

      if (!unit || !building || (!options.fromAssault && !analysis.legal)) {
        return false;
      }

      const currentOccupant = occupant(building.id);
      if (currentOccupant && currentOccupant.id !== unit.id) return false;

      const center = centerPoint(building.id);
      if (!options.fromAssault && !options.preserveEntry) {
        unit.buildingEntryX = unit.x;
        unit.buildingEntryY = unit.y;
      }

      unit.inBuilding = building.id;
      unit.x = center.x;
      unit.y = center.y;
      unit.down = false;
      return true;
    }

    function enterAction() {
      const unit = getUnit(getSelectedUnitId());
      const analysis = entryAnalysis(unit);
      if (getPhase() !== "choose-order" || !analysis.legal) return;

      setChosenOrder("Enter Building");
      if (!attemptOrder(unit, "Advance")) return;

      unit.buildingEntryX = analysis.approach.x;
      unit.buildingEntryY = analysis.approach.y;
      occupy(unit, {
        preserveEntry: true,
        buildingId: analysis.building.id
      });

      const name = label(analysis.building);
      addLog(
        `${capitalize(unit.faction)} ${unit.name} advances through the doorway ` +
        `and occupies the ${name}.`,
        "terrain"
      );

      const factionName = getActiveScenario()?.factions?.[unit.faction]?.name
        ?? capitalize(unit.faction);
      showAnnouncement(
        `${name.toUpperCase()} OCCUPIED`,
        `${factionName} takes defensive positions`,
        unit.faction,
        1250
      );
      completeActivation("Enter Building");
    }

    function exitAction() {
      const unit = getUnit(getSelectedUnitId());
      if (getPhase() !== "choose-order" || !unit?.inBuilding) return;

      const buildingId = unit.inBuilding;
      const name = label(buildingId);
      setChosenOrder("Exit Building");
      if (!attemptOrder(unit, "Advance")) return;

      const fallback = approachPoint(buildingId);
      const exitPoint = {
        x: unit.buildingEntryX ?? fallback.x,
        y: unit.buildingEntryY ?? fallback.y
      };

      unit.inBuilding = null;
      unit.x = exitPoint.x;
      unit.y = exitPoint.y;
      unit.buildingEntryX = null;
      unit.buildingEntryY = null;

      addLog(
        `${capitalize(unit.faction)} ${unit.name} exits the ${name} ` +
        "through the doorway.",
        "terrain"
      );
      showAnnouncement(
        `${name.toUpperCase()} CLEARED`,
        `${unit.name} returns to the doorway`,
        unit.faction,
        1000
      );
      completeActivation("Exit Building");
    }

    function command(unit, presentation = "desktop") {
      const exiting = Boolean(unit?.inBuilding);
      const analysis = exiting ? null : entryAnalysis(unit);
      const entering = Boolean(analysis?.legal);
      const enabled = getPhase() === "choose-order" && Boolean(unit) && (exiting || entering);
      const building = exiting ? instance(unit.inBuilding) : analysis?.building;
      const name = label(building);
      const commandLabel = `${exiting ? "Exit" : "Enter"} ${capitalize(name)}`;

      return commands.makeCommand({
        id: exiting
          ? `exit-${unit.inBuilding}`
          : `enter-${building?.id ?? "building"}`,
        label: commandLabel,
        enabled,
        execute: exiting ? exitAction : enterAction,
        reason: enabled
          ? exiting
            ? `Leave the ${name} through its doorway.`
            : `Advance ${analysis.cost.toFixed(1)}″ to the doorway and occupy the ${name}.`
          : analysis?.reason ?? "The selected unit cannot interact with a building.",
        meta: {
          presentation,
          className: "tray-confirm tray-wide building-action"
        }
      });
    }

    function combatContext(attacker, target) {
      const parts = [];
      if (attacker?.inBuilding) {
        parts.push(`Firing from ${label(attacker.inBuilding)} window`);
      }
      if (target?.inBuilding) {
        parts.push(`Target inside ${label(target.inBuilding)} · hard cover`);
      }
      if (target?.inBuilding && target?.down) parts.push("Target is Down");
      if (attacker?.inBuilding && attacker?.ambush) parts.push("Ambush fire");
      return parts;
    }

    function defenseLabel(target) {
      if (!target?.inBuilding) return "";
      const name = capitalize(label(target.inBuilding));
      return target.down ? `${name} hard cover + Down` : `${name} hard cover`;
    }

    function orderLabel(unit) {
      if (!unit) return "";
      if (unit.ambush) return "AMBUSH";
      if (unit.down) return "DOWN";
      return unit.order ? String(unit.order).toUpperCase() : "READY";
    }

    function selectOccupant(buildingId = null) {
      const unit = occupant(buildingId);
      if (!unit) return;

      if (getPhase() === "choose-target") chooseTarget(unit.id);
      else if (getPhase() === "choose-assault-target") chooseAssaultTarget(unit.id);
      else if (getPhase() === "deployment") selectDeploymentUnit(unit.id);
      else selectUnit(unit.id);
    }

    function updateActionButton() {
      if (!actionButton) return;
      const currentCommand = command(getUnit(getSelectedUnitId()), "desktop");
      actionButton.hidden = !currentCommand.enabled;
      actionButton.disabled = !currentCommand.enabled;
      actionButton.textContent = currentCommand.label;
      actionButton.title = currentCommand.reason;
      actionButton.onclick = currentCommand.enabled ? currentCommand.execute : null;
    }

    function render() {
      const selectedUnitId = getSelectedUnitId();
      const selected = getUnit(selectedUnitId);
      const analysis = selected?.inBuilding ? null : entryAnalysis(selected);

      for (const building of instances()) {
        const element = terrainPresentation.elementForInstance(
          terrainLayer,
          building.id
        );
        if (!element) continue;

        const currentOccupant = occupant(building.id);
        const canEnterBuilding = Boolean(
          getPhase() === "choose-order" &&
          analysis?.legal &&
          analysis.building.id === building.id
        );
        const badge = element.querySelector(".building-occupancy-nameplate");
        const marker = element.querySelector(".building-approach-marker");

        element.classList.toggle("occupied-blue", currentOccupant?.faction === "blue");
        element.classList.toggle("occupied-red", currentOccupant?.faction === "red");
        element.classList.toggle("occupant-selected", currentOccupant?.id === selectedUnitId);
        element.classList.toggle("entry-available", canEnterBuilding);
        element.classList.toggle(
          "eligible-current",
          Boolean(currentOccupant && unitIsEligibleForCurrentDie(currentOccupant))
        );
        element.setAttribute(
          "aria-label",
          currentOccupant
            ? `${capitalize(label(building))} occupied by ${currentOccupant.name}, ` +
              `${currentOccupant.soldiers} soldiers, ${currentOccupant.pins} pins`
            : `Empty ${label(building)}`
        );

        if (badge) {
          badge.hidden = !currentOccupant;
          badge.className = `building-occupancy-nameplate ${currentOccupant?.faction ?? ""}` +
            `${currentOccupant?.id === selectedUnitId ? " selected" : ""}` +
            `${currentOccupant && unitIsEligibleForCurrentDie(currentOccupant) ? " ready" : ""}`;
          badge.innerHTML = currentOccupant
            ? unitNameplateHtml(currentOccupant, {
              detail: "building",
              showMen: true,
              showPins: true
            })
            : "";
          badge.onclick = currentOccupant
            ? event => {
              event.stopPropagation();
              if (!gestureSuppressed()) selectOccupant(building.id);
            }
            : null;
        }

        if (marker) {
          marker.hidden = !canEnterBuilding;
          if (canEnterBuilding) {
            const markerPoint = terrainGeometry.entryMarker(building, 1.8);
            marker.style.left = `${markerPoint.x * 100}%`;
            marker.style.top = `${markerPoint.y * 100}%`;
          }
        }

        if (!element.dataset.selectionBound) {
          element.dataset.selectionBound = "true";
          element.addEventListener("click", event => {
            if (!occupant(building.id) || gestureSuppressed()) return;
            event.stopPropagation();
            selectOccupant(building.id);
          });
        }
      }

      updateActionButton();
    }

    function clearInvalidOccupancy() {
      const validIds = new Set(instances().map(building => building.id));
      const firstOccupantByBuilding = new Set();

      for (const unit of livingUnits()) {
        if (!unit.inBuilding) continue;
        if (
          !validIds.has(unit.inBuilding) ||
          firstOccupantByBuilding.has(unit.inBuilding)
        ) {
          unit.inBuilding = null;
          unit.buildingEntryX = null;
          unit.buildingEntryY = null;
          continue;
        }
        firstOccupantByBuilding.add(unit.inBuilding);
      }
    }

    function reconcileAfterUnitChange(unit) {
      if (unit) {
        const noLongerActive = unit.outcome && unit.outcome !== unitOutcomeActive;
        const noSoldiers = Number(unit.soldiers) <= 0;
        if (unit.inBuilding && (noLongerActive || noSoldiers)) {
          unit.inBuilding = null;
          unit.buildingEntryX = null;
          unit.buildingEntryY = null;
        }
        if (getSelectedUnitId() === unit.id && (noLongerActive || noSoldiers)) {
          clearSelectedUnit(unit.id);
        }
      }
      clearInvalidOccupancy();
    }

    return Object.freeze({
      rules: RULES,
      instance,
      instances,
      label,
      centerPoint,
      doorPoint,
      approachPoint,
      occupant,
      entryAnalysis,
      windowPointToward,
      canEnter,
      occupy,
      command,
      enterAction,
      exitAction,
      combatContext,
      defenseLabel,
      orderLabel,
      selectOccupant,
      render,
      updateActionButton,
      clearInvalidOccupancy,
      reconcileAfterUnitChange
    });
  }

  window.CrossroadsBuildingOccupancy = Object.freeze({
    rules: RULES,
    create
  });
})();
