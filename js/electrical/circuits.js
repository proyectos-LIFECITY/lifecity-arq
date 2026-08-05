/* ============================================================
   LifeCity ARQ · circuits.js
   Creación de circuitos y su geometría (línea punteada en planta).
   El número se asigna por ORDEN DE CREACIÓN (contador monotónico).
   ============================================================ */

export function nextCircuitNumber(scene) {
  scene.circuitCounter = (scene.circuitCounter || 0) + 1;
  return scene.circuitCounter;
}

export function makeCircuit(scene, panelId, elementIds, kind) {
  const number = nextCircuitNumber(scene);
  const c = {
    id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    panelId, kind, number,
    elementIds: [...elementIds],   // se conserva el orden de selección
  };
  scene.circuits.push(c);
  return c;
}

/* Polilínea tablero -> salidas (en orden de creación) para dibujar punteado */
export function circuitPolyline(scene, c) {
  const panel = scene.elements.find(e => e.id === c.panelId);
  const pts = [];
  if (panel) pts.push([panel.x, panel.y]);
  for (const id of c.elementIds) {
    const e = scene.elements.find(x => x.id === id);
    if (e) pts.push([e.x, e.y]);
  }
  return pts;
}

/* Longitud del circuito en metros (para cantidades de conductor) */
export function circuitLengthM(scene, c) {
  const pts = circuitPolyline(scene, c);
  let cm = 0;
  for (let i = 1; i < pts.length; i++) {
    cm += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return cm / 100;
}
