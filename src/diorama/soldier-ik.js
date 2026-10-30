"use strict";
(() => {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Analytic two-bone IK with forward-bending knees, in model-local Y/Z.
  function solve({hipY=.54,hipZ=0,footY=.22,footZ=0,upper=.255,lower=.255}={}){
    // Degenerate targets previously let the knee flip or explode into a
    // zero-length direction. Fix the pole in front of the model (-Z/Y).
    upper=Math.max(.02,Number.isFinite(upper)?upper:.255);
    lower=Math.max(.02,Number.isFinite(lower)?lower:.255);
    let dy=footY-hipY,dz=footZ-hipZ;
    let length=Math.hypot(dy,dz);
    if(!Number.isFinite(length)||length<.00001){
      dy=-1;dz=0;length=1;
    }
    const reach=clamp(length,Math.abs(upper-lower)+.0001,
      upper+lower-.0001);
    const uy=dy/length,uz=dz/length;
    const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
    const outward=Math.sqrt(Math.max(0,upper*upper-along*along));
    const kneeY=hipY+uy*along-uz*outward;
    const kneeZ=hipZ+uz*along+uy*outward;
    const ankleY=hipY+uy*reach,ankleZ=hipZ+uz*reach;
    const segment=(ay,az,by,bz)=>({
      y:(ay+by)/2,z:(az+bz)/2,
      length:Math.hypot(by-ay,bz-az),
      rotation:Math.atan2(az-bz,ay-by)
    });
    return Object.freeze({
      hip:{y:hipY,z:hipZ},knee:{y:kneeY,z:kneeZ},
      ankle:{y:ankleY,z:ankleZ},
      thigh:segment(hipY,hipZ,kneeY,kneeZ),
      shin:segment(kneeY,kneeZ,ankleY,ankleZ)
    });
  }
  // Only crossing a physical segment prompts a step. Parallel travel
  // beside a wall is never mistaken for vaulting over it.
  function crossingLift(point,from,to,segments){
    if(!point||!from||!to)return 0;
    const dx=to.x-from.x,dz=to.z-from.z;
    if(Math.hypot(dx,dz)<.1)return 0;
    const cross=(a,b,c,d)=>a*d-b*c;
    let result=0;
    for(const edge of segments||[]){
      const sx=edge.b.x-edge.a.x,sz=edge.b.z-edge.a.z;
      const den=cross(dx,dz,sx,sz);
      if(Math.abs(den)<.00001)continue;
      const rx=edge.a.x-from.x,rz=edge.a.z-from.z;
      const t=cross(rx,rz,sx,sz)/den,u=cross(rx,rz,dx,dz)/den;
      if(t<0||t>1||u<0||u>1)continue;
      const x=from.x+t*dx,z=from.z+t*dz;
      const distance=Math.hypot(point.x-x,point.z-z);
      if(distance>.42)continue;
      const height=edge.kind==="wall"?.22:edge.kind==="hedge"?.17:.12;
      result=Math.max(result,Math.pow(1-distance/.42,2)*height);
    }
    return result;
  }
  // Keep motion readable without causing a foot target to outrun the leg
  // chain. The same envelope is used by the current heroic rig and lab.
  function strideEnvelope(reach=0,lift=0,run=false){
    return Object.freeze({
      reach:clamp(Number.isFinite(reach)?reach:0,run?-.29:-.23,
        run?.29:.23),
      lift:clamp(Number.isFinite(lift)?lift:0,0,run?.20:.16)
    });
  }
  window.Crossroads3DSoldierIK=Object.freeze({
    solve,crossingLift,strideEnvelope
  });
})();