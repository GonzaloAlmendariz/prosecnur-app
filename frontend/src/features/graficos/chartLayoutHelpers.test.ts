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

type AdjustLayoutPairByArrowKey = (
  key: string,
  values: readonly [number, number],
  leftMeta: ArgMetadata | undefined,
  rightMeta: ArgMetadata | undefined
) => [number, number] | null;

type ResolvedLayoutPair = {
  total: number;
  primaryMin: number;
  primaryMax: number;
};

type ResolveLayoutPair = (
  values: readonly [number, number],
  leftMeta: ArgMetadata | undefined,
  rightMeta: ArgMetadata | undefined
) => ResolvedLayoutPair | null;

type LayoutEscapePolicy = {
  preventDefault: true;
  stopPropagation: true;
  cancel: true;
  invokeCallback: false;
  blur: false;
  preserveFocus: true;
};

type ResolveLayoutEscapePolicy = (
  scope: "transaction" | "input",
  active: boolean
) => LayoutEscapePolicy | null;

function numberMeta(name: string, unidad: string): ArgMetadata {
  return {
    name,
    label: name,
    tipo_input: "number",
    grupo: "espacio",
    unidad,
  };
}

function boundedPairMeta(
  name: string,
  label: string,
  min: number,
  max: number,
  step = 0.01
): ArgMetadata {
  return {
    name,
    label,
    min,
    max,
    step,
    tipo_input: "number",
    grupo: "espacio",
  };
}

function withoutBound(meta: ArgMetadata, bound: "min" | "max"): ArgMetadata {
  const copy = { ...meta };
  delete copy[bound];
  return copy;
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

  test("resuelve únicamente pares con valores y dominio completo, finito y factible", () => {
    const resolveLayoutPair = Reflect.get(
      layoutHelpers,
      "resolveLayoutPair"
    ) as ResolveLayoutPair | undefined;

    expect(resolveLayoutPair).toBeTypeOf("function");
    if (!resolveLayoutPair) return;

    const leftMeta = boundedPairMeta(
      "canvas_w_etiquetas",
      "Espacio para etiquetas",
      0,
      0.55
    );
    const rightMeta = boundedPairMeta(
      "canvas_w_bars",
      "Espacio para barras",
      0.2,
      0.9
    );
    const validPair = resolveLayoutPair([0.45, 0.52], leftMeta, rightMeta);

    expect(validPair).not.toBeNull();
    expect(validPair?.total).toBeCloseTo(0.97, 12);
    expect(validPair?.primaryMin).toBeCloseTo(0.07, 12);
    expect(validPair?.primaryMax).toBeCloseTo(0.55, 12);

    const zeroLeftMeta = boundedPairMeta("left", "Izquierda", 0, 1);
    const zeroRightMeta = boundedPairMeta("right", "Derecha", 0, 1);
    const invalidCases: Array<{
      name: string;
      values: readonly [number, number];
      leftMeta: ArgMetadata | undefined;
      rightMeta: ArgMetadata | undefined;
    }> = [
      { name: "left metadata absent", values: [0.45, 0.52], leftMeta: undefined, rightMeta },
      { name: "right metadata absent", values: [0.45, 0.52], leftMeta, rightMeta: undefined },
      { name: "left.min absent", values: [0.45, 0.52], leftMeta: withoutBound(leftMeta, "min"), rightMeta },
      { name: "left.max absent", values: [0.45, 0.52], leftMeta: withoutBound(leftMeta, "max"), rightMeta },
      { name: "right.min absent", values: [0.45, 0.52], leftMeta, rightMeta: withoutBound(rightMeta, "min") },
      { name: "right.max absent", values: [0.45, 0.52], leftMeta, rightMeta: withoutBound(rightMeta, "max") },
      { name: "left.min non-finite", values: [0.45, 0.52], leftMeta: { ...leftMeta, min: Number.NaN }, rightMeta },
      { name: "left.max non-finite", values: [0.45, 0.52], leftMeta: { ...leftMeta, max: Number.POSITIVE_INFINITY }, rightMeta },
      { name: "right.min non-finite", values: [0.45, 0.52], leftMeta, rightMeta: { ...rightMeta, min: Number.NEGATIVE_INFINITY } },
      { name: "right.max non-finite", values: [0.45, 0.52], leftMeta, rightMeta: { ...rightMeta, max: Number.NaN } },
      { name: "left min above max", values: [0.45, 0.52], leftMeta: { ...leftMeta, min: 0.6 }, rightMeta },
      { name: "right min above max", values: [0.45, 0.52], leftMeta, rightMeta: { ...rightMeta, min: 1 } },
      {
        name: "combined interval impossible",
        values: [0.5, 0.5],
        leftMeta: boundedPairMeta("left", "Izquierda", 0.6, 0.8),
        rightMeta: boundedPairMeta("right", "Derecha", 0.6, 0.8),
      },
      { name: "left value non-finite", values: [Number.NaN, 0.52], leftMeta, rightMeta },
      { name: "right value non-finite", values: [0.45, Number.POSITIVE_INFINITY], leftMeta, rightMeta },
      { name: "left value outside domain", values: [0.56, 0.41], leftMeta, rightMeta },
      { name: "right value outside domain", values: [0.06, 0.91], leftMeta, rightMeta },
      { name: "zero total", values: [0, 0], leftMeta: zeroLeftMeta, rightMeta: zeroRightMeta },
    ];

    expect(Object.fromEntries(invalidCases.map(({ name, values, leftMeta: left, rightMeta: right }) => [
      name,
      resolveLayoutPair(values, left, right),
    ]))).toEqual(Object.fromEntries(invalidCases.map(({ name }) => [name, null])));
  });

  test("ajusta el par con flechas, conserva la suma y respeta límites publicados", () => {
    const adjustLayoutPairByArrowKey = Reflect.get(
      layoutHelpers,
      "adjustLayoutPairByArrowKey"
    ) as AdjustLayoutPairByArrowKey | undefined;

    expect(adjustLayoutPairByArrowKey).toBeTypeOf("function");
    if (!adjustLayoutPairByArrowKey) return;

    const leftMeta: ArgMetadata = {
      name: "canvas_w_etiquetas",
      label: "Espacio para etiquetas",
      min: 0,
      max: 0.55,
      step: 0.01,
      tipo_input: "number",
      grupo: "espacio",
    };
    const rightMeta: ArgMetadata = {
      name: "canvas_w_bars",
      label: "Espacio para barras",
      min: 0.2,
      max: 0.9,
      step: 0.01,
      tipo_input: "number",
      grupo: "espacio",
    };
    const arrowRight = adjustLayoutPairByArrowKey(
      "ArrowRight",
      [0.45, 0.52],
      leftMeta,
      rightMeta
    );
    const arrowLeft = adjustLayoutPairByArrowKey(
      "ArrowLeft",
      [0.45, 0.52],
      leftMeta,
      rightMeta
    );

    expect({ arrowRight, arrowLeft }).toEqual({
      arrowRight: [0.46, 0.51],
      arrowLeft: [0.44, 0.53],
    });
    for (const pair of [arrowRight, arrowLeft]) {
      expect(Math.abs((pair?.[0] ?? 0) + (pair?.[1] ?? 0) - 0.97)).toBeLessThanOrEqual(0.001);
    }
    expect({
      lowerClamp: adjustLayoutPairByArrowKey("ArrowLeft", [0.07, 0.9], leftMeta, rightMeta),
      upperClamp: adjustLayoutPairByArrowKey("ArrowRight", [0.55, 0.42], leftMeta, rightMeta),
    }).toEqual({
      lowerClamp: [0.07, 0.9],
      upperClamp: [0.55, 0.42],
    });
  });

  test("falla cerrado sin step positivo y ante teclas fuera del contrato", () => {
    const adjustLayoutPairByArrowKey = Reflect.get(
      layoutHelpers,
      "adjustLayoutPairByArrowKey"
    ) as AdjustLayoutPairByArrowKey | undefined;

    expect(adjustLayoutPairByArrowKey).toBeTypeOf("function");
    if (!adjustLayoutPairByArrowKey) return;

    const leftMeta: ArgMetadata = {
      name: "canvas_w_etiquetas",
      label: "Espacio para etiquetas",
      min: 0,
      max: 0.55,
      step: 0.01,
      tipo_input: "number",
      grupo: "espacio",
    };
    const rightMeta: ArgMetadata = {
      name: "canvas_w_bars",
      label: "Espacio para barras",
      min: 0.2,
      max: 0.9,
      step: 0.01,
      tipo_input: "number",
      grupo: "espacio",
    };
    const withoutStep = { ...leftMeta, step: undefined };
    const incompleteBounds = withoutBound(leftMeta, "min");
    const invalidBounds = { ...rightMeta, max: Number.POSITIVE_INFINITY };
    const zeroLeftMeta = { ...leftMeta, min: 0, max: 1 };
    const zeroRightMeta = { ...rightMeta, min: 0, max: 1 };

    expect({
      unrelated: adjustLayoutPairByArrowKey("Enter", [0.45, 0.52], leftMeta, rightMeta),
      home: adjustLayoutPairByArrowKey("Home", [0.45, 0.52], leftMeta, rightMeta),
      end: adjustLayoutPairByArrowKey("End", [0.45, 0.52], leftMeta, rightMeta),
      missingStep: adjustLayoutPairByArrowKey("ArrowRight", [0.45, 0.52], withoutStep, rightMeta),
      incompleteBounds: adjustLayoutPairByArrowKey("ArrowRight", [0.45, 0.52], incompleteBounds, rightMeta),
      invalidBounds: adjustLayoutPairByArrowKey("ArrowRight", [0.45, 0.52], leftMeta, invalidBounds),
      zeroTotal: adjustLayoutPairByArrowKey("ArrowRight", [0, 0], zeroLeftMeta, zeroRightMeta),
    }).toEqual({
      unrelated: null,
      home: null,
      end: null,
      missingStep: null,
      incompleteBounds: null,
      invalidBounds: null,
      zeroTotal: null,
    });
  });

  test("explicita la cancelación local de Escape sin callback, blur ni pérdida de foco", () => {
    const resolveLayoutEscapePolicy = Reflect.get(
      layoutHelpers,
      "resolveLayoutEscapePolicy"
    ) as ResolveLayoutEscapePolicy | undefined;

    expect(resolveLayoutEscapePolicy).toBeTypeOf("function");
    if (!resolveLayoutEscapePolicy) return;

    const cancellation: LayoutEscapePolicy = {
      preventDefault: true,
      stopPropagation: true,
      cancel: true,
      invokeCallback: false,
      blur: false,
      preserveFocus: true,
    };
    expect({
      transaction: resolveLayoutEscapePolicy("transaction", true),
      input: resolveLayoutEscapePolicy("input", true),
      idleTransaction: resolveLayoutEscapePolicy("transaction", false),
    }).toEqual({
      transaction: cancellation,
      input: cancellation,
      idleTransaction: null,
    });
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
      // Sin unidad declarada la etiqueta va vacía: el contrato sigue fallando
      // cerrado (`measure-only`, no comparte), que es lo que vigila este test.
      // Antes decía «Unidad no publicada», vocabulario del registro en la cara
      // del analista.
      unitLabel: "",
      basis: "measure-only",
      partition: null,
      canShare: false,
    });
    expect(layoutHelpers.canShareLayoutMeasurePair(sinUnidad, proporcionPublicada)).toBe(false);
  });
});
