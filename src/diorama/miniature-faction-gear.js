"use strict";
// Country-specific 1939 field equipment as broad readable masses, not decorations.
// Polish wz.31 helmet + wz.33 canvas pack/short boots & wraps;
// German M35 helmet + structured rucksack + marching boots / ammo pouches.
(() => {
  const specs=Object.freeze({
    poland:Object.freeze({id:"poland",helmet:"wz31",pack:"wz33",lower:"wraps",
      leather:0x624736,packColor:0x9b8d67,strapWidth:.073,
      pouchHeight:.14,pouchY:-.075,packWidth:.376,packHeight:.53}),
    germany:Object.freeze({id:"germany",helmet:"m35",pack:"tornister",lower:"marching-boots",
      leather:0x342e2c,packColor:0x776c58,strapWidth:.078,
      pouchHeight:.158,pouchY:-.058,packWidth:.33,packHeight:.49})
  });
  function create(THREE,S){
    function outfit({faction,role,mat,equipmentRoot,packGroup,legs}){
      const cfg=specs[faction]||specs.poland;
      const packW=cfg.packWidth,backZ=.064;
      const pack=S.loft(packGroup,mat.pack,"field-pack-"+faction,[
        [-.5,packW*.41,.113],[-.35,packW*.53,.148],
        [.21,packW*.54,.15],[.43,packW*.48,.12],
        [.5,packW*.36,.106]
      ],[0,-.005,backZ],10);
      pack.scale.y=cfg.packHeight;
      if(faction==="poland"){
        // Wz.33: wide canvas top flap, low rolled blanket + shoulder strap.
        S.box(packGroup,mat.pack,[.378,.082,.142],[0,.253,.10]);
        const roll=S.loft(packGroup,mat.pack,"polish-roll-1939",[
          [-.5,.077,.077],[-.35,.088,.088],[.35,.088,.088],[.5,.077,.077]
        ],[0,.333,.064],8);
        roll.rotation.z=Math.PI/2;roll.scale.y=.37;
        S.box(packGroup,mat.pack,[.125,.119,.085],[.233,-.09,.087]);
      }else{
        // Tornister / assault pack: boxier top, rolled shelter-half and
        // readable rear flap with one broad black strap.
        S.box(packGroup,mat.pack,[.334,.076,.157],[0,.216,.104]);
        S.box(packGroup,mat.pack,[.27,.075,.095],[0,-.18,.125]);
        const roll=S.loft(packGroup,mat.pack,"german-roll-1939",[
          [-.5,.069,.071],[-.35,.080,.083],[.35,.080,.083],[.5,.069,.071]
        ],[0,.293,.068],8);
        roll.rotation.z=Math.PI/2;roll.scale.y=.325;
      }
      // Straps are clipped to the actual forward tunic contour rather than
      // floating as vertical wires or entering the shoulders.
      const webbing=new THREE.Group();equipmentRoot.add(webbing);
      for(const side of [-1,1]){
        const x=side;
        if(faction==="germany"){
          // High Y-style shoulder harness and crisp black leather.
          S.strap(webbing,mat.straps,[
            [x*.115,.286,-.147],[x*.154,.226,-.169],
            [x*.172,.111,-.209],[x*.170,-.038,-.218],
            [x*.155,-.179,-.181]
          ],cfg.strapWidth,.019);
        }else{
          // Lower and softer Polish pack straps.
          S.strap(webbing,mat.straps,[
            [x*.103,.275,-.152],[x*.147,.201,-.182],
            [x*.174,.064,-.214],[x*.161,-.060,-.219],
            [x*.151,-.193,-.189]
          ],cfg.strapWidth,.018);
        }
        // Large, raised leather ammunition pouch (fewer but clearer).
        const pouch=S.box(webbing,mat.straps,
          [faction==="germany"?.153:.170,cfg.pouchHeight,.099],
          [x*.151,cfg.pouchY,-.218]);
        // One strong horizontal flap, no individual cartridge partitions.
        S.box(webbing,mat.straps,
          [faction==="germany"?.158:.172,.038,.113],
          [x*.151,cfg.pouchY+cfg.pouchHeight*.39,-.232]);
        // Rear pack retainers follow the pack surface and stop at its hem.
        S.strap(packGroup,mat.straps,[
          [x*.115,.319,.107],[x*.125,.248,.178],
          [x*.130,.078,.197],[x*.126,-.193,.182]
        ],.055,.014);
      }
      if(faction==="poland"){
        // Distinctive canvas gas-mask satchel / breadbag above right hip.
        S.box(equipmentRoot,mat.pack,[.155,.124,.10],[.251,-.264,.055]);
      }else{
        // German cylindrical gas-mask canister at right-rear hip.
        const canister=S.loft(equipmentRoot,mat.hardware,
          "german-gasmask-canister-1939",[
            [-.5,.047,.047],[-.4,.055,.055],[.4,.055,.055],[.5,.047,.047]
          ],[.277,-.244,.158],8);
        canister.scale.y=.235;
      }
      const gait=[];
      for(const leg of legs){
        const shin=leg.shin;
        if(faction==="poland"){
          // Three broad soft wool puttee/wrapper turns visible above shoes.
          for(let n=0;n<3;n++){
            const mesh=S.loft(shin,mat.trousers,"polish-puttee-"+n,[
              [-.5,.099,.099],[-.45,.108,.108],
              [.45,.108,.108],[.5,.099,.099]
            ],[0,-.31+n*.20,0],8);
            mesh.scale.y=.12;gait.push(mesh);
          }
        }else{
          // German tall marching boot: large smooth dark shaft, not puttees.
          const shaft=S.loft(shin,mat.boots,"german-marching-boot",[
            [-.5,.098,.106],[-.35,.103,.110],[.35,.108,.112],
            [.5,.099,.10]
          ],[0,-.22,0],10);
          shaft.scale.y=.64;gait.push(shaft);
        }
      }
      return {webbing,pack,packGroup,gait,faction,config:cfg};
    }
    return Object.freeze({outfit});
  }
  window.Crossroads3DFactionGear=Object.freeze({specs,create});
})();