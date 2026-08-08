import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  GraficosSlideLayoutMatrix,
  GraficosSlideLayoutMatrixSlide,
  GraficosSlideLayoutRegion,
  SlideMetadata,
} from "../../api/client";
import { normalizeGraficosRegistry } from "./metadataSanitizers";
import {
  resolveSlideComposition,
  resolveSlideCompositionMap,
  slideCompositionRegionSignature,
} from "./slideCompositionModel";

type RegistryFixture = {
  registry: unknown;
};

const featureDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(
  featureDir,
  "../../../../scripts/tests/fixtures/graficos-libraries-acnur-acg.v1.json",
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as RegistryFixture;
const metadata = normalizeGraficosRegistry(fixture.registry).slides.map((slide) => ({
  ...slide,
  render_key: `fixture_${slide.name}`,
}));

function slotRegion(
  slide: SlideMetadata,
  slotIndex: number,
): GraficosSlideLayoutRegion {
  const slot = slide.slot_specs?.[slotIndex];
  if (!slot) throw new Error(`Fixture sin slot ${slotIndex} para ${slide.name}`);
  const count = slide.slot_specs?.length || 1;
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const column = slotIndex % columns;
  const row = Math.floor(slotIndex / columns);
  const width = 0.72 / columns;
  const height = 0.52 / rows;
  return {
    key: slot.name,
    payload_key: slot.name,
    role: slot.role,
    visible: true,
    rect: {
      x: 0.14 + column * width,
      y: 0.25 + row * height,
      width,
      height,
    },
    geometry_source: "fixture_effective",
  };
}

function matrixSlide(slide: SlideMetadata): GraficosSlideLayoutMatrixSlide {
  const slotRegions = (slide.slot_specs ?? []).map((_, index) => slotRegion(slide, index));
  return {
    tipo: slide.name,
    render_key: slide.render_key,
    layout: slide.blueprint?.ppt_layout ?? "",
    regions: [
      {
        key: "titulo",
        payload_key: "titulo",
        role: "text",
        visible: true,
        rect: { x: 0.08, y: 0.08, width: 0.66, height: 0.09 },
        geometry_source: "fixture_effective",
      },
      ...slotRegions,
      {
        key: "referencia_oculta",
        payload_key: "fecha",
        role: "text",
        visible: false,
        rect: { x: 0, y: 0, width: 0, height: 0 },
        geometry_source: "fixture_hidden",
      },
    ],
    diagnostics: [],
  };
}

function exhaustiveMatrix(): GraficosSlideLayoutMatrix {
  return {
    schema: "graficos.slide_layout_matrix/v2",
    contract_version: 2,
    template: {
      id: "fixture-16-9",
      fingerprint: "sha256:fixture-matrix",
      identity_source: "template_id",
    },
    canvas: { width: 13.333, height: 7.5, aspect_ratio: 16 / 9 },
    slides: metadata.map(matrixSlide),
  };
}

function mutableMatrix(): GraficosSlideLayoutMatrix {
  return structuredClone(exhaustiveMatrix());
}

function requireSlide(
  matrix: GraficosSlideLayoutMatrix,
  tipo: string,
): GraficosSlideLayoutMatrixSlide {
  const slide = matrix.slides.find((candidate) => candidate.tipo === tipo);
  if (!slide) throw new Error(`Matriz sin ${tipo}`);
  return slide;
}

function requireMetadata(tipo: string): SlideMetadata {
  const slide = metadata.find((candidate) => candidate.name === tipo);
  if (!slide) throw new Error(`Registry sin ${tipo}`);
  return slide;
}

describe("slide composition matrix v2", () => {
  it("resuelve 20/20 composiciones de la fixture exhaustiva sin fallback", () => {
    const matrix = exhaustiveMatrix();
    const resolutions = resolveSlideCompositionMap(metadata, matrix);

    expect(metadata).toHaveLength(20);
    expect(matrix.slides).toHaveLength(20);
    expect(Object.keys(resolutions)).toHaveLength(20);
    expect(Object.values(resolutions).every((resolution) => resolution.status === "ready")).toBe(true);
    for (const slide of metadata) {
      const resolution = resolutions[slide.name];
      expect(resolution?.status).toBe("ready");
      if (resolution?.status !== "ready") continue;
      expect(resolution.composition).toMatchObject({
        tipo: slide.name,
        layout: slide.blueprint?.ppt_layout,
        kind: slide.blueprint?.kind,
        contractVersion: 2,
      });
      expect(resolution.composition.regions).toBe(
        requireSlide(matrix, slide.name).regions,
      );
      expect(slideCompositionRegionSignature(resolution.composition)).toContain(
        "geometry_source",
      );
    }
  });

  it("falla cerrado si cambia ppt_layout aunque kind permanezca igual", () => {
    const matrix = mutableMatrix();
    const slide = requireMetadata("p_slide_2_graficos");
    const effective = requireSlide(matrix, slide.name);
    const kindBefore = slide.blueprint?.kind;
    effective.layout = "Layout_mutante_con_mismo_kind";

    const resolution = resolveSlideComposition(slide, effective, matrix);

    expect(slide.blueprint?.kind).toBe(kindBefore);
    expect(resolution).toMatchObject({
      status: "fallback",
      diagnostic: { code: "layout_mismatch" },
    });
  });

  it("rechaza render_key ausente, divergente y key de región duplicada", () => {
    const missingRender = mutableMatrix();
    const metadataSlide = requireMetadata("p_slide_1_grafico");
    const missingRenderSlide = requireSlide(missingRender, metadataSlide.name);
    missingRenderSlide.render_key = "";
    expect(resolveSlideComposition(metadataSlide, missingRenderSlide, missingRender)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "render_key_missing" },
    });

    const mismatchedRender = mutableMatrix();
    const mismatchedRenderSlide = requireSlide(mismatchedRender, metadataSlide.name);
    mismatchedRenderSlide.render_key = "otro_render_key";
    expect(resolveSlideComposition(
      metadataSlide,
      mismatchedRenderSlide,
      mismatchedRender,
    )).toMatchObject({
      status: "fallback",
      diagnostic: { code: "render_key_mismatch" },
    });

    const missingMetadataRender = { ...metadataSlide, render_key: "" };
    const completeMatrix = mutableMatrix();
    const effective = requireSlide(completeMatrix, metadataSlide.name);
    expect(resolveSlideComposition(
      missingMetadataRender,
      effective,
      completeMatrix,
    )).toMatchObject({
      status: "fallback",
      diagnostic: { code: "metadata_render_key_missing" },
    });

    const duplicateKey = mutableMatrix();
    const duplicateSlide = requireSlide(duplicateKey, metadataSlide.name);
    duplicateSlide.regions[1].key = duplicateSlide.regions[0].key;
    expect(resolveSlideComposition(metadataSlide, duplicateSlide, duplicateKey)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "region_key_duplicate" },
    });
  });

  it("rechaza identity_source fuera del contrato cerrado", () => {
    const matrix = mutableMatrix();
    matrix.template.identity_source = "explicit_fixture" as GraficosSlideLayoutMatrix["template"]["identity_source"];
    const slide = requireMetadata("p_slide_1_grafico");

    expect(resolveSlideComposition(slide, requireSlide(matrix, slide.name), matrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "matrix_contract_invalid" },
    });
  });

  it("rechaza template.id vacío antes de consumir regiones", () => {
    const matrix = mutableMatrix();
    matrix.template.id = "  ";
    const slide = requireMetadata("p_slide_1_grafico");

    expect(resolveSlideComposition(slide, requireSlide(matrix, slide.name), matrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "matrix_contract_invalid" },
    });
  });

  it("rechaza mutantes de role/payload_key para icono sin traducir icon", () => {
    const slide = requireMetadata("p_slide_2_graficos_poblacion");

    const wrongRole = mutableMatrix();
    const wrongRoleSlide = requireSlide(wrongRole, slide.name);
    const iconRegion = wrongRoleSlide.regions.find((region) => region.payload_key === "icono");
    if (!iconRegion) throw new Error("Fixture sin icono");
    iconRegion.role = "chart";
    expect(resolveSlideComposition(slide, wrongRoleSlide, wrongRole)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "slot_contract_mismatch" },
    });

    const aliasKey = mutableMatrix();
    const aliasSlide = requireSlide(aliasKey, slide.name);
    const aliasIcon = aliasSlide.regions.find((region) => region.payload_key === "icono");
    if (!aliasIcon) throw new Error("Fixture sin icono");
    aliasIcon.payload_key = "icon";
    aliasIcon.key = "icon";
    expect(resolveSlideComposition(slide, aliasSlide, aliasKey)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "slot_contract_mismatch" },
    });
  });

  it("rechaza left/right como aliases de izquierda/derecha", () => {
    const matrix = mutableMatrix();
    const slide = requireMetadata("p_slide_2_graficos");
    const effective = requireSlide(matrix, slide.name);
    const aliases = ["left", "right"];
    effective.regions
      .filter((region) => region.role === "chart")
      .forEach((region, index) => {
        region.key = aliases[index];
        region.payload_key = aliases[index];
      });

    expect(resolveSlideComposition(slide, effective, matrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "slot_contract_mismatch" },
    });
  });

  it("acepta área cero sólo oculta y rechaza una región visible sin área", () => {
    const validMatrix = mutableMatrix();
    const slide = requireMetadata("p_slide_portada");
    const validSlide = requireSlide(validMatrix, slide.name);
    expect(resolveSlideComposition(slide, validSlide, validMatrix).status).toBe("ready");

    const invalidMatrix = mutableMatrix();
    const invalidSlide = requireSlide(invalidMatrix, slide.name);
    const hidden = invalidSlide.regions.find((region) => region.key === "referencia_oculta");
    if (!hidden) throw new Error("Fixture sin región oculta");
    hidden.visible = true;
    expect(resolveSlideComposition(slide, invalidSlide, invalidMatrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "region_visibility_invalid" },
    });
  });

  it.each([
    "p_slide_grafico_texto_derecha",
    "p_slide_grafico_texto_izquierda",
    "p_slide_2_graficos_texto_izquierda",
    "p_slide_2_graficos_texto_derecha",
  ])("rechaza una caja inferior fuera del canvas en %s", (tipo) => {
    const matrix = mutableMatrix();
    const slide = requireMetadata(tipo);
    const effective = requireSlide(matrix, tipo);
    const chart = effective.regions.find((region) => region.role === "chart");
    if (!chart) throw new Error(`Fixture sin gráfico para ${tipo}`);
    chart.rect.y = 0.78;
    chart.rect.height = 0.3;

    expect(resolveSlideComposition(slide, effective, matrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "region_geometry_invalid" },
    });
  });

  it("falla cerrado si top_two no está en la matriz", () => {
    const matrix = mutableMatrix();
    const slide = requireMetadata("p_slide_top_two_box");
    matrix.slides = matrix.slides.filter((candidate) => candidate.tipo !== slide.name);

    expect(resolveSlideCompositionMap(metadata, matrix)[slide.name]).toMatchObject({
      status: "fallback",
      diagnostic: { code: "matrix_slide_missing" },
    });
  });

  it("rechaza slot canónico ausente y coordenadas no finitas", () => {
    const missingSlotMatrix = mutableMatrix();
    const slide = requireMetadata("p_slide_2_graficos");
    const missingSlot = requireSlide(missingSlotMatrix, slide.name);
    missingSlot.regions = missingSlot.regions.filter((region) => region.payload_key !== "derecha");
    expect(resolveSlideComposition(slide, missingSlot, missingSlotMatrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "slot_contract_mismatch" },
    });

    const nonFiniteMatrix = mutableMatrix();
    const nonFinite = requireSlide(nonFiniteMatrix, slide.name);
    nonFinite.regions[0].rect.x = Number.NaN;
    expect(resolveSlideComposition(slide, nonFinite, nonFiniteMatrix)).toMatchObject({
      status: "fallback",
      diagnostic: { code: "region_geometry_invalid" },
    });
  });
});
