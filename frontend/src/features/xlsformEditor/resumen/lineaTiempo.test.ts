// Mata: un rótulo cortado en un tramo angosto («A1_b…») y el rótulo que se pinta antes de medir la barra.
import { describe, expect, test } from "vitest";
import { rotuloCabe } from "./LineaTiempo";

describe("rótulo del tramo", () => {
  test("se muestra sólo si cabe entero en el ancho real", () => {
    expect(rotuloCabe(0.06, 848, "A1_bateria")).toBe(false);
    expect(rotuloCabe(0.15, 848, "A1_bateria")).toBe(true);
    expect(rotuloCabe(0.2, 848, "Sección D. Preguntas sobre mecanismos")).toBe(false);
    expect(rotuloCabe(0.5, 0, "A1")).toBe(false);
  });
});
