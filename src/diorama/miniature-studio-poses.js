"use strict";
// Pure model-space inspection choreography using the same gait/IK helpers
// as live Crossroads soldiers. Looping preview; no battle state.
(() => {
  const ACTIONS=Object.freeze([
    ["idle","Standing / idle"],["aim","Aiming"],["fire","Shooting"],
    ["reload","Reloading"],["walk","Walking"],["run","Running"],
    ["turn","Turning / pivot"],["down","Down / low profile"],
    ["ambush","Ambush / ready"],["cover","In cover"],["pinned","Pinned / suppressed"],
    ["rally","Rally / recovering"],["assault","Assault / charge"],
    ["hit","Hit reaction"],["casualty","Casualty / fall"],
    ["enter","Entering building"],["exit","Exiting building"],
    ["deploy","Deploying gun"],["pack","Packing gun"]
  ]);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const cycle=(t,seconds=1)=>((t%seconds)+seconds)%seconds/seconds;
  function duration(pose){
    return pose==="fire"?.62:pose==="reload"?2.2:
      pose==="casualty"?2.1:pose==="hit"?1.3:
      pose==="deploy"||pose==="pack"?2:1.6;
  }
  function frame(pose,t,motion){
    const q=cycle(t,duration(pose));
    const state={bob:0,lean:0,roll:0,yaw:0,crouch:0,
      leftLift:0,rightLift:0,leftReach:0,rightReach:0,
      flash:false,footOffset:0};
    const walking=pose==="walk"||pose==="run"||pose==="assault"||
      pose==="enter"||pose==="exit";
    if(walking){
      const run=pose==="run"||pose==="assault";
      const distance=t*(run?1.65:1.05);
      const gait=motion.gaitPose(distance,.48,1,0,run);
      const feet=motion.plantedGait?.(distance,.48,1,0,run)||gait;
      state.bob=gait.bob*.055;
      state.leftLift=feet.leftLift;state.rightLift=feet.rightLift;
      state.leftReach=feet.leftReach;state.rightReach=feet.rightReach;
      state.lean=gait.lean+(pose==="assault"?.12:0);
      state.footOffset=Math.sin(t*3)*.025;
      if(pose==="enter"||pose==="exit")state.yaw=Math.sin(t*.9)*.18;
    }
    if(pose==="aim"||pose==="ambush")state.lean=.10;
    if(pose==="down")state.crouch=.73,state.lean=.62;
    if(pose==="cover")state.crouch=.39,state.lean=.22;
    if(pose==="pinned")state.crouch=.47,
      state.roll=Math.sin(t*8)*.09,state.lean=.35;
    if(pose==="fire"){
      state.lean=.12+(q<.15?.20*(1-q/.15):0);
      state.flash=q<.11;
    }
    if(pose==="reload"){
      state.lean=.10+Math.sin(q*Math.PI)*.23;
      state.yaw=Math.sin(q*Math.PI*2)*.11;
    }
    if(pose==="turn")state.yaw=t*.9;
    if(pose==="rally"){
      state.crouch=.30*(1-q);
      state.lean=.18*(1-q);
    }
    if(pose==="hit"){
      state.roll=Math.sin(q*Math.PI)*.25;
      state.lean=Math.sin(q*Math.PI)*.23;
    }
    if(pose==="deploy"||pose==="pack"){
      const u=pose==="pack"?1-q:q;
      state.crouch=u*.46;
      state.lean=u*.35;
      state.yaw=Math.sin(q*Math.PI)*.11;
    }
    if(pose==="casualty"){
      state.roll=clamp(q*2.6,0,1)*1.25;
      state.crouch=.2;
    }
    return state;
  }
  const api=Object.freeze({ACTIONS,frame,duration});
  window.Crossroads3DStudioPoses=api;
  window.Crossroads3DSoldierActions=api;
})();
