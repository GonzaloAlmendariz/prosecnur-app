// El tipo que sale de codificar una pregunta no se pregunta: se hereda o sale de lo codificado (plan 5.3).
import { describe, expect, test } from "vitest";
import type { Grupo } from "../../../api/codificacion";
import { origenDeLista, respuestasConVariosCodigos, tipoResultanteActivo, tipoResultanteDeLista } from "./tipoResultante";

const g = (codigo: string, respuestas: string[], casos: { id_caso: string; codigo: string }[] = []): Grupo => ({
  id: `g${codigo}`,
  codigo,
  etiqueta: codigo,
  respuestas,
  matrix_cases: casos.map((c) => ({ ...c, respuesta: "", etiqueta: "", obs: "" })),
});

describe("tipoResultanteActivo", () => {
  test("una pareja lo hereda de su pregunta cerrada", () => {
    expect(tipoResultanteActivo({ parent: "D1", tipo: "select_multiple" }, "pareja-sm", [])).toEqual({ tipo: "multiple", rotulo: "Múltiple", leyenda: "Igual que su pregunta D1" });
    expect(tipoResultanteActivo({ parent: "p3", tipo: "select_one" }, "pareja-so", [])).toEqual({ tipo: "unica", rotulo: "Única", leyenda: "Igual que su pregunta p3" });
  });

  test("una abierta sin códigos está por definir; con códigos, única hasta que una respuesta lleve dos", () => {
    expect(tipoResultanteActivo({ parent: "p21", tipo: "text" }, "solitaria", [g("1", [])])).toMatchObject({ tipo: null, rotulo: "Por definir" });
    expect(tipoResultanteActivo({ parent: "p21", tipo: "text" }, "solitaria", [g("1", ["a"]), g("2", ["b"])])).toEqual({
      tipo: "unica",
      rotulo: "Única",
      leyenda: "Ninguna respuesta con varios códigos",
    });
    const conCasos = [g("1", ["a"], [{ id_caso: "c1", codigo: "1" }]), g("2", [], [{ id_caso: "c1", codigo: "2" }])];
    expect(tipoResultanteActivo({ parent: "p21", tipo: "text" }, "solitaria", conCasos)).toEqual({ tipo: "multiple", rotulo: "Múltiple", leyenda: "1 respuesta con varios códigos" });
  });

  test("cuenta respuestas con más de un código por caso y por texto", () => {
    expect(respuestasConVariosCodigos([g("1", ["a", "b"]), g("2", ["a"])])).toBe(1);
    expect(respuestasConVariosCodigos([g("1", [], [{ id_caso: "x", codigo: "1" }, { id_caso: "y", codigo: "1" }])])).toBe(0);
  });
});

describe("la lista de preguntas", () => {
  test("una abierta con códigos no dice su tipo: depende de sus casos", () => {
    expect(tipoResultanteDeLista({ parent: "p9", tipo: "text", n_codificadas: 3 }, "solitaria")).toBeNull();
    expect(tipoResultanteDeLista({ parent: "p9", tipo: "text", n_codificadas: 0 }, "solitaria")).toMatchObject({ rotulo: "Por definir" });
    expect(origenDeLista({ parent: "D1", tipo: "select_multiple" }, "pareja-sm")).toBe("Otro de D1");
    expect(origenDeLista({ parent: "p9", tipo: "text" }, "solitaria")).toBe("Abierta");
  });
});
