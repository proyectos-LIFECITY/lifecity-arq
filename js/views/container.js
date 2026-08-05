/* Vista: contenedores de una disciplina (Modelo / Planos / Cantidades) */
import Store from '../store.js';
import { canEdit } from '../permissions.js';

export function renderContainer(el, { slug, disc, setCrumbs }) {
  const u = Store.currentUser();
  const proj = Store.project(slug);
  const d = Store.discipline(disc);
  const editable = canEdit(u, disc);
  setCrumbs([
    { label: 'Proyectos', href: '#/proyectos' },
    { label: proj.name, href: `#/p/${slug}` },
    { label: d.name },
  ]);

  const tiles = [
    { id: 'modelo', ic: '✒', name: 'Modelo', meta: editable ? 'Trazado 2D en planta' : 'Consulta 2D (solo lectura)' },
    { id: 'planos', ic: '📄', name: 'Planos', meta: 'Láminas y despieces' },
    { id: 'cantidades', ic: '🧮', name: 'Cantidades', meta: 'Tabla automática' },
  ].map(t => `<div class="tile" data-c="${t.id}">
      <div class="ic">${t.ic}</div><h3>${t.name}</h3><div class="meta">${t.meta}</div>
    </div>`).join('');

  el.innerHTML = `<div class="view">
    <h2>${d.name} <span class="pill">${editable ? 'editable' : 'solo lectura'}</span></h2>
    <div class="sub">${proj.name} · contenedores de la disciplina</div>
    <div class="tiles">${tiles}</div>
  </div>`;

  el.querySelectorAll('.tile').forEach(t =>
    t.addEventListener('click', () => { location.hash = `#/p/${slug}/${disc}/${t.dataset.c}`; }));
}
