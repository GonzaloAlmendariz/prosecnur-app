import { describe, expect, test } from "vitest";
import { upsertAcreditacionActorGoal } from "./AcreditacionActorGoals";
import { buildAcreditacionPhoneRealAlertModel, buildAcreditacionPhoneSupervisionModel } from "./AcreditacionPhoneAlerts";
import { buildAcreditacionPhoneDailyPoints, buildAcreditacionPhoneDailyStatusSeries, buildAcreditacionPhoneDailyTableRows } from "./AcreditacionPhoneDailyTrend";
import {
  ACREDITACION_MODEL_TABS,
  ACREDITACION_CONSULTA_TABS,
  ACREDITACION_PHONE_TABS,
  advanceCardsFromRows,
  acreditacionConsultaShowsCutStatusStrip,
  acreditacionChannelLabel,
  acreditacionSubsanacionCaseGuide,
  acreditacionScheduleDraftFromPhases,
  acreditacionRowsForConsultaTab,
  buildAcreditacionPhoneSupervisionControlPlan,
  buildAcreditacionPhoneTimeControl,
  buildAcreditacionPhoneQuotaEditorRows,
  compactAdvanceDateTickLabel,
  acreditacionPhoneStatusLegendItems,
  caseKeyTraceSummary,
  caseIsActionableSubsanacion,
  caseIsSubsanacionCandidate,
  casePlatformActionLabel,
  caseResponseDateTimeLabel,
  caseResponseTimeDetailLabel,
  dailyPointsFromRows,
  phoneQuotaCardsForDashboard,
  phoneQuotaAdvanceCardsFromRows,
  phonePlatformComparisonTotals,
  phoneQuotaRowsForPanel,
  upsertAcreditacionFieldSchedulePhase,
} from "./AcreditacionMonitoreoPage";
import {
  acreditacionActorOptions,
  acreditacionSourceChannel,
  acreditacionSourceResponseCount,
  acreditacionSourceWithOperationalMetadata,
  acreditacionCollectorCountForSource,
  acreditacionCollectorsForSource,
  acreditacionSweepSourceForChannel,
  acreditacionSweepSources,
  acreditacionSurveySourceName,
  buildAcreditacionPhoneSourceContract,
  buildAcreditacionTelephoneChannels,
  buildAcreditacionActiveSourcesSummary,
} from "./AcreditacionSourcesModel";
import type { MonitoreoAcreditacionReports, MonitoreoInternalQueryCase, MonitoreoLinkCollector, MonitoreoSource, MonitoreoSourceMetadata, MonitoreoStrategyPhase } from "../../../../api/client";

function consultaCase(partial: Partial<MonitoreoInternalQueryCase>): MonitoreoInternalQueryCase {
  return {
    actor: "Egresados",
    person_label: "Ana Perez",
    case_key: "COD-001",
    response_id: "",
    date: "2026-06-01",
    source_id: "sm-egresados",
    source_label: "SurveyMonkey · Egresados",
    channel: "Web",
    collector_id: "collector-1",
    collector_name: "Web egresados",
    platform_state: "Completa",
    base_result: "Cruzo",
    base_record: "Base Egresados",
    base_source: "Universo Egresados",
    base_status: "Activo",
    decision: "Cuenta",
    decision_reason: "",
    advancement: "effective",
    issue_type: "",
    rule: "llave exacta",
    pending_exit: false,
    recovery_collector: false,
    response_row: 1,
    duplicate_count: 1,
    ...partial,
  };
}

describe("Acreditacion fuentes", () => {
  test("normaliza canales heredados a la lista operativa de acreditacion", () => {
    expect(acreditacionChannelLabel("Correo")).toBe("Correo");
    expect(acreditacionChannelLabel("email")).toBe("Correo");
    expect(acreditacionChannelLabel("Correo web")).toBe("Correo");
    expect(acreditacionChannelLabel("Ficha QR")).toBe("Ficha QR");
    expect(acreditacionChannelLabel("Presencial")).toBe("Ficha QR");
    expect(acreditacionChannelLabel("WhatsApp")).toBe("Enlace");
    expect(acreditacionChannelLabel("Enlace abierto")).toBe("Enlace");
    expect(acreditacionChannelLabel("SMS")).toBe("Enlace");
    expect(acreditacionChannelLabel("Telefónico")).toBe("Telefónico");
    expect(acreditacionChannelLabel("KoboToolbox")).toBe("Kobo");
  });
});

describe("Acreditacion telefonica", () => {
  test("la leyenda preserva todos los estados positivos de la base telefonica", () => {
    const rows = [
      { Estado: "Efectiva", Casos: 12 },
      { Estado: "Parcial", Casos: 3 },
      { Estado: "Rechazo", Casos: 2 },
      { Estado: "Sin respuesta", Casos: 7 },
      { Estado: "No contesta", Casos: 5 },
      { Estado: "Numero incorrecto", Casos: 4 },
      { Estado: "Reprogramada", Casos: 2 },
      { Estado: "Fuera de servicio", Casos: 1 },
      { Estado: "Sin casos", Casos: 0 },
    ];

    const items = acreditacionPhoneStatusLegendItems(rows);

    expect(items).toHaveLength(8);
    expect(items.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Efectiva",
      "Parcial",
      "Rechazo",
      "Sin respuesta",
      "No contesta",
      "Numero incorrecto",
      "Reprogramada",
      "Fuera de servicio",
    ]));
  });
});

describe("Acreditacion consultas", () => {
  test("expone las cuatro pestañas operativas en el orden esperado", () => {
    expect(ACREDITACION_CONSULTA_TABS.map((tab) => tab.key)).toEqual([
      "plataforma",
      "base",
      "cruces",
      "subsanacion",
    ]);
  });

  test("omite el resumen de corte en subsanacion para recuperar altura util", () => {
    expect(acreditacionConsultaShowsCutStatusStrip("plataforma")).toBe(false);
    expect(acreditacionConsultaShowsCutStatusStrip("base")).toBe(false);
    expect(acreditacionConsultaShowsCutStatusStrip("cruces")).toBe(true);
    expect(acreditacionConsultaShowsCutStatusStrip("subsanacion")).toBe(false);
  });

  test("registros en plataforma solo muestra respuestas y las ordena por fecha/hora descendente", () => {
    const rows = [
      consultaCase({
        person_label: "Base sin respuesta",
        case_key: "COD-BASE",
        response_id: "",
        response_datetime: "",
        date: "2026-06-03",
        platform_state: "Sin respuesta",
        advancement: "pending",
      }),
      consultaCase({
        person_label: "Respuesta antigua",
        response_id: "resp-1",
        response_datetime: "2026-06-03T10:15:00Z",
        response_row: 8,
      }),
      consultaCase({
        person_label: "Respuesta reciente",
        response_id: "resp-2",
        response_datetime: "2026-06-04T09:30:00Z",
        response_row: 2,
      }),
    ];

    expect(acreditacionRowsForConsultaTab(rows, "plataforma").map((item) => item.response_id)).toEqual([
      "resp-2",
      "resp-1",
    ]);
  });

  test("estado de la base preserva una fila por caso de universo", () => {
    const rows = [
      consultaCase({ person_label: "Ana", case_key: "COD-001", response_id: "" }),
      consultaCase({ person_label: "Luis", case_key: "COD-002", response_id: "resp-2" }),
    ];

    expect(acreditacionRowsForConsultaTab(rows, "base").map((item) => item.case_key)).toEqual([
      "COD-001",
      "COD-002",
    ]);
  });

  test("subsanacion distingue no cruces accionables de rechazos no identificables", () => {
    const completeNoCross = consultaCase({
      response_id: "resp-completa",
      base_result: "Sin cruce",
      platform_state: "Completa",
      advancement: "excluded",
    });
    const partialNoCross = consultaCase({
      response_id: "resp-parcial",
      base_result: "Sin llave",
      platform_state: "Parcial",
      advancement: "partial",
    });
    const refusalNoCross = consultaCase({
      response_id: "resp-rechazo",
      base_result: "Sin llave",
      platform_state: "Rechazo",
      advancement: "refusal",
      identity_status: "No identificable",
    });
    const crossed = consultaCase({
      response_id: "resp-cruzada",
      base_result: "Cruzo por llave",
      platform_state: "Completa",
    });

    expect(caseIsSubsanacionCandidate(completeNoCross)).toBe(true);
    expect(caseIsActionableSubsanacion(completeNoCross)).toBe(true);
    expect(caseIsActionableSubsanacion(partialNoCross)).toBe(true);
    expect(caseIsSubsanacionCandidate(refusalNoCross)).toBe(true);
    expect(caseIsActionableSubsanacion(refusalNoCross)).toBe(false);
    expect(caseIsSubsanacionCandidate(crossed)).toBe(false);
  });

  test("registros en plataforma etiqueta parciales cerradas por una completa posterior", () => {
    const partial = consultaCase({
      response_id: "resp-parcial",
      response_datetime: "2026-07-01T10:00:00Z",
      platform_state: "Parcial",
      advancement: "partial",
      counts_in_advance: false,
      duplicate_group_size: 2,
    });
    const laterComplete = consultaCase({
      response_id: "resp-completa",
      response_datetime: "2026-07-02T10:00:00Z",
      platform_state: "Completa",
      advancement: "effective",
      counts_in_advance: true,
      duplicate_group_size: 2,
    });
    const earlierComplete = consultaCase({
      response_id: "resp-completa-antigua",
      response_datetime: "2026-06-30T10:00:00Z",
      platform_state: "Completa",
      advancement: "effective",
      counts_in_advance: true,
      duplicate_group_size: 2,
    });

    expect(casePlatformActionLabel(partial, [partial, laterComplete])).toBe("Completada después");
    expect(casePlatformActionLabel(partial, [partial, earlierComplete])).toBe("Sin subsanación");
    expect(casePlatformActionLabel(partial, [partial])).toBe("Sin subsanación");
  });

  test("guia de subsanacion orienta la accion segun evidencia disponible", () => {
    const candidate = {
      candidate_id: "base-ana",
      person_label: "Ana Perez",
      case_key: "COD-001",
      base_record: "Base Egresados",
      base_source: "Universo",
      base_row: 12,
      base_status: "Pendiente",
      match_type: "email_code",
      match_label: "Correo y codigo exactos",
      evidence_level: "exact",
      evidence_label: "Correo y codigo exactos",
      current_status: "Pendiente",
      already_effective: false,
    };

    const withCandidate = acreditacionSubsanacionCaseGuide(consultaCase({
      response_id: "resp-candidato",
      base_result: "Sin cruce",
      platform_state: "Completa",
      advancement: "excluded",
      assisted_review: { eligible: true, assignment_candidates: [candidate] },
    }));

    expect(withCandidate.tone).toBe("ready");
    expect(withCandidate.primaryAction).toContain("Elegir persona");

    const missingKey = acreditacionSubsanacionCaseGuide(consultaCase({
      response_id: "resp-sin-llave",
      base_result: "Sin llave",
      case_key: "",
      platform_state: "Completa",
      advancement: "excluded",
      primary_identity_value: "",
      secondary_identity_label: "Correo declarado",
      secondary_identity_value: "ana.perez@pucp.edu.pe",
    }));

    expect(missingKey.tone).toBe("warning");
    expect(missingKey.title).toContain("evidencia auxiliar");

    const refusal = acreditacionSubsanacionCaseGuide(consultaCase({
      response_id: "resp-rechazo",
      base_result: "Sin llave",
      platform_state: "Rechazo",
      advancement: "refusal",
    }));

    expect(refusal.tone).toBe("blocked");
    expect(refusal.primaryAction).toBe("Mantener excluida");
  });

  test("fecha de respuesta muestra hora cuando llega response_datetime", () => {
    const label = caseResponseDateTimeLabel(consultaCase({
      response_id: "resp-hora",
      response_datetime: "2026-06-02T15:30:00Z",
    }));

    expect(label).toMatch(/\d{1,2}:\d{2}/);
  });

  test("detalle temporal evita exponer numero de fila como fecha", () => {
    expect(caseResponseTimeDetailLabel(consultaCase({
      response_id: "resp-sin-hora",
      response_datetime: "",
      response_row: 1205,
    }))).toBe("Sin hora registrada");
    expect(caseResponseTimeDetailLabel(consultaCase({
      response_id: "resp-con-hora",
      response_datetime: "2026-06-02T15:30:00Z",
      response_row: 1205,
    }))).toMatch(/\d{1,2}:\d{2}/);
  });

  test("explicita la llave usada por canal para subsanar no cruces", () => {
    const phoneTrace = caseKeyTraceSummary(consultaCase({
      channel: "Telefónico",
      channel_key_strategy: "telefono_enlace_y_codigo_final",
      channel_key_strategy_label: "Telefónico: enlace personalizado + código final",
      primary_identity_label: "Enlace usado",
      primary_identity_value: "cv-422658144",
      secondary_identity_label: "Código final",
      secondary_identity_value: "20201234",
      base_result: "Sin cruce",
      base_record: "",
    }));

    expect(phoneTrace.strategyLabel).toBe("Telefónico: enlace personalizado + código final");
    expect(phoneTrace.primaryEvidence).toBe("Enlace usado: cv-422658144");
    expect(phoneTrace.secondaryEvidence).toBe("Código final: 20201234");

    const qrTrace = caseKeyTraceSummary(consultaCase({
      channel: "Ficha QR",
      channel_key_strategy: "pregunta_pucp_qr",
      primary_identity_label: "Código PUCP declarado",
      primary_identity_value: "2020O123",
      secondary_identity_label: "Correo declarado",
      secondary_identity_value: "ana.perez@pucp.edu.pe",
      base_result: "Sin cruce",
      base_record: "",
    }));

    expect(qrTrace.strategyLabel).toBe("QR presencial: pregunta de código PUCP");
    expect(qrTrace.primaryEvidence).toBe("Código PUCP declarado: 2020O123");
    expect(qrTrace.secondaryEvidence).toBe("Correo declarado: ana.perez@pucp.edu.pe");
    expect(qrTrace.strategyHint).toContain("digitación");

    const configuredLinkTrace = caseKeyTraceSummary(consultaCase({
      channel: "Enlace",
      channel_key_strategy_label: "Llave configurada por fuente",
      primary_identity_value: "",
      secondary_identity_label: "Correo declarado",
      secondary_identity_value: "ana.perez@pucp.edu.pe",
      base_result: "Sin llave",
      case_key: "",
    }));

    expect(configuredLinkTrace.strategyLabel).toBe("Enlace: llave configurada por fuente");
    expect(configuredLinkTrace.primaryEvidence).toBe("Llave leída: Sin llave declarada");
    expect(configuredLinkTrace.strategyHint).toContain("llave configurada para Enlace");
  });
});

describe("Acreditacion actor goals", () => {
  test("actualiza la meta del actor sin duplicar ni tocar otros actores", () => {
    const goals = upsertAcreditacionActorGoal({
      goals: [
        { filters: { dim_actor: "Egresados" }, meta: 108, meta_pct: 40 },
        { filters: { dim_actor: "Estudiantes" }, meta: 126, meta_pct: 70 },
      ],
      actor: "Egresados",
      meta: 120,
      metaPct: 44.4,
      goalKey: "dim_actor",
    });

    expect(goals).toEqual([
      { filters: { dim_actor: "Egresados" }, meta: 120, meta_pct: 44.4 },
      { filters: { dim_actor: "Estudiantes" }, meta: 126, meta_pct: 70 },
    ]);
  });

  test("crea meta por actor cuando no existe una configuracion previa", () => {
    const goals = upsertAcreditacionActorGoal({
      goals: [],
      actor: "Docentes",
      meta: 55,
      metaPct: 25,
      goalKey: "dim_actor",
    });

    expect(goals).toEqual([
      { filters: { dim_actor: "Docentes" }, meta: 55, meta_pct: 25 },
    ]);
  });
});

describe("Acreditacion avance", () => {
  test("calcula el porcentaje de progreso sobre el universo base y no sobre la meta", () => {
    const [card] = advanceCardsFromRows([
      {
        Actor: "Egresados",
        Universo: 200,
        Efectivas: 100,
        Parciales: 15,
        Rechazos: 5,
        Meta: 100,
      },
    ]);

    expect(card.progress).toBeCloseTo(50);
    expect(card.coverage).toBeCloseTo(50);
    expect(card.missing).toBe(0);
    expect(card.statusTone).toBe("complete");
  });

  test("mantiene el estado de meta separado del porcentaje sobre base", () => {
    const [card] = advanceCardsFromRows([
      {
        Actor: "Docentes",
        Universo: 200,
        Efectivas: 80,
        Meta: 100,
      },
    ]);

    expect(card.progress).toBeCloseTo(40);
    expect(card.missing).toBe(20);
    expect(card.statusTone).toBe("steady");
  });
});

describe("Acreditacion modelo compacto", () => {
  const basePhase: MonitoreoStrategyPhase = {
    id: "fase-existente",
    stratum: "Acreditación",
    modality: "mixto",
    start_week: 1,
    end_week: 2,
    start_date: "2026-07-01",
    end_date: "2026-07-14",
    client_report_weekday: "miercoles",
    client_report_exceptions: [{ week: 2, weekday: "viernes", date: "2026-07-10", note: "Comité" }],
    target_rule: "Regla existente",
    kpi_focus: ["meta actor"],
    kpi_modules: ["progress"],
    breakdown_vars: [],
    attempts_var: "",
    outcome_var: "",
  };

  test("expone las tres pestañas metodológicas sin superficies editables de Fuentes", () => {
    expect(ACREDITACION_MODEL_TABS.map((tab) => tab.key)).toEqual(["estructura", "estrategias", "resumen"]);
    expect(ACREDITACION_MODEL_TABS.map((tab) => tab.label)).toEqual(["Modelo operativo", "Cronograma", "Resumen"]);
  });

  test("deriva el borrador de cronograma desde la fase operativa existente", () => {
    expect(acreditacionScheduleDraftFromPhases([basePhase])).toEqual({
      startWeek: 1,
      durationWeeks: 2,
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      reportWeekday: "miercoles",
    });
  });

  test("guarda semanas y dia de reporte sin borrar excepciones compatibles", () => {
    const next = upsertAcreditacionFieldSchedulePhase([basePhase], {
      startWeek: 2,
      durationWeeks: 4,
      startDate: "2026-07-08",
      endDate: "2026-08-02",
      reportWeekday: "viernes",
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: "fase-existente",
      start_week: 2,
      end_week: 5,
      start_date: "2026-07-08",
      end_date: "2026-08-02",
      client_report_weekday: "viernes",
      client_report_exceptions: basePhase.client_report_exceptions,
      target_rule: "Regla existente",
    });
  });
});

describe("Acreditacion source model", () => {
  const surveySource: MonitoreoSource = {
    id: "sm-docentes",
    kind: "surveymonkey",
    label: "SurveyMonkey · Docentes · Personalizado",
    enabled: true,
    role: "respuestas",
    survey_id: "123",
    survey_title: "Encuesta de satisfaccion docente 2026",
    dimensions: { actor: "Docentes", canal: "Correo" },
    collectors: [
      {
        collector_id: "c-web",
        collector_name: "Correo institucional junio",
        collector_type: "email",
        response_count: 27,
        metadata_source: "surveymonkey_sync",
      },
    ],
    last_sync_at: "2026-06-28T20:00:00Z",
  };

  const linkCollectors: MonitoreoLinkCollector[] = [
    {
      id: "sm-docentes::c-web",
      source_id: "sm-docentes",
      source_label: "Encuesta de satisfaccion docente 2026",
      survey_id: "123",
      collector_id: "c-web",
      collector_name: "Docentes correo principal",
      collector_type: "email",
      enabled: true,
      channel: "Correo",
      operational_use: "correo_autoaplicado",
      modality: "email",
      roster_required: false,
    },
    {
      id: "sm-docentes::c-legacy",
      source_id: "sm-docentes",
      source_label: "Encuesta de satisfaccion docente 2026",
      survey_id: "123",
      collector_id: "c-legacy",
      collector_name: "Alias historico",
      collector_type: "weblink",
      enabled: false,
      channel: "Ficha QR",
      operational_use: "enlace_abierto",
      modality: "presencial",
      roster_required: false,
    },
  ];

  test("prioriza el nombre real de SurveyMonkey por encima del alias sintetico", () => {
    expect(acreditacionSurveySourceName(surveySource)).toBe("Encuesta de satisfaccion docente 2026");
  });

  test("combina actores detectados con actores manuales sin duplicar", () => {
    expect(acreditacionActorOptions([surveySource], ["Docentes", "Egresados"])).toEqual([
      "Docentes",
      "Egresados",
    ]);
  });

  test("agrupa recopiladores por encuesta preservando nombre real y alias operativo", () => {
    const collectors = acreditacionCollectorsForSource(surveySource, linkCollectors);

    expect(collectors.map((collector) => [collector.collectorId, collector.platformName, collector.alias, collector.enabled])).toEqual([
      ["c-web", "Correo institucional junio", "Docentes correo principal", true],
      ["c-legacy", "", "Alias historico", false],
    ]);
  });

  test("hereda el canal base de la encuesta cuando el recopilador no declara excepcion", () => {
    const collectors = acreditacionCollectorsForSource({
      ...surveySource,
      collectors: [
        ...(surveySource.collectors ?? []),
        {
          collector_id: "c-default",
          collector_name: "Link heredado",
          collector_type: "weblink",
          response_count: 3,
        },
      ],
    }, linkCollectors);

    expect(collectors.find((collector) => collector.collectorId === "c-default")?.channel).toBe("Correo");
    expect(collectors.find((collector) => collector.collectorId === "c-legacy")?.channel).toBe("Ficha QR");
  });

  test("usa el canal de plataforma cuando la encuesta no tiene canal elegido", () => {
    const collectors = acreditacionCollectorsForSource({
      ...surveySource,
      id: "sm-estudiantes-sin-canal",
      survey_id: "792",
      dimensions: { actor: "Estudiantes" },
      collectors: [
        {
          collector_id: "c-platform",
          collector_name: "Web Link 1",
          collector_type: "weblink",
          channel: "WhatsApp",
          response_count: 9,
        },
      ],
    }, []);

    expect(collectors[0]?.channel).toBe("WhatsApp");
  });

  test("calcula respuestas desde cursor de sync o recopiladores reales", () => {
    expect(acreditacionSourceResponseCount({
      ...surveySource,
      sync_cursor: { fetched_count: 0, remote_total: 42 },
    }, linkCollectors)).toBe(42);

    expect(acreditacionSourceResponseCount({
      ...surveySource,
      sync_cursor: undefined,
      collectors: [
        { collector_id: "c-web", collector_name: "Correo", response_count: 27 },
        { collector_id: "c-link", collector_name: "Enlace", active_response_count: 3, response_count: 8 },
      ],
    }, [])).toBe(30);
  });

  test("usa metadata local de snapshot cuando una encuesta personalizada no guarda recopiladores propios", () => {
    const personalizedSource: MonitoreoSource = {
      ...surveySource,
      id: "sm-contabilidad-docentes-personalizado",
      label: "Acreditación Contabilidad PUCP - Docentes Personalizado",
      survey_id: "422658144",
      survey_title: "Acreditación Contabilidad PUCP - Docentes Personalizado",
      collectors: [],
      last_sync_at: "",
      dimensions: { actor: "Docentes", canal: "WhatsApp" },
    };
    const metadata: MonitoreoSourceMetadata = {
      generated_at: "2026-06-28T19:00:21Z",
      surveys: {
        "sm-contabilidad-docentes-personalizado": {
          source_id: "sm-contabilidad-docentes-personalizado",
          survey_id: "422658144",
          title: "Acreditación Contabilidad PUCP - Docentes Personalizado",
          label: "SurveyMonkey · Docentes · Personalizado",
          actor: "Docentes",
          channel: "WhatsApp",
          response_count: 52,
          collector_count: 1,
        },
      },
      collectors: [
        {
          id: "sm-contabilidad-docentes-personalizado::439964780",
          source_id: "sm-contabilidad-docentes-personalizado",
          source_label: "SurveyMonkey · Docentes · Personalizado",
          survey_id: "422658144",
          collector_id: "439964780",
          collector_name: "Web Link 1",
          collector_type: "weblink",
          enabled: true,
          channel: "WhatsApp",
          operational_use: "enlace_abierto",
          configured_use: "enlace_abierto",
          suggested_use: "enlace_abierto",
          modality: "whatsapp",
          roster_required: false,
          response_count: 52,
          active_response_count: 52,
          recipient_summary: {
            available: false,
            total: 0,
            scanned: 0,
            truncated: false,
            personalized_link_count: 0,
            mail_status_counts: {},
            response_status_counts: { completed: 46, partial: 6 },
          },
          url_present: true,
          metadata_source: "responses_snapshot",
          warnings: [],
        },
      ],
    };

    const hydratedSource = acreditacionSourceWithOperationalMetadata(personalizedSource, metadata);
    const collectors = acreditacionCollectorsForSource(hydratedSource, []);

    expect(hydratedSource.last_sync_at).toBe("2026-06-28T19:00:21Z");
    expect(acreditacionCollectorCountForSource(hydratedSource, [])).toBe(1);
    expect(acreditacionSourceChannel(hydratedSource)).toBe("WhatsApp");
    expect(acreditacionSourceResponseCount(hydratedSource, [])).toBe(52);
    expect(collectors[0]).toMatchObject({
      collectorId: "439964780",
      platformName: "Web Link 1",
      channel: "WhatsApp",
      responseCount: 52,
    });
  });

  test("declara Correo para actores institucionales solo cuando no hay canal elegido", () => {
    const adminSource: MonitoreoSource = {
      ...surveySource,
      id: "sm-administrativos",
      label: "Acreditacion Contabilidad PUCP - Administrativos",
      survey_id: "789",
      survey_title: "Acreditacion Contabilidad PUCP - Administrativos",
      dimensions: { actor: "Administrativos" },
      collectors: [
        {
          collector_id: "c-admin",
          collector_name: "Correo institucional",
          collector_type: "weblink",
          response_count: 12,
        },
      ],
    };

    expect(acreditacionSourceChannel(adminSource)).toBe("Correo");
    expect(acreditacionCollectorsForSource(adminSource, []).find((collector) => collector.collectorId === "c-admin")?.channel).toBe("Correo");
  });

  test("respeta el canal elegido por encuesta sobre inferencias del actor o recopilador", () => {
    const whatsappSource: MonitoreoSource = {
      ...surveySource,
      id: "sm-docentes-whatsapp",
      label: "Acreditacion Contabilidad PUCP - Docentes WhatsApp",
      survey_id: "790",
      survey_title: "Acreditacion Contabilidad PUCP - Docentes WhatsApp",
      dimensions: { actor: "Docentes", canal: "Enlace personalizado (Whatsapp)" },
      collectors: [
        {
          collector_id: "c-docentes-whatsapp",
          collector_name: "Correo institucional historico",
          collector_type: "weblink",
          channel: "Correo",
          response_count: 8,
        },
      ],
    };
    const qrSource: MonitoreoSource = {
      ...surveySource,
      id: "sm-estudiantes-qr",
      label: "Acreditacion Contabilidad PUCP - Estudiantes",
      survey_id: "791",
      survey_title: "Acreditacion Contabilidad PUCP - Estudiantes",
      dimensions: { actor: "Estudiantes", canal: "Presencial (Ficha QR)" },
      collectors: [
        {
          collector_id: "c-estudiantes-qr",
          collector_name: "Correo tecnico heredado",
          collector_type: "weblink",
          channel: "Correo",
          response_count: 18,
        },
      ],
    };

    expect(acreditacionSourceChannel(whatsappSource)).toBe("Enlace personalizado (Whatsapp)");
    expect(acreditacionCollectorsForSource(whatsappSource, [])[0]?.channel).toBe("Enlace personalizado (Whatsapp)");
    expect(acreditacionChannelLabel(acreditacionSourceChannel(qrSource))).toBe("Ficha QR");
    expect(acreditacionCollectorsForSource(qrSource, [])[0]?.channel).toBe("Presencial (Ficha QR)");
  });

  test("resume fuentes activas con faltantes de Sheets y metadata de recopiladores", () => {
    const summary = buildAcreditacionActiveSourcesSummary([
      surveySource,
      {
        id: "kobo-pdm",
        kind: "kobo",
        label: "Kobo PDM",
        enabled: true,
        role: "respuestas",
        asset_uid: "aKoboAsset123",
        survey_title: "Post-Distribution Monitoring",
        dimensions: { actor: "Egresados", servicio: "Respuestas Kobo" },
      },
      {
        id: "gs-estudiantes",
        kind: "google_sheets",
        label: "Base Estudiantes",
        enabled: true,
        role: "universo",
        dimensions: { actor: "Estudiantes" },
      },
    ], linkCollectors);

    expect(summary).toMatchObject({
      activeSurveys: 2,
      surveysWithActor: 2,
      activeSheetBases: 1,
      actorsWithSurvey: ["Docentes", "Egresados"],
      actorsWithSheet: ["Estudiantes"],
      missingSheetActors: ["Docentes", "Egresados"],
      includedCollectors: 1,
      excludedCollectors: 1,
      missingCollectorMetadata: 1,
    });
  });

  test("detecta canales telefonicos desde Enlaces y empata la hoja de barrido confirmada", () => {
    const phoneSurvey: MonitoreoSource = {
      ...surveySource,
      id: "sm-egresados",
      label: "SurveyMonkey · Egresados",
      survey_id: "456",
      survey_title: "Encuesta Egresados",
      dimensions: { actor: "Egresados", canal: "Web" },
    };
    const phoneCollectors: MonitoreoLinkCollector[] = [
      {
        id: "sm-egresados::c-phone",
        source_id: "sm-egresados",
        source_label: "Encuesta Egresados",
        survey_id: "456",
        collector_id: "c-phone",
        collector_name: "Barrido telefonico egresados",
        collector_type: "weblink",
        enabled: true,
        channel: "Telefónico",
        operational_use: "telefono_asistido",
        modality: "telefono",
        roster_required: true,
      },
    ];
    const sweepSource: MonitoreoSource = {
      id: "gs-barrido-egresados",
      kind: "google_sheets",
      label: "Barrido telefónico - Egresados",
      enabled: true,
      role: "barrido",
      dimensions: {
        actor: "Egresados",
        canal: "Telefónico",
        survey_source_id: "sm-egresados",
        collector_id: "c-phone",
      },
      sheet_binding: {
        spreadsheet_id: "1example",
        sheet_name: "MONITOREOS_TELEFONICOS",
        header_row: 1,
        range: "",
        last_read_at: "",
        snapshot_hash: "",
      },
    };

    const phoneChannels = buildAcreditacionTelephoneChannels([phoneSurvey, sweepSource], phoneCollectors);
    const sweepSources = acreditacionSweepSources([phoneSurvey, sweepSource]);

    expect(phoneChannels).toHaveLength(1);
    expect(phoneChannels[0]).toMatchObject({
      sourceId: "sm-egresados",
      collectorId: "c-phone",
      actor: "Egresados",
      rosterRequired: true,
    });
    expect(acreditacionSweepSourceForChannel(sweepSources, phoneChannels[0])?.id).toBe("gs-barrido-egresados");
  });

  test("separa base de universo y barrido en el contrato telefonico", () => {
    const universeSource: MonitoreoSource = {
      id: "acnur-pdm-universo",
      kind: "google_sheets",
      label: "11_ACNUR_PDM_Base telefonica / Universo",
      enabled: true,
      role: "universo",
      dimensions: { sede: "sede", atencion: "atencion" },
      sheet_binding: {
        spreadsheet_id: "1V9Tjh-suREXNEyZ8ZapTVmHiNqLRipJ-1085mwMKPZw",
        sheet_name: "Barrido",
        header_row: 1,
        range: "Barrido!A1:F1770",
        last_read_at: "2026-06-30T06:10:48-0500",
        snapshot_hash: "",
      },
    };

    const contract = buildAcreditacionPhoneSourceContract([universeSource]);

    expect(acreditacionSweepSources([universeSource])).toEqual([]);
    expect(contract.universe.ready).toBe(true);
    expect(contract.sweep.ready).toBe(false);
    expect(contract.platform.ready).toBe(false);
    expect(contract.missing).toEqual(["barrido", "plataforma"]);
    expect(contract.universe.sources[0]?.id).toBe("acnur-pdm-universo");

    const sweepSource: MonitoreoSource = {
      id: "gs-barrido",
      kind: "google_sheets",
      label: "Base de barrido",
      enabled: true,
      role: "barrido",
      sheet_binding: {
        spreadsheet_id: "1V9Tjh-suREXNEyZ8ZapTVmHiNqLRipJ-1085mwMKPZw",
        sheet_name: "Barrido",
        header_row: 1,
        range: "Barrido!A1:F1770",
        last_read_at: "2026-06-30T06:10:48-0500",
        snapshot_hash: "",
      },
    };
    const koboSource: MonitoreoSource = {
      id: "kobo-plataforma",
      kind: "kobo",
      label: "Kobo egresados",
      enabled: true,
      role: "respuestas",
      asset_uid: "aKoboAsset123",
      survey_title: "11_ACNUR_PDM_Plataforma",
      base_url: "https://kf.kobotoolbox.org",
      dimensions: { actor: "Egresados", canal: "Telefónico" },
    };

    const completeContract = buildAcreditacionPhoneSourceContract([universeSource, sweepSource, koboSource]);

    expect(completeContract.ready).toBe(true);
    expect(completeContract.platform.sources[0]?.id).toBe("kobo-plataforma");
    expect(completeContract.missing).toEqual([]);
  });
});

describe("Acreditacion phone daily points", () => {
  test("separa alertas reales de supervisión telefónica en pestañas distintas", () => {
    expect(ACREDITACION_PHONE_TABS.map((tab) => tab.key)).toEqual([
      "resumen",
      "dia",
      "incidencia",
      "responsables",
      "alertas",
      "supervision",
    ]);
  });

  test("ignora filas cabecera y conserva la serie diaria telefónica real", () => {
    const points = buildAcreditacionPhoneDailyPoints([
      { Fecha: "ECHA", Efectivas: 0, Parciales: 0, "Rechazos telefónicos": 0 },
      { Fecha: "Fecha", Efectivas: 0, Parciales: 0, "Rechazos telefónicos": 0 },
      { Fecha: "2026-06-05", Efectivas: 38, Parciales: 0, "Rechazos telefónicos": 1 },
      { Fecha: "2026-06-03", Efectivas: 10, Parciales: 0, "Rechazos telefónicos": 1 },
      { Fecha: "Sin fecha", Efectivas: 1, Parciales: 0, "Rechazos telefónicos": 0 },
    ]);

    expect(points.map((point) => point.rawLabel)).toEqual([
      "2026-06-03",
      "2026-06-05",
      "Sin fecha",
    ]);
    expect(points.map((point) => point.effective + point.partial + point.refusals)).toEqual([11, 39, 1]);
    expect(points.some((point) => ["fecha", "echa"].includes(point.rawLabel.toLowerCase()))).toBe(false);
  });

  test("lee avance diario cuando las fechas son columnas y los estados son filas", () => {
    const points = buildAcreditacionPhoneDailyPoints([
      { Estado: "Efectivas telefónicas", "3/6/2026": 10, "4/6/2026": 28, "Sin fecha": 1 },
      { Estado: "Parciales", "3/6/2026": 0, "4/6/2026": 2, "Sin fecha": 0 },
      { Estado: "Rechazos telefónicos", "3/6/2026": 1, "4/6/2026": 0, "Sin fecha": 0 },
      { Estado: "Barridos", "3/6/2026": 11, "4/6/2026": 30, "Sin fecha": 1 },
    ]);

    expect(points.map((point) => point.rawLabel)).toEqual(["3/6/2026", "4/6/2026", "Sin fecha"]);
    expect(points.map((point) => ({
      effective: point.effective,
      partial: point.partial,
      refusals: point.refusals,
    }))).toEqual([
      { effective: 10, partial: 0, refusals: 1 },
      { effective: 28, partial: 2, refusals: 0 },
      { effective: 1, partial: 0, refusals: 0 },
    ]);
  });

  test("orienta la tabla diaria con estados como filas y fechas como columnas", () => {
    const rows = buildAcreditacionPhoneDailyTableRows([
      { Fecha: "4/6/2026", Efectivas: 28, Parciales: 0, "Rechazos telefónicos": 0 },
      { Fecha: "3/6/2026", Efectivas: 10, Parciales: 1, "Rechazos telefónicos": 1 },
      { Fecha: "Sin fecha", Efectivas: 1, Parciales: 0, "Rechazos telefónicos": 0 },
    ]);

    expect(rows).toEqual([
      { Estado: "Efectivas", "3/6/2026": 10, "4/6/2026": 28, "Sin fecha": 1 },
      { Estado: "Parciales", "3/6/2026": 1, "4/6/2026": 0, "Sin fecha": 0 },
      { Estado: "Rechazos telefónicos", "3/6/2026": 1, "4/6/2026": 0, "Sin fecha": 0 },
    ]);
  });

  test("preserva estados telefonicos diarios ampliados para monitoreo telefonico standalone", () => {
    const series = buildAcreditacionPhoneDailyStatusSeries([
      { Estado: "No contesta", "2026-06-01": 3, "2026-06-02": 1, Total: 4 },
      { Estado: "Apagado", "2026-06-01": 0, "2026-06-02": 2, Total: 2 },
      { Estado: "Efectiva", "2026-06-01": 1, "2026-06-02": 0, Total: 1 },
    ]);

    expect(series.map((item) => [item.label, item.total])).toEqual([
      ["No contesta", 4],
      ["Apagado", 2],
      ["Efectiva", 1],
    ]);
    expect(series[0].points.map((point) => [point.rawLabel, point.value])).toEqual([
      ["2026-06-01", 3],
      ["2026-06-02", 1],
    ]);
  });

  test("resume comparacion CodPulso entre barrido telefonico y plataforma", () => {
    const totals = phonePlatformComparisonTotals([
      { CodPulso: "C1", "Efectiva telefónica": "Sí", "Plataforma completa": "Sí", "Coinciden efectivas": "Sí" },
      { CodPulso: "C2", "Efectiva telefónica": "No", "Plataforma completa": "Sí", "Coinciden efectivas": "No" },
      { CodPulso: "C3", "Efectiva telefónica": "Sí", "Plataforma completa": "No", "Coinciden efectivas": "No" },
      { CodPulso: "C4", "Efectiva telefónica": "No", "Plataforma completa": "No", "Coinciden efectivas": "No aplica" },
    ]);

    expect(totals).toMatchObject({
      total: 4,
      phoneEffective: 2,
      platformComplete: 2,
      matchedEffective: 1,
      mismatch: 2,
      phoneWithoutPlatform: 1,
      platformWithoutPhone: 1,
    });
  });

  test("normaliza cuotas telefonicas por variable para acreditacion y telefonico", () => {
    const rows = phoneQuotaRowsForPanel([
      { Actor: "Egresados", Variable: "Distrito", Valor: "Lima", Universo: 2, Meta: 2, Efectivas: 1, "No barridos": 1, "Avance meta": 50, Brecha: 1 },
      { Actor: "Egresados", Variable: "Distrito", Valor: "Callao", Universo: 2, Meta: 2, Efectivas: 0, "Rechazos telefónicos": 1, Brecha: 2 },
    ]);

    expect(rows.map((row) => [row.actor, row.variable, row.value])).toEqual([
      ["Egresados", "Distrito", "Callao"],
      ["Egresados", "Distrito", "Lima"],
    ]);
    expect(rows[0]).toMatchObject({ meta: 2, effective: 0, refusals: 1, gap: 2 });
    expect(rows[1]).toMatchObject({ meta: 2, effective: 1, unswept: 1, advancePct: 50 });
  });

  test("lee cuotas telefonicas desde columnas de publico objetivo del sheet", () => {
    const rows = phoneQuotaRowsForPanel([
      { "Actor específico": "Docentes", "Variable de cuota": "dim_actor", Etiqueta: "Docentes", "Población objetivo": 3, Cuota: 2, Efectivas: 1 },
      { "Publico objetivo": "Egresados", Corte: "Distrito", Categoria: "Lima", Poblacion: 4, Objetivo: 3, Efectivas: 2 },
    ]);

    expect(rows.map((row) => [row.actor, row.variable, row.value, row.universe, row.meta])).toEqual([
      ["Docentes", "Actor", "Docentes", 3, 2],
      ["Egresados", "Distrito", "Lima", 4, 3],
    ]);
  });

  test("preserva metas telefonicas configuradas aunque aun no tengan base", () => {
    const rows = phoneQuotaRowsForPanel([
      { Actor: "Total", Variable: "sede", Valor: "Chorrillos", Universo: 0, Meta: 58, Efectivas: 0, Brecha: 58, "Estado cuota": "Sin base" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: "Total", variable: "Sede", value: "Chorrillos", universe: 0, meta: 58, gap: 58 });
  });

  test("prioriza metas por sede para el avance telefonico aunque falte base", () => {
    const cards = phoneQuotaAdvanceCardsFromRows([
      { Actor: "Total", Variable: "sede", Valor: "Cercado de Lima", Universo: 501, Meta: 95, Efectivas: 19, Brecha: 76 },
      { Actor: "Total", Variable: "sede", Valor: "Chorrillos", Universo: 0, Meta: 58, Efectivas: 0, Brecha: 58, "Estado cuota": "Sin base" },
      { Actor: "Staff ACNUR", Variable: "dim_actor", Valor: "Staff ACNUR", Universo: 1536, Efectivas: 0 },
    ]);

    expect(cards.map((card) => [card.actor, card.universe, card.meta, card.missing])).toEqual([
      ["Cercado de Lima", 501, 95, 76],
      ["Chorrillos", 0, 58, 58],
    ]);
    expect(cards[0].coverage).toBeCloseTo(3.8, 1);
    expect(cards[0].progress).toBe(20);
  });

  test("asocia ritmo diario de Kobo a las cuotas telefonicas por variable", () => {
    const reports: MonitoreoAcreditacionReports = {
      schema: "monitoreo.acreditacion.reports.v1",
      generated_at: "2026-06-30T21:45:00Z",
      reference_tabs: [],
      sheets: [
        {
          id: "monitoreo_telefonico",
          title: "Monitoreo telefónico",
          description: "",
          scope: "cliente",
          blocks: [
            {
              id: "cuotas_variable",
              title: "Cuotas",
              columns: [],
              rows: [
                { Actor: "Total", Variable: "sede", Valor: "Cercado de Lima", Universo: 501, Meta: 95, Efectivas: 2, Brecha: 93 },
                { Actor: "Total", Variable: "sede", Valor: "Chorrillos", Universo: 0, Meta: 58, Efectivas: 0, Brecha: 58 },
              ],
            },
            {
              id: "avance_efectivo_variable_dia",
              title: "Avance diario por cuota",
              columns: [],
              rows: [
                { Variable: "Sede", Valor: "Cercado de Lima", Fecha: "2026-06-30", "Efectivas Kobo": 1 },
                { Variable: "Sede", Valor: "Cercado de Lima", Fecha: "2026-07-01", "Efectivas Kobo": 1 },
                { Variable: "Sede", Valor: "Chorrillos", Fecha: "Sin fecha", "Efectivas Kobo": 2 },
              ],
            },
          ],
        },
      ],
    };

    const cards = phoneQuotaCardsForDashboard(reports);
    const cercado = cards.find((card) => card.actor === "Cercado de Lima");
    const chorrillos = cards.find((card) => card.actor === "Chorrillos");

    expect(cercado?.dailyPoints.map((point) => [point.date, point.effective])).toEqual([
      ["2026-06-30", 1],
      ["2026-07-01", 1],
    ]);
    expect(chorrillos?.dailyPoints).toEqual([]);
  });

  test("arma filas editables de cuota con tasa requerida y margen no efectivo", () => {
    const rows = buildAcreditacionPhoneQuotaEditorRows({
      variable: "sede",
      variables: [{ name: "sede", tipo: "texto", n_missing: 0, n_unique: 2, values: ["Cercado de Lima", "Chorrillos"] }],
      goals: [
        { filters: { sede: "Cercado de Lima" }, meta: 95 },
        { filters: { sede: "Chorrillos" }, meta: 58 },
      ],
      quotaRows: [
        { Actor: "Total", Variable: "sede", Valor: "Cercado de Lima", Universo: 501, Meta: 95, Efectivas: 0 },
      ],
    });

    expect(rows.map((row) => [row.value, row.universe, row.meta])).toEqual([
      ["Cercado de Lima", 501, 95],
      ["Chorrillos", 0, 58],
    ]);
    expect(rows[0].requiredSuccessPct).toBeCloseTo(18.96, 1);
    expect(rows[0].nonEffectiveMargin).toBe(406);
    expect(rows[1].source).toBe("configured");
  });

  test("usa pendientes por responsable como fallback accionable cuando no llega el bloque alertas", () => {
    const model = buildAcreditacionPhoneSupervisionModel({
      alertRows: [],
      pendingRows: [
        { Responsable: "Martha Villanueva", "No barridos": 57 },
        { Responsable: "Silbia Cruzado", "Por barrer": 11 },
      ],
      insistenceRows: [],
      reattemptRows: [],
    });

    expect(model.activeAlertCount).toBe(68);
    expect(model.highest).toBe("warning");
    expect(model.priorityGroups.map((group) => [group.title, group.count])).toEqual([
      ["Martha Villanueva", 57],
      ["Silbia Cruzado", 11],
    ]);
    expect(model.locations.map((location) => [location.where, location.count])).toEqual([
      ["Martha Villanueva", 57],
      ["Silbia Cruzado", 11],
    ]);
  });

  test("alertas reales no usa pendientes por responsable como fallback", () => {
    const model = buildAcreditacionPhoneRealAlertModel({ alertRows: [] });

    expect(model.activeAlertCount).toBe(0);
    expect(model.highest).toBe("ok");
    expect(model.activeAlerts).toEqual([]);
    expect(model.priorityGroups).toEqual([]);
    expect(model.locations).toEqual([]);
  });

  test("alertas reales clasifica enlace, duración corta y diferencias plataforma-barrido", () => {
    const model = buildAcreditacionPhoneRealAlertModel({
      alertRows: [
        {
          nivel: "Alta",
          "tipo alerta": "Confusión de enlace personalizado",
          responsable: "Ana Torres",
          detalle: "La persona pudo marcar el enlace mal asignado. Fuente: SurveyMonkey · Egresados · Telefonico.",
        },
        {
          nivel: "Media",
          "tipo alerta": "Duración menor a 5 minutos",
          responsable: "Luis Soto",
          detalle: "2 encuestas completas duran menos de 5 minutos. Fuente: SurveyMonkey · Egresados · Telefonico.",
          casos: 2,
        },
        {
          nivel: "Alta",
          "tipo alerta": "Diferencia efectivas Kobo vs base de barrido",
          detalle: "3 efectivas Kobo no figuran como efectivas en el barrido. Fuente: Kobo · Egresados · Telefonico.",
          casos: 3,
        },
      ],
    });

    expect(model.activeAlertCount).toBe(6);
    expect(model.highest).toBe("danger");
    expect(model.activeAlerts.map((alert) => alert.signal.kind)).toEqual([
      "link_confusion",
      "short_duration",
      "platform_gap",
    ]);
    expect(model.activeAlerts.map((alert) => alert.title)).toEqual([
      "Posible confusión de enlace",
      "Encuesta muy corta",
      "Diferencia de efectivas Kobo-barrido",
    ]);
  });

  test("alertas reales excluye respuestas de canales web o personalizados", () => {
    const model = buildAcreditacionPhoneRealAlertModel({
      alertRows: [
        {
          nivel: "Alta",
          "tipo alerta": "respuesta_sin_llave",
          detalle: "Respuesta completa de plataforma sin llave reconciliable. Fuente: SurveyMonkey · Estudiantes · Web. response_id: web-1.",
        },
        {
          nivel: "Alta",
          "tipo alerta": "efectiva_sin_cruce_base",
          detalle: "Respuesta completa de plataforma no cruza con el universo base. Fuente: SurveyMonkey · Docentes · Personalizado. Llave detectada: DOC-1.",
          casos: 4,
        },
        {
          nivel: "Alta",
          "tipo alerta": "respuesta_sin_llave",
          detalle: "Respuesta completa de plataforma sin llave reconciliable. Fuente: SurveyMonkey · Egresados · Telefonico. response_id: tel-1.",
        },
        {
          nivel: "Media",
          "tipo alerta": "responsable_no_barridos",
          responsable: "Equipo Egresados",
          detalle: "13 de 246 casos asignados siguen por barrer.",
        },
      ],
    });

    expect(model.activeAlertCount).toBe(14);
    expect(model.activeAlerts.map((alert) => alert.where)).toEqual([
      "SurveyMonkey · Egresados · Telefonico",
      "Equipo Egresados",
    ]);
    expect(model.activeAlerts.some((alert) => alert.where.includes("Web") || alert.where.includes("Personalizado"))).toBe(false);
  });

  test("supervisión propone una base de barrido del 30% por responsable", () => {
    const plan = buildAcreditacionPhoneSupervisionControlPlan({
      responsibleRows: [
        { Responsable: "Ana Torres", Actor: "Egresados", Efectivas: 10 },
        { Responsable: "Luis Soto", Actor: "Docentes", Efectivas: 3 },
      ],
      sampleRows: [],
      priorityGroups: [],
    });

    expect(plan.hasReadBase).toBe(false);
    expect(plan.totalEffective).toBe(13);
    expect(plan.targetTotal).toBe(4);
    expect(plan.selectedTotal).toBe(4);
    expect(plan.tableRows.map((row) => [row.Responsable, row["Objetivo 30%"], row["Base propuesta"]])).toEqual([
      ["Ana Torres", 3, 3],
      ["Luis Soto", 1, 1],
    ]);
  });

  test("supervisión lee una base de barrido de supervisión si viene en el reporte", () => {
    const plan = buildAcreditacionPhoneSupervisionControlPlan({
      responsibleRows: [
        { Responsable: "Ana Torres", Actor: "Egresados", Efectivas: 10 },
      ],
      sampleRows: [
        { Responsable: "Ana Torres", CodPulso: "ACR-001" },
        { Responsable: "Ana Torres", CodPulso: "ACR-002" },
      ],
      priorityGroups: [],
    });

    expect(plan.hasReadBase).toBe(true);
    expect(plan.targetTotal).toBe(3);
    expect(plan.observedTotal).toBe(2);
    expect(plan.gapTotal).toBe(1);
    expect(plan.tableRows[0]).toMatchObject({
      Responsable: "Ana Torres",
      "Objetivo 30%": 3,
      "Base leída": 2,
      "Por completar": 1,
    });
    expect(plan.exportRows).toEqual([
      { Responsable: "Ana Torres", CodPulso: "ACR-001" },
      { Responsable: "Ana Torres", CodPulso: "ACR-002" },
    ]);
  });

  test("supervisión usa producción total como fallback cuando no hay responsables", () => {
    const plan = buildAcreditacionPhoneSupervisionControlPlan({
      responsibleRows: [],
      sampleRows: [],
      priorityGroups: [],
      fallbackEffective: 117,
    });

    expect(plan.totalEffective).toBe(117);
    expect(plan.targetTotal).toBe(36);
    expect(plan.tableRows[0]).toMatchObject({
      Responsable: "Equipo telefónico",
      Base: "Todos",
      Efectivas: 117,
      "Objetivo 30%": 36,
      "Base propuesta": 36,
    });
  });

  test("supervisión clasifica duración Kobo en menor a 2, menor a 5 y normal", () => {
    const alertModel = buildAcreditacionPhoneRealAlertModel({
      alertRows: [
        {
          nivel: "Alta",
          "tipo alerta": "Duración menor a 2 minutos",
          fuente: "Kobo telefónico",
          detalle: "1 encuesta completa dura menos de 2 minutos.",
          casos: 1,
        },
        {
          nivel: "Media",
          "tipo alerta": "Duración menor a 5 minutos",
          fuente: "Kobo telefónico",
          detalle: "2 encuestas completas duran menos de 5 minutos.",
          casos: 2,
        },
      ],
    });
    const control = buildAcreditacionPhoneTimeControl({
      alerts: alertModel.alerts,
      totalEffective: 10,
    });

    expect(control.under2).toBe(1);
    expect(control.under5).toBe(2);
    expect(control.normal).toBe(7);
    expect(control.buckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["under2", 1],
      ["under5", 2],
      ["normal", 7],
    ]);
  });
});

describe("Acreditacion advance daily points", () => {
  test("descarta cabeceras diarias y rotula sin fecha sin cortar el texto", () => {
    const points = dailyPointsFromRows([
      { Fecha: "Fecha", Efectivas: 0, Parciales: 0, Rechazos: 0 },
      { Fecha: "ECHA", Efectivas: 0, Parciales: 0, Rechazos: 0 },
      { Fecha: "30/06/2026", Efectivas: 8, Parciales: 0, Rechazos: 1 },
      { Fecha: "Sin fecha", Efectivas: 2, Parciales: 0, Rechazos: 0 },
    ]);

    expect(points).toEqual([
      { date: "30/06/2026", effective: 8, partial: 0, refusals: 1, total: 9 },
      { date: "Sin fecha", effective: 2, partial: 0, refusals: 0, total: 2 },
    ]);
    expect(compactAdvanceDateTickLabel("Sin fecha")).toBe("S/D");
  });
});

describe("Acreditacion phone alert supervision model", () => {
  test("agrupa alertas telefónicas activas sin perder conteos del bloque canónico", () => {
    const model = buildAcreditacionPhoneSupervisionModel({
      alertRows: [
        {
          nivel: "Media",
          "tipo alerta": "Responsable no barridos",
          responsable: "Equipo Egresados",
          detalle: "13 de 246 casos asignados siguen por barrer.",
        },
        {
          nivel: "Alta",
          "tipo alerta": "Llave faltante barrido",
          detalle: "2 registros del barrido sin código.",
          casos: 2,
        },
      ],
      pendingRows: [{ Responsable: "Equipo Egresados", "No barridos": 13 }],
      insistenceRows: [{ Responsable: "Equipo Egresados", "Casos no contesta": 104 }],
      reattemptRows: [],
    });

    expect(model.activeAlertCount).toBe(15);
    expect(model.highest).toBe("danger");
    expect(model.priorityGroups.map((group) => [group.title, group.count])).toEqual([
      ["Base de barrido telefónico", 2],
      ["Equipo Egresados", 13],
    ]);
    expect(model.locations.map((location) => [location.where, location.count])).toEqual([
      ["Equipo Egresados", 13],
      ["Base de barrido telefónico", 2],
    ]);
  });
});

// --- Regresión (corte 0.5.1, df6133e0): la sección Teléfono de un proyecto
// ACREDITACIÓN perdía TODAS sus pestañas porque phoneStats solo se calculaba
// cuando la familia era "telefonico" — el rail quedaba vacío aunque el
// backend trajera los bloques monitoreo_telefonico completos.
import { localTabsForAcreditacionView } from "./AcreditacionMonitoreoPage";
import { MONITOREO_ROUTES } from "../../core/monitoreoRegistry";
import type { MonitoreoState } from "../../../../api/monitoreo";

describe("localTabsForAcreditacionView — sección Teléfono en familia acreditación", () => {
  const acreditacionRoute = MONITOREO_ROUTES.find((r) => r.family === "acreditacion")!;
  const state = {
    monitoreo_profile: { family: "acreditacion" },
    sources: [],
  } as unknown as MonitoreoState;
  const reports = {
    sheets: [
      {
        id: "monitoreo_telefonico",
        title: "Monitoreo telefónico",
        blocks: [
          {
            id: "resumen_telefonico",
            title: "Resumen",
            rows: [{ metrica: "Efectivas", valor: 141 }],
          },
          {
            id: "estatus_telefonico",
            title: "Estatus",
            rows: [{ estatus: "Efectivo", casos: 141 }],
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof localTabsForAcreditacionView>[2];

  test("la vista telefonico devuelve las 6 pestañas ricas aunque la familia sea acreditacion", () => {
    const tabs = localTabsForAcreditacionView("telefonico", state, reports, acreditacionRoute as never);
    expect(tabs.map((t) => t.key)).toEqual([
      "resumen",
      "dia",
      "incidencia",
      "responsables",
      "alertas",
      "supervision",
    ]);
  });
});
