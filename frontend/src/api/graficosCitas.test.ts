// GET /api/graficos/citas-candidatas (O3b-a): candidatas de la tarjeta de aprobación. R desempaca vectores de uno.
import { describe, expect, it } from "vitest";
import { normalizarCitasCandidatas } from "./graficosCitas";

describe("normalizarCitasCandidatas", () => {
  it("lee el payload y tolera escalares en caja y avisos sueltos", () => {
    const out = normalizarCitasCandidatas({
      ok: true, base: "ccss", variable: "coment", comentarios: [120], escribieron: 150,
      candidatas: [{ id: "c1", texto: "Uno dos tres", chars: 12, puntaje: 3, revision: "", propuesta: true },
        { id: ["c2"], texto: ["Dos"], chars: [3], puntaje: [1], revision: ["Revisar: posible nombre propio («Rosales»)"], propuesta: [false] },
        { texto: "sin id" }],
      avisos: "Sólo 2 comentarios cumplen",
    });
    expect(out.candidatas).toEqual([
      { id: "c1", texto: "Uno dos tres", chars: 12, puntaje: 3, revision: "", propuesta: true },
      { id: "c2", texto: "Dos", chars: 3, puntaje: 1, revision: "Revisar: posible nombre propio («Rosales»)", propuesta: false },
    ]);
    expect(out.comentarios).toBe(120);
    expect(out.escribieron).toBe(150);
    expect(out.avisos).toEqual(["Sólo 2 comentarios cumplen"]);
    expect(normalizarCitasCandidatas(null).candidatas).toEqual([]);
  });
});
