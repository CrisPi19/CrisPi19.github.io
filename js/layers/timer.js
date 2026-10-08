/*
 * Cronómetro "12,3 s" del canvas, común a los ejercicios. Los dígitos se preparan una vez
 * como sprites sueltos y se dibujan de derecha a izquierda sin crear strings ni objetos
 * (se llama en cada fotograma).
 */
import { C } from '../engine/palette.js';
import { makeGlyphSprites, CAP_TOP } from '../engine/font.js';
import { W } from '../engine/renderer.js';

export class TimerText {
  constructor(color = C.STONE_2) {
    const glyphs = makeGlyphSprites('0123456789,s', { color });
    this.digits = [...'0123456789'].map((d) => glyphs.get(d));
    this.comma = glyphs.get(',');
    this.secs = glyphs.get('s');
  }

  /** Dibuja `ms` alineado a la derecha en `right`, con la fila de mayúsculas en `capY`. */
  draw(ctx, ms, right = W - 6, capY = 5) {
    let tenths = Math.floor(ms / 100);
    if (tenths > 99999) tenths = 99999;
    const y = capY - CAP_TOP;
    let x = right;

    x -= this.secs.width;
    ctx.drawImage(this.secs, x, y);
    x -= 4;
    let d = this.digits[tenths % 10];
    x -= d.width;
    ctx.drawImage(d, x, y);
    x -= this.comma.width + 1;
    ctx.drawImage(this.comma, x, y);
    let whole = Math.floor(tenths / 10);
    do {
      d = this.digits[whole % 10];
      x -= d.width + 1;
      ctx.drawImage(d, x, y);
      whole = Math.floor(whole / 10);
    } while (whole > 0);
  }
}
