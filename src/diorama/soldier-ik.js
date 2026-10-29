"use strict";
(() => {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Analytic two-bone IK with forward-bending knees, in model-local Y/Z.
  function solve({hipY=.54,hipZ=0,footY=.22,footZ=0,upper=.255,lower=.255}={}){
    const dy=footY-hipY,dz=footZ-hipZ;
    const length=Math.hypot(dy,dz);
    const reach=clamp(length,Math.abs(upper-lower)+.0001,upper+lower-.0001);
    const uy=dy/Math.max(.00001,length),uz=dz/Math.max(.00001,length);
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
  window.Crossroads3DSoldierIK=Object.freeze({solve,crossingLift});
})();