"use strict";

(() => {
  const battlefield = document.getElementById("battlefield");
  const deploymentProgress = document.getElementById("deploymentProgress");
  const blueName = document.getElementById("blueFactionName");
  const redName = document.getElementById("redFactionName");
  if (!battlefield) return;

  let inspectedUnitId = null;

  function factionFromDeploymentText() {
    const text = deploymentProgress?.textContent ?? "";
    if (blueName?.textContent && text.includes(blueName.textContent)) return "blue";
    if (redName?.textContent && text.includes(redName.textContent)) return "red";
    return null;
  }

  function eligibleFaction() {
    return battlefield.querySelector(".unit.eligible-current.blue") ? "blue" :
      battlefield.querySelector(".unit.eligible-current.red") ? "red" : null;
  }

  function sync() {
    const units = [...battlefield.querySelectorAll(".unit")];
    const selected = battlefield.querySelector(".unit.selected");
    const deployment = (deploymentProgress?.textContent ?? "").toLowerCase().includes("deploy");
    const activeFaction = deployment ? factionFromDeploymentText() : eligibleFaction();

    battlefield.dataset.nameplateMode = deployment ? "deployment" : selected ? "selected" : "active";
    battlefield.dataset.nameplateFaction = activeFaction ?? "";
    battlefield.dataset.selectedUnitId = selected?.dataset.unitId ?? "";
    battlefield.dataset.inspectedUnitId = inspectedUnitId ?? "";

    for (const unit of units) {
      const own = activeFaction && unit.classList.contains(activeFaction);
      const isSelected = unit === selected;
      const isInspected = unit.dataset.unitId === inspectedUnitId;
      unit.classList.toggle("nameplate-visible", deployment ? own : selected ? isSelected || isInspected : own || isInspected);
      unit.classList.toggle("nameplate-full", isSelected || isInspected);
    }
  }

  battlefield.addEventListener("click", event => {
    const unit = event.target.closest(".unit");
    if (!unit) {
      inspectedUnitId = null;
      queueMicrotask(sync);
      return;
    }
    const activeFaction = eligibleFaction();
    const isEnemy = activeFaction && !unit.classList.contains(activeFaction);
    if (isEnemy) inspectedUnitId = inspectedUnitId === unit.dataset.unitId ? null : unit.dataset.unitId;
    queueMicrotask(sync);
  });

  battlefield.addEventListener("pointerover", event => {
    if (!matchMedia("(hover:hover)").matches) return;
    const unit = event.target.closest(".unit");
    if (!unit || unit.classList.contains("selected")) return;
    unit.classList.add("nameplate-hover");
  });

  battlefield.addEventListener("pointerout", event => {
    event.target.closest(".unit")?.classList.remove("nameplate-hover");
  });

  new MutationObserver(sync).observe(battlefield, { childList:true, subtree:false });
  deploymentProgress && new MutationObserver(sync).observe(deploymentProgress, { childList:true, subtree:true, characterData:true });
  sync();
})();
