import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PonderPreview } from "../../../api/client";
import { PonderacionEfecto } from "./PonderacionEfecto";

const render = (preview: PonderPreview | null) =>
  renderToStaticMarkup(createElement(PonderacionEfecto, { preview, labelOf: (x: string) => x }));

const DIAG = { n: 400, n_eff: 320, deff: 1.25, cv: 0.5, loss_pct: 20, min: 0.4, max: 3, mean: 1, median: 1, ratio_max_min: 7.5 };

describe("Ponderación › Efecto", () => {
  it("un error declarado del backend se muestra tal cual", () => {
    const msg = "No se puede imputar: faltan 8 % en «sexo», más que el 5 % permitido. Usa «dejar fuera del margen» o saca la variable de la calibración.";
    const html = render({ ok: false, reason: "E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL", message: msg });
    expect(html).toContain("faltan 8 % en «sexo»");
    expect(html).toContain('role="alert"');
  });

  it("sin metas: el vacío dice qué falta", () => {
    expect(render(null)).toContain("Configura al menos una variable con metas");
  });

  it("deff y n efectivo antes y después del recorte, imputados por variable y avisos con causa", () => {
    const html = render({
      ok: true,
      diagnostics: DIAG,
      margins: { sexo: [{ categoria: "1", objetivo: 0.48, muestra: 0.4, ponderado: 0.48 }] },
      recorte: {
        cap: 4, modo: "recalibrar", ciclos: 3, convergio: true, tol_margen: 0.001, max_desvio_margen: 0.0004,
        antes: { deff: 1.6, n_eff: 250, max_sobre_media: 6.1 },
        despues: { deff: 1.25, n_eff: 320, max_sobre_media: 4 },
      },
      imputacion: { semilla: 20261104, umbral: 0.05, metodo: "hot-deck", variables: { sexo: { imputados: 12, sin_donante: 0, pct: 0.03, colapsados: 0 } } },
      escala: "expansion",
      total_poblacion: 1234567,
      warnings: [{ level: "info", code: "categoria_fuera_de_margen", message: "5 casos sin dato en «edad» (99) conservan su peso en ese margen." }],
    });
    expect(html).toContain("1.60 → ");
    expect(html).toContain("1.25");
    expect(html).toMatch(/250 → .*320/);
    expect(html).toContain("12 imputados");
    expect(html).toContain("3 ciclos de recalibración");
    expect(html).toContain("conservan su peso en ese margen");
    expect(html).toContain("1,234,567");
  });
});
