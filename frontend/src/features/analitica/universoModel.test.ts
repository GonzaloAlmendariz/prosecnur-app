import { describe, expect, it } from "vitest";
import { lineasUniverso } from "./universoModel";

const base = (over: Partial<Parameters<typeof lineasUniverso>[0][number]>) => ({
  base: "default", declarado: true, aplicado: true, n_total: 3318, n_validos: 2500, motivo_no_aplicado: "",
  condiciones: [{ variable: "seleccionado", operador: "==" as const, valores: ["1"] }], ...over,
});

describe("lineasUniverso", () => {
  it("una base: cuántos cuentan y con qué condición, sin nombrar la base", () => {
    expect(lineasUniverso([base({})])).toEqual([
      { base: "default", aviso: false, texto: "Cuentan 2,500 de 3,318 casos: seleccionado es «1»." },
    ]);
  });

  it("varias bases: sólo las que declaran, con su nombre", () => {
    const l = lineasUniverso([base({ base: "2026" }), base({ base: "2024", declarado: false })]);
    expect(l.map((x) => x.texto)).toEqual(["Cuentan 2,500 de 3,318 casos en 2026: seleccionado es «1»."]);
  });

  it("un criterio que vaciaría la base avisa que cuentan todos", () => {
    const [l] = lineasUniverso([base({ aplicado: false, n_validos: 3318 })]);
    expect(l.aviso).toBe(true);
    expect(l.texto).toContain("cuentan todos (3,318)");
  });
});
