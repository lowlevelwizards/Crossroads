"use strict";
/* Procedural, user-gesture-unlocked miniature weapon audio. No media assets. */
(() => {
  let context=null,master=null,muted=true;
  function unlock() {
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return false;
    if(!context){
      context=new C();
      master=context.createGain();master.gain.value=.20;
      master.connect(context.destination);
    }
    if(context.state==="suspended")context.resume().catch(()=>{});
    return true;
  }
  function playPulse(weapon="rifle",volume=.12) {
    if(muted||!unlock()||context.state!=="running")return;
    const now=context.currentTime;
    const mmg=/mmg|machine/i.test(weapon),smg=/smg|submachine/i.test(weapon);
    const count=mmg?4:smg?3:1,interval=mmg?.07:.09;
    for(let i=0;i<count;i++) {
      const when=now+i*interval;
      const osc=context.createOscillator(),tone=context.createGain();
      osc.type="sawtooth";
      osc.frequency.setValueAtTime(mmg?90:smg?120:145,when);
      osc.frequency.exponentialRampToValueAtTime(48,when+.075);
      tone.gain.setValueAtTime(.0001,when);
      tone.gain.exponentialRampToValueAtTime(Math.max(.004,volume*(mmg?.34:.6)),when+.004);
      tone.gain.exponentialRampToValueAtTime(.0001,when+.10);
      osc.connect(tone);tone.connect(master);osc.start(when);osc.stop(when+.105);
    }
  }
  const sound=Object.freeze({
    unlock,playShooting(event) {
      const groups=event?.groups||[];
      for(const group of groups)playPulse(group.weapon||group.key||"rifle",
        .12/Math.max(1,Math.sqrt(groups.length)));
    },
    setMuted(value){muted=Boolean(value);if(!muted)unlock();return muted},
    get muted(){return muted}
  });
  window.Crossroads3DCombatAudio=sound;
})();