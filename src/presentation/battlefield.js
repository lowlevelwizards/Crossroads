"use strict";

(() => {
  // Battlefield presentation only: converts battle state into DOM without
  // resolving orders, mutating combat state, or owning input/camera rules.

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CARDINAL_ANGLE = Object.freeze({
    right: 0,
    down: 90,
    left: 180,
    up: 270
  });

  function createLocalFrame(travel) {
    const frame = document.createElement("span");
    frame.className = "unit-local-frame";

    while (travel.firstChild) {
      frame.appendChild(travel.firstChild);
    }

    travel.appendChild(frame);
    return frame;
  }

  function maximumWeaponRange(unit, weaponProfiles) {
    return Math.max(
      0,
      ...Object.entries(unit?.weapons ?? {})
        .filter(([, count]) => Number(count) > 0)
        .map(([key]) => Number(weaponProfiles[key]?.range) || 0)
    );
  }

  function elementBoxWithin(element, ancestor) {
    let x = 0;
    let y = 0;
    let node = element;

    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }

    return {
      x,
      y,
      width: element.offsetWidth,
      height: element.offsetHeight
    };
  }

  function appendFireArc({
    battlefield,
    center,
    radius,
    facing,
    faction,
    kind,
    modifiers = []
  }) {
    if (!Number.isFinite(radius) || radius <= 0) return null;

    const arc = document.createElementNS(SVG_NS, "svg");
    arc.classList.add("fire-arc", `${kind}-fire-arc`, faction, ...modifiers);
    arc.setAttribute("viewBox", "-1 -1 2 2");
    arc.setAttribute("preserveAspectRatio", "xMidYMid meet");
    arc.setAttribute("aria-hidden", "true");
    arc.style.left = `${center.x}px`;
    arc.style.top = `${center.y}px`;
    arc.style.width = `${radius * 2}px`;
    arc.style.height = `${radius * 2}px`;
    arc.style.setProperty("--fire-arc-facing", `${facing}deg`);

    const sector = document.createElementNS(SVG_NS, "path");
    sector.classList.add("fire-arc-sector");
    sector.setAttribute(
      "d",
      "M 0 0 L .7071 -.7071 A 1 1 0 0 1 .7071 .7071 Z"
    );
    arc.appendChild(sector);
    battlefield.appendChild(arc);
    return arc;
  }

  function renderMMGFireArcs({
    battlefield,
    livingUnits,
    selectedUnitId,
    phase,
    isMMGTeam,
    weaponProfiles,
    inchesToPixels
  }) {
    for (const unit of livingUnits()) {
      if (!isMMGTeam(unit) || unit.inBuilding) continue;

      const selected = unit.id === selectedUnitId;
      const deployedRelevant =
        unit.mmgDeployed &&
        (unit.ambush || (selected && ["choose-order", "choose-target"].includes(phase)));
      const deploymentPreview =
        selected && !unit.mmgDeployed && phase === "choose-order";

      if (!deployedRelevant && !deploymentPreview) continue;

      const facing = unit.mmgDeployed
        ? unit.mmgFacing
        : CARDINAL_ANGLE[unit.facing] ?? unit.mmgFacing ?? 0;

      appendFireArc({
        battlefield,
        center: {
          x: inchesToPixels(unit.x),
          y: inchesToPixels(unit.y)
        },
        radius: inchesToPixels(weaponProfiles.mmg?.range ?? 36),
        facing,
        faction: unit.faction,
        kind: "mmg",
        modifiers: [
          deploymentPreview ? "is-deployment-preview" : "is-live",
          unit.ambush ? "is-ambush" : ""
        ].filter(Boolean)
      });
    }
  }

  function renderBuildingFireArcs({
    battlefield,
    livingUnits,
    selectedUnitId,
    phase,
    weaponProfiles,
    inchesToPixels
  }) {
    const occupant = livingUnits().find(unit => Boolean(unit.inBuilding));
    if (!occupant) return;

    const selected = occupant.id === selectedUnitId;
    const relevant =
      occupant.ambush ||
      (selected && ["choose-order", "choose-target"].includes(phase));
    if (!relevant) return;

    const range = maximumWeaponRange(occupant, weaponProfiles);
    const building = battlefield.querySelector("#farmhouseTerrain");
    if (!building || range <= 0) return;

    const box = elementBoxWithin(building, battlefield);
    const origins = [
      { x: box.x + box.width, y: box.y + box.height / 2, facing: 0 },
      { x: box.x + box.width / 2, y: box.y + box.height, facing: 90 },
      { x: box.x, y: box.y + box.height / 2, facing: 180 },
      { x: box.x + box.width / 2, y: box.y, facing: 270 }
    ];

    for (const origin of origins) {
      appendFireArc({
        battlefield,
        center: origin,
        radius: inchesToPixels(range),
        facing: origin.facing,
        faction: occupant.faction,
        kind: "building",
        modifiers: [occupant.ambush ? "is-ambush" : "is-preview"]
      });
    }
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
      getCurrentFaction,
      commandSupport
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
      const hit = event.target.closest(".model-hit-pad, .unit-label-hit");
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
      const confirmedTargetId =
        targeting.confirmedTargetId ?? getConfirmedTargetId();
      const currentFaction = getCurrentFaction();

      battlefield
        .querySelectorAll(".unit, .fire-arc")
        .forEach(element => element.remove());

      renderMMGFireArcs({
        battlefield,
        livingUnits,
        selectedUnitId,
        phase,
        isMMGTeam,
        weaponProfiles: WEAPON_PROFILES,
        inchesToPixels
      });
      renderBuildingFireArcs({
        battlefield,
        livingUnits,
        selectedUnitId,
        phase,
        weaponProfiles: WEAPON_PROFILES,
        inchesToPixels
      });

      const shooter = getUnit(selectedUnitId);

      for (const unit of livingUnits()) {
        if (unit.inBuilding) continue;

        const element = document.createElement("button");
        element.className =
          `unit ${unit.faction} ${unit.type} quality-${unit.quality}` +
          `${unitIsEligibleForCurrentDie(unit) ? " eligible-current" : ""}`;
        element.style.left = `${(unit.x / RULES.tableWidth) * 100}%`;
        element.style.top = `${(unit.y / RULES.tableHeight) * 100}%`;
        element.dataset.unitId = unit.id;
        element.setAttribute(
          "aria-label",
          `${unit.name}, ${qualityLabel(unit)}, ${unit.soldiers} soldiers, ` +
            `${unit.ambush ? "Ambush" : unit.down ? "Down" : unit.order ?? "Ready"}, ` +
            `${unit.pins} pins`
        );
        element.innerHTML = unitFormationHtml(unit);

        const travel = element.querySelector(".unit-visual-travel");
        const localFrame = travel ? createLocalFrame(travel) : null;

        if (unit.role === "officer" && localFrame) {
          const ring = document.createElement("span");
          ring.className = `command-ring ${unit.faction}`;
          ring.style.width = `${inchesToPixels(RULES.commandRadius * 2)}px`;
          ring.style.height = `${inchesToPixels(RULES.commandRadius * 2)}px`;
          localFrame.prepend(ring);
        }

        const support = commandSupport(unit);
        if (support && localFrame) {
          element.classList.add("command-supported");
          const marker = document.createElement("span");
          marker.className = "command-support-marker";
          marker.textContent = "★";
          marker.setAttribute("aria-label", `Supported by ${support.name}`);
          localFrame.appendChild(marker);
        }

        element
          .querySelectorAll(".unit-label")
          .forEach(label => label.classList.add("unit-label-hit"));

        if (unit.activated) element.classList.add("activated");
        if (unit.ambush) element.classList.add("ambush");
        if (unit.down) element.classList.add("down");
        if (unit.id === selectedUnitId || unit.id === deploymentUnitId) {
          element.classList.add("selected");
        }
        if (unit.id === pendingTouchTargetId && !confirmedTargetId) {
          element.classList.add("touch-pending-target");
        }
        if (unit.id === confirmedTargetId) {
          element.classList.add("confirmed-target");
        }
        if (unitIsOnObjective(unit)) element.classList.add("controls-objective");

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
            element.classList.add("targetable-blocked");
          } else if (trace.cover.saveTarget !== null) {
            element.classList.add("targetable-protected");
          } else {
            element.classList.add("targetable-legal");
          }
        }

        if (isEnemyAssaultTarget) {
          const assault = analyzeAssault(shooter, unit);
          element.classList.add(
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
          element.classList.add("illegal");
        }

        installLongPress(element, unit);
        element.addEventListener("mouseenter", () => {
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
        element.addEventListener("mouseleave", clearTracePreview);

        battlefield.appendChild(element);
      }
    };
  }

  function applyUnitFacing(battlefield, unitId, facing) {
    const root = battlefield.querySelector(
      `.unit[data-unit-id="${CSS.escape(unitId)}"]`
    );
    window.CrossroadsFormationGeometry.applyFacing(root, facing);
  }

  function confirmTargetInPlace(battlefield, targetId) {
    battlefield
      .querySelectorAll(
        ".unit.targetable-legal, .unit.targetable-protected, " +
          ".unit.targetable-blocked, .unit.targetable-assault, " +
          ".unit.confirmed-target"
      )
      .forEach(unit => {
        unit.classList.remove(
          "targetable-legal",
          "targetable-protected",
          "targetable-blocked",
          "targetable-assault",
          "confirmed-target"
        );
      });

    battlefield
      .querySelector(`.unit[data-unit-id="${CSS.escape(targetId)}"]`)
      ?.classList.add("confirmed-target");

    document.body.classList.add("targeting-confirmed");
  }

  function clearTargetConfirmation(battlefield) {
    battlefield.querySelectorAll(".unit.confirmed-target").forEach(unit =>
      unit.classList.remove("confirmed-target")
    );
    document.body.classList.remove("targeting-confirmed");
  }


  window.CrossroadsBattlefieldPresentation = Object.freeze({
    createUnitLayerRenderer,
    applyUnitFacing,
    confirmTargetInPlace,
    clearTargetConfirmation
  });
})();
