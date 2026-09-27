/**
 * 2026-09-27: con técnica «Cobertura censal» la banda publicaba «Margen
 * alcanzado ±50.0% · pedido ±5.0% · cifra validada». El 50 % es la cobertura
 * objetivo: una técnica operativa no tiene margen de error.
 */
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { defaultComponente } from "../../sharedCore";
import { cifrasDisenoGeneral } from "../bandaDisenoModelo";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

function comp(naturaleza: CalcMuestraComponente["naturaleza"], resultado: Partial<Resultado>): CalcMuestraComponente {
  return {
    ...defaultComponente({ id: "c1", actor: "Personal" }),
    tecnica: "intencion_censal",
    naturaleza,
    parametros: { ...defaultComponente().parametros, e: 0.05 },
    resultado: resultado as Resultado,
  };
}

describe("banda · técnica operativa", () => {
  it("la cobertura objetivo se rotula como tal, sin ± ni margen pedido", () => {
    const cifra = cifrasDisenoGeneral({
      comp: comp("operativo", { n_objetivo: 1600, n_operativo: 2000, cobertura_objetivo: 0.5 } as Partial<Resultado>),
      marco: null, corrida: null, seccion: "metodo",
    }).find((c) => c.clave === "margen");
    expect(cifra?.label).toBe("Cobertura objetivo");
    expect(cifra?.value).toBe("50.0%");
    expect(cifra?.value).not.toContain("±");
    expect(cifra?.detalle ?? "").not.toContain("pedido");
  });

  it("una técnica probabilística sigue mostrando su margen", () => {
    const cifra = cifrasDisenoGeneral({
      comp: { ...comp("prob", { n_objetivo: 323, n_operativo: 509, precision_alcanzada: 0.0499 } as Partial<Resultado>), tecnica: "prob_aleatorio_simple" },
      marco: null, corrida: null, seccion: "metodo",
    }).find((c) => c.clave === "margen");
    expect(cifra?.label).toBe("Margen alcanzado");
    expect(cifra?.value).toContain("±");
  });
});
