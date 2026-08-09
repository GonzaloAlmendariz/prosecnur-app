import { describe, expect, test } from "vitest";
import { clampPairByMeta, buildGridTracks, flexTrackStyle } from "./chartLayoutHelpers";
import * as layoutHelpers from "./chartLayoutHelpers";
import type { ArgMetadata } from "../../api/client";

type LayoutMeasureBasis =
  | "ratio-partition"
  | "fixed-inch"
  | "nested-inch"
  | "per-category-inch"
  | "measure-only";

type LayoutMeasureContractProbe = {
  axis: "x" | "y";
  unitLabel: string;
  basis: LayoutMeasureBasis;
  partition: string | null;
  canShare: boolean;
};

type ResolveLayoutMeasureContract = (
  name: string,
  meta: ArgMetadata | undefined
) => LayoutMeasureContractProbe;

type CanShareLayoutMeasurePair = (
  first: LayoutMeasureContractProbe,
  second: LayoutMeasureContractProbe
) => boolean;

function numberMeta(name: string, unidad: string): ArgMetadata {
  return {
    name,
    label: name,
    tipo_input: "number",
    grupo: "espacio",
    unidad,
  };
}

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

  test("sólo reparte medidas que pertenecen a una misma partición física", () => {
    // API pública deliberadamente pequeña de G2-L1.5a: el JSX resuelve cada
    // medida una vez y pregunta a una sola política si el par puede compartir
    // drag/porcentaje. Así no vuelve a inferir compatibilidad por sufijos.
    const resolveLayoutMeasureContract = Reflect.get(
      layoutHelpers,
      "resolveLayoutMeasureContract"
    ) as ResolveLayoutMeasureContract | undefined;
    const canShareLayoutMeasurePair = Reflect.get(
      layoutHelpers,
      "canShareLayoutMeasurePair"
    ) as CanShareLayoutMeasurePair | undefined;

    expect(resolveLayoutMeasureContract).toBeTypeOf("function");
    expect(canShareLayoutMeasurePair).toBeTypeOf("function");
    if (!resolveLayoutMeasureContract || !canShareLayoutMeasurePair) return;

    const etiquetas = resolveLayoutMeasureContract(
      "canvas_w_etiquetas",
      numberMeta("canvas_w_etiquetas", "proporción")
    );
    const barras = resolveLayoutMeasureContract(
      "canvas_w_bars",
      numberMeta("canvas_w_bars", "proporción")
    );
    const header = resolveLayoutMeasureContract(
      "canvas_h_header_in",
      numberMeta("canvas_h_header_in", "pulgadas")
    );
    const filaAuxiliar = resolveLayoutMeasureContract(
      "canvas_h_toprow_in",
      numberMeta("canvas_h_toprow_in", "pulgadas")
    );
    const altoPorFila = resolveLayoutMeasureContract(
      "alto_por_categoria",
      numberMeta("alto_por_categoria", "pulgadas")
    );
    const sinOracle = resolveLayoutMeasureContract(
      "canvas_h_sin_oracle_in",
      numberMeta("canvas_h_sin_oracle_in", "pulgadas")
    );

    expect(etiquetas).toMatchObject({
      axis: "x",
      unitLabel: "proporción",
      basis: "ratio-partition",
      partition: "bars-horizontal",
      canShare: true,
    });
    expect(barras).toMatchObject({
      axis: "x",
      basis: "ratio-partition",
      partition: "bars-horizontal",
      canShare: true,
    });
    expect(header).toMatchObject({
      axis: "y",
      unitLabel: "pulgadas",
      basis: "fixed-inch",
      partition: null,
      canShare: false,
    });
    expect(filaAuxiliar).toMatchObject({
      axis: "y",
      basis: "nested-inch",
      partition: null,
      canShare: false,
    });
    expect(altoPorFila).toMatchObject({
      axis: "y",
      unitLabel: "pulgadas por categoría",
      basis: "per-category-inch",
      partition: null,
      canShare: false,
    });
    expect(sinOracle).toMatchObject({
      basis: "measure-only",
      partition: null,
      canShare: false,
    });

    expect(canShareLayoutMeasurePair(etiquetas, barras)).toBe(true);
    expect(canShareLayoutMeasurePair(header, altoPorFila)).toBe(false);
    expect(canShareLayoutMeasurePair(filaAuxiliar, altoPorFila)).toBe(false);
  });

  test("falla cerrado si una medida horizontal whitelist no publica su unidad", () => {
    // `canvas_w_grupo` existe en la familia multi_apiladas, pero pertenecer a
    // la whitelist por nombre no demuestra que el backend haya publicado una
    // proporción. Sin esa unidad no puede heredar share ni drag de otro campo.
    const sinUnidad = layoutHelpers.resolveLayoutMeasureContract(
      "canvas_w_grupo",
      {
        name: "canvas_w_grupo",
        label: "Columna de grupo",
        tipo_input: "number",
        grupo: "espacio",
      }
    );
    const proporcionPublicada = layoutHelpers.resolveLayoutMeasureContract(
      "canvas_w_etiquetas",
      numberMeta("canvas_w_etiquetas", "proporción")
    );

    expect(sinUnidad).toEqual({
      axis: "x",
      unitLabel: "Unidad no publicada",
      basis: "measure-only",
      partition: null,
      canShare: false,
    });
    expect(layoutHelpers.canShareLayoutMeasurePair(sinUnidad, proporcionPublicada)).toBe(false);
  });
});
