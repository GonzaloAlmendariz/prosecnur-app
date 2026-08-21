import { describe, expect, it } from "vitest";

import {
  phoneCodPulsoDifferenceHint,
  phoneCodPulsoDifferenceSentence,
} from "./TelefonicoMonitoreoPage";

/**
 * «Las efectivas telefonicas coinciden con Kobo por CodPulso individual» con
 * CERO registros comparados.
 *
 * El veredicto del cruce se decidia sólo con `mismatch`: sin diferencias,
 * coinciden. Pero no haber encontrado diferencias entre cero pares no es que
 * cuadren — es que no se cruzó nada. Y el fallback de «todavía no hay cruce»
 * llegaba con `mismatch: 0`, así que caía exactamente en la rama que anuncia
 * la buena noticia.
 *
 * Misma familia que `e7d7e058` y `2d8bc3c7`, esta vez en los dos perfiles
 * telefónicos. Los dos archivos están CONGELADOS: reparado con cero líneas
 * nuevas.
 */

const cruce = (total: number, mismatch: number) => ({
  total, mismatch, phoneWithoutPlatform: 0, platformWithoutPhone: 0, withoutCode: 0,
});

describe("el cruce no coincide si no se cruzó nada", () => {
  it("sin registros comparados no declara coincidencia", () => {
    expect(phoneCodPulsoDifferenceSentence(cruce(0, 0))).not.toMatch(/coinciden/i);
    expect(phoneCodPulsoDifferenceSentence(cruce(0, 0))).toMatch(/todavia no hay/i);
    expect(phoneCodPulsoDifferenceHint(cruce(0, 0))).not.toMatch(/coincidencia/i);
  });

  it("con registros comparados y sin diferencias SI la declara", () => {
    // El control: si nunca dijera «coinciden», el aserto de arriba pasaría por
    // la razón equivocada.
    expect(phoneCodPulsoDifferenceSentence(cruce(120, 0))).toMatch(/coinciden/i);
    expect(phoneCodPulsoDifferenceHint(cruce(120, 0))).toMatch(/120 registros comparados/);
  });

  it("con diferencias manda la diferencia, haya o no total", () => {
    expect(phoneCodPulsoDifferenceSentence(cruce(120, 4))).not.toMatch(/coinciden/i);
    expect(phoneCodPulsoDifferenceHint(cruce(0, 4))).toMatch(/4 diferencias/);
  });
});
