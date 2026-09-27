/**
 * L18 (2026-09-27): con el marco entero a campo, la cadena decía «÷ respuesta
 * 70 %» junto a 2,000, una división que no ocurrió.
 */
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { cadenaDelN } from "../cadenaDelN";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

function comp(resultado: Partial<Resultado>): Pick<CalcMuestraComponente, "resultado" | "parametros"> {
  return {
    resultado: resultado as Resultado,
    parametros: { tasa_respuesta: 0.7, oversample_pct: 0.1 } as CalcMuestraComponente["parametros"],
  };
}

describe("cadenaDelN · n a campo", () => {
  it("con el marco entero dice «todo el marco» y cuántas completas vuelven", () => {
    const campo = cadenaDelN(comp({ n_objetivo: 1600, n_operativo: 2000, n_completas_esperadas: 1400 }), 2000)[2];
    expect(campo.detalle).toBe("todo el marco · se esperan 1,400 completas");
    expect(campo.detalle).not.toContain("÷ respuesta");
  });

  it("sin tope conserva la cadena de la respuesta y la sobremuestra", () => {
    const campo = cadenaDelN(comp({ n_objetivo: 323, n_operativo: 509 }), 2000)[2];
    expect(campo.detalle).toContain("÷ respuesta");
    expect(campo.detalle).toContain("sobremuestra");
  });
});
