"use strict";

(() => {
  const COMPONENT_FIELDS = Object.freeze({ pointIndex:"point", segmentIndex:"segment" });

  function normalize(selection) {
    if (!selection) return null;
    const sourceObject = selection.object ?? {};
    const object = {
      kind:selection.kind ?? sourceObject.kind,
      id:selection.id ?? sourceObject.id,
      faction:selection.faction ?? sourceObject.faction,
      zoneId:selection.zoneId ?? sourceObject.zoneId
    };
    let component = selection.component ?? null;
    if (selection.pointIndex !== undefined) component = { type:object.kind === "patch" ? "vertex" : object.kind === "objective" ? "objectivePoint" : "waypoint", index:Number(selection.pointIndex) };
    else if (selection.segmentIndex !== undefined) component = { type:object.kind === "patch" ? "edge" : "segment", index:Number(selection.segmentIndex) };
    const result = {
      object:{ kind:object.kind, id:object.id, faction:object.faction, zoneId:object.zoneId },
      component:component ? { type:component.type, index:Number(component.index) } : null,
      kind:object.kind,
      id:object.id,
      faction:object.faction,
      zoneId:object.zoneId
    };
    if (result.component?.type === "waypoint" || result.component?.type === "vertex" || result.component?.type === "objectivePoint") result.pointIndex = result.component.index;
    if (result.component?.type === "segment" || result.component?.type === "edge") result.segmentIndex = result.component.index;
    return result;
  }

  function objectOnly(selection) {
    const normalized = normalize(selection);
    if (!normalized) return null;
    return normalize({ object:normalized.object });
  }

  function withComponent(selection, type, index) {
    const normalized = normalize(selection);
    if (!normalized) return null;
    return normalize({ object:normalized.object, component:{ type, index } });
  }

  function sameObject(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    if (!left || !right) return false;
    return left.kind === right.kind && String(left.id ?? "") === String(right.id ?? "") && String(left.faction ?? "") === String(right.faction ?? "") && String(left.zoneId ?? "") === String(right.zoneId ?? "");
  }

  function key(selection) {
    const value = normalize(selection);
    if (!value) return "";
    return [value.kind, value.faction, value.id, value.zoneId, value.component?.type, value.component?.index].filter(part => part !== undefined && part !== null).join(":");
  }

  function level(selection) {
    return normalize(selection)?.component ? "component" : selection ? "object" : "none";
  }

  function componentLabel(selection) {
    const value = normalize(selection);
    if (!value?.component) return null;
    const labels = { waypoint:"Waypoint", vertex:"Vertex", segment:"Section", edge:"Edge", objectivePoint:"Objective point" };
    return `${labels[value.component.type] ?? value.component.type} ${value.component.index + 1}`;
  }

  function describe(selection, item = null) {
    const value = normalize(selection);
    if (!value) return "Nothing selected";
    const objectLabel = String(item?.label || item?.name || item?.id || value.id || value.zoneId || value.kind);
    const component = componentLabel(value);
    return component ? `${objectLabel} · ${component}` : `${objectLabel} · Whole ${value.kind}`;
  }

  window.CrossroadsEditorSelection = Object.freeze({ normalize, objectOnly, withComponent, sameObject, key, level, componentLabel, describe, COMPONENT_FIELDS });
})();
