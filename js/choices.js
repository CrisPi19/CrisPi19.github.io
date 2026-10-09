/*
 * Botones de respuesta múltiple (HTML), sin atajos de teclado (se eligen con clic).
 * Primera entrada que no pasa por el piano: la usa Reconocer (módulo 5) y podrán usarla
 * otros módulos. No sabe cuál es la correcta hasta que se le dice con reveal().
 *
 *   const choices = createChoices(container, (id) => …);
 *   choices.set([{ id, label, title }])   reemplaza las opciones
 *   choices.reveal(correctIds, chosenId)  verde las correctas, rojo la elegida si falló
 *   choices.setDisabled(true | false)
 */

export function createChoices(container, onChoose) {
  let buttons = [];
  let disabled = false;

  function set(options) {
    container.innerHTML = '';
    buttons = options.map((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn choice';
      b.dataset.answer = opt.id;
      if (opt.title) b.title = opt.title;
      b.textContent = opt.label;
      b.disabled = disabled;
      b.addEventListener('click', (event) => {
        onChoose(opt.id);
        if (event.detail > 0) b.blur(); // tras un clic, Enter/Espacio vuelven a los atajos
      });
      container.appendChild(b);
      return b;
    });
  }

  function reveal(correctIds, chosenId) {
    for (const b of buttons) {
      const id = b.dataset.answer;
      b.classList.toggle('is-right', correctIds.includes(id));
      b.classList.toggle('is-wrong', id === chosenId && !correctIds.includes(id));
    }
  }

  function clearReveal() {
    for (const b of buttons) b.classList.remove('is-right', 'is-wrong');
  }

  function setDisabled(value) {
    disabled = value;
    for (const b of buttons) b.disabled = value;
  }

  return { set, reveal, clearReveal, setDisabled };
}
