import { describe, expect, it } from "vitest";
import { buscarDistrito, claveDeDistrito, construirSilueta, type DistritoConGeometria } from "./siluetaModel";

const cuadrado: DistritoConGeometria = {
  properties: { ubigeo: "150103", distrito: "SAN MARTIN DE PORRES" },
  geometry: { type: "Polygon", coordinates: [[[-77.1, -12.0], [-77.0, -12.0], [-77.0, -11.9], [-77.1, -11.9], [-77.1, -12.0]]] },
};
const alargado: DistritoConGeometria = {
  properties: { ubigeo: "150132", distrito: "SAN JUAN DE LURIGANCHO" },
  geometry: { type: "MultiPolygon", coordinates: [[[[-77.0, -12.0], [-76.9, -12.0], [-76.9, -11.8], [-77.0, -11.8], [-77.0, -12.0]]]] },
};

describe("silueta de distrito", () => {
  it("empareja el nombre rotulado con el del motor y con el ubigeo", () => {
    expect(claveDeDistrito("San Martín de Porres")).toBe(claveDeDistrito("SAN MARTIN DE PORRES"));
    expect(buscarDistrito([cuadrado, alargado], "San Juan de Lurigancho")?.properties.ubigeo).toBe("150132");
    expect(buscarDistrito([cuadrado, alargado], "150103")?.properties.distrito).toBe("SAN MARTIN DE PORRES");
    expect(buscarDistrito([cuadrado, alargado], "Ate")).toBeNull();
    expect(buscarDistrito([cuadrado], "")).toBeNull();
  });

  it("encuadra el distrito en su caja con margen y conserva la proporción", () => {
    const silueta = construirSilueta(alargado, 64, 4);
    expect(silueta?.trazo.startsWith("M")).toBe(true);
    expect(silueta?.trazo.endsWith("Z")).toBe(true);
    const cifras = [...(silueta?.trazo ?? "").matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const xs = cifras.map(([x]) => x);
    const ys = cifras.map(([, y]) => y);
    // Alto 0.2°, ancho 0.1°: el alto llena los 56 px útiles y el ancho la mitad, centrado.
    expect(Math.min(...ys)).toBeCloseTo(4, 1);
    expect(Math.max(...ys)).toBeCloseTo(60, 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(28, 1);
    expect(Math.min(...xs)).toBeCloseTo(18, 1);
  });

  it("ubica la manzana dentro de la silueta y descarta la que cae fuera", () => {
    expect(construirSilueta(cuadrado, 64, 4, { lon: -77.05, lat: -11.95 })?.punto).toEqual({ x: 32, y: 32 });
    expect(construirSilueta(cuadrado, 64, 4, { lon: -76.0, lat: -11.95 })?.punto).toBeNull();
    expect(construirSilueta(cuadrado, 64, 4)?.punto).toBeNull();
  });

  it("sin coordenadas no hay silueta", () => {
    expect(construirSilueta({ properties: { ubigeo: "x", distrito: "X" }, geometry: { type: "Polygon", coordinates: [] } })).toBeNull();
  });
});
