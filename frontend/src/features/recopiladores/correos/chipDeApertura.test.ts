import { describe, expect, it } from "vitest";

import { anchoDelChip, lugarDelChip } from "./chipDeApertura";

const ZONA = { x: 40, y: 200, w: 520, h: 60 };

describe("el chip de la apertura no tapa el texto del correo", () => {
  it("va dentro cuando la primera línea deja sitio a la derecha", () => {
    expect(lugarDelChip({ zona: ZONA, primeraLinea: { x: 40, y: 200, w: 300, h: 18 }, bordeDeArriba: 190, anchoChip: 120 })).toBe("dentro");
  });

  it("la primera línea llega al borde (1024 px): sube sobre la zona si hay hueco", () => {
    expect(lugarDelChip({ zona: ZONA, primeraLinea: { x: 40, y: 200, w: 510, h: 18 }, bordeDeArriba: 170, anchoChip: 120 })).toBe("arriba");
  });

  it("sin sitio dentro ni hueco encima, no se pinta", () => {
    expect(lugarDelChip({ zona: ZONA, primeraLinea: { x: 40, y: 200, w: 510, h: 18 }, bordeDeArriba: 192, anchoChip: 120 })).toBeNull();
  });

  it("una zona sin texto lo lleva dentro", () => {
    expect(lugarDelChip({ zona: ZONA, primeraLinea: null, bordeDeArriba: 199, anchoChip: 120 })).toBe("dentro");
  });

  it("el ancho estimado crece con el rótulo", () => {
    expect(anchoDelChip("Sólo en Recordatorio 1")).toBeGreaterThan(anchoDelChip("Sólo en este envío"));
  });
});
