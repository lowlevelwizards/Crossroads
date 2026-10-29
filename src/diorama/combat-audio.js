"use strict";
/* Procedural, user-gesture-unlocked miniature weapon audio. No media assets. */
(() => {
  let context=null,master=null,muted=true;
  let listener={yaw:0,x:0,z:0};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
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
  function playPulse(weapon="rifle",volume=.12,pan=0) {
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
      osc.connect(tone);
      if(typeof context.createStereoPanner==="function"){
        const stereo=context.createStereoPanner();
        stereo.pan.setValueAtTime(pan,when);
        tone.connect(stereo);stereo.connect(master);
      }else tone.connect(master);
      osc.start(when);osc.stop(when+.105);
    }
  }
  const sound=Object.freeze({
    unlock,playShooting(event) {
      const groups=event?.groups||[];
      const pos=event?.shooterPosition;
      const dx=Number.isFinite(pos?.x)?(pos.x-36)*.30-listener.x:0;
      const dz=Number.isFinite(pos?.y)?(pos.y-24)*.30-listener.z:0;
      const screenX=dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw);
      const pan=clamp(screenX/8,-.70,.70);
      const attenuation=clamp(1/(1+Math.hypot(dx,dz)*.045),.55,1);
      for(const group of groups)playPulse(group.weapon||group.key||"rifle",
        .12*attenuation/Math.max(1,Math.sqrt(groups.length)),pan);
    },
    setListener({yaw=0,x=0,z=0}={}){
      listener={yaw,x,z};
    },
    setMuted(value){muted=Boolean(value);if(!muted)unlock();return muted},
    get muted(){return muted}
  });
  window.Crossroads3DCombatAudio=sound;
})();