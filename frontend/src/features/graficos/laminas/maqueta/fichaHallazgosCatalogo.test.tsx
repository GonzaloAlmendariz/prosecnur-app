// Hallazgos M2–M7 del recorrido del catálogo del recetario en la app (docs/qa/checklist-catalogo-recetario-2026-10-14.md):
// la ficha decía cosas que no eran ciertas o callaba ajustes encendidos.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Slide } from "../../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../../usePlanValidator";
import { ranurasDeMaqueta } from "../modeloMaqueta";
import { datosEstructura } from "./datosEstructura";
import { FichaRanura } from "./FichaRanura";
import { fichaDeRanura, TTB_SIN_RESPUESTAS, type FichaInfo } from "./fichaModelo";

const ACUERDO = ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"];
const v = (source: string, name: string, labels: string[], label = name) =>
  ({ name, source, label, list_name: `l_${name}`, tipo: "select_one", seccion: "", choices: labels.map((l, i) => ({ name: String(i + 1), label: l })), n_non_empty: 100 });
const VARS = ["docentes", "estudiantes"].flatMap((s) => [
  v(s, "p1", ACUERDO, "La Unidad cuenta con tutoría"), v(s, "p2", ACUERDO, "Los trámites son claros"),
  v(s, "sexo", ["Mujer", "Hombre"], "Sexo"), v(s, "mision", ["Sí", "No"], "¿Conoce la misión?"),
]) as never[];
const slide = (graficador: string, args: Record<string, unknown>) =>
  ({ id: "s", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: { graficador, args } } }) as unknown as Slide;
const ficha = (s: Slide): FichaInfo => fichaDeRanura(ranurasDeMaqueta(s, VARS, {})[0], "Tipo");

describe("M2 · Top Two Box sin respuestas", () => {
  it("la ficha lo avisa y el panel lo cuenta como aviso, sin bloquear", () => {
    const s = slide("p_barras_multiapiladas", { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2"], top2box: true });
    expect(ficha(s).avisos).toContain(TTB_SIN_RESPUESTAS);
    const entrada = { slides: [s], presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [], slidesById: {}, graficadoresById: {}, presetsByName: {}, variables: VARS, multi: true } as unknown as EntradaValidarPlan;
    const r = validarPlan(entrada);
    expect(r.warnings.some((w) => w.code === "ttb-sin-respuestas")).toBe(true);
    expect(r.canExport).toBe(true);
  });

  it("con sus respuestas declaradas no hay aviso", () => {
    const s = slide("p_barras_multiapiladas", { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2"], top2box: true, top2box_labels: ["De acuerdo", "Totalmente de acuerdo"] });
    expect(ficha(s).avisos).not.toContain(TTB_SIN_RESPUESTAS);
  });
});

describe("M3 · ancho del tema con el control vigente", () => {
  const publicos = (ancho: string) => slide("p_barras_multiapiladas", { modo: "var_cruce", vars: { Tutoria: ["docentes$p1", "estudiantes$p1"] }, ancho_tema: ancho });
  it("«Más ancho» y «Más angosto» aparecen como ajuste", () => {
    expect(ficha(publicos("ancho")).ajustes).toContain("Temas anchos");
    expect(ficha(publicos("angosto")).ajustes).toContain("Temas angostos");
    expect(ficha(publicos("auto")).ajustes.some((a) => a.startsWith("Temas"))).toBe(false);
  });
});

describe("M5 · gráficos sin `var` que sí tienen pregunta", () => {
  it("la matriz de cuadrantes por sus temas y las dimensiones por su objetivo no dicen «falta elegir la pregunta»", () => {
    const matriz = ficha(slide("p_matriz_cuadrantes", { temas: { Tutoría: ["estudiantes$p1", "docentes$p1"] }, corte_x: "3,4", corte_y: "3,4" }));
    expect(matriz.faltaPregunta).toBe(false);
    expect(matriz.preguntas).toContain("Tutoría");
    const dim = ficha(slide("p_dim_heatmap", { modo: "general", objetivo: "idx_comp", cruce: "estudiantes$sexo" }));
    expect(dim.faltaPregunta).toBe(false);
    expect(dim.ajustes).toContain("Por grupos: Sexo");   // su `modo` («general») no es el de las multiapiladas
    expect(ficha(slide("p_dim_heatmap_criterios", { config_criterios: [{ id: "a", titulo: "Técnicas", vars: [] }] })).preguntas).toContain("Técnicas");
  });
});

describe("M6 · sin cifras de ejemplo", () => {
  it("la dona y la cifra destacada no muestran «64%» ni «31%» en la maqueta", () => {
    for (const g of ["p_donut", "p_cifra"]) {
      const info = ficha(slide(g, { var: "estudiantes$mision" }));
      const html = renderToStaticMarkup(<FichaRanura info={info} w={4} h={3} clave="k" />);
      expect(html, g).not.toMatch(/64%|31%/);
    }
  });
});

describe("M7 · grupos y significancia", () => {
  it("las apiladas con cruce dicen «Por grupos» y la significancia encendida se nombra", () => {
    expect(ficha(slide("p_barras_apiladas", { var: "estudiantes$p1", cruces: "estudiantes$sexo" })).ajustes).toContain("Por grupos: Sexo");
    expect(ficha(slide("p_barras_agrupadas", { var: "estudiantes$mision", cruces: "estudiantes$sexo", mostrar_significancia: true })).ajustes)
      .toEqual(expect.arrayContaining(["Por grupos: Sexo", "Diferencias significativas"]));
  });
});

describe("M4 · índice que toma sus capítulos del informe", () => {
  it("sin capítulos propios, la maqueta lista los separadores de capítulo (no los de subcapítulo)", () => {
    const indice = { tipo: "p_slide_indice", payload: { titulo: "Índice" } } as unknown as Slide;
    const informe = [
      indice,
      { tipo: "p_slide_seccion", payload: { titulo: "Perfil" } },
      { tipo: "p_slide_seccion", payload: { titulo: "Detalle", meta: { nivel: "subcapitulo" } } },
      { tipo: "p_slide_seccion", payload: { titulo: "Resultados" } },
    ] as unknown as Slide[];
    expect(datosEstructura(indice, informe).capitulos).toEqual(["Perfil", "Resultados"]);
    expect(datosEstructura(indice).capitulos).toEqual([]);
  });
});
