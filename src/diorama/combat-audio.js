"use strict";
/* Procedural, user-gesture-unlocked miniature weapon audio. No media assets. */
(() => {
  let context=null,master=null,muted=true,noiseBuffer=null;
  let listener={yaw:0,x:0,z:0};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function unlock() {
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return false;
    if(!context){
      context=new C();
      master=context.createGain();master.gain.value=.20;
      master.connect(context.destination);
      const length=Math.floor(context.sampleRate*.19);
      noiseBuffer=context.createBuffer(1,length,context.sampleRate);
      const sample=noiseBuffer.getChannelData(0);
      let seed=19039;
      for(let i=0;i<length;i++){
        seed=(1664525*seed+1013904223)>>>0;
        sample[i]=(seed/2147483648-1)*Math.pow(1-i/length,.42);
      }
    }
    if(context.state==="suspended")context.resume().catch(()=>{});
    return true;
  }
  function playPulse(weapon="rifle",volume=.12,pan=0) {
    if(muted||!unlock()||context.state!=="running")return;
    const now=context.currentTime;
    const mmg=/mmg|machine/i.test(weapon),lmg=/lmg|light.machine/i.test(weapon),
      smg=/smg|submachine/i.test(weapon);
    const count=mmg?5:lmg?4:smg?3:1,interval=mmg?.072:lmg?.084:.095;
    for(let i=0;i<count;i++) {
      const when=now+i*interval;
      const osc=context.createOscillator(),tone=context.createGain();
      osc.type="triangle";
      osc.frequency.setValueAtTime(mmg?98:lmg?108:smg?125:155,when);
      osc.frequency.exponentialRampToValueAtTime(42,when+.095);
      tone.gain.setValueAtTime(.0001,when);
      tone.gain.exponentialRampToValueAtTime(Math.max(.004,volume*(mmg?.35:.55)),when+.004);
      tone.gain.exponentialRampToValueAtTime(.0001,when+.10);
      osc.connect(tone);
      const crack=context.createBufferSource();
      crack.buffer=noiseBuffer;
      const band=context.createBiquadFilter();
      band.type="highpass";band.frequency.value=mmg?410:600;
      const attack=context.createGain();
      attack.gain.setValueAtTime(.0001,when);
      attack.gain.exponentialRampToValueAtTime(Math.max(.008,volume*1.8),when+.003);
      attack.gain.exponentialRampToValueAtTime(.0001,when+.11);
      crack.connect(band);band.connect(attack);
      if(typeof context.createStereoPanner==="function"){
        const stereo=context.createStereoPanner();
        stereo.pan.setValueAtTime(pan,when);
        tone.connect(stereo);attack.connect(stereo);stereo.connect(master);
      }else{tone.connect(master);attack.connect(master)}
      osc.start(when);osc.stop(when+.12);
      crack.start(when);crack.stop(when+.13);
    }
  }
  const sound=Object.freeze({
    unlock,playShooting(event) {
      const groups=event?.groups||[];
      const pos=event?.shooterPosition;
      const board=window.CrossroadsDioramaBridge?.table||{width:72,height:48,
        worldUnitsPerInch:.30};
      const inch=board.worldUnitsPerInch||.30;
      const dx=Number.isFinite(pos?.x)?(pos.x-board.width/2)*inch-listener.x:0;
      const dz=Number.isFinite(pos?.y)?(pos.y-board.height/2)*inch-listener.z:0;
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