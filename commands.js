"use strict";

// Foundation 2C.3: shared command vocabulary. Desktop and mobile order controls now consume the same order-command descriptions.
window.CrossroadsCommands = Object.freeze({
  makeCommand({ id, label, enabled = true, execute = null, reason = "", meta = {} }) {
    if (!id || !label) throw new Error("Command requires id and label.");
    if (execute !== null && typeof execute !== "function") {
      throw new Error(`Command ${id} execute must be a function or null.`);
    }
    return Object.freeze({
      id,
      label,
      enabled: Boolean(enabled),
      execute,
      reason,
      meta: Object.freeze({ ...meta })
    });
  }
});
