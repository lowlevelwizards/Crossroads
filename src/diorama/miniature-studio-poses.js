"use strict";
// Pure model-space inspection choreography using the same gait/IK helpers
// as live Crossroads soldiers. Looping preview; no battle state.
(() => {
  const ACTIONS=Object.freeze([
    ["reference","Standing / unarmed"],["tpose","T-pose / unarmed"],
    ["idle","Standing / equipped"],["relaxed","Relaxed carry"],
    ["ready","Alert / ready"],["acquire","Raise to iron sights"],
    ["aim","Aiming / ADS"],["fire","Shooting"],["cycle","Cycle bolt"],
    ["recover","Lower after firing"],["scan","Scanning for threats"],
    ["transition","Custom posture transition"],
    ["reload","Reloading"],["fire-sequence","Complete firing sequence"],
    ["burst-sequence","Automatic burst / recoil"],
    ["impact-sequence","Incoming fire / suppression"],
    ["walk","Walking"],["run","Running"],
    ["turn","Turning / pivot"],["down","Down / low profile"],
    ["ambush","Ambush / ready"],["cover","In cover"],
    ["kneel","Kneeling / braced"],["pinned","Pinned / suppressed"],
    ["rally","Rally / recovering"],["assault","Assault / charge"],
    ["hit","Hit reaction"],["casualty","Casualty / fall"],
    ["enter","Entering building"],["exit","Exiting building"],
    ["deploy","Deploying gun"],["pack","Packing gun"],
    ["crew-deploy","Crew · complete deployment"],
    ["crew-ready","Crew · mounted and ready"],
    ["crew-traverse","Crew · traverse 90° sector"],
    ["crew-fire","Crew · fire and feed"],
    ["crew-pack","Crew · pack and leave"],
    ["crew-pinned","Crew · suppressed"],
    ["crew-rally","Crew · morale recovery"]
  ]);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const cycle=(t,seconds=1)=>((t%seconds)+seconds)%seconds/seconds;
  function duration(pose){
    return pose.startsWith("crew-")?
      (pose==="crew-deploy"||pose==="crew-pack"?1.15:2.0):
      pose==="fire-sequence"?2.4:pose==="burst-sequence"?2.4:
      pose==="impact-sequence"?1.8:
      pose==="fire"?.62:pose==="reload"?2.2:
      pose==="casualty"?2.1:pose==="hit"?1.3:
      pose==="deploy"||pose==="pack"?2:1.6;
  }
  function frame(pose,t,motion,role="rifle"){
    // A casualty is a one-shot transition with a persistent end pose.
    const q=pose==="casualty"?clamp(t/duration(pose),0,1):cycle(t,duration(pose));
    const state={bob:0,lean:0,roll:0,yaw:0,crouch:0,
      leftLift:0,rightLift:0,leftReach:0,rightReach:0,
      forward:0,gesture:0,aim:false,recoil:0,fall:0,headDuck:0,
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
    if(pose==="fire-sequence"||pose==="burst-sequence"){
      const weapon=window.Crossroads3DWeaponPresentation;
      const actionRole=["rifle","officer","smg","lmg","mmg"].includes(role)?
        role:"rifle";
      const count=pose==="burst-sequence"?
        (actionRole==="rifle"||actionRole==="officer"?2:5):
        (actionRole==="rifle"||actionRole==="officer"?1:3);
      const shots=weapon?.schedule([{key:actionRole,shots:count}],
        [{role:actionRole}])||[];
      const fireStart=.42;
      const first=shots.filter(s=>q*duration(pose)>=fireStart+s.delay)
        .slice(-1)[0];
      const elapsed=q*duration(pose);
      state.aim=true;state.lean=.08;state.weaponReadiness=1;
      if(elapsed<fireStart){
        state.weaponBlend=Math.min(1,elapsed/fireStart);
      }else if(elapsed>duration(pose)-.65){
        state.weaponBlend=Math.max(0,Math.min(1,
          (duration(pose)-elapsed)/.65));
      }else state.weaponBlend=1;
      if(first){
        const since=elapsed-fireStart-first.delay;
        const action=weapon?.motionAt(actionRole,since)||{};
        state.weaponCycle=action.weaponCycle||0;
        state.recoil=action.recoil||0;
        state.flash=shots.some(s=>elapsed>=fireStart+s.delay&&
          elapsed<fireStart+s.delay+.065);
      }
    }
    if(pose==="impact-sequence"){
      state.headDuck=Math.sin(Math.PI*q)*.20;
      state.roll=Math.sin(Math.PI*q)*.18;
      state.crouch=q<.45?q*.95:Math.max(0,(1-q)*.78);
      state.lean=Math.sin(Math.PI*q)*.21;
    }
    if(pose.startsWith("crew-")){
      const mode=pose.slice(5);
      const crew=window.Crossroads3DCrewPresentation;
      const unit={type:"mmgTeam",soldiers:3,mmgDeployed:mode!=="pack"};
      const data=crew?.frame(unit,
        mode==="pinned"||mode==="rally"?"ready":mode,t,0);
      state.crouch=data?.crouch||0;
      state.lean=data?.lean||0;
      state.weaponReadiness=data?.readiness||0;
      state.weaponBlend=mode==="fire"?1:mode==="ready"?.7:0;
      state.aim=mode==="fire"||mode==="traverse";
      state.recoil=mode==="fire"?(data?.activity||0)*.15:0;
      if(mode==="traverse")state.yaw=(q-.5)*Math.PI/2;
      if(mode==="pinned"){state.crouch=.48;state.headDuck=.16;}
      if(mode==="rally"){state.crouch=.38*(1-q);state.gesture=Math.sin(q*Math.PI);}
    }
    if(pose==="aim"||pose==="ambush"){state.lean=.08;state.aim=true;}
    if(pose==="down"){
      state.crouch=.84;state.lean=.24;state.forward=.12;
      state.headDuck=.14;
    }
    if(pose==="cover")state.crouch=.42,state.lean=.16;
    if(pose==="kneel"){
      state.crouch=.48;state.lean=.10;state.aim=true;
      state.forward=.06;
    }
    if(pose==="pinned")state.crouch=.47,
      state.roll=Math.sin(t*8)*.09,state.lean=.35;
    if(pose==="fire"){
      state.lean=.09+(q<.15?.07*(1-q/.15):0);
      state.aim=true;state.recoil=q<.18?(1-q/.18)*.17:0;
      state.flash=q<.11;
    }
    if(pose==="reload"){
      state.aim=true;
      state.lean=.08+Math.sin(q*Math.PI)*.12;
      state.yaw=Math.sin(q*Math.PI*2)*.11;
    }
    if(pose==="turn")state.yaw=t*.9;
    if(pose==="rally"){
      state.crouch=.30*(1-q);
      state.lean=.18*(1-q);
      state.gesture=Math.sin(q*Math.PI)*.9;
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
    // Same pure posture definitions are inspected without mutable battle state.
    Object.assign(state,window.Crossroads3DSoldierPose?.lab(pose,q)||{});
    if(pose==="aim"){state.weaponReadiness=1;state.weaponBlend=1;}
    if(pose==="fire"){state.weaponReadiness=1;state.weaponBlend=1;}
    if(pose==="cycle"){
      state.weaponReadiness=1;state.weaponBlend=.8;
      state.weaponCycle=Math.sin(q*Math.PI);
    }
    if(pose==="fire-sequence"||pose==="burst-sequence"){
      state.weaponReadiness=1;
      state.aim=true;
    }
    if(pose==="ambush"){state.weaponReadiness=.8;state.weaponBlend=0;}
    if(pose==="kneel")state.weaponReadiness=1;
    if(pose==="casualty"){
      state.fall=clamp(q*1.15,0,1);
      state.roll=state.fall*1.25; // classic-model compatibility
      state.crouch=.28;state.lean=.22;
    }
    return state;
  }
  const api=Object.freeze({ACTIONS,frame,duration});
  window.Crossroads3DStudioPoses=api;
  window.Crossroads3DSoldierActions=api;
})();
