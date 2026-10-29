"use strict";
// Models live pointer identities without depending on browser pointer-event order.
// iOS can abandon capture during a home/app-switch swipe without a pointerup.
(() => {
  function createPointerGuard(onAbandon=()=>{}) {
    const pointers=new Map(),tapStarts=new Map();
    let generation=0;
    function end(id){
      if(!pointers.has(id)){tapStarts.delete(id);return false}
      pointers.delete(id);tapStarts.delete(id);onAbandon(id);
      return true;
    }
    function reset(touchOnly=false){
      for(const [id,p] of [...pointers])
        if(!touchOnly||p.pointerType==="touch")end(id);
    }
    function begin(event){
      // A fresh primary touch is the start of a NEW iOS contact sequence.
      // Any previously retained touch IDs are ghosts, not a second finger.
      if(event.pointerType==="touch"&&event.isPrimary)reset(true);
      generation++;
      pointers.set(event.pointerId,{
        x:event.clientX,y:event.clientY,pointerType:event.pointerType||"mouse"
      });
      tapStarts.set(event.pointerId,{
        x:event.clientX,y:event.clientY,dragged:false
      });
      if(pointers.size>1)
        for(const t of tapStarts.values())t.dragged=true;
      return pointers.size;
    }
    function move(event){
      const old=pointers.get(event.pointerId);
      if(!old)return null;
      const previousPair=pointers.size===2?[...pointers.values()]:null;
      pointers.set(event.pointerId,{...old,x:event.clientX,y:event.clientY});
      const tap=tapStarts.get(event.pointerId);
      if(tap&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>9)
        tap.dragged=true;
      return {old,previousPair,tap,count:pointers.size};
    }
    function reconcileTouches(touches){
      // TouchEvent.touches reflects real screen contacts. PointerEvent maps
      // sometimes retain an ended ID; trim only when the touch list is smaller.
      if(!touches)return;
      const actual=Array.from(touches,t=>({x:t.clientX,y:t.clientY}))
        .filter(t=>Number.isFinite(t.x)&&Number.isFinite(t.y));
      const tracked=[...pointers.entries()].filter(([,p])=>p.pointerType==="touch");
      if(tracked.length<=actual.length)return;
      // Keep closest live pointer identities; never turn the remaining
      // single finger into a false two-finger pinch.
      const candidates=[];
      for(let i=0;i<tracked.length;i++)
        for(let j=0;j<actual.length;j++){
          const p=tracked[i][1],t=actual[j];
          candidates.push({i,j,dist:(p.x-t.x)**2+(p.y-t.y)**2});
        }
      candidates.sort((a,b)=>a.dist-b.dist);
      const keep=new Set(),claimed=new Set();
      for(const c of candidates){
        if(keep.size>=actual.length)break;
        if(keep.has(c.i)||claimed.has(c.j))continue;
        keep.add(c.i);claimed.add(c.j);
      }
      for(let i=0;i<tracked.length;i++)
        if(!keep.has(i))end(tracked[i][0]);
      // Do NOT invent pointerup/tap actions for removed touches.
    }
    return Object.freeze({
      pointers,tapStarts,begin,move,end,reset,reconcileTouches,
      get generation(){return generation},
      get count(){return pointers.size}
    });
  }
  function startsInSystemEdge(event,rect,{left=18,right=18,top=21,bottom=44}={}){
    if(event.pointerType!=="touch"||!rect)return false;
    const x=event.clientX,y=event.clientY;
    return x<rect.left+left||x>rect.right-right||
      y<rect.top+top||y>rect.bottom-bottom;
  }
  window.Crossroads3DPointerRecovery=Object.freeze({createPointerGuard,startsInSystemEdge});
})();
