// «Confirmar los idénticos (N)» (X6): sólo sugerencias identicas, cada pregunta una vez, y cada par deshacible solo.
import { describe, expect, it } from "vitest";
import type { Emparejado, PreguntaEmparejado } from "../../../../api/graficosEmparejado";
import { coincidenciasDe } from "./coincidencia";
import { avisoSugerenciasPerdidas, confirmarIdenticos, identicosPorConfirmar, sugerenciasQuePierdeElLote } from "./loteIdenticos";
import { filasEmparejado, quitarPar } from "./modeloEmparejado";

const B = ["docentes", "estudiantes"] as const;

const P = (base: string, v: string, etiqueta: string, extra: Partial<PreguntaEmparejado> = {}): PreguntaEmparejado => ({
  base, var: v, etiqueta, tema: etiqueta, estado: "sin_par", par: null, sugerencias: [], ...extra,
});
const S = (base: string, v: string, etiqueta: string, puntaje: number) => ({ base, var: v, etiqueta, puntaje });

const DATOS: Emparejado = {
  bases: [...B],
  preguntas: [
    P("docentes", "p0", "Clima", { estado: "matriz", par: { base: "estudiantes", var: "q0", etiqueta: "Clima" } }),
    P("docentes", "p1", "Servicio de salud", { sugerencias: [S("estudiantes", "q1", "Servicio de salud", 1)] }),
    P("docentes", "p2", "Calidad del servicio", { sugerencias: [S("estudiantes", "q2", "Calidad de los servicios", 0.6)] }),
    P("docentes", "p3", "Biblioteca", { sugerencias: [S("estudiantes", "q3", "Biblioteca", 1)] }),
    // Otra pregunta de docentes con el mismo texto apunta a q3: la primera fila se lo lleva.
    P("docentes", "p4", "Biblioteca.", { sugerencias: [S("estudiantes", "q3", "Biblioteca", 1)] }),
    // La otra cara de p1 (la fila de estudiantes que sugiere el mismo par).
    P("estudiantes", "q1", "Servicio de salud", { sugerencias: [S("docentes", "p1", "Servicio de salud", 1)] }),
  ],
};

const filas = filasEmparejado(DATOS, [], B, new Set());
const mapa = coincidenciasDe(filas);

describe("identicosPorConfirmar", () => {
  it("sólo sugerencias identicas, cada pregunta una vez y en el orden de la tabla", () => {
    expect(identicosPorConfirmar(filas, mapa).map((f) => f.clave)).toEqual(["docentes$p1", "docentes$p3"]);
  });

  it("una sugerencia descartada o un par ya confirmado no entran", () => {
    const sinP1 = filasEmparejado(DATOS, [], B, new Set(["docentes$p1"]));
    // Descartar p1 descarta el par: la cara de q1 tampoco lo trae de vuelta (E1).
    expect(identicosPorConfirmar(sinP1, coincidenciasDe(sinP1)).map((f) => f.clave)).toEqual(["docentes$p3"]);
  });

  it("E1: el par espejo cuenta una vez, así que el filtro «Idéntico» y el lote dicen el mismo N", () => {
    expect(filas.some((f) => f.clave === "estudiantes$q1")).toBe(false);
    const identicas = filas.filter((f) => f.estado === "sugerido" && mapa.get(f.clave)?.clase === "identico");
    // p4 también es idéntica pero apunta a q3, que el lote ya toma con p3: queda fuera y se avisa (E6).
    expect(identicas.map((f) => f.clave)).toEqual(["docentes$p1", "docentes$p3", "docentes$p4"]);
    expect(identicosPorConfirmar(filas, mapa)).toHaveLength(2);
  });
});

describe("sugerenciasQuePierdeElLote (E6)", () => {
  it("cuenta las filas sugeridas cuyo par se lleva el lote", () => {
    const lote = identicosPorConfirmar(filas, mapa);
    expect(sugerenciasQuePierdeElLote(filas, lote)).toBe(1);
    expect(avisoSugerenciasPerdidas(1)).toBe("1 fila perdió su sugerencia: su par ya se confirmó.");
    expect(avisoSugerenciasPerdidas(8)).toBe("8 filas perdieron su sugerencia: su par ya se confirmó.");
    expect(avisoSugerenciasPerdidas(0)).toBeNull();
  });
});

describe("confirmarIdenticos", () => {
  const lote = identicosPorConfirmar(filas, mapa);
  const temas = confirmarIdenticos([], B, lote);

  it("escribe un tema por par, como confirmarlos a mano", () => {
    expect(temas).toEqual([
      { key: "servicio_de_salud", title: "Servicio de salud", vars: ["docentes$p1", "estudiantes$q1"] },
      { key: "biblioteca", title: "Biblioteca", vars: ["docentes$p3", "estudiantes$q3"] },
    ]);
    const despues = filasEmparejado(DATOS, temas, B, new Set());
    expect(despues.filter((f) => f.estado === "confirmado").map((f) => f.clave)).toEqual(["docentes$p1", "docentes$p3"]);
    expect(identicosPorConfirmar(despues, coincidenciasDe(despues))).toEqual([]);
  });

  it("cada par se deshace solo: quitar uno deja el otro confirmado", () => {
    const sinUno = quitarPar(temas, "docentes$p1");
    const despues = filasEmparejado(DATOS, sinUno, B, new Set());
    expect(despues.find((f) => f.clave === "docentes$p1")?.estado).toBe("sugerido");
    expect(despues.find((f) => f.clave === "docentes$p3")?.estado).toBe("confirmado");
  });

  it("sin lote no cambia nada", () => {
    expect(confirmarIdenticos(temas, B, [])).toEqual(temas);
  });
});
