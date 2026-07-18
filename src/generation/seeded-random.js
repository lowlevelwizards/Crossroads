"use strict";

(() => {
  function hash32(seed, x = 0, y = 0, channel = 0) {
    let value = (Math.trunc(Number(seed) || 0) ^ Math.imul(Math.trunc(x), 0x9e3779b1) ^ Math.imul(Math.trunc(y), 0x85ebca77) ^ Math.imul(Math.trunc(channel), 0xc2b2ae3d)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b) >>> 0;
    value ^= value >>> 16;
    return value >>> 0;
  }

  function unit(seed, x = 0, y = 0, channel = 0) {
    return hash32(seed, x, y, channel) / 4294967295;
  }

  function range(seed, x, y, channel, min, max) {
    return Number(min) + unit(seed, x, y, channel) * (Number(max) - Number(min));
  }

  function integer(seed, x, y, channel, min, maxExclusive) {
    const low = Math.trunc(min);
    const high = Math.max(low + 1, Math.trunc(maxExclusive));
    return low + Math.floor(unit(seed, x, y, channel) * (high - low));
  }

  window.CrossroadsSeededRandom = Object.freeze({ hash32, unit, range, integer });
})();
