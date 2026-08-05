/* ============================================================
   LifeCity ARQ · quantities.js — Cantidades automáticas por disciplina
   Conteo de aparatos + (eléctrico) circuitos y longitud de conductor
   + (hidro/gas) tubería por diámetro desde el trazado.
   ============================================================ */
import Store from './store.js';
import { TYPES, typeName } from './palettes.js';
import { computeCircuits } from './electrical/retie.js';
import { diaColor } from './hydro/diameters.js';

export function renderQuantities(el, { slug, disc, setCrumbs }) {
  const proj = Store.project(slug);
  const d = Store.discipline(disc);
  const scene = Store.getScene(slug, disc);
  setCrumbs([
    { label: 'Proyectos', href: '#/proyectos' },
    { label: proj.name, href: `#/p/${slug}` },
    { label: d.name, href: `#/p/${slug}/${disc}` },
    { label: 'Cantidades' },
  ]);

  // conteo por tipo
  const counts = {};
  for (const e of scene.elements) counts[e.type] = (counts[e.type] || 0) + 1;
  const rows = Object.keys(counts).sort().map(t =>
    `<tr><td>${typeName(t)}</td><td>${(TYPES[t] && TYPES[t].disc) || '-'}</td><td class="num">${counts[t]}</td><td>und</td></tr>`).join('')
    || `<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Sin elementos colocados.</td></tr>`;

  let extra = '';
  if (disc === 'electrico') {
    const cc = computeCircuits(scene);
    const totLen = cc.reduce((s, c) => s + c.lengthM, 0);
    const crows = cc.map(c =>
      `<tr><td><b>#${c.number}</b></td><td>${c.kind}</td><td class="num">${c.count}</td><td class="num">${c.va}</td><td>${c.breaker}A</td><td>${c.calibre}</td><td class="num">${c.lengthM}</td></tr>`).join('')
      || `<tr><td colspan="7" style="text-align:center;color:var(--text-dim)">Sin circuitos.</td></tr>`;
    extra = `<h3 style="font-family:var(--display);margin:26px 0 10px">Circuitos y conductor</h3>
      <table class="data"><thead><tr><th>Circuito</th><th>Tipo</th><th>Sal</th><th class="num">VA</th><th>Breaker</th><th>Conductor</th><th class="num">Long (m)</th></tr></thead>
      <tbody>${crows}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:right"><b>Total conductor estimado</b></td><td class="num"><b>${totLen.toFixed(1)} m</b></td></tr></tfoot></table>`;
  }

  if (disc === 'hidrosanitario' || disc === 'gas') {
    const net = (scene.routes || [])[0];
    const label = disc === 'gas' ? 'Tubería de gas (trazado al medidor)' : 'Tubería de desagüe (trazado al bajante)';
    const dest = disc === 'gas' ? 'medidor' : 'bajante';
    if (net && net.edges && net.edges.length) {
      // agrupar longitud por diámetro
      const byDia = {};
      for (const e of net.edges) {
        const L = Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1]) / 100;
        byDia[e.dia.mm] = byDia[e.dia.mm] || { mm: e.dia.mm, in: e.dia.in, m: 0 };
        byDia[e.dia.mm].m += L;
      }
      const drows = Object.values(byDia).sort((a, b) => a.mm - b.mm).map(d =>
        `<tr><td><b style="color:${diaColor(d.mm)}">Ø ${d.mm} mm</b></td><td>${d.in}</td><td class="num">${d.m.toFixed(2)}</td></tr>`).join('');
      const tot = Object.values(byDia).reduce((s, d) => s + d.m, 0);
      extra = `<h3 style="font-family:var(--display);margin:26px 0 10px">${label}</h3>
        <table class="data"><thead><tr><th>Diámetro</th><th>Pulg</th><th class="num">Longitud (m)</th></tr></thead>
        <tbody>${drows}</tbody>
        <tfoot><tr><td colspan="2" style="text-align:right"><b>Total tubería</b></td><td class="num"><b>${tot.toFixed(2)} m</b></td></tr></tfoot></table>`;
    } else {
      extra = `<div class="empty" style="padding:24px">Traza la ruta al ${dest} en <b>Modelo</b> para cuantificar tubería por diámetro.</div>`;
    }
  }

  el.innerHTML = `<div class="view">
    <h2>Cantidades · ${d.name}</h2>
    <div class="sub">${proj.name} · generado desde el modelo 2D</div>
    <table class="data"><thead><tr><th>Elemento</th><th>Disciplina</th><th class="num">Cantidad</th><th>Unidad</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${extra}
  </div>`;
}
