import { describe, expect, it } from "vitest";
import { cierreDelPlan, ejeHastaCierre } from "./cierrePrevisto";

describe("cierre previsto", () => {
  it("es el fin más tardío del plan", () => {
    expect(cierreDelPlan([{ hasta: "2026-11-20" }, { hasta: "2026-12-04" }, { hasta: "" }])).toBe("2026-12-04");
    expect(cierreDelPlan([])).toBeNull();
  });

  it("estira el eje hasta el cierre, sin inventar datos", () => {
    const eje = ejeHastaCierre(["2026-10-29", "2026-10-30"], "2026-12-04");
    expect(eje.fechas).toHaveLength(37);
    expect(eje.fechas.at(-1)).toBe("2026-12-04");
    expect(eje.conDato).toBe(2);
    expect(eje.indiceDelCierre).toBe(36);
  });

  it("sin cierre, o con el cierre ya dentro del campo, el eje queda igual", () => {
    expect(ejeHastaCierre(["2026-10-29", "2026-10-30"], null)).toEqual({ fechas: ["2026-10-29", "2026-10-30"], conDato: 2, indiceDelCierre: null });
    expect(ejeHastaCierre(["2026-10-29", "2026-10-30"], "2026-10-30").indiceDelCierre).toBe(1);
    expect(ejeHastaCierre(["2026-10-29", "2026-10-30"], "2026-10-01").indiceDelCierre).toBeNull();
  });
});
