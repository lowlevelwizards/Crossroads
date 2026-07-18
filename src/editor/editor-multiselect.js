"use strict";

(() => {
  const SELECTION = window.CrossroadsEditorSelection;

  function objectKey(selection) {
    return SELECTION.key(SELECTION.objectOnly(selection));
  }

  function unique(selections = []) {
    const seen = new Set();
    const result = [];
    for (const selection of selections) {
      const normalized = SELECTION.objectOnly(selection);
      const key = objectKey(normalized);
      if (!normalized || !key || seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
    }
    return result;
  }

  function contains(selections, selection) {
    const key = objectKey(selection);
    return Boolean(key && unique(selections).some(item => objectKey(item) === key));
  }

  function toggle(selections, selection) {
    const normalized = SELECTION.objectOnly(selection);
    if (!normalized) return unique(selections);
    const key = objectKey(normalized);
    const current = unique(selections);
    const index = current.findIndex(item => objectKey(item) === key);
    if (index >= 0) current.splice(index, 1);
    else current.push(normalized);
    return current;
  }

  function unionBounds(bounds = []) {
    const valid = bounds.filter(Boolean);
    if (!valid.length) return null;
    const x = Math.min(...valid.map(item => item.x));
    const y = Math.min(...valid.map(item => item.y));
    const right = Math.max(...valid.map(item => item.x + item.width));
    const bottom = Math.max(...valid.map(item => item.y + item.height));
    return { x, y, width:right-x, height:bottom-y, centerX:(x+right)/2, centerY:(y+bottom)/2 };
  }

  function intersects(a, b) {
    return Boolean(a && b && a.x <= b.x+b.width && a.x+a.width >= b.x && a.y <= b.y+b.height && a.y+a.height >= b.y);
  }

  function rotatePoint(point, center, degrees) {
    const radians = Number(degrees) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dx = Number(point.x) - Number(center.x);
    const dy = Number(point.y) - Number(center.y);
    return { ...point, x:Number(center.x)+dx*cosine-dy*sine, y:Number(center.y)+dx*sine+dy*cosine };
  }

  window.CrossroadsEditorMultiSelect = Object.freeze({ objectKey, unique, contains, toggle, unionBounds, intersects, rotatePoint });
})();
