"use strict";
// Crossroads compact heroic infantry: sculpted forms, meaningful sockets,
// historical kit recipes and an articulated rig shared by lab and battle.
// Battle rules remain authoritative; all pose channels here are cosmetic.
(() => {
  function create({THREE,miniatureScale=1,motion,shape}) {
    const sculpt=window.Crossroads3DSculptShapes;
    const weapons=window.Crossroads3DHistoricalWeapons;
    if(!sculpt||!weapons)return null;
    const S=sculpt.create(THREE),W=weapons.create(THREE,S),v=S.v;
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    const palette={
      poland:{coat:0x817f5e,pants:0x66674d,helmet:0x657058,
        straps:0x694936,pack:0x958866,boots:0x533e30},
      germany:{coat:0x65766c,pants:0x555f57,helmet:0x4d6259,
        straps:0x39332e,pack:0x8b8167,boots:0x3f352e}
    };
    function build(squad,x,z,facing,recipe,variant,index){
      const faction=recipe.kit.factionId==="germany"?"germany":"poland";
      const role=recipe.role||"rifle",col=palette[faction];
      const mat={
        uniform:S.material(col.coat,.98),
        trousers:S.material(col.pants,.98),
        helmet:S.material(col.helmet,.9),
        skin:S.material(0xc6a282,.95),
        eyes:S.material(0x292d2a),
        straps:S.material(col.straps,.9),
        pack:S.material(col.pack,.97),
        boots:S.material(col.boots,.85),
        steel:S.material(0x333b3a,.65),
        wood:S.material(0x70503a,.86),
        hardware:S.material(0x53564b,.78),
        soles:S.material(0x302b28,.98),
        brass:S.material(0x9d8d60,.8)
      };
      const figure=new THREE.Group();
      figure.position.set(x,0,z);figure.rotation.y=facing;
      figure.scale.setScalar(miniatureScale);squad.root.add(figure);
      const base=new THREE.Group();figure.add(base);
      const baseMat=mat.hardware;
      const baseG=S.cached("round-base",()=>new THREE.CylinderGeometry(.38,.41,.105,24));
      S.mesh(base,baseG,baseMat,[0,.035,0]);
      S.mesh(base,S.cached("base-top",()=>new THREE.CylinderGeometry(.347,.347,.015,24)),
        mat.helmet,[0,.094,0]);
      const body=new THREE.Group();figure.add(body);
      const breathing=new THREE.Group();breathing.position.y=.90;body.add(breathing);
      // Anatomical mannequin visible only during proportion inspection.
      const anatomy=new THREE.Group();breathing.add(anatomy);anatomy.visible=false;
      S.soft(anatomy,mat.skin,[0,.04,0],[.245,.29,.187]);
      S.soft(anatomy,mat.skin,[0,-.23,.0],[.195,.135,.165]);
      const uniformGroup=new THREE.Group();breathing.add(uniformGroup);
      // Shaped tunic: five authored cross sections, collar flaps and hem.
      const torso=S.loft(uniformGroup,mat.uniform,"tunic-1939",[
        [-.32,.195,.185],[-.23,.249,.201],[-.07,.256,.218],
        [.15,.286,.227],[.32,.228,.179],[.36,.165,.14]
      ],[0,.015,0]);
      const uniformParts=[torso];
      const hem=S.loft(uniformGroup,mat.uniform,"tunic-hem",[
        [-.5,.249,.202],[-.35,.257,.214],[.3,.260,.213],
        [.5,.232,.185]
      ],[0,-.262,.009]);
      hem.scale.y=.075;uniformParts.push(hem);
      const waist=S.loft(uniformGroup,mat.straps,"belt-ring",[
        [-.5,.246,.203],[.5,.247,.204]
      ],[0,-.212,0]);
      waist.scale.y=.058;
      const collarLeft=S.box(uniformGroup,mat.uniform,[.154,.092,.112],
        [-.103,.349,-.083]);
      const collarRight=S.box(uniformGroup,mat.uniform,[.154,.092,.112],
        [.103,.349,-.083]);
      collarLeft.rotation.z=.16;collarRight.rotation.z=-.16;
      collarLeft.rotation.x=-.17;collarRight.rotation.x=-.17;
      S.soft(uniformGroup,mat.straps,[0,.28,.014],[.105,.026,.055]);
      // Faction-distinct tunic construction: collar, pockets and seams.
      // Small cues are understated at battle distance, visible in the lab.
      for(const side of [-1,1]){
        S.box(uniformGroup,mat.uniform,
          faction==="germany"?[.118,.109,.019]:[.128,.125,.021],
          [side*.153,.092,-.216]);
        S.box(uniformGroup,mat.straps,[.114,.020,.018],
          [side*.153,.143,-.228]);
        if(faction==="poland"){
          S.box(uniformGroup,mat.uniform,[.116,.090,.019],
            [side*.156,-.150,-.206]);
        }else{
          S.box(uniformGroup,mat.hardware,[.032,.018,.013],
            [side*.153,.110,-.233]);
        }
      }
      // No separate giant spherical 'shoulder caps'. Sleeve contour meets
      // the chest; upper/lower segments form an actual bent elbow.
      const arms=[];
      for(const side of [-1,1]){
        const upper=S.loft(breathing,mat.uniform,"upper-sleeve",[
          [-.5,.074,.073],[-.38,.088,.084],[-.10,.094,.095],
          [.24,.099,.101],[.5,.082,.084]
        ],[0,0,0],16);
        const lower=S.loft(breathing,mat.uniform,"lower-sleeve",[
          [-.5,.065,.067],[-.26,.072,.072],[.05,.087,.083],
          [.35,.092,.088],[.5,.076,.075]
        ]);
        const handGroup=new THREE.Group();breathing.add(handGroup);
        const hand=S.soft(handGroup,mat.skin,[0,0,0],[.083,.071,.076]);
        const thumb=S.soft(handGroup,mat.skin,[side*.065,-.018,-.055],
          [.031,.047,.035]);thumb.rotation.z=side*.23;
        const cuff=S.loft(handGroup,mat.uniform,"sleeve-cuff",[
          [-.5,.067,.069],[.5,.074,.071]
        ],[0,.073,.02]);cuff.scale.y=.065;
        const shoulder=v(side*.252,.207,-.015);
        const elbow=v(side*.307,.015,-.135);
        const arm={side,upper,lower,hand:handGroup,shoulder,elbow,
          thumb,cuff,skinHand:hand};
        arms.push(arm);
      }
      // Separate, short thigh and trouser legs; no faceted armor-knee blobs.
      const pelvis=S.soft(uniformGroup,mat.trousers,[0,-.27,.012],
        [.238,.13,.18]);uniformParts.push(pelvis);
      const legs=[];
      for(const side of [-1,1]){
        const thigh=S.loft(body,mat.trousers,"thigh-trouser",[
          [-.5,.102,.103],[-.28,.124,.121],[.10,.132,.125],
          [.40,.135,.12],[.5,.107,.105]
        ]);
        const shin=S.loft(body,mat.trousers,"lower-trouser",[
          [-.5,.085,.086],[-.28,.104,.104],[.12,.112,.113],
          [.35,.110,.111],[.5,.096,.094]
        ]);
        const bootModel=S.boot(body,mat.boots,mat.soles,side,.18);
        const boot=bootModel.root;
        legs.push({side,mesh:thigh,shin,boot,bootModel,
          hip:v(side*.146,.575,.018),knee:v(side*.153,.41,-.085)});
      }
      const headGroup=new THREE.Group();
      headGroup.position.set(0,.406,-.004);breathing.add(headGroup);
      // Head is shaped with a subtle jaw and little face, not protruding
      // spherical ears and a bright button nose.
      S.soft(headGroup,mat.skin,[0,.132,-.005],[.216,.217,.190]);
      S.soft(headGroup,mat.skin,[0,.020,-.037],[.171,.089,.151]);
      S.soft(headGroup,mat.skin,[0,.063,-.191],[.047,.048,.034]);
      for(const side of [-1,1]){
        S.soft(headGroup,mat.skin,[side*.197,.090,.005],[.023,.048,.038]);
        const eye=S.soft(headGroup,mat.eyes,[side*.078,.153,-.189],
          [.019,.028,.007]);
        eye.rotation.z=-side*.045;
        const brow=S.soft(headGroup,mat.skin,[side*.079,.202,-.186],
          [.067,.018,.022]);brow.rotation.z=-side*.09;
      }
      const hat=new THREE.Group();headGroup.add(hat);
      if(role==="officer"){
        S.loft(hat,mat.helmet,"officer-cap",[
          [-.5,.217,.190],[-.25,.229,.195],[.23,.204,.178],[.5,.160,.155]
        ],[0,.340,.018]).scale.y=.16;
        S.soft(hat,mat.helmet,[0,.416,.017],[.202,.054,.172]);
        S.box(hat,mat.soles,[.44,.025,.19],[0,.282,-.140]);
      }else{
        const domeGeometry=S.cached("smooth-steel-helmet",()=>
          new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2));
        const shell=S.mesh(hat,domeGeometry,mat.helmet,[0,.263,.009]);
        shell.scale.set(faction==="germany"?.259:.252,.251,
          faction==="germany"?.275:.260);
        const brim=S.loft(hat,mat.helmet,
          faction==="germany"?"stahlhelm-skirt":"wz31-brim",[
          [-.5,faction==="germany"?.290:.276,.268],
          [-.3,faction==="germany"?.294:.280,.270],
          [.4,.252,.242],[.5,.241,.235]
          ],[0,.267,.004]);
        brim.scale.y=.07;
        if(faction==="germany")for(const side of [-1,1])
          S.box(hat,mat.helmet,[.078,.068,.162],
            [side*.266,.225,.038]);
      }
      for(const side of [-1,1])
        S.strap(headGroup,mat.straps,[
          [side*.20,.220,.035],[side*.207,.100,.065],
          [side*.170,-.024,-.045]
        ],.018,.01);
      // Historical load-bearing kit. Straps follow chest curvature; bags are
      // mounted on the body or waist instead of world-space positions.
      // A visible, curved chest/neck transition (not a giant donut collar).
      const equipmentRoot=new THREE.Group();breathing.add(equipmentRoot);
      const packGroup=new THREE.Group();
      packGroup.position.set(0,-.010,.230);equipmentRoot.add(packGroup);
      const pack=S.loft(packGroup,mat.pack,"canvas-pack",[
        [-.5,.163,.105],[-.4,.208,.126],[.28,.216,.138],
        [.42,.189,.11],[.5,.152,.094]
      ],[0,0,.037]);pack.scale.y=.52;
      S.box(packGroup,mat.pack,[.356,.076,.171],[0,.226,.096]);
      for(const side of [-1,1]){
        S.strap(equipmentRoot,mat.straps,[
          [side*.154,.365,-.135],[side*.208,.256,-.151],
          [side*.232,.097,-.171],[side*.206,-.102,-.181],
          [side*.168,-.210,-.180]
        ],.043,.011);
        S.strap(packGroup,mat.straps,[
          [side*.123,.266,.149],[side*.127,.044,.184],
          [side*.129,-.233,.149]
        ],.029,.010);
        const ammo=S.box(equipmentRoot,mat.straps,
          [.137,.119,.096],[side*.18,-.190,-.210]);
        S.box(equipmentRoot,mat.straps,[.144,.038,.100],
          [side*.18,-.117,-.215]);
      }
      // Retaining straps go over the roll (no unexplained open cylinder).
      const roll=S.loft(packGroup,mat.pack,"blanket-roll",[
        [-.5,.096,.097],[-.44,.112,.111],[.44,.112,.111],[.5,.094,.096]
      ],[0,.345,.021]);roll.rotation.z=Math.PI/2;roll.scale.y=.425;
      for(const side of [-1,1])
        S.box(packGroup,mat.straps,[.026,.237,.032],
          [side*.145,.343,.021]);
      const canteen=S.soft(equipmentRoot,mat.pack,[.276,-.235,.175],
        [.083,.128,.072]);
      S.box(equipmentRoot,mat.straps,[.056,.037,.059],
        [.276,-.102,.175]);
      const bag=S.loft(equipmentRoot,mat.pack,"bread-bag",[
        [-.5,.080,.070],[-.27,.117,.087],[.32,.121,.086],
        [.5,.082,.069]
      ],[-.293,-.185,.120]);bag.scale.y=.28;
      S.box(equipmentRoot,mat.straps,[.155,.040,.110],
        [-.293,-.047,.121]);
      if(role==="lmg"||role==="loader"||role==="mmg"){
        // Extra ammunition for crew roles, carried at the belt.
        S.box(equipmentRoot,mat.hardware,[.175,.167,.114],
          [-.264,-.232,.140]);
      }
      if(role==="officer"){
        S.box(equipmentRoot,mat.straps,[.190,.208,.075],
          [.288,-.152,.088]);
        packGroup.scale.setScalar(.70);
      }
      const armaments=W.build({figure,body,breathing,role,faction,
        mats:{steel:mat.steel,wood:mat.wood,strap:mat.straps,
          hardware:mat.hardware}});
      const weapon=armaments.weapon;
      const inspectRing=S.mesh(figure,S.cached("inspection-ring",()=>
        new THREE.RingGeometry(.46,.51,24)),new THREE.MeshBasicMaterial({
        color:0xf5d37f,transparent:true,opacity:.85,depthWrite:false,
        depthTest:false,side:THREE.DoubleSide}),[0,.109,0]);
      inspectRing.rotation.x=-Math.PI/2;inspectRing.visible=false;
      const firingArc=new THREE.Group();squad.root.add(firingArc);
      const wedge=shape(firingArc,new THREE.RingGeometry(.2,1.8,32,1,
        Math.PI/6,Math.PI*2/3),new THREE.MeshBasicMaterial({
          color:0xe3cf9e,transparent:true,opacity:.14,depthWrite:false,
          depthTest:false,side:THREE.DoubleSide}),0,0,0);
      wedge.rotation.x=-Math.PI/2;firingArc.visible=false;
      const muzzleLocal=v(0,0,0);
      const soldier={figure,base,body,breathing,legs,arms,headGroup,weapon,
        torso,uniformGroup,uniformParts,equipmentRoot,packGroup,inspectRing,
        windowArc:firingArc,role,modelVersion:3,phase:0,recoil:0,crouch:0,
        baseY:.90,grounded:false,lastFootingFrame:-100,slotX:x,slotZ:z,
        gait:motion.gaitFor(squad.index,index),muzzleLocal,rigMarkers:[]};
      squad.soldiers.push(soldier);
      let gesture=0;
      soldier.applyGesture=value=>{gesture=clamp(Number(value)||0,0,1)};
      soldier.setGunDeployed=value=>{
        armaments.setDeployed(value);soldier.gunDeployed=armaments.isDeployed();
      };
      soldier.setGunDeployed(squad.unit.mmgDeployed??true);
      soldier.updateMuzzle=()=>muzzleLocal.copy(armaments.muzzle());
      soldier.applyProfile=(raw={})=>{
        const p=window.Crossroads3DMiniatureProfiles?.normalize(raw)||raw;
        headGroup.scale.setScalar(p.headSize||1);
        // Author-calibrated multiplier, never overwrite a geometric radius.
        torso.scale.x=p.bodyWidth||1;
        packGroup.scale.setScalar((p.packSize||1)*(role==="officer"?.70:1));
        for(const leg of legs)leg.boot.scale.setScalar(p.bootSize||1);
        soldier.profile=p;
      };
      soldier.inspectionMode="equipped";
      const silhouetteMat=S.material(0x303834,.96);
      const originalMaterials=new Map();
      soldier.setInspectionMode=(mode="equipped")=>{
        // Restore surfaces before switching from monochrome silhouette.
        for(const [mesh,material] of originalMaterials)
          mesh.material=material;
        originalMaterials.clear();
        soldier.inspectionMode=mode;
        const naked=mode==="body",silhouette=mode==="silhouette";
        const equipped=mode==="equipped"||silhouette;
        anatomy.visible=naked;uniformGroup.visible=!naked;
        equipmentRoot.visible=equipped;
        armaments.weapon.visible=equipped&&!armaments.isDeployed();
        armaments.mount.visible=equipped&&armaments.isDeployed();
        hat.visible=!naked&&soldier.profile?.helmet!=="off";
        for(const arm of arms){
          arm.upper.material=naked?mat.skin:mat.uniform;
          arm.lower.material=naked?mat.skin:mat.uniform;
          arm.cuff.visible=!naked;
        }
        for(const leg of legs){
          leg.mesh.material=naked?mat.skin:mat.trousers;
          leg.shin.material=naked?mat.skin:mat.trousers;
          // Keep natural feet visible in the bare-body comparison.
          leg.boot.visible=true;
          leg.bootModel.upper.material=naked?mat.skin:mat.boots;
          leg.bootModel.cuff.visible=!naked;
          leg.bootModel.sole.visible=!naked;
          leg.bootModel.heel.visible=!naked;
        }
        if(silhouette){
          body.traverse(node=>{
            if(!node.isMesh||!node.visible)return;
            originalMaterials.set(node,node.material);
            node.material=silhouetteMat;
          });
          armaments.mount.traverse(node=>{
            if(!node.isMesh||!node.visible)return;
            originalMaterials.set(node,node.material);
            node.material=silhouetteMat;
          });
        }
      };
      soldier.applyLook=(look={})=>{
        const scheme=look.uniform||"field";
        mat.uniform.color.setHex(scheme==="olive"?0x53654c:
          scheme==="khaki"?0x9a8a62:col.coat);
        mat.trousers.color.setHex(scheme==="olive"?0x465349:
          scheme==="khaki"?0x746749:col.pants);
        mat.helmet.color.setHex(look.helmetTint==="dark"?0x394b40:
          look.helmetTint==="dust"?0x938266:col.helmet);
        mat.straps.color.setHex(look.leatherTint==="dark"?0x302c29:
          look.leatherTint==="russet"?0x794e34:col.straps);
        soldier.applyProfile(look);
        soldier.setInspectionMode(soldier.inspectionMode);
        packGroup.visible=look.pack!=="off"&&soldier.inspectionMode==="equipped";
      };
      const poseDefaults={crouch:0,bob:0,lean:0,roll:0,forward:0,fall:0,
        leftLift:0,rightLift:0,leftReach:0,rightReach:0,aim:false};
      soldier.applyPose=(raw={},opts={})=>{
        const pose={...poseDefaults,...raw},action=pose.action||"idle";
        const down=action==="down",cover=action==="cover",
          kneel=action==="kneel";
        // Inspection poses are strictly cosmetic and never invoked by battle.
        const reference=action==="reference"||action==="tpose";
        const tpose=action==="tpose";
        const fall=clamp(pose.fall||0,0,1),eased=fall*fall*(3-2*fall);
        const crouch=clamp(pose.crouch||0,0,1);
        const moving=["walk","run","assault","enter","exit"].includes(action);
        const compact=clamp(crouch*.14,0,.15);
        // The hips travel backward and downward during crouching, not merely
        // the torso sinking through both kneecaps.
        breathing.position.set((down?.017:0),.90-compact-
          crouch*.075+(pose.bob||0),
          reference?0:-(pose.forward||0)+(crouch*.042));
        breathing.rotation.set(reference?0:-(pose.lean||0)*.62,0,
          reference?0:(pose.roll||0)*(1-eased));
        headGroup.rotation.x=reference?0:(pose.headDuck||0)+crouch*.065;
        headGroup.rotation.z=reference?0:((index%3)-1)*.033*(1-eased);
        headGroup.rotation.y=action==="turn"?.16:0;
        // A clean model reference must not contain the weapon or dangling
        // field kit. Restore each when leaving the reference action.
        const showKit=!reference&&
          (soldier.inspectionMode==="equipped"||
           soldier.inspectionMode==="silhouette");
        equipmentRoot.visible=showKit;
        armaments.weapon.visible=showKit&&!armaments.isDeployed();
        armaments.mount.visible=showKit&&armaments.isDeployed();
        const fallAngle=eased*1.23;
        body.rotation.set(-eased*.14,0,-fallAngle);
        body.position.set(.08*eased,-.015*eased,0);
        // The support weapon is NOT a child of this rotating body.
        if(!armaments.isDeployed()){
          weapon.rotation.set(pose.aim?-.15:-.055,
            pose.aim?-.04:.24,pose.aim?-.05:-.11);
          weapon.position.set(.028,(pose.aim?.03:-.095)-
            (pose.recoil||0)*.05,-.32);
        }
        // In locomotion, each leg's foot contact is carried from the existing
        // distance-based gait; in cover, change leg stance and widen contact.
        for(const leg of legs){
          const side=leg.side;
          const lift=(side<0?pose.leftLift:pose.rightLift)||0;
          const reach=(side<0?pose.leftReach:pose.rightReach)||0;
          const stride=moving?reach:0;
          const stance=down?(side<0?-.22:.15):
            kneel?(side<0?-.19:.23):
            cover?(side<0?-.15:.10):
            (!moving&&action==="idle"?(side<0?-.018:.038):0);
          const foot=leg.boot;
          foot.position.set(side*(.145+crouch*.024),
            .18+lift*(1-crouch*.3),-.045+stride+stance);
          foot.rotation.set(0,side*(crouch*.11)+
            (!moving&&action==="idle"?(index%3-1)*.07:0),0);
          const solver=window.Crossroads3DSoldierIK;
          const upright=(reference||action==="idle"||action==="aim"||
            action==="ambush")&&crouch<.04&&lift<.01;
          const hipY=.715-crouch*.21;
          const k=solver?.solve({hipY,hipZ:crouch*.035,
            footY:foot.position.y+.091,footZ:foot.position.z,
            upper:.275,lower:.26});
          if(upright){
            // Long, almost vertical reference legs, with distinct knees.
            // The previous resting hip height (.586) made every soldier squat.
            const hip=v(side*.146,.715,.010);
            const knee=v(side*.150,.466,-.014);
            const ankle=v(side*.145,.265,-.045);
            S.segment(leg.mesh,hip,knee);
            S.segment(leg.shin,knee,ankle);
          }else if(k){
            const hip=v(side*.146,k.hip.y,k.hip.z);
            const knee=v(side*.146,k.knee.y,k.knee.z);
            const ankle=v(side*.145,k.ankle.y,k.ankle.z);
            S.segment(leg.mesh,hip,knee);
            S.segment(leg.shin,knee,ankle);
          }
        }
        const right=armaments.grip("primary"),left=armaments.grip("secondary");
        // Down and role-specific gestures keep elbows away from the torso;
        // the weapon is held in actual contact with both hands.
        for(const arm of arms){
          const side=arm.side,shoulder=arm.shoulder;
          const wrist=reference?
            (tpose?v(side*.594,.210,-.015):
              v(side*.294,-.282,-.010)):
            (side===1?right:left).clone();
          if(gesture>0&&!reference&&side===1)
            wrist.set(.35,.24+gesture*.30,-.18);
          if(!reference&&role==="officer"&&!pose.aim&&!armaments.isDeployed()&&side===-1)
            wrist.set(-.22,-.22,-.12);
          const direction=wrist.clone().sub(shoulder),distance=direction.length();
          const elbow=reference?
            (tpose?v(side*.421,.210,-.015):
              v(side*.314,-.050,-.004)):
            shoulder.clone().lerp(wrist,.47);
          if(!reference){
            const pole=v(side*.18,-.13,pose.aim?.06:.11);
            elbow.add(pole.multiplyScalar(clamp(distance/.44,.7,1.25)));
          }
          // More natural compact arm bend, no straight blocky L-pose.
          S.segment(arm.upper,shoulder,elbow);
          S.segment(arm.lower,elbow,wrist);
          arm.hand.position.copy(wrist);
          arm.hand.rotation.y=reference?0:side*(pose.aim?.11:.23);
        }
        soldier.updateMuzzle();
      };
      const look=window.Crossroads3DMiniatureProfiles?.read(
        recipe.kit.id,squad.unit.type,index)||{};
      soldier.applyLook(look);
      soldier.applyPose({action:"idle"});
      return figure;
    }
    return build;
  }
  window.Crossroads3DHeroicMiniature=Object.freeze({create});
})();