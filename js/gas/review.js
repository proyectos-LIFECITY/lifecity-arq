/* ============================================================
   LifeCity ARQ · gas/review.js — recomendaciones de gas
   Base: NTC 2505 / RETIE-gas (configurable, verificar contra norma).
   ============================================================ */
import { TYPES } from '../palettes.js';
import { loadOf } from './diameters.js';

export function reviewGas(scene, route) {
  const items = [];
  const appliances = scene.elements.filter(e => (TYPES[e.type] || {}).disc === 'gas' && !(TYPES[e.type] || {}).regulator);
  const meters = scene.elements.filter(e => e.type === 'medidor');
  const regs = scene.elements.filter(e => (TYPES[e.type] || {}).regulator);

  if (!meters.length) items.push({ level: 'err', tag: 'Medidor', msg: 'No hay medidor. En cada piso debe ir su medidor individual como punto de entrega.' });
  else items.push({ level: 'ok', tag: 'Medidor', msg: `${meters.length} medidor(es) colocado(s). Verifica uno por piso/apartamento.` });

  if (!regs.length) items.push({ level: 'warn', tag: 'Regulación', msg: 'No hay regulador RP-40. Coloca el regulador de servicio antes del medidor.' });

  const totKw = appliances.reduce((s, a) => s + loadOf(a.type), 0);
  if (appliances.length) items.push({ level: 'ok', tag: 'Carga', msg: `${appliances.length} artefactos · ${totKw.toFixed(1)} kW de potencia instalada.` });
  else items.push({ level: 'warn', tag: 'Artefactos', msg: 'No hay artefactos a gas colocados (estufa/calentador/secadora).' });

  if (route && route.edges && route.edges.length) {
    const maxMm = Math.max(...route.edges.map(e => e.dia.mm));
    const e = route.edges.find(x => x.dia.mm === maxMm);
    items.push({ level: 'ok', tag: 'Acometida interna', msg: `Tramo al medidor: Ø ${maxMm} mm (${e.dia.in}) para ${e.udes.toFixed(1)} kW acumulados.` });
    items.push({ level: 'ok', tag: 'Ruteo', msg: `Se evaluaron ${route.evaluated} rutas potenciales; se eligió la de menor costo (${Math.round(route.score)}). Tubería ${route.metrics.trenchM} m · ${route.metrics.bends} cambios de dirección · ${route.metrics.structAdj} tramos junto a estructura.` });
    items.push({ level: 'warn', tag: 'Longitud', msg: 'El diámetro depende de la longitud equivalente y la caída de presión admisible: recalcula si el recorrido es largo o hay muchos accesorios.' });
    if (route.metrics.structAdj > 0) items.push({ level: 'warn', tag: 'Estructura', msg: `${route.metrics.structAdj} tramo(s) discurren junto a estructura; usa pasamuros/camisas y evita empotrar sin protección.` });
  }

  const hayCalentador = appliances.some(a => a.type === 'calentador');
  if (hayCalentador) items.push({ level: 'warn', tag: 'Ventilación', msg: 'Calentador de paso: garantiza ventilación y evacuación de gases (tiro/ducto). No instalar en dormitorios ni baños sin cámara estanca.' });

  items.push({ level: 'ok', tag: 'Corte y prueba', msg: 'Prevé válvula de corte por artefacto y prueba de hermeticidad de la red antes de habilitar.' });
  return { items };
}
