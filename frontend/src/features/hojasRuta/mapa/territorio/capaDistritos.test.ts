import { describe, expect, it } from "vitest";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { areaKm2, CAPAS_MANZANAS_DISTRITO, capaMarcada, escalaDistritos } from "./capaDistritos";
import { rangosDensidad } from "./CapaDistritosControles";

const t = (ubigeo: string, poblacion: number, nse: number | null): HojasRutaTerritory =>
  ({ ubigeo, departamento: "LIMA", provincia: "LIMA", distrito: ubigeo, viviendas: poblacion / 4, poblacion, manzanas: 10, nse_predominante: nse }) as HojasRutaTerritory;

// Un cuadrado de lado L metros en el mundo del lienzo (cerca del origen: sin corrección de latitud).
const cuadrado = (x: number, y: number, l: number) => [x, y, x + l, y, x + l, y + l, x, y + l];

describe("capa de distritos de la ciudad abierta (revisión del 7 nov 2026)", () => {
  it("el área descuenta los huecos", () => {
    expect(areaKm2([cuadrado(0, 0, 10_000)])).toBeCloseTo(100, 0);
    expect(areaKm2([cuadrado(0, 0, 10_000), cuadrado(2_000, 2_000, 5_000)])).toBeCloseTo(75, 0);
  });

  it("«Distritos» no colorea", () => {
    expect(escalaDistritos("distritos", [], new Map())).toBeNull();
  });

  it("población por densidad, no por total: el distrito grande y poco poblado queda abajo", () => {
    const ciudad = [t("A", 1_000_000, 5), t("B", 300_000, 3), t("C", 200_000, 1), t("D", 100_000, 2), t("E", 50_000, null)];
    // A tiene el mayor total pero un área enorme; C, poca gente en muy poco espacio.
    const areas = new Map([["A", 500], ["B", 30], ["C", 4], ["D", 20], ["E", 10]]);
    const e = escalaDistritos("poblacion", ciudad, areas)!;
    expect(e.clase.get("A")).toBe(1);
    expect(e.clase.get("C")).toBe(5);
    expect(e.cortes).toHaveLength(4);
  });

  it("un distrito sin contorno queda sin dato", () => {
    const e = escalaDistritos("viviendas", [t("A", 1_000, 1)], new Map())!;
    expect(e.clase.get("A")).toBe(0);
  });

  it("NSE: el nivel predominante tal cual (1 = Alto) y 0 sin dato", () => {
    const e = escalaDistritos("nse", [t("A", 1, 1), t("B", 1, 3), t("C", 1, 5), t("D", 1, null)], new Map())!;
    expect(["A", "B", "C", "D"].map((u) => e.clase.get(u))).toEqual([1, 3, 5, 0]);
  });

  it("la leyenda da el rango de cada una de las cinco clases", () => {
    expect(rangosDensidad([1_000, 2_500, 5_000, 12_000])).toEqual(["menos de 1,000", "1,000 a 2,500", "2,500 a 5,000", "5,000 a 12,000", "12,000 o más"]);
  });
});

describe("leyenda escalonada", () => {
  it("los cortes van en corto, con punto decimal", async () => {
    const { corteCorto } = await import("./CapaDistritosControles");
    expect([948, 8169, 13995, 17795].map(corteCorto)).toEqual(["950", "8.2 mil", "14 mil", "18 mil"]);
    expect(corteCorto(1000)).toBe("1 mil");
  });
});

describe("rótulo del cursor en el atlas", () => {
  it("dice el valor de la capa que se ve", async () => {
    const { valorDeCapa } = await import("./CapaDistritosControles");
    const d = t("150128", 169_458, 3);
    expect(valorDeCapa("poblacion", d, 12.1)).toBe("14,005 habitantes por km²");
    expect(valorDeCapa("nse", d, 12.1)).toBe("NSE predominante: medio");
    expect(valorDeCapa("poblacion", d, null)).toBe("sin área");
  });
});

describe("capas dentro de un distrito", () => {
  it("no ofrecen Población (por manzana no existe) y la leen como Viviendas", () => {
    expect(CAPAS_MANZANAS_DISTRITO.map(([id]) => id)).not.toContain("poblacion");
    expect(capaMarcada("poblacion", true)).toBe("viviendas");
    expect(capaMarcada("poblacion", false)).toBe("poblacion");
    expect(capaMarcada("nse", true)).toBe("nse");
  });
});
