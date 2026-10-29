"use strict";
// Single source of truth for Crossroads' 3D tabletop miniatures.
// The battlefield and the standalone lab both call this exact factory.
(() => {
  function create({THREE,miniatureScale=1,mat,block,shape,wood,
    motion,miniatureLab=null,between=()=>0}){
  function makeSoldier(squad, x, z, facing, recipe, variant, index) {
    const figure = new THREE.Group();
    figure.position.set(x, 0, z);
    figure.rotation.y = facing;
    // Approximate 1-inch miniature bases on a true 72x48-inch tabletop.
    // Height is intentionally heroic so facial/weapon silhouettes read on phone.
    figure.scale.setScalar(miniatureScale);
    squad.root.add(figure);

    const german=recipe.kit.factionId==="germany";
    const officer=recipe.role==="officer";
    const base = shape(figure, new THREE.CylinderGeometry(.39, .42, .11, 18),
      mat(german?0x333e37:0x3d3f34), 0, .02, 0);
    base.castShadow = true;
    shape(figure, new THREE.CylinderGeometry(.345, .345, .019, 18),
      mat(german?0x6c7763:0x6b7851), 0, .086, 0);
    const uniform=mat(german?(variant%2?0x758076:0x606e65)
      :(variant%2?0x787152:0x89805b));
    const trousers=mat(german?0x515d56:0x696249);
    const leather=mat(german?0x453c34:0x674b35);
    const skin=mat(0xc5a17d);
    const helmet=mat(german?0x53625b:0x677154);
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = block(figure, .15, .255, .19, trousers, side * .125, .42, 0);
      const shin=block(figure,.145,.255,.18,trousers,side*.125,.27,-.02);
      const boot=block(figure, .175, .16, .26, leather, side * .125, .17, -.055);
      legs.push({ mesh:leg, shin, side, boot });
    }
    const breathing = new THREE.Group();
    breathing.position.set(0, .78, 0);
    figure.add(breathing);
    block(breathing, .47, .56, .30, uniform, 0, 0, 0);
    block(breathing, .48, .10, .32, leather, 0, -.20, 0);
    const pack=block(breathing, .34, .37, .19, mat(0x665e43), 0, -.025, .235);
    for (const side of [-1, 1]) {
      block(breathing, .11, .38, .07, leather, side * .17, .02, -.169).rotation.z = -side * .21;
    }
    // Arms support a weapon across the chest rather than float beside it.
    for (const side of [-1, 1]) {
      const arm = block(breathing, .15, .42, .19, uniform, side * .28, -.04, -.115);
      arm.rotation.x = -.76;
      arm.rotation.z = side * .19;
      shape(breathing, new THREE.SphereGeometry(.085, 8, 6), skin, side * .27, -.20, -.33);
    }
    block(breathing, .17, .15, .16, skin, 0, .37, 0);
    shape(breathing, new THREE.SphereGeometry(.17, 10, 8), skin, 0, .51, -.01);
    if(officer) {
      shape(breathing,new THREE.CylinderGeometry(.187,.195,.18,10),uniform,0,.66,-.01);
      block(breathing,.40,.045,.25,mat(0x343c34),0,.62,-.13); // peaked cloth cap
    } else {
      shape(breathing,new THREE.SphereGeometry(german?.23:.205,12,8,0,Math.PI*2,0,Math.PI/2),
        helmet,0,.63,-.012);
      shape(breathing,new THREE.CylinderGeometry(german?.245:.212,german?.28:.218,
        german?.09:.055,12),helmet,0,.603,-.012);
      if(german) for(const side of [-1,1])
        block(breathing,.06,.09,.26,helmet,side*.228,.57,-.02); // flared Stahlhelm
    }
    // Sling, stock, receiver and forward-pointing rifle.
    const metal=mat(0x353a33,.16);
    const length=officer?.14:recipe.role==="smg"?.24:recipe.role==="lmg"?.64:.54;
    const center=officer?-.46:recipe.role==="smg"?-.59:recipe.role==="lmg"?-.79:-.74;
    block(breathing,.13,.13,officer?.12:.29,officer?metal:wood,.08,-.15,-.19);
    block(breathing,.12,.14,officer?.15:.30,metal,.08,-.13,officer?-.32:-.43);
    shape(breathing,new THREE.CylinderGeometry(.031,.036,length,7),metal,
      .08,-.105,center).rotation.x=Math.PI/2;
    block(breathing,.055,.14,.07,metal,.08,-.09,center-length*.43);
    if(officer)block(breathing,.07,.18,.07,leather,.08,-.27,-.31);
    if(recipe.role==="smg")block(breathing,.09,.27,.10,metal,.08,-.31,-.43);
    if (recipe.role === "mmg") {
      // Heavy receiver, long mounted barrel and a stable three-legged tripod.
      block(breathing,.22,.26,.32,mat(0x343b36),.08,-.19,-.52);
      block(breathing,.24,.27,.14,leather,-.18,-.22,-.47);
      const muzzle=shape(breathing,new THREE.CylinderGeometry(.065,.055,.73,9),
        mat(0x333a36,.22),.08,-.15,-.94);
      muzzle.rotation.x=Math.PI/2;
      for(const a of [-.75,0,.75]){
        const foot=block(figure,.065,.45,.055,mat(0x343b36),
          Math.sin(a)*.26,.31,-.40+Math.cos(a)*.19);
        foot.rotation.z=Math.sin(a)*.7;foot.rotation.x=-.55;
      }
      block(breathing,.26,.24,.25,mat(0x665d45),-.28,-.19,-.53);
      for(let n=0;n<7;n++)
        block(breathing,.035,.075,.07,mat(0xb49c60),
          -.15-n*.045,-.10-Math.sin(n/7*Math.PI)*.07,-.54);
      block(figure,.24,.16,.26,mat(0x575744),-.34,.13,-.27);
    } else if(recipe.role==="crew") {
      if(index===1){
        block(figure,.29,.22,.34,mat(0x73664a),-.22,.24,-.34);
        block(figure,.30,.035,.045,mat(0xa28a60),-.22,.36,-.34);
      }else{
        block(breathing,.26,.25,.18,mat(0x615442),-.28,-.22,.18);
        block(breathing,.13,.17,.21,mat(0x343b36),-.24,-.15,-.51);
      }
      block(breathing,.23,.18,.20,leather,-.20,-.25,.16);
      block(breathing,.19,.16,.16,mat(0x64604a),-.23,-.20,.25);
    } else if (recipe.role === "lmg") {
      block(breathing, .18, .23, .21, mat(0x34392e), .08, -.26, -.54);
      block(breathing, .07, .08, .20, mat(0x34392e), .08, -.12, -.98);
    } else if (recipe.role === "loader") {
      block(breathing, .22, .17, .12, leather, -.20, -.19, .16);
    }
    // Differentiation starts with silhouettes and equipment, not labels:
    // NCOs carry dispatch cases and rank tabs; weapon specialists carry
    // role-appropriate ammunition and hardware.
    if(index===0&&!officer&&recipe.role!=="mmg"&&recipe.role!=="crew"){
      block(breathing,.22,.085,.035,mat(0xc8b476),.02,.16,-.17);
      block(breathing,.14,.18,.23,leather,-.31,-.23,.20);
    }
    if(recipe.role==="rifle"){
      block(breathing,.32,.16,.13,mat(0x796b50),.18,-.24,.22);
      for(const n of [-1,0,1])
        block(breathing,.055,.10,.055,mat(0xb9a16d),
          -.29+n*.085,-.29,.02);
    }else if(recipe.role==="smg"){
      for(const n of [-1,0,1])
        block(breathing,.095,.22,.065,mat(0x4e5245),
          -.27+n*.13,-.25,.12);
      block(breathing,.10,.07,.07,metal,.09,-.21,-.63);
    }else if(recipe.role==="lmg"){
      block(breathing,.27,.30,.14,mat(0x5b5747),-.24,-.23,.24);
      for(const side of [-1,1])
        block(breathing,.03,.27,.04,metal,.08+side*.10,-.29,-1.13)
          .rotation.z=side*.28;
    }else if(officer){
      block(breathing,.24,.30,.13,leather,.28,-.12,.23);
      block(breathing,.09,.22,.13,mat(0xb7ab82),-.24,-.05,-.18);
      block(breathing,.26,.06,.12,mat(0x3c473b),.15,.11,.24);
    }
    // A tiny painted cartridge pouch, not another interface marker.
    block(breathing, .17, .15, .14, leather, -.22, -.18, -.09);
    const muzzleZ=recipe.role==="mmg"?-1.305:center-length*.5;
    squad.soldiers.push({figure,breathing,legs,phase:between(0,Math.PI*2),
      muzzleLocal:new THREE.Vector3(.08,-.105,muzzleZ),
      baseY:.78,grounded:false,lastFootingFrame:-100,role:recipe.role,recoil:0,
      gait:motion.gaitFor(squad.index,index),slotX:x,slotZ:z,crouch:0});
    const soldier=squad.soldiers[squad.soldiers.length-1];
    const issueCoat=uniform.color.getHex();
    const issuePants=trousers.color.getHex();
    const issueHelmet=helmet.color.getHex();
    const issueLeather=leather.color.getHex();
    // Headwear geometry sits above the head at .60+; the face remains.
    const headwear=breathing.children.filter(part=>part.position.y>=.60);
    const inspectRing=new THREE.Mesh(new THREE.RingGeometry(.46,.51,24),
      new THREE.MeshBasicMaterial({color:0xf5d37f,transparent:true,opacity:.85,
        side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
    inspectRing.rotation.x=-Math.PI/2;inspectRing.position.y=.105;
    inspectRing.visible=false;figure.add(inspectRing);
    soldier.inspectRing=inspectRing;
    const firingArc=new THREE.Group();squad.root.add(firingArc);
    const wedge=shape(firingArc,new THREE.RingGeometry(.2,1.8,32,1,
      Math.PI/6,Math.PI*2/3),new THREE.MeshBasicMaterial({
        color:0xe3cf9e,transparent:true,opacity:.14,
        depthWrite:false,depthTest:false,side:THREE.DoubleSide}),0,0,0);
    wedge.rotation.x=-Math.PI/2;
    firingArc.visible=false;
    soldier.windowArc=firingArc;
    soldier.applyLook=(look={})=>{
      const scheme=look.uniform||"field";
      uniform.color.setHex(scheme==="olive"?0x50614c:
        scheme==="khaki"?0x9a8b62:issueCoat);
      trousers.color.setHex(scheme==="olive"?0x424f42:
        scheme==="khaki"?0x716345:issuePants);
      helmet.color.setHex(look.helmetTint==="dark"?0x3c4d42:
        look.helmetTint==="dust"?0x918367:
        scheme==="khaki"?0x777053:issueHelmet);
      leather.color.setHex(look.leatherTint==="dark"?0x302b29:
        look.leatherTint==="russet"?0x7e4c31:issueLeather);
      pack.visible=look.pack!=="off";
      for(const part of headwear)part.visible=look.helmet!=="off";
    };
    soldier.applyLook(miniatureLab?.readLook(squad.unit.id,index)||{});
    return figure;
  }

    return makeSoldier;
  }
  window.Crossroads3DMiniatureModel=Object.freeze({create});
})();
