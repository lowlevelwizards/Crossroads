"use strict";
// Silhouette-first early-war weapons: large identifiable features, no tiny
// decorative assembly. This module is visual only; combat stats stay in rules.
(() => {
  function create(THREE,S){
    const point=(x,y,z)=>S.v(x,y,z);
    const barrel=(parent,mat,from,to,r=.020)=>{
      const mesh=S.loft(parent,mat,"gun-barrel-"+r,[
        [-.5,r,r],[.5,r,r]
      ]);
      S.segment(mesh,from,to);return mesh;
    };
    function stock(parent,mat,len=.76){
      // Continuous tapered wooden butt with a recognizable shoulder end.
      const m=S.loft(parent,mat,"rifle-stock-v45",[
        [-.5,.079,.101],[-.35,.087,.110],[.03,.080,.105],
        [.33,.056,.087],[.5,.049,.077]
      ],[0,-.039,.217]);
      m.rotation.x=Math.PI/2;m.scale.y=len;
    }
    const sections=root=>{
      const parts={};
      for(const name of ["stock","receiver","barrel","magazine"]){
        parts[name]=new THREE.Group();root.add(parts[name]);
      }
      return parts;
    };
    function longGun(root,mats,kind,withBipod=true){
      const {steel,wood,hardware}=mats,parts=sections(root);
      const rifle=kind==="kar98k"||kind==="wz29",
        polish=kind==="wz28",mg=kind==="mg34";
      const end=rifle?-.88:mg?-.96:-.89;
      stock(parts.stock,mg?hardware:wood,mg?.67:.77);
      // Four strong shapes: stock, receiver, fore-end / jacket, barrel.
      S.box(parts.receiver,steel,[.146,.112,rifle?.211:.256],[0,.010,-.129]);
      if(mg){
        // MG34 perforated jacket expressed as ONE dark cylindrical mass;
        // no microscopic vents or metal tabs at tabletop scale.
        barrel(parts.barrel,hardware,point(0,.018,-.283),
          point(0,.018,-.815),.046);
        S.box(parts.receiver,steel,[.134,.057,.103],[.084,.054,-.176]);
      }else{
        S.box(parts.stock,wood,[.138,.096,rifle?.352:.308],
          [0,-.021,rifle?-.366:-.334]);
      }
      barrel(parts.barrel,steel,point(0,.018,mg?-.795:-.419),
        point(0,.018,end),rifle?.026:.030);
      // One oversized front sight is more useful than dozens of fittings.
      S.box(parts.barrel,steel,[.035,.062,.034],[0,.059,end+.032]);
      if(rifle){
        // Recognizable long-stock Mauser-pattern rifle, minimal metalwork.
        S.box(parts.receiver,steel,[.034,.025,.088],[0,.069,-.103]);
      }else if(polish){
        // Browning wz.28: distinctive downward-facing box magazine.
        S.box(parts.magazine,steel,[.105,.180,.107],[0,-.132,-.183]);
      }else{
        // MG34: obvious receiver/feed box on the side of the gun.
        S.box(parts.magazine,steel,[.165,.064,.120],[.091,.033,-.175]);
      }
      let bipod=null;
      if(!rifle&&withBipod){
        bipod=new THREE.Group();
        bipod.position.set(0,-.009,end+.17);parts.barrel.add(bipod);
        for(const side of [-1,1])
          barrel(bipod,hardware,
            point(side*.028,-.015,0),
            point(side*.134,-.255,-.025),.013);
        // Folded while carried; visible only when deliberately braced/aimed.
        bipod.visible=false;
      }
      return {
        muzzle:point(0,.018,end-.023),
        // Grip targets intersect the wood/receiver volumes: the single
        // mitten meshes now cradle them instead of hovering to either side.
        primary:point(.047,-.091,-.041),
        secondary:point(-.048,-.076,-.345),bipod,parts,
        gripNodes:{primary:parts.stock,secondary:parts.stock,muzzle:parts.barrel}
      };
    }
    function submachineGun(root,mats,kind){
      const {steel,wood,hardware}=mats,parts=sections(root);
      S.box(parts.receiver,steel,[.135,.117,.250],[0,.018,-.17]);
      barrel(parts.barrel,steel,point(0,.018,-.280),
        point(0,.018,kind==="mp38"?-.66:-.62),.031);
      S.box(parts.magazine,steel,[.075,.195,.083],[0,-.151,-.171]);
      // A single readable handle/stock rather than tiny wire pieces.
      S.box(parts.stock,kind==="mp38"?hardware:wood,
        [.083,.094,.260],[0,-.045,.105]);
      return {muzzle:point(0,.018,kind==="mp38"?-.68:-.64),
        primary:point(.036,-.113,-.006),
        secondary:point(-.040,-.067,-.238),parts,
        gripNodes:{primary:parts.stock,secondary:parts.receiver,muzzle:parts.barrel}};
    }
    function pistol(root,mats){
      const {steel,wood}=mats,parts=sections(root);
      S.box(parts.receiver,steel,[.108,.089,.225],[0,0,-.075]);
      S.box(parts.stock,wood,[.075,.160,.078],[0,-.114,.013]).rotation.x=-.20;
      return {muzzle:point(0,.013,-.198),
        primary:point(.026,-.115,.014),
        secondary:point(-.07,-.065,-.1),parts,
        gripNodes:{primary:parts.stock,secondary:parts.receiver,muzzle:parts.receiver}};
    }
    function kindFor(faction,role){
      if(role==="officer")return "pistol";
      if(role==="mmg"||role==="lmg")
        return faction==="germany"?"mg34":"wz28";
      if(role==="smg")return faction==="germany"?"mp38":"mors39";
      return faction==="germany"?"kar98k":"wz29";
    }
    function build({figure,breathing,role,faction,mats,weaponKind}){
      const kind=weaponKind||kindFor(faction,role),isMMG=role==="mmg";
      const weapon=new THREE.Group();
      weapon.position.set(.045,-.095,-.335);
      weapon.rotation.set(-.08,.21,-.08);
      breathing.add(weapon);
      const grips=kind==="pistol"?pistol(weapon,mats):
        (kind==="mp38"||kind==="mors39")?
          submachineGun(weapon,mats,kind):
          longGun(weapon,mats,kind,true);
      const presets=window.Crossroads3DWeaponLibrary;
      presets?.apply(grips.parts,kind);
      // An MMG tripod lives on the figure, not inside the animated torso.
      const mount=new THREE.Group();figure.add(mount);
      mount.visible=false;
      const mountedGun=new THREE.Group();
      mountedGun.position.set(0,.37,-.49);mount.add(mountedGun);
      let deployedGrips=null;
      if(isMMG){
        S.box(mount,mats.hardware,[.18,.055,.20],[0,.116,-.50]);
        S.box(mount,mats.steel,[.067,.23,.070],[0,.251,-.49]);
        for(const side of [-1,0,1])
          barrel(mount,mats.steel,point(0,.244,-.49),
            point(side*.31,.105,side===0?-.86:-.32),.020);
        deployedGrips=longGun(mountedGun,mats,kind,false);
        presets?.apply(deployedGrips.parts,kind);
      }
      let deployed=false;
      const setDeployed=value=>{
        deployed=!!value&&isMMG;
        mount.visible=deployed;weapon.visible=!deployed;
      };
      const isDeployed=()=>deployed;
      const setBipod=value=>{
        if(grips.bipod)grips.bipod.visible=!!value&&!deployed;
      };
      const current=()=>deployed?mountedGun:weapon;
      const local=which=>{
        const target=deployed?deployedGrips:grips;
        return target?.[which]?.clone()||point(0,0,0);
      };
      const getInTorso=which=>{
        const node=current(),target=deployed?deployedGrips:grips;
        node.updateWorldMatrix(true,true);
        breathing.updateWorldMatrix(true,false);
        const part=target?.gripNodes?.[which]||node;
        return breathing.worldToLocal(part.localToWorld(local(which)));
      };
      return {kind,weapon,mount,grips,sections:grips.parts,
        deployedSections:deployedGrips?.parts||null,
        grip:which=>getInTorso(which),muzzle:()=>getInTorso("muzzle"),
        setDeployed,isDeployed,setBipod};
    }
    return Object.freeze({build,kindFor});
  }
  window.Crossroads3DHistoricalWeapons=Object.freeze({create});
})();