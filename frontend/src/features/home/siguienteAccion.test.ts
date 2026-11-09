import { describe, expect, test } from "vitest";
import { accionVisible } from "./siguienteAccion";

describe("siguiente acción en la tarjeta del Home (L31)", () => {
  test("se muestra la acción que orienta", () => {
    expect(accionVisible({ label: "Revisar alertas" })).toBe("Revisar alertas");
    expect(accionVisible({ label: "Continuar en Validación" })).toBe("Continuar en Validación");
  });

  test('"Abrir X" repite el módulo y se calla; sin acción, nada', () => {
    expect(accionVisible({ label: "Abrir cálculo" })).toBeNull();
    expect(accionVisible({ label: "  " })).toBeNull();
    expect(accionVisible(null)).toBeNull();
  });
});
