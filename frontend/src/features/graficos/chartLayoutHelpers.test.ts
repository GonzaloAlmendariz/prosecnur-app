import { describe, expect, test } from "vitest";
import { clampPairByMeta, buildGridTracks, flexTrackStyle } from "./chartLayoutHelpers";
import type { ArgMetadata } from "../../api/client";

describe("chartLayoutHelpers", () => {
  test("normaliza tracks con cierre al 100% y gap en 0 sin ancho", () => {
    const fields = [
      { name: "canvas_w_a" },
      { name: "canvas_w_b" },
      { name: "canvas_w_c" },
    ];
    const valueOf = (name: string) => {
      if (name === "canvas_w_a") return 0.4;
      if (name === "canvas_w_b") return 0;
      return 0.6;
    };
    expect(buildGridTracks(fields, valueOf)).toBe("minmax(0, 40%) minmax(0, 0%) minmax(0, 60%)");
  });

  test("congela el ajuste de un par dentro de límites por metadata", () => {
    const left: ArgMetadata = {
      name: "a",
      label: "Campo a",
      min: 0.1,
      max: 0.6,
      tipo_input: "number",
      grupo: "estilo",
    };
    const right: ArgMetadata = {
      name: "b",
      label: "Campo b",
      min: 0.05,
      max: 0.5,
      tipo_input: "number",
      grupo: "estilo",
    };
    expect(clampPairByMeta(0.95, 1, left, right)).toEqual([0.6, 0.4]);
    expect(clampPairByMeta(-0.1, 1, left, right)).toEqual([0.5, 0.5]);
  });

  test("devuelve flex de gap con ancho 0 cuando el valor es 0", () => {
    expect(flexTrackStyle(0, true)).toMatchObject({ flex: "0 1 0" });
    expect(flexTrackStyle(0, false).flex).not.toBe("0 1 0");
  });
});
