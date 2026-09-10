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

describe("las pastillas de facultad", () => {
  it("reusan el chip pulsable del perfil y marcan la que está en foco", () => {
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas
        cuenta={cuenta()} rotulo="DERECHO"
        facultades={["DERECHO", "LETRAS"]} onFoco={() => {}}
      />,
    );
    expect(html).toContain("aulas-sexo-chip");
    expect(html).toMatch(/aria-pressed="true"[^>]*>DERECHO/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Todas las facultades/);
  });

  it("sin manejador de foco no se pintan: un mando muerto es peor que ninguno", () => {
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={cuenta()} facultades={["DERECHO"]} onFoco={null} />,
    );
    expect(html).not.toContain("Todas las facultades");
  });

  it("una facultad en foco SIN respuestas pinta su cero, no el bloque anterior", () => {
    // Callarlo dejaría en pantalla la cuenta de la facultad anterior como si
    // fuera de ésta.
    const vacia = { observadas: 0, efectivas: 0, fuera_del_operativo: 0, no_pasan_criterio: 0 };
    const html = renderToStaticMarkup(
      <AulasResumenRespuestas cuenta={vacia} rotulo="EDUCACION" />,
    );
    expect(html).toContain("EDUCACION");
    expect(html).toContain("0");
    // Y sin porcentaje: 0 de 0 no es 0 %, es una división que no existe. Se
    // busca el porcentaje ESCRITO —«90,0 %»— y no el carácter suelto: los
    // anchos de las barras van en % y estarían siempre.
    expect(html).not.toMatch(/\d[.,]\d\s%/);
  });
});
