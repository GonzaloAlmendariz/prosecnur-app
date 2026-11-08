// Coincidencia de un par en «Revisar emparejado» (X6): umbrales con nombre, texto normalizado, puntaje del motor o
// medido aquí con las mismas palabras que el backend, conteo y filtro.
import { describe, expect, it } from "vitest";
import type { PreguntaEmparejado } from "../../../../api/graficosEmparejado";
import {
  clasificarCoincidencia, coincidenciaDeFila, coincidenciasDe, contarCoincidencias, filtrarPorCoincidencia, normalizarTexto,
  palabrasDe, parecidoDeTexto, rotuloFiltroCoincidencia, UMBRAL_IDENTICO, UMBRAL_PARECIDO,
} from "./coincidencia";
import type { FilaEmparejado } from "./modeloEmparejado";

const pregunta = (etiqueta: string, extra: Partial<PreguntaEmparejado> = {}): PreguntaEmparejado => ({
  base: "docentes", var: "p1", etiqueta, tema: etiqueta, estado: "sin_par", par: null, sugerencias: [], ...extra,
});

const fila = (clave: string, a: string, b: string | null, puntaje: number | null, extra: Partial<FilaEmparejado> = {}): FilaEmparejado => ({
  clave,
  pregunta: pregunta(a),
  estado: b === null ? "sin_par" : puntaje === null ? "matriz" : "sugerido",
  par: b === null ? null : { base: "estudiantes", var: "q1", etiqueta: b },
  puntaje,
  otraBase: "estudiantes",
  ...extra,
});

describe("umbrales", () => {
  it("idéntico desde 1 y parecido desde 0,5", () => {
    expect(UMBRAL_IDENTICO).toBe(1);
    expect(UMBRAL_PARECIDO).toBe(0.5);
  });
});

describe("clasificarCoincidencia", () => {
  it("el texto normalizado igual es idéntico aunque el puntaje no llegue a 1", () => {
    expect(clasificarCoincidencia("Servicio de salud", "servicio de  SALUD.", 0.4)).toBe("identico");
    expect(clasificarCoincidencia("¿Cómo calificas la atención?", "Como calificas la atencion", 0)).toBe("identico");
  });
  it("puntaje 1 es idéntico aunque el texto difiera", () => {
    expect(clasificarCoincidencia("Servicio de salud", "Salud: servicio", 1)).toBe("identico");
  });
  it("de 0,5 en adelante es parecido; por debajo, distinto", () => {
    expect(clasificarCoincidencia("a b", "c d", 0.5)).toBe("parecido");
    expect(clasificarCoincidencia("a b", "c d", 0.999)).toBe("parecido");
    expect(clasificarCoincidencia("a b", "c d", 0.499)).toBe("distinto");
    expect(clasificarCoincidencia("a b", "c d", 0.2)).toBe("distinto");
  });
  it("dos textos vacíos no son idénticos por normalización", () => {
    expect(clasificarCoincidencia("", "", 0)).toBe("distinto");
  });
});

describe("palabras y parecido", () => {
  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normalizarTexto("  Estoy satisfecho(a) con el LIDERAZGO… ")).toBe("estoy satisfecho a con el liderazgo");
  });
  it("quita las palabras vacías del backend y no repite", () => {
    expect(palabrasDe("La calidad de la enseñanza y la calidad del servicio")).toEqual(["calidad", "ensenanza", "servicio"]);
  });
  it("Jaccard con tres decimales", () => {
    expect(parecidoDeTexto("Servicio de salud", "Salud del servicio")).toBe(1);
    expect(parecidoDeTexto("calidad del servicio", "calidad de la enseñanza")).toBe(0.333);
    expect(parecidoDeTexto("", "")).toBe(0);
  });
});

describe("coincidenciaDeFila", () => {
  it("usa el puntaje de la sugerencia mostrada", () => {
    expect(coincidenciaDeFila(fila("a", "Se desempeñan eficazmente", "Estoy satisfecho(a) con el liderazgo", 0.25)))
      .toEqual({ clase: "distinto", puntaje: 0.25, origen: "motor" });
  });
  it("un par confirmado toma el puntaje de la candidata que coincide", () => {
    const f = fila("a", "Calidad del servicio", "Calidad de servicios", null, {
      estado: "confirmado",
      pregunta: pregunta("Calidad del servicio", { sugerencias: [{ base: "estudiantes", var: "q1", etiqueta: "Calidad de servicios", puntaje: 0.6 }] }),
    });
    expect(coincidenciaDeFila(f)).toEqual({ clase: "parecido", puntaje: 0.6, origen: "motor" });
  });
  it("sin puntaje del motor (matriz) se mide con las palabras", () => {
    expect(coincidenciaDeFila(fila("a", "Clima laboral", "Clima del aula", null))).toEqual({ clase: "distinto", puntaje: 0.333, origen: "texto" });
  });
  it("sin par no hay coincidencia", () => {
    expect(coincidenciaDeFila(fila("a", "x", null, null))).toBeNull();
  });
});

describe("conteo y filtro", () => {
  const filas = [
    fila("a", "Servicio de salud", "Servicio de salud", 1),
    fila("b", "Calidad del servicio", "Calidad de los servicios", 0.6),
    fila("c", "Se desempeñan eficazmente", "Satisfecho con el liderazgo", 0.2),
    fila("d", "Sin par", null, null),
  ];
  const mapa = coincidenciasDe(filas);
  it("cuenta por clase y todas incluye las filas sin par", () => {
    expect(contarCoincidencias(filas, mapa)).toEqual({ todas: 4, identico: 1, parecido: 1, distinto: 1 });
  });
  it("filtra por clase; todas no filtra", () => {
    expect(filtrarPorCoincidencia(filas, mapa, "identico").map((f) => f.clave)).toEqual(["a"]);
    expect(filtrarPorCoincidencia(filas, mapa, "distinto").map((f) => f.clave)).toEqual(["c"]);
    expect(filtrarPorCoincidencia(filas, mapa, "todas")).toHaveLength(4);
  });
  it("rótulos con su conteo", () => {
    const c = contarCoincidencias(filas, mapa);
    expect(["todas", "identico", "parecido", "distinto"].map((k) => rotuloFiltroCoincidencia(k as "todas", c)))
      .toEqual(["Todas (4)", "Idéntico (1)", "Parecido (1)", "Distinto (1)"]);
  });
});
