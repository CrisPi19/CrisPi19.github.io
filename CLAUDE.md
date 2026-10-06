# CrisPianist — entrenador de piano y teoría musical

## Objetivo
Aplicación web para practicar teoría musical en el piano, publicada en GitHub Pages
(`crispi19.github.io`). No es una enciclopedia de teoría: es un **entrenador** que hace
responder al usuario y lo corrige al instante. Nombre del proyecto: **CrisPianist** (se usa en
el título de las páginas y en la interfaz).

## Usuario y problema que resuelve
- Estudiante de ingeniería con bases de teoría musical (toca guitarra y piano).
- Le cuesta: leer partituras, construir acordes en el piano y recordar rápido escalas,
  intervalos y la composición de acordes.
- El problema de fondo es traducir rápido entre tres representaciones del mismo acorde:
  **nombre** (ej. Fmaj7) ↔ **teclas en el piano** ↔ **notas en el pentagrama**.
- Interés especial en armonía modal (modo lidio) y voicings de jazz y bossa nova.

## Restricciones técnicas
- Sitio **estático**: HTML, CSS y JavaScript sin framework ni paso de build. Nada de backend.
  Módulos ES nativos; para desarrollar se usa un servidor local (`python -m http.server 8000`).
- Librerías cargadas por CDN (jsDelivr o cdnjs) con versión fijada:
  - Tone.js: sonido
  - VexFlow: dibujar pentagrama
  - OpenSheetMusicDisplay: renderizar archivos MusicXML
- Entrada por teclado MIDI real con la **Web MIDI API** (Chrome/Edge en computador).
  Siempre debe existir un teclado en pantalla como alternativa (clic/toque).
- Progreso y estadísticas del usuario en `localStorage` (envolver en try/catch).

## Decisiones tomadas
- Nomenclatura **anglosajona** (C, D, E…; Fmaj7, B♭m7). Notas deletreadas por grado
  (B♭m7 = B♭ D♭ F A♭), con ♭ ♯ 𝄫 𝄪.
- Acordes del entrenador: mayor, m, dim, aug, sus2, sus4, maj7, 7, m7, m7♭5, 9, m6/9.
- Se aceptan inversiones y octavas, pero se informa la inversión tocada (ej. Fmaj7/A;
  si el símbolo lleva barra: (Am6/9)/C).
- Repetición espaciada Leitner (cajas 1–5); "rápido" = ≤ 2 s por nota del acorde.
- **Solo modo oscuro** (la escena es un conservatorio de noche).
- En celular se acepta el canvas a escala ×1 (teclas pequeñas) por ahora.
- Accesibilidad: atajos de teclado (Enter, Esc, Espacio); las teclas del canvas no son
  elementos accesibles para lectores de pantalla.

## Módulos (en orden de construcción)
1. **Entrenador de acordes** ✅ (en migración al sistema pixel art).
2. **Conexión MIDI**: detectar el teclado y usar sus notas como entrada en todos los módulos.
3. **Explorador**: eliges tónica y tipo de acorde o escala; se muestran a la vez las teclas
   resaltadas con su función (1, 3, 5, b7…), el pentagrama y el sonido.
4. **Lectura**: una nota (luego acordes) en el pentagrama → el usuario toca la tecla.
   Clave de sol primero, después clave de fa.
5. **Intervalos y escalas**: ejercicios visuales y de oído.
6. **Práctica guiada con MusicXML**: el usuario sube un archivo MusicXML, se dibuja la
   partitura, se resalta la nota/acorde actual y se avanza solo cuando lo toca bien.

Fuera del sitio (no implementar en la web): conversión de PDF/imagen a MusicXML con OMR
(Audiveris) como paso externo.

## Sistema visual pixel art (estructural)
Debe verse como un juego pulido de 16 bits, no como formas vectoriales escaladas.
Barra de calidad: píxeles nítidos a cualquier tamaño de ventana, 60 fps estables, y el
acorde a resolver y el estado de cada tecla se entienden de inmediato.

### Renderizado
- La escena se dibuja en un canvas fuera de pantalla de **320×180** (resolución lógica fija)
  y se copia al canvas visible escalado por el **mayor factor entero** que quepa, centrado,
  con `imageSmoothingEnabled = false` y CSS `image-rendering: pixelated`.
  El factor se calcula en píxeles físicos (considera `devicePixelRatio`) para que cada
  píxel lógico ocupe exactamente N×N píxeles de pantalla.
- Todo en coordenadas enteras. Sin subpíxeles, antialiasing, gradientes ni shadowBlur.
- **Paleta fija de 32 colores** en rampas (madera, piedra, azules nocturnos, marfil, gris
  oscuro, blancos de perro + contorno, narices negro/café, brillantes para efectos, verde
  acierto, rojo/naranja error). Cada píxel proviene de ella. Única fuente:
  `js/engine/palette.js`; exportada a `assets/palette/crispianist.gpl` y `crispianist.png`
  con `python tools/export-palette.py`.
- Todo texto del canvas usa la fuente bitmap de `js/engine/font.js` (tildes, ñ, ¿¡, ♭, ♯).

### Capas (en este orden; cada una reemplazable sin tocar las demás)
1. Fondo: placeholder plano por ahora. Al final: interior de un conservatorio de noche,
   detallado y de **bajo contraste**, con elementos animados sutiles.
2. Personajes: reservada para los perros.
3. Piano y teclado.
4. Efectos y partículas.
5. Interfaz en canvas (nombre del acorde, burbujas de diálogo).

### Jerarquía visual
El teclado y el nombre del acorde son siempre lo de mayor contraste. Fondo, personajes y
efectos nunca compiten con su legibilidad (el fondo usa tonos medios).

### Teclado
- 2 octavas (C3–C5) procedurales sobre el cuerpo de un piano de madera.
- Estados: normal, seleccionada (baja 1 px), acierto (verde), error (rojo); en un error,
  las notas que faltaron se marcan en naranja.
- **Ninguna animación ni efecto puede revelar la respuesta antes de confirmar.**
- Clics convertidos a coordenadas lógicas; las negras se prueban antes que las blancas.
- `trainer.noteOn(midi, source)` es la única puerta de entrada de notas (la usará el MIDI).
- Opción para mostrar u ocultar nombres de notas.

### Efectos y rendimiento
- Partículas en pool preasignado (sin asignaciones); cada partícula recorre índices de la
  paleta claro → brillante → oscuro. Posiciones en el grid. Notas musicales al acertar.
- Animaciones con parámetros cuantizados (se leen a 8–12 fps aunque el bucle vaya a 60).
- Timestep fijo 60 Hz + `requestAnimationFrame`. **Cero asignaciones dentro del bucle.**
- El sonido se dispara en el evento del clic, nunca desde el bucle.

### Fuera del canvas
- Menús, configuración y explicaciones largas: HTML con la misma paleta y fuente pixel.
- Pentagrama y partituras (VexFlow / OSMD) irán en un panel nítido aparte, sin pixelar,
  con colores de la paleta. No dibujarlas en el canvas.

## Mascotas (arquitectura preparada; sprites los dibuja el usuario)
Dos perros blancos idénticos, diferenciados solo por la nariz (uno negra, otro café).

### Roles (no escribir diálogos todavía)
- **El maestro**: intelectual, soberbio y condescendiente, pero nunca hostil. Da las
  órdenes (plantea los ejercicios) y presenta las estadísticas.
- **El compañero**: extrovertido, cómico y alegre. Alienta y da consejos.

### Arquitectura
- **Bus de eventos** del entrenador (`exercise:new`, `note:on`, `selection:change`,
  `answer:correct`, `answer:wrong`, `streak`…). Los personajes se suscriben; la lógica del
  entrenador no se modifica para conectarlos. Los eventos previos a confirmar nunca
  incluyen si la selección es correcta.
- **Máquina de estados** por personaje, ampliable: REPOSO, ATENCIÓN (mientras se
  seleccionan notas), CELEBRACIÓN (acierto), DESÁNIMO (error), HABLAR (burbuja).
- **Diálogos** en `data/dialogos.json`, por personaje → evento → variantes (sin repetir
  hasta agotar). Burbujas cortas en el canvas; explicaciones largas en panel HTML.
- **Sprites**: si faltan los archivos se muestra un placeholder simple o nada, sin errores.

### Especificación de sprites (para dibujar en Piskel/Aseprite)
- Tamaño de frame: **40×32 px**, igual en todos los estados.
- Punto de anclaje: **(20, 31)**, abajo al centro, entre las patas: es el punto que se
  apoya en el suelo.
- Colores: solo de `assets/palette/crispianist.gpl`. Fondo transparente; alfa solo 0 o 255
  (sin semitransparencias ni antialiasing).
- Formato: **una tira horizontal PNG por estado** (frames de izquierda a derecha, sin
  separación), en una carpeta por personaje, más un JSON de metadatos:
  ```
  assets/sprites/maestro/reposo.png  atencion.png  celebracion.png  desanimo.png  hablar.png
  assets/sprites/maestro/maestro.json
  assets/sprites/companero/…         (misma estructura)
  ```
  ```json
  {
    "frame": { "w": 40, "h": 32 },
    "anchor": { "x": 20, "y": 31 },
    "states": {
      "reposo":      { "file": "reposo.png",      "frames": 4, "fps": 6,  "loop": true },
      "atencion":    { "file": "atencion.png",    "frames": 4, "fps": 8,  "loop": true },
      "celebracion": { "file": "celebracion.png", "frames": 6, "fps": 10, "loop": false },
      "desanimo":    { "file": "desanimo.png",    "frames": 4, "fps": 6,  "loop": false },
      "hablar":      { "file": "hablar.png",      "frames": 4, "fps": 8,  "loop": true }
    }
  }
  ```
  Cantidad de frames y fps son la recomendación; el JSON manda si se cambian.
- Recomendación: una carpeta por personaje (así cada uno puede tener posturas propias de
  su personalidad). Si un estado es idéntico salvo la nariz, se puede reutilizar la tira
  del otro perro con `"noseSwap": true`, y el motor cambia el color de la nariz.

## Estadísticas
- Historial de ejercicios en `localStorage`: acorde, acierto/error, notas que faltaron o
  sobraron, inversión y tiempo de respuesta (máx. ~2000 registros). Por ahora solo se
  guarda; más adelante el maestro lo presentará.

## Estructura
```
index.html               ← menú de módulos
css/                     ← estilo compartido (paleta + fuente pixel)
js/theory.js             ← teoría pura (notas, grados, acordes, validación)
js/srs.js  storage.js    ← repetición espaciada, localStorage
js/audio.js              ← Tone.js
js/trainer.js            ← lógica del ejercicio (sin DOM); emite eventos
js/events.js             ← bus de eventos
js/engine/               ← paleta, renderer, loop, fuente, input, partículas, sprites
js/layers/               ← background, characters, piano, effects, ui
js/midi.js               ← entrada MIDI (módulo 2)
data/                    ← diálogos
assets/palette/  assets/sprites/
tools/                   ← scripts de apoyo (exportar paleta)
modules/<modulo>/        ← una carpeta por módulo
tests/                   ← pruebas en el navegador (tests/index.html)
```
La lógica (teoría, entrenador) va separada de la interfaz para reutilizarla y probarla.

## Cómo trabajar conmigo
- Responder en español.
- Explicar las decisiones y no saltarse pasos: estoy aprendiendo mientras construyo.
- Avanzar por etapas y esperar mi revisión entre cada una.
- Etapas actuales del sistema visual:
  1. Canvas, escalado, paleta (con exportación), fuente bitmap, capas y teclado.
  2. Efectos y partículas.
  3. Mascotas, bus de eventos, diálogos y estadísticas, con placeholders.
