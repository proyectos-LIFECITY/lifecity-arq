/* Vista: proyectos donde el usuario esta inscrito */
import Store from '../store.js';

export function renderProjects(el) {
  const u = Store.currentUser();
  const projects = Store.myProjects();
  const cards = projects.map(p => `
    <div class="card" data-slug="${p.slug}">
      <div class="disc-icon" style="background:rgba(244,185,66,.14);color:var(--accent)">▤</div>
      <h3>${p.name}</h3>
      <div class="meta">${p.city || ''} · ${p.levels ? p.levels.length + ' niveles' : ''}</div>
      <div class="meta" style="margin-top:8px;color:var(--text-faint)">${p.slug}</div>
    </div>`).join('');

  el.innerHTML = `<div class="view">
    <h2>Proyectos</h2>
    <div class="sub">Estás inscrito en ${projects.length} proyecto(s) · sesión: <b>${u.name}</b> (${u.role})</div>
    ${projects.length ? `<div class="grid">${cards}</div>` : `<div class="empty">No estás inscrito en ningún proyecto todavía.</div>`}
  </div>`;

  el.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => { location.hash = `#/p/${c.dataset.slug}`; }));
}
