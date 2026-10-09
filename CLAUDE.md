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
  - OpenSheetMusicDisplay: renderizar archivos MusicXML (módulo 6)
  - El pentagrama de los módulos 3–5 es pixel art propio (sin librería; ver más abajo).
    VexFlow se probó y se descartó porque no encaja con el estilo.
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
- Accesibilidad: atajos de teclado (Enter, Esc, Espacio, N, ← →; en el Explorador también
  ↑↓, C y V); las teclas del canvas no
  son elementos accesibles para lectores de pantalla.
- **Nombres y Escuchar** son botones con ícono pixel art (sin texto) en una columna junto al
  canvas, iguales en todos los módulos: una C arriba (nombres en las teclas, N) y una oreja
  abajo (escuchar, Espacio). En Lectura la oreja está siempre en gris: ahí no se usa
  (`shell.setupSideTools()`, íconos en `js/icons.js`).
- **Pausa** con la tecla P (o Pausa): no tiene botón ni aparece en pantalla. Al pausar se
  detiene todo (escena, cronómetro, entrada de notas y botones), se oculta el acorde y el
  canvas muestra "En pausa" sobre una trama oscura. El tiempo en pausa no cuenta para la
  repetición espaciada. Lógica en `trainer.setPaused()`; dibujo en `js/engine/pause.js`
  (común a todos los módulos).
- **Círculo de quintas** en todos los módulos (`js/fifths.js`): botón pequeño arriba a la
  derecha con una rosa cromática pixel art (sin texto) que abre una ventana flotante en el
  medio: mayores afuera, relativas menores adentro, armaduras en pentagramas chiquitos
  (F♯ y G♭ abajo); tocar una nota la hace sonar desde C4. **No pausa nada** (sin fondo que
  bloquee; el cronómetro sigue). Se cierra con ×, con el botón o con Esc (que no llega al
  módulo). **Excepción a la paleta**: la rueda usa 12 tonos propios (y su versión oscura
  para las menores), solo en esa ventana y su ícono.
- **Fondo animado, efectos/partículas y mascotas se hacen al final**, después de terminar
  los 6 módulos. Mientras tanto las capas existen como placeholders.

## Módulos (en orden de construcción)
1. **Entrenador de acordes** ✅ (con el sistema pixel art).
2. **Conexión MIDI**: detectar el teclado y usar sus notas como entrada en todos los módulos.
3. **Explorador** ✅: eliges acorde o escala, tónica y "Mi escala"/"Mi acorde"; se
   muestran a la vez las teclas con su función (1, 3, 5, ♭7…), el pentagrama (grados en
   romanos en las escalas) y el sonido, con las MISMAS notas. Clave Sol (tónica en la
   octava 4, ventana C4–C6) o Fa (octava 3, ventana C3–C5). "Comparar con…" (misma
   tónica, mismo tipo de ítem): lo explorado en azul, lo comparado en cian, tecla partida
   (mitad azul, mitad cian) si está en los dos, tónica dorada. Solo lo explorado lleva
   números en las teclas y grados en el pentagrama; lo comparado se reconoce por el
   color. Debajo, un texto con las diferencias (lidio ♯4 ↔ mayor 4). Botón de vista
   (solo al comparar, atajo V): "Ambas" → mi escala/acorde (azul) → la comparada (cian)
   → "Ambas"; teclado, pentagrama y sonido muestran solo lo elegido. Cada
   tipo tiene una comparación sugerida (★); al cambiar de tipo con la comparación activa,
   pasa a la sugerida. Atajos: Espacio escuchar (lo que se ve), ↑↓ tipo, C comparar, V vista,
   N nombres, ← → ventanas, P pausa. Lógica en `js/explorer.js`.
4. **Lectura** (notas sueltas ✅; acordes escritos ✅): una nota en
   el pentagrama → la **primera tecla** tocada es la respuesta, en la **octava exacta**.
   El pentagrama va DENTRO del canvas, en una pizarra con marco de madera sobre el piano
   (anticipo de la opción B). Opciones: clave Sol / Fa / Ambas (elegir clave lleva el
   teclado a su ventana: sol C4–C6, fa C2–C4, ambas C3–C5); "Pentagrama" (sol D4–G5, fa
   F2–B3: sin líneas adicionales) o "+ líneas adicionales" (hasta 2: sol A3–C6, fa C2–E4);
   alteraciones sí/no (solo ♯/♭ de tecla negra, sin E♯/C♭…). Al acertar: nota y tecla en
   verde y pasa sola a la siguiente (0,7 s). Al fallar: la pedida en naranja y la tocada
   en rojo, en la pizarra (escrita al lado, con su nombre debajo) y en las teclas; panel
   HTML con la explicación ("una 3.ª más abajo", "octava equivocada", "sin el ♯"); sigue
   con Enter. Sin "escuchar" (la oreja va en gris); los acordes suenan solos al confirmar. Flecha que brilla = la nota
   está en otra ventana. Cajas Leitner por clave y nota (`lectura.items`); "rápido" ≤ 2 s.
   Lógica en `js/reading.js`; pizarra en `js/layers/reading-ui.js`.
   **Acordes escritos** (selector "Notas | Acordes", mismas claves y mismo nivel de líneas
   adicionales): acorde en bloque sin nombre, en posición cerrada (inversiones opcionales),
   en una octava al azar entre las que caben en la pizarra y en UNA ventana. Se marcan
   las teclas (Esc/Borrar limpia) y se confirma con Enter: exactamente esas notas y
   octavas. Al confirmar suena el acorde; teclas: verde/naranja con su función (1, ♭3…),
   rojo con su nombre lo que sobró; pizarra (más ancha: 88 px) igual, con lo que sobró
   escrito al lado en rojo si cabe (columna 1 de `layoutStaff`, con becuadro si hace
   falta); burbuja con el nombre (Fmaj7/A). Acierto → pasa solo (1,2 s); error → panel
   con notas, "Faltó/Sobró" y los errores de octava. Opciones en "Acordes que entran":
   tipos (tríadas por defecto; sus2/sus4; maj7, 7, m7, m7♭5; sin 9 ni m6/9), tónicas
   naturales o las 12, inversiones sí/no. Ids `acorde|clave|tónica|tipo|inversión` en
   `lectura.items`; "rápido" ≤ 2 s por nota.
5. **Intervalos y escalas** ✅: solo **reconocer** (construir nombre → teclas ya
   lo entrenan Acordes y Lectura). Selector "Intervalos | Escalas"; fuente Pentagrama / Oído
   / Ambos; lo que se oye se responde **nombrando** (botones HTML con atajos 1–9, 0) o
   **tocando** (octava exacta): intervalo → la 1.ª nota dorada está dada y la primera tecla
   distinta es la respuesta; escala → tónica y octava doradas, se marcan las de en medio y
   Enter. Lo escrito se nombra siempre. Los botones de respuesta son siempre los 12 (2 filas
   de 6, sin atajos de teclado), aunque no todos estén en rotación. Intervalos: los 12 de la
   octava (2m … 8J; el tritono es UN botón, 4A/5d, escrito al azar como 4A o como 5d; por
   defecto 3m, 3M, 5J, 8J), forma ascendente / descendente / armónico / mezcla,
   alteraciones sí/no, sin líneas adicionales. Escalas: las 12 de `SCALE_TYPES`. Escalas: de la tónica a su
   octava, en la pizarra con las menos líneas adicionales (≤ 2), sin dobles alteraciones;
   tónicas naturales o las 12. Lo que se oye suena en C4–C6 (sol). Al responder: se escribe
   lo que sonó (dorado dada/tónica, verde, naranja lo que era, rojo lo que sobró), burbuja
   con el nombre, teclas con nombres (intervalos) o funciones (escalas); error → panel
   (semitonos; en escalas, en qué se diferencia de la elegida, como en el Explorador). Ids
   `int|prueba|intervalo|forma` y `esc|staff|escala|tónica` / `esc|ear|escala` /
   `esc|play|escala` en `reconocer.items`. Lógica en `js/recognize.js`; pizarra en
   `js/layers/recognize-ui.js` (común con Lectura: `js/layers/board.js`).
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
- **Paleta fija de 30 colores + 2 reservados** (tope 32) en rampas (madera, piedra, azules
  nocturnos, marfil, gris oscuro, blancos de perro + contorno, brillantes para efectos,
  verde acierto, rojo/naranja error). Los 2 libres se definen con la ambientación final.
  Las narices no tienen colores propios: negra = `ink`, café = `wood-2`.
  Cada píxel proviene de la paleta. Única fuente:
  `js/engine/palette.js`; exportada a `assets/palette/crispianist.gpl` y `crispianist.png`
  con `python tools/export-palette.py`.
- Todo texto del canvas usa la fuente bitmap de `js/engine/font.js` (tildes, ñ, ¿¡, ♭, ♯).
  Regla de legibilidad: C/c con los brazos rectos (abiertos) para no confundirse con O/o.

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
- 2 octavas procedurales sobre el cuerpo de un piano de madera.
- **3 ventanas fijas**: C2–C4, C3–C5 (inicial) y C4–C6. Se cambia de una en una con las
  flechitas de las mejillas del piano (abajo a la izquierda/derecha) o con ← →. **Sin
  deslizar** ni animación. La selección y las marcas se guardan por nota MIDI y sobreviven
  al cambio. Flecha azul = hay teclas seleccionadas/marcadas en ese lado; flecha que
  **brilla** (dorado/blanco a 4 fps) = el módulo lo pide con `piano.setArrowHint()`
  (p. ej. en Lectura, la nota está en otra ventana). Lectura exige la octava exacta.
- El teclado no conoce los ejercicios: cada módulo le dice qué mostrar con
  `setSelected()`, `setMarks()` y `clearMarks()`.
- Estados: normal, seleccionada (baja 1 px), acierto (verde), error (rojo); en un error,
  las notas que faltaron se marcan en naranja. Para mostrar sin juzgar (Explorador):
  nota de lo explorado (azul), tónica (dorado), solo de lo comparado (cian) y de los dos
  (tecla partida azul/cian).
- **Ninguna animación ni efecto puede revelar la respuesta antes de confirmar.**
- Clics convertidos a coordenadas lógicas; las negras se prueban antes que las blancas.
- `trainer.noteOn(midi, source)` es la única puerta de entrada de notas (la usará el MIDI).
- Opción para mostrar u ocultar nombres de notas.

### Efectos y rendimiento
- Partículas en pool preasignado (sin asignaciones); cada partícula recorre índices de la
  paleta claro → brillante → oscuro. Posiciones en el grid. Notas musicales al acertar.
- Animaciones con parámetros cuantizados (se leen a 8–12 fps aunque el bucle vaya a 60).
- Timestep fijo 60 Hz + `requestAnimationFrame`. **Cero asignaciones dentro del bucle.**
- El sonido se dispara en el evento del clic, nunca desde el bucle. Las notas a futuro
  (rasgueo, escalas, "A y luego B") usan temporizadores cancelables: cada "Escuchar"
  llama a `stopPlayback()` y empieza de cero (apretar seguido no amontona sonidos).
- Las muestras de piano se precargan al abrir la página (si no, los primeros segundos
  suena el sintetizador de respaldo); el audio se enciende en el primer gesto.

### Fuera del canvas
- Menús, configuración y explicaciones largas: HTML con la misma paleta y la fuente pixel
  **Tiny5** (@fontsource/tiny5@5.3.0). Tiene un solo grosor: jerarquía con tamaño y color,
  `font-synthesis: none` (nada de negrita sintética). Se cambió desde Pixelify Sans porque
  confundía C con O y 5 con 8.
- Partituras MusicXML (OSMD, módulo 6): panel nítido aparte con colores de la paleta.

### Pentagrama pixel art (módulos 3–5)
- Dibujado con el mismo sistema que la escena: líneas cada 4 px lógicos, solo redondas
  (6×3, con el hueco del color del papel), glifos bitmap de claves y alteraciones en
  `js/engine/music-glyphs.js`, grados de escala en **números romanos** (I, ♭III, ♯IV…;
  la octava vuelve a ser I) con la fuente bitmap. Colores: líneas `ivory-0`,
  clave `ivory-1`, notas `ivory-2` (lo de mayor contraste), papel `stone-0`.
- `js/notation.js` diagrama (posiciones, líneas adicionales, segundas desplazadas a la
  derecha, alteraciones en columnas, becuadros) sin DOM y con pruebas;
  `js/layers/staff.js` (`StaffLayer`) lo pinta en cualquier canvas lógico.
- **Hoy**, en el Explorador, va en un panel bajo la escena (`js/staff.js`), ampliado a
  escala **fija ×2** (píxeles físicos; sin selector). En Lectura ya va dentro de la escena
  (pizarra de `js/layers/reading-ui.js`, a escala ×1 lógica).
- **Objetivo final (opción B):** llevarlo DENTRO de la escena (atril o pizarra del
  conservatorio) cuando se haga el fondo. Por eso `StaffLayer` es una capa normal con
  posición `x`, `y`: bastará con agregarla a la escena. Mientras tanto, todo lo nuevo
  debe poder moverse ahí (nada de depender de HTML para leer el pentagrama).

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
  del otro perro con `"noseSwap": true`, y el motor cambia `wood-2` → `ink`. Para que el
  cambio no toque nada más, en el perro de nariz café `wood-2` debe usarse **solo** en la
  nariz (los ojos y contornos van en `ink`/`dog-outline`).

## Estadísticas
- Historial de ejercicios (`js/history.js`): módulo, ítem, acierto/error, tiempo y detalles
  (notas que faltaron o sobraron, inversión…), máx. 2000 registros. **Por ahora solo en
  memoria: dura la sesión y se pierde al refrescar o reabrir.** Más adelante se guardará en
  `localStorage` y el maestro lo presentará. (Las cajas Leitner sí se guardan.)

## Estructura
```
index.html               ← menú de módulos
css/                     ← estilo compartido (paleta + fuente pixel; module.css: lo común
                           de los módulos con piano)
js/theory.js             ← teoría pura (notas, grados, acordes, escalas, intervalos,
                           notas escritas con octava, validación)
js/explorer.js           ← lógica del Explorador (notas por clave, comparación)
js/reading.js            ← ejercicio de Lectura (extiende Session; sin DOM)
js/recognize.js          ← Reconocer intervalos y escalas (módulo 5; extiende Session)
js/choices.js            ← botones de respuesta múltiple (HTML, atajos 1–9 y 0)
js/fifths.js             ← ventana del círculo de quintas (común a todos los módulos)
js/icons.js              ← íconos pixel art de botones HTML (C de nombres, oreja de escuchar)
js/notation.js           ← diagramación del pentagrama pixel art (sin DOM)
js/staff.js              ← panel del pentagrama bajo la escena (usa layers/staff.js)
js/srs.js  storage.js    ← repetición espaciada, localStorage
js/history.js            ← historial de respuestas (en memoria por ahora)
js/audio.js              ← Tone.js
js/session.js            ← base de ejercicios (fases, cronómetro, pausa, Leitner, historial)
js/trainer.js            ← ejercicio de acordes (extiende Session; sin DOM); emite eventos
js/shell.js              ← armazón común de módulos: canvas, clics, flechas, atajos, sonido
js/events.js             ← bus de eventos
js/engine/               ← paleta, renderer, loop, fuente, glifos musicales, input,
                           partículas, sprites
js/layers/               ← background, characters, piano, staff, effects, ui,
                           explorer-ui, board (pizarra común), reading-ui, recognize-ui,
                           timer (cronómetro común)
js/midi.js               ← entrada MIDI (módulo 2)
data/                    ← diálogos
assets/palette/  assets/sprites/
tools/                   ← scripts de apoyo (exportar paleta)
modules/<modulo>/        ← una carpeta por módulo
tests/                   ← pruebas en el navegador (tests/index.html) y prueba visual
                           del pentagrama (tests/staff.html)
```
La lógica (teoría, entrenador) va separada de la interfaz para reutilizarla y probarla.

## Cómo trabajar conmigo
- Responder en español.
- Explicar las decisiones y no saltarse pasos: estoy aprendiendo mientras construyo.
- Avanzar por etapas y esperar mi revisión entre cada una.
- Sistema visual: etapa 1 (canvas, escalado, paleta, fuente bitmap, capas y teclado) ✅
  aprobada.
- **Módulo 2 (MIDI) pospuesto** hasta tener cable MIDI. Se sigue con los módulos 3–6 según
  este plan (una revisión entre etapas):
  0. Piezas comunes: `shell.js`, `session.js`, API del teclado + 3 ventanas, `history.js`.
  1. Teoría (escalas, intervalos, `spellVoicing`) + pentagrama pixel art (`notation.js`,
     `layers/staff.js`, `staff.js`).
  2. Módulo 3 Explorador (incluye "Comparar con…", p. ej. lidio vs mayor). ✅
  3. Módulo 4 Lectura, notas sueltas en sol y fa (primera tecla, octava exacta). ✅
     aprobada
  4. Módulo 4 Lectura, acordes escritos. ✅ aprobada (esquema original):
     - Selector "Notas | Acordes" en Lectura (misma página, misma pizarra, mismas claves).
     - Se dibuja un acorde en bloque (redondas, `layoutStaff` modo 'chord': segundas
       desplazadas y alteraciones en columnas) con `spellVoicing`; sin nombre del acorde:
       se lee, no se reconoce el símbolo.
     - Respuesta: marcar las teclas y confirmar con Enter (como en Acordes; Esc borra).
       Correcto = exactamente esas notas en esas octavas (es lectura: no valen
       inversiones ni duplicaciones).
     - Al confirmar: en teclas y pizarra, verde lo acertado, rojo lo que sobró (escrito
       al lado en la pizarra si cabe) y naranja lo que faltó; luego se muestra el nombre
       (Fmaj7) para conectar las tres representaciones. Acierto → pasa solo; error → Enter.
     - Opciones: tipos (tríadas mayor/m/dim/aug primero; luego sus2/sus4 y cuatríadas),
       tónicas (naturales o todas), inversiones sí/no (por defecto no).
     - Cada acorde se coloca en una octava donde todas sus notas quepan en la pizarra
       (≤ 2 líneas adicionales) y en UNA ventana del teclado; si no cabe, no entra.
     - Cajas Leitner por clave + acorde + inversión; "rápido" ≤ 2 s por nota.
     - Lógica en `js/reading.js` (selección como en `trainer.js`), con pruebas.
  5. Módulo 5 Intervalos y escalas (visual y de oído): solo reconocer, intervalos y
     escalas juntos, más el círculo de quintas en todos los módulos. ✅
  6. Módulo 6 MusicXML: en pantalla se acepta cualquier octava y la ventana sigue a la
     partitura; con MIDI, octava exacta.
- Escalas: mayor, menor natural/armónica/melódica, los 7 modos, pentatónicas mayor y
  menor, y blues. Ninguna más por ahora.
- Al terminar los 6 módulos: efectos y partículas; mascotas (sprites, máquina de estados,
  diálogos); fondo del conservatorio y los 2 colores reservados; pentagrama dentro de la
  escena (opción B). El historial de
  estadísticas puede adelantarse si un módulo lo necesita.
