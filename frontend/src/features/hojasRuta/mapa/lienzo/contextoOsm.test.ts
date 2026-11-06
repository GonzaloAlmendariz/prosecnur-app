import { describe, expect, test } from "vitest";
import type { HojasRutaContextMapFeature } from "../../../../api/hojasRuta";
import { piezasDeContexto } from "./contextoOsm";

const cuadrado = [[-76.9, -12.0], [-76.89, -12.0], [-76.89, -12.01], [-76.9, -12.01], [-76.9, -12.0]];
const f = (feature_class: string, geometry: HojasRutaContextMapFeature["geometry"]): HojasRutaContextMapFeature => ({ type: "Feature", geometry, properties: { feature_class, name: "Parque" } });

describe("capa de contexto OSM (P9 de la paridad)", () => {
  test("toma parques, plazas y agua como polígonos proyectados; descarta puntos y otras clases", () => {
    const piezas = piezasDeContexto([
      f("green", { type: "Polygon", coordinates: [cuadrado] }),
      f("water", { type: "MultiPolygon", coordinates: [[cuadrado], [cuadrado]] }),
      f("square", { type: "Polygon", coordinates: [cuadrado] }),
      f("public", { type: "Point", coordinates: [-76.9, -12.0] }),
      f("transit", { type: "Polygon", coordinates: [cuadrado] }),
      f("green", null),
    ]);
    expect(piezas.map((p) => p.clase)).toEqual(["verde", "agua", "agua", "verde"]);
    expect(piezas[0].anillos[0]).toHaveLength(10);
    const [x0, y0, x1, y1] = piezas[0].caja;
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeGreaterThan(y0);
  });
});
