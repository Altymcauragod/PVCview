// ═══════════════════════════════════════════════════════════════════
//  PipeForge 3D  v3  —  app.js      Three.js r128
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Scale factor: 1 three-unit = 1 foot
  // All fittings are dimensioned in REAL inches converted to feet.
  const IN = 1 / 12;  // 1 inch in feet

  // ── Renderer ────────────────────────────────────────────────────────
  const canvas   = document.getElementById('three-canvas');
  const wrap     = document.getElementById('canvas-wrap');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b0d12);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog   = new THREE.Fog(0x0b0d12, 28, 75);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  camera.position.set(8, 9, 13);
  camera.lookAt(0, 0, 0);

  // ── Lights ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x8899cc, 0.65));
  const sun = new THREE.DirectionalLight(0xfff5e8, 1.25);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near:.5, far:100, left:-25, right:25, top:25, bottom:-25 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x00e5ff, 0.18);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  // ── Grid + ground ────────────────────────────────────────────────────
  let gridHelper = new THREE.GridHelper(50, 50, 0x252e42, 0x181d28);
  scene.add(gridHelper);
  // Also draw a 0.5-unit sub-grid (lighter)
  const subGrid = new THREE.GridHelper(50, 100, 0x1a2030, 0x141820);
  subGrid.position.y = 0.001;
  scene.add(subGrid);

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Elevation plane indicator
  const elevPlaneMat  = new THREE.MeshBasicMaterial({ color:0x00e5ff, transparent:true, opacity:0.05, side:THREE.DoubleSide });
  const elevPlaneMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), elevPlaneMat);
  elevPlaneMesh.rotation.x = -Math.PI / 2;
  elevPlaneMesh.visible = false;
  scene.add(elevPlaneMesh);

  // ── Endpoint group ──────────────────────────────────────────────────
  const epGroup = new THREE.Group();
  scene.add(epGroup);

  // ── MATERIAL DEFINITIONS ────────────────────────────────────────────
  const MATDEFS = {
    // PVC / Plastic
    'pvc-white':     { col:0xeee8e0, rou:.55, met:.02, env:false },
    'pvc-gray':      { col:0x808890, rou:.50, met:.03, env:false },
    'cpvc':          { col:0xc8a060, rou:.58, met:.01, env:false },
    'abs':           { col:0x282828, rou:.80, met:.00, env:false },
    'hdpe-black':    { col:0x141414, rou:.90, met:.00, env:false },
    'hdpe-yellow':   { col:0xeece10, rou:.75, met:.00, env:false },
    'pex-red':       { col:0xc82020, rou:.65, met:.00, env:false },
    'pex-blue':      { col:0x2050c0, rou:.65, met:.00, env:false },
    'orange-conduit':{ col:0xd06010, rou:.55, met:.02, env:false },
    'fiberglass':    { col:0xc8b880, rou:.82, met:.00, env:false },
    // Metal
    'galvanized':    { col:0xc0c0b8, rou:.28, met:.75, env:true  },
    'copper':        { col:0xd07840, rou:.20, met:.90, env:true  },
    'black-iron':    { col:0x302820, rou:.70, met:.55, env:true  },
    'stainless':     { col:0xe0e0e8, rou:.12, met:.95, env:true  },
    'emt':           { col:0x90b820, rou:.35, met:.60, env:true  },
    'rigid-conduit': { col:0xb8a050, rou:.40, met:.50, env:true  },
    'steel-raw':     { col:0x6c7480, rou:.60, met:.80, env:true  },
    'steel-painted': { col:0x3a4a5a, rou:.75, met:.30, env:false },
    'aluminum':      { col:0xd0d4d8, rou:.22, met:.88, env:true  },
    'rebar-mat':     { col:0x505050, rou:.85, met:.55, env:true  },
    // Wood — high roughness, low metalness, warm tones
    'wood-pine':     { col:0xd4a855, rou:.92, met:.00, env:false },
    'wood-oak':      { col:0xb07830, rou:.90, met:.00, env:false },
    'wood-cedar':    { col:0xb06840, rou:.88, met:.00, env:false },
    'wood-treated':  { col:0x7a9055, rou:.93, met:.00, env:false },
    'plywood-mat':   { col:0xc8a050, rou:.94, met:.00, env:false },
    'mdf':           { col:0xbcac90, rou:.95, met:.00, env:false },
    // Custom
    'custom':        { col:0xe8e0d0, rou:.55, met:.02, env:false },
  };

  function makeMat(matKey, customHex) {
    const d = MATDEFS[matKey] || MATDEFS['pvc-white'];
    return new THREE.MeshStandardMaterial({
      color:      customHex ? new THREE.Color(customHex) : new THREE.Color(d.col),
      roughness:  d.rou,
      metalness:  d.met,
    });
  }

  // ── Real PVC OD sizes (inches) → converted to feet ──────────────────
  // Nominal : actual OD in inches (Schedule 40)
  const PVC_OD = { 0.5:0.840, 0.75:1.050, 1:1.315, 1.25:1.660, 1.5:1.900, 2:2.375, 3:3.500, 4:4.500 };
  // Wall thickness (Sch40) in inches
  const PVC_WALL = { 0.5:0.109, 0.75:0.113, 1:0.133, 1.25:0.140, 1.5:0.145, 2:0.154, 3:0.216, 4:0.237 };

  // Pipe radius in feet (outer) — used for cylinders
  function pipeOD(s) { return ((PVC_OD[s] || (0.84 + s * 0.6)) / 2) * IN; }

  // Real fitting length in inches for a given nominal size
  // Based on ASTM / standard socket depth + body
  function fittingLen(s) {
    // Approximate: fitting body ≈ 3×OD for elbows/tees, less for caps/couplers
    return (PVC_OD[s] || 1.3) * 2.8 * IN; // feet
  }

  // Socket depth in feet (how far pipe inserts)
  function socketDepth(s) {
    return ((PVC_OD[s] || 1) * 0.85) * IN;
  }

  // ── Build mesh ──────────────────────────────────────────────────────
  function buildMesh(tool, sizeInch, matKey, customHex, len) {
    const mat  = makeMat(matKey, customHex);
    const g    = new THREE.Group();
    const SEG  = 20;

    // helper builders (all add to group g)
    function cyl(r1,r2,h, rx,ry,rz, px,py,pz) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,SEG), mat.clone());
      m.rotation.set(rx,ry,rz); m.position.set(px,py,pz);
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    }
    function box(w,h,d, rx,ry,rz, px,py,pz) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat.clone());
      m.rotation.set(rx,ry,rz); m.position.set(px,py,pz);
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    }
    function sph(r, px,py,pz) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r,SEG,12), mat.clone());
      m.position.set(px,py,pz); m.castShadow = m.receiveShadow = true; g.add(m); return m;
    }
    function tor(R, tube, px,py,pz, rx,ry,rz, arc) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(R,tube,10,22,arc||Math.PI/2), mat.clone());
      m.position.set(px,py,pz); m.rotation.set(rx,ry,rz);
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    }

    const r  = pipeOD(sizeInch);        // pipe outer radius (ft)
    const fl = fittingLen(sizeInch);    // fitting length (ft)
    const sd = socketDepth(sizeInch);   // socket depth (ft)
    const rW = r * 1.22;                // fitting collar radius (slightly larger)

    // ── PIPES ───────────────────────────────────────────────────────
    if (tool === 'pipe-h') {
      cyl(r,r,len, 0,0,Math.PI/2, 0,0,0);
    }
    else if (tool === 'pipe-v') {
      cyl(r,r,len, 0,0,0, 0,0,0);
    }
    else if (tool === 'pipe-d') {
      cyl(r,r,len, 0,0,Math.PI/4, 0,0,0);
    }
    else if (tool === 'flex') {
      const segs = 16;
      const step = len / segs;
      for (let i = 0; i < segs; i++) {
        const y = -len/2 + step*i + step/2;
        const wave = Math.sin(i*1.1) * r * 1.6;
        cyl(r*1.0, r*1.0, step*1.08, wave*.12, 0, 0, wave, y, 0);
      }
      // end collars
      cyl(rW, rW, sd, 0,0,0, 0, -len/2+sd/2, 0);
      cyl(rW, rW, sd, 0,0,0, 0,  len/2-sd/2, 0);
    }
    else if (tool === 'conduit') {
      // Outer walls slightly thicker, with ribs
      cyl(r*1.1, r*1.1, len, 0,0,0, 0,0,0);
      const rCount = Math.max(2, Math.round(len * 2.5));
      for (let i = 0; i < rCount; i++) {
        const y = -len/2 + (len/(rCount-1)) * i;
        cyl(r*1.22, r*1.22, r*0.3, 0,0,0, 0,y,0);
      }
    }
    else if (tool === 'pipe-z') {
      const offs = len * 0.28;
      const vert = len * 0.44;
      cyl(r,r, vert, 0,0,0, 0,0,0);
      cyl(r,r, offs, 0,0,Math.PI/2, 0,  vert/2, 0);
      cyl(r,r, offs, 0,0,Math.PI/2, 0, -vert/2, 0);
      sph(rW, 0,  vert/2, 0);
      sph(rW, 0, -vert/2, 0);
    }

    // ── FITTINGS — dimensioned in real scale ─────────────────────────
    // All fittings use fl (fitting length), rW (collar radius), sd (socket depth)
    // The "arm" extends sd outward from center = socket where pipe inserts

    else if (tool === 'elbow-90') {
      // Real 90° elbow: torus quarter + two stubs
      const TR = fl * 0.38;   // torus major radius
      tor(TR, r, TR, 0, 0,  0, Math.PI/2, 0, 0);
      // stubs (sockets)
      cyl(r,r, sd, 0,0,0,  0, sd/2, 0);                   // up
      cyl(r,r, sd, 0,0,Math.PI/2, sd/2, 0, 0);             // right
      cyl(rW,rW, fl*0.08, 0,0,0,  0, sd, 0);               // collar ring up
      cyl(rW,rW, fl*0.08, 0,0,Math.PI/2, sd, 0, 0);        // collar ring right
    }
    else if (tool === 'elbow-45') {
      const a = Math.PI/8;
      cyl(r,r, fl*0.55, 0,0, -a/2, 0, fl*0.14, 0);
      cyl(r,r, fl*0.55, 0,0,  a/2, 0,-fl*0.14, 0);
      sph(rW, 0,0,0);
      cyl(rW,rW, fl*0.07, 0,0,-a/2, 0, fl*0.42, 0);
      cyl(rW,rW, fl*0.07, 0,0, a/2, 0,-fl*0.42, 0);
    }
    else if (tool === 'tee') {
      // Straight run + branch
      const arm = fl * 0.55;  // half-length of through run
      cyl(r,r, arm*2, 0,0,Math.PI/2, 0,0,0);               // through horizontal
      cyl(r,r, arm,   0,0,0, 0, arm/2+arm/6, 0);            // branch up
      sph(rW*1.05, 0,0,0);
      cyl(rW,rW, fl*0.08, 0,0,Math.PI/2, -arm, 0, 0);
      cyl(rW,rW, fl*0.08, 0,0,Math.PI/2,  arm, 0, 0);
      cyl(rW,rW, fl*0.08, 0,0,0, 0, arm, 0);
    }
    else if (tool === 'cross') {
      const arm = fl * 0.55;
      cyl(r,r, arm*2, 0,0,Math.PI/2, 0,0,0);
      cyl(r,r, arm*2, 0,0,0, 0,0,0);
      sph(rW*1.1, 0,0,0);
      [-arm, arm].forEach(p => {
        cyl(rW,rW, fl*0.08, 0,0,Math.PI/2, p, 0, 0);
        cyl(rW,rW, fl*0.08, 0,0,0, 0, p, 0);
      });
    }
    else if (tool === 'wye') {
      const arm = fl * 0.52;
      cyl(r,r, arm,   0,0,0, 0, arm/2, 0);                          // main up
      cyl(r,r, arm, 0,0, Math.PI*(5/6), -arm*0.44,-arm*0.26, 0);   // left leg
      cyl(r,r, arm, 0,0, Math.PI*(1/6),  arm*0.44,-arm*0.26, 0);   // right leg
      sph(rW, 0,0,0);
    }
    else if (tool === 'reducer') {
      const rBig = pipeOD(sizeInch) * 1.7;
      cyl(r,   r,    sd, 0,0,0, 0,  fl*0.3+sd/2, 0);
      cyl(rBig, rBig, sd, 0,0,0, 0, -fl*0.3-sd/2, 0);
      cyl(rBig, r, fl*0.6, 0,0,0, 0, 0, 0);   // taper body
    }
    else if (tool === 'coupler') {
      // Short coupling sleeve
      const clen = fl * 0.55;
      cyl(r,r, clen*0.4, 0,0,0, 0,  clen*0.35, 0);
      cyl(r,r, clen*0.4, 0,0,0, 0, -clen*0.35, 0);
      cyl(rW, rW, clen,  0,0,0, 0, 0, 0);
      // hex nut center
      const hexGeo = new THREE.CylinderGeometry(rW*1.12, rW*1.12, clen*0.18, 6);
      const hm = new THREE.Mesh(hexGeo, mat.clone()); hm.castShadow=true; g.add(hm);
    }
    else if (tool === 'cap') {
      const clen = fl * 0.65;
      cyl(r, r, clen*0.4, 0,0,0, 0, -clen*0.3, 0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r*1.05, SEG, 10, 0, Math.PI*2, 0, Math.PI/2), mat.clone());
      dome.castShadow = dome.receiveShadow = true; g.add(dome);
      cyl(rW, rW, fl*0.07, 0,0,0, 0, -fl*0.01, 0);
    }
    else if (tool === 'union') {
      cyl(r,r, sd, 0,0,0, 0,  fl*0.38, 0);
      cyl(r,r, sd, 0,0,0, 0, -fl*0.38, 0);
      cyl(rW, rW, fl*0.22, 0,0,0, 0,  fl*0.08, 0);
      cyl(rW*0.95, rW*0.95, fl*0.22, 0,0,0, 0, -fl*0.08, 0);
      const hexG = new THREE.CylinderGeometry(rW*1.1, rW*1.1, fl*0.1, 6);
      const hm = new THREE.Mesh(hexG, mat.clone()); hm.castShadow=true; g.add(hm);
    }
    else if (tool === 'valve') {
      cyl(r,r, sd, 0,0,0, 0,  fl*0.38, 0);
      cyl(r,r, sd, 0,0,0, 0, -fl*0.38, 0);
      cyl(rW,rW, fl*0.3, 0,0,0, 0,0,0);
      // stem
      cyl(r*0.4, r*0.4, fl*0.55, 0,0,Math.PI/2, 0,0,0);
      // handle
      cyl(r*0.18, r*0.18, fl*0.6, 0,0,0, 0, rW*2.2, 0);
      // handle cross bar
      const hb = cyl(r*0.15, r*0.15, fl*0.28, 0,0,Math.PI/2, 0,0,0);
      hb.position.y = rW*2.2;
      cyl(rW,rW, fl*0.07, 0,0,0, 0,  fl*0.16, 0);
      cyl(rW,rW, fl*0.07, 0,0,0, 0, -fl*0.16, 0);
    }
    else if (tool === 'flange') {
      const fr = r * 3.8;
      cyl(r,r, sd, 0,0,0, 0, fl*0.28+sd/2, 0);
      cyl(rW,rW, fl*0.14, 0,0,0, 0, fl*0.14, 0);
      cyl(fr, fr, fl*0.14, 0,0,0, 0, 0, 0);
      // bolt holes × 4
      for (let i=0;i<4;i++) {
        const a = (i/4)*Math.PI*2;
        cyl(r*0.18,r*0.18, fl*0.18, 0,0,0, Math.cos(a)*fr*0.72,0, Math.sin(a)*fr*0.72);
      }
    }
    else if (tool === 'bushing') {
      const rBig = r*1.65, rSm = r;
      cyl(rBig, rBig, fl*0.22, 0,0,0, 0, -fl*0.11, 0);
      cyl(rBig, rSm,  fl*0.28, 0,0,0, 0,  fl*0.03, 0);
      cyl(rSm,  rSm,  fl*0.22, 0,0,0, 0,  fl*0.28, 0);
    }

    // ── WOOD MEMBERS ─────────────────────────────────────────────────
    // Standard lumber nominal vs actual (in feet):
    //   2×4 → 1.5" × 3.5"    2×6 → 1.5" × 5.5"    4×4 → 3.5" × 3.5"
    else if (tool === 'wood-2x4') {
      const w = 1.5*IN, h = 3.5*IN;
      box(h, len, w, 0,0,0, 0,0,0);
    }
    else if (tool === 'wood-2x6') {
      const w = 1.5*IN, h = 5.5*IN;
      box(h, len, w, 0,0,0, 0,0,0);
    }
    else if (tool === 'wood-4x4') {
      const s = 3.5*IN;
      box(s, len, s, 0,0,0, 0,0,0);
    }
    // ── SHEET GOODS ─────────────────────────────────────────────────
    // Plywood / OSB: 4×8 sheet, 3/4" thick
    else if (tool === 'plywood') {
      const W = len, H = 4, T = 0.75*IN;
      box(W, T, H, 0,0,0, 0,0,0);    // laid flat (horizontal sheet)
    }
    else if (tool === 'osb') {
      const W = len, H = 4, T = 0.625*IN;
      const m2 = makeMat(matKey, customHex);
      m2.roughness = 0.98;
      const bm = new THREE.Mesh(new THREE.BoxGeometry(W, T, H), m2);
      bm.castShadow = bm.receiveShadow = true; g.add(bm);
    }
    // ── STEEL STRUCTURAL ────────────────────────────────────────────
    // All use nominal inch sizes scaled by sizeInch relative to ½" base
    // Base sizes at ½" = smallest stock; scale factor per sizeInch
    else if (tool === 'steel-tube-sq') {
      // Square HSS: outer side = ~2.5" at size=1, wall = 0.12"
      const side   = (1.5 + sizeInch * 0.8) * IN;
      const wall   = (0.095 + sizeInch * 0.025) * IN;
      // Build as filled box (for simplicity in 3D)
      box(side, len, side, 0,0,0, 0,0,0);
    }
    else if (tool === 'steel-tube-rnd') {
      // Round HSS — just a cylinder with slightly thicker wall look
      const od = pipeOD(sizeInch) * 1.35;
      cyl(od, od, len, 0,0,0, 0,0,0);
    }
    else if (tool === 'steel-angle') {
      // Angle iron: two plates at 90°
      const leg = (1.5 + sizeInch * 0.5) * IN;
      const t   = (0.125 + sizeInch * 0.04) * IN;
      box(t,   len, leg,  0,0,0,  -leg/2, 0, 0);    // vertical flange
      box(leg-t, len, t,  0,0,0,  0,      0, leg/2); // horizontal flange
    }
    else if (tool === 'steel-channel') {
      // C-channel: web + 2 flanges
      const web  = (2 + sizeInch * 0.6) * IN;
      const fl2  = (0.9 + sizeInch * 0.2) * IN;
      const t    = (0.12 + sizeInch * 0.03) * IN;
      box(t,    len, web, 0,0,0, 0,0,0);                // web
      box(fl2,  len, t,   0,0,0, (fl2-t)/2,  0, web/2-t/2);   // top flange
      box(fl2,  len, t,   0,0,0, (fl2-t)/2,  0,-web/2+t/2);   // bottom flange
    }
    else if (tool === 'steel-ibeam') {
      // Wide-flange I-beam (W-shape)
      const bf = (4 + sizeInch * 1.5) * IN;    // flange width
      const d  = (6 + sizeInch * 2.0) * IN;    // depth (height)
      const tf = (0.2 + sizeInch * 0.04) * IN;  // flange thickness
      const tw = (0.15 + sizeInch * 0.03) * IN; // web thickness
      box(bf, len, tf, 0,0,0, 0, 0,  (d-tf)/2);   // top flange
      box(bf, len, tf, 0,0,0, 0, 0, -(d-tf)/2);   // bottom flange
      box(tw, len, d-2*tf, 0,0,0, 0, 0, 0);        // web
    }
    else if (tool === 'steel-sheet') {
      // Steel sheet: 4×8 panel, gauge thickness
      const gauge = (0.06 + sizeInch * 0.025) * IN;  // ~18ga–10ga
      const W = len, H = 4;
      box(W, gauge, H, 0,0,0, 0,0,0);
    }
    else if (tool === 'rebar') {
      const rd = (0.375 + sizeInch * 0.15) * IN;  // #3 to #8 rebar diameter
      cyl(rd, rd, len, 0,0,0, 0,0,0);
      // deformation bumps
      const bumps = Math.floor(len * 5);
      for (let i=0; i<bumps; i++) {
        const y = -len/2 + (len/bumps)*(i+0.5);
        cyl(rd*1.25, rd*1.25, rd*0.3, 0,Math.PI*(i%4)/4,0, 0,y,0);
      }
    }
    else {
      // generic fallback
      cyl(r, r, len, 0,0,0, 0,0,0);
    }

    g.userData = { tool, sizeInch, matKey, customHex: customHex||null, len };
    return g;
  }

  // ── State ────────────────────────────────────────────────────────────
  let currentTool   = 'pipe-h';
  let currentSize   = 0.5;
  let currentMat    = 'pvc-white';
  let currentCustom = null;
  let currentLen    = 8;
  let rotSnapDeg    = 0;
  let snapEnabled   = true;
  let endSnap       = true;
  let showEPs       = true;
  let ghostElev     = 0;          // current placement Y
  let ghostPos      = new THREE.Vector3(); // last known ghost XZ
  let pieces        = [];
  let selected      = null;
  let ghost         = null;
  let ghostRot      = new THREE.Euler(0,0,0,'XYZ');

  // ── Undo / redo ──────────────────────────────────────────────────────
  const undoStack = [], redoStack = [];
  function snap2state() {
    return JSON.stringify(pieces.map(p => ({
      ...p.userData,
      pos: p.position.toArray(),
      rot: [p.rotation.x, p.rotation.y, p.rotation.z],
    })));
  }
  function saveUndo() {
    undoStack.push(snap2state());
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }
  function applyState(json) {
    pieces.forEach(p => scene.remove(p));
    pieces = [];
    selected = null;
    updateSelUI();
    JSON.parse(json).forEach(d => {
      const p = buildMesh(d.tool, d.sizeInch, d.matKey||'pvc-white', d.customHex||null, d.len);
      p.position.fromArray(d.pos);
      p.rotation.set(...d.rot);
      scene.add(p); pieces.push(p);
    });
    refreshEPs(); updateStats();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snap2state()); applyState(undoStack.pop()); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap2state()); applyState(redoStack.pop()); }

  // ── Resize ────────────────────────────────────────────────────────────
  function resize() {
    renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  // ── Orbit ──────────────────────────────────────────────────────────────
  let orb = { on:false, btn:-1, prev:{x:0,y:0} };
  let sph = { th: 0.55, ph: 0.72 };
  let camR = Math.sqrt(8*8+9*9+13*13);
  let camT = new THREE.Vector3(0,0,0);

  function applyOrbit() {
    sph.ph = Math.max(0.03, Math.min(Math.PI*0.49, sph.ph));
    camera.position.set(
      camT.x + camR*Math.sin(sph.ph)*Math.sin(sph.th),
      camT.y + camR*Math.cos(sph.ph),
      camT.z + camR*Math.sin(sph.ph)*Math.cos(sph.th)
    );
    camera.lookAt(camT);
  }
  applyOrbit();

  canvas.addEventListener('mousedown', e => {
    if (e.button===1||e.button===2) {
      orb.on=true; orb.btn=e.button; orb.prev={x:e.clientX,y:e.clientY}; e.preventDefault();
    }
  });
  window.addEventListener('mousemove', e => {
    if (!orb.on) return;
    const dx=e.clientX-orb.prev.x, dy=e.clientY-orb.prev.y;
    orb.prev={x:e.clientX,y:e.clientY};
    if (orb.btn===2) { sph.th-=dx*.007; sph.ph-=dy*.007; applyOrbit(); }
    else if (orb.btn===1) {
      const sp=camR*.0012;
      const rt=new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()),camera.up).normalize();
      camT.addScaledVector(rt,-dx*sp).addScaledVector(camera.up,dy*sp);
      applyOrbit();
    }
  });
  window.addEventListener('mouseup', ()=>{ orb.on=false; });
  canvas.addEventListener('wheel', e=>{ camR=Math.max(1.5,Math.min(120,camR+e.deltaY*.018)); applyOrbit(); e.preventDefault(); },{passive:false});
  canvas.addEventListener('contextmenu', e=>e.preventDefault());

  // ── Camera presets ────────────────────────────────────────────────────
  function animCam(th,ph,rad) {
    const N=42,st=sph.th,sp=sph.ph,sr=camR;
    let i=0; clearInterval(animCam._t);
    animCam._t=setInterval(()=>{
      const t=Math.min(1,++i/N);
      sph.th=st+(th-st)*t; sph.ph=sp+(ph-sp)*t; camR=sr+(rad-sr)*t; applyOrbit();
      if(i>=N) clearInterval(animCam._t);
    },16);
  }
  [['btnReset3D','c3d'],[],[]].flat();
  document.getElementById('btnReset3D').onclick = document.getElementById('c3d').onclick = () => animCam(0.55,0.72,18);
  document.getElementById('btnTopV').onclick    = document.getElementById('cTop').onclick   = () => animCam(0,0.03,24);
  document.getElementById('btnFrontV').onclick  = document.getElementById('cFront').onclick = () => animCam(0,Math.PI*.38,18);
  document.getElementById('btnSideV').onclick   = () => animCam(Math.PI*.5,Math.PI*.38,18);

  // ── Raycasting ─────────────────────────────────────────────────────────
  const RC = new THREE.Raycaster();
  const elevPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const _hit = new THREE.Vector3();

  function getNDC(e) {
    const rc=canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1);
  }
  function getElevPoint(e) {
    elevPlane.constant = -ghostElev;
    RC.setFromCamera(getNDC(e), camera);
    RC.ray.intersectPlane(elevPlane, _hit);
    return _hit.clone();
  }
  function snapGrid(v) {
    if (!snapEnabled) return v;
    return new THREE.Vector3(Math.round(v.x*2)/2, v.y, Math.round(v.z*2)/2);  // 0.5 ft grid
  }

  // ── Endpoint snap ────────────────────────────────────────────────────
  const SNAP_D = 0.65;
  function getEndpoints(piece) {
    const d = piece.userData, pts = [];
    const FITTINGS = ['elbow-90','elbow-45','tee','cross','wye','reducer','coupler','cap','union','valve','flange','bushing'];
    const fl = fittingLen(d.sizeInch || 0.5);
    const sd = socketDepth(d.sizeInch || 0.5);

    if (['pipe-h','pipe-v','pipe-d','flex','conduit','pipe-z','wood-2x4','wood-2x6','wood-4x4','rebar','steel-tube-sq','steel-tube-rnd'].includes(d.tool)) {
      [new THREE.Vector3(0,-d.len/2,0), new THREE.Vector3(0,d.len/2,0)].forEach(lp=>{
        pts.push(lp.clone().applyMatrix4(piece.matrixWorld));
      });
    } else if (d.tool==='elbow-90') {
      [new THREE.Vector3(0, sd, 0), new THREE.Vector3(sd, 0, 0)].forEach(lp=>{
        pts.push(lp.clone().applyMatrix4(piece.matrixWorld));
      });
    } else if (d.tool==='tee') {
      const arm = fl*0.55;
      [new THREE.Vector3(-arm,0,0), new THREE.Vector3(arm,0,0), new THREE.Vector3(0,arm,0)].forEach(lp=>{
        pts.push(lp.clone().applyMatrix4(piece.matrixWorld));
      });
    } else if (d.tool==='cross') {
      const arm = fl*0.55;
      [new THREE.Vector3(-arm,0,0),new THREE.Vector3(arm,0,0),new THREE.Vector3(0,-arm,0),new THREE.Vector3(0,arm,0)].forEach(lp=>{
        pts.push(lp.clone().applyMatrix4(piece.matrixWorld));
      });
    } else {
      [new THREE.Vector3(0,-fl*0.5,0), new THREE.Vector3(0,fl*0.5,0)].forEach(lp=>{
        pts.push(lp.clone().applyMatrix4(piece.matrixWorld));
      });
    }
    return pts;
  }

  function nearestEP(worldPt, excludePiece) {
    let best=null, bd=SNAP_D;
    pieces.forEach(p=>{
      if(p===excludePiece) return;
      getEndpoints(p).forEach(ep=>{
        const d=worldPt.distanceTo(ep);
        if(d<bd){bd=d; best=ep.clone();}
      });
    });
    return best;
  }

  // ── Ghost ──────────────────────────────────────────────────────────────
  function buildGhost() {
    if (ghost) scene.remove(ghost);
    ghost = buildMesh(currentTool, currentSize, currentMat, currentCustom, currentLen);
    ghost.rotation.copy(ghostRot);
    ghost.traverse(m=>{
      if(m.isMesh){
        m.material.transparent=true; m.material.opacity=0.42;
        m.material.emissive=new THREE.Color(0x00e5ff);
        m.material.emissiveIntensity=0.5;
        m.castShadow=false;
      }
    });
    ghost.userData.isGhost=true;
    ghost.position.copy(ghostPos);
    ghost.position.y = ghostElev;
    scene.add(ghost);
  }
  buildGhost();

  // ── Snap dot el ───────────────────────────────────────────────────────
  const snapDot = document.getElementById('snap-dot');

  function updateGhostPos(worldPt) {
    let p = snapGrid(worldPt);
    let snapped = false;
    if (endSnap && pieces.length) {
      const ep = nearestEP(worldPt, null);
      if (ep) { p = ep.clone(); snapped = true; }
    }
    ghostPos.copy(p);
    if (ghost) { ghost.position.copy(p); ghost.position.y = ghostElev; }

    // update elevation plane
    elevPlaneMesh.position.y = ghostElev;
    elevPlaneMesh.visible = ghostElev > 0.01;

    // show snap dot
    if (snapped) {
      const proj = p.clone(); proj.y = ghostElev;
      const sp = proj.project(camera);
      const rc = canvas.getBoundingClientRect();
      snapDot.style.left = ((sp.x*.5+.5)*rc.width+rc.left)+'px';
      snapDot.style.top  = ((-sp.y*.5+.5)*rc.height+rc.top)+'px';
      snapDot.classList.remove('hidden');
    } else {
      snapDot.classList.add('hidden');
    }
  }

  canvas.addEventListener('mousemove', e => {
    if (orb.on) return;
    const p = getElevPoint(e);
    if (!p||isNaN(p.x)) return;
    updateGhostPos(p);
  });

  // ── Place piece ──────────────────────────────────────────────────────
  function placePiece() {
    saveUndo();
    const piece = buildMesh(currentTool, currentSize, currentMat, currentCustom, currentLen);
    piece.position.copy(ghostPos);
    piece.position.y = ghostElev;
    piece.rotation.copy(ghostRot);
    scene.add(piece);
    pieces.push(piece);
    refreshEPs();
    updateStats();
    selectPiece(piece);
  }

  canvas.addEventListener('click', e => {
    if (orb.on) return;
    // Check if clicking existing piece → select
    RC.setFromCamera(getNDC(e), camera);
    const ms=[];
    pieces.forEach(p=>p.traverse(m=>{ if(m.isMesh) ms.push(m); }));
    const hits=RC.intersectObjects(ms,false);
    if (hits.length) {
      let root=hits[0].object;
      while(root.parent&&root.parent!==scene) root=root.parent;
      if(!root.userData.isGhost){ selectPiece(root); return; }
    }
    placePiece();
  });

  // ── Elevation control ─────────────────────────────────────────────────
  const elevValEl  = document.getElementById('elevVal');
  const topElevEl  = document.getElementById('topElev');

  function setElev(v) {
    ghostElev = Math.max(0, Math.round(v * 4) / 4);  // 0.25 ft steps
    elevValEl.textContent  = ghostElev.toFixed(2);
    topElevEl.textContent  = ghostElev.toFixed(2);
    if (ghost) ghost.position.y = ghostElev;
    elevPlaneMesh.position.y = ghostElev;
    elevPlaneMesh.visible = ghostElev > 0.01;
  }

  document.getElementById('elevUp').onclick   = () => setElev(ghostElev + 0.5);
  document.getElementById('elevDown').onclick = () => setElev(ghostElev - 0.5);
  document.getElementById('elevReset').onclick = () => setElev(0);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  const keysDown = {};
  window.addEventListener('keydown', e => {
    keysDown[e.key] = true;
    const inp = document.activeElement.tagName;
    if (inp==='INPUT'||inp==='TEXTAREA') return;

    const step = e.shiftKey ? 2 : 0.5;

    // Arrow keys: elevation and ghost movement
    if (e.key==='ArrowUp')   { e.preventDefault(); setElev(ghostElev + step); }
    if (e.key==='ArrowDown') { e.preventDefault(); setElev(ghostElev - step); }
    if (e.key==='ArrowLeft') { e.preventDefault(); ghostPos.x -= step; if(ghost) ghost.position.x = ghostPos.x; }
    if (e.key==='ArrowRight'){ e.preventDefault(); ghostPos.x += step; if(ghost) ghost.position.x = ghostPos.x; }
    if (e.key==='w'||e.key==='W') { e.preventDefault(); ghostPos.z -= step; if(ghost) ghost.position.z = ghostPos.z; }
    if (e.key==='s'||e.key==='S') { e.preventDefault(); ghostPos.z += step; if(ghost) ghost.position.z = ghostPos.z; }

    if (e.key==='0') setElev(0);
    if (e.key===' ') { e.preventDefault(); placePiece(); }

    // Rotation keys — act on selected if exists, else rotate ghost
    const rAmt = (rotSnapDeg > 0 ? rotSnapDeg : 45) * (Math.PI/180);
    function rotGhostOrSel(axis, dir) {
      const target = selected || null;
      const eu = target ? target.rotation : ghostRot;
      if (axis==='y') eu.y += rAmt * dir;
      if (axis==='x') eu.x += rAmt * dir;
      if (axis==='z') eu.z += rAmt * dir;
      if (target) refreshEPs();
      if (!target && ghost) ghost.rotation.copy(ghostRot);
    }
    if (e.key==='q'||e.key==='Q') rotGhostOrSel('y',  1);
    if (e.key==='e'||e.key==='E') rotGhostOrSel('y', -1);
    if (e.key==='r'||e.key==='R') rotGhostOrSel('x',  1);
    if (e.key==='f'||e.key==='F') rotGhostOrSel('x', -1);
    if (e.key==='t'||e.key==='T') rotGhostOrSel('z',  1);
    if (e.key==='g'||e.key==='G') rotGhostOrSel('z', -1);

    // Preset orientations
    if (e.key==='1') { ghostRot.set(0,0,0); if(selected){saveUndo();selected.rotation.set(0,0,0);refreshEPs();} if(ghost) ghost.rotation.copy(ghostRot); }
    if (e.key==='2') { ghostRot.set(0,0,Math.PI/2); if(selected){saveUndo();selected.rotation.set(0,selected.rotation.y,Math.PI/2);refreshEPs();} if(ghost) ghost.rotation.copy(ghostRot); }
    if (e.key==='3') { ghostRot.set(Math.PI/2,0,0); if(selected){saveUndo();selected.rotation.set(Math.PI/2,selected.rotation.y,0);refreshEPs();} if(ghost) ghost.rotation.copy(ghostRot); }

    // Backspace = reset rotation
    if (e.key==='Backspace') {
      if(selected){saveUndo();selected.rotation.set(0,0,0);refreshEPs();}
      ghostRot.set(0,0,0); if(ghost) ghost.rotation.copy(ghostRot);
    }

    // Delete / Esc / Undo / Redo
    if (e.key==='Delete') deletePiece(selected);
    if (e.key==='Escape') deselect();
    if (e.key==='d'||e.key==='D') { if(selected) dupSelected(); }
    if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Z')) { e.preventDefault(); redo(); }

    // Home = reset camera
    if (e.key==='Home') animCam(0.55,0.72,18);
  });

  // ── Endpoints ──────────────────────────────────────────────────────────
  const epMat = new THREE.MeshBasicMaterial({color:0x00e5ff});
  const epGeo = new THREE.SphereGeometry(0.065,8,6);
  function refreshEPs() {
    while(epGroup.children.length) epGroup.remove(epGroup.children[0]);
    if (!showEPs) return;
    pieces.forEach(p=>{
      getEndpoints(p).forEach(ep=>{
        const d=new THREE.Mesh(epGeo,epMat);
        d.position.copy(ep);
        epGroup.add(d);
      });
    });
  }

  // ── Selection ──────────────────────────────────────────────────────────
  function selectPiece(p) {
    if(selected&&selected!==p) deselect();
    selected=p;
    selected.traverse(m=>{ if(m.isMesh){ m.material.emissive=new THREE.Color(0x00e5ff); m.material.emissiveIntensity=0.35; }});
    document.getElementById('gizmo').classList.remove('hidden');
    document.getElementById('sel-bar').classList.remove('hidden');
    updateSelUI();
  }
  function deselect() {
    if (!selected) return;
    selected.traverse(m=>{ if(m.isMesh){ m.material.emissive=new THREE.Color(0x000000); m.material.emissiveIntensity=0; }});
    selected=null;
    document.getElementById('gizmo').classList.add('hidden');
    document.getElementById('sel-bar').classList.add('hidden');
    updateSelUI();
  }
  function updateSelUI() {
    const f=document.getElementById('selFields'), em=document.getElementById('selEmpty');
    if (!selected) { f.classList.add('hidden'); em.classList.remove('hidden'); return; }
    f.classList.remove('hidden'); em.classList.add('hidden');
    const d=selected.userData;
    document.getElementById('s-type').textContent = d.tool;
    document.getElementById('s-mat').textContent  = d.matKey||'—';
    document.getElementById('s-size').textContent = d.sizeInch+'"';
    document.getElementById('s-len').textContent  = d.len+'ft';
    document.getElementById('posX').value = selected.position.x.toFixed(2);
    document.getElementById('posY').value = selected.position.y.toFixed(2);
    document.getElementById('posZ').value = selected.position.z.toFixed(2);
    document.getElementById('sel-text').textContent = `${d.tool} · ${d.sizeInch}" · ${d.matKey}`;
    switchTab('scene');
  }
  ['posX','posY','posZ'].forEach(id=>{
    document.getElementById(id).addEventListener('change',()=>{
      if(!selected) return; saveUndo();
      selected.position.set(
        parseFloat(document.getElementById('posX').value),
        parseFloat(document.getElementById('posY').value),
        parseFloat(document.getElementById('posZ').value)
      );
      refreshEPs();
    });
  });

  // ── Rotate selected ────────────────────────────────────────────────────
  function rotateSel(axis, deg) {
    if (!selected) return;
    saveUndo();
    const r = THREE.MathUtils.degToRad(deg);
    if(axis==='x') selected.rotation.x+=r;
    if(axis==='y') selected.rotation.y+=r;
    if(axis==='z') selected.rotation.z+=r;
    refreshEPs(); updateSelUI();
  }
  document.querySelectorAll('.gb').forEach(b=>b.addEventListener('click',()=>rotateSel(b.dataset.axis,45*parseFloat(b.dataset.dir))));
  document.querySelectorAll('.rq[data-axis]').forEach(b=>b.addEventListener('click',()=>rotateSel(b.dataset.axis,parseFloat(b.dataset.a))));
  document.getElementById('btnResetRot').onclick=()=>{ if(!selected) return; saveUndo(); selected.rotation.set(0,0,0); refreshEPs(); };

  // Sel-bar buttons  
  document.querySelector('#sel-bar .sb-acts').querySelectorAll('.sb-btn:not(.danger)').forEach((b,i)=>{
    b.addEventListener('click',()=>rotateSel(['y','x','z'][i],45));
  });
  document.getElementById('sbDel').onclick=()=>deletePiece(selected);

  // ── Delete / Duplicate ────────────────────────────────────────────────
  function deletePiece(p) {
    if(!p) return; saveUndo();
    scene.remove(p); pieces=pieces.filter(x=>x!==p);
    if(selected===p) deselect();
    refreshEPs(); updateStats();
  }
  function dupSelected() {
    if(!selected) return; saveUndo();
    const d=selected.userData;
    const dup=buildMesh(d.tool,d.sizeInch,d.matKey,d.customHex,d.len);
    dup.position.copy(selected.position).add(new THREE.Vector3(0.5,0,0.5));
    dup.rotation.copy(selected.rotation);
    scene.add(dup); pieces.push(dup); refreshEPs(); updateStats(); selectPiece(dup);
  }
  document.getElementById('btnDelSel').onclick=()=>deletePiece(selected);
  document.getElementById('btnDupSel').onclick=dupSelected;

  // ── Context menu ─────────────────────────────────────────────────────
  const ctxMenu=document.getElementById('ctx-menu');
  canvas.addEventListener('contextmenu',e=>{
    e.preventDefault();
    RC.setFromCamera(getNDC(e),camera);
    const ms=[]; pieces.forEach(p=>p.traverse(m=>{if(m.isMesh)ms.push(m);}));
    const hits=RC.intersectObjects(ms,false);
    if(hits.length){
      let r=hits[0].object; while(r.parent&&r.parent!==scene) r=r.parent;
      selectPiece(r);
      ctxMenu.style.left=e.clientX+'px'; ctxMenu.style.top=e.clientY+'px';
      ctxMenu.classList.remove('hidden');
    } else { ctxMenu.classList.add('hidden'); deselect(); }
  });
  document.addEventListener('mousedown',e=>{ if(!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden'); });
  document.getElementById('ciDup').onclick=()=>{ dupSelected(); ctxMenu.classList.add('hidden'); };
  document.getElementById('ciDel').onclick=()=>{ deletePiece(selected); ctxMenu.classList.add('hidden'); };
  document.getElementById('ciRX').onclick=()=>{ rotateSel('x',45); ctxMenu.classList.add('hidden'); };
  document.getElementById('ciRY').onclick=()=>{ rotateSel('y',45); ctxMenu.classList.add('hidden'); };
  document.getElementById('ciRZ').onclick=()=>{ rotateSel('z',45); ctxMenu.classList.add('hidden'); };
  document.getElementById('ciHoriz').onclick=()=>{
    if(!selected)return; saveUndo(); selected.rotation.set(0,selected.rotation.y,0); refreshEPs(); ctxMenu.classList.add('hidden');
  };
  document.getElementById('ciVert').onclick=()=>{
    if(!selected)return; saveUndo(); selected.rotation.set(0,selected.rotation.y,Math.PI/2); refreshEPs(); ctxMenu.classList.add('hidden');
  };
  document.getElementById('ciReset').onclick=()=>{
    if(!selected)return; saveUndo(); selected.rotation.set(0,0,0); refreshEPs(); ctxMenu.classList.add('hidden');
  };
  document.getElementById('ciToFloor').onclick=()=>{
    if(!selected)return; saveUndo(); selected.position.y=0; refreshEPs(); updateSelUI(); ctxMenu.classList.add('hidden');
  };

  // ── Tab switch ─────────────────────────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));
  }
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));

  // ── Build tab controls ─────────────────────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentTool=btn.dataset.tool;
      buildGhost();
      const lbl=btn.querySelector('span:last-child').textContent;
      document.getElementById('modeHint').textContent=`${lbl} — ↑↓ elevation · Q/E rotate · click to place`;
    });
  });
  document.querySelectorAll('.size-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); currentSize=parseFloat(btn.dataset.size); buildGhost();
    });
  });
  document.querySelectorAll('.snap-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.snap-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); rotSnapDeg=parseFloat(btn.dataset.rot);
    });
  });
  const lsEl=document.getElementById('lengthSlider'), lnEl=document.getElementById('lengthNum');
  function syncLen(v){ currentLen=parseFloat(v); lsEl.value=currentLen; lnEl.value=currentLen; buildGhost(); }
  lsEl.addEventListener('input',e=>syncLen(e.target.value));
  lnEl.addEventListener('change',e=>syncLen(e.target.value));

  // ── Materials ───────────────────────────────────────────────────────────
  document.querySelectorAll('.mat-item').forEach(item=>{
    item.addEventListener('click',()=>{
      document.querySelectorAll('.mat-item').forEach(m=>m.classList.remove('active'));
      item.classList.add('active'); currentMat=item.dataset.mat; currentCustom=null; buildGhost();
    });
  });
  document.getElementById('applyCustom').onclick=()=>{
    currentMat='custom'; currentCustom=document.getElementById('customColor').value;
    document.querySelectorAll('.mat-item').forEach(m=>m.classList.remove('active')); buildGhost();
  };

  // ── Display toggles ─────────────────────────────────────────────────────
  document.getElementById('tGrid').addEventListener('change',e=>{ gridHelper.visible=e.target.checked; subGrid.visible=e.target.checked; });
  document.getElementById('tSnap').addEventListener('change',e=>{ snapEnabled=e.target.checked; });
  document.getElementById('tEndSnap').addEventListener('change',e=>{ endSnap=e.target.checked; });
  document.getElementById('tEndDots').addEventListener('change',e=>{ showEPs=e.target.checked; refreshEPs(); });
  document.getElementById('tShadow').addEventListener('change',e=>{ renderer.shadowMap.enabled=e.target.checked; sun.castShadow=e.target.checked; });
  document.getElementById('tFog').addEventListener('change',e=>{ scene.fog=e.target.checked?new THREE.Fog(0x0b0d12,28,75):null; });
  document.getElementById('tWire').addEventListener('change',e=>{ pieces.forEach(p=>p.traverse(m=>{ if(m.isMesh) m.material.wireframe=e.target.checked; })); });

  // Undo / Redo buttons
  document.getElementById('tUndo').onclick=undo;
  document.getElementById('tRedo').onclick=redo;

  // ── Export / Import ──────────────────────────────────────────────────────
  document.getElementById('btnExport').onclick=()=>{
    const data=pieces.map(p=>({...p.userData,pos:p.position.toArray(),rot:[p.rotation.x,p.rotation.y,p.rotation.z]}));
    const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:'pipeforge-v3.json'}).click();
  };
  document.getElementById('btnImport').onclick=()=>document.getElementById('importFile').click();
  document.getElementById('importFile').addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f) return;
    const r2=new FileReader();
    r2.onload=ev=>{
      try {
        saveUndo();
        pieces.forEach(p=>scene.remove(p)); pieces=[]; deselect();
        JSON.parse(ev.target.result).forEach(d=>{
          const p=buildMesh(d.tool,d.sizeInch,d.matKey||'pvc-white',d.customHex||null,d.len);
          p.position.fromArray(d.pos); p.rotation.set(...d.rot);
          scene.add(p); pieces.push(p);
        });
        refreshEPs(); updateStats();
      } catch { alert('Invalid JSON file'); }
    };
    r2.readAsText(f); e.target.value='';
  });
  document.getElementById('btnClear').onclick=()=>{
    if(!confirm('Clear all?')) return;
    saveUndo(); pieces.forEach(p=>scene.remove(p)); pieces=[]; deselect(); refreshEPs(); updateStats();
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const FITTINGS_SET = new Set(['elbow-90','elbow-45','tee','cross','wye','reducer','coupler','cap','union','valve','flange','bushing']);
  function updateStats() {
    document.getElementById('stPieces').textContent = pieces.length;
    const pipes = pieces.filter(p=>!FITTINGS_SET.has(p.userData.tool));
    document.getElementById('stFeet').textContent = pipes.reduce((s,p)=>s+(p.userData.len||0),0).toFixed(1);
    document.getElementById('stFit').textContent  = pieces.filter(p=>FITTINGS_SET.has(p.userData.tool)).length;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

})();
