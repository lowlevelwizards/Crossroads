"use strict";
// Pure, deterministic model-space window sockets, not a second LOS rule.
(() => {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function facade(bounds,threat){
    const dx=(threat?.x??bounds.x+1)-bounds.x;
    const dz=(threat?.z??bounds.z)-bounds.z;
    const alongX=Math.abs(dx/Math.max(.01,bounds.width)) >=
      Math.abs(dz/Math.max(.01,bounds.depth));
    const side=(alongX?dx:dz)<0?-1:1;
    return Object.freeze({axis:alongX?"x":"z",side,
      normal:{x:alongX?side:0,z:alongX?0:side}});
  }
  function authoredSlots(sockets,threat,count){
    if(!Array.isArray(sockets)||!sockets.length||!count)return [];
    const target=threat||{x:0,z:-100};
    const facing=sockets.filter(socket=>socket&&
      Number.isFinite(socket.x)&&Number.isFinite(socket.z)&&
      Number.isFinite(socket.normal?.x)&&
      Number.isFinite(socket.normal?.z)).map(socket=>{
      const dx=target.x-socket.x,dz=target.z-socket.z;
      const dot=dx*socket.normal.x+dz*socket.normal.z;
      return {socket,dot};
    });
    if(!facing.length)return [];
    const best=Math.max(...facing.map(s=>s.dot));
    // A figure may use a real window only on an exposed facade.
    const choices=facing.filter(s=>s.dot>=Math.max(.001,best*.3))
      .sort((a,b)=>b.dot-a.dot||a.socket.x-b.socket.x||
        a.socket.z-b.socket.z).map(s=>s.socket);
    if(!choices.length)return [];
    const points=[];
    for(let i=0;i<count;i++){
      const socket=choices[i%choices.length];
      const row=Math.floor(i/choices.length);
      // Each additional rank goes deeper into the structure; the front
      // window remains available to a single firing model.
      const recess=.18+row*.43;
      const x=socket.x-socket.normal.x*recess;
      const z=socket.z-socket.normal.z*recess;
      points.push({x,z,kind:"building",frontRow:row===0,cover:true,
        windowSocket:socket,look:{x:x+socket.normal.x,z:z+socket.normal.z}});
    }
    return points;
  }
  function slots(bounds,threat,count,sockets=null){
    if(Array.isArray(sockets)&&sockets.length)
      return authoredSlots(sockets,threat,count);
    const face=facade(bounds,threat);
    const alongLength=face.axis==="x"?bounds.depth:bounds.width;
    // Use actual facade bays; never place a figure in the wall corner.
    const width=Math.max(.2,alongLength-.38);
    const columns=Math.max(1,Math.floor(width/.42));
    const output=[];
    for(let i=0;i<count;i++){
      const row=Math.floor(i/columns);
      const column=i%columns;
      const rowCount=Math.min(columns,count-row*columns);
      const along=(column-(rowCount-1)/2)*Math.min(.43,width/Math.max(1,rowCount));
      const inset=Math.min(.31,.16+row*.12);
      const x=face.axis==="x"?
        bounds.x+face.side*(bounds.width/2-inset):bounds.x+along;
      const z=face.axis==="z"?
        bounds.z+face.side*(bounds.depth/2-inset):bounds.z+along;
      output.push({x,z,frontRow:row===0,kind:"building",
        cover:true,facade:face.axis+(face.side>0?"+":"-"),
        look:{x:x+face.normal.x,z:z+face.normal.z}});
    }
    return output;
  }
  function outlet(bounds,from,threat,sockets=null){
    if(Array.isArray(sockets)&&sockets.length){
      const target=threat||{x:bounds.x+1,z:bounds.z};
      const usable=sockets.filter(socket=>socket&&
        Number.isFinite(socket.x)&&Number.isFinite(socket.z)&&
        Number.isFinite(socket.normal?.x)&&
        Number.isFinite(socket.normal?.z)&&socket.outlet&&
        Number.isFinite(socket.outlet.x)&&Number.isFinite(socket.outlet.z));
      const visible=usable.filter(socket=>
        (target.x-socket.x)*socket.normal.x+
        (target.z-socket.z)*socket.normal.z>.01);
      const candidates=visible.length?visible:usable;
      const nearest=candidates.slice().sort((a,b)=>
        Math.hypot(a.x-from.x,a.z-from.z)-
        Math.hypot(b.x-from.x,b.z-from.z))[0];
      if(nearest)return {...nearest.outlet,facade:nearest.normal};
      // Invalid sockets fall back to safe geometry-based facade bays.
    }
    const face=facade(bounds,threat);
    const inset=.08;
    const width=face.axis==="x"?bounds.depth:bounds.width;
    const along=face.axis==="x"?from.z-bounds.z:from.x-bounds.x;
    // Nearest fixed window bay (no arbitrary muzzles through solid corners).
    const bays=Math.max(1,Math.floor((width-.38)/.42));
    const pitch=(width-.38)/Math.max(1,bays);
    const index=clamp(Math.round(along/Math.max(.01,pitch)+(bays-1)/2),0,bays-1);
    const offset=(index-(bays-1)/2)*pitch;
    return face.axis==="x"?
      {x:bounds.x+face.side*(bounds.width/2+inset),z:bounds.z+offset,facade:face}:
      {x:bounds.x+offset,z:bounds.z+face.side*(bounds.depth/2+inset),facade:face};
  }
  window.Crossroads3DGarrisonWindows=Object.freeze({facade,slots,outlet,authoredSlots});
})();