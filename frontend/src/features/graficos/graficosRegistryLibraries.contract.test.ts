import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GraficadorBlueprint,
  resolveGraficadorBlueprint,
} from "./GraficadorBlueprint";
import { canInsertGraficador } from "./GraficadorPicker";
import { slideAcceptsGraphSlot } from "./GraficosLibrariesHost";
import { normalizeGraficosRegistry } from "./metadataSanitizers";
import {
  buildSlideLibraryModel,
  isInsertableSlideType,
} from "./v2/timeline/SlidePicker";
import { CATEGORY_LABEL, categoryOf } from "./v2/timeline/categoryOf";
import {
  resolveSlidePickerBlueprint,
  SlidePickerBlueprint,
} from "./v2/timeline/SlidePickerBlueprint";

const EXPECTED_SLIDES = [
  ["p_slide_portada", "Portada", "estructural", "estructural", "cover", "Title Slide", []],
  ["p_slide_indice", "Índice", "estructural", "estructural", "index", "Indice", []],
  ["p_slide_top_two_box", "Explicación Top Two Box", "estructural", "estructural", "topTwo", "Title and Content", []],
  ["p_slide_seccion", "Separador de sección", "estructural", "estructural", "section", "Section Header", []],
  ["p_slide_objetivo_icono", "Objetivo con ícono", "estructural", "estructural", "objective", "Objetivos_Secciones", []],
  ["p_slide_texto", "Bloque de texto", "estructural", "estructural", "text", "Title and Content", []],
  ["p_slide_tabla_tecnica", "Tabla técnica", "estructural", "estructural", "technical", "Title and Content", []],
  ["p_slide_1_grafico", "Un gráfico", "1grafico", "1g", "single", "Graficos", ["grafico"]],
  ["p_slide_1_grafico_narrativo", "Un gráfico + narrativa", "1grafico", "1g", "singleNarrative", "1_Grafico_narrativo", ["grafico"]],
  ["p_slide_grafico_texto_derecha", "Gráfico + texto a la derecha", "1grafico", "1g", "splitRight", "right_grafico_texto", ["grafico"]],
  ["p_slide_grafico_texto_izquierda", "Gráfico + texto a la izquierda", "1grafico", "1g", "splitLeft", "left_grafico_texto", ["grafico"]],
  ["p_slide_2_graficos", "Dos gráficos", "2graficos", "2g", "two", "Graficos_2columnas", ["izquierda", "derecha"]],
  ["p_slide_2_graficos_narrativo", "Dos gráficos + narrativa", "2graficos", "2g", "twoNarrative", "1_Graficos_2columnas_narrativo", ["izquierda", "derecha"]],
  ["p_slide_2_graficos_texto_izquierda", "Dos gráficos + texto izquierda", "2graficos", "2g", "twoTextLeft", "left_2graficos_texto", ["grafico_1", "grafico_2"]],
  ["p_slide_2_graficos_texto_derecha", "Dos gráficos + texto derecha", "2graficos", "2g", "twoTextRight", "right_2graficos_texto", ["grafico_1", "grafico_2"]],
  ["p_slide_4_graficos", "Cuatro gráficos", "4graficos", "grid", "grid4", "4_paneles", ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"]],
  ["p_slide_2_graficos_poblacion", "Dos gráficos + ícono (población)", "poblacion", "poblacion", "population2", "poblacion_2", ["izquierda", "derecha"]],
  ["p_slide_4_graficos_poblacion", "Cuatro gráficos + ícono (población)", "poblacion", "poblacion", "population4", "poblacion_4", ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"]],
  ["p_slide_5_graficos_poblacion", "Cinco gráficos + ícono", "poblacion", "poblacion", "population5", "poblacion_5", ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2"]],
  ["p_slide_6_graficos_poblacion", "Seis gráficos + ícono", "poblacion", "poblacion", "population6", "poblacion_6", ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3"]],
] as const;

const EXPECTED_GRAFICADORES = [
  ["p_barras_agrupadas", "Barras agrupadas", "distribution", "bars-grouped"],
  ["p_barras_categoricas", "Barras categóricas", "distribution", "bars-categorical"],
  ["p_barras_apiladas", "Barras apiladas", "distribution", "bars-stacked"],
  ["p_barras_multiapiladas", "Multi-apiladas", "distribution", "bars-multi-stacked"],
  ["p_nube_palabras", "Nube de palabras", "text", "word-cloud"],
  ["p_mapa_cobertura_territorial", "Mapa de cobertura territorial", "territory", "territory-map"],
  ["p_pie", "Gráfico de torta", "distribution", "pie"],
  ["p_donut", "Gráfico de dona", "distribution", "donut"],
  ["p_numerico", "Indicador numérico", "numeric", "numeric"],
  ["p_histograma", "Histograma", "numeric", "histogram"],
  ["p_boxplot", "Box plot", "numeric", "boxplot"],
  ["p_media_rango", "Media y rango", "numeric", "mean-range"],
  ["p_radar", "Radar", "comparison", "radar"],
  ["p_tabla", "Tabla", "comparison", "table"],
  ["p_dim_radar", "Radar por dimensiones", "dimensions", "dimension-radar"],
  ["p_dim_heatmap", "Heatmap de dimensiones", "dimensions", "dimension-heatmap"],
  ["p_dim_comparativo_radarbar", "Radar + barras comparativo", "dimensions", "dimension-radar-bars"],
  ["p_dim_foda", "Matriz FODA dimensional", "dimensions", "dimension-foda"],
  ["p_dim_heatmap_criterios", "Heatmap por criterios", "dimensions", "dimension-criteria-heatmap"],
] as const;

type Fixture = {
  schema: string;
  source: { reference_project: string; sha256: string; sanitized: boolean };
  registry: unknown;
  sentinels: {
    future_slide: unknown;
    future_graficador: unknown;
  };
};

const featureDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(
  featureDir,
  "../../../../scripts/tests/fixtures/graficos-libraries-acnur-acg.v1.json",
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Fixture;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(featureDir, relativePath), "utf8");
}

function markupAttribute(markup: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`).exec(markup)?.[1];
}

function matrixRegistry() {
  return normalizeGraficosRegistry(fixture.registry);
}

function histogram(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

describe("bibliotecas gobernadas por el registry L6", () => {
  it("ancla la fixture sanitizada a acnur_acg y fija el censo versionado 20/19", () => {
    const registry = matrixRegistry();

    expect(fixture.schema).toBe("prosecnur.qa.graficos_libraries_fixture.v1");
    expect(fixture.source).toMatchObject({
      reference_project: "acnur_acg",
      sha256: "70ca67b9f5dcdbf2ad06c7144a005f48023122a57c97b152c11862412b4fde70",
      sanitized: true,
    });
    expect(registry.slides).toHaveLength(20);
    expect(registry.graficadores).toHaveLength(19);
    expect(registry.slides.map((slide) => slide.name)).toEqual(
      EXPECTED_SLIDES.map(([name]) => name),
    );
    expect(registry.graficadores.map((graf) => graf.name)).toEqual(
      EXPECTED_GRAFICADORES.map(([name]) => name),
    );
  });

  it("cubre 20/20 labels, categorías picker, blueprints, layouts y zonas declaradas", () => {
    const registry = matrixRegistry();
    const rows = registry.slides.map((slide) => {
      const model = buildSlideLibraryModel(slide);
      return [
        slide.name,
        model.title,
        slide.categoria,
        model.category,
        model.blueprint.kind,
        model.blueprint.pptLayout,
        model.blueprint.graphSlots.map((slot) => slot.name),
      ];
    });

    expect(rows).toEqual(EXPECTED_SLIDES);
    expect(histogram(rows.map((row) => String(row[3])))).toEqual({
      estructural: 7,
      "1g": 4,
      "2g": 4,
      grid: 1,
      poblacion: 4,
    });
    for (const slide of registry.slides) {
      expect(slide.slot_specs?.every((slot) => slot.label.trim().length > 0)).toBe(true);
      expect(slide.slot_specs?.every((slot) => slot.role === "chart" || slot.role === "icon")).toBe(true);
      expect(isInsertableSlideType(slide.name)).toBe(true);
    }
  });

  it("ejecuta categoryOf sobre los 20 SlideType con taxonomía y labels cerrados", () => {
    const classified = EXPECTED_SLIDES.map(([name, , , expectedCategory]) => [
      name,
      categoryOf(name),
      expectedCategory,
    ] as const);

    expect(classified.map(([name, actualCategory]) => [name, actualCategory])).toEqual(
      classified.map(([name, , expectedCategory]) => [name, expectedCategory]),
    );
    expect(histogram(classified.map(([, actualCategory]) => actualCategory))).toEqual({
      estructural: 7,
      "1g": 4,
      "2g": 4,
      grid: 1,
      poblacion: 4,
    });
    expect(CATEGORY_LABEL).toEqual({
      estructural: "Estructural",
      "1g": "1 gráfico",
      "2g": "2 gráficos",
      grid: "Grid 4",
      poblacion: "Población",
    });
    const labels = Object.values(CATEGORY_LABEL);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("cubre 19/19 labels, taxonomía y blueprints de graficadores", () => {
    const registry = matrixRegistry();
    const rows = registry.graficadores.map((graf) => [
      graf.name,
      graf.titulo_humano,
      graf.categoria,
      resolveGraficadorBlueprint(graf.blueprint),
    ]);

    expect(rows).toEqual(EXPECTED_GRAFICADORES);
    expect(histogram(rows.map((row) => String(row[2])))).toEqual({
      distribution: 6,
      text: 1,
      territory: 1,
      numeric: 4,
      comparison: 2,
      dimensions: 5,
    });
    expect(registry.graficadores.every((graf) => graf.titulo_humano.trim().length > 0)).toBe(true);
  });

  it("mantiene card y hero alineados en los 20 + 19 blueprints", () => {
    const registry = matrixRegistry();

    registry.slides.forEach((slide, index) => {
      const expected = EXPECTED_SLIDES[index];
      const resolved = resolveSlidePickerBlueprint(slide);
      const card = renderToStaticMarkup(createElement(SlidePickerBlueprint, {
        blueprint: resolved,
        iconoUi: slide.icono_ui,
        size: "card",
      }));
      const hero = renderToStaticMarkup(createElement(SlidePickerBlueprint, {
        blueprint: resolved,
        iconoUi: slide.icono_ui,
        size: "hero",
      }));
      expect(markupAttribute(card, "data-layout")).toBe(expected[4]);
      expect(markupAttribute(hero, "data-layout")).toBe(expected[4]);
      expect(markupAttribute(card, "data-ppt-layout")).toBe(expected[5]);
      expect(markupAttribute(hero, "data-ppt-layout")).toBe(expected[5]);
    });

    registry.graficadores.forEach((graf, index) => {
      const expected = EXPECTED_GRAFICADORES[index][3];
      const card = renderToStaticMarkup(createElement(GraficadorBlueprint, {
        blueprint: graf.blueprint,
        variant: "card",
      }));
      const hero = renderToStaticMarkup(createElement(GraficadorBlueprint, {
        blueprint: graf.blueprint,
        variant: "hero",
      }));
      expect(markupAttribute(card, "data-blueprint")).toBe(expected);
      expect(markupAttribute(hero, "data-blueprint")).toBe(expected);
    });
  });

  it("da precedencia cerrada a slot_specs y usa slots sólo para backend viejo", () => {
    const [legacy, explicit, unknownRole] = normalizeGraficosRegistry({
      slides: [
        {
          name: "p_slide_1_grafico",
          titulo_humano: "Legacy",
          categoria: "1grafico",
          slots: ["grafico"],
          args: [],
          args_extra: [],
        },
        {
          name: "p_slide_1_grafico",
          titulo_humano: "Explícito",
          categoria: "1grafico",
          slot_specs: [],
          slots: ["grafico"],
          args: [],
          args_extra: [],
        },
        {
          name: "p_slide_futuro",
          titulo_humano: "Roles",
          categoria: "otro",
          slot_specs: [
            { name: "grafico", role: "video", label: "Video" },
            { name: "icono", role: "icon", label: "Ícono" },
            { name: "chart", role: "chart", label: "Gráfico" },
          ],
          slots: ["grafico", "icono", "chart"],
          args: [],
          args_extra: [],
        },
      ],
      graficadores: [],
    }).slides;

    expect(resolveSlidePickerBlueprint(legacy).graphSlots.map((slot) => slot.name)).toEqual(["grafico"]);
    expect(resolveSlidePickerBlueprint(explicit).graphSlots).toEqual([]);
    expect(resolveSlidePickerBlueprint(unknownRole).graphSlots.map((slot) => slot.name)).toEqual(["chart"]);
    expect(slideAcceptsGraphSlot(undefined, "grafico")).toBe(false);
    expect(slideAcceptsGraphSlot(legacy, "grafico")).toBe(true);
    expect(slideAcceptsGraphSlot(explicit, "grafico")).toBe(false);
    expect(slideAcceptsGraphSlot(unknownRole, "grafico")).toBe(false);
    expect(slideAcceptsGraphSlot(unknownRole, "icono")).toBe(false);
    expect(slideAcceptsGraphSlot(unknownRole, "chart")).toBe(true);
  });

  it("usa sentinels: slide futuro sólo revisable y graficador futuro insertable", () => {
    const registry = normalizeGraficosRegistry({
      slides: [fixture.sentinels.future_slide],
      graficadores: [fixture.sentinels.future_graficador],
    });
    const futureSlide = buildSlideLibraryModel(registry.slides[0]);
    const futureGraf = registry.graficadores[0];

    expect(futureSlide).toMatchObject({
      category: "otro",
      insertableType: null,
      blueprint: { kind: "neutral" },
    });
    expect(futureSlide.compatibilityReason).toMatch(/versión más reciente/);
    expect(isInsertableSlideType(futureSlide.metadata.name)).toBe(false);
    expect(futureGraf).toMatchObject({ categoria: "other", blueprint: "future" });
    expect(canInsertGraficador(futureGraf, false)).toBe(true);
  });

  it("no conserva catálogos ni resolvers basados en el nombre dentro de las bibliotecas", () => {
    const slidePicker = read("v2/timeline/SlidePicker.tsx");
    const slideBlueprint = read("v2/timeline/SlidePickerBlueprint.tsx");
    const grafPicker = read("GraficadorPicker.tsx");
    const grafBlueprint = read("GraficadorBlueprint.tsx");
    const host = read("GraficosLibrariesHost.tsx");

    expect(slidePicker).not.toMatch(/CANONICAL_TYPES|categoryOf|slidesById|availableTypes/);
    expect(slideBlueprint).not.toMatch(/p_slide_|fallbackSlots|const BLUEPRINTS|typeName|tipo=/);
    expect(grafPicker).not.toMatch(/graficadorFamily|switch\s*\(graf\.name\)/);
    expect(grafBlueprint).not.toMatch(/case\s+["']p_|\.includes\(["']p_/);
    expect(host).not.toContain("SLIDE_GRAF_SLOTS");
  });
});
