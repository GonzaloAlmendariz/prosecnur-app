import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasResumenRespuestas } from "./AulasResumenRespuestas";

const cuenta = (extra = {}) => ({
  observadas: 1049, efectivas: 944, fuera_del_operativo: 37, no_pasan_criterio: 68, ...extra,
});

describe("«Respuestas»", () => {
  it("las dos razones se enseñan SEPARADAS, nunca como «105 descartadas»", () => {
    // El rótulo que salió del perfil el 2026-09-07: metía en la misma bolsa lo
    // que no es del operativo y lo que sí lo es y no pasa el criterio, que
    // piden acciones opuestas.
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta()} />);
    expect(html).toContain("Fuera del operativo");
    expect(html).toContain("No pasan el criterio");
    expect(html).not.toContain("descartadas");
  });

  it("la segunda barra reparte sólo lo que NO cuenta", () => {
    // 68 sobre 105 es dos tercios; sobre 1 049 sería el 6 % y desaparecería.
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta()} />);
    const anchos = [...html.matchAll(/width:([0-9.]+)%/g)].map((m) => Number(m[1]));
    expect(anchos.some((w) => Math.abs(w - (100 * 68) / 105) < 0.01)).toBe(true);
  });

  it("el titular dice las dos cifras y su porcentaje", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta()} />);
    expect(html).toContain("944");
    expect(html).toContain("1,049");
    expect(html).toMatch(/90[.,]0\s%/);
  });

  it("sin nada que descartar no pinta la segunda barra ni su leyenda", () => {
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={cuenta({ observadas: 10, efectivas: 10, fuera_del_operativo: 0, no_pasan_criterio: 0 })} />,
    );
    expect(html).not.toContain("que no cuentan");
  });

  it("las respuestas sin aula se DICEN: explican por qué las facultades no suman el total", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta()} sinAula={38} />);
    expect(html).toContain("38");
    expect(html).toContain("en ninguna facultad");
  });

  it("sin sinAula no inventa la nota", () => {
    const html = renderToStaticMarkup(<AulasResumenRespuestas cuenta={cuenta()} sinAula={0} />);
    expect(html).not.toContain("en ninguna facultad");
  });

  it("sin observadas no pinta un bloque en ceros", () => {
    expect(renderToStaticMarkup(<AulasResumenRespuestas cuenta={null} />)).toBe("");
    expect(renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={cuenta({ observadas: 0, efectivas: 0, fuera_del_operativo: 0, no_pasan_criterio: 0 })} />,
    )).toBe("");
  });
});
