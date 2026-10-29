"use strict";
// Solo tactical inspector is opt-in via ?ai-debug=1; no game rules affected.
(() => {
  const records=[];
  const enabled=new URLSearchParams(location.search).get("ai-debug")==="1";
  let content=null;
  if(enabled){
    const panel=document.createElement("aside");
    panel.className="ai-inspector";
    const toggle=document.createElement("button");
    toggle.type="button";toggle.className="ai-inspector-toggle";
    toggle.textContent="AI DECISIONS";toggle.setAttribute("aria-expanded","false");
    content=document.createElement("div");content.hidden=true;
    content.className="ai-inspector-list";
    toggle.addEventListener("click",()=>{
      content.hidden=!content.hidden;
      toggle.setAttribute("aria-expanded",String(!content.hidden));
    });
    panel.append(toggle,content);
    document.getElementById("stage")?.append(panel);
  }
  function record(entry){
    const r=Object.freeze({
      stage:String(entry.stage||"DECISION").slice(0,40),
      unit:String(entry.unit||"AI").slice(0,60),
      choice:String(entry.choice||"—").slice(0,90),
      details:String(entry.details||"").slice(0,180)
    });
    records.unshift(r);
    if(records.length>20)records.length=20;
    if(!content)return;
    content.replaceChildren(...records.slice(0,8).map(item=>{
      const div=document.createElement("div");
      const label=document.createElement("strong");
      label.textContent=item.stage+" / "+item.unit+" / "+item.choice;
      const note=document.createElement("p");note.textContent=item.details;
      div.append(label,note);return div;
    }));
  }
  window.Crossroads3DAIInspector=Object.freeze({record,history:()=>records.slice()});
})();