"use strict";
// Crossroads' sculpted, mobile-first infantry. Used by the same factory in
// the battle and independent Miniature Lab; combat data stays authoritative.
(() => {
  const smooth=(THREE,hex)=>new THREE.MeshStandardMaterial({
    color:hex,roughness:.92,metalness:0,flatShading:false
  });
  function create({THREE,miniatureScale=1,mat,shape,motion}) {
    const Y=new THREE.Vector3(0,1,0);
    // Geometry reuse is crucial for multi-squad iPhone battles. Each factory
    // caches shared vertex buffers, while every actor owns its transform.
    const geometryCache=new Map();
    const cached=(key,build)=>{
      if(!geometryCache.has(key))geometryCache.set(key,build());
      return geometryCache.get(key);
    };
    const sphere=cached("unitSphere",()=>new THREE.SphereGeometry(1,16,12));
    const smoothCylinder=(a,b,h,segments=16)=>
      cached(["cyl",a,b,h,segments].join(":"),()=>
        new THREE.CylinderGeometry(a,b,h,segments));
    const ellipsoid=(parent,material,xyz,scale)=>{
      const mesh=new THREE.Mesh(sphere,material);
      mesh.position.set(...xyz);mesh.scale.set(...scale);
      mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.userData.sharedMiniatureGeometry=true;parent.add(mesh);
      return mesh;
    };
    const box=(parent,material,size,pos)=>{
      const geom=cached("box:"+size.join(":"),()=>
        new THREE.BoxGeometry(...size));
      const mesh=new THREE.Mesh(geom,material);
      mesh.userData.sharedMiniatureGeometry=true;
      mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);
      return mesh;
    };
    const cylinder=(parent,material,r1,r2,height,pos,radial=16)=>{
      const mesh=new THREE.Mesh(smoothCylinder(r1,r2,height,radial),material);
      mesh.userData.sharedMiniatureGeometry=true;
      mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);
      return mesh;
    };
    const segment=(mesh,a,b)=>{
      const d=new THREE.Vector3().subVectors(b,a);
      mesh.position.copy(a).add(b).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(Y,d.clone().normalize());
      // Cylinder cross-sections are already authored in the geometry.
      // Only scale the segment's longitudinal axis, so legacy movement
      // resets cannot accidentally produce unit-radius giant limbs.
      mesh.scale.set(1,d.length(),1);
    };
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    function makeSoldier(squad,x,z,facing,recipe,variant,index){
      const german=recipe.kit.factionId==="germany";
      const role=recipe.role;
      const officer=role==="officer";
      const uniform=smooth(THREE,german?0x68766e:0x827f5b);
      const trousers=smooth(THREE,german?0x59655d:0x666249);
      const helmetMat=smooth(THREE,german?0x54665f:0x667053);
      const face=smooth(THREE,0xc6a17e);
      const leather=smooth(THREE,german?0x483a32:0x604a36);
      const canvas=smooth(THREE,0x94805d);
      const dark=smooth(THREE,0x343936);
      const wood=smooth(THREE,0x775037);
      const buckles=smooth(THREE,0xb5a477);
      const mats=[uniform,trousers,helmetMat,face,leather,canvas,dark,wood,buckles];
      const figure=new THREE.Group();
      figure.position.set(x,0,z);figure.rotation.y=facing;
      figure.scale.setScalar(miniatureScale);squad.root.add(figure);
      const base=new THREE.Group();figure.add(base);
      cylinder(base,dark,.39,.42,.11,[0,.02,0],24);
      cylinder(base,german?trousers:helmetMat,.345,.345,.019,[0,.086,0],24);
      // No falling animation ever rotates the base or world-space figure.
      const body=new THREE.Group();figure.add(body);
      const breathing=new THREE.Group();breathing.position.y=.76;body.add(breathing);
      const pelvis=ellipsoid(breathing,trousers,[0,-.22,.005],[.27,.19,.21]);
      const torsoRadius=.285;
      const torso=ellipsoid(breathing,uniform,[0,.055,0],
        [torsoRadius,.315,.225]);
      const yoke=ellipsoid(breathing,uniform,[0,.275,-.02],[.225,.082,.175]);
      const belt=cylinder(breathing,leather,.245,.235,.07,[0,-.205,0],14);
      // jacket hem and collar are separate, intentionally readable shapes.
      const jacketHem=ellipsoid(breathing,uniform,[0,-.18,.025],
        [.268,.085,.208]);
      const collar=cylinder(breathing,uniform,.15,.18,.10,
        [0,.335,-.018],14);
      // A genuine un-dressed silhouette study, rather than a palette toggle.
      // Hidden in battle; selectable only in the independent model workshop.
      const anatomy=new THREE.Group();breathing.add(anatomy);anatomy.visible=false;
      ellipsoid(anatomy,face,[0,.07,0],[.26,.31,.195]);
      ellipsoid(anatomy,face,[0,-.20,0],[.22,.18,.19]);
      const uniformMeshes=[pelvis,torso,yoke,belt,jacketHem,collar];
      const headGroup=new THREE.Group();
      headGroup.position.set(0,.39,-.01);
      headGroup.rotation.z=(index%3-1)*.026;
      breathing.add(headGroup);
      ellipsoid(headGroup,face,[0,.12,-.02],[.22,.235,.19]);
      ellipsoid(headGroup,face,[0,.035,-.172],[.075,.07,.04]); // nose
      for(const side of [-1,1]){
        ellipsoid(headGroup,face,[side*.205,.085,0],[.035,.068,.055]);
        box(headGroup,dark,[.032,.057,.012],[side*.074,.148,-.207]);
      }
      // Separate smoothly shaded dome, contoured brim and chinstrap.
      const helmetParts=[];
      if(officer){
        helmetParts.push(cylinder(headGroup,uniform,.235,.22,.135,[0,.32,0],24));
        helmetParts.push(ellipsoid(headGroup,uniform,[0,.385,0],[.235,.085,.215]));
        helmetParts.push(box(headGroup,dark,[.47,.025,.24],[0,.265,-.14]));
      }else{
        const dome=cached("helmet-dome",()=>new THREE.SphereGeometry(1,32,16,
          0,Math.PI*2,0,Math.PI/2));
        const shell=new THREE.Mesh(dome,helmetMat);
        shell.userData.sharedMiniatureGeometry=true;
        shell.scale.set(german?.267:.245,.258,german?.285:.253);
        shell.position.set(0,.265,0);headGroup.add(shell);shell.castShadow=true;
        helmetParts.push(shell);
        const rim=cylinder(headGroup,helmetMat,german?.283:.26,
          german?.30:.269,.053,[0,.258,-.008],32);
        helmetParts.push(rim);
        if(german)for(const side of [-1,1])
          helmetParts.push(box(headGroup,helmetMat,[.07,.085,.21],
            [side*.265,.236,.035]));
      }
      for(const side of [-1,1]){
        // chin strap follows the head rather than the body.
        const strap=ellipsoid(headGroup,leather,[side*.19,.025,-.015],
          [.020,.13,.017]);strap.rotation.z=-side*.23;
      }
      // Articulated upper and lower arms, with anatomical shoulder/elbow/wrist
      // targets. Each frame solves two segments toward the weapon's grips.
      const arms=[];
      for(const side of [-1,1]){
        // Use real-world limb radii in the geometry, not unit-radius
        // cylinders that become enormous if a pose temporarily resets scale.
        const upper=cylinder(breathing,uniform,.086,.098,1,[0,0,0],12);
        const lower=cylinder(breathing,uniform,.076,.084,1,[0,0,0],12);
        const hand=ellipsoid(breathing,face,[0,0,0],[.105,.085,.095]);
        const shoulder=v(side*.253,.205,-.005);
        // Small sleeve cap makes the shoulder joint visible without a
        // continuous inflated oval stretching across the chest.
        ellipsoid(breathing,uniform,[side*.255,.205,-.012],
          [.102,.105,.103]);
        arms.push({side,upper,lower,hand,shoulder});
      }
      // The legs sit under the articulated body, not under the base.
      const legs=[];
      for(const side of [-1,1]){
        const thigh=cylinder(body,trousers,.114,.122,1,[0,0,0],12);
        const shin=cylinder(body,trousers,.098,.108,1,[0,0,0],12);
        const boot=ellipsoid(body,leather,[side*.15,.18,-.055],
          [.133,.125,.19]);
        // ankle cuff / gaiter
        ellipsoid(boot,trousers,[0,.48,.24],[.83,.45,.60]);
        legs.push({mesh:thigh,shin,boot,side});
      }
      // WW2 load-bearing equipment is carried by actual torso / waist nodes.
      const equipmentRoot=new THREE.Group();breathing.add(equipmentRoot);
      const packGroup=new THREE.Group();
      packGroup.position.set(0,.02,.255);equipmentRoot.add(packGroup);
      const pack=ellipsoid(packGroup,canvas,[0,0,.05],[.22,.26,.14]);
      box(packGroup,canvas,[.37,.12,.13],[0,.16,.13]); // pack flap
      const bedroll=cylinder(packGroup,canvas,.11,.11,.39,[0,.29,.04],16);
      bedroll.rotation.z=Math.PI/2;
      for(const side of [-1,1]){
        const strap=box(equipmentRoot,leather,[.055,.40,.035],
          [side*.18,.055,-.211]);strap.rotation.z=-side*.13;
        const packStrap=box(packGroup,leather,[.034,.5,.022],
          [side*.12,.02,.193]);packStrap.rotation.z=side*.09;
        const pouch=box(equipmentRoot,leather,[.15,.15,.11],
          [side*.18,-.215,-.18]);
        box(pouch,canvas,[.16,.035,.12],[0,.09,-.005]);
      }
      cylinder(packGroup,canvas,.10,.09,.18,[.25,-.11,.04],12)
        .rotation.x=Math.PI/2; // canteen
      const breadBag=ellipsoid(equipmentRoot,canvas,[-.285,-.16,.17],
        [.12,.16,.095]);
      const extraPack=ellipsoid(packGroup,canvas,[-.19,-.18,.08],
        [.11,.11,.12]);
      // Specialist silhouettes stay distinct while sharing one body rig.
      if(officer){
        box(equipmentRoot,leather,[.21,.23,.085],[.30,-.12,.08]);
      }else if(role==="lmg"||role==="loader"){
        for(let n=0;n<3;n++)
          box(equipmentRoot,canvas,[.11,.19,.075],
            [-.25,-.17+n*.12,.12]);
      }else if(role==="crew"||role==="mmg"){
        box(equipmentRoot,dark,[.27,.18,.24],[-.29,-.20,.19]);
        box(equipmentRoot,leather,[.29,.045,.25],[-.29,-.08,.19]);
      }
      // Weapon group is physically coherent. Muzzle and both grip targets
      // are descendants of the same transform.
      const weapon=new THREE.Group();
      weapon.position.set(.02,-.08,-.305);
      weapon.rotation.y=.38;weapon.rotation.z=-.13;
      breathing.add(weapon);
      const gunParts=[];
      const gunLength=role==="lmg"||role==="mmg"?.67:
        role==="smg"?.38:officer?.25:.53;
      if(role==="mmg"){
        gunParts.push(box(weapon,dark,[.20,.18,.30],[0,0,-.15]));
        const muzzle=cylinder(weapon,dark,.037,.045,.65,[0,.035,-.52],12);
        muzzle.rotation.x=Math.PI/2;gunParts.push(muzzle);
        const tripod=new THREE.Group();
        body.add(tripod);gunParts.push(tripod);
        cylinder(tripod,dark,.033,.033,.30,[0,.21,-.51],10);
        for(const side of [-1,0,1]){
          const foot=cylinder(tripod,dark,.022,.024,.49,
            [side*.14,.22,-.54],10);
          foot.rotation.z=side*.6;foot.rotation.x=-.3;
        }
      }else{
        // Stock narrows into the receiver, barrel runs forward (-Z).
        ellipsoid(weapon,wood,[0,-.04,.13],
          [officer?.055:.07,.08,officer?.15:.235]);
        box(weapon,dark,[.115,.115,.19],[0,.015,-.10]);
        const forestock=box(weapon,wood,[.095,.08,gunLength*.68],
          [0,-.012,-.20-gunLength*.17]);
        const barrel=cylinder(weapon,dark,.021,.026,gunLength,
          [0,.029,-.27-gunLength*.46],12);
        barrel.rotation.x=Math.PI/2;
        box(weapon,dark,[.06,.08,.055],[0,.085,-.20-gunLength*.93]);
        if(role==="lmg"){
          box(weapon,dark,[.15,.25,.11],[0,.14,-.19]);
          for(const side of [-1,1]){
            const bipod=cylinder(weapon,dark,.015,.015,.32,
              [side*.09,-.16,-.66],8);
            bipod.rotation.z=side*.35;
          }
        }else if(role==="smg"){
          box(weapon,dark,[.065,.23,.075],[0,-.165,-.13]);
        }
      }
      const muzzleZ=role==="mmg"?-.86:
        -.27-gunLength*.94;
      const muzzleLocal=v(0,0,0);
      const gripRight=v(.035,-.07,.055);
      const gripLeft=v(-.025,-.035,-.30);
      const unusedRig=[]; // reserved for future accessory sockets
      // Compatibility with the battle's MMG presentation and UI.
      const packedBundle=role==="mmg"?
        ellipsoid(breathing,canvas,[0,-.19,.38],[.26,.19,.13]):null;
      const inspectRing=new THREE.Mesh(new THREE.RingGeometry(.46,.51,24),
        new THREE.MeshBasicMaterial({color:0xf5d37f,transparent:true,
          opacity:.85,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
      inspectRing.rotation.x=-Math.PI/2;inspectRing.position.y=.105;
      inspectRing.visible=false;figure.add(inspectRing);
      const firingArc=new THREE.Group();squad.root.add(firingArc);
      const wedge=shape(firingArc,new THREE.RingGeometry(.2,1.8,32,1,
        Math.PI/6,Math.PI*2/3),new THREE.MeshBasicMaterial({
        color:0xe3cf9e,transparent:true,opacity:.14,depthWrite:false,
        depthTest:false,side:THREE.DoubleSide}),0,0,0);
      wedge.rotation.x=-Math.PI/2;firingArc.visible=false;
      // The body owns all joints and gear; the base is never a casualty child.
      const soldier={figure,body,breathing,legs,arms,headGroup,base,weapon,
        inspectRing,windowArc:firingArc,equipmentRoot,role,
        phase:0,recoil:0,crouch:0,baseY:.76,grounded:false,
        lastFootingFrame:-100,gait:motion.gaitFor(squad.index,index),
        slotX:x,slotZ:z,muzzleLocal,modelVersion:2,rigMarkers:unusedRig};
      squad.soldiers.push(soldier);
      let gesture=0;
      soldier.applyGesture=(strength=0)=>{gesture=strength};
      soldier.setGunDeployed=(deployed)=>{
        if(role!=="mmg")return;
        for(const p of gunParts)p.visible=!!deployed;
        if(packedBundle)packedBundle.visible=!deployed;
        soldier.gunDeployed=!!deployed;
      };
      soldier.setGunDeployed(squad.unit.mmgDeployed??true);
      // Expose the authored chest primitive for diagnostics and testing.
      soldier.torso=torso;
      soldier.applyProfile=(raw={})=>{
        const p=window.Crossroads3DMiniatureProfiles?.normalize(raw)||raw;
        headGroup.scale.setScalar(p.headSize||1);
        // The slider is a dimensionless multiplier. Replacing this radius
        // with 1.00 enlarged the chest ~3.5x and made the giant oval.
        // Always derive from the authored radius (non-cumulative).
        torso.scale.x=torsoRadius*(p.bodyWidth||1);
        packGroup.scale.setScalar(p.packSize||1);
        for(const leg of legs)
          leg.boot.scale.set((p.bootSize||1)*.133,.125,(p.bootSize||1)*.19);
        soldier.profile=p;
      };
      soldier.inspectionMode="equipped";
      soldier.setInspectionMode=(mode="equipped")=>{
        soldier.inspectionMode=mode;
        const bodyOnly=mode==="body",equipped=mode==="equipped";
        anatomy.visible=bodyOnly;
        for(const part of uniformMeshes)part.visible=!bodyOnly;
        for(const arm of arms){
          arm.upper.material=bodyOnly?face:uniform;
          arm.lower.material=bodyOnly?face:uniform;
        }
        for(const leg of legs){
          leg.mesh.material=bodyOnly?face:trousers;
          leg.shin.material=bodyOnly?face:trousers;
          leg.boot.visible=!bodyOnly;
        }
        weapon.visible=equipped;
        equipmentRoot.visible=equipped;
        for(const mesh of helmetParts)
          mesh.visible=!bodyOnly&&soldier.profile?.helmet!=="off";
      };
            soldier.applyLook=(look={})=>{
        const scheme=look.uniform||"field";
        uniform.color.setHex(scheme==="olive"?0x50614c:
          scheme==="khaki"?0x9a8b62:
          german?0x68766e:0x827f5b);
        trousers.color.setHex(scheme==="olive"?0x424f42:
          scheme==="khaki"?0x716345:german?0x59655d:0x666249);
        helmetMat.color.setHex(look.helmetTint==="dark"?0x3c4d42:
          look.helmetTint==="dust"?0x918367:
          german?0x54665f:0x667053);
        leather.color.setHex(look.leatherTint==="dark"?0x302b29:
          look.leatherTint==="russet"?0x7e4c31:
          german?0x483a32:0x604a36);
        packGroup.visible=look.pack!=="off";
        equipmentRoot.visible=true;
        for(const mesh of helmetParts)mesh.visible=look.helmet!=="off";
        soldier.applyProfile(look);
        soldier.setInspectionMode(soldier.inspectionMode);
      };
      const toTorso=(point)=>{
        weapon.updateWorldMatrix(true,false);
        breathing.updateWorldMatrix(true,false);
        return breathing.worldToLocal(weapon.localToWorld(point.clone()));
      };
      soldier.updateMuzzle=()=>{
        muzzleLocal.copy(toTorso(v(0,.029,muzzleZ)));
      };
      soldier.applyPose=(pose={},options={})=>{
        const crouch=Math.max(0,pose.crouch||0);
        const fall=Math.max(0,Math.min(1,pose.fall||0));
        const eased=fall*fall*(3-2*fall);
        // Cosmetic animation never touches the figure's world transform.
        body.rotation.set(-eased*.20,0,-eased*1.25);
        body.position.set(eased*.21,-eased*.03,0);
        breathing.position.y=.76-crouch*.30+(pose.bob||0);
        breathing.position.z=-(pose.forward||0);
        breathing.rotation.x=-(pose.lean||0)*(1-eased*.65);
        breathing.rotation.z=(pose.roll||0)*(1-eased);
        headGroup.rotation.x=(pose.headDuck||crouch*.12);
        weapon.rotation.x=(pose.aim?-.12:0)+
          (pose.reload?Math.sin(pose.reload*Math.PI)*.30:0);
        weapon.rotation.y=.38+(pose.aim?-.23:0);
        weapon.rotation.z=-.13-eased*.35;
        weapon.position.z=-.305-(pose.recoil||0)*.055;
        for(const leg of legs){
          const side=leg.side;
          const lift=side<0?(pose.leftLift||0):(pose.rightLift||0);
          const reach=side<0?(pose.leftReach||0):(pose.rightReach||0);
          const foot=leg.boot;
          foot.position.set(side*.15,.18+lift,-.055+reach);
          const solver=window.Crossroads3DSoldierIK;
          const k=solver?.solve({hipY:.60-crouch*.18,hipZ:0,
            footY:foot.position.y+.07,footZ:foot.position.z,
            upper:.26,lower:.26});
          if(k){
            const hip=v(side*.15,k.hip.y,k.hip.z);
            const knee=v(side*.15,k.knee.y,k.knee.z);
            const ankle=v(side*.15,k.ankle.y,k.ankle.z);
            segment(leg.mesh,hip,knee);
            segment(leg.shin,knee,ankle);
          }
        }
        // Re-evaluate grips in local space after every weapon motion.
        const right=toTorso(gripRight),left=toTorso(gripLeft);
        for(const arm of arms){
          const side=arm.side;
          const wrist=side===1?right:left;
          if(gesture>0&&side===1){
            wrist.set(.48,.28+gesture*.26,-.20);
          }
          const shoulder=arm.shoulder;
          const elbow=shoulder.clone().lerp(wrist,.51);
          elbow.x+=side*.14;elbow.y-=.12;elbow.z+=.07;
          segment(arm.upper,shoulder,elbow);
          segment(arm.lower,elbow,wrist);
          arm.hand.position.copy(wrist);
        }
        soldier.updateMuzzle();
      };
      const look=window.Crossroads3DMiniatureProfiles?.read(
        recipe.kit.id,squad.unit.type,index)||{};
      soldier.applyLook(look);
      soldier.applyPose({});
      return figure;
    }
    return makeSoldier;
  }
  window.Crossroads3DMiniatureV2=Object.freeze({create});
})();