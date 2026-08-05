/* ============================================================
   LifeCity ARQ · hydro/diameters.js
   Dimensionamiento de tubería de DESAGÜE por unidades de descarga
   (UDES). Base: NTC 1500 (Código Colombiano de Fontanería) / RAS.
   IMPORTANTE: las tablas son CONFIGURABLES y deben verificarse
   contra el texto oficial. No se citan números de tabla.
   ============================================================ */
import { TYPES } from '../palettes.js';

// Unidades de descarga por aparato (UDES) — valores típicos, configurables.
export const UDES = {
  sanitario: 4,
  lavamanos: 1,
  ducha: 2,
  lavaplatos: 2,
  lavadero: 2,
  lavadora: 2,
  poceta: 3,
  sifon: 1,
};

// Diámetro mínimo del sifón/desagüe individual por aparato (mm).
export const MIN_MM = {
  sanitario: 100, lavaplatos: 50, lavamanos: 38, ducha: 50,
  lavadero: 50, lavadora: 50, poceta: 75, sifon: 50,
};

// Tabla ramal horizontal: UDES acumuladas -> diámetro (mm / pulgadas).
// Configurable; ordenada de menor a mayor.
export const DIA_TABLE = [
  { maxUdes: 1,   mm: 38,  in: '1½"' },
  { maxUdes: 3,   mm: 50,  in: '2"' },
  { maxUdes: 6,   mm: 63,  in: '2½"' },
  { maxUdes: 20,  mm: 75,  in: '3"' },
  { maxUdes: 160, mm: 100, in: '4"' },
  { maxUdes: 360, mm: 150, in: '6"' },
];

export function udesOf(type) {
  if (UDES[type] != null) return UDES[type];
  const t = TYPES[type] || {};
  return t.uc || 1;
}

export function minMmOf(type) {
  if (MIN_MM[type] != null) return MIN_MM[type];
  const t = TYPES[type] || {};
  return t.desague || 50;
}

/* Diámetro por UDES acumuladas, respetando un mínimo (mm) */
export function diameterFor(udes, minMm = 0) {
  let row = DIA_TABLE.find(r => udes <= r.maxUdes) || DIA_TABLE[DIA_TABLE.length - 1];
  if (minMm > row.mm) {
    row = DIA_TABLE.find(r => r.mm >= minMm) || row;
  }
  return { mm: row.mm, in: row.in, udes };
}

// color por diámetro (para dibujar segmentos)
export function diaColor(mm) {
  if (mm <= 38) return '#6bd96b';
  if (mm <= 50) return '#4dd0e1';
  if (mm <= 63) return '#f4b942';
  if (mm <= 75) return '#ff7a45';
  return '#ff5252';
}
