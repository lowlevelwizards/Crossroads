"use strict";

(() => {
  const REGISTRY = window.CrossroadsObjectiveRegistry;
  if (!REGISTRY) throw new Error("Objective registry must load before passive objectives.");
  function evaluate(objective) { return { status:"active", summary:objective.summary || "Custom objective" }; }
  function handleEvent(objective, state) { return { score:{blue:0,red:0}, snapshot:evaluate(objective, state) }; }
  REGISTRY.register("custom", { evaluate, handleEvent, validate:() => [] });
})();
