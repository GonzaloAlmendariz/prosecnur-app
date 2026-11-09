// Inspector › Lámina de «Hallazgos clave» (revisión del PPT v7.11, ítem 2): el modo y, en el resumen ejecutivo, la
// selección, los topes, los cruces y los capítulos. Markup estático, sin DOM.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ArgMetadata, Slide } from "../../../../api/graficos";

const ARGS: ArgMetadata[] = [
  { name: "titulo", label: "Título de la lámina", tipo_input: "string", grupo: "textos" },
  { name: "etiqueta", label: "Etiqueta corta", tipo_input: "string", grupo: "textos" },
  { name: "base", label: "Base", tipo_input: "string", grupo: "textos" },
  { name: "modo", label: "Modo", tipo_input: "choice", grupo: "textos", default: "cifras", choices: [
    { value: "cifras", label: "Hasta seis cifras" }, { value: "cifras_con_graficos", label: "Hasta tres cifras con su gráfico" },
    { value: "resumen", label: "Resumen ejecutivo en tabla por capítulo" }, { value: "titulares", label: "Un titular por capítulo" },
  ] },
  { name: "seleccion", label: "Selección de hallazgos", tipo_input: "choice", grupo: "textos", default: "manual",
    depende: { arg: "modo", valores: ["resumen", "titulares"] },
    choices: [{ value: "manual", label: "Los hallazgos escritos en el plan" }, { value: "auto", label: "Propuestos por el motor" }] },
  { name: "max_por_capitulo", label: "Hallazgos por capítulo", tipo_input: "number", grupo: "textos", default: 3, min: 1, max: 3, step: 1,
    depende: { arg: "modo", valores: ["resumen"] } },
  { name: "max_por_lamina", label: "Hallazgos por lámina", tipo_input: "number", grupo: "textos", default: 8, min: 4, max: 8, step: 1,
    depende: { arg: "modo", valores: ["resumen", "titulares"] } },
  { name: "tambien", label: 'Mostrar "También"', tipo_input: "bool", grupo: "textos", default: true, depende: { arg: "modo", valores: ["resumen"] } },
  { name: "cruces", label: "Cruces", tipo_input: "variables_list", grupo: "datos", depende: { arg: "modo", valores: ["resumen", "titulares"] } },
  { name: "capitulos", label: "Capítulos y hallazgos", tipo_input: "hallazgos_capitulos", grupo: "datos",
    depende: { arg: "modo", valores: ["resumen", "titulares"] } },
];

vi.mock("../../useGraficosRegistry", () => ({
  useGraficosRegistry: () => ({ slidesById: { p_slide_hallazgos: { args: ARGS } }, graficadoresById: {} }),
}));
vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [{ name: "A11_recod", label: "Tipo de colegio", source: "base" }] }),
}));
vi.mock("../../../../lib/SessionContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/SessionContext")>()),
  useSession: () => ({ state: { active_base: "base" } }),
}));
vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
    { codigo: "1", etiqueta: "Público", n: 60, pct: 60, residual: false },
    { codigo: "2", etiqueta: "Privado", n: 40, pct: 40, residual: false },
  ] } }),
}));

const { InspectorLamina } = await import("../InspectorLamina");
const { construirEstructura } = await import("../modeloEstructura");
const { ajustesQueAplican } = await import("./AjustesHallazgos");

const real = [{ titulo: "Información general", cifras: [{ var: "A11_recod", fila: "Privado", texto: "estudió la secundaria en un colegio privado", comparacion: "auto" }] }];

function pintar(payload: Record<string, unknown>): string {
  const slide: Slide = { id: "h1", tipo: "p_slide_hallazgos", payload };
  const lamina = construirEstructura([slide]).laminas[0];
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/procesamiento?seccion=graficos"] },
    createElement(InspectorLamina, {
      slide, lamina, ranura: null, onRanura: () => undefined, visor: null, onCerrar: () => undefined,
      onCambiarLamina: () => undefined, onCambiarGrafico: () => undefined,
    })));
}

describe('"Hallazgos clave" en el inspector', () => {
  it("los ajustes siguen a su modo: con el de por defecto (cifras) no aparece el resumen", () => {
    const nombres = (p: Record<string, unknown>) => ajustesQueAplican(ARGS.slice(3), p).map((a) => a.name);
    expect(nombres({})).toEqual(["modo"]);
    expect(nombres({ modo: "resumen" })).toEqual(["modo", "seleccion", "max_por_capitulo", "max_por_lamina", "tambien", "cruces", "capitulos"]);
    expect(nombres({ modo: "titulares" })).toEqual(["modo", "seleccion", "max_por_lamina", "cruces", "capitulos"]);
  });

  it("en modo cifras: el modo se elige y las cifras se nombran como pendientes, sin campo de texto para los capítulos", () => {
    const html = pintar({ cifras: [{ var: "q1" }] });
    expect(html).toContain('data-campo="modo"');
    expect(html).toContain("Cifras destacadas: en este modo todavía se escriben en el plan.");
    expect(html).not.toContain('data-campo="capitulos"');
    // Antes, el tipo desconocido caía a «string» y «Capítulos y hallazgos» salía como un campo de texto que pisaba la lista.
    expect(html).not.toMatch(/<input[^>]*data-campo="capitulos"/);
    expect(html).not.toContain("todavía no está en Láminas");
  });

  it("en el resumen: cruces, capítulos y el hallazgo real con su respuesta marcada y su comparación", () => {
    const html = pintar({ modo: "resumen", capitulos: real, cruces: ["A1_sexo"] });
    expect(html).toContain('data-campo="cruces"');
    expect(html).toContain('data-qa="capitulos-hallazgos"');
    expect(html).toContain('value="Información general"');
    expect(html).toContain('aria-label="Capítulo &quot;Información general&quot;"');
    expect(html).toContain('aria-label="Hallazgo 1 del capítulo &quot;Información general&quot;"');
    expect(html).toMatch(/aria-pressed="true"[^>]*title="Código 2/);
    expect(html).toContain("estudió la secundaria en un colegio privado");
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(?:<span[^>]*>)?Automática/);
    expect(html).toContain("1 de 1 sale");
    // Sólo en «titulares» se pide el titular.
    expect(html).not.toContain("Titular del capítulo");
    expect(pintar({ modo: "titulares", capitulos: real })).toContain('placeholder="Titular del capítulo"');
  });

  it("en el resumen, el nombre de cada cruce y los rótulos cortos de sus grupos se editan (U7)", () => {
    const html = pintar({ modo: "resumen", capitulos: real, cruces: ["A11_recod"], rotulos: { A11_recod: "Colegio" },
      cortos: { "Economía y Finanzas": "Econ. y Fin." } });
    expect(html).toContain('aria-label="Nombre de Tipo de colegio en la lámina"');
    expect(html).toContain('value="Colegio"');
    expect(html).toContain('data-qa="tarjetas-cortos"');
    expect(html).toContain('value="Econ. y Fin."');
    // En los modos de cifras el registro no ofrece los cruces.
    expect(pintar({ cifras: [{ var: "q1" }] })).not.toContain('data-qa="cruces-lamina"');
  });

  it("lo que el editor no maneja se lee; lo incompleto avisa", () => {
    const html = pintar({ modo: "resumen", capitulos: [{ titulo: "Trabajo", cifras: [
      { var: "P5", sumar: ["Sí", "A veces"], texto: "trabaja", comparacion: "ninguna" },
      { var: "", texto: "" },
    ] }] });
    expect(html).toContain("Suma: Sí + A veces. No se edita aquí y se conserva.");
    expect(html).toContain("Falta la pregunta, la respuesta y el texto: no sale.");
  });

  it("con selección automática muestra la propuesta del motor (cargando) en lugar del editor (H13)", () => {
    const html = pintar({ modo: "resumen", seleccion: "auto" });
    expect(html).toContain('data-qa="propuesta-motor"');
    expect(html).toContain("Lo que propone el motor");
    expect(html).toContain("Calculando la propuesta del motor. Tarda unos segundos.");
    expect(html).not.toContain("pulso-f6-hallazgos-campo");
    expect(html).not.toContain("Traer la propuesta del motor");
  });

  it("en manual ofrece traer la propuesta del motor sin pedirla todavía", () => {
    const html = pintar({ modo: "resumen", seleccion: "manual", capitulos: real });
    expect(html).toContain("Traer la propuesta del motor");
    expect(html).not.toContain('data-qa="propuesta-motor"');
    expect(html).toContain("pulso-f6-hallazgos-campo");
  });

  it('en modo de cifras no hay propuesta, aunque quede un "auto" guardado', () => {
    const html = pintar({ modo: "cifras", seleccion: "auto", cifras: [{ var: "q1" }] });
    expect(html).not.toContain("Traer la propuesta del motor");
    expect(html).not.toContain('data-qa="propuesta-motor"');
  });

  it("en manual sin capítulos completos avisa que el motor no arma la lámina", () => {
    expect(pintar({ modo: "resumen" })).toContain("Sin un capítulo completo, el motor no arma esta lámina en selección manual.");
  });
});
