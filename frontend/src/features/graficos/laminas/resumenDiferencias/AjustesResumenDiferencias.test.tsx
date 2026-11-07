// Inspector › Lámina de «Resumen de diferencias» (ítem 15 de la revisión del PPT v7.23): la selección, los cruces con su
// nombre y sus cortos, los topes de la selección automática y los capítulos con sus filas. Markup estático, sin DOM.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ArgMetadata, Slide } from "../../../../api/graficos";

// El registro tal como lo declara api/R/graficos_metadata.R.
const ARGS: ArgMetadata[] = [
  { name: "titulo", label: "Título de la lámina", tipo_input: "string", grupo: "textos" },
  { name: "etiqueta", label: "Etiqueta corta", tipo_input: "string", grupo: "textos" },
  { name: "base", label: "Base", tipo_input: "string", grupo: "textos" },
  { name: "seleccion", label: "Selección de filas", tipo_input: "choice", grupo: "textos", default: "manual",
    choices: [{ value: "manual", label: "Las filas escritas en el plan" }, { value: "auto", label: "Las filas del plan con diferencias" }] },
  { name: "cruces", label: "Cruces", tipo_input: "variables_list", grupo: "datos" },
  { name: "publico", label: "Cómo se nombran los casos", tipo_input: "string", grupo: "textos" },
  { name: "max_filas", label: "Filas en total", tipo_input: "number", grupo: "textos", default: 18, min: 4, max: 30, step: 1,
    depende: { arg: "seleccion", valores: ["auto"] } },
  { name: "max_por_capitulo", label: "Filas por capítulo", tipo_input: "number", grupo: "textos", default: 4, min: 1, max: 8, step: 1,
    depende: { arg: "seleccion", valores: ["auto"] } },
  { name: "capitulos", label: "Capítulos y filas", tipo_input: "resumen_capitulos", grupo: "datos" },
];

vi.mock("../../useGraficosRegistry", () => ({
  useGraficosRegistry: () => ({ slidesById: { p_slide_resumen_diferencias: { args: ARGS } }, graficadoresById: {} }),
}));
vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [
    { name: "B16", label: "¿Trabaja?", source: "base" }, { name: "area", label: "Área de estudios", source: "base" },
  ] }),
}));
vi.mock("../../../../lib/SessionContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/SessionContext")>()),
  useSession: () => ({ state: { active_base: "base" } }),
}));
vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
    { codigo: "1", etiqueta: "Sí", n: 60, pct: 60, residual: false },
    { codigo: "2", etiqueta: "No", n: 40, pct: 40, residual: false },
  ] } }),
}));

const { InspectorLamina } = await import("../InspectorLamina");
const { construirEstructura } = await import("../modeloEstructura");

const real = [
  { titulo: "Experiencia laboral", filas: [
    { var: "B16", fila: "Sí", rotulo: "Trabaja de forma remunerada" },
    { var: "B17", fila: "Fines de semana", rotulo: "Trabaja solo fines de semana", base_rotulo: "que trabajan" },
  ] },
  { titulo: "Gobierno", filas: [{ var: "C1_1", top2box: ["De acuerdo", "Totalmente de acuerdo"], rotulo: "Confía en el rectorado" }] },
];

function pintar(payload: Record<string, unknown>): string {
  const slide: Slide = { id: "r1", tipo: "p_slide_resumen_diferencias", payload };
  const lamina = construirEstructura([slide]).laminas[0];
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/graficos?pestana=laminas"] },
    createElement(InspectorLamina, {
      slide, lamina, ranura: null, onRanura: () => undefined, visor: null, onCerrar: () => undefined,
      onCambiarLamina: () => undefined, onCambiarGrafico: () => undefined,
    })));
}

describe("«Resumen de diferencias» en el inspector", () => {
  it("manual: selección, cruces con su nombre, cortos y capítulos; sin topes ni pendientes", () => {
    const html = pintar({ seleccion: "manual", capitulos: real, cruces: ["area"], rotulos: { area: "Área" }, cortos: { "Economía y Finanzas": "Econ. y Fin." } });
    expect(html).toContain('data-qa="ajustes-resumen-diferencias"');
    expect(html).toContain('data-campo="seleccion"');
    expect(html).toContain('data-campo="cruces"');
    expect(html).toContain('aria-label="Nombre de Área de estudios en la lámina"');
    expect(html).toContain('value="Área"');
    expect(html).toContain('value="Econ. y Fin."');
    expect(html).not.toContain('data-campo="max_filas"');
    expect(html).toContain('data-qa="capitulos-resumen"');
    expect(html).toContain("3 filas en 2 capítulos");
    expect(html).toContain('aria-label="Fila 1 del capítulo «Experiencia laboral»"');
    expect(html).toMatch(/aria-pressed="true"[^>]*title="Código 1/);
    expect(html).toContain('value="Trabaja de forma remunerada"');
    expect(html).toContain("Rótulo de la base: que trabajan. No se edita aquí y se conserva.");
    expect(html).toContain("Cuenta la suma: De acuerdo + Totalmente de acuerdo.");
    expect(html).toContain("Contar una sola respuesta");
    // H6: «Cómo se nombran los casos» va bajo «Comparar por» y el nombre corto de los grupos, como en las tarjetas, y
    // ya no se nombra nada como pendiente.
    expect(html).toContain("Comparar por");
    const cortos = html.indexOf('data-qa="tarjetas-cortos"');
    const publico = html.indexOf('data-campo="publico"');
    expect(cortos).toBeGreaterThan(-1);
    expect(publico).toBeGreaterThan(cortos);
    expect(publico).toBeLessThan(html.indexOf('data-qa="capitulos-resumen"'));
    // Un solo campo: el rótulo visible una vez (el «?» lo repite en su nombre accesible, ADR 0135 §8).
    expect(html.match(/>Cómo se nombran los casos</g)).toHaveLength(1);
    expect(html).toContain("Esta lámina lo usa siempre en lugar del nombre.");
    expect(html).not.toContain("todavía no está en Láminas");
    // Antes, el tipo desconocido caía a «string» y los capítulos salían como un campo de texto que pisaba la lista.
    expect(html).not.toMatch(/<input[^>]*data-campo="capitulos"/);
  });

  it("sin cruces escritos muestra los que la lámina rotula", () => {
    const html = pintar({ capitulos: real, rotulos: { area: "Área" } });
    expect(html).toContain('value="Área"');
    expect(html).toContain("Los que la lámina nombra. El nombre vacío usa el de la pregunta.");
  });

  it("automática: topes visibles y la propuesta del motor en lugar del editor (H13)", () => {
    const html = pintar({ seleccion: "auto", capitulos: real });
    expect(html).toContain('data-campo="max_filas"');
    expect(html).toContain('data-campo="max_por_capitulo"');
    expect(html).toContain('data-qa="propuesta-motor"');
    expect(html).toContain("Calculando la propuesta del motor. Tarda unos segundos.");
    expect(html).not.toContain("pulso-f6-hallazgos-campo");
    expect(html).not.toContain("Sin un capítulo completo");
  });

  it("manual sin capítulos completos avisa; una fila sin rótulo dice qué le falta", () => {
    expect(pintar({ seleccion: "manual" })).toContain("Sin un capítulo completo, el motor no arma esta lámina en selección manual.");
    const html = pintar({ capitulos: [{ titulo: "X", filas: [{ var: "B16", fila: "Sí" }] }] });
    expect(html).toContain("Falta el rótulo: no sale.");
    expect(html).toContain("Ninguna fila completa: el capítulo no sale.");
  });
});
