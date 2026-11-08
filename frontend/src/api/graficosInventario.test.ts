import { describe, expect, it } from "vitest";

import { normalizarInventario } from "./graficosInventario";

// Contrato del normalizador del inventario (GET /api/graficos/resumenes/inventario, ADR 0135): un conteo que falta
// cae a 0, un padrón sin valor positivo no se declara y un payload malformado no revienta.

const fila = (extra: Record<string, unknown> = {}) => ({
  base: "docentes",
  publico: "docentes",
  n: 30,
  preguntas: { escala: 4, opcion_unica: 1, multiple: 1, numerica: 1, abierta: 1 },
  padron: { declarado: true, valor: 120, origen: "Cálculo de muestra: marco validado (Docentes)", motivo: "" },
  ...extra,
});

describe("normalizarInventario", () => {
  it("conserva un payload bien formado", () => {
    expect(normalizarInventario({ ok: true, bases: [fila()] })).toEqual([{
      base: "docentes",
      publico: "docentes",
      n: 30,
      preguntas: { escala: 4, opcion_unica: 1, multiple: 1, numerica: 1, abierta: 1 },
      padron: { declarado: true, valor: 120, origen: "Cálculo de muestra: marco validado (Docentes)", motivo: "" },
    }]);
  });

  it("los conteos que faltan, negativos o no numéricos caen a 0", () => {
    const [b] = normalizarInventario({ bases: [fila({ n: undefined, preguntas: { escala: 3, multiple: -2, numerica: "x", abierta: null } })] });
    expect(b.n).toBe(0);
    expect(b.preguntas).toEqual({ escala: 3, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 });
    const [sinPreguntas] = normalizarInventario({ bases: [fila({ preguntas: "nada" })] });
    expect(sinPreguntas.preguntas).toEqual({ escala: 0, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 });
  });

  it("acepta escalares en arreglo de uno (`auto_unbox` ausente) y conteos como texto", () => {
    const [b] = normalizarInventario({ bases: [fila({ base: ["docentes"], n: ["30"], preguntas: { escala: [4], opcion_unica: "2" } })] });
    expect(b.base).toBe("docentes");
    expect(b.n).toBe(30);
    expect(b.preguntas.escala).toBe(4);
    expect(b.preguntas.opcion_unica).toBe(2);
  });

  it("`declarado` queda en false si el valor no es positivo, aunque llegue `true`", () => {
    for (const valor of [null, undefined, 0, -5, "abc", NaN]) {
      const [b] = normalizarInventario({ bases: [fila({ padron: { declarado: true, valor, origen: "algo", motivo: "" } })] });
      expect(b.padron.declarado).toBe(false);
      expect(b.padron.valor).toBeNull();
      expect(b.padron.origen).toBe("");   // sin padrón no se publica un origen
    }
    const [sinPadron] = normalizarInventario({ bases: [fila({ padron: undefined })] });
    expect(sinPadron.padron).toEqual({ declarado: false, valor: null, origen: "", motivo: "" });
    // Un valor sin `declarado: true` tampoco se declara.
    const [soloValor] = normalizarInventario({ bases: [fila({ padron: { valor: 120, motivo: "Sin padrón declarado." } })] });
    expect(soloValor.padron).toEqual({ declarado: false, valor: null, origen: "", motivo: "Sin padrón declarado." });
  });

  it("un payload malformado no revienta: devuelve una lista vacía o salta las filas sin base", () => {
    for (const raw of [null, undefined, 42, "texto", [], { bases: "x" }, { bases: null }, { ok: false }]) {
      expect(normalizarInventario(raw)).toEqual([]);
    }
    const filas = normalizarInventario({ bases: [null, 7, "x", { base: "" }, { n: 3 }, fila(), fila({ n: 99 })] });
    expect(filas).toHaveLength(1);   // las inválidas fuera y la base repetida, una vez (la primera)
    expect(filas[0].n).toBe(30);
  });

  it("sin `publico`, el público es el nombre de la base", () => {
    const [b] = normalizarInventario({ bases: [fila({ publico: "  " })] });
    expect(b.publico).toBe("docentes");
  });
});
