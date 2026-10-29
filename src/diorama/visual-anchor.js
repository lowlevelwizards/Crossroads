"use strict";
// Presentation-only anchor for tabletop formations. The original rules
// engine keeps its authoritative unit center; visual selection targets the
// minis that the player actually sees on the table.
(() => {
  const finite=n=>Number.isFinite(n);
  function resolve(soldiers,living,options={}){
    const count=Math.max(0,Math.min(soldiers?.length||0,Math.floor(Number(living)||0)));
    const fallback=options.fallback||{x:0,z:0};
    const points=[];
    for(let i=0;i<count;i++){
      const soldier=soldiers[i];
      if(!soldier||soldier.pendingRemoval||soldier.figure?.visible===false)continue;
      const pos=soldier.figure?.position||soldier;
      if(finite(pos.x)&&finite(pos.z))points.push({x:pos.x,z:pos.z});
    }
    if(!points.length)return Object.freeze({
      x:fallback.x||0,z:fallback.z||0,count:0,
      radius:Math.max(.38,Number(options.minRadius)||.38)
    });
    let x=0,z=0;
    for(const point of points){x+=point.x;z+=point.z}
    x/=points.length;z/=points.length;
    let radius=0;
    for(const point of points)
      radius=Math.max(radius,Math.hypot(point.x-x,point.z-z));
    return Object.freeze({x,z,count:points.length,
      radius:Math.max(Number(options.minRadius)||.38,
        radius+(Number(options.margin)||.31))});
  }
  function toWorld(root,anchor){
    return Object.freeze({x:root.x+anchor.x,z:root.z+anchor.z});
  }
  window.Crossroads3DVisualAnchor=Object.freeze({resolve,toWorld});
})();
