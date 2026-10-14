// ADR 0104: la matriz se arma en la app. La búsqueda filtra lo que la persona
// escribe y el indicador de escala compara sólo lo que ella eligió.
import { describe, expect, it } from "vitest";
import type { Armonizacion, VariableDeBase } from "../../api/equivalencias";
import {
  coincidenciaDeEscala,
  etiquetaDePregunta,
  filtrarPreguntas,
  indicadorDeEscala,
  normalizarBusqueda,
} from "./preguntaEquivalenteModel";
import { nombreDeSerie } from "./nombreDeSerie";

const v = (name: string, label: string, firma = "", seccion = ""): VariableDeBase => ({ name, label, seccion, firma });

const docentes = [
  v("p12_1", "¿Conoce el servicio de bienestar psicológico?", "1=Sí|2=No", "Servicios"),
  v("p13_1", "¿Ha utilizado el servicio de salud?", "1=Sí|2=No", "Servicios"),
  v("p20", "Satisfacción general con la universidad", "1..5", "Clima"),
  v("edad", "Edad", ""),
];
const estudiantes = [
  v("p11_1", "¿Ha usado el servicio de salud?", "1=Sí|2=No|9=NS"),
  v("p11_9", "¿Ha usado el servicio de salud? (filtro)", "1=Sí|2=No"),
  v("q30", "Satisfacción general", "1..5"),
  v("anios", "Edad en años", ""),
];
const porBase = { docentes, estudiantes };
const serie = nombreDeSerie(["docentes", "estudiantes"]);

describe("búsqueda por texto", () => {
  it("sin tildes ni mayúsculas, y cada palabra en cualquier orden", () => {
    expect(normalizarBusqueda("  SATISFACCIÓN ")).toBe("satisfaccion");
    expect(filtrarPreguntas(docentes, "salud servicio").map((o) => o.name)).toEqual(["p13_1"]);
    expect(filtrarPreguntas(docentes, "satisfaccion").map((o) => o.name)).toEqual(["p20"]);
  });

  it("busca también por código y por sección", () => {
    expect(filtrarPreguntas(docentes, "p12").map((o) => o.name)).toEqual(["p12_1"]);
    expect(filtrarPreguntas(docentes, "servicios").map((o) => o.name)).toEqual(["p12_1", "p13_1"]);
  });

  it("sin consulta devuelve todas en el orden del instrumento; sin coincidencia, ninguna", () => {
    expect(filtrarPreguntas(docentes, "  ").map((o) => o.name)).toEqual(["p12_1", "p13_1", "p20", "edad"]);
    expect(filtrarPreguntas(docentes, "inexistente")).toEqual([]);
  });

  it("la etiqueta de una pregunta, o su código si no tiene", () => {
    expect(etiquetaDePregunta(docentes, "p20")).toBe("Satisfacción general con la universidad");
    expect(etiquetaDePregunta([v("x", "  ")], "x")).toBe("x");
    expect(etiquetaDePregunta(docentes, "")).toBe("");
  });
});

describe("coincidencia de escala entre las bases elegidas", () => {
  const bases = ["docentes", "estudiantes"];

  it("con menos de dos bases elegidas no hay comparación", () => {
    expect(coincidenciaDeEscala(bases, { docentes: "p20" }, porBase)).toEqual({ tipo: "incompleta" });
  });

  it("misma firma es misma escala; otra firma, distinta, nombrando la base", () => {
    expect(coincidenciaDeEscala(bases, { docentes: "p20", estudiantes: "q30" }, porBase)).toEqual({ tipo: "misma" });
    expect(coincidenciaDeEscala(bases, { docentes: "p13_1", estudiantes: "p11_1" }, porBase))
      .toEqual({ tipo: "distintas", bases: ["estudiantes"] });
  });

  it("dos preguntas sin lista no tienen escala que comparar; una sin lista frente a una con lista es distinta", () => {
    expect(coincidenciaDeEscala(bases, { docentes: "edad", estudiantes: "anios" }, porBase)).toEqual({ tipo: "sin_lista" });
    expect(coincidenciaDeEscala(bases, { docentes: "edad", estudiantes: "q30" }, porBase))
      .toEqual({ tipo: "distintas", bases: ["estudiantes"] });
  });
});

describe("indicador de escala de la fila", () => {
  const bases = ["docentes", "estudiantes"];

  it("«Escalas distintas · Armonizar» abre la armonización", () => {
    const ind = indicadorDeEscala({ variables: { docentes: "p13_1", estudiantes: "p11_1" } }, bases, porBase, serie);
    expect(ind).toMatchObject({ tono: "aviso", texto: "Escalas distintas · Armonizar", abre: true });
    expect(ind.explicacion).toContain("estudiantes");
  });

  it("«Misma escala» y «Falta otra base»", () => {
    expect(indicadorDeEscala({ variables: { docentes: "p20", estudiantes: "q30" } }, bases, porBase, serie))
      .toMatchObject({ tono: "ok", texto: "Misma escala", abre: true });
    expect(indicadorDeEscala({ variables: { docentes: "p20" } }, bases, porBase, serie))
      .toMatchObject({ tono: "neutro", texto: "Falta otra base", abre: false });
  });

  it("una armonización declarada manda sobre la comparación de listas", () => {
    const armonizada: Armonizacion = {
      escala: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }],
      por_base: { docentes: { comparable: true, mapa: {} }, estudiantes: { comparable: true, mapa: { "9": "2" } } },
    };
    expect(indicadorDeEscala({ variables: { docentes: "p13_1", estudiantes: "p11_1" }, armonizacion: armonizada }, bases, porBase, serie))
      .toMatchObject({ tono: "ok", texto: "Armonizada", abre: true });
    const noComparable: Armonizacion = { ...armonizada, por_base: { docentes: { comparable: true, mapa: {} } } };
    expect(indicadorDeEscala({ variables: { docentes: "p13_1", estudiantes: "p11_1" }, armonizacion: noComparable }, bases, porBase, serie))
      .toMatchObject({ tono: "aviso", texto: "No comparable en 1 base" });
  });
});
