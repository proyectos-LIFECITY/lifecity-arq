/* ============================================================
   LifeCity ARQ · unifilar.js — Diagrama unifilar (SVG)
   Por tablero (apto) y resumen del edificio.
   Acometida → medidor → totalizador → barraje → circuitos ramales.
   ============================================================ */
import { panelSummary, RETIE } from './retie.js';
import { modal } from '../ui.js';

export function openUnifilar(scene, proj) {
  const panels = panelSummary(scene);
  if (!panels.length) { modal('Unifilar', `<div class="empty">Coloca un tablero y crea circuitos para generar el unifilar.</div>`); return; }

  const aptoTabs = panels.map((ps, i) => unifilarPanel(ps, i)).join('<hr style="border:0;border-top:1px solid var(--line);margin:24px 0">');
  const building = unifilarBuilding(panels, proj);

  modal(`Unifilar · ${proj.name}`, `
    <div class="sub" style="margin-bottom:14px">Diagrama por apto/tablero y consolidado del edificio. Calibres y protecciones según <code>retie.js</code> (RETIE 2026 · verificar contra norma).</div>
    <h3 style="font-family:var(--display);margin-bottom:10px">Por apartamento / tablero</h3>
    ${aptoTabs}
    <hr style="border:0;border-top:1px solid var(--line);margin:24px 0">
    <h3 style="font-family:var(--display);margin-bottom:10px">Edificio completo</h3>
    ${building}`, { wide: true });
}

function box(x, y, w, h, stroke = '#37455d') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="${stroke}" stroke-width="1.3"/>`;
}
function label(x, y, t, col = '#e6ecf5', size = 11, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-family="JetBrains Mono" fill="${col}">${t}</text>`;
}
function breakerSym(x, y, col = '#f4b942') { // símbolo de interruptor termomagnético
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="${col}" stroke-width="1.4"/><line x1="${x}" y1="${y + 10}" x2="${x + 8}" y2="${y + 3}" stroke="${col}" stroke-width="1.4"/><line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 28}" stroke="${col}" stroke-width="1.4"/>`;
}

function unifilarPanel(ps, idx) {
  const circuits = ps.circuits;
  const perRow = 6;
  const colW = 92, startX = 60, busY = 150, dropTop = busY, boxY = busY + 34;
  const cols = Math.max(circuits.length, 1);
  const width = Math.max(560, startX + cols * colW + 40);
  const height = boxY + 150;

  let s = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px;background:#0b0f16;border:1px solid var(--line);border-radius:10px">`;
  // acometida + medidor + totalizador
  const mainX = 40;
  s += label(mainX, 24, 'ACOMETIDA', '#8b97aa', 9, 'start');
  s += `<line x1="${mainX}" y1="30" x2="${mainX}" y2="60" stroke="#e6ecf5" stroke-width="1.6"/>`;
  s += `<circle cx="${mainX}" cy="72" r="12" fill="none" stroke="#4dd0e1" stroke-width="1.4"/>${label(mainX, 76, 'M', '#4dd0e1', 11)}`;
  s += label(mainX + 20, 76, 'Medidor', '#8b97aa', 9, 'start');
  s += `<line x1="${mainX}" y1="84" x2="${mainX}" y2="108" stroke="#e6ecf5" stroke-width="1.6"/>`;
  s += breakerSym(mainX, 108, '#ff5252');
  const totBrk = totalBreaker(ps.ampAcometida);
  s += label(mainX + 22, 128, `Totalizador ${totBrk}A`, '#ff5252', 9, 'start');
  s += `<line x1="${mainX}" y1="136" x2="${mainX}" y2="${busY}" stroke="#e6ecf5" stroke-width="1.6"/>`;
  // barraje
  const busEnd = startX + cols * colW;
  s += `<line x1="${mainX}" y1="${busY}" x2="${busEnd}" y2="${busY}" stroke="#f4b942" stroke-width="2.4"/>`;
  s += label(mainX, busY - 8, `Tablero ${idx + 1}`, '#f4b942', 11, 'start');

  circuits.forEach((c, i) => {
    const x = startX + i * colW + colW / 2;
    const col = c.kind === 'iluminacion' ? '#9c6bff' : '#f4b942';
    s += `<line x1="${x}" y1="${busY}" x2="${x}" y2="${boxY}" stroke="${col}" stroke-width="1.4"/>`;
    s += breakerSym(x - 4, boxY - 2, col);
    const by = boxY + 30;
    s += box(x - 34, by, 68, 66, col);
    s += label(x, by + 18, `C#${c.number}`, col, 12);
    s += label(x, by + 34, `${c.breaker}A`, '#e6ecf5', 11);
    s += label(x, by + 48, c.calibre.replace(' Cu', ''), '#8b97aa', 9);
    s += label(x, by + 60, `${c.count} sal·${c.va}VA`, '#8b97aa', 8);
    s += label(x, by + 84, c.kind === 'iluminacion' ? 'ILUM' : 'TOMAS', col, 8);
  });
  s += `</svg>`;
  return s;
}

function unifilarBuilding(panels, proj) {
  const levels = (proj.levels || []).length || panels.length;
  const colW = 130, startX = 70;
  const width = Math.max(560, startX + panels.length * colW + 40);
  const busY = 120, boxY = busY + 40, height = boxY + 130;
  let s = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:${width}px;background:#0b0f16;border:1px solid var(--line);border-radius:10px">`;
  const mainX = 40;
  s += label(mainX, 24, 'ACOMETIDA GENERAL', '#8b97aa', 9, 'start');
  s += `<line x1="${mainX}" y1="30" x2="${mainX}" y2="60" stroke="#e6ecf5" stroke-width="1.8"/>`;
  s += breakerSym(mainX, 60, '#ff5252');
  s += label(mainX + 22, 78, 'Totalizador general', '#ff5252', 9, 'start');
  s += `<line x1="${mainX}" y1="88" x2="${mainX}" y2="${busY}" stroke="#e6ecf5" stroke-width="1.8"/>`;
  const busEnd = startX + panels.length * colW;
  s += `<line x1="${mainX}" y1="${busY}" x2="${busEnd}" y2="${busY}" stroke="#f4b942" stroke-width="2.6"/>`;
  s += label(mainX, busY - 8, 'Barraje general', '#f4b942', 10, 'start');

  panels.forEach((ps, i) => {
    const x = startX + i * colW + colW / 2;
    s += `<line x1="${x}" y1="${busY}" x2="${x}" y2="${boxY}" stroke="#4dd0e1" stroke-width="1.4"/>`;
    s += breakerSym(x - 4, boxY - 2, '#4dd0e1');
    const by = boxY + 30;
    s += box(x - 52, by, 104, 74, '#4dd0e1');
    s += label(x, by + 18, `Tablero ${i + 1}`, '#4dd0e1', 12);
    s += label(x, by + 34, `${totalBreaker(ps.ampAcometida)}A`, '#e6ecf5', 11);
    s += label(x, by + 48, `${ps.circuits.length} circuitos`, '#8b97aa', 9);
    s += label(x, by + 64, `${Math.round(ps.vaDem)} VA dem`, '#8b97aa', 9);
  });
  const totVA = panels.reduce((a, p) => a + p.vaDem, 0);
  s += label(width - 20, height - 14, `Demanda edificio ≈ ${Math.round(totVA)} VA · ${(totVA / (RETIE.tension * RETIE.fp) / 1000).toFixed(1)} kA @ ${RETIE.tension}V · ${levels} niveles`, '#8b97aa', 10, 'end');
  s += `</svg>`;
  return s;
}

function totalBreaker(amp) { for (const b of [15, 20, 30, 40, 50, 60, 70, 100, 125]) if (b >= amp / 0.8) return b; return 150; }
