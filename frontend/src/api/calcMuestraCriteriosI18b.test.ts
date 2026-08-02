import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accreditCalcMuestraCriteriosI18bInventory,
  apiCalcMuestraCriteriosPreview,
  createCriteriosPreviewCoordinator,
  normalizeCalcMuestraCriteriosI18bBundle,
  normalizeCalcMuestraCriteriosAnclasHistoricas,
  normalizeCalcMuestraCriteriosCascada,
  normalizeCalcMuestraCriteriosTotales,
  type CalcMuestraCriteriosCascada,
  type CalcMuestraCriteriosPreviewInput,
  type CalcMuestraCriteriosPreviewState,
} from "./calcMuestraCriteriosI18b";

afterEach(() => vi.unstubAllGlobals());

const distribution = {
  media: 0,
  p10: 0,
  p25: 1,
  p50: 2,
  p75: 3,
  p90: 4,
};

const snapshot = {
  n_ch: 1,
  n_ch_con_dato: 1,
  n_estudiantes_unicos: 0,
  n_matriculas: 0,
  distribution,
};

const totalsRaw = {
  schema: "calc_muestra_aulas_criterios_totales_v1",
  owner: "calc_muestra_aulas_frame_v1.criterios_totales",
  source_schema: "calc_muestra_aulas_criterios_radiografia_v2",
  source_frame_hash: "frame-1",
  momento: "marco_ejecutado",
  grain: "criterio_x_segmento",
  unit: "curso_horario_unico",
  rows: [{
    criterion_id: "session_type",
    card_id: "session_type",
    label: "Tipo de sesión",
    segment_key: "teorico",
    segment_label: "Teórico",
    segment_kind: "categoria",
    actual: snapshot,
    contraste_total: snapshot,
    signal_distribution: {
      unit: "valor_criterio",
      n_total: 1,
      n_con_dato: 1,
      ...distribution,
    },
  }],
};

const cascadeRaw = {
  schema: "calc_muestra_aulas_criterios_cascada_v1",
  owner: "calc_muestra_aulas_frame_v1.criterios_cascada",
  source_frame_hash: "frame-1",
  criteria_hash: "criteria-1",
  momento: "marco_ejecutado",
  grain: "paso_x_facultad_efectiva",
  unit: "curso_horario_unico",
  order_source: "motor_r",
  steps: [{
    order: 1,
    criterion_id: "session_type",
    card_id: "session_type",
    label: "Tipo de sesión",
    scope: "aula",
    gate: true,
    applies: true,
    status: "aplicado",
    faculties: [{
      faculty_key: "ingenieria",
      label: "Ingeniería",
      before_ch: 0,
      after_ch: 0,
      excluded_ch: 0,
    }],
    total: { before_ch: 0, after_ch: 0, excluded_ch: 0 },
  }, {
    order: 2,
    criterion_id: "manual_excluded",
    card_id: "manual_excluded",
    label: "Exclusiones manuales",
    scope: "aula",
    gate: false,
    applies: false,
    status: "inactivo",
    faculties: [{
      faculty_key: "ingenieria",
      label: "Ingeniería",
      before_ch: 0,
      after_ch: 0,
      excluded_ch: 0,
    }],
    total: { before_ch: 0, after_ch: 0, excluded_ch: 0 },
  }],
};

const anchorsRaw = {
  schema: "calc_muestra_criterios_anclas_historicas_v1",
  owner: "calc_muestra_aulas_frame_v1.criterios_anclas_historicas",
  source_frame_hash: "frame-1",
  reference_schema: "calc_muestra_referencia_asistencia_celdas_v1",
  reference_hash: "reference-1",
  periodo: "2025-1",
  grain: "criterio_x_facultad_efectiva",
  faculty_dimensions: ["curso_horario_efectiva"],
  reference_faculty_dimension: "facultad_historica",
  rows: [{
    criterion_id: "session_type",
    card_id: "session_type",
    faculty_key: "ingenieria",
    faculty_label: "Ingeniería",
    faculty_dimension: "curso_horario_efectiva",
    reference_faculty_dimension: "facultad_historica",
    requested_dimension: "tipo_sesion",
    requested_key: "teorico",
    requested_label: "Teórico",
    matched_dimension: "tipo_sesion",
    matched_key: "teorico",
    matched_label: "Teórico",
    match_level: "exacta",
    k: 12,
    tasa: 0.8,
    ic_low: 0.7,
    ic_high: 0.9,
    metodo_ic: "bootstrap_percentil",
    suficiencia: "delgada",
    periodo: "2025-1",
    warning: "Coincidencia histórica exacta.",
  }],
};

describe("contratos I18b de criterios", () => {
  it("normaliza Totales R-owned sin convertir cero en ausencia", () => {
    const result = normalizeCalcMuestraCriteriosTotales(totalsRaw);
    expect(result?.rows[0]?.actual.n_ch).toBe(1);
    expect(result?.rows[0]?.actual.n_matriculas).toBe(0);
    expect(result?.rows[0]?.actual.n_estudiantes_unicos).toBe(0);
    expect(result?.rows[0]?.actual.distribution.media).toBe(0);

    const partial = structuredClone(totalsRaw);
    (partial.rows[0] as { actual: unknown }).actual = {
      n_ch: 1,
      n_ch_con_dato: 0,
      n_estudiantes_unicos: null,
      n_matriculas: null,
      distribution: { media: null, p10: null, p25: null, p50: null, p75: null, p90: null },
    };
    expect(normalizeCalcMuestraCriteriosTotales(partial)?.rows[0]?.actual.n_matriculas).toBeNull();
  });

  it("rechaza snapshots parciales y cuantiles desordenados", () => {
    const partial = structuredClone(totalsRaw);
    delete (partial.rows[0]!.actual.distribution as Record<string, unknown>).p90;
    expect(normalizeCalcMuestraCriteriosTotales(partial)).toBeNull();

    const unordered = structuredClone(totalsRaw);
    unordered.rows[0]!.actual.distribution.p25 = 9;
    expect(normalizeCalcMuestraCriteriosTotales(unordered)).toBeNull();
  });

  it("preserva el orden R y valida la identidad before = after + excluded", () => {
    const result = normalizeCalcMuestraCriteriosCascada(cascadeRaw);
    expect(result?.order_source).toBe("motor_r");
    expect(result?.steps[0]?.order).toBe(1);
    expect(result?.steps[0]?.total.before_ch).toBe(0);

    const invalid = structuredClone(cascadeRaw);
    invalid.steps[0]!.total = { before_ch: 3, after_ch: 1, excluded_ch: 1 };
    expect(normalizeCalcMuestraCriteriosCascada(invalid)).toBeNull();
  });

  it("rechaza pasos repetidos o fuera del orden publicado por R", () => {
    const duplicate = structuredClone(cascadeRaw);
    duplicate.steps.push({ ...duplicate.steps[0]!, criterion_id: "modality" });
    expect(normalizeCalcMuestraCriteriosCascada(duplicate)).toBeNull();

    const reversed = structuredClone(cascadeRaw);
    reversed.steps.unshift({ ...reversed.steps[0]!, order: 2, criterion_id: "modality" });
    expect(normalizeCalcMuestraCriteriosCascada(reversed)).toBeNull();
  });

  it("conserva manual_excluded como paso final fuera del denominador", () => {
    const withManual = structuredClone(cascadeRaw);
    const result = normalizeCalcMuestraCriteriosCascada(withManual);
    expect(result?.steps.filter((step) => step.gate)).toHaveLength(1);
    expect(result?.steps.at(-1)).toMatchObject({ criterion_id: "manual_excluded", gate: false });

    const stringGate = structuredClone(cascadeRaw) as unknown as { steps: Array<{ gate: unknown }> };
    stringGate.steps[0]!.gate = "marco";
    expect(normalizeCalcMuestraCriteriosCascada(stringGate)).toBeNull();

    const withoutManual = structuredClone(cascadeRaw);
    withoutManual.steps.pop();
    expect(normalizeCalcMuestraCriteriosCascada(withoutManual)).toBeNull();
  });

  it("normaliza anclas publicables y rechaza exacta con k/IC imposibles", () => {
    const result = normalizeCalcMuestraCriteriosAnclasHistoricas(anchorsRaw);
    expect(result?.reference_hash).toBe("reference-1");
    expect(result?.rows[0]).toMatchObject({
      match_level: "exacta",
      k: 12,
      tasa: 0.8,
      ic_low: 0.7,
      ic_high: 0.9,
    });

    const impossible = structuredClone(anchorsRaw);
    impossible.rows[0]!.k = 0;
    impossible.rows[0]!.tasa = 0;
    impossible.rows[0]!.ic_low = 0;
    impossible.rows[0]!.ic_high = 0;
    impossible.rows[0]!.suficiencia = "vacia";
    expect(normalizeCalcMuestraCriteriosAnclasHistoricas(impossible)).toBeNull();

    const inferred = structuredClone(anchorsRaw);
    inferred.rows[0]!.match_level = "nearest_inferido";
    expect(normalizeCalcMuestraCriteriosAnclasHistoricas(inferred)).toBeNull();
  });

  it("acredita los tres siblings solo contra el frame visible", () => {
    const bundle = normalizeCalcMuestraCriteriosI18bBundle({
      frameHash: "frame-1",
      totals: totalsRaw,
      cascade: cascadeRaw,
      anchors: anchorsRaw,
    });
    expect(bundle.invalid).toEqual([]);
    expect(bundle.status).toBe("complete");
    expect(bundle.totals?.source_frame_hash).toBe("frame-1");

    const stale = normalizeCalcMuestraCriteriosI18bBundle({
      frameHash: "frame-2",
      totals: totalsRaw,
      cascade: cascadeRaw,
      anchors: anchorsRaw,
    });
    expect(stale).toMatchObject({ totals: null, cascade: null, anchors: null });
    expect(stale.status).toBe("invalid");
    expect(stale.invalid).toEqual(["totals", "cascade", "anchors"]);

    const partial = normalizeCalcMuestraCriteriosI18bBundle({
      frameHash: "frame-1",
      totals: totalsRaw,
      cascade: null,
      anchors: anchorsRaw,
    });
    expect(partial).toMatchObject({ status: "invalid", totals: null, cascade: null, anchors: null });
    expect(partial.invalid).toContain("cascade");
  });

  it("acredita inventario exacto y falla cerrado ante un Total parcial", () => {
    const bundle = normalizeCalcMuestraCriteriosI18bBundle({
      frameHash: "frame-1",
      totals: totalsRaw,
      cascade: cascadeRaw,
      anchors: anchorsRaw,
    });
    const inventory = [{
      criterion_id: "session_type",
      card_id: "session_type",
      faculty_dimension: "curso_horario_efectiva" as const,
      faculty_keys: ["ingenieria"],
      segments: [{ segment_key: "teorico", segment_kind: "categoria" }],
    }];
    expect(accreditCalcMuestraCriteriosI18bInventory(bundle, inventory, 0).status).toBe("complete");

    const wrongInventory = [{
      ...inventory[0]!,
      segments: [...inventory[0]!.segments, { segment_key: "taller", segment_kind: "categoria" }],
    }];
    expect(accreditCalcMuestraCriteriosI18bInventory(bundle, wrongInventory, 0)).toMatchObject({
      status: "invalid",
      totals: null,
      invalid: ["inventory"],
    });
  });
});

describe("coordinador de preview I18b", () => {
  const input: CalcMuestraCriteriosPreviewInput = {
    source_frame_hash: "frame-1",
    criteria_hash: "criteria-1",
    config: { criterios_seleccion: { byVariable: {} } },
  };

  it("envía el body congelado y propaga AbortSignal sin persistir el borrador", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "sid-test"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const preview = { ...cascadeRaw, momento: "borrador_no_persistido" };
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, preview }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await apiCalcMuestraCriteriosPreview(input, { signal: controller.signal });

    expect(result.preview.momento).toBe("borrador_no_persistido");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/calc-muestra/marco/criterios/preview");
    expect(init).toMatchObject({ method: "POST", signal: controller.signal });
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("aborta el request anterior y descarta su respuesta tardía", async () => {
    const pending: Array<{
      signal: AbortSignal;
      resolve: (value: { ok: true; preview: CalcMuestraCriteriosCascada }) => void;
    }> = [];
    const load = (_request: CalcMuestraCriteriosPreviewInput, options: { signal: AbortSignal }) =>
      new Promise<{ ok: true; preview: CalcMuestraCriteriosCascada }>((resolve) => {
        pending.push({ signal: options.signal, resolve });
      });
    const states: CalcMuestraCriteriosPreviewState[] = [];
    const coordinator = createCriteriosPreviewCoordinator(load);

    const first = coordinator.run(input, (state) => states.push(state));
    const second = coordinator.run({ ...input, config: { revision: 2 } }, (state) => states.push(state));
    expect(pending[0]?.signal.aborted).toBe(true);

    const preview = normalizeCalcMuestraCriteriosCascada({
      ...cascadeRaw,
      momento: "borrador_no_persistido",
      criteria_hash: "criteria-2",
    })!;
    pending[1]!.resolve({ ok: true, preview });
    await second;
    pending[0]!.resolve({ ok: true, preview: { ...preview, criteria_hash: "tardio" } });
    await first;

    const ready = states.filter((state) => state.status === "ready");
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ status: "ready", data: { criteria_hash: "criteria-2" } });
  });

  it("marca stale y no publica un preview de otro frame", async () => {
    const preview = normalizeCalcMuestraCriteriosCascada({
      ...cascadeRaw,
      source_frame_hash: "frame-viejo",
      momento: "borrador_no_persistido",
    })!;
    const states: CalcMuestraCriteriosPreviewState[] = [];
    const coordinator = createCriteriosPreviewCoordinator(async () => ({ ok: true, preview }));
    await coordinator.run(input, (state) => states.push(state));
    expect(states.at(-1)).toMatchObject({ status: "stale" });
  });

  it("clasifica HTTP 409 como stale", async () => {
    const states: CalcMuestraCriteriosPreviewState[] = [];
    const coordinator = createCriteriosPreviewCoordinator(async () => {
      throw { status: 409, message: "frame obsoleto" };
    });
    await coordinator.run(input, (state) => states.push(state));
    expect(states.at(-1)).toMatchObject({ status: "stale" });
  });
});
