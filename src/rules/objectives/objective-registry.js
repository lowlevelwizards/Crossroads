"use strict";

(() => {
  const evaluators = new Map();

  function register(type, evaluator) {
    const key = String(type || "").trim();
    if (!key || !evaluator || typeof evaluator.evaluate !== "function") {
      throw new Error("Objective evaluators require a type and evaluate function.");
    }
    if (evaluators.has(key)) throw new Error(`Objective evaluator already registered: ${key}`);
    evaluators.set(key, Object.freeze({ ...evaluator, type:key }));
  }

  function get(type) {
    const evaluator = evaluators.get(String(type || "control_zone"));
    if (!evaluator) throw new Error(`Unknown objective type: ${type}`);
    return evaluator;
  }

  function has(type) {
    return evaluators.has(String(type || ""));
  }

  function types() {
    return [...evaluators.keys()];
  }

  window.CrossroadsObjectiveRegistry = Object.freeze({ register, get, has, types });
})();
