"use strict";
// Miniature Lab stores cosmetic choices locally. The battle rules are untouched.
(() => {
  const key="crossroads-3d-miniature-looks-v1";
  let store={};
  try{store=JSON.parse(localStorage.getItem(key)||"{}")||{}}catch(_){store={}}
  let adapter=null,opened=false,unitId=null,index=0;
  let isolated=false,previewPose="idle";
  const stage=document.getElementById("stage");
  if(!stage)return;
  const toggle=document.createElement("button");
  toggle.className="miniature-lab-toggle";toggle.type="button";
  toggle.textContent="✦ MINIATURE LAB";toggle.setAttribute("aria-expanded","false");
  const panel=document.createElement("aside");
  panel.className="miniature-lab";panel.hidden=true;
  panel.setAttribute("aria-label","Miniature appearance workshop");
  stage.append(toggle,panel);
  const slot=(id,i)=>String(id)+":"+i;
  const readLook=(id,i)=>({...store[slot(id,i)]});
  function save(){
    try{localStorage.setItem(key,JSON.stringify(store))}catch(_){}
  }
  function element(tag,text){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function dropdown(label,entries,value,changed){
    const wrap=element("label",label),select=element("select");
    for(const [v,title] of entries){
      const option=element("option",title);option.value=v;select.append(option);
    }
    select.value=String(value);
    select.addEventListener("change",()=>changed(select.value));
    wrap.append(select);panel.append(wrap);
  }
  function focus(){
    if(!adapter||!unitId)return;
    adapter.focus(unitId,index);
    adapter.isolate?.(unitId,index,isolated);
    adapter.pose?.(unitId,index,previewPose);
  }
  function render(){
    panel.replaceChildren();
    if(!adapter){panel.append(element("p","Preparing miniatures…"));return}
    const squads=adapter.list();
    if(!squads.length){panel.append(element("p","No units found"));return}
    if(!squads.some(s=>s.id===unitId))unitId=squads[0].id;
    const squad=squads.find(s=>s.id===unitId);
    index=Math.max(0,Math.min(index,squad.count-1));
    const heading=element("div");heading.className="mini-lab-heading";
    heading.append(element("strong","MINIATURE LAB"));
    const close=element("button","✕");close.type="button";
    close.setAttribute("aria-label","Close miniature lab");
    close.addEventListener("click",()=>setOpen(false));
    heading.append(close);panel.append(heading);
    panel.append(element("p","Individual painted figures · visual only. Drag to orbit; pinch to zoom."));
    dropdown("Unit",squads.map(s=>[s.id,s.name]),unitId,value=>{
      unitId=value;index=0;focus();render();
    });
    dropdown("Soldier",Array.from({length:squad.count},(_,i)=>
      [String(i),"Soldier "+(i+1)]),index,value=>{
      index=Number(value)||0;focus();render();
    });
    const appearance=readLook(unitId,index);
    const fields=[
      ["uniform","Uniform",[["field","Field issue"],["olive","Olive drab"],["khaki","Khaki"]]],
      ["helmet","Headwear",[["on","Equipped"],["off","Removed"]]],
      ["pack","Field pack",[["on","Equipped"],["off","Removed"]]],
      ["helmetTint","Helmet finish",[["issue","Issue paint"],["dark","Dark green"],["dust","Dusty tan"]]],
      ["leatherTint","Boots / leather",[["issue","Issue leather"],["dark","Blackened"],["russet","Russet"]]]
    ];
    for(const [name,label,entries] of fields)
      dropdown(label,entries,appearance[name]||(name==="uniform"?"field":"on"),value=>{
        const look={...readLook(unitId,index),[name]:value};
        store[slot(unitId,index)]=look;save();adapter.look(unitId,index,look);
      });
    dropdown("Inspection pose",[
      ["idle","Standing"],["walk","Walking"],["down","Down / prone"],["aim","Aiming"],
      ["fire","Firing"]],previewPose,value=>{
      previewPose=value;adapter.pose?.(unitId,index,value);
    });
    const isolateLabel=element("label","Isolate selected miniature");
    isolateLabel.className="mini-lab-checkbox";
    const isolateBox=element("input");
    isolateBox.type="checkbox";isolateBox.checked=isolated;
    isolateBox.addEventListener("change",()=>{
      isolated=isolateBox.checked;
      adapter.isolate?.(unitId,index,isolated);
    });
    isolateLabel.prepend(isolateBox);panel.append(isolateLabel);
    const reset=element("button","Reset appearance");
    reset.type="button";reset.className="mini-lab-reset";
    reset.addEventListener("click",()=>{
      delete store[slot(unitId,index)];save();
      adapter.look(unitId,index,{});render();
    });
    panel.append(reset);
  }
  function setOpen(value){
    opened=Boolean(value);panel.hidden=!opened;
    toggle.setAttribute("aria-expanded",String(opened));
    toggle.textContent=opened?"✕ CLOSE LAB":"✦ MINIATURE LAB";
    if(opened){render();focus()}else {
      isolated=false;previewPose="idle";adapter?.close();
    }
  }
  toggle.addEventListener("click",()=>setOpen(!opened));
  window.Crossroads3DMiniatureLab=Object.freeze({
    readLook,isOpen:()=>opened,
    focusUnit(id){unitId=id;index=0;render();focus()},
    attach(handlers){
      adapter=handlers;render();
      if(new URLSearchParams(location.search).get("lab")==="1")setOpen(true);
    }
  });
})();