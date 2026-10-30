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
    const sdf=window.Crossroads3DSDFTransitions?.create(THREE,S)||null;
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
      // The visible torso is the mannequin. No duplicate skin cylinders
      // or auxiliary anatomical blobs are created beneath its clothing.
      const uniformGroup=new THREE.Group();breathing.add(uniformGroup);
      // Shaped tunic: five authored cross sections, collar flaps and hem.
      const torso=S.loft(uniformGroup,mat.uniform,"tunic-1939-"+faction,
        faction==="poland"?[
          [-.32,.195,.185],[-.23,.249,.201],[-.07,.256,.218],
          [.15,.286,.227],[.32,.228,.179],[.36,.165,.14]
        ]:[
          [-.32,.185,.182],[-.23,.232,.197],[-.07,.252,.210],
          [.15,.276,.220],[.32,.231,.187],[.36,.164,.142]
        ],[0,.015,0]);
      // A pair of crisp collar tabs provides uniform character without
      // tiny buttons or another torus-like scarf over the chest.
      for(const side of [-1,1]){
        const collar=S.box(uniformGroup,mat.uniform,
          [faction==="poland"?.091:.083,.034,.056],
          [side*.109,.334,-.130]);
        collar.rotation.z=side*(faction==="poland"?.21:.12);
      }
      const uniformParts=[torso];
      // The sculpted torso already defines the hem, shoulder width and
      // waist. Extra collar blocks, belt rings, pockets and body fragments
      // only obscure the silhouette at miniature scale.
      // No separate shoulder caps. Sleeve contour meets
      // the chest; upper/lower segments form an actual bent elbow.
      const arms=[];
      for(const side of [-1,1]){
        const upper=S.loft(breathing,mat.uniform,"upper-sleeve",[
          [-.5,.074,.073],[-.38,.088,.084],[-.10,.094,.095],
          [.24,.099,.101],[.5,.082,.084]
        ],[0,0,0],10);
        const lower=S.loft(breathing,mat.uniform,"lower-sleeve",[
          [-.5,.065,.067],[-.26,.072,.072],[.05,.087,.083],
          [.35,.092,.088],[.5,.076,.075]
        ]);
        const handGroup=new THREE.Group();breathing.add(handGroup);
        // A single flattened palm: readable when carrying a weapon but not a ball.
        const hand=S.soft(handGroup,mat.skin,[0,0,0],[.078,.048,.065]);
        hand.rotation.z=side*.13;
        // The single hand mesh is the entire mitten. No floating thumb
        // sphere or separate wrist cuff.
        // Seat the sleeve root inside the chest instead of leaving a
        // vertical gap above the upper arm.
        const shoulder=v(side*.236,.207,-.012);
        const elbow=v(side*.307,.015,-.135);
        const seam=sdf?.joint(breathing,mat.uniform,"elbow")||null;
        const arm={side,upper,lower,hand:handGroup,shoulder,elbow,seam,
          skinHand:hand};
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
        // Shared vertices for lower trouser, puttees or marching boots:
        // color bands cannot float, separate, or double-scale with movement.
        const shin=S.clothedShin(body,mat.trousers,mat.boots,faction);
        const bootModel=S.boot(body,mat.boots,mat.soles,side,.15);
        const boot=bootModel.root;
        const seam=sdf?.joint(body,mat.trousers,"knee")||null;
        legs.push({side,mesh:thigh,shin,boot,bootModel,seam,
          hip:v(side*.146,.575,.018),knee:v(side*.153,.41,-.085)});
      }
      const headGroup=new THREE.Group();
      headGroup.position.set(0,.406,-.004);breathing.add(headGroup);
      // Slightly squared heroic head with broad cheeks and a restrained
      // chin. One main volume, no projecting nose or brows.
      const editableHead=S.loft(headGroup,mat.skin,"head-silhouette-v6",[
        [-1,.64,.68],[-.79,.79,.83],[-.37,.95,.96],
        [.13,1,1],[.68,.95,.96],[1,.73,.79]
      ],[0,.132,-.002],16);
      // Keep historical approved Workbench head contours in their original
      // normalized coordinate space: switching shape sources stays safe.
      editableHead.scale.set(.218,.219,.192);
      for(const side of [-1,1]){
        S.soft(headGroup,mat.skin,[side*.205,.085,.008],
          [.038,.054,.040]);
        // Flat eyes are the only facial details; no separate brows/nose.
        S.soft(headGroup,mat.eyes,[side*.071,.132,-.184],
          [.014,.019,.007]);
      }
      const hat=new THREE.Group();
      // Backward pitch raises the front rim; lower it to meet the forehead.
      // The new self-contained helmet has its own brim/skirt contour; 
      // keep the shell seated on the head instead of tilting it into a cap.
      hat.position.set(0,-.055,-.006);
      hat.rotation.x=.038;
      hat.scale.setScalar(1.012);
      headGroup.add(hat);
      let editableHelmet=null;
      if(role==="officer"){
        S.loft(hat,mat.helmet,"officer-cap",[
          [-.5,.217,.190],[-.25,.229,.195],[.23,.204,.178],[.5,.160,.155]
        ],[0,.340,.018]).scale.y=.16;
        S.soft(hat,mat.helmet,[0,.416,.017],[.202,.054,.172]);
        S.box(hat,mat.soles,[.44,.025,.19],[0,.282,-.140]);
      }else if(sdf){
        editableHelmet=sdf.helmet(hat,mat.helmet,faction);
      }else{
        const domeGeometry=S.cached("smooth-steel-helmet",()=>
          new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,Math.PI/2));
        const shell=S.mesh(hat,domeGeometry,mat.helmet,[0,.263,.009]);
        editableHelmet=shell;
        shell.scale.set(faction==="germany"?.259:.252,.251,
          faction==="germany"?.275:.260);
        const brim=S.loft(hat,mat.helmet,
          faction==="germany"?"stahlhelm-skirt":"wz31-brim",[
          [-.5,faction==="germany"?.290:.276,.268],
          [-.3,faction==="germany"?.294:.280,.270],
          [.4,.252,.242],[.5,.241,.235]
          ],[0,.267,.004]);
        brim.scale.y=.07;
        // No loose helmet side blocks or chinstrap geometry.
      }
      // Historical load-bearing kit. Straps follow chest curvature; bags are
      // mounted on the body or waist instead of world-space positions.
      // A visible, curved chest/neck transition (not a giant donut collar).
      const equipmentRoot=new THREE.Group();breathing.add(equipmentRoot);
      const packGroup=new THREE.Group();
      packGroup.position.set(0,-.010,.230);equipmentRoot.add(packGroup);
      const gearFactory=window.Crossroads3DFactionGear?.create(THREE,S);
      const gear=gearFactory?.outfit({
        faction,role,mat,equipmentRoot,packGroup,legs
      })||{gait:[]};
      // The carrying kit is cosmetic; the same field equipment appears in
      // the independent lab and on live soldiers.
      const armaments=W.build({figure,body,breathing,role,faction,
        settings:recipe.weaponSettings,
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
        torso,uniformGroup,uniformParts,equipmentRoot,packGroup,gear,inspectRing,
        windowArc:firingArc,role,modelVersion:3,phase:0,recoil:0,crouch:0,
        baseY:.90,grounded:false,lastFootingFrame:-100,slotX:x,slotZ:z,
        gait:motion.gaitFor(squad.index,index),muzzleLocal,rigMarkers:[]};
      // Each editable part is tagged with a stable logical ID. Runtime loads
      // only explicitly approved device assets; drafts live solely in the lab.
      const shapeLibrary=window.Crossroads3DShapeLibrary,
        shapeGeometry=window.Crossroads3DShapeGeometry;
      const editableParts=new Map();
      soldier.approvedShapesUsed=[];
      const bindPart=(id,meshes)=>{
        const list=meshes.filter(Boolean);
        editableParts.set(id,list);
        for(const mesh of list)mesh.userData.workbenchPart=id;
        const doc=recipe.shapeSource==="canon"?null:
          shapeLibrary?.approved(id);
        if(doc) soldier.approvedShapesUsed.push(id);
        if(!doc||!shapeGeometry)return;
        const geometry=shapeGeometry.make(THREE,doc,{published:true});
        for(const mesh of list){
          mesh.geometry=geometry;
          mesh.userData.sharedMiniatureGeometry=true;
        }
        if(id==="torso"&&doc.blend.enabled)pelvis.visible=false;
      };
      bindPart("torso",[torso]);
      bindPart("head",[editableHead]);
      bindPart("helmet",[editableHelmet]);
      bindPart("upper-arm",arms.map(a=>a.upper));
      bindPart("forearm",arms.map(a=>a.lower));
      bindPart("thigh",legs.map(a=>a.mesh));
      bindPart("shin",legs.map(a=>a.shin));
      bindPart("boot",legs.map(a=>a.bootModel.upper));
      soldier.mannequinActive=false;
      soldier.setMannequin=on=>{
        soldier.mannequinActive=!!on;
        soldier.setInspectionMode(soldier.inspectionMode);
      };
      soldier.editableParts=editableParts;
      soldier.workbenchPelvis=pelvis;
      squad.soldiers.push(soldier);
      let gesture=0;
      soldier.applyGesture=value=>{gesture=clamp(Number(value)||0,0,1)};
      soldier.setGunDeployed=value=>{
        armaments.setDeployed(value);soldier.gunDeployed=armaments.isDeployed();
      };
      soldier.setGunDeployed(squad.unit.mmgDeployed??true);
      soldier.updateMuzzle=()=>muzzleLocal.copy(armaments.muzzle());
      soldier.setAttachmentDebug=enabled=>{
        soldier.attachmentsDebug=!!enabled;
        gear.setDebug?.(!!enabled);
      };
      soldier.applyProfile=(raw={})=>{
        const p=window.Crossroads3DMiniatureProfiles?.normalize(raw)||raw;
        headGroup.scale.setScalar(1.08*(p.headSize||1));
        // Author-calibrated multiplier, never overwrite a geometric radius.
        torso.scale.x=1.08*(p.bodyWidth||1);
        torso.scale.y=.91;
        gear.setBodyWidth?.(p.bodyWidth||1);
        // When attachments are being inspected, reflow debug pins as well.
        if(soldier.attachmentsDebug)gear.setDebug?.(true);
        packGroup.scale.setScalar(1.13*(p.packSize||1)*(role==="officer"?.70:1));
        for(const leg of legs)leg.boot.scale.setScalar(.92*(p.bootSize||1));
        soldier.profile=p;
      };
      soldier.inspectionMode="equipped";
      soldier.equipmentPreset="marching";
      soldier.setEquipmentPreset=preset=>{
        soldier.equipmentPreset=["reference","combat","marching"].includes(preset)?
          preset:"marching";
        soldier.setInspectionMode(soldier.inspectionMode);
      };
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
        uniformGroup.visible=true;
        torso.material=naked?mat.skin:mat.uniform;
        pelvis.material=naked?mat.skin:mat.trousers;
        const kitVisible=equipped&&!soldier.mannequinActive&&
          soldier.equipmentPreset!=="reference";
        equipmentRoot.visible=kitVisible;
        packGroup.visible=kitVisible&&
          soldier.equipmentPreset==="marching"&&soldier.profile?.pack!=="off";
        gear.setPackPresent?.(packGroup.visible);
        for(const mesh of gear.gait||[])
          mesh.visible=!naked&&!soldier.mannequinActive;
        armaments.weapon.visible=kitVisible&&!armaments.isDeployed();
        armaments.mount.visible=kitVisible&&armaments.isDeployed();
        hat.visible=!naked&&soldier.profile?.helmet!=="off";
        for(const arm of arms){
          arm.upper.material=naked?mat.skin:mat.uniform;
          arm.lower.material=naked?mat.skin:mat.uniform;
          if(arm.seam)arm.seam.material=naked?mat.skin:mat.uniform;
        }
        for(const leg of legs){
          leg.mesh.material=naked?mat.skin:mat.trousers;
          leg.shin.material=naked?[mat.skin,mat.skin]:[mat.trousers,mat.boots];
          if(leg.seam)leg.seam.material=naked?mat.skin:mat.trousers;
          // Keep natural feet visible in the bare-body comparison.
          leg.boot.visible=true;
          leg.bootModel.upper.material=naked?mat.skin:mat.boots;
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
        packGroup.visible=look.pack!=="off"&&soldier.equipmentPreset==="marching"&&
          (soldier.inspectionMode==="equipped"||soldier.inspectionMode==="silhouette");
        gear.setPackPresent?.(packGroup.visible);
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
        breathing.position.set((down?.017:0),.90-
          (action==="idle"?.024:0)-compact-
          crouch*.075+(pose.bob||0),
          reference?0:-(pose.forward||0)+(crouch*.042));
        breathing.rotation.set(reference?0:-(pose.lean||0)*.62,0,
          reference?0:(pose.roll||0)*(1-eased));
        headGroup.rotation.x=reference?0:(pose.headDuck||0)+crouch*.065;
        headGroup.rotation.z=reference?0:((index%3)-1)*.033*(1-eased);
        headGroup.rotation.y=action==="turn"?.16:0;
        // A clean model reference must not contain the weapon or dangling
        // field kit. Restore each when leaving the reference action.
        const showKit=!reference&&!soldier.mannequinActive&&
          soldier.equipmentPreset!=="reference"&&
          (soldier.inspectionMode==="equipped"||
           soldier.inspectionMode==="silhouette");
        equipmentRoot.visible=showKit;
        packGroup.visible=showKit&&soldier.equipmentPreset==="marching"&&
          soldier.profile?.pack!=="off";
        gear.setPackPresent?.(packGroup.visible);
        armaments.weapon.visible=showKit&&!armaments.isDeployed();
        armaments.mount.visible=showKit&&armaments.isDeployed();
        const fallAngle=eased*1.23;
        body.rotation.set(-eased*.14,0,-fallAngle);
        body.position.set(.08*eased,-.015*eased,0);
        // Seat the stock in a *fixed shoulder/underarm pocket* rather
        // than placing the receiver at an arbitrary stomach coordinate.
        // The historical archetype's actual butt marker is the pivot
        // reference for every stance, so shorter SMGs and longer rifles
        // share coherent arm contact and ADS transitions.
        const aim=!!pose.aim||["aim","ambush","fire"].includes(action);
        const carry=moving?(faction==="germany"?"german-side":"polish-two"):
          aim?"sighted":"ready";
        if(!armaments.isDeployed()){
          const officer=role==="officer";
          const sideCarry=carry==="german-side"&&!officer;
          const sighted=carry==="sighted";
          const pitch=sighted?-.015:sideCarry?-.21:-.082;
          const yaw=sighted?.092:sideCarry?-.12:.27;
          const roll=sighted?-.012:sideCarry?-.25:-.07;
          weapon.rotation.set(pitch,yaw,roll);
          const butt=v(0,0,officer?armaments.anchors.receiverRear:
            armaments.anchors.butt).applyEuler(weapon.rotation);
          const stockPocket=sighted?
            v(.176,.302,-.020):
            sideCarry?v(.388,-.064,.016):
            v(.243,.127,-.012);
          if(carry==="polish-two")stockPocket.add(v(.028,.030,-.025));
          // Do not snap the weapon out of the shoulder during recoil.
          stockPocket.z+=(pose.recoil||0)*.085;
          weapon.position.copy(stockPocket.sub(butt));
          weapon.userData.carryMode=carry;
        }
        headGroup.rotation.x+=aim?.115:0;
        // Only show a folded gunner bipod when the gun is being braced;
        // don't leave two long sticks hanging from every walking LMG.
        armaments.setBipod?.(!!pose.aim||
          action==="ambush"||action==="fire");
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
          if(kneel){
            // True braced kneel: rear knee touches the base, front boot is
            // forward and supports the torso. We retain articulated shins.
            const rear=side<0;
            const hip=v(side*.146,.555,rear?.094:.025);
            const knee=v(side*.150,rear?.199:.410,rear?.145:-.176);
            const ankle=v(side*.145,rear?.242:.245,rear?.309:-.245);
            foot.position.set(side*.145,.15,rear?.309:-.245);
            foot.rotation.set(rear?-.14:.05,side*.045,0);
            S.segment(leg.mesh,hip,knee);
            S.segment(leg.shin,knee,ankle);
            if(leg.seam){
              leg.seam.position.copy(knee);
              leg.seam.quaternion.setFromUnitVectors(v(0,1,0),
                hip.clone().sub(ankle).normalize());
            }
            continue;
          }
          foot.position.set(side*(.145+crouch*.024),
            .15+lift*(1-crouch*.3),-.045+stride+stance);
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
            const idle=action==="idle";
            const hip=v(side*.146,idle?.696:.715,idle?.031:.010);
            const knee=v(side*.150,idle?.459:.466,idle?-.069:-.014);
            const ankle=v(side*.145,idle?.247:.265,-.045);
            S.segment(leg.mesh,hip,knee);
            S.segment(leg.shin,knee,ankle);
            if(leg.seam){
              leg.seam.position.copy(knee);
              leg.seam.quaternion.setFromUnitVectors(v(0,1,0),
                hip.clone().sub(ankle).normalize());
            }
          }else if(k){
            const hip=v(side*.146,k.hip.y,k.hip.z);
            const knee=v(side*.146,k.knee.y,k.knee.z);
            const ankle=v(side*.145,k.ankle.y,k.ankle.z);
            S.segment(leg.mesh,hip,knee);
            S.segment(leg.shin,knee,ankle);
            if(leg.seam){
              leg.seam.position.copy(knee);
              leg.seam.quaternion.setFromUnitVectors(v(0,1,0),
                hip.clone().sub(ankle).normalize());
            }
          }
        }
        const right=armaments.grip("primary"),left=armaments.grip("secondary");
        const unarmed=soldier.equipmentPreset==="reference";
        // The grip sockets are inherited from the historical weapon
        // archetype; the same points hold under proportion adjustments.
        // Down and role-specific gestures keep elbows away from the torso;
        // the weapon is held in actual contact with both hands.
        for(const arm of arms){
          const side=arm.side,shoulder=arm.shoulder;
          const wrist=reference?
            (tpose?v(side*.594,.210,-.015):
              v(side*.294,-.282,-.010)):
            (unarmed?v(side*.267,-.245,-.035):
              // German field carry deliberately leaves the off-hand free.
              // Polish locomotion keeps both hands on the weapon.
              (moving&&faction==="germany"&&side===-1&&
               role!=="officer"&&!armaments.isDeployed()?
                v(-.264,-.184+Math.sin((pose.leftReach||0)*8)*.052,
                  -.028):
                (side===1?right:left).clone()));
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
            const pole=v(side*.16,kneel?-.048:aim?.025:-.105,
              aim?-.035:.075);
            elbow.add(pole.multiplyScalar(clamp(distance/.44,.7,1.25)));
          }
          // More natural compact arm bend, no straight blocky L-pose.
          S.segment(arm.upper,shoulder,elbow);
          S.segment(arm.lower,elbow,wrist);
          if(arm.seam){
            arm.seam.position.copy(elbow);
            arm.seam.quaternion.setFromUnitVectors(v(0,1,0),
              shoulder.clone().sub(wrist).normalize());
          }
          arm.hand.position.copy(wrist);
          arm.hand.rotation.y=reference?0:side*(aim?.08:.20);
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