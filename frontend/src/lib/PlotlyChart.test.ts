import { describe, expect, it } from "vitest";
import { plotlySpecEquals } from "./PlotlyChart";

// La guardia estructural de PlotlyChart nunca debe declarar "igual" un spec
// que cambió de verdad; sí debe reconocer specs idénticos reconstruidos
// inline (referencias nuevas, mismo contenido), que es el patrón dominante en
// las páginas de Monitoreo.

describe("plotlySpecEquals", () => {
  it("reconoce specs idénticos reconstruidos con referencias nuevas", () => {
    const make = () => [
      {
        type: "bar",
        x: ["lun", "mar"],
        y: [3, 5],
        marker: { color: "#168a55", line: { width: 0 } },
      },
      {
        type: "scatter",
        mode: "lines+markers",
        x: ["lun", "mar"],
        y: [3, 8],
        line: { shape: "spline", smoothing: 0.45 },
      },
    ];
    expect(plotlySpecEquals(make(), make())).toBe(true);
  });

  it("detecta cambios de datos aunque la estructura sea la misma", () => {
    const a = [{ type: "bar", y: [1, 2, 3] }];
    const b = [{ type: "bar", y: [1, 2, 4] }];
    expect(plotlySpecEquals(a, b)).toBe(false);
  });

  it("detecta traces agregados o quitados", () => {
    const a = [{ type: "bar", y: [1] }];
    const b = [{ type: "bar", y: [1] }, { type: "scatter", y: [2] }];
    expect(plotlySpecEquals(a, b)).toBe(false);
  });

  it("detecta claves distintas en layouts equivalentes en tamaño", () => {
    expect(plotlySpecEquals({ showlegend: false }, { dragmode: false })).toBe(false);
    expect(plotlySpecEquals({ margin: { t: 0 } }, { margin: { t: 4 } })).toBe(false);
  });

  it("acepta null/undefined solo cuando coinciden", () => {
    expect(plotlySpecEquals(null, null)).toBe(true);
    expect(plotlySpecEquals(undefined, undefined)).toBe(true);
    expect(plotlySpecEquals(null, {})).toBe(false);
    expect(plotlySpecEquals({}, undefined)).toBe(false);
  });

  it("compara typed arrays por contenido y tipo", () => {
    expect(plotlySpecEquals(new Float64Array([1, 2]), new Float64Array([1, 2]))).toBe(true);
    expect(plotlySpecEquals(new Float64Array([1, 2]), new Float64Array([1, 3]))).toBe(false);
    expect(plotlySpecEquals(new Float64Array([1, 2]), new Float32Array([1, 2]))).toBe(false);
  });

  it("no confunde fechas distintas ni fechas con objetos planos", () => {
    expect(plotlySpecEquals(new Date(100), new Date(100))).toBe(true);
    expect(plotlySpecEquals(new Date(100), new Date(200))).toBe(false);
    expect(plotlySpecEquals(new Date(100), {})).toBe(false);
  });

  it("trata funciones no idénticas como cambio (re-render seguro)", () => {
    expect(plotlySpecEquals({ onClick: () => 1 }, { onClick: () => 1 })).toBe(false);
    const fn = () => 1;
    expect(plotlySpecEquals({ onClick: fn }, { onClick: fn })).toBe(true);
  });

  it("agota el presupuesto en specs enormes y cae al comportamiento anterior", () => {
    const big = () => [{ type: "scatter", y: Array.from({ length: 60_001 }, (_, i) => i) }];
    // Presupuesto excedido => se asume cambiado (re-render, nunca stale).
    expect(plotlySpecEquals(big(), big())).toBe(false);
  });
});
