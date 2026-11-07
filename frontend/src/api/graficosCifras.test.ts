// Normalizador de las cifras con clave (POST /api/graficos/resumenes/cifras, ADR 0135 §6).
import { describe, expect, it } from "vitest";
import { normalizarCifras } from "./graficosCifras";

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
