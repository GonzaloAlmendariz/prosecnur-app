import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canInsertGraficador,
  graficadorAvailabilityLabel,
} from "./GraficadorPicker";
import { resolveGraficadorBlueprint } from "./GraficadorBlueprint";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { resolveGraphLucideIcon } from "./lucideRegistry";
import { normalizeGraficosRegistry } from "./metadataSanitizers";
import { chartDataPreflightIssue } from "./slidePreviewModel";

const featureDir = path.dirname(fileURLToPath(import.meta.url));
const historicalFixturePath = path.resolve(
  featureDir,
  "../../../../scripts/tests/fixtures/graficos-libraries-acnur-acg.v1.json",
);
const historicalFixture = JSON.parse(fs.readFileSync(historicalFixturePath, "utf8")) as {
  registry: { slides: unknown[]; graficadores: Array<Record<string, unknown>> };
};

const EXPANSION_GRAFICADORES = [
  {
    name: "p_barras_divergentes",
    titulo_humano: "Barras divergentes",
    descripcion: "Escala Likert centrada en cero.",
    icono_ui: "AlignHorizontalJustifyCenter",
    categoria: "distribution",
    blueprint: "bars-diverging",
    capability_key: "",
    requirement_label: "Selecciona una o varias variables de la base activa.",
    authoring_mode: "direct",
    data_requirement: "var_or_vars",
    preset_key: "barras_divergentes",
    args: [],
    args_extra: [],
  },
  {
    name: "p_puntos_comparativos",
    titulo_humano: "Puntos comparativos",
    descripcion: "Compara un indicador explicito entre grupos de una base.",
    icono_ui: "CircleDot",
    categoria: "comparison",
    blueprint: "comparison-dots",
    capability_key: "",
    requirement_label: "Selecciona indicador, agrupacion y codigos objetivo.",
    authoring_mode: "direct",
    data_requirement: "var_cruces_corte",
    preset_key: "puntos_comparativos",
    args: [],
    args_extra: [],
  },
  {
    name: "p_dumbbell",
    titulo_humano: "Brecha entre dos bases",
    descripcion: "Compara exactamente dos bases equivalentes.",
    icono_ui: "MoveHorizontal",
    categoria: "comparison",
    blueprint: "dumbbell",
    capability_key: "equivalences_exactly_two",
    requirement_label: "Requiere un plan compatible que ya declare equivalencias entre exactamente dos bases; esta biblioteca aún no puede crearlo.",
    authoring_mode: "generated",
    data_requirement: "named_vars",
    preset_key: "dumbbell",
    args: [],
    args_extra: [],
  },
  {
    name: "p_lollipop",
    titulo_humano: "Ranking (lollipop)",
    descripcion: "Ranking compacto de categorías.",
    icono_ui: "ListOrdered",
    categoria: "distribution",
    blueprint: "lollipop",
    capability_key: "",
    requirement_label: "Selecciona una o varias variables de la base activa.",
    authoring_mode: "direct",
    data_requirement: "var_or_vars",
    preset_key: "lollipop",
    args: [],
    args_extra: [],
  },
  {
    name: "p_serie_temporal",
    titulo_humano: "Serie temporal",
    descripcion: "Evolución entre olas equivalentes.",
    icono_ui: "TrendingUp",
    categoria: "comparison",
    blueprint: "line-series",
    capability_key: "equivalences_temporal",
    requirement_label: "Requiere un plan compatible que ya declare equivalencias entre bases ordenadas por momento; esta biblioteca aún no puede crearlo.",
    authoring_mode: "generated",
    data_requirement: "named_vars",
    preset_key: "serie_temporal",
    args: [],
    args_extra: [],
  },
] as const;

function successorRegistryInput() {
  const legacy = historicalFixture.registry.graficadores;
  const comparisonStart = legacy.findIndex((graf) => graf.name === "p_radar");
  return {
    slides: historicalFixture.registry.slides,
    graficadores: [
      ...legacy.slice(0, comparisonStart),
      ...EXPANSION_GRAFICADORES,
      ...legacy.slice(comparisonStart),
    ],
  };
}

describe("contrato sucesor del registry de Gráficos", () => {
  it("canaliza el registry Lucide exclusivamente por el shim local", () => {
    const registrySource = fs.readFileSync(path.join(featureDir, "lucideRegistry.ts"), "utf8");
    const shimSource = fs.readFileSync(
      path.resolve(featureDir, "../../vendor/lucide-react.ts"),
      "utf8",
    );
    const lucideImportSources = Array.from(
      registrySource.matchAll(/from\s+["']([^"']*lucide-react[^"']*)["']/g),
      (match) => match[1],
    );

    expect(lucideImportSources).toEqual(["../../vendor/lucide-react"]);
    for (const [iconName, moduleName] of [
      ["AlignHorizontalJustifyCenter", "align-horizontal-justify-center"],
      ["ChartColumn", "chart-column"],
      ["ChartColumnStacked", "chart-column-stacked"],
      ["CircleDot", "circle-dot"],
      ["TrendingUp", "trending-up"],
    ] as const) {
      expect(shimSource).toContain(
        `export { default as ${iconName} } from "lucide-react/dist/esm/icons/${moduleName}.mjs";`,
      );
    }
  });

  it("mantiene las 20 láminas históricas y eleva el censo a 24 graficadores", () => {
    const registry = normalizeGraficosRegistry(successorRegistryInput());

    expect(registry.slides).toHaveLength(20);
    expect(registry.graficadores).toHaveLength(24);
    expect(registry.graficadores.map((graf) => graf.name)).toEqual([
      "p_barras_agrupadas",
      "p_barras_categoricas",
      "p_barras_apiladas",
      "p_barras_multiapiladas",
      "p_nube_palabras",
      "p_mapa_cobertura_territorial",
      "p_pie",
      "p_donut",
      "p_numerico",
      "p_histograma",
      "p_boxplot",
      "p_media_rango",
      "p_barras_divergentes",
      "p_puntos_comparativos",
      "p_dumbbell",
      "p_lollipop",
      "p_serie_temporal",
      "p_radar",
      "p_tabla",
      "p_dim_radar",
      "p_dim_heatmap",
      "p_dim_comparativo_radarbar",
      "p_dim_foda",
      "p_dim_heatmap_criterios",
    ]);
    expect(registry.graficadores.every((graf) => (
      graf.capability_key !== undefined
      && graf.requirement_label !== undefined
      && graf.authoring_mode !== undefined
      && graf.data_requirement !== undefined
    ))).toBe(true);
  });

  it("normaliza las cinco altas con blueprint, preset e icono reales", () => {
    const registry = normalizeGraficosRegistry(successorRegistryInput());
    const additions = registry.graficadores.filter((graf) => (
      EXPANSION_GRAFICADORES.some((expected) => expected.name === graf.name)
    ));

    expect(additions.map((graf) => [
      graf.name,
      resolveGraficadorBlueprint(graf.blueprint),
      graficadorToPresetType(graf.name, graf.preset_key),
      graf.authoring_mode,
      graf.data_requirement,
    ])).toEqual([
      ["p_barras_divergentes", "bars-diverging", "barras_divergentes", "direct", "var_or_vars"],
      ["p_puntos_comparativos", "comparison-dots", "puntos_comparativos", "direct", "var_cruces_corte"],
      ["p_dumbbell", "dumbbell", "dumbbell", "generated", "named_vars"],
      ["p_lollipop", "lollipop", "lollipop", "direct", "var_or_vars"],
      ["p_serie_temporal", "line-series", "serie_temporal", "generated", "named_vars"],
    ]);
    for (const graf of additions) {
      expect(resolveGraphLucideIcon(graf.icono_ui, "Square")).not.toBe(
        resolveGraphLucideIcon("Square", "Square"),
      );
    }
  });

  it("mantiene visibles los generados pero cierra la inserción genérica con copy honesto", () => {
    const registry = normalizeGraficosRegistry(successorRegistryInput());
    const dumbbell = registry.graficadores.find((graf) => graf.name === "p_dumbbell");
    const temporal = registry.graficadores.find((graf) => graf.name === "p_serie_temporal");
    expect(dumbbell).toBeDefined();
    expect(temporal).toBeDefined();
    if (!dumbbell || !temporal) return;

    for (const graf of [dumbbell, temporal]) {
      expect(canInsertGraficador(graf, true)).toBe(false);
      expect(graficadorAvailabilityLabel(graf, true)).toBe("Requiere plan compatible");
      expect(graficadorAvailabilityLabel(graf, true)).not.toBe("Listo para insertar");
      expect(chartDataPreflightIssue({ vars: { Tema: ["a$p1", "b$p1"] } }, graf)).toBeNull();
      expect(chartDataPreflightIssue({}, graf)).toMatch(/plan.*equivalencias nombradas/i);
      expect(chartDataPreflightIssue({}, graf)).toMatch(/biblioteca.*no puede completarlas/i);
      expect(chartDataPreflightIssue({}, graf)).not.toMatch(/Datos|variable principal/i);
    }
  });

  it("resuelve dimensiones y territorio legacy sin exigir variable principal", () => {
    const registry = normalizeGraficosRegistry(successorRegistryInput());
    const dimensions = registry.graficadores.find((graf) => graf.name === "p_dim_radar");
    const territory = registry.graficadores.find(
      (graf) => graf.name === "p_mapa_cobertura_territorial",
    );
    expect(dimensions).toBeDefined();
    expect(territory).toBeDefined();
    if (!dimensions || !territory) return;

    expect(canInsertGraficador(dimensions, false)).toBe(false);
    expect(canInsertGraficador(dimensions, true)).toBe(true);
    expect(chartDataPreflightIssue({}, dimensions)).toBeNull();
    expect(canInsertGraficador(territory, false)).toBe(territory.available !== false);
    expect(chartDataPreflightIssue({}, territory)).toBeNull();
  });

  it("preserva sentinels desconocidos y falla cerrado aunque haya var", () => {
    const [future] = normalizeGraficosRegistry({
      slides: [],
      graficadores: [{
        name: "p_futuro",
        titulo_humano: "Futuro",
        icono_ui: "Square",
        capability_key: "hologram",
        authoring_mode: "automatico",
        data_requirement: "stream",
        requirement_label: "Necesita una capacidad futura.",
        args: [],
        args_extra: [],
      }],
    }).graficadores;

    expect(future).toMatchObject({
      capability_key: "unknown",
      authoring_mode: "unknown",
      data_requirement: "unknown",
      requirement_label: "Necesita una capacidad futura.",
    });
    expect(canInsertGraficador(future, true)).toBe(false);
    expect(chartDataPreflightIssue({ var: "base$p1" }, future)).toBe(
      "Necesita una capacidad futura.",
    );
  });

  it("prioriza el requisito exacto del registry en los modelos generados", () => {
    const pickerSource = fs.readFileSync(path.join(featureDir, "GraficadorPicker.tsx"), "utf8");
    const assignmentStart = pickerSource.indexOf("const contractReason =");
    const assignmentEnd = pickerSource.indexOf(";", assignmentStart);
    const assignment = pickerSource.slice(assignmentStart, assignmentEnd + 1);
    const exactLabel = assignment.indexOf("contract.requirementLabel");
    const genericFallback = assignment.indexOf("GENERATED_PLAN_REQUIRED_DETAIL");

    expect(exactLabel, "El inspector debe leer requirement_label").toBeGreaterThan(-1);
    expect(genericFallback, "Debe existir un fallback cuando el registry no aporta copy").toBeGreaterThan(-1);
    expect(
      exactLabel,
      "requirement_label debe preceder al detalle genérico para Brecha y Serie temporal",
    ).toBeLessThan(genericFallback);
  });

  it("conserva el requisito exacto además del guidance en modo consulta directo", () => {
    const pickerSource = fs.readFileSync(path.join(featureDir, "GraficadorPicker.tsx"), "utf8");
    const consultationStart = pickerSource.indexOf("{consultationReason && !generated && (");
    const consultationEnd = pickerSource.indexOf(
      '<section className="pulso-graficador-library-inspector-section"',
      consultationStart,
    );
    const consultationBlock = pickerSource.slice(consultationStart, consultationEnd);

    expect(consultationStart).toBeGreaterThan(-1);
    expect(consultationEnd).toBeGreaterThan(consultationStart);
    expect(
      consultationBlock,
      "El modo consulta debe explicar el requisito propio del modelo",
    ).toMatch(/\{(?:contractReason|contract\.requirementLabel)\}/);
    expect(consultationBlock).toContain("{consultationReason}");
  });

  it("mantiene el CTA semánticamente deshabilitado y enlaza preview al metadata real", () => {
    const pickerSource = fs.readFileSync(path.join(featureDir, "GraficadorPicker.tsx"), "utf8");
    const previewSource = fs.readFileSync(path.join(featureDir, "SlidePreview.tsx"), "utf8");
    const formSource = fs.readFileSync(path.join(featureDir, "GraficadorForm.tsx"), "utf8");
    const slotSource = fs.readFileSync(path.join(featureDir, "GraficadorSlot.tsx"), "utf8");
    const styleSource = fs.readFileSync(
      path.join(featureDir, "v2/inspector/StylePanel.tsx"),
      "utf8",
    );

    expect(pickerSource).toContain("disabled={!canInsert}");
    expect(pickerSource).toContain('comparison: { label: "Comparación", hint: "Grupos, series y tablas", Icon: Radar },');
    expect(pickerSource).toContain("Requiere plan compatible");
    expect(pickerSource).toContain("Inserción no disponible aquí");
    expect(pickerSource).not.toMatch(
      /Se genera desde equivalencias|Añádelo desde la matriz|Abre la matriz/,
    );
    expect(previewSource).toContain("graficadoresById[v.graficador]");
    expect(previewSource).toContain("metadata?.preset_key");
    expect(previewSource).not.toMatch(/p_dumbbell|p_serie_temporal/);
    expect(formSource).toContain("graficadorToPresetType(graf.graficador, meta?.preset_key)");
    expect(slotSource).toContain("presetKey={meta?.preset_key}");
    expect(slotSource).toContain("graficadorToPresetType(value.graficador, presetKey)");
    expect(styleSource).toMatch(
      /graficadorToPresetType\(\s*graf,\s*graficadoresById\[graf\]\?\.preset_key,\s*\)/,
    );
    expect(graficadorToPresetType("p_barras_agrupadas", "")).toBeNull();
    expect(graficadorToPresetType("p_barras_agrupadas", "histograma")).toBe("histograma");
  });
});
