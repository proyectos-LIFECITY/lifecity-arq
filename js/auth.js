/* ============================================================
   LifeCity ARQ · auth.js — guard de sesion para el SPA.
   Si no hay usuario logueado, redirige a login.html.
   ============================================================ */
import Store from './store.js';

export async function requireSession() {
  await Store.ready;
  const u = Store.currentUser();
  if (!u) { location.replace('login.html'); return null; }
  return u;
}
