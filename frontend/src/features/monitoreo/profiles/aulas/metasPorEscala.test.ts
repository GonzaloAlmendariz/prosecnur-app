import { describe, expect, it } from "vitest";

import { repartirMetasPorEscala } from "./AulasSerieDeRendimiento";

/**
 * Una meta que no cabe en el eje no se dibuja: se declara.
 *
 * Medido en el DOM el 2026-08-29 sobre `aulas_con_respuestas.pulso`: las dos
 * líneas de cuota por sexo salían a `y = -1384 px` y `-1332 px` —2.628 px por
 * encima del gráfico— y cruzaban la tabla del panel de arriba, tachando su
 * párrafo. El techo del eje se calcula con
 * `max(ultimo, meta, sobremuestra, ...proyectadas)` y NO incluye las cuotas por
 * sexo: tope de unos 400 contra cuotas de 1.730 y 1.761.
 *
 * Meterlas en la escala tampoco valía —aplastaría la serie observada contra el
 * suelo—, así que se dibuja lo que cabe y se dice lo que no.
 */

const m = (meta: number, sexo = "Mujeres") => ({ meta, sexo });

describe("repartir las metas por la escala del eje", () => {
  it("la que cabe se dibuja y la que no se declara", () => {
    const { caben, fuera } = repartirMetasPorEscala([m(1761), m(300)], 400);
    expect(caben.map((x) => x.meta)).toEqual([300]);
    expect(fuera.map((x) => x.meta)).toEqual([1761]);
  });

  it("el borde exacto cabe: una meta IGUAL al tope se dibuja sobre el eje", () => {
    expect(repartirMetasPorEscala([m(400)], 400).caben).toHaveLength(1);
  });

  it("ninguna meta se pierde entre los dos lados", () => {
    // El invariante que importa. Si una cayera fuera de ambos, no se dibujaría
    // NI se declararía, que es el silencio que esto vino a quitar.
    const metas = [m(0), m(1), m(399), m(400), m(401), m(99999)];
    const { caben, fuera } = repartirMetasPorEscala(metas, 400);
    expect(caben.length + fuera.length).toBe(metas.length);
    expect([...caben, ...fuera].map((x) => x.meta).sort((a, b) => a - b))
      .toEqual([0, 1, 399, 400, 401, 99999]);
  });

  it("sin escala utilizable NADA se dibuja: todas se declaran", () => {
    // Un tope 0, NaN o infinito no es una escala. Suponer que la meta cabe la
    // mandaría a `y = ±Infinity`, que es el defecto original con otro disfraz.
    for (const tope of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { caben, fuera } = repartirMetasPorEscala([m(10)], tope);
      expect({ tope, caben: caben.length, fuera: fuera.length })
        .toEqual({ tope, caben: 0, fuera: 1 });
    }
  });
});
