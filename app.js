// ── PVC Pipe Sketcher 3D ─────────────────────────────────────────────────────
// Three.js r128 — no imports needed, loaded via CDN

(function () {
  'use strict';

  // ── Scene Setup ──────────────────────────────────────────────────────────────
  const canvas = document.getElementById('three-canvas');
  const wrap   = document.getElementById('canvas-wrap');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0f1117);

  const scene  = new THREE.Scene();
  scene.fog    = new THREE.Fog(0x0f1117, 30, 80);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(8, 8, 12);
  camera.lookAt(0, 0, 0);

  // ── Lights ───────────────────────────────────────────────────────────────────
  const ambLight = new THREE.AmbientLight(0x8899bb, 0.6);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(10, 16, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 80;
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -20;
  dirLight.shadow.camera.right = dirLight.shadow.camera.top   = 20;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.25);
  fillLight.position.set(-8, 5, -5);
  scene.add(fillLight);

  // ── Grid ─────────────────────────────────────────────────────────────────────
  let gridHelper = new THREE.GridHelper(30, 30, 0x2a3348, 0x1a2234);
  scene.add(gridHelper);

  // Shadow ground plane
  const groundGeo  = new THREE.PlaneGeometry(60, 60);
  const groundMat  = new THREE.ShadowMaterial({ opacity: 0.18 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // ── State ─────────────────────────────────────────────────────────────────────
  let currentTool  = 'pipe-h';
  let currentSize  = 0.5;      // inches nominal — scaled to visual radius
  let currentColor = '#e8e0d0';
  let currentLen   = 3;        // feet units
  let pieces       = [];
  let selected     = null;
  let snapEnabled  = true;
  let shadowEnabled = true;

  // ── Resize ───────────────────────────────────────────────────────────────────
  function resize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Orbit Controls (manual — no import needed) ────────────────────────────────
  let orbitActive = false;
  let orbitButton = -1;
  let prevMouse   = { x: 0, y: 0 };
  let spherical   = { theta: Math.atan2(8, 12), phi: Math.atan2(Math.sqrt(64 + 144), 8) };
  let radius      = Math.sqrt(8*8 + 8*8 + 12*12);
  let target      = new THREE.Vector3(0, 0, 0);

  function applyOrbit() {
    spherical.phi = Math.max(0.05, Math.min(Math.PI * 0.49, spherical.phi));
    camera.position.x = target.x + radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = target.y + radius * Math.cos(spherical.phi);
    camera.position.z = target.z + radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(target);
  }
  applyOrbit();

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1 || e.button === 2) {
      orbitActive = true;
      orbitButton = e.button;
      prevMouse   = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', e => {
    if (!orbitActive) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    prevMouse = { x: e.clientX, y: e.clientY };
    if (orbitButton === 2) {
      spherical.theta -= dx * 0.007;
      spherical.phi   -= dy * 0.007;
      applyOrbit();
    } else if (orbitButton === 1) {
      // pan
      const panSpeed = radius * 0.001;
      const right = new THREE.Vector3();
      const up    = new THREE.Vector3();
      right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      up.copy(camera.up);
      target.addScaledVector(right, -dx * panSpeed);
      target.addScaledVector(up,     dy * panSpeed);
      applyOrbit();
    }
  });

  window.addEventListener('mouseup', () => { orbitActive = false; });

  canvas.addEventListener('wheel', e => {
    radius = Math.max(2, Math.min(80, radius + e.deltaY * 0.02));
    applyOrbit();
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ── Pipe Material Factory ─────────────────────────────────────────────────────
  function makeMat(hex, selected = false) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.45,
      metalness: 0.05,
      emissive: selected ? new THREE.Color(0x00d4ff) : new THREE.Color(0x000000),
      emissiveIntensity: selected ? 0.3 : 0,
    });
  }

  // ── Pipe Radius from nominal size ──────────────────────────────────────────────
  function pipeRadius(sizeInch) {
    // Visual radius roughly proportional to nominal size
    return 0.05 + sizeInch * 0.045;
  }

  // ── Build Pipe Mesh ────────────────────────────────────────────────────────────
  function buildPipeMesh(tool, sizeInch, color, len) {
    const r   = pipeRadius(sizeInch);
    const mat = makeMat(color);
    const group = new THREE.Group();

    if (tool === 'pipe-h' || tool === 'pipe-v' || tool === 'pipe-d') {
      const geo  = new THREE.CylinderGeometry(r, r, len, 16);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (tool === 'pipe-h') mesh.rotation.z = Math.PI / 2;
      if (tool === 'pipe-d') { mesh.rotation.z = Math.PI / 4; mesh.rotation.x = Math.PI / 6; }
      group.add(mesh);
    }

    else if (tool === 'elbow') {
      const tubeR = r;
      const arc = len * 0.4;
      // Two short cylinders at 90°
      const geoA = new THREE.CylinderGeometry(tubeR, tubeR, arc, 14);
      const geoB = new THREE.CylinderGeometry(tubeR, tubeR, arc, 14);
      const mA   = new THREE.Mesh(geoA, mat.clone());
      const mB   = new THREE.Mesh(geoB, mat.clone());
      mA.position.y = arc / 2;
      mB.position.x = arc / 2;
      mB.rotation.z = Math.PI / 2;
      // Corner sphere
      const sGeo = new THREE.SphereGeometry(tubeR * 1.15, 14, 10);
      const sM   = new THREE.Mesh(sGeo, mat.clone());
      [mA, mB, sM].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
    }

    else if (tool === 'tee') {
      const tubeR = r;
      const arm   = len * 0.45;
      const geoH  = new THREE.CylinderGeometry(tubeR, tubeR, arm * 2, 14);
      const geoV  = new THREE.CylinderGeometry(tubeR, tubeR, arm, 14);
      const mH    = new THREE.Mesh(geoH, mat.clone());
      const mV    = new THREE.Mesh(geoV, mat.clone());
      mH.rotation.z = Math.PI / 2;
      mV.position.y = arm / 2;
      const sGeo = new THREE.SphereGeometry(tubeR * 1.2, 14, 10);
      const sM   = new THREE.Mesh(sGeo, mat.clone());
      [mH, mV, sM].forEach(m => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
    }

    else if (tool === 'cross') {
      const tubeR = r;
      const arm   = len * 0.45;
      const axes  = [[0,1,0,0],[Math.PI/2,0,0,0],[0,0,1,Math.PI/2]];
      axes.forEach(([rx, ry, rz, extra]) => {
        const geo = new THREE.CylinderGeometry(tubeR, tubeR, arm * 2, 14);
        const m   = new THREE.Mesh(geo, mat.clone());
        m.rotation.set(rx, ry, rz + extra);
        m.castShadow = true; m.receiveShadow = true;
        group.add(m);
      });
      const sGeo = new THREE.SphereGeometry(tubeR * 1.3, 14, 10);
      const sM   = new THREE.Mesh(sGeo, mat.clone());
      sM.castShadow = true; group.add(sM);
    }

    else if (tool === 'cap') {
      const tubeR = r;
      const stubLen = len * 0.25;
      const geo  = new THREE.CylinderGeometry(tubeR, tubeR, stubLen, 14);
      const dome = new THREE.SphereGeometry(tubeR, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const m    = new THREE.Mesh(geo, mat.clone());
      const d    = new THREE.Mesh(dome, mat.clone());
      m.position.y = -stubLen / 2;
      d.position.y = 0;
      [m, d].forEach(x => { x.castShadow = true; x.receiveShadow = true; group.add(x); });
    }

    else if (tool === 'coupler') {
      const tubeR = r;
      const wr    = tubeR * 1.35;
      const collarGeo = new THREE.CylinderGeometry(wr, wr, len * 0.2, 16);
      const pipeL = new THREE.CylinderGeometry(tubeR, tubeR, len * 0.35, 14);
      const pipeR = new THREE.CylinderGeometry(tubeR, tubeR, len * 0.35, 14);
      const mc    = new THREE.Mesh(collarGeo, mat.clone());
      const ml    = new THREE.Mesh(pipeL, mat.clone());
      const mr    = new THREE.Mesh(pipeR, mat.clone());
      ml.position.y =  len * 0.275;
      mr.position.y = -len * 0.275;
      [mc, ml, mr].forEach(x => { x.castShadow = true; x.receiveShadow = true; group.add(x); });
    }

    group.userData = { tool, sizeInch, color, len };
    return group;
  }

  // ── Ghost preview mesh ────────────────────────────────────────────────────────
  let ghost = null;

  function updateGhost() {
    if (ghost) { scene.remove(ghost); ghost = null; }
    const g = buildPipeMesh(currentTool, currentSize, currentColor, currentLen);
    g.traverse(m => {
      if (m.isMesh) {
        m.material.transparent = true;
        m.material.opacity = 0.35;
        m.material.emissive = new THREE.Color(0x00d4ff);
        m.material.emissiveIntensity = 0.6;
        m.castShadow = false;
      }
    });
    g.userData.isGhost = true;
    ghost = g;
    scene.add(ghost);
  }
  updateGhost();

  // ── Raycaster & Placement Plane ───────────────────────────────────────────────
  const raycaster   = new THREE.Raycaster();
  const placePlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeTarget = new THREE.Vector3();

  function getPointerOnPlane(e) {
    const rect = canvas.getBoundingClientRect();
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
     -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(placePlane, planeTarget);
    return planeTarget.clone();
  }

  function snapPoint(v) {
    if (!snapEnabled) return v;
    return new THREE.Vector3(Math.round(v.x), v.y, Math.round(v.z));
  }

  // ── Mouse move → ghost follows pointer ───────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    if (e.button !== 0 && orbitActive) return;
    const pt = getPointerOnPlane(e);
    if (!pt || isNaN(pt.x)) return;
    const snap = snapPoint(pt);
    if (ghost) ghost.position.copy(snap);
  });

  // ── Click → place piece ───────────────────────────────────────────────────────
  canvas.addEventListener('click', e => {
    if (orbitActive) return;
    const rect = canvas.getBoundingClientRect();
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
     -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    // Try to pick existing piece
    const meshes = [];
    pieces.forEach(p => p.traverse(m => { if (m.isMesh) meshes.push(m); }));
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      // Select hit piece
      const hitObj = hits[0].object;
      let root = hitObj;
      while (root.parent && root.parent !== scene) root = root.parent;
      selectPiece(root);
      return;
    }
    // Place new piece
    const pt   = getPointerOnPlane(e);
    if (!pt || isNaN(pt.x)) return;
    const snap = snapPoint(pt);
    const piece = buildPipeMesh(currentTool, currentSize, currentColor, currentLen);
    piece.position.copy(snap);
    scene.add(piece);
    pieces.push(piece);
    updateStats();
    selectPiece(piece);
  });

  // ── Selection ────────────────────────────────────────────────────────────────
  function selectPiece(piece) {
    if (selected && selected !== piece) deselectAll();
    selected = piece;
    selected.traverse(m => {
      if (m.isMesh) {
        m.material.emissive    = new THREE.Color(0x00d4ff);
        m.material.emissiveIntensity = 0.4;
      }
    });
    document.getElementById('selection-info').classList.remove('hidden');
    const d = piece.userData;
    document.getElementById('selInfo').textContent =
      `${d.tool.toUpperCase()} · ${d.sizeInch}" · ${d.len}ft · ${d.color}`;
  }

  function deselectAll() {
    if (!selected) return;
    selected.traverse(m => {
      if (m.isMesh) {
        m.material.emissive    = new THREE.Color(0x000000);
        m.material.emissiveIntensity = 0;
      }
    });
    selected = null;
    document.getElementById('selection-info').classList.add('hidden');
  }

  // ── Context Menu ──────────────────────────────────────────────────────────────
  const ctxMenu = document.getElementById('context-menu');

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
     -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const meshes = [];
    pieces.forEach(p => p.traverse(m => { if (m.isMesh) meshes.push(m); }));
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      let root = hits[0].object;
      while (root.parent && root.parent !== scene) root = root.parent;
      selectPiece(root);
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top  = e.clientY + 'px';
      ctxMenu.classList.remove('hidden');
    } else {
      ctxMenu.classList.add('hidden');
      deselectAll();
    }
  });

  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden');
  });

  document.getElementById('ctxDelete').addEventListener('click', () => { deletePiece(selected); ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxDuplicate').addEventListener('click', () => {
    if (!selected) return;
    const d = selected.userData;
    const dup = buildPipeMesh(d.tool, d.sizeInch, d.color, d.len);
    dup.position.copy(selected.position).addScalar(0.5);
    dup.rotation.copy(selected.rotation);
    scene.add(dup);
    pieces.push(dup);
    updateStats();
    selectPiece(dup);
    ctxMenu.classList.add('hidden');
  });

  const ROT = Math.PI / 4;
  document.getElementById('ctxRotateX').addEventListener('click', () => { if (selected) selected.rotation.x += ROT; ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxRotateY').addEventListener('click', () => { if (selected) selected.rotation.y += ROT; ctxMenu.classList.add('hidden'); });
  document.getElementById('ctxRotateZ').addEventListener('click', () => { if (selected) selected.rotation.z += ROT; ctxMenu.classList.add('hidden'); });

  // ── Delete / Clear ────────────────────────────────────────────────────────────
  function deletePiece(piece) {
    if (!piece) return;
    scene.remove(piece);
    pieces = pieces.filter(p => p !== piece);
    if (selected === piece) deselectAll();
    updateStats();
  }

  document.getElementById('btnClearSelected').addEventListener('click', () => deletePiece(selected));
  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (!confirm('Clear all pieces?')) return;
    pieces.forEach(p => scene.remove(p));
    pieces = [];
    deselectAll();
    updateStats();
  });

  // Delete key shortcut
  window.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) deletePiece(selected);
    if (e.key === 'Escape') deselectAll();
  });

  // ── Export / Import ───────────────────────────────────────────────────────────
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = pieces.map(p => ({
      ...p.userData,
      pos: p.position.toArray(),
      rot: [p.rotation.x, p.rotation.y, p.rotation.z],
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pvc-sketch.json' });
    a.click();
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        pieces.forEach(p => scene.remove(p));
        pieces = [];
        data.forEach(d => {
          const p = buildPipeMesh(d.tool, d.sizeInch, d.color, d.len);
          p.position.fromArray(d.pos);
          p.rotation.set(...d.rot);
          scene.add(p);
          pieces.push(p);
        });
        updateStats();
      } catch { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ── Camera presets ────────────────────────────────────────────────────────────
  function animateCam(theta, phi, r) {
    const steps = 40;
    let i = 0;
    const startT = spherical.theta, startP = spherical.phi, startR = radius;
    const t = setInterval(() => {
      const p = (++i) / steps;
      spherical.theta = startT + (theta - startT) * p;
      spherical.phi   = startP + (phi   - startP) * p;
      radius          = startR + (r     - startR) * p;
      applyOrbit();
      if (i >= steps) clearInterval(t);
    }, 16);
  }

  document.getElementById('btnResetCam').addEventListener('click', () => { target.set(0,0,0); animateCam(Math.PI*0.3, Math.PI*0.35, 16); });
  document.getElementById('btnTopView').addEventListener('click',   () => animateCam(0, 0.01, 20));
  document.getElementById('btnFrontView').addEventListener('click', () => animateCam(0, Math.PI*0.4, 16));

  // ── UI Controls ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
      updateGhost();
      document.getElementById('modeHint').textContent = `Tool: ${btn.title} — click canvas to place`;
    });
  });

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize = parseFloat(btn.dataset.size);
      updateGhost();
    });
  });

  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      currentColor = sw.dataset.color;
      updateGhost();
    });
  });

  const lengthSlider = document.getElementById('lengthSlider');
  const lengthVal    = document.getElementById('lengthVal');
  lengthSlider.addEventListener('input', () => {
    currentLen = parseFloat(lengthSlider.value);
    lengthVal.textContent = currentLen.toFixed(1) + ' ft';
    updateGhost();
  });

  document.getElementById('toggleGrid').addEventListener('change', e => {
    gridHelper.visible = e.target.checked;
  });

  document.getElementById('toggleSnap').addEventListener('change', e => {
    snapEnabled = e.target.checked;
  });

  document.getElementById('toggleShadow').addEventListener('change', e => {
    shadowEnabled = e.target.checked;
    renderer.shadowMap.enabled = e.target.checked;
    dirLight.castShadow = e.target.checked;
    pieces.forEach(p => p.traverse(m => {
      if (m.isMesh) { m.castShadow = e.target.checked; m.receiveShadow = e.target.checked; }
    }));
  });

  // ── Stats ─────────────────────────────────────────────────────────────────────
  function updateStats() {
    document.getElementById('statPieces').textContent = pieces.length;
    const totalFt = pieces.reduce((s, p) => s + (p.userData.len || 0), 0);
    document.getElementById('statFeet').textContent = totalFt.toFixed(1);
  }

  // ── Render Loop ───────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

})();
