import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ArgMetadata } from "../../api/client";
import { ChartLayoutPopover } from "./ChartLayoutPopover";

const BARRAS_AGRUPADAS_ARGS: ArgMetadata[] = [
  numberArg("canvas_w_etiquetas", "Espacio para etiquetas", "proporción", 0.45),
  numberArg("canvas_w_bars", "Espacio para barras", "proporción", 0.52),
  numberArg("canvas_h_header_in", "Alto del encabezado", "pulgadas", 0.7),
  numberArg("alto_por_categoria", "Alto por fila", "pulgadas", 0.48),
];

function numberArg(
  name: string,
  label: string,
  unidad: string,
  defaultValue: number
): ArgMetadata {
  return {
    name,
    label,
    unidad,
    default: defaultValue,
    min: 0,
    max: 1.5,
    tipo_input: "number",
    grupo: "espacio",
  };
}

function renderGroupedBarsLayout(): string {
  return renderToStaticMarkup(createElement(ChartLayoutPopover, {
    presetType: "barras_agrupadas",
    args: BARRAS_AGRUPADAS_ARGS,
    values: {
      canvas_w_etiquetas: 0.45,
      canvas_w_bars: 0.52,
      canvas_h_header_in: 0.7,
      alto_por_categoria: 0.48,
    },
    onChangeArg: vi.fn(),
  }));
}

function unitlessNumberArg(name: string, label: string, defaultValue: number): ArgMetadata {
  return {
    name,
    label,
    default: defaultValue,
    min: 0,
    max: 1.5,
    tipo_input: "number",
    grupo: "espacio",
  };
}

function renderLayout(
  presetType: string,
  args: ArgMetadata[],
  values: Record<string, number>
): string {
  return renderToStaticMarkup(createElement(ChartLayoutPopover, {
    presetType,
    args,
    values,
    onChangeArg: vi.fn(),
  }));
}

function buttonAriaLabels(markup: string): string[] {
  return [...markup.matchAll(/<button\b[^>]*\baria-label="([^"]+)"/g)].map((match) => match[1]);
}

function semanticClaims(markup: string): string[] {
  return [...markup.matchAll(/\b(?:aria-label|title)="([^"]+)"/g)].map((match) => match[1]);
}

function geometrySignature(markup: string): string[] {
  return [...markup.matchAll(/\bstyle="([^"]+)"/g)]
    .flatMap((match) => match[1].split(";"))
    .filter((declaration) => /^(?:grid-template-(?:rows|columns)|flex|width|height):/.test(declaration));
}

function exactMetricClaims(markup: string): string[] {
  return semanticClaims(markup).filter((claim) => claim.includes("valor exacto"));
}

function canvasAriaLabel(markup: string): string {
  const canvasTag = [...markup.matchAll(/<div\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => /\bclass="[^"]*\bpulso-gv2-layout-canvas\b/.test(tag));
  return canvasTag?.match(/\baria-label="([^"]+)"/)?.[1] ?? "";
}

describe("ChartLayoutPopover — bases dimensionales", () => {
  test("conserva el reparto horizontal y no ofrece un reparto falso entre encabezado y filas", () => {
    const pairLabels = buttonAriaLabels(renderGroupedBarsLayout())
      .filter((label) => label.includes("repartir espacio"));

    expect(pairLabels).toContain(
      "Arrastra el borde para repartir espacio entre Espacio para etiquetas y Espacio para barras"
    );
    expect(pairLabels).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:encabezado.*fila|fila.*encabezado)/i),
    ]));
  });

  test("declara alcance, geometría C1 y la unidad por categoría sin porcentaje relativo", () => {
    const markup = renderGroupedBarsLayout();

    expect(markup).toContain(
      "Controla parámetros del render. La vista PPT confirma el resultado final."
    );
    expect(markup).toContain('data-qa-geometry-group="graficos/distribucion-espacio"');
    expect(markup).toContain('data-qa-geometry-contract="intrinsic"');

    const perRowClaims = semanticClaims(markup)
      .filter((claim) => /\bfila(?:s)?\b/i.test(claim));
    expect(perRowClaims.length).toBeGreaterThan(0);
    expect(perRowClaims).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:relativ[oa]|%)/i),
    ]));
  });

  test("campos verticales y pie sin unidad no gobiernan tracks aunque conservan su valor exacto", () => {
    const cases: Array<{
      name: string;
      presetType: string;
      args: ArgMetadata[];
      firstValues: Record<string, number>;
      secondValues: Record<string, number>;
    }> = [
      {
        name: "vertical",
        presetType: "histograma",
        args: [
          unitlessNumberArg("canvas_h_header_in", "Alto del encabezado", 0.2),
          unitlessNumberArg("canvas_h_caption_in", "Alto del pie", 0.6),
        ],
        firstValues: { canvas_h_header_in: 0.2, canvas_h_caption_in: 0.6 },
        secondValues: { canvas_h_header_in: 0.6, canvas_h_caption_in: 0.2 },
      },
      {
        name: "pie",
        presetType: "pie",
        args: [
          unitlessNumberArg("canvas_h_title", "Franja de título", 0.12),
          unitlessNumberArg("canvas_h_caption", "Franja de pie", 0.28),
        ],
        firstValues: { canvas_h_title: 0.12, canvas_h_caption: 0.28 },
        secondValues: { canvas_h_title: 0.28, canvas_h_caption: 0.12 },
      },
    ];

    const observations = Object.fromEntries(cases.map((item) => {
      const first = renderLayout(item.presetType, item.args, item.firstValues);
      const second = renderLayout(item.presetType, item.args, item.secondValues);
      return [item.name, {
        geometryStable: JSON.stringify(geometrySignature(first)) === JSON.stringify(geometrySignature(second)),
        exactMetricsChange: JSON.stringify(exactMetricClaims(first)) !== JSON.stringify(exactMetricClaims(second)),
      }];
    }));

    expect(observations).toEqual({
      vertical: { geometryStable: true, exactMetricsChange: true },
      pie: { geometryStable: true, exactMetricsChange: true },
    });
  });

  test("el canvas sólo anuncia arrastre cuando existe una partición compatible", () => {
    const verticalUnitless = renderLayout(
      "histograma",
      [unitlessNumberArg("canvas_h_header_in", "Alto del encabezado", 0.4)],
      { canvas_h_header_in: 0.4 }
    );
    const groupedBars = renderGroupedBarsLayout();

    expect({
      verticalAnnouncesDrag: canvasAriaLabel(verticalUnitless).includes("Arrastra"),
      barsAnnouncesDrag: canvasAriaLabel(groupedBars).includes("Arrastra"),
    }).toEqual({
      verticalAnnouncesDrag: false,
      barsAnnouncesDrag: true,
    });
  });
});
