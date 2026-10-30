"use strict";
// Crossroads 3D: presentation probes around authoritative model bases.
// Every result is cosmetic. Never modify rules LOS, saves, moves or models.
(() => {
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number(n)||0));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const HEIGHT=Object.freeze({wall:.49,fence:.38,hedge:.60});
  function projection(p,s){
    const x=s.b.x-s.a.x,z=s.b.z-s.a.z,len=Math.hypot(x,z);
    if(len<.05)return null;
    const ux=x/len,uz=z/len;
    const along=clamp((p.x-s.a.x)*ux+(p.z-s.a.z)*uz,0,len);
    const at={x:s.a.x+along*ux,z:s.a.z+along*uz};
    return {at,distance:distance(p,at),ux,uz,len,along};
  }
  function cover(point,segments,threat,{maxDistance=.55}={}){
    if(!threat||!Number.isFinite(threat.x)||!Number.isFinite(threat.z))
      return Object.freeze({active:false,stance:"open"});
    let best=null,score=Infinity;
    for(const segment of segments||[]){
      if(!HEIGHT[segment.kind])continue;
      const p=projection(point,segment);
      if(!p||p.distance>maxDistance)continue;
      const nx=-p.uz,nz=p.ux;
      const own=(point.x-p.at.x)*nx+(point.z-p.at.z)*nz;
      const enemy=(threat.x-p.at.x)*nx+(threat.z-p.at.z)*nz;
      if(own*enemy>=-.008)continue;
      const rating=p.distance+(segment.kind==="fence"?.08:0);
      if(rating<score){score=rating;best={segment,p};}
    }
    if(!best)return Object.freeze({active:false,stance:"open"});
    const {segment,p}=best;
    const wallHeight=HEIGHT[segment.kind];
    const stance=segment.kind==="hedge"?"kneel":
      p.distance<.22?"brace":"crouch";
    return Object.freeze({active:true,kind:segment.kind,stance,
      distance:p.distance,height:wallHeight,
      crouch:stance==="kneel"?.47:stance==="brace"?.19:.33,
      lean:stance==="brace"?.12:.18,
      aimClearance:segment.kind==="hedge"?.12:.055,
      facing:Math.atan2(threat.z-point.z,threat.x-point.x),
      segmentId:segment.id||null});
  }
  // Intersections only with an explicitly rules-authorized presentation
  // path. No animated "vault" if the legal path runs alongside a wall.
  function crossings(path,segments,{maxEvents=5}={}){
    if(!Array.isArray(path)||path.length<2)return Object.freeze([]);
    const result=[];
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],rx=b.x-a.x,rz=b.z-a.z;
      for(const s of segments||[]){
        if(!HEIGHT[s.kind])continue;
        const sx=s.b.x-s.a.x,sz=s.b.z-s.a.z;
        const denom=rx*sz-rz*sx;
        if(Math.abs(denom)<1e-6)continue;
        const qx=s.a.x-a.x,qz=s.a.z-a.z;
        const t=(qx*sz-qz*sx)/denom,u=(qx*rz-qz*rx)/denom;
        if(t<=.06||t>=.94||u<.02||u>.98)continue;
        const pathLength=path.slice(1).reduce((n,p,k)=>n+
          distance(p,path[k]),0);
        const before=path.slice(1,i).reduce((n,p,k)=>n+
          distance(p,path[k]),0);
        const at=pathLength?(before+distance(a,b)*t)/pathLength:0;
        result.push(Object.freeze({at,kind:s.kind,height:HEIGHT[s.kind],
          segmentId:s.id||null,step:i,world:{x:a.x+rx*t,z:a.z+rz*t}}));
      }
    }
    result.sort((a,b)=>a.at-b.at||String(a.segmentId).localeCompare(String(b.segmentId)));
    const dedup=[];
    for(const r of result)if(!dedup.some(x=>Math.abs(x.at-r.at)<.045))
      dedup.push(r);
    return Object.freeze(dedup.slice(0,maxEvents));
  }
  function traverse(progress,events,{run=false,reducedMotion=false}={}){
    if(reducedMotion)return Object.freeze({active:false,lift:0,crouch:0,
      leftLift:0,rightLift:0,lean:0});
    let nearest=null,best=Infinity;
    for(const e of events||[]){
      const diff=Math.abs(progress-e.at);
      if(diff<best){nearest=e;best=diff;}
    }
    const width=run?.088:.12;
    if(!nearest||best>=width)return Object.freeze({active:false,lift:0,
      crouch:0,leftLift:0,rightLift:0,lean:0});
    const q=clamp((progress-nearest.at+width)/(width*2));
    const lift=Math.sin(q*Math.PI);
    const obstacle=nearest.kind==="hedge"?.16:nearest.height;
    const lead=Math.sin(clamp(q*2)*Math.PI);
    const follow=Math.sin(clamp((q-.5)*2)*Math.PI);
    return Object.freeze({active:true,kind:nearest.kind,phase:q,
      lift:Math.min(.25,obstacle*.36)*lift,
      crouch:.10*Math.sin(q*Math.PI),
      leftLift:Math.max(0,lead)*.095,
      rightLift:Math.max(0,follow)*.095,
      lean:.15*Math.sin(q*Math.PI)});
  }
  function windowPosture(occupied,slot,threat){
    if(!occupied||!slot||slot.kind!=="building")
      return Object.freeze({active:false});
    const facing=slot.look||threat||null;
    return Object.freeze({active:true,crouch:.16,lean:.13,
      windowFacing:facing,aimClearance:.09,
      // Window sockets present occupancy; combat still uses building-level LOS.
      authoritative:false});
  }
  window.Crossroads3DTerrainInteractions=Object.freeze({
    projection,cover,crossings,traverse,windowPosture,HEIGHT
  });
})();