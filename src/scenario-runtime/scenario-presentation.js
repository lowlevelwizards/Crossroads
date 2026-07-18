"use strict";

(() => {
  function make(tagName, className = "", text = "") {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== "") element.textContent = String(text);
    return element;
  }

  function ensurePanel() {
    let panel = document.getElementById("scenarioObjectivePanel");
    if (panel) return panel;
    const status = document.querySelector(".scenario-status");
    if (!status?.parentElement) return null;
    panel = make("div", "scenario-objective-panel");
    panel.id = "scenarioObjectivePanel";
    panel.append(
      make("div", "scenario-objective-panel-title", "Mission Objectives"),
      make("div", "scenario-objective-card-list")
    );
    status.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function statusLabel(status) {
    return status === "complete" ? "Complete" : status === "failed" ? "Failed" : "Active";
  }

  function renderCards(snapshots, factions) {
    const panel = ensurePanel();
    if (!panel) return;
    const listed = snapshots.filter(snapshot => snapshot.objective.listed !== false);
    const cards = listed.map(snapshot => {
      const objective = snapshot.objective;
      const card = make("article", `scenario-objective-card state-${snapshot.status ?? "active"}`);
      const identity = make("div");
      identity.append(
        make("strong", "", objective.label || objective.id),
        make("small", "", `${objective.faction ? factions?.[objective.faction]?.name ?? objective.faction : "Shared"} · ${String(objective.type).replaceAll("_", " ")}`)
      );
      const status = make("div", "scenario-objective-card-status");
      status.append(make("b", "", statusLabel(snapshot.status)));
      if (snapshot.progress && Number.isFinite(Number(snapshot.progress.current))) {
        const required = Number.isFinite(Number(snapshot.progress.required)) ? ` / ${snapshot.progress.required}` : "";
        status.append(make("span", "", `${snapshot.progress.current}${required}`));
      }
      if (snapshot.summary) status.append(make("em", "", snapshot.summary));
      card.append(identity, status);
      return card;
    });
    panel.querySelector(".scenario-objective-card-list").replaceChildren(...cards);
    panel.hidden = cards.length === 0;
  }

  function markerLayer() {
    const battlefield = document.getElementById("battlefield");
    if (!battlefield) return null;
    let layer = battlefield.querySelector(".scenario-objective-layer");
    if (!layer) {
      layer = make("div", "scenario-objective-layer");
      battlefield.appendChild(layer);
    }
    return layer;
  }

  function exitMarker(objective, table) {
    const lane = make("div", `scenario-exit-lane edge-${objective.edge}`);
    const depthX = Number(objective.depth ?? 3) / Number(table.width) * 100;
    const depthY = Number(objective.depth ?? 3) / Number(table.height) * 100;
    if (objective.edge === "blue" || objective.edge === "red") lane.style.width = `${depthX}%`;
    else lane.style.height = `${depthY}%`;
    lane.append(make("b", "", objective.label));
    return lane;
  }

  function targetMarker(snapshot, table) {
    const objective = snapshot.objective;
    if (!snapshot.target) return null;
    const marker = make("div", `scenario-target-badge ${objective.type === "protect_target" ? "protect" : "destroy"}`);
    const targetX = Number(snapshot.target.x ?? 0) + Number(snapshot.target.width ?? 0) / 2;
    const targetY = Number(snapshot.target.y ?? 0) + Number(snapshot.target.height ?? 0) / 2;
    marker.style.left = `${targetX / Number(table.width) * 100}%`;
    marker.style.top = `${targetY / Number(table.height) * 100}%`;
    marker.append(
      make("span", "", objective.type === "protect_target" ? "◆" : "×"),
      make("b", "", objective.label)
    );
    return marker;
  }

  function controlMarkers(snapshot, table) {
    const objective = snapshot.objective;
    const points = objective.type === "control_group" ? objective.points ?? [] : [objective];
    return points.map(point => {
      const marker = make("div", `scenario-objective-point state-${point.state ?? snapshot.state ?? "none"}`);
      marker.style.left = `${Number(point.x ?? 0) / Number(table.width) * 100}%`;
      marker.style.top = `${Number(point.y ?? 0) / Number(table.height) * 100}%`;
      marker.style.setProperty("--objective-radius-x", `${Number(point.radius ?? objective.radius ?? 2) * 2 / Number(table.width) * 100}%`);
      marker.style.setProperty("--objective-radius-y", `${Number(point.radius ?? objective.radius ?? 2) * 2 / Number(table.height) * 100}%`);
      marker.dataset.label = point.label ?? objective.label;
      marker.append(make("span", "", "◇"), make("b", "", point.label ?? objective.label));
      return marker;
    });
  }

  function renderMarkers(snapshots, table) {
    const layer = markerLayer();
    if (!layer) return;
    const markers = [];
    for (const snapshot of snapshots) {
      const objective = snapshot.objective;
      if (objective.showMarker === false || objective.type === "casualty") continue;
      if (objective.type === "exit_unit") {
        markers.push(exitMarker(objective, table));
      } else if (objective.type === "destroy_target" || objective.type === "protect_target") {
        const marker = targetMarker(snapshot, table);
        if (marker) markers.push(marker);
      } else {
        markers.push(...controlMarkers(snapshot, table));
      }
    }
    layer.replaceChildren(...markers);
    layer.hidden = markers.length === 0;
  }

  function describeObjective(objective, scenario) {
    const faction = objective.faction ? scenario.factions?.[objective.faction]?.name ?? objective.faction : "Either side";
    if (objective.type === "control_zone") return `${faction} scores ${objective.roundPoints ?? 0} per round and ${objective.finalPoints ?? 0} at battle end for controlling ${objective.label}.`;
    if (objective.type === "control_group") return `Control the positions in ${objective.label}; scoring is checked at configured round and final checkpoints.`;
    if (objective.type === "exit_unit") return `${scenario.factions?.[objective.faction]?.name ?? objective.faction} scores ${objective.pointsPerUnit ?? 0} per unit exiting through the ${objective.edge} edge.`;
    if (objective.type === "destroy_target") return `${faction} must destroy ${objective.targetId || "the selected target"}.`;
    if (objective.type === "protect_target") return `${faction} must preserve ${objective.targetId || "the selected target"}.`;
    if (objective.type === "hold") return `${faction} must hold ${objective.label} through Round ${objective.checkpointRound}.`;
    if (objective.type === "casualty") return `Score ${objective.pointsPerUnit ?? 0} per enemy unit destroyed.`;
    return objective.label || objective.id;
  }

  window.CrossroadsScenarioPresentation = Object.freeze({ ensurePanel, renderCards, renderMarkers, describeObjective });
})();
