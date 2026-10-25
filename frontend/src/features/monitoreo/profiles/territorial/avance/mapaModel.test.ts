import { describe, expect, it } from "vitest";
import type { HojasRutaBlockMapFeature, HojasRutaStreetMapFeature } from "../../../../../api/client";
import { callesCercanas, centroDeManzana, construirMapa, manzanasVecinas, metrosEntre } from "./mapaModel";
import { construirUmps } from "./umpsModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

const cuadrado = (id: string, lon: number, lat: number, lado = 0.0004): HojasRutaBlockMapFeature => ({
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[[lon, lat], [lon + lado, lat], [lon + lado, lat + lado], [lon, lat + lado], [lon, lat]]],
  },
  properties: { ID_MANZANA: id },
});

describe("Avance › Mapa", () => {
  const modelo = construirMapa(CORTE_DE_CUOTAS);

  it("una manzana en uso por UMP con su estado, y las que ya no usa como anillo", () => {
    expect(modelo.manzanas.map((item) => [item.ump, item.idManzana, item.estado])).toEqual([
      ["143", "150135063000590", "pendiente"],
      ["7", "150103007000100", "subsanada"],
      ["35", "150108035000200", "completa"],
      ["143", "150135063000600", "sin-usar"],
    ]);
    expect(modelo.ubigeos).toEqual(["150135", "150103", "150108"]);
  });

  it("los conteos del lateral son los de Avance › UMP", () => {
    const umps = construirUmps(CORTE_DE_CUOTAS);
    expect(modelo.conteos).toEqual({ completa: umps.conteos.completas, subsanada: umps.conteos.subsanadas, pendiente: umps.conteos.pendientes });
    expect(modelo.pendientes.map((fila) => fila.ump)).toEqual(["143"]);
  });

  it("la flecha de la subsanación sugerida va de la UMP que cede a la que recibe", () => {
    expect(modelo.flechas.get("143")).toEqual({ ump: "143", origen: "150135062000440", destino: "150135063000590", umpOrigen: "142" });
  });

  it("el bloque adaptado conserva lo que el emparejador de cartografía necesita", () => {
    expect(modelo.manzanas[0].bloque).toMatchObject({ id_manzana: "150135063000590", ubigeo: "150135", zona: "06300", manzana: "0590" });
  });

  it("centro, distancia y vecinas dentro del entorno de 520 m", () => {
    const aqui = cuadrado("a", -77.0, -12.0);
    const cerca = cuadrado("b", -77.0, -12.0018);
    const lejos = cuadrado("c", -77.0, -12.01);
    const centro = centroDeManzana(aqui)!;
    expect(centro.lon).toBeCloseTo(-76.99984, 4);
    expect(metrosEntre(centro, centroDeManzana(cerca)!)).toBeGreaterThan(190);
    expect(metrosEntre(centro, centroDeManzana(cerca)!)).toBeLessThan(210);
    expect(manzanasVecinas([aqui, cerca, lejos], centro).map((item) => item.properties.ID_MANZANA)).toEqual(["a", "b"]);
    expect(centroDeManzana({ ...aqui, geometry: null })).toBeNull();
  });

  it("sólo las calles con algún tramo en el entorno", () => {
    const calle = (id: string, lat: number): HojasRutaStreetMapFeature => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[-77.01, lat], [-77.0, lat]] },
      properties: { id },
    });
    const centro = { lon: -77.0, lat: -12.0 };
    expect(callesCercanas([calle("cerca", -12.001), calle("lejos", -12.02)], centro).map((item) => item.properties.id)).toEqual(["cerca"]);
  });
});
