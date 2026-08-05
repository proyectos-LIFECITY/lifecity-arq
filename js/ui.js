/* Helpers de UI compartidos (modal, toast) */
export function modal(title, bodyHtml, opts = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" style="${opts.wide ? 'max-width:min(1100px,96vw)' : ''}">
    <header><h3>${title}</h3>${opts.actions || ''}<button class="btn sm ghost" data-x>✕</button></header>
    <div class="body">${bodyHtml}</div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.dataset.x !== undefined) close(); });
  return { close, el: bg };
}

export function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
