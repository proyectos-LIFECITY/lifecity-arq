/* ============================================================
   LifeCity ARQ · app.js — SPA shell + hash router
   Rutas:
     #/proyectos                      -> proyectos inscritos
     #/p/:slug                        -> disciplinas del proyecto
     #/p/:slug/:disc                  -> contenedores (Modelo/Planos/Cantidades)
     #/p/:slug/:disc/modelo           -> editor 2D
     #/p/:slug/:disc/planos           -> planos
     #/p/:slug/:disc/cantidades       -> cantidades
   ============================================================ */
import Store from './store.js';
import { requireSession } from './auth.js';
import { renderProjects } from './views/projects.js';
import { renderProject } from './views/project.js';
import { renderContainer } from './views/container.js';
import { mountEditor } from './editor2d.js';
import { renderQuantities } from './quantities.js';

const root = document.getElementById('root');
const crumbsEl = document.getElementById('crumbs');
const userchip = document.getElementById('userchip');

function setCrumbs(items) {
  crumbsEl.innerHTML = items.map((it, i) => {
    const sep = i ? '<span class="sep">/</span>' : '';
    return it.href
      ? `${sep}<a href="${it.href}">${it.label}</a>`
      : `${sep}<span class="cur">${it.label}</span>`;
  }).join(' ');
}

function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  return h.split('/').filter(Boolean); // e.g. ['p','torre-cali-99','electrico','modelo']
}

async function route() {
  const u = Store.currentUser();
  if (!u) { location.replace('login.html'); return; }
  const parts = parse();

  // default
  if (parts.length === 0 || parts[0] === 'proyectos') {
    setCrumbs([{ label: 'Proyectos' }]);
    return renderProjects(root, { setCrumbs });
  }

  if (parts[0] === 'p') {
    const slug = parts[1];
    const disc = parts[2];
    const container = parts[3];
    const proj = Store.project(slug);
    if (!proj || !Store.isMember(slug)) { location.hash = '#/proyectos'; return; }

    if (!disc) return renderProject(root, { slug, setCrumbs });
    if (!container) return renderContainer(root, { slug, disc, setCrumbs });

    if (container === 'modelo')     return mountEditor(root, { slug, disc, setCrumbs });
    if (container === 'cantidades') return renderQuantities(root, { slug, disc, setCrumbs });
    if (container === 'planos')     return renderPlanos(root, { slug, disc, setCrumbs });
  }

  location.hash = '#/proyectos';
}

function renderPlanos(el, { slug, disc, setCrumbs }) {
  const proj = Store.project(slug), d = Store.discipline(disc);
  setCrumbs([
    { label: 'Proyectos', href: '#/proyectos' },
    { label: proj.name, href: `#/p/${slug}` },
    { label: d.name, href: `#/p/${slug}/${disc}` },
    { label: 'Planos' },
  ]);
  el.innerHTML = `<div class="view"><h2>Planos · ${d.name}</h2>
    <div class="sub">${proj.name}</div>
    <div class="empty">📄 El contenedor de <b>Planos</b> (láminas PDF/DWG) se conecta al BIM Hub en la fase de publicación.<br>
    Por ahora el trazado se hace en <b>Modelo</b> (2D) y las láminas se generan desde ahí.</div></div>`;
}

function renderChip() {
  const u = Store.currentUser();
  if (!u) return;
  userchip.innerHTML = `<span>${u.name}</span><span class="role">${u.role}</span>`;
}

document.getElementById('btn-logout').addEventListener('click', () => {
  Store.logout(); location.replace('login.html');
});

(async () => {
  const u = await requireSession();
  if (!u) return;
  renderChip();
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/proyectos';
  else route();
})();
