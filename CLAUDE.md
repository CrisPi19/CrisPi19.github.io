# Entrenador de piano y teoría musical

## Objetivo
Aplicación web para practicar teoría musical en el piano, publicada en GitHub Pages
(`<usuario>.github.io`). No es una enciclopedia de teoría: es un **entrenador** que hace
responder al usuario y lo corrige al instante.

## Usuario y problema que resuelve
- Estudiante de ingeniería con bases de teoría musical (toca guitarra y piano).
- Le cuesta: leer partituras, construir acordes en el piano y recordar rápido escalas,
  intervalos y la composición de acordes.
- El problema de fondo es traducir rápido entre tres representaciones del mismo acorde:
  **nombre** (ej. Fmaj7) ↔ **teclas en el piano** ↔ **notas en el pentagrama**.
- Interés especial en armonía modal (modo lidio) y voicings de jazz y bossa nova.

## Restricciones técnicas
- Sitio **estático**: HTML, CSS y JavaScript sin framework ni paso de build. Nada de backend.
- Librerías cargadas por CDN (jsDelivr o cdnjs) con versión fijada:
  - Tone.js: sonido
  - VexFlow: dibujar pentagrama
  - OpenSheetMusicDisplay: renderizar archivos MusicXML
- Entrada por teclado MIDI real con la **Web MIDI API** (Chrome/Edge en computador).
  Siempre debe existir un teclado en pantalla como alternativa (clic/toque).
- Progreso y estadísticas del usuario en `localStorage` (envolver en try/catch).
- El repositorio es **público**: no subir partituras con derechos de autor. Las partituras
  se cargan con un botón y se procesan solo en el navegador.

## Módulos (en orden de construcción)
1. **Entrenador de acordes**: muestra un nombre de acorde, el usuario marca o toca las teclas,
   se valida y se mide el tiempo. Los acordes fallados o lentos reaparecen más seguido
   (repetición espaciada).
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

## Principios de diseño
- Un solo sistema visual compartido (paleta, tipografía, espaciado) en `css/`.
- Visualmente atractivo, pero cada módulo primero en versión mínima funcional y después pulido.
- Responsive y con modo claro/oscuro.

## Estructura sugerida
```
index.html          ← menú de módulos
css/                ← estilo compartido
js/theory.js        ← lógica de teoría (notas, intervalos, fórmulas de acordes y escalas)
js/midi.js          ← entrada MIDI
modules/<modulo>/   ← una carpeta por módulo
```
La lógica de teoría musical va separada de la interfaz para poder reutilizarla y probarla.

## Por decidir
- Nomenclatura de notas en la interfaz: latina (Do, Re, Mi), anglosajona (C, D, E) o ambas.
- Qué acordes entran en la primera versión del entrenador.

## Cómo trabajar conmigo
- Responder en español.
- Explicar las decisiones y no saltarse pasos: estoy aprendiendo mientras construyo.
- Avanzar módulo por módulo y dejar cada uno funcionando antes de seguir.
