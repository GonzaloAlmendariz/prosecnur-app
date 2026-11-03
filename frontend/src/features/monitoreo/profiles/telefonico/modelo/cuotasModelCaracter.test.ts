import { describe, expect, it } from "vitest";
import { metasConProporcion, validarMetas } from "./cuotasModel";

describe("Modelo › Cuotas con referenciales (ADR 0126)", () => {
  const filas = [
    { value: "SJL", universe: 600, meta: 60, effective: 0, caracter: "meta" as const },
    { value: "SMP", universe: 400, meta: 40, effective: 0, caracter: "meta" as const },
    { value: "PL", universe: 1000, meta: 80, effective: 0, caracter: "referencial" as const },
  ];

  it("la referencial no entra al reparto proporcional de las metas", () => {
    const [sjl, smp, pl] = metasConProporcion(filas);
    expect(sjl.proporcional).toBeCloseTo(60, 5);
    expect(smp.proporcional).toBeCloseTo(40, 5);
    expect(pl.proporcional).toBeNull();
    expect(pl.desvio).toBeNull();
  });

  it("la validación suma sólo las metas y nombra a las referenciales", () => {
    const validaciones = validarMetas({ filas: metasConProporcion(filas), variable: "Sede", objetivoTotal: 100 });
    expect(validaciones[0].texto).toContain("PL es referencial");
    expect(validaciones.some((v) => v.texto.includes("suman 100, igual que el objetivo total"))).toBe(true);
  });
});
