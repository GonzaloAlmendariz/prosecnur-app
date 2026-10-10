import { describe, expect, it } from "vitest";
import type { GraficosSlideLayoutRegion } from "../../../api/graficos";
import { ranurasSobreLamina } from "./ranurasLamina";

const reg = (payload_key: string, x: number, extra: Partial<GraficosSlideLayoutRegion> = {}): GraficosSlideLayoutRegion => ({
  key: payload_key, payload_key, role: "chart", visible: true, geometry_source: "template",
  rect: { x, y: 0.2, width: 0.4, height: 0.6 }, ...extra,
});

describe("ranurasSobreLamina", () => {
  it("numera en el orden de las ranuras del tipo, no en el de la matriz", () => {
    const r = ranurasSobreLamina(["izquierda", "derecha"], [reg("derecha", 0.55), reg("izquierda", 0.05)]);
    expect(r.map((x) => [x.k, x.slot])).toEqual([[1, "izquierda"], [2, "derecha"]]);
  });
  it("descarta regiones ocultas, que no son gráfico o sin tamaño, y conserva la k de la ranura", () => {
    const r = ranurasSobreLamina(["a", "b", "c"], [
      reg("a", 0, { visible: false }), reg("b", 0.1, { role: "text" }), reg("c", 0.2),
    ]);
    expect(r.map((x) => x.k)).toEqual([3]);
    expect(ranurasSobreLamina(["a"], [reg("a", 0, { rect: { x: 0, y: 0, width: 0, height: 1 } })])).toEqual([]);
  });
  it("recorta lo que sale de la lámina", () => {
    const [r] = ranurasSobreLamina(["a"], [reg("a", 0.8, { rect: { x: 0.8, y: 0.5, width: 0.5, height: 0.9 } })]);
    expect(r.rect.width).toBeCloseTo(0.2);
    expect(r.rect.height).toBeCloseTo(0.5);
  });
});
