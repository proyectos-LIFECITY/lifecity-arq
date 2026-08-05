/* ============================================================
   LifeCity ARQ · retie.js — motor de reglas RETIE 2026
   Base: Resolución 40284 de 2026 (modifica el RETIE) + NTC 2050.
   IMPORTANTE: las constantes son CONFIGURABLES y deben verificarse
   contra el texto oficial del reglamento. No se citan números de
   cláusula; se aplican principios de diseño ampliamente aceptados.
   Fuente única de cálculo de circuitos para panel.js y unifilar.js.
   ============================================================ */
import { TYPES } from '../palettes.js';
import { circuitLengthM } from './circuits.js';

export const RETIE = {
  tension: 120,              // V (fase-neutro, residencial monofásico)
  fp: 0.9,                   // factor de potencia asumido
  factorContinuo: 0.8,      // 80% de la protección para carga continua
  va: { toma: 180, luminaria: 100 }, // cargas típicas por salida (NTC 2050)
  breakerPorTipo: { tomas: 20, iluminacion: 15 }, // A
  calibre: { 15: '#14 AWG Cu', 20: '#12 AWG Cu', 30: '#10 AWG Cu', 40: '#8 AWG Cu', 50: '#6 AWG Cu' },
  maxSalidas: { tomas: 10, iluminacion: 12 },  // guía práctica
  tecnicoMaxVA: 15000,       // 2026: técnicos/tecnólogos hasta 15.000 VA
  factorDemanda: 0.7,        // factor de demanda global (residencial)
};

/* Carga (VA) de un elemento */
function elVA(el) {
  if (el.props && el.props.va != null) return +el.props.va;
  const t = TYPES[el.type] || {};
  return t.va || 0;
}

/* breaker comercial >= amperaje requerido */
function pickBreaker(amp) {
  for (const b of [15, 20, 30, 40, 50, 60]) if (b >= amp) return b;
  return 60;
}

/* Cálculo por circuito — fuente única de verdad */
export function computeCircuits(scene) {
  return scene.circuits.map(c => {
    const els = c.elementIds.map(id => scene.elements.find(e => e.id === id)).filter(Boolean);
    const va = els.reduce((s, e) => s + elVA(e), 0);
    const amp = va / (RETIE.tension * RETIE.fp);
    const ampProt = amp / RETIE.factorContinuo;              // dimensionar al 80%
    const breakerBase = RETIE.breakerPorTipo[c.kind] || 20;
    const breaker = Math.max(breakerBase, pickBreaker(ampProt));
    const dedicated = els.some(e => (TYPES[e.type] || {}).dedicated);
    return {
      id: c.id, number: c.number, kind: c.kind, panelId: c.panelId,
      count: els.length, va, amp: +amp.toFixed(1),
      breaker, calibre: RETIE.calibre[breaker] || RETIE.calibre[40],
      dedicated, lengthM: +circuitLengthM(scene, c).toFixed(1),
    };
  });
}

/* Cargas totales y por tablero */
export function panelSummary(scene) {
  const cc = computeCircuits(scene);
  const panels = scene.elements.filter(e => (TYPES[e.type] || {}).panel);
  return panels.map(p => {
    const mine = cc.filter(c => c.panelId === p.id);
    const tomas = mine.filter(c => c.kind === 'tomas');
    const ilum = mine.filter(c => c.kind === 'iluminacion');
    const vaTot = mine.reduce((s, c) => s + c.va, 0);
    const vaDem = vaTot * RETIE.factorDemanda;
    return { panel: p, tomas, ilum, circuits: mine, vaTot, vaDem,
      ampAcometida: +(vaDem / (RETIE.tension * RETIE.fp)).toFixed(1) };
  });
}

/* Revisión / recomendaciones RETIE 2026 */
export function retieReview(scene) {
  const items = [];
  const cc = computeCircuits(scene);
  const panels = scene.elements.filter(e => (TYPES[e.type] || {}).panel);
  const tomas = scene.elements.filter(e => (TYPES[e.type] || {}).circuitable === 'tomas');
  const lums = scene.elements.filter(e => (TYPES[e.type] || {}).circuitable === 'iluminacion');

  if (!panels.length) items.push({ level: 'err', tag: 'Tablero', msg: 'No hay tablero. Coloca al menos un tablero (T) para organizar los circuitos.' });

  // salidas sin circuito
  const enCircuito = new Set(cc.flatMap(c => scene.circuits.find(x => x.id === c.id).elementIds));
  const sueltasT = tomas.filter(e => !enCircuito.has(e.id)).length;
  const sueltasL = lums.filter(e => !enCircuito.has(e.id)).length;
  if (sueltasT) items.push({ level: 'warn', tag: 'Tomas', msg: `${sueltasT} toma(s) sin circuito asignado. Selecciónalas con el tablero y crea su circuito.` });
  if (sueltasL) items.push({ level: 'warn', tag: 'Iluminación', msg: `${sueltasL} luminaria(s) sin circuito. Crea su circuito de iluminación.` });

  for (const c of cc) {
    const capVA = c.breaker * RETIE.tension * RETIE.fp * RETIE.factorContinuo;
    if (c.va > capVA) items.push({ level: 'err', tag: `Circuito #${c.number}`, msg: `Carga ${c.va} VA supera la capacidad continua del breaker ${c.breaker}A (${Math.round(capVA)} VA). Divide el circuito.` });
    const max = RETIE.maxSalidas[c.kind];
    if (c.count > max) items.push({ level: 'warn', tag: `Circuito #${c.number}`, msg: `${c.count} salidas en un circuito de ${c.kind}; se recomienda ≤ ${max}.` });
    if (c.dedicated && c.count > 1) items.push({ level: 'warn', tag: `Circuito #${c.number}`, msg: `Incluye una carga que debería ir en circuito DEDICADO (220V/electrodoméstico). Sepárala.` });
    items.push({ level: 'ok', tag: `Circuito #${c.number}`, msg: `${c.kind} · ${c.count} sal · ${c.va} VA · breaker ${c.breaker}A · conductor ${c.calibre}.` });
  }

  // GFCI en zonas húmedas
  const hayGfci = tomas.some(e => (TYPES[e.type] || {}).gfci);
  if (tomas.length && !hayGfci) items.push({ level: 'warn', tag: 'GFCI', msg: 'No hay tomas GFCI. En baños, cocina, zona de ropas y exteriores el RETIE exige protección diferencial (GFCI).' });

  // carga total y alcance de técnico 2026
  const vaTot = cc.reduce((s, c) => s + c.va, 0);
  const vaDem = Math.round(vaTot * RETIE.factorDemanda);
  if (vaTot) {
    items.push({ level: 'ok', tag: 'Carga total', msg: `Instalada ${vaTot} VA · demanda estimada ${vaDem} VA (factor ${RETIE.factorDemanda}).` });
    if (vaDem <= RETIE.tecnicoMaxVA) items.push({ level: 'ok', tag: 'Alcance 2026', msg: `≤ ${RETIE.tecnicoMaxVA} VA: dentro del alcance de técnicos/tecnólogos electricistas (novedad RETIE 2026).` });
    else items.push({ level: 'warn', tag: 'Alcance 2026', msg: `> ${RETIE.tecnicoMaxVA} VA: requiere ingeniero electricista matriculado.` });
  }

  items.push({ level: 'ok', tag: 'Puesta a tierra', msg: 'Recuerda conductor de protección (tierra) en todos los circuitos y barraje equipotencial en el tablero.' });
  return { items, circuits: cc };
}
