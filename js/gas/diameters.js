/* ============================================================
   LifeCity ARQ · gas/diameters.js
   Dimensionamiento de tubería de GAS por potencia acumulada (kW).
   Base: NTC 2505 (instalaciones para suministro de gas).
   SIMPLIFICADO Y CONFIGURABLE: el diámetro real depende del tipo de
   gas (GN/GLP), presión, longitud equivalente y caída admisible.
   Verificar contra NTC 2505 y la ficha del gas. No se citan tablas.
   ============================================================ */
import { TYPES } from '../palettes.js';

// Potencia por aparato (kW) — configurable.
export const GAS_LOAD = {
  estufa: 8.0,       // estufa 4 puestos
  calentador: 20.0,  // calentador de paso
  lavadora: 5.3,     // secadora a gas
};

// Diámetro mínimo de acometida al aparato (mm).
export const MIN_MM = { estufa: 15, calentador: 20, lavadora: 15 };

// Tabla: potencia acumulada (kW) -> diámetro (mm / pulgadas). Configurable.
export const DIA_TABLE = [
  { maxKw: 6,   mm: 15, in: '½"' },
  { maxKw: 12,  mm: 20, in: '¾"' },
  { maxKw: 25,  mm: 25, in: '1"' },
  { maxKw: 45,  mm: 32, in: '1¼"' },
  { maxKw: 70,  mm: 40, in: '1½"' },
  { maxKw: 130, mm: 50, in: '2"' },
];

export function loadOf(type) {
  if (GAS_LOAD[type] != null) return GAS_LOAD[type];
  const t = TYPES[type] || {};
  return t.gas_pot || 0;
}
export function minOf(type) {
  if (MIN_MM[type] != null) return MIN_MM[type];
  return 15;
}
export function diameterFor(kw, minMm = 0) {
  let row = DIA_TABLE.find(r => kw <= r.maxKw) || DIA_TABLE[DIA_TABLE.length - 1];
  if (minMm > row.mm) row = DIA_TABLE.find(r => r.mm >= minMm) || row;
  return { mm: row.mm, in: row.in, kw };
}

// config de flujo para el motor de ruteo genérico
export const GAS_FLOW = { loadOf, minOf, diameterFor };
