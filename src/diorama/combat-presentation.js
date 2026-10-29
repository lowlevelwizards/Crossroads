"use strict";
/* Presentation-only event timeline. It never mutates game/rule state. */
(() => {
  const SEQUENCES=Object.freeze({
    shooting:[["aim",.32],["fire",.42],["hit-dice",.55],
      ["damage-dice",.52],["save-dice",.52],["impact",.42],["settle",.12]],
    assault:[["charge",.35],["dice",.75],["impact",.48],["settle",.14]],
    "order-test":[["dice",.75],["impact",.32],["settle",.1]],
    ambush:[["alert",.48],["settle",.12]],
    "round-score":[["score",.9],["settle",.15]],
    rally:[["recover",.65],["settle",.12]]
  });
  function create(onStage,{speed=1}={}) {
    const queue=[],seen=new Set(),order=[];
    let active=null,elapsed=0,stage=-1;
    let playbackSpeed=Math.max(.5,Math.min(4,Number(speed)||1));
    function announce(part) {
      if(!active)return;
      const [name]=active.sequence[part];
      onStage({type:active.event.type,phase:name,event:active.event});
    }
    function enqueue(event){
      if(!event||!Number.isInteger(event.id)||seen.has(event.id))return false;
      seen.add(event.id);order.push(event.id);
      if(order.length>256)seen.delete(order.shift());
      const sequence=SEQUENCES[event.type];
      if(!sequence)return false;
      queue.push({event,sequence});
      return true;
    }
    function update(dt){
      let remaining=Math.max(0,Math.min(dt,.2))*playbackSpeed;
      if(!active&&queue.length){active=queue.shift();stage=0;elapsed=0;announce(0)}
      while(active&&remaining>=0){
        const duration=active.sequence[stage][1];
        const advance=Math.min(remaining,duration-elapsed);
        elapsed+=advance;remaining-=advance;
        if(elapsed+1e-8<duration)break;
        elapsed=0;stage++;
        if(stage>=active.sequence.length) {
          active=null;stage=-1;
          if(queue.length){active=queue.shift();stage=0;announce(0)}
          else break;
        } else announce(stage);
        if(remaining<=0)break;
      }
      return Boolean(active||queue.length);
    }
    function skip(){
      if(active)onStage({type:active.event.type,phase:"settle",event:active.event});
      active=null;queue.length=0;stage=-1;elapsed=0;
    }
    function reset(){
      skip();seen.clear();order.length=0;
    }
    function setSpeed(value){playbackSpeed=Math.max(.5,Math.min(4,Number(value)||1));}
    return Object.freeze({enqueue,update,skip,reset,setSpeed,
      get active(){return Boolean(active||queue.length)},
      get pending(){return queue.length}});
  }
  window.Crossroads3DCombatPresentation=Object.freeze({create});
})();