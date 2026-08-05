/* ============================================================
   LifeCity ARQ · palettes.js
   Definicion de aparatos por disciplina + simbolos SVG en planta.
   Cada simbolo se dibuja centrado en (0,0) en "unidades mundo"
   (~24 u = tamaño nominal). El editor lo ubica con translate/rotate.
   Las cargas (va) alimentan el motor RETIE.
   ============================================================ */

// helpers de simbolo (devuelven markup SVG, color via currentColor)
const S = 11; // radio nominal

function txt(t, dy = 4, size = 10) {
  return `<text x="0" y="${dy}" text-anchor="middle" font-size="${size}" font-family="JetBrains Mono, monospace" fill="currentColor" font-weight="600">${t}</text>`;
}

const SYMBOLS = {
  // ---------- ELÉCTRICO ----------
  tablero: () => `<rect x="-13" y="-9" width="26" height="18" rx="2" fill="rgba(244,185,66,.18)" stroke="currentColor" stroke-width="1.6"/>${txt('T', 4)}`,
  toma_normal: () => `<circle r="${S}" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-${S}" y1="0" x2="${S}" y2="0" stroke="currentColor" stroke-width="1.6"/><line x1="-4" y1="-5" x2="-4" y2="0" stroke="currentColor" stroke-width="1.4"/><line x1="4" y1="-5" x2="4" y2="0" stroke="currentColor" stroke-width="1.4"/>`,
  toma_gfci: () => `<circle r="${S}" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-${S}" y1="0" x2="${S}" y2="0" stroke="currentColor" stroke-width="1.6"/>${txt('GFI', -3, 7)}`,
  toma_220: () => `<circle r="${S}" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-${S}" y1="0" x2="${S}" y2="0" stroke="currentColor" stroke-width="1.6"/>${txt('220', -3, 7)}`,
  luminaria: () => `<circle r="${S}" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-7" y1="-7" x2="7" y2="7" stroke="currentColor" stroke-width="1.4"/><line x1="7" y1="-7" x2="-7" y2="7" stroke="currentColor" stroke-width="1.4"/>`,
  interruptor: () => `${txt('S', 5, 13)}<line x1="4" y1="-8" x2="10" y2="-13" stroke="currentColor" stroke-width="1.4"/>`,

  // ---------- HIDROSANITARIO ----------
  lavamanos: () => `<ellipse rx="12" ry="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="1.6" cy="-3" fill="currentColor"/>`,
  ducha: () => `<rect x="-11" y="-11" width="22" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  sanitario: () => `<ellipse rx="8" ry="11" cy="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="-9" y="-13" width="18" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  lavaplatos: () => `<rect x="-13" y="-9" width="26" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="-5" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  sifon: () => `<circle r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-6" y1="-6" x2="6" y2="6" stroke="currentColor" stroke-width="1.3"/><line x1="6" y1="-6" x2="-6" y2="6" stroke="currentColor" stroke-width="1.3"/>`,
  poceta: () => `<rect x="-12" y="-10" width="24" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>${txt('P', 4, 9)}`,
  lavadero: () => `<rect x="-13" y="-10" width="26" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="-13" y1="0" x2="13" y2="0" stroke="currentColor" stroke-width="1.2"/>`,
  lavadora: () => `<rect x="-11" y="-12" width="22" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="6" fill="none" stroke="currentColor" stroke-width="1.3"/>`,

  // ---------- GAS ----------
  rp40: () => `<rect x="-12" y="-8" width="24" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>${txt('RP40', 4, 7)}`,
  estufa: () => `<rect x="-12" y="-12" width="24" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="-5" cy="-5" r="2.4" fill="currentColor"/><circle cx="5" cy="-5" r="2.4" fill="currentColor"/><circle cx="-5" cy="5" r="2.4" fill="currentColor"/><circle cx="5" cy="5" r="2.4" fill="currentColor"/>`,
  calentador: () => `<circle r="12" fill="none" stroke="currentColor" stroke-width="1.6"/>${txt('CAL', 3, 7)}`,

  // ---------- ESTRUCTURA (obstáculos para ruteo) ----------
  columna: () => `<rect x="-20" y="-20" width="40" height="40" rx="2" fill="rgba(201,139,91,.25)" stroke="currentColor" stroke-width="1.6"/>`,
  viga: () => `<rect x="-100" y="-15" width="200" height="30" fill="rgba(201,139,91,.14)" stroke="currentColor" stroke-width="1.4" stroke-dasharray="6 4"/>`,
  muro: () => `<rect x="-100" y="-8" width="200" height="16" fill="rgba(201,139,91,.3)" stroke="currentColor" stroke-width="1.2"/>`,

  // ---------- COMÚN (todas las disciplinas) ----------
  medidor: () => `<circle r="${S}" fill="none" stroke="currentColor" stroke-width="1.6"/>${txt('M', 4, 11)}`,
  bajante: () => `<circle r="9" fill="rgba(77,208,225,.18)" stroke="currentColor" stroke-width="1.6"/>${txt('BR', 3, 7)}`,
};

// Definición de aparatos por disciplina
export const PALETTES = {
  electrico: {
    groups: [
      { title: 'Tablero', items: ['tablero'] },
      { title: 'Tomas', items: ['toma_normal', 'toma_gfci', 'toma_220'] },
      { title: 'Iluminación', items: ['luminaria', 'interruptor'] },
      { title: 'Común', items: ['medidor'] },
    ],
  },
  hidrosanitario: {
    groups: [
      { title: 'Aparatos', items: ['lavamanos', 'ducha', 'sanitario', 'lavaplatos'] },
      { title: 'Desagües', items: ['sifon', 'poceta', 'lavadero', 'bajante'] },
      { title: 'Electrodomésticos', items: ['lavadora'] },
      { title: 'Común', items: ['medidor'] },
    ],
  },
  gas: {
    groups: [
      { title: 'Aparatos', items: ['estufa', 'calentador', 'lavadora'] },
      { title: 'Regulación', items: ['rp40'] },
      { title: 'Común', items: ['medidor', 'bajante'] },
    ],
  },
  arquitectura: { groups: [{ title: 'Común', items: ['medidor'] }] },
  estructura: { groups: [{ title: 'Estructura', items: ['columna', 'viga', 'muro'] }, { title: 'Común', items: ['medidor'] }] },
  hvac: { groups: [{ title: 'Común', items: ['medidor'] }] },
};

// Metadatos de cada tipo (nombre visible, carga VA para RETIE, unidades hidráulicas)
export const TYPES = {
  tablero:     { name: 'Tablero',        disc: 'electrico', va: 0,    panel: true },
  toma_normal: { name: 'Toma normal',    disc: 'electrico', va: 180,  circuitable: 'tomas' },
  toma_gfci:   { name: 'Toma GFCI',      disc: 'electrico', va: 180,  circuitable: 'tomas', gfci: true },
  toma_220:    { name: 'Toma 220V',      disc: 'electrico', va: 2000, circuitable: 'tomas', v: 220, dedicated: true },
  luminaria:   { name: 'Luminaria',      disc: 'electrico', va: 100,  circuitable: 'iluminacion' },
  interruptor: { name: 'Interruptor',    disc: 'electrico', va: 0 },
  medidor:     { name: 'Medidor',        disc: 'comun',     va: 0 },
  bajante:     { name: 'Bajante',        disc: 'comun',     riser: true },

  lavamanos:   { name: 'Lavamanos',      disc: 'hidrosanitario', uc: 1,   d_min: 12.7 },
  ducha:       { name: 'Ducha',          disc: 'hidrosanitario', uc: 2,   d_min: 12.7 },
  sanitario:   { name: 'Sanitario',      disc: 'hidrosanitario', uc: 3,   d_min: 12.7, desague: 100 },
  lavaplatos:  { name: 'Lavaplatos',     disc: 'hidrosanitario', uc: 2,   d_min: 12.7, desague: 50 },
  sifon:       { name: 'Sifón',          disc: 'hidrosanitario', uc: 1,   desague: 50 },
  poceta:      { name: 'Poceta',         disc: 'hidrosanitario', uc: 3,   desague: 75 },
  lavadero:    { name: 'Lavadero',       disc: 'hidrosanitario', uc: 2,   desague: 50 },
  lavadora:    { name: 'Lavadora',       disc: 'hidrosanitario', uc: 2,   desague: 50, va: 1200, gas_pot: 0 },

  estufa:      { name: 'Estufa',         disc: 'gas', gas_pot: 3.2 },
  calentador:  { name: 'Calentador',     disc: 'gas', gas_pot: 4.5 },
  rp40:        { name: 'Regulador RP-40',disc: 'gas', gas_pot: 0, regulator: true },

  columna:     { name: 'Columna',        disc: 'estructura', obstacle: true, w: 40,  h: 40 },
  viga:        { name: 'Viga',           disc: 'estructura', obstacle: true, w: 200, h: 30 },
  muro:        { name: 'Muro',           disc: 'estructura', obstacle: true, w: 200, h: 16 },
};

export function symbolMarkup(type) {
  const fn = SYMBOLS[type];
  return fn ? fn() : `<circle r="9" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
}

export function typeName(type) { return (TYPES[type] && TYPES[type].name) || type; }
