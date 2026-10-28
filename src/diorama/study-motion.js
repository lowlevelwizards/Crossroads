"use strict";

// Visual-only turn choreography for the 3D squad study.
// Logical move distance, allowance and commitment belong to CrossroadsMovementRules.
(() => {
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const shortestDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  function heading(start, end) {
    return Math.atan2(-(end.x - start.x), -(end.z - start.z));
  }
  function makeTurn(starts, goal) {
    const turns = starts.map((start, index) => Object.freeze({
      start,
      delta: shortestDelta(start, goal),
      // Each figure pivots at a slightly different pace; all finish before marching.
      fraction: 0.76 + (index % 6) * 0.045
    }));
    const longest = Math.max(0, ...turns.map(turn => Math.abs(turn.delta)));
    return Object.freeze({
      duration: clamp(longest / 4.6, 0.18, 0.69),
      turns: Object.freeze(turns)
    });
  }
  function headingAt(turn, progress) {
    const normalized = clamp(progress / turn.fraction, 0, 1);
    const eased = normalized * normalized * (3 - 2 * normalized);
    return turn.start + turn.delta * eased;
  }
  window.CrossroadsDioramaMotion = Object.freeze({ heading, shortestDelta, makeTurn, headingAt });
})();
