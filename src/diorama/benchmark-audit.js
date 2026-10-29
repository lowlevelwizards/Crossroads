"use strict";
// Opt-in complete-battle instrumentation. All observation is read-only.
// Open battle3d.html?scenario=hold_the_farm&solo=1&benchmark=1
(() => {
  function create(){
    const achievements=new Set(),seenEvents=new Set(),lastPositions=new Map();
    let round=0,scenario="",winner=null;
    const tasks=Object.freeze([
      ["deploy","Deployment / first order"],
      ["move","An infantry move"],
      ["fire","Ranged fire"],
      ["pin","Suppression or morale"],
      ["casualty","Casualty"],
      ["objective","Objective control"],
      ["round","Round transition"],
      ["finish","Battle result"]
    ]);
    function snapshot(){
      return Object.freeze({scenario,round,winner,
        checked:tasks.filter(([id])=>achievements.has(id)).map(x=>x[0]),
        missing:tasks.filter(([id])=>!achievements.has(id)).map(x=>x[0]),
        progress:achievements.size,total:tasks.length});
    }
    function observe(s){
      if(!s)return snapshot();
      scenario=String(s.scenarioId||scenario);round=Math.max(round,s.round||0);
      if(s.phase!=="deployment"&&s.phase!=="briefing")
        achievements.add("deploy");
      if(round>=2)achievements.add("round");
      if(s.battleEnded){achievements.add("finish");winner=s.result?.winner||null}
      if((s.units||[]).some(u=>u.pins>0))achievements.add("pin");
      if((s.objectives||[]).some(o=>["blue","red","contested"].includes(o.state)))
        achievements.add("objective");
      for(const u of s.units||[]){
        if(!Number.isFinite(u.x)||!Number.isFinite(u.y))continue;
        const previous=lastPositions.get(u.id);
        if(previous&&Math.hypot(previous.x-u.x,previous.y-u.y)>.15)
          achievements.add("move");
        lastPositions.set(u.id,{x:u.x,y:u.y});
      }
      for(const e of s.combatEvents||[]){
        const id=e.id??e.sequence??JSON.stringify(e).slice(0,150);
        if(seenEvents.has(id))continue;
        seenEvents.add(id);
        if(e.type==="shooting")achievements.add("fire");
        if((e.casualties||0)>0||e.destroyed)achievements.add("casualty");
      }
      return snapshot();
    }
    return Object.freeze({observe,snapshot,tasks});
  }
  function mount(client){
    if(new URLSearchParams(location.search).get("benchmark")!=="1")
      return null;
    const audit=create();
    const stage=document.getElementById("stage");
    const panel=document.createElement("aside");
    panel.className="benchmark-audit";
    const button=document.createElement("button");
    button.textContent="BATTLE PLAYTEST · 0/8";
    button.setAttribute("aria-expanded","false");
    const body=document.createElement("div");body.hidden=true;
    button.addEventListener("click",()=>{
      body.hidden=!body.hidden;
      button.setAttribute("aria-expanded",String(!body.hidden));
    });
    panel.append(button,body);stage?.append(panel);
    const draw=s=>{
      const result=audit.observe(s);
      button.textContent="BATTLE PLAYTEST · "+result.progress+"/"+result.total;
      body.replaceChildren();
      const status=document.createElement("p");
      status.textContent=(result.scenario||"Battle")+" · round "+result.round+
        (result.winner?" · "+result.winner+" victory":"");
      body.append(status);
      for(const [id,label] of audit.tasks){
        const row=document.createElement("div");
        row.textContent=(result.checked.includes(id)?"✓ ":"○ ")+label;
        row.className=result.checked.includes(id)?"done":"pending";
        body.append(row);
      }
    };
    client.subscribe(draw);
    return audit;
  }
  window.Crossroads3DBenchmark=Object.freeze({create,mount});
})();