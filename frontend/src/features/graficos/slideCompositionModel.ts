import type {
  GraficosSlideLayoutMatrix,
  GraficosSlideLayoutMatrixSlide,
  GraficosSlideLayoutRegion,
  SlideBlueprintKind,
  SlideMetadata,
  SlideSlotRole,
} from "../../api/client";

export const SLIDE_LAYOUT_MATRIX_SCHEMA = "graficos.slide_layout_matrix/v2" as const;
const NORMALIZED_RECT_EPSILON = 1e-9;
const TEMPLATE_IDENTITY_SOURCES = new Set(["template_id", "profile_id", "default"]);

export type SlideCompositionDiagnosticCode =
  | "matrix_unavailable"
  | "matrix_contract_invalid"
  | "matrix_slide_missing"
  | "matrix_slide_duplicate"
  | "metadata_blueprint_missing"
  | "metadata_render_key_missing"
  | "layout_mismatch"
  | "render_key_missing"
  | "render_key_mismatch"
  | "region_key_duplicate"
  | "region_geometry_invalid"
  | "region_visibility_invalid"
  | "slot_contract_mismatch";

export type SlideCompositionDiagnostic = {
  code: SlideCompositionDiagnosticCode;
  message: string;
};

export type SlideComposition = {
  source: "matrix";
  contractVersion: 2;
  tipo: string;
  renderKey: string;
  layout: string;
  kind: SlideBlueprintKind;
  structureLabel: string;
  aspectRatio: number;
  template: GraficosSlideLayoutMatrix["template"];
  regions: readonly GraficosSlideLayoutRegion[];
  diagnostics: readonly string[];
};

export type SlideCompositionResolution =
  | {
    status: "ready";
    composition: SlideComposition;
    diagnostic: null;
  }
  | {
    status: "fallback";
    composition: null;
    diagnostic: SlideCompositionDiagnostic;
  };

export type SlideCompositionMap = Readonly<Record<string, SlideCompositionResolution>>;

type MatrixContractCheck =
  | { ok: true }
  | { ok: false; diagnostic: SlideCompositionDiagnostic };

function fallback(
  code: SlideCompositionDiagnosticCode,
  message: string,
): SlideCompositionResolution {
  return {
    status: "fallback",
    composition: null,
    diagnostic: { code, message },
  };
}

function validPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validMatrixContract(
  matrix: GraficosSlideLayoutMatrix | null | undefined,
): MatrixContractCheck {
  if (!matrix) {
    return {
      ok: false,
      diagnostic: {
        code: "matrix_unavailable",
        message: "La matriz de composición no está disponible; se conserva la referencia nominal.",
      },
    };
  }
  if (
    matrix.schema !== SLIDE_LAYOUT_MATRIX_SCHEMA
    || matrix.contract_version !== 2
    || !matrix.template
    || typeof matrix.template.id !== "string"
    || matrix.template.id.trim().length === 0
    || typeof matrix.template.fingerprint !== "string"
    || matrix.template.fingerprint.trim().length === 0
    || !TEMPLATE_IDENTITY_SOURCES.has(matrix.template.identity_source)
    || !matrix.canvas
    || !validPositiveNumber(matrix.canvas.width)
    || !validPositiveNumber(matrix.canvas.height)
    || !validPositiveNumber(matrix.canvas.aspect_ratio)
    || !Array.isArray(matrix.slides)
  ) {
    return {
      ok: false,
      diagnostic: {
        code: "matrix_contract_invalid",
        message: "La matriz de composición no cumple el contrato v2; se conserva la referencia nominal.",
      },
    };
  }
  return { ok: true };
}

function regionGeometryIssue(
  region: GraficosSlideLayoutRegion,
): SlideCompositionDiagnostic | null {
  const rect = region.rect;
  if (!rect || typeof rect !== "object") {
    return {
      code: "region_geometry_invalid",
      message: `La región ${region.key || "sin clave"} no declara un rectángulo normalizado válido.`,
    };
  }
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return {
      code: "region_geometry_invalid",
      message: `La región ${region.key || "sin clave"} contiene coordenadas no finitas.`,
    };
  }
  if (
    rect.x < 0
    || rect.y < 0
    || rect.width < 0
    || rect.height < 0
    || rect.x + rect.width > 1 + NORMALIZED_RECT_EPSILON
    || rect.y + rect.height > 1 + NORMALIZED_RECT_EPSILON
  ) {
    return {
      code: "region_geometry_invalid",
      message: `La región ${region.key || "sin clave"} queda fuera del canvas normalizado.`,
    };
  }
  const positiveArea = rect.width > 0 && rect.height > 0;
  if (region.visible === true && !positiveArea) {
    return {
      code: "region_visibility_invalid",
      message: `La región visible ${region.key || "sin clave"} debe tener área positiva.`,
    };
  }
  if (!positiveArea && region.visible !== false) {
    return {
      code: "region_visibility_invalid",
      message: `La región ${region.key || "sin clave"} de área cero debe estar oculta.`,
    };
  }
  if (typeof region.visible !== "boolean") {
    return {
      code: "region_visibility_invalid",
      message: `La región ${region.key || "sin clave"} no declara visibilidad booleana.`,
    };
  }
  return null;
}

function slotContractIssue(
  metadata: SlideMetadata,
  regions: readonly GraficosSlideLayoutRegion[],
): SlideCompositionDiagnostic | null {
  const expected = new Map<string, SlideSlotRole>();
  for (const slot of metadata.slot_specs ?? []) {
    if (slot.role !== "chart" && slot.role !== "icon") continue;
    const payloadKey = slot.name.trim();
    if (!payloadKey || expected.has(payloadKey)) {
      return {
        code: "slot_contract_mismatch",
        message: "Los slots de metadata no permiten verificar una correspondencia única.",
      };
    }
    expected.set(payloadKey, slot.role);
  }

  const seen = new Set<string>();
  for (const region of regions) {
    if (region.role !== "chart" && region.role !== "icon") continue;
    const payloadKey = region.payload_key.trim();
    const expectedRole = expected.get(payloadKey);
    if (!payloadKey || !expectedRole || expectedRole !== region.role || seen.has(payloadKey)) {
      return {
        code: "slot_contract_mismatch",
        message: `La región ${region.key || "sin clave"} no coincide con payload_key/role de slot_specs.`,
      };
    }
    seen.add(payloadKey);
  }

  for (const payloadKey of expected.keys()) {
    if (!seen.has(payloadKey)) {
      return {
        code: "slot_contract_mismatch",
        message: `La matriz no contiene la región canónica ${payloadKey}.`,
      };
    }
  }
  return null;
}

export function resolveSlideComposition(
  metadata: SlideMetadata,
  matrixSlide: GraficosSlideLayoutMatrixSlide | null | undefined,
  matrix: GraficosSlideLayoutMatrix | null | undefined,
): SlideCompositionResolution {
  const contract = validMatrixContract(matrix);
  if (!contract.ok) {
    return {
      status: "fallback",
      composition: null,
      diagnostic: contract.diagnostic,
    };
  }
  if (!matrix) {
    return fallback(
      "matrix_unavailable",
      "La matriz de composición no está disponible; se conserva la referencia nominal.",
    );
  }
  if (!matrixSlide || matrixSlide.tipo !== metadata.name) {
    return fallback(
      "matrix_slide_missing",
      `La matriz no contiene una composición inequívoca para ${metadata.name}.`,
    );
  }
  const blueprint = metadata.blueprint;
  if (!blueprint || !blueprint.ppt_layout.trim()) {
    return fallback(
      "metadata_blueprint_missing",
      `El registry no declara el layout PPT de ${metadata.name}.`,
    );
  }
  if (typeof metadata.render_key !== "string" || !metadata.render_key.trim()) {
    return fallback(
      "metadata_render_key_missing",
      `El registry no declara render_key para ${metadata.name}.`,
    );
  }
  if (matrixSlide.layout !== blueprint.ppt_layout) {
    return fallback(
      "layout_mismatch",
      `El layout resuelto para ${metadata.name} no coincide con el registry.`,
    );
  }
  if (typeof matrixSlide.render_key !== "string" || !matrixSlide.render_key.trim()) {
    return fallback(
      "render_key_missing",
      `La composición de ${metadata.name} no declara render_key.`,
    );
  }
  if (matrixSlide.render_key !== metadata.render_key) {
    return fallback(
      "render_key_mismatch",
      `El render_key resuelto para ${metadata.name} no coincide con el registry.`,
    );
  }
  if (!Array.isArray(matrixSlide.regions)) {
    return fallback(
      "region_geometry_invalid",
      `La composición de ${metadata.name} no declara regiones.`,
    );
  }

  const keys = new Set<string>();
  for (const region of matrixSlide.regions) {
    if (
      !region
      || typeof region.key !== "string"
      || !region.key.trim()
      || keys.has(region.key.trim())
    ) {
      return fallback(
        "region_key_duplicate",
        `La composición de ${metadata.name} contiene una región sin clave única.`,
      );
    }
    keys.add(region.key.trim());
    if (typeof region.payload_key !== "string" || !region.payload_key.trim()) {
      return fallback(
        "slot_contract_mismatch",
        `La región ${region.key} no declara payload_key canónico.`,
      );
    }
    const geometryIssue = regionGeometryIssue(region);
    if (geometryIssue) {
      return {
        status: "fallback",
        composition: null,
        diagnostic: geometryIssue,
      };
    }
  }

  const slotIssue = slotContractIssue(metadata, matrixSlide.regions);
  if (slotIssue) {
    return {
      status: "fallback",
      composition: null,
      diagnostic: slotIssue,
    };
  }

  return {
    status: "ready",
    composition: {
      source: "matrix",
      contractVersion: 2,
      tipo: matrixSlide.tipo,
      renderKey: matrixSlide.render_key,
      layout: matrixSlide.layout,
      kind: blueprint.kind,
      structureLabel: blueprint.structure_label.trim() || "Composición compatible",
      aspectRatio: matrix.canvas.aspect_ratio,
      template: matrix.template,
      regions: matrixSlide.regions,
      diagnostics: Array.isArray(matrixSlide.diagnostics) ? matrixSlide.diagnostics : [],
    },
    diagnostic: null,
  };
}

export function resolveSlideCompositionMap(
  metadata: readonly SlideMetadata[],
  matrix: GraficosSlideLayoutMatrix | null | undefined,
): SlideCompositionMap {
  const contract = validMatrixContract(matrix);
  const result: Record<string, SlideCompositionResolution> = {};
  if (!contract.ok || !matrix) {
    for (const slide of metadata) {
      result[slide.name] = {
        status: "fallback",
        composition: null,
        diagnostic: contract.ok
          ? {
            code: "matrix_unavailable",
            message: "La matriz de composición no está disponible; se conserva la referencia nominal.",
          }
          : contract.diagnostic,
      };
    }
    return result;
  }

  const matrixSlides = new Map<string, GraficosSlideLayoutMatrixSlide>();
  const duplicateTypes = new Set<string>();
  for (const slide of matrix.slides) {
    if (matrixSlides.has(slide.tipo)) duplicateTypes.add(slide.tipo);
    else matrixSlides.set(slide.tipo, slide);
  }

  for (const slide of metadata) {
    if (duplicateTypes.has(slide.name)) {
      result[slide.name] = fallback(
        "matrix_slide_duplicate",
        `La matriz contiene más de una composición para ${slide.name}.`,
      );
      continue;
    }
    result[slide.name] = resolveSlideComposition(
      slide,
      matrixSlides.get(slide.name),
      matrix,
    );
  }
  return result;
}

export function slideCompositionRegionSignature(
  composition: SlideComposition,
): string {
  return JSON.stringify(composition.regions.map((region) => ({
    key: region.key,
    payload_key: region.payload_key,
    role: region.role,
    visible: region.visible,
    rect: region.rect,
    geometry_source: region.geometry_source,
  })));
}
