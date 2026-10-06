/*
 * Paleta de CrisPianist: 32 colores organizados en rampas (de oscuro a claro).
 * Es la ÚNICA fuente de colores. Cada píxel del canvas sale de aquí.
 *
 * Al cambiar un color, regenerar los archivos derivados:
 *   python tools/export-palette.py
 * que escribe assets/palette/crispianist.gpl, assets/palette/crispianist.png
 * y css/palette.css (las mismas variables para el HTML).
 *
 * Formato de cada línea (lo lee el script de exportación, mantenerlo así):
 *   { name: 'nombre-en-kebab', hex: '#rrggbb' },
 */
export const COLORS = [
  // Madera cálida (piano, muebles)
  { name: 'wood-0', hex: '#2e1915' },
  { name: 'wood-1', hex: '#5a3122' },
  { name: 'wood-2', hex: '#8a4f2f' },
  { name: 'wood-3', hex: '#bd7d45' },
  // Piedra (paredes y piso del conservatorio)
  { name: 'stone-0', hex: '#24202c' },
  { name: 'stone-1', hex: '#38323f' },
  { name: 'stone-2', hex: '#544d5c' },
  // Azules nocturnos (ventanas, ambiente; el más claro es el tinte de selección)
  { name: 'night-0', hex: '#0d1026' },
  { name: 'night-1', hex: '#1b2350' },
  { name: 'night-2', hex: '#2f4590' },
  { name: 'night-3', hex: '#6f93e0' },
  // Marfil (teclas blancas, texto principal)
  { name: 'ivory-0', hex: '#b9a682' },
  { name: 'ivory-1', hex: '#e9dcba' },
  { name: 'ivory-2', hex: '#fff6df' },
  // Gris oscuro (teclas negras, contornos)
  { name: 'ink', hex: '#0a090e' },
  { name: 'key-black', hex: '#25222c' },
  { name: 'key-black-hi', hex: '#4b4657' },
  // Perros: contorno y tres blancos
  { name: 'dog-outline', hex: '#2b2535' },
  { name: 'dog-0', hex: '#a6a3b6' },
  { name: 'dog-1', hex: '#d5d3e0' },
  { name: 'dog-2', hex: '#f5f4f9' },
  // Narices
  { name: 'nose-black', hex: '#15121a' },
  { name: 'nose-brown', hex: '#6f3f29' },
  // Brillantes (efectos)
  { name: 'fx-gold', hex: '#ffd23f' },
  { name: 'fx-pink', hex: '#ff6fae' },
  { name: 'fx-cyan', hex: '#4fe3df' },
  { name: 'fx-white', hex: '#fffbe6' },
  // Acierto
  { name: 'ok-0', hex: '#1d7339' },
  { name: 'ok-1', hex: '#43c463' },
  // Error y nota faltante
  { name: 'bad-0', hex: '#8c1d2a' },
  { name: 'bad-1', hex: '#e8463f' },
  { name: 'miss', hex: '#ff9c2f' },
];

/** Hex por índice: PAL[i] es un string listo para ctx.fillStyle (sin crear objetos). */
export const PAL = COLORS.map((c) => c.hex);

/** Índices con nombre: C.WOOD_0, C.IVORY_2, C.INK… (de 'wood-0' → WOOD_0). */
export const C = Object.freeze(Object.fromEntries(
  COLORS.map((c, i) => [c.name.toUpperCase().replace(/-/g, '_'), i]),
));

/** RGB por índice, para escribir píxeles directamente (ImageData). */
export const RGB = COLORS.map((c) => [
  parseInt(c.hex.slice(1, 3), 16),
  parseInt(c.hex.slice(3, 5), 16),
  parseInt(c.hex.slice(5, 7), 16),
]);
