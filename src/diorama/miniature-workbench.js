"use strict";
// Visual-first mobile contour editor. No game rules are loaded in this module.
(() => {
  function create({THREE,canvas,scene,getSoldier,getCamera,enterPose,exitPose}){
    const lib=window.Crossroads3DShapeLibrary,
      geo=window.Crossroads3DShapeGeometry,
      History=window.Crossroads3DShapeHistory;
    if(!lib||!geo||!History)return null;
    const $=id=>document.getElementById(id);
    let enabled=false,history=null,part="torso",contourIndex=2,
      selectedMesh=null,previewGeometry=null,drag=null,mode="normal",
      original=new Map(),visualOriginal=new Map(),lastPreview=0;
    const handles=new THREE.Group(),handleMat=new THREE.MeshBasicMaterial({
      color:0x77b98d,depthTest:false,depthWrite:false});
    const activeMat=new THREE.MeshBasicMaterial({
      color:0xffcf7a,depthTest:false,depthWrite:false});
    const ghostMat=new THREE.MeshBasicMaterial({
      color:0x8a978f,transparent:true,opacity:.15,depthWrite:false});
    const sphere=new THREE.SphereGeometry(.022,8,6);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const round=n=>Number(n.toFixed(4));
    const setStatus=(message)=>{$("wbStatus").textContent=message};
    const partMeshes=()=>getSoldier()?.editableParts?.get(part)||[];
    const getDocument=()=>history?.get();
    function restoreOriginal(){
      if(previewGeometry){previewGeometry.dispose();previewGeometry=null}
      for(const [mesh,geometry] of original){
        mesh.geometry=geometry;
        mesh.userData.sharedMiniatureGeometry=
          !!geometry.userData?.sharedMiniatureGeometry;
      }
      original.clear();
      if(getSoldier()?.workbenchPelvis){
        const published=lib.approved("torso");
        getSoldier().workbenchPelvis.visible=!published?.blend.enabled;
      }
    }
    function restoreVisuals(){
      for(const [mesh,state] of visualOriginal){
        mesh.visible=state.visible;mesh.material=state.material;
      }
      visualOriginal.clear();
    }
    function refreshVisuals(){
      restoreVisuals();
      const actor=getSoldier()?.figure;
      if(!actor||mode==="normal")return;
      const selected=new Set(partMeshes());
      const base=getSoldier()?.base;
      actor.traverse(mesh=>{
        if(!mesh.isMesh||mesh.parent===handles)return;
        // Keep the round miniature base visible for scale/grounding even
        // while hiding the rest of the mannequin.
        let parent=mesh.parent,onBase=false;
        while(parent){if(parent===base){onBase=true;break}parent=parent.parent}
        if(onBase)return;
        if(selected.has(mesh))return;
        visualOriginal.set(mesh,{visible:mesh.visible,material:mesh.material});
        if(mode==="isolate")mesh.visible=false;
        else if(mesh.visible)mesh.material=ghostMat;
      });
      // Ghost/isolate only affects the figure, not the tabletop base.
      for(const m of selected)m.visible=true;
    }
    function clearHandles(){
      handles.parent?.remove(handles);
      handles.clear();
    }
    function rebuildHandles(){
      clearHandles();
      if(!enabled||!selectedMesh||!history)return;
      selectedMesh.add(handles);
      const doc=getDocument();
      for(let i=0;i<doc.contours.length;i++){
        const c=doc.contours[i];
        for(const kind of ["width-","width+","depth-","depth+","height"]){
          const isZ=doc.axis==="z";
          const p=isZ?
            [c.offsetX+(kind==="width-"?-c.width:kind==="width+"?c.width:0),
              c.offsetZ+(kind==="depth-"?-c.depth:kind==="depth+"?c.depth:0),
              c.height]:
            [c.offsetX+(kind==="width-"?-c.width:kind==="width+"?c.width:0),
              c.height,
              c.offsetZ+(kind==="depth-"?-c.depth:kind==="depth+"?c.depth:0)];
          const marker=new THREE.Mesh(sphere,i===contourIndex?activeMat:handleMat);
          // The editable geometry bakes the part transform. Apply the same
          // transform to each handle so editing remains WYSIWYG.
          const q=new THREE.Vector3(...p);
          const transform=doc.transform;
          q.multiply(new THREE.Vector3(...transform.scale));
          q.applyEuler(new THREE.Euler(...transform.rotation));
          q.add(new THREE.Vector3(...transform.position));
          marker.position.copy(q);marker.renderOrder=101;
          marker.userData={contour:i,kind,handle:true};
          marker.scale.setScalar(i===contourIndex?1.35:1.0);
          handles.add(marker);
        }
      }
    }
    function refreshFields(){
      const doc=getDocument();if(!doc)return;
      const i=clamp(contourIndex,0,doc.contours.length-1);
      contourIndex=i;
      $("wbDetail").max=doc.contours.length-1;
      $("wbDetail").value=i;
      $("wbSegments").value=doc.radialSegments;
      $("wbSegmentsLabel").textContent=doc.radialSegments;
      const c=doc.contours[i];
      for(const [field,id] of [
        ["height","wbHeight"],["width","wbWidth"],["depth","wbDepth"]
      ])$(id).value=c[field].toFixed(3);
      $("wbBlend").checked=doc.blend.enabled;
      $("wbBlendStrength").value=doc.blend.strength;
      $("wbBlendLabel").textContent=doc.blend.strength.toFixed(2);
      $("wbBlendOffset").value=doc.blend.primitive.center[1];
      for(const [id,field,i] of [
        ["wbBlendX","center",0],["wbBlendZ","center",2],
        ["wbBlendRx","radius",0],["wbBlendRy","radius",1],
        ["wbBlendRz","radius",2]
      ])$(id).value=doc.blend.primitive[field][i].toFixed(3);
      $("wbMirror").textContent=doc.symmetry==="x"?"MIRROR ON":"MIRROR OFF";
      $("wbMirror").setAttribute("aria-pressed",String(doc.symmetry==="x"));
      $("wbUndo").disabled=!history.canUndo();
      $("wbRedo").disabled=!history.canRedo();
    }
    function preview(force=false){
      const t=performance.now();
      const doc=getDocument();
      if(!doc||!partMeshes().length)return;
      if(!force&&doc.blend.enabled&&t-lastPreview<90)return;
      lastPreview=t;
      const meshes=partMeshes();
      for(const mesh of meshes)
        if(!original.has(mesh))original.set(mesh,mesh.geometry);
      const generated=geo.make(THREE,doc,{resolution:doc.blend.enabled?22:16});
      const previous=previewGeometry;previewGeometry=generated;
      for(const mesh of meshes){
        mesh.geometry=generated;
        mesh.userData.sharedMiniatureGeometry=false;
      }
      if(previous&&previous!==generated)previous.dispose();
      if(part==="torso"&&getSoldier()?.workbenchPelvis)
        getSoldier().workbenchPelvis.visible=!doc.blend.enabled;
      if(mode!=="normal")refreshVisuals();
      rebuildHandles();refreshFields();
    }
    function selectPart(id,mesh=null){
      if(!lib.ids.includes(id))return;
      restoreVisuals();clearHandles();restoreOriginal();
      part=id;$("wbPart").value=id;
      selectedMesh=mesh||getSoldier()?.editableParts?.get(id)?.[0]||null;
      history=History.create(lib.resolve(id,"draft"));
      contourIndex=Math.floor(history.get().contours.length/2);
      history.subscribe(()=>{preview(false)});
      preview(true);
      setStatus("Editing "+id+". Changes remain on this device until published.");
    }
    function enter(){
      if(enabled)return;
      if(!getSoldier()?.editableParts){
        setStatus("This model does not expose editable parts. Choose sculpted mode.");
        return;
      }
      enabled=true;$("wbControls").hidden=false;
      $("wbToggle").textContent="FINISH EDITING";
      $("wbToggle").setAttribute("aria-pressed","true");
      enterPose();getSoldier()?.setMannequin?.(true);selectPart(part);
    }
    function leave(){
      if(!enabled)return;
      history?.commit();
      if(history)lib.put(history.get(),"draft");
      enabled=false;drag=null;clearHandles();clearGLB();
      restoreVisuals();restoreOriginal();
      $("wbControls").hidden=true;
      $("wbToggle").textContent="EDIT SHAPE";
      $("wbToggle").setAttribute("aria-pressed","false");
      getSoldier()?.setMannequin?.(false);exitPose();
    }
    $("wbToggle").addEventListener("click",()=>enabled?leave():enter());
    $("wbPart").addEventListener("change",e=>{
      if(history)lib.put(history.get(),"draft");
      selectPart(e.target.value);
    });
    $("wbDetail").addEventListener("input",e=>{
      contourIndex=Number(e.target.value);rebuildHandles();refreshFields();
    });
    $("wbMirror").addEventListener("click",()=>history?.transact(doc=>{
      doc.symmetry=doc.symmetry==="x"?"none":"x";return doc;
    }));
    function transact(fn){
      if(!history)return;
      try{history.transact(fn);lib.put(history.get(),"draft")}
      catch(err){setStatus(err.message)}
    }
    $("wbInsert").addEventListener("click",()=>transact(doc=>{
      if(doc.contours.length>=14)return doc;
      const i=clamp(contourIndex,0,doc.contours.length-2);
      const a=doc.contours[i],b=doc.contours[i+1];
      const c={};
      for(const key of Object.keys(a))c[key]=round((a[key]+b[key])/2);
      doc.contours.splice(i+1,0,c);contourIndex=i+1;return doc;
    }));
    $("wbDelete").addEventListener("click",()=>transact(doc=>{
      if(doc.contours.length<=3)return doc;
      doc.contours.splice(contourIndex,1);
      contourIndex=clamp(contourIndex,0,doc.contours.length-1);
      return doc;
    }));
    $("wbSmooth").addEventListener("click",()=>transact(doc=>{
      const i=contourIndex,c=doc.contours[i];
      if(i===0||i===doc.contours.length-1)return doc;
      for(const key of ["width","depth","offsetX","offsetZ"])
        c[key]=round(.5*c[key]+.25*(doc.contours[i-1][key]+
          doc.contours[i+1][key]));
      return doc;
    }));
    for(const [key,id] of [["height","wbHeight"],
      ["width","wbWidth"],["depth","wbDepth"]]){
      $(id).addEventListener("change",e=>transact(doc=>{
        const n=Number(e.target.value);
        if(!Number.isFinite(n))return doc;
        const c=doc.contours[contourIndex];
        const low=key==="height"?
          (contourIndex===0?-2:doc.contours[contourIndex-1].height+.01):.015;
        const high=key==="height"?
          (contourIndex===doc.contours.length-1?2:
            doc.contours[contourIndex+1].height-.01):2;
        c[key]=round(clamp(n,low,high));return doc;
      }));
    }
    $("wbSegments").addEventListener("change",e=>transact(doc=>{
      doc.radialSegments=Number(e.target.value);return doc;
    }));
    $("wbBlend").addEventListener("change",e=>transact(doc=>{
      doc.blend.enabled=e.target.checked;return doc;
    }));
    for(const [id,update] of [
      ["wbBlendStrength",(doc,n)=>doc.blend.strength=n],
      ["wbBlendOffset",(doc,n)=>doc.blend.primitive.center[1]=n]
    ])$(id).addEventListener("change",e=>transact(doc=>{
      update(doc,Number(e.target.value));return doc;
    }));
    for(const [id,field,i] of [
      ["wbBlendX","center",0],["wbBlendZ","center",2],
      ["wbBlendRx","radius",0],["wbBlendRy","radius",1],
      ["wbBlendRz","radius",2]
    ])$(id).addEventListener("change",e=>transact(doc=>{
      const n=Number(e.target.value);
      if(!Number.isFinite(n))return doc;
      doc.blend.primitive[field][i]=n;return doc;
    }));
    $("wbIsolate").addEventListener("click",()=>{
      mode=mode==="isolate"?"normal":"isolate";refreshVisuals();
    });
    $("wbGhost").addEventListener("click",()=>{
      mode=mode==="ghost"?"normal":"ghost";refreshVisuals();
    });
    $("wbUndo").addEventListener("click",()=>{
      if(history?.undo())lib.put(history.get(),"draft");
    });
    $("wbRedo").addEventListener("click",()=>{
      if(history?.redo())lib.put(history.get(),"draft");
    });
    $("wbReset").addEventListener("click",()=>transact(()=>{
      return lib.clone(lib.defaults[part]);
    }));
    $("wbSave").addEventListener("click",()=>{
      if(!history)return;
      const r=lib.put(history.get(),"draft");
      setStatus(r.persisted?"Draft saved locally.":"Storage blocked. Export JSON for backup.");
    });
    $("wbPublish").addEventListener("click",()=>{
      if(!history)return;
      const doc=history.get();doc.revision++;
      const r=lib.put(doc,"approved");
      setStatus(r.persisted?
        "Approved on this device. Reload the battle to use the shape.":
        "Browser storage unavailable; export the shape instead.");
    });
    $("wbDiscardDraft").addEventListener("click",()=>{
      if(!enabled||!history)return;
      if(!window.confirm("Delete the saved draft for "+part+"?"))return;
      history.commit();
      if(!lib.clear(part,"draft")){
        setStatus("Cannot update browser storage. Export your shape first.");
        return;
      }
      selectPart(part);
      setStatus("Draft deleted; built-in "+part+" shape restored in the editor.");
    });
    $("wbRevertPublished").addEventListener("click",()=>{
      if(!enabled||!history)return;
      if(!window.confirm("Delete local draft and approved "+part+
        " shape, then reload to restore the original?"))return;
      const draftCleared=lib.clear(part,"draft");
      const approvedCleared=lib.clear(part,"approved");
      if(!draftCleared||!approvedCleared){
        setStatus("Unable to clear local shape storage.");
        return;
      }
      window.location.reload();
    });
    $("wbExport").addEventListener("click",()=>{
      if(!history)return;
      const text=lib.exportDocument(history.get());
      const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;
      a.download="crossroads-"+part+".json";a.click();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    });
    $("wbImport").addEventListener("change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        if(file.size>25000)throw Error("File is too large");
        const imported=lib.importDocument(await file.text());
        selectPart(imported.id);
        transact(()=>imported);
        setStatus("Shape imported as draft; review before publishing.");
      }catch(error){setStatus("Import rejected: "+error.message)}
      e.target.value="";
    });
    // Imported GLBs are external visual references, not editable contours.
    let importedGLB=null;
    function clearGLB(){
      if(!importedGLB)return;
      scene.remove(importedGLB);
      importedGLB.traverse(node=>{
        node.geometry?.dispose?.();
        const mats=Array.isArray(node.material)?node.material:[node.material];
        for(const mat of mats)mat?.dispose?.();
      });
      importedGLB=null;
    }
    $("wbExportGLB").addEventListener("click",async()=>{
      if(!selectedMesh)return;
      try{
        setStatus("Exporting current part...");
        const {GLTFExporter}=await import(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/GLTFExporter.js");
        const mesh=new THREE.Mesh(selectedMesh.geometry.clone(),selectedMesh.material);
        const binary=await new Promise((resolve,reject)=>
          new GLTFExporter().parse(mesh,resolve,reject,{binary:true}));
        mesh.geometry.dispose();
        const url=URL.createObjectURL(new Blob([binary],
          {type:"model/gltf-binary"}));
        const a=document.createElement("a");a.href=url;
        a.download="crossroads-"+part+".glb";a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        setStatus("GLB exported. Keep JSON to retain contour controls.");
      }catch(err){setStatus("GLB export unavailable: "+err.message)}
    });
    $("wbImportGLB").addEventListener("change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        if(file.size>10_000_000)throw Error("GLB must be under 10 MB");
        const {GLTFLoader}=await import(
          "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js");
        const buffer=await file.arrayBuffer();
        const gltf=await new Promise((resolve,reject)=>
          new GLTFLoader().parse(buffer,"",resolve,reject));
        clearGLB();importedGLB=gltf.scene;
        const size=new THREE.Box3().setFromObject(importedGLB)
          .getSize(new THREE.Vector3());
        const factor=Math.min(1.5,.75/Math.max(size.x,size.y,size.z,.001));
        importedGLB.scale.setScalar(factor);
        importedGLB.updateMatrixWorld(true);
        const center=new THREE.Box3().setFromObject(importedGLB)
          .getCenter(new THREE.Vector3());
        importedGLB.position.add(new THREE.Vector3(.85,.95,0).sub(center));
        scene.add(importedGLB);
        setStatus("GLB reference shown beside soldier (not contour-editable).");
      }catch(err){setStatus("GLB import failed: "+err.message)}
      e.target.value="";
    });
    $("wbClearGLB").addEventListener("click",()=>{
      clearGLB();setStatus("GLB reference cleared.");
    });

    function ray(event){
      const rect=canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,
        -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,getCamera());
    }
    function pointerDown(event){
      if(!enabled||event.button!==0)return false;
      ray(event);
      const picked=raycaster.intersectObjects(handles.children,false)[0];
      if(picked){
        const o=picked.object;
        const world=o.getWorldPosition(new THREE.Vector3());
        const normal=new THREE.Vector3();
        getCamera().getWorldDirection(normal);
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,world);
        const hit=new THREE.Vector3();
        raycaster.ray.intersectPlane(plane,hit);
        drag={id:event.pointerId,handle:o.userData,plane,
          origin:hit.clone(),document:history.get()};
        history.begin();event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        return true;
      }
      // Tapping a visible body piece selects it; empty canvas orbits.
      const body=getSoldier()?.figure;
      if(body){
        const hits=raycaster.intersectObject(body,true);
        const target=hits.find(h=>h.object.userData?.workbenchPart);
        if(target){
          const id=target.object.userData.workbenchPart;
          selectPart(id,target.object);
          event.preventDefault();return true;
        }
      }
      return false;
    }
    function pointerMove(event){
      if(!drag||drag.id!==event.pointerId)return false;
      ray(event);
      const hit=new THREE.Vector3();
      if(!raycaster.ray.intersectPlane(drag.plane,hit))return true;
      const a=selectedMesh.worldToLocal(drag.origin.clone()),
        b=selectedMesh.worldToLocal(hit.clone()),
        d=b.sub(a),doc=lib.clone(drag.document);
      const index=drag.handle.contour,kind=drag.handle.kind;
      contourIndex=index;
      const tool=$("wbTool").value;
      if(tool==="move"){
        doc.transform.position[0]+=d.x;doc.transform.position[1]+=d.y;
        doc.transform.position[2]+=d.z;
      }else if(tool==="scale"){
        const s=clamp(1+d.x*2,.3,2);
        doc.transform.scale=doc.transform.scale.map(n=>clamp(n*s,.25,3));
      }else if(tool==="rotate"){
        doc.transform.rotation[1]+=d.x*3;
      }else{
        const c=doc.contours[index],zAxis=doc.axis==="z";
        if(kind.startsWith("width")){
          const side=kind.endsWith("+")?1:-1;
          const delta=d.x*side;
          if(doc.symmetry==="none")c.offsetX+=d.x*.5;
          c.width=clamp(c.width+delta,.015,2);
        }else if(kind.startsWith("depth")){
          const side=kind.endsWith("+")?1:-1;
          const delta=(zAxis?d.y:d.z)*side;
          if(doc.symmetry==="none")c.offsetZ+=(zAxis?d.y:d.z)*.5;
          c.depth=clamp(c.depth+delta,.015,2);
        }else{
          const delta=zAxis?d.z:d.y;
          const low=index===0?-2:doc.contours[index-1].height+.009;
          const high=index===doc.contours.length-1?2:
            doc.contours[index+1].height-.009;
          c.height=clamp(c.height+delta,low,high);
        }
      }
      try{
        history.update(lib.validate(doc));
      }catch(_){}
      event.preventDefault();return true;
    }
    function pointerUp(event){
      if(!drag||drag.id!==event.pointerId)return false;
      drag=null;
      if(history?.commit())lib.put(history.get(),"draft");
      preview(true);return true;
    }
    return Object.freeze({pointerDown,pointerMove,pointerUp,
      isEditing:()=>enabled,refresh:()=>{
        if(enabled){restoreVisuals();clearHandles();restoreOriginal();
          selectPart(part);}
      },leave});
  }
  window.Crossroads3DMiniatureWorkbench=Object.freeze({create});
})();