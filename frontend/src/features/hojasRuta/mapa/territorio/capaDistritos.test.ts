import { describe, expect, it } from "vitest";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { escalaDistritos } from "./capaDistritos";

const t = (ubigeo: string, poblacion: number, nse: number | null): HojasRutaTerritory =>
  ({ ubigeo, departamento: "LIMA", provincia: "LIMA", distrito: ubigeo, viviendas: poblacion / 4, poblacion, manzanas: 10, nse_predominante: nse }) as HojasRutaTerritory;

const ciudad = [t("150101", 270_000, 3), t("150122", 100_000, 1), t("150106", 380_000, 5), t("150132", 1_100_000, 5), t("150104", 30_000, null)];

describe("capa de distritos de la ciudad abierta (revisión del 7 nov 2026)", () => {
  it("«Distritos» no colorea", () => {
    expect(escalaDistritos("distritos", ciudad)).toBeNull();
  });

  it("población: el más poblado en la clase más alta, el menos en la más baja", () => {
    const e = escalaDistritos("poblacion", ciudad)!;
    const clases = ciudad.map((d) => e.clase.get(d.ubigeo)!);
    expect(Math.max(...clases)).toBe(e.clase.get("150132"));
    expect(Math.min(...clases)).toBe(e.clase.get("150104"));
    expect([e.min, e.max]).toEqual([30_000, 1_100_000]);
  });

  it("NSE: el nivel predominante tal cual (1 = Alto) y 0 sin dato", () => {
    const e = escalaDistritos("nse", ciudad)!;
    expect(["150122", "150101", "150106", "150104"].map((u) => e.clase.get(u))).toEqual([1, 3, 5, 0]);
  });
});
