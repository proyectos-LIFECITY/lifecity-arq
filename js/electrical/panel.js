/* ============================================================
   LifeCity ARQ · panel.js — Cuadro de cargas del tablero
   Tomas a un lado, iluminación al otro (orden de creación).
   ============================================================ */
import { panelSummary, RETIE } from './retie.js';
import { modal } from '../ui.js';

export function openPanelDiagram(scene, proj) {
  const panels = panelSummary(scene);
  if (!panels.length) { modal('Cuadro de cargas', `<div class="empty">Coloca un tablero y crea circuitos para generar el cuadro de cargas.</div>`); return; }

  const blocks = panels.map((ps, i) => {
    const rowsT = ps.tomas.map(c => circRow(c)).join('') || emptyRow();
    const rowsL = ps.ilum.map(c => circRow(c)).join('') || emptyRow();
    return `
      <h3 style="font-family:var(--display);margin:${i ? '22' : '4'}px 0 10px">Tablero ${i + 1} <span class="pill">apto/zona</span></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Circuitos de Tomas</div>
          <table class="data"><thead><tr><th>#</th><th>Sal</th><th class="num">VA</th><th>Brk</th><th>Conductor</th></tr></thead><tbody>${rowsT}</tbody></table>
        </div>
        <div>
          <div style="font-size:11px;color:var(--viol);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Circuitos de Iluminación</div>
          <table class="data"><thead><tr><th>#</th><th>Sal</th><th class="num">VA</th><th>Brk</th><th>Conductor</th></tr></thead><tbody>${rowsL}</tbody></table>
        </div>
      </div>
      <div style="display:flex;gap:22px;margin-top:12px;font-size:12px;flex-wrap:wrap">
        <div>Carga instalada: <b>${ps.vaTot} VA</b></div>
        <div>Demanda (×${RETIE.factorDemanda}): <b>${Math.round(ps.vaDem)} VA</b></div>
        <div>Corriente acometida: <b>${ps.ampAcometida} A</b></div>
        <div>Protección total sugerida: <b>${totalBreaker(ps.ampAcometida)} A</b></div>
      </div>`;
  }).join('');

  modal(`Cuadro de cargas · ${proj.name}`, blocks, { wide: true });
}

function circRow(c) {
  return `<tr><td><b>${c.number}</b></td><td>${c.count}</td><td class="num">${c.va}</td><td>${c.breaker}A</td><td>${c.calibre}</td></tr>`;
}
function emptyRow() { return `<tr><td colspan="5" style="color:var(--text-dim);text-align:center">— sin circuitos —</td></tr>`; }
function totalBreaker(amp) { for (const b of [15, 20, 30, 40, 50, 60, 70, 100]) if (b >= amp / 0.8) return b; return 125; }
