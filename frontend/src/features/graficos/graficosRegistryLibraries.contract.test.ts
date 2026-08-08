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
import {
  canInsertGraficador,
} from "./GraficadorPicker";
import {
  slideAcceptsGraphSlot,
} from "./GraficosLibrariesHost";
import { normalizeGraficosRegistry } from "./metadataSanitizers";
import {
  buildSlideLibraryModel,
  isInsertableSlideType,
} from "./v2/timeline/SlidePicker";
import {
  resolveSlidePickerBlueprint,
  SlidePickerBlueprint,
} from "./v2/timeline/SlidePickerBlueprint";

const SLIDE_MATRIX = [
  { name: "p_slide_portada", categoria: "estructural", kind: "cover", slots: [] },
  { name: "p_slide_indice", categoria: "estructural", kind: "index", slots: [] },
  { name: "p_slide_top_two_box", categoria: "estructural", kind: "topTwo", slots: [] },
  { name: "p_slide_seccion", categoria: "estructural", kind: "section", slots: [] },
  { name: "p_slide_objetivo_icono", categoria: "estructural", kind: "objective", slots: [["icono", "icon"]] },
  { name: "p_slide_texto", categoria: "estructural", kind: "text", slots: [] },
  { name: "p_slide_tabla_tecnica", categoria: "estructural", kind: "technical", slots: [] },
  { name: "p_slide_1_grafico", categoria: "1grafico", kind: "single", slots: [["grafico", "chart"]] },
  { name: "p_slide_1_grafico_narrativo", categoria: "1grafico", kind: "singleNarrative", slots: [["grafico", "chart"]] },
  { name: "p_slide_grafico_texto_derecha", categoria: "1grafico", kind: "splitRight", slots: [["grafico", "chart"]] },
  { name: "p_slide_grafico_texto_izquierda", categoria: "1grafico", kind: "splitLeft", slots: [["grafico", "chart"]] },
  { name: "p_slide_2_graficos", categoria: "2graficos", kind: "two", slots: [["izquierda", "chart"], ["derecha", "chart"]] },
  { name: "p_slide_2_graficos_narrativo", categoria: "2graficos", kind: "twoNarrative", slots: [["izquierda", "chart"], ["derecha", "chart"]] },
  { name: "p_slide_2_graficos_texto_izquierda", categoria: "2graficos", kind: "twoTextLeft", slots: [["grafico_1", "chart"], ["grafico_2", "chart"]] },
  { name: "p_slide_2_graficos_texto_derecha", categoria: "2graficos", kind: "twoTextRight", slots: [["grafico_1", "chart"], ["grafico_2", "chart"]] },
  { name: "p_slide_4_graficos", categoria: "4graficos", kind: "grid4", slots: [["a", "chart"], ["b", "chart"], ["c", "chart"], ["d", "chart"]] },
  { name: "p_slide_2_graficos_poblacion", categoria: "poblacion", kind: "population2", slots: [["a", "chart"], ["b", "chart"], ["icono", "icon"]] },
  { name: "p_slide_4_graficos_poblacion", categoria: "poblacion", kind: "population4", slots: [["a", "chart"], ["b", "chart"], ["c", "chart"], ["d", "chart"], ["icono", "icon"]] },
  { name: "p_slide_5_graficos_poblacion", categoria: "poblacion", kind: "population5", slots: [["a", "chart"], ["b", "chart"], ["c", "chart"], ["d", "chart"], ["e", "chart"], ["icono", "icon"]] },
  { name: "p_slide_6_graficos_poblacion", categoria: "poblacion", kind: "population6", slots: [["a", "chart"], ["b", "chart"], ["c", "chart"], ["d", "chart"], ["e", "chart"], ["f", "chart"], ["icono", "icon"]] },
] as const;

const GRAFICADOR_MATRIX = [
  ["p_barras_agrupadas", "distribution", "bars-grouped"],
  ["p_barras_categoricas", "distribution", "bars-categorical"],
  ["p_barras_apiladas", "distribution", "bars-stacked"],
  ["p_barras_multiapiladas", "distribution", "bars-multi-stacked"],
  ["p_nube_palabras", "text", "word-cloud"],
  ["p_mapa_cobertura_territorial", "territory", "territory-map"],
  ["p_pie", "distribution", "pie"],
  ["p_donut", "distribution", "donut"],
  ["p_numerico", "numeric", "numeric"],
  ["p_histograma", "numeric", "histogram"],
  ["p_boxplot", "numeric", "boxplot"],
  ["p_media_rango", "numeric", "mean-range"],
  ["p_radar", "comparison", "radar"],
  ["p_tabla", "comparison", "table"],
  ["p_dim_radar", "dimensions", "dimension-radar"],
  ["p_dim_heatmap", "dimensions", "dimension-heatmap"],
  ["p_dim_comparativo_radarbar", "dimensions", "dimension-radar-bars"],
  ["p_dim_foda", "dimensions", "dimension-foda"],
  ["p_dim_heatmap_criterios", "dimensions", "dimension-criteria-heatmap"],
] as const;

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return fs.readFileSync(path.join(featureDir, relativePath), "utf8");
}

function markupAttribute(markup: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`).exec(markup)?.[1];
}

function matrixRegistry() {
  return normalizeGraficosRegistry({
    slides: SLIDE_MATRIX.map((entry) => ({
      name: entry.name,
      titulo_humano: entry.name,
      descripcion: "Modelo",
      icono_ui: "FileText",
      categoria: entry.categoria,
      blueprint: {
        kind: entry.kind,
        ppt_layout: `layout:${entry.kind}`,
        structure_label: `estructura:${entry.kind}`,
      },
      slot_specs: entry.slots.map(([name, role]) => ({ name, role, label: name })),
      slots: entry.slots.map(([name]) => name),
      args: [],
      args_extra: [],
    })),
    graficadores: GRAFICADOR_MATRIX.map(([name, categoria, blueprint]) => ({
      name,
      titulo_humano: name,
      descripcion: "Modelo",
      icono_ui: "BarChart",
      categoria,
      blueprint,
      args: [],
      args_extra: [],
    })),
  });
}

describe("bibliotecas gobernadas por el registry L4", () => {
  it("conserva el orden y la matriz runtime completa 20/19", () => {
    const registry = matrixRegistry();

    expect(registry.slides).toHaveLength(20);
    expect(registry.graficadores).toHaveLength(19);
    expect(registry.slides.map((slide) => slide.name)).toEqual(
      SLIDE_MATRIX.map((entry) => entry.name),
    );
    expect(registry.graficadores.map((graf) => graf.name)).toEqual(
      GRAFICADOR_MATRIX.map(([name]) => name),
    );
    expect(registry.slides.map((slide) => resolveSlidePickerBlueprint(slide).kind)).toEqual(
      SLIDE_MATRIX.map((entry) => entry.kind),
    );
    expect(registry.graficadores.map((graf) => resolveGraficadorBlueprint(graf.blueprint))).toEqual(
      GRAFICADOR_MATRIX.map(([, , blueprint]) => blueprint),
    );
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

  it("mantiene conocido-viejo insertable, slide futuro sólo revisable y graficador futuro insertable", () => {
    const registry = normalizeGraficosRegistry({
      slides: [
        {
          name: "p_slide_1_grafico",
          titulo_humano: "Conocido viejo",
          categoria: "1grafico",
          slots: ["grafico"],
          args: [],
          args_extra: [],
        },
        {
          name: "p_slide_realidad_aumentada",
          titulo_humano: "Futuro",
          categoria: "experimental",
          blueprint: { kind: "immersive" },
          slot_specs: [{ name: "escena", role: "video", label: "Escena" }],
          slots: ["escena"],
          args: [],
          args_extra: [],
        },
      ],
      graficadores: [{
        name: "p_holograma",
        titulo_humano: "Holograma",
        categoria: "experimental",
        blueprint: "hologram",
        available: true,
        args: [],
        args_extra: [],
      }],
    });

    const oldKnown = buildSlideLibraryModel(registry.slides[0]);
    const future = buildSlideLibraryModel(registry.slides[1]);
    expect(oldKnown.blueprint.kind).toBe("neutral");
    expect(oldKnown.insertableType).toBe("p_slide_1_grafico");
    expect(isInsertableSlideType(registry.slides[0].name)).toBe(true);
    expect(future.blueprint.kind).toBe("neutral");
    expect(future.insertableType).toBeNull();
    expect(future.compatibilityReason).toMatch(/versión más reciente/);
    expect(isInsertableSlideType(registry.slides[1].name)).toBe(false);

    const futureGraf = registry.graficadores[0];
    expect(futureGraf).toMatchObject({ categoria: "other", blueprint: "future" });
    expect(canInsertGraficador(futureGraf, false)).toBe(true);
  });

  it("card y hero pintan el mismo kind resuelto, sin prometer geometría PPT exacta", () => {
    const registry = matrixRegistry();
    const slide = registry.slides.find((item) => item.name === "p_slide_4_graficos");
    const graf = registry.graficadores.find((item) => item.name === "p_dim_foda");
    expect(slide).toBeDefined();
    expect(graf).toBeDefined();
    if (!slide || !graf) throw new Error("La matriz 20/19 quedó incompleta");

    const resolved = resolveSlidePickerBlueprint(slide);
    const slideCard = renderToStaticMarkup(createElement(SlidePickerBlueprint, {
      blueprint: resolved,
      iconoUi: slide.icono_ui,
      size: "card",
    }));
    const slideHero = renderToStaticMarkup(createElement(SlidePickerBlueprint, {
      blueprint: resolved,
      iconoUi: slide.icono_ui,
      size: "hero",
    }));
    expect(markupAttribute(slideCard, "data-layout")).toBe("grid4");
    expect(markupAttribute(slideHero, "data-layout")).toBe("grid4");
    expect(markupAttribute(slideCard, "data-ppt-layout")).toBe("layout:grid4");
    expect(markupAttribute(slideHero, "data-ppt-layout")).toBe("layout:grid4");

    const graphCard = renderToStaticMarkup(createElement(GraficadorBlueprint, {
      blueprint: graf.blueprint,
      variant: "card",
    }));
    const graphHero = renderToStaticMarkup(createElement(GraficadorBlueprint, {
      blueprint: graf.blueprint,
      variant: "hero",
    }));
    expect(markupAttribute(graphCard, "data-blueprint")).toBe("dimension-foda");
    expect(markupAttribute(graphHero, "data-blueprint")).toBe("dimension-foda");
  });

  it("no conserva catálogos, taxonomías ni resolvers basados en el nombre dentro de las bibliotecas", () => {
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
