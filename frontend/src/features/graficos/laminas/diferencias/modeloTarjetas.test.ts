// Mata: tarjetas ofrecidas en una lámina con cruce (el motor las rechaza), apagar que borra los rótulos cortos del
// estudio, y `activo: false` leído como encendido.
import { describe, expect, it } from "vitest";
import { admiteTarjetas, tarjetasActivas, tarjetasAlternadas } from "./modeloTarjetas";

describe("tarjetas de diferencias (ADR 0129)", () => {
  it("solo una lámina de un gráfico de categorías o escala, sin cruce", () => {
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_agrupadas", "")).toBe(true);
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_multiapiladas", "")).toBe(true);
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_agrupadas", "default$area")).toBe(false);
    expect(admiteTarjetas("p_slide_2_graficos", "p_barras_agrupadas", "")).toBe(false);
    expect(admiteTarjetas("p_slide_1_grafico", "p_histograma", "")).toBe(false);
  });

  it("lee encendido con `true` o con una opción sin `activo: false`", () => {
    expect(tarjetasActivas({})).toBe(false);
    expect(tarjetasActivas({ tarjetas_diferencias: true })).toBe(true);
    expect(tarjetasActivas({ tarjetas_diferencias: { cortos: { a: "b" } } })).toBe(true);
    expect(tarjetasActivas({ tarjetas_diferencias: { activo: false, max: 4 } })).toBe(false);
    expect(tarjetasActivas({ tarjetas_diferencias: false })).toBe(false);
  });

  it("apagar conserva la opción declarada y volver a encender la recupera", () => {
    const meta = { tarjetas_diferencias: { activo: true, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } } };
    const apagada = tarjetasAlternadas(meta, false);
    expect(apagada).toEqual({ activo: false, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } });
    expect(tarjetasAlternadas({ tarjetas_diferencias: apagada as never }, true)).toEqual({ activo: true, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } });
    expect(tarjetasAlternadas({}, true)).toBe(true);
    expect(tarjetasAlternadas({ tarjetas_diferencias: true }, false)).toBeUndefined();
  });
});
