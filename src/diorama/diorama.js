"use strict";

// Deliberately independent of the existing 2D game/rules bootstraps.
(async function startDiorama() {
  const loading = document.getElementById("loadingState");
  try {
    let THREE;
    try {
      THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
    } catch (primaryError) {
      THREE = await import("https://unpkg.com/three@0.180.0/build/three.module.js");
    }
    initialize(THREE);
    loading.hidden = true;
  } catch (error) {
    console.error("Crossroads 3D scene failed to start:", error);
    loading.textContent = "The 3D scene could not start. WebGL and an internet connection are required.";
  }
})();

function initialize(THREE) {
  const canvas = document.getElementById("dioramaCanvas");
  const stage = document.getElementById("stage");
  const readout = document.getElementById("zoomReadout");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6f7d73);
  scene.fog = new THREE.Fog(0x6f7d73, 44, 82);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.27;

  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 150);
  const target = new THREE.Vector3(0, 0.75, 0);
  const initialYaw = Math.PI / 4;
  let yaw = initialYaw;
  let zoom = 1;
  let baseHeight = 20;
  let viewportWidth = 1;
  let viewportHeight = 1;
  const elevation = THREE.MathUtils.degToRad(51);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

  const hemi = new THREE.HemisphereLight(0xf5f0dc, 0x5e6554, 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe5b8, 3);
  sun.position.set(-9, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  const materials = new Map();
  function mat(color, metalness) {
    const key = String(color) + "-" + String(metalness || 0);
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color: color, roughness: 0.91, metalness: metalness || 0, flatShading: true
      }));
    }
    return materials.get(key);
  }
  const wood = mat(0x664836);
  const darkWood = mat(0x382e26);
  const roofMat = mat(0x8f4b38);
  const stonePalette = [0x8d8a7b, 0xa29b83, 0xb0a992, 0x7f8275];
  const leafPalette = [0x566d46, 0x6a7b4a, 0x7b8450, 0x536748];
  const terrainY = (x, z) => 0.19 + Math.sin(x * 0.64) * Math.cos(z * 0.53) * 0.075 + Math.sin(x * 1.34 + z * 0.42) * 0.025;
  let seed = 39045;
  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function between(a, b) { return a + random() * (b - a); }
  function block(parent, width, height, depth, material, x, y, z) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function shape(parent, geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  // A physical slice of battlefield, complete with layered wooden edges.
  block(scene, 21.7, 0.17, 15.7, mat(0x2b2a25), 0, -0.73, 0);
  block(scene, 21.45, 0.69, 15.45, darkWood, 0, -0.37, 0);
  block(scene, 21.2, 0.13, 15.2, wood, 0, 0.015, 0);
  block(scene, 20.65, 0.1, 14.65, mat(0x777f50), 0, 0.085, 0);
  for (const z of [-7.67, 7.67]) {
    block(scene, 21.45, 0.14, 0.085, mat(0x926847), 0, -0.28, z);
    block(scene, 21.45, 0.04, 0.035, mat(0xb38c5c), 0, -0.06, z);
  }
  for (const x of [-10.7, 10.7]) {
    block(scene, 0.09, 0.14, 15.45, mat(0x926847), x, -0.28, 0);
  }
  for (const x of [-9.8, 9.8]) {
    for (const z of [-6.85, 6.85]) {
      shape(scene, new THREE.CylinderGeometry(0.09, 0.09, 0.045, 8), mat(0xb19b76, 0.22), x, 0.09, z);
    }
  }

  const groundGeometry = new THREE.PlaneGeometry(20.52, 14.52, 52, 38);
  groundGeometry.rotateX(-Math.PI / 2);
  const position = groundGeometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, terrainY(position.getX(i), position.getZ(i)));
  }
  groundGeometry.computeVertexNormals();
  const ground = shape(scene, groundGeometry, mat(0x758355), 0, 0, 0);
  ground.castShadow = false;

  // Tonal field patches: no repeating photo texture, no noisy realism.
  const patchColors = [0x6b7c50, 0x87915d, 0x708052, 0x8e9565];
  for (let i = 0; i < 27; i++) {
    const x = between(-9.4, 9.4);
    const z = between(-6.5, 6.5);
    const patch = shape(scene, new THREE.CircleGeometry(1, 11), mat(patchColors[i % patchColors.length]), x, terrainY(x, z) + 0.028, z);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(between(0.65, 2.4), between(0.48, 1.7), 1);
    patch.castShadow = false;
  }

  function roadCenter(x) { return 0.52 - x * 0.155 + Math.sin(x * 0.43) * 0.36; }
  function makeRoadBand(width, color, offset, rise) {
    const vertices = [];
    const indices = [];
    for (let i = 0; i <= 88; i++) {
      const x = -10.26 + i * 20.52 / 88;
      const center = roadCenter(x) + (offset || 0);
      const jitter = Math.sin(x * 2.13) * 0.06;
      for (const sign of [-1, 1]) {
        const z = center + sign * (width * 0.5 + jitter);
        vertices.push(x, terrainY(x, z) + rise, z);
      }
      if (i < 88) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 1, side: THREE.DoubleSide });
    const path = shape(scene, geometry, material, 0, 0, 0);
    path.castShadow = false;
  }
  makeRoadBand(3.14, 0x918764, 0, 0.047);
  makeRoadBand(2.64, 0xb0a17c, 0, 0.058);
  makeRoadBand(0.20, 0x948363, -0.67, 0.061);
  makeRoadBand(0.20, 0x948363, 0.67, 0.061);

  // Angular low-poly stones and seasonal miniature vegetation.
  const grassBlade = new THREE.ConeGeometry(0.055, 0.20, 3);
  const grassMaterials = [mat(0x8b9c62), mat(0x536f46), mat(0xabb171)];
  for (let p = 0; p < grassMaterials.length; p++) {
    const field = new THREE.InstancedMesh(grassBlade, grassMaterials[p], 220);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 220; i++) {
      let x = 0, z = 0, tries = 0;
      do {
        x = between(-9.75, 9.75);
        z = between(-6.9, 6.9);
        tries++;
      } while (tries < 20 && (Math.abs(z - roadCenter(x)) < 1.65 || (x > -6.6 && x < -1.5 && z > -5.0 && z < -1.15)));
      dummy.position.set(x, terrainY(x, z) + 0.095, z);
      dummy.rotation.set(0, between(0, Math.PI * 2), between(-0.22, 0.22));
      const scale = between(0.55, 1.55);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      field.setMatrixAt(i, dummy.matrix);
    }
    field.instanceMatrix.needsUpdate = true;
    field.castShadow = false;
    scene.add(field);
  }

  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.10, 0), mat(0x9a9880), 94);
  const pebbleMatrix = new THREE.Object3D();
  for (let i = 0; i < 94; i++) {
    const x = between(-9.7, 9.7);
    const z = roadCenter(x) + (random() < 0.5 ? -1 : 1) * between(1.35, 2.0);
    pebbleMatrix.position.set(x, terrainY(x, z) + 0.056, z);
    pebbleMatrix.rotation.set(between(-1, 1), between(0, 6), between(-1, 1));
    pebbleMatrix.scale.set(between(.35, 1.25), between(.3, .65), between(.4, 1.3));
    pebbleMatrix.updateMatrix();
    pebbles.setMatrixAt(i, pebbleMatrix.matrix);
  }
  pebbles.castShadow = false;
  scene.add(pebbles);

  // Farmhouse with masonry, timber, inset windows, shutters and a true pitched roof.
  function makeFarmhouse() {
    const group = new THREE.Group();
    group.position.set(-4.18, terrainY(-4.18, -3.19), -3.19);
    scene.add(group);
    block(group, 4.35, 0.25, 3.38, mat(0x8b8a77), 0, .14, 0);
    block(group, 4.12, 1.96, 3.13, mat(0xe1cfab), 0, 1.12, 0);
    block(group, 4.18, .30, 3.20, mat(0xb5a78a), 0, .34, 0);
    for (const x of [-1.4, -.46, .47, 1.45]) {
      block(group, .095, 1.85, .055, mat(0xc7b693), x, 1.19, 1.59);
    }
    const pitch = Math.atan2(1.00, 1.80);
    const roofFront = block(group, 4.78, .18, 2.08, roofMat, 0, 2.52, .89);
    roofFront.rotation.x = pitch;
    const roofBack = block(group, 4.78, .18, 2.08, roofMat, 0, 2.52, -.89);
    roofBack.rotation.x = -pitch;
    block(group, 4.80, .17, .20, mat(0x55372d), 0, 3.02, 0);
    for (const x of [-2.16, 2.16]) {
      const verts = new Float32Array([
        x, 2.06, -1.57,
        x, 2.06, 1.57,
        x, 3.05, 0
      ]);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
      geom.computeVertexNormals();
      shape(group, geom, new THREE.MeshStandardMaterial({ color: 0xd6c49f, side: THREE.DoubleSide }), 0, 0, 0);
    }
    block(group, .55, 1.04, .56, mat(0x9a8b74), 1.17, 3.13, -.55);
    block(group, .68, .15, .67, mat(0x756453), 1.17, 3.67, -.55);
    function windowAt(x, z, y, side) {
      const front = side || 1;
      block(group, .68, .81, .055, wood, x, y, z + .08 * front);
      block(group, .52, .64, .069, mat(0x667879), x, y, z + .11 * front);
      block(group, .065, .68, .09, mat(0xdfd1ae), x, y, z + .15 * front);
      block(group, .61, .065, .095, mat(0xdfd1ae), x, y, z + .15 * front);
      block(group, .30, .82, .075, mat(0x697349), x - .51, y, z + .08 * front);
      block(group, .30, .82, .075, mat(0x697349), x + .51, y, z + .08 * front);
      block(group, .95, .1, .25, mat(0xc4b391), x, y - .45, z + .17 * front);
    }
    windowAt(-1.23, 1.57, 1.24, 1);
    windowAt(1.22, 1.57, 1.24, 1);
    windowAt(-1.23, -1.57, 1.24, -1);
    block(group, .77, 1.50, .12, darkWood, 0, 1.05, 1.65);
    block(group, .65, 1.36, .15, mat(0x785637), 0, 1.05, 1.73);
    block(group, .055, 1.36, .045, mat(0x9d7244), -.20, 1.05, 1.82);
    shape(group, new THREE.SphereGeometry(.045, 8, 6), mat(0xc6a76a, .30), .21, 1.02, 1.84);
    // Stepping stones, sacks and firewood in front of the door.
    block(group, 1.25, .11, .43, mat(0xaaa18b), 0, .13, 2.00);
    for (let i = 0; i < 3; i++) {
      const log = shape(group, new THREE.CylinderGeometry(.13, .13, .72, 7), wood, -1.83 + .21 * i, .23 + i * .04, 1.98);
      log.rotation.z = Math.PI / 2;
    }
  }
  makeFarmhouse();

  // A low stone wall with an unmistakable opening toward the farm gate.
  function wallSection(x1, x2, z) {
    const length = x2 - x1;
    const courses = 3;
    const unit = .34;
    const count = Math.ceil(length / unit);
    for (let c = 0; c < courses; c++) {
      for (let i = 0; i < count; i++) {
        const dx = x1 + ((i + 0.5) / count) * length + (c % 2 ? .07 : 0);
        const y = terrainY(dx, z) + .14 + c * .23;
        const stone = block(scene, length / count - .02, .22, .48, mat(stonePalette[(i + c * 2) % stonePalette.length]), dx, y, z);
        stone.rotation.y = Math.sin(i * 1.9 + c) * .018;
      }
    }
    for (let i = 0; i < count; i++) {
      const x = x1 + ((i + .5) / count) * length;
      block(scene, length / count - .01, .12, .58, mat(0xa6a18b), x, terrainY(x, z) + .86, z);
    }
  }
  wallSection(-9.55, -5.45, -.82);
  wallSection(-2.77, -.85, -.82);
  for (const x of [-5.44, -2.77]) {
    block(scene, .60, 1.10, .65, mat(0xa39c85), x, terrainY(x, -.82) + .58, -.82);
    block(scene, .76, .17, .80, mat(0xbbb29a), x, terrainY(x, -.82) + 1.16, -.82);
  }

  // An old fence marks the cultivated field; posts and rails are true geometry.
  function makeFence(x1, z1, x2, z2, posts) {
    const dx = x2 - x1, dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const group = new THREE.Group();
    group.position.set((x1 + x2) / 2, terrainY((x1 + x2) / 2, (z1 + z2) / 2), (z1 + z2) / 2);
    group.rotation.y = -Math.atan2(dz, dx);
    scene.add(group);
    for (let i = 0; i <= posts; i++) {
      const x = -length / 2 + i * length / posts;
      block(group, .14, .93, .15, mat(0x6f5840), x, .49, 0);
      const cap = shape(group, new THREE.ConeGeometry(.15, .16, 4), mat(0x715a40), x, 1.02, 0);
      cap.rotation.y = Math.PI / 4;
    }
    for (const y of [.36, .70]) {
      block(group, length, .105, .105, mat(0x937451), 0, y, 0);
    }
  }
  makeFence(4.38, 5.65, 9.55, 5.25, 8);
  makeFence(4.38, 5.65, 4.1, 3.18, 4);

  // Deeply faceted canopies keep trees recognizable as painted model trees.
  function makeTree(x, z, size, paletteIndex) {
    const group = new THREE.Group();
    group.position.set(x, terrainY(x, z), z);
    scene.add(group);
    const bark = mat(0x65503b);
    shape(group, new THREE.CylinderGeometry(.18 * size, .28 * size, 1.5 * size, 7), bark, 0, .75 * size, 0);
    const positions = [
      [0, 2.06, 0, .94],
      [-.62, 1.72, -.20, .72],
      [.61, 1.73, .11, .72],
      [-.10, 1.76, .60, .68],
      [0, 2.49, -.18, .59]
    ];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const color = leafPalette[(paletteIndex + i) % leafPalette.length];
      const leaves = shape(group, new THREE.DodecahedronGeometry(p[3] * size, 0), mat(color), p[0] * size, p[1] * size, p[2] * size);
      leaves.rotation.y = i * .53;
      leaves.rotation.z = i * .1;
    }
    // Tiny exposed roots make it read as model terrain rather than floating foliage.
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const root = block(group, .12 * size, .16 * size, .65 * size, bark, Math.sin(a) * .14 * size, .09 * size, Math.cos(a) * .23 * size);
      root.rotation.y = a;
    }
  }
  makeTree(-8.45, -4.88, 1.1, 0);
  makeTree(-9.14, 5.30, .85, 2);
  makeTree(8.57, -4.65, 1.12, 3);
  makeTree(6.68, -5.45, .78, 1);
  makeTree(-1.02, -5.51, .74, 0);

  function makeHedge(x, z, count, step, index) {
    for (let i = 0; i < count; i++) {
      const tx = x + i * step;
      const g = shape(scene, new THREE.DodecahedronGeometry(.47 + (i % 3) * .08, 0), mat(leafPalette[(i + index) % leafPalette.length]), tx, terrainY(tx, z) + .47, z + Math.sin(i * 3.4) * .11);
      g.scale.set(1.08, .83, .83);
    }
  }
  makeHedge(.08, -5.46, 9, .57, 2);

  // Small wheat stalks in ordered rows: a deliberately cultivated patch.
  const wheat = new THREE.InstancedMesh(new THREE.ConeGeometry(.052, .39, 4), mat(0xc4ad67), 252);
  const stalk = new THREE.Object3D();
  let wIndex = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 28; col++) {
      const x = 5.0 + col * .146 + between(-.035, .035);
      const z = 2.55 + row * .42 + between(-.06, .06);
      stalk.position.set(x, terrainY(x, z) + .20, z);
      stalk.rotation.set(between(-.15, .15), between(0, 6), between(-.12, .12));
      stalk.scale.setScalar(between(.7, 1.25));
      stalk.updateMatrix();
      wheat.setMatrixAt(wIndex++, stalk.matrix);
    }
  }
  wheat.castShadow = false;
  scene.add(wheat);

  // Miniatures are intentionally sculpted from chunky painted parts.
  const soldiers = [];
  function makeSoldier(x, z, facing, variant) {
    const figure = new THREE.Group();
    figure.position.set(x, terrainY(x, z) + .12, z);
    figure.rotation.y = facing;
    scene.add(figure);

    const base = shape(figure, new THREE.CylinderGeometry(.39, .42, .11, 18), mat(0x3d3f34), 0, .02, 0);
    base.castShadow = true;
    shape(figure, new THREE.CylinderGeometry(.345, .345, .019, 18), mat(0x6b7851), 0, .086, 0);
    const uniform = mat(variant % 2 ? 0x696f4b : 0x777a57);
    const trousers = mat(0x575d46);
    const leather = mat(0x503f31);
    const skin = mat(0xc5a17d);
    const helmet = mat(variant % 2 ? 0x4f634b : 0x5c6a4f);
    for (const side of [-1, 1]) {
      const leg = block(figure, .15, .39, .19, trousers, side * .125, .34, 0);
      leg.rotation.x = side * .08;
      block(figure, .175, .16, .26, leather, side * .125, .17, -.055);
    }
    const breathing = new THREE.Group();
    breathing.position.set(0, .78, 0);
    figure.add(breathing);
    block(breathing, .47, .56, .30, uniform, 0, 0, 0);
    block(breathing, .48, .10, .32, leather, 0, -.20, 0);
    block(breathing, .34, .37, .19, mat(0x665e43), 0, -.025, .235);
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
    const dome = shape(breathing, new THREE.SphereGeometry(.215, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, .63, -.012);
    dome.rotation.y = variant * .25;
    shape(breathing, new THREE.CylinderGeometry(.235, .222, .065, 12), helmet, 0, .61, -.012);
    // Sling, stock, receiver and forward-pointing rifle.
    block(breathing, .13, .13, .29, wood, .08, -.15, -.19);
    block(breathing, .12, .14, .30, mat(0x353a33, .12), .08, -.13, -.43);
    const barrel = shape(breathing, new THREE.CylinderGeometry(.031, .036, .54, 7), mat(0x353a33, .21), .08, -.105, -.74);
    barrel.rotation.x = Math.PI / 2;
    block(breathing, .055, .14, .07, mat(0x353a33), .08, -.09, -.91);
    // A tiny painted cartridge pouch, not another interface marker.
    block(breathing, .17, .15, .14, leather, -.22, -.18, -.09);
    soldiers.push({ breathing: breathing, phase: between(0, Math.PI * 2), baseY: .78 });
    return figure;
  }
  makeSoldier(.73, 3.53, -2.67, 0);
  makeSoldier(1.85, 3.94, -2.90, 1);
  makeSoldier(2.84, 3.43, -2.57, 2);
  makeSoldier(1.00, 5.02, -2.42, 3);
  makeSoldier(3.17, 4.69, -2.85, 4);

  // The ground has subtle negative space; a few wartime props provide scale.
  function crate(x, z, size) {
    const y = terrainY(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    block(g, size, size * .72, size, mat(0x88714c), 0, size * .36, 0);
    for (const side of [-1, 1]) {
      block(g, .06, size * .72, .06, darkWood, side * size * .38, size * .36, size * .50);
      block(g, size, .06, .06, darkWood, 0, size * .36, side * size * .50);
    }
  }
  crate(-6.94, -2.12, .58);
  crate(-6.35, -2.28, .44);

  // Camera: horizontal orbit only, locked isometric elevation, orthographic zoom.
  function updateCamera() {
    const radius = 31;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elevation) * radius,
      target.y + Math.sin(elevation) * radius,
      target.z + Math.cos(yaw) * Math.cos(elevation) * radius
    );
    camera.lookAt(target);
    const h = baseHeight / zoom;
    const aspect = viewportWidth / viewportHeight;
    camera.left = -h * aspect / 2;
    camera.right = h * aspect / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    readout.textContent = String(Math.round(zoom * 100)) + "%";
  }
  function setZoom(value) {
    zoom = clamp(value, .75, 3.35);
    updateCamera();
  }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    viewportWidth = Math.max(1, Math.floor(bounds.width));
    viewportHeight = Math.max(1, Math.floor(bounds.height));
    const aspect = viewportWidth / viewportHeight;
    // On narrow screens, fit the full board rather than clip its wooden edges.
    baseHeight = Math.max(20.3, 25.2 / Math.max(aspect, .28));
    renderer.setSize(viewportWidth, viewportHeight, false);
    updateCamera();
  }
  document.getElementById("orbitLeft").addEventListener("click", function () {
    yaw -= Math.PI / 9; updateCamera();
  });
  document.getElementById("orbitRight").addEventListener("click", function () {
    yaw += Math.PI / 9; updateCamera();
  });
  document.getElementById("zoomOut").addEventListener("click", function () { setZoom(zoom / 1.2); });
  document.getElementById("zoomIn").addEventListener("click", function () { setZoom(zoom * 1.2); });
  document.getElementById("resetView").addEventListener("click", function () {
    yaw = initialYaw; setZoom(1);
  });
  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    setZoom(zoom * Math.exp(-event.deltaY * .0014));
  }, { passive: false });
  const pointers = new Map();
  let lastPinchDistance = null;
  canvas.addEventListener("pointerdown", function (event) {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastPinchDistance = null;
  });
  canvas.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) return;
    const old = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      yaw -= (event.clientX - old.x) * .0085;
      updateCamera();
    } else if (pointers.size === 2) {
      const pair = [...pointers.values()];
      const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      if (lastPinchDistance !== null && lastPinchDistance > 5) {
        setZoom(zoom * (distance / lastPinchDistance));
      }
      lastPinchDistance = distance;
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    lastPinchDistance = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", function (event) {
    pointers.delete(event.pointerId);
    lastPinchDistance = null;
  });
  window.addEventListener("keydown", function (event) {
    const el = event.target;
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
    if (event.key === "ArrowLeft") { yaw -= .13; updateCamera(); }
    if (event.key === "ArrowRight") { yaw += .13; updateCamera(); }
    if (event.key === "+" || event.key === "=") setZoom(zoom * 1.12);
    if (event.key === "-" || event.key === "_") setZoom(zoom / 1.12);
  });

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize();

  const clock = new THREE.Clock();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = true;
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) { clock.getDelta(); render(); }
  });
  function render() {
    if (!running) return;
    requestAnimationFrame(render);
    const t = clock.getElapsedTime();
    if (!reducedMotion) {
      for (const soldier of soldiers) {
        soldier.breathing.position.y = soldier.baseY + Math.sin(t * 1.45 + soldier.phase) * .007;
        soldier.breathing.rotation.z = Math.sin(t * .72 + soldier.phase) * .009;
      }
    }
    renderer.render(scene, camera);
  }
  render();
}
