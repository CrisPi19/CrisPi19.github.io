/*
 * Tema claro/oscuro.
 *
 * Se carga como script clásico (no módulo) dentro de <head> para aplicar el
 * tema ANTES de pintar la página y evitar un parpadeo de colores.
 *
 * Sin elección guardada se sigue la preferencia del sistema (ver tokens.css).
 * Cualquier botón con el atributo data-theme-toggle alterna el tema.
 */
(function () {
  var KEY = 'pianoTrainer.v1.theme';
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* sin almacenamiento: solo dura esta visita */ }
  }

  function effectiveTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateButtons() {
    var dark = effectiveTheme() === 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = dark ? '☀' : '☾';
      buttons[i].setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      buttons[i].title = buttons[i].getAttribute('aria-label');
    }
  }

  var saved = read();
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  document.addEventListener('DOMContentLoaded', function () {
    updateButtons();
    document.addEventListener('click', function (event) {
      if (!event.target.closest('[data-theme-toggle]')) return;
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      write(next);
      updateButtons();
    });
  });
})();
