"use strict";
// Presentation only. The hidden original Crossroads coordinator owns every roll,
// order, scoring result, casualty and game-state mutation.
(() => {
  const frame=document.getElementById("battleSessionFrame");
  const hud=document.getElementById("battleControls");
  if(!frame||!hud)throw Error("Crossroads 3D battle host missing");
  const scenario=new URLSearchParams(location.search).get("scenario");
  if(scenario&&/^[a-z0-9_-]+$/.test(scenario))
    frame.src="classic-session.html?scenario="+encodeURIComponent(scenario)+"&v=0.7.2";
  let session=null,state=null,busy=false,warning="",hint="",error="";
  let aiController=null;
  const soloMode=new URLSearchParams(location.search).get("solo")==="1";
  let logOpen=false,signature="",lastStateKey="";
  let toastExpires=0,lastEventCount=-1;
  const drawOverlay=document.createElement("div");
  drawOverlay.className="battle-draw-overlay";
  drawOverlay.setAttribute("aria-live","polite");
  document.getElementById("stage")?.append(drawOverlay);
  let drawRevealTimeout=null;
  function revealDraw(snapshot) {
    if(!snapshot?.faction)return;
    const die=node("div","battle-big-die "+snapshot.faction);
    die.append(node("span","battle-big-symbol","◆"),
      node("span","battle-big-caption",factionName(snapshot.faction).toUpperCase()+
        " · ORDER DIE"));
    drawOverlay.replaceChildren(die);
    if(drawRevealTimeout)clearTimeout(drawRevealTimeout);
    drawRevealTimeout=setTimeout(()=>drawOverlay.replaceChildren(),1100);
  }
  const subscribers=new Set(),effects=new Set(),combatEvents=new Set(),stageListeners=new Set();
  let lastCombatId=0;
  const director=window.Crossroads3DCombatPresentation.create(stage=>{
    for(const callback of stageListeners)callback(stage);
  });
  let presentationRAF=null;
  function tickPresentation(now){
    presentationRAF=null;
    const elapsed=tickPresentation.last?Math.min(.07,(now-tickPresentation.last)/1000):.016;
    tickPresentation.last=now;
    if(director.update(elapsed))presentationRAF=requestAnimationFrame(tickPresentation);
    else {
      tickPresentation.last=0;
      signature="";
      if(state)render(state); // Remove the SKIP control after the last event settles.
    }
  }
  function startPresentation(){
    if(presentationRAF===null)
      presentationRAF=requestAnimationFrame(tickPresentation);
  }
  function deliverCombat(snapshot){
    if((snapshot.combatEventCount||0)<lastCombatId){
      director.reset();
      lastCombatId=0;
      diceOverlay.hidden=true;
    }
    for(const event of snapshot.combatEvents||[]){
      if(event.id<=lastCombatId)continue;
      lastCombatId=event.id;
      for(const callback of combatEvents)callback(event);
      if(director.enqueue(event))startPresentation();
    }
  }
  const diceOverlay=document.createElement("section");
  diceOverlay.className="battle-combat-dice";
  diceOverlay.setAttribute("aria-live","polite");
  diceOverlay.hidden=true;
  document.getElementById("stage")?.append(diceOverlay);
  function pip(value,target,lowIsGood=false){
    const success=Number.isFinite(target)&&
      (lowIsGood?value<=target:value>=target);
    return node("span","battle-roll "+(success?"good":"weak"),value);
  }
  function onDiceStage(stage){
    if(stage.phase==="settle"){
      diceOverlay.hidden=true;return;
    }
    if(!["dice","hit-dice","damage-dice","save-dice","alert","score","recover"].includes(stage.phase))return;
    const e=stage.event;
    diceOverlay.replaceChildren();
    diceOverlay.append(node("div","battle-dice-heading",
      e.type==="shooting"?(
        stage.phase==="hit-dice"?"HIT ROLLS":
        stage.phase==="damage-dice"?"DAMAGE ROLLS":"COVER SAVES"
      ):
      e.type==="assault"?"CLOSE ASSAULT":
      e.type==="ambush"?"AMBUSH REACTION":
      e.type==="round-score"?"OBJECTIVE SCORING":
      e.type==="rally"?"RALLY":"ORDER TEST"));
    function row(label,rolls,target,low=false){
      if(!rolls?.length)return;
      const line=node("div","battle-dice-row");
      line.append(node("span","battle-dice-weapon",
        label+(target!=null?" · "+target+(low?" or less":"+"):"")));
      const values=node("div","battle-dice-rolls");
      for(const value of rolls)values.append(pip(value,target,low));
      line.append(values);diceOverlay.append(line);
    }
    if(e.type==="ambush"){
      diceOverlay.append(node("div","battle-dice-result",
        e.decision==="interrupt"?"AMBUSH! Movement interrupted":
        e.decision==="fire"?"Ambush fire":"Ambush held"));
    }else if(e.type==="round-score"){
      diceOverlay.append(node("div","battle-dice-result",
        "POL +"+e.blue+"  ·  GER +"+e.red));
    }else if(e.type==="rally"){
      diceOverlay.append(node("div","battle-dice-result",
        e.removedPins+" Pin"+(e.removedPins===1?"":"s")+" removed"));
    }else if(e.type==="shooting"){
      if(stage.phase==="hit-dice"){
        for(const group of e.groups||[])row(group.weapon,group.rolls,group.hitTarget);
        diceOverlay.append(node("div","battle-dice-result",e.hits+" hits"));
      }else if(stage.phase==="damage-dice"){
        row("Damage",e.damageRolls,e.damageTarget);
        diceOverlay.append(node("div","battle-dice-result",
          e.potentialCasualties+" potential casualties"));
      }else if(stage.phase==="save-dice"){
        if(e.coverSaveTarget!=null)row("Cover saves",e.saveRolls,e.coverSaveTarget);
        diceOverlay.append(node("div","battle-dice-result",
          e.saved+" saved · "+e.casualties+" casualties · +"+
          e.pinDelta+" Pin"+(e.pinDelta===1?"":"s")+
          (e.routed?" · ROUTED":"")+
          (e.destroyed?" · UNIT LOST":"")));
      }
    }else if(e.type==="order-test"){
      row(e.order,e.dice,e.target,true);
      diceOverlay.append(node("div","battle-dice-result",
        e.total+" / "+e.target+" · "+(e.passed?"PASSED":"FAILED")));
    }else{
      for(const round of e.rounds||[]){
        row("Attacker R"+round.number,round.attackerRolls,null);
        row("Defender R"+round.number,round.defenderRolls,null);
      }
      diceOverlay.append(node("div","battle-dice-result",
        "Winner: "+e.winner));
    }
    diceOverlay.hidden=false;
  }
  stageListeners.add(onDiceStage);
  const audio=window.Crossroads3DCombatAudio;
  stageListeners.add(stage=>{
    if(stage.type==="shooting"&&stage.phase==="fire")
      audio?.playShooting(stage.event);
  });
  let audioEnabled=false;
  let fastPresentation=false;
  const actionIcons={Advance:"➜",Run:"»",Fire:"✦",Ambush:"◈",Down:"⌄",Rally:"✚",Assault:"⚑"};
  function node(tag,className,text) {
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function action(parent,label,command,payload={},variant="") {
    const button=node("button","battle-action "+variant,label);
    button.type="button";
    button.disabled=busy;
    button.addEventListener("click",()=>{void send(command,payload)});
    parent.append(button);
    return button;
  }
  function factionName(value) {
    return value==="blue"?"Polish":value==="red"?"German":"Both armies";
  }
  function factionText(value) {
    return value==="blue"?"POLAND":value==="red"?"GERMANY":"CROSSROADS";
  }
  function phaseLabel(phase) {
    return ({
      "ready-to-draw":"Draw an order die","choose-unit":"Choose a unit",
      "choose-order":"Choose its order","plan-movement":"Plan movement",
      "choose-target":"Choose a firing target","choose-assault-target":"Choose an assault",
      "deployment":"Position your forces","ambush-reaction":"Ambush reaction",
      "round-complete":"End of round","game-over":"Battle complete"
    })[phase]||"Resolving order";
  }
  function render(current) {
    if(!current)return;
    const chosen=current.units?.find(u=>u.id===(current.selectedUnitId||current.deploymentUnitId));
    const eventCount=current.eventCount||0;
    if(eventCount!==lastEventCount){
      lastEventCount=eventCount;
      if(eventCount>0){
        toastExpires=Date.now()+3600;
        setTimeout(()=>{signature="";if(state)render(state)},3700);
      }
    }
    const showToast=Date.now()<toastExpires;
    const fingerprint=JSON.stringify({
      phase:current.phase,round:current.round,bag:current.bagRemaining,
      faction:current.faction,chosen:current.selectedUnitId,
      deployment:current.deploymentUnitId,order:current.chosenOrder,
      score:current.scores,snap:current.snap,end:current.battleEnded,
      objectives:current.objectives,units:current.units?.map(u=>
        [u.id,u.soldiers,u.pins,u.order,u.activated,u.down,u.inBuilding]),
      available:current.orders,building:current.building,reaction:current.reaction,
      count:current.eventCount,hint,warning,busy,logOpen,showToast,
      audioEnabled,fastPresentation
    });
    if(signature===fingerprint)return;
    signature=fingerprint;
    hud.replaceChildren();

    const ribbon=node("div","battle-ribbon");
    const round=node("div","battle-round",
      "ROUND "+current.round+" / "+current.maxRounds);
    const score=node("div","battle-score");
    score.setAttribute("aria-label","Awarded objective points; pending points score at round end");
    score.append(
      node("span","battle-team-score blue","POL "+(current.scores?.blue??0)),
      node("span","battle-score-divider","·"),
      node("span","battle-team-score red","GER "+(current.scores?.red??0))
    );
    const dice=node("div","battle-die-bag",
      current.battleEnded?"FINAL":current.bagRemaining+" DICE");
    ribbon.append(round,score,dice);
    const sound=node("button","battle-audio-toggle",
      audioEnabled?"♪ ON":"♪ OFF");
    sound.type="button";
    sound.setAttribute("aria-label",audioEnabled?"Mute battle audio":"Enable battle audio");
    sound.addEventListener("click",()=>{
      audioEnabled=!audioEnabled;
      audio?.setMuted(!audioEnabled);
      signature="";render(state);
    });
    ribbon.append(sound);
    const speed=node("button","battle-audio-toggle",
      fastPresentation?"» FAST":"▶ NORMAL");
    speed.type="button";
    speed.setAttribute("aria-label","Toggle animation speed");
    speed.addEventListener("click",()=>{
      fastPresentation=!fastPresentation;
      director.setSpeed(fastPresentation?2.8:1);
      signature="";render(state);
    });
    ribbon.append(speed);
    if(director.active){
      const skip=node("button","battle-audio-toggle","SKIP");
      skip.type="button";
      skip.setAttribute("aria-label","Skip combat animations");
      skip.addEventListener("click",()=>{
        director.skip();diceOverlay.hidden=true;
        signature="";render(state);
      });
      ribbon.append(skip);
    }
    hud.append(ribbon);
    if(current.phase==="round-complete"){
      const pending=node("div","battle-objective-banner",
        "ROUND CHECKPOINT · Continue to award eligible points for Round "+current.round);
      pending.setAttribute("role","status");hud.append(pending);
    }
    const focusedObjective=current.objectives?.find(o=>o.state&&o.state!=="none");
    if(focusedObjective){
      const label=node("div","battle-objective-banner",
        "⚑  "+focusedObjective.label+" · "+String(focusedObjective.state).toUpperCase());
      hud.append(label);
    }
    if(current.phase==="round-complete"){
      const controlled=(current.objectives||[]).filter(o=>
        o.state==="blue"||o.state==="red");
      const projected={blue:0,red:0};
      for(const obj of controlled)
        if(obj.type==="control_zone")
          projected[obj.state]+=Number(obj.roundPoints||0);
      const finalOnly=controlled.filter(o=>o.type==="control_zone"&&o.finalPoints>0)
        .map(o=>o.label+" · "+o.finalPoints+" final VP");
      const headline=(projected.blue||projected.red)?
        "PENDING AT CHECKPOINT: POL +"+projected.blue+" · GER +"+projected.red:
        finalOnly.length?
          "FINAL CONTROL BONUS (not yet awarded): "+finalOnly.join(" · "):
          controlled.length?
            "OBJECTIVES HELD: "+controlled.map(o=>o.label).join(", "):
            "NO OBJECTIVES CURRENTLY CLAIMED";
      const detail=node("div","battle-objective-banner",headline);
      hud.append(detail);
    }

    const objectiveSummaries=(current.objectives||[]).filter(o=>
      o.type!=="unknown"&&o.label);
    if(objectiveSummaries.length){
      const inspect=node("details","battle-objectives-inspect");
      const summary=node("summary",null,"⚑ OBJECTIVES · "+
        objectiveSummaries.map(o=>o.label).join(" / "));
      inspect.append(summary);
      for(const obj of objectiveSummaries){
        const status=obj.state==="blue"?"POL CONTROL":obj.state==="red"?
          "GER CONTROL":obj.state==="contested"?"CONTESTED":"UNCONTROLLED";
        let terms="";
        if(obj.roundPoints)terms+="+"+obj.roundPoints+" VP at each round checkpoint";
        if(obj.finalPoints)terms+=(terms?" · ":"")+"+"+obj.finalPoints+" VP at battle end";
        if(obj.pointsPerUnit)terms+=(terms?" · ":"")+"+"+
          obj.pointsPerUnit+" VP per unit exiting";
        if(obj.roundScoring?.length)
          terms+=(terms?" · ":"")+"Scenario-specific round scoring "+
            obj.roundScoring.map(r=>r.faction+" "+r.rule+" +"+r.points+
              (r.startRound?" from R"+r.startRound:"")).join(", ");
        if(obj.finalScoring?.length)
          terms+=(terms?" · ":"")+"Scenario-specific final scoring";
        const pointState=Array.isArray(obj.points)?
          " · "+obj.points.map(p=>p.label+": "+(p.state||"none")).join(" · "):"";
        inspect.append(node("div","battle-objective-detail",
          obj.label+" · "+status+pointState+" · "+(terms||"Check mission rules")));
      }
      hud.append(inspect);
    }
    const center=node("section","battle-center");
    const contextual=node("div","battle-heading "+(current.faction||"neutral"));
    contextual.append(
      node("span","battle-eyebrow "+(current.faction||"neutral"),
        factionText(current.faction)+(soloMode&&current.faction==="red"?" · AI":"")+"  ·  "+phaseLabel(current.phase)),
      node("strong","battle-primary",chosen?.name||
        (current.phase==="ready-to-draw"?"Order dice in the bag":phaseLabel(current.phase)))
    );
    if(chosen){
      const status=node("div","battle-unit-status",
        (chosen.quality||"Infantry")+"  ·  "+chosen.soldiers+
        "/"+(chosen.maxSoldiers||chosen.soldiers)+" soldiers"+
        (chosen.pins?"  ·  "+chosen.pins+" PINS":"")+
        (chosen.inBuilding?"  ·  IN BUILDING":""));
      contextual.append(status);
    }
    const guidance=({
      "ready-to-draw":"Draw a die to determine the next faction.",
      "choose-unit":current.snap?
        "OFFICER SNAP TO ACTION · Pick a nearby ready squad ("+current.snap.remaining+
        " reserved die/dice).":"Tap any glowing, eligible squad to activate it.",
      "choose-order":"Only legal orders are shown below.",
      "plan-movement":"Tap destination, then Confirm Move; add a waypoint to bend the route.",
      "choose-target":"Tap an enemy, review its cover and shots, then Confirm Fire.",
      "choose-assault-target":"Tap an enemy, then Confirm Assault.",
      "deployment":"Tap a unit, then choose its legal deployment point.",
      "ambush-reaction":"An enemy entered a prepared firing lane.",
      "round-complete":"Review the result before advancing.",
      "game-over":"The tabletop battle has concluded."
    })[current.phase]||"Resolving the active order.";
    contextual.append(node("div","battle-hint",warning||hint||guidance));
    center.append(contextual);

    if(current.faction && !current.battleEnded) {
      const die=node("div","battle-order-die "+current.faction+
        (current.chosenOrder?" has-order":""));
      die.append(
        node("span","battle-die-symbol",
          current.chosenOrder?actionIcons[current.chosenOrder]||"◆":"◆"),
        node("span","battle-die-caption",current.chosenOrder||"DRAWN")
      );
      die.setAttribute("aria-label",factionName(current.faction)+
        (current.chosenOrder?" "+current.chosenOrder+" order":" order die"));
      center.append(die);
    }
    const controls=node("div","battle-actions");
    if(current.battleEnded){
      const winner=current.result?.winner;
      contextual.prepend(node("div","battle-victory",
        winner?factionName(winner)+" VICTORY":"BATTLE COMPLETE"));
      contextual.append(node("div","battle-end-score",
        "Final score  "+(current.scores?.blue??0)+" — "+
        (current.scores?.red??0)));
      if(current.statistics){
        const bs=current.statistics.blue,rs=current.statistics.red;
        contextual.append(node("div","battle-after-action",
          "Casualties inflicted: "+(bs.casualtiesInflicted||0)+
          " / "+(rs.casualtiesInflicted||0)+
          "   ·   Units lost: "+(bs.unitsLost||0)+" / "+(rs.unitsLost||0)));
      }
      action(controls,"↻  Play again","restart",{},"battle-primary-action");
    } else if(current.phase==="choose-unit"&&current.snap){
      action(controls,"END OFFICER ORDERS","end-snap",{},"battle-secondary");
    } else if(current.phase==="ready-to-draw"){
      action(controls,"◈  DRAW ORDER DIE","draw",{},"battle-primary-action");
    } else if(current.phase==="choose-order"){
      for(const item of current.orders||[]) {
        if(item.available)action(controls,(actionIcons[item.order]||"◆")+"  "+item.order,
          "order",{order:item.order});
      }
      if(current.building)action(controls,"⌂  "+current.building.label,"building");
      if(current.canCancel)action(controls,"Cancel","cancel",{},"battle-secondary");
    } else if(current.phase==="plan-movement"){
      const tools=window.Crossroads3DMoveTools,move=tools?.getState?.()||{};
      if(move.legal)center.append(node("div","battle-move-summary",
        "ROUTE "+Number(move.cost||0).toFixed(1)+" / "+move.allowance+
        "″"+(move.shortened?" · LIMITED":"")+
        (move.waypoint?" · VIA WAYPOINT":"")));
      const confirm=node("button","battle-action battle-primary-action battle-confirm-move",
        "✓ CONFIRM MOVE");
      confirm.type="button";confirm.disabled=busy||!move.legal;
      confirm.addEventListener("click",()=>tools?.confirmMove?.());controls.append(confirm);
      const waypoint=node("button","battle-action battle-secondary",
        move.placingWaypoint?"TAP ROUTE…":move.waypoint?"↱ Edit waypoint":"↱ Add waypoint");
      waypoint.type="button";waypoint.disabled=busy||!move.legal;
      waypoint.addEventListener("click",()=>tools?.armWaypoint?.());controls.append(waypoint);
      if(move.waypoint){
        const remove=node("button","battle-action battle-secondary","Remove waypoint");
        remove.type="button";remove.disabled=busy;
        remove.addEventListener("click",()=>tools?.clearWaypoint?.());
        controls.append(remove);
      }
      const reset=node("button","battle-action battle-secondary","Clear route");
      reset.type="button";reset.disabled=busy||!move.legal;
      reset.addEventListener("click",()=>tools?.reset?.());controls.append(reset);
      if(current.canCancel)action(controls,"Cancel order","cancel",{},"battle-secondary");
    } else if(["choose-target","choose-assault-target"].includes(current.phase)){
      const target=window.Crossroads3DTargetTools?.getState?.()||{};
      const confirm=node("button","battle-action battle-primary-action battle-confirm-target",
        current.phase==="choose-assault-target"?"✓ CONFIRM ASSAULT":"✓ CONFIRM FIRE");
      confirm.type="button";confirm.disabled=busy||!target.legal;
      confirm.addEventListener("click",()=>window.Crossroads3DTargetTools?.confirmTarget?.());
      controls.append(confirm);
      if(current.chosenOrder==="Advance")action(controls,"Finish Advance","finish-advance");
      if(current.canCancel)action(controls,"Cancel target","cancel",{},"battle-secondary");
    } else if(current.phase==="round-complete"){
      action(controls,"SCORE OBJECTIVES & CONTINUE","score-round",{},"battle-primary-action");
    } else if(current.phase==="ambush-reaction"){
      action(controls,"✦  Fire ambush","reaction-fire",{},"battle-primary-action");
      action(controls,"Hold fire","reaction-hold",{},"battle-secondary");
    } else if(current.phase==="deployment"){
      action(controls,"Confirm deployment","confirm-deployment",{},"battle-primary-action");
    }
    center.append(controls);
    hud.append(center);

    const events=current.recentEvents||[];
    if(events.length){
      const latest=events.at(-1);
      const feed=node("div","battle-event-preview"+(showToast?" is-recent":""));
      if(showToast)feed.append(node("span","battle-event-message",latest.message));
      const toggle=node("button","battle-log-toggle",logOpen?"Close":"Log");
      toggle.type="button";toggle.addEventListener("click",()=>{
        logOpen=!logOpen;signature="";render(state);
      });
      feed.append(toggle);
      hud.append(feed);
      if(logOpen){
        const history=node("div","battle-log");
        history.setAttribute("role","log");
        history.setAttribute("aria-label","Battle events");
        for(const event of events.slice().reverse())
          history.append(node("div","battle-log-entry "+(event.className||""),
            "R"+event.round+"  "+event.message));
        hud.append(history);
      }
    }
  }
  function accept(snapshot){
    if(!snapshot)return;
    state=snapshot;
    deliverCombat(snapshot);
    const stateKey=JSON.stringify({
      phase:state.phase,round:state.round,battleEpoch:state.battleEpoch,faction:state.faction,
      selected:state.selectedUnitId,deploy:state.deploymentUnitId,order:state.chosenOrder,
      bag:state.bagRemaining,events:state.eventCount,result:state.result,
      objectives:state.objectives,
      scores:state.scores,units:state.units?.map(u=>
        [u.id,u.x,u.y,u.soldiers,u.pins,u.down,u.activated,u.order,u.inBuilding])
    });
    if(lastStateKey!==stateKey){
      lastStateKey=stateKey;
      for(const callback of subscribers)callback(state);
    }
    render(state);
    if(aiController)aiController.observe(state);
  }
  async function send(actionName,payload={}){
    if(!session||busy)return {ok:false,reason:"Battle coordinator busy"};
    // One of these commands is a genuine player gesture, so the audio
    // context can be unlocked without browser autoplay workarounds.
    if(audioEnabled)audio?.unlock();
    busy=true;warning="";hint="";signature="";render(state);
    try{
      const before=state;
      const response=await session.command(actionName,payload);
      if(response?.ok===false)warning=response.reason||"Order rejected";
      if(response?.snapshot)accept(response.snapshot);
      if(actionName==="draw"&&response?.ok!==false)
        revealDraw(response?.snapshot);
      if(response?.ok!==false)for(const callback of effects)
        callback({action:actionName,payload,before,after:response?.snapshot});
      return response;
    }catch(e){
      warning=String(e?.message||e);
      error=warning;
      return {ok:false,reason:warning};
    }finally{
      busy=false;signature="";
      if(session)accept(session.snapshot());
    }
  }
  function connect(){
    try{
      const api=frame.contentWindow?.InfantryCore?.session;
      if(!api?.snapshot||!api?.command)return false;
      session=api;
      const snapshot=api.snapshot();
      if(!snapshot?.units?.length)return false;
      accept(snapshot);
      return true;
    }catch(e){error=String(e);return false}
  }
  const client=Object.freeze({
    get snapshot(){return state},
    skipPresentation(){director.skip();diceOverlay.hidden=true;},
    setPresentationSpeed(value){director.setSpeed(value);},
    get ready(){return Boolean(session)},
    get error(){return error},
    send,subscribe(callback){
      subscribers.add(callback);
      if(state)callback(state);
      return ()=>subscribers.delete(callback);
    },
    onAction(callback){effects.add(callback);return ()=>effects.delete(callback)},
    onCombatEvent(callback){combatEvents.add(callback);return ()=>combatEvents.delete(callback)},
    onCombatStage(callback){stageListeners.add(callback);return ()=>stageListeners.delete(callback)},
    setHint(message){hint=String(message||"").slice(0,180);signature="";render(state)},
    previewMove(point,waypoint){
      return session?.previewMove(point,waypoint)||
        {legal:false,reason:"Battle coordinator not ready"};
    },
    previewTarget(id){
      return session?.previewTarget(id)||
        {legal:false,reason:"Battle coordinator not ready"};
    }
  });
  window.CrossroadsBattle3D=client;
  if(soloMode&&window.Crossroads3DAIOpponent)
    aiController=window.Crossroads3DAIOpponent.create(client);
  frame.addEventListener("load",()=>{
    if(!connect())hud.textContent="Could not initialize the shared battle coordinator";
  });
  // A poll is still needed for engine-owned asynchronous reactions; no 2D DOM
  // repaint occurs and unchanged snapshots do not notify the Three.js scene.
  window.setInterval(()=>{if(!session){connect();return}
    try{accept(session.snapshot())}catch(e){error=String(e)}
  },250);
})();
