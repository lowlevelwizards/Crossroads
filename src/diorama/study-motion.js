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
      pace:1,delay:0,
      stepLength:.48+oscillation*.035,
      phase:Math.sin(n*2.51)*.24,
      bob:.052+(.5+.5*Math.cos(n*2.14))*.014
    });
  }
  // Brief ramp-up and braking; the middle 80% moves at steady speed.
  // This integral drives every model's translation, feet and bounce.
  function travelProgress(elapsed,duration){
    const u=clamp(elapsed/Math.max(.001,duration),0,1);
    const a=.095,b=.88,normal=1-(a+(1-b))/2;
    if(u<a)return u*u/(2*a*normal);
    if(u<b)return (u-a/2)/normal;
    const v=1-u;
    return 1-v*v/(2*(1-b)*normal);
  }
  function travelVelocity(elapsed,duration){
    const u=clamp(elapsed/Math.max(.001,duration),0,1);
    const a=.095,b=.88,normal=1-(a+(1-b))/2;
    if(u<a)return (u/a)/normal;
    if(u<b)return 1/normal;
    return ((1-u)/(1-b))/normal;
  }
  // Each leg alternates between a stable stance and a lifted swing.
  // Distance-driven phase means a motionless miniature never jogs in place.
  function gaitPose(travelled,stepLength,speedRatio,phase=0,run=false){
    const angle=travelled/Math.max(.28,stepLength*(run?1.16:1))*Math.PI*2+phase;
    const drive=clamp(speedRatio,0,1);
    const swing=Math.sin(angle);
    const lift=(v)=>Math.pow(Math.max(0,v),1.3)*(run?.18:.105)*drive;
    return {legs:swing*(run?.74:.56)*drive,
      leftLift:lift(swing),rightLift:lift(-swing),
      leftReach:swing*(run?.11:.075)*drive,
      rightReach:-swing*(run?.11:.075)*drive,
      bob:(1-Math.cos(angle*2))*.5*drive*(run?1.35:1),
      lean:drive*(run?.15:.075)};
  }
  // The stance boot's rearward travel cancels the miniature's forward
  // translation until toe-off; distance-driven and stationary when stopped.
  function plantedGait(travelled,stepLength,speedRatio=1,phase=0,run=false){
    const cycle=Math.max(.28,stepLength*(run?1.14:1));
    const duty=run?.53:.61;
    const reach=cycle*duty;
    const base=((travelled/cycle+phase/(Math.PI*2))%1+1)%1;
    const drive=clamp(speedRatio,0,1);
    function foot(time){
      const u=((time%1)+1)%1;
      if(u<duty)return {reach:-reach/2+u/duty*reach,lift:0,planted:true};
      const swing=(u-duty)/(1-duty),ease=swing*swing*(3-2*swing);
      return {reach:reach/2-ease*reach,
        lift:Math.sin(swing*Math.PI)*(run?.20:.12)*drive,planted:false};
    }
    const left=foot(base),right=foot(base+.5);
    return Object.freeze({
      leftReach:left.reach*drive,rightReach:right.reach*drive,
      leftLift:left.lift,rightLift:right.lift,
      leftPlanted:left.planted,rightPlanted:right.planted,phase:base
    });
  }
  function progressFor(elapsed,duration){return travelProgress(elapsed,duration)}
  function travelDuration(distance,run=false){
    const speed=run?1.95:1.19;
    return clamp(distance/Math.max(.25,speed),.39,5.0);
  }
  function finishTime(duration){return duration}
  window.CrossroadsDioramaMotion = Object.freeze({
    heading, shortestDelta, makeTurn, headingAt, gaitFor, progressFor,
    travelDuration,finishTime,travelProgress,travelVelocity,gaitPose,plantedGait
  });
})();
