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
    function stock(parent,mat,len=.67){
      // Continuous tapered wooden butt with a recognizable shoulder end.
      const m=S.loft(parent,mat,"rifle-stock-primary",[
        [-.5,.064,.093],[-.35,.073,.101],[.03,.068,.095],
        [.33,.046,.078],[.5,.042,.070]
      ],[0,-.038,.204]);
      m.rotation.x=Math.PI/2;m.scale.y=len;
    }
    function longGun(root,mats,kind,withBipod=true){
      const {steel,wood,hardware}=mats;
      const rifle=kind==="kar98k"||kind==="wz29",
        polish=kind==="wz28",mg=kind==="mg34";
      const end=rifle?-.88:mg?-.96:-.89;
      stock(root,mg?hardware:wood,mg?.59:.70);
      // Four strong shapes: stock, receiver, fore-end / jacket, barrel.
      S.box(root,steel,[.126,.099,rifle?.208:.250],[0,.010,-.129]);
      if(mg){
        // MG34 perforated jacket expressed as ONE dark cylindrical mass;
        // no microscopic vents or metal tabs at tabletop scale.
        barrel(root,hardware,point(0,.018,-.283),
          point(0,.018,-.815),.040);
        S.box(root,steel,[.134,.057,.103],[.084,.054,-.176]);
      }else{
        S.box(root,wood,[.106,.075,rifle?.337:.293],
          [0,-.020,rifle?-.366:-.334]);
      }
      barrel(root,steel,point(0,.018,mg?-.795:-.419),
        point(0,.018,end),rifle?.017:.021);
      // One oversized front sight is more useful than dozens of fittings.
      S.box(root,steel,[.025,.058,.022],[0,.059,end+.032]);
      if(rifle){
        // Recognizable long-stock Mauser-pattern rifle, minimal metalwork.
        S.box(root,steel,[.034,.025,.088],[0,.069,-.103]);
      }else if(polish){
        // Browning wz.28: distinctive downward-facing box magazine.
        S.box(root,steel,[.083,.178,.090],[0,-.132,-.183]);
      }else{
        // MG34: obvious receiver/feed box on the side of the gun.
        S.box(root,steel,[.165,.064,.120],[.091,.033,-.175]);
      }
      let bipod=null;
      if(!rifle&&withBipod){
        bipod=new THREE.Group();
        bipod.position.set(0,-.009,end+.17);root.add(bipod);
        for(const side of [-1,1])
          barrel(bipod,hardware,
            point(side*.028,-.015,0),
            point(side*.134,-.255,-.025),.013);
        // Folded while carried; visible only when deliberately braced/aimed.
        bipod.visible=false;
      }
      return {
        muzzle:point(0,.018,end-.023),
        primary:point(.067,-.082,.040),
        secondary:point(-.072,-.057,-.322),bipod
      };
    }
    function submachineGun(root,mats,kind){
      const {steel,wood,hardware}=mats;
      S.box(root,steel,[.118,.110,.245],[0,.018,-.17]);
      barrel(root,steel,point(0,.018,-.280),
        point(0,.018,kind==="mp38"?-.66:-.62),.024);
      S.box(root,steel,[.075,.195,.083],[0,-.151,-.171]);
      // A single readable handle/stock rather than tiny wire pieces.
      S.box(root,kind==="mp38"?hardware:wood,
        [.083,.094,.260],[0,-.045,.105]);
      return {muzzle:point(0,.018,kind==="mp38"?-.68:-.64),
        primary:point(.030,-.116,.014),
        secondary:point(-.057,-.045,-.238)};
    }
    function pistol(root,mats){
      const {steel,wood}=mats;
      S.box(root,steel,[.095,.082,.225],[0,0,-.075]);
      S.box(root,wood,[.075,.160,.078],[0,-.114,.013]).rotation.x=-.20;
      return {muzzle:point(0,.013,-.198),
        primary:point(.026,-.115,.014),
        secondary:point(-.07,-.065,-.1)};
    }
    function kindFor(faction,role){
      if(role==="officer")return "pistol";
      if(role==="mmg"||role==="lmg")
        return faction==="germany"?"mg34":"wz28";
      if(role==="smg")return faction==="germany"?"mp38":"mors39";
      return faction==="germany"?"kar98k":"wz29";
    }
    function build({figure,breathing,role,faction,mats}){
      const kind=kindFor(faction,role),isMMG=role==="mmg";
      const weapon=new THREE.Group();
      weapon.position.set(.045,-.095,-.335);
      weapon.rotation.set(-.08,.21,-.08);
      breathing.add(weapon);
      const grips=kind==="pistol"?pistol(weapon,mats):
        (kind==="mp38"||kind==="mors39")?
          submachineGun(weapon,mats,kind):
          longGun(weapon,mats,kind,true);
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
        const node=current();
        node.updateWorldMatrix(true,false);
        breathing.updateWorldMatrix(true,false);
        return breathing.worldToLocal(node.localToWorld(local(which)));
      };
      return {kind,weapon,mount,grips,
        grip:which=>getInTorso(which),muzzle:()=>getInTorso("muzzle"),
        setDeployed,isDeployed,setBipod};
    }
    return Object.freeze({create:build,kindFor});
  }
  window.Crossroads3DHistoricalWeapons=Object.freeze({create});
})();