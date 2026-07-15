"use strict";

(() => {
  // Foundation 3E: battlefield unit-layer presentation.
  // This module converts current battle state into DOM. It does not resolve
  // orders, mutate combat state, or own camera/input rules.

  function applyEdgeContainment(element, unit, rules, battlefield) {
    const pixelsPerInch =
      Math.max(1, battlefield.offsetWidth) / Math.max(1, rules.tableWidth);

    const horizontalFootprint = 54;
    const topFootprint = 42;
    const bottomFootprint = 74;

    const availableLeft = unit.x * pixelsPerInch;
    const availableRight = (rules.tableWidth - unit.x) * pixelsPerInch;
    const availableTop = unit.y * pixelsPerInch;
    const availableBottom = (rules.tableHeight - unit.y) * pixelsPerInch;

    let shiftX = 0;
    let shiftY = 0;

    if (availableLeft < horizontalFootprint) {
      shiftX = horizontalFootprint - availableLeft;
    } else if (availableRight < horizontalFootprint) {
      shiftX = -(horizontalFootprint - availableRight);
    }

    if (availableTop < topFootprint) {
      shiftY = topFootprint - availableTop;
    } else if (availableBottom < bottomFootprint) {
      shiftY = -(bottomFootprint - availableBottom);
    }

    element.style.setProperty("--unit-edge-shift-x", `${shiftX.toFixed(1)}px`);
    element.style.setProperty("--unit-edge-shift-y", `${shiftY.toFixed(1)}px`);
  }

  function createUnitLayerRenderer(deps) {
    const {
      battlefield,
      RULES,
      WEAPON_PROFILES,
      getUnit,
      isMMGTeam,
      inchesToPixels,
      livingUnits,
      unitIsEligibleForCurrentDie,
      qualityLabel,
      unitFormationHtml,
      presentationEffects,
      casualtyGhostHtml,
      unitIsOnObjective,
      analyzeShot,
      availableFireGroups,
      analyzeAssault,
      gestureSuppressed,
      adaptiveTouchActive,
      handleAdaptiveUnitTap,
      selectDeploymentUnit,
      chooseTarget,
      chooseAssaultTarget,
      selectUnit,
      installLongPress,
      showShotPreview,
      showAssaultPreview,
      showUnitPreview,
      clearTracePreview,
      getPhase,
      getChosenOrder,
      getSelectedUnitId,
      getDeploymentUnitId,
      getPendingTouchTargetId,
      getConfirmedTargetId,
      getTargetingSnapshot,
      getCurrentFaction
    } = deps;

    function routeUnitTap(unitId) {
      if (gestureSuppressed()) return;

      const phase = getPhase();
      if (adaptiveTouchActive()) handleAdaptiveUnitTap(unitId);
      else if (phase === "deployment") selectDeploymentUnit(unitId);
      else if (phase === "choose-target") chooseTarget(unitId);
      else if (phase === "choose-assault-target") chooseAssaultTarget(unitId);
      else selectUnit(unitId);
    }

    battlefield.addEventListener("click", event => {
      const hit = event.target.closest(".unit-model-hit, .unit-label-hit");
      if (!hit || !battlefield.contains(hit)) return;

      const unitElement = hit.closest(".unit");
      if (!unitElement?.dataset.unitId) return;

      event.stopPropagation();
      routeUnitTap(unitElement.dataset.unitId);
    });

    return function renderUnitLayer() {
      const phase = getPhase();
      const chosenOrder = getChosenOrder();
      const selectedUnitId = getSelectedUnitId();
      const deploymentUnitId = getDeploymentUnitId();
      const pendingTouchTargetId = getPendingTouchTargetId();
      const targeting = getTargetingSnapshot();
      const confirmedTargetId = targeting.confirmedTargetId ?? getConfirmedTargetId();
      const currentFaction = getCurrentFaction();

      battlefield.querySelectorAll(".unit, .command-ring, .mmg-fire-arc").forEach(el => el.remove());
      const shooter = getUnit(selectedUnitId);

      const selectedMMG = getUnit(selectedUnitId);
      if (selectedMMG && isMMGTeam(selectedMMG) && selectedMMG.mmgDeployed && !selectedMMG.inBuilding) {
        const arc = document.createElement("div");
        arc.className = `mmg-fire-arc ${selectedMMG.faction}`;
        arc.style.left = `${(selectedMMG.x / RULES.tableWidth) * 100}%`;
        arc.style.top = `${(selectedMMG.y / RULES.tableHeight) * 100}%`;
        arc.style.width = `${inchesToPixels(WEAPON_PROFILES.mmg.range * 2)}px`;
        arc.style.height = `${inchesToPixels(WEAPON_PROFILES.mmg.range * 2)}px`;
        arc.style.setProperty("--mmg-facing", `${selectedMMG.mmgFacing}deg`);
        battlefield.appendChild(arc);
      }

      const commandRingsRelevant =
        phase === "choose-unit" ||
        phase === "choose-order" ||
        getUnit(selectedUnitId)?.role === "officer";

      for (const officer of commandRingsRelevant
        ? livingUnits().filter(unit => unit.role === "officer")
        : []) {
        const ring = document.createElement("div");
        ring.className = `command-ring ${officer.faction}`;
        ring.style.left = `${(officer.x / RULES.tableWidth) * 100}%`;
        ring.style.top = `${(officer.y / RULES.tableHeight) * 100}%`;
        ring.style.width = `${inchesToPixels(RULES.commandRadius * 2)}px`;
        ring.style.height = `${inchesToPixels(RULES.commandRadius * 2)}px`;
        battlefield.appendChild(ring);
      }

      for (const unit of livingUnits()) {
        if (unit.inBuilding) continue;

        const el = document.createElement("button");
        el.className = `unit ${unit.faction} ${unit.type} quality-${unit.quality}${unit.inBuilding ? " in-building" : ""}${unitIsEligibleForCurrentDie(unit) ? " eligible-current" : ""}`;
        el.style.left = `${(unit.x / RULES.tableWidth) * 100}%`;
        el.style.top = `${(unit.y / RULES.tableHeight) * 100}%`;
        el.dataset.unitId = unit.id;

        el.setAttribute(
          "aria-label",
          `${unit.name}, ${qualityLabel(unit)}, ${unit.soldiers} soldiers, ${unit.ambush ? "Ambush" : unit.down ? "Down" : unit.order ?? "Ready"}, ${unit.pins} pins`
        );
        el.innerHTML = unitFormationHtml(unit);
        el.querySelectorAll(".formation-slot").forEach(slot => slot.classList.add("unit-model-hit"));
        el.querySelectorAll(".unit-label").forEach(label => label.classList.add("unit-label-hit"));

        if (unit.activated) el.classList.add("activated");
        if (unit.ambush) el.classList.add("ambush");
        if (unit.id === selectedUnitId || unit.id === deploymentUnitId) el.classList.add("selected");
        if (unit.id === pendingTouchTargetId && !confirmedTargetId) {
          el.classList.add("touch-pending-target");
        }
        if (unit.id === confirmedTargetId) {
          el.classList.add("confirmed-target");
        }
        if (unitIsOnObjective(unit)) el.classList.add("controls-objective");

        const isEnemyShotTarget =
          phase === "choose-target" &&
          !confirmedTargetId &&
          shooter &&
          unit.faction !== shooter.faction;

        const isEnemyAssaultTarget =
          phase === "choose-assault-target" &&
          !confirmedTargetId &&
          shooter &&
          unit.faction !== shooter.faction;

        if (isEnemyShotTarget) {
          const trace = analyzeShot(shooter, unit);
          const groups = availableFireGroups(
            shooter,
            trace.distance,
            chosenOrder === "Advance",
            true
          );

          if (!trace.inRange || trace.blocked || groups.length === 0) {
            el.classList.add("targetable-blocked");
          } else if (trace.cover.saveTarget !== null) {
            el.classList.add("targetable-protected");
          } else {
            el.classList.add("targetable-legal");
          }
        }

        if (isEnemyAssaultTarget) {
          const assault = analyzeAssault(shooter, unit);
          el.classList.add(
            assault.legal ? "targetable-assault" : "targetable-blocked"
          );
        }

        const legalUnitChoice =
          phase === "choose-unit" &&
          currentFaction === unit.faction &&
          !unit.activated;

        const deploymentChoice = phase === "deployment";

        if (
          !legalUnitChoice &&
          !isEnemyShotTarget &&
          !isEnemyAssaultTarget &&
          !deploymentChoice
        ) {
          el.classList.add("illegal");
        }

        installLongPress(el, unit);

        el.addEventListener("mouseenter", () => {
          if (
            phase === "choose-target" &&
            shooter &&
            unit.faction !== shooter.faction
          ) {
            showShotPreview(shooter, unit);
          } else if (
            phase === "choose-assault-target" &&
            shooter &&
            unit.faction !== shooter.faction
          ) {
            showAssaultPreview(shooter, unit);
          } else {
            showUnitPreview(unit);
          }
        });

        el.addEventListener("mouseleave", clearTracePreview);
        battlefield.appendChild(el);
        applyEdgeContainment(el, unit, RULES, battlefield);
      }

      battlefield.querySelectorAll(".casualty-layer").forEach(el => el.remove());
      for (const record of presentationEffects.casualtyRecords()) {
        const ghost = document.createElement("span");
        ghost.className = `casualty-layer ${record.faction} ${record.type ?? ""}`;
        ghost.style.left = `${(record.x / RULES.tableWidth) * 100}%`;
        ghost.style.top = `${(record.y / RULES.tableHeight) * 100}%`;
        ghost.innerHTML = casualtyGhostHtml(record);
        battlefield.appendChild(ghost);
      }
    };
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    createUnitLayerRenderer
  });
})();
