import { describe, expect, it } from "vitest";
import { cuerpoDelPedido, impactoEnFrases, textoDelBoton } from "./anulacionModel";

describe("anular un caso o una producción", () => {
  it("arma el pedido del motor según el alcance", () => {
    expect(cuerpoDelPedido({ alcance: "caso", responseId: "dcb2051a", rotulo: "Caso dcb2051a" })).toEqual({
      scope: "response", response_id: "dcb2051a", response_label: "Caso dcb2051a",
    });
    expect(cuerpoDelPedido({ alcance: "produccion", clave: "p702_aplicador", rotulo: "P702 · Aplicador" })).toEqual({
      scope: "all_production", responsible_key: "p702_aplicador", responsible_label: "P702 · Aplicador",
    });
  });

  it("pone el impacto en frases con su base: UMP con su meta y el estudio", () => {
    const { casos, lineas } = impactoEnFrases({
      responses_excluded: 1,
      before: { valid_responses: 1283 },
      after: { valid_responses: 1282 },
      blocks: [
        { id_manzana: "m145", ump: "UMP 145", distrito: "SAN MARTIN DE PORRES", validas_antes: 8, validas_despues: 7, meta: 8 },
        { id_manzana: "m146", ump: "146", validas_antes: 8, validas_despues: 8, meta: 8 },
      ],
    });
    expect(casos).toBe(1);
    expect(lineas.map((linea) => linea.texto)).toEqual([
      "UMP 145 (San Martín de Porres): 8 → 7 de 8",
      "Estudio: 1,283 → 1,282 que cuentan",
    ]);
  });

  it("sin vista previa no inventa impacto, y el botón dice cuántos casos anula", () => {
    expect(impactoEnFrases(null)).toEqual({ casos: 0, lineas: [] });
    expect(textoDelBoton({ alcance: "caso", responseId: "a", rotulo: "a" }, 1)).toBe("Anular 1 caso");
    expect(textoDelBoton({ alcance: "produccion", clave: "k", rotulo: "k" }, 311)).toBe("Anular 311 casos");
  });
});
