// Normalizador de las cifras con clave (POST /api/graficos/resumenes/cifras, ADR 0135 §6).
import { describe, expect, it } from "vitest";
import { errorDeEntrada, normalizarCifras, normalizarCifrasLote } from "./graficosCifras";
import { ApiError } from "./core";

describe("normalizarCifras", () => {
  it("lee las cifras del motor con su texto tal cual y desempaca vectores de uno", () => {
    expect(normalizarCifras({
      ok: true,
      tipo: ["contraste/1"],
      cifras: [
        { clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia (Docentes menos Estudiantes)", texto: "+12", valor: 12, unidad: "pts" },
        { clave: ["valor:Biblioteca:Docentes"], rotulo: "Biblioteca: Docentes", texto: "68%", valor: "68", unidad: "%" },
      ],
      avisos: [],
    })).toEqual({
      tipo: "contraste/1",
      cifras: [
        { clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia (Docentes menos Estudiantes)", texto: "+12", valor: 12, unidad: "pts" },
        { clave: "valor:Biblioteca:Docentes", rotulo: "Biblioteca: Docentes", texto: "68%", valor: 68, unidad: "%" },
      ],
      avisos: [],
    });
  });

  it("sin clave o sin texto la cifra no pasa; una clave repetida tampoco; un valor ilegible queda en null", () => {
    const r = normalizarCifras({ cifras: [
      { clave: "", texto: "1" }, { clave: "a", texto: "" }, { clave: "b", texto: "3", valor: "x" }, { clave: "b", texto: "4" },
    ], avisos: "La lámina no dibujó cifras con estos datos." });
    expect(r.cifras).toEqual([{ clave: "b", rotulo: "b", texto: "3", valor: null, unidad: "" }]);
    expect(r.avisos).toEqual(["La lámina no dibujó cifras con estos datos."]);
    expect(normalizarCifras(null)).toEqual({ tipo: "", cifras: [], avisos: [] });
  });
});

describe("normalizarCifrasLote", () => {
  it("lee cada lámina por su id, en orden, con su error E_* aparte y sin tumbar a las demás", () => {
    const r = normalizarCifrasLote({
      ok: true,
      por_lamina: {
        cob: { tipo: "cobertura/1", cifras: [{ clave: "tasa:Docentes", rotulo: "Docentes: tasa", texto: "80%", valor: 80 }], avisos: [] },
        mala: { tipo: "", cifras: [], avisos: [], error: { code: ["E_CIFRAS_INVALIDO"], message: "El gráfico no publica cifras." } },
        sin_frase: { error: { code: "E_INTERNAL" } },
      },
    });
    expect(Object.keys(r)).toEqual(["cob", "mala", "sin_frase"]);
    expect(r.cob.error).toBeNull();
    expect(r.cob.cifras.cifras[0]).toEqual({ clave: "tasa:Docentes", rotulo: "Docentes: tasa", texto: "80%", valor: 80, unidad: "" });
    expect(r.mala.error).toEqual({ code: "E_CIFRAS_INVALIDO", message: "El gráfico no publica cifras." });
    expect(r.sin_frase.error?.message).toBe("No se pudieron leer las cifras de esta lámina.");
    expect(r.sin_frase.cifras).toEqual({ tipo: "", cifras: [], avisos: [] });
  });

  it("un cuerpo ilegible da un lote vacío; una entrada ausente o con error es un ApiError", () => {
    expect(normalizarCifrasLote(null)).toEqual({});
    expect(normalizarCifrasLote({ por_lamina: [] })).toEqual({});
    const ausente = errorDeEntrada(undefined);
    expect(ausente).toBeInstanceOf(ApiError);
    expect(ausente?.code).toBe("E_CIFRAS_INVALIDO");
    expect(errorDeEntrada({ cifras: { tipo: "", cifras: [], avisos: [] }, error: { code: "E_X", message: "m" } })?.code).toBe("E_X");
    expect(errorDeEntrada({ cifras: { tipo: "", cifras: [], avisos: [] }, error: null })).toBeNull();
  });
});
