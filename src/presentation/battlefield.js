"use strict";

(() => {
  // Foundation 3E: battlefield unit-layer presentation.
  // This module converts current battle state into DOM. It does not resolve
  // orders, mutate combat state, or own camera/input rules.

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
      consumeUnitEffects,
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
      getCurrentFaction
    } = deps;

    return function renderUnitLayer() {
      const phase = getPhase();
      const chosenOrder = getChosenOrder();
      const selectedUnitId = getSelectedUnitId();
      const deploymentUnitId = getDeploymentUnitId();
      const pendingTouchTargetId = getPendingTouchTargetId();
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

        const visualEffects = consumeUnitEffects(unit.id);
        for (const effectName of visualEffects) {
          el.classList.add(`effect-${effectName}`);
        }

        const feedbackPriority = [
          ["casualty", "CASUALTY"],
          ["pin", "+ PIN"],
          ["hit", "HIT"],
          ["fire", "FIRE"],
          ["move", chosenOrder === "Assault" ? "ASSAULT" : "MOVE"]
        ];
        const feedback = feedbackPriority.find(([effect]) => visualEffects.has(effect));

        if (feedback) {
          const card = document.createElement("span");
          card.className = `unit-feedback-card feedback-${feedback[0]}`;
          card.textContent = feedback[1];
          el.appendChild(card);
        }

        if (visualEffects.has("move")) {
          const dust = document.createElement("span");
          dust.className = "effect-dust";
          el.appendChild(dust);
        }

        if (visualEffects.has("hit")) {
          const impact = document.createElement("span");
          impact.className = "effect-impact";
          el.appendChild(impact);
        }

        if (visualEffects.has("casualty")) {
          const mark = document.createElement("span");
          mark.className = "effect-casualty-mark";
          el.appendChild(mark);
        }

        if (visualEffects.has("fire")) {
          const weapon =
            el.querySelector(".brick-soldier.role-lmg .brick-weapon") ||
            el.querySelector(".brick-soldier.role-mmg .brick-weapon") ||
            el.querySelector(".brick-soldier.role-smg .brick-weapon") ||
            el.querySelector(".brick-weapon");

          if (weapon) {
            const flash = document.createElement("span");
            flash.className = "muzzle-flash";
            flash.textContent = "✦";
            weapon.appendChild(flash);
          }
        }

        if (unit.activated) el.classList.add("activated");
        if (unit.ambush) el.classList.add("ambush");
        if (unit.id === selectedUnitId || unit.id === deploymentUnitId) el.classList.add("selected");
        if (unit.id === pendingTouchTargetId) el.classList.add("touch-pending-target");
        if (unitIsOnObjective(unit)) el.classList.add("controls-objective");

        const isEnemyShotTarget =
          phase === "choose-target" &&
          shooter &&
          unit.faction !== shooter.faction;

        const isEnemyAssaultTarget =
          phase === "choose-assault-target" &&
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

        el.addEventListener("click", event => {
          event.stopPropagation();
          if (gestureSuppressed()) return;

          if (adaptiveTouchActive()) handleAdaptiveUnitTap(unit.id);
          else if (phase === "deployment") selectDeploymentUnit(unit.id);
          else if (phase === "choose-target") chooseTarget(unit.id);
          else if (phase === "choose-assault-target") chooseAssaultTarget(unit.id);
          else selectUnit(unit.id);
        });

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
      }
    };
  }

  window.CrossroadsBattlefieldPresentation = Object.freeze({
    createUnitLayerRenderer
  });
})();
