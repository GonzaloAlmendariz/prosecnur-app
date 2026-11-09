import { describe, expect, it } from "vitest";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { pct, repartoNse } from "./DistritoAtlasTarjeta";

const t = (pcts: Array<number | null>): HojasRutaTerritory =>
  ({ ubigeo: "150106", distrito: "CARABAYLLO", provincia: "LIMA", departamento: "LIMA", poblacion: 1, viviendas: 1, manzanas: 1, nse_pct_1: pcts[0], nse_pct_2: pcts[1], nse_pct_3: pcts[2], nse_pct_4: pcts[3], nse_pct_5: pcts[4] }) as HojasRutaTerritory;

describe("reparto de hogares por NSE en la tarjeta del distrito (H21)", () => {
  it("devuelve las cinco proporciones, de Alto a Bajo", () => {
    expect(repartoNse(t([0, 0.0413, 0.1288, 0.309, 0.5209]))).toEqual([0, 0.0413, 0.1288, 0.309, 0.5209]);
  });
  it("sin NSE no hay reparto que dibujar", () => {
    expect(repartoNse(t([null, null, null, null, null]))).toBeNull();
    expect(repartoNse(t([0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("pct", () => {
  it('rotula "menos de 1 %" un nivel con hogares que redondea a cero', () => {
    expect(pct(0.003)).toBe("menos de 1 %");
    expect(pct(0)).toBe("0 %");
    expect(pct(0.5209)).toBe("52 %");
  });
});
