"use strict";
// Historical silhouettes built from connected axial landmarks. Visual-only:
// Bolt Action ranges, shooting, recoil, and rules remain external.
(() => {
  function create(THREE,S){
    const G=window.Crossroads3DWeaponGeometry.create(THREE,S);
    const A=window.Crossroads3DWeaponArchetypes;
    const lib=window.Crossroads3DWeaponLibrary;
    const point=(x,y,z)=>S.v(x,y,z);
    function kindFor(faction,role){
      if(role==="officer")return "pistol";
      if(role==="mmg"||role==="lmg")return faction==="germany"?"mg34":"wz28";
      if(role==="smg")return faction==="germany"?"mp38":"mors39";
      return faction==="germany"?"kar98k":"wz29";
    }
    function profile(root,mats,kind,values,{bipodEnabled=true}={}){
      const def=A.defs[kind];if(!Object.prototype.hasOwnProperty.call(A.defs,kind))throw Error("Unknown weapon "+kind);
      const p=lib.parse(kind,values),hero=p.exaggeration;
      const parts={};
      for(const name of ["stock","receiver","foreEnd","barrel","magazine","grip","sights","bolt"]){
        parts[name]=new THREE.Group();root.add(parts[name]);
      }
      const d=def.receiver*p.receiverLength,
        back=d/2,front=-d/2,
        foreTip=front-def.fore*p.foreEndLength*p.length,
        muzzle=foreTip-def.barrel*p.barrelLength*p.length,
        butt=back+def.butt*p.stockLength*p.length;
      const wood=mats.wood,steel=mats.steel,hardware=mats.hardware||steel;
      const thick=p.stock*hero,metal=p.receiver*hero,
        bore=p.barrel*hero;
      let primary=point(.058,-.115,back+.045);
      let secondary=point(-.07,-.086,foreTip+(front-foreTip)*.52);
      let gunMuzzle=point(0,.025,muzzle-.023);
      const bolt=def.family==="bolt";
      if(bolt||def.family==="bar"||def.family==="mg"||def.family==="mors"){
        G.stock(parts.stock,def.family==="mg"?hardware:wood,{
          rear:butt,front:back-.018,thickness:thick,
          style:def.family
        });
      }else if(def.family==="mp"){
        // MP38 folded metal skeleton stock: not an enormous wooden block.
        G.wire(parts.stock,hardware,[
          [.078,-.035,back],[.096,-.06,butt-.04],
          [.096,-.128,butt],[.096,-.149,butt-.012]
        ],.021*hero);
        G.wire(parts.stock,hardware,[
          [-.078,-.035,back],[-.096,-.06,butt-.04],
          [-.096,-.128,butt],[-.096,-.149,butt-.012]
        ],.021*hero);
        G.block(parts.stock,hardware,[.212,.036,.041],[0,-.132,butt-.015]);
        // One broad silhouette cue for the MP38's folding metal shoulder
        // rest, rather than four disconnected wire ends at game distance.
        G.block(parts.stock,hardware,[.214,.086,.029],
          [0,-.134,butt+.016]);
      }
      if(def.family==="pistol"){
        const slideBack=back+.013,slideFront=front-.03;
        G.block(parts.receiver,steel,[.126*metal,.09*metal,slideBack-slideFront],
          [0,.036,(slideBack+slideFront)/2]);
        G.block(parts.grip,wood,[.096*hero,.185*hero,.100],
          [0,-.117,back-.041]).rotation.x=-.25;
        G.tube(parts.barrel,steel,slideFront-.085,slideFront,.037*bore);
        primary=point(.043,-.136,back-.04);
        secondary=point(-.043,-.044,front+.015);
        gunMuzzle=point(0,.036,slideFront-.1);
      }else{
        const recWidth=(def.family==="mg"?.091:def.family==="bar"?.082:.075)*metal;
        const recHeight=(def.family==="mp"?.074:.068)*metal;
        if(def.family==="mp"||def.family==="mors"){
          G.tube(parts.receiver,steel,front,back,recWidth,recHeight,.023,10);
        }else{
          G.block(parts.receiver,steel,[recWidth*2,recHeight*2,d+.036],
            [0,.022,(back+front)/2]);
        }
        if(bolt){
          // Long continuous wood below the receiver and fore-end; one
          // purposeful bolt handle and front sight.
          G.taperedFore(parts.foreEnd,wood,foreTip-.008,front+.025,
            .091*thick,.068*thick);
          G.tube(parts.barrel,steel,muzzle,foreTip+.045,.026*bore);
          G.block(parts.sights,steel,[.034,.054,.034],
            [0,.055,muzzle+.044]);
          G.block(parts.sights,steel,[.029,.023,.078],
            [.045,.079,back-.047]);
          // Single tiny moving bolt is enough to read cycling at model scale.
          const boltHandle=G.block(parts.bolt,steel,
            [.047,.035,.081],[.082,.09,back-.045]);
          boltHandle.userData.cycleRest=boltHandle.position.z;
          primary=point(.06,-.119,back+.032);
        }else if(def.family==="bar"){
          G.taperedFore(parts.foreEnd,wood,foreTip,front+.035,
            .092*thick,.08*thick);
          G.tube(parts.barrel,steel,muzzle,foreTip+.03,.034*bore);
          // Omit the underslung floating gas tube at 28mm miniature scale;
          // the Browning feed and profile remain recognizable without it.
          G.block(parts.magazine,steel,[.15*p.magazine*hero,.18*p.magazine*hero,.105],
            [0,-.122,front+.045]);
          G.block(parts.grip,wood,[.085,.158,.085],[0,-.137,back-.022])
            .rotation.x=-.22;
          G.block(parts.sights,steel,[.036,.066,.036],[0,.063,muzzle+.048]);
        }else if(def.family==="mg"){
          // MG34 has a metal jacket, distinct receiver/feed and short
          // wooden butt; the bipod is NOT the magazine.
          const jacketFront=muzzle+.103;
          G.tube(parts.barrel,hardware,jacketFront,front+.016,
            .065*bore,.061*bore,.026,12);
          G.tube(parts.barrel,steel,muzzle,jacketFront+.022,.035*bore);
          G.block(parts.magazine,steel,
            [.145*p.magazine,.071*p.magazine,.135],
            [.103,.057,front+.035]); // left-side feed
          G.block(parts.grip,hardware,[.075,.142,.076],
            [0,-.135,back-.015]).rotation.x=-.20;
          G.block(parts.sights,steel,[.035,.066,.035],[0,.073,muzzle+.045]);
          secondary=point(-.088,-.057,front-.23);
        }else if(def.family==="mp"){
          G.tube(parts.barrel,steel,muzzle,front+.025,.037*bore);
          G.block(parts.grip,hardware,[.088,.182,.105],
            [0,-.137,back-.06]).rotation.x=-.17;
          G.block(parts.magazine,steel,
            [.108*p.magazine,.24*p.magazine,.104],
            [0,-.144,front+.052]);
          G.block(parts.sights,steel,[.035,.07,.04],[0,.058,muzzle+.037]);
          primary=point(.049,-.14,back-.045);
          secondary=point(-.06,-.03,front-.06);
        }else if(def.family==="mors"){
          G.taperedFore(parts.foreEnd,wood,foreTip,front+.02,.079*thick,.079*thick);
          G.tube(parts.barrel,steel,muzzle,foreTip+.025,.034*bore);
          G.block(parts.grip,wood,[.092,.169,.097],
            [0,-.145,back-.018]).rotation.x=-.19;
          G.block(parts.magazine,steel,
            [.113*p.magazine,.222*p.magazine,.106],
            [0,-.145,front+.032]);
          G.block(parts.sights,steel,[.035,.055,.034],[0,.054,muzzle+.035]);
        }
      }
      let bipod=null;
      if((def.family==="bar"||def.family==="mg")&&bipodEnabled){
        bipod=new THREE.Group();root.add(bipod);
        const z=muzzle+.18;
        G.block(bipod,hardware,[.073,.062,.080],[0,-.019,z]);
        G.wire(bipod,hardware,[[0,-.03,z],[-.14,-.23,z-.06]],.020);
        G.wire(bipod,hardware,[[0,-.03,z],[.14,-.23,z-.06]],.020);
        bipod.visible=false;
      }
      return {parts,bipod,kind,params:p,
        muzzle:gunMuzzle,primary,secondary,
        anchors:{butt,receiverRear:back,receiverFront:front,foreEnd:foreTip,muzzle},
        dimensions:{rear:butt,front:muzzle,stockLength:butt-back},
        triangleTarget:500};
    }
    function build({figure,breathing,role,faction,mats,weaponKind,settings,
      mountParent=null}){
      const kind=weaponKind||kindFor(faction,role),isMMG=role==="mmg";
      const recipe=settings||lib.read(kind);
      const weapon=new THREE.Group();
      weapon.position.set(.045,-.095,-.335);
      weapon.rotation.set(-.08,.21,-.08);
      breathing.add(weapon);
      const grips=profile(weapon,mats,kind,recipe);
      // A deployed MMG stays on the figure (outside the animated body).
      const mount=new THREE.Group();
      // One squad-level physical mount; the gunner remains an independent
      // miniature whose real model base never changes.
      (isMMG&&mountParent?mountParent:figure).add(mount);
      mount.visible=false;
      const syncMount=()=>{
        if(!isMMG||!mountParent)return;
        mount.position.copy(figure.position);
        mount.rotation.copy(figure.rotation);
      };
      syncMount();
      const mountedGun=new THREE.Group();
      mountedGun.position.set(0,.37,-.49);mount.add(mountedGun);
      let deployedGrips=null;
      if(isMMG){
        G.block(mount,mats.hardware,[.17,.056,.18],[0,.115,-.49]);
        G.block(mount,mats.steel,[.066,.216,.066],[0,.244,-.49]);
        for(const side of [-1,0,1])
          G.wire(mount,mats.steel,[
            [0,.244,-.49],[side*.28,.098,side===0?-.81:-.33]
          ],.023);
        deployedGrips=profile(mountedGun,mats,kind,recipe,{bipodEnabled:false});
      }
      let deployed=false;
      const setDeployed=value=>{
        deployed=!!value&&isMMG;
        syncMount();
        mount.visible=deployed;weapon.visible=!deployed;
      };
      const isDeployed=()=>deployed;
      const setBipod=value=>{
        if(grips.bipod)grips.bipod.visible=!!value&&!deployed;
      };
      const current=()=>deployed?mountedGun:weapon;
      const local=which=>{
        const set=deployed?deployedGrips:grips;
        return set?.[which]?.clone()||point(0,0,0);
      };
      const getInTorso=which=>{
        syncMount();
        const node=current();
        node.updateWorldMatrix(true,true);
        breathing.updateWorldMatrix(true,false);
        return breathing.worldToLocal(node.localToWorld(local(which)));
      };
      return {kind,weapon,mount,grips,sections:grips.parts,
        deployedSections:deployedGrips?.parts||null,
        dimensions:grips.dimensions,anchors:grips.anchors,
        grip:which=>getInTorso(which),muzzle:()=>getInTorso("muzzle"),
        setDeployed,isDeployed,setBipod,syncMount,
        get worldSocket(){
          return which=>{
            syncMount();const node=current();
            node.updateWorldMatrix(true,false);
            return node.localToWorld(local(which));
          };
        },
        animateAction:phase=>{
          const value=Math.max(0,Math.min(1,phase||0));
          for(const group of [grips,deployedGrips]){
            if(!group)continue;
            const handle=group.parts.bolt?.children?.[0];
            if(handle&&Number.isFinite(handle.userData.cycleRest)){
              handle.position.z=handle.userData.cycleRest-value*.095;
              handle.rotation.z=value*.23;
            }
            // Pistol slide movement is a restrained mechanical action.
            // It does not represent extra rounds or a detachable magazine.
            if(group.kind==="pistol"){
              const slide=group.parts.receiver;
              slide.position.z=-value*.047;
            }else if(["mp38","mors39","mg34","wz28"].includes(group.kind)){
              // A small action flutter, not a floating receiver or weapon.
              group.parts.bolt.rotation.x=value*.032;
            }
          }
        }};
    }
    return Object.freeze({build,kindFor,profile});
  }
  window.Crossroads3DHistoricalWeapons=Object.freeze({create});
})();