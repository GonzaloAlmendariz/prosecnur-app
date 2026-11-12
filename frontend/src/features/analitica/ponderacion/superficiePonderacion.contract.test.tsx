import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PonderacionConfig } from "../store";
import { MemoryRouter } from "react-router-dom";
import type { PonderPreview } from "../../../api/analitica";
import { CabeceraDePonderacion } from "./CabeceraDePonderacion";
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
const PREVIEW: PonderPreview = {
  ok: true, rake_applied: true, escala: "expansion", total_poblacion: 486,
  diagnostics: { n: 112, n_eff: 97, deff: 1.15, cv: 0.4, loss_pct: 13, min: 0.71, max: 1.62, mean: 1, median: 1, ratio_max_min: 2.3 },
};
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

  it("C1: la mesa es la del kit, con sus dos columnas, y los contenedores declaran grupo y contrato", () => {
    const pane = leer(path.join(panes, "PonderacionPane.tsx"));
    // MesaDePestana declara "analitica/ponderacion-mesa" y PilaDeMesa "analitica/ponderacion-lateral-pila".
    expect(pane).toMatch(/<MesaDePestana\s+grupo="analitica\/ponderacion"\s+columnas=\{2\}/);
    expect(pane).toMatch(/<PilaDeMesa grupo="analitica\/ponderacion-lateral">/);
    const izquierda = leer(path.join(aqui, "PanelMuestraPoblacion.tsx"));
    expect(izquierda).toMatch(/data-qa-geometry-group="analitica\/ponderacion-declarado"\s+data-qa-geometry-contract="intrinsic"/);
    // El vacío de cada contenedor es del cuerpo de PanelDeMesa (capacidad declarada en el kit):
    // una segunda declaración por dentro haría leer el relleno como capacidad.
    for (const f of ["PanelMuestraPoblacion.tsx", "GuiaDeCriterios.tsx"]) {
      expect(leer(path.join(aqui, f)), f).toContain("<PanelDeMesa");
      expect(leer(path.join(aqui, f)), f).not.toContain('data-qa-geometry-capacity="owned"');
    }
    for (const f of ["PonderacionEfecto.tsx", "PonderacionAjustes.tsx"]) {
      expect(leer(path.join(panes, f)), f).toContain("<PanelDeMesa");
      expect(leer(path.join(panes, f)), f).not.toContain('data-qa-geometry-capacity="owned"');
    }
    // El recorrido declara su fila de pasos.
    expect(leer(path.join(aqui, "PasosDePonderacion.tsx"))).toMatch(/data-qa-geometry-group="analitica\/ponderacion-pasos"\s+data-qa-geometry-contract="intrinsic"/);
  });

  it("la cabecera es la del kit: antetítulo, título, estado, lo declarado y el interruptor; no repite el efecto", () => {
    const pond: PonderacionConfig = { enabled: true, rake: { margins: [{ var: "sexo", targets: { "1": 61.3, "2": 38.7 } }] } };
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CabeceraDePonderacion, {
      pond,
      lectura: { tipo: "efecto", preview: PREVIEW, recalculando: false },
      preview: PREVIEW,
      onAlternar: () => undefined,
    })));
    expect(html).toContain("pulso-cabecera-pestana");
    expect(html).toContain(">Analítica<");
    expect(html).toContain(">Ponderación</h2>");
    expect(html).toContain('data-tono="listo">Activa<');
    expect(html).not.toMatch(/Pestaña \d+ de \d+/);
    expect(html).toContain("variables de ajuste");
    expect(html).toContain("suma de pesos");
    expect(html).toContain(">486<");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Usar pesos en frecuencias, cruces y dimensiones");
    // El hueco declarado: lo que el prototipo dibuja y el motor no publica.
    expect(html).toContain("data-cifras-pendientes=");
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

  it("C2: la cabecera de la tabla es la misma con cero, una y varias variables", () => {
    expect(cabecera(render([]))).toBe(5);
    expect(cabecera(render([grupo("sexo")]))).toBe(5);
    expect(cabecera(render([grupo("sexo"), grupo("edad"), grupo("nivel")]))).toBe(5);
  });

  it("las columnas son las del prototipo: Distribución, Muestra %, Población y el resultado ponderado", () => {
    const cabeceras = [...render([grupo("sexo")]).matchAll(/role="columnheader"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(cabeceras).toEqual(["Categoría", "Distribución", "Muestra %", "Población", "Ponderado %"]);
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
