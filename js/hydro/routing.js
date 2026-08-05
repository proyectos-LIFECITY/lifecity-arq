/* ============================================================
   LifeCity ARQ · hydro/routing.js
   Ruteo 2D de aparatos hidrosanitarios hasta el BAJANTE.
   - Grid ortogonal (tubería va en ángulo recto) con A*.
   - Evita ESTRUCTURA (obstáculos tomados de la disciplina vinculada).
   - Fusiona ramales (zanja compartida) hacia el bajante.
   - Evalúa varias rutas potenciales y elige la de menor costo con un
     modelo de costo lineal (ML-ready: pesos ajustables/entrenables).
   - Asigna diámetros por UDES acumuladas (ver diameters.js).
   ============================================================ */
import { TYPES } from '../palettes.js';
import { udesOf, minMmOf, diameterFor } from './diameters.js';

const CELL = 25;                 // cm por celda (coincide con el snap)
const key = (gx, gy) => gx + ',' + gy;
const toGrid = (v) => Math.round(v / CELL);
const toWorld = (g) => g * CELL;

/* Obstáculos (rectángulos) a partir de los elementos de ESTRUCTURA.
   Se leen siempre (el ruteo considera estructura aunque el vínculo
   visual esté apagado). Respeta la rotación de vigas/muros. */
export function obstaclesFromStructure(getScene, slug) {
  const out = [];
  const est = getScene(slug, 'estructura');
  for (const el of est.elements) {
    const t = TYPES[el.type] || {};
    if (!t.obstacle) continue;
    let w = (el.props && el.props.w) || t.w || 40;
    let h = (el.props && el.props.h) || t.h || 40;
    if (((el.rot || 0) % 180) === 90) { const tmp = w; w = h; h = tmp; } // rotado
    out.push({ x: el.x, y: el.y, w, h });
  }
  return out;
}

function blockedSet(obstacles, clearance = 10) {
  const blocked = new Set();
  for (const o of obstacles) {
    const gx0 = toGrid(o.x - o.w / 2 - clearance), gx1 = toGrid(o.x + o.w / 2 + clearance);
    const gy0 = toGrid(o.y - o.h / 2 - clearance), gy1 = toGrid(o.y + o.h / 2 + clearance);
    for (let gx = gx0; gx <= gx1; gx++)
      for (let gy = gy0; gy <= gy1; gy++) blocked.add(key(gx, gy));
  }
  return blocked;
}

/* A* ortogonal con penalización por giro y descuento de zanja compartida */
function astar(start, goal, blocked, used, weights) {
  const s = { gx: toGrid(start[0]), gy: toGrid(start[1]) };
  const g = { gx: toGrid(goal[0]), gy: toGrid(goal[1]) };
  const startK = key(s.gx, s.gy), goalK = key(g.gx, g.gy);
  // no bloquear origen/destino
  const H = (a, b) => (Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy)) * CELL;
  const open = new Map();       // stateKey -> node
  const gScore = new Map();
  const startState = startK + '|0';
  open.set(startState, { gx: s.gx, gy: s.gy, dir: 0, f: H(s, g), g: 0, from: null });
  gScore.set(startState, 0);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 2], [0, -1, 2]];
  let iter = 0;
  while (open.size && iter++ < 40000) {
    // nodo con menor f
    let bestK = null, best = null;
    for (const [k, n] of open) if (!best || n.f < best.f) { best = n; bestK = k; }
    open.delete(bestK);
    if (key(best.gx, best.gy) === goalK) return reconstruct(best);
    for (const [dx, dy, d] of dirs) {
      const nx = best.gx + dx, ny = best.gy + dy, nk = key(nx, ny);
      if (blocked.has(nk) && nk !== goalK) continue;
      let step = CELL * (used.has(nk) ? weights.discount : 1);
      if (best.dir && best.dir !== d) step += weights.turn;
      const ng = best.g + step;
      const state = nk + '|' + d;
      if (gScore.has(state) && ng >= gScore.get(state)) continue;
      gScore.set(state, ng);
      open.set(state, { gx: nx, gy: ny, dir: d, g: ng, f: ng + H({ gx: nx, gy: ny }, g), from: best });
    }
  }
  return null;
}

function reconstruct(node) {
  const pts = [];
  let n = node;
  while (n) { pts.push([toWorld(n.gx), toWorld(n.gy)]); n = n.from; }
  return pts.reverse();
}

/* Configuración de flujo por defecto: hidrosanitaria (UDES + NTC 1500) */
const HYDRO_FLOW = { loadOf: udesOf, minOf: minMmOf, diameterFor };

/* Construye la red completa bajo una configuración de pesos */
function buildNetwork(fixtures, bajante, blocked, weights, flow) {
  const used = new Set();
  const paths = [];              // {fixture, pts}
  // más lejano primero => se forma un tronco
  const ordered = [...fixtures].sort((a, b) =>
    dist(b, bajante) - dist(a, bajante));
  for (const f of ordered) {
    let pts = astar([f.x, f.y], [bajante.x, bajante.y], blocked, used, weights);
    if (!pts) pts = elbow([f.x, f.y], [bajante.x, bajante.y]); // fallback ruta en L
    paths.push({ fixture: f, pts });
    for (const p of pts) used.add(key(toGrid(p[0]), toGrid(p[1])));
  }
  // acumular UDES y diámetro por arista
  const edges = new Map();
  let totalBends = 0, sumPathLen = 0;
  for (const { fixture, pts } of paths) {
    totalBends += countBends(pts);
    sumPathLen += polyLen(pts);
    const u = flow.loadOf(fixture.type), mm = flow.minOf(fixture.type);
    for (let i = 1; i < pts.length; i++) {
      const ek = edgeKey(pts[i - 1], pts[i]);
      let e = edges.get(ek);
      if (!e) { e = { a: pts[i - 1], b: pts[i], udes: 0, minMm: 0 }; edges.set(ek, e); }
      e.udes += u; e.minMm = Math.max(e.minMm, mm);
    }
  }
  let trenchLen = 0, structAdj = 0;
  for (const e of edges.values()) {
    e.dia = flow.diameterFor(e.udes, e.minMm);
    trenchLen += segLen(e.a, e.b);
    if (nearBlocked(e.a, e.b, blocked)) structAdj++;
  }
  const score = weights.wLen * (trenchLen / 100)
    + weights.wBend * totalBends
    + weights.wStruct * structAdj
    + weights.wUnmerged * ((sumPathLen - trenchLen) / 100);
  return { paths, edges: [...edges.values()], score,
    metrics: { trenchM: +(trenchLen / 100).toFixed(1), bends: totalBends, structAdj,
      sharedM: +((sumPathLen - trenchLen) / 100).toFixed(1) } };
}

/* Punto de entrada: evalúa varias rutas potenciales y elige la mejor.
   `flow` inyecta la carga por aparato y la tabla de diámetros
   (default: hidrosanitaria). Gas pasa su propia config. */
export function bestRoute(fixtures, bajante, obstacles, flow = HYDRO_FLOW) {
  const blocked = blockedSet(obstacles);
  // desbloquear celdas de aparatos y bajante
  for (const f of [...fixtures, bajante]) blocked.delete(key(toGrid(f.x), toGrid(f.y)));

  // pesos del modelo de costo (comunes a la evaluación)
  const cost = { wLen: 1.0, wBend: 0.8, wStruct: 3.0, wUnmerged: 1.4 };
  // configuraciones candidatas (giro y descuento de zanja compartida)
  const configs = [
    { turn: 40, discount: 0.35 },
    { turn: 15, discount: 0.5 },
    { turn: 70, discount: 0.3 },
    { turn: 30, discount: 0.7 },
  ];
  let best = null, evaluated = 0;
  const scores = [];
  for (const c of configs) {
    const net = buildNetwork(fixtures, bajante, blocked, { ...cost, ...c }, flow);
    evaluated++;
    scores.push(+net.score.toFixed(1));
    if (!best || net.score < best.score) best = { ...net, config: c };
  }
  return { ...best, evaluated, scores, cost };
}

/* helpers geométricos */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function segLen(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += segLen(p[i - 1], p[i]); return s; }
function countBends(p) { let n = 0; for (let i = 2; i < p.length; i++) { const d1 = dir(p[i - 2], p[i - 1]), d2 = dir(p[i - 1], p[i]); if (d1 !== d2) n++; } return n; }
function dir(a, b) { return a[0] === b[0] ? 'v' : 'h'; }
function edgeKey(a, b) { const A = a[0] + ',' + a[1], B = b[0] + ',' + b[1]; return A < B ? A + '|' + B : B + '|' + A; }
function elbow(a, b) { return [a, [b[0], a[1]], b]; }
function nearBlocked(a, b, blocked) {
  const mx = toGrid((a[0] + b[0]) / 2), my = toGrid((a[1] + b[1]) / 2);
  return blocked.has(key(mx + 1, my)) || blocked.has(key(mx - 1, my)) || blocked.has(key(mx, my + 1)) || blocked.has(key(mx, my - 1));
}
