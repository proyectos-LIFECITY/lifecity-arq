/* Vista: disciplinas del proyecto (6 carpetas), con permiso por rol */
import Store from '../store.js';
import { canEdit, permissionLabel } from '../permissions.js';

const BADGE = { edit: ['edit', 'Editable'], view: ['view', 'Solo lectura'], lock: ['lock', 'Sin acceso'] };

export function renderProject(el, { slug, setCrumbs }) {
  const u = Store.currentUser();
  const proj = Store.project(slug);
  setCrumbs([{ label: 'Proyectos', href: '#/proyectos' }, { label: proj.name }]);

  const cards = Store.disciplines().map(d => {
    const perm = permissionLabel(u, d.id);
    const [cls, txt] = BADGE[perm];
    const locked = perm === 'lock';
    return `<div class="card ${locked ? 'locked' : ''}" data-disc="${d.id}">
      <span class="badge ${cls}">${txt}</span>
      <div class="disc-icon" style="background:${hexA(d.color, .16)};color:${d.color}">${d.icon}</div>
      <h3>${d.name}</h3>
      <div class="meta">${canEdit(u, d.id) ? 'Puedes modelar y editar.' : 'Puedes consultar y vincular.'}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="view">
    <h2>${proj.name}</h2>
    <div class="sub">${proj.city || ''} · Selecciona una disciplina. Ves todas; editas solo <b>${u.role}</b>.</div>
    <div class="grid">${cards}</div>
  </div>`;

  el.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => { location.hash = `#/p/${slug}/${c.dataset.disc}`; }));
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
