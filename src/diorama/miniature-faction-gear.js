"use strict";
// Broad 1939 infantry gear: faction-specific silhouettes, shared attachment
// conventions. Clothing and kit are visual only, and may be hidden by studio.
(() => {
  const specs=Object.freeze({
    poland:Object.freeze({id:"poland",helmet:"wz31",pack:"wz33",
      lower:"ankle-boots-puttees",strapWidth:.065,pouchHeight:.136,
      pouchY:-.085,packWidth:.39,packHeight:.46}),
    germany:Object.freeze({id:"germany",helmet:"m35",pack:"tornister",
      lower:"jackboots",strapWidth:.074,pouchHeight:.157,
      pouchY:-.065,packWidth:.335,packHeight:.425})
  });
  // Use the actual faction tunic contour and authored vertical scaling.
  const tunics={
    poland:[[-.32,.195,.185],[-.23,.249,.201],[-.07,.256,.218],
      [.15,.286,.227],[.32,.228,.179],[.36,.165,.14]],
    germany:[[-.32,.185,.182],[-.23,.232,.197],[-.07,.252,.210],
      [.15,.276,.220],[.32,.231,.187],[.36,.164,.142]]
  };
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function torsoSurface(x,y,width=1,faction="poland"){
    const profile=tunics[faction]||tunics.poland;
    const h=clamp((y-.015)/.91,profile[0][0],profile[profile.length-1][0]);
    let lo=profile[0],hi=profile[profile.length-1];
    for(let i=1;i<profile.length;i++)
      if(h<=profile[i][0]){lo=profile[i-1];hi=profile[i];break}
    const t=clamp((h-lo[0])/(hi[0]-lo[0]),0,1);
    const rx=(lo[1]+(hi[1]-lo[1])*t)*1.08*width,
      rz=lo[2]+(hi[2]-lo[2])*t;
    return -rz*Math.sqrt(Math.max(0,1-Math.pow(x/Math.max(.02,rx),2)));
  }
  function create(THREE,S){
    function outfit({faction,role,mat,equipmentRoot,packGroup,legs}){
      const cfg=specs[faction]||specs.poland;
      const packW=cfg.packWidth,polish=faction!=="germany";
      const pack=S.loft(packGroup,mat.pack,"field-pack-rework-"+faction,polish?[
        [-.5,packW*.38,.099],[-.37,packW*.49,.139],
        [-.10,packW*.53,.148],[.29,packW*.52,.139],
        [.48,packW*.42,.110],[.5,packW*.37,.101]
      ]:[
        [-.5,packW*.42,.106],[-.42,packW*.49,.133],
        [-.10,packW*.52,.147],[.31,packW*.52,.142],
        [.49,packW*.45,.117],[.5,packW*.41,.111]
      ],[0,-.012,.063],10);
      pack.scale.y=cfg.packHeight;
      if(polish){
        // Softer, wider wz.33 canvas pack with single broad top flap.
        S.box(packGroup,mat.pack,[.350,.052,.140],[0,.206,.102]);
        const roll=S.loft(packGroup,mat.pack,"wz33-blanket-roll",[
          [-.5,.067,.068],[-.32,.078,.081],[.32,.078,.081],
          [.5,.067,.068]
        ],[0,.277,.063],8);
        roll.rotation.z=Math.PI/2;roll.scale.y=.33;
        S.box(packGroup,mat.pack,[.109,.128,.094],[.213,-.132,.085]);
        S.box(packGroup,mat.straps,[.29,.036,.025],[0,.115,-.087]);
      }else{
        // Compact structured Tornister: square flap plus horizontal roll.
        S.box(packGroup,mat.pack,[.314,.078,.147],[0,.185,.120]);
        S.box(packGroup,mat.pack,[.267,.060,.117],[0,-.145,.119]);
        S.box(packGroup,mat.straps,[.225,.026,.025],[0,.121,-.091]);
        const roll=S.loft(packGroup,mat.pack,"tornister-blanket-roll",[
          [-.5,.063,.070],[-.30,.076,.080],[.30,.076,.080],
          [.5,.063,.070]
        ],[0,.253,.077],8);
        roll.rotation.z=Math.PI/2;roll.scale.y=.29;
      }
      const webbing=new THREE.Group();equipmentRoot.add(webbing);
      const ribbons=[],pouches=[];
      for(const side of [-1,1]){
        const path=polish?[
          [side*.096,.300],[side*.125,.249],[side*.145,.185],
          [side*.149,.093],[side*.154,-.020],[side*.150,-.114]
        ]:[
          [side*.112,.308],[side*.137,.249],[side*.159,.182],
          [side*.162,.095],[side*.161,-.013],[side*.148,-.099]
        ];
        ribbons.push(S.surfaceRibbon(webbing,mat.straps,path,
          (x,y,width)=>torsoSurface(x,y,width,faction),cfg.strapWidth));
        // Fixed width pouches *sit ahead* of the curved chest, never at its
        // intersecting center. Keep one bold flap rather than fine details.
        const group=new THREE.Group();webbing.add(group);
        S.box(group,mat.straps,
          [polish?.159:.141,cfg.pouchHeight,.092],[0,0,0]);
        S.box(group,mat.straps,
          [polish?.166:.145,.033,.101],
          [0,cfg.pouchHeight*.375,-.009]);
        pouches.push({side,group});
        // Pack straps follow the rear pack volume; no hanging straight ends.
        const z=polish?.192:.190;
        ribbons.push(S.surfaceRibbon(packGroup,mat.straps,[
          [side*.104,.183],[side*.117,.133],
          [side*.117,.015],[side*.113,-.127],[side*.108,-.175]
        ],()=>z+.018,.054));
      }
      const belt=S.box(webbing,mat.straps,[.474,.037,.015],[0,-.240,-.155]);
      // A single large piece of issue kit sets the flank silhouette.
      if(polish){
        S.box(equipmentRoot,mat.pack,[.150,.131,.098],
          [.251,-.259,.048]);
      }else{
        const gas=S.loft(equipmentRoot,mat.hardware,
          "m35-gasmask-1939",[
            [-.5,.045,.045],[-.36,.051,.052],[.36,.051,.052],
            [.5,.045,.045]
          ],[.272,-.248,.165],8);
        gas.scale.y=.238;
      }
      if(["lmg","mmg","loader","crew"].includes(role))
        S.box(equipmentRoot,mat.pack,[.15,.14,.10],
          [polish?.258:-.261,-.257,.103]);
      function setBodyWidth(width=1){
        for(const ribbon of ribbons)ribbon.userData.refreshRibbon(width);
        for(const {side,group} of pouches){
          const px=side*(polish?.148:.144);
          group.position.set(px,cfg.pouchY,
            torsoSurface(px,cfg.pouchY,width,faction)-.066);
        }
        belt.position.z=torsoSurface(0,-.240,width,faction)-.022;
      }
      setBodyWidth(1);
      // Debug anchors allocated lazily in the Lab; no extra per-soldier
      // scene objects in a normal battle.
      let debugRoot=null;
      function setDebug(enabled){
        if(!enabled){if(debugRoot)debugRoot.visible=false;return}
        if(!debugRoot){
          debugRoot=new THREE.Group();webbing.add(debugRoot);
          const material=new THREE.MeshBasicMaterial({color:0xffcb66,
            depthTest:false});
          const geometry=S.cached("strap-debug-pin",()=>
            new THREE.SphereGeometry(.019,8,6));
          for(const ribbon of ribbons.slice(0,2))
            for(let i=0;i<ribbon.userData.ribbonNodes.length;i++){
              const marker=S.mesh(debugRoot,geometry,material);
              marker.userData.sourceRibbon=ribbon;
              marker.userData.sourceNode=i;
            }
        }
        debugRoot.visible=true;
        for(const pin of debugRoot.children){
          const data=pin.userData.sourceRibbon.geometry.attributes.position.array;
          const i=pin.userData.sourceNode*6;
          pin.position.set((data[i]+data[i+3])/2,data[i+1],
            (data[i+2]+data[i+5])/2-.01);
        }
      }
      // No extra meshes parented under scaled shins. The character's new
      // single contiguous material-banded shin carries wrap or boot colors.
      return {webbing,pack,packGroup,gait:[],faction,config:cfg,
        setBodyWidth,setDebug};
    }
    return Object.freeze({outfit});
  }
  window.Crossroads3DFactionGear=Object.freeze({
    specs,torsoSurface,create
  });
})();