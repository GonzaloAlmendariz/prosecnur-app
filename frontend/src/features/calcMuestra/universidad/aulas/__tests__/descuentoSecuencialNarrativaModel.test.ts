import { describe, expect, it } from "vitest";
import {
  buildDiscountNarrative,
  discountBehaviorForEngine,
} from "../descuentoSecuencialNarrativaModel";

const rows = [
  { operational_code: "AULA 2", discount_step: 2, eligible_n_bruto: 30, ya_cubiertos: 8, eligible_n_neto: 22, aporte_neto: 22 },
  { operational_code: "AULA 1", discount_step: 1, eligible_n_bruto: 40, ya_cubiertos: 0, eligible_n_neto: 40, aporte_neto: 40 },
];

describe("narrativa del descuento", () => {
  it("distingue secuencia causal de auditoría post_hoc usando el modo acreditado", () => {
    const sequential = buildDiscountNarrative({ sequential_discount: { schema: "v1", mode: "sequential" } }, rows);
    const postHoc = buildDiscountNarrative({ sequential_discount: { schema: "v1", mode: "post_hoc" } }, rows);

    expect(sequential).toMatchObject({ mode: "sequential", causal: true });
    expect(postHoc).toMatchObject({ mode: "post_hoc", causal: false });
    expect(sequential?.steps.map((step) => step.code)).toEqual(["CH 1", "CH 2"]);
    expect(sequential?.steps[1]).toMatchObject({ bruto: 30, yaCubiertos: 8, neto: 22, aporteNeto: 22 });
  });

  it.each([
    ["sistematico_pps", "sequential"],
    ["estratificado_aleatorio", "sequential"],
    ["pool_controlado", "sequential"],
    ["cube_balanceado", "post_hoc"],
    ["local_pivotal_balanceado", "post_hoc"],
    ["manual_auditable", "post_hoc"],
    ["metodo_futuro", "unknown"],
  ] as const)("clasifica %s como %s sin inventar causalidad", (engine, expected) => {
    expect(discountBehaviorForEngine(engine)).toBe(expected);
  });

  it("no inventa pasos sin modo o sin columnas del engine", () => {
    expect(buildDiscountNarrative(null, rows)).toBeNull();
    expect(buildDiscountNarrative({ sequential_discount: { schema: "v1", mode: "sequential" } }, [{ eligible_n: 20 }])).toBeNull();
  });
});
