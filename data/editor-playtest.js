"use strict";

(() => {
  const parameters = new URLSearchParams(window.location.search);
  if (!parameters.has("editorPlaytest")) return;

  const storageKey = "crossroads.editor.playtest";
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    console.warn("Terrain Editor playtest requested, but no saved editor scenario was found.");
    return;
  }

  try {
    const scenario = JSON.parse(raw);
    if (!scenario?.table || !scenario?.forces || !Array.isArray(scenario?.objectives)) {
      throw new Error("Saved editor scenario is incomplete.");
    }
    scenario.id = "editor_playtest";
    scenario.title = scenario.title || "Editor Playtest";

    window.CROSSROADS_SCENARIOS = Object.freeze({
      ...window.CROSSROADS_SCENARIOS,
      editor_playtest: scenario
    });

    const select = document.getElementById("scenarioSelect");
    if (select) {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.title;
      select.appendChild(option);
      select.value = scenario.id;
    }

    const mainMenu = document.getElementById("mainMenuOverlay");
    const scenarioMenu = document.getElementById("scenarioMenuOverlay");
    if (mainMenu) mainMenu.style.display = "none";
    if (scenarioMenu) scenarioMenu.hidden = true;
    document.body.classList.remove("menu-open");
    document.body.dataset.editorPlaytest = "true";
  } catch (error) {
    console.error("Terrain Editor playtest could not be loaded.", error);
  }
})();
