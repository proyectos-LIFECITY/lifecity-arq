/* ============================================================
   LifeCity ARQ · editor2d.js — lienzo 2D en planta (SVG)
   - pan/zoom/grid/snap, colocación de aparatos por disciplina
   - capas: grid / vínculos / rutas / circuitos / elementos / selección
   - inspector: propiedades, vínculos, (eléctrico) circuitos + diagramas,
     (hidro/gas) ruteo al bajante/medidor + diámetros
   - modo solo-lectura si el rol no puede editar la disciplina
   ============================================================ */
import Store from './store.js';
import { canEdit } from './permissions.js';
import { PALETTES, TYPES, symbolMarkup, typeName, geomOf } from './palettes.js';
import { makeCircuit, circuitPolyline, nextCircuitNumber } from './electrical/circuits.js';
import { openPanelDiagram } from './electrical/panel.js';
import { openUnifilar } from './electrical/unifilar.js';
import { retieReview } from './electrical/retie.js';
import { bestRoute, obstaclesFromStructure } from './hydro/routing.js';
import { diaColor } from './hydro/diameters.js';
import { reviewHydro } from './hydro/review.js';
import { GAS_FLOW } from './gas/diameters.js';
import { reviewGas } from './gas/review.js';
import { modal, toast } from './ui.js';

/* Config de ruteo por disciplina (hidro y gas comparten motor) */
function routeCfg(disc) {
  if (disc === 'hidrosanitario') return {
    flow: undefined, // default hidro en bestRoute
    isSink: t => !!(TYPES[t] || {}).riser,
    isFixture: t => (TYPES[t] || {}).disc === 'hidrosanitario' && !(TYPES[t] || {}).riser,
    review: reviewHydro, unit: 'UDES', sinkName: 'bajante', btn: '≈ Diámetros / Norma',
    help: 'Selecciona los <b>aparatos</b> (Shift) y un <b>bajante</b>. El motor evalúa varias rutas evitando <b>estructura</b> y elige la mejor; asigna diámetros por UDES.',
  };
  if (disc === 'gas') return {
    flow: GAS_FLOW,
    isSink: t => t === 'medidor' || !!(TYPES[t] || {}).regulator || !!(TYPES[t] || {}).riser,
    isFixture: t => GAS_FLOW.loadOf(t) > 0,
    review: reviewGas, unit: 'kW', sinkName: 'medidor', btn: '🔥 Diámetros / Norma',
    help: 'Selecciona los <b>artefactos</b> (Shift) y el <b>medidor</b> (uno por piso). El motor rutea evitando <b>estructura</b> y asigna diámetros por potencia (kW).',
  };
  return null;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const GRID = 50;        // cm por cuadro menor
const SNAP = 25;        // snap a 25 cm

let st = null;

export function mountEditor(rootEl, { slug, disc, setCrumbs }) {
  const u = Store.currentUser();
  const proj = Store.project(slug);
  const d = Store.discipline(disc);
  const editable = canEdit(u, disc);
  setCrumbs([
    { label: 'Proyectos', href: '#/proyectos' },
    { label: proj.name, href: `#/p/${slug}` },
    { label: d.name, href: `#/p/${slug}/${disc}` },
    { label: 'Modelo' },
  ]);

  st = {
    slug, disc, d, proj, editable,
    scene: Store.getScene(slug, disc),
    view: { x: -200, y: -200, w: 1600, h: 1000 }, // viewBox en cm
    tool: 'select',
    sel: new Set(),
    circuitPick: null,   // {kind, panelId, ids:[]}
    dragging: null,
    panning: null,
    pending: null,       // dibujo en progreso: {type, geom, a:[x,y]} o {type, geom:'polygon', pts:[...]}
    cursor: null,        // posición actual del cursor en mundo (para preview)
  };

  rootEl.innerHTML = shell(disc, editable);
  buildPalette();
  buildInspector();
  document.querySelector('.etoolbar').addEventListener('click', onToolbar);
  if (editable) {
    const pf = document.getElementById('plano-file');
    if (pf) pf.addEventListener('change', onPlanoFile);
  }
  wireCanvas();
  render();
}

/* ---------------- layout ---------------- */
function shell(disc, editable) {
  const isElec = disc === 'electrico';
  const cfgR = routeCfg(disc);
  return `<div id="editor-root">
    <div class="epalette" id="epalette"></div>
    <div class="ecanvas-wrap">
      <svg id="ecanvas" xmlns="${SVGNS}">
        <g id="layer-grid"></g>
        <g id="layer-underlay"></g>
        <g id="layer-links"></g>
        <g id="layer-routes"></g>
        <g id="layer-circuits"></g>
        <g id="layer-elements"></g>
        <g id="layer-overlay"></g>
      </svg>
      <div class="etoolbar">
        <button class="btn sm" data-act="fit">Encuadrar</button>
        <button class="btn sm" data-act="grid">Grid</button>
        ${isElec ? `<button class="btn sm" data-act="panel">⚡ Cuadro de cargas</button>
        <button class="btn sm" data-act="unifilar">Unifilar</button>
        <button class="btn sm" data-act="retie">RETIE 2026</button>` : ''}
        ${cfgR ? `<button class="btn sm" data-act="routenorm">${cfgR.btn}</button>` : ''}
        ${!editable ? '' : `<button class="btn sm" data-act="plano">🗺 Plano de fondo</button>
        <button class="btn sm primary" data-act="save">Guardar</button>`}
      </div>
      ${!editable ? `<div class="readonly-banner">Solo lectura · no puedes editar ${st.d.name}</div>` : ''}
      <input type="file" id="plano-file" accept="image/*" style="display:none">
      <div class="ehint" id="ehint"></div>
    </div>
    <div class="einspector" id="einspector"></div>
  </div>`;
}

/* ---------------- paleta ---------------- */
function buildPalette() {
  const box = document.getElementById('epalette');
  const pal = PALETTES[st.disc] || { groups: [] };
  let html = `<h4>Herramientas</h4>
    <div class="ptool ${st.tool === 'select' ? 'on' : ''}" data-tool="select">
      <svg viewBox="-14 -14 28 28"><path d="M-6 -8 L6 2 L-1 2 L2 8 L-2 8 L-4 2 L-8 4 Z" fill="currentColor"/></svg> Seleccionar</div>`;
  if (st.editable) {
    for (const g of pal.groups) {
      html += `<h4>${g.title}</h4>`;
      for (const t of g.items) {
        html += `<div class="ptool" data-tool="${t}" style="color:${st.d.color}">
          <svg viewBox="-16 -16 32 32">${symbolMarkup(t)}</svg>
          <span style="color:var(--text)">${typeName(t)}</span></div>`;
      }
    }
  } else {
    html += `<div style="font-size:11px;color:var(--text-dim);padding:10px 4px;line-height:1.6">Disciplina en modo consulta. Puedes navegar y activar <b>vínculos</b> de otras disciplinas desde el panel derecho.</div>`;
  }
  box.innerHTML = html;
  box.querySelectorAll('.ptool').forEach(el =>
    el.addEventListener('click', () => setTool(el.dataset.tool)));
}

function setTool(t) {
  st.tool = t;
  st.pending = null; st.cursor = null;
  document.querySelectorAll('#epalette .ptool').forEach(el =>
    el.classList.toggle('on', el.dataset.tool === t));
  const g = geomOf(t);
  const msg = t === 'select' ? 'Clic para seleccionar. Arrastra vacío para desplazar la vista.'
    : g === 'segment' ? `${typeName(t)}: clic INICIO, luego clic FINAL (2 clics).`
    : g === 'polygon' ? `${typeName(t)}: clic en cada esquina; cierra en el inicio o con Enter.`
    : g === 'host' ? `${typeName(t)}: clic sobre un MURO para colocarla.`
    : `Clic en el plano para colocar ${typeName(t)}. Esc para terminar.`;
  hint(msg);
  if (g === 'segment' || g === 'polygon') renderSelection();
}

/* ---------------- inspector ---------------- */
function buildInspector() {
  const box = document.getElementById('einspector');
  const others = Store.disciplines().filter(x => x.id !== st.disc);
  const linkRows = others.map(o => {
    const on = st.scene.links.includes(o.id);
    return `<div class="linkrow"><input type="checkbox" data-link="${o.id}" ${on ? 'checked' : ''}>
      <span class="swatch" style="background:${o.color}"></span>${o.name}</div>`;
  }).join('');

  let elecUI = '';
  if (st.disc === 'electrico' && st.editable) {
    elecUI = `<h4>Circuitos</h4>
      <div style="font-size:11px;color:var(--text-dim);line-height:1.6;margin-bottom:8px">
        1) Selecciona un <b>tablero</b>. 2) Suma tomas <b>o</b> luminarias (clic con Shift). 3) Crea el circuito.</div>
      <button class="btn sm" id="cir-tomas" style="width:100%;margin-bottom:6px">Crear circuito de TOMAS</button>
      <button class="btn sm" id="cir-ilum" style="width:100%">Crear circuito de ILUMINACIÓN</button>
      <div id="cir-list" style="margin-top:12px"></div>`;
  }

  let routeUI = '';
  const cfgR = routeCfg(st.disc);
  if (cfgR && st.editable) {
    routeUI = `<h4>Ruteo al ${cfgR.sinkName} (ML)</h4>
      <div style="font-size:11px;color:var(--text-dim);line-height:1.6;margin-bottom:8px">${cfgR.help}</div>
      <button class="btn sm primary" id="route-trace" style="width:100%;margin-bottom:6px">Trazar mejor ruta</button>
      <button class="btn sm ghost" id="route-clear" style="width:100%">Borrar trazado</button>
      <div id="route-info" style="margin-top:12px"></div>`;
  }

  let underlayUI = '';
  const u = st.scene.underlay;
  if (st.editable && u) {
    underlayUI = `<h4>Plano de fondo</h4>
      <div class="f"><label>Ancho real (cm)</label><input type="number" id="ul-w" value="${u.w}"></div>
      <div class="f"><label>Opacidad</label><input type="range" id="ul-op" min="0.1" max="1" step="0.05" value="${u.opacity}"></div>
      <div class="linkrow" style="justify-content:space-between">
        <span style="font-size:11px;color:var(--text-dim)">Escala el plano y traza encima.</span>
        <button class="btn sm ghost" id="ul-del">Quitar</button></div>`;
  }

  box.innerHTML = `<h4>Selección</h4><div id="insp-sel"><div style="font-size:11px;color:var(--text-dim)">Nada seleccionado.</div></div>
    ${elecUI}${routeUI}${underlayUI}
    <h4>Vínculos (otras disciplinas)</h4>
    <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Insértalos como fondo de referencia.</div>
    ${linkRows}`;

  box.querySelectorAll('[data-link]').forEach(cb =>
    cb.addEventListener('change', () => toggleLink(cb.dataset.link, cb.checked)));

  if (st.disc === 'electrico' && st.editable) {
    document.getElementById('cir-tomas').addEventListener('click', () => createCircuitFromSelection('tomas'));
    document.getElementById('cir-ilum').addEventListener('click', () => createCircuitFromSelection('iluminacion'));
    renderCircuitList();
  }
  if (cfgR && st.editable) {
    document.getElementById('route-trace').addEventListener('click', traceBestRoute);
    document.getElementById('route-clear').addEventListener('click', () => { st.scene.routes = []; persist(); render(); renderRouteInfo(); });
    renderRouteInfo();
  }
  if (st.editable && st.scene.underlay) {
    const ul = st.scene.underlay;
    document.getElementById('ul-w').addEventListener('change', (ev) => {
      const w = Math.max(50, +ev.target.value || ul.w);
      ul.h = Math.round(ul.h * (w / ul.w)); ul.w = w; persist(); render();
    });
    document.getElementById('ul-op').addEventListener('input', (ev) => { ul.opacity = +ev.target.value; persist(); render(); });
    document.getElementById('ul-del').addEventListener('click', () => { st.scene.underlay = null; persist(); render(); buildInspector(); });
  }
}

function onToolbar(e) {
  const act = e.target.dataset.act;
  if (!act) return;
  if (act === 'fit') fitView();
  if (act === 'grid') { st.gridOff = !st.gridOff; render(); }
  if (act === 'save') { Store.saveScene(st.slug, st.disc, st.scene); toast('Modelo guardado'); }
  if (act === 'panel') openPanelDiagram(st.scene, st.proj);
  if (act === 'unifilar') openUnifilar(st.scene, st.proj);
  if (act === 'retie') showRetie();
  if (act === 'routenorm') showRouteNorm();
  if (act === 'plano') { const pf = document.getElementById('plano-file'); if (pf) pf.click(); }
}

/* ------ plano de fondo (underlay) ------ */
function onPlanoFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const w = 800; // ancho por defecto 8 m; se calibra en el inspector
      const h = Math.round(w * img.naturalHeight / img.naturalWidth);
      st.scene.underlay = { href: rd.result, x: 0, y: 0, w, h, opacity: 0.55 };
      persist(); render(); buildInspector(); fitView();
      toast('Plano cargado. Ajusta ancho/opacidad en el panel derecho.');
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
  e.target.value = '';
}

function renderUnderlay() {
  const g = document.getElementById('layer-underlay');
  if (!g) return;
  const u = st.scene.underlay;
  g.innerHTML = u
    ? `<image href="${u.href}" x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" opacity="${u.opacity}" preserveAspectRatio="none" pointer-events="none"/>`
    : '';
}

/* ---------------- render ---------------- */
function render() {
  const svg = document.getElementById('ecanvas');
  const v = st.view;
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  renderGrid();
  renderUnderlay();
  renderLinks();
  renderRoutes();
  renderCircuits();
  renderElements();
  renderSelection();
}

function renderGrid() {
  const g = document.getElementById('layer-grid');
  if (st.gridOff) { g.innerHTML = ''; return; }
  const v = st.view;
  const x0 = Math.floor(v.x / GRID) * GRID, x1 = v.x + v.w;
  const y0 = Math.floor(v.y / GRID) * GRID, y1 = v.y + v.h;
  let s = '';
  for (let x = x0; x <= x1; x += GRID) {
    const major = x % (GRID * 10) === 0;
    s += `<line x1="${x}" y1="${v.y}" x2="${x}" y2="${y1}" stroke="${major ? '#1b2636' : '#141c28'}" stroke-width="${major ? 1.2 : 0.6}" vector-effect="non-scaling-stroke"/>`;
  }
  for (let y = y0; y <= y1; y += GRID) {
    const major = y % (GRID * 10) === 0;
    s += `<line x1="${v.x}" y1="${y}" x2="${x1}" y2="${y}" stroke="${major ? '#1b2636' : '#141c28'}" stroke-width="${major ? 1.2 : 0.6}" vector-effect="non-scaling-stroke"/>`;
  }
  g.innerHTML = s;
}

function renderLinks() {
  const g = document.getElementById('layer-links');
  let s = '';
  for (const linkDisc of st.scene.links) {
    const d = Store.discipline(linkDisc);
    const other = Store.getScene(st.slug, linkDisc);
    for (const el of other.elements) {
      const t = TYPES[el.type] || {};
      const geom = el.geom || 'point';
      if (geom === 'segment') {
        const th = el.props?.thickness || t.thickness || (t.cabinet ? 3 : 12);
        s += `<line x1="${el.a[0]}" y1="${el.a[1]}" x2="${el.b[0]}" y2="${el.b[1]}" stroke="${d.color}" stroke-width="${t.wall ? th : 3}" stroke-linecap="square" opacity=".38" pointer-events="none"/>`;
      } else if (geom === 'polygon') {
        s += `<polygon points="${el.pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${d.color}" stroke-width="1.4" opacity=".3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      } else {
        s += `<g transform="translate(${el.x},${el.y}) rotate(${el.rot || 0})" style="color:${d.color};opacity:.42" pointer-events="none">${symbolMarkup(el.type)}</g>`;
      }
    }
  }
  g.innerHTML = s;
}

function renderRoutes() {
  const g = document.getElementById('layer-routes');
  if (!g) return;
  let s = '';
  const net = (st.scene.routes || [])[0];
  if (net && net.edges) {
    // segmentos coloreados por diámetro
    for (const e of net.edges) {
      const col = diaColor(e.dia.mm);
      const wgt = 1.4 + (e.dia.mm / 40);
      s += `<line x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" stroke="${col}" stroke-width="${wgt}" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".95"/>`;
    }
    // una etiqueta por diámetro distinto (en su tramo más largo)
    const byDia = {};
    for (const e of net.edges) {
      const L = Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1]);
      if (!byDia[e.dia.mm] || L > byDia[e.dia.mm].L) byDia[e.dia.mm] = { e, L };
    }
    for (const mm in byDia) {
      const e = byDia[mm].e, col = diaColor(+mm);
      const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
      s += `<g transform="translate(${mx},${my})"><rect x="-20" y="-9" width="40" height="18" rx="3" fill="#0b0f16" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/><text y="4" text-anchor="middle" font-size="10" font-family="JetBrains Mono" fill="${col}">Ø${e.dia.mm}</text></g>`;
    }
  }
  g.innerHTML = s;
}

function renderCircuits() {
  const g = document.getElementById('layer-circuits');
  let s = '';
  for (const c of st.scene.circuits) {
    const pts = circuitPolyline(st.scene, c);
    if (pts.length < 2) continue;
    const dline = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    const col = c.kind === 'iluminacion' ? '#9c6bff' : '#f4b942';
    s += `<path d="${dline}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="7 5" vector-effect="non-scaling-stroke" opacity=".9"/>`;
    // etiqueta del número junto al primer tramo
    const mid = pts[1];
    s += `<g transform="translate(${mid[0]},${mid[1]})"><circle r="9" fill="#0b0f16" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke"/><text y="4" text-anchor="middle" font-size="11" font-family="JetBrains Mono" fill="${col}">${c.number}</text></g>`;
  }
  g.innerHTML = s;
}

function renderElements() {
  const g = document.getElementById('layer-elements');
  let s = '';
  for (const el of st.scene.elements) {
    const t = TYPES[el.type] || {};
    const col = t.panel ? '#f4b942' : st.d.color;
    const geom = el.geom || 'point';
    if (geom === 'segment') s += renderSegment(el, t, col);
    else if (geom === 'polygon') s += renderPolygon(el, t, col);
    else s += `<g class="el" data-id="${el.id}" transform="translate(${el.x},${el.y}) rotate(${el.rot || 0})" style="color:${col};cursor:${st.editable ? 'move' : 'default'}">${geom === 'host' ? hostSymbol(el, t) : symbolMarkup(el.type)}</g>`;
  }
  g.innerHTML = s;
  g.querySelectorAll('.el').forEach(node =>
    node.addEventListener('pointerdown', (e) => onElementDown(e, node.dataset.id)));
}

function renderSegment(el, t, col) {
  const a = el.a, b = el.b;
  if (t.cabinet) {
    const dep = el.props.depth || t.depth || 50;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * dep, ny = dx / L * dep;
    const pts = `${a[0]},${a[1]} ${b[0]},${b[1]} ${b[0] + nx},${b[1] + ny} ${a[0] + nx},${a[1] + ny}`;
    const fill = t.cabinet === 'alto' ? 'none' : 'rgba(154,167,184,.14)';
    const dash = t.cabinet === 'alto' ? 'stroke-dasharray="7 4"' : '';
    return `<polygon class="el" data-id="${el.id}" points="${pts}" fill="${fill}" stroke="${col}" stroke-width="1.5" ${dash} vector-effect="non-scaling-stroke" style="cursor:${st.editable ? 'pointer' : 'default'}"/>`;
  }
  const th = el.props.thickness || t.thickness || 15;
  return `<line class="el" data-id="${el.id}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="${th}" stroke-linecap="square" style="cursor:${st.editable ? 'pointer' : 'default'}"/>`;
}

function renderPolygon(el, t, col) {
  const pts = el.pts.map(p => p.join(',')).join(' ');
  const fill = t.roof ? 'rgba(154,167,184,.08)' : (t.ceiling ? 'none' : 'rgba(154,167,184,.10)');
  const dash = t.ceiling ? 'stroke-dasharray="9 5"' : '';
  const c = centroid(el.pts);
  let s = `<polygon class="el" data-id="${el.id}" points="${pts}" fill="${fill}" stroke="${col}" stroke-width="1.6" ${dash} vector-effect="non-scaling-stroke" style="cursor:${st.editable ? 'pointer' : 'default'}"/>`;
  if (t.roof) {
    for (const v of el.pts) s += `<line x1="${c[0]}" y1="${c[1]}" x2="${v[0]}" y2="${v[1]}" stroke="${col}" stroke-width=".8" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" opacity=".55" pointer-events="none"/>`;
    s += `<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="12" font-family="JetBrains Mono" fill="${col}" pointer-events="none">Cubierta · ${el.props.aguas || 2} aguas · ${el.props.pendiente || 25}%</text>`;
  } else {
    s += `<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="11" font-family="JetBrains Mono" fill="${col}" opacity=".7" pointer-events="none">${typeName(el.type)}</text>`;
  }
  return s;
}

function hostSymbol(el, t) {
  const w = el.props.w || t.w || 90;
  if (el.type === 'ventana') {
    return `<rect x="${-w / 2}" y="-6" width="${w}" height="12" fill="#0b0f16" stroke="currentColor" stroke-width="1.4"/><line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="currentColor" stroke-width="1"/>`;
  }
  return `<rect x="${-w / 2}" y="-5" width="${w}" height="10" fill="#0b0f16" stroke="none"/><line x1="${-w / 2}" y1="0" x2="${-w / 2}" y2="${-w}" stroke="currentColor" stroke-width="1.8"/><path d="M${-w / 2} ${-w} A ${w} ${w} 0 0 1 ${w / 2} 0" fill="none" stroke="currentColor" stroke-width="1.1"/>`;
}

function renderSelection() {
  const g = document.getElementById('layer-overlay');
  let s = '';
  const HL = 'stroke="#4dd0e1" stroke-width="1.8" stroke-dasharray="4 3" fill="none" vector-effect="non-scaling-stroke" pointer-events="none"';
  for (const id of st.sel) {
    const el = st.scene.elements.find(e => e.id === id);
    if (!el) continue;
    if ((el.geom || 'point') === 'segment') {
      s += `<line x1="${el.a[0]}" y1="${el.a[1]}" x2="${el.b[0]}" y2="${el.b[1]}" ${HL}/>`;
    } else if (el.geom === 'polygon') {
      s += `<polygon points="${el.pts.map(p => p.join(',')).join(' ')}" ${HL}/>`;
    } else {
      s += `<circle cx="${el.x}" cy="${el.y}" r="17" ${HL}/>`;
    }
  }
  // preview del dibujo en progreso
  if (st.pending && st.cursor) {
    const col = st.d.color;
    if (st.pending.geom === 'segment') {
      s += `<line x1="${st.pending.a[0]}" y1="${st.pending.a[1]}" x2="${st.cursor[0]}" y2="${st.cursor[1]}" stroke="${col}" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    } else if (st.pending.geom === 'polygon') {
      const all = [...st.pending.pts, st.cursor];
      s += `<polyline points="${all.map(p => p.join(',')).join(' ')}" fill="rgba(255,255,255,.04)" stroke="${col}" stroke-width="1.6" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      for (const v of st.pending.pts) s += `<circle cx="${v[0]}" cy="${v[1]}" r="4" fill="${col}" pointer-events="none"/>`;
    }
  }
  g.innerHTML = s;
  updateSelInspector();
}

/* ---------------- interacción ---------------- */
let globalsWired = false;
function wireCanvas() {
  const svg = document.getElementById('ecanvas');
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('pointerdown', onCanvasDown);
  svg.addEventListener('pointermove', onCanvasMove);
  if (!globalsWired) {   // st siempre apunta al editor activo; evitar apilar listeners
    window.addEventListener('pointerup', onCanvasUp);
    window.addEventListener('keydown', onKey);
    globalsWired = true;
  }
  requestAnimationFrame(fitView);
}

function toWorld(evt) {
  const svg = document.getElementById('ecanvas');
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function snap(v) { return Math.round(v / SNAP) * SNAP; }

function onWheel(e) {
  e.preventDefault();
  const w = toWorld(e);
  const f = e.deltaY < 0 ? 0.87 : 1.15;
  const v = st.view;
  v.x = w.x - (w.x - v.x) * f;
  v.y = w.y - (w.y - v.y) * f;
  v.w *= f; v.h *= f;
  render();
}

function onCanvasDown(e) {
  if (e.target.closest('.el')) return; // manejado por onElementDown
  const w = toWorld(e);
  if (st.editable && st.tool !== 'select' && e.button === 0) {
    const g = geomOf(st.tool);
    const p = [snap(w.x), snap(w.y)];
    if (g === 'point') { placeElement(st.tool, p[0], p[1]); return; }
    if (g === 'host') { createHost(st.tool, p); return; }
    if (g === 'segment') {
      if (!st.pending) { st.pending = { type: st.tool, geom: g, a: p }; hint('Clic en el punto FINAL. Esc cancela.'); }
      else { createSegment(st.tool, st.pending.a, p); st.pending = null; hint(`${typeName(st.tool)} creado. Clic para el siguiente (Esc para terminar).`); }
      render(); return;
    }
    if (g === 'polygon') {
      if (!st.pending) { st.pending = { type: st.tool, geom: g, pts: [p] }; }
      else {
        const f = st.pending.pts[0];
        if (st.pending.pts.length >= 3 && Math.hypot(p[0] - f[0], p[1] - f[1]) < 40) { finishPolygon(); return; }
        st.pending.pts.push(p);
      }
      hint('Clic para más puntos · clic en el INICIO o Enter para cerrar · Esc cancela.');
      render(); return;
    }
  }
  st.panning = { sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y };
  if (!e.shiftKey) { st.sel.clear(); renderSelection(); }
}

function onCanvasMove(e) {
  if (st.pending) { const w = toWorld(e); st.cursor = [snap(w.x), snap(w.y)]; renderSelection(); return; }
  if (st.panning) {
    const svg = document.getElementById('ecanvas');
    const scale = st.view.w / svg.clientWidth;
    st.view.x = st.panning.vx - (e.clientX - st.panning.sx) * scale;
    st.view.y = st.panning.vy - (e.clientY - st.panning.sy) * scale;
    render();
    return;
  }
  if (st.dragging) {
    const w = toWorld(e);
    const el = st.scene.elements.find(x => x.id === st.dragging.id);
    if (el) { el.x = snap(w.x - st.dragging.dx); el.y = snap(w.y - st.dragging.dy); render(); }
  }
}

function onCanvasUp() { st.panning = null; if (st.dragging) { st.dragging = null; } }

function onElementDown(e, id) {
  e.stopPropagation();
  const el = st.scene.elements.find(x => x.id === id);
  if (!el) return;
  // selección (shift = múltiple)
  if (!e.shiftKey) st.sel.clear();
  st.sel.add(id);
  renderSelection();
  if (st.editable && e.button === 0 && el.x != null) {   // arrastre solo puntos/anclados
    const w = toWorld(e);
    st.dragging = { id, dx: w.x - el.x, dy: w.y - el.y };
  }
}

function onKey(e) {
  if (e.key === 'Escape') { st.pending = null; st.cursor = null; setTool('select'); st.circuitPick = null; render(); }
  if (e.key === 'Enter' && st.pending && st.pending.geom === 'polygon') { finishPolygon(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && st.editable && st.sel.size) {
    st.scene.elements = st.scene.elements.filter(el => !st.sel.has(el.id));
    st.scene.circuits = st.scene.circuits.filter(c =>
      !st.sel.has(c.panelId) && !c.elementIds.some(i => st.sel.has(i)));
    st.sel.clear(); persist(); render(); buildInspector();
  }
  if (e.key === 'r' && st.editable && st.sel.size) { // rotar 90°
    for (const id of st.sel) { const el = st.scene.elements.find(x => x.id === id); if (el) el.rot = ((el.rot || 0) + 90) % 360; }
    persist(); render();
  }
}

/* ---------------- acciones ---------------- */
let idc = Date.now();
function placeElement(type, x, y) {
  const el = { id: 'e' + (idc++), type, disc: st.disc, x, y, rot: 0, props: {} };
  const t = TYPES[type] || {};
  if (t.va != null) el.props.va = t.va;
  // MEP: tomas se anclan al muro más cercano; luminarias van "en cielo"
  if (t.circuitable === 'tomas') {
    const walls = collectWalls();
    if (walls.length) { const h = nearestWall([x, y], walls); if (h && h.dist < 150) { el.x = h.foot[0]; el.y = h.foot[1]; el.rot = h.angle; el.props.host = 'muro'; } }
  }
  if (t.circuitable === 'iluminacion') el.props.host = 'cielo';
  st.scene.elements.push(el);
  persist(); render();
}

/* ------ geometría arquitectónica ------ */
function createSegment(type, a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
  const t = TYPES[type] || {};
  const el = { id: 'e' + (idc++), type, disc: st.disc, geom: 'segment', a, b, props: {} };
  if (t.thickness) el.props.thickness = t.thickness;
  if (t.depth) el.props.depth = t.depth;
  st.scene.elements.push(el); persist();
}

function finishPolygon() {
  const p = st.pending;
  if (!p || p.pts.length < 3) { st.pending = null; st.cursor = null; render(); return; }
  const t = TYPES[p.type] || {};
  const el = { id: 'e' + (idc++), type: p.type, disc: st.disc, geom: 'polygon', pts: p.pts.slice(), props: {} };
  if (t.roof) { el.props.aguas = t.aguas; el.props.pendiente = t.pendiente; }
  st.scene.elements.push(el);
  st.pending = null; st.cursor = null; persist(); render();
  toast(`${typeName(p.type)} creado.`);
}

function createHost(type, p) {
  const t = TYPES[type] || {};
  const walls = collectWalls();
  if (!walls.length) return toast('Coloca un muro primero (o activa el vínculo Arquitectura).');
  const h = nearestWall(p, walls);
  if (!h || h.dist > 140) return toast('Acerca el clic a un muro.');
  const el = { id: 'e' + (idc++), type, disc: st.disc, geom: 'host', hostId: h.wall.id, x: h.foot[0], y: h.foot[1], rot: h.angle, props: { w: t.w } };
  st.scene.elements.push(el); persist(); render();
}

// muros de esta escena + (si es MEP) los del vínculo Arquitectura
function collectWalls() {
  const here = st.scene.elements.filter(e => e.geom === 'segment' && (TYPES[e.type] || {}).wall);
  if (st.disc === 'arquitectura') return here;
  const a = Store.getScene(st.slug, 'arquitectura');
  return here.concat(a.elements.filter(e => e.geom === 'segment' && (TYPES[e.type] || {}).wall));
}
function projectPointSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t));
  const fx = a[0] + t * dx, fy = a[1] + t * dy;
  return { foot: [fx, fy], dist: Math.hypot(p[0] - fx, p[1] - fy), t, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}
function nearestWall(p, walls) {
  let best = null;
  for (const w of walls) { const r = projectPointSeg(p, w.a, w.b); if (!best || r.dist < best.dist) best = { ...r, wall: w }; }
  return best;
}
function centroid(pts) {
  let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length];
}

function toggleLink(disc, on) {
  st.scene.links = st.scene.links.filter(x => x !== disc);
  if (on) st.scene.links.push(disc);
  persist(); render();
}

function persist() { Store.saveScene(st.slug, st.disc, st.scene); }

/* ------ circuitos (eléctrico) ------ */
function createCircuitFromSelection(kind) {
  const sel = [...st.sel].map(id => st.scene.elements.find(e => e.id === id)).filter(Boolean);
  const panel = sel.find(e => (TYPES[e.type] || {}).panel);
  const items = sel.filter(e => (TYPES[e.type] || {}).circuitable === kind);
  if (!panel) return toast('Selecciona también un tablero (T).');
  if (!items.length) return toast(`Selecciona al menos una salida de ${kind}.`);
  const c = makeCircuit(st.scene, panel.id, items.map(e => e.id), kind);
  persist(); render(); renderCircuitList();
  toast(`Circuito #${c.number} (${kind}) creado con ${items.length} salidas.`);
  st.sel.clear(); renderSelection();
}

function renderCircuitList() {
  const box = document.getElementById('cir-list');
  if (!box) return;
  if (!st.scene.circuits.length) { box.innerHTML = `<div style="font-size:11px;color:var(--text-dim)">Sin circuitos aún.</div>`; return; }
  box.innerHTML = st.scene.circuits.map(c => {
    const col = c.kind === 'iluminacion' ? '#9c6bff' : '#f4b942';
    return `<div class="linkrow" style="justify-content:space-between">
      <span><b style="color:${col}">#${c.number}</b> · ${c.kind} · ${c.elementIds.length} sal.</span>
      <button class="btn sm ghost" data-del="${c.id}">✕</button></div>`;
  }).join('');
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    st.scene.circuits = st.scene.circuits.filter(c => c.id !== b.dataset.del);
    persist(); render(); renderCircuitList();
  }));
}

/* ------ ruteo hidrosanitario / gas (fase 2, motor compartido) ------ */
function traceBestRoute() {
  const cfg = routeCfg(st.disc);
  if (!cfg) return;
  const sel = [...st.sel].map(id => st.scene.elements.find(e => e.id === id)).filter(Boolean);
  const sinksInScene = st.scene.elements.filter(e => cfg.isSink(e.type));
  if (!sinksInScene.length) return toast(`Coloca un ${cfg.sinkName} como destino.`);
  // aparatos: seleccionados, o todos si no hay selección
  let fixtures = sel.filter(e => cfg.isFixture(e.type));
  if (!fixtures.length) fixtures = st.scene.elements.filter(e => cfg.isFixture(e.type));
  if (!fixtures.length) return toast('Coloca y/o selecciona los aparatos/artefactos.');
  // sink: el seleccionado, o el más cercano al centroide
  let sink = sel.find(e => cfg.isSink(e.type));
  if (!sink) {
    const cx = fixtures.reduce((a, f) => a + f.x, 0) / fixtures.length;
    const cy = fixtures.reduce((a, f) => a + f.y, 0) / fixtures.length;
    sink = sinksInScene.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
  }
  const obstacles = obstaclesFromStructure(Store.getScene, st.slug);
  const net = bestRoute(fixtures, sink, obstacles, cfg.flow);
  st.scene.routes = [{
    id: 'r' + Date.now().toString(36),
    edges: net.edges.map(e => ({ a: e.a, b: e.b, udes: e.udes, dia: e.dia })),
    metrics: net.metrics, score: net.score, evaluated: net.evaluated, scores: net.scores,
    fixtureIds: fixtures.map(f => f.id), sinkId: sink.id, obstacles: obstacles.length,
  }];
  persist(); render(); renderRouteInfo();
  toast(`Ruta trazada: ${net.evaluated} evaluadas · ${net.metrics.trenchM} m · evita ${obstacles.length} obstáculos.`);
}

function renderRouteInfo() {
  const box = document.getElementById('route-info');
  if (!box) return;
  const net = (st.scene.routes || [])[0];
  if (!net) { box.innerHTML = `<div style="font-size:11px;color:var(--text-dim)">Sin trazado aún.</div>`; return; }
  const maxMm = Math.max(...net.edges.map(e => e.dia.mm));
  box.innerHTML = `<div style="font-size:11px;line-height:1.7">
    <div>Rutas evaluadas: <b>${net.evaluated}</b> · costos: ${net.scores.join(', ')}</div>
    <div>Elegida (menor costo): <b>${Math.round(net.score)}</b></div>
    <div>Zanja: <b>${net.metrics.trenchM} m</b> · compartida ${net.metrics.sharedM} m</div>
    <div>Cambios de dirección: <b>${net.metrics.bends}</b></div>
    <div>Tramos junto a estructura: <b>${net.metrics.structAdj}</b></div>
    <div>Colector: <b style="color:${diaColor(maxMm)}">Ø ${maxMm} mm</b></div>
    <button class="btn sm" id="route-norm" style="width:100%;margin-top:8px">Ver diámetros / norma</button></div>`;
  document.getElementById('route-norm').addEventListener('click', showRouteNorm);
}

function showRouteNorm() {
  const cfg = routeCfg(st.disc);
  if (!cfg) return;
  const net = (st.scene.routes || [])[0];
  const rep = cfg.review(st.scene, net);
  const recs = rep.items.map(r => `<div class="rec ${r.level}"><span class="tag">${r.tag}</span>${r.msg}</div>`).join('');
  const isGas = st.disc === 'gas';
  let table = '';
  if (net && net.edges) {
    const rows = net.edges.slice().sort((a, b) => b.udes - a.udes).slice(0, 14).map(e =>
      `<tr><td class="num">${isGas ? e.udes.toFixed(1) : e.udes}</td><td><b style="color:${diaColor(e.dia.mm)}">Ø ${e.dia.mm} mm</b></td><td>${e.dia.in}</td><td class="num">${Math.round(Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1]))} cm</td></tr>`).join('');
    table = `<h3 style="font-family:var(--display);margin:6px 0 10px">Tramos y diámetros</h3>
      <table class="data"><thead><tr><th class="num">${cfg.unit}</th><th>Diámetro</th><th>Pulg</th><th class="num">Long</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="height:14px"></div>`;
  }
  const title = isGas ? 'Gas · Diámetros y recomendaciones' : 'Hidrosanitaria · Diámetros y recomendaciones';
  const src = isGas ? 'potencia (kW) · base NTC 2505' : 'unidades de descarga (UDES) · base NTC 1500/RAS';
  const file = isGas ? 'gas/diameters.js' : 'hydro/diameters.js';
  modal(title, `
    <div class="sub" style="margin-bottom:14px">Dimensionamiento por ${src}. Constantes configurables en <code>${file}</code>; verificar contra la norma.</div>
    ${table}${recs || '<div class="empty">Traza una ruta para obtener diámetros y recomendaciones.</div>'}`, { wide: true });
}

function updateSelInspector() {
  const box = document.getElementById('insp-sel');
  if (!box) return;
  if (!st.sel.size) { box.innerHTML = `<div style="font-size:11px;color:var(--text-dim)">Nada seleccionado.</div>`; return; }
  if (st.sel.size > 1) { box.innerHTML = `<div style="font-size:11px;color:var(--text-dim)">${st.sel.size} elementos seleccionados.</div>`; return; }
  const el = st.scene.elements.find(e => st.sel.has(e.id));
  if (!el) return;
  const t = TYPES[el.type] || {};
  const ed = st.editable ? '' : 'disabled';
  let fields = '';
  const geom = el.geom || 'point';
  if (geom === 'segment') {
    const L = Math.round(Math.hypot(el.b[0] - el.a[0], el.b[1] - el.a[1]));
    fields = `<div class="f"><label>Longitud</label><input value="${L} cm  (${(L / 100).toFixed(2)} m)" disabled></div>`;
    if (t.wall) fields += `<div class="f"><label>Espesor muro (cm)</label><input type="number" id="p-th" value="${el.props.thickness || t.thickness}" ${ed}></div>`;
    if (t.cabinet) fields += `<div class="f"><label>Fondo gabinete (cm)</label><input type="number" id="p-dep" value="${el.props.depth || t.depth}" ${ed}></div>`;
  } else if (geom === 'polygon') {
    fields = `<div class="f"><label>Vértices</label><input value="${el.pts.length}" disabled></div>`;
    if (t.roof) fields += `<div class="f"><label>Nº de aguas</label><input type="number" id="p-ag" value="${el.props.aguas ?? 2}" ${ed}></div>
      <div class="f"><label>Pendiente (%)</label><input type="number" id="p-pe" value="${el.props.pendiente ?? 25}" ${ed}></div>`;
  } else {
    fields = `<div class="f"><label>Posición (cm)</label><input value="x ${el.x} · y ${el.y}" disabled></div>
      ${el.props.host ? `<div class="f"><label>Anclado a</label><input value="${el.props.host}" disabled></div>` : ''}
      ${t.va != null ? `<div class="f"><label>Carga (VA)</label><input type="number" id="p-va" value="${el.props.va ?? t.va}" ${ed}></div>` : ''}
      ${geom === 'host' ? `<div class="f"><label>Ancho (cm)</label><input type="number" id="p-w" value="${el.props.w || t.w}" ${ed}></div>` : ''}
      <div class="f"><label>Rotación</label><input value="${Math.round(el.rot || 0)}°" disabled></div>`;
  }
  box.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:6px">${typeName(el.type)}</div>${fields}
    ${st.editable ? `<div style="font-size:10px;color:var(--text-faint)">${el.x != null ? 'R = rotar · ' : ''}Supr = borrar</div>` : ''}`;
  const bind = (id, key) => { const n = document.getElementById(id); if (n) n.addEventListener('change', () => { el.props[key] = +n.value; persist(); render(); }); };
  bind('p-va', 'va'); bind('p-th', 'thickness'); bind('p-dep', 'depth'); bind('p-ag', 'aguas'); bind('p-pe', 'pendiente'); bind('p-w', 'w');
}

/* ------ RETIE panel ------ */
function showRetie() {
  const rep = retieReview(st.scene, st.proj);
  const rows = rep.items.map(r => `<div class="rec ${r.level}"><span class="tag">${r.tag}</span>${r.msg}</div>`).join('');
  modal('RETIE 2026 · Recomendaciones', `
    <div class="sub" style="margin-bottom:14px">Res. 40284 de 2026 · vigente desde 01-ene-2026 (sin período de gracia). Constantes configurables en <code>retie.js</code>; verificar contra el texto oficial.</div>
    ${rows || '<div class="empty">Coloca tablero, tomas y luminarias y crea circuitos para obtener recomendaciones.</div>'}`);
}

/* ---------------- utilidades vista ---------------- */
function fitView() {
  const els = st.scene.elements;
  const svg = document.getElementById('ecanvas');
  const aspect = svg.clientWidth / Math.max(1, svg.clientHeight);
  const u = st.scene.underlay;
  if (!els.length && !u) { st.view = { x: -200, y: -200, w: 1400, h: 1400 / aspect }; render(); return; }
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const acc = (x, y) => { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); };
  for (const e of els) {
    if (e.geom === 'segment') { acc(e.a[0], e.a[1]); acc(e.b[0], e.b[1]); }
    else if (e.geom === 'polygon') { for (const p of e.pts) acc(p[0], p[1]); }
    else acc(e.x, e.y);
  }
  if (u) { acc(u.x, u.y); acc(u.x + u.w, u.y + u.h); }
  if (!isFinite(minx)) { st.view = { x: -200, y: -200, w: 1400, h: 1400 / aspect }; render(); return; }
  const pad = 150;
  let w = (maxx - minx) + pad * 2, h = (maxy - miny) + pad * 2;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  st.view = { x: minx - pad, y: miny - pad, w, h };
  render();
}

function hint(t) { const h = document.getElementById('ehint'); if (h) h.textContent = t; }
