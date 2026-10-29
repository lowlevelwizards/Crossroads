"use strict";
// Editable source documents are authoritative; generated geometry is disposable.
// Device-local publish affects only this browser, never the repository.
(() => {
  const KEY_DRAFT="crossroads-workbench-drafts-v1";
  const KEY_APPROVED="crossroads-workbench-approved-v1";
  const ids=["torso","head","helmet","upper-arm","forearm","thigh","shin","boot"];
  const preset=(id,axis,contours,sides=10)=>({schemaVersion:1,id,
    name:id.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" "),
    type:"contour",axis,radialSegments:sides,symmetry:"x",revision:1,
    contours:contours.map(([height,width,depth,offsetX=0,offsetZ=0])=>
      ({height,width,depth,offsetX,offsetZ})),
    blend:{enabled:false,strength:.085,primitive:{
      center:[0,-.22,0],radius:[.25,.12,.18]
    }}});
  const defaults=Object.freeze({
    torso:preset("torso","y",[
      [-.32,.195,.185],[-.23,.249,.201],[-.07,.256,.218],
      [.15,.286,.227],[.32,.228,.179],[.36,.165,.14]],12),
    head:preset("head","y",[
      [-1,.18,.16],[-.8,.60,.59],[-.45,.88,.81],
      [0,1,1],[.50,.91,.91],[.85,.63,.64],[1,.10,.10]],12),
    helmet:preset("helmet","y",[
      [0,1,.99],[.1,.99,.99],[.35,.93,.93],
      [.6,.8,.8],[.83,.55,.56],[.98,.13,.14],[1,.025,.025]],12),
    "upper-arm":preset("upper-arm","y",[
      [-.5,.074,.073],[-.38,.088,.084],[-.1,.094,.095],
      [.24,.099,.101],[.5,.082,.084]],10),
    forearm:preset("forearm","y",[
      [-.5,.065,.067],[-.26,.072,.072],[.05,.087,.083],
      [.35,.092,.088],[.5,.076,.075]],10),
    thigh:preset("thigh","y",[
      [-.5,.102,.103],[-.28,.124,.121],[.10,.132,.125],
      [.40,.135,.12],[.5,.107,.105]],10),
    shin:preset("shin","y",[
      [-.5,.085,.086],[-.28,.104,.104],[.12,.112,.113],
      [.35,.110,.111],[.5,.096,.094]],10),
    boot:preset("boot","z",[
      [-.210,.075,.045,0,-.015],[-.165,.132,.087,0,.005],
      [-.060,.124,.101,0,.029],[.060,.109,.118,0,.047],
      [.165,.083,.124,0,.060],[.205,.071,.090,0,.057]],12)
  });
  const clone=o=>JSON.parse(JSON.stringify(o));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function validate(doc) {
    if(!doc||typeof doc!=="object"||!ids.includes(doc.id)||
      doc.type!=="contour"||!Array.isArray(doc.contours)||
      doc.contours.length<3||doc.contours.length>14)throw Error("Invalid shape document");
    const template=defaults[doc.id],result=clone(template);
    result.name=String(doc.name||template.name).slice(0,60);
    result.revision=clamp(Math.floor(Number(doc.revision)||1),1,999999);
    result.radialSegments=clamp(Math.round(Number(doc.radialSegments)||10),6,24);
    result.symmetry=doc.symmetry==="none"?"none":"x";
    result.contours=doc.contours.map((c,i)=>({
      height:clamp(Number(c.height),-2,2),
      width:clamp(Number(c.width),.015,2),
      depth:clamp(Number(c.depth),.015,2),
      offsetX:clamp(Number(c.offsetX)||0,-1,1),
      offsetZ:clamp(Number(c.offsetZ)||0,-1,1)
    }));
    for(const c of result.contours)
      if(!Object.values(c).every(Number.isFinite))
        throw Error("Nonfinite contour field");
    for(let i=1;i<result.contours.length;i++)
      if(result.contours[i].height-result.contours[i-1].height<.008)
        throw Error("Contour heights must increase by at least .008");
    const blend=doc.blend||{};
    result.blend.enabled=!!blend.enabled;
    result.blend.strength=clamp(Number(blend.strength)||.085,.005,.22);
    const primitive=blend.primitive||template.blend.primitive;
    for(const field of ["center","radius"]){
      if(!Array.isArray(primitive[field])||primitive[field].length!==3||
        !primitive[field].every(v=>Number.isFinite(Number(v))))
        throw Error("Invalid SDF primitive");
    }
    result.blend.primitive={
      center:primitive.center.map(v=>clamp(Number(v),-2,2)),
      radius:primitive.radius.map(v=>clamp(Number(v),.025,1))
    };
    return result;
  }
  function storage(){try{return window.localStorage}catch(_){return null}}
  function readAll(key){
    try{
      const raw=JSON.parse(storage()?.getItem(key)||"{}");
      return raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
    }catch(_){return {}}
  }
  function writeAll(key,data) {
    try{storage()?.setItem(key,JSON.stringify(data));return true}
    catch(_){return false}
  }
  function resolve(id,kind="approved"){
    if(!ids.includes(id))return null;
    const stored=readAll(kind==="draft"?KEY_DRAFT:KEY_APPROVED)[id];
    try{return stored?validate(stored):clone(defaults[id])}
    catch(_){return clone(defaults[id])}
  }
  function approved(id){
    const record=readAll(KEY_APPROVED)[id];
    if(!record)return null;
    try{return validate(record)}catch(_){return null}
  }
  function put(doc,kind="draft"){
    const shape=validate(doc);
    const key=kind==="approved"?KEY_APPROVED:KEY_DRAFT;
    const data=readAll(key);
    data[shape.id]=shape;
    return {shape,persisted:writeAll(key,data)};
  }
  function clear(id,kind="draft"){
    const key=kind==="approved"?KEY_APPROVED:KEY_DRAFT;
    const data=readAll(key);
    delete data[id];
    return writeAll(key,data);
  }
  function exportDocument(doc){return JSON.stringify(validate(doc),null,2)}
  function importDocument(text){
    if(text.length>25000)throw Error("Shape document is too large");
    return validate(JSON.parse(text));
  }
  window.Crossroads3DShapeLibrary=Object.freeze({
    ids,defaults,clone,validate,resolve,approved,put,clear,exportDocument,
    importDocument,KEY_DRAFT,KEY_APPROVED
  });
})();