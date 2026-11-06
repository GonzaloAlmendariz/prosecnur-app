import { describe, expect, it } from "vitest";
import type { HojasRutaSampleSizeConfig } from "../../../../api/hojasRuta";
import { resumenMargen, resumenReparto, resumenSupuestos } from "./resumenesMuestra";

const s = { confidence_level: 0.95, margin_total: 0.03, margin_district: 0.1, expected_proportion: 0.5, response_rate: 0.9, design_effect: 1.5, allocation_mode: "proportional", estrato: "provincia", base_reparto: null } as unknown as HojasRutaSampleSizeConfig;

describe("resúmenes de los grupos plegables de Muestra", () => {
  it("dicen el valor vigente en una línea", () => {
    expect(resumenMargen(s)).toBe("95 %, ±3 % total, ±10 % por distrito");
    expect(resumenSupuestos(s)).toBe("p 50 %, respuesta 90 %, DEFF 1.5");
    expect(resumenReparto(s, false)).toBe("Asignación por tamaño, por provincia, CPV 2017");
  });
  it("con N por distrito el estrato es el distrito y no hay asignación", () => {
    expect(resumenReparto(s, true)).toBe("Por distrito, CPV 2017");
  });
});
