"use strict";

(() => {
  const WORKSPACES = Object.freeze(["build", "organize", "scenario"]);
  const PANELS = Object.freeze(["inspector", "validation", "data"]);
  const WORKSPACE_KEY = "crossroads.editor.workspace";
  const PANEL_KEY = "crossroads.editor.panel";

  function safeRead(storage, key, fallback) {
    try {
      const value = storage?.getItem(key);
      return value || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function safeWrite(storage, key, value) {
    try { storage?.setItem(key, value); }
    catch (_error) { /* Editor UI preferences are optional. */ }
  }

  function allowed(value, choices, fallback) {
    return choices.includes(value) ? value : fallback;
  }

  function create(options = {}) {
    const root = options.root ?? document.body;
    const storage = options.storage ?? null;
    const onLayoutChange = typeof options.onLayoutChange === "function" ? options.onLayoutChange : () => {};
    const onWorkspaceChange = typeof options.onWorkspaceChange === "function" ? options.onWorkspaceChange : () => {};
    const workspaceButtons = [...root.querySelectorAll("[data-editor-workspace-button]")];
    const workspacePanels = [...root.querySelectorAll("[data-editor-workspace-panel]")];
    const panelButtons = [...root.querySelectorAll("[data-editor-panel-button]")];
    const panelSections = [...root.querySelectorAll("[data-editor-panel]")];
    const popoverButtons = [...root.querySelectorAll("[data-editor-popover-button]")];
    const popovers = [...root.querySelectorAll("[data-editor-popover]")];
    const leftToggle = root.querySelector("[data-editor-toggle-left]");
    const rightToggle = root.querySelector("[data-editor-toggle-right]");

    let workspace = allowed(safeRead(storage, WORKSPACE_KEY, "build"), WORKSPACES, "build");
    let panel = allowed(safeRead(storage, PANEL_KEY, "inspector"), PANELS, "inspector");

    function notifyLayout() {
      window.requestAnimationFrame?.(() => onLayoutChange({ workspace, panel }));
    }

    function setWorkspace(next, settings = {}) {
      workspace = allowed(next, WORKSPACES, "build");
      root.dataset.editorWorkspace = workspace;
      for (const button of workspaceButtons) {
        const selected = button.dataset.editorWorkspaceButton === workspace;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      }
      for (const section of workspacePanels) {
        section.hidden = section.dataset.editorWorkspacePanel !== workspace;
      }
      if (settings.remember !== false) safeWrite(storage, WORKSPACE_KEY, workspace);
      onWorkspaceChange(workspace);
      root.classList.remove("is-left-drawer-open");
      notifyLayout();
    }

    function setPanel(next, settings = {}) {
      panel = allowed(next, PANELS, "inspector");
      root.dataset.editorPanel = panel;
      for (const button of panelButtons) {
        const selected = button.dataset.editorPanelButton === panel;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      }
      for (const section of panelSections) {
        section.hidden = section.dataset.editorPanel !== panel;
      }
      if (settings.remember !== false) safeWrite(storage, PANEL_KEY, panel);
      root.classList.remove("is-right-drawer-open");
      notifyLayout();
    }

    function closePopovers(except = null) {
      for (const popover of popovers) {
        if (popover === except) continue;
        popover.hidden = true;
      }
      for (const button of popoverButtons) {
        const target = root.querySelector(`#${button.getAttribute("aria-controls")}`);
        button.setAttribute("aria-expanded", String(Boolean(target && !target.hidden)));
      }
    }

    function togglePopover(button) {
      const targetId = button.getAttribute("aria-controls");
      const target = targetId ? root.querySelector(`#${targetId}`) : null;
      if (!target) return;
      const opening = target.hidden;
      closePopovers(opening ? target : null);
      target.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
    }

    function showValidation() {
      setPanel("validation");
      root.classList.add("is-right-drawer-open");
    }

    function bind() {
      for (const button of workspaceButtons) {
        button.addEventListener("click", () => setWorkspace(button.dataset.editorWorkspaceButton));
      }
      for (const button of panelButtons) {
        button.addEventListener("click", () => setPanel(button.dataset.editorPanelButton));
      }
      for (const button of popoverButtons) {
        button.addEventListener("click", event => {
          event.stopPropagation();
          togglePopover(button);
        });
      }
      root.addEventListener("click", event => {
        if (event.target.closest("[data-editor-popover], [data-editor-popover-button]")) return;
        closePopovers();
      });
      window.addEventListener("keydown", event => {
        if (event.key === "Escape") closePopovers();
      });
      leftToggle?.addEventListener("click", () => {
        root.classList.toggle("is-left-drawer-open");
        root.classList.remove("is-right-drawer-open");
      });
      rightToggle?.addEventListener("click", () => {
        root.classList.toggle("is-right-drawer-open");
        root.classList.remove("is-left-drawer-open");
      });
    }

    bind();
    setWorkspace(workspace, { remember:false });
    setPanel(panel, { remember:false });

    return Object.freeze({
      workspace:() => workspace,
      panel:() => panel,
      setWorkspace,
      setPanel,
      showValidation,
      closePopovers
    });
  }

  window.CrossroadsEditorShell = Object.freeze({ create });
})();
