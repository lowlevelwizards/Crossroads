"use strict";
// Recognizable 1939 weapon silhouettes, distinct carried and grounded mounts.
// Visual presentation only — no ammunition or combat-rule authority here.
(() => {
  function create(THREE,S){
    const v=S.v;
    const barrel=(parent,mat,from,to,r=.018)=>{
      const d=to.clone().sub(from),len=d.length();
      const mesh=S.loft(parent,mat,"barrel-"+r,[
        [-.5,r,r],[-.44,r*1.05,r*1.05],
        [.43,r,r],[.5,r*.9,r*.9]
      ]);
      S.segment(mesh,from,to);return mesh;
    };
    const point=(x,y,z)=>v(x,y,z);
    function addLongGun(root,mats,kind){
      const {steel,wood,strap,hardware}=mats;
      const isRifle=kind==="wz29"||kind==="kar98k";
      const polish=kind==="wz28";
      const germanMG=kind==="mg34";
      const end=isRifle?-.62:germanMG?-.75:-.70;
      // One continuous, recognizable stock silhouette rather than a floating
      // receiver and unrelated dark barrel.
      S.loft(root,wood,"stock-"+kind,[
        [-.5,.059,.115],[-.32,.075,.115],[.03,.058,.091],
        [.28,.044,.085],[.5,.034,.070]
      ],[0,-.042,.170]).rotation.x=Math.PI/2;
      S.soft(root,wood,[0,-.048,.155],[.072,.071,.155]);
      S.box(root,hardware,[.119,.115,.205],[0,.013,-.120]);
      S.box(root,steel,[.045,.032,.081],[0,.078,-.093]); // bolt/top
      S.box(root,steel,[.017,.066,.015],[.084,.018,-.070]); // bolt handle
      S.box(root,wood,[.101,.065,.210],[0,-.010,-.282]);
      barrel(root,steel,point(0,.019,-.30),point(0,.019,end),.018);
      for(const z of [-.33,-.43])
        S.box(root,steel,[.109,.074,.023],[0,-.005,z]);
      S.box(root,steel,[.015,.075,.015],[0,.057,end+.026]); // sight
      S.box(root,hardware,[.028,.10,.013],[0,-.104,-.084]); // trigger guard
      if(isRifle){
        S.box(root,wood,[.035,.060,.064],[0,-.096,-.094]);
        // Rifle sling hangs along the stock; does not float at world origin.
        S.strap(root,strap,[[-.045,-.035,.18],[-.102,-.12,.04],
          [-.102,-.17,-.24],[-.047,-.055,-.43]],.018,.009);
      }else{
        if(polish){
          // The Browning wz.28 box magazine is BELOW the receiver.
          S.box(root,steel,[.086,.155,.090],[0,-.129,-.157]);
          S.box(root,hardware,[.098,.027,.098],[0,-.213,-.157]);
        }
        if(germanMG){
          // Barrel jacket and feed arrangement of the MG34.
          S.loft(root,steel,"mg34-jacket",[
            [-.5,.039,.039],[-.4,.045,.045],[.38,.044,.044],[.5,.036,.036]
          ],[0,.016,-.515]).rotation.x=Math.PI/2;
          for(const z of [-.41,-.49,-.57,-.65])
            S.box(root,hardware,[.074,.014,.010],[0,.050,z]);
          S.box(root,steel,[.17,.060,.092],[.092,.043,-.173]);
          S.soft(root,hardware,[.185,.033,-.168],[.078,.043,.050]);
        }
        // Bipod is a hinged piece connected to the forward barrel/forestock.
        const bipod=new THREE.Group();bipod.position.set(0,-.013,end+.14);
        root.add(bipod);
        S.box(bipod,hardware,[.123,.047,.044],[0,0,0]);
        for(const side of [-1,1]){
          const leg=barrel(bipod,steel,point(side*.025,-.015,0),
            point(side*.138,-.315,-.05),.013);
          S.box(bipod,steel,[.070,.023,.035],
            [side*.144,-.32,-.05]);
        }
      }
      return {muzzle:point(0,.019,end-.022),
        primary:point(.065,-.083,.035),
        secondary:point(-.071,-.052,-.31)};
    }
    function submachineGun(root,mats,kind){
      const {steel,wood,hardware}=mats;
      // Distinct compact receiver, side folding-stock frame and projecting
      // magazine rather than a shortened bolt-action rifle.
      S.box(root,steel,[.119,.118,.255],[0,.015,-.13]);
      const muzzle=kind==="mp38"?-.51:-.48;
      barrel(root,steel,point(0,.02,-.26),point(0,.02,muzzle),.023);
      S.box(root,steel,[.032,.068,.020],[0,.070,muzzle+.027]);
      S.box(root,steel,[.076,.225,.085],[0,-.167,-.17]);
      S.box(root,wood,[.082,.140,.075],[0,-.123,.012]);
      S.box(root,hardware,[.020,.024,.29],[.083,-.042,.055]);
      S.box(root,hardware,[.020,.18,.020],[.081,-.112,.189]);
      S.box(root,hardware,[.116,.025,.018],[.022,-.204,.195]);
      return {muzzle:point(0,.02,muzzle-.015),
        primary:point(.035,-.122,.005),
        secondary:point(-.064,-.042,-.252)};
    }
    function pistol(root,mats){
      const {steel,wood,hardware}=mats;
      S.box(root,steel,[.095,.075,.185],[0,0,-.08]);
      S.box(root,steel,[.094,.032,.16],[0,.047,-.10]);
      S.box(root,wood,[.070,.16,.065],[0,-.117,-.005]).rotation.x=-.26;
      S.box(root,hardware,[.017,.035,.012],[0,.088,-.153]);
      return {muzzle:point(0,.012,-.20),primary:point(.026,-.115,0),
        secondary:point(-.07,-.055,-.10)};
    }
    function kindFor(faction,role){
      if(role==="officer")return "pistol";
      if(role==="mmg"||role==="lmg")return faction==="germany"?"mg34":"wz28";
      if(role==="smg")return faction==="germany"?"mp38":"mors39";
      return faction==="germany"?"kar98k":"wz29";
    }
    function build({figure,breathing,body,role,faction,mats}){
      const kind=kindFor(faction,role),isMMG=role==="mmg";
      const weapon=new THREE.Group();
      weapon.position.set(.045,-.095,-.335);
      weapon.rotation.set(-.08,.21,-.08);
      breathing.add(weapon);
      const grips=kind==="pistol"?pistol(weapon,mats):
        (kind==="mp38"||kind==="mors39")?submachineGun(weapon,mats,kind):
        addLongGun(weapon,mats,kind);
      // Gun carriage is a separate sibling of the animated body.
      const mount=new THREE.Group();figure.add(mount);
      mount.visible=false;
      const mountedGun=new THREE.Group();
      mountedGun.position.set(0,.37,-.49);mount.add(mountedGun);
      let deployedGrips=null;
      if(isMMG){
        const footing=S.box(mount,mats.hardware,[.20,.05,.24],[0,.12,-.5]);
        S.box(mount,mats.steel,[.07,.24,.075],[0,.26,-.49]);
        for(const side of [-1,0,1]){
          const leg=barrel(mount,mats.steel,point(0,.24,-.49),
            point(side*.31,.109,side===0?-.86:-.32),.019);
          S.box(mount,mats.steel,[.1,.026,.075],
            [side*.31,.104,side===0?-.86:-.32]);
        }
        deployedGrips=addLongGun(mountedGun,mats,kind);
      }
      let deployed=false;
      const setDeployed=value=>{
        deployed=!!value&&isMMG;
        mount.visible=deployed;
        weapon.visible=!deployed;
      };
      const isDeployed=()=>deployed;
      const current=()=>deployed?mountedGun:weapon;
      const local=(which)=>{
        const target=deployed?deployedGrips:grips;
        return target?.[which]?.clone()||point(0,0,0);
      };
      const getInTorso=(which)=>{
        const node=current();node.updateWorldMatrix(true,false);
        breathing.updateWorldMatrix(true,false);
        return breathing.worldToLocal(node.localToWorld(local(which)));
      };
      return {kind,weapon,mount,grips,grip:(which)=>getInTorso(which),
        muzzle:()=>getInTorso("muzzle"),setDeployed,isDeployed};
    }
    return Object.freeze({build,kindFor});
  }
  window.Crossroads3DHistoricalWeapons=Object.freeze({create});
})();