import { describe, expect, it } from "vitest";
import { avisoAlAplicar } from "./avisoAplicar";

describe("aviso de lo que descarta Aplicar", () => {
  it("rangos nuevos con salidas aguas abajo: lo dice todo", () => {
    expect(avisoAlAplicar({ muestra: false, rangos: true, hayTamano: true, hayCuotasOSorteo: false })).toMatch(/recalcula la población/);
  });
  it("muestra nueva con cuotas o sorteo: avisa que se descartan", () => {
    expect(avisoAlAplicar({ muestra: true, rangos: false, hayTamano: true, hayCuotasOSorteo: true })).toMatch(/recalcula el tamaño/);
  });
  it("sin nada que descartar, calla", () => {
    expect(avisoAlAplicar({ muestra: true, rangos: false, hayTamano: true, hayCuotasOSorteo: false })).toBeNull();
    expect(avisoAlAplicar({ muestra: false, rangos: false, hayTamano: true, hayCuotasOSorteo: true })).toBeNull();
  });
});
