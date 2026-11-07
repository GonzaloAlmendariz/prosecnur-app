import { describe, expect, it } from "vitest";
import type { VarWithSource } from "../../useVariables";
import {
  aEntreBases, aEntreGrupos, conCorte, conCruce, conGrupo, conPreguntas, corteDe, esEntreGrupos, faltaEnBrecha, gruposDe, maxGrupos,
  mismaBase, opcionesDe, opcionesDeGrupo, preguntasDe,
} from "./modeloBrechaGrupos";

const v = (source: string, name: string, choices: [string, string][] = []): VarWithSource =>
  ({ source, name, label: name, tipo: "select_one", seccion: "", choices: choices.map(([n, l]) => ({ name: n, label: l })) }) as VarWithSource;
const vars = [v("docentes", "p3", [["1", "Masculino"], ["2", "Femenino"]]), v("docentes", "p12_1", [["4", "Satisfecho"], ["5", "Muy satisfecho"]]),
  v("docentes", "p12_2"), v("estudiantes", "p12_1")];

describe("la brecha entre dos grupos de una base (G17)", () => {
  it("una brecha recién elegida arranca en dos grupos; con preguntas por base o vuelta a bases, en dos bases", () => {
    expect(esEntreGrupos({})).toBe(true);
    expect(esEntreGrupos({ vars: [] })).toBe(true);
    expect(esEntreGrupos({ vars: { tema_1: ["docentes$p12_1", "estudiantes$p12_1"] } })).toBe(false);
    expect(esEntreGrupos({ ...aEntreBases() })).toBe(false);
  });

  it("pasar a grupos deja cruce vacío y pide, en orden, cruce, grupos, preguntas e indicador", () => {
    let a: Record<string, unknown> = { vars: { tema_1: ["docentes$p12_1", "estudiantes$p12_1"] }, corte: "4,5" };
    expect(esEntreGrupos(a)).toBe(false);
    a = { ...a, ...aEntreGrupos() };
    expect(esEntreGrupos(a)).toBe(true);
    expect(faltaEnBrecha(a)).toMatch(/pregunta que define/);
    a = { ...a, ...conCruce(vars, "p3") };
    expect(a.cruce).toBe("docentes$p3");                       // la ref lleva su base aunque el picker la dé sin ella
    expect(opcionesDe(vars, a.cruce as string).map((o) => o.etiqueta)).toEqual(["Masculino", "Femenino"]);
    expect(faltaEnBrecha(a)).toMatch(/dos grupos/);
    a = { ...a, ...conGrupo(a, 0, "2") }; a = { ...a, ...conGrupo(a, 1, "1") };
    expect(a.grupos).toEqual(["2", "1"]);
    expect(faltaEnBrecha(a)).toMatch(/al menos una pregunta/);
    a = { ...a, ...conPreguntas(vars, ["p12_1", "p12_2"]) };
    expect(preguntasDe(a)).toEqual(["docentes$p12_1", "docentes$p12_2"]);
    a = { ...a, corte: "" };
    expect(faltaEnBrecha(a)).toMatch(/indicador/);
    a = { ...a, ...conCorte(a, "4", true) }; a = { ...a, ...conCorte(a, "5", true) };
    expect(corteDe(a)).toEqual(["4", "5"]);
    expect(faltaEnBrecha(a)).toBeNull();
  });

  it("volver a dos bases quita cruce y grupos; una pregunta de otra base se señala", () => {
    expect(aEntreBases()).toEqual({ cruce: null, grupos: null, vars: {} });
    expect(mismaBase(vars, "docentes$p3", "estudiantes$p12_1")).toBe(false);
    expect(mismaBase(vars, "docentes$p3", "docentes$p12_2")).toBe(true);
  });
});

describe("la brecha entre dos bases se arma en la lámina (P21, enmienda ADR 0103)", () => {
  it("vars por tema con titulos_grupo y corte en arreglo siguen siendo entre bases", () => {
    const args = { cruce: null, grupos: null, vars: { tema_1: ["docentes$p12_1", "estudiantes$p12_1"] }, titulos_grupo: { tema_1: "Clima" }, corte: ["4", "5"] };
    expect(esEntreGrupos(args)).toBe(false);
  });
});

describe("la brecha entre grupos con el contraste del resumen ejecutivo (ADR 0134)", () => {
  const listo = { cruce: "docentes$ciclo", vars: ["docentes$p12_1"], corte: "4,5" };
  const opciones = ["1", "2", "3", "4", "5"].map((codigo) => ({ codigo, etiqueta: `Ciclo ${codigo}` }));

  it("el recetario son exactamente dos casillas; el resumen abre una más mientras quepa, hasta cuatro", () => {
    expect(maxGrupos({})).toBe(2);
    expect(maxGrupos({ estilo: "recetario" })).toBe(2);
    expect(maxGrupos({ estilo: "resumen" })).toBe(4);
    expect(gruposDe({ ...listo, grupos: ["1", "2"] })).toEqual(["1", "2"]);
    expect(gruposDe({ ...listo, estilo: "resumen", grupos: [] })).toEqual(["", ""]);
    expect(gruposDe({ ...listo, estilo: "resumen", grupos: ["1", "2"] })).toEqual(["1", "2", ""]);
    expect(gruposDe({ ...listo, estilo: "resumen", grupos: ["1", "2", "3"] })).toEqual(["1", "2", "3", ""]);
    expect(gruposDe({ ...listo, estilo: "resumen", grupos: ["1", "2", "3", "4"] })).toEqual(["1", "2", "3", "4"]);
  });

  it("elegir hasta cuatro grupos distintos; los huecos desde el tercero se cierran", () => {
    let a: Record<string, unknown> = { ...listo, estilo: "resumen", grupos: [] };
    for (const [k, c] of [[0, "1"], [1, "2"], [2, "3"], [3, "4"]] as const) a = { ...a, ...conGrupo(a, k, c) };
    expect(a.grupos).toEqual(["1", "2", "3", "4"]);
    expect(faltaEnBrecha(a)).toBeNull();
    a = { ...a, ...conGrupo(a, 2, "") };
    expect(a.grupos).toEqual(["1", "2", "4"]);
    // Un código ya elegido antes deja vacía la casilla posterior: el motor rechaza grupos repetidos.
    a = { ...a, ...conGrupo(a, 2, "1") };
    expect(a.grupos).toEqual(["1", "2"]);
    expect(opcionesDeGrupo(opciones, { ...a, grupos: ["1", "2", "3"] }, 2).map((o) => o.codigo)).toEqual(["3", "4", "5"]);
  });

  it("con dos grupos vacíos pide los dos primeros; un recetario con más de dos lo avisa sin recortarlos", () => {
    expect(faltaEnBrecha({ ...listo, estilo: "resumen", grupos: ["1"] })).toMatch(/dos primeros grupos/);
    const sobrante = { ...listo, estilo: "recetario", grupos: ["1", "2", "3"] };
    expect(gruposDe(sobrante)).toEqual(["1", "2", "3"]);
    expect(faltaEnBrecha(sobrante)).toMatch(/Recetario compara dos grupos/);
    expect(conGrupo(sobrante, 2, "")).toEqual({ grupos: ["1", "2"] });
  });
});
