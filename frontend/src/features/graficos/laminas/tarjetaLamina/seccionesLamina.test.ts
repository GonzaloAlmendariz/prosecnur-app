import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../../../api/graficos";
import { conSeccionLamina, esSeccionLamina, MIN_SECCIONES_INDICE, seccionesDeLamina, seccionLaminaAbierta } from "./seccionesLamina";

const arg = (name: string, extra: Partial<ArgMetadata> = {}): ArgMetadata => ({ name, label: name, tipo_input: "choice", grupo: "textos", ...extra });

// Como el registro de «Hallazgos clave»: los capítulos sólo aplican en los modos de resumen.
const AJUSTES = [
  arg("modo", { default: "cifras", choices: [{ value: "cifras", label: "Cifras" }, { value: "resumen", label: "Resumen" }] }),
  arg("capitulos", { tipo_input: "hallazgos_capitulos", depende: { arg: "modo", valores: ["resumen", "titulares"] } }),
];

describe("secciones de la pestaña «Lámina»", () => {
  test("una lámina de gráfico tiene Composición y Textos, sin índice", () => {
    const s = seccionesDeLamina("p_slide_1_grafico", [], {});
    expect(s.map((x) => x.clave)).toEqual(["composicion", "textos"]);
    expect(s.length).toBeLessThan(MIN_SECCIONES_INDICE);
  });

  test("Hallazgos clave en resumen suma sus ajustes y sus capítulos: cuatro secciones y el índice", () => {
    const s = seccionesDeLamina("p_slide_hallazgos", AJUSTES, { modo: "resumen" });
    expect(s.map((x) => x.clave)).toEqual(["composicion", "textos", "ajustes", "capitulos"]);
    expect(s.map((x) => x.rotulo)).toEqual(["Composición", "Textos", "Hallazgos", "Capítulos"]);
    expect(s.find((x) => x.clave === "capitulos")?.titulo).toBe("Capítulos y hallazgos");
    expect(s.length).toBeGreaterThanOrEqual(MIN_SECCIONES_INDICE);
  });

  test("en modo de cifras no hay capítulos", () => {
    expect(seccionesDeLamina("p_slide_hallazgos", AJUSTES, {}).map((x) => x.clave)).toEqual(["composicion", "textos", "ajustes"]);
  });

  test("Resumen de diferencias nombra sus secciones como su lámina", () => {
    const s = seccionesDeLamina("p_slide_resumen_diferencias", [arg("capitulos", { tipo_input: "resumen_capitulos" })], {});
    expect(s.slice(2).map((x) => [x.titulo, x.rotulo])).toEqual([["Resumen de diferencias", "Resumen"], ["Capítulos y filas", "Capítulos"]]);
  });

  test("sólo Composición arranca abierta; abrir otra se recuerda sin copiar lo que no cambia", () => {
    expect(seccionLaminaAbierta({}, "composicion")).toBe(true);
    expect(seccionLaminaAbierta({}, "capitulos")).toBe(false);
    const vacio = {};
    expect(conSeccionLamina(vacio, "composicion", true)).toBe(vacio);
    expect(conSeccionLamina(vacio, "capitulos", true)).toEqual({ capitulos: true });
  });

  test("reconoce sus claves y no las de la tarjeta del gráfico", () => {
    expect(esSeccionLamina("capitulos")).toBe(true);
    expect(esSeccionLamina("cifras")).toBe(false);
  });
});
