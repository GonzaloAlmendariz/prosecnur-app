import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasRitmoDiario, type RitmoDiario } from "./AulasRitmoDiario";

/**
 * Las cifras son las de HSVG2026 «como 2025»: cuota 2.500, acumulado 2.668 y
 * una brecha de 170 repartida por los grupos de facultad y sexo que no cierran.
 * La resta `meta - acumulado` da CERO justo ahí, y el pie entero vive tras un
 * `falta > 0`: el panel no publicaba un número equivocado, se callaba.
 */
const ritmo = (over: Partial<RitmoDiario> = {}): RitmoDiario => ({
  dias: [
    { fecha: "2026-09-17", validas: 2280, acumulado: 2280 },
    { fecha: "2026-09-18", validas: 388, acumulado: 2668 },
  ] as RitmoDiario["dias"],
  dias_con_campo: 2,
  mejor_dia: { fecha: "2026-09-17", validas: 2280 },
  media_diaria: 1334,
  meta: 2500,
  brecha: 170,
  ...over,
});

describe("AulasRitmoDiario", () => {
  it("con el total por encima de la meta y gente faltando, lo dice en vez de callarse", () => {
    const html = renderToStaticMarkup(<AulasRitmoDiario ritmo={ritmo()} />);
    expect(html).toContain("170");
    expect(html).toContain("grupos de facultad y sexo que");
    // Al ritmo medio NO se cierra una cuota por sexo: las respuestas que faltan
    // tienen que caer en los grupos cortos, así que no se prometen días.
    expect(html).not.toContain("al ritmo de");
  });

  it("por debajo de la meta sigue diciendo lo que falta y cuántos días al ritmo", () => {
    const html = renderToStaticMarkup(
      <AulasRitmoDiario ritmo={ritmo({
        dias: [{ fecha: "2026-09-17", validas: 800, acumulado: 800 }] as RitmoDiario["dias"],
        dias_con_campo: 1, media_diaria: 800, brecha: 1700,
      })} />,
    );
    expect(html).toContain("para la meta total de");
    expect(html).toContain("al ritmo de");
  });

  it("sin brecha del motor cae a la resta, que es la conducta anterior", () => {
    const html = renderToStaticMarkup(
      <AulasRitmoDiario ritmo={ritmo({
        dias: [{ fecha: "2026-09-17", validas: 800, acumulado: 800 }] as RitmoDiario["dias"],
        dias_con_campo: 1, media_diaria: 800, brecha: null,
      })} />,
    );
    // 2.500 - 800 = 1.700.
    expect(html).toContain("1,700");
  });
});
