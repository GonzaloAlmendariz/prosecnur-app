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
  numberArg("canvas_w_etiquetas", "Espacio para etiquetas", "proporción", 0.45, {
    min: 0,
    max: 0.55,
    step: 0.01,
  }),
  numberArg("canvas_w_bars", "Espacio para barras", "proporción", 0.52, {
    min: 0.2,
    max: 0.9,
    step: 0.01,
  }),
  numberArg("canvas_h_header_in", "Alto del encabezado", "pulgadas", 0.7),
  numberArg("alto_por_categoria", "Alto por fila", "pulgadas", 0.48),
];

function numberArg(
  name: string,
  label: string,
  unidad: string,
  defaultValue: number,
  limits: Partial<Pick<ArgMetadata, "min" | "max" | "step">> = {}
): ArgMetadata {
  return {
    name,
    label,
    unidad,
    default: defaultValue,
    min: limits.min ?? 0,
    max: limits.max ?? 1.5,
    ...(limits.step === undefined ? {} : { step: limits.step }),
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

function tagsWithRole(markup: string, role: string): string[] {
  return [...markup.matchAll(new RegExp(`<[^/>]+\\brole="${role}"[^>]*>`, "g"))]
    .map((match) => match[0]);
}

function tagsWithClass(markup: string, className: string): string[] {
  return [...markup.matchAll(new RegExp(`<[^/>]+\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`, "g"))]
    .map((match) => match[0]);
}

function tagAttribute(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";
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
  test("mantiene visible un separador div cuando la región primaria es compacta", () => {
    const markup = renderLayout(
      "barras_agrupadas",
      BARRAS_AGRUPADAS_ARGS,
      {
        canvas_w_etiquetas: 0.05,
        canvas_w_bars: 0.52,
        canvas_h_header_in: 0.7,
        alto_por_categoria: 0.48,
      }
    );
    const handles = tagsWithClass(markup, "pulso-gv2-layout-handle");
    const separators = tagsWithRole(markup, "separator");
    const separator = separators[0] ?? "";
    const tagName = separator.match(/^<([a-z][a-z0-9-]*)\b/i)?.[1] ?? "";
    const controlledRegionId = tagAttribute(separator, "aria-controls");
    const primaryFrame = tagsWithClass(markup, "pulso-gv2-layout-frame")
      .find((tag) => tagAttribute(tag, "id") === controlledRegionId) ?? "";

    expect({
      handles: handles.length,
      separators: separators.length,
      tagName,
      compactFrame: tagAttribute(primaryFrame, "class").split(/\s+/).includes("is-compact"),
    }).toEqual({
      handles: 1,
      separators: 1,
      tagName: "div",
      compactFrame: true,
    });
    expect(["span", "button", "input", "select", "textarea"]).not.toContain(tagName);
    expect({
      tabIndex: tagAttribute(separator, "tabindex"),
      orientation: tagAttribute(separator, "aria-orientation"),
      label: tagAttribute(separator, "aria-label"),
      controls: controlledRegionId,
      now: tagAttribute(separator, "aria-valuenow"),
      min: tagAttribute(separator, "aria-valuemin"),
      max: tagAttribute(separator, "aria-valuemax"),
    }).toEqual({
      tabIndex: "0",
      orientation: "vertical",
      label: "Ajustar el límite entre Espacio para etiquetas y Espacio para barras",
      controls: expect.stringMatching(/\S+/),
      now: "0.05",
      min: "0",
      max: "0.37",
    });
    expect(markup).toContain(`id="${controlledRegionId}"`);
    expect(tagAttribute(separator, "aria-valuetext"))
      .toMatch(/Espacio para etiquetas[^;]*0\.05[^;]*proporción; Espacio para barras[^;]*0\.52[^;]*proporción/i);

    const zeroPrimaryMarkup = renderLayout(
      "barras_agrupadas",
      BARRAS_AGRUPADAS_ARGS,
      { canvas_w_etiquetas: 0, canvas_w_bars: 0.52 }
    );
    const zeroPrimaryHandles = tagsWithClass(zeroPrimaryMarkup, "pulso-gv2-layout-handle");
    const zeroPrimarySeparators = tagsWithRole(zeroPrimaryMarkup, "separator");
    const zeroPrimarySeparator = zeroPrimarySeparators[0] ?? "";
    const zeroPrimaryRegionId = tagAttribute(zeroPrimarySeparator, "aria-controls");
    const zeroPrimaryFrame = tagsWithClass(zeroPrimaryMarkup, "pulso-gv2-layout-frame")
      .find((tag) => tagAttribute(tag, "id") === zeroPrimaryRegionId) ?? "";
    const zeroPrimaryFrameClasses = tagAttribute(zeroPrimaryFrame, "class").split(/\s+/);

    expect({
      handles: zeroPrimaryHandles.length,
      separators: zeroPrimarySeparators.length,
      tagName: zeroPrimarySeparator.match(/^<([a-z][a-z0-9-]*)\b/i)?.[1] ?? "",
      now: tagAttribute(zeroPrimarySeparator, "aria-valuenow"),
      min: tagAttribute(zeroPrimarySeparator, "aria-valuemin"),
      max: tagAttribute(zeroPrimarySeparator, "aria-valuemax"),
      controlsPrimaryFrame: Boolean(zeroPrimaryFrame),
      compactFrame: zeroPrimaryFrameClasses.includes("is-compact"),
      zeroFrame: zeroPrimaryFrameClasses.includes("is-zero"),
    }).toEqual({
      handles: 1,
      separators: 1,
      tagName: "div",
      now: "0",
      min: "0",
      max: "0.32",
      controlsPrimaryFrame: true,
      compactFrame: true,
      zeroFrame: false,
    });
  });

  test("no materializa control interactivo con suma cero o metadata incompleta", () => {
    const leftWithoutMin = { ...BARRAS_AGRUPADAS_ARGS[0] };
    delete leftWithoutMin.min;
    const incompleteArgs = [leftWithoutMin, ...BARRAS_AGRUPADAS_ARGS.slice(1)];
    const cases = {
      zeroTotal: renderLayout(
        "barras_agrupadas",
        BARRAS_AGRUPADAS_ARGS,
        { canvas_w_etiquetas: 0, canvas_w_bars: 0 }
      ),
      incompleteBounds: renderLayout(
        "barras_agrupadas",
        incompleteArgs,
        { canvas_w_etiquetas: 0.45, canvas_w_bars: 0.52 }
      ),
    };

    expect(Object.fromEntries(Object.entries(cases).map(([name, markup]) => [name, {
      handles: tagsWithClass(markup, "pulso-gv2-layout-handle").length,
      separators: tagsWithRole(markup, "separator").length,
    }]))).toEqual({
      zeroTotal: { handles: 0, separators: 0 },
      incompleteBounds: { handles: 0, separators: 0 },
    });
  });

  test("materializa un único separador accesible para el límite etiquetas-barras", () => {
    const markup = renderGroupedBarsLayout();
    const handles = tagsWithClass(markup, "pulso-gv2-layout-handle");
    const separators = tagsWithRole(markup, "separator");

    expect({
      handles: handles.length,
      separators: separators.length,
      leadingHandles: tagsWithClass(markup, "is-leading").length,
    }).toEqual({
      handles: 1,
      separators: 1,
      leadingHandles: 0,
    });

    const separator = separators[0] ?? "";
    const tagName = separator.match(/^<([a-z][a-z0-9-]*)\b/i)?.[1] ?? "";
    const controlledRegionId = tagAttribute(separator, "aria-controls");
    const valueText = tagAttribute(separator, "aria-valuetext");

    expect(["button", "input", "select", "textarea"]).not.toContain(tagName);
    expect({
      tabIndex: tagAttribute(separator, "tabindex"),
      orientation: tagAttribute(separator, "aria-orientation"),
      label: tagAttribute(separator, "aria-label"),
      now: tagAttribute(separator, "aria-valuenow"),
      min: tagAttribute(separator, "aria-valuemin"),
      max: tagAttribute(separator, "aria-valuemax"),
    }).toEqual({
      tabIndex: "0",
      orientation: "vertical",
      label: "Ajustar el límite entre Espacio para etiquetas y Espacio para barras",
      now: "0.45",
      min: "0.07",
      max: "0.55",
    });
    expect(controlledRegionId).not.toBe("");
    expect(markup).toContain(`id="${controlledRegionId}"`);
    expect(valueText).toMatch(/Espacio para etiquetas[^;]*0\.45[^;]*proporción/i);
    expect(valueText).toMatch(/Espacio para barras[^;]*0\.52[^;]*proporción/i);
  });

  test("conserva el reparto horizontal y no ofrece un reparto falso entre encabezado y filas", () => {
    const pairLabels = tagsWithRole(renderGroupedBarsLayout(), "separator")
      .map((tag) => tagAttribute(tag, "aria-label"));

    expect(pairLabels).toContain(
      "Ajustar el límite entre Espacio para etiquetas y Espacio para barras"
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

  test("publica un status persistente y sólo anuncia interacción donde existe partición", () => {
    const groupedBars = renderGroupedBarsLayout();
    const boxPlot = renderLayout(
      "boxplot",
      [
        numberArg("canvas_h_header_in", "Alto del encabezado", "pulgadas", 0.7),
        numberArg("alto_por_categoria", "Alto por fila", "pulgadas", 0.48),
      ],
      { canvas_h_header_in: 0.7, alto_por_categoria: 0.48 }
    );

    for (const markup of [groupedBars, boxPlot]) {
      const statuses = tagsWithRole(markup, "status");
      expect(statuses).toHaveLength(1);
      expect({
        live: tagAttribute(statuses[0] ?? "", "aria-live"),
        atomic: tagAttribute(statuses[0] ?? "", "aria-atomic"),
        srOnly: tagAttribute(statuses[0] ?? "", "class").split(/\s+/).includes("pulso-sr-only"),
      }).toEqual({ live: "polite", atomic: "true", srOnly: true });
    }

    expect({
      groupedBarsCanvas: canvasAriaLabel(groupedBars),
      boxPlotHandles: tagsWithClass(boxPlot, "pulso-gv2-layout-handle").length,
      boxPlotSeparators: tagsWithRole(boxPlot, "separator").length,
      boxPlotAnnouncesDrag: /arrastra/i.test(canvasAriaLabel(boxPlot)),
    }).toEqual({
      groupedBarsCanvas: expect.stringMatching(/arrastra.*flechas? (?:izquierda.*derecha|derecha.*izquierda)/i),
      boxPlotHandles: 0,
      boxPlotSeparators: 0,
      boxPlotAnnouncesDrag: false,
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
