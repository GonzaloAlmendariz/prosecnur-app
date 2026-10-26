// El aviso de una lámina que no se dibuja decía dónde, pero no por qué (Gonzalo, 2026-10-25, Arte_v1-4 lámina 8).
import { describe, expect, test } from "vitest";
import { causaLlana } from "./causaLamina";
import { humanizeGraficosExportError } from "./humanizeExportError";

const plan = {
  slides: [{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "POLITICAS INSTITUCIONALES", grafico: { graficador: "p_barras_multiapiladas", args: {} } } }],
} as unknown as Parameters<typeof humanizeGraficosExportError>[1];

describe("causaLlana", () => {
  test("un ajuste con un valor que no se acepta, nombrado como lo ve el analista", () => {
    expect(causaLlana("Base 'docentes': Lámina 1 «X»: `titulos_grupo` debe ser NULL o character() no vacio."))
      .toBe("el ajuste «Títulos por bloque» tiene un valor que este gráfico no acepta");
  });
  test("un ajuste que este tipo de gráfico no usa", () => {
    expect(causaLlana("Lámina 1 «X»: p_radar_tabla(modo='box'): no usar `var`."))
      .toBe("lleva una variable suelta, que este tipo de gráfico no usa");
  });
  test("un campo que quedó vacío", () => {
    expect(causaLlana("Lámina 1 «X»: modo='var_cruce': `vars` quedo vacio luego de limpiar."))
      .toBe("las preguntas quedaron vacías");
  });
  test("un campo desconocido no muestra su nombre de código", () => {
    const c = causaLlana("Lámina 1 «X»: `cortes_chip_raro` debe ser NULL o numerico.");
    expect(c).toBe("uno de sus ajustes tiene un valor que este gráfico no acepta");
    expect(c).not.toContain("cortes_chip_raro");
  });
  test("sin patrón reconocible no inventa causa", () => {
    expect(causaLlana("Lámina 1 «X»: algo raro")).toBeNull();
  });
});

test("el aviso de la lámina caída dice por qué, sin jerga (Arte_v1-4, lámina 8)", () => {
  const crudo = "! in callr subprocess. Caused by error: ! Base 'docentes': Lámina 1 «POLITICAS INSTITUCIONALES»: `titulos_grupo` debe ser NULL o character() no vacio.";
  const h = humanizeGraficosExportError(crudo, plan);
  expect(h.message).toBe("Lámina 1 · “POLITICAS INSTITUCIONALES”: su gráfico no se puede dibujar porque el ajuste «Títulos por bloque» tiene un valor que este gráfico no acepta, y el informe se detuvo ahí.");
  expect(h.message).not.toMatch(/titulos_grupo|character|NULL/);
  expect(h.hint).toBe("Ábrela y revisa ese ajuste en su gráfico; en la tira de miniaturas aparece como «No se dibuja».");
  expect(h.detalle).toBe(crudo);
});
