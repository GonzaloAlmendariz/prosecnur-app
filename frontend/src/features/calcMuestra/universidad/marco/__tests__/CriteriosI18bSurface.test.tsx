import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriterioRadiografiaV2Row,
  CalcMuestraAulasCriteriosRadiografiaV2,
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CriterioKind,
  CriterioScope,
  CriteriosCatalogo,
} from "../../../../../api/client";
import type {
  CalcMuestraCriteriosAnclasHistoricas,
  CalcMuestraCriteriosAnchorRow,
  CalcMuestraCriteriosCascada,
  CalcMuestraCriteriosTotales,
} from "../../../../../api/calcMuestraCriteriosI18b";
import { CriterioAnclaHistorica } from "../CriterioAnclaHistorica";
import {
  boxplotDomain,
  CriterioBoxplotLeyenda,
  CriterioBoxplotPercentilar,
} from "../CriterioBoxplotPercentilar";
import { CriteriosEmbudoVivo } from "../CriteriosEmbudoVivo";
import { CriteriosRadiografiaCardDetalle } from "../CriteriosRadiografiaCardDetalle";
import { CursosHorarioMarcoTab } from "../CursosHorarioMarcoTab";
import { CriteriosMarcoTab } from "../../criterios/CriteriosMarcoTab";
import {
  buildCriteriosRadiografiaModel,
  COMPOSITION_GATE_IDS,
} from "../criteriosRadiografiaModel";

const cascade: CalcMuestraCriteriosCascada = {
  schema: "calc_muestra_aulas_criterios_cascada_v1",
  owner: "calc_muestra_aulas_frame_v1.criterios_cascada",
  source_frame_hash: "frame-1",
  criteria_hash: "criteria-1",
  momento: "marco_ejecutado",
  grain: "paso_x_facultad_efectiva",
  unit: "curso_horario_unico",
  order_source: "motor_r",
  steps: [
    {
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
        before_ch: 100,
        after_ch: 80,
        excluded_ch: 20,
      }],
      total: { before_ch: 100, after_ch: 80, excluded_ch: 20 },
    },
    {
      order: 2,
      criterion_id: "minEligible",
      card_id: "minEligible",
      label: "Mínimo elegible",
      scope: "aula",
      gate: true,
      applies: true,
      status: "aplicado",
      faculties: [{
        faculty_key: "ingenieria",
        label: "Ingeniería",
        before_ch: 80,
        after_ch: 70,
        excluded_ch: 10,
      }],
      total: { before_ch: 80, after_ch: 70, excluded_ch: 10 },
    },
    {
      order: 3,
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
        before_ch: 70,
        after_ch: 70,
        excluded_ch: 0,
      }],
      total: { before_ch: 70, after_ch: 70, excluded_ch: 0 },
    },
  ],
};

const anchor: CalcMuestraCriteriosAnchorRow = {
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
};

const canonicalVariables: Array<[string, CriterioScope, CriterioKind]> = [
  ["formation", "alumno", "flat"],
  ["condition", "alumno", "flat"],
  ["age", "alumno", "numeric"],
  ["faculty", "alumno", "flat"],
  ["level", "alumno", "ordinal"],
  ["modality", "aula", "flat"],
  ["session_type", "aula", "flat"],
  ["condicion_curso", "aula", "flat"],
  ["teacher_type", "aula", "hierarchical"],
  ["course_level", "aula", "range"],
  ["enrolled_total", "aula", "numeric"],
];

const canonicalCatalog: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: canonicalVariables.map(([id, scope, kind]) => ({
    id,
    scope,
    kind,
    label: id,
    mappedColumn: id,
  })),
};

const canonicalRow: CalcMuestraAulasCriterioRadiografiaV2Row = {
  faculty_key: "ingenieria",
  faculty_label: "Ingeniería",
  segment_key: "segmento",
  segment_label: "Segmento observado",
  segment_kind: "categoria",
  actual: {
    n_ch: 10,
    n_ch_con_dato: 10,
    n_estudiantes_unicos: 100,
    n_matriculas: 120,
    distribution: { media: 12, p10: 4, p25: 8, p50: 11, p75: 15, p90: 20 },
  },
  contraste_total: {
    n_ch: 12,
    n_ch_con_dato: 12,
    n_estudiantes_unicos: 130,
    n_matriculas: 150,
    distribution: { media: 13, p10: 5, p25: 9, p50: 12, p75: 16, p90: 22 },
  },
  signal_distribution: {
    unit: "valor_criterio",
    n_total: 10,
    n_con_dato: 10,
    media: 12,
    p10: 4,
    p25: 8,
    p50: 11,
    p75: 15,
    p90: 20,
  },
  delta: {
    reference: "marco_ejecutado",
    action: "reemplazar_regla",
    reconstruccion_valida: true,
    delta_ch: -2,
    delta_matriculas: -30,
    delta_estudiantes_unicos: -30,
  },
};

function canonicalEntry(
  id: string,
  cardId = id,
  scope: CriterioScope = "aula",
  kind: CriterioKind | "gate" = "flat",
): CalcMuestraAulasCriterioRadiografiaV2Entry {
  if (scope === "alumno") {
    const row = kind === "numeric"
      ? { ...canonicalRow, segment_kind: "cumple" as const }
      : {
          ...canonicalRow,
          delta: { ...canonicalRow.delta, action: kind === "flat" ? "restringir_a_categoria" as const : "reemplazar_regla" as const },
        };
    return {
      id,
      card_id: cardId,
      label: id,
      scope: "alumno",
      family: kind === "numeric" ? "student_numeric" : kind === "ordinal" ? "student_ordinal" : "student_flat",
      owner: "calc_muestra_aulas_construir_v1.filas_alumno",
      kind: kind as "flat" | "numeric" | "ordinal",
      grain: "alumno_x_curso_horario_x_facultad",
      unit: "alumno_unico_por_curso_horario",
      gate: "poblacion",
      status: "disponible",
      effective_layer: "marco",
      overlap: false,
      faculty_dimension: "alumno",
      rows: [row],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
  }
  const composition = COMPOSITION_GATE_IDS.includes(id as (typeof COMPOSITION_GATE_IDS)[number]);
  const threshold = id === "minEligible";
  const gateFamily = composition || threshold;
  const row = gateFamily || kind === "range" || kind === "numeric"
    ? {
        ...canonicalRow,
        segment_kind: "cumple" as const,
        delta: { ...canonicalRow.delta, action: gateFamily ? "reemplazar_umbral" as const : "reemplazar_regla" as const },
      }
    : {
        ...canonicalRow,
        segment_kind: kind === "hierarchical" ? "grupo" as const : "categoria" as const,
        delta: { ...canonicalRow.delta, action: "restringir_a_categoria" as const },
      };
  return {
    id,
    card_id: cardId,
    label: id,
    scope: "aula",
    family: threshold
      ? "threshold_gate"
      : composition
        ? "proportion_gate"
        : kind === "hierarchical"
          ? "classroom_hierarchical"
          : kind === "range"
            ? "classroom_range"
            : kind === "numeric" ? "classroom_numeric" : "classroom_flat",
    owner: gateFamily ? "calc_muestra_aulas_criterios_v1" : "calc_muestra_aulas_frame_v1.aula_frame",
    kind: gateFamily ? "gate" : kind,
    grain: "curso_horario_x_facultad_x_segmento",
    unit: "curso_horario_unico",
    gate: "marco",
    status: "disponible",
    effective_layer: null,
    overlap: kind === "hierarchical",
    faculty_dimension: "curso_horario_efectiva",
    rows: [row],
  } as CalcMuestraAulasCriterioRadiografiaV2Entry;
}

function canonicalContracts() {
  const entries = [
    ...canonicalCatalog.variables.map((variable) => canonicalEntry(variable.id, variable.id, variable.scope, variable.kind)),
    canonicalEntry("minEligible", "minEligible", "aula", "gate"),
    ...COMPOSITION_GATE_IDS.map((id) => canonicalEntry(id, "composition", "aula", "gate")),
  ];
  const radiography: CalcMuestraAulasCriteriosRadiografiaV2 = {
    schema: "calc_muestra_aulas_criterios_radiografia_v2",
    owner: "calc_muestra_aulas_frame_v1.criterios_radiografia",
    frame_hash: "frame-canonical",
    momento: "marco_ejecutado",
    grano: "criterio_x_facultad_x_segmento",
    unidad: "curso_horario_unico",
    filas_owner: "calc_muestra_aulas_frame_v1.aula_frame",
    filas_grano: "session_type_x_facultad_efectiva",
    filas: [{
      criterio: "session_type",
      facultad_key: canonicalRow.faculty_key,
      facultad_label: canonicalRow.faculty_label,
      categoria_key: canonicalRow.segment_key,
      categoria_label: canonicalRow.segment_label,
      n_ch_total: canonicalRow.contraste_total.n_ch,
      n_ch_elegibles: canonicalRow.actual.n_ch,
      n_matriculas_elegibles: canonicalRow.actual.n_matriculas,
      distribucion_elegible: {
        n_ch_con_dato: canonicalRow.actual.n_ch_con_dato,
        ...canonicalRow.actual.distribution,
      },
      contraste_total: {
        n_ch_con_dato: canonicalRow.contraste_total.n_ch_con_dato,
        media: canonicalRow.contraste_total.distribution.media,
      },
      delta_marginal: {
        referencia: canonicalRow.delta.reference,
        accion: "restringir_a_categoria",
        delta_ch: canonicalRow.delta.delta_ch,
        delta_matriculas_elegibles: canonicalRow.delta.delta_matriculas,
      },
    }],
    criterios: entries,
  };
  const totals: CalcMuestraCriteriosTotales = {
    schema: "calc_muestra_aulas_criterios_totales_v1",
    owner: "calc_muestra_aulas_frame_v1.criterios_totales",
    source_schema: radiography.schema,
    source_frame_hash: radiography.frame_hash,
    momento: "marco_ejecutado",
    grain: "criterio_x_segmento",
    unit: "curso_horario_unico",
    rows: entries.map((entry) => ({
      criterion_id: entry.id,
      card_id: entry.card_id,
      label: entry.label,
      segment_key: entry.rows[0]!.segment_key,
      segment_label: entry.rows[0]!.segment_label,
      segment_kind: entry.rows[0]!.segment_kind,
      actual: canonicalRow.actual,
      contraste_total: canonicalRow.contraste_total,
      signal_distribution: canonicalRow.signal_distribution,
    })),
  };
  const cascadeContract: CalcMuestraCriteriosCascada = {
    schema: "calc_muestra_aulas_criterios_cascada_v1",
    owner: "calc_muestra_aulas_frame_v1.criterios_cascada",
    source_frame_hash: radiography.frame_hash,
    criteria_hash: "criteria-canonical",
    momento: "marco_ejecutado",
    grain: "paso_x_facultad_efectiva",
    unit: "curso_horario_unico",
    order_source: "motor_r",
    steps: entries.map((entry, index) => ({
      order: index + 1,
      criterion_id: entry.id,
      card_id: entry.card_id,
      label: entry.label,
      scope: entry.scope,
      gate: true,
      applies: true,
      status: "aplicado",
      faculties: [{
        faculty_key: "ingenieria",
        label: "Ingeniería",
        before_ch: entries.length + 1 - index,
        after_ch: entries.length - index,
        excluded_ch: 1,
      }],
      total: {
        before_ch: entries.length + 1 - index,
        after_ch: entries.length - index,
        excluded_ch: 1,
      },
    })).concat([{
      order: entries.length + 1,
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
        before_ch: 1,
        after_ch: 1,
        excluded_ch: 0,
      }],
      total: { before_ch: 1, after_ch: 1, excluded_ch: 0 },
    }]),
  };
  const anchors: CalcMuestraCriteriosAnclasHistoricas = {
    schema: "calc_muestra_criterios_anclas_historicas_v1",
    owner: "calc_muestra_aulas_frame_v1.criterios_anclas_historicas",
    source_frame_hash: radiography.frame_hash,
    reference_schema: "calc_muestra_referencia_asistencia_celdas_v1",
    reference_hash: "reference-canonical",
    periodo: "2025-1",
    grain: "criterio_x_facultad_efectiva",
    faculty_dimensions: ["alumno", "curso_horario_efectiva"],
    reference_faculty_dimension: "facultad_historica",
    rows: entries.map((entry) => ({
      ...anchor,
      criterion_id: entry.id,
      card_id: entry.card_id,
      faculty_dimension: entry.faculty_dimension,
    })),
  };
  return { radiography, totals, cascadeContract, anchors };
}

describe("superficie I18b de criterios", () => {
  it("dibuja P10–P90, caja P25–P75, mediana y media con cifras accesibles", () => {
    const html = renderToStaticMarkup(
      <CriterioBoxplotPercentilar
        label="Ingeniería · Teórico"
        distribution={{ media: 0, p10: 0, p25: 1, p50: 2, p75: 3, p90: 4 }}
      />,
    );
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain("P10 0");
    expect(html).toContain("P90 4");
    expect(html).toContain("Media 0");
    expect(html).toContain('data-mark="p10-p90"');
    expect(html).toContain('data-mark="p25-p75"');
    expect(html).toContain('data-mark="p50"');
    expect(html).toContain('data-mark="media"');
    expect(html).not.toContain("mínimo");
    expect(html).not.toContain("máximo");
  });

  it("S4: sobre un dominio compartido dos distribuciones distintas dibujan cajas distintas", () => {
    const estrecha = { media: 10, p10: 9, p25: 9.5, p50: 10, p75: 10.5, p90: 11 };
    const ancha = { media: 50, p10: 10, p25: 30, p50: 50, p75: 70, p90: 90 };
    const domain = boxplotDomain([estrecha, ancha]);
    expect(domain).toEqual({ low: 9, high: 90 });

    const anchoDe = (html: string) => {
      const match = html.match(/class="cmv2-i18b-boxplot-box"[^>]*width="([\d.]+)"/);
      return match ? Number(match[1]) : Number.NaN;
    };
    const render = (d: typeof estrecha, dom: typeof domain) =>
      renderToStaticMarkup(<CriterioBoxplotPercentilar label="x" distribution={d} domain={dom} />);

    // Con escala compartida la caja estrecha ocupa una fracción de la ancha.
    expect(anchoDe(render(estrecha, domain))).toBeLessThan(anchoDe(render(ancha, domain)) / 10);
    // Sin dominio cada figura se normalizaba sola y ambas salían idénticas:
    // ese era el defecto, y queda declarado en el markup.
    expect(anchoDe(render(estrecha, null))).toBeCloseTo(anchoDe(render(ancha, null)), 5);
    expect(render(estrecha, domain)).toContain('data-scale="compartida"');
    expect(render(estrecha, null)).toContain('data-scale="propia"');
    // La leyenda es del bloque, nunca de la figura.
    expect(render(estrecha, domain)).not.toContain("<figcaption");
    expect(renderToStaticMarkup(<CriterioBoxplotLeyenda domain={domain} unidad="alumnos por CH" />))
      .toContain("Escala compartida");
  });

  it("mantiene un vacío honesto si no hay seis estadísticos", () => {
    const html = renderToStaticMarkup(
      <CriterioBoxplotPercentilar
        label="Ingeniería"
        distribution={{ media: null, p10: null, p25: null, p50: null, p75: null, p90: null }}
      />,
    );
    expect(html).toContain("Sin distribución percentilar publicable");
    expect(html).not.toContain('<svg');
  });

  it("muestra desde el gate enfocado todos los pasos downstream en orden R", () => {
    const html = renderToStaticMarkup(
      <CriteriosEmbudoVivo
        cardId="session_type"
        executed={cascade}
        previewRequest={null}
      />,
    );
    expect(html.indexOf("Paso 1")).toBeLessThan(html.indexOf("Paso 2"));
    expect(html).toContain("100 → 80");
    expect(html).toContain("80 → 70");
    expect(html).toContain("Orden publicado por el motor R");
    expect(html).toContain("Cascada secuencial");
    expect(html).toContain("paso operativo fuera del denominador");
    expect(html).not.toContain("impacto marginal");
  });

  it("publica k, IC y degradación literal sin inferir coincidencias", () => {
    const html = renderToStaticMarkup(
      <CriterioAnclaHistorica cardId="session_type" rows={[anchor]} />,
    );
    expect(html).toContain("exacta");
    expect(html).toContain("k=12");
    expect(html).toContain("IC 95% 70.0%–90.0%");
    expect(html).toContain("bootstrap_percentil");
    expect(html).toContain("2025-1");
  });

  it("T3: un aviso que comparten todas las facultades se dice una sola vez", () => {
    const aviso = "El criterio no comparte una caracteristica compatible con la referencia.";
    const sinPublicar = (facultad: string) => ({
      ...anchor,
      faculty_key: facultad.toLowerCase(),
      faculty_label: facultad,
      match_level: "incompatible" as const,
      k: null,
      tasa: null,
      ic_low: null,
      ic_high: null,
      warning: aviso,
    });
    const html = renderToStaticMarkup(
      <CriterioAnclaHistorica
        cardId="session_type"
        rows={[sinPublicar("Derecho"), sinPublicar("Educación"), sinPublicar("Psicología")]}
      />,
    );
    // El aviso aparece una vez, no una por facultad.
    expect(html.match(new RegExp(aviso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(1);
    expect(html).toContain('data-anchor-shared="true"');
    // Ninguna facultad se pierde: las tres siguen nombradas y contadas.
    expect(html).toContain("Sin coincidencia publicable en 3 facultades");
    for (const facultad of ["Derecho", "Educación", "Psicología"]) {
      expect(html).toContain(facultad);
    }
    // La causa real —las dos dimensiones de facultad— sigue publicada.
    expect(html).toContain("Facultad de referencia");
  });

  it("clasifica la ausencia de ancla como estado honesto", () => {
    const html = renderToStaticMarkup(
      <CriterioAnclaHistorica cardId="session_type" rows={[]} />,
    );
    expect(html).toContain("Sin ancla histórica para este criterio");
    expect(html).toContain('data-state="sin_ancla"');
  });

  it("entrega juntas las tres capacidades en 13/13 tarjetas y 15/15 gates dinámicos", () => {
    const contracts = canonicalContracts();
    const model = buildCriteriosRadiografiaModel({
      catalogo: canonicalCatalog,
      radiografia: contracts.radiography,
      rawPresent: true,
    });
    expect(model.cards).toHaveLength(13);
    expect(model.expectedGateIds).toHaveLength(15);

    let renderedGates = 0;
    for (const card of model.cards) {
      renderedGates += card.gateIds.length;
      const html = renderToStaticMarkup(
        <CriteriosRadiografiaCardDetalle
          card={card}
          radiografia={contracts.radiography}
          totals={contracts.totals}
          cascade={contracts.cascadeContract}
          anchors={contracts.anchors}
        />,
      );
      expect(html, card.cardId).toContain('role="img"');
      expect(html, card.cardId).toContain("Total recalculado por R");
      expect(html, card.cardId).toContain("Cascada secuencial");
      expect(html, card.cardId).toContain('data-match-level="exacta"');
      expect(html, card.cardId).toContain(`data-card-id="${card.cardId}"`);
    }
    expect(renderedGates).toBe(15);
  });

  it("ensambla la superficie I18b en las dos rutas de criterios", () => {
    const contracts = canonicalContracts();
    const selection = {
      byVariable: {
        session_type: {
          categories: ["segmento"],
          exceptions: { ingenieria: { categories: ["segmento"], op: "replace" } },
        },
      },
    };
    const state = {
      frame: {
        schema: "calc_muestra_aulas_frame_v1",
        generated_at: "2026-08-02T00:00:00Z",
        input_mode: "base_madre",
        config: {},
        frame_hash: contracts.radiography.frame_hash,
        aula_frame: [{ classroom_id: "CH-1", included: true, eligible_n: 10, faculty: "Ingeniería" }],
        audit: [{ metric: "classroom_included_n", value: 1 }],
        warnings: [],
        criterios_catalogo: canonicalCatalog,
        criterios_seleccion: selection,
        criterios_radiografia: contracts.radiography,
        criterios_totales: contracts.totals,
        criterios_cascada: contracts.cascadeContract,
        criterios_anclas_historicas: contracts.anchors,
        exploracion: {
          schema: "calc_muestra_aulas_exploracion_v1",
          totales: {
            facultades: 1,
            ch_total: 1,
            ch_elegibles: 1,
            elegibles_total: 10,
            n_local_externo: 0,
            n_multi_facultad: 0,
          },
          por_facultad: [{
            facultad: "Ingeniería",
            ch_total: 1,
            ch_elegibles: 1,
            elegibles_total: 10,
            est_aula_mediana: 10,
            est_aula_media: 10,
            por_tipo_sesion: [],
            por_nivel: [],
            por_condicion: [],
            n_multi_facultad: 0,
            n_local_externo: 0,
            n_sin_condicion: 0,
            top_cursos: [],
          }],
        },
      },
    } as unknown as CalcMuestraAulasState;
    const workspace = {
      version: 2,
      frame_mode: "opinion_universitaria",
      aulas_config: { criterios_seleccion: selection },
    } as unknown as CalcMuestraWorkspace;
    const common = {
      workspace,
      aulasState: state,
      facultades: ["Ingeniería"],
      onWorkspace: () => {},
      onReconstruir: () => {},
      puedeReconstruir: true,
    };

    const studentRoute = renderToStaticMarkup(<CriteriosMarcoTab {...common} scope="alumno" />);
    const classroomRoute = renderToStaticMarkup(<CursosHorarioMarcoTab {...common} />);
    // F40 · Los criterios de estudiante son GENERALES y no llevan radiografía.
    //
    // La radiografía describe elegibles según una característica del
    // curso-horario, tomando en cuenta los criterios previos: pertenece a la
    // ruta de curso-horario, no a la de estudiante. Montarla aquí metía 637
    // elementos plegados en la pestaña y sugería una decisión por facultad que
    // en estos criterios no existe.
    expect(studentRoute).not.toContain('role="img"');
    expect(studentRoute).not.toContain("Radiografía por facultad");
    expect(studentRoute).not.toContain("cmv2-crit-exc");
    expect(studentRoute).not.toContain("<details");

    expect(classroomRoute).not.toContain("Radiografía antes de decidir");
    expect(classroomRoute).toContain('aria-label="Radiografía de session_type en Ingeniería"');
    expect(classroomRoute.match(/data-decision="transversal"/g)).toHaveLength(2);
    expect(classroomRoute).toContain("<strong>enrolled_total</strong>");
    expect(classroomRoute).toContain("<strong>Composición del curso-horario</strong>");
    // S3 (F7): la matriz es el resultado, así que CIERRA el recorrido — va
    // después de las decisiones y su resumen dice qué cierra y con qué tamaño,
    // no cómo usarla.
    expect(classroomRoute).toContain("Cierre del recorrido · impacto de cada criterio por facultad");
    expect(classroomRoute).not.toContain("solo cuando necesites contrastar");
    expect(classroomRoute.indexOf('aria-label="Decisión por facultad con su radiografía"')).toBeLessThan(
      classroomRoute.indexOf("Cierre del recorrido · impacto de cada criterio por facultad"),
    );
    expect(classroomRoute).toContain('class="cmv2-crc-compact"');
    expect(classroomRoute).toContain('data-context="faculty"');
    expect(classroomRoute).toContain('role="img"');
    expect(classroomRoute).toContain("Cascada secuencial");
    expect(classroomRoute).toContain("Ancla histórica");
    expect(classroomRoute).toContain('data-match-level="exacta"');
    expect(classroomRoute.indexOf('aria-label="Radiografía de session_type en Ingeniería"')).toBeLessThan(
      classroomRoute.indexOf('aria-label="session_type en Ingeniería"'),
    );
  });
});
