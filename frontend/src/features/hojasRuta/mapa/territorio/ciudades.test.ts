import { describe, expect, it } from "vitest";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { ciudadAbiertaDeFoco, ciudadDeUbigeo, ciudadesDelAtlas, ciudadesDelEstudio, radioCiudad, regionesDe } from "./ciudades";

const t = (ubigeo: string, poblacion: number, captacion: number | null = null) => ({ ubigeo, poblacion, viviendas: poblacion / 4, manzanas: 10, captacion }) as unknown as HojasRutaTerritory;

describe("ciudades del atlas", () => {
  it("la ciudad de un distrito sale del índice; Lima y Callao son una", () => {
    expect(ciudadDeUbigeo("150101")).toBe("lima");
    expect(ciudadDeUbigeo("070101")).toBe("lima");
    expect(ciudadDeUbigeo("040103")).toBe("0401");
    expect(ciudadDeUbigeo("999999")).toBeNull();
  });
  it("Lima y Callao piden dos regiones; Arequipa, una", () => {
    expect(regionesDe(["lima", "0401"])).toEqual(["04", "07", "15"]);
  });
  it("suma las cifras del registro y pondera la captación por población", () => {
    const at = ciudadesDelAtlas([t("040101", 100, 90), t("040103", 300, 70)]);
    const aqp = at.find((c) => c.codigo === "0401");
    expect(aqp?.poblacion).toBe(400);
    expect(aqp?.captacion).toBeCloseTo(75);
    expect(at[0].codigo).toBe("0401");
  });
  it("las ciudades del estudio incluyen las de sus distritos", () => {
    expect(ciudadesDelEstudio(["0401"], ["150101"])).toEqual(["0401", "lima"]);
    expect(ciudadesDelEstudio(undefined, [])).toEqual([]);
  });
  it("el foco abre una ciudad conocida y nada más", () => {
    expect(ciudadAbiertaDeFoco("lima")).toBe("lima");
    expect(ciudadAbiertaDeFoco("0401")).toBe("0401");
    expect(ciudadAbiertaDeFoco("9999")).toBeNull();
    expect(ciudadAbiertaDeFoco("pe")).toBeNull();
    expect(ciudadAbiertaDeFoco("150101001000390")).toBeNull();
  });
  it("el área del círculo crece con la población", () => {
    expect(radioCiudad(10_000_000)).toBeGreaterThan(radioCiudad(100_000) * 3);
  });
});
