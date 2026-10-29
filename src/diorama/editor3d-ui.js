"use strict";
// Draft terrain editor. All commits to authoritative scenarios remain explicit.
(() => {
 const panel=document.getElementById("terrainEditorPanel");
 if(!panel)return;
 const types=[["wall","Stone wall",14,2.5],["hedge","Hedge",12,2.5],
  ["fence_wood","Fence",10,2.5],["road_straight","Road",18,4.32],
  ["woods","Woods",12,9],["medium_cottage","Cottage",11,8],
  ["barn","Barn",12,8],["field_wheat","Field",12,8]];
 const scenario=new URLSearchParams(location.search).get("scenario")||"hold_the_farm";
 const key="crossroads-editor3d-v1-"+scenario;
 const bridge=window.CrossroadsDioramaBridge;
 const el=(tag,text)=>{const v=document.createElement(tag);if(text)v.textContent=text;return v};
 const body=el("div");body.className="editor3d-panel";panel.append(body);
 body.append(el("h2","3D TERRAIN EDITOR · ALPHA"));
 body.append(el("p","Draft objects are visual until imported into an authored scenario. Tap the table to place or select."));
 const type=el("select");type.setAttribute("aria-label","Terrain asset");
 for(const [id,label] of types){const opt=el("option",label);opt.value=id;type.append(opt)}
 body.append(type);
 const bar=el("div");bar.className="editor3d-actions";body.append(bar);
 const buttons={};
 for(const label of ["Place","Select","Rotate","Duplicate","Delete",
   "Undo","Redo","Snap","Save","Import","Export"]){
   const btn=el("button",label);btn.type="button";bar.append(btn);
   buttons[label]=btn;
 }
 const hint=el("p","Tap the tabletop to place a terrain asset.");
 hint.setAttribute("role","status");body.append(hint);
 const list=el("ol");body.append(list);
 const output=el("textarea");output.readOnly=true;output.hidden=true;
 output.setAttribute("aria-label","Exported scenario terrain records");body.append(output);
 let mode="Place",items=[],selected=null,serial=1;
 let undo=[],redo=[],snap=0;
 const clone=()=>items.map(x=>({...x}));
 function checkpoint(){undo.push(clone());if(undo.length>60)undo.shift();redo=[]}
 function restore(data){
   items=data.map(x=>({...x}));selected=null;
   serial=items.reduce((n,x)=>Math.max(n,
     Number(String(x.id).replace("draft-",""))||0),0)+1;
   paint();
 }
 const update=()=>{
   list.replaceChildren();
   for(const item of items){
     const row=el("li",item.terrainId+" · "+item.x.toFixed(1)+
      ", "+item.y.toFixed(1)+" · "+(item.rotation||0)+"°");
     if(item.id===selected)row.className="selected";
     row.addEventListener("click",()=>{selected=item.id;mode="Select";update()});
     list.append(row);
   }
   for(const key of ["Place","Select"])
     buttons[key].classList.toggle("active",mode===key);
 };
 const paint=()=>{
   const scene=window.Crossroads3DEditorBridge;
   if(!scene)return;
   scene.clear();for(const item of items)scene.place(item);update();
 };
 function place(world){
   checkpoint();
   const [id,,width,height]=types.find(t=>t[0]===type.value)||types[0];
   const table=bridge.toTable(world),size=bridge.table;
   const clamp=(v,max)=>Math.min(max-.3,Math.max(.3,v));
   const entry={id:"draft-"+serial++,terrainId:id,
     x:clamp(snap?Math.round((table.x-width/2)/snap)*snap:table.x-width/2,
       size.width-width),
     y:clamp(snap?Math.round((table.y-height/2)/snap)*snap:table.y-height/2,
       size.height-height),
     width,height,rotation:0};
   items.push(entry);selected=entry.id;
   window.Crossroads3DEditorBridge?.place(entry);
   hint.textContent="Placed "+id+" · rotate, delete or save draft";update();
 }
 function selectAt(world){
   const at=bridge.toTable(world);
   const closest=items.map(item=>({item,d:Math.hypot(item.x+item.width/2-at.x,
     item.y+item.height/2-at.y)})).sort((a,b)=>a.d-b.d)[0];
   selected=closest&&closest.d<7?closest.item.id:null;
   hint.textContent=selected?"Selected "+selected:"No nearby draft object";update();
 }
 window.Crossroads3DEditor=Object.freeze({
   enabled:true,handleGround(world){if(mode==="Place")place(world);else selectAt(world)}
 });
 for(const key of ["Place","Select"])buttons[key].addEventListener("click",()=>{
   mode=key;update();hint.textContent=key==="Place"?"Tap tabletop to place":"Tap a draft to select";
 });
 buttons.Rotate.addEventListener("click",()=>{
   const item=items.find(item=>item.id===selected);
   if(!item)return hint.textContent="Select an object first";
   checkpoint();item.rotation=((item.rotation||0)+15)%360;
   window.Crossroads3DEditorBridge?.place(item);update();
 });
 buttons.Delete.addEventListener("click",()=>{
   if(!selected)return hint.textContent="Select an object first";
   checkpoint();
   window.Crossroads3DEditorBridge?.remove(selected);
   items=items.filter(item=>item.id!==selected);selected=null;update();
 });
 buttons.Duplicate.addEventListener("click",()=>{
   const src=items.find(x=>x.id===selected);
   if(!src)return hint.textContent="Select an object first";
   checkpoint();
   const duplicate={...src,id:"draft-"+serial++,
     x:Math.min(bridge.table.width-src.width-.3,src.x+1.5),
     y:Math.min(bridge.table.height-src.height-.3,src.y+1.5)};
   items.push(duplicate);selected=duplicate.id;
   window.Crossroads3DEditorBridge?.place(duplicate);update();
 });
 buttons.Undo.addEventListener("click",()=>{
   if(!undo.length)return hint.textContent="Nothing to undo";
   redo.push(clone());restore(undo.pop());
   hint.textContent="Undid last terrain change";
 });
 buttons.Redo.addEventListener("click",()=>{
   if(!redo.length)return hint.textContent="Nothing to redo";
   undo.push(clone());restore(redo.pop());
   hint.textContent="Redid terrain change";
 });
 buttons.Snap.addEventListener("click",()=>{
   snap=snap===0?1:snap===1?.5:0;
   buttons.Snap.textContent="Grid "+(snap?snap+"″":"Off");
   hint.textContent="New placements snap to "+(snap?snap+" inch grid":"free position");
 });
 buttons.Import.addEventListener("click",()=>{
   const answer=prompt("Paste a Crossroads terrain draft JSON export");
   if(!answer)return;
   try{
     const parsed=JSON.parse(answer),incoming=parsed.terrain;
     if(!Array.isArray(incoming)||incoming.length>250)
       throw Error("Must contain up to 250 terrain records");
     const valid=incoming.every(item=>item&&
       types.some(t=>t[0]===item.terrainId)&&
       ["x","y","width","height"].every(k=>Number.isFinite(item[k]))&&
       item.width>0&&item.height>0);
     if(!valid)throw Error("Unrecognized terrain type or coordinates");
     checkpoint();restore(incoming);
     hint.textContent="Imported "+items.length+" draft terrain objects";
   }catch(error){hint.textContent="Import rejected: "+error.message}
 });
 buttons.Save.addEventListener("click",()=>{
   try{localStorage.setItem(key,JSON.stringify(items));hint.textContent="Saved in this browser"}
   catch(e){hint.textContent="Local save unavailable"}
 });
 buttons.Export.addEventListener("click",()=>{
   output.value=JSON.stringify({baseScenario:scenario,terrain:items},null,2);
   output.hidden=false;output.focus();output.select();
   hint.textContent="Draft terrain export: import and validate before game use";
 });
 try{
   const saved=JSON.parse(localStorage.getItem(key)||"[]");
   if(Array.isArray(saved)){
     items=saved.filter(item=>types.some(t=>t[0]===item.terrainId)&&
       ["x","y","width","height"].every(k=>Number.isFinite(item[k])));
     serial=items.length+1;
   }
 }catch(e){hint.textContent="Could not load previous draft"}
 update();
 function awaitScene(){
   if(window.Crossroads3DEditorBridge){paint();return}
   setTimeout(awaitScene,150);
 }
 awaitScene();
})();
