import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ArgMetadata } from "../../api/client";
import { ChartLayoutPopover } from "./ChartLayoutPopover";

type TestChartLayoutOrigin =
  | { kind: "base_ppt" }
  | { kind: "saved_style"; styleId: string; styleLabel: string }
  | { kind: "chart_adjustment" };

const ABSENT_ORIGIN = Symbol("absent-origin");

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
  const props = {
    presetType: "barras_agrupadas",
    args: BARRAS_AGRUPADAS_ARGS,
    values: {
      canvas_w_etiquetas: 0.45,
      canvas_w_bars: 0.52,
      canvas_h_header_in: 0.7,
      alto_por_categoria: 0.48,
    },
    origin: { kind: "base_ppt" as const },
    onChangeArg: vi.fn(),
  };
  return renderToStaticMarkup(createElement(ChartLayoutPopover, props));
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
  const props = {
    presetType,
    args,
    values,
    origin: { kind: "base_ppt" as const },
    onChangeArg: vi.fn(),
  };
  return renderToStaticMarkup(createElement(ChartLayoutPopover, props));
}

function renderLayoutOrigin(
  origin: TestChartLayoutOrigin,
  values: Record<string, number> = { canvas_w_etiquetas: 0.45 },
  inheritedValues: Record<string, number> = { canvas_w_bars: 0.52 }
): string {
  const props = {
    presetType: "barras_agrupadas",
    args: BARRAS_AGRUPADAS_ARGS,
    values,
    inheritedValues,
    origin,
    onChangeArg: vi.fn(),
  };
  return renderToStaticMarkup(createElement(ChartLayoutPopover, props));
}

function renderRuntimeOrigin(origin: unknown | typeof ABSENT_ORIGIN): string {
  const props = {
    presetType: "barras_agrupadas",
    args: BARRAS_AGRUPADAS_ARGS,
    values: { canvas_w_etiquetas: 0.45 },
    inheritedValues: { canvas_w_bars: 0.52 },
    ...(origin === ABSENT_ORIGIN ? {} : { origin }),
    onChangeArg: vi.fn(),
  } as Parameters<typeof ChartLayoutPopover>[0];
  return renderToStaticMarkup(createElement(ChartLayoutPopover, props));
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

function sourceClaim(markup: string): { state: string; label: string } {
  const state = markup.match(/\bdata-source-state="([^"]+)"/)?.[1] ?? "";
  const card = markup.match(/<div\b[^>]*\bpulso-gv2-layout-state-card\b[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const label = card.match(/<strong>([^<]+)<\/strong>/)?.[1] ?? "";
  return { state, label };
}

function sourceCardAriaLabel(markup: string): string {
  const tag = markup.match(/<div\b[^>]*\bpulso-gv2-layout-state-card\b[^>]*>/)?.[0] ?? "";
  return tag.match(/\baria-label="([^"]+)"/)?.[1] ?? "";
}

function resetClaim(markup: string): { label: string; disabled: boolean } {
  const match = markup.match(/(<button\b[^>]*\bpulso-gv2-layout-reset\b[^>]*>)([\s\S]*?)<\/button>/);
  const tag = match?.[1] ?? "";
  const label = (match?.[2] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    label,
    disabled: /\bdisabled(?:=""|(?=[\s>]))/.test(tag),
  };
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

describe("ChartLayoutPopover — procedencia explícita", () => {
  test("la prop origin gobierna el claim aunque values e inheritedValues sean idénticos", () => {
    const longStyleLabel = "Narrativa territorial para población desplazada y comunidades de acogida";

    const claims = [
      renderLayoutOrigin({ kind: "base_ppt" }),
      renderLayoutOrigin({
        kind: "saved_style",
        styleId: "ovr-narrativa-territorial",
        styleLabel: longStyleLabel,
      }),
      renderLayoutOrigin({ kind: "chart_adjustment" }),
    ].map(sourceClaim);

    expect(claims).toEqual([
      { state: "base", label: "Base PPT" },
      { state: "mode", label: `Estilo guardado: ${longStyleLabel}` },
      { state: "manual", label: "Ajuste de este gráfico" },
    ]);
  });

  test("origin ausente o inválido falla cerrado sin inferir desde los valores", () => {
    const claims = [
      renderRuntimeOrigin(ABSENT_ORIGIN),
      renderRuntimeOrigin({ kind: "legacy-inferred-mode" }),
    ].map(sourceClaim);

    expect(claims).toEqual([
      { state: "unknown", label: "Procedencia no declarada" },
      { state: "unknown", label: "Procedencia no declarada" },
    ]);
  });

  test("el reset nombra el owner y sólo se habilita cuando existen valores propios", () => {
    const savedStyle = {
      kind: "saved_style" as const,
      styleId: "ovr-narrativa-territorial",
      styleLabel: "Narrativa territorial",
    };

    expect({
      base: resetClaim(renderLayoutOrigin({ kind: "base_ppt" })),
      savedStyle: resetClaim(renderLayoutOrigin(savedStyle)),
      chartAdjustment: resetClaim(renderLayoutOrigin({ kind: "chart_adjustment" })),
      inheritedOnly: resetClaim(renderLayoutOrigin(
        { kind: "base_ppt" },
        {},
        { canvas_w_etiquetas: 0.45, canvas_w_bars: 0.52 }
      )),
    }).toEqual({
      base: { label: "Restablecer Base PPT", disabled: false },
      savedStyle: { label: "Restablecer estilo guardado", disabled: false },
      chartAdjustment: { label: "Quitar ajuste de este gráfico", disabled: false },
      inheritedOnly: { label: "Restablecer Base PPT", disabled: true },
    });
  });

  test("el nombre accesible de la tarjeta contiene el claim visible exacto", () => {
    const cases = [
      { claim: "Base PPT", markup: renderLayoutOrigin({ kind: "base_ppt" }) },
      {
        claim: "Estilo guardado: Narrativa territorial",
        markup: renderLayoutOrigin({
          kind: "saved_style",
          styleId: "ovr-narrativa-territorial",
          styleLabel: "Narrativa territorial",
        }),
      },
      { claim: "Ajuste de este gráfico", markup: renderLayoutOrigin({ kind: "chart_adjustment" }) },
    ];

    expect(cases.map(({ claim, markup }) => ({
      claim,
      ariaIncludesClaim: sourceCardAriaLabel(markup).includes(claim),
    }))).toEqual(cases.map(({ claim }) => ({ claim, ariaIncludesClaim: true })));
  });

  test("presentaciones y tooltips renderizados no exponen owner ni snapshot", () => {
    const renderedCases = {
      base: renderLayoutOrigin({ kind: "base_ppt" }),
      saved: renderLayoutOrigin({
        kind: "saved_style",
        styleId: "ovr-narrativa-territorial",
        styleLabel: "Narrativa territorial",
      }),
      manual: renderLayoutOrigin({ kind: "chart_adjustment" }),
      undeclared: renderRuntimeOrigin({ kind: "legacy-inferred-mode" }),
      inheritedOnly: renderLayoutOrigin(
        { kind: "base_ppt" },
        {},
        { canvas_w_etiquetas: 0.45, canvas_w_bars: 0.52 }
      ),
    };
    const forbiddenClaims = Object.entries(renderedCases).flatMap(([name, markup]) =>
      [...markup.matchAll(/\b(owner|snapshot)\b/gi)]
        .map((match) => `${name}:${match[0].toLowerCase()}`)
    );

    expect(forbiddenClaims).toEqual([]);
  });
});
