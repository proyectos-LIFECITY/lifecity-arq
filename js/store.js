/* ============================================================
   LifeCity ARQ · store.js — capa de datos local-first
   Espeja el esquema del BIM Hub (users / projects / memberships /
   models / planos). Hoy persiste en localStorage; manana los mismos
   metodos apuntan al Worker Cloudflare (bim-hub) sin tocar la UI.

   API publica:
     await Store.ready
     Store.disciplines()               -> [{id,name,color,icon}]
     Store.discipline(id)
     Store.currentUser() / Store.login(email,pass) / Store.logout()
     Store.myProjects()                -> proyectos donde el user esta inscrito
     Store.project(slug)
     Store.getScene(slug, disc)        -> {elements, circuits, routes, links}
     Store.saveScene(slug, disc, scene)
   ============================================================ */
const LS_SESSION = 'lcarq_session';
const LS_SCENE   = (slug, disc) => `lcarq_scene_${slug}_${disc}`;
const LS_DB      = 'lcarq_db_v1';

const Store = (() => {
  let db = null;                 // {disciplines, users, projects, memberships}
  let user = null;

  async function loadDb() {
    // 1) intenta cache local (permite crear usuarios/proyectos offline)
    try {
      const cached = JSON.parse(localStorage.getItem(LS_DB) || 'null');
      if (cached && cached.users) { db = cached; return; }
    } catch (_) {}
    // 2) baja el seed
    const res = await fetch('data/seed.json', { cache: 'no-store' });
    db = await res.json();
    persistDb();
  }
  function persistDb() { try { localStorage.setItem(LS_DB, JSON.stringify(db)); } catch (_) {} }

  async function init() {
    await loadDb();
    try {
      const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
      if (s && s.userId) user = db.users.find(u => u.id === s.userId) || null;
    } catch (_) {}
  }
  const ready = init();

  // ---- auth (demo local; en produccion => POST /api/login del hub) ----
  function login(email, pass) {
    const u = db.users.find(x => x.email.toLowerCase() === String(email).toLowerCase().trim());
    if (!u || u.pass !== pass) return { ok: false, error: 'Credenciales inválidas' };
    user = u;
    localStorage.setItem(LS_SESSION, JSON.stringify({ userId: u.id, at: Date.now() }));
    return { ok: true, user: publicUser(u) };
  }
  function logout() { user = null; localStorage.removeItem(LS_SESSION); }
  function publicUser(u) { return u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null; }
  function currentUser() { return publicUser(user); }

  // Entrada sin credenciales (beta): si no hay sesión, entra como demo con
  // acceso total. No borra el login: solo evita el muro al inicio.
  // (El login sigue disponible en login.html para cambiar de usuario/rol.)
  function autoGuest() {
    if (user) return publicUser(user);
    const u = db.users.find(x => x.role === 'admin') || db.users[0];
    if (u) { user = u; localStorage.setItem(LS_SESSION, JSON.stringify({ userId: u.id, at: Date.now(), guest: true })); }
    return publicUser(user);
  }

  // ---- proyectos / disciplinas ----
  function disciplines() { return db.disciplines.slice(); }
  function discipline(id) { return db.disciplines.find(d => d.id === id) || null; }
  function project(slug) { return db.projects.find(p => p.slug === slug) || null; }
  function myProjects() {
    if (!user) return [];
    if (user.role === 'admin') return db.projects.slice();
    const slugs = new Set(db.memberships.filter(m => m.userId === user.id).map(m => m.slug));
    return db.projects.filter(p => slugs.has(p.slug));
  }
  function isMember(slug) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return db.memberships.some(m => m.userId === user.id && m.slug === slug);
  }

  // ---- escenas (modelo 2D por proyecto+disciplina) ----
  function emptyScene() { return { elements: [], circuits: [], routes: [], links: [], underlay: null, seq: 0, circuitSeq: {} }; }
  function getScene(slug, disc) {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SCENE(slug, disc)) || 'null');
      if (s) return Object.assign(emptyScene(), s);
    } catch (_) {}
    return emptyScene();
  }
  function saveScene(slug, disc, scene) {
    localStorage.setItem(LS_SCENE(slug, disc), JSON.stringify(scene));
  }

  return {
    ready,
    disciplines, discipline, project, myProjects, isMember,
    currentUser, login, logout, autoGuest,
    getScene, saveScene, emptyScene,
    _db: () => db,
  };
})();

export default Store;
