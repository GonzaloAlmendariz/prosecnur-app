import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PonderacionConfig } from "../store";
import { BandaPonderacion } from "./BandaPonderacion";
import { TablaDeMetas, type GrupoDeLaTabla } from "./TablaDeMetas";

/**
 * Contrato de la superficie de Ponderación (etapa P5a del rediseño de Procesamiento).
 *
 * Lo que la composición promete y ninguna prueba de modelo ve: que no vuelve un
 * acordeón ni una casilla, que los contenedores declaran su geometría (C1), que
 * la banda no repite las cifras del efecto y que la tabla de metas conserva su
 * marco con cero, una y varias variables (C2).
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const panes = path.join(aqui, "..", "panes");

const fuentes = [
  ...readdirSync(aqui).filter((f) => f.endsWith(".tsx") && !f.includes(".test.")).map((f) => path.join(aqui, f)),
  ...["PonderacionPane.tsx", "PonderacionAjustes.tsx", "PonderacionPesoBase.tsx", "PonderacionEfecto.tsx", "MetasCpv2025.tsx"]
    .map((f) => path.join(panes, f)),
];
const leer = (f: string) => readFileSync(f, "utf8");
const nombre = (f: string) => path.basename(f);

/** Los patrones que este contrato prohíbe, como funciones para poder probarlos contra un caso que los rompe. */
const tieneAcordeon = (fuente: string) => /<details\b|<summary\b|Collapsible/.test(fuente);
const tieneCasilla = (fuente: string) => /type=["']checkbox["']/.test(fuente);

describe("superficie de Ponderación", () => {
  it("el barrido ve los componentes de la pestaña (centinela)", () => {
    expect(fuentes.length).toBeGreaterThanOrEqual(15);
  });

  it("sin acordeones: nada del trabajo queda plegado", () => {
    expect(fuentes.filter((f) => tieneAcordeon(leer(f))).map(nombre)).toEqual([]);
  });

  it("los booleanos son interruptores, no casillas", () => {
    expect(fuentes.filter((f) => tieneCasilla(leer(f))).map(nombre)).toEqual([]);
  });

  it("los detectores reconocen lo que prohíben", () => {
    expect(tieneAcordeon('<details className="pond-cpv" open>')).toBe(true);
    expect(tieneAcordeon("<summary>Metas</summary>")).toBe(true);
    expect(tieneAcordeon('<section className="pond-cpv">')).toBe(false);
    expect(tieneCasilla('<input type="checkbox" />')).toBe(true);
    expect(tieneCasilla('<input type="range" />')).toBe(false);
  });

  it("C1: la mesa y sus dos contenedores declaran grupo y contrato", () => {
    const pane = leer(path.join(panes, "PonderacionPane.tsx"));
    for (const grupo of ["analitica/ponderacion-mesa", "analitica/ponderacion-lateral"]) {
      expect(pane).toMatch(new RegExp(`data-qa-geometry-group="${grupo}"\\s+data-qa-geometry-contract="intrinsic"`));
    }
    const izquierda = leer(path.join(aqui, "PanelMuestraPoblacion.tsx"));
    expect(izquierda).toMatch(/data-qa-geometry-group="analitica\/ponderacion-declarado"\s+data-qa-geometry-contract="intrinsic"/);
    // El vacío de cada contenedor tiene dueño declarado.
    expect(izquierda.match(/data-qa-geometry-capacity="owned"/g)?.length).toBe(2);
  });

  it("la banda dice lo declarado y enciende la ponderación; no repite el efecto", () => {
    const pond: PonderacionConfig = { enabled: true, rake: { margins: [{ var: "sexo", targets: { "1": 61.3, "2": 38.7 } }] } };
    const html = renderToStaticMarkup(createElement(BandaPonderacion, {
      pond,
      preview: {
        ok: true, rake_applied: true, escala: "expansion", total_poblacion: 486,
        diagnostics: { n: 112, n_eff: 97, deff: 1.15, cv: 0.4, loss_pct: 13, min: 0.71, max: 1.62, mean: 1, median: 1, ratio_max_min: 2.3 },
      },
      onAlternar: () => undefined,
    }));
    expect(html).toContain("Variables de ajuste");
    expect(html).toContain("Suma de pesos");
    expect(html).not.toContain("Población");
    expect(html).toContain(">486<");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Usar pesos en frecuencias, cruces y dimensiones");
    for (const delEfecto of ["Tamaño efectivo", "Efecto de diseño", "Peso mínimo", "Peso máximo", ">97<", ">1.15<"]) {
      expect(html, delEfecto).not.toContain(delEfecto);
    }
  });
});

describe("tabla de metas", () => {
  const grupo = (variable: string, extra: Partial<GrupoDeLaTabla> = {}): GrupoDeLaTabla => ({
    variable,
    etiqueta: variable,
    categorias: [{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }],
    metas: { "1": 48, "2": 52 },
    onMetas: () => undefined,
    onQuitar: () => undefined,
    ...extra,
  });
  const render = (grupos: GrupoDeLaTabla[], recalculando = false) =>
    renderToStaticMarkup(createElement(TablaDeMetas, {
      modo: "ajuste", nombre: "Variables de ajuste y sus metas", grupos, recalculando,
      vacio: createElement("p", null, "Sin variables de ajuste"),
    }));
  const cabecera = (html: string) => html.match(/role="columnheader"/g)?.length ?? 0;

  it("C2: la cabecera es la misma con cero, una y varias variables", () => {
    expect(cabecera(render([]))).toBe(5);
    expect(cabecera(render([grupo("sexo")]))).toBe(5);
    expect(cabecera(render([grupo("sexo"), grupo("edad"), grupo("nivel")]))).toBe(5);
  });

  it("C3: sin variables, el vacío va dentro de la tabla y no hay filas", () => {
    const html = render([]);
    expect(html).toContain("Sin variables de ajuste");
    expect(html).not.toContain('role="rowheader"');
  });

  it("con variables, el vacío no aparece y cada una declara su grupo", () => {
    const html = render([grupo("sexo"), grupo("edad")]);
    expect(html).not.toContain("Sin variables de ajuste");
    expect(html.match(/role="rowheader"/g)).toHaveLength(2);
    expect(html).toContain('data-qa-geometry-group="analitica/ponderacion-variables"');
  });

  it("muestra, meta y resultado salen de la fila que el motor devuelve para esa categoría", () => {
    const html = render([grupo("sexo", {
      // El motor devuelve las categorías en otro orden: se cruza por código.
      comparacion: [
        { categoria: "2", objetivo: 0.52, muestra: 0.6, ponderado: 0.52 },
        { categoria: "1", objetivo: 0.48, muestra: 0.4, ponderado: 0.48 },
      ],
    })]);
    const hombre = html.slice(html.indexOf("Hombre"), html.indexOf("Mujer"));
    expect(hombre).toContain("Muestra 40.0 %, meta 48.0 %");
    expect(hombre).toContain(">40.0<");
    expect(hombre).toContain(">48.0<");
    expect(hombre).not.toContain(">60.0<");
  });

  it("mientras se recalcula, la tabla se marca: muestra y ponderado son del resultado anterior", () => {
    expect(render([grupo("sexo")])).not.toContain("data-recalculando");
    const html = render([grupo("sexo")], true);
    expect(html).toContain('data-recalculando=""');
    expect(html).toContain('aria-busy="true"');
  });

  it("se lee la etiqueta de la categoría y el código va delante, como dato secundario", () => {
    const html = render([grupo("sexo")]);
    expect(html).toMatch(/<code class="pond-metas-codigo"[^>]*>1<\/code>Hombre/);
    expect(html).toContain('data-categoria="2"');
    expect(html).toContain("Meta de Mujer");
    // Sin etiqueta, el código no se repite delante de sí mismo.
    const soloCodigos = render([grupo("sexo", { categorias: [{ value: "1", label: "1" }, { value: "2", label: "" }] })]);
    expect(soloCodigos).not.toContain("pond-metas-codigo");
  });

  it("sin cálculo, las cifras quedan sin dato y no en cero", () => {
    const html = render([grupo("sexo")]);
    expect(html).not.toContain(">0.0<");
    expect(html).not.toContain('role="img"');
  });

  it("las metas del censo se rotulan en conteo y las tecleadas en porcentaje", () => {
    expect(render([grupo("sexo")])).toContain("Metas en porcentaje");
    const censo = render([grupo("sexo", { metas: { "1": 523412, "2": 498100 }, fuente: "CPV 2025" })]);
    expect(censo).toContain("Metas en conteo");
    expect(censo).toContain("CPV 2025");
  });

  it("leyendo y lectura fallida no se confunden con una variable sin categorías", () => {
    expect(render([grupo("sexo", { categorias: null })])).toContain("Leyendo las categorías de sexo");
    expect(render([grupo("sexo", { categorias: "error" })])).toContain("No se pudieron leer las categorías de sexo");
    expect(render([grupo("sexo", { categorias: [] })])).toContain("no tiene categorías en la base");
  });

  it("en modo estrato solo hay categoría y población", () => {
    const html = renderToStaticMarkup(createElement(TablaDeMetas, { modo: "estrato", nombre: "Población por estrato", grupos: [grupo("distrito")] }));
    expect(cabecera(html)).toBe(2);
    expect(html).toContain("Población de Hombre");
    expect(html).not.toContain("Usar muestra");
  });
});
