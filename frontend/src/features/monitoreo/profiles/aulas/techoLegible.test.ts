import { describe, expect, it } from "vitest";

import { techoLegible } from "./AulasAvanceDiario";

/**
 * El techo del eje, redondeado a una cifra que se pueda leer.
 *
 * Medido en pantalla el 2026-09-10: con el `max · 1,15` del boceto los ejes
 * decían **189 y 378** a la izquierda y **519 y 1038** a la derecha. Son
 * números que no significan nada; para situar una barra hay que interpolar.
 */
describe("techoLegible", () => {
  it("sube al siguiente múltiplo bonito por encima del máximo con su aire", () => {
    // 329 · 1,15 = 378,4 → 500.
    expect(techoLegible(329, 1.15)).toBe(500);
    // 944 · 1,1 = 1 038,4 → 2 000 sería demasiado: 1 038 cae entre 1 000 y
    // 2 000, así que el paso 2,5 da 2 500 y el 2 da 2 000. El primero que cubre.
    expect(techoLegible(944, 1.1)).toBe(2000);
  });

  it("siempre deja el máximo por debajo del techo", () => {
    for (const max of [1, 7, 23, 89, 100, 341, 999, 1000, 4321]) {
      expect(techoLegible(max, 1.15), `max=${max}`).toBeGreaterThanOrEqual(max);
    }
  });

  it("un cero no revienta el logaritmo", () => {
    expect(techoLegible(0, 1.15)).toBeGreaterThan(0);
  });
});
