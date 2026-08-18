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

  it("acepta pasos operativos del constructor en medio del embudo", () => {
    // faculty_curso (las facultades declaradas recortan las aulas) corre en el
    // constructor sin gate en la radiografía. La versión anterior del contrato
    // solo admitía manual_excluded como operativo, y ese cierre se tragó la
    // cascada ENTERA en HSVG2026: 101 CH cortadas y la UI sin barras ni matriz.
    const withOperational = structuredClone(cascadeRaw);
    withOperational.steps = [
      {
        ...structuredClone(withOperational.steps[0]!),
        order: 1,
        criterion_id: "faculty_curso",
        card_id: "faculty_curso",
        label: "Facultad del curso: sólo 15 facultad(es) del estudio",
        gate: false,
      },
      { ...structuredClone(withOperational.steps[0]!), order: 2 },
      { ...structuredClone(withOperational.steps[1]!), order: 3 },
    ];
    const result = normalizeCalcMuestraCriteriosCascada(withOperational);
    expect(result?.steps.map((step) => step.criterion_id)).toEqual([
      "faculty_curso", "session_type", "manual_excluded",
    ]);
    expect(result?.steps[0]).toMatchObject({ gate: false, applies: true });

    // La forma sigue vigilada: un operativo con card ajena no pasa…
    const rogue = structuredClone(withOperational);
    rogue.steps[0]!.card_id = "session_type";
    expect(normalizeCalcMuestraCriteriosCascada(rogue)).toBeNull();

    // …y el cierre tampoco se negocia: manual_excluded fuera del final, nulo.
    const manualEnMedio = structuredClone(withOperational);
    manualEnMedio.steps = [
      { ...structuredClone(manualEnMedio.steps[2]!), order: 1 },
      { ...structuredClone(manualEnMedio.steps[1]!), order: 2 },
    ];
    expect(normalizeCalcMuestraCriteriosCascada(manualEnMedio)).toBeNull();
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

  it("acepta incompatible con request a medio formar, como lo emite el motor", () => {
    // R marca incompatible cuando `!nzchar(dimension) || !nzchar(key)` y
    // publica la mitad del request que sí tenía. Exigir el request todo-nulo
    // invalidaba las 269 anclas del estudio real por 2 filas de facultades
    // fuera del estudio (CONSORCIO), y con anchors nulo caía el bundle entero.
    const media = structuredClone(anchorsRaw);
    media.rows[0] = {
      ...media.rows[0]!,
      requested_dimension: "tipo_sesion",
      requested_key: null as unknown as string,
      requested_label: null as unknown as string,
      matched_dimension: null as unknown as string,
      matched_key: null as unknown as string,
      matched_label: null as unknown as string,
      match_level: "incompatible",
      k: null as unknown as number,
      tasa: null as unknown as number,
      ic_low: null as unknown as number,
      ic_high: null as unknown as number,
      metodo_ic: "no_aplica",
      suficiencia: "vacia",
      warning: "El criterio no comparte una caracteristica compatible con la referencia.",
    };
    const result = normalizeCalcMuestraCriteriosAnclasHistoricas(media);
    expect(result?.rows[0]).toMatchObject({
      match_level: "incompatible",
      requested_dimension: "tipo_sesion",
      requested_key: null,
      k: null,
    });

    // El bug del motor sigue fallando cerrado: request COMPLETO e incompatible.
    const contradictorio = structuredClone(media);
    contradictorio.rows[0]! = {
      ...contradictorio.rows[0]!,
      requested_key: "teorico",
      requested_label: "Teórico",
    };
    expect(normalizeCalcMuestraCriteriosAnclasHistoricas(contradictorio)).toBeNull();
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

describe("F45 · el aviso del preview no suplanta al motor", () => {
  it("propaga el mensaje que envía el motor en un rechazo stale", async () => {
    // Medido en la app: el motor responde
    // `E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE` con «El preview requiere el
    // contexto transitorio del marco y criterios vigentes», y la app lo
    // reemplazaba por «el marco cambió mientras se calculaba el preview» —una
    // causa que no ocurrió—. Quien lee un aviso inventado busca donde no está.
    const estados: Array<{ status: string; message?: string }> = [];
    const coordinator = createCriteriosPreviewCoordinator(async () => {
      throw Object.assign(
        new Error("El preview requiere el contexto transitorio del marco y criterios vigentes."),
        { code: "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE", status: 409 },
      );
    });
    await coordinator.run(
      { source_frame_hash: "h", config: {}, criteria_hash: "c" },
      (estado) => estados.push(estado),
    );
    const stale = estados.find((e) => e.status === "stale");
    // F47 · «Requiere el contexto transitorio» es exacto y no le dice nada a
    // quien lo lee. El motor sólo tiene ese contexto si el marco se construyó en
    // esta sesión, así que al abrir un `.pulso` guardado el embudo pide el
    // recálculo en cada cambio y es rechazado siempre. Se traduce a la condición
    // real y a su salida.
    expect(stale?.message).toContain("construido en esta sesión");
    expect(stale?.message).toContain("Vuelve a construirlo");
    expect(stale?.message).not.toContain("El marco cambió mientras");
  });
});

/**
 * G41 · El reparto por categoría entra por el normalizador o no entra.
 *
 * Es la cifra que la tarjeta enseña como «llegan aquí», así que un reparto que
 * no cuadra con el `before_ch` de su facultad no puede pasar: sería un número
 * inventado con aspecto de dato del motor. Y al revés — descartarlo no puede
 * llevarse la cascada entera por delante, porque entonces un detalle opcional
 * apagaría el embudo de toda la pantalla.
 */
describe("normalizeCalcMuestraCriteriosCascada · reparto por categoría", () => {
  const conSegmentos = (segments: unknown, particionan = false) => {
    const raw = structuredClone(cascadeRaw) as typeof cascadeRaw;
    raw.steps[0].faculties[0].before_ch = 10;
    raw.steps[0].faculties[0].after_ch = 6;
    raw.steps[0].faculties[0].excluded_ch = 4;
    raw.steps[0].total = { before_ch: 10, after_ch: 6, excluded_ch: 4 };
    raw.steps[1].faculties[0].before_ch = 6;
    raw.steps[1].faculties[0].after_ch = 6;
    raw.steps[1].total = { before_ch: 6, after_ch: 6, excluded_ch: 0 };
    (raw.steps[0].faculties[0] as Record<string, unknown>).segments = segments;
    (raw.steps[0].faculties[0] as Record<string, unknown>).segments_particionan = particionan;
    return normalizeCalcMuestraCriteriosCascada(raw);
  };

  it("conserva el reparto que suma lo que llega y lo que sale", () => {
    const raw = structuredClone(cascadeRaw) as typeof cascadeRaw;
    const cascada = conSegmentos([
      { segment_key: "teorico", before_ch: 7, after_ch: 6 },
      { segment_key: "laboratorio", before_ch: 3, after_ch: 0 },
    ], true);
    void raw;
    const segments = cascada?.steps[0].faculties[0].segments;
    expect(segments).toHaveLength(2);
    expect(segments?.reduce((n, s) => n + s.before_ch, 0)).toBe(10);
    expect(cascada?.steps[0].faculties[0].segments_particionan).toBe(true);
  });

  /*
   * G41 · Un reparto que no suma NO se descarta.
   *
   * La primera versión lo hacía, y en la app eso vació la casilla de «Tipo de
   * docente»: sus categorías se solapan —un curso-horario con dos docentes de
   * tipos distintos cuenta en dos— así que la suma nunca iba a cerrar, y la
   * cifra por categoría era correcta igualmente. Quien declara si particionan
   * es el motor (`segments_particionan`); la superficie lo dice en pantalla.
   */
  it("conserva el reparto que no suma y lo marca como no excluyente", () => {
    const cascada = conSegmentos([
      { segment_key: "teorico", before_ch: 7, after_ch: 6 },
    ]);
    expect(cascada).not.toBeNull();
    expect(cascada?.steps[0].faculties[0].segments).toHaveLength(1);
    expect(cascada?.steps[0].faculties[0].segments_particionan).toBe(false);
    expect(cascada?.steps[0].faculties[0].before_ch).toBe(10);
  });

  it("descarta el reparto ilegible, sin perder la cascada", () => {
    const cascada = conSegmentos([{ segment_key: "", before_ch: -1, after_ch: 9 }]);
    expect(cascada).not.toBeNull();
    expect(cascada?.steps[0].faculties[0].segments).toBeUndefined();
  });

  it("una cascada sin reparto sigue siendo válida", () => {
    const cascada = normalizeCalcMuestraCriteriosCascada(cascadeRaw);
    expect(cascada).not.toBeNull();
    expect(cascada?.steps[0].faculties[0].segments).toBeUndefined();
  });
});
