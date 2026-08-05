/* ============================================================
   LifeCity ARQ · permissions.js
   Regla de permisos por rol -> disciplina:
     - VER: un diseñador inscrito ve TODAS las disciplinas del proyecto.
     - EDITAR: solo la disciplina que coincide con su rol.
     - admin: ve y edita todo.
   (El ing. electrico ve hidro/estructura/etc. pero solo edita Electrico.)
   ============================================================ */
export function canView(user, _disc) {
  return !!user; // inscrito => ve todas las disciplinas
}

export function canEdit(user, disc) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === disc;
}

export function permissionLabel(user, disc) {
  if (canEdit(user, disc)) return 'edit';
  if (canView(user, disc)) return 'view';
  return 'lock';
}
