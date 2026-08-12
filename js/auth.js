/* ============================================================
   LifeCity ARQ · auth.js — guard de sesion para el SPA.
   Si no hay usuario logueado, redirige a login.html.
   ============================================================ */
import Store from './store.js';

export async function requireSession() {
  await Store.ready;
  // Beta: sin muro de credenciales. Si no hay sesión, entra como invitado
  // (demo con acceso total). El login sigue en login.html para cambiar de rol.
  const u = Store.currentUser() || Store.autoGuest();
  return u;
}
