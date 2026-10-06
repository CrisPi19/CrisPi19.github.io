/*
 * Capa 2: personajes. VACÍA por ahora; aquí vivirán los dos perros (etapa 3).
 *
 * Puntos de apoyo reservados (coordenadas lógicas del ancla de cada sprite, que es el
 * punto entre las patas): los perros se paran sobre la tapa del piano (y = 99),
 * a los lados del nombre del acorde, sin taparlo.
 */
export const CHARACTER_SLOTS = {
  maestro: { x: 34, y: 99 },
  companero: { x: 286, y: 99 },
};

export class CharactersLayer {
  constructor() {
    this.characters = []; // cada uno tendrá update(dt, time) y draw(ctx, time)
  }

  add(character) {
    this.characters.push(character);
  }

  update(dt, time) {
    for (let i = 0; i < this.characters.length; i++) this.characters[i].update(dt, time);
  }

  draw(ctx, time) {
    for (let i = 0; i < this.characters.length; i++) this.characters[i].draw(ctx, time);
  }
}
