import { describe, expect, it } from "vitest";
import type { VariableDeBase } from "../../../../api/equivalencias";
import { aFilasEditor, type FilaEditor } from "../../equivalenciasEditorModel";
import { nombreDeSerieDeBases } from "../../nombreDeSerie";
import {
  cifrasDeEquivalencias,
  conteoPorFiltro,
  escalasDeFila,
  filaDeFoco,
  filaDelInspector,
  filasDeMesa,
  filasVisibles,
  mapaEnPalabras,
  resumenDeEscalas,
  rotuloCorto,
} from "./equivalenciasMesaModel";

const BASES = ["docentes", "estudiantes", "egresados"];
const op = (codigo: string, etiqueta: string) => ({ codigo, etiqueta });
const ACUERDO = [op("1", "Muy en desacuerdo"), op("2", "En desacuerdo"), op("3", "De acuerdo"), op("4", "Muy de acuerdo")];
const v = (name: string, firma: string, opciones = ACUERDO): VariableDeBase => ({ name, label: name, seccion: "", firma, opciones });
const CATALOGO: Record<string, VariableDeBase[]> = {
  docentes: [v("p1", "A"), v("p2", "A"), v("p9", "", [])],
  estudiantes: [v("q1", "A"), v("q2", "B", [op("1", "Mala"), op("2", "Buena")]), v("q9", "", [])],
  egresados: [v("r1", "A")],
};

function filas(): FilaEditor[] {
  return aFilasEditor([
    { seccion: "", etiqueta_estandar: "Satisfacción con la formación", variables: { docentes: "p1", estudiantes: "q1", egresados: "r1" }, cantidad: 3 },
    { seccion: "", etiqueta_estandar: "Infraestructura", variables: { docentes: "p2", estudiantes: "q2" }, cantidad: 2 },
    { seccion: "", etiqueta_estandar: "Edad", variables: { docentes: "p9", estudiantes: "q9" }, cantidad: 2 },
    { id: "B-7", seccion: "", etiqueta_estandar: "Género", variables: { docentes: "p1" }, cantidad: 1 },
  ]);
}

const serie = nombreDeSerieDeBases(BASES);

describe("mesa de Equivalencias", () => {
  it("cada fila dice su escala con el rótulo corto y cuenta en qué bases está", () => {
    const m = filasDeMesa(filas(), BASES, CATALOGO, serie);
    expect(m.map((f) => f.estado.texto)).toEqual(["Misma escala", "Por armonizar", "Sin lista", "Falta otra base"]);
    expect(m.map((f) => f.estado.porArmonizar)).toEqual([false, true, false, false]);
    expect(m.map((f) => f.enBases)).toEqual([3, 2, 2, 1]);
    expect(m.map((f) => f.estado.sinLista)).toEqual([false, false, true, false]);
    expect(resumenDeEscalas(m)).toEqual({ porArmonizar: 1, sinLista: 1 });
  });

  it("el estado largo se acorta para su columna; el detalle queda en la explicación", () => {
    expect(rotuloCorto("Revisar mapa en 2 bases")).toBe("Revisar mapa");
    expect(rotuloCorto("Revisar mapa en estudiantes")).toBe("Revisar mapa");
    expect(rotuloCorto("No comparable en 3 bases")).toBe("No comparable");
    expect(rotuloCorto("Escalas distintas: armonizar")).toBe("Por armonizar");
    expect(rotuloCorto("Armonizada")).toBe("Armonizada");
  });

  it("filtros y cifras salen de las mismas filas: por armonizar, falta en alguna base y en todas", () => {
    const m = filasDeMesa(filas(), BASES, CATALOGO, serie);
    expect(conteoPorFiltro(m, BASES.length)).toEqual({ todas: 4, armonizar: 1, falta: 3 });
    expect(cifrasDeEquivalencias(m, BASES.length)).toEqual({ emparejadas: 4, porArmonizar: 1, enTodas: 1 });
    expect(filasVisibles(m, "armonizar", "", BASES.length).map((f) => f.fila.etiqueta_estandar)).toEqual(["Infraestructura"]);
  });

  it("busca por nombre sin tildes o por el código de cualquier base", () => {
    const m = filasDeMesa(filas(), BASES, CATALOGO, serie);
    expect(filasVisibles(m, "todas", "satisfaccion", BASES.length).map((f) => f.fila.etiqueta_estandar)).toEqual(["Satisfacción con la formación"]);
    expect(filasVisibles(m, "todas", "Q2", BASES.length).map((f) => f.fila.etiqueta_estandar)).toEqual(["Infraestructura"]);
  });

  it("el foco nombra la fila por su id de bloque o por su posición guardada, y el inspector cae en la primera visible", () => {
    const f = filas();
    expect(filaDeFoco(f, "B-7")?.etiqueta_estandar).toBe("Género");
    expect(filaDeFoco(f, "1")?.etiqueta_estandar).toBe("Infraestructura");
    expect(filaDeFoco(f, "99")).toBeNull();
    const m = filasDeMesa(f, BASES, CATALOGO, serie);
    const visibles = filasVisibles(m, "armonizar", "", BASES.length);
    expect(filaDelInspector(visibles, m, f[3].id)?.fila.etiqueta_estandar).toBe("Género");
    expect(filaDelInspector(visibles, m, "fila-que-no-existe")?.fila.etiqueta_estandar).toBe("Infraestructura");
    expect(filaDelInspector([], [], null)).toBeNull();
  });

  it("la escala de cada base sale del catálogo por código de variable; la base sin la pregunta queda vacía", () => {
    const e = escalasDeFila(filas()[1], BASES, CATALOGO);
    expect(e.map((x) => [x.base, x.variable, x.opciones.length])).toEqual([["docentes", "p2", 4], ["estudiantes", "q2", 2], ["egresados", "", 0]]);
  });

  it("el mapa guardado se lee por código, no por posición, junta las bases con la misma frase y nombra lo que queda fuera", () => {
    // La lista de estudiantes viene en otro orden: por posición, "Muy de acuerdo" caería en Desacuerdo.
    const catalogo: Record<string, VariableDeBase[]> = {
      ...CATALOGO,
      estudiantes: [v("q1", "A2", [op("4", "Muy de acuerdo"), op("3", "De acuerdo"), op("2", "En desacuerdo"), op("1", "Muy en desacuerdo"), op("9", "No sabe")])],
    };
    const mapa = { "1": "1", "2": "1", "3": "2", "4": "2" };
    const fila: FilaEditor = {
      ...filas()[0],
      armonizacion: {
        escala: [op("1", "Desacuerdo"), op("2", "Acuerdo")],
        por_base: { docentes: { comparable: true, mapa }, estudiantes: { comparable: true, mapa }, egresados: { comparable: true, mapa: {} } },
      },
    };
    const pasos = mapaEnPalabras(fila, escalasDeFila(fila, BASES, catalogo));
    expect(pasos).toEqual([
      { bases: ["docentes"], frase: '"Muy en desacuerdo" y "En desacuerdo" pasan a Desacuerdo; "De acuerdo" y "Muy de acuerdo" a Acuerdo' },
      { bases: ["estudiantes"], frase: '"Muy de acuerdo" y "De acuerdo" pasan a Acuerdo; "En desacuerdo" y "Muy en desacuerdo" a Desacuerdo; "No sabe" queda sin categoría' },
    ]);
  });

  it("sin escala común no hay mapa que leer", () => {
    expect(mapaEnPalabras(filas()[0], escalasDeFila(filas()[0], BASES, CATALOGO))).toEqual([]);
  });
});
