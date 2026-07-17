"use strict";

(() => {
  const battlefield = document.getElementById("battlefield");
  const deploymentProgress = document.getElementById("deploymentProgress");
  const blueName = document.getElementById("blueFactionName");
  const redName = document.getElementById("redFactionName");
  if (!battlefield) return;

  let inspectedUnitId = null;
  let syncQueued = false;

  function factionNamedIn(text) {
    const normalized = String(text || "").toLowerCase();
    const names = [
      ["blue", blueName?.textContent],
      ["red", redName?.textContent]
    ];
    for (const [faction, name] of names) {
      if (name && normalized.includes(String(name).toLowerCase())) return faction;
    }
    if (normalized.includes("poland") || normalized.includes("polish")) return "blue";
    if (normalized.includes("germany") || normalized.includes("german")) return "red";
    return null;
  }

  function eligibleFaction() {
    const eligible = battlefield.querySelector(".unit.eligible-current");
    return eligible?.classList.contains("blue") ? "blue" : eligible?.classList.contains("red") ? "red" : null;
  }

  function state() {
    const selected = battlefield.querySelector(".unit.selected");
    const deploymentText = deploymentProgress?.textContent ?? "";
    const deployment = /deploy/i.test(deploymentText);
    const eligible = eligibleFaction();
    const activeFaction = deployment
      ? (factionNamedIn(deploymentText) || selected?.classList.contains("blue") && "blue" || selected?.classList.contains("red") && "red")
      : (eligible || selected?.classList.contains("blue") && "blue" || selected?.classList.contains("red") && "red" || null);
    return { selected, deployment, activeFaction };
  }

  function labelMode(unit, current) {
    const selected = unit === current.selected;
    const inspected = unit.dataset.unitId === inspectedUnitId;
    const own = current.activeFaction && unit.classList.contains(current.activeFaction);
    if (selected || inspected) return "full";
    if (current.deployment) return own ? "compact" : "hidden";
    if (current.selected) return "hidden";
    return own ? "compact" : "hidden";
  }

  function sync() {
    syncQueued = false;
    const current = state();
    battlefield.dataset.labelPhase = current.deployment ? "deployment" : current.selected ? "selected" : "active";
    battlefield.dataset.labelFaction = current.activeFaction ?? "";
    for (const unit of battlefield.querySelectorAll(".unit")) {
      const mode = labelMode(unit, current);
      unit.dataset.labelMode = mode;
      unit.classList.toggle("nameplate-visible", mode !== "hidden");
      unit.classList.toggle("nameplate-full", mode === "full");
    }
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(sync);
  }

  battlefield.addEventListener("click", event => {
    const unit = event.target.closest?.(".unit");
    if (!unit) {
      inspectedUnitId = null;
      queueSync();
      return;
    }
    const current = state();
    const enemy = current.activeFaction && !unit.classList.contains(current.activeFaction);
    if (enemy) inspectedUnitId = inspectedUnitId === unit.dataset.unitId ? null : unit.dataset.unitId;
    queueSync();
  });

  battlefield.addEventListener("pointerover", event => {
    if (!matchMedia("(hover:hover)").matches) return;
    const unit = event.target.closest?.(".unit");
    if (!unit || unit.dataset.labelMode === "full") return;
    unit.classList.add("nameplate-hover");
  });
  battlefield.addEventListener("pointerout", event => event.target.closest?.(".unit")?.classList.remove("nameplate-hover"));

  new MutationObserver(queueSync).observe(battlefield, { childList:true });
  if (deploymentProgress) new MutationObserver(queueSync).observe(deploymentProgress, { childList:true, subtree:true, characterData:true });
  queueSync();
})();
