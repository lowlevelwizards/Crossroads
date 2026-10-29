"use strict";
// A single deterministic model-position resolver for both preview and final pose.
// Unit centers, movement legalities, and combat cohesion are engine-owned.
(() => {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function cohere(points,{maxNeighbor=.57,minBase=.29}={}){
    const result=[];
    for(const point of points){
      let p={...point},near=null,best=Infinity;
      for(const other of result){
        const d=distance(p,other);
        if(d<best){best=d;near=other}
      }
      if(near){
        const dx=p.x-near.x,dz=p.z-near.z;
        const d=Math.max(.0001,Math.hypot(dx,dz));
        if(d>maxNeighbor){
          const f=maxNeighbor/d;
          p.x=near.x+dx*f;p.z=near.z+dz*f;
        }else if(d<minBase){
          const f=minBase/d;
          p.x=near.x+dx*f;p.z=near.z+dz*f;
        }
      }
      result.push(p);
    }
    return result;
  }
  function buildingSlots(origin,slots,bounds,threat,windows=null){
    const sockets=window.Crossroads3DGarrisonWindows?.slots(bounds,threat,slots.length,windows);
    if(sockets)return sockets.map(socket=>({
      ...socket,x:socket.x-origin.x,z:socket.z-origin.z
    }));
    const dx=threat?threat.x-bounds.x:1,dz=threat?threat.z-bounds.z:0;
    const faceX=Math.abs(dx)>Math.abs(dz);
    const width=Math.max(.35,(faceX?bounds.depth:bounds.width)-.58);
    const cols=Math.max(1,Math.floor(width/.38)+1);
    const arr=[];
    for(let i=0;i<slots.length;i++){
      const row=Math.floor(i/cols),count=Math.min(cols,slots.length-row*cols);
      const along=(i%cols-(count-1)/2)*.38;
      const depth=.28+row*.39;
      const world=faceX?{
        x:bounds.x+Math.sign(dx||1)*Math.max(.18,bounds.width/2-depth),
        z:bounds.z+along
      }:{
        x:bounds.x+along,
        z:bounds.z+Math.sign(dz||1)*Math.max(.18,bounds.depth/2-depth)
      };
      arr.push({x:world.x-origin.x,z:world.z-origin.z,
        cover:true,frontRow:row===0,kind:"building",
        look:threat||{x:world.x+Math.sign(dx||1),z:world.z+Math.sign(dz||1)}});
    }
    return arr;
  }
  function capTravel(points,origin,move){
    if(!move?.startOrigin||!Array.isArray(move.startPoints))return points;
    const shift={x:origin.x-move.startOrigin.x,z:origin.z-move.startOrigin.z};
    const length=Math.hypot(shift.x,shift.z);
    const heading=length>1e-6?{x:shift.x/length,z:shift.z/length}:{x:0,z:0};
    return points.map((point,i)=>{
      const start=move.startPoints[i];
      if(!start)return point;
      const source={x:move.startOrigin.x+start.x,z:move.startOrigin.z+start.z};
      const translated={x:source.x+shift.x,z:source.z+shift.z};
      const next={x:origin.x+point.x,z:origin.z+point.z};
      const forward=(next.x-translated.x)*heading.x+
        (next.z-translated.z)*heading.z;
      if(forward>move.forwardBudget){
        next.x-=heading.x*(forward-move.forwardBudget);
        next.z-=heading.z*(forward-move.forwardBudget);
      }
      const dx=next.x-source.x,dz=next.z-source.z;
      const travelled=Math.hypot(dx,dz);
      if(travelled>move.maxDistance&&travelled>1e-6){
        next.x=source.x+dx*move.maxDistance/travelled;
        next.z=source.z+dz*move.maxDistance/travelled;
      }
      return {...point,x:next.x-origin.x,z:next.z-origin.z};
    });
  }
  function resolve({origin,slots,living,segments=[],coverPositions=null,
     buildingBounds=null,buildingWindows=null,threat=null,cohesion=.57,move=null}={}){
    const count=Math.max(0,Math.min(slots?.length||0,
      Number.isFinite(living)?Math.floor(living):slots?.length||0));
    const originals=(slots||[]).slice(0,count)
      .map(p=>({x:p.x,z:p.z,cover:false}));
    let points=originals,source="open";
    if(buildingBounds){
      points=buildingSlots(origin,originals,buildingBounds,threat,buildingWindows);
      source="building";
    }else if(coverPositions){
      const cover=coverPositions.arrange(origin,originals,segments,threat,{
        maxSnap:1.04,spacing:.38
      });
      if(cover){points=cover.points;source="cover"}
    }
    return Object.freeze({source,
      points:capTravel(cohere(points,{maxNeighbor:cohesion}),origin,move)});
  }
  window.Crossroads3DFormationLayout=Object.freeze({resolve,cohere,buildingSlots,capTravel});
})();
