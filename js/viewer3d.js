/* ============================================================
   LifeCity ARQ · viewer3d.js — Visor 3D (Three.js)
   Genera la geometría 3D desde el MISMO modelo 2D, federando
   TODAS las disciplinas del proyecto: arquitectura (muros, suelo,
   cielo, cubierta, gabinetes, puertas/ventanas), eléctrico (tomas,
   luminarias, tablero + circuitos), hidrosanitario y gas (aparatos
   + tuberías por diámetro).
   Coordenadas 2D en cm; en 3D: X=x, Z=y2d, Y=altura.
   ============================================================ */
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import Store from './store.js';
import { TYPES } from './palettes.js';
import { diaColor } from './hydro/diameters.js';

const DISCS = ['arquitectura', 'estructura', 'hidrosanitario', 'gas', 'electrico'];
// alturas de montaje (cm)
const H = { wall: 250, ceiling: 245, toma: 30, tablero: 140, lum: 244, pipe: -8, cabBajoTop: 90, cabAltoBase: 150, cabAltoTop: 210 };

export function open3D(slug, proj) {
  const ov = document.createElement('div');
  ov.className = 'v3d-overlay';
  ov.innerHTML = `<div class="v3d-bar">
      <b>🧊 Modelo 3D · ${proj.name}</b>
      <span class="v3d-hint">Arrastra = orbitar · rueda = zoom · clic derecho = desplazar</span>
      <span style="flex:1"></span>
      <button class="btn sm" id="v3d-fit">Encuadrar</button>
      <button class="btn sm" id="v3d-close">✕ Cerrar</button>
    </div>
    <div class="v3d-legend" id="v3d-legend"></div>
    <div class="v3d-canvas" id="v3d-canvas"></div>`;
  document.body.appendChild(ov);
  const host = ov.querySelector('#v3d-canvas');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f16);
  const W = host.clientWidth, Hh = host.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, W / Hh, 1, 100000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(W, Hh);
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // luces
  scene.add(new THREE.AmbientLight(0x9fb0c8, 0.7));
  const sun = new THREE.DirectionalLight(0xffe9c0, 0.9); sun.position.set(400, 800, 300); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6080ff, 0.35); fill.position.set(-300, 400, -400); scene.add(fill);

  // construir modelo federado
  const bbox = new THREE.Box3();
  const used = new Set();
  for (const disc of DISCS) {
    const d = Store.discipline(disc);
    const s = Store.getScene(slug, disc);
    if (buildDiscipline(scene, s, d, bbox)) used.add(disc);
  }
  // piso de referencia (grid)
  const size = Math.max(1200, bbox.getSize(new THREE.Vector3()).length() || 1200);
  const grid = new THREE.GridHelper(size * 1.5, Math.round(size * 1.5 / 100), 0x1b2636, 0x141c28);
  grid.position.y = 0; scene.add(grid);

  // leyenda de disciplinas presentes
  ov.querySelector('#v3d-legend').innerHTML = [...used].map(id => {
    const d = Store.discipline(id);
    return `<span><i style="background:${d.color}"></i>${d.name}</span>`;
  }).join('') || '<span>(modelo vacío — dibuja en 2D primero)</span>';

  function fit() {
    if (bbox.isEmpty()) { camera.position.set(600, 700, 900); controls.target.set(0, 100, 0); controls.update(); return; }
    const c = bbox.getCenter(new THREE.Vector3());
    const r = bbox.getSize(new THREE.Vector3()).length() * 0.75 + 300;
    camera.position.set(c.x + r, c.y + r * 0.9, c.z + r);
    controls.target.copy(c); controls.update();
  }
  fit();

  let alive = true;
  function loop() { if (!alive) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
  loop();

  function onResize() {
    const w = host.clientWidth, h = host.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  function close() {
    alive = false; window.removeEventListener('resize', onResize);
    renderer.dispose(); ov.remove();
  }
  ov.querySelector('#v3d-close').addEventListener('click', close);
  ov.querySelector('#v3d-fit').addEventListener('click', fit);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ---------- construcción por disciplina ---------- */
function buildDiscipline(scene, s, d, bbox) {
  let any = false;
  const col = new THREE.Color(d.color);
  const panelIndex = {}; // id tablero -> posición (para circuitos)

  for (const el of s.elements) {
    const t = TYPES[el.type] || {};
    const geom = el.geom || 'point';
    let obj = null;
    if (geom === 'segment' && t.wall) obj = wallMesh(el, t, col);
    else if (geom === 'segment' && t.cabinet) obj = cabinetMesh(el, t, col);
    else if (geom === 'polygon' && t.roof) obj = polyMesh(el.pts, H.wall + 60, col, 0.25, true);
    else if (geom === 'polygon' && t.ceiling) obj = polyMesh(el.pts, H.ceiling, col, 0.10);
    else if (geom === 'polygon') obj = polyMesh(el.pts, 2, col, 0.18);       // suelo
    else obj = fixtureMesh(el, t, col);                                       // punto / anclado
    if (obj) { scene.add(obj); expand(bbox, obj); any = true; }
    if (t.panel) panelIndex[el.id] = el;
  }

  // circuitos eléctricos (líneas 3D)
  for (const c of (s.circuits || [])) {
    const panel = s.elements.find(e => e.id === c.panelId);
    if (!panel) continue;
    const hEl = c.kind === 'iluminacion' ? H.lum : H.toma;
    const pts = [v3(panel.x, panel.y, H.tablero)];
    for (const id of c.elementIds) { const e = s.elements.find(x => x.id === id); if (e) pts.push(v3(e.x, e.y, hEl)); }
    if (pts.length > 1) { const ln = lineOf(pts, c.kind === 'iluminacion' ? 0x9c6bff : 0xf4b942); scene.add(ln); any = true; }
  }

  // rutas hidro/gas (tubería por diámetro)
  const net = (s.routes || [])[0];
  if (net && net.edges) {
    for (const e of net.edges) {
      const ln = lineOf([v3(e.a[0], e.a[1], H.pipe), v3(e.b[0], e.b[1], H.pipe)], new THREE.Color(diaColor(e.dia.mm)).getHex(), 1 + e.dia.mm / 30);
      scene.add(ln); any = true;
    }
  }
  return any;
}

/* ---------- helpers geométricos ---------- */
function v3(x, y2d, h) { return new THREE.Vector3(x, h, y2d); }

function wallMesh(el, t, col) {
  const a = el.a, b = el.b;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz); if (!len) return null;
  const th = el.props.thickness || t.thickness || 15;
  const geo = new THREE.BoxGeometry(len, H.wall, th);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((a[0] + b[0]) / 2, H.wall / 2, (a[1] + b[1]) / 2);
  m.rotation.y = Math.atan2(-dz, dx);
  return m;
}

function cabinetMesh(el, t, col) {
  const a = el.a, b = el.b;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz); if (!len) return null;
  const dep = el.props.depth || t.depth || 50;
  const base = t.cabinet === 'alto' ? H.cabAltoBase : 0;
  const top = t.cabinet === 'alto' ? H.cabAltoTop : H.cabBajoTop;
  const h = top - base;
  const geo = new THREE.BoxGeometry(len, h, dep);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, transparent: true, opacity: 0.85 });
  const m = new THREE.Mesh(geo, mat);
  // desplazar el centro medio-fondo perpendicular al muro
  const nx = -dz / len, nz = dx / len;
  m.position.set((a[0] + b[0]) / 2 + nx * dep / 2, base + h / 2, (a[1] + b[1]) / 2 + nz * dep / 2);
  m.rotation.y = Math.atan2(-dz, dx);
  return m;
}

function polyMesh(pts, height, col, opacity, doubleThickness) {
  if (!pts || pts.length < 3) return null;
  const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const verts = [];
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    verts.push(c[0], height, c[1], p1[0], height, p1[1], p2[0], height, p2[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity, side: THREE.DoubleSide, roughness: 1 });
  return new THREE.Mesh(geo, mat);
}

function fixtureMesh(el, t, col) {
  const type = el.type;
  // altura de montaje
  let h = 5, size = [26, 20, 26];
  if (t.panel) { h = H.tablero; size = [30, 40, 12]; }
  else if (t.circuitable === 'tomas' || /^toma_/.test(type)) { h = H.toma; size = [12, 14, 8]; }
  else if (t.circuitable === 'iluminacion' || type === 'luminaria') { h = H.lum; size = [22, 6, 22]; }
  else if (t.disc === 'hidrosanitario') { h = 20; size = footprint(type); }
  else if (t.disc === 'gas') { h = 40; size = [30, 60, 30]; }
  else if (type === 'medidor') { h = 120; size = [22, 30, 12]; }
  else { size = [20, 20, 20]; }
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const emis = (t.circuitable === 'iluminacion' || type === 'luminaria');
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: emis ? new THREE.Color(0x9c6bff) : 0x000000, emissiveIntensity: emis ? 0.5 : 0 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(el.x, h + size[1] / 2, el.y);
  if (el.rot) m.rotation.y = -el.rot * Math.PI / 180;
  return m;
}

function footprint(type) {
  const map = { sanitario: [40, 50, 60], lavamanos: [45, 25, 35], ducha: [80, 10, 80], lavaplatos: [80, 25, 50], lavadero: [60, 30, 50], lavadora: [60, 85, 60], poceta: [45, 30, 45], sifon: [20, 8, 20], bajante: [16, 260, 16] };
  return map[type] || [40, 30, 40];
}

function lineOf(vecs, colorHex, width) {
  const geo = new THREE.BufferGeometry().setFromPoints(vecs);
  const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: width || 1 });
  return new THREE.Line(geo, mat);
}

function expand(bbox, obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  if (!b.isEmpty()) bbox.union(b);
}
