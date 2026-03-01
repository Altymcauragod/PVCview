// ═══════════════════════════════════════════════════════════════════
//  PipeForge 3D  —  app.js
//  Three.js r128 (CDN)
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Renderer ─────────────────────────────────────────────────────
  const canvas = document.getElementById('three-canvas');
  const wrap   = document.getElementById('canvas-wrap');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0d12);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog   = new THREE.Fog(0x0b0d12, 25, 70);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  camera.position.set(8, 9, 13);
  camera.lookAt(0, 0, 0);

  // ── Lights ───────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x8899cc, 0.7));
  const sun = new THREE.DirectionalLight(0xfff5e8, 1.2);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near:.5, far:80, left:-22, right:22, top:22, bottom:-22 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x00e5ff, 0.2);
  fill.position.set(-10, 5, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff6b00, 0.1);
  rim.position.set(0, -5, 10);
  scene.add(rim);

  // ── Grid & Ground ────────────────────────────────────────────────
  let gridHelper = new THREE.GridHelper(40, 40, 0x252e42, 0x181d28);
  scene.add(gridHelper);
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.22 })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // ── Endpoint dots group ───────────────────────────────────────────
  const endpointGroup = new THREE.Group();
  scene.add(endpointGroup);

  // ── Material Definitions ──────────────────────────────────────────
  const MATS = {
    'pvc-white':      { color:0xeee8e0, roughness:.55, metalness:.02 },
    'pvc-gray':       { color:0x808890, roughness:.50, metalness:.03 },
    'cpvc':           { color:0xc8a060, roughness:.58, metalness:.01 },
    'abs':            { color:0x282828, roughness:.80, metalness:.00 },
    'galvanized':     { color:0xc0c0b8, roughness:.28, metalness:.75 },
    'copper':         { color:0xd07840, roughness:.20, metalness:.90 },
    'black-iron':     { color:0x302820, roughness:.70, metalness:.55 },
    'stainless':      { color:0xe0e0e8, roughness:.12, metalness:.95 },
    'hdpe-black':     { color:0x141414, roughness:.90, metalness:.00 },
    'hdpe-yellow':    { color:0xeece10, roughness:.75, metalness:.00 },
    'pex-red':        { color:0xc82020, roughness:.65, metalness:.00 },
    'pex-blue':       { color:0x2050c0, roughness:.65, metalness:.00 },
    'emt':            { color:0x90b820, roughness:.35, metalness:.60 },
    'rigid-conduit':  { color:0xb8a050, roughness:.40, metalness:.50 },
    'orange-conduit': { color:0xd06010, roughness:.55, metalness:.02 },
    'fiberglass':     { color:0xc8b880, roughness:.82, metalness:.00 },
    'custom':         { color:0xe8e0d0, roughness:.55, metalness:.02 },
  };

  function makeMat(matKey, customHex) {
    const def = MATS[matKey] || MATS['pvc-white'];
    return new THREE.MeshStandardMaterial({
      color: customHex ? new THREE.Color(customHex) : new THREE.Color(def.color),
      roughness: def.roughness,
      metalness: def.metalness,
    });
  }

  // ── Pipe radius from nominal inch size ────────────────────────────
  function pR(s) { return 0.045 + s * 0.042; }

  // ── Compute endpoints for a piece (world space) ───────────────────
  // Returns array of {x,y,z} in world space
  function getEndpoints(piece) {
    const d   = piece.userData;
    const r3  = new THREE.Vector3();
    const pts = [];

    const halfLen = d.len / 2;
    const FITTINGS = ['elbow-90','elbow-45','tee','cross','wye','reducer',
                      'union','cap','coupler','valve','flange','bushing'];

    if (['pipe-h','pipe-v','pipe-d','pipe-z','flex','conduit'].includes(d.tool)) {
      // local-space endpoints along piece's local Y axis (cylinder axis)
      const local = [
        new THREE.Vector3(0, -halfLen, 0),
        new THREE.Vector3(0,  halfLen, 0),
      ];
      local.forEach(lp => {
        const wp = lp.clone().applyMatrix4(piece.matrixWorld);
        pts.push(wp);
      });
    } else {
      // For fittings, return center + offsets based on type
      const ar = d.len * 0.42;
      let offsets = [];
      if (d.tool === 'elbow-90' || d.tool === 'elbow-45') {
        offsets = [new THREE.Vector3(0, ar, 0), new THREE.Vector3(ar, 0, 0)];
      } else if (d.tool === 'tee') {
        offsets = [new THREE.Vector3(-ar, 0, 0), new THREE.Vector3(ar, 0, 0), new THREE.Vector3(0, ar, 0)];
      } else if (d.tool === 'cross') {
        offsets = [new THREE.Vector3(-ar, 0, 0), new THREE.Vector3(ar, 0, 0), new THREE.Vector3(0, ar, 0), new THREE.Vector3(0, -ar, 0)];
      } else if (d.tool === 'wye') {
        offsets = [new THREE.Vector3(0, ar, 0), new THREE.Vector3(-ar*0.7, -ar*0.7, 0), new THREE.Vector3(ar*0.7, -ar*0.7, 0)];
      } else {
        offsets = [new THREE.Vector3(0, -ar, 0), new THREE.Vector3(0, ar, 0)];
      }
      offsets.forEach(lp => {
        const wp = lp.clone().applyMatrix4(piece.matrixWorld);
        pts.push(wp);
      });
    }
    return pts;
  }

  // ── Build 3D mesh for a piece ─────────────────────────────────────
  function buildMesh(tool, sizeInch, matKey, customHex, len) {
    const r   = pR(sizeInch);
    const mat = makeMat(matKey, customHex);
    const g   = new THREE.Group();
    const SEG = 18;

    function cyl(r1, r2, h, rx, ry, rz, px, py, pz) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, SEG), mat.clone());
      m.rotation.set(rx, ry, rz);
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true;
      return m;
    }
    function sph(radius, px, py, pz) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(radius, SEG, 12), mat.clone());
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true;
      return m;
    }
    function tor(R, tube, px, py, pz, rx, ry, rz) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 10, 20, Math.PI / 2), mat.clone());
      m.position.set(px, py, pz); m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      return m;
    }

    // ── PIPES ──────────────────────────────────────────────────────
    if (tool === 'pipe-h') {
      g.add(cyl(r, r, len, 0, 0, Math.PI/2, 0, 0, 0));
    }
    else if (tool === 'pipe-v') {
      g.add(cyl(r, r, len, 0, 0, 0, 0, 0, 0));
    }
    else if (tool === 'pipe-d') {
      g.add(cyl(r, r, len, 0, 0, Math.PI/4, 0, 0, 0));
    }
    else if (tool === 'pipe-z') {
      const arm = len * 0.3;
      g.add(cyl(r, r, arm, 0, 0, Math.PI/2, 0, len*0.3, 0));
      g.add(cyl(r, r, len*0.4, 0, 0, 0, 0, 0, 0));
      g.add(cyl(r, r, arm, 0, 0, Math.PI/2, 0, -len*0.3, 0));
      g.add(sph(r*1.1, 0, len*0.3, 0));
      g.add(sph(r*1.1, 0, -len*0.3, 0));
    }
    else if (tool === 'flex') {
      // Segmented wave pipe
      const segs = 14;
      const step = len / segs;
      for (let i = 0; i < segs; i++) {
        const y = -len/2 + step * i + step/2;
        const wave = Math.sin(i * 0.8) * r * 1.5;
        const segR = r * (0.9 + Math.random() * 0.15);
        g.add(cyl(segR, segR, step * 1.05, wave * 0.15, 0, 0, wave, y, 0));
      }
    }
    else if (tool === 'conduit') {
      // Hollow conduit look: outer + inner ridge rings
      g.add(cyl(r * 1.1, r * 1.1, len, 0, 0, 0, 0, 0, 0));
      const ringCount = Math.max(2, Math.floor(len * 1.5));
      for (let i = 0; i < ringCount; i++) {
        const y = -len/2 + (len / ringCount) * (i + 0.5);
        g.add(cyl(r * 1.22, r * 1.22, 0.04, 0, 0, 0, 0, y, 0));
      }
    }

    // ── FITTINGS ───────────────────────────────────────────────────
    else if (tool === 'elbow-90') {
      const arm = len * 0.42;
      // Use a torus quarter for smooth elbow
      g.add(tor(arm * 0.5, r, arm * 0.5, 0, 0, 0, Math.PI/2, 0, 0));
      g.add(cyl(r, r, arm * 0.5, 0, 0, 0, 0, arm * 0.25, 0));
      g.add(cyl(r, r, arm * 0.5, 0, 0, Math.PI/2, arm * 0.25, 0, 0));
      // collars
      g.add(cyl(r*1.2, r*1.2, 0.06, 0, 0, 0, 0, arm * 0.5, 0));
      g.add(cyl(r*1.2, r*1.2, 0.06, 0, 0, Math.PI/2, arm * 0.5, 0, 0));
    }
    else if (tool === 'elbow-45') {
      const arm = len * 0.38;
      g.add(cyl(r, r, arm * 0.6, 0, 0, Math.PI/8, 0, arm * 0.25, 0));
      g.add(cyl(r, r, arm * 0.6, 0, 0, -Math.PI/8, 0, -arm * 0.25, 0));
      g.add(sph(r * 1.15, 0, 0, 0));
      g.add(cyl(r*1.2, r*1.2, 0.06, 0, 0, Math.PI/8, 0, arm * 0.55, 0));
      g.add(cyl(r*1.2, r*1.2, 0.06, 0, 0, -Math.PI/8, 0, -arm * 0.55, 0));
    }
    else if (tool === 'tee') {
      const arm = len * 0.42;
      g.add(cyl(r, r, arm * 2, 0, 0, Math.PI/2, 0, 0, 0));
      g.add(cyl(r, r, arm, 0, 0, 0, 0, arm/2, 0));
      g.add(sph(r * 1.25, 0, 0, 0));
      g.add(cyl(r*1.18, r*1.18, 0.06, 0, 0, Math.PI/2, -arm, 0, 0));
      g.add(cyl(r*1.18, r*1.18, 0.06, 0, 0, Math.PI/2,  arm, 0, 0));
      g.add(cyl(r*1.18, r*1.18, 0.06, 0, 0, 0, 0, arm, 0));
    }
    else if (tool === 'cross') {
      const arm = len * 0.42;
      g.add(cyl(r, r, arm * 2, 0, 0, Math.PI/2, 0, 0, 0));
      g.add(cyl(r, r, arm * 2, 0, 0, 0, 0, 0, 0));
      g.add(sph(r * 1.3, 0, 0, 0));
      [-arm, arm].forEach(p => {
        g.add(cyl(r*1.18, r*1.18, 0.06, 0, 0, Math.PI/2, p, 0, 0));
        g.add(cyl(r*1.18, r*1.18, 0.06, 0, 0, 0, 0, p, 0));
      });
    }
    else if (tool === 'wye') {
      const arm = len * 0.4;
      g.add(cyl(r, r, arm, 0, 0, 0, 0, arm/2, 0));
      g.add(cyl(r, r, arm, 0, 0, Math.PI * 5/6, -arm*0.43, -arm*0.25, 0));
      g.add(cyl(r, r, arm, 0, 0, Math.PI * 1/6, arm*0.43, -arm*0.25, 0));
      g.add(sph(r * 1.2, 0, 0, 0));
    }
    else if (tool === 'reducer') {
      const rS = r; const rL = r * 1.8;
      g.add(new THREE.Mesh(
        new THREE.CylinderGeometry(rS, rL, len * 0.5, SEG),
        mat.clone()
      ));
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(rS,rL,len*0.5,SEG), mat.clone());
      cone.castShadow = cone.receiveShadow = true;
      g.add(cone);
      g.add(cyl(rS, rS, len * 0.3, 0, 0, 0, 0, len*0.4, 0));
      g.add(cyl(rL, rL, len * 0.3, 0, 0, 0, 0, -len*0.4, 0));
    }
    else if (tool === 'union') {
      const wr = r * 1.4;
      g.add(cyl(r, r, len * 0.3, 0, 0, 0, 0, len*0.33, 0));
      g.add(cyl(r, r, len * 0.3, 0, 0, 0, 0, -len*0.33, 0));
      g.add(cyl(wr, wr, len * 0.2, 0, 0, 0, 0, 0.06, 0));
      g.add(cyl(wr * 0.95, wr * 0.95, len * 0.2, 0, 0, 0, 0, -0.06, 0));
      // nut ring
      const hexGeo = new THREE.CylinderGeometry(wr * 1.1, wr * 1.1, len * 0.08, 6);
      const hm = new THREE.Mesh(hexGeo, mat.clone());
      hm.castShadow = true; g.add(hm);
    }
    else if (tool === 'cap') {
      g.add(cyl(r, r, len * 0.3, 0, 0, 0, 0, -len*0.15, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r*1.05, SEG, 10, 0, Math.PI*2, 0, Math.PI/2), mat.clone());
      dome.position.y = 0; dome.castShadow = true; g.add(dome);
      g.add(cyl(r*1.15, r*1.15, 0.05, 0, 0, 0, 0, -len*0.01, 0));
    }
    else if (tool === 'coupler') {
      const wr = r * 1.32;
      g.add(cyl(r, r, len * 0.35, 0, 0, 0, 0, len*0.285, 0));
      g.add(cyl(r, r, len * 0.35, 0, 0, 0, 0, -len*0.285, 0));
      g.add(cyl(wr, wr, len * 0.22, 0, 0, 0, 0, 0, 0));
      // hex detail
      const hGeo = new THREE.CylinderGeometry(wr*1.05, wr*1.05, len*0.06, 6);
      const hm = new THREE.Mesh(hGeo, mat.clone()); hm.castShadow=true; g.add(hm);
    }
    else if (tool === 'valve') {
      const wr = r * 1.28;
      // body
      g.add(cyl(r, r, len * 0.35, 0, 0, 0, 0, len*0.28, 0));
      g.add(cyl(r, r, len * 0.35, 0, 0, 0, 0, -len*0.28, 0));
      g.add(cyl(wr, wr, len * 0.25, 0, 0, 0, 0, 0, 0));
      // stem
      g.add(cyl(r * 0.5, r * 0.5, len * 0.35, 0, 0, Math.PI/2, 0, 0, 0));
      // handle bar
      const handle = cyl(r * 0.3, r * 0.3, len * 0.5, 0, 0, 0, 0, len * 0.18, 0);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, r*1.5, 0);
      g.add(handle);
      g.add(cyl(r*1.2, r*1.2, 0.05, 0, 0, 0, 0, len*0.13, 0));
      g.add(cyl(r*1.2, r*1.2, 0.05, 0, 0, 0, 0, -len*0.13, 0));
    }
    else if (tool === 'flange') {
      const fr = r * 3.2;
      g.add(cyl(r, r, len * 0.35, 0, 0, 0, 0, len*0.18, 0));
      g.add(cyl(fr, fr, len * 0.12, 0, 0, 0, 0, 0, 0));
      g.add(cyl(r * 1.15, r * 1.15, len * 0.06, 0, 0, 0, 0, len*0.06, 0));
      // bolt holes (visual)
      const boltR = fr * 0.7;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const bx = Math.cos(angle) * boltR, bz = Math.sin(angle) * boltR;
        g.add(cyl(r * 0.2, r * 0.2, len * 0.16, 0, 0, 0, bx, 0, bz));
      }
    }
    else if (tool === 'bushing') {
      const rL = r * 1.6, rS = r * 0.85;
      g.add(cyl(rL, rL, len * 0.2, 0, 0, 0, 0, -len*0.1, 0));
      const transGeo = new THREE.CylinderGeometry(rS, rL, len * 0.2, SEG);
      const tm = new THREE.Mesh(transGeo, mat.clone()); tm.castShadow=true; g.add(tm);
      g.add(cyl(rS, rS, len * 0.2, 0, 0, 0, 0, len*0.2, 0));
    }
    else {
      // fallback: plain cylinder
      g.add(cyl(r, r, len, 0, 0, 0, 0, 0, 0));
    }

    g.userData = { tool, sizeInch, matKey, customHex: customHex || null, len };
    return g;
  }

  // ── State ──────────────────────────────────────────────────────────
  let currentTool    = 'pipe-h';
  let currentSize    = 0.5;
  let currentMat     = 'pvc-white';
  let currentCustom  = null;
  let currentLen     = 3;
  let rotSnap        = 0;          // 0 = free, else degrees
  let snapEnabled    = true;
  let endSnapEnabled = true;
  let showEndpoints  = true;
  let pieces         = [];
  let selected       = null;
  let ghost          = null;
  let ghostSnapping  = false;

  // Undo/redo stacks
  const undoStack = [];
  const redoStack = [];
  function saveUndo() {
    const state = pieces.map(p => ({
      ...p.userData,
      pos: p.position.toArray(),
      rot: [p.rotation.x, p.rotation.y, p.rotation.z],
    }));
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }
  function restoreState(json) {
    pieces.forEach(p => scene.remove(p));
    pieces = [];
    selected = null;
    updateSelUI();
    const data = JSON.parse(json);
    data.forEach(d => {
      const p = buildMesh(d.tool, d.sizeInch, d.matKey || 'pvc-white', d.customHex, d.len);
      p.position.fromArray(d.pos);
      p.rotation.set(...d.rot);
      scene.add(p);
      pieces.push(p);
    });
    refreshEndpoints();
    updateStats();
  }
  function undo() {
    if (!undoStack.length) return;
    const cur = pieces.map(p => ({ ...p.userData, pos:p.position.toArray(), rot:[p.rotation.x,p.rotation.y,p.rotation.z] }));
    redoStack.push(JSON.stringify(cur));
    restoreState(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    const cur = pieces.map(p => ({ ...p.userData, pos:p.position.toArray(), rot:[p.rotation.x,p.rotation.y,p.rotation.z] }));
    undoStack.push(JSON.stringify(cur));
    restoreState(redoStack.pop());
  }

  // ── Resize ──────────────────────────────────────────────────────────
  function resize() {
    renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Orbit ───────────────────────────────────────────────────────────
  let orb = { active:false, btn:-1, prev:{x:0,y:0} };
  let sph = { theta: 0.55, phi: 0.72 };
  let camRadius = Math.sqrt(8*8+9*9+13*13);
  let camTarget = new THREE.Vector3(0, 0, 0);

  function applyOrbit() {
    sph.phi = Math.max(0.04, Math.min(Math.PI * 0.488, sph.phi));
    camera.position.set(
      camTarget.x + camRadius * Math.sin(sph.phi) * Math.sin(sph.theta),
      camTarget.y + camRadius * Math.cos(sph.phi),
      camTarget.z + camRadius * Math.sin(sph.phi) * Math.cos(sph.theta)
    );
    camera.lookAt(camTarget);
  }
  applyOrbit();

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1 || e.button === 2) {
      orb.active = true; orb.btn = e.button;
      orb.prev = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  });
  window.addEventListener('mousemove', e => {
    if (!orb.active) return;
    const dx = e.clientX - orb.prev.x, dy = e.clientY - orb.prev.y;
    orb.prev = { x: e.clientX, y: e.clientY };
    if (orb.btn === 2) {
      sph.theta -= dx * 0.007; sph.phi -= dy * 0.007; applyOrbit();
    } else if (orb.btn === 1) {
      const sp = camRadius * 0.0012;
      const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      camTarget.addScaledVector(right, -dx*sp).addScaledVector(camera.up, dy*sp);
      applyOrbit();
    }
  });
  window.addEventListener('mouseup', () => { orb.active = false; });
  canvas.addEventListener('wheel', e => {
    camRadius = Math.max(1.5, Math.min(100, camRadius + e.deltaY * 0.018));
    applyOrbit(); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ── Camera presets ──────────────────────────────────────────────────
  function animCam(th, ph, rad, cx, cy, cz) {
    const steps = 45;
    let i = 0;
    const st = sph.theta, sp = sph.phi, sr = camRadius;
    const tx = camTarget.x, ty = camTarget.y, tz = camTarget.z;
    clearInterval(animCam._t);
    animCam._t = setInterval(() => {
      const t = ++i / steps;
      sph.theta = st + (th - st) * t; sph.phi = sp + (ph - sp) * t;
      camRadius = sr + (rad - sr) * t;
      camTarget.set(tx+(cx-tx)*t, ty+(cy-ty)*t, tz+(cz-tz)*t);
      applyOrbit(); if (i>=steps) clearInterval(animCam._t);
    }, 16);
  }

  document.getElementById('btnResetCam').addEventListener('click',  () => animCam(0.55, 0.72, 18, 0, 0, 0));
  document.getElementById('btnP1').addEventListener('click',        () => animCam(0.55, 0.72, 18, 0, 0, 0));
  document.getElementById('btnTopView').addEventListener('click',   () => animCam(0, 0.04, 22, 0, 0, 0));
  document.getElementById('btnP2').addEventListener('click',        () => animCam(0, 0.04, 22, 0, 0, 0));
  document.getElementById('btnFrontView').addEventListener('click', () => animCam(0, Math.PI*0.38, 18, 0, 0, 0));
  document.getElementById('btnP3').addEventListener('click',        () => animCam(0, Math.PI*0.38, 18, 0, 0, 0));
  document.getElementById('btnSideView').addEventListener('click',  () => animCam(Math.PI*0.5, Math.PI*0.38, 18, 0, 0, 0));

  // ── Raycasting helpers ───────────────────────────────────────────────
  const raycaster  = new THREE.Raycaster();
  const flatPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHit   = new THREE.Vector3();

  function getNDC(e) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
     -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
  }
  function getFloorPoint(e) {
    raycaster.setFromCamera(getNDC(e), camera);
    raycaster.ray.intersectPlane(flatPlane, planeHit);
    return planeHit.clone();
  }
  function snapGrid(v) {
    if (!snapEnabled) return v;
    return new THREE.Vector3(Math.round(v.x), v.y, Math.round(v.z));
  }

  // ── Endpoint snap ─────────────────────────────────────────────────────
  const SNAP_DIST = 0.7;
  function findNearestEndpoint(worldPt, excludePiece) {
    let best = null, bestD = SNAP_DIST;
    pieces.forEach(p => {
      if (p === excludePiece) return;
      getEndpoints(p).forEach(ep => {
        const d = worldPt.distanceTo(ep);
        if (d < bestD) { bestD = d; best = ep.clone(); }
      });
    });
    return best;
  }

  // ── Ghost preview ─────────────────────────────────────────────────────
  function buildGhost() {
    if (ghost) scene.remove(ghost);
    ghost = buildMesh(currentTool, currentSize, currentMat, currentCustom, currentLen);
    ghost.traverse(m => {
      if (m.isMesh) {
        m.material.transparent = true;
        m.material.opacity = 0.4;
        m.material.emissive = new THREE.Color(0x00e5ff);
        m.material.emissiveIntensity = 0.5;
        m.castShadow = false;
      }
    });
    ghost.userData.isGhost = true;
    scene.add(ghost);
  }
  buildGhost();

  // ── Mouse move — ghost + snap indicator ─────────────────────────────
  const snapDotEl = document.getElementById('snap-dot');

  canvas.addEventListener('mousemove', e => {
    if (orb.active) return;
    const floorPt = getFloorPoint(e);
    if (!floorPt || isNaN(floorPt.x)) return;

    let placePt = snapGrid(floorPt);
    ghostSnapping = false;

    if (endSnapEnabled && pieces.length) {
      const nearest = findNearestEndpoint(floorPt, null);
      if (nearest) {
        placePt = nearest.clone();
        ghostSnapping = true;
      }
    }

    if (ghost) ghost.position.copy(placePt);

    // show snap dot on screen
    if (ghostSnapping) {
      const proj = placePt.clone().project(camera);
      const rect = canvas.getBoundingClientRect();
      const sx = (proj.x * 0.5 + 0.5) * rect.width  + rect.left;
      const sy = (-proj.y * 0.5 + 0.5) * rect.height + rect.top;
      snapDotEl.style.left = sx + 'px';
      snapDotEl.style.top  = sy + 'px';
      snapDotEl.classList.remove('hidden');
    } else {
      snapDotEl.classList.add('hidden');
    }
  });

  // ── Place piece on click ─────────────────────────────────────────────
  canvas.addEventListener('click', e => {
    if (orb.active) return;
    const ndc = getNDC(e);
    raycaster.setFromCamera(ndc, camera);

    // Try to select existing piece
    const meshes = [];
    pieces.forEach(p => p.traverse(m => { if (m.isMesh) meshes.push(m); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      let root = hits[0].object;
      while (root.parent && root.parent !== scene) root = root.parent;
      if (!root.userData.isGhost) { selectPiece(root); return; }
    }

    // Place new piece
    const fp = getFloorPoint(e);
    if (!fp || isNaN(fp.x)) return;

    let placePt = snapGrid(fp);
    if (endSnapEnabled && pieces.length) {
      const nearest = findNearestEndpoint(fp, null);
      if (nearest) placePt = nearest.clone();
    }

    saveUndo();
    const piece = buildMesh(currentTool, currentSize, currentMat, currentCustom, currentLen);
    piece.position.copy(placePt);

    // apply rotation snap if set
    if (rotSnap > 0) {
      const snap = THREE.MathUtils.degToRad(rotSnap);
      piece.rotation.y = Math.round(piece.rotation.y / snap) * snap;
    }

    scene.add(piece);
    pieces.push(piece);
    refreshEndpoints();
    updateStats();
    selectPiece(piece);
  });

  // ── Endpoint visual dots ──────────────────────────────────────────────
  const endDotMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const endDotGeo = new THREE.SphereGeometry(0.07, 8, 6);

  function refreshEndpoints() {
    // clear old dots
    while (endpointGroup.children.length) endpointGroup.remove(endpointGroup.children[0]);
    if (!showEndpoints) return;
    pieces.forEach(p => {
      getEndpoints(p).forEach(ep => {
        const dot = new THREE.Mesh(endDotGeo, endDotMat);
        dot.position.copy(ep);
        endpointGroup.add(dot);
      });
    });
  }

  // ── Selection ───────────────────────────────────────────────────────
  function selectPiece(piece) {
    if (selected && selected !== piece) deselect();
    selected = piece;
    selected.traverse(m => {
      if (m.isMesh) { m.material.emissive = new THREE.Color(0x00e5ff); m.material.emissiveIntensity = 0.35; }
    });
    document.getElementById('gizmo-panel').classList.remove('hidden');
    document.getElementById('selection-bar').classList.remove('hidden');
    updateSelUI();
  }

  function deselect() {
    if (!selected) return;
    selected.traverse(m => {
      if (m.isMesh) { m.material.emissive = new THREE.Color(0x000000); m.material.emissiveIntensity = 0; }
    });
    selected = null;
    document.getElementById('gizmo-panel').classList.add('hidden');
    document.getElementById('selection-bar').classList.add('hidden');
    updateSelUI();
  }

  function updateSelUI() {
    const fields = document.getElementById('selFields');
    const empty  = document.getElementById('selEmpty');
    if (!selected) {
      fields.classList.add('hidden'); empty.classList.remove('hidden');
      document.getElementById('selection-bar').classList.add('hidden');
      return;
    }
    fields.classList.remove('hidden'); empty.classList.add('hidden');
    const d = selected.userData;
    document.getElementById('selType').textContent = d.tool;
    document.getElementById('selMat').textContent  = d.matKey || '—';
    document.getElementById('selSize').textContent = d.sizeInch + '"';
    document.getElementById('selLen').textContent  = (d.len || '—') + ' ft';
    document.getElementById('posX').value = selected.position.x.toFixed(2);
    document.getElementById('posY').value = selected.position.y.toFixed(2);
    document.getElementById('posZ').value = selected.position.z.toFixed(2);
    document.getElementById('selBarText').textContent =
      `${d.tool} · ${d.sizeInch}" · ${d.matKey} · ${d.len}ft`;
    // switch to scene tab
    switchTab('scene');
  }

  // Position inputs
  ['posX','posY','posZ'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (!selected) return;
      saveUndo();
      selected.position.set(
        parseFloat(document.getElementById('posX').value),
        parseFloat(document.getElementById('posY').value),
        parseFloat(document.getElementById('posZ').value)
      );
      refreshEndpoints();
    });
  });

  // ── Rotate selected helper ─────────────────────────────────────────
  function rotateSel(axis, deg) {
    if (!selected) return;
    saveUndo();
    const r = THREE.MathUtils.degToRad(deg);
    if (axis === 'x') selected.rotation.x += r;
    if (axis === 'y') selected.rotation.y += r;
    if (axis === 'z') selected.rotation.z += r;
    refreshEndpoints();
    updateSelUI();
  }

  // Gizmo buttons
  document.querySelectorAll('.gizmo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const axis = btn.dataset.axis, dir = parseFloat(btn.dataset.dir);
      rotateSel(axis, 45 * dir);
    });
  });

  // Selection bar rotate buttons
  document.getElementById('sbRotY').addEventListener('click', () => rotateSel('y', 45));
  document.getElementById('sbRotX').addEventListener('click', () => rotateSel('x', 45));
  document.getElementById('sbRotZ').addEventListener('click', () => rotateSel('z', 45));
  document.getElementById('sbDelete').addEventListener('click', () => { deletePiece(selected); });

  // Scene tab rotate buttons
  document.querySelectorAll('.rq-btn[data-axis]').forEach(btn => {
    btn.addEventListener('click', () => rotateSel(btn.dataset.axis, parseFloat(btn.dataset.a)));
  });
  document.getElementById('btnResetRot').addEventListener('click', () => {
    if (!selected) return;
    saveUndo();
    selected.rotation.set(0,0,0);
    refreshEndpoints();
  });

  // ── Delete ─────────────────────────────────────────────────────────
  function deletePiece(p) {
    if (!p) return;
    saveUndo();
    scene.remove(p);
    pieces = pieces.filter(x => x !== p);
    if (selected === p) deselect();
    refreshEndpoints();
    updateStats();
  }
  document.getElementById('btnDeleteSel').addEventListener('click', () => deletePiece(selected));
  document.getElementById('btnDupSel').addEventListener('click', () => {
    if (!selected) return;
    saveUndo();
    const d = selected.userData;
    const dup = buildMesh(d.tool, d.sizeInch, d.matKey, d.customHex, d.len);
    dup.position.copy(selected.position).add(new THREE.Vector3(0.6, 0, 0.6));
    dup.rotation.copy(selected.rotation);
    scene.add(dup); pieces.push(dup);
    refreshEndpoints(); updateStats(); selectPiece(dup);
  });
  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (!confirm('Clear all pieces?')) return;
    saveUndo();
    pieces.forEach(p => scene.remove(p)); pieces = []; deselect();
    refreshEndpoints(); updateStats();
  });

  // ── Context Menu ───────────────────────────────────────────────────
  const ctxMenu = document.getElementById('context-menu');
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    raycaster.setFromCamera(getNDC(e), camera);
    const meshes = [];
    pieces.forEach(p => p.traverse(m => { if (m.isMesh) meshes.push(m); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      let root = hits[0].object;
      while (root.parent && root.parent !== scene) root = root.parent;
      selectPiece(root);
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top  = e.clientY + 'px';
      ctxMenu.classList.remove('hidden');
    } else {
      ctxMenu.classList.add('hidden'); deselect();
    }
  });
  document.addEventListener('mousedown', e => {
    if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden');
  });

  document.getElementById('ctxDelete').addEventListener('click',    () => { deletePiece(selected); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxDuplicate').addEventListener('click', () => { document.getElementById('btnDupSel').click(); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxRX').addEventListener('click', () => { rotateSel('x', 45); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxRY').addEventListener('click', () => { rotateSel('y', 45); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxRZ').addEventListener('click', () => { rotateSel('z', 45); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxFlatH').addEventListener('click', () => {
    if (!selected) return; saveUndo(); selected.rotation.set(0, selected.rotation.y, 0); refreshEndpoints(); ctxMenu.classList.add('hidden');
  });
  document.getElementById('ctxFlatV').addEventListener('click', () => {
    if (!selected) return; saveUndo(); selected.rotation.set(0, selected.rotation.y, Math.PI/2); refreshEndpoints(); ctxMenu.classList.add('hidden');
  });
  document.getElementById('ctxResetRot').addEventListener('click', () => {
    if (!selected) return; saveUndo(); selected.rotation.set(0,0,0); refreshEndpoints(); ctxMenu.classList.add('hidden');
  });

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') deletePiece(selected);
    if (e.key === 'Escape') deselect();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); redo(); }
    if (e.key === 'x' && selected) rotateSel('x', 45);
    if (e.key === 'y' && selected) rotateSel('y', 45);
    if (e.key === 'z' && selected) rotateSel('z', 45);
    if (e.key === 'd' && selected) document.getElementById('btnDupSel').click();
  });
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);

  // ── Tab switching ───────────────────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-'+name));
  }
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  // ── Build tab controls ──────────────────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
      buildGhost();
      document.getElementById('modeHint').textContent =
        `Tool: ${btn.querySelector('span:last-child').textContent} — click canvas to place`;
    });
  });

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize = parseFloat(btn.dataset.size);
      buildGhost();
    });
  });

  document.querySelectorAll('.snap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.snap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rotSnap = parseFloat(btn.dataset.rot);
    });
  });

  const lenSlider = document.getElementById('lengthSlider');
  const lenNum    = document.getElementById('lengthNum');
  function syncLen(v) {
    currentLen = parseFloat(v);
    lenSlider.value = currentLen;
    lenNum.value    = currentLen;
    buildGhost();
  }
  lenSlider.addEventListener('input',  e => syncLen(e.target.value));
  lenNum.addEventListener('change',    e => syncLen(e.target.value));

  // ── Materials tab ───────────────────────────────────────────────────
  document.querySelectorAll('.mat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.mat-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      currentMat    = item.dataset.mat;
      currentCustom = null;
      buildGhost();
    });
  });

  document.getElementById('applyCustomColor').addEventListener('click', () => {
    currentMat    = 'custom';
    currentCustom = document.getElementById('customColor').value;
    document.querySelectorAll('.mat-item').forEach(m => m.classList.remove('active'));
    buildGhost();
  });

  // ── Scene / display toggles ─────────────────────────────────────────
  document.getElementById('toggleGrid').addEventListener('change', e => { gridHelper.visible = e.target.checked; });
  document.getElementById('toggleSnap').addEventListener('change', e => { snapEnabled = e.target.checked; });
  document.getElementById('toggleEndSnap').addEventListener('change', e => { endSnapEnabled = e.target.checked; });
  document.getElementById('toggleEndpoints').addEventListener('change', e => {
    showEndpoints = e.target.checked; refreshEndpoints();
  });
  document.getElementById('toggleShadow').addEventListener('change', e => {
    renderer.shadowMap.enabled = e.target.checked;
    sun.castShadow = e.target.checked;
  });
  document.getElementById('toggleWireframe').addEventListener('change', e => {
    pieces.forEach(p => p.traverse(m => { if (m.isMesh) m.material.wireframe = e.target.checked; }));
  });
  document.getElementById('toggleFog').addEventListener('change', e => {
    scene.fog = e.target.checked ? new THREE.Fog(0x0b0d12, 25, 70) : null;
  });

  // ── Export / Import ─────────────────────────────────────────────────
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = pieces.map(p => ({
      ...p.userData,
      pos: p.position.toArray(),
      rot: [p.rotation.x, p.rotation.y, p.rotation.z],
    }));
    const b = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(b), download:'pipeforge-sketch.json'
    }).click();
  });
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        saveUndo();
        pieces.forEach(p => scene.remove(p)); pieces = [];
        const data = JSON.parse(ev.target.result);
        data.forEach(d => {
          const p = buildMesh(d.tool, d.sizeInch, d.matKey || 'pvc-white', d.customHex, d.len);
          p.position.fromArray(d.pos); p.rotation.set(...d.rot);
          scene.add(p); pieces.push(p);
        });
        refreshEndpoints(); updateStats(); deselect();
      } catch { alert('Invalid JSON file.'); }
    };
    r.readAsText(f); e.target.value = '';
  });

  // ── Stats ───────────────────────────────────────────────────────────
  const FITTINGS_LIST = ['elbow-90','elbow-45','tee','cross','wye','reducer',
                         'union','cap','coupler','valve','flange','bushing'];
  function updateStats() {
    document.getElementById('statPieces').textContent   = pieces.length;
    const pipes = pieces.filter(p => !FITTINGS_LIST.includes(p.userData.tool));
    const fitCount = pieces.filter(p => FITTINGS_LIST.includes(p.userData.tool)).length;
    document.getElementById('statFeet').textContent     = pipes.reduce((s,p) => s+(p.userData.len||0), 0).toFixed(1);
    document.getElementById('statFittings').textContent = fitCount;
  }

  // ── Render loop ─────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

})();
