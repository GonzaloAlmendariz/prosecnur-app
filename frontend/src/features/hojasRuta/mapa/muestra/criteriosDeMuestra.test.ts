import { describe, expect, test } from "vitest";
import { consejosDeMuestra, CRITERIOS_ESTADISTICOS, recomendacionDeff } from "./criteriosDeMuestra";

describe("criterios y guía de decisión de Muestra (P7 de la paridad)", () => {
  test("la recomendación de DEFF sube con la carga por manzana, con los umbrales de la clásica", () => {
    expect(recomendacionDeff(1).deff).toBe(1.0);
    expect(recomendacionDeff(3).deff).toBe(1.2);
    expect(recomendacionDeff(8).deff).toBe(1.5);
    expect(recomendacionDeff(10).deff).toBe(2.0);
    expect(recomendacionDeff(0).deff).toBe(1.0);
  });

  test("los semáforos marcan cada supuesto", () => {
    const tono = (c: ReturnType<typeof consejosDeMuestra>, id: string) => c.find((x) => x.id === id)?.tono;
    const bueno = consejosDeMuestra({ margenTotal: 0.05, p: 0.5, deff: 1.5, respuesta: 0.9 });
    expect(bueno.every((c) => c.tono === "ok")).toBe(true);
    const flojo = consejosDeMuestra({ margenTotal: 0.1, p: 0.2, deff: 0.9, respuesta: 0.5 });
    expect(tono(flojo, "margen")).toBe("error");
    expect(tono(flojo, "p")).toBe("aviso");
    expect(tono(flojo, "deff")).toBe("aviso");
    expect(tono(flojo, "respuesta")).toBe("error");
    expect(CRITERIOS_ESTADISTICOS).toHaveLength(4);
  });
});
