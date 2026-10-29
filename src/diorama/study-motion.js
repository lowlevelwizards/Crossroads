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
      fraction: .66 + (((index * 5 + 2) % 7) / 6) * .34
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
  // Subtle per-model differences, not a separate game speed stat.
  // Each miniature follows the same authorized move, but has its own
  // measured cadence and settles back into the exact authored slot.
  function gaitFor(unitIndex, soldierIndex) {
    const n = unitIndex * 17 + soldierIndex * 7;
    const oscillation = Math.sin(n * 1.371 + 2.37);
    return Object.freeze({
      pace: 1 + oscillation * .14, // 0.86–1.14× duration (visual only)
      delay: .03 + (.5 + .5 * Math.sin(n * 2.51 + .34)) * .14,
      stride: 5.7 + (.5 + .5 * Math.sin(n * 1.74)) * 3.6,
      bob: .084 + (.5 + .5 * Math.cos(n * 2.14)) * .054
    });
  }
  function progressFor(elapsed, duration, gait) {
    return clamp((elapsed - gait.delay) / (duration * gait.pace), 0, 1);
  }
  function travelDuration(distance,run=false){
    const speed=run?2.55:1.73;
    return clamp(distance/Math.max(.25,speed),.29,2.15);
  }
  function finishTime(duration, gaits) {
    return Math.max(duration, ...gaits.map(gait => gait.delay + duration * gait.pace));
  }
  window.CrossroadsDioramaMotion = Object.freeze({
    heading, shortestDelta, makeTurn, headingAt, gaitFor, progressFor,
    travelDuration,finishTime
  });
})();
