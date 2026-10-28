"use strict";
(() => {
  const frame=document.getElementById("battleSessionFrame");
  const requestedScenario=new URLSearchParams(window.location.search).get("scenario");
  if(requestedScenario&&/^[a-z0-9_-]+$/.test(requestedScenario))
    frame.src="classic-session.html?scenario="+encodeURIComponent(requestedScenario);
  const hud=document.getElementById("battleControls");
  if(!frame||!hud)throw Error("Missing 3D battle coordinator frame/control surface");
  let session=null,latest=null,busy=false,warning="";
  let signature="",lastError="",hint="";
  const observers=new Set(),effects=new Set();
  function notify(state){
    latest=state;
    for(const observer of observers)observer(state);
  }
  function addButton(container,label,action,payload={},secondary=false){
    const button=document.createElement("button");
    button.type="button";button.textContent=label;
    if(secondary)button.className="battle-cancel";
    button.disabled=busy;
    button.addEventListener("click",()=>{void send(action,payload);});
    container.appendChild(button);
  }
  function render(state){
    const fingerprint=JSON.stringify({
      phase:state.phase,selected:state.selectedUnitId,order:state.chosenOrder,
      faction:state.faction,round:state.round,bag:state.bagRemaining,
      scores:state.scores,reaction:state.reaction,over:state.battleEnded,
      warning,busy
    });
    if(fingerprint===signature)return;
    signature=fingerprint;
    hud.replaceChildren();
    const heading=document.createElement("div");
    heading.className="battle-heading";
    const label=document.createElement("div");
    label.className="battle-primary";
    const help=document.createElement("div");
    help.className="battle-hint";
    heading.append(label,help);
    const actions=document.createElement("div");
    actions.className="battle-actions";
    const units=state.units||[];
    const selected=units.find(u=>u.id===state.selectedUnitId);
    const title=selected?.name||"";
    const prefix="Round "+state.round+"/"+state.maxRounds+" · "+
      (state.faction ? state.faction.toUpperCase() : "Crossroads");
    const note=warning ? " · "+warning : hint ? " · "+hint : "";
    if(state.battleEnded){
      label.textContent=state.result?.message||"Battle complete";
      help.textContent="Final score: "+state.scores.blue+" – "+state.scores.red+note;
      addButton(actions,"Restart battle","restart");
    }else if(state.phase==="ready-to-draw"){
      label.textContent=prefix+" · "+state.bagRemaining+" order dice remaining";
      help.textContent="Draw a die to determine which faction activates."+note;
      addButton(actions,"Draw order die","draw");
    }else if(state.phase==="choose-unit"||state.phase==="choose-order"){
      label.textContent=prefix+(title?" · "+title:"");
      help.textContent=state.phase==="choose-unit"?
        "Tap one of your unused squads on the tabletop."+note:
        selected.soldiers+" soldiers · "+selected.pins+" pins · Choose an order."+note;
      if(state.phase==="choose-order"){
        for(const order of state.orders||[]){
          if(order.available)addButton(actions,order.order,"order",{order:order.order});
        }
        if(state.canCancel)addButton(actions,"Cancel","cancel",{},true);
      }
    }else if(state.phase==="plan-movement"){
      label.textContent=prefix+" · "+title+" · "+state.chosenOrder;
      help.textContent="Tap ground to move. Existing rules check distance and terrain."+note;
      if(state.canCancel)addButton(actions,"Cancel move","cancel",{},true);
    }else if(state.phase==="choose-target"||state.phase==="choose-assault-target"){
      label.textContent=prefix+" · "+title+" · "+state.chosenOrder;
      help.textContent="Tap an enemy squad to choose a target."+note;
      if(state.chosenOrder==="Advance")addButton(actions,"Finish Advance","finish-advance");
      if(state.canCancel)addButton(actions,"Cancel","cancel",{},true);
    }else if(state.phase==="round-complete"){
      label.textContent="Round "+state.round+" complete";
      help.textContent="Score scenario objectives and begin the next round."+note;
      addButton(actions,"Score round & continue","score-round");
    }else if(state.phase==="ambush-reaction"){
      label.textContent="Ambush reaction";
      help.textContent="Choose whether to fire at the moving enemy."+note;
      addButton(actions,"Fire!","reaction-fire");
      addButton(actions,"Hold fire","reaction-hold",{},true);
    }else if(state.phase==="deployment"){
      label.textContent="Deployment · "+(state.deploymentFaction||"");
      help.textContent="Tap a unit, then a legal tabletop position."+note;
      addButton(actions,"Confirm deployment","confirm-deployment");
    }else{
      label.textContent=prefix+" · "+state.phase;
      help.textContent="The original Crossroads coordinator is resolving the action."+note;
    }
    hud.append(heading,actions);
  }
  async function send(action,payload={}) {
    if(!session||busy)return {ok:false,reason:"Coordinator unavailable or busy"};
    busy=true;warning="";hint="";signature="";
    if(latest)render(latest);
    try{
      const before=latest;
      const response=await session.command(action,payload);
      if(response?.ok===false)warning=response.reason||"Command rejected";
      if(response?.snapshot)notify(response.snapshot);
      if(response?.ok!==false){
        for(const observer of effects)observer({action,payload,before,after:response?.snapshot});
      }
      return response;
    }catch(error){
      warning=String(error?.message||error);
      lastError=warning;
      return {ok:false,reason:warning};
    }finally{
      busy=false;signature="";
      const state=session?.snapshot();
      if(state){notify(state);render(state);}
    }
  }
  function connect(){
    try{
      const api=frame.contentWindow?.InfantryCore?.session;
      if(!api?.snapshot||!api?.command)return false;
      session=api;
      const state=api.snapshot();
      if(!state?.units?.length)return false;
      notify(state);render(state);
      return true;
    }catch(error){lastError=String(error);return false;}
  }
  const client=Object.freeze({
    get snapshot(){return latest;},
    get ready(){return Boolean(session);},
    get error(){return lastError;},
    send,subscribe(callback){
      if(typeof callback!=="function")return ()=>{};
      observers.add(callback);if(latest)callback(latest);
      return ()=>observers.delete(callback);
    },
    onAction(callback){
      effects.add(callback);return ()=>effects.delete(callback);
    },
    setHint(message){
      hint=String(message||"").slice(0,180);
      signature="";
      if(latest)render(latest);
    },
    previewMove(point,waypoint){
      return session?.previewMove(point,waypoint)||{legal:false,reason:"Coordinator not ready"};
    },
    previewTarget(id){
      return session?.previewTarget(id)||{legal:false,reason:"Coordinator not ready"};
    }
  });
  window.CrossroadsBattle3D=client;
  // The original classic game is still an ordinary same-origin page.
  // In its offscreen frame it owns rules, dice, mutations and turn flow.
  frame.addEventListener("load",()=>{
    if(!connect()){
      warning="Could not initialize the shared battle session";
      hud.textContent=warning;
    }
  });
  window.setInterval(()=>{
    if(!session){connect();return;}
    try{
      const current=session.snapshot();
      const changed=!latest||JSON.stringify(current)!==JSON.stringify(latest);
      if(changed){notify(current);render(current);}
    }catch(error){lastError=String(error);}
  },175);
})();