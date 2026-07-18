"use strict";

(() => {
  const DEFAULT_KEYS = Object.freeze({
    playtest:"crossroads.editor.playtest",
    lastScenario:"crossroads.editor.lastScenario",
    customScenarios:"crossroads.editor.customScenarios",
    clipboard:"crossroads.editor.clipboard"
  });

  function requireValue(value, name) {
    if (!value) throw new Error(`Editor persistence requires ${name}.`);
    return value;
  }

  function create(options = {}) {
    const documentModel = requireValue(options.documentModel, "documentModel");
    const builtInScenarios = requireValue(options.builtInScenarios, "builtInScenarios");
    const scenarioSources = requireValue(options.scenarioSources, "scenarioSources");
    const storage = options.storage ?? null;
    const keys = Object.freeze({ ...DEFAULT_KEYS, ...(options.keys ?? {}) });
    const builtInIds = new Set(Object.keys(builtInScenarios));

    function read(key, fallback = null) {
      if (!storage) return fallback;
      try {
        const value = storage.getItem(key);
        return value == null ? fallback : value;
      } catch (_error) {
        return fallback;
      }
    }

    function write(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(key, value);
        return true;
      } catch (_error) {
        return false;
      }
    }

    function customScenarios() {
      return [...scenarioSources.values()]
        .filter(source => !builtInIds.has(source.id))
        .map(source => documentModel.create(source));
    }

    function writeCustomScenarios() {
      return write(keys.customScenarios, JSON.stringify(customScenarios()));
    }

    function loadCustomScenarios() {
      let saved;
      try {
        saved = JSON.parse(read(keys.customScenarios, "[]"));
      } catch (_error) {
        return [];
      }
      if (!Array.isArray(saved)) return [];

      const loaded = [];
      for (const source of saved) {
        try {
          const scenario = documentModel.create(source);
          if (!scenario?.id || builtInIds.has(scenario.id)) continue;
          scenarioSources.set(scenario.id, scenario);
          loaded.push(scenario.id);
        } catch (_error) {
          // Invalid local drafts are ignored without preventing editor startup.
        }
      }
      return loaded;
    }

    function persistScenario(source) {
      const draft = documentModel.create(source);
      if (builtInIds.has(draft.id)) {
        throw new Error(`Cannot overwrite built-in scenario: ${draft.id}`);
      }
      scenarioSources.set(draft.id, draft);
      writeCustomScenarios();
      return draft;
    }

    function deleteScenario(id) {
      if (!id || builtInIds.has(id)) return false;
      const removed = scenarioSources.delete(id);
      if (removed) writeCustomScenarios();
      return removed;
    }

    function requestedScenarioId(search = "") {
      const fallback = scenarioSources.has("mokra") ? "mokra" : scenarioSources.keys().next().value;
      const fromUrl = new URLSearchParams(search).get("scenario");
      if (fromUrl && scenarioSources.has(fromUrl)) return fromUrl;
      const remembered = read(keys.lastScenario, "");
      if (remembered && scenarioSources.has(remembered)) return remembered;
      return fallback;
    }

    function rememberScenario(id) {
      return write(keys.lastScenario, id || "");
    }

    function loadClipboard() {
      try {
        return JSON.parse(read(keys.clipboard, "null"));
      } catch (_error) {
        return null;
      }
    }

    function saveClipboard(payload) {
      return write(keys.clipboard, JSON.stringify(payload ?? null));
    }

    function savePlaytest(scenario) {
      return write(keys.playtest, JSON.stringify(scenario));
    }

    return Object.freeze({
      keys,
      loadCustomScenarios,
      persistScenario,
      deleteScenario,
      requestedScenarioId,
      rememberScenario,
      loadClipboard,
      saveClipboard,
      savePlaytest
    });
  }

  window.CrossroadsEditorPersistence = Object.freeze({ create });
})();
