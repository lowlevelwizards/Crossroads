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
  function slots(bounds,threat,count){
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
  function outlet(bounds,from,threat){
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
  window.Crossroads3DGarrisonWindows=Object.freeze({facade,slots,outlet});
})();