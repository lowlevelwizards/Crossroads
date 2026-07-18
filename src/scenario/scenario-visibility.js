"use strict";

(() => {
  function isVisible(item) {
    return item?.visible !== false && item?.hidden !== true;
  }

  function setVisible(item, visible) {
    if (!item || typeof item !== "object") return item;
    item.visible = Boolean(visible);
    delete item.hidden;
    return item;
  }

  function isLocked(item) {
    return item?.locked === true;
  }

  function setLocked(item, locked) {
    if (!item || typeof item !== "object") return item;
    item.locked = Boolean(locked);
    return item;
  }

  function visibleOnly(items) {
    return (items ?? []).filter(isVisible);
  }

  window.CrossroadsScenarioVisibility = Object.freeze({ isVisible, setVisible, isLocked, setLocked, visibleOnly });
})();
