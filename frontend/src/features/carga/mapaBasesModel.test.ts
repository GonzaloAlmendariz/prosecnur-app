// G1: qué tiene cada base y qué le falta frente a las otras.
import { describe, expect, test } from "vitest";
import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { PANELES_CARGA } from "./panelesCarga";
import {
  PANEL_MAPA_BASES,
  filasDelMapa,
  presenciaEnBase,
  resumenPorBase,
  textoFaltaEn,
  variablesEnMatriz,
  variablesFuera,
} from "./mapaBasesModel";

const v = (name: string, label = name, seccion = ""): VariableDeBase => ({ name, label, seccion });
const variablesPorBase: Record<string, VariableDeBase[]> = {
  "2024": [v("p1", "Edad"), v("p2", "Sexo"), v("p3", "¿Usó el *servicio* de salud?"), v("p4", "Facultad"), v("p5", "Ciclo")],
  "2025": [v("q1", "Edad"), v("q2", "Sexo"), v("q3", "Uso del servicio de salud")],
  "2026": [],
};
const bases = ["2024", "2025", "2026"];
const fila = (etiqueta: string, variables: Record<string, string>, extra: Partial<EquivalenciaFila> = {}): EquivalenciaFila => ({
  seccion: "", etiqueta_estandar: etiqueta, variables, cantidad: Object.keys(variables).length, ...extra,
});

const FILAS: EquivalenciaFila[] = [
  fila("Edad", { "2024": "p1", "2025": "q1" }),
  fila("Sexo", { "2024": "p2", "2025": "q2" }, {
    armonizacion: { escala: [{ codigo: "1", etiqueta: "Mujer" }], por_base: { "2025": { comparable: false, mapa: {} } } },
  }),
  // Un indicador compuesto nombra sus componentes en `derivada`; la variable es una expresión.
  fila("Usó algún servicio", { "2024": "alguna(p3,p4)" }, {
    derivada: { regla: "alguna", por_base: { "2024": { variables: ["p3", "p4"], codigos: ["1"] } } },
  }),
  fila("", {}),
];

describe("mapa de bases", () => {
  test("el panel está declarado en el manifiesto de Carga", () => {
    expect(PANELES_CARGA).toContain(PANEL_MAPA_BASES);
    expect(PANEL_MAPA_BASES.id).toBe("mapa-bases");
  });

  test("una variable está en la matriz como pregunta o como componente de un compuesto", () => {
    expect([...variablesEnMatriz(FILAS, "2024")].sort()).toEqual(["alguna(p3,p4)", "p1", "p2", "p3", "p4"]);
  });

  test("resumen por base: total del instrumento, en la matriz y fuera", () => {
    expect(resumenPorBase(bases, FILAS, variablesPorBase)).toEqual([
      { base: "2024", total: 5, enMatriz: 4, fuera: 1 },
      { base: "2025", total: 3, enMatriz: 2, fuera: 1 },
      { base: "2026", total: 0, enMatriz: 0, fuera: 0 },
    ]);
  });

  test("presencia por base: presente, falta o no comparable", () => {
    expect(presenciaEnBase(FILAS[0], "2024")).toBe("presente");
    expect(presenciaEnBase(FILAS[0], "2026")).toBe("falta");
    expect(presenciaEnBase(FILAS[1], "2025")).toBe("no-comparable");
    expect(presenciaEnBase(FILAS[2], "2024")).toBe("presente");
  });

  test("la tabla deja fuera las filas vacías y marca las que faltan en alguna base", () => {
    const mapa = filasDelMapa(bases, FILAS);
    expect(mapa.map((f) => f.etiqueta)).toEqual(["Edad", "Sexo", "Usó algún servicio"]);
    expect(mapa.every((f) => f.incompleta)).toBe(true);
    expect(textoFaltaEn(mapa)).toBe("3 faltan en alguna base.");
    expect(textoFaltaEn(filasDelMapa(["2024"], FILAS.slice(0, 2)))).toBe("Todas están en todas las bases.");
  });

  test("variables fuera de la matriz, en el orden del instrumento y con búsqueda", () => {
    expect(variablesFuera("2024", FILAS, variablesPorBase).map((x) => x.name)).toEqual(["p5"]);
    expect(variablesFuera("2025", FILAS, variablesPorBase, "salud").map((x) => x.name)).toEqual(["q3"]);
    expect(variablesFuera("2025", FILAS, variablesPorBase, "facultad")).toEqual([]);
    expect(variablesFuera("2026", FILAS, variablesPorBase)).toEqual([]);
  });
});

describe("metadatos aparte", () => {
  test("identificadores, fechas, consentimientos y filtro van aparte; las preguntas no", async () => {
    const { separarMetadatos } = await import("./mapaBasesModel");
    const v = (name: string) => ({ name, label: name, seccion: "", firma: "", opciones: [] });
    const r = separarMetadatos(["UUID", "ID", "fecha_envio", "consentimiento_1", "primer_ciclo", "P11", "Sexo", "P12_R", "facultad"].map(v));
    expect(r.metadatos.map((x) => x.name)).toEqual(["UUID", "ID", "fecha_envio", "consentimiento_1", "primer_ciclo"]);
    expect(r.preguntas.map((x) => x.name)).toEqual(["P11", "Sexo", "P12_R", "facultad"]);
  });
});
