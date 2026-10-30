"use strict";
// Visual-only positioning of individual models near existing authored scenery.
// No changes to unit centers, LOS, cover saves, collision, or movement rules.
(() => {
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function projection(point,segment){
    const dx=segment.b.x-segment.a.x,dz=segment.b.z-segment.a.z;
    const length=Math.hypot(dx,dz);
    if(length<.34)return null;
    const ux=dx/length,uz=dz/length;
    const t=clamp((point.x-segment.a.x)*ux+(point.z-segment.a.z)*uz,0,length);
    const closest={x:segment.a.x+t*ux,z:segment.a.z+t*uz};
    return {t,ux,uz,length,closest,distance:d(point,closest)};
  }
  function findNearest(origin,segments,maxSnap=1.07,threat=null){
    let best=null,bestScore=Infinity;
    for(const segment of segments||[]){
      const proj=projection(origin,segment);
      if(!proj||proj.distance>maxSnap)continue;
      // Favor nearby hard cover over hedges only when distances are similar.
      let score=proj.distance+(segment.kind==="hedge"?.04:0)+
        (segment.kind==="fence"?.08:0);
      if(threat){
        const normal={x:-proj.uz,z:proj.ux};
        const own=(origin.x-proj.closest.x)*normal.x+
          (origin.z-proj.closest.z)*normal.z;
        const enemy=(threat.x-proj.closest.x)*normal.x+
          (threat.z-proj.closest.z)*normal.z;
        // Prefer a barrier BETWEEN the squad and a known enemy rather than
        // the closest decorative wall on the wrong side.
        score+=own*enemy<-.01?-.23:.60;
      }
      if(score<bestScore){
        bestScore=score;best={segment,...proj};
      }
    }
    return best;
  }
  // Descriptive stance for an AUTHORIZED model base; this does not move it
  // behind the nearest wall or claim a rules cover save.
  function assess(point,segments,threat,{maxDistance=.48}={}){
    const found=findNearest(point,segments,maxDistance,threat);
    if(!found)return {cover:false};
    const {segment,closest,ux,uz}=found;
    const nx=-uz,nz=ux;
    const own=(point.x-closest.x)*nx+(point.z-closest.z)*nz;
    const enemy=threat?
      (threat.x-closest.x)*nx+(threat.z-closest.z)*nz:null;
    const protective=enemy==null?false:own*enemy<-.01;
    return protective?{cover:true,kind:segment.kind,frontRow:true,
      look:{x:threat.x,z:threat.z}}:{cover:false};
  }
  function arrange(origin,slots,segments,threat,{maxSnap=1.07,spacing=.37}={}){
    if(!Array.isArray(slots)||!slots.length)return null;
    const cover=findNearest(origin,segments,maxSnap,threat);
    if(!cover)return null;
    const {segment,ux,uz,length,t,closest}=cover;
    // Stay on the same physical side as the authoritative unit center.
    const nx=-uz,nz=ux;
    const signed=(origin.x-closest.x)*nx+(origin.z-closest.z)*nz;
    const opposite=threat?
      (threat.x-closest.x)*nx+(threat.z-closest.z)*nz:0;
    const side=Math.abs(signed)>.04?Math.sign(signed):
      (Math.abs(opposite)>.02?-Math.sign(opposite):1);
    const facingCover=!threat||opposite*side<-.01;
    const margin=Math.min(.24,length*.20);
    const capacity=Math.max(1,Math.floor(Math.max(.05,length-2*margin)/spacing)+1);
    const cols=Math.min(capacity,slots.length);
    const maxStart=Math.max(margin,length-margin-(cols-1)*spacing);
    const start=clamp(t-(cols-1)*spacing/2,margin,maxStart);
    const near=segment.kind==="hedge"?.25:segment.kind==="fence"?.20:.24;
    const points=[];
    for(let i=0;i<slots.length;i++){
      const row=Math.floor(i/cols);
      const column=i%cols;
      // Back ranks preserve spacing rather than spilling through wall ends.
      const along=start+column*spacing;
      const offset=near+row*.38;
      const world={x:segment.a.x+ux*along+nx*side*offset,
        z:segment.a.z+uz*along+nz*side*offset};
      const original={x:origin.x+slots[i].x,z:origin.z+slots[i].z};
      // Do not teleport distant models from the other side of a long wall.
      if(d(world,original)>1.75){
        points.push({x:slots[i].x,z:slots[i].z,cover:false});
        continue;
      }
      points.push({x:world.x-origin.x,z:world.z-origin.z,
        cover:facingCover,kind:segment.kind,frontRow:row===0,
        look:threat?{x:threat.x,z:threat.z}:
          {x:world.x-nx*side,z:world.z-nz*side}});
    }
    return {segmentId:segment.id,points};
  }
  window.Crossroads3DCoverPositions=Object.freeze({
    projection,findNearest,assess,arrange
  });
})();
