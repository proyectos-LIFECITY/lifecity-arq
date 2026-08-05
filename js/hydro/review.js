/* ============================================================
   LifeCity ARQ · hydro/review.js — recomendaciones de desagüe
   Base: NTC 1500 / RAS (configurable, verificar contra norma).
   ============================================================ */
import { TYPES } from '../palettes.js';
import { udesOf } from './diameters.js';

// Pendiente mínima recomendada según diámetro (%). Configurable.
export function slopeFor(mm) {
  if (mm <= 75) return 2.0;      // ≤ 3": 2%
  if (mm <= 100) return 1.0;     // 4": 1%
  return 0.5;                     // ≥ 6": 0.5%
}

export function reviewHydro(scene, route) {
  const items = [];
  const fixtures = scene.elements.filter(e => (TYPES[e.type] || {}).disc === 'hidrosanitario');
  const bajantes = scene.elements.filter(e => (TYPES[e.type] || {}).riser);

  if (!bajantes.length) items.push({ level: 'err', tag: 'Bajante', msg: 'No hay bajante. Coloca un bajante (BR) como destino del ramal.' });
  if (!fixtures.length) items.push({ level: 'warn', tag: 'Aparatos', msg: 'No hay aparatos hidrosanitarios colocados.' });

  const totalUdes = fixtures.reduce((s, f) => s + udesOf(f.type), 0);
  if (fixtures.length) items.push({ level: 'ok', tag: 'Carga', msg: `${fixtures.length} aparatos · ${totalUdes} unidades de descarga (UDES) totales.` });

  if (route && route.edges && route.edges.length) {
    const maxMm = Math.max(...route.edges.map(e => e.dia.mm));
    const maxIn = route.edges.find(e => e.dia.mm === maxMm).dia.in;
    items.push({ level: 'ok', tag: 'Colector', msg: `Tramo hacia el bajante: Ø ${maxMm} mm (${maxIn}) para ${route.edges.find(e => e.dia.mm === maxMm).udes} UDES acumuladas.` });
    items.push({ level: 'ok', tag: 'Pendiente', msg: `Pendiente mínima recomendada ${slopeFor(maxMm)}% para Ø ${maxMm} mm. Verifica caída disponible en el recorrido.` });
    items.push({ level: 'ok', tag: 'Ruteo', msg: `Se evaluaron ${route.evaluated} rutas potenciales; se eligió la de menor costo (${Math.round(route.score)}). Zanja ${route.metrics.trenchM} m · ${route.metrics.bends} cambios de dirección · ${route.metrics.structAdj} tramos junto a estructura.` });
    if (route.metrics.structAdj > 0) items.push({ level: 'warn', tag: 'Estructura', msg: `${route.metrics.structAdj} tramo(s) discurren junto a un elemento estructural; confirma pases/refuerzos con el ingeniero estructural.` });
  }

  const hasWC = fixtures.some(f => f.type === 'sanitario');
  if (hasWC) items.push({ level: 'warn', tag: 'Sanitario', msg: 'Todo inodoro descarga con Ø mínimo 100 mm (4"). No reducir aguas abajo del sanitario.' });

  items.push({ level: 'ok', tag: 'Ventilación', msg: 'Prevé ventilación del ramal (tubo de ventilación / reventilación) para no sifonar los sifones. Distancia sifón–ventilación según norma.' });
  items.push({ level: 'ok', tag: 'Registros', msg: 'Coloca registros de inspección en cambios de dirección y cada tramo largo del colector.' });
  return { items };
}
