import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PonderPreview } from "../../../api/client";
import { normalizarPonderPreview } from "../../../api/analitica";
import { lecturaDelEfecto, type CalculoDePonderacion } from "../ponderacion/calculoDePonderacion";
import { PonderacionEfecto } from "./PonderacionEfecto";

const renderCalculo = (calculo: CalculoDePonderacion) =>
  renderToStaticMarkup(createElement(PonderacionEfecto, {
    lectura: lecturaDelEfecto(calculo),
    etiquetaDe: (x: string) => x,
    onReintentar: () => undefined,
  }));
const render = (preview: PonderPreview) => renderCalculo({ fase: "listo", preview });

const DIAG = { n: 400, n_eff: 320, deff: 1.25, cv: 0.5, loss_pct: 20, min: 0.4, max: 3, mean: 1, median: 1, ratio_max_min: 7.5 };

describe("Ponderación › Efecto de ponderar", () => {
  it("un error declarado del backend se muestra tal cual, sin ofrecer reintentar", () => {
    const msg = 'No se puede imputar: faltan 8 % en "sexo", más que el 5 % permitido. Usa "dejar fuera del margen" o saca la variable de la calibración.';
    const html = render({ ok: false, reason: "E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL", message: msg });
    expect(html).toContain("faltan 8 % en &quot;sexo&quot;");
    expect(html).toContain('role="alert"');
    expect(html).toContain("No se pudieron calcular los pesos");
    expect(html).not.toContain("Reintentar");
  });

  it("la llamada que falla es un error con causa y con Reintentar, no un vacío", () => {
    const html = renderCalculo({ fase: "error", mensaje: "Failed to fetch" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to fetch");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("Sin efecto que mostrar");
  });

  it("calculando: se anuncia y no afirma que faltan variables", () => {
    const html = renderCalculo({ fase: "calculando", previo: null });
    expect(html).toContain('role="status"');
    expect(html).toContain("Calculando los pesos");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Sin efecto que mostrar");
    expect(html).not.toContain("Tamaño efectivo");
  });

  it("al recalcular, las cifras anteriores siguen a la vista y el panel se marca ocupado", () => {
    const html = renderCalculo({ fase: "calculando", previo: { ok: true, rake_applied: true, diagnostics: DIAG } });
    expect(html).toContain("Tamaño efectivo");
    expect(html).toContain("data-recalculando");
    expect(html).toContain('aria-busy="true"');
  });

  it("sin peso base ni variables con metas: el vacío dice qué falta", () => {
    const html = render({ ok: true, rake_applied: false, design_applied: false, diagnostics: DIAG });
    expect(html).toContain("Sin efecto que mostrar");
    expect(html).toContain("Falta un peso base o una variable de ajuste con metas.");
    // Sin efecto no hay cifras: un tamaño efectivo aquí sería una buena noticia por ausencia.
    expect(html).not.toContain("Tamaño efectivo");
  });

  it("con el peso tomado de una columna dice por qué no hay efecto", () => {
    const html = renderCalculo({ fase: "inactivo" });
    expect(html).toContain("Sin efecto que calcular");
    expect(html).toContain("El peso se toma de una columna de la base, sin calibración.");
  });

  it("los NULL de R llegan como {}: sin recorte ni imputación no se rompe", () => {
    const crudo = {
      ok: true, rake_applied: true, diagnostics: DIAG, margins: {}, warnings: {},
      recorte: {}, imputacion: {}, total_poblacion: {}, peso_base: {}, faltantes: "excluir",
    } as unknown as PonderPreview;
    const p = normalizarPonderPreview(crudo);
    expect(p.recorte).toBeNull();
    expect(p.imputacion).toBeNull();
    expect(p.total_poblacion).toBeNull();
    expect(p.warnings).toEqual([]);
    const html = render(p);
    expect(html).toContain("Tamaño efectivo");
    expect(html).not.toContain("antes del recorte");
    expect(html).not.toContain("Imputados en");
    // Sin margen ni diseño aplicados no hay efecto que mostrar.
    expect(render(normalizarPonderPreview({ ...crudo, rake_applied: false } as PonderPreview))).toContain("Sin efecto que mostrar");
  });

  it("las cuatro cifras llevan su base y la suma de pesos no se repite aquí", () => {
    const html = render({ ok: true, rake_applied: true, diagnostics: DIAG, escala: "expansion", total_poblacion: 1234567 });
    // Las dos celdas de cada fila son pares; las filas entre sí no.
    expect(html).toMatch(/data-qa-geometry-group="analitica\/ponderacion-efecto-cifras" data-qa-geometry-contract="intrinsic"/);
    for (const fila of [1, 2]) {
      expect(html).toMatch(new RegExp(`data-qa-geometry-group="analitica/ponderacion-efecto-fila-${fila}" data-qa-geometry-contract="equal"`));
    }
    expect(html.match(/class="pond-efecto-fila"/g)).toHaveLength(2);
    for (const clave of ["tamano-efectivo", "efecto-de-diseno", "peso-minimo", "peso-maximo"]) {
      expect(html).toContain(`data-cifra="${clave}"`);
    }
    expect(html).toContain("de 400 casos, 20 % menos");
    expect(html).toContain("media 1.00");
    // La población vive en la banda de la pestaña.
    expect(html).not.toContain("1,234,567");
  });

  it("recorte, imputados por variable y avisos con causa", () => {
    const html = render({
      ok: true,
      rake_applied: true,
      diagnostics: DIAG,
      margins: { sexo: [{ categoria: "1", objetivo: 0.48, muestra: 0.4, ponderado: 0.48 }] },
      recorte: {
        cap: 4, modo: "recalibrar", ciclos: 3, convergio: true, tol_margen: 0.001, max_desvio_margen: 0.0004,
        antes: { deff: 1.6, n_eff: 250, max_sobre_media: 6.1 },
        despues: { deff: 1.25, n_eff: 320, max_sobre_media: 4 },
      },
      imputacion: { semilla: 20261104, umbral: 0.05, metodo: "hot-deck", variables: { sexo: { imputados: 12, sin_donante: 0, pct: 0.03, colapsados: 0 } } },
      warnings: [{ level: "info", code: "categoria_fuera_de_margen", message: '5 casos sin dato en "edad" (99) conservan su peso en ese margen.' }],
    });
    expect(html).toContain("tamaño efectivo 250 antes del recorte");
    expect(html).toContain("efecto de diseño 1.60 antes del recorte");
    expect(html).toContain("Efecto de diseño por ponderación");
    expect(html).toContain("a 4 veces la media");
    expect(html).toContain("Mayor peso, en veces la media");
    expect(html).toContain("de 6.10 a 4.00");
    expect(html).toContain("3 ciclos");
    expect(html).toContain("Desvío máximo de margen");
    expect(html).toContain("0.04 puntos porcentuales");
    expect(html).toContain("Imputados en sexo");
    expect(html).toContain("12 casos y 3 % sin dato");
    expect(html).toContain('data-pond-aviso="categoria_fuera_de_margen"');
    expect(html).toContain("conservan su peso en ese margen");
  });

  it("sin variables de ajuste aplicadas no se publica un desvío de margen de cero", () => {
    // Solo peso base y recorte: el motor fija el desvío en 0 porque no hay márgenes que medir.
    const recorte = {
      cap: 4, modo: "renormalizar" as const, ciclos: 0, convergio: true, tol_margen: 0.001, max_desvio_margen: 0,
      antes: { deff: 1.6, n_eff: 250, max_sobre_media: 6.1 },
      despues: { deff: 1.25, n_eff: 320, max_sobre_media: 4 },
    };
    const sinAjuste = render({ ok: true, rake_applied: false, design_applied: true, diagnostics: DIAG, recorte });
    expect(sinAjuste).toContain("Mayor peso, en veces la media");
    expect(sinAjuste).not.toContain("Desvío máximo de margen");
    expect(sinAjuste).not.toContain("0.00 puntos");
    // Con variables aplicadas, el mismo cero sí es un dato: los márgenes se cumplen.
    const conAjuste = render({ ok: true, rake_applied: true, design_applied: true, diagnostics: DIAG, recorte });
    expect(conAjuste).toContain("Desvío máximo de margen");
    expect(conAjuste).toContain("0.00 puntos porcentuales");
  });

  it("un recorte que no concilia lo dice; uno sin recalibrar, también", () => {
    const base = {
      cap: 4, ciclos: 20, tol_margen: 0.001, max_desvio_margen: 0.02,
      antes: { deff: 1.6, n_eff: 250, max_sobre_media: 6.1 },
      despues: { deff: 1.25, n_eff: 320, max_sobre_media: 4.4 },
    };
    const con = (recorte: PonderPreview["recorte"]) => render({ ok: true, rake_applied: true, diagnostics: DIAG, recorte });
    expect(con({ ...base, modo: "recalibrar", convergio: false })).toContain("20 ciclos y sin conciliar");
    expect(con({ ...base, modo: "renormalizar", convergio: true, ciclos: 0 })).toContain("Sin recalibrar");
  });
});
