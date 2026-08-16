import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, BarChart3, CalendarRange, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, ContactRound, Download, Eye, FileCheck2, Filter, KeyRound, Layers3, Link2, Loader2, Mail, PhoneCall, PlugZap, Plus, ListChecks, QrCode, RefreshCw, Route, Save, Search, ShieldAlert, SlidersHorizontal, Table2, Target, X, XCircle } from "lucide-react";
import { PageFrame } from "../../../../components/PageFrame";
import { GlidingTabList } from "../../../../components/GlidingTabList";
import {
  apiConnectionCheck,
  apiConnectionTokenLoad,
  apiMonitoreoAcreditacionCaseReconciliation,
  apiMonitoreoAcreditacionSeguimiento,
  apiMonitoreoCierre,
  apiMonitoreoCollectorsConfig,
  apiMonitoreoKoboAssets,
  apiMonitoreoSheetsInspect,
  apiMonitoreoSheetsSource,
  apiMonitoreoConfig,
  apiMonitoreoSource,
  apiMonitoreoSources,
  apiMonitoreoState,
  apiMonitoreoSync,
  apiMonitoreoSurveyMonkeyCollectors,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
  type ConnectionCheckResult,
  type ConnectionTokenState,
  type MonitoreoAcreditacion,
  type MonitoreoAcreditacionComponente,
  type MonitoreoAcreditacionIntentos,
  type MonitoreoAcreditacionReports,
  type MonitoreoAcreditacionSeguimientoPayload,
  type MonitoreoAssistedReviewCandidate,
  type MonitoreoCollectorUse,
  type MonitoreoConfig,
  type MonitoreoGoal,
  type MonitoreoGoalObjetivo,
  type MonitoreoInternalQueryCase,
  type MonitoreoInternalQueryIssue,
  type MonitoreoKoboAssetItem,
  type MonitoreoLinkCollector,
  type MonitoreoReportBlock,
  type MonitoreoReportSheet,
  type MonitoreoReportWeekday,
  type MonitoreoRow,
  type MonitoreoSheetsInspectResult,
  type MonitoreoSource,
  type MonitoreoSourcePayload,
  type MonitoreoState,
  type MonitoreoStateRule,
  type MonitoreoStrategyReportException,
  type MonitoreoStrategyPhase,
  type MonitoreoSurveyMonkeyCollector,
  type MonitoreoVariable,
  type SurveyMonkeyMultibaseInspection,
  type SurveyMonkeyMultibaseListItem,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import {
  modoIdDesdeFamily, MONITOREO_MODOS, MONITOREO_SECCIONES, seccionesDelModo, type MonitoreoSeccion } from "../../core/monitoreoRegistry";
import { CORTE_VACIO } from "../../core/corteVacio";
import { CorteAusente } from "../../core/CorteAusente";
import { coberturaDelCorte } from "../../core/coberturaDelCorte";
import { fuentesSincronizables, motivoSinFuentes } from "../../core/fuentesSincronizables";
import { PIEZAS_DEL_PAQUETE_TELEFONICO, piezasRequeridas } from "../../core/paqueteDeFuentes";
import {
  monitoreoPestanaDesdeParams,
  pestanaInicialDeSeccion,
  seccionInicialMonitoreo,
  monitoreoSeccionDesdeParams,
  useMonitoreoDireccion,
} from "../../useMonitoreoDireccion";
import { useRegistrarPestanasMonitoreo } from "../../useRegistrarPestanas";
import { buildCaseCrossingExplanation } from "../../core/acreditacionActorCases";
import {
  ACREDITACION_SOURCE_TABS,
  pestanaDeFuentesInicial,
  pestanasDeFuentesPorClave,
  type AcreditacionSourceTab,
} from "./pestanasDeFuentes";
import { useWaitForSourceSyncJob } from "./sync/pollSourceSync";
import { useSourceSyncActions } from "./sync/useSourceSyncActions";
import { sourceSyncActions, useSourceSyncStore } from "./sync/sourceSyncStore";
import { AcreditacionModuleChromeConSync } from "./sync/AcreditacionModuleChromeConSync";
import { countText, fmt, formatDate, formatMetric, normalizeSourceMatch } from "./formato";
import { EmptyPanel } from "./EmptyPanel";
import {
  ACREDITACION_DAILY_NO_DATE_LABEL,
  CALENDAR_DAY_MS,
  CALENDAR_REPORT_WEEKDAYS,
  CALENDAR_REPORT_WEEKDAY_INDEX,
  calendarIsoDate,
  calendarReportWeekdayLabel,
  compactAdvanceDateTickLabel,
  dailyEffectiveValue,
  dailyPointTotals,
  dateOnlyTime,
  inlineAdvanceDateTickLabel,
  phoneStatusIsNegated,
  isAcreditacionNoDateLabel,
  mergeAcreditacionDailyPoints,
  normalizeCalendarReportWeekday,
  parseAcreditacionDailyDate,
  phoneStatusPalette,
  phoneStatusTone,
  sortAcreditacionDailyPoints,
  type AcreditacionAdvanceDailyPoint,
  type AcreditacionDailyReportCut,
} from "./avance/ritmoDiario";
import { AcreditacionAdvanceDailyMini } from "./avance/AcreditacionAdvanceDailyMini";
import { AcreditacionPhoneDailyTrend } from "./avance/AcreditacionPhoneDailyTrend";

// Los tests del gemelo consumen este helper desde la página; se re-exporta
// tras la extracción a avance/ritmoDiario.
export { compactAdvanceDateTickLabel };
import { schedulePrefetchScopes, usePrefetchTimeouts } from "./sync/scopePrefetch";
import { RutaDeSubsanacion, useBandejaDeSubsanacion } from "../../components/RutaDeSubsanacion";
import { enlaceDeFuente, nombreDeFuente, servicioDeFuente } from "../../fuentes/enlacesDeFuente";
import { DetalleDeCelda } from "../../celdas/DetalleDeCelda";
import { leerDireccionDeSheets } from "../../fuentes/direccionDeFuente";
import { sourceRowCount, sourceSheetField, sourceSyncLabel } from "./fuentes/camposDeFuente";
import { eslabonesDelContrato } from "./fuentes/eslabonesDelContrato";
import { filasDeCruceDeCasos, lecturaDeCruceDeCasos } from "../../core/crucesDeCasos";
import { MonitoreoWorkbenchChrome, MonitoreoWorkbenchHead, MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../components";
import {
  filterInternalQueryCases,
  compareInternalQueryDateValues,
  formatInternalQueryDateLabel,
  internalCaseCrossingLabel,
  internalCaseCrossingValue,
  internalCaseResponseStateLabel,
  internalCaseResponseStateValue,
  internalQueryCollectorDisplayLabel,
  internalQueryCollectorValue,
  normalizeInternalQueries,
  summarizeInternalCases,
} from "../../internalQueries";
import { corteAcreditacion } from "../../corte/corteAdapters";
import { recorteTabla, type MonitoreoCorte } from "../../corte/corteContract";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import {
  ACREDITACION_PHONE_ALERT_RULES,
  acreditacionQualityActionLabel,
  acreditacionQualityLevelLabel,
  acreditacionQualityPriorityValue,
  acreditacionQualityStatusLabel,
  buildAcreditacionPhoneRealAlertModel,
  buildAcreditacionPhoneSupervisionModel,
  type AcreditacionPhoneSupervisionPriorityGroup,
  type AcreditacionPhoneSupervisionModel,
  type AcreditacionQualityAlertItem,
  type AcreditacionQualityAlertTone,
} from "./TelefonicoPhoneAlerts";
import { upsertAcreditacionActorGoal } from "./TelefonicoActorGoals";
import {
  TelefonicoPlatformGapPanel,
  TelefonicoReconciliationSummary,
  TelefonicoStatusMatrixPanel,
} from "./TelefonicoTeamDiagnostics";
import { buildTelefonicoPlatformGap, buildTelefonicoStatusMatrix } from "./telefonicoTeamModel";
import { TelefonicoCumplimientoPanel, TelefonicoEmbudo } from "./TelefonicoGoalPanel";
import { buildTelefonicoCumplimiento } from "./telefonicoGoalModel";
import {
  buildAcreditacionPhoneDailyPoints,
  buildAcreditacionPhoneDailyStatusSeries,
  type AcreditacionPhoneDailyPoint,
  type AcreditacionPhoneDailyStatusSeries,
} from "./TelefonicoPhoneDailyTrend";
import {
  acreditacionActorOptions,
  acreditacionCollectorCountForSource,
  acreditacionCollectorsForSource,
  acreditacionKoboResponseSources,
  acreditacionSourceChannel,
  acreditacionSourceResponseCount,
  acreditacionSourceWithOperationalMetadata,
  acreditacionSweepSourceForChannel,
  acreditacionSweepSources,
  buildAcreditacionPhoneSourceContract,
  buildAcreditacionTelephoneChannels,
  acreditacionSurveySourceName,
  buildAcreditacionActiveSourcesSummary,
  type AcreditacionCollectorRow,
  type AcreditacionPhoneSourceContract,
  type AcreditacionPhoneSourceSlot,
  type AcreditacionTelephoneChannel,
} from "./TelefonicoSourcesModel";
import { SourceSyncActions, type SourceSyncActionsProgress } from "../../components";
import { CadenaDeFuentes } from "./fuentes/CadenaDeFuentes";
import type { EslabonDeFuente } from "./fuentes/modeloDeCadena";
import {
  pestanaDeFuentesDesde,
  repartoDeFuentes,
  type PestanaDeFuentes,
  type RepartoDeFuentes,
} from "./fuentes/repartoDePestanas";
import { PanelConectarFuente } from "../../fuentes/PanelConectarFuente";
import { useAbrirConectarFuente } from "../../fuentes/abrirConectarFuente";
import { DefinidorDeEstados } from "../../estados/DefinidorDeEstados";
import { criteriosDesdeFiltro, filtroDesdeCriterios, resumenDeCriterios } from "../../filtroEfectiva/criterios";
import { contarSegmentos, nombreDelSegmento, pluralDelSegmento } from "./segmentoDeCuotas";
import { TelefonicoEffectiveConsultedFilters } from "./TelefonicoEffectiveConsultedFilters";
import { GraficoDeEstadosPorDia } from "../../estados/GraficoDeEstadosPorDia";
import { estadosPorDiaDeLaCuota } from "../../estados/estadosPorCuota";
import { acreditacionDeclaracionesDesdeReglas } from "../../estados/familiasDeLlamada";
import { proveedoresDeFuentes } from "../../fuentes/vocabulario";
import type { MonitoreoReportScope } from "../types";
import "../../monitoreo.css";
import "../../ritmoDiario.css";
import "../../shell/monitoreoShell.css";
import "../profilePage.css";
import "./telefonicoProfile.css";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { MetaCuotaInput } from "./MetaCuotaInput";
import { resumenDeEquipo } from "./conteoDeEquipo";
import { fusionarResponsablesPorPersona } from "./fusionDeResponsables";
import {
  aplicarMetasPendientes,
  etiquetaDeConfirmacion,
  metasQueCambian,
  type MetasPendientes,
} from "./metasPendientes";

import {
  anchosDeSegmentos,
  ACREDITACION_ADVANCE_TABS,
  ACREDITACION_CONSULTA_TABS,
  ACREDITACION_DEFAULT_ACTORS,
  ACREDITACION_MODEL_TABS,
  ACREDITACION_PHONE_TABS,
  ACREDITACION_ROUTE,
  ACREDITACION_SOURCE_PRESETS,
  AcreditacionCumplimientoBadge,
  AcreditacionMetric,
  CANALES,
  KOBO_DEFAULT_BASE_URL,
  TELEFONICO_ROUTE,
  columnLabel,
  cumplimientoLabel,
  draftFromComponent,
  formatCaseLabel,
  isTelefonicoMonitoreoState,
  isTelefonicoVisibleAdvanceTab,
  isTelefonicoVisiblePhoneTab,
  normalizeKoboBaseUrl,
  num,
  pct,
  pctFrom,
  rowNumber,
  stateFromReports,
  unknownArray,
} from "./telefonicoBase";
import type {
  AcreditacionActionStatus,
  AcreditacionAdvanceTab,
  AcreditacionCaseReconciliationPayload,
  AcreditacionConsultaTab,
  AcreditacionLocalTabKey,
  AcreditacionModelTab,
  AcreditacionModelVisibleTab,
  AcreditacionPhoneTab,
  AcreditacionProfileMode,
  AcreditacionSourcePreset,
  AcreditacionSourcePresetKey,
  SeguimientoDraft,
} from "./telefonicoBase";
export { TELEFONICO_VISIBLE_PHONE_TABS, TELEFONICO_VISIBLE_ADVANCE_TABS } from "./telefonicoBase";

function AcreditacionModelActorSummaryCard({
  card,
  saving,
  onSaveGoal,
}: {
  card: AcreditacionActorCard;
  saving?: boolean;
  onSaveGoal?: (actor: string, meta: number, metaPct: number | null) => Promise<void>;
}) {
  const connectedMechanisms = card.mechanisms.filter((item) => item.role !== "Universo");
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  const channels = Array.from(new Set(connectedMechanisms.map((item) => {
    if (!item.channel) return item.role;
    const label = acreditacionChannelLabel(item.channel);
    return label === "Sin canal" ? item.role : label;
  }).filter(Boolean)));
  // ADR-less, vara V2 del GOAL de UI: `card.statusTone` ya distingue cuatro
  // estados —muted, complete, steady, low— y esta línea los reducía a tres,
  // mandando `steady` y `low` al mismo `base`, que además no tiene regla CSS.
  // Una tarjeta al 95% de su meta y una al 20% se veían idénticas, mientras la
  // misma data se pinta con sus cuatro colores en `mon-actor-card`.
  const statusTone = card.statusTone;
  const metaPct = card.meta != null && card.universe > 0
    ? Math.round((card.meta / card.universe) * 1000) / 10
    : null;
  const [minimumDraft, setMinimumDraft] = useState(card.meta == null ? "" : String(card.meta));
  const [pctDraft, setPctDraft] = useState(metaPct == null ? "" : String(metaPct));
  const nextMinimum = Math.max(0, Math.round(Number(minimumDraft) || 0));
  const nextPct = pctDraft.trim() ? Math.max(0, Math.min(100, Number(pctDraft) || 0)) : null;
  const canSaveGoal = Boolean(onSaveGoal && card.actor.trim());

  useEffect(() => {
    setMinimumDraft(card.meta == null ? "" : String(card.meta));
    setPctDraft(metaPct == null ? "" : String(metaPct));
  }, [card.id, card.meta, metaPct]);

  const updateMinimumDraft = (value: string) => {
    setMinimumDraft(value);
    if (card.universe > 0) {
      const minimum = Math.max(0, Math.round(Number(value) || 0));
      const percent = Math.round((minimum / card.universe) * 1000) / 10;
      setPctDraft(String(Math.max(0, Math.min(100, percent))));
    }
  };

  const updatePctDraft = (value: string) => {
    setPctDraft(value);
    if (card.universe > 0) {
      const percent = Math.max(0, Math.min(100, Number(value) || 0));
      setMinimumDraft(String(Math.round((card.universe * percent) / 100)));
    }
  };

  const saveGoal = () => {
    if (!onSaveGoal) return;
    void onSaveGoal(card.actor, nextMinimum, nextPct);
  };
  const renderMechanism = (item: AcreditacionActorMechanism) => {
    const Icon = mechanismIcon(item.modality);
    return (
      <div key={item.id} className={`mon-acr-model-source-item is-${mechanismKind(item)}`}>
        <Icon size={13} />
        <span>{item.label}</span>
        <em>{item.role === "Universo" ? "Base trabajada" : item.role === "Barrido" ? "Barrido telefónico" : item.provider === "SurveyMonkey" ? "Encuesta" : "Respuesta"}</em>
      </div>
    );
  };

  return (
    <article className={`mon-acr-model-actor is-${statusTone}`}>
      <header className="mon-acr-model-actor-head">
        <div>
          <span>Actor</span>
          <strong>{card.actor}</strong>
        </div>
        <em>{card.meta == null ? "Meta pendiente" : "Meta confirmada"}</em>
      </header>
      <div className="mon-acr-model-actor-metrics">
        <AcreditacionActorFlowNode label="Universo" value={fmt(card.universe)} tone="base" />
        <AcreditacionActorFlowNode label="Meta actor" value={card.meta == null ? "S/M" : fmt(card.meta)} tone={card.meta == null ? "warning" : "target"} />
        <AcreditacionActorFlowNode label="Efectivas" value={fmt(card.effective)} tone="ready" />
      </div>
      <div className="mon-acr-model-minimum-editor" aria-label={`Meta de ${card.actor}`}>
        <label>
          <span>Mínimo N</span>
          <input
            type="number"
            min={0}
            value={minimumDraft}
            onChange={(event) => updateMinimumDraft(event.currentTarget.value)}
            disabled={saving || !canSaveGoal}
          />
        </label>
        <label>
          <span>% universo</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pctDraft}
            onChange={(event) => updatePctDraft(event.currentTarget.value)}
            disabled={saving || !canSaveGoal || card.universe <= 0}
          />
        </label>
        <button type="button" className="is-adjust" onClick={saveGoal} disabled={saving || !canSaveGoal}>
          {saving ? "Guardando" : "Ajustar"}
        </button>
      </div>
      <div className="mon-acr-model-channel-strip">
        {channels.length ? channels.map((channel) => <span key={channel}>{channel}</span>) : <span>Sin canal</span>}
      </div>
      <div className="mon-acr-model-source-list">
        {baseMechanisms.length ? (
          <section className="mon-acr-model-source-group mon-acr-model-source-group--base">
            <header>
              <span>Base y barrido</span>
              <em>{baseMechanisms.length}</em>
            </header>
            {baseMechanisms.map(renderMechanism)}
          </section>
        ) : null}
        {responseMechanisms.length ? (
          <section className="mon-acr-model-source-group mon-acr-model-source-group--responses">
            <header>
              <span>Fuentes de respuesta</span>
              <em>{responseMechanisms.length}</em>
            </header>
            {responseMechanisms.map(renderMechanism)}
          </section>
        ) : null}
      </div>
    </article>
  );
}

type PlatformRejectionRuleDraft = {
  id: string;
  question: string;
  answers: string;
};

type PlatformRejectionQuestionOption = {
  value: string;
  label: string;
  choices: string[];
  support: number;
};

type PhoneEffectiveFilterConfig = {
  enabled: boolean;
  variable: string;
  values: string[];
  label: string;
  value_label: string;
  source_kind: string;
};

type PhoneEffectiveFilterQuestionOption = {
  value: string;
  label: string;
  choices: string[];
  support: number;
  type: string;
};

function newPlatformRejectionDraft(): PlatformRejectionRuleDraft {
  return { id: `rechazo-plataforma-${Date.now()}-${Math.random().toString(36).slice(2)}`, question: "", answers: "No" };
}

function normalizePhoneEffectiveFilter(value: unknown): PhoneEffectiveFilterConfig {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawValues = raw.values ?? raw.options ?? raw.value;
  const values = (Array.isArray(rawValues) ? rawValues : [rawValues])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return {
    enabled: Boolean(raw.enabled ?? raw.activo ?? (String(raw.variable ?? raw.field ?? "").trim() && values.length)),
    variable: String(raw.variable ?? raw.field ?? raw.question ?? raw.pregunta ?? "").trim(),
    values,
    label: String(raw.label ?? raw.etiqueta ?? "").trim(),
    value_label: String(raw.value_label ?? raw.etiqueta_valor ?? "").trim(),
    source_kind: String(raw.source_kind ?? raw.provider ?? "kobo").trim(),
  };
}

function phoneEffectiveFilterLabel(option: PhoneEffectiveFilterQuestionOption) {
  return option.label && option.label !== option.value ? `${option.label} (${option.value})` : option.value;
}

function preferredPhoneEffectiveValue(choices: string[]) {
  return choices.find((choice) => ["yes", "si", "sí", "1", "true"].includes(normalizeSourceMatch(choice)))
    ?? choices.find((choice) => normalizeSourceMatch(choice).includes("consent"))
    ?? choices[0]
    ?? "";
}

function phoneEffectiveFilterQuestionScore(option: PhoneEffectiveFilterQuestionOption) {
  const haystack = normalizeSourceMatch(`${option.value} ${option.label} ${option.type}`);
  if (haystack.includes("consent")) return 0;
  if (haystack.includes("elegib") || haystack.includes("apto")) return 1;
  if (haystack.includes("filtro") || haystack.includes("screen")) return 2;
  if (haystack.includes("select_one")) return 5;
  return 10;
}

function phoneEffectiveFilterQuestionOptions(
  variables: MonitoreoVariable[],
  sourceMetadata: MonitoreoState["source_metadata"] | null | undefined,
  platformSources: MonitoreoSource[],
) {
  const platformSourceIds = new Set(platformSources.map((source) => source.id).filter(Boolean));
  const options = new Map<string, PhoneEffectiveFilterQuestionOption>();
  const addOption = (input: {
    value: string;
    label?: string;
    choices?: unknown[];
    support?: number;
    type?: string;
  }) => {
    const value = String(input.value ?? "").trim();
    if (!value) return;
    const key = normalizeSourceMatch(value);
    if (!key || value.startsWith(".") || key.startsWith(".") || key.includes("snapshot") || key.includes("prosecnur")) return;
    if (value.startsWith("_") || key.includes("attachment") || key.includes("version") || key.includes("uuid") || key.includes("submission") || key.includes("integration")) return;
    const choices = uniqueDisplayValues(unknownArray<unknown>(input.choices)).slice(0, 40);
    if (!choices.length) return;
    const existing = options.get(key);
    const nextChoices = uniqueDisplayValues([...(existing?.choices ?? []), ...choices]);
    options.set(key, {
      value: existing?.value ?? value,
      label: String(input.label ?? existing?.label ?? value).trim() || value,
      choices: nextChoices,
      support: Math.max(existing?.support ?? 0, Number(input.support) || nextChoices.length),
      type: String(input.type ?? existing?.type ?? "").trim(),
    });
  };

  variables.forEach((variable) => {
    addOption({
      value: variable.name,
      label: variable.label || variable.name,
      choices: variable.values ?? [],
      support: variable.n_unique,
      type: variable.tipo,
    });
  });

  Object.entries(sourceMetadata?.variables_by_source ?? {}).forEach(([sourceId, stats]) => {
    if (platformSourceIds.size && !platformSourceIds.has(sourceId)) return;
    unknownArray<Record<string, unknown>>(stats).forEach((stat) => {
      addOption({
        value: String(stat.name ?? "").trim(),
        label: String(stat.label ?? stat.name ?? "").trim(),
        choices: unknownArray<unknown>(stat.examples),
        support: Number(stat.non_empty ?? stat.total ?? 0),
        type: String(stat.kind ?? ""),
      });
    });
  });

  return Array.from(options.values())
    .sort((a, b) => phoneEffectiveFilterQuestionScore(a) - phoneEffectiveFilterQuestionScore(b) || a.value.localeCompare(b.value, "es"))
    .slice(0, 160);
}

function phoneEffectiveFilterAnswerOptions(
  options: PhoneEffectiveFilterQuestionOption[],
  variable: string,
  currentValue: string,
) {
  const key = normalizeSourceMatch(variable);
  const option = options.find((item) => normalizeSourceMatch(item.value) === key);
  const choices = option?.choices ?? [];
  if (currentValue && !choices.some((choice) => normalizeSourceMatch(choice) === normalizeSourceMatch(currentValue))) {
    return [currentValue, ...choices];
  }
  return choices;
}

function platformRejectionDrafts(rules: Array<Record<string, unknown>>): PlatformRejectionRuleDraft[] {
  const drafts = rules
    .map((rule, index) => {
      const question = unknownArray<unknown>(rule.question_patterns).map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
      const answers = unknownArray<unknown>(rule.rejection_answers).map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
      return { id: `rechazo-plataforma-${index}`, question, answers: answers || "No" };
    })
    .filter((draft) => draft.question.trim() || draft.answers.trim());
  return drafts.length ? drafts : [newPlatformRejectionDraft()];
}

function humanizeQuestionSlug(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-záéíóúñ])/g, (letter) => letter.toLocaleUpperCase("es"));
}

function platformQuestionLabel(variable: MonitoreoVariable) {
  const name = variable.name;
  const directLabel = String(variable.label ?? "").trim();
  if (directLabel && directLabel !== name) return directLabel;
  const [code, rawLabel] = name.split("__", 2);
  return rawLabel ? humanizeQuestionSlug(rawLabel) : code;
}

function compactSelectLabel(value: string, maxLength = 68) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function platformQuestionOptions(variables: MonitoreoVariable[]): PlatformRejectionQuestionOption[] {
  return variables
    .map((variable) => {
      const choices = unknownArray<string>(variable.values)
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
      return {
        value: variable.name,
        label: platformQuestionLabel(variable),
        choices,
        support: Math.max(0, (variable.n_unique ?? 0) - (variable.n_missing ? 0 : 0)),
      };
    })
    .filter((option) => {
      const key = normalizeSourceMatch(option.value);
      return /^q\d{4}$/i.test(option.value)
        && option.choices.length >= 2
        && option.choices.length <= 10
        && !key.includes("otro especifique");
    })
    .sort((a, b) => {
      const aIsFilter = normalizeSourceMatch(a.value) === "q0001" ? -1 : 0;
      const bIsFilter = normalizeSourceMatch(b.value) === "q0001" ? -1 : 0;
      return aIsFilter - bIsFilter || a.value.localeCompare(b.value, "es");
    });
}

function withCurrentQuestionOption(options: PlatformRejectionQuestionOption[], value: string) {
  const clean = value.trim();
  if (!clean || options.some((option) => option.value === clean)) return options;
  return [{ value: clean, label: clean, choices: [], support: 0 }, ...options];
}

function platformAnswerOptions(options: PlatformRejectionQuestionOption[], draft: PlatformRejectionRuleDraft) {
  const selected = options.find((option) => option.value === draft.question);
  const choices = selected?.choices ?? [];
  const current = draft.answers.trim();
  return current && !choices.includes(current) ? [current, ...choices] : choices;
}

function splitListInput(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AcreditacionPlatformRejectionEditor({
  state,
  variables,
  onStateChange,
}: {
  state?: MonitoreoState | null;
  variables: MonitoreoVariable[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const rules = unknownArray<Record<string, unknown>>(state?.config?.monitoreo_profile?.rejection_rules);
  const rulesKey = JSON.stringify(rules);
  const [drafts, setDrafts] = useState<PlatformRejectionRuleDraft[]>(() => platformRejectionDrafts(rules));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const questionOptions = platformQuestionOptions(variables);
  const configured = drafts.filter((draft) => draft.question.trim() && draft.answers.trim()).length;

  useEffect(() => {
    setDrafts(platformRejectionDrafts(rules));
  }, [rulesKey]);

  const updateDraft = (id: string, patch: Partial<PlatformRejectionRuleDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };

  const addDraft = () => {
    setDrafts((current) => [...current, newPlatformRejectionDraft()]);
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id);
      return next.length ? next : [newPlatformRejectionDraft()];
    });
  };

  const saveRules = async () => {
    if (!state?.config) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando regla de rechazo..." });
    const rejection_rules = drafts
      .map((draft) => ({
        enabled: true,
        actor: "",
        question_patterns: splitListInput(draft.question),
        rejection_answers: splitListInput(draft.answers),
      }))
      .filter((rule) => rule.question_patterns.length && rule.rejection_answers.length);
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: {
          ...state.config.monitoreo_profile,
          rejection_rules,
        },
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Reglas de rechazo actualizadas." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`mon-platform-rejection-rule${configured ? " is-configured" : " is-empty"}`} aria-label="Definición de rechazo de plataforma">
      <header>
        <div>
          <span>Rechazo de plataforma</span>
          <strong>{configured ? `${configured} regla${configured === 1 ? "" : "s"} activa${configured === 1 ? "" : "s"}` : "Sin regla definida"}</strong>
          <p>Define qué pregunta filtro y qué respuesta marcan rechazo dentro de las respuestas de plataforma.</p>
        </div>
        <button type="button" onClick={() => void saveRules()} disabled={saving || !state?.config}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar regla
        </button>
      </header>
      <div className="mon-platform-rule-list">
        {drafts.map((draft, index) => {
          const answerOptions = platformAnswerOptions(questionOptions, draft);
          return (
          <article key={draft.id} className="mon-platform-rule-row">
            <div className="mon-platform-rule-index" aria-label={`Condición ${index + 1}`}>
              <span>Condición {String(index + 1).padStart(2, "0")}</span>
            </div>
            <label>
              <span>Pregunta de selección única</span>
              <select
                value={draft.question}
                onChange={(event) => {
                  const question = event.target.value;
                  const option = questionOptions.find((item) => item.value === question);
                  updateDraft(draft.id, {
                    question,
                    answers: option?.choices.includes(draft.answers) ? draft.answers : option?.choices[0] ?? draft.answers,
                  });
                }}
                disabled={saving}
              >
                <option value="">Seleccionar pregunta</option>
                {withCurrentQuestionOption(questionOptions, draft.question).map((option) => (
                  <option key={option.value} value={option.value} title={option.label}>
                    {compactSelectLabel(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Respuesta que rechaza</span>
              <select
                value={draft.answers}
                onChange={(event) => updateDraft(draft.id, { answers: event.target.value })}
                disabled={saving}
              >
                {answerOptions.length ? answerOptions.map((answer) => (
                  <option key={answer} value={answer}>{answer}</option>
                )) : <option value={draft.answers}>{draft.answers || "No"}</option>}
              </select>
            </label>
            <button type="button" aria-label="Quitar condición" onClick={() => removeDraft(draft.id)} disabled={saving}>
              <XCircle size={13} />
            </button>
          </article>
          );
        })}
      </div>
      <footer>
        <span>{fmt(variables.length)} variables inspeccionadas</span>
        <span>{fmt(configured)} reglas configuradas</span>
        <button type="button" onClick={addDraft} disabled={saving}>
          <Plus size={13} />
          Agregar condición
        </button>
      </footer>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionCanonicalModelWorkbench({
  reports,
  state,
  activeTab = "estructura",
  onStateChange,
}: {
  reports?: MonitoreoAcreditacionReports | null;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionModelTab;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const client = reports?.client_report;
  const actorRows = useMemo(() => (
    client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"])
  ), [client?.actors, reports?.sheets]);
  const sourceRows = useMemo(() => (
    client?.sources?.length ? client.sources : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"])
  ), [client?.sources, reports?.sheets]);
  const sheetActorDailyRows = useMemo(
    () => reports ? rowsForSheetBlock(reports, "cliente_avance_actor", ["avance_actor_dia"]) : [],
    [reports],
  );
  const dailyRows = client?.daily_actor?.length
    ? client.daily_actor
    : sheetActorDailyRows.length
      ? sheetActorDailyRows
      : client?.daily_general ?? [];
  const allowedActors = useMemo(
    () => new Set(actorRows.map((row, index) => normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`)))),
    [actorRows],
  );
  const actorDailySeries = useMemo(
    () => reports ? buildAcreditacionAdvanceDailySeries(reports, "avance_general_dia", "Unidad", allowedActors) : [],
    [allowedActors, reports],
  );
  const cards = useMemo(() => actorCardsForDashboard({
    actorRows,
    sourceRows: sourceRows as Array<Record<string, unknown>>,
    dailyRows,
    actorDailySeries,
    goals: state?.config?.goals ?? [],
    sources: state?.sources ?? [],
    progressRows: state?.dashboard?.progress ?? [],
  }), [actorDailySeries, actorRows, dailyRows, sourceRows, state?.config?.goals, state?.dashboard?.progress, state?.sources]);
  const totals = advanceTotals(cards);
  const goalSummary = actorGoalSummary(cards);
  const activeSources = (state?.sources ?? []).filter((source) => source.enabled);
  const sourceSummary = buildAcreditacionActiveSourcesSummary(state?.sources ?? [], state?.config?.operational_model.link_collectors ?? []);
  const telephoneChannels = buildAcreditacionTelephoneChannels(state?.sources ?? [], state?.config?.operational_model.link_collectors ?? []);
  const activeSheetBases = activeSources.filter((source) => source.kind === "google_sheets" && source.role === "universo").length;
  const surveyCount = activeSources.filter(isPlatformResponseSource).length;
  const sweepCount = acreditacionSweepSources(activeSources).length;
  const mechanismTotal = surveyCount + sweepCount || cards.reduce((sum, card) => sum + card.mechanisms.filter((item) => item.role !== "Universo").length, 0);
  const metaTotal = cards.reduce((sum, card) => sum + (card.meta ?? 0), 0);
  const goalActorKey = preferredGoalVariable((state?.variables ?? []).map((variable) => variable.name)) || "dim_actor";
  const [goalSavingActor, setGoalSavingActor] = useState("");
  const [goalStatus, setGoalStatus] = useState<AcreditacionActionStatus>(null);
  const [quotaStatus, setQuotaStatus] = useState<AcreditacionActionStatus>(null);
  const scheduleDraft = acreditacionScheduleDraftFromPhases(state?.config?.strategy_phases ?? []);
  const scheduleWindow = calendarWeekRangeLabel(scheduleDraft.startWeek, scheduleDraft.startWeek + scheduleDraft.durationWeeks - 1);
  const reportWeekdayLabel = calendarReportWeekdayLabel(scheduleDraft.reportWeekday);
  const phoneQuotaReportRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaVariable = isPhoneModel && state?.config
    ? preferredPhoneQuotaVariable(state.variables ?? [], state.config.control_vars ?? [], phoneQuotaReportRows, state.config.goals ?? [])
    : "";
  const phoneQuotaEditorRows = isPhoneModel && state?.config
    ? buildAcreditacionPhoneQuotaEditorRows({
      variable: phoneQuotaVariable,
      variables: state.variables ?? [],
      goals: state.config.goals ?? [],
      quotaRows: phoneQuotaReportRows,
    })
    : [];
  const phoneQuotaBaseTotal = phoneQuotaEditorRows.reduce((sum, row) => sum + row.universe, 0);
  const phoneQuotaEffectiveTotal = phoneQuotaEditorRows.reduce((sum, row) => sum + row.effective, 0);
  const phoneQuotaMetaTotal = phoneQuotaVariable && state?.config ? phoneQuotaGoalTotal(state.config.goals ?? [], phoneQuotaVariable) : 0;
  const phoneContract = isPhoneModel ? buildAcreditacionPhoneSourceContract(state?.sources ?? []) : null;
  const phoneReadyCount = phoneContract ? phoneContractReadyCount(phoneContract) : 0;
  const phoneFilter = isPhoneModel ? normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter) : null;
  const phoneFilterConfigured = Boolean(phoneFilter?.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phoneComparisonRows = isPhoneModel && reports
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
    : [];
  const phoneComparison = phonePlatformComparisonTotals(phoneComparisonRows);
  const modelActionLabels = isPhoneModel
    ? [
      phoneQuotaVariable ? `Variable ${phoneQuotaVariableLabel(phoneQuotaVariable)}` : "Sin variable rectora",
      phoneQuotaMetaTotal ? `${fmt(phoneQuotaMetaTotal)} objetivo` : "Sin objetivo",
      `${fmt(phoneQuotaEffectiveTotal)} efectivas Kobo`,
      `${fmt(phoneQuotaEditorRows.length)} categorías`,
    ]
    : [
      `${fmt(cards.length)} actores`,
      goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} sin meta` : "Metas listas",
      scheduleWindow,
      reportWeekdayLabel,
    ];
  const activeVisibleTab: AcreditacionModelVisibleTab = activeTab === "estrategias" || activeTab === "resumen" ? activeTab : "estructura";
  const modelCopy = activeVisibleTab === "estrategias"
    ? {
      eyebrow: "Cronograma operativo",
      title: "Campo y reportes",
      hint: "Configura semanas de campo, fechas opcionales y día de entrega del reporte de avance.",
    }
    : activeVisibleTab === "resumen"
      ? {
        eyebrow: "Resumen metodológico",
        title: "Lectura de Fuentes",
        hint: "Revisa el estado de encuestas, bases y barrido sin editar canales ni fuentes desde Modelo.",
      }
      : isPhoneModel
        ? {
          eyebrow: "Modelo telefónico",
          title: "Cuotas por variable",
          hint: "Define la variable rectora, sus categorías y metas; el avance de cumplimiento se revisa en Avance.",
        }
      : {
        eyebrow: "Modelo operativo",
        title: "Metas por actor",
        hint: "Define la meta de cada actor. Fuentes conserva canales, barrido, enlaces y filtro de efectiva.",
      };

  const saveActorGoal = useCallback(async (actor: string, meta: number, metaPct: number | null) => {
    if (!state?.config) return;
    setGoalSavingActor(actor);
    setGoalStatus({ tone: "info", message: `Guardando meta de ${actor}...` });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        goals: upsertAcreditacionActorGoal({
          goals: state.config.goals ?? [],
          actor,
          meta,
          metaPct,
          goalKey: goalActorKey,
        }),
      });
      onStateChange?.(result.state);
      setGoalStatus({ tone: "success", message: `Meta de ${actor} actualizada.` });
    } catch (error) {
      setGoalStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setGoalSavingActor("");
    }
  }, [goalActorKey, onStateChange, state?.config]);
  const savePhoneQuotaPatch = useCallback((patch: Partial<MonitoreoConfig>) => {
    if (!state?.config) return;
    const nextConfig = { ...state.config, ...patch };
    setQuotaStatus({ tone: "info", message: "Guardando cuotas telefónicas..." });
    void apiMonitoreoConfig(nextConfig)
      .then((result) => {
        onStateChange?.(result.state);
        setQuotaStatus({ tone: "success", message: "Cuotas telefónicas actualizadas." });
      })
      .catch((error) => {
        setQuotaStatus({ tone: "error", message: (error as Error).message });
      });
  }, [onStateChange, state?.config]);

  if (!reports) {
    return <EmptyPanel title="Modelo pendiente" detail="El último corte no incluye el modelo operativo. Sincroniza las fuentes para reconstruir metas, mecanismos y barrido." />;
  }

  return (
    <div className={`mon-stage mon-stage--model mon-stage--acr-model${isPhoneModel && activeVisibleTab === "estrategias" ? " is-phone-model-schedule-stage" : ""}`}>
      <section
        className={`pulso-panel mon-fill-panel mon-acr-model-panel${isPhoneModel && activeVisibleTab === "estrategias" ? " is-phone-model-schedule" : ""}`}
        style={{
          minHeight: 0,
          height: undefined,
          overflowY: isPhoneModel && activeVisibleTab === "estrategias" ? "visible" : "auto",
          scrollbarGutter: "stable",
        } as CSSProperties}
        aria-label="Modelo operativo canónico de acreditación"
      >
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">{modelCopy.eyebrow}</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><Target size={16} /> {modelCopy.title}</span></h2>
            <p className="pulso-panel-hint">{modelCopy.hint}</p>
          </div>
          <div className="mon-acr-model-actions">
            {modelActionLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
        </header>
        {goalStatus ? <span className={`mon-acr-model-action-status is-${goalStatus.tone}`}>{goalStatus.message}</span> : null}
        <div className="mon-acr-model-map" aria-label="Mapa operativo de acreditación">
          {isPhoneModel ? (
            <>
              <AcreditacionActorDashboardTile label="Variable rectora" value={phoneQuotaVariable ? phoneQuotaVariableLabel(phoneQuotaVariable) : "Pendiente"} hint={`${fmt(phoneQuotaEditorRows.length)} categorías`} tone={phoneQuotaVariable ? "ready" : "warning"} />
              <AcreditacionActorDashboardTile label="Base telefónica" value={fmt(phoneQuotaBaseTotal || totals.universe)} hint="casos con CodPulso" tone={phoneQuotaBaseTotal || totals.universe ? "ready" : "warning"} />
              <AcreditacionActorDashboardTile label="Objetivo Kobo" value={phoneQuotaMetaTotal ? fmt(phoneQuotaMetaTotal) : "S/M"} hint="efectivas filtradas" tone={phoneQuotaMetaTotal ? "target" : "warning"} />
              <AcreditacionActorDashboardTile label="Categorías" value={fmt(phoneQuotaEditorRows.length)} hint={phoneQuotaVariable ? `metas por ${phoneQuotaVariableLabel(phoneQuotaVariable).toLowerCase()}` : "define variable"} tone={phoneQuotaEditorRows.length ? "ready" : "warning"} />
            </>
          ) : (
            <>
              <AcreditacionActorDashboardTile label="Actores" value={fmt(cards.length)} hint="modelo base" tone="base" />
              <AcreditacionActorDashboardTile label="Universo" value={fmt(totals.universe)} hint="desde Sheets" tone="ready" />
              <AcreditacionActorDashboardTile label="Meta actor" value={metaTotal ? fmt(metaTotal) : "S/M"} hint={goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} pendientes` : "configuradas"} tone={goalSummary.missingMeta ? "warning" : "target"} />
              <AcreditacionActorDashboardTile label="Campo" value={scheduleWindow} hint={reportWeekdayLabel === "Sin reporte" ? "reporte pendiente" : `reporte ${reportWeekdayLabel.toLowerCase()}`} tone={scheduleDraft.reportWeekday ? "ready" : "warning"} />
            </>
          )}
        </div>
        {activeVisibleTab === "estructura" && isPhoneModel && state?.config ? (
          <>
            <AcreditacionPhoneQuotaEditor
              draft={state.config}
              variables={state.variables ?? []}
              platformSources={(state.sources ?? []).filter(isKoboResponseSource)}
              quotaRows={phoneQuotaReportRows}
              onPatchConfig={savePhoneQuotaPatch}
            />
            {quotaStatus ? <span className={`mon-acr-model-action-status is-${quotaStatus.tone}`}>{quotaStatus.message}</span> : null}
          </>
        ) : null}
        {activeVisibleTab === "estructura" && !isPhoneModel ? (
          <div className="mon-acr-model-actor-grid">
            {cards.length ? cards.map((card) => (
              <AcreditacionModelActorSummaryCard
                key={card.id}
                card={card}
                saving={goalSavingActor === card.actor}
                onSaveGoal={saveActorGoal}
              />
            )) : (
              <EmptyPanel title="Sin actores detectados" detail="Carga la base trabajada para armar el modelo por actor." />
            )}
          </div>
        ) : null}
        {activeVisibleTab === "estrategias" ? (
          <AcreditacionFieldSchedulePanel config={state?.config ?? null} reports={reports} onStateChange={onStateChange} />
        ) : null}
        {activeVisibleTab === "resumen" ? (
          isPhoneModel && phoneContract && phoneFilter ? (
            <AcreditacionPhoneModelReadingPanel
              contract={phoneContract}
              readyCount={phoneReadyCount}
              quotaVariable={phoneQuotaVariable}
              quotaRows={phoneQuotaEditorRows}
              quotaBaseTotal={phoneQuotaBaseTotal}
              quotaEffectiveTotal={phoneQuotaEffectiveTotal}
              quotaMetaTotal={phoneQuotaMetaTotal}
              filter={phoneFilter}
              filterConfigured={phoneFilterConfigured}
              comparison={phoneComparison}
              comparisonRows={phoneComparisonRows.length}
              scheduleWindow={scheduleWindow}
              reportWeekdayLabel={reportWeekdayLabel}
            />
          ) : (
            <section className="mon-contract-block mon-contract-block--wide" aria-label="Resumen de Fuentes para Modelo">
              <div className="mon-contract-block-head">
                <span>Resumen de Fuentes</span>
                <span className="mon-contract-counter">Solo lectura</span>
              </div>
              <div className="mon-acr-active-kpis">
                <StatTile label="Encuestas activas" value={fmt(sourceSummary.activeSurveys)} tone={sourceSummary.activeSurveys ? "good" : "warn"} />
                <StatTile label="Bases Sheets" value={fmt(activeSheetBases)} tone={activeSheetBases ? "good" : "warn"} />
                <StatTile label="Barrido" value={fmt(sweepCount)} tone={sweepCount ? "good" : "neutral"} />
                <StatTile label="Canales tel." value={fmt(telephoneChannels.length)} tone={telephoneChannels.length ? "good" : "neutral"} />
              </div>
              <p className="mon-profile-muted">
                Canales, recopiladores, barrido, enlaces y filtro de efectiva se editan en Fuentes. Modelo solo los resume para contextualizar las metas y el cronograma.
              </p>
            </section>
          )
        ) : null}
      </section>
    </div>
  );
}

function AcreditacionPhoneModelReadingPanel({
  contract,
  readyCount,
  quotaVariable,
  quotaRows,
  quotaBaseTotal,
  quotaEffectiveTotal,
  quotaMetaTotal,
  filter,
  filterConfigured,
  comparison,
  comparisonRows,
  scheduleWindow,
  reportWeekdayLabel,
}: {
  contract: AcreditacionPhoneSourceContract;
  readyCount: number;
  quotaVariable: string;
  quotaRows: AcreditacionPhoneQuotaEditorRow[];
  quotaBaseTotal: number;
  quotaEffectiveTotal: number;
  quotaMetaTotal: number;
  filter: PhoneEffectiveFilterConfig;
  filterConfigured: boolean;
  comparison: PhonePlatformComparisonTotals;
  comparisonRows: number;
  scheduleWindow: string;
  reportWeekdayLabel: string;
}) {
  const filterLabel = filterConfigured
    ? `${filter.label || phoneQuotaVariableLabel(filter.variable)} = ${filter.value_label || filter.values[0]}`
    : "Filtro de consentimiento pendiente";
  const categoryLabel = quotaVariable
    ? `${phoneQuotaVariableLabel(quotaVariable)} · ${fmt(quotaRows.length)} categorías`
    : "Variable rectora pendiente";
  const packageTone = contract.ready && filterConfigured && quotaVariable ? "ready" : "warning";
  const decisionItems = [
    {
      key: "fuentes",
      icon: Layers3,
      label: "Paquete",
      value: `${readyCount}/3 fuentes`,
      detail: contract.ready ? "base, barrido y Kobo vinculados" : "completa fuentes antes de cerrar modelo",
      tone: contract.ready ? "ready" : "warning",
    },
    {
      key: "filtro",
      icon: Filter,
      label: "Efectiva Kobo",
      value: filterLabel,
      detail: filterConfigured ? "respuesta completa que pasa filtro" : "define pregunta y opción válida en Fuentes",
      tone: filterConfigured ? "ready" : "warning",
    },
    {
      key: "cuotas",
      icon: Target,
      label: "Cuotas",
      value: categoryLabel,
      detail: quotaMetaTotal ? `${fmt(quotaMetaTotal)} meta Kobo` : "define metas por categoría",
      tone: quotaVariable && quotaRows.length ? "ready" : "warning",
    },
    {
      key: "codpulso",
      icon: KeyRound,
      label: "CodPulso",
      value: comparisonRows ? `${fmt(comparison.matchedEffective)}/${fmt(Math.max(comparison.phoneEffective, comparison.platformComplete))} tel. alineadas` : "Sin cruce leído",
      detail: comparison.mismatch ? phoneCodPulsoDifferenceHint(comparison) : "el estado de la llamada se revisa en Llamadas",
      tone: comparisonRows && comparison.mismatch ? "warning" : comparisonRows ? "ready" : "neutral",
    },
  ] as const;
  const slotItems = [
    { slot: contract.universe, value: quotaBaseTotal ? fmt(quotaBaseTotal) : "S/D", hint: "base de cuotas", icon: Table2 },
    { slot: contract.sweep, value: contract.sweep.ready ? "Listo" : "Pendiente", hint: "estados telefónicos", icon: PhoneCall },
    { slot: contract.platform, value: quotaEffectiveTotal ? fmt(quotaEffectiveTotal) : "S/D", hint: "efectivas filtradas", icon: ListChecks },
  ] as const;
  const missingPackageLabel = slotItems
    .filter(({ slot }) => !slot.ready)
    .map(({ slot }) => slot.label.toLocaleLowerCase("es"))
    .join(", ") || "nada";

  return (
    <section className={`mon-phone-model-reading is-${packageTone}`} aria-label="Lectura del modelo telefónico">
      <div className="mon-phone-model-reading-main">
        {/* El rótulo lleva el estado del paquete, no un enunciado. Decía «Kobo
          * cuenta avance; barrido explica operación» y debajo un párrafo que
          * describía qué hace cada sección de la app: dos frases verdaderas que
          * no cambian nunca y que no dicen nada de ESTE estudio. */}
        <div className="mon-phone-model-reading-rule">
          <span><ClipboardCheck size={14} /> Lectura del modelo</span>
          <strong>{contract.ready ? "Paquete completo" : `Falta ${missingPackageLabel}`}</strong>
        </div>
        <div className="mon-phone-model-reading-slots" aria-label="Fuentes que alimentan el modelo telefónico">
          {slotItems.map(({ slot, value, hint, icon: Icon }) => (
            <article key={slot.key} className={`is-${slot.ready ? "ready" : slot.status}`}>
              <span><Icon size={14} /> {slot.label}</span>
              <strong>{value}</strong>
              <em>{hint}</em>
            </article>
          ))}
        </div>
      </div>

      <div className="mon-phone-model-decision-grid" aria-label="Decisiones del modelo telefónico">
        {decisionItems.map(({ key, icon: Icon, label, value, detail, tone }) => (
          <article key={key} className={`is-${tone}`}>
            <span><Icon size={14} /> {label}</span>
            <strong title={value}>{value}</strong>
            <em>{detail}</em>
          </article>
        ))}
      </div>

      <div className="mon-phone-model-routing" aria-label="Qué se revisa en cada sección">
        <span><em>Modelo</em><strong>{categoryLabel}</strong><small>estructura editable</small></span>
        <i aria-hidden="true" />
        <span><em>Avance</em><strong>{quotaEffectiveTotal ? `${fmt(quotaEffectiveTotal)} efectivas` : "ritmo efectivo"}</strong><small>diario y cuotas</small></span>
        <i aria-hidden="true" />
        <span><em>Llamadas</em><strong>{comparisonRows ? "CodPulso" : "cruce pendiente"}</strong><small>estado tel. individual</small></span>
        <i aria-hidden="true" />
        <span><em>Reporte</em><strong>{scheduleWindow}</strong><small>{reportWeekdayLabel}</small></span>
      </div>
    </section>
  );
}

type AcreditacionFieldScheduleEvidenceDay = {
  date: string;
  label: string;
  kobo: number;
  phone: number;
  swept: number;
  noDate: boolean;
};

function buildAcreditacionFieldScheduleEvidence(reports?: MonitoreoAcreditacionReports | null) {
  if (!reports) return null;
  const rows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["avance_efectivo_dia", "avance_diario_efectivo"]);
  const daysByKey = new Map<string, AcreditacionFieldScheduleEvidenceDay>();
  rows.forEach((row) => {
    const rawDate = rowText(row, ["Fecha", "Dia", "Día", "Date"], "");
    const noDate = isAcreditacionNoDateLabel(rawDate);
    const parsedDate = noDate ? null : parseAcreditacionDailyDate(rawDate);
    const dateKey = noDate ? ACREDITACION_DAILY_NO_DATE_LABEL : parsedDate ? calendarIsoDate(parsedDate) : rawDate;
    const current = daysByKey.get(dateKey) ?? {
      date: dateKey,
      label: noDate ? "Sin fecha" : formatInternalQueryDateLabel(dateKey),
      kobo: 0,
      phone: 0,
      swept: 0,
      noDate,
    };
    current.kobo += rowNumber(row, ["Efectivas Kobo", "Efectivas"], 0);
    current.phone += rowNumber(row, ["Efectivas telefónicas", "Efectivas telefonicas"], 0);
    current.swept += rowNumber(row, ["Barridos"], 0);
    daysByKey.set(dateKey, current);
  });
  const days = Array.from(daysByKey.values()).filter((row) => row.kobo > 0 || row.phone > 0 || row.swept > 0);
  const dated = days
    .filter((row) => !row.noDate)
    .sort((a, b) => compareInternalQueryDateValues(a.date, b.date));
  const noDateRows = days.filter((row) => row.noDate);
  const koboDays = dated.filter((row) => row.kobo > 0);
  const totalKobo = days.reduce((sum, row) => sum + row.kobo, 0);
  const totalPhone = days.reduce((sum, row) => sum + row.phone, 0);
  const totalSwept = days.reduce((sum, row) => sum + row.swept, 0);
  const phoneNoDate = noDateRows.reduce((sum, row) => sum + row.phone, 0);
  const sweptNoDate = noDateRows.reduce((sum, row) => sum + row.swept, 0);
  const bestDay = koboDays.reduce<AcreditacionFieldScheduleEvidenceDay | null>((best, row) => (
    !best || row.kobo > best.kobo ? row : best
  ), null);
  const firstKobo = koboDays[0] ?? null;
  const lastKobo = koboDays[koboDays.length - 1] ?? null;
  const averageKobo = koboDays.length ? totalKobo / koboDays.length : 0;
  return {
    days,
    dated,
    koboDays,
    totalKobo,
    totalPhone,
    totalSwept,
    phoneNoDate,
    sweptNoDate,
    bestDay,
    firstKobo,
    lastKobo,
    averageKobo,
    maxKobo: Math.max(1, ...days.map((row) => row.kobo)),
  };
}

function AcreditacionFieldSchedulePanel({
  config,
  reports,
  onStateChange,
}: {
  config: MonitoreoConfig | null;
  reports?: MonitoreoAcreditacionReports | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [draft, setDraft] = useState<AcreditacionFieldScheduleDraft>(() => (
    acreditacionScheduleDraftFromPhases(config?.strategy_phases ?? [])
  ));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDraft(acreditacionScheduleDraftFromPhases(config?.strategy_phases ?? []));
  }, [config?.strategy_phases]);

  if (!config) {
    return <EmptyPanel title="Cronograma pendiente" detail="La configuración local todavía no está disponible para editar semanas y reportes." />;
  }

  const previewPhase = acreditacionScheduleDraftFromPhases(upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], draft));
  const previewWindow = calendarWeekRangeLabel(previewPhase.startWeek, previewPhase.startWeek + previewPhase.durationWeeks - 1);
  const dateWindow = draft.startDate || draft.endDate
    ? [draft.startDate || "inicio pendiente", draft.endDate || "fin pendiente"].join(" a ")
    : "Fechas opcionales";
  const weekStops = Array.from(
    { length: Math.min(8, Math.max(1, draft.durationWeeks)) },
    (_, index) => draft.startWeek + index,
  );
  const hiddenWeeks = Math.max(0, draft.durationWeeks - weekStops.length);
  const reportLabel = calendarReportWeekdayLabel(draft.reportWeekday);
  const evidence = buildAcreditacionFieldScheduleEvidence(reports);
  const evidenceWindow = evidence?.firstKobo && evidence.lastKobo
    ? evidence.firstKobo.date === evidence.lastKobo.date
      ? evidence.firstKobo.label
      : `${evidence.firstKobo.label} - ${evidence.lastKobo.label}`
    : "Sin efectivas fechadas";
  const evidenceDays = evidence
    ? evidence.dated.length
      ? [...evidence.dated, ...evidence.days.filter((day) => day.noDate)]
      : evidence.days
    : [];

  const patchDraft = (patch: Partial<AcreditacionFieldScheduleDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const saveSchedule = async () => {
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando cronograma de campo..." });
    try {
      const result = await apiMonitoreoConfig({
        ...config,
        strategy_phases: upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], draft),
      });
      onStateChange?.(result.state);
      setDraft(acreditacionScheduleDraftFromPhases(result.config.strategy_phases ?? []));
      setStatus({ tone: "success", message: "Cronograma de campo actualizado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-field-schedule-panel" aria-label="Cronograma operativo">
      <div className="mon-contract-block-head">
        <span>Cronograma de campo</span>
        <button type="button" onClick={() => { void saveSchedule(); }} disabled={saving}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar cronograma
        </button>
      </div>
      <div className="mon-field-schedule-dashboard" aria-label="Lectura visual del cronograma">
        <div className="mon-field-schedule-window">
          <span><CalendarRange size={14} /> Ventana de campo</span>
          <strong>{previewWindow}</strong>
          <p>{dateWindow}</p>
          <div className="mon-field-schedule-weekrail" aria-label={`${fmt(draft.durationWeeks)} semanas de campo`}>
            {weekStops.map((week, index) => (
              <i key={week} className={index === 0 ? "is-start" : index === weekStops.length - 1 && !hiddenWeeks ? "is-end" : ""}>
                <em>{week}</em>
              </i>
            ))}
            {hiddenWeeks ? <i className="is-more"><em>+{fmt(hiddenWeeks)}</em></i> : null}
          </div>
        </div>
        <div className="mon-field-schedule-cards">
          <span className={draft.durationWeeks ? "is-ready" : "is-warning"}>
            <em>Duración</em>
            <strong>{fmt(draft.durationWeeks)} sem.</strong>
            <small>{previewWindow}</small>
          </span>
          <span className={draft.startDate && draft.endDate ? "is-ready" : "is-neutral"}>
            <em>Fechas</em>
            <strong>{draft.startDate && draft.endDate ? "cerradas" : "opcionales"}</strong>
            <small>{dateWindow}</small>
          </span>
          <span className={draft.reportWeekday ? "is-ready" : "is-warning"}>
            <em>Reporte</em>
            <strong>{reportLabel}</strong>
            <small>{draft.reportWeekday ? "corte semanal" : "define día"}</small>
          </span>
        </div>
      </div>
      {evidence ? (
        <div className="mon-field-schedule-evidence" aria-label="Evidencia del corte para cronograma">
          <section className="mon-field-schedule-evidence-summary">
            <span><BarChart3 size={14} /> Corte observado</span>
            <strong>{evidenceWindow}</strong>
            <p>{fmt(evidence.totalKobo)} efectivas Kobo en {fmt(evidence.koboDays.length)} día{evidence.koboDays.length === 1 ? "" : "s"} con respuesta.</p>
            <div>
              <em>Promedio <b>{evidence.averageKobo ? `${evidence.averageKobo.toLocaleString("es-PE", { maximumFractionDigits: 1 })}/día` : "S/D"}</b></em>
              <em>Mejor día <b>{evidence.bestDay ? `${fmt(evidence.bestDay.kobo)} · ${evidence.bestDay.label}` : "S/D"}</b></em>
              <em className={evidence.phoneNoDate || evidence.sweptNoDate ? "is-warning" : ""}>
                Sin fecha tel. <b>{fmt(evidence.phoneNoDate)} efectivas · {fmt(evidence.sweptNoDate)} barridos</b>
              </em>
            </div>
          </section>
          <section className="mon-field-schedule-evidence-days" aria-label="Días del corte observado">
            {evidenceDays.map((day) => (
              <article key={`${day.date}-${day.label}`} className={day.noDate ? "is-warning" : day.kobo ? "is-ready" : "is-neutral"}>
                <span>
                  <strong>{day.label}</strong>
                  <em>{day.noDate ? "actividad sin fecha" : "día fechado"}</em>
                </span>
                <i aria-hidden="true">
                  <b style={{ width: `${Math.max(day.kobo ? 5 : 0, Math.min(100, (day.kobo / evidence.maxKobo) * 100))}%` }} />
                </i>
                <small>{fmt(day.kobo)} Kobo · {fmt(day.phone)} tel. efectivas · {fmt(day.swept)} barridos</small>
              </article>
            ))}
          </section>
        </div>
      ) : null}
      <div className="mon-form mon-form--two">
        <label>
          <span>Semana inicio</span>
          <input
            type="number"
            min={1}
            value={draft.startWeek}
            disabled={saving}
            onChange={(event) => patchDraft({ startWeek: positiveInteger(event.currentTarget.value, 1) })}
          />
        </label>
        <label>
          <span>Cantidad de semanas</span>
          <input
            type="number"
            min={1}
            value={draft.durationWeeks}
            disabled={saving}
            onChange={(event) => patchDraft({ durationWeeks: positiveInteger(event.currentTarget.value, 1) })}
          />
        </label>
        <label>
          <span>Fecha campo inicio</span>
          <input
            type="date"
            value={draft.startDate}
            disabled={saving}
            onChange={(event) => patchDraft({ startDate: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Fecha campo fin</span>
          <input
            type="date"
            min={draft.startDate || undefined}
            value={draft.endDate}
            disabled={saving}
            onChange={(event) => patchDraft({ endDate: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Día de reporte de avance</span>
          <select
            value={draft.reportWeekday}
            disabled={saving}
            onChange={(event) => patchDraft({ reportWeekday: event.currentTarget.value as MonitoreoReportWeekday | "" })}
          >
            <option value="">Sin día definido</option>
            {CALENDAR_REPORT_WEEKDAYS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionModelWorkbench({
  acreditacion,
  reports,
  state,
  activeTab = "estructura",
  saving,
  actionStatus,
  onSaveSeguimiento,
  onCerrar,
  onStateChange,
}: {
  acreditacion: MonitoreoAcreditacion | null | undefined;
  reports?: MonitoreoAcreditacionReports | null;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionModelTab;
  saving: boolean;
  actionStatus: AcreditacionActionStatus;
  onSaveSeguimiento?: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
  onCerrar?: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  if (String(activeTab) === "estructura") {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }

  if (!acreditacion?.enabled) {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }
  if (String(activeTab) === "resumen" || String(activeTab) === "estrategias") {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }

  const componentes = acreditacion.componentes ?? [];
  const cards = acreditacion.dashboard.cards ?? [];
  const [activeId, setActiveId] = useState(componentes[0]?.id ?? "");
  const selected = componentes.find((comp) => comp.id === activeId) ?? componentes[0] ?? null;
  const selectedCard = cards.find((card) => card.id === selected?.id) ?? cards[0] ?? null;
  const [draft, setDraft] = useState<SeguimientoDraft>(() => draftFromComponent(selected));
  const [planRefuerzo, setPlanRefuerzo] = useState(acreditacion?.plan_refuerzo ?? "");
  const [aprobarBrechas, setAprobarBrechas] = useState(Boolean(acreditacion?.aprobacion_metodologica));

  useEffect(() => {
    if (componentes.length && !componentes.some((comp) => comp.id === activeId)) {
      setActiveId(componentes[0].id);
    }
  }, [activeId, componentes]);

  useEffect(() => {
    setDraft(draftFromComponent(selected));
  }, [
    selected?.id,
    selected?.seguimiento.n_efectivo,
    selected?.seguimiento.notas_campo,
    selected?.seguimiento.intentos_canal.email,
    selected?.seguimiento.intentos_canal.whatsapp,
    selected?.seguimiento.intentos_canal.sms,
    selected?.seguimiento.intentos_canal.telefono,
    selected?.seguimiento.intentos_canal.presencial,
  ]);

  useEffect(() => {
    setPlanRefuerzo(acreditacion?.plan_refuerzo ?? "");
    setAprobarBrechas(Boolean(acreditacion?.aprobacion_metodologica));
  }, [acreditacion?.plan_refuerzo, acreditacion?.aprobacion_metodologica]);

  if (!acreditacion?.enabled) {
    return (
      <AcreditacionModelConfigWorkbench
        state={state}
        activeTab={activeTab}
        onStateChange={onStateChange}
      />
    );
  }

  const canClose = Boolean(acreditacion.dashboard.cierre_habilitado || planRefuerzo.trim() || aprobarBrechas);
  const cierreDisabled = saving || acreditacion.modo_trabajo === "cierre_campo" || !canClose;
  const strategyRows = (state?.config.strategy_phases ?? []).map((phase) => ({
    ID: phase.id || "sin_id",
    Estrato: phase.stratum || "Todo",
    Modalidad: phase.modality,
    Inicio: phase.start_week,
    Fin: phase.end_week,
    "Fecha inicio": phase.start_date || "S/F",
    "Fecha fin": phase.end_date || "S/F",
    Regla: phase.target_rule || "Sin regla",
    KPI: Array.isArray(phase.kpi_focus) ? phase.kpi_focus.join(", ") : "",
  }));
  const sourceRows = (state?.sources ?? []).map((source) => ({
    Fuente: source.label || source.id,
    Tipo: source.kind,
    Rol: source.role || "respuestas",
    Estado: source.enabled ? "Activa" : "Inactiva",
    ID: source.id,
  }));
  const saveSelected = () => {
    if (!selected || !onSaveSeguimiento) return;
    const intentos_canal = CANALES.reduce<Partial<MonitoreoAcreditacionIntentos>>((acc, canal) => {
      acc[canal] = Math.max(0, Number(draft.intentos[canal]) || 0);
      return acc;
    }, {});
    void onSaveSeguimiento({
      id: selected.id,
      n_efectivo: Math.max(0, Number(draft.n_efectivo) || 0),
      notas_campo: draft.notas_campo,
      intentos_canal,
    });
  };

  if (activeTab === "casos") {
    const bolsaRows = componentes.flatMap((component) => (
      component.seguimiento.bolsa_operativa.map((row) => ({ Actor: component.actor, ...row }))
    )) as unknown as Array<Record<string, unknown>>;
    const seguimientoRows = componentes.map((component) => ({
      Actor: component.actor,
      Tecnica: component.tecnica,
      "n efectivo": component.seguimiento.n_efectivo,
      "Meta": component.meta.n_objetivo ?? "S/M",
      "Email": component.seguimiento.intentos_canal.email,
      "Enlace": component.seguimiento.intentos_canal.whatsapp,
      "SMS": component.seguimiento.intentos_canal.sms,
      "Teléfono": component.seguimiento.intentos_canal.telefono,
      "Presencial": component.seguimiento.intentos_canal.presencial,
      Estado: cumplimientoLabel(component.seguimiento.cumplimiento.estado),
    }));
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Actores" value={fmt(componentes.length)} tone={componentes.length ? "good" : "neutral"} />
          <StatTile label="Bolsa operativa" value={fmt(bolsaRows.length)} tone={bolsaRows.length ? "good" : "neutral"} />
          <StatTile label="Bloqueos" value={fmt(acreditacion.dashboard.bloqueos)} tone={acreditacion.dashboard.bloqueos ? "warn" : "good"} />
          <StatTile label="Modo" value={acreditacion.modo_trabajo === "cierre_campo" ? "Cierre" : "Campo"} />
        </div>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Base de barrido y seguimiento</h3>
              <span>{fmt(seguimientoRows.length)} actores</span>
            </div>
            <DataTable rows={seguimientoRows} empty="No hay actores para seguimiento." />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Bolsa operativa</h3>
              <span>{fmt(bolsaRows.length)} filas</span>
            </div>
            <DataTable rows={bolsaRows} empty="No hay bolsa operativa normalizada." />
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === "enlaces") {
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Fuentes" value={fmt(sourceRows.length)} tone={sourceRows.length ? "good" : "warn"} />
          <StatTile label="Activas" value={fmt(sourceRows.filter((row) => row.Estado === "Activa").length)} tone="good" />
          <StatTile label="Canales" value={fmt(CANALES.length)} />
          <StatTile label="Componentes" value={fmt(componentes.length)} />
        </div>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes, links y recopiladores</h3>
              <span>{fmt(sourceRows.length)} fuentes</span>
            </div>
            <DataTable rows={sourceRows} empty="No hay fuentes conectadas para enlaces/envíos." />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Intentos por canal</h3>
              <span>{fmt(componentes.length)} actores</span>
            </div>
            <DataTable
              rows={componentes.map((component) => ({
                Actor: component.actor,
                Email: component.seguimiento.intentos_canal.email,
                Enlace: component.seguimiento.intentos_canal.whatsapp,
                SMS: component.seguimiento.intentos_canal.sms,
                Telefono: component.seguimiento.intentos_canal.telefono,
                Presencial: component.seguimiento.intentos_canal.presencial,
              }))}
              empty="No hay intentos por canal."
            />
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === "reglas") {
    const ruleRows = cards.map((card) => ({
      Actor: card.actor,
      Estado: cumplimientoLabel(card.estado),
      "n efectivo": card.n_efectivo,
      Meta: card.n_objetivo ?? "S/M",
      Brecha: card.brecha_absoluta ?? 0,
      "% avance": card.avance_pct == null ? "S/D" : pct(card.avance_pct),
    }));
    return (
      <div className="mon-acr-model">
        {acreditacion.dashboard.alertas.length ? (
          <section className="mon-acr-model-alerts" aria-label="Alertas de reglas de avance">
            {acreditacion.dashboard.alertas.slice(0, 8).map((alerta, index) => (
              <div key={`${alerta.componente_id}-${alerta.tipo}-${index}`} className={`is-${alerta.severidad}`}>
                <AlertCircle size={14} />
                <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
              </div>
            ))}
          </section>
        ) : null}
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Estados válidos, metas y brechas</h3>
            <span>{fmt(ruleRows.length)} reglas</span>
          </div>
          <DataTable rows={ruleRows} empty="No hay reglas de cumplimiento para este modelo." />
        </section>
      </div>
    );
  }

  if (String(activeTab) === "__legacy_estrategias__") {
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Fases" value={fmt(strategyRows.length)} tone={strategyRows.length ? "good" : "warn"} />
          <StatTile label="Plan refuerzo" value={planRefuerzo.trim() ? "Activo" : "Pendiente"} tone={planRefuerzo.trim() ? "good" : "warn"} />
          <StatTile label="Aprobación" value={aprobarBrechas ? "Sí" : "No"} tone={aprobarBrechas ? "good" : "neutral"} />
          <StatTile label="Cierre" value={acreditacion.modo_trabajo === "cierre_campo" ? "Marcado" : "Editable"} />
        </div>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Calendario y mecanismos por semana</h3>
            <span>{fmt(strategyRows.length)} fases</span>
          </div>
          <DataTable rows={strategyRows} empty="No hay fases estratégicas configuradas." />
        </section>
        <section className="mon-acr-model-close" aria-label="Cierre de acreditación">
          <div>
            <span>Cierre metodológico</span>
            <input
              value={planRefuerzo}
              disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
              onChange={(event) => setPlanRefuerzo(event.target.value)}
              placeholder="Plan de refuerzo o justificación de cierre"
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={aprobarBrechas}
              disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
              onChange={(event) => setAprobarBrechas(event.target.checked)}
            />
            Aprobación metodológica
          </label>
          <button type="button" disabled={cierreDisabled || !onCerrar} onClick={() => void onCerrar?.(planRefuerzo, aprobarBrechas)}>
            <FileCheck2 size={14} />
            {acreditacion.modo_trabajo === "cierre_campo" ? "Cierre marcado" : "Marcar cierre"}
          </button>
        </section>
        {actionStatus ? <span className={`mon-acr-model-action-status is-${actionStatus.tone}`}>{actionStatus.message}</span> : null}
      </div>
    );
  }

  return (
    <div className="mon-acr-model">
      <section className="mon-acr-model-summary" aria-label="Resumen del modelo de acreditación">
        <div>
          <span>{acreditacion.modo_trabajo === "cierre_campo" ? "Cierre de campo" : "Seguimiento de campo"}</span>
          <strong>{acreditacion.estudio.titulo}</strong>
          <p>{acreditacion.estudio.cliente || "Modelo operativo por actores, metas, intentos y brechas de acreditación."}</p>
        </div>
        <div className="mon-acr-model-summary__stats">
          <StatTile label="Actores" value={fmt(componentes.length)} tone={componentes.length ? "good" : "neutral"} />
          <StatTile label="Bloqueos" value={fmt(acreditacion.dashboard.bloqueos)} tone={acreditacion.dashboard.bloqueos ? "warn" : "good"} />
          <StatTile label="Cierre" value={acreditacion.modo_trabajo === "cierre_campo" ? "Marcado" : canClose ? "Disponible" : "Pendiente"} tone={canClose ? "good" : "warn"} />
        </div>
      </section>

      {acreditacion.dashboard.alertas.length ? (
        <section className="mon-acr-model-alerts" aria-label="Alertas de seguimiento">
          {acreditacion.dashboard.alertas.slice(0, 6).map((alerta, index) => (
            <div key={`${alerta.componente_id}-${alerta.tipo}-${index}`} className={`is-${alerta.severidad}`}>
              <AlertCircle size={14} />
              <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mon-acr-model-grid">
        <aside className="mon-acr-model-list" aria-label="Actores de acreditación">
          <header>
            <span>Actores y meta</span>
            <strong>{fmt(cards.length)} tarjetas</strong>
          </header>
          {cards.map((card) => {
            const active = selected?.id === card.id;
            const width = Math.max(0, Math.min(100, Number(card.avance_pct ?? 0)));
            return (
              <button key={card.id} type="button" className={active ? "is-active" : ""} onClick={() => setActiveId(card.id)}>
                <span>
                  <strong>{card.actor}</strong>
                  <AcreditacionCumplimientoBadge estado={card.estado} />
                </span>
                <em>{fmt(card.n_efectivo)} / {card.n_objetivo == null ? "S/M" : fmt(card.n_objetivo)}</em>
                <i aria-hidden="true"><b style={{ width: `${width}%` }} /></i>
              </button>
            );
          })}
        </aside>

        <section className="mon-acr-model-detail" aria-label="Detalle y edición de seguimiento">
          {selected && selectedCard ? (
            <>
              <header>
                <div>
                  <span>Componente seleccionado</span>
                  <strong>{selected.actor}</strong>
                  <p>{selected.tecnica || "Sin técnica"} · {selected.variable_control || "Sin variable de control"}</p>
                </div>
                <AcreditacionCumplimientoBadge estado={selected.seguimiento.cumplimiento.estado} />
              </header>

              <div className="mon-acr-model-metrics">
                <AcreditacionMetric label="Universo" value={selected.marco.universo_bruto} />
                <AcreditacionMetric label="Marco actualizado" value={selected.marco.marco_actualizado} />
                <AcreditacionMetric label="Contactable" value={selected.marco.marco_contactable} />
                <AcreditacionMetric label="Meta efectiva" value={selected.meta.n_objetivo} hint={selectedCard.avance_pct == null ? "sin avance" : `${pct(selectedCard.avance_pct)} avance`} />
              </div>

              <div className="mon-acr-model-form">
                <label>
                  <span>n efectivo</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.n_efectivo}
                    disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, n_efectivo: event.target.value }))}
                  />
                </label>
                {CANALES.map((canal) => (
                  <label key={canal}>
                    <span>{canal}</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.intentos[canal]}
                      disabled={saving}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        intentos: { ...current.intentos, [canal]: event.target.value },
                      }))}
                    />
                  </label>
                ))}
              </div>

              <label className="mon-acr-model-notes">
                <span>Notas de campo</span>
                <textarea
                  value={draft.notas_campo}
                  disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, notas_campo: event.target.value }))}
                />
              </label>

              <div className="mon-acr-model-actions">
                <button type="button" onClick={saveSelected} disabled={saving || !onSaveSeguimiento}>
                  <Save size={14} />
                  Registrar avance
                </button>
                {actionStatus ? <span className={`is-${actionStatus.tone}`}>{actionStatus.message}</span> : null}
              </div>

              <section className="mon-acr-model-close" aria-label="Cierre de acreditación">
                <div>
                  <span>Cierre metodológico</span>
                  <input
                    value={planRefuerzo}
                    disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
                    onChange={(event) => setPlanRefuerzo(event.target.value)}
                    placeholder="Plan de refuerzo o justificación de cierre"
                  />
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={aprobarBrechas}
                    disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
                    onChange={(event) => setAprobarBrechas(event.target.checked)}
                  />
                  Aprobación metodológica
                </label>
                <button type="button" disabled={cierreDisabled || !onCerrar} onClick={() => void onCerrar?.(planRefuerzo, aprobarBrechas)}>
                  <FileCheck2 size={14} />
                  {acreditacion.modo_trabajo === "cierre_campo" ? "Cierre marcado" : "Marcar cierre"}
                </button>
              </section>

              {Object.keys(selected.seguimiento.sub_cuotas_progreso).length ? (
                <section className="mon-profile-panel">
                  <div className="mon-profile-panel-head">
                    <h3>Subcuotas</h3>
                    <span>{fmt(Object.keys(selected.seguimiento.sub_cuotas_progreso).length)} celdas</span>
                  </div>
                  <DataTable
                    rows={Object.entries(selected.seguimiento.sub_cuotas_progreso).map(([celda, row]) => ({ Celda: celda, ...row }))}
                    empty="Sin subcuotas para este componente."
                  />
                </section>
              ) : null}

              {selected.seguimiento.bolsa_operativa.length ? (
                <section className="mon-profile-panel">
                  <div className="mon-profile-panel-head">
                    <h3>Bolsa operativa</h3>
                    <span>{fmt(selected.seguimiento.bolsa_operativa.length)} filas</span>
                  </div>
                  <DataTable rows={selected.seguimiento.bolsa_operativa as unknown as Array<Record<string, unknown>>} empty="Sin bolsa operativa para este componente." />
                </section>
              ) : null}
            </>
          ) : (
            <EmptyPanel title="Sin componente seleccionado" detail="El modelo está activo, pero aún no hay actores normalizados para editar." />
          )}
        </section>
      </div>
    </div>
  );
}

const MODEL_MODALITY_OPTIONS: Array<{ value: MonitoreoStrategyPhase["modality"]; label: string }> = [
  { value: "email", label: "Correo" },
  { value: "whatsapp", label: "Enlace" },
  { value: "sms", label: "SMS" },
  { value: "telefono", label: "Teléfono" },
  { value: "presencial", label: "Presencial / QR" },
  { value: "mixto", label: "Mixto" },
];

type AcreditacionChannelToneKey = "correo" | "telefono" | "presencial" | "enlace" | "kobo" | "desconocido";

const ACREDITACION_CHANNEL_OPTIONS: Array<{
  value: string;
  label: string;
  key: AcreditacionChannelToneKey;
  modality: MonitoreoStrategyPhase["modality"];
  icon: typeof Link2;
}> = [
  { value: "Correo", label: "Correo", key: "correo", modality: "email", icon: Mail },
  { value: "Presencial (Ficha QR)", label: "Ficha QR", key: "presencial", modality: "presencial", icon: QrCode },
  { value: "Enlace personalizado (Whatsapp)", label: "Enlace", key: "enlace", modality: "whatsapp", icon: Link2 },
  { value: "Kobo", label: "Kobo", key: "kobo", modality: "mixto", icon: ListChecks },
  { value: "Telefónico", label: "Telefónico", key: "telefono", modality: "telefono", icon: PhoneCall },
];

const MODEL_COLLECTOR_USE_OPTIONS: Array<{
  value: MonitoreoCollectorUse;
  label: string;
  modality: MonitoreoStrategyPhase["modality"];
  channel: string;
  icon: typeof Link2;
}> = [
  { value: "correo_autoaplicado", label: "Correo autoaplicado", modality: "email", channel: "Correo", icon: Mail },
  { value: "telefono_asistido", label: "Teléfono asistido", modality: "telefono", channel: "Telefónico", icon: PhoneCall },
  { value: "presencial_qr", label: "Ficha QR", modality: "presencial", channel: "Presencial (Ficha QR)", icon: QrCode },
  { value: "enlace_abierto", label: "Enlace", modality: "whatsapp", channel: "Enlace personalizado (Whatsapp)", icon: Link2 },
  { value: "sms", label: "SMS", modality: "sms", channel: "Enlace personalizado (Whatsapp)", icon: ContactRound },
  { value: "mixto", label: "Refuerzo operativo", modality: "mixto", channel: "Correo", icon: Route },
  { value: "sin_clasificar", label: "Sin clasificar", modality: "mixto", channel: "Correo", icon: SlidersHorizontal },
];

const MODEL_ROSTER_SOURCE_OPTIONS = [
  { value: "none", label: "Sin barrido" },
  { value: "source", label: "Fuente configurada" },
  { value: "uploaded", label: "Archivo cargado" },
  { value: "external_local", label: "Base local externa" },
] as const;

const MODEL_FINAL_STATE_OPTIONS = [
  { value: "complete", label: "Completa" },
  { value: "partial", label: "Parcial" },
  { value: "refusal", label: "Rechazo" },
  { value: "pending", label: "Pendiente" },
  { value: "invalid", label: "No válida" },
];

type AcreditacionCalendarActorPlan = {
  actor: string;
  channels: string[];
  sourceCount: number;
  meta: number | null;
  modality: MonitoreoStrategyPhase["modality"];
  startWeek: number;
  endWeek: number;
};

function calendarWeekRangeLabel(startWeek: number | null | undefined, endWeek: number | null | undefined) {
  const start = Number(startWeek);
  const end = Number(endWeek ?? startWeek);
  if (!Number.isFinite(start) || start <= 0) return "Sin semana";
  if (!Number.isFinite(end) || end <= 0 || end === start) return `Semana ${fmt(start)}`;
  return `Semanas ${fmt(start)}-${fmt(end)}`;
}

function calendarWeekWindowLabel(phases: MonitoreoStrategyPhase[], fallbackEnd: number | null) {
  const weeks = phases.flatMap((phase) => [
    Number(phase.start_week),
    Number(phase.end_week ?? phase.start_week),
  ]).filter((week) => Number.isFinite(week) && week > 0);
  if (weeks.length) {
    const min = Math.min(...weeks);
    const max = Math.max(...weeks);
    return min === max ? `Semana ${fmt(min)}` : `Semanas ${fmt(min)}-${fmt(max)}`;
  }
  if (fallbackEnd && fallbackEnd > 0) return `Sugerido S1-S${fmt(fallbackEnd)}`;
  return "Pendiente";
}

function calendarDateWindowLabel(phases: MonitoreoStrategyPhase[]) {
  const dates = phases.flatMap((phase) => [
    phase.start_date ?? "",
    phase.end_date ?? phase.start_date ?? "",
  ]).filter(Boolean).sort();
  if (!dates.length) return "Por definir";
  const start = dates[0];
  const end = dates[dates.length - 1];
  return start === end ? start : `${start} a ${end}`;
}

type AcreditacionCalendarPhaseDateState = "ready" | "partial" | "empty" | "invalid";

type AcreditacionCalendarPhaseDateStatus = {
  state: AcreditacionCalendarPhaseDateState;
  label: string;
  detail: string;
  durationLabel: string;
  overlapCount: number;
};

type AcreditacionCalendarTimelineDay = {
  iso: string;
  dayLabel: string;
  weekdayLabel: string;
};

type AcreditacionCalendarTimelineItem = {
  key: string;
  index: number;
  phase: MonitoreoStrategyPhase;
  startIndex: number;
  endIndex: number;
  state: AcreditacionCalendarPhaseDateState;
  rangeLabel: string;
  durationLabel: string;
};

type AcreditacionCalendarReportRow = {
  key: string;
  week: number | null;
  weekday: MonitoreoReportWeekday | "";
  date: string;
  label: string;
  note: string;
  isException: boolean;
};

const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" });
const CALENDAR_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const ACREDITACION_FIELD_PHASE_ID = "acreditacion-campo";

export type AcreditacionFieldScheduleDraft = {
  startWeek: number;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  reportWeekday: MonitoreoReportWeekday | "";
};

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function acreditacionPrimarySchedulePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID) ?? phases[0] ?? null;
}

export function acreditacionScheduleDraftFromPhases(phases: MonitoreoStrategyPhase[]): AcreditacionFieldScheduleDraft {
  const phase = acreditacionPrimarySchedulePhase(phases);
  const startWeek = positiveInteger(phase?.start_week, 1);
  const endWeek = Math.max(startWeek, positiveInteger(phase?.end_week ?? phase?.start_week, startWeek));
  return {
    startWeek,
    durationWeeks: Math.max(1, endWeek - startWeek + 1),
    startDate: phase?.start_date ?? "",
    endDate: phase?.end_date ?? "",
    reportWeekday: normalizeCalendarReportWeekday(phase?.client_report_weekday),
  };
}

export function upsertAcreditacionFieldSchedulePhase(
  phases: MonitoreoStrategyPhase[],
  draft: AcreditacionFieldScheduleDraft,
) {
  const existingIndex = phases.findIndex((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID);
  const targetIndex = existingIndex >= 0 ? existingIndex : phases.length ? 0 : -1;
  const existing = targetIndex >= 0 ? phases[targetIndex] : null;
  const startWeek = positiveInteger(draft.startWeek, 1);
  const durationWeeks = positiveInteger(draft.durationWeeks, 1);
  const nextPhase: MonitoreoStrategyPhase = {
    id: existing?.id || ACREDITACION_FIELD_PHASE_ID,
    stratum: existing?.stratum || "Acreditación",
    modality: existing?.modality || "mixto",
    start_week: startWeek,
    end_week: startWeek + durationWeeks - 1,
    start_date: draft.startDate,
    end_date: draft.endDate,
    client_report_weekday: normalizeCalendarReportWeekday(draft.reportWeekday),
    client_report_exceptions: existing?.client_report_exceptions ?? [],
    target_rule: existing?.target_rule || "Cumplir metas por actor en campo",
    kpi_focus: existing?.kpi_focus?.length ? existing.kpi_focus : ["meta actor", "avance efectivo", "faltantes"],
    kpi_modules: existing?.kpi_modules ?? ["progress"],
    breakdown_vars: existing?.breakdown_vars ?? [],
    attempts_var: existing?.attempts_var ?? "",
    outcome_var: existing?.outcome_var ?? "",
  };
  if (targetIndex < 0) return [nextPhase];
  return phases.map((phase, index) => index === targetIndex ? nextPhase : phase);
}

function parseCalendarIsoDate(value: string | null | undefined) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function calendarAddDaysIso(value: string, days: number) {
  const date = parseCalendarIsoDate(value);
  if (!date) return "";
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return calendarIsoDate(next);
}

function calendarDateDiffDays(start: string, end: string) {
  const startDate = parseCalendarIsoDate(start);
  const endDate = parseCalendarIsoDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / CALENDAR_DAY_MS);
}

function formatCalendarDateLabel(value: string | null | undefined) {
  const date = parseCalendarIsoDate(value);
  return date ? CALENDAR_DATE_FORMATTER.format(date).replace(".", "") : "";
}

function formatCalendarWeekdayLabel(value: string | null | undefined) {
  const date = parseCalendarIsoDate(value);
  return date ? CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "") : "";
}

function calendarPhaseDurationDays(phase: MonitoreoStrategyPhase) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end) return null;
  const diff = calendarDateDiffDays(start, end);
  return diff != null && diff >= 0 ? diff + 1 : null;
}

function calendarPhaseWeekDurationDays(phase: MonitoreoStrategyPhase) {
  const startWeek = Number(phase.start_week);
  const endWeek = Number(phase.end_week ?? phase.start_week);
  if (!Number.isFinite(startWeek) || startWeek <= 0) return 1;
  if (!Number.isFinite(endWeek) || endWeek < startWeek) return 7;
  return Math.max(1, endWeek - startWeek + 1) * 7;
}

function calendarDurationLabel(days: number | null) {
  if (!days || days <= 0) return "Duración pendiente";
  return days === 1 ? "1 día" : `${fmt(days)} días`;
}

function calendarReportExceptions(phase: MonitoreoStrategyPhase): MonitoreoStrategyReportException[] {
  return (phase.client_report_exceptions ?? []).map((item) => ({
    week: Number.isFinite(Number(item.week)) && Number(item.week) > 0 ? Number(item.week) : null,
    weekday: normalizeCalendarReportWeekday(item.weekday),
    date: item.date ?? "",
    note: item.note ?? "",
  })).filter((item) => item.week || item.date || item.weekday || item.note);
}

function calendarWeekRange(phase: MonitoreoStrategyPhase) {
  const start = Number(phase.start_week);
  const end = Number(phase.end_week ?? phase.start_week);
  const startWeek = Number.isFinite(start) && start > 0 ? start : 1;
  const endWeek = Number.isFinite(end) && end >= startWeek ? end : startWeek;
  return { startWeek, endWeek };
}

function calendarReportDateForWeek(phase: MonitoreoStrategyPhase, week: number | null, weekday: MonitoreoReportWeekday | "", overrideDate = "") {
  if (overrideDate) return overrideDate;
  if (!phase.start_date || !week || !weekday) return "";
  const { startWeek } = calendarWeekRange(phase);
  const weekStart = calendarAddDaysIso(phase.start_date, Math.max(0, week - startWeek) * 7);
  const weekStartDate = parseCalendarIsoDate(weekStart);
  const weekdayIndex = CALENDAR_REPORT_WEEKDAY_INDEX.get(weekday);
  if (!weekStartDate || weekdayIndex == null) return "";
  const delta = (weekdayIndex - weekStartDate.getDay() + 7) % 7;
  const date = calendarAddDaysIso(weekStart, delta);
  if (phase.end_date && date > phase.end_date) return "";
  return date;
}

function calendarReportScheduleRows(phase: MonitoreoStrategyPhase): AcreditacionCalendarReportRow[] {
  const defaultWeekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
  const exceptions = calendarReportExceptions(phase);
  const byWeek = new Map(exceptions.filter((item) => item.week).map((item) => [Number(item.week), item]));
  const rows: AcreditacionCalendarReportRow[] = [];
  const { startWeek, endWeek } = calendarWeekRange(phase);
  if (defaultWeekday) {
    for (let week = startWeek; week <= endWeek; week += 1) {
      const exception = byWeek.get(week);
      const weekday = normalizeCalendarReportWeekday(exception?.weekday) || defaultWeekday;
      const date = calendarReportDateForWeek(phase, week, weekday, exception?.date ?? "");
      rows.push({
        key: `week-${week}`,
        week,
        weekday,
        date,
        label: date ? formatCalendarDateLabel(date) : `Semana ${fmt(week)}`,
        note: exception?.note ?? "",
        isException: Boolean(exception),
      });
    }
  }
  exceptions
    .filter((item) => !item.week)
    .forEach((exception, index) => {
      const weekday = normalizeCalendarReportWeekday(exception.weekday);
      const date = exception.date ?? "";
      rows.push({
        key: `exception-${index}-${date || weekday}`,
        week: null,
        weekday,
        date,
        label: date ? formatCalendarDateLabel(date) : "Excepción",
        note: exception.note ?? "",
        isException: true,
      });
    });
  return rows;
}

function acreditacionReportWeekdayFromPhases(phases: MonitoreoStrategyPhase[] = []) {
  const primary = acreditacionPrimarySchedulePhase(phases);
  const primaryWeekday = normalizeCalendarReportWeekday(primary?.client_report_weekday);
  if (primaryWeekday) return primaryWeekday;
  for (const phase of phases) {
    const weekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
    if (weekday) return weekday;
    const exceptionWeekday = calendarReportExceptions(phase).map((item) => normalizeCalendarReportWeekday(item.weekday)).find(Boolean);
    if (exceptionWeekday) return exceptionWeekday;
  }
  return "";
}

function acreditacionReportCutsFromPhases(phases: MonitoreoStrategyPhase[] = []): AcreditacionDailyReportCut[] {
  const rows = phases.flatMap((phase) => calendarReportScheduleRows(phase));
  const byDate = new Map<string, AcreditacionDailyReportCut>();
  rows.forEach((row) => {
    if (!row.date) return;
    const weekday = calendarReportWeekdayLabel(row.weekday);
    const label = row.week ? `S${fmt(row.week)} · ${weekday}` : weekday;
    byDate.set(row.date, { date: row.date, label });
  });
  return Array.from(byDate.values()).sort((a, b) => {
    const aTime = dateOnlyTime(parseAcreditacionDailyDate(a.date)) ?? 0;
    const bTime = dateOnlyTime(parseAcreditacionDailyDate(b.date)) ?? 0;
    return aTime - bTime || a.label.localeCompare(b.label, "es");
  });
}

function calendarPhaseDateRangeLabel(phase: MonitoreoStrategyPhase) {
  const start = phase.start_date ?? "";
  const end = phase.end_date ?? "";
  if (start && end) {
    const diff = calendarDateDiffDays(start, end);
    if (diff != null && diff < 0) return "Rango inválido";
    const startLabel = formatCalendarDateLabel(start);
    const endLabel = formatCalendarDateLabel(end);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }
  if (start) return `Desde ${formatCalendarDateLabel(start)}`;
  if (end) return `Hasta ${formatCalendarDateLabel(end)}`;
  return "Sin fecha";
}

function calendarPhaseOverlapCount(phase: MonitoreoStrategyPhase, index: number, phases: MonitoreoStrategyPhase[]) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end || calendarDateDiffDays(start, end) == null) return 0;
  return phases.reduce((count, candidate, candidateIndex) => {
    if (candidateIndex === index) return count;
    const candidateStart = candidate.start_date ?? "";
    const candidateEnd = candidate.end_date || candidateStart;
    if (!candidateStart || !candidateEnd) return count;
    const validCandidate = calendarDateDiffDays(candidateStart, candidateEnd);
    if (validCandidate == null || validCandidate < 0) return count;
    const overlaps = start <= candidateEnd && candidateStart <= end;
    return overlaps ? count + 1 : count;
  }, 0);
}

function calendarPhaseDateStatus(phase: MonitoreoStrategyPhase, index: number, phases: MonitoreoStrategyPhase[]): AcreditacionCalendarPhaseDateStatus {
  const start = phase.start_date ?? "";
  const end = phase.end_date ?? "";
  const diff = start && end ? calendarDateDiffDays(start, end) : null;
  const overlapCount = calendarPhaseOverlapCount(phase, index, phases);
  if (diff != null && diff < 0) {
    return {
      state: "invalid",
      label: "Rango inválido",
      detail: "La fecha fin queda antes del inicio.",
      durationLabel: "Corregir fechas",
      overlapCount,
    };
  }
  if (start && end) {
    const duration = calendarPhaseDurationDays(phase);
    return {
      state: overlapCount ? "partial" : "ready",
      label: calendarPhaseDateRangeLabel(phase),
      detail: overlapCount ? `Se cruza con ${fmt(overlapCount)} fase${overlapCount === 1 ? "" : "s"}` : "Rango definido",
      durationLabel: calendarDurationLabel(duration),
      overlapCount,
    };
  }
  if (start || end) {
    return {
      state: "partial",
      label: calendarPhaseDateRangeLabel(phase),
      detail: "Completa inicio y fin para leer la ventana.",
      durationLabel: "Rango incompleto",
      overlapCount,
    };
  }
  return {
    state: "empty",
    label: "Sin fecha de campo",
    detail: "Define inicio para hidratar el calendario.",
    durationLabel: "Pendiente",
    overlapCount,
  };
}

function calendarBasePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => parseCalendarIsoDate(phase.start_date));
}

function distributeCalendarDatesByWeek(phases: MonitoreoStrategyPhase[]) {
  const basePhase = calendarBasePhase(phases);
  const baseDate = basePhase?.start_date ?? "";
  if (!basePhase || !baseDate) return null;
  const baseWeek = Number(basePhase.start_week) > 0 ? Number(basePhase.start_week) : 1;
  return phases.map((phase) => {
    const startWeek = Number(phase.start_week) > 0 ? Number(phase.start_week) : baseWeek;
    const endWeek = Number(phase.end_week ?? phase.start_week) >= startWeek ? Number(phase.end_week ?? phase.start_week) : startWeek;
    const startOffset = Math.max(0, startWeek - baseWeek) * 7;
    const durationDays = Math.max(1, endWeek - startWeek + 1) * 7;
    const startDate = calendarAddDaysIso(baseDate, startOffset);
    return {
      ...phase,
      start_date: startDate,
      end_date: startDate ? calendarAddDaysIso(startDate, durationDays - 1) : phase.end_date,
    };
  });
}

function buildCalendarTimeline(phases: MonitoreoStrategyPhase[]) {
  const ranges = phases.map((phase, index) => {
    const start = phase.start_date ?? "";
    const end = phase.end_date || start;
    const diff = start && end ? calendarDateDiffDays(start, end) : null;
    if (!start || !end || diff == null || diff < 0) return null;
    return { phase, index, start, end };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const missingDates = phases.length - ranges.length;
  if (!ranges.length) {
    return { days: [] as AcreditacionCalendarTimelineDay[], items: [] as AcreditacionCalendarTimelineItem[], missingDates, totalDays: 0 };
  }

  const start = ranges.map((item) => item.start).sort()[0];
  const end = ranges.map((item) => item.end).sort().at(-1) ?? start;
  const totalDays = Math.max(1, (calendarDateDiffDays(start, end) ?? 0) + 1);
  const days = Array.from({ length: totalDays }, (_, offset) => {
    const iso = calendarAddDaysIso(start, offset);
    return {
      iso,
      dayLabel: formatCalendarDateLabel(iso),
      weekdayLabel: formatCalendarWeekdayLabel(iso),
    };
  });
  const items = ranges.map((item) => {
    const startIndex = Math.max(0, calendarDateDiffDays(start, item.start) ?? 0);
    const endIndex = Math.max(startIndex, calendarDateDiffDays(start, item.end) ?? startIndex);
    const status = calendarPhaseDateStatus(item.phase, item.index, phases);
    return {
      key: item.phase.id || `${item.index}-${item.start}-${item.end}`,
      index: item.index,
      phase: item.phase,
      startIndex,
      endIndex,
      state: status.state,
      rangeLabel: status.label,
      durationLabel: status.durationLabel,
    };
  });
  return { days, items, missingDates, totalDays };
}

function AcreditacionFieldCalendarTimeline({ phases }: { phases: MonitoreoStrategyPhase[] }) {
  const timeline = buildCalendarTimeline(phases);
  const readyCount = timeline.items.filter((item) => item.state === "ready").length;
  const partialCount = timeline.items.length - readyCount;
  const timelineStyle = { "--calendar-day-count": Math.max(1, timeline.days.length) } as CSSProperties;

  if (!phases.length) {
    return null;
  }

  return (
    <div className={`mon-calendar-timeline-panel${timeline.items.length ? "" : " is-empty"}`} aria-label="Vista visual del calendario de campo">
      <div className="mon-calendar-timeline-head">
        <div>
          <span><CalendarRange size={13} /> Calendario visual</span>
          <strong>
            {timeline.items.length
              ? `${formatCalendarDateLabel(timeline.days[0]?.iso)} - ${formatCalendarDateLabel(timeline.days.at(-1)?.iso)}`
              : "Define fechas para ver la ventana"}
          </strong>
        </div>
        <div className="mon-calendar-timeline-kpis">
          <span className="is-ready">{fmt(readyCount)} listas</span>
          <span className={partialCount ? "is-warning" : "is-ready"}>{fmt(partialCount)} por revisar</span>
          <span>{timeline.totalDays ? calendarDurationLabel(timeline.totalDays) : "Sin rango"}</span>
        </div>
      </div>
      {timeline.items.length ? (
        <div className="mon-calendar-timeline-scroll">
          <div className="mon-calendar-timeline-grid" style={timelineStyle}>
            <div className="mon-calendar-timeline-days">
              {timeline.days.map((day) => (
                <div key={day.iso} className="mon-calendar-timeline-day">
                  <strong>{day.dayLabel}</strong>
                  <span>{day.weekdayLabel}</span>
                </div>
              ))}
            </div>
            <div className="mon-calendar-timeline-lanes">
              {timeline.items.map((item) => (
                <div key={item.key} className="mon-calendar-timeline-row">
                  <div
                    className={`mon-calendar-timeline-bar is-${item.state}`}
                    style={{ gridColumn: `${item.startIndex + 1} / ${item.endIndex + 2}` }}
                  >
                    <strong>{item.phase.stratum || `Fase ${fmt(item.index + 1)}`}</strong>
                    <span>{item.rangeLabel} · {item.durationLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mon-calendar-timeline-empty">Las fases existen, pero ninguna tiene fecha de campo definida.</p>
      )}
      {timeline.missingDates > 0 ? (
        <p className="mon-calendar-timeline-note">{fmt(timeline.missingDates)} fase{timeline.missingDates === 1 ? "" : "s"} sin fecha completa todavía.</p>
      ) : null}
    </div>
  );
}

function inferCalendarModality(channels: string[], sources: MonitoreoSource[]): MonitoreoStrategyPhase["modality"] {
  const text = [...channels, ...sources.map((source) => source.label), ...sources.map((source) => source.role)]
    .map(normalizeSourceMatch)
    .join(" ");
  const hits: MonitoreoStrategyPhase["modality"][] = [];
  if (text.includes("telefon") || text.includes("phone") || text.includes("call")) hits.push("telefono");
  if (text.includes("whatsapp") || text.includes("wa ")) hits.push("whatsapp");
  if (text.includes("sms")) hits.push("sms");
  if (text.includes("presencial") || text.includes("qr")) hits.push("presencial");
  if (text.includes("correo") || text.includes("email") || text.includes("mail") || text.includes("survey") || text.includes("web")) hits.push("email");
  const uniqueHits = Array.from(new Set(hits));
  if (uniqueHits.length > 1) return "mixto";
  return uniqueHits[0] ?? (channels.length > 1 ? "mixto" : "email");
}

function calendarGoalActor(goal: MonitoreoGoal, preferredKey: string) {
  const filters = goal.filters ?? {};
  const preferred = preferredKey ? filters[preferredKey] : "";
  const fallback = Object.values(filters).find((value) => String(value ?? "").trim());
  return String(preferred || fallback || "").trim();
}

function calendarGoalForActor(actor: string, goals: MonitoreoGoal[], preferredKey: string) {
  const actorKey = normalizeSourceMatch(actor);
  const goal = goals.find((item) => normalizeSourceMatch(calendarGoalActor(item, preferredKey)) === actorKey);
  const meta = goal ? Number(goal.meta) : NaN;
  return Number.isFinite(meta) && meta > 0 ? meta : null;
}

function calendarTargetRule(actor: string, meta: number | null) {
  if (meta && meta > 0) return `Cubrir ${fmt(meta)} efectivas de ${actor}`;
  return `Cubrir meta y faltantes de ${actor}`;
}

function calendarPhaseFromPlan(plan: AcreditacionCalendarActorPlan, index: number): MonitoreoStrategyPhase {
  return {
    id: `campo-${Date.now()}-${index}`,
    stratum: plan.actor,
    modality: plan.modality,
    start_week: plan.startWeek,
    end_week: plan.endWeek,
    start_date: "",
    end_date: "",
    client_report_weekday: "",
    client_report_exceptions: [],
    target_rule: calendarTargetRule(plan.actor, plan.meta),
    kpi_focus: ["meta actor", "avance efectivo", "faltantes"],
    kpi_modules: ["progress", "contact_efficiency"],
    breakdown_vars: [],
    attempts_var: "",
    outcome_var: "",
  };
}

function splitCalendarTokens(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const PHONE_QUOTA_ACTOR_FILTER_KEYS = new Set([
  "actor",
  "dim actor",
  "unidad",
  "publico objetivo",
  "público objetivo",
]);

export type AcreditacionPhoneQuotaEditorRow = {
  key: string;
  variable: string;
  variableLabel: string;
  value: string;
  universe: number;
  meta: number | null;
  effective: number;
  partial: number;
  refusals: number;
  unswept: number;
  gap: number | null;
  requiredSuccessPct: number | null;
  nonEffectiveMargin: number | null;
  source: "base" | "configured";
};

function phoneQuotaIsActorFilterKey(key: string) {
  return PHONE_QUOTA_ACTOR_FILTER_KEYS.has(normalizeSourceMatch(key));
}

function phoneQuotaGoalHasActor(goal: MonitoreoGoal) {
  return Object.keys(goal.filters ?? {}).some(phoneQuotaIsActorFilterKey);
}

function phoneQuotaGoalValue(goal: MonitoreoGoal, variable: string) {
  return String(goal.filters?.[variable] ?? "").trim();
}

function phoneQuotaGoalTotal(goals: MonitoreoGoal[], variable: string) {
  return goals.reduce((sum, goal) => (
    !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable)
      ? sum + Math.max(0, Number(goal.meta) || 0)
      : sum
  ), 0);
}

function phoneQuotaGoalVariables(goals: MonitoreoGoal[] = []) {
  const names = goals.flatMap((goal) => (
    phoneQuotaGoalHasActor(goal)
      ? []
      : Object.keys(goal.filters ?? {}).filter((key) => String(goal.filters?.[key] ?? "").trim())
  ));
  return uniqueDisplayValues(names);
}

function phoneQuotaUpsertGoal(goals: MonitoreoGoal[], variable: string, value: string, meta: number, keepZero = false) {
  const cleanValue = value.trim();
  const cleanMeta = Math.max(0, Number(meta) || 0);
  const next = goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
  if (cleanValue && (cleanMeta > 0 || keepZero)) {
    next.push({ filters: { [variable]: cleanValue }, meta: cleanMeta });
  }
  return next;
}

function phoneQuotaRemoveGoal(goals: MonitoreoGoal[], variable: string, value: string) {
  const cleanValue = value.trim();
  return goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
}

function phoneQuotaVariableOptions(variables: MonitoreoVariable[], controlVars: string[], rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []) {
  const names = uniqueDisplayValues([
    ...controlVars,
    ...rows.map((row) => phoneRowValue(row, ["Variable", "Variable control", "variable_control", "Variable cuota", "Variable de cuota", "Corte"], "")),
    ...phoneQuotaGoalVariables(goals),
    ...variables.map((variable) => variable.name),
  ]).filter((name) => (
    phoneQuotaGoalVariables(goals).includes(name)
    || variables.some((variable) => variable.name === name)
    || rows.some((row) => normalizeSourceMatch(phoneRowValue(row, ["Variable"], "")) === normalizeSourceMatch(name))
  ));
  const preferred = names.filter((name) => ["sede", "distrito", "dim_segmento", "segmento", "dim_actor"].includes(normalizeSourceMatch(name)));
  const rest = names.filter((name) => !preferred.includes(name));
  return [...preferred, ...rest];
}

function preferredPhoneQuotaVariable(variables: MonitoreoVariable[], controlVars: string[], rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []) {
  const options = phoneQuotaVariableOptions(variables, controlVars, rows, goals);
  return options.find((name) => normalizeSourceMatch(name) === "sede")
    ?? options.find((name) => controlVars.includes(name))
    ?? options[0]
    ?? "";
}

export function buildAcreditacionPhoneQuotaEditorRows({
  variable,
  variables,
  goals,
  quotaRows,
}: {
  variable: string;
  variables: MonitoreoVariable[];
  goals: MonitoreoGoal[];
  quotaRows: Array<Record<string, unknown>>;
}): AcreditacionPhoneQuotaEditorRow[] {
  if (!variable) return [];
  const variableMeta = variables.find((item) => item.name === variable);
  const reportRows = quotaRows.map((row) => {
    const rawVariable = phoneRowValue(row, ["Variable", "Variable control", "variable_control", "Variable cuota", "Variable de cuota", "Corte"], "");
    return {
      actor: phoneRowValue(row, ["Actor", "Unidad", "Público objetivo", "Publico objetivo"], "Total") || "Total",
      variable: rawVariable,
      value: phoneRowValue(row, ["Valor", "Categoria", "Categoría", "Nivel", "Segmento", "Grupo", "Etiqueta"], ""),
      universe: phoneRowNumber(row, ["Universo", "Base", "Población", "Poblacion", "Población objetivo", "Poblacion objetivo", "Total", "Casos"], 0),
      meta: phoneRowOptionalNumber(row, ["Meta", "Cuota", "Objetivo", "Mínimo", "Minimo"]),
      effective: phoneRowNumber(row, ["Efectivas", "Completas", "Efectivas telefónicas", "Efectivas telefonicas"], 0),
      partial: phoneRowNumber(row, ["Parciales", "Parcial"], 0),
      refusals: phoneRowNumber(row, ["Rechazos telefónicos", "Rechazos telefonicos", "Rechazos", "Rechazo"], 0),
      unswept: phoneRowNumber(row, ["No barridos", "Por barrer"], 0),
    };
  }).filter((row) => row.variable === variable && row.value);
  const hasTotalRows = reportRows.some((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor)));
  const sourceRows = hasTotalRows ? reportRows.filter((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor))) : reportRows;
  const byValue = new Map<string, Omit<AcreditacionPhoneQuotaEditorRow, "key" | "variableLabel" | "requiredSuccessPct" | "nonEffectiveMargin" | "source">>();
  sourceRows.forEach((row) => {
    const current = byValue.get(row.value) ?? {
      variable,
      value: row.value,
      universe: 0,
      meta: null,
      effective: 0,
      partial: 0,
      refusals: 0,
      unswept: 0,
      gap: null,
    };
    current.universe += row.universe;
    current.effective += row.effective;
    current.partial += row.partial;
    current.refusals += row.refusals;
    current.unswept += row.unswept;
    if (row.meta != null) current.meta = (current.meta ?? 0) + row.meta;
    byValue.set(row.value, current);
  });
  const goalValues = new Map<string, number>();
  goals.forEach((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return;
    const value = phoneQuotaGoalValue(goal, variable);
    if (!value) return;
    goalValues.set(value, (goalValues.get(value) ?? 0) + Math.max(0, Number(goal.meta) || 0));
  });
  const values = uniqueDisplayValues([
    ...Array.from(byValue.keys()),
    ...(variableMeta?.values ?? []),
    ...Array.from(goalValues.keys()),
  ]);
  const variableLabel = phoneQuotaVariableLabel(variable);
  return values.map((value) => {
    const base = byValue.get(value) ?? {
      variable,
      value,
      universe: 0,
      meta: null,
      effective: 0,
      partial: 0,
      refusals: 0,
      unswept: 0,
      gap: null,
    };
    const meta = goalValues.has(value) ? goalValues.get(value)! : base.meta;
    const gap = meta != null ? Math.max(0, meta - base.effective) : null;
    const requiredSuccessPct = meta != null && base.universe > 0 ? safePercentValue(meta, base.universe) : null;
    const nonEffectiveMargin = meta != null && base.universe > 0 ? base.universe - meta : null;
    return {
      ...base,
      key: `${normalizeSourceMatch(variable)}-${normalizeSourceMatch(value)}`,
      variableLabel,
      meta,
      gap,
      requiredSuccessPct,
      nonEffectiveMargin,
      source: base.universe > 0 ? "base" as const : "configured" as const,
    };
  }).sort((a, b) => (
    (b.meta ?? 0) - (a.meta ?? 0)
    || b.universe - a.universe
    || a.value.localeCompare(b.value, "es", { numeric: true })
  ));
}

function AcreditacionPhoneQuotaEditor({
  draft,
  variables,
  platformSources = [],
  quotaRows,
  onPatchConfig,
}: {
  draft: MonitoreoConfig;
  variables: MonitoreoVariable[];
  platformSources?: MonitoreoSource[];
  quotaRows: Array<Record<string, unknown>>;
  onPatchConfig: (patch: Partial<MonitoreoConfig>) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [metasPendientes, setMetasPendientes] = useState<MetasPendientes>({});
  const variableOptions = phoneQuotaVariableOptions(variables, draft.control_vars, quotaRows, draft.goals);
  const [activeVariable, setActiveVariable] = useState(() => preferredPhoneQuotaVariable(variables, draft.control_vars, quotaRows, draft.goals));

  useEffect(() => {
    if (!activeVariable || !variableOptions.includes(activeVariable)) {
      setActiveVariable(preferredPhoneQuotaVariable(variables, draft.control_vars, quotaRows, draft.goals));
    }
  }, [activeVariable, draft.control_vars, draft.goals, quotaRows, variableOptions, variables]);

  const rows = buildAcreditacionPhoneQuotaEditorRows({
    variable: activeVariable,
    variables,
    goals: draft.goals,
    quotaRows,
  });
  const allCandidateVariables = variableOptions.map((name) => {
    const candidateRows = buildAcreditacionPhoneQuotaEditorRows({
      variable: name,
      variables,
      goals: draft.goals,
      quotaRows,
    });
    return {
      name,
      label: phoneQuotaVariableLabel(name),
      categories: candidateRows.length,
      universe: candidateRows.reduce((sum, row) => sum + row.universe, 0),
      meta: phoneQuotaGoalTotal(draft.goals, name),
    };
  });
  const candidateVariables = allCandidateVariables
    .filter((candidate) => (
      normalizeSourceMatch(candidate.name) === normalizeSourceMatch(activeVariable)
      || candidate.universe > 0
      || candidate.meta > 0
    ))
    .sort((a, b) => (
      Number(normalizeSourceMatch(b.name) === normalizeSourceMatch(activeVariable)) - Number(normalizeSourceMatch(a.name) === normalizeSourceMatch(activeVariable))
      || b.universe - a.universe
      || b.meta - a.meta
      || a.label.localeCompare(b.label, "es")
    ))
    .slice(0, 6);
  const quotaTotal = activeVariable ? phoneQuotaGoalTotal(draft.goals, activeVariable) : 0;
  const totalUniverse = rows.reduce((sum, row) => sum + row.universe, 0);
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const totalGap = rows.reduce((sum, row) => sum + (row.gap ?? 0), 0);
  const rowsWithoutBase = rows.filter((row) => row.meta != null && row.meta > 0 && row.universe <= 0).length;
  const activeVariableLabel = activeVariable ? phoneQuotaVariableLabel(activeVariable) : "Sin variable";
  const phoneFilter = normalizePhoneEffectiveFilter(draft.monitoreo_profile?.platform_effective_filter);
  const phoneFilterConfigured = Boolean(phoneFilter.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phoneFilterQuestionLabel = phoneFilter.label || (phoneFilter.variable ? phoneQuotaVariableLabel(phoneFilter.variable) : "");
  const phoneFilterValueLabel = phoneFilter.value_label || phoneFilter.values.join(", ");
  const activePlatformSources = platformSources.filter((source) => source.enabled);
  const variableIsSaved = activeVariable
    ? draft.control_vars.some((name) => normalizeSourceMatch(name) === normalizeSourceMatch(activeVariable))
    : false;
  const quotaProgressPct = quotaTotal > 0
    ? safePercentValue(totalEffective, quotaTotal)
    : safePercentValue(totalEffective, totalUniverse);
  const boundedQuotaProgressPct = Math.max(0, Math.min(100, quotaProgressPct ?? 0));
  const focusRows = [...rows]
    .filter((row) => row.meta != null || row.universe > 0 || row.effective > 0)
    .sort((a, b) => (
      (b.gap ?? 0) - (a.gap ?? 0)
      || (b.meta ?? 0) - (a.meta ?? 0)
      || b.universe - a.universe
      || a.value.localeCompare(b.value, "es", { numeric: true })
    ))
    .slice(0, 6);
  const decisionSteps = [
    {
      key: "filter",
      label: "Filtro",
      value: phoneFilterConfigured ? phoneFilterQuestionLabel : "Sin filtro",
      detail: phoneFilterConfigured ? phoneFilterValueLabel : "Kobo",
      tone: phoneFilterConfigured ? "ready" : "warning",
    },
    {
      key: "variable",
      label: "Variable",
      value: activeVariable ? activeVariableLabel : "Pendiente",
      detail: activeVariable ? `${fmt(rows.length)} categorías` : "Seleccionar",
      tone: activeVariable ? "ready" : "warning",
    },
    {
      key: "goal",
      label: "Meta",
      value: quotaTotal ? fmt(quotaTotal) : "S/M",
      detail: quotaTotal ? "cuotas Kobo" : "sin objetivo",
      tone: quotaTotal ? "ready" : "warning",
    },
    {
      key: "effective",
      label: "Kobo",
      value: fmt(totalEffective),
      detail: "filtradas",
      tone: totalEffective ? "ready" : "neutral",
    },
    {
      // Se llamaba «Avance» y mostraba la brecha: con el mínimo cubierto decía
      // «Avance 0» junto a un 105,8 % de cumplimiento (plan §2.5).
      key: "gap",
      label: "Brecha",
      value: totalGap ? fmt(totalGap) : "0",
      detail: totalGap ? "faltan para el mínimo" : "mínimo cubierto",
      tone: totalGap ? "warning" : "ready",
    },
  ] as const;
  const governorFacts = [
    {
      key: "kobo",
      label: "Fuente Kobo",
      value: activePlatformSources.length ? `${fmt(activePlatformSources.length)} activa${activePlatformSources.length === 1 ? "" : "s"}` : "Pendiente",
      tone: activePlatformSources.length ? "ready" : "warning",
    },
    {
      key: "filter",
      label: "Efectiva Kobo",
      value: phoneFilterConfigured ? `${phoneFilterQuestionLabel} = ${phoneFilterValueLabel}` : "Configurar filtro",
      tone: phoneFilterConfigured ? "ready" : "warning",
    },
    {
      key: "quota",
      label: "Cuotas",
      value: activeVariable ? `${activeVariableLabel} · ${fmt(rows.length)} categorías` : "Sin variable",
      tone: activeVariable ? "ready" : "warning",
    },
    {
      key: "match",
      label: "Contraste",
      value: "CodPulso Kobo vs barrido",
      tone: activePlatformSources.length && activeVariable ? "ready" : "warning",
    },
  ] as const;

  const saveActiveVariable = () => {
    if (!activeVariable) return;
    const nextControlVars = variableIsSaved ? draft.control_vars : [...draft.control_vars, activeVariable];
    onPatchConfig({
      control_vars: nextControlVars,
      objetivo_total: quotaTotal > 0 ? quotaTotal : draft.objetivo_total,
    });
  };

  const patchGoals = (goals: MonitoreoGoal[]) => {
    const nextControlVars = activeVariable && !draft.control_vars.includes(activeVariable)
      ? [...draft.control_vars, activeVariable]
      : draft.control_vars;
    const nextTotal = activeVariable ? phoneQuotaGoalTotal(goals, activeVariable) : 0;
    onPatchConfig({
      goals,
      control_vars: nextControlVars,
      objetivo_total: nextTotal > 0 ? nextTotal : draft.objetivo_total,
    });
  };
  const updateMeta = (value: string, meta: number, keepZero = false) => {
    if (!activeVariable) return;
    patchGoals(phoneQuotaUpsertGoal(draft.goals, activeVariable, value, meta, keepZero));
  };
  // Ajustar metas no recalcula: se acumulan acá y el recálculo ocurre una vez,
  // al confirmar. Ver metasPendientes.ts.
  const metaGuardada = (value: string) => rows.find((row) => row.value === value)?.meta ?? 0;
  const metasCambiadas = metasQueCambian(metasPendientes, metaGuardada);
  const confirmarMetas = () => {
    if (!activeVariable || !metasCambiadas.length) return;
    patchGoals(aplicarMetasPendientes(
      draft.goals,
      metasPendientes,
      metaGuardada,
      (goals, value, meta) => phoneQuotaUpsertGoal(goals, activeVariable, value, meta, true),
    ));
    setMetasPendientes({});
  };
  const descartarMetas = () => setMetasPendientes({});
  const removeValue = (value: string) => {
    if (!activeVariable) return;
    setMetasPendientes((current) => {
      const { [value]: _quitada, ...resto } = current;
      return resto;
    });
    patchGoals(phoneQuotaRemoveGoal(draft.goals, activeVariable, value));
  };
  const addCategory = () => {
    const value = newValue.trim();
    if (!activeVariable || !value) return;
    updateMeta(value, 0, true);
    setNewValue("");
  };

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-phone-quota-editor">
      <div className="mon-phone-quota-editor-head">
        {/* El subtítulo decía «Kobo aporta efectivas; el barrido conserva estados
          * telefónicos en paralelo»: el mismo hecho que la cabecera de Cuotas
          * enuncia con otra redacción, y en ninguna de las dos habla de lo que
          * esa superficie mide —ambas son de metas, no de fuentes—. Además cada
          * cifra ya se rotula «Efectivas Kobo» o «barridos». Diagnosticado en
          * plan-fuentes-legibles §4.4 y pendiente desde entonces.
          *
          * El título tampoco nombra la pregunta: «Sede organiza categorías y
          * metas» describe la mecánica de la variable. Lo que se decide aquí es
          * cuánto se quiere de cada categoría. */}
        <div>
          <span>Modelo telefónico</span>
          <strong>{activeVariable ? `Cuánto se quiere de cada ${activeVariableLabel.toLocaleLowerCase("es")}` : "Elige la variable rectora"}</strong>
        </div>
        <div className="mon-phone-quota-editor-controls">
          <label>
            <span>Variable</span>
            <select value={activeVariable} onChange={(event) => setActiveVariable(event.target.value)}>
              <option value="">Seleccionar</option>
              {variableOptions.map((name) => <option key={name} value={name}>{phoneQuotaVariableLabel(name)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="mon-phone-quota-governor-save"
            onClick={saveActiveVariable}
            disabled={!activeVariable || variableIsSaved}
          >
            <CheckCircle2 size={13} />
            {variableIsSaved ? "Variable guardada" : "Usar para cuotas"}
          </button>
          <label>
            <span>Objetivo total</span>
            <input
              type="number"
              min={0}
              value={draft.objetivo_total ?? (quotaTotal || "")}
              onChange={(event) => onPatchConfig({ objetivo_total: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
        </div>
      </div>
      <div className="mon-phone-quota-governor" aria-label="Variable rectora del monitoreo telefónico">
        <div className="mon-phone-quota-governor-main">
          <div
            className="mon-phone-quota-governor-gauge"
            style={{ "--phone-quota-governor-pct": `${Math.max(2, boundedQuotaProgressPct)}%` } as CSSProperties}
            aria-label={quotaProgressPct == null ? "Sin avance de cuota" : `${formatPercentLabel(quotaProgressPct)} de la meta Kobo`}
          >
            <strong>{quotaProgressPct == null ? "S/M" : formatPercentLabel(quotaProgressPct)}</strong>
            <em>Kobo</em>
          </div>
          <div>
            <span><SlidersHorizontal size={13} /> Variable rectora</span>
            <strong>{activeVariable ? activeVariableLabel : "Seleccionar variable"}</strong>
            {/* Con variable elegida sobra el párrafo: enumeraba meta, base
              * telefónica y efectivas Kobo, que son las columnas que la tabla de
              * abajo ya rotula. Sin variable sí hace falta, porque entonces no
              * hay nada que mirar y hay que decir qué se elige. */}
            {activeVariable ? null : <p>Elige la variable que define las cuotas operativas del estudio telefónico.</p>}
          </div>
        </div>
        <div className="mon-phone-quota-decision-path" aria-label="Regla de lectura de cuotas telefónicas">
          {decisionSteps.map((step, index) => (
            <Fragment key={step.key}>
              <span className={`is-${step.tone}`}>
                <em>{step.label}</em>
                <strong>{step.value}</strong>
                <small>{step.detail}</small>
              </span>
              {index < decisionSteps.length - 1 ? <i aria-hidden="true" /> : null}
            </Fragment>
          ))}
        </div>
        <div className="mon-phone-quota-governor-facts" aria-label="Condiciones para contar efectivas Kobo por cuota">
          {governorFacts.map((fact) => (
            <span key={fact.key} className={`is-${fact.tone}`}>
              <em>{fact.label}</em>
              <strong title={fact.value}>{fact.value}</strong>
            </span>
          ))}
        </div>
        {focusRows.length ? (
          <div className="mon-phone-quota-gap-board" aria-label={`Categorías de cuota por ${activeVariableLabel}`}>
            <header>
              <span><BarChart3 size={13} /> Categorías de {activeVariableLabel}</span>
              <strong>{fmt(rows.length)} categorías · {quotaTotal ? `${fmt(quotaTotal)} meta` : "sin meta"}</strong>
            </header>
            <div>
              {focusRows.map((row) => {
                const metaPct = row.meta != null && row.universe > 0 ? safePercentValue(row.meta, row.universe) ?? 0 : 0;
                return (
                  <article key={row.key} className={row.meta != null ? "is-ready" : "is-gap"}>
                    <span>
                      <strong>{row.value}</strong>
                      <em>{fmt(row.universe)} base · {row.meta == null ? "sin meta" : `${fmt(row.meta)} meta`}</em>
                    </span>
                    <i
                      aria-hidden="true"
                      style={{
                        "--phone-quota-gap-pct": "0%",
                        "--phone-quota-progress-pct": `${Math.max(metaPct ? 4 : 0, Math.min(100, metaPct))}%`,
                      } as CSSProperties}
                    />
                    <small>{row.requiredSuccessPct == null ? "sin base" : `${formatPercentLabel(row.requiredSuccessPct)} requerido`}</small>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
        {candidateVariables.length ? (
          <div className="mon-phone-quota-governor-candidates" aria-label="Variables candidatas para cuotas">
            {candidateVariables.map((candidate) => (
              <button
                key={candidate.name}
                type="button"
                className={normalizeSourceMatch(candidate.name) === normalizeSourceMatch(activeVariable) ? "is-active" : ""}
                onClick={() => setActiveVariable(candidate.name)}
              >
                <strong>{candidate.label}</strong>
                <em>{fmt(candidate.categories)} categorías · {fmt(candidate.universe)} base{candidate.meta ? ` · ${fmt(candidate.meta)} meta` : ""}</em>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mon-phone-quota-editor-summary" aria-label="Resumen de cuotas telefónicas editables">
        <span><em>Objetivo Kobo</em><strong>{quotaTotal ? fmt(quotaTotal) : "S/M"}</strong></span>
        <span><em>Base telefónica</em><strong>{fmt(totalUniverse)}</strong></span>
        <span><em>Efectivas Kobo</em><strong>{fmt(totalEffective)}</strong></span>
        <span className={totalGap ? "is-warning" : "is-ready"}><em>Pendiente avance</em><strong>{fmt(totalGap)}</strong></span>
        <span className={rowsWithoutBase ? "is-warning" : "is-ready"}><em>Sin base</em><strong>{fmt(rowsWithoutBase)}</strong></span>
      </div>
      <div className="mon-phone-quota-editor-add">
        <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder={`Nuevo valor de ${activeVariable ? phoneQuotaVariableLabel(activeVariable).toLowerCase() : "variable"}`} />
        <button type="button" onClick={addCategory} disabled={!activeVariable || !newValue.trim()}><Plus size={13} /> Agregar categoría</button>
      </div>
      {metasCambiadas.length ? (
        <div className="mon-phone-quota-editor-confirm" role="status">
          <span>{metasCambiadas.length === 1 ? "1 meta ajustada sin confirmar" : `${fmt(metasCambiadas.length)} metas ajustadas sin confirmar`}</span>
          <div>
            <button type="button" onClick={descartarMetas}>Descartar</button>
            <button type="button" className="is-primary" onClick={confirmarMetas}>{etiquetaDeConfirmacion(metasCambiadas.length)}</button>
          </div>
        </div>
      ) : null}
      {rows.length ? (
        <div className="mon-phone-quota-editor-list">
          {rows.map((row) => {
            const progressPct = row.meta && row.meta > 0 ? safePercentValue(row.effective, row.meta) ?? 0 : safePercentValue(row.effective, row.universe) ?? 0;
            // `nonEffectiveMargin` es universo − mínimo: la base que queda
            // disponible por encima de lo que hay que alcanzar. Llamarla «no
            // efectivas» nombraba como resultado de campo lo que es capacidad
            // remanente (plan §2.5).
            const marginTitle = row.nonEffectiveMargin == null
              ? "Sin base"
              : row.nonEffectiveMargin >= 0
                ? `${fmt(row.nonEffectiveMargin)} casos de reserva por encima del mínimo`
                : `${fmt(Math.abs(row.nonEffectiveMargin))} casos de base faltantes para el mínimo`;
            const marginLabel = row.nonEffectiveMargin == null
              ? "Sin base"
              : row.nonEffectiveMargin >= 0
                ? fmt(row.nonEffectiveMargin)
                : fmt(Math.abs(row.nonEffectiveMargin));
            const marginMetricLabel = row.nonEffectiveMargin != null && row.nonEffectiveMargin < 0 ? "Base faltante" : "Reserva";
            return (
              <article key={row.key} className={`mon-phone-quota-editor-row ${row.source === "configured" ? "is-configured" : ""} ${row.gap ? "is-gap" : "is-ready"}`}>
                <header>
                  <div>
                    <span>{row.variableLabel}</span>
                    <strong>{row.value}</strong>
                  </div>
                  <button type="button" aria-label={`Quitar cuota ${row.value}`} onClick={() => removeValue(row.value)}>
                    <XCircle size={14} />
                  </button>
                </header>
                <div className="mon-phone-quota-editor-row-grid">
                  <span><em>Universo</em><strong>{fmt(row.universe)}</strong></span>
                  <label>
                    <span>Meta</span>
                    <MetaCuotaInput
                      value={metasPendientes[row.value] ?? row.meta}
                      ariaLabel={`Meta de ${row.value}`}
                      onCommit={(meta) => setMetasPendientes((current) => ({ ...current, [row.value]: meta }))}
                    />
                  </label>
                  <span><em>Efectivas</em><strong>{fmt(row.effective)}</strong></span>
                  <span><em>Brecha</em><strong>{row.gap == null ? "S/M" : fmt(row.gap)}</strong></span>
                  <span><em title="Tasa requerida para cubrir la meta Kobo">Tasa req.</em><strong>{row.requiredSuccessPct == null ? "S/B" : formatPercentLabel(row.requiredSuccessPct)}</strong></span>
                  <span><em title={marginTitle}>{marginMetricLabel}</em><strong title={marginTitle}>{marginLabel}</strong></span>
                </div>
                <i aria-hidden="true" style={{ "--phone-quota-editor-pct": `${Math.max(2, Math.min(100, progressPct))}%` } as CSSProperties} />
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyPanel title="Sin categorías de cuota" detail="Selecciona una variable de control o agrega una categoría para definir metas telefónicas." />
      )}
    </section>
  );
}

function AcreditacionModelConfigWorkbench({
  state,
  activeTab,
  onStateChange,
  showHeader = true,
}: {
  state?: MonitoreoState | null;
  activeTab: AcreditacionModelTab;
  onStateChange?: (state: MonitoreoState) => void;
  showHeader?: boolean;
}) {
  const [draft, setDraft] = useState<MonitoreoConfig | null>(() => state?.config ?? null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    if (state?.config) setDraft(state.config);
  }, [state?.config]);

  // Antes del early-return (regla de hooks) y memoizado (unidad 2.3): sin el
  // memo, cada render del workbench reconstruía el árbol de reportes entero.
  const modelReports = useMemo(() => reportsFromState(state ?? null), [state]);

  if (!state || !draft) {
    return <EmptyPanel title="Modelo pendiente" detail="La configuración operativa se activa cuando el proyecto termina de cargar su estado local." />;
  }

  const variables = state.variables ?? [];
  const variableNames = variables.map((variable) => variable.name);
  const model = draft.operational_model;
  const statusOptions = statusValueOptions(variables, draft.status_var, draft.valid_statuses);
  const sources = state.sources ?? [];
  const activeSources = sources.filter((source) => source.enabled);
  const goalTotal = draft.goals.reduce((sum, goal) => sum + Math.max(0, Number(goal.meta) || 0), 0);
  const configuredGoals = draft.goals.filter((goal) => Number(goal.meta) > 0).length;
  const goalActorKey = preferredGoalVariable(variableNames);
  const calendarActorLabels = uniqueDisplayValues([
    ...draft.goals.map((goal) => calendarGoalActor(goal, goalActorKey)),
    ...activeSources.map(sourceActorLabel),
  ]);
  const calendarActorPlans: AcreditacionCalendarActorPlan[] = calendarActorLabels.map((actor, index) => {
    const actorKey = normalizeSourceMatch(actor);
    const actorSources = activeSources.filter((source) => {
      const sourceActor = normalizeSourceMatch(sourceActorLabel(source));
      const sourceLabel = normalizeSourceMatch(source.label);
      return sourceActor === actorKey || sourceLabel.includes(actorKey);
    });
    const channels = uniqueDisplayValues(actorSources.map((source) => acreditacionChannelLabel(sourceChannelLabel(source))));
    const meta = calendarGoalForActor(actor, draft.goals, goalActorKey);
    return {
      actor,
      channels,
      sourceCount: actorSources.length,
      meta,
      modality: inferCalendarModality(channels, actorSources),
      startWeek: index + 1,
      endWeek: index + 1,
    };
  });
  const suggestedCalendarEnd = calendarActorPlans.length ? calendarActorPlans[calendarActorPlans.length - 1].endWeek : null;
  const calendarWindow = calendarWeekWindowLabel(draft.strategy_phases, suggestedCalendarEnd);
  const calendarDateWindow = calendarDateWindowLabel(draft.strategy_phases);
  const plannedActorCount = uniqueDisplayValues(draft.strategy_phases.map((phase) => phase.stratum)).length || calendarActorPlans.length;
  const phoneQuotaReportRows = modelReports
    ? rowsForSheetBlock(modelReports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
    : [];
  const showPhoneQuotaEditor = normalizeSourceMatch(draft.monitoreo_profile?.family ?? "").includes("telefon")
    || phoneQuotaReportRows.length > 0
    || draft.operational_model.link_collectors.some((collector) => normalizeSourceMatch(collector.channel ?? "").includes("telefon"));

  const patchConfig = (patch: Partial<MonitoreoConfig>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
  };
  const patchModel = (patch: Partial<MonitoreoConfig["operational_model"]>) => {
    setDraft((current) => current ? {
      ...current,
      operational_model: { ...current.operational_model, ...patch },
    } : current);
  };
  const patchCases = (patch: Partial<MonitoreoConfig["operational_model"]["cases"]>) => {
    patchModel({ cases: { ...model.cases, ...patch } });
  };

  const saveConfig = async () => {
    if (!draft) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando configuración operativa..." });
    try {
      const result = await apiMonitoreoConfig(draft);
      setDraft(result.config);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Modelo operativo guardado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const updateGoal = (index: number, goal: MonitoreoGoal) => {
    patchConfig({ goals: draft.goals.map((item, itemIndex) => itemIndex === index ? goal : item) });
  };
  const removeGoal = (index: number) => {
    patchConfig({ goals: draft.goals.filter((_, itemIndex) => itemIndex !== index) });
  };
  const addGoal = () => {
    const key = preferredGoalVariable(variableNames);
    patchConfig({ goals: [...draft.goals, { filters: key ? { [key]: "" } : {}, meta: 0 }] });
  };
  const updatePhase = (index: number, phase: MonitoreoStrategyPhase) => {
    patchConfig({ strategy_phases: draft.strategy_phases.map((item, itemIndex) => itemIndex === index ? phase : item) });
  };
  const removePhase = (index: number) => {
    patchConfig({ strategy_phases: draft.strategy_phases.filter((_, itemIndex) => itemIndex !== index) });
  };
  const nextPhaseStartWeek = () => {
    const last = Math.max(0, ...draft.strategy_phases.map((phase) => Number(phase.end_week ?? phase.start_week) || 0));
    return last + 1;
  };
  const addPhase = () => {
    const startWeek = nextPhaseStartWeek();
    patchConfig({
      strategy_phases: [
        ...draft.strategy_phases,
        {
          id: `fase-${Date.now()}`,
          stratum: "",
          modality: "email",
          start_week: startWeek,
          end_week: startWeek,
          start_date: "",
          end_date: "",
          client_report_weekday: "",
          client_report_exceptions: [],
          target_rule: "",
          kpi_focus: [],
          kpi_modules: [],
          breakdown_vars: [],
          attempts_var: "",
          outcome_var: "",
        },
      ],
    });
  };

  const header = (
    <section className="mon-acr-model-summary mon-acr-model-config-summary" aria-label="Modelo operativo configurable">
      <div>
        <span>Modelo operativo</span>
        <strong>Variables, metas y reglas de avance</strong>
        <p>Configuración local del proyecto. El seguimiento multi-corte puede importarse después, pero estas pestañas ya controlan el modelo base.</p>
      </div>
      <div className="mon-acr-model-summary__stats">
        <StatTile label="Variables" value={fmt(variableNames.length)} tone={variableNames.length ? "good" : "warn"} />
        <StatTile label="Metas" value={fmt(configuredGoals)} tone={configuredGoals ? "good" : "warn"} />
        <StatTile label="Fases" value={fmt(draft.strategy_phases.length)} tone={draft.strategy_phases.length ? "good" : "neutral"} />
      </div>
      <div className="mon-acr-model-config-actions">
        <button type="button" onClick={() => void saveConfig()} disabled={saving}>
          {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          Guardar modelo
        </button>
        {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      </div>
    </section>
  );

  if (activeTab === "casos") {
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <AcreditacionSweepBaseWorkbench
          sources={sources}
          config={draft}
          cases={model.cases}
          variableNames={variableNames}
          onCasesChange={patchCases}
          onStateChange={onStateChange}
        />
      </div>
    );
  }

  if (activeTab === "enlaces") {
    const collectorSummary = buildAcreditacionActiveSourcesSummary(sources, draft.operational_model.link_collectors);
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-profile-panel mon-acr-model-router-note">
          <div className="mon-profile-panel-head">
            <h3>Enlaces operativos</h3>
            <span>{fmt(collectorSummary.includedCollectors)} recopiladores incluidos</span>
          </div>
          <p className="mon-profile-muted">
            La clasificacion editable de recopiladores vive en Fuentes, dentro de la pestaña Recopiladores. Este modelo conserva la relacion guardada para metas, reglas y avance.
          </p>
          <div className="mon-acr-active-kpis">
            <StatTile label="Encuestas activas" value={fmt(collectorSummary.activeSurveys)} tone={collectorSummary.activeSurveys ? "good" : "warn"} />
            <StatTile label="Actores con encuesta" value={fmt(collectorSummary.actorsWithSurvey.length)} tone={collectorSummary.actorsWithSurvey.length ? "good" : "warn"} />
            <StatTile label="Incluidos" value={fmt(collectorSummary.includedCollectors)} tone={collectorSummary.includedCollectors ? "good" : "neutral"} />
            <StatTile label="Sin metadata" value={fmt(collectorSummary.missingCollectorMetadata)} tone={collectorSummary.missingCollectorMetadata ? "warn" : "good"} />
          </div>
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Fuentes disponibles para mecanismos</h3>
            <span>{fmt(activeSources.length)} activas</span>
          </div>
          <DataTable
            rows={activeSources.map((source) => ({
              Fuente: source.label || source.id,
              Servicio: source.kind,
              Rol: source.role || "respuestas",
              Actor: sourceActorLabel(source),
              Canal: acreditacionChannelLabel(sourceChannelLabel(source)),
              ID: source.id,
            }))}
            empty="Sin fuentes activas para enlazar mecanismos."
            preferredColumns={["Fuente", "Servicio", "Rol", "Actor", "Canal", "ID"]}
          />
        </section>
      </div>
    );
  }

  if (activeTab === "reglas") {
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-contract-block mon-contract-block--wide">
          <div className="mon-contract-block-head">
            <span>Estados válidos y reglas de avance</span>
            <span className="mon-contract-counter">{fmt(model.events.length)} eventos · {fmt(model.state_rules.length)} reglas</span>
          </div>
          <div className="mon-form mon-form--two">
            <AcreditacionVarSelect label="Variable de estado" value={draft.status_var} vars={variableNames} onChange={(status_var) => patchConfig({ status_var })} />
            <AcreditacionValuePicker label="Estados válidos" options={statusOptions} values={draft.valid_statuses} onChange={(valid_statuses) => patchConfig({ valid_statuses })} />
          </div>
          <div className="mon-profile-grid">
            <AcreditacionEventsEditor
              events={model.events}
              onChange={(events) => patchModel({ events })}
            />
            <AcreditacionStateRulesEditor
              rules={model.state_rules}
              eventValues={model.events.map((event) => event.outcome).filter(Boolean)}
              onChange={(state_rules) => patchModel({ state_rules })}
            />
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "estrategias") {
    const seedCalendar = () => {
      patchConfig({ strategy_phases: calendarActorPlans.map(calendarPhaseFromPlan) });
    };
    const addPhaseForPlan = (plan: AcreditacionCalendarActorPlan) => {
      patchConfig({ strategy_phases: [...draft.strategy_phases, calendarPhaseFromPlan(plan, draft.strategy_phases.length)] });
    };
    const distributedCalendar = distributeCalendarDatesByWeek(draft.strategy_phases);
    const distributeCalendar = () => {
      if (distributedCalendar) patchConfig({ strategy_phases: distributedCalendar });
    };
    const setPhaseDuration = (index: number, days: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase?.start_date) return;
      updatePhase(index, {
        ...phase,
        end_date: calendarAddDaysIso(phase.start_date, Math.max(1, days) - 1),
      });
    };
    const alignPhaseAfterPrevious = (index: number) => {
      const phase = draft.strategy_phases[index];
      const previous = draft.strategy_phases.slice(0, index).reverse().find((item) => item.end_date || item.start_date);
      const previousEnd = previous?.end_date || previous?.start_date || "";
      if (!phase || !previousEnd) return;
      const startDate = calendarAddDaysIso(previousEnd, 1);
      const duration = calendarPhaseDurationDays(phase) ?? calendarPhaseWeekDurationDays(phase);
      updatePhase(index, {
        ...phase,
        start_date: startDate,
        end_date: startDate ? calendarAddDaysIso(startDate, Math.max(1, duration) - 1) : phase.end_date,
      });
    };
    const addReportException = (index: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      const exceptions = calendarReportExceptions(phase);
      const { startWeek } = calendarWeekRange(phase);
      updatePhase(index, {
        ...phase,
        client_report_exceptions: [
          ...exceptions,
          { week: startWeek, weekday: normalizeCalendarReportWeekday(phase.client_report_weekday) || "viernes", date: "", note: "" },
        ],
      });
    };
    const updateReportException = (index: number, exceptionIndex: number, patch: Partial<MonitoreoStrategyReportException>) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      const exceptions = calendarReportExceptions(phase).map((item, itemIndex) => (
        itemIndex === exceptionIndex ? { ...item, ...patch } : item
      ));
      updatePhase(index, { ...phase, client_report_exceptions: exceptions });
    };
    const removeReportException = (index: number, exceptionIndex: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      updatePhase(index, {
        ...phase,
        client_report_exceptions: calendarReportExceptions(phase).filter((_, itemIndex) => itemIndex !== exceptionIndex),
      });
    };
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-contract-block mon-contract-block--wide mon-calendar-field-plan">
          <div className="mon-calendar-field-head">
            <div>
              <span>Calendario de campo</span>
              <strong>Ventanas, actor y mecanismo por semana</strong>
            </div>
            <div className="mon-calendar-field-actions">
              {!draft.strategy_phases.length && calendarActorPlans.length ? (
                <button type="button" onClick={seedCalendar}><CalendarRange size={13} /> Crear calendario base</button>
              ) : null}
              <button
                type="button"
                onClick={distributeCalendar}
                disabled={!distributedCalendar}
                title={distributedCalendar ? "Usar la primera fecha definida como ancla y completar cada fase por semana." : "Define la fecha inicio de una fase para distribuir el calendario."}
              >
                <CalendarRange size={13} /> Distribuir semanas
              </button>
              <button type="button" onClick={addPhase}><Plus size={13} /> Agregar fase</button>
            </div>
          </div>
          <div className="mon-calendar-field-summary" aria-label="Resumen del calendario de campo">
            <StatTile label="Ventana campo" value={calendarWindow} tone={draft.strategy_phases.length ? "good" : "warn"} />
            <StatTile label="Fechas campo" value={calendarDateWindow} tone={calendarDateWindow === "Por definir" ? "warn" : "good"} />
            <StatTile label="Actores" value={fmt(plannedActorCount)} tone={plannedActorCount ? "good" : "warn"} />
            <StatTile label="Mecanismos" value={fmt(activeSources.length)} tone={activeSources.length ? "good" : "neutral"} />
          </div>
          <AcreditacionFieldCalendarTimeline phases={draft.strategy_phases} />
          <datalist id="mon-acr-calendar-actors">
            {calendarActorPlans.map((plan) => <option key={plan.actor} value={plan.actor} />)}
          </datalist>
          <div className="mon-calendar-suggestion-grid" aria-label="Fases sugeridas por actor">
            {calendarActorPlans.slice(0, 6).map((plan) => (
              <article key={plan.actor} className="mon-calendar-suggestion-card">
                <header>
                  <span>{calendarWeekRangeLabel(plan.startWeek, plan.endWeek)}</span>
                  <strong>{plan.actor}</strong>
                </header>
                <div className="mon-calendar-suggestion-metrics">
                  <span><Target size={12} /> {plan.meta ? fmt(plan.meta) : "S/M"}</span>
                  <span><Route size={12} /> {MODEL_MODALITY_OPTIONS.find((option) => option.value === plan.modality)?.label ?? plan.modality}</span>
                  <span><PlugZap size={12} /> {fmt(plan.sourceCount)}</span>
                </div>
                <p>{plan.channels.length ? plan.channels.slice(0, 3).join(" · ") : "Canal por definir"}</p>
                <button type="button" onClick={() => addPhaseForPlan(plan)}>Usar fase</button>
              </article>
            ))}
            {!calendarActorPlans.length ? (
              <EmptyPanel title="Actores pendientes" detail="Configura metas o fuentes activas para armar el calendario por actor." />
            ) : null}
          </div>
          <div className="mon-calendar-phase-list">
            {draft.strategy_phases.map((phase, index) => {
              const dateStatus = calendarPhaseDateStatus(phase, index, draft.strategy_phases);
              const canUsePrevious = Boolean(draft.strategy_phases.slice(0, index).some((item) => item.end_date || item.start_date));
              const reportWeekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
              const reportRows = calendarReportScheduleRows(phase);
              const reportExceptions = calendarReportExceptions(phase);
              return (
                <article key={phase.id || index} className={`mon-calendar-phase-card is-${dateStatus.state}`}>
                  <header>
                    <div className="mon-calendar-phase-title">
                      <span>{calendarWeekRangeLabel(phase.start_week, phase.end_week)}</span>
                      <strong>{phase.stratum || "Campo general"}</strong>
                    </div>
                    <div className="mon-calendar-phase-actions">
                      <span className={`mon-calendar-date-badge is-${dateStatus.state}`}>
                        <CalendarRange size={12} />
                        {dateStatus.label}
                      </span>
                      <button type="button" className="mon-icon-action" aria-label="Quitar fase" onClick={() => removePhase(index)}>
                        <XCircle size={13} />
                      </button>
                    </div>
                  </header>
                  <div className="mon-calendar-phase-date-summary">
                    <span>{dateStatus.durationLabel}</span>
                    <em>
                      {dateStatus.detail}
                      {reportWeekday ? ` · Reporte ${calendarReportWeekdayLabel(reportWeekday).toLowerCase()}` : ""}
                    </em>
                  </div>
                  <div className="mon-calendar-phase-grid">
                    <label className="mon-calendar-phase-wide">
                      <span>Corte / actor</span>
                      <input list="mon-acr-calendar-actors" value={phase.stratum} onChange={(event) => updatePhase(index, { ...phase, stratum: event.target.value })} />
                    </label>
                    <label>
                      <span>Mecanismo</span>
                      <select value={phase.modality} onChange={(event) => updatePhase(index, { ...phase, modality: event.target.value as MonitoreoStrategyPhase["modality"] })}>
                        {MODEL_MODALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Semana campo inicio</span>
                      <input
                        type="number"
                        min={1}
                        value={phase.start_week ?? ""}
                        onChange={(event) => {
                          const startWeek = event.target.value ? Number(event.target.value) : null;
                          const endWeek = startWeek && phase.end_week && phase.end_week < startWeek ? startWeek : phase.end_week;
                          updatePhase(index, { ...phase, start_week: startWeek, end_week: endWeek });
                        }}
                      />
                    </label>
                    <label>
                      <span>Semana campo fin</span>
                      <input
                        type="number"
                        min={1}
                        value={phase.end_week ?? ""}
                        onChange={(event) => {
                          const rawEndWeek = event.target.value ? Number(event.target.value) : null;
                          const endWeek = rawEndWeek && phase.start_week && rawEndWeek < phase.start_week ? phase.start_week : rawEndWeek;
                          updatePhase(index, { ...phase, end_week: endWeek });
                        }}
                      />
                    </label>
                    <div className="mon-calendar-date-editor mon-calendar-phase-wide">
                      <label>
                        <span>Fecha campo inicio</span>
                        <input
                          type="date"
                          value={phase.start_date ?? ""}
                          onChange={(event) => {
                            const startDate = event.target.value;
                            const endDate = startDate && phase.end_date && phase.end_date < startDate ? startDate : (phase.end_date || startDate);
                            updatePhase(index, { ...phase, start_date: startDate, end_date: endDate });
                          }}
                        />
                      </label>
                      <label>
                        <span>Fecha campo fin</span>
                        <input
                          type="date"
                          min={phase.start_date || undefined}
                          value={phase.end_date ?? ""}
                          onChange={(event) => {
                            const rawEndDate = event.target.value;
                            const endDate = rawEndDate && phase.start_date && rawEndDate < phase.start_date ? phase.start_date : rawEndDate;
                            updatePhase(index, { ...phase, end_date: endDate });
                          }}
                        />
                      </label>
                      <div className="mon-calendar-date-quick" aria-label={`Atajos de fecha para ${phase.stratum || `fase ${index + 1}`}`}>
                        <button type="button" onClick={() => setPhaseDuration(index, 1)} disabled={!phase.start_date}>1 día</button>
                        <button type="button" onClick={() => setPhaseDuration(index, 3)} disabled={!phase.start_date}>3 días</button>
                        <button type="button" onClick={() => setPhaseDuration(index, 7)} disabled={!phase.start_date}>7 días</button>
                        <button type="button" onClick={() => alignPhaseAfterPrevious(index)} disabled={!canUsePrevious}>Desde anterior</button>
                      </div>
                    </div>
                    <div className="mon-calendar-report-editor mon-calendar-phase-wide">
                      <div className="mon-calendar-report-rule">
                        <label>
                          <span>Reporte al cliente</span>
                          <select
                            value={reportWeekday}
                            onChange={(event) => updatePhase(index, {
                              ...phase,
                              client_report_weekday: event.target.value as MonitoreoReportWeekday | "",
                            })}
                          >
                            <option value="">Sin cadencia semanal</option>
                            {CALENDAR_REPORT_WEEKDAYS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" onClick={() => addReportException(index)}>
                          <Plus size={12} />
                          Agregar excepción
                        </button>
                      </div>
                      {reportRows.length ? (
                        <div className="mon-calendar-report-preview" aria-label={`Fechas de reporte al cliente para ${phase.stratum || `fase ${index + 1}`}`}>
                          {reportRows.slice(0, 6).map((row) => (
                            <span key={row.key} className={row.isException ? "is-exception" : ""}>
                              <strong>{row.week ? `S${fmt(row.week)}` : "Extra"}</strong>
                              <em>{row.label}</em>
                              <small>{calendarReportWeekdayLabel(row.weekday)}</small>
                            </span>
                          ))}
                          {reportRows.length > 6 ? <span><strong>+{fmt(reportRows.length - 6)}</strong><em>más</em><small>reporte</small></span> : null}
                        </div>
                      ) : (
                        <p className="mon-calendar-report-empty">Define un día semanal o una excepción para programar reportes al cliente.</p>
                      )}
                      {reportExceptions.length ? (
                        <div className="mon-calendar-report-exceptions" aria-label={`Excepciones de reporte al cliente para ${phase.stratum || `fase ${index + 1}`}`}>
                          {reportExceptions.map((exception, exceptionIndex) => (
                            <article key={`${exception.week ?? "extra"}-${exceptionIndex}`}>
                              <label>
                                <span>Semana</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={exception.week ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, {
                                    week: event.target.value ? Number(event.target.value) : null,
                                  })}
                                />
                              </label>
                              <label>
                                <span>Día excepción</span>
                                <select
                                  value={normalizeCalendarReportWeekday(exception.weekday)}
                                  onChange={(event) => updateReportException(index, exceptionIndex, {
                                    weekday: event.target.value as MonitoreoReportWeekday | "",
                                  })}
                                >
                                  <option value="">Sin día</option>
                                  {CALENDAR_REPORT_WEEKDAYS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Fecha fija</span>
                                <input
                                  type="date"
                                  value={exception.date ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, { date: event.target.value })}
                                />
                              </label>
                              <label className="mon-calendar-report-exception-note">
                                <span>Motivo</span>
                                <input
                                  value={exception.note ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, { note: event.target.value })}
                                  placeholder="ej. feriado, comité, cierre"
                                />
                              </label>
                              <button type="button" className="mon-icon-action" aria-label="Quitar excepción" onClick={() => removeReportException(index, exceptionIndex)}>
                                <XCircle size={13} />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label className="mon-calendar-phase-wide">
                      <span>Regla objetivo</span>
                      <input value={phase.target_rule} onChange={(event) => updatePhase(index, { ...phase, target_rule: event.target.value })} placeholder="ej. completar meta del actor" />
                    </label>
                    <label className="mon-calendar-phase-wide">
                      <span>Foco KPI</span>
                      <input
                        value={phase.kpi_focus.join(", ")}
                        onChange={(event) => updatePhase(index, { ...phase, kpi_focus: splitCalendarTokens(event.target.value) })}
                        placeholder="meta actor, avance efectivo, faltantes"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
            {!draft.strategy_phases.length ? <EmptyPanel title="Sin fases guardadas" detail="El calendario base se arma desde actores, metas y fuentes activas." /> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mon-acr-model mon-acr-model-config">
      {showHeader ? header : null}
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Cortes, metas y variables</span>
          <span className="mon-contract-counter">{fmt(configuredGoals)}/{fmt(draft.goals.length)} metas · total {goalTotal ? fmt(goalTotal) : "S/M"}</span>
        </div>
        <div className="mon-form mon-form--two">
          <AcreditacionVarSelect label="Enumerador" value={draft.enumerator_var} vars={variableNames} onChange={(enumerator_var) => patchConfig({ enumerator_var })} />
          <AcreditacionVarSelect label="Fecha" value={draft.date_var} vars={variableNames} onChange={(date_var) => patchConfig({ date_var })} />
          <AcreditacionVarSelect label="Estado" value={draft.status_var} vars={variableNames} onChange={(status_var) => patchConfig({ status_var })} />
          <AcreditacionVarSelect label="Duración" value={draft.duration_var} vars={variableNames} onChange={(duration_var) => patchConfig({ duration_var })} />
          <AcreditacionVarSelect label="ID" value={draft.id_var} vars={variableNames} onChange={(id_var) => patchConfig({ id_var })} />
          <AcreditacionVarSelect label="Contacto" value={draft.contact_var} vars={variableNames} onChange={(contact_var) => patchConfig({ contact_var })} />
          <label>
            <span>Meta total</span>
            <input
              type="number"
              min={0}
              value={draft.objetivo_total ?? ""}
              onChange={(event) => patchConfig({ objetivo_total: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
          <AcreditacionValuePicker label="Estados válidos" options={statusOptions} values={draft.valid_statuses} onChange={(valid_statuses) => patchConfig({ valid_statuses })} />
        </div>
        <div className="mon-profile-grid">
          <AcreditacionVariableChipPicker label="Variables de corte / estrato" vars={variableNames} selected={draft.control_vars} onChange={(control_vars) => patchConfig({ control_vars })} />
          <AcreditacionVariableChipPicker label="Campos críticos" vars={variableNames} selected={draft.critical_vars} onChange={(critical_vars) => patchConfig({ critical_vars })} />
        </div>
      </section>
      {showPhoneQuotaEditor ? (
        <AcreditacionPhoneQuotaEditor
          draft={draft}
          variables={variables}
          platformSources={sources.filter(isKoboResponseSource)}
          quotaRows={phoneQuotaReportRows}
          onPatchConfig={patchConfig}
        />
      ) : null}
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Metas por corte / estrato</span>
          <button type="button" onClick={addGoal}><Plus size={13} /> Agregar meta</button>
        </div>
        <AcreditacionGoalsEditor goals={draft.goals} vars={variableNames} onUpdate={updateGoal} onRemove={removeGoal} />
      </section>
    </div>
  );
}

function AcreditacionSweepBaseWorkbench({
  sources,
  config,
  cases,
  variableNames,
  onCasesChange,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  cases: MonitoreoConfig["operational_model"]["cases"];
  variableNames: string[];
  onCasesChange: (patch: Partial<MonitoreoConfig["operational_model"]["cases"]>) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [selectedByChannel, setSelectedByChannel] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const sweepPreset = ACREDITACION_SOURCE_PRESETS.find((preset) => preset.key === "barrido_telefonico") ?? ACREDITACION_SOURCE_PRESETS[1];
  const telephoneChannels = useMemo(
    () => buildAcreditacionTelephoneChannels(sources, config.operational_model.link_collectors),
    [config.operational_model.link_collectors, sources],
  );
  const sweepSourceCandidates = useMemo(() => acreditacionSweepSources(sources), [sources]);
  const selectableSweepSources = sweepSourceCandidates.filter((source) => source.enabled);
  const confirmedChannels = telephoneChannels.filter((channel) => (
    Boolean(acreditacionSweepSourceForChannel(sweepSourceCandidates, channel))
  ));
  const sourceOptions = selectableSweepSources.length ? selectableSweepSources : sweepSourceCandidates;

  const confirmSweepBase = async (channel: AcreditacionTelephoneChannel) => {
    const matched = acreditacionSweepSourceForChannel(sweepSourceCandidates, channel);
    const sourceId = selectedByChannel[channel.key] ?? matched?.id ?? "";
    const source = sweepSourceCandidates.find((item) => item.id === sourceId) ?? null;
    if (!source) {
      setStatus({ tone: "error", message: "Selecciona o registra una hoja de barrido antes de confirmar." });
      return;
    }
    setSavingKey(channel.key);
    setStatus({ tone: "info", message: `Confirmando barrido para ${channel.actor}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
        enabled: true,
        role: "barrido",
        integration_mode: source.integration_mode || "connected_read",
        dimensions: cleanSourceDimensions({
          ...source.dimensions,
          actor: channel.actor,
          segmento: channel.actor,
          canal: "Telefónico",
          channel: "Telefónico",
          servicio: "Barrido telefónico",
          sheet_name: source.sheet_binding?.sheet_name ?? source.dimensions?.sheet_name,
          survey_id: channel.surveyId || undefined,
          survey_source_id: channel.sourceId || undefined,
          source_id: channel.sourceId || undefined,
          collector_id: channel.collectorId || undefined,
          collector_name: channel.collectorName || undefined,
        }),
      }));
      onStateChange?.(result.state);
      setSelectedByChannel((current) => ({ ...current, [channel.key]: result.source.id }));
      onCasesChange({ enabled: true, roster_source: "external_local" });
      setStatus({ tone: "success", message: `Base de barrido confirmada para ${channel.actor}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSavingKey("");
    }
  };

  return (
    <>
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Base de barrido</span>
          <label className="mon-switch-line">
            <input
              type="checkbox"
              checked={Boolean(cases.enabled)}
              onChange={(event) => onCasesChange({ enabled: event.target.checked })}
            />
            <span>Usar barrido operativo</span>
          </label>
        </div>
        <div className="mon-acr-active-kpis" aria-label="Resumen de base de barrido">
          <StatTile label="Canales telefónicos" value={fmt(telephoneChannels.length)} tone={telephoneChannels.length ? "good" : "warn"} />
          <StatTile label="Bases de barrido" value={fmt(sweepSourceCandidates.length)} tone={sweepSourceCandidates.length ? "good" : "warn"} />
          <StatTile label="Confirmadas" value={`${fmt(confirmedChannels.length)}/${fmt(telephoneChannels.length)}`} tone={telephoneChannels.length && confirmedChannels.length === telephoneChannels.length ? "good" : "warn"} />
        </div>
        <p className="mon-profile-muted">
          Los canales telefónicos salen de Enlaces y envíos. La base de barrido se confirma contra una fuente Google Sheets con rol barrido para que el modelo sepa qué hoja alimenta responsables, intentos y estados.
        </p>
        {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
        <div className="mon-profile-grid">
          <AcreditacionSheetSourceEditor preset={sweepPreset} sources={sweepSourceCandidates} onStateChange={onStateChange} />
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Campos operativos</h3>
              <span>{cases.enabled ? "Activo" : "Pendiente"}</span>
            </div>
            <div className="mon-form mon-form--two">
              <AcreditacionVarSelect label="Identificador" value={cases.case_id_var} vars={variableNames} onChange={(value) => onCasesChange({ case_id_var: value })} />
              <AcreditacionVarSelect label="Persona o caso" value={cases.person_label_var} vars={variableNames} onChange={(value) => onCasesChange({ person_label_var: value })} />
              <AcreditacionVarSelect label="Estado reportado" value={cases.status_var} vars={variableNames} onChange={(value) => onCasesChange({ status_var: value })} />
              <label>
                <span>Origen del barrido</span>
                <select
                  value={cases.roster_source}
                  onChange={(event) => onCasesChange({ roster_source: event.target.value as MonitoreoConfig["operational_model"]["cases"]["roster_source"] })}
                >
                  {MODEL_ROSTER_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mon-profile-grid">
              <AcreditacionVariableChipPicker label="Campos de contacto" vars={variableNames} selected={cases.contact_vars} onChange={(contact_vars) => onCasesChange({ contact_vars })} />
              <AcreditacionVariableChipPicker label="Campos sensibles" vars={variableNames} selected={cases.sensitive_vars} onChange={(sensitive_vars) => onCasesChange({ sensitive_vars })} />
            </div>
          </section>
        </div>
      </section>
      <section className="mon-contract-block mon-contract-block--wide mon-channel-selector-matrix" aria-label="Canales telefónicos con base de barrido">
        <div className="mon-contract-block-head">
          <span>Canales telefónicos definidos en Enlaces y envíos</span>
          <span className="mon-contract-counter">{fmt(confirmedChannels.length)} confirmados</span>
        </div>
        {!telephoneChannels.length ? (
          <EmptyPanel title="Sin canales telefónicos" detail="Clasifica al menos un recopilador como Teléfono asistido o Barrido en Enlaces y envíos." />
        ) : (
          <div className="mon-collector-list">
            {telephoneChannels.map((channel) => {
              const matched = acreditacionSweepSourceForChannel(sweepSourceCandidates, channel);
              const selectedId = selectedByChannel[channel.key] ?? matched?.id ?? "";
              const selectedSource = sourceOptions.find((source) => source.id === selectedId) ?? matched ?? null;
              const dimensions = sourceDimensionEntries(selectedSource?.dimensions).slice(0, 5);
              return (
                <article key={channel.key} className={`mon-collector-card mon-collector-card--channel is-${matched ? "telefono" : "mixto"}`}>
                  <div className="mon-collector-title">
                    <span className="mon-collector-use-icon"><PhoneCall size={14} /></span>
                    <div>
                      <strong>{channel.actor}</strong>
                      <em>{channel.collectorName} · {channel.sourceName}</em>
                    </div>
                    <span className="mon-collector-chip">{matched ? "Base confirmada" : "Por confirmar"}</span>
                  </div>
                  <div className="mon-collector-metrics">
                    <AcreditacionCollectorMetric label="Respuestas" value={channel.responseCount} tone={channel.responseCount ? "ready" : "neutral"} />
                    <AcreditacionCollectorMetric label="Barrido" value={matched ? 1 : 0} tone={matched ? "ready" : "warning"} />
                    <AcreditacionCollectorMetric label="Hoja" value={selectedSource?.sheet_binding?.sheet_name ? 1 : 0} tone={selectedSource?.sheet_binding?.sheet_name ? "ready" : "neutral"} />
                  </div>
                  <div className="mon-collector-controls mon-collector-controls--channel">
                    <label>
                      <span>Base de barrido</span>
                      <select
                        value={selectedId}
                        onChange={(event) => setSelectedByChannel((current) => ({ ...current, [channel.key]: event.currentTarget.value }))}
                        disabled={Boolean(savingKey)}
                      >
                        <option value="">Sin base confirmada</option>
                        {sourceOptions.map((source) => (
                          <option key={source.id} value={source.id}>
                            {[source.label || source.id, source.sheet_binding?.sheet_name, sourceActorLabel(source)].filter(Boolean).join(" · ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="pulso-primary"
                      onClick={() => { void confirmSweepBase(channel); }}
                      disabled={savingKey === channel.key || !selectedId}
                    >
                      {savingKey === channel.key ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                      Confirmar selección
                    </button>
                  </div>
                  <div className="mon-collector-channel-line">
                    <AcreditacionChannelBadge channel={channel.channel} />
                    <span>{channel.collectorId || channel.sourceId} · {channel.collectorType}</span>
                  </div>
                  {selectedSource ? (
                    <div className="mon-source-dim-badges">
                      <span>{selectedSource.sheet_binding?.sheet_name || "Pestaña pendiente"}</span>
                      {sourceSpreadsheetUrl(selectedSource) ? (
                        <a href={sourceSpreadsheetUrl(selectedSource)} target="_blank" rel="noreferrer">
                          {sourceSpreadsheetDisplay(selectedSource)}
                        </a>
                      ) : null}
                      {dimensions.map(([key, value]) => <span key={`${channel.key}-${key}`}>{dimensionLabel(key)}: {value}</span>)}
                    </div>
                  ) : (
                    <div className="mon-sm-empty">Registra una hoja de barrido arriba para asociarla a este canal.</div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function AcreditacionVarSelect({ label, value, vars, onChange }: { label: string; value: string; vars: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Sin asignar</option>
        {vars.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
    </label>
  );
}

function AcreditacionVariableChipPicker({
  label,
  vars,
  selected,
  onChange,
}: {
  label: string;
  vars: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const available = vars.filter((variable) => !selected.includes(variable));
  return (
    <div className="mon-token-picker">
      <span>{label}</span>
      <select value="" onChange={(event) => event.target.value && onChange([...selected, event.target.value])}>
        <option value="">{available.length ? "Agregar variable..." : "Sin variables disponibles"}</option>
        {available.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
      <div className="mon-token-list">
        {selected.length ? selected.map((variable) => (
          <button key={variable} type="button" onClick={() => onChange(selected.filter((item) => item !== variable))}>
            {variable}
            <XCircle size={12} />
          </button>
        )) : <span className="mon-muted-chip">Sin variables seleccionadas</span>}
      </div>
    </div>
  );
}

function AcreditacionValuePicker({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((option) => option && !values.includes(option));
  return (
    <div className="mon-token-picker mon-row-span">
      <span>{label}</span>
      <select value="" onChange={(event) => event.target.value && onChange([...values, event.target.value])}>
        <option value="">{available.length ? "Agregar estado..." : "Sin estados disponibles"}</option>
        {available.map((option) => <option key={option} value={option}>{prettyModelLabel(option)}</option>)}
      </select>
      <div className="mon-token-list">
        {values.length ? values.map((value) => (
          <button key={value} type="button" onClick={() => onChange(values.filter((item) => item !== value))}>
            {prettyModelLabel(value)}
            <XCircle size={12} />
          </button>
        )) : <span className="mon-muted-chip">Sin estados seleccionados</span>}
      </div>
    </div>
  );
}

function AcreditacionGoalsEditor({
  goals,
  vars,
  onUpdate,
  onRemove,
}: {
  goals: MonitoreoGoal[];
  vars: string[];
  onUpdate: (index: number, goal: MonitoreoGoal) => void;
  onRemove: (index: number) => void;
}) {
  if (!goals.length) {
    return <EmptyPanel title="Sin metas por corte" detail="Agrega metas para que el modelo pueda calcular brechas contra actor, carrera o segmento." />;
  }
  return (
    <div className="mon-goals">
      <div className="mon-goal-row mon-goal-row--head" aria-hidden="true">
        <span>Variable</span>
        <span>Valor</span>
        <span>Meta</span>
        <span />
      </div>
      {goals.map((goal, index) => {
        const key = Object.keys(goal.filters ?? {})[0] ?? "";
        const value = key ? String(goal.filters[key] ?? "") : "";
        return (
          <div key={index} className="mon-goal-row">
            <select
              value={key}
              onChange={(event) => {
                const nextKey = event.target.value;
                onUpdate(index, { ...goal, filters: nextKey ? { [nextKey]: value } : {} });
              }}
            >
              <option value="">Variable</option>
              {vars.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
            </select>
            <input
              value={value}
              onChange={(event) => key && onUpdate(index, { ...goal, filters: { [key]: event.target.value } })}
              placeholder="valor"
            />
            <input
              type="number"
              min={0}
              value={goal.meta ?? 0}
              onChange={(event) => onUpdate(index, { ...goal, meta: Math.max(0, Number(event.target.value) || 0) })}
            />
            <button type="button" aria-label="Quitar meta" onClick={() => onRemove(index)}>
              <XCircle size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AcreditacionEventsEditor({
  events,
  onChange,
}: {
  events: MonitoreoConfig["operational_model"]["events"];
  onChange: (next: MonitoreoConfig["operational_model"]["events"]) => void;
}) {
  const update = (index: number, patch: Partial<MonitoreoConfig["operational_model"]["events"][number]>) => {
    onChange(events.map((event, itemIndex) => itemIndex === index ? { ...event, ...patch } : event));
  };
  return (
    <section className="mon-profile-panel">
      <div className="mon-profile-panel-head">
        <h3>Eventos operativos</h3>
        <button type="button" onClick={() => onChange([...events, {
          id: `evento-${Date.now()}`,
          label: "Completa",
          modality: "email",
          outcome: "completed",
          counts_attempt: true,
          counts_contact: true,
          counts_complete: true,
          stop_contact: true,
        }])}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="mon-contract-list">
        {events.map((event, index) => (
          <article key={event.id || index} className="mon-event-row">
            <label><span>Evento</span><input value={event.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
            <label>
              <span>Modalidad</span>
              <select value={event.modality} onChange={(e) => update(index, { modality: e.target.value as MonitoreoStrategyPhase["modality"] })}>
                {MODEL_MODALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>Resultado</span><input value={event.outcome} onChange={(e) => update(index, { outcome: e.target.value })} /></label>
            <label className="mon-switch-line"><input type="checkbox" checked={event.counts_complete} onChange={(e) => update(index, { counts_complete: e.target.checked })} /><span>Completa</span></label>
          </article>
        ))}
        {!events.length ? <p className="mon-profile-muted">Sin eventos configurados.</p> : null}
      </div>
    </section>
  );
}

function AcreditacionStateRulesEditor({
  rules,
  eventValues,
  onChange,
}: {
  rules: MonitoreoConfig["operational_model"]["state_rules"];
  eventValues: string[];
  onChange: (next: MonitoreoConfig["operational_model"]["state_rules"]) => void;
}) {
  const update = (index: number, patch: Partial<MonitoreoConfig["operational_model"]["state_rules"][number]>) => {
    onChange(rules.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...patch } : rule));
  };
  return (
    <section className="mon-profile-panel">
      <div className="mon-profile-panel-head">
        <h3>Reglas de estado final</h3>
        <button type="button" onClick={() => onChange([...rules, {
          id: `regla-${Date.now()}`,
          label: "Completa válida",
          final_state: "complete",
          priority: rules.length + 1,
          outcome_values: eventValues[0] ? [eventValues[0]] : ["completed"],
          stop_contact: true,
        }])}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="mon-contract-list">
        {rules.map((rule, index) => (
          <article key={rule.id || index} className="mon-rule-row">
            <label><span>Regla</span><input value={rule.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
            <label>
              <span>Estado final</span>
              <select value={rule.final_state} onChange={(e) => update(index, { final_state: e.target.value })}>
                {MODEL_FINAL_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>Prioridad</span><input type="number" min={1} value={rule.priority} onChange={(e) => update(index, { priority: Number(e.target.value) || index + 1 })} /></label>
            <AcreditacionValuePicker
              label="Valores resultado"
              options={Array.from(new Set([...eventValues, ...rule.outcome_values, "completed", "valid", "approved", "rechazo", "rejected"]))}
              values={rule.outcome_values}
              onChange={(outcome_values) => update(index, { outcome_values })}
            />
          </article>
        ))}
        {!rules.length ? <p className="mon-profile-muted">Sin reglas de avance configuradas.</p> : null}
      </div>
    </section>
  );
}

function statusValueOptions(variables: MonitoreoVariable[], statusVar: string, current: string[]) {
  const variableValues = variables.find((variable) => variable.name === statusVar)?.values ?? [];
  return Array.from(new Set([
    ...current,
    ...variableValues,
    "completed",
    "complete",
    "valid",
    "approved",
    "submitted",
    "rechazo",
    "rejected",
    "partial",
  ].map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function preferredGoalVariable(vars: string[]) {
  return vars.find((variable) => normalizeSourceMatch(variable).includes("actor"))
    ?? vars.find((variable) => normalizeSourceMatch(variable).includes("carrera"))
    ?? vars.find((variable) => normalizeSourceMatch(variable).includes("segment"))
    ?? vars[0]
    ?? "";
}

function prettyModelLabel(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\bcompleted\b/i, "Completa")
    .replace(/\bapproved\b/i, "Aprobada")
    .replace(/\brejected\b/i, "Rechazo")
    .replace(/\bpartial\b/i, "Parcial");
}

function scopeForView(requestedSection: MonitoreoSeccion, profileFamily?: string): MonitoreoReportScope {
  if (requestedSection === "telefonico") return "phone_summary";
  if (requestedSection === "modelo" && profileFamily === "telefonico") return "phone_summary";
  if (requestedSection === "consultas" && profileFamily === "telefonico") return "phone_summary";
  // Fuentes dejó de ser sólo lectura de conexiones: en telefónico declara qué
  // significa cada estado de la hoja de barrido, y para eso necesita los estados
  // que ESTE corte trajo, que sólo viajan en `phone_summary`. Con `source` el
  // definidor se montaba siempre vacío diciendo que el corte no traía estados,
  // que era falso —ya se cargaban en segundo plano para la sección de al lado—.
  if (requestedSection === "fuentes" && profileFamily === "telefonico") return "phone_summary";
  if (requestedSection === "consultas") return "queries_summary";
  if (requestedSection === "modelo") return "advance_summary";
  if (requestedSection === "fuentes") return "source";
  return "advance_summary";
}

const ACREDITACION_BACKGROUND_SCOPES: MonitoreoReportScope[] = [
  "source",
  "advance_summary",
  "queries_summary",
  "phone_summary",
];

function backgroundScopesForView(view: MonitoreoSeccion, family?: string): MonitoreoReportScope[] {
  if (family === "telefonico") {
    // `fuentes` y `modelo` ya piden `phone_summary` en primer plano; lo que les
    // conviene precalentar es el otro.
    if (view === "fuentes" || view === "modelo") return ["source"];
    if (view === "telefonico") return ["source"];
    if (view === "consultas" || view === "avance") return ["phone_summary"];
    return ["phone_summary"];
  }
  return ACREDITACION_BACKGROUND_SCOPES;
}

function reportsFromState(state: MonitoreoState | null) {
  return normalizeAcreditacionReports(state?.dashboard?.acreditacion_reports ?? null);
}

function normalizeAcreditacionReports(reports: MonitoreoAcreditacionReports | null | undefined): MonitoreoAcreditacionReports | null {
  if (!reports) return null;
  const client = reports.client_report ?? null;
  return {
    ...reports,
    schema: reports.schema || "apps_script_acreditacion_v1",
    generated_at: reports.generated_at || "",
    reference_tabs: Array.isArray(reports.reference_tabs) ? reports.reference_tabs : [],
    internal_queries: reports.internal_queries ?? null,
    client_report: client
      ? {
        ...client,
        summary: Array.isArray(client.summary) ? client.summary : [],
        actors: Array.isArray(client.actors) ? client.actors : [],
        daily_general: Array.isArray(client.daily_general) ? client.daily_general : [],
        daily_actor: Array.isArray(client.daily_actor) ? client.daily_actor : [],
        sources: Array.isArray(client.sources) ? client.sources : [],
        collector_sources: Array.isArray(client.collector_sources) ? client.collector_sources : [],
        controls: Array.isArray(client.controls) ? client.controls : [],
        sheets: Array.isArray(client.sheets) ? client.sheets : [],
      }
      : null,
    sheets: Array.isArray(reports.sheets) ? reports.sheets : [],
  };
}

function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function compactColumns(rows: Array<Record<string, unknown>>, preferred: string[] = [], maxColumns = 8) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, maxColumns);
}

function rowsFromSheets(sheets: MonitoreoReportSheet[] = [], terms: string[] = []) {
  const filters = terms.map((term) => term.toLowerCase());
  return sheets.flatMap((sheet) => (
    sheet.blocks.flatMap((block) => {
      const haystack = `${sheet.id} ${sheet.title} ${block.id} ${block.title}`.toLowerCase();
      if (filters.length && !filters.some((term) => haystack.includes(term))) return [];
      return block.rows.map((row) => ({
        _sheet: sheet.title,
        _block: block.title,
        ...row,
      }));
    })
  ));
}

function rowsForSheetBlock(
  reports: MonitoreoAcreditacionReports,
  sheetId: string,
  blockIds: string[] = [],
) {
  const sheet = reports.sheets.find((item) => item.id === sheetId) ?? null;
  if (!sheet) return [];
  const wanted = new Set(blockIds.map((id) => id.toLowerCase()));
  return sheet.blocks.flatMap((block) => {
    if (wanted.size && !wanted.has(String(block.id).toLowerCase())) return [];
    return block.rows.map((row) => ({
      _block: block.title,
      ...row,
    }));
  }) as Array<Record<string, unknown>>;
}

function phoneRowValue(row: Record<string, unknown>, keys: string[], fallback = "") {
  return rowText(row, keys, fallback).trim();
}

function phoneRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  return rowNumber(row, keys, fallback);
}

function phoneRowOptionalNumber(row: Record<string, unknown>, keys: string[]) {
  const value = rowNumber(row, keys, Number.NaN);
  return Number.isFinite(value) ? value : null;
}

function phoneRowRatioPct(row: Record<string, unknown>, keys: string[]) {
  const value = phoneRowOptionalNumber(row, keys);
  if (value == null) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function phoneQuotaVariableLabel(value: string) {
  const raw = String(value ?? "").trim();
  const cleaned = raw
    .replace(/^(dim|dimension|variable|var|control)[_\s-]+/i, "")
    .trim();
  return humanizeQuestionSlug(cleaned || raw || "Variable");
}

function phoneSummaryValue(rows: Array<Record<string, unknown>>, labelNeedle: string) {
  const wanted = normalizeSourceMatch(labelNeedle);
  const row = rows.find((item) => normalizeSourceMatch(phoneRowValue(item, ["Indicador", "Metrica", "Métrica", "Variable"])).includes(wanted));
  if (!row) return null;
  const value = rowNumber(row, ["Valor", "Casos", "Total"], NaN);
  return Number.isFinite(value) ? value : null;
}

function phonePercentLabel(value: number | null | undefined) {
  return formatPercentLabel(value);
}

/**
 * Objetivo declarado para una fila de cuota: `barrido` (trabajar el universo
 * entero) o `minimo` (el piso interno basta). Lo declara el usuario por meta y
 * viaja en el `.pulso`; sin declaración explícita se asume `minimo`, que es como
 * se comportaba la app antes de existir el campo.
 */
function objetivoDeclaradoParaCuota(
  goals: MonitoreoGoal[],
  row: { variable: string; value: string },
): MonitoreoGoalObjetivo | null {
  const valorBuscado = normalizeSourceMatch(row.value);
  if (!valorBuscado) return null;
  const variableBuscada = normalizeSourceMatch(row.variable);
  const candidatos = goals.filter((goal) => Object.entries(goal.filters ?? {}).some(
    ([, value]) => normalizeSourceMatch(value) === valorBuscado,
  ));
  if (!candidatos.length) return null;
  // Si más de una meta comparte el valor, gana la que también calza la variable.
  const exacto = candidatos.find((goal) => Object.entries(goal.filters ?? {}).some(
    ([key, value]) => normalizeSourceMatch(value) === valorBuscado
      && (normalizeSourceMatch(key) === variableBuscada || phoneQuotaVariableLabel(key) === row.variable),
  ));
  return (exacto ?? candidatos[0]).objetivo ?? null;
}

/**
 * Nombre corto de la plataforma de respuestas, leído de las columnas del corte.
 * Evita hardcodear "Kobo" en un módulo que también corre con SurveyMonkey.
 */
function phonePlatformShortLabel(...rowSets: Array<Array<Record<string, unknown>>>) {
  const columns = rowSets.flatMap((rows) => rows.flatMap((row) => Object.keys(row))).map(normalizeSourceMatch);
  if (columns.some((column) => column.includes("kobo"))) return "Kobo";
  if (columns.some((column) => column.includes("surveymonkey") || column.includes("survey monkey"))) return "SurveyMonkey";
  return "plataforma";
}

/**
 * Encuesta lograda. Estricta a propósito: «Contactado por WhatsApp» es contacto,
 * no entrevista, y «Encuesta parcial» no cierra el caso.
 */
function phoneStatusIsEffective(label: string) {
  const key = normalizeSourceMatch(label);
  if (!key || phoneStatusIsNegated(key)) return false;
  if (key.includes("parcial")) return false;
  return key.includes("efectiv") || key.includes("completa") || key.includes("completo");
}

function phoneLooksLikeTechnicalSourceLabel(value: string) {
  const key = normalizeSourceMatch(value);
  if (!key) return false;
  return (
    key.includes("base de barrido")
    || key.includes("base barrido")
    || key.includes("barrido telefon")
    || key.includes("_base")
    || key.includes("_pdm")
    || key.includes("spreadsheet")
    || key.includes("google sheets")
    || key.includes("kobotoolbox")
    || key.includes("surveymonkey")
    || /^\d+[_-]/.test(key)
  );
}

function phoneCleanResponsibleDisplayName(value: string) {
  const cleanValue = String(value ?? "").trim();
  const parts = cleanValue.split(/\s+(?:·|-)\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && phoneLooksLikeTechnicalSourceLabel(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(" · ");
  }
  const technicalSuffix = cleanValue.match(/^(.*?)(?:\s+)(\d+[_-][A-Za-z0-9].*)$/);
  if (technicalSuffix && phoneLooksLikeTechnicalSourceLabel(technicalSuffix[2] ?? "")) {
    return technicalSuffix[1].trim();
  }
  return cleanValue;
}

function phoneResponsibleBaseName(row: Record<string, unknown>, index = 0) {
  const raw = phoneRowValue(row, ["Responsable", "Encuestador", "Owner"], "") || `Responsable ${index + 1}`;
  return phoneCleanResponsibleDisplayName(raw);
}

function phoneResponsibleActorName(row: Record<string, unknown>) {
  const actor = phoneRowValue(row, ["Actor", "Unidad"], "");
  const actorKey = normalizeSourceMatch(actor);
  if (phoneLooksLikeTechnicalSourceLabel(actor)) return "";
  return actorKey && !actorKey.includes("sin actor") ? actor : "";
}

function phoneResponsibleName(row: Record<string, unknown>, index = 0) {
  const base = phoneResponsibleBaseName(row, index);
  const actor = phoneResponsibleActorName(row);
  const actorKey = normalizeSourceMatch(actor);
  if (actorKey && !actorKey.includes("sin actor") && normalizeSourceMatch(base) !== actorKey) return `${base} · ${actor}`;
  return base;
}

function phoneIsUnassignedResponsible(value: string) {
  const key = normalizeSourceMatch(value);
  return !key || key.includes("sin responsable") || key.includes("sin asignar") || key.includes("no asignad");
}

function phoneResponsibleMetrics(row: Record<string, unknown>) {
  const assigned = phoneRowNumber(row, ["Casos asignados", "Total telefonico", "Total telefónico", "Asignados"], NaN);
  const unswept = phoneRowNumber(row, ["No barridos", "Por barrer"], NaN);
  const swept = phoneRowNumber(row, ["Barridos", "Casos barridos"], Number.isFinite(assigned) && Number.isFinite(unswept) ? Math.max(0, assigned - unswept) : NaN);
  const effective = phoneRowNumber(row, ["Efectivas", "Completas", "Completas telefonicas", "Completas telefónicas"], 0);
  const nonEffective = phoneRowNumber(row, ["Sin efectiva", "No efectivas", "Barridos sin efectiva", "Incidencias", "Incid."], Number.isFinite(swept) ? Math.max(0, swept - effective) : NaN);
  const denominator = Math.max(1, Number.isFinite(assigned) ? assigned : effective + (Number.isFinite(nonEffective) ? nonEffective : 0) + (Number.isFinite(unswept) ? unswept : 0));
  const incidencePct = phoneRowRatioPct(row, ["Ratio incidencias", "% sin efectiva", "Ratio sin efectiva"])
    ?? (Number.isFinite(nonEffective) && Number.isFinite(swept) ? safePercentValue(nonEffective, swept) : null);
  return {
    assigned: Number.isFinite(assigned) ? assigned : null,
    swept: Number.isFinite(swept) ? swept : null,
    unswept: Number.isFinite(unswept) ? unswept : null,
    effective,
    nonEffective: Number.isFinite(nonEffective) ? nonEffective : null,
    incidencePct,
    denominator,
  };
}

const ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE = 0.3;

type AcreditacionPhoneSupervisionControlRow = {
  key: string;
  responsible: string;
  actor: string;
  effective: number;
  target: number;
  observed: number;
  gap: number;
  coveragePct: number | null;
  priorityCases: number;
  source: "read" | "proposed";
};

export type AcreditacionPhoneSupervisionControlPlan = {
  hasReadBase: boolean;
  rows: AcreditacionPhoneSupervisionControlRow[];
  tableRows: Array<Record<string, unknown>>;
  exportRows: Array<Record<string, unknown>>;
  totalEffective: number;
  targetTotal: number;
  observedTotal: number;
  selectedTotal: number;
  gapTotal: number;
  coveragePct: number | null;
};

type AcreditacionPhoneTimeBucketKey = "under2" | "under5" | "normal";

type AcreditacionPhoneTimeBucket = {
  key: AcreditacionPhoneTimeBucketKey;
  label: string;
  hint: string;
  count: number;
  percent: number;
  tone: AcreditacionQualityAlertTone;
};

type AcreditacionPhoneTimeCaseTone = "ok" | "warning" | "danger" | "missing";

type AcreditacionPhoneTimeCase = {
  id: string;
  code: string;
  actor: string;
  responsible: string;
  survey: string;
  date: string;
  duration: string;
  seconds: number | null;
  category: string;
  status: "normal" | "corto" | "muy_corto" | "sin_dato" | string;
  source: string;
  alert: string;
  tone: AcreditacionPhoneTimeCaseTone;
};

export type AcreditacionPhoneTimeControlModel = {
  totalEffective: number;
  flaggedTotal: number;
  under2: number;
  under5: number;
  normal: number;
  missing: number;
  buckets: AcreditacionPhoneTimeBucket[];
  alerts: AcreditacionQualityAlertItem[];
  cases: AcreditacionPhoneTimeCase[];
  hiddenCases: number;
};

export function buildAcreditacionPhoneSupervisionControlPlan({
  responsibleRows,
  sampleRows,
  priorityGroups,
  fallbackEffective = 0,
}: {
  responsibleRows: Array<Record<string, unknown>>;
  sampleRows: Array<Record<string, unknown>>;
  priorityGroups: AcreditacionPhoneSupervisionPriorityGroup[];
  fallbackEffective?: number;
}): AcreditacionPhoneSupervisionControlPlan {
  const hasReadBase = sampleRows.length > 0;
  const observedByResponsible = new Map<string, { responsible: string; observed: number }>();
  sampleRows.forEach((row, index) => {
    const responsible = phoneSupervisionBaseResponsibleName(row, index);
    const key = normalizeSourceMatch(responsible);
    const observed = phoneRowOptionalNumber(row, ["Casos", "Muestra", "Seleccionados", "Casos supervision", "Casos supervisión", "N"]) ?? 1;
    const current = observedByResponsible.get(key) ?? { responsible, observed: 0 };
    current.observed += Math.max(0, observed);
    observedByResponsible.set(key, current);
  });

  const priorityByResponsible = new Map<string, number>();
  priorityGroups.forEach((group) => {
    priorityByResponsible.set(normalizeSourceMatch(group.title), group.count);
  });

  const rowsByResponsible = new Map<string, AcreditacionPhoneSupervisionControlRow>();
  responsibleRows
    .filter((row, index) => !phoneIsUnassignedResponsible(phoneSupervisionBaseResponsibleName(row, index)))
    .forEach((row, index) => {
      const responsible = phoneSupervisionBaseResponsibleName(row, index);
      const key = normalizeSourceMatch(responsible) || `responsable-${index}`;
      const actor = phoneResponsibleActorName(row);
      const metrics = phoneResponsibleMetrics(row);
      const effective = Math.max(0, metrics.effective);
      const target = effective > 0 ? Math.ceil(effective * ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE) : 0;
      const observed = observedByResponsible.get(key)?.observed ?? 0;
      rowsByResponsible.set(key, {
        key,
        responsible,
        actor,
        effective,
        target,
        observed,
        gap: Math.max(0, target - observed),
        coveragePct: target > 0 ? safePercentValue(observed, target) : null,
        priorityCases: priorityByResponsible.get(key) ?? 0,
        source: hasReadBase ? "read" : "proposed",
      });
    });

  observedByResponsible.forEach((item, key) => {
    if (rowsByResponsible.has(key)) return;
    rowsByResponsible.set(key, {
      key,
      responsible: item.responsible,
      actor: "",
      effective: 0,
      target: item.observed,
      observed: item.observed,
      gap: 0,
      coveragePct: 100,
      priorityCases: priorityByResponsible.get(key) ?? 0,
      source: "read",
    });
  });

  if (!rowsByResponsible.size && fallbackEffective > 0) {
    const target = Math.ceil(fallbackEffective * ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE);
    rowsByResponsible.set("equipo-telefonico", {
      key: "equipo-telefonico",
      responsible: "Equipo telefónico",
      actor: "Todos",
      effective: fallbackEffective,
      target,
      observed: 0,
      gap: hasReadBase ? target : target,
      coveragePct: hasReadBase ? 0 : null,
      priorityCases: priorityGroups.reduce((sum, group) => sum + group.count, 0),
      source: hasReadBase ? "read" : "proposed",
    });
  }

  const rows = Array.from(rowsByResponsible.values()).sort((a, b) => (
    b.gap - a.gap
    || b.priorityCases - a.priorityCases
    || b.target - a.target
    || a.responsible.localeCompare(b.responsible, "es")
  ));
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const targetTotal = rows.reduce((sum, row) => sum + row.target, 0);
  const observedTotal = rows.reduce((sum, row) => sum + row.observed, 0);
  const selectedTotal = hasReadBase ? observedTotal : targetTotal;
  const gapTotal = hasReadBase ? rows.reduce((sum, row) => sum + row.gap, 0) : targetTotal;
  const tableRows = rows.map((row) => ({
    Responsable: row.responsible,
    Base: row.actor || "Todos",
    Efectivas: row.effective,
    "Objetivo 30%": row.target,
    [hasReadBase ? "Base leída" : "Base propuesta"]: hasReadBase ? row.observed : row.target,
    "Por completar": row.gap,
    Cobertura: row.coveragePct == null ? (hasReadBase ? "S/M" : "Propuesta") : formatPercentLabel(row.coveragePct),
    Prioridad: row.priorityCases,
  }));

  return {
    hasReadBase,
    rows,
    tableRows,
    exportRows: hasReadBase ? sampleRows : tableRows,
    totalEffective,
    targetTotal,
    observedTotal,
    selectedTotal,
    gapTotal,
    coveragePct: targetTotal > 0 ? safePercentValue(observedTotal, targetTotal) : null,
  };
}

export function buildAcreditacionPhoneTimeControl({
  alerts,
  totalEffective = 0,
  rows = [],
  assignmentRows = [],
  caseLimit = 160,
}: {
  alerts: AcreditacionQualityAlertItem[];
  totalEffective?: number;
  rows?: Array<Record<string, unknown>>;
  assignmentRows?: Array<Record<string, unknown>>;
  caseLimit?: number;
}): AcreditacionPhoneTimeControlModel {
  const durationAlerts = alerts.filter((alert) => alert.signal.kind === "short_duration");
  const timeRows = phoneTimeRowsWithAssignments(rows, assignmentRows);
  const allCases = (timeRows.map(phoneTimeCaseFromRow).filter(Boolean) as AcreditacionPhoneTimeCase[]).sort(phoneTimeCaseSort);
  // Listar 160 entrevistas de duración normal no es auditar nada: la tabla es
  // para lo que hay que mirar. Si ninguna tiene salvedad, no se lista ninguna y
  // el panel lo dice en una línea.
  const flaggedCases = allCases.filter((item) => item.status !== "normal");
  const listables = flaggedCases.length ? flaggedCases : [];
  const cases = listables.slice(0, caseLimit);
  const hiddenCases = Math.max(0, listables.length - cases.length);
  const under2 = allCases.length ? allCases.filter((item) => item.status === "muy_corto").length : durationAlerts.reduce((sum, alert) => {
    const threshold = phoneDurationAlertThreshold(alert);
    return threshold <= 2 ? sum + phoneAlertCaseCount(alert) : sum;
  }, 0);
  const under5 = allCases.length ? allCases.filter((item) => item.status === "corto").length : durationAlerts.reduce((sum, alert) => {
    const threshold = phoneDurationAlertThreshold(alert);
    return threshold > 2 && threshold <= 5 ? sum + phoneAlertCaseCount(alert) : sum;
  }, 0);
  const missing = allCases.length ? allCases.filter((item) => item.status === "sin_dato").length : 0;
  const flaggedTotal = under2 + under5;
  const effectiveBase = allCases.length ? allCases.length : Math.max(0, totalEffective, flaggedTotal);
  const normal = allCases.length
    ? allCases.filter((item) => item.status === "normal").length
    : Math.max(0, effectiveBase - flaggedTotal);
  const bucketInputs: Array<Omit<AcreditacionPhoneTimeBucket, "percent">> = [
    {
      key: "under2",
      label: "Menos de 2 min",
      hint: "revisar primero",
      count: under2,
      tone: under2 ? "danger" : "ok",
    },
    {
      key: "under5",
      label: "Entre 2 y 5 min",
      hint: "puede faltar respuesta",
      count: under5,
      tone: under5 ? "warning" : "ok",
    },
    {
      key: "normal",
      label: "5 min o más",
      hint: "duración esperada",
      count: normal,
      tone: "ok",
    },
  ];

  return {
    totalEffective: effectiveBase,
    flaggedTotal,
    under2,
    under5,
    normal,
    missing,
    buckets: bucketInputs.map((bucket) => ({
      ...bucket,
      percent: effectiveBase > 0 ? safePercentValue(bucket.count, effectiveBase) ?? 0 : 0,
    })),
    alerts: durationAlerts,
    cases,
    hiddenCases,
  };
}

function phoneTimeCaseFromRow(row: Record<string, unknown>, index: number): AcreditacionPhoneTimeCase | null {
  const status = phoneTimeOperationalStatus(row);
  const code = telefonicoCleanCodPulso(phoneRowValue(row, ["CodPulso", "Cod Pulso", "Código", "Codigo", "Codigo Pulso", "Código Pulso"], ""));
  const seconds = phoneRowOptionalNumber(row, ["Duración segundos", "Duracion segundos", "duration_seconds"]);
  const duration = phoneRowValue(row, ["Duración", "Duracion", "duration"], seconds != null ? `${Math.round(seconds)} s` : "Sin dato");
  const date = phoneRowValue(row, ["Fecha Kobo", "Fecha", "Fecha plataforma", "submission_date"], "");
  const responsible = phoneTimeResponsibleValue(row);
  const survey = phoneRowValue(row, ["Encuesta", "Fuente", "Kobo"], "");
  const actor = phoneTimeContextValue(row, survey);
  const category = phoneRowValue(row, ["Clasificación", "Clasificacion", "Etiqueta duración", "Etiqueta duracion"], phoneTimeCategoryLabel(status));
  const source = phoneRowValue(row, ["Fuente duración", "Fuente duracion", "duration_source"], "");
  const alert = phoneRowValue(row, ["Alerta", "Observación", "Observacion"], "");
  const id = phoneRowValue(row, ["Response ID", "response_id", "_uuid", "id"], "") || code || `tiempo-${index + 1}`;
  return {
    id: `${id}-${index}`,
    code,
    actor,
    responsible,
    survey,
    date,
    duration,
    seconds: seconds ?? null,
    category,
    status,
    source,
    alert,
    tone: phoneTimeTone(status),
  };
}

function phoneTimeRowsWithAssignments(rows: Array<Record<string, unknown>>, assignmentRows: Array<Record<string, unknown>>) {
  if (!rows.length || !assignmentRows.length) return rows;
  const assignments = new Map<string, { responsible: string; actor: string; phoneStatus: string }>();
  assignmentRows.forEach((row) => {
    const key = telefonicoCodPulsoLookupKey(phoneRowValue(row, ["CodPulso", "Cod Pulso", "Código", "Codigo", "Codigo Pulso", "Código Pulso", "Caso", "Llave"], ""));
    if (!key) return;
    const responsible = phoneTimeResponsibleValue(row);
    const actor = phoneTimeContextValue(row, "");
    const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Estado", "Avance telefónico", "Avance telefonico"], "");
    const current = assignments.get(key);
    if (current && (current.responsible || !responsible)) return;
    assignments.set(key, { responsible, actor, phoneStatus });
  });
  if (!assignments.size) return rows;
  return rows.map((row) => {
    const key = telefonicoCodPulsoLookupKey(phoneRowValue(row, ["CodPulso", "Cod Pulso", "Código", "Codigo", "Codigo Pulso", "Código Pulso", "Caso", "Llave"], ""));
    const assignment = key ? assignments.get(key) : null;
    if (!assignment) return row;
    return {
      ...row,
      "Responsable barrido": phoneTimeResponsibleValue(row) || assignment.responsible,
      "Sede barrido": phoneTimeContextValue(row, phoneRowValue(row, ["Encuesta", "Fuente", "Kobo"], "")) || assignment.actor,
      "Estado telefónico barrido": assignment.phoneStatus,
    };
  });
}

function phoneTimeResponsibleValue(row: Record<string, unknown>) {
  const candidates = [
    "Responsable plataforma",
    "Responsable barrido",
    "Persona asignada",
    "Persona Asignada",
    "Responsable asignado",
    "Responsable",
    "Asignado",
    "Asignado a",
    "Operador",
    "Encuestador",
    "Recolector",
    "Collector",
    "submitted_by",
  ];
  for (const key of candidates) {
    const value = phoneRowValue(row, [key], "").trim();
    if (!value || phoneIsUnassignedResponsible(value)) continue;
    return phoneCleanResponsibleDisplayName(value);
  }
  return "";
}

function phoneTimeContextValue(row: Record<string, unknown>, survey: string) {
  const surveyKey = normalizeSourceMatch(survey);
  const candidates = [
    phoneRowValue(row, ["Sede barrido"], ""),
    phoneRowValue(row, ["Sede", "Distrito", "Localidad", "Comuna", "Provincia"], ""),
    phoneRowValue(row, ["Variable rectora", "Variable Rectora", "Cuota", "Segmento", "Grupo"], ""),
    phoneRowValue(row, ["Unidad", "Actor"], ""),
  ];
  for (const candidate of candidates) {
    const value = candidate.trim();
    const key = normalizeSourceMatch(value);
    if (!key) continue;
    if (["post", "kobo", "kobotoobox", "kobotoolbox"].includes(key)) continue;
    if (phoneLooksLikeTechnicalSourceLabel(value)) continue;
    if (key.includes("post distribution") || key.includes("monitoring")) continue;
    if (surveyKey && key.length > 4 && surveyKey.includes(key)) continue;
    return value;
  }
  return "";
}

function phoneTimeOperationalStatus(row: Record<string, unknown>): AcreditacionPhoneTimeCase["status"] {
  const raw = phoneRowValue(row, ["Estado duración", "Estado duracion", "duration_operational_status", "Clasificación", "Clasificacion"], "");
  const key = normalizeSourceMatch(raw);
  if (key.includes("muy") || key.includes("<2")) return "muy_corto";
  if (key.includes("cort") || key.includes("2-5") || key.includes("<5")) return "corto";
  if (key.includes("sin") || key.includes("missing")) return "sin_dato";
  return "normal";
}

function phoneTimeCategoryLabel(status: AcreditacionPhoneTimeCase["status"]) {
  if (status === "muy_corto") return "Muy corta (<2 min)";
  if (status === "corto") return "Corta (2-5 min)";
  if (status === "sin_dato") return "Sin tiempo";
  return "Normal (5+ min)";
}

function phoneTimeDateLabel(value: string) {
  const raw = String(value || "").trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw || "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    timeZone: dateOnly ? "UTC" : undefined,
  }).format(date).replace(".", "");
}

function phoneTimeCaseContextLabel(item: AcreditacionPhoneTimeCase) {
  const parts = [item.responsible, item.actor].map((part) => part.trim()).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return "No informado";
}

function telefonicoCodPulsoLookupKey(value: unknown) {
  const cleaned = telefonicoCleanCodPulso(value) || String(value ?? "");
  return normalizeSourceMatch(cleaned).replace(/[^a-z0-9]/g, "");
}

function phoneTimeTone(status: AcreditacionPhoneTimeCase["status"]): AcreditacionPhoneTimeCaseTone {
  if (status === "muy_corto") return "danger";
  if (status === "corto") return "warning";
  if (status === "sin_dato") return "missing";
  return "ok";
}

function phoneTimeCaseSort(a: AcreditacionPhoneTimeCase, b: AcreditacionPhoneTimeCase) {
  const severity = (status: AcreditacionPhoneTimeCase["status"]) => {
    if (status === "muy_corto") return 0;
    if (status === "corto") return 1;
    if (status === "sin_dato") return 2;
    return 3;
  };
  const durationA = a.seconds ?? Number.POSITIVE_INFINITY;
  const durationB = b.seconds ?? Number.POSITIVE_INFINITY;
  return severity(a.status) - severity(b.status)
    || durationA - durationB
    || compareInternalQueryDateValues(b.date, a.date)
    || a.code.localeCompare(b.code, "es", { numeric: true });
}

function phoneDurationAlertThreshold(alert: AcreditacionQualityAlertItem) {
  const text = normalizeSourceMatch(`${alert.title} ${alert.type} ${alert.detail} ${alert.signal.detail}`);
  const explicit = text.match(/(?:menor(?:es)?\s*a|menos\s*de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)?/);
  if (explicit) {
    const parsed = Number(explicit[1].replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (text.includes("2 min") || text.includes("2 minuto") || text.includes("extremadamente")) return 2;
  if (text.includes("5 min") || text.includes("5 minuto")) return 5;
  return 5;
}

function phoneAlertCaseCount(alert: AcreditacionQualityAlertItem) {
  return Math.max(1, Math.round(alert.count ?? alert.total ?? 1));
}

function phoneSupervisionBaseResponsibleName(row: Record<string, unknown>, index: number) {
  const raw = phoneRowValue(row, ["Responsable", "Encuestador", "Operador", "Agente", "Owner"], "") || `Responsable ${index + 1}`;
  return phoneCleanResponsibleDisplayName(raw);
}

function mergeAcreditacionPhoneResponsibleRows(...rowGroups: Array<Array<Record<string, unknown>>>) {
  const byResponsible = new Map<string, Record<string, unknown>>();
  const applyNumber = (target: Record<string, unknown>, label: string, value: number | null) => {
    if (value != null) target[label] = value;
  };

  rowGroups.flat().forEach((row, index) => {
    const name = phoneResponsibleName(row, index);
    const baseName = phoneRowValue(row, ["Responsable", "Encuestador", "Owner"], "") || name;
    const actor = phoneRowValue(row, ["Actor", "Unidad"], "");
    const key = normalizeSourceMatch(name);
    if (!key) return;
    const current = byResponsible.get(key) ?? { Responsable: baseName };
    current.Responsable = String(current.Responsable ?? baseName) || baseName;
    if (actor) current.Actor = actor;
    applyNumber(current, "Casos asignados", phoneRowOptionalNumber(row, ["Casos asignados", "Total telefonico", "Total telefónico", "Asignados"]));
    applyNumber(current, "Barridos", phoneRowOptionalNumber(row, ["Barridos", "Casos barridos"]));
    applyNumber(current, "No barridos", phoneRowOptionalNumber(row, ["No barridos", "Por barrer"]));
    applyNumber(current, "Efectivas", phoneRowOptionalNumber(row, ["Efectivas", "Completas", "Completas telefonicas", "Completas telefónicas"]));
    applyNumber(current, "Sin efectiva", phoneRowOptionalNumber(row, ["Sin efectiva", "No efectivas", "Barridos sin efectiva", "Incidencias", "Incid."]));
    applyNumber(current, "Ratio incidencias", phoneRowRatioPct(row, ["Ratio incidencias", "% sin efectiva", "Ratio sin efectiva"]));
    byResponsible.set(key, current);
  });

  // Segunda pasada: lo de arriba junta columnas complementarias de cuatro
  // bloques sobre la misma (persona · actor); esto junta a la persona consigo
  // misma cuando cubre varios actores. Va antes del recálculo para que los
  // ratios salgan de los conteos ya sumados. Ver fusionDeResponsables.ts.
  return fusionarResponsablesPorPersona(
    Array.from(byResponsible.values()),
    (row) => normalizeSourceMatch(phoneResponsibleBaseName(row)),
    (row) => phoneResponsibleActorName(row),
  ).map((row) => {
    const metrics = phoneResponsibleMetrics(row);
    if (metrics.assigned != null && metrics.unswept != null && metrics.swept == null) row.Barridos = Math.max(0, metrics.assigned - metrics.unswept);
    if (metrics.swept != null && metrics.nonEffective != null && metrics.incidencePct == null) {
      row["Ratio incidencias"] = safePercentValue(metrics.nonEffective, metrics.swept);
    }
    return row;
  }).sort((a, b) => {
    const bMetrics = phoneResponsibleMetrics(b);
    const aMetrics = phoneResponsibleMetrics(a);
    return bMetrics.effective - aMetrics.effective
      || (bMetrics.assigned ?? 0) - (aMetrics.assigned ?? 0)
      || (bMetrics.unswept ?? 0) - (aMetrics.unswept ?? 0)
      || phoneResponsibleName(a).localeCompare(phoneResponsibleName(b), "es");
  });
}

function phoneDisplayRowsWithBaseColumn(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row, "Actor")) return row;
    const { Actor: actor, ...rest } = row;
    return { Base: actor, ...rest };
  });
}

/**
 * Totales del barrido con **un solo origen por métrica**.
 *
 * La versión anterior encadenaba `??`/`||` entre poblaciones incompatibles: las
 * efectivas podían venir de la suma por responsable, de la suma diaria o de los
 * estados «buenos» según qué bloque llegara primero, y los no barridos podían
 * salir de la suma por responsable, que excluye los casos sin asignar. Tres
 * cifras distintas bajo la misma etiqueta. Ahora toda métrica se resuelve sobre
 * la **base telefónica completa** y, si el corte no la trae, queda en `null`
 * para que la UI muestre «—» en vez de sustituirla por otra cosa.
 * Ver docs/plan-monitoreo-telefonico-2026-07.md §4.
 */
function phoneStatusCasesFor(
  statusRows: Array<Record<string, unknown>>,
  matches: (label: string) => boolean,
) {
  const hit = statusRows.filter((row) => matches(phoneRowValue(row, ["Estado", "Estatus", "Indicador"])));
  if (!hit.length) return null;
  return hit.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor"], 0), 0);
}

function phoneOperationTotals(
  summaryRows: Array<Record<string, unknown>>,
  statusRows: Array<Record<string, unknown>>,
  responsibleRows: Array<Record<string, unknown>>,
) {
  // Todos los casos de la base tienen un estado (incluido «No barrido»), así que
  // la suma de estados es la misma población que el total del resumen.
  const statusTotal = statusRows.length
    ? statusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos"], 0), 0)
    : null;
  const total = phoneSummaryValue(summaryRows, "total telefonico")
    ?? phoneSummaryValue(summaryRows, "total telefónico")
    ?? statusTotal;

  // «No barrido» es un estado de la base, no una suma por responsable: sumarlo
  // por responsable dejaba fuera los casos sin asignar.
  const unswept = phoneSummaryValue(summaryRows, "no barridos")
    ?? phoneStatusCasesFor(statusRows, (label) => phoneStatusTone(label) === "unswept");

  const swept = phoneSummaryValue(summaryRows, "casos barridos")
    ?? (total != null && unswept != null ? Math.max(0, total - unswept) : null);

  // Efectiva declarada en el barrido: el estado de la hoja. La producción real
  // la aporta la plataforma y se muestra aparte, nunca mezclada con esta.
  const effective = phoneStatusCasesFor(statusRows, phoneStatusIsEffective);

  // Definición aritmética sobre la misma población: barridos que no terminaron
  // en efectiva. No se sustituye por la suma por responsable.
  const incidents = swept != null && effective != null ? Math.max(0, swept - effective) : null;

  const responsables = new Set(responsibleRows.map((row, index) => phoneResponsibleName(row, index)).filter((name) => !phoneIsUnassignedResponsible(name))).size;
  return {
    total: total ?? 0,
    swept: swept ?? 0,
    unswept: unswept ?? 0,
    effective: effective ?? 0,
    incidents: incidents ?? 0,
    /** `false` cuando el corte no trae la métrica y la UI debe mostrar «—». */
    hasTotal: total != null,
    hasSwept: swept != null,
    hasUnswept: unswept != null,
    hasEffective: effective != null,
    hasIncidents: incidents != null,
    responsables,
    sweptPct: safePercentValue(swept, total),
    unsweptPct: safePercentValue(unswept, total),
    /** Sobre barridos: es una tasa de resultado, no una proporción de la base. */
    incidentRatio: safePercentValue(incidents, swept),
    effectiveOverSweptPct: safePercentValue(effective, swept),
  };
}

export type AcreditacionPhoneQuotaRow = {
  key: string;
  actor: string;
  variable: string;
  value: string;
  universe: number;
  meta: number | null;
  effective: number;
  partial: number;
  refusals: number;
  unswept: number;
  advancePct: number | null;
  gap: number | null;
  status: string;
};

export function phoneQuotaRowsForPanel(rows: Array<Record<string, unknown>>): AcreditacionPhoneQuotaRow[] {
  const mapped = rows.map((row, index) => {
    const actor = phoneRowValue(row, [
      "Actor",
      "Unidad",
      "Público objetivo",
      "Publico objetivo",
      "Actor específico",
      "Actor especifico",
      "Segmento actor",
    ], "Todos") || "Todos";
    const variable = phoneQuotaVariableLabel(phoneRowValue(row, [
      "Variable",
      "Variable control",
      "variable_control",
      "Variable cuota",
      "Variable de cuota",
      "Corte",
      "Dimensión",
      "Dimension",
    ], "") || "Variable");
    const value = phoneRowValue(row, ["Valor", "Categoria", "Categoría", "Nivel", "Segmento", "Grupo", "Etiqueta"], `Valor ${index + 1}`);
    const universe = phoneRowNumber(row, ["Universo", "Base", "Población", "Poblacion", "Población objetivo", "Poblacion objetivo", "Total", "Casos"], 0);
    const meta = phoneRowOptionalNumber(row, ["Meta", "Cuota", "Objetivo", "Mínimo", "Minimo"]);
    const effective = phoneRowNumber(row, ["Efectivas", "Completas", "Efectivas telefónicas", "Efectivas telefonicas"], 0);
    const partial = phoneRowNumber(row, ["Parciales", "Parcial"], 0);
    const refusals = phoneRowNumber(row, ["Rechazos telefónicos", "Rechazos telefonicos", "Rechazos", "Rechazo"], 0);
    const unswept = phoneRowNumber(row, ["No barridos", "Por barrer"], Math.max(0, universe - effective - partial - refusals));
    const advancePct = phoneRowRatioPct(row, ["Avance meta", "% avance meta", "Cumplimiento", "% cumplimiento"])
      ?? (meta != null ? safePercentValue(effective, meta) : safePercentValue(effective, universe));
    const gap = phoneRowOptionalNumber(row, ["Brecha", "Faltante", "Por completar"])
      ?? (meta != null ? Math.max(0, meta - effective) : null);
    const status = phoneRowValue(row, ["Estado cuota", "Estado", "Status"], "") || (gap != null ? (gap > 0 ? "Brecha" : "Cumple") : "Sin meta");
    return {
      key: `${normalizeSourceMatch(actor)}-${normalizeSourceMatch(variable)}-${normalizeSourceMatch(value)}-${index}`,
      actor,
      variable,
      value,
      universe,
      meta,
      effective,
      partial,
      refusals,
      unswept,
      advancePct,
      gap,
      status,
    };
  }).filter((row) => row.value && (row.universe > 0 || (row.meta != null && row.meta > 0)));
  const totalKeys = new Set(mapped
    .filter((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor)) && row.meta != null)
    .map((row) => `${normalizeSourceMatch(row.variable)}\r${normalizeSourceMatch(row.value)}`));
  return mapped
    .filter((row) => !totalKeys.has(`${normalizeSourceMatch(row.variable)}\r${normalizeSourceMatch(row.value)}`) || ["total", "todos"].includes(normalizeSourceMatch(row.actor)))
    .sort((a, b) => (
      (["total", "todos"].includes(normalizeSourceMatch(a.actor)) ? -1 : 0) - (["total", "todos"].includes(normalizeSourceMatch(b.actor)) ? -1 : 0)
      ||
      a.actor.localeCompare(b.actor, "es")
      || a.variable.localeCompare(b.variable, "es")
      || (b.gap ?? -1) - (a.gap ?? -1)
      || b.universe - a.universe
      || a.value.localeCompare(b.value, "es", { numeric: true })
    ));
}

function phoneQuotaStatusTone(status: string, gap: number | null) {
  const key = normalizeSourceMatch(status);
  if (key.includes("cumple") || key.includes("completa") || gap === 0) return "ready";
  if (key.includes("sin meta")) return "base";
  return "warning";
}

function AcreditacionPhoneQuotaPanel({ rows }: { rows: Array<Record<string, unknown>> }) {
  const quotaRows = phoneQuotaRowsForPanel(rows);
  const variables = uniqueDisplayValues(quotaRows.map((row) => row.variable));
  const [activeVariable, setActiveVariable] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (activeVariable && !variables.includes(activeVariable)) setActiveVariable("");
  }, [activeVariable, variables]);
  if (!quotaRows.length) {
    return (
      <section className="mon-phone-quota-panel is-empty" aria-label="Cuotas telefónicas por variable">
        <EmptyPanel title="Sin cuotas por variable" detail="Define una variable de control en la base de público objetivo para leer cuotas telefónicas por categoría." />
      </section>
    );
  }

  const visibleRows = activeVariable ? quotaRows.filter((row) => row.variable === activeVariable) : quotaRows;
  const groups = Array.from(visibleRows.reduce((acc, row) => {
    const key = normalizeSourceMatch(row.variable) || "variable";
    const current = acc.get(key) ?? { variable: row.variable, rows: [] as AcreditacionPhoneQuotaRow[] };
    current.rows.push(row);
    acc.set(key, current);
    return acc;
  }, new Map<string, { variable: string; rows: AcreditacionPhoneQuotaRow[] }>()).values());
  const variableTotals = variables.map((variable) => {
    const rowsForVariable = quotaRows.filter((row) => row.variable === variable);
    return {
      universe: rowsForVariable.reduce((sum, row) => sum + row.universe, 0),
      meta: rowsForVariable.reduce((sum, row) => sum + (row.meta ?? 0), 0),
      effective: rowsForVariable.reduce((sum, row) => sum + row.effective, 0),
      gap: rowsForVariable.reduce((sum, row) => sum + (row.gap ?? 0), 0),
    };
  });
  const totalUniverse = activeVariable
    ? visibleRows.reduce((sum, row) => sum + row.universe, 0)
    : Math.max(0, ...variableTotals.map((item) => item.universe));
  const totalMeta = activeVariable
    ? visibleRows.reduce((sum, row) => sum + (row.meta ?? 0), 0)
    : Math.max(0, ...variableTotals.map((item) => item.meta));
  const totalEffective = activeVariable
    ? visibleRows.reduce((sum, row) => sum + row.effective, 0)
    : Math.max(0, ...variableTotals.map((item) => item.effective));
  const totalGap = activeVariable
    ? visibleRows.reduce((sum, row) => sum + (row.gap ?? 0), 0)
    : Math.max(0, ...variableTotals.map((item) => item.gap));
  const detailId = "mon-phone-quota-detail";

  return (
    <section className="mon-phone-quota-panel" aria-label="Cuotas telefónicas por variable">
      <header className="mon-phone-ops-head mon-phone-quota-head">
        <div>
          <span>Cuotas telefónicas</span>
          <strong>Base objetivo por variable</strong>
          {/* La otra mitad del mismo enunciado a dos redacciones. Se conserva el
            * dato que lo acompañaba —cuántas categorías— porque eso sí es de
            * esta superficie. */}
          <small>{formatMetric(visibleRows.length)} categoría{visibleRows.length === 1 ? "" : "s"}</small>
        </div>
        <div className="mon-phone-quota-actions">
          <em>{formatMetric(variables.length)} variable{variables.length === 1 ? "" : "s"}</em>
          <button
            type="button"
            className={`mon-phone-quota-toggle ${expanded ? "is-open" : ""}`}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown size={14} />
            <span>{expanded ? "Ocultar detalle" : "Ver detalle"}</span>
          </button>
        </div>
      </header>
      <div className="mon-phone-quota-summary" aria-label="Resumen de cuotas telefónicas">
        <span><em>Universo</em><strong>{formatMetric(totalUniverse)}</strong></span>
        <span className={totalMeta ? "is-target" : "is-base"}><em>Meta</em><strong>{totalMeta ? formatMetric(totalMeta) : "Sin meta"}</strong></span>
        <span className="is-ready"><em>Efectivas</em><strong>{formatMetric(totalEffective)}</strong></span>
        <span className={totalGap ? "is-warning" : "is-ready"}><em>Brecha</em><strong>{formatMetric(totalGap)}</strong></span>
      </div>
      {expanded ? (
        <div id={detailId} className="mon-phone-quota-detail">
          {variables.length > 1 ? (
            <div className="mon-phone-quota-filter">
              <span>Variable</span>
              <div className="mon-phone-quota-tabs" role="group" aria-label="Variable de cuota telefónica">
                <button
                  type="button"
                  className={!activeVariable ? "is-active" : ""}
                  onClick={() => setActiveVariable("")}
                >
                  Todas
                </button>
                {variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    className={variable === activeVariable ? "is-active" : ""}
                    onClick={() => setActiveVariable(variable)}
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mon-phone-quota-single">
              <span>Variable</span>
              <strong>{variables[0] ?? "Variable"}</strong>
            </div>
          )}
          <div className="mon-phone-quota-grid">
            {groups.map((group) => (
              <article key={group.variable} className="mon-phone-quota-actor mon-phone-quota-variable">
                <header>
                  <strong>{group.variable}</strong>
                  <em>{formatMetric(group.rows.length)} categoría{group.rows.length === 1 ? "" : "s"} · {formatMetric(group.rows.reduce((sum, row) => sum + row.universe, 0))} base</em>
                </header>
                <div className="mon-phone-quota-rows">
                  {group.rows.map((row) => {
                    const pctValue = row.advancePct ?? 0;
                    const tone = phoneQuotaStatusTone(row.status, row.gap);
                    return (
                      <section key={row.key} className={`mon-phone-quota-row is-${tone}`}>
                        <div className="mon-phone-quota-row-head">
                          <span>{row.variable}</span>
                          <strong>{row.value}</strong>
                        </div>
                        <div className="mon-phone-quota-row-metrics">
                          <span>{formatMetric(row.effective)} efectivas</span>
                          <span>{row.meta == null ? "sin meta" : `${formatMetric(row.meta)} meta`}</span>
                        </div>
                        <i aria-hidden="true" style={{ "--phone-quota-pct": `${Math.max(2, Math.min(100, pctValue))}%` } as CSSProperties} />
                        <footer>
                          <span>{formatPercentLabel(row.advancePct)}</span>
                          <span>{row.gap == null ? "Sin meta" : `${formatMetric(row.gap)} faltan`}</span>
                          <span>{formatMetric(row.unswept)} por barrer</span>
                        </footer>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AcreditacionPhoneStorage({ totals }: { totals: ReturnType<typeof phoneOperationTotals> }) {
  const total = Math.max(0, totals.total);
  const segments = [
    { key: "swept", label: "Barridos", value: totals.swept, pct: safePercentValue(totals.swept, total) ?? 0, hint: "de la base" },
    { key: "unswept", label: "Por barrer", value: totals.unswept, pct: safePercentValue(totals.unswept, total) ?? 0, hint: "de la base" },
  ].filter((item) => item.value > 0);
  let segmentOffset = 0;
  const positionedSegments = segments.map((segment) => {
    const segmentPct = Math.max(0, Math.min(100, segment.pct));
    const start = segmentOffset;
    segmentOffset += segmentPct;
    return { ...segment, pct: segmentPct, center: Math.max(6, Math.min(94, start + segmentPct / 2)) };
  });
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState("");
  const hoveredSegment = positionedSegments.find((segment) => segment.key === hoveredSegmentKey) ?? null;
  // Las cuatro tarjetas comparten denominador: todas se leen sobre la base.
  // Antes «Sin efectiva» usaba el barrido y se leía como comparable con las
  // otras tres. La tasa sobre barridos sigue disponible, pero como dato
  // secundario y rotulada como tal (plan §4).
  const operationItems = [
    { key: "swept", label: "Barridos", value: totals.swept, pct: totals.sweptPct, hint: "de la base", tone: "swept", detail: "Casos que ya se llamaron y tienen un estado registrado.", available: totals.hasSwept },
    { key: "effective", label: "Declaradas efectivas", value: totals.effective, pct: safePercentValue(totals.effective, total), hint: "de la base", tone: "effective", detail: "Lo que la hoja marca como efectivo. La producción real la valida la plataforma.", available: totals.hasEffective },
    { key: "incidents", label: "Sin efectiva", value: totals.incidents, pct: safePercentValue(totals.incidents, total), hint: "de la base", tone: totals.incidents > 0 ? "incidents" : "calm", detail: `Barridos con estado distinto de efectivo. Sobre el barrido son ${phonePercentLabel(totals.incidentRatio)}.`, available: totals.hasIncidents },
    { key: "unswept", label: "Por barrer", value: totals.unswept, pct: totals.unsweptPct, hint: "de la base", tone: "unswept", detail: "Casos de la base que todavía nadie llamó.", available: totals.hasUnswept },
  ];
  const operationTooltip = (item: typeof operationItems[number]) => (
    `${item.label}: ${formatMetric(item.value)} casos · ${phonePercentLabel(item.pct)} ${item.hint}. ${item.detail}`
  );
  return (
    <div className="mon-phone-storage mon-phone-storage--operation" aria-label="Cobertura del barrido telefónico">
      <div className="mon-phone-storage-head">
        <div>
          <span>Cobertura del barrido</span>
          <strong>{formatMetric(totals.swept)} de {formatMetric(total)} casos barridos</strong>
        </div>
        <em>{phonePercentLabel(totals.sweptPct)} barrido</em>
      </div>
      <div className="mon-phone-storage-bar-wrap">
        <div className="mon-phone-storage-bar" role="list" aria-label={`${formatMetric(totals.swept)} barridos y ${formatMetric(totals.unswept)} por barrer`}>
          {positionedSegments.length ? positionedSegments.map((segment) => (
            <i
              key={segment.key}
              role="listitem"
              tabIndex={0}
              className={`is-${segment.key}`}
              aria-label={`${segment.label}: ${formatMetric(segment.value)} (${phonePercentLabel(segment.pct)} ${segment.hint})`}
              title={`${segment.label}: ${formatMetric(segment.value)} (${phonePercentLabel(segment.pct)})`}
              onBlur={() => setHoveredSegmentKey("")}
              onFocus={() => setHoveredSegmentKey(segment.key)}
              onMouseEnter={() => setHoveredSegmentKey(segment.key)}
              onMouseLeave={() => setHoveredSegmentKey("")}
              style={{ "--phone-storage-size": `${segment.pct}%` } as CSSProperties}
            />
          )) : <i className="is-empty" style={{ "--phone-storage-size": "100%" } as CSSProperties} />}
        </div>
        {hoveredSegment ? (
          <div
            className="mon-phone-bar-tooltip"
            style={{ "--phone-bar-tooltip-x": `${hoveredSegment.center}%` } as CSSProperties}
          >
            <strong>{hoveredSegment.label}</strong>
            <span>{formatMetric(hoveredSegment.value)} casos</span>
            <em>{phonePercentLabel(hoveredSegment.pct)} {hoveredSegment.hint}</em>
          </div>
        ) : null}
      </div>
      <div className="mon-phone-operation-grid" aria-label="Lectura operativa del barrido, toda sobre la base telefónica">
        {operationItems.map((item) => (
          <span
            key={item.key}
            className={`is-${item.tone}${item.available ? "" : " is-unavailable"}`}
            aria-label={operationTooltip(item)}
            title={operationTooltip(item)}
            style={{ "--phone-operation-pct": `${Math.max(0, Math.min(100, item.pct ?? 0))}%` } as CSSProperties}
          >
            <em>{item.label}</em>
            <strong>{item.available ? formatMetric(item.value) : "—"}</strong>
            <i aria-hidden="true" title={operationTooltip(item)} />
            <small>{item.available ? `${phonePercentLabel(item.pct)} ${item.hint}` : "sin dato en el corte"}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function AcreditacionPhoneStatusStorage({
  rows,
  total,
}: {
  rows: Array<Record<string, unknown>>;
  total: number;
}) {
  const items = rows.map((row, index) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`);
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    const palette = phoneStatusPalette(label);
    return { key: `${normalizeSourceMatch(label)}-${index}`, label, value, tone: phoneStatusTone(label), palette };
  }).filter((item) => item.value > 0);
  const base = Math.max(0, items.reduce((sum, item) => sum + item.value, 0) || total);
  const rankedItems = [...items].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
  let statusOffset = 0;
  const positionedItems = items.map((item) => {
    const pctValue = Math.max(0, Math.min(100, safePercentValue(item.value, base) ?? 0));
    const start = statusOffset;
    statusOffset += pctValue;
    return { ...item, pctValue, center: Math.max(6, Math.min(94, start + pctValue / 2)) };
  });
  const [hoveredStatusKey, setHoveredStatusKey] = useState("");
  const hoveredStatus = positionedItems.find((item) => item.key === hoveredStatusKey) ?? null;
  if (!items.length) return <EmptyPanel title="Sin estados telefónicos" detail="El corte todavía no trae la distribución de estados del barrido." />;
  return (
    <div className="mon-phone-storage mon-phone-storage--statuses" aria-label="Estados telefónicos">
      <div className="mon-phone-storage-head">
        <div>
          <span>Estados telefónicos</span>
          <strong>Estado de la base de llamadas</strong>
        </div>
        <em>{formatMetric(base)} casos</em>
      </div>
      <div className="mon-phone-storage-bar-wrap">
        <div className="mon-phone-storage-bar mon-phone-status-stack" role="list" aria-label="Distribución de estados telefónicos">
          {positionedItems.map((item) => (
            <i
              key={item.key}
              role="listitem"
              tabIndex={0}
              className={`is-${item.tone}`}
              aria-label={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(item.pctValue)} del barrido)`}
              title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(item.pctValue)})`}
              onBlur={() => setHoveredStatusKey("")}
              onFocus={() => setHoveredStatusKey(item.key)}
              onMouseEnter={() => setHoveredStatusKey(item.key)}
              onMouseLeave={() => setHoveredStatusKey("")}
              style={{
                "--phone-storage-size": `${item.pctValue}%`,
                "--phone-status-color": item.palette.color,
                "--phone-status-color-hi": item.palette.highlight,
              } as CSSProperties}
            />
          ))}
        </div>
        {hoveredStatus ? (
          <div
            className="mon-phone-bar-tooltip"
            style={{ "--phone-bar-tooltip-x": `${hoveredStatus.center}%` } as CSSProperties}
          >
            <strong>{hoveredStatus.label}</strong>
            <span>{formatMetric(hoveredStatus.value)} casos</span>
            <em>{phonePercentLabel(hoveredStatus.pctValue)} del barrido</em>
          </div>
        ) : null}
      </div>
      <div className="mon-phone-status-rank" aria-label="Todos los estados telefónicos de la base">
        {rankedItems.map((item) => {
          const pctValue = safePercentValue(item.value, base) ?? 0;
          return (
            <span
              key={`${item.key}-rank`}
              className={`is-${item.tone}`}
              style={{
                "--phone-status-rank": `${Math.max(2, Math.min(100, pctValue))}%`,
                "--phone-status-rank-color": item.palette.color,
                "--phone-status-rank-hi": item.palette.highlight,
              } as CSSProperties}
              title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(pctValue)})`}
            >
              <strong>{item.label}</strong>
              <em>{formatMetric(item.value)}</em>
              <i aria-hidden="true" />
              <small>{phonePercentLabel(pctValue)} del barrido</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AcreditacionPhoneResponsibleCards({ rows }: { rows: Array<Record<string, unknown>> }) {
  const assignedRows = rows
    .filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index)))
    // Ordenar por efectivas absolutas premia a quien tiene más asignados y deja
    // último a quien exige acción hoy (53 asignados, 4 barridos). El criterio es
    // la proporción sin trabajar (plan §9).
    .slice()
    .sort((a, b) => {
      const left = phoneResponsibleMetrics(a);
      const right = phoneResponsibleMetrics(b);
      const asignadosA = left.assigned ?? 0;
      const asignadosB = right.assigned ?? 0;
      const pendienteA = asignadosA > 0 ? (left.unswept ?? 0) / asignadosA : 0;
      const pendienteB = asignadosB > 0 ? (right.unswept ?? 0) / asignadosB : 0;
      return pendienteB - pendienteA || (right.unswept ?? 0) - (left.unswept ?? 0) || right.effective - left.effective;
    });
  const unassignedRows = rows.filter((row, index) => phoneIsUnassignedResponsible(phoneResponsibleName(row, index)));
  const visibleActors = new Set(assignedRows.map((row) => normalizeSourceMatch(phoneResponsibleActorName(row))).filter(Boolean));
  const showActorContext = visibleActors.size > 1;
  return (
    <div className="mon-phone-responsibles" aria-label="Producción por responsable">
      <header className="mon-phone-responsibles-head">
        <div>
          <span>Equipo asignado</span>
          <strong>Producción por responsable y asignación</strong>
        </div>
        <em>{resumenDeEquipo(assignedRows.map((row, index) => phoneResponsibleBaseName(row, index))).etiqueta}</em>
      </header>
      {assignedRows.length ? assignedRows.map((row, index) => {
        const name = phoneResponsibleName(row, index);
        const displayName = phoneResponsibleBaseName(row, index);
        const actor = phoneResponsibleActorName(row);
        const metrics = phoneResponsibleMetrics(row);
        const total = metrics.assigned ?? metrics.denominator;
        const effectivePct = safePercentValue(metrics.effective, total);
        const nonEffectivePct = safePercentValue(metrics.nonEffective ?? 0, total);
        const pendingPct = safePercentValue(metrics.unswept ?? 0, total);
        const incidencePct = metrics.incidencePct ?? nonEffectivePct;
        return (
          <article key={`${name}-${index}`} className="mon-phone-responsible" title={actor ? `${displayName} · ${actor}` : displayName}>
            <header>
              <div className="mon-phone-responsible-title">
                <strong>{displayName}</strong>
                {showActorContext && actor ? <span>{actor}</span> : null}
              </div>
              <em>{formatMetric(metrics.effective)} efectivas</em>
            </header>
            <div className="mon-phone-responsible-meter" aria-label={`Composición operativa de ${name}`}>
              <span className="is-effective" style={{ "--phone-segment": `${Math.max(2, Math.min(100, effectivePct ?? 0))}%` } as CSSProperties} />
              <span className="is-non-effective" style={{ "--phone-segment": `${Math.max(0, Math.min(100, nonEffectivePct ?? 0))}%` } as CSSProperties} />
              <span className="is-pending" style={{ "--phone-segment": `${Math.max(0, Math.min(100, pendingPct ?? 0))}%` } as CSSProperties} />
            </div>
            <div className="mon-phone-responsible-chips">
              {metrics.assigned != null ? <span>{formatMetric(metrics.assigned)} asignados</span> : null}
              {metrics.swept != null ? <span>{formatMetric(metrics.swept)} barridos</span> : null}
              <span>{formatMetric(metrics.effective)} efectivas</span>
              {metrics.nonEffective != null ? <span>{formatMetric(metrics.nonEffective)} sin efectiva</span> : null}
              {incidencePct != null ? <span>{phonePercentLabel(incidencePct)} ratio incidencias</span> : null}
              {metrics.unswept != null ? <span>{formatMetric(metrics.unswept)} por barrer</span> : null}
            </div>
            <footer className="mon-phone-responsible-foot">
              <span className="is-effective"><i /><strong>{phonePercentLabel(effectivePct)}</strong><em>Efectivas</em></span>
              <span className="is-non-effective"><i /><strong>{phonePercentLabel(incidencePct)}</strong><em>Ratio incid.</em></span>
              <span className="is-pending"><i /><strong>{phonePercentLabel(pendingPct)}</strong><em>Por barrer</em></span>
            </footer>
          </article>
        );
      }) : <EmptyPanel title="Sin responsables" detail="La base está cargada; falta asignar responsables antes de evaluar producción." />}
      {unassignedRows.length ? (
        <aside className="mon-phone-unassigned">
          <AlertCircle size={16} />
          <div>
            <span>Brecha de asignación</span>
            <strong>{formatMetric(unassignedRows.length)} fila{unassignedRows.length === 1 ? "" : "s"} sin responsable</strong>
            <em>No entra al ranking del equipo.</em>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function AcreditacionPhoneIncidenceInsights({ rows }: { rows: Array<Record<string, unknown>> }) {
  const visible = rows.map((row, index) => {
    const metrics = phoneResponsibleMetrics(row);
    return {
      key: `${phoneResponsibleName(row, index)}-${index}`,
      name: phoneResponsibleName(row, index),
      metrics,
    };
  }).filter((item) => !phoneIsUnassignedResponsible(item.name) && (
    item.metrics.swept != null
    || item.metrics.nonEffective != null
    || item.metrics.incidencePct != null
  )).sort((a, b) => (b.metrics.incidencePct ?? 0) - (a.metrics.incidencePct ?? 0) || (b.metrics.nonEffective ?? 0) - (a.metrics.nonEffective ?? 0));
  if (!visible.length) return null;
  const totalSwept = visible.reduce((sum, item) => sum + (item.metrics.swept ?? 0), 0);
  const totalIncidents = visible.reduce((sum, item) => sum + (item.metrics.nonEffective ?? 0), 0);
  const totalEffective = visible.reduce((sum, item) => sum + item.metrics.effective, 0);
  const incidencePct = safePercentValue(totalIncidents, totalSwept);
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--compare">
      <header className="mon-phone-ops-head">
        <div>
          <span>Ratio de incidencias</span>
          <strong>Barridos sin efectiva por responsable</strong>
        </div>
        <em>{phonePercentLabel(incidencePct)} del barrido</em>
      </header>
      <div className="mon-phone-compare-summary">
        <span><strong>{formatMetric(totalSwept)}</strong><em>barridos</em></span>
        <span><strong>{formatMetric(totalEffective)}</strong><em>efectivas tel.</em></span>
        <span className={totalIncidents ? "is-warning" : "is-ok"}><strong>{formatMetric(totalIncidents)}</strong><em>sin efectiva</em></span>
      </div>
      <div className="mon-phone-compare-list">
        {visible.slice(0, 8).map((item) => {
          const swept = item.metrics.swept ?? item.metrics.denominator;
          const effectivePct = safePercentValue(item.metrics.effective, swept) ?? 0;
          const incidence = item.metrics.incidencePct ?? safePercentValue(item.metrics.nonEffective ?? 0, swept) ?? 0;
          const review = item.metrics.nonEffective ?? 0;
          return (
            <section key={item.key} className={`mon-phone-compare-row ${review ? "is-warning" : "is-ok"}`}>
              <div className="mon-phone-compare-title">
                <strong>{item.name}</strong>
                <em>{review ? `${formatMetric(review)} sin efectiva` : "sin incidencia"}</em>
              </div>
              <div className="mon-phone-compare-bars">
                <span title={`${item.name}: ${formatMetric(item.metrics.effective)} efectivas telefonicas de ${formatMetric(swept)} barridos`}>
                  <small>Efectivas</small>
                  <i style={{ "--phone-compare-bar": `${Math.max(0, Math.min(100, effectivePct))}%` } as CSSProperties} />
                  <b>{formatMetric(item.metrics.effective)}</b>
                </span>
                <span className="is-platform" title={`${item.name}: ${phonePercentLabel(incidence)} del barrido sin efectiva`}>
                  <small>Incidencias</small>
                  <i style={{ "--phone-compare-bar": `${Math.max(0, Math.min(100, incidence))}%` } as CSSProperties} />
                  <b>{phonePercentLabel(incidence)}</b>
                </span>
              </div>
              <footer>
                {item.metrics.assigned != null ? <span>{formatMetric(item.metrics.assigned)} asignados</span> : null}
                {item.metrics.swept != null ? <span>{formatMetric(item.metrics.swept)} barridos</span> : null}
                {item.metrics.unswept != null ? <span>{formatMetric(item.metrics.unswept)} por barrer</span> : null}
              </footer>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function AcreditacionPhoneIncidenceSection({
  responsibleRows,
}: {
  responsibleRows: Array<Record<string, unknown>>;
}) {
  const hasIncidence = responsibleRows.some((row) => {
    const metrics = phoneResponsibleMetrics(row);
    return metrics.swept != null || metrics.nonEffective != null || metrics.incidencePct != null;
  });
  if (!hasIncidence) {
    return (
      <EmptyPanel
        title="Sin incidencia de base"
        detail="El corte aún no incluye llamadas barridas. Asigna responsables y sincroniza los estados de llamada."
      />
    );
  }
  return (
    <section className="mon-phone-ops-insights" aria-label="Incidencia de la base telefónica">
      <AcreditacionPhoneIncidenceInsights rows={responsibleRows} />
    </section>
  );
}

function phoneAttemptValue(row: Record<string, unknown>, label: string) {
  return phoneRowNumber(row, [label], 0);
}

const ACREDITACION_PHONE_ATTEMPT_BUCKETS = [
  { key: "1", label: "1", detail: "1 intento", candidates: ["1 intento"] },
  { key: "2", label: "2", detail: "2 intentos", candidates: ["2 intentos"] },
  { key: "3", label: "3", detail: "3 intentos", candidates: ["3 intentos"] },
  { key: "4", label: "4", detail: "4 intentos", candidates: ["4 intentos"] },
  { key: "5", label: "5", detail: "5 intentos", candidates: ["5 intentos"] },
  {
    key: "6plus",
    label: "6+",
    detail: "6 o más intentos",
    candidates: ["6 intentos", "6 o mas intentos", "6 o más intentos", "7 intentos", "mas de 7 intentos", "más de 7 intentos"],
  },
] as const;

type AcreditacionPhoneAttemptBucket = typeof ACREDITACION_PHONE_ATTEMPT_BUCKETS[number];

function phoneAttemptBucketValue(row: Record<string, unknown>, bucket: AcreditacionPhoneAttemptBucket) {
  return bucket.candidates.reduce((sum, candidate) => sum + phoneAttemptValue(row, candidate), 0);
}

function phoneOpsPercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

/**
 * Intensidad de insistencia. Con una referencia del equipo, califica por desvío
 * relativo: una etiqueta que le sale a los 13 responsables por igual no
 * discrimina nada (plan §8). Sin referencia mantiene los umbrales absolutos.
 */
function phoneAttemptIntensity(avg: number | null, referencia: number | null = null) {
  if (avg == null) return { key: "unknown", label: "S/D insistencia" };
  if (referencia != null && referencia > 0) {
    const ratio = avg / referencia;
    if (ratio >= 1.25) return { key: "high", label: "Insiste más que el equipo" };
    if (ratio <= 0.75) return { key: "low", label: "Insiste menos que el equipo" };
    return { key: "medium", label: "En el promedio del equipo" };
  }
  if (avg >= 4) return { key: "high", label: "Insistencia alta" };
  if (avg >= 3) return { key: "medium", label: "Insistencia media" };
  return { key: "low", label: "Insistencia baja" };
}

/** Mediana simple; devuelve `null` si no hay valores utilizables. */
function phoneMedian(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

type AcreditacionPhoneNoAnswerCase = {
  id: string;
  name: string;
  actor: string;
  code: string;
  status: string;
  attempts: number;
  target: number;
  ratioPct: number;
  dateLabel: string;
  intensity: ReturnType<typeof phoneAttemptIntensity>;
};

function phoneCaseDateLabel(row: Record<string, unknown>) {
  const raw = phoneRowValue(row, ["Fecha"], "");
  if (!raw || normalizeSourceMatch(raw).includes("sin fecha")) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function phoneNoAnswerCaseFromRow(row: Record<string, unknown>, index: number, ownerKey: string): AcreditacionPhoneNoAnswerCase {
  const rawName = phoneRowValue(row, ["Caso", "Persona", "Nombre", "Nombres", "Apellidos y nombres"], "");
  const code = phoneRowValue(row, ["CodPulso", "Codigo", "Código", "Llave"], "");
  const attempts = Math.max(0, Math.floor(phoneRowNumber(row, ["Intentos"], 0)));
  const target = Math.max(1, Math.floor(phoneRowNumber(row, ["Intentos objetivo", "Objetivo intentos"], 4)));
  const ratioSource = phoneRowOptionalNumber(row, ["Ratio insistencia", "Ratio de insistencia"]);
  const ratio = Math.max(0, ratioSource ?? attempts / target);
  return {
    id: `${ownerKey || "responsable"}-${code || rawName || index}-${index}`,
    name: rawName || code || "Caso sin nombre",
    actor: phoneRowValue(row, ["Actor", "Unidad"], "Sin actor"),
    code,
    status: phoneRowValue(row, ["Estado", "Status", "Estatus"], "No contesta"),
    attempts,
    target,
    ratioPct: Math.max(0, Math.min(100, ratio * 100)),
    dateLabel: phoneCaseDateLabel(row),
    intensity: phoneAttemptIntensity(attempts || null),
  };
}

function phoneAttemptCountLabel(value: number) {
  return value === 1 ? "1 intento" : `${formatMetric(value)} intentos`;
}

function AcreditacionPhoneTimeWorkbench({
  alertRows,
  timeRows,
  assignmentRows,
  totals,
  platformEffective,
}: {
  alertRows: Array<Record<string, unknown>>;
  timeRows: Array<Record<string, unknown>>;
  assignmentRows: Array<Record<string, unknown>>;
  totals: ReturnType<typeof phoneOperationTotals>;
  platformEffective: number | null;
}) {
  const alertModel = buildAcreditacionPhoneRealAlertModel({ alertRows });
  const totalEffective = platformEffective ?? totals.effective;
  const model = buildAcreditacionPhoneTimeControl({
    alerts: alertModel.alerts,
    totalEffective,
    rows: timeRows,
    assignmentRows,
  });
  const reviewed = model.normal + model.under2 + model.under5;
  const pendingReview = model.under2 + model.under5 + model.missing;
  return (
    <div className="mon-phone-time-workbench" aria-label="Validación de tiempos Kobo">
      {/* El hero decía lo mismo que la grilla de abajo con otros rótulos:
          Normal/Corta/Muy corta arriba y <2/<5/5+ debajo. Ahora el titular da
          el veredicto y los tramos se cuentan una sola vez (plan §9). */}
      <section className={`mon-phone-time-hero is-${model.under2 ? "danger" : model.under5 ? "warning" : "ok"}`}>
        <div>
          <span><Clock3 size={14} /> Duración</span>
          <strong>
            {pendingReview
              ? `${formatMetric(pendingReview)} entrevista${pendingReview === 1 ? "" : "s"} por revisar`
              : "Ninguna entrevista por revisar"}
          </strong>
          <p>
            {pendingReview
              ? `De ${formatMetric(model.totalEffective)} entrevistas completas, estas duraron menos de lo esperado.`
              : `Las ${formatMetric(model.totalEffective)} entrevistas completas duraron lo esperado.`}
            {model.missing ? ` ${formatMetric(model.missing)} no tienen duración registrada.` : ""}
          </p>
        </div>
      </section>
      <AcreditacionPhoneSupervisionTimeControl model={model} />
    </div>
  );
}

function AcreditacionPhoneSupervisionBoard({
  reports,
  alertRows,
  responsibleRows,
  assignmentRows,
  pendingRows,
  insistenceRows,
  reattemptRows,
  timeRows,
  totals,
  platformEffective,
}: {
  reports: MonitoreoAcreditacionReports;
  alertRows: Array<Record<string, unknown>>;
  responsibleRows: Array<Record<string, unknown>>;
  assignmentRows: Array<Record<string, unknown>>;
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
  timeRows: Array<Record<string, unknown>>;
  totals: ReturnType<typeof phoneOperationTotals>;
  platformEffective: number | null;
}) {
  const [activeSupervisionTab, setActiveSupervisionTab] = useState<"tiempo" | "muestra" | "prioridad">("tiempo");
  const sampleRows = acreditacionPhoneControlSampleRows(reports);
  const model = buildAcreditacionPhoneSupervisionModel({ alertRows, pendingRows, insistenceRows, reattemptRows });
  const koboEffectiveTotal = platformEffective ?? totals.effective;
  const controlPlan = buildAcreditacionPhoneSupervisionControlPlan({
    responsibleRows,
    sampleRows,
    priorityGroups: model.priorityGroups,
    fallbackEffective: Math.max(totals.effective, koboEffectiveTotal),
  });
  const timeControl = buildAcreditacionPhoneTimeControl({
    alerts: model.alerts,
    totalEffective: koboEffectiveTotal,
    rows: timeRows,
    assignmentRows,
  });
  const handleExport = () => {
    downloadRowsAsCsv(
      controlPlan.exportRows,
      `base-barrido-supervision-${controlPlan.hasReadBase ? "leida" : "propuesta"}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };
  const tabs = [
    {
      key: "tiempo",
      label: "Tiempo",
      detail: "duración Kobo",
      badge: formatMetric(timeControl.flaggedTotal),
      status: timeControl.under2 ? "danger" : timeControl.under5 ? "warning" : "ready",
    },
    {
      key: "muestra",
      label: "Muestra",
      detail: controlPlan.hasReadBase ? "base leída" : "propuesta 30%",
      badge: formatMetric(controlPlan.selectedTotal),
      status: controlPlan.gapTotal ? "warning" : "ready",
    },
    {
      key: "prioridad",
      label: "Prioridad",
      detail: "qué revisar",
      badge: formatMetric(model.priorityGroups.length),
      status: model.highest === "ok" ? "ready" : model.highest,
    },
  ] as const;
  return (
    <div className="mon-phone-supervision-shell" aria-label="Supervisión telefónica">
      <section className={`mon-phone-supervision-hero is-${model.highest}`} aria-label="Resumen de supervisión telefónica">
        <div className="mon-phone-supervision-lead">
          <span>
            {model.highest === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {acreditacionQualityStatusLabel(model.highest)}
          </span>
          <strong>{timeControl.totalEffective ? "Control de tiempo y muestra" : "Sin producción efectiva"}</strong>
          <p>Primero se revisa duración de efectivas Kobo; luego se define la muestra de supervisión por responsable.</p>
        </div>
        <div className="mon-phone-supervision-metrics">
          <span className={timeControl.totalEffective ? "is-base" : "is-warning"}><em>Efectivas Kobo</em><strong>{formatMetric(timeControl.totalEffective)}</strong><small>pasan filtro</small></span>
          <span className={timeControl.under2 ? "is-warning" : "is-ready"}><em>{"<2 min"}</em><strong>{formatMetric(timeControl.under2)}</strong><small>prioridad</small></span>
          <span className={timeControl.under5 ? "is-warning" : "is-ready"}><em>{"<5 min"}</em><strong>{formatMetric(timeControl.under5)}</strong><small>revisión</small></span>
          <span className={controlPlan.hasReadBase ? "is-ready" : "is-warning"}><em>Muestra</em><strong>{formatMetric(controlPlan.selectedTotal)}</strong><small>{controlPlan.hasReadBase ? "leída" : "propuesta"}</small></span>
        </div>
      </section>

      <nav className="mon-phone-supervision-tabs" aria-label="Vistas de supervisión telefónica">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`is-${tab.status}${activeSupervisionTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveSupervisionTab(tab.key)}
            aria-pressed={activeSupervisionTab === tab.key}
          >
            <strong>{tab.label}</strong>
            <span>{tab.detail}</span>
            <em>{tab.badge}</em>
          </button>
        ))}
      </nav>

      {activeSupervisionTab === "tiempo" ? (
        <div className="mon-phone-supervision-focus is-time">
          <AcreditacionPhoneSupervisionTimeControl model={timeControl} />
          <AcreditacionPhoneSupervisionPriorityPanel groups={model.priorityGroups} />
        </div>
      ) : activeSupervisionTab === "muestra" ? (
        <div className="mon-phone-supervision-focus">
          <AcreditacionPhoneSupervisionSamplePlan plan={controlPlan} onExport={handleExport} />
          {controlPlan.hasReadBase ? <AcreditacionPhoneSupervisionBaseState plan={controlPlan} sampleRows={sampleRows} /> : null}
        </div>
      ) : (
        <div className="mon-phone-supervision-focus">
          <AcreditacionPhoneSupervisionPriorityPanel groups={model.priorityGroups} />
        </div>
      )}
    </div>
  );
}

function AcreditacionPhoneSupervisionTimeControl({ model }: { model: AcreditacionPhoneTimeControlModel }) {
  const reviewTone = model.under2 ? "danger" : model.under5 ? "warning" : "ok";
  const visibleAlerts = model.alerts.slice(0, 4);
  const caseGroups = phoneTimeCaseGroups(model.cases);
  const reviewTotal = model.under2 + model.under5 + model.missing;
  return (
    <section className={`mon-phone-time-control is-${reviewTone}`} aria-label="Control de tiempo de encuestas Kobo">
      <header className="mon-phone-ops-head mon-phone-time-control-head">
        <div>
          <span><Table2 size={13} /> Duración de las entrevistas</span>
          <strong>Cuánto duró cada entrevista completa</strong>
          <small>Una entrevista muy corta puede indicar que se saltaron preguntas. No cambia el estado de la llamada.</small>
        </div>
        {/* Cuántas hay que mirar, no cuántas filas se pintaron. */}
        {reviewTotal ? <em>{formatMetric(reviewTotal)} por revisar</em> : null}
      </header>
      <div className="mon-phone-time-track" aria-label="Distribución por duración">
        {model.buckets.map((bucket) => (
          <span
            key={bucket.key}
            className={`is-${bucket.key}`}
            style={{ width: `${bucket.count > 0 ? Math.max(4, bucket.percent) : 0}%` } as CSSProperties}
            title={`${bucket.label}: ${formatMetric(bucket.count)} (${formatPercentLabel(bucket.percent)})`}
          />
        ))}
      </div>
      <div className="mon-phone-time-buckets">
        {model.buckets.map((bucket) => (
          <article key={`phone-time-bucket-${bucket.key}`} className={`is-${bucket.key} is-${bucket.tone}`}>
            <span>{bucket.label}</span>
            <strong>{formatMetric(bucket.count)}</strong>
            <em>{bucket.hint}</em>
          </article>
        ))}
      </div>
      {model.cases.length ? (
        <div className="mon-phone-time-cases" aria-label="Entrevistas que requieren revisión por duración">
          <header className="mon-phone-time-cases-title">
            <div>
              <span>Para revisar</span>
              <strong>{formatMetric(reviewTotal)} entrevista{reviewTotal === 1 ? "" : "s"} fuera de lo esperado</strong>
            </div>
            <em>
              {model.hiddenCases
                ? `${formatMetric(model.cases.length)} de ${formatMetric(model.cases.length + model.hiddenCases)}`
                : `${formatMetric(model.cases.length)} listadas`}
            </em>
          </header>
          {caseGroups.map((group) => (
            <section key={`phone-time-group-${group.key}`} className={`is-${group.tone}`}>
              <header>
                <span>{group.label}</span>
                <strong>{formatMetric(group.cases.length)}</strong>
              </header>
              <div className="mon-phone-time-case-list">
                <div className="mon-phone-time-case-row is-head" aria-hidden="true">
                  <span>Clasificación</span>
                  <span>CodPulso</span>
                  <span>Fecha</span>
                  <span>Duración</span>
                  <span>Responsable / sede</span>
                  <span>Evidencia</span>
                </div>
                {group.cases.map((item) => (
                  <article key={item.id} className={`mon-phone-time-case-row is-${item.tone}${item.alert ? " has-alert" : ""}`}>
                    <span className="mon-phone-time-case-status"><Clock3 size={12} /> {item.category}</span>
                    <strong>{item.code || "Sin CodPulso"}</strong>
                    <span>{item.date ? phoneTimeDateLabel(item.date) : "Sin fecha"}</span>
                    <b>{item.duration || "Sin dato"}</b>
                    <span>{phoneTimeCaseContextLabel(item)}</span>
                    <small className={item.alert ? "is-alert" : ""}>{item.alert || phoneTimeCaseSourceLabel(item)}</small>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {model.hiddenCases ? <p>{formatMetric(model.hiddenCases)} casos adicionales quedan en el reporte exportable.</p> : null}
        </div>
      ) : (
        <div className="mon-phone-time-alerts">
          {visibleAlerts.length ? visibleAlerts.map((alert) => (
            <article key={`phone-time-alert-${alert.id}`} className={`is-${alert.tone}`}>
              <span>{phoneDurationAlertThreshold(alert) <= 2 ? "<2 min" : "<5 min"}</span>
              <strong>{alert.title}</strong>
              <p>{phoneDurationAlertDisplayDetail(alert)}</p>
              <em>{formatMetric(phoneAlertCaseCount(alert))} caso{phoneAlertCaseCount(alert) === 1 ? "" : "s"}</em>
            </article>
          )) : model.normal ? null : (
            <p>Este corte no trae la duración de las entrevistas.</p>
          )}
        </div>
      )}
    </section>
  );
}

function phoneTimeCaseGroups(cases: AcreditacionPhoneTimeCase[]) {
  const groups: Array<{ key: AcreditacionPhoneTimeCase["status"]; label: string; tone: AcreditacionPhoneTimeCaseTone; cases: AcreditacionPhoneTimeCase[] }> = [
    { key: "muy_corto", label: "Muy corta", tone: "danger", cases: [] },
    { key: "corto", label: "Corta", tone: "warning", cases: [] },
    { key: "normal", label: "Normal", tone: "ok", cases: [] },
    { key: "sin_dato", label: "Sin tiempo", tone: "missing", cases: [] },
  ];
  const byKey = new Map(groups.map((group) => [group.key, group]));
  cases.forEach((item) => {
    const target = byKey.get(item.status as AcreditacionPhoneTimeCase["status"]) ?? byKey.get("normal");
    target?.cases.push(item);
  });
  return groups.filter((group) => group.cases.length > 0);
}

function phoneTimeCaseSourceLabel(item: AcreditacionPhoneTimeCase) {
  const source = item.source.trim();
  const normalizedSource = normalizeSourceMatch(source);
  if (normalizedSource.includes("start") && normalizedSource.includes("end")) return "Kobo · inicio a fin";
  if (normalizedSource.includes("duration")) return "Kobo · duración calculada";
  if (source) return source.replaceAll("_", " ");
  if (item.survey) return item.survey;
  return "KoboToolbox";
}

function phoneDurationAlertDisplayDetail(alert: AcreditacionQualityAlertItem) {
  return (alert.detail || "Revisar duración y consistencia de la respuesta.")
    .replace(/\s*Fuente:.*$/i, "")
    .trim();
}

function AcreditacionPhoneSupervisionSamplePlan({
  plan,
  onExport,
}: {
  plan: AcreditacionPhoneSupervisionControlPlan;
  onExport: () => void;
}) {
  return (
    <section className="mon-phone-supervision-plan" aria-label="Base de barrido de supervisión">
      <header className="mon-phone-ops-head">
        <div>
          <span>Base de barrido de supervisión</span>
          <strong>{plan.hasReadBase ? "Lectura de base cargada" : "Propuesta 30% por responsable"}</strong>
        </div>
        <button type="button" className="mon-phone-supervision-export" onClick={onExport} disabled={!plan.exportRows.length}>
          <Download size={13} />
          Exportar CSV
        </button>
      </header>
      <div className="mon-phone-supervision-plan-strip" aria-label="Resumen de muestra de supervisión">
        <span><em>Responsables</em><strong>{formatMetric(plan.rows.length)}</strong></span>
        <span><em>Objetivo</em><strong>{formatMetric(plan.targetTotal)}</strong></span>
        <span><em>{plan.hasReadBase ? "Leídos" : "Propuestos"}</em><strong>{formatMetric(plan.selectedTotal)}</strong></span>
        <span className={plan.gapTotal ? "is-warning" : "is-ready"}><em>{plan.hasReadBase ? "Brecha" : "Por generar"}</em><strong>{formatMetric(plan.gapTotal)}</strong></span>
      </div>
      <DataTable
        rows={plan.tableRows}
        empty="El corte no desglosa efectivas por responsable. Sincroniza el barrido antes de preparar la supervisión."
        preferredColumns={["Responsable", "Base", "Efectivas", "Objetivo 30%", plan.hasReadBase ? "Base leída" : "Base propuesta", "Por completar", "Cobertura", "Prioridad"]}
        maxColumns={8}
      />
    </section>
  );
}

function AcreditacionPhoneSupervisionBaseState({
  plan,
  sampleRows,
}: {
  plan: AcreditacionPhoneSupervisionControlPlan;
  sampleRows: Array<Record<string, unknown>>;
}) {
  const status = plan.hasReadBase ? "Base leída" : "Base propuesta";
  return (
    <section className="mon-phone-supervision-source" aria-label="Estado de base de supervisión">
      <header className="mon-phone-ops-head">
        <div>
          <span>Lectura y entregable</span>
          <strong>{status}</strong>
        </div>
        <em>{plan.hasReadBase ? `${formatMetric(sampleRows.length)} filas` : "CSV local"}</em>
      </header>
      <div className="mon-phone-supervision-source-list">
        <span>
          <strong>{plan.hasReadBase ? "Lectura" : "Definición"}</strong>
          <em>{plan.hasReadBase ? "bloque muestra_control" : "objetivo 30% por responsable"}</em>
        </span>
        <span>
          <strong>Entregables</strong>
          <em>{plan.hasReadBase ? "lista para publicar" : "requiere generación formal"}</em>
        </span>
        <span>
          <strong>Cobertura</strong>
          <em>{plan.coveragePct == null ? "Sin lectura" : formatPercentLabel(plan.coveragePct)}</em>
        </span>
      </div>
    </section>
  );
}

function AcreditacionPhoneSupervisionPriorityPanel({ groups }: { groups: AcreditacionPhoneSupervisionModel["priorityGroups"] }) {
  return (
    <section className="mon-phone-supervision-priority" aria-label="Prioridades de supervisión telefónica">
      <header className="mon-phone-ops-head">
        <div>
          <span>Prioridad operativa</span>
          <strong>Qué revisar primero</strong>
        </div>
        <em>{formatMetric(groups.length)} foco{groups.length === 1 ? "" : "s"}</em>
      </header>
      <div>
        {groups.length ? groups.map((group) => (
          <article key={group.key} className={`is-${group.tone}`}>
            <span>{acreditacionQualityStatusLabel(group.tone)}</span>
            <strong>{group.title}</strong>
            <p>{group.detail}</p>
            <em>{formatMetric(group.count)} caso{group.count === 1 ? "" : "s"}</em>
          </article>
        )) : (
          <EmptyPanel title="Sin prioridades en el corte" detail="El último corte no reporta alertas activas. Revisa la sincronización antes de cerrar la supervisión." />
        )}
      </div>
    </section>
  );
}

function AcreditacionPhoneQualityAlertsPanel({
  model,
  generatedAt,
}: {
  model: AcreditacionPhoneSupervisionModel;
  generatedAt: string;
}) {
  const visibleAlerts = model.activeAlerts;
  const signalRows = acreditacionPhoneAlertSignalRows(visibleAlerts);
  const observationCount = visibleAlerts.length;
  const impactedCases = model.activeAlertCount;
  const observationLabel = observationCount === 1 ? "observación" : "observaciones";
  const heroTitle = observationCount
    ? `${formatMetric(observationCount)} ${observationLabel} localizada${observationCount === 1 ? "" : "s"}`
    : "Sin observaciones en el último corte";
  const heroCopy = observationCount
    ? `Impactan ${formatMetric(impactedCases)} caso${impactedCases === 1 ? "" : "s"} y separan preparación, asignación y calidad antes de pasar a supervisión.`
    : "El reporte canónico no trae señales de enlace, duración, asignación o conciliación Kobo-barrido.";
  const summary = [
    { label: "Observaciones", value: formatMetric(observationCount), hint: observationCount ? "para revisar" : "sin pendientes", tone: model.highest },
    { label: "Casos impactados", value: formatMetric(impactedCases), hint: impactedCases ? "afectados" : "sin impacto", tone: impactedCases ? model.highest : "ok" },
    { label: "Prioridad", value: acreditacionQualityPriorityValue(model.highest), hint: observationCount ? "nivel más alto" : "lista", tone: model.highest },
  ];
  return (
    <section className={`mon-quality-alert-panel is-${model.highest}`} aria-label="Observaciones telefónicas accionables">
      <header className="mon-quality-section-head">
        <div>
          <span>Alertas telefónicas</span>
          <strong><ShieldAlert size={16} /> Observaciones de llamadas y asignación</strong>
        </div>
        <div className="mon-quality-alert-meta">
          <span>{generatedAt ? formatDate(generatedAt) : "Sin sincronizar"}</span>
          <span>{formatMetric(observationCount)} activa{observationCount === 1 ? "" : "s"}</span>
        </div>
      </header>
      <div className="mon-quality-alert-hero">
        <div className="mon-quality-alert-lead">
          <span className="mon-quality-alert-chip">
            {model.highest === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {acreditacionQualityStatusLabel(model.highest)}
          </span>
          <strong>{heroTitle}</strong>
          <p>{heroCopy}</p>
        </div>
        <div className="mon-quality-alert-stats">
          {summary.map((item) => (
            <span key={item.label} className={`is-${item.tone}`}>
              <em>{item.label}</em>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="mon-quality-alert-layout">
        <div className="mon-quality-alert-list" aria-label="Observaciones localizadas">
          {visibleAlerts.length ? visibleAlerts.map((alert) => (
            <AcreditacionPhoneQualityAlertCard key={alert.id} alert={alert} />
          )) : (
            <EmptyPanel title="Sin observaciones" detail="Este corte no trae nada que revisar en llamadas ni en asignación." />
          )}
        </div>

        <aside className="mon-quality-alert-where" aria-label="Ubicación de observaciones">
          <div>
            <span>Dónde revisar primero</span>
            <strong>{model.locations.length ? `${model.locations.length} lugar${model.locations.length === 1 ? "" : "es"} con observaciones` : "Nada pendiente"}</strong>
          </div>
          {model.locations.length ? (
            <div className="mon-quality-alert-where-list">
              {model.locations.map((location) => (
                <div key={location.where} className={`is-${location.tone}`}>
                  <span>
                    <strong>{location.where}</strong>
                    <em>{formatMetric(location.count)} caso{location.count === 1 ? "" : "s"}</em>
                  </span>
                  <i style={{ "--quality-location-pct": `${location.percent}%` } as CSSProperties} />
                </div>
              ))}
            </div>
          ) : (
            <p>No hay observaciones pendientes.</p>
          )}
          <div className="mon-quality-alert-rulebook" aria-label="Reglas de alerta telefónica">
            <span>Qué se está vigilando</span>
            {ACREDITACION_PHONE_ALERT_RULES.map((rule) => {
              const active = signalRows.find((row) => row.kind === rule.kind);
              return (
                <div key={rule.kind} className={active ? "is-active" : ""}>
                  <strong>{rule.label}</strong>
                  <em>{active ? `${formatMetric(active.count)} caso${active.count === 1 ? "" : "s"}` : "sin casos"}</em>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function acreditacionPhoneAlertSignalRows(alerts: AcreditacionQualityAlertItem[]) {
  const rows = new Map<string, { kind: string; label: string; count: number }>();
  alerts.forEach((alert) => {
    const current = rows.get(alert.signal.kind) ?? { kind: alert.signal.kind, label: alert.signal.label, count: 0 };
    current.count += alert.count ?? 1;
    rows.set(alert.signal.kind, current);
  });
  return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function AcreditacionPhoneQualityAlertCard({ alert }: { alert: AcreditacionQualityAlertItem }) {
  const displayCode = alert.code.replace(/^(codpulso|cod pulso|codigo|código|id|cv_id|custom_value):/i, "");
  return (
    <article className={`mon-quality-alert-card is-${alert.tone}`}>
      <div className="mon-quality-alert-card-head">
        <span>{acreditacionQualityLevelLabel(alert.level, alert.tone)}</span>
        <span>{alert.signal.label}</span>
        {alert.count != null && <em>{formatMetric(alert.count)} caso{alert.count === 1 ? "" : "s"}</em>}
      </div>
      <strong>{alert.title}</strong>
      <p>{alert.detail}</p>
      <span className="mon-quality-alert-action">
        <ClipboardCheck size={13} />
        {acreditacionQualityActionLabel(alert)}
      </span>
      <div className="mon-quality-alert-foot">
        <span><Route size={13} /> {alert.where}</span>
        {displayCode && <span>Código {displayCode}</span>}
        {alert.total != null && alert.count != null && alert.total > 0 && (
          <span>{formatPercentLabel(safePercentValue(alert.count, alert.total))} del grupo</span>
        )}
      </div>
    </article>
  );
}

function acreditacionPhoneControlSampleRows(reports: MonitoreoAcreditacionReports) {
  return rowsForSheetBlock(reports, "monitoreo_telefonico", ["muestra_control", "muestra_supervision", "control_sample"]);
}

function AcreditacionPhonePendingInsistence({
  pendingRows,
  insistenceRows,
  detailRows,
  reattemptRows,
}: {
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  detailRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
}) {
  const rowsByName = new Map<string, {
    key: string;
    name: string;
    pending: Record<string, unknown> | null;
    insistence: Record<string, unknown> | null;
    reattempt: Record<string, unknown> | null;
    details: Array<Record<string, unknown>>;
  }>();
  const ensure = (row: Record<string, unknown>, index: number) => {
    const name = phoneResponsibleName(row, index);
    const key = normalizeSourceMatch(name) || `responsable-${index}`;
    const current = rowsByName.get(key) ?? { key, name, pending: null, insistence: null, reattempt: null, details: [] };
    rowsByName.set(key, current);
    return current;
  };
  pendingRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).pending = row; });
  insistenceRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).insistence = row; });
  reattemptRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).reattempt = row; });
  detailRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).details.push(row); });

  const baseRows = Array.from(rowsByName.values()).map((record) => {
    const pending = phoneRowNumber(record.pending ?? {}, ["No barridos", "Por barrer"], 0);
    const assigned = phoneRowOptionalNumber(record.pending ?? {}, ["Casos asignados", "Asignados"]);
    const swept = assigned == null ? null : Math.max(0, assigned - pending);
    const noAnswer = phoneRowNumber(record.insistence ?? {}, ["Casos no contesta"], 0);
    const avg = phoneRowOptionalNumber(record.insistence ?? {}, ["Promedio intentos"]);
    const buckets = ACREDITACION_PHONE_ATTEMPT_BUCKETS.map((bucket, index) => ({
      ...bucket,
      index,
      value: phoneAttemptBucketValue(record.insistence ?? {}, bucket),
    }));
    // Un caso sin intentos no tiene disposición: no puede figurar como «no
    // contesta». Antes se colaban con «0 intentos» bajo ese rótulo (plan §2.5).
    const noAnswerCasesAll = record.details
      .map((item, index) => phoneNoAnswerCaseFromRow(item, index, record.key))
      .sort((a, b) => a.attempts - b.attempts || a.name.localeCompare(b.name, "es"));
    const noAnswerCases = noAnswerCasesAll.filter((item) => item.attempts > 0);
    const noAnswerWithoutAttempts = noAnswerCasesAll.length - noAnswerCases.length;
    return {
      ...record,
      assigned,
      swept,
      pending,
      noAnswer,
      avg,
      buckets,
      reattemptable: phoneRowOptionalNumber(record.reattempt ?? {}, ["Casos reintentables"]),
      lowReattempt: phoneRowOptionalNumber(record.reattempt ?? {}, ["Reintentos bajos"]),
      noAnswerCases,
      noAnswerWithoutAttempts,
      avgForMedian: avg,
    };
  }).sort((a, b) => b.pending - a.pending || b.noAnswer - a.noAnswer || a.name.localeCompare(b.name, "es"));

  // La insistencia se califica contra el propio equipo: con umbrales absolutos
  // los 13 responsables salían con la misma etiqueta (plan §8).
  const medianaIntentos = phoneMedian(baseRows.map((row) => row.avgForMedian));
  const rows = baseRows.map((row) => ({ ...row, intensity: phoneAttemptIntensity(row.avgForMedian, medianaIntentos) }));

  const totalAssigned = rows.reduce((sum, row) => sum + (row.assigned ?? 0), 0);
  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0);
  const totalNoAnswer = rows.reduce((sum, row) => sum + row.noAnswer, 0);
  const totalAttemptCases = rows.reduce((sum, row) => sum + row.buckets.reduce((inner, bucket) => inner + bucket.value, 0), 0);
  const weightedAttempts = rows.reduce((sum, row) => (
    sum + row.buckets.reduce((inner, bucket, index) => inner + (bucket.value * (index === 5 ? 6 : index + 1)), 0)
  ), 0);
  const avgAttempts = totalAttemptCases > 0 ? weightedAttempts / totalAttemptCases : null;
  const totalBuckets = ACREDITACION_PHONE_ATTEMPT_BUCKETS.map((bucket, index) => ({
    ...bucket,
    value: rows.reduce((sum, row) => sum + (row.buckets[index]?.value ?? 0), 0),
  }));
  const unassignedPending = pendingRows.filter((row, index) => phoneIsUnassignedResponsible(phoneResponsibleName(row, index)));
  const unassignedCases = unassignedPending.reduce((sum, row) => sum + phoneRowNumber(row, ["No barridos", "Por barrer", "Casos asignados"], 0), 0);

  if (!rows.length) return <EmptyPanel title="Sin pendientes telefónicos" detail="Los no-contactos, insistencias y reintentos aparecerán después de sincronizar estados de llamada." />;
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--pending-workbench">
      <header className="mon-phone-ops-head">
        <div>
          <span>Pendientes e insistencia</span>
          <strong>Casos por llamar e insistencia, por responsable</strong>
        </div>
        <em>{formatMetric(rows.length)} responsables</em>
      </header>
      {/* Eran cinco cifras del mismo peso. Lo que decide es cuántos casos
          quedan sin dueño; el resto es contexto. */}
      <div className="mon-phone-pending-workbench-summary">
        {unassignedCases ? (
          <span className="is-warning is-lead" title="Casos de la base que nadie tiene asignados">
            <strong>{formatMetric(unassignedCases)}</strong>
            <em>sin responsable</em>
          </span>
        ) : null}
        <span className={totalPending ? "is-warning" : "is-ok"}><strong>{formatMetric(totalPending)}</strong><em>por llamar, ya asignados</em></span>
        <span><strong>{formatMetric(totalNoAnswer)}</strong><em>no contestan</em></span>
        <span><strong>{formatMetric(totalAssigned)}</strong><em>casos repartidos</em></span>
        <span><strong>{avgAttempts == null ? "—" : avgAttempts.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong><em>intentos en promedio</em></span>
      </div>
      <div className="mon-phone-attempt-scale" aria-label="Escala de insistencia por intentos">
        {totalBuckets.map((bucket, index) => (
          <span key={bucket.key} className={`is-bucket-${index + 1}`}>
            <strong>{bucket.detail}</strong>
            <em>{formatMetric(bucket.value)}</em>
          </span>
        ))}
      </div>
      <div className="mon-phone-pending-workbench-list">
        {rows.map((row) => {
          const assigned = Math.max(0, row.assigned ?? row.pending);
          const swept = Math.max(0, row.swept ?? Math.max(0, assigned - row.pending));
          const pendingPct = safePercentValue(row.pending, assigned) ?? 0;
          const sweptPct = safePercentValue(swept, assigned) ?? 0;
          const anchosIntentos = anchosDeSegmentos(row.buckets.map((bucket) => bucket.value));
          return (
            <section key={row.key} className={`mon-phone-pending-person is-${row.pending ? "pending" : "clear"}`}>
              <header>
                <div>
                  <strong>{row.name}</strong>
                  <em>{formatMetric(assigned)} casos asignados · {formatMetric(row.noAnswer)} sin respuesta</em>
                </div>
                <span className={row.pending ? "is-warning" : "is-ok"}>
                  <strong>{formatMetric(row.pending)}</strong>
                  <em>por llamar</em>
                </span>
              </header>
              <div className="mon-phone-pending-track-block">
                <div className="mon-phone-track-labels">
                  <span><strong>{formatMetric(swept)}</strong><em>ya llamados</em></span>
                </div>
                <div className="mon-phone-pending-track" aria-label={`${row.name}: ${formatMetric(swept)} barridos y ${formatMetric(row.pending)} por barrer`}>
                  {swept > 0 ? (
                    <i
                      className="is-swept"
                      tabIndex={0}
                      title={`${row.name}: ${formatMetric(swept)} casos barridos`}
                      aria-label={`${row.name}: ${formatMetric(swept)} casos barridos`}
                      style={{ "--phone-segment": `${Math.max(0, Math.min(100, sweptPct))}%` } as CSSProperties}
                    />
                  ) : null}
                  {row.pending > 0 ? (
                    <i
                      className="is-pending"
                      tabIndex={0}
                      title={`${row.name}: ${formatMetric(row.pending)} casos por barrer`}
                      aria-label={`${row.name}: ${formatMetric(row.pending)} casos por barrer`}
                      style={{ "--phone-segment": `${Math.max(0, Math.min(100, pendingPct))}%` } as CSSProperties}
                    />
                  ) : null}
                  {!swept && !row.pending ? <i className="is-empty" style={{ "--phone-segment": "100%" } as CSSProperties} /> : null}
                </div>
              </div>
              <div className="mon-phone-attempt-track-block">
                <div className="mon-phone-track-labels">
                  <span><strong>{row.avg == null ? "S/D" : row.avg.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong><em>promedio de intentos</em></span>
                  <span><strong>{formatMetric(row.reattemptable ?? 0)}</strong><em>casos reintentables</em></span>
                </div>
                <div className="mon-phone-attempt-track" aria-label={`${row.name}: distribución de intentos en casos que no contestan`}>
                  {row.buckets.map((bucket, indiceBucket) => (
                    bucket.value > 0 ? (
                      <i
                        key={`${row.key}-${bucket.key}`}
                        className={`is-bucket-${bucket.index + 1}`}
                        tabIndex={0}
                        title={`${row.name}: ${bucket.detail}, ${formatMetric(bucket.value)} casos`}
                        aria-label={`${row.name}: ${bucket.detail}, ${formatMetric(bucket.value)} casos`}
                        style={{ "--phone-segment": `${anchosIntentos[indiceBucket]}%` } as CSSProperties}
                      />
                    ) : null
                  ))}
                  {!row.buckets.some((bucket) => bucket.value > 0) ? <i className="is-empty" style={{ "--phone-segment": "100%" } as CSSProperties} /> : null}
                </div>
                {/* La escala completa ya está arriba, para todo el equipo.
                    Repetirla por responsable con seis píldoras —incluidos los
                    tramos en cero— sumaba una fila de ruido trece veces. */}
                <div className="mon-phone-attempt-inline-counts">
                  {row.buckets.filter((bucket) => bucket.value > 0).map((bucket) => (
                    <span key={`${row.key}-${bucket.key}-count`} className={`is-bucket-${bucket.index + 1}`}>
                      <em>{bucket.detail}</em>
                      <strong>{formatMetric(bucket.value)}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="mon-phone-noanswer-cases">
                {row.noAnswerCases.length ? (
                  <details className="mon-phone-noanswer-disclosure">
                    <summary className="mon-phone-noanswer-summary">
                      <span>Casos que no contestan</span>
                      <strong>{formatMetric(row.noAnswerCases.length)} caso{row.noAnswerCases.length === 1 ? "" : "s"} con intento registrado</strong>
                      {row.noAnswerWithoutAttempts > 0 ? (
                        <small title="Sin intento registrado no hay disposición: no cuentan como no contesta">
                          {formatMetric(row.noAnswerWithoutAttempts)} sin intento registrado, fuera de esta lista
                        </small>
                      ) : null}
                    </summary>
                    <div className="mon-phone-noanswer-list">
                      {row.noAnswerCases.map((item) => (
                        <article key={item.id} className={`is-${item.intensity.key}`}>
                          <div>
                            <strong>{item.name}</strong>
                            {/* Sin nombre en la base, `name` ya es el CodPulso:
                                repetirlo abajo era decir dos veces lo mismo. */}
                            <em>{[
                              item.code && item.code !== item.name ? `CodPulso ${item.code}` : "",
                              item.dateLabel,
                            ].filter(Boolean).join(" · ") || "sin fecha"}</em>
                          </div>
                          <span><strong>{phoneAttemptCountLabel(item.attempts)}</strong><em>de {formatMetric(item.target)}</em></span>
                          <i title={`${item.status}: ${phoneAttemptCountLabel(item.attempts)} de ${formatMetric(item.target)}`}>
                            <b style={{ "--phone-case-pct": `${item.ratioPct}%` } as CSSProperties} />
                          </i>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : (
                  <div className="mon-phone-noanswer-summary is-empty">
                    <span>Casos que no contestan</span>
                    <strong>0 casos con intento registrado</strong>
                    {row.noAnswerWithoutAttempts > 0 ? (
                      <small title="Sin intento registrado no hay disposición: no cuentan como no contesta">
                        {formatMetric(row.noAnswerWithoutAttempts)} sin intento registrado, fuera de esta lista
                      </small>
                    ) : null}
                  </div>
                )}
              </div>
              <footer>
                <span className={`is-${row.intensity.key}`}>{row.intensity.label}</span>
                {row.lowReattempt != null && row.lowReattempt > 0 ? <span>{formatMetric(row.lowReattempt)} casos con baja insistencia</span> : null}
              </footer>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function TelefonicoPendingOperationalTable({
  pendingRows,
  insistenceRows,
  detailRows,
  reattemptRows,
}: {
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  detailRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
}) {
  const rowsByName = new Map<string, {
    key: string;
    name: string;
    pending: Record<string, unknown> | null;
    insistence: Record<string, unknown> | null;
    reattempt: Record<string, unknown> | null;
    detailCount: number;
  }>();
  const ensure = (row: Record<string, unknown>, index: number) => {
    const name = phoneResponsibleName(row, index);
    const key = normalizeSourceMatch(name) || `responsable-${index}`;
    const current = rowsByName.get(key) ?? { key, name, pending: null, insistence: null, reattempt: null, detailCount: 0 };
    rowsByName.set(key, current);
    return current;
  };

  pendingRows.forEach((row, index) => { ensure(row, index).pending = row; });
  insistenceRows.forEach((row, index) => { ensure(row, index).insistence = row; });
  reattemptRows.forEach((row, index) => { ensure(row, index).reattempt = row; });
  detailRows.forEach((row, index) => { ensure(row, index).detailCount += 1; });

  const rows = Array.from(rowsByName.values()).map((record) => {
    const assigned = phoneRowOptionalNumber(record.pending ?? {}, ["Casos asignados", "Asignados"]);
    const pending = phoneRowNumber(record.pending ?? {}, ["No barridos", "Por barrer"], 0);
    const noAnswer = phoneRowOptionalNumber(record.insistence ?? {}, ["Casos no contesta"]) ?? record.detailCount;
    const attemptSum = phoneRowOptionalNumber(record.insistence ?? {}, ["Suma intentos", "Intentos totales"]);
    const avgAttempts = phoneRowOptionalNumber(record.insistence ?? {}, ["Promedio intentos"]);
    const reattemptable = phoneRowOptionalNumber(record.reattempt ?? {}, ["Casos reintentables"]);
    const lowReattempt = phoneRowOptionalNumber(record.reattempt ?? {}, ["Reintentos bajos"]);
    const assignedDenominator = Math.max(1, assigned ?? pending);
    const pendingPct = safePercentValue(pending, assignedDenominator) ?? 0;
    return {
      ...record,
      assigned,
      pending,
      noAnswer,
      attemptSum,
      avgAttempts,
      reattemptable,
      lowReattempt,
      pendingPct,
      unassigned: phoneIsUnassignedResponsible(record.name),
    };
  }).sort((a, b) => Number(b.unassigned) - Number(a.unassigned) || b.pending - a.pending || b.noAnswer - a.noAnswer || a.name.localeCompare(b.name, "es"));

  if (!rows.length) {
    return <EmptyPanel title="Sin detalle de pendientes" detail="El corte no trae filas de responsables, insistencia o reintentos para esta sección." />;
  }

  return (
    <section className="mon-phone-pending-table-panel" aria-label="Detalle compacto de pendientes telefónicos">
      <header>
        <div>
          <span>Detalle operativo</span>
          <strong>Responsables con pendientes</strong>
        </div>
        <em>{formatMetric(rows.length)} filas consolidadas</em>
      </header>
      <div className="mon-phone-pending-table-wrap">
        <table className="mon-phone-pending-table">
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Asignación</th>
              <th>No barridos</th>
              <th>No contesta</th>
              <th>Intentos</th>
              <th>Reintentos</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((row) => (
              <tr key={row.key} className={row.unassigned ? "is-unassigned" : row.pending ? "is-pending" : "is-clear"}>
                <td>
                  <strong>{row.name}</strong>
                  <small>{row.unassigned ? "Asignación pendiente" : row.pending ? "Requiere barrido" : "Sin pendiente"}</small>
                </td>
                <td>
                  <strong>{row.assigned == null ? "S/D" : formatMetric(row.assigned)}</strong>
                  <small>casos asignados</small>
                </td>
                <td>
                  <strong>{formatMetric(row.pending)}</strong>
                  <small>{formatPercentLabel(row.pendingPct)} por barrer</small>
                  <span className="mon-phone-pending-compact-bar" aria-hidden="true">
                    <i style={{ "--phone-pending-pct": `${Math.max(0, Math.min(100, row.pendingPct))}%` } as CSSProperties} />
                  </span>
                </td>
                <td>
                  <strong>{formatMetric(row.noAnswer)}</strong>
                  <small>{row.detailCount ? `${formatMetric(row.detailCount)} casos con detalle` : "sin detalle individual"}</small>
                </td>
                <td>
                  <strong>{row.avgAttempts == null ? "S/D" : row.avgAttempts.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong>
                  <small>{row.attemptSum == null ? "sin suma" : `${formatMetric(row.attemptSum)} intentos`}</small>
                </td>
                <td>
                  <strong>{row.reattemptable == null ? "S/D" : formatMetric(row.reattemptable)}</strong>
                  <small>{row.lowReattempt ? `${formatMetric(row.lowReattempt)} baja insistencia` : "sin alerta"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function phoneDailyBlockForPanel(reports: MonitoreoAcreditacionReports): MonitoreoReportBlock | null {
  const phoneEffective = reportBlockForSheet(reports, "monitoreo_telefonico", "avance_efectivo_dia");
  if (phoneEffective?.rows.length) return phoneEffective;

  const summaryEffective = reportBlockForSheet(reports, "resumen", "avance_efectivo_dia");
  if (summaryEffective?.rows.length) {
    const columns = reportBlockColumns(summaryEffective);
    const dateColumns = columns.filter((column) => {
      const key = normalizeReportMatch(column);
      return key && !["unidad", "actor", "estado", "estatus", "total"].includes(key);
    });
    const rows = dateColumns.map((column) => ({
      Fecha: column,
      Efectivas: summaryEffective.rows.reduce((sum, row) => sum + reportNumberValue(row[column]), 0),
    })).filter((row) => row.Efectivas > 0);
    if (rows.length) {
      return {
        id: "avance_efectivo_dia",
        title: "Avance efectivo por día",
        columns: ["Fecha", "Efectivas"],
        rows,
        note: "Corte diario consolidado desde el avance efectivo.",
      };
    }
  }

  return reportBlockForSheet(reports, "monitoreo_telefonico", "produccion_dia");
}

function phoneBooleanValue(row: Record<string, unknown>, keys: string[]) {
  const raw = phoneRowValue(row, keys, "");
  const key = normalizeCaseSearch(raw);
  if (["si", "s", "yes", "true", "1"].includes(key)) return true;
  if (["no", "false", "0"].includes(key)) return false;
  const numeric = num(raw, NaN);
  return Number.isFinite(numeric) ? numeric !== 0 : false;
}

type PhonePlatformComparisonTotals = {
  total: number;
  phoneEffective: number;
  platformComplete: number;
  matchedEffective: number;
  mismatch: number;
  phoneWithoutPlatform: number;
  platformWithoutPhone: number;
  withoutCode: number;
};

function phoneCodPulsoDifferenceParts(comparison: Pick<PhonePlatformComparisonTotals, "mismatch" | "phoneWithoutPlatform" | "platformWithoutPhone" | "withoutCode">) {
  const parts: string[] = [];
  if (comparison.platformWithoutPhone) {
    parts.push(`${fmt(comparison.platformWithoutPhone)} entrevistas completas sin estado registrado en la hoja`);
  }
  if (comparison.phoneWithoutPlatform) {
    parts.push(`${fmt(comparison.phoneWithoutPlatform)} tel. efectivas sin Kobo`);
  }
  if (comparison.withoutCode) {
    parts.push(`${fmt(comparison.withoutCode)} sin CodPulso`);
  }
  if (!parts.length && comparison.mismatch) parts.push(`${fmt(comparison.mismatch)} diferencias`);
  return parts;
}

function phoneCodPulsoDifferenceHint(comparison: Pick<PhonePlatformComparisonTotals, "mismatch" | "phoneWithoutPlatform" | "platformWithoutPhone" | "withoutCode" | "total">) {
  if (!comparison.mismatch) return comparison.total ? `${fmt(comparison.total)} registros comparados` : "coincidencia individual";
  const parts: string[] = [];
  if (comparison.platformWithoutPhone) parts.push(`${fmt(comparison.platformWithoutPhone)} Kobo con telefono pendiente`);
  if (comparison.phoneWithoutPlatform) parts.push(`${fmt(comparison.phoneWithoutPlatform)} tel. sin Kobo`);
  if (comparison.withoutCode) parts.push(`${fmt(comparison.withoutCode)} sin CodPulso`);
  return parts.length ? parts.join(" · ") : `${fmt(comparison.mismatch)} diferencias`;
}

function phoneCodPulsoDifferenceSentence(comparison: Pick<PhonePlatformComparisonTotals, "mismatch" | "phoneWithoutPlatform" | "platformWithoutPhone" | "withoutCode">) {
  if (!comparison.mismatch) return "Las efectivas telefonicas coinciden con Kobo por CodPulso individual.";
  return `${phoneCodPulsoDifferenceParts(comparison).join("; ")}.`;
}

export function phonePlatformComparisonTotals(rows: Array<Record<string, unknown>>): PhonePlatformComparisonTotals {
  const initialTotals: PhonePlatformComparisonTotals = {
    total: 0,
    phoneEffective: 0,
    platformComplete: 0,
    matchedEffective: 0,
    mismatch: 0,
    phoneWithoutPlatform: 0,
    platformWithoutPhone: 0,
    withoutCode: 0,
  };

  return rows.reduce<PhonePlatformComparisonTotals>((acc, row) => {
    if (phoneComparisonRowIsTest(row)) return acc;
    const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
    const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
    const matchLabel = normalizeSourceMatch(phoneRowValue(row, ["Coinciden efectivas"], ""));
    const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "");
    const comparable = phoneEffective || platformComplete || matchLabel === "no";
    acc.total += 1;
    if (phoneEffective) acc.phoneEffective += 1;
    if (platformComplete) acc.platformComplete += 1;
    if (phoneEffective && platformComplete) acc.matchedEffective += 1;
    if (comparable && phoneEffective !== platformComplete) acc.mismatch += 1;
    if (phoneEffective && !platformComplete) acc.phoneWithoutPlatform += 1;
    if (!phoneEffective && platformComplete) acc.platformWithoutPhone += 1;
    if (!normalizeSourceMatch(code)) acc.withoutCode += 1;
    return acc;
  }, initialTotals);
}

function phonePlatformComparisonIsMismatch(row: Record<string, unknown>) {
  if (phoneComparisonRowIsTest(row)) return false;
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const matchLabel = normalizeSourceMatch(phoneRowValue(row, ["Coinciden efectivas"], ""));
  const detail = normalizeSourceMatch(phoneRowValue(row, ["Coincidencia"], ""));
  return matchLabel === "no"
    || phoneEffective !== platformComplete
    || detail.includes("sin codpulso")
    || detail.includes("sin plataforma")
    || detail.includes("sin kobo")
    || detail.includes("sin tel");
}

function phonePlatformComparisonTone(row: Record<string, unknown>): "ok" | "warning" | "pending" {
  if (phonePlatformComparisonIsMismatch(row)) return "warning";
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  if (phoneEffective && platformComplete) return "ok";
  return "pending";
}

function phonePlatformComparisonLabel(row: Record<string, unknown>) {
  const tone = phonePlatformComparisonTone(row);
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  if (platformComplete && !phoneEffective) return `Kobo efectiva; estado telefónico actual: ${phoneStatus || "pendiente"}`;
  if (phoneEffective && !platformComplete) return "Tel. efectiva sin efectiva Kobo";
  const detail = phoneRowValue(row, ["Coincidencia", "Detalle"], "");
  if (detail) return detail;
  if (tone === "warning") return "Revisar estado telefónico";
  if (tone === "ok") return "Coincide como efectiva";
  return "Sin efectiva en ambas fuentes";
}

function phonePlatformComparisonFocusRows(rows: Array<Record<string, unknown>>, mismatchRows: Array<Record<string, unknown>>) {
  if (mismatchRows.length) return mismatchRows.slice(0, 12);
  const effectiveRows = rows.filter((row) => !phoneComparisonRowIsTest(row) && (
    phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"])
    || phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"])
  ));
  const realRows = rows.filter((row) => !phoneComparisonRowIsTest(row));
  return (effectiveRows.length ? effectiveRows : realRows).slice(0, 12);
}

function phonePlatformComparisonEvidenceRows(
  rows: Array<Record<string, unknown>>,
  mismatchRows: Array<Record<string, unknown>>,
  limit = 80,
) {
  const ordered: Array<Record<string, unknown>> = [];
  const seen = new Set<Record<string, unknown>>();
  const push = (row: Record<string, unknown>) => {
    if (seen.has(row)) return;
    seen.add(row);
    ordered.push(row);
  };
  const matchedEffectiveRows = rows.filter((row) => phonePlatformComparisonTone(row) === "ok");
  const pendingRows = rows.filter((row) => phonePlatformComparisonTone(row) === "pending");
  mismatchRows.forEach(push);
  matchedEffectiveRows.forEach(push);
  pendingRows.forEach(push);
  rows.forEach(push);
  return {
    rows: ordered.slice(0, limit),
    hidden: Math.max(0, ordered.length - limit),
  };
}

function AcreditacionPhoneComparisonCaseCard({
  row,
  index,
}: {
  row: Record<string, unknown>;
  index: number;
}) {
  const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código", "Llave"], "");
  const responsible = phoneRowValue(row, ["Responsable", "Operador", "Encuestador", "Asignado"], "");
  const rawDate = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Última respuesta", "Ultima respuesta"], "");
  const date = isAcreditacionNoDateLabel(rawDate) ? "" : rawDate;
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  const platformStatus = phoneRowValue(row, ["Avance plataforma", "Estado plataforma", "Estado Kobo"], "");
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const tone = phonePlatformComparisonTone(row);
  const Icon = tone === "warning" ? AlertCircle : tone === "ok" ? CheckCircle2 : Search;
  const codeLabel = code ? `CodPulso ${code}` : `Caso sin CodPulso ${index + 1}`;
  return (
    <section className={`mon-phone-compare-case is-${tone}`}>
      <header>
        <span><Icon size={13} /> {tone === "warning" ? "Revisar" : tone === "ok" ? "Coincide" : "Sin efectiva"}</span>
        <strong>{codeLabel}</strong>
        <em>{phonePlatformComparisonLabel(row)}</em>
      </header>
      <div className="mon-phone-compare-case-flow" aria-label={code ? `Conciliación de ${code}` : `Conciliación del caso ${index + 1}`}>
        <span className={phoneEffective ? "is-ready" : "is-muted"}>
          <em>Barrido</em>
          <strong>{phoneEffective ? "Efectiva" : phoneStatus || "Sin efectiva"}</strong>
        </span>
        <i className={tone === "warning" ? "is-warning" : tone === "ok" ? "is-ok" : "is-muted"} aria-hidden="true">
          <KeyRound size={12} />
          <small>{code || `#${index + 1}`}</small>
        </i>
        <span className={platformComplete ? "is-platform" : "is-muted"}>
          <em>Kobo</em>
          <strong>{platformComplete ? "Efectiva" : platformStatus || "Sin efectiva"}</strong>
        </span>
      </div>
      <footer>
        {responsible ? <span>{responsible}</span> : null}
        {date ? <span>{formatDate(date)}</span> : null}
        <span>{tone === "ok" ? "Efectivas alineadas" : tone === "warning" ? "Estado tel. pendiente" : "Sin efectiva"}</span>
      </footer>
    </section>
  );
}

function AcreditacionPhoneComparisonEvidenceItem({
  row,
  index,
}: {
  row: Record<string, unknown>;
  index: number;
}) {
  const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código", "Llave"], "");
  const responsible = phoneRowValue(row, ["Responsable", "Operador", "Encuestador", "Asignado"], "");
  const rawDate = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Última respuesta", "Ultima respuesta"], "");
  const date = isAcreditacionNoDateLabel(rawDate) ? "" : rawDate;
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  const platformStatus = phoneRowValue(row, ["Avance plataforma", "Estado plataforma", "Estado Kobo"], "");
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const tone = phonePlatformComparisonTone(row);
  const statusLabel = tone === "warning" ? "Revisar" : tone === "ok" ? "Coincide" : "Sin efectiva";
  return (
    <article className={`mon-phone-compare-evidence-item is-${tone}`}>
      <span className="mon-phone-compare-evidence-code">
        <KeyRound size={12} />
        <strong>{code || `Sin CodPulso ${index + 1}`}</strong>
        <em>{statusLabel}</em>
      </span>
      <span className={phoneEffective ? "is-ready" : "is-muted"}>
        <em>Barrido</em>
        <strong>{phoneEffective ? "Efectiva" : phoneStatus || "No efectiva"}</strong>
      </span>
      <span className={platformComplete ? "is-platform" : "is-muted"}>
        <em>Kobo</em>
        <strong>{platformComplete ? "Efectiva" : platformStatus || "No efectiva"}</strong>
      </span>
      <span className="mon-phone-compare-evidence-note">
        <em>{phonePlatformComparisonLabel(row)}</em>
        <strong>{[responsible, date ? formatDate(date) : ""].filter(Boolean).join(" · ") || "Sin responsable/fecha"}</strong>
      </span>
    </article>
  );
}

function AcreditacionPhonePlatformComparison({ rows }: { rows: Array<Record<string, unknown>> }) {
  const realRows = rows.filter((row) => !phoneComparisonRowIsTest(row));
  if (!realRows.length) {
    return (
      <EmptyPanel
        title="Sin comparación Kobo-barrido"
        detail="El reporte todavía no trae filas con CodPulso para conciliar el avance telefónico contra Kobo."
      />
    );
  }
  const totals = phonePlatformComparisonTotals(realRows);
  const mismatchRows = realRows.filter(phonePlatformComparisonIsMismatch);
  const focusRows = phonePlatformComparisonFocusRows(realRows, mismatchRows);
  const evidence = phonePlatformComparisonEvidenceRows(realRows, mismatchRows);
  const evidenceRows = evidence.rows;
  const hiddenEvidenceCount = evidence.hidden;
  const comparableEffective = Math.max(totals.phoneEffective, totals.platformComplete);
  const comparableDenominator = Math.max(1, comparableEffective);
  const effectiveMatchLabel = phoneCodPulsoEffectiveMatchLabel(totals);
  const effectiveBadge = effectiveMatchLabel === "S/D" ? `${formatMetric(totals.total)} registros` : `${effectiveMatchLabel} tel. alineadas`;
  const platformDelta = totals.platformComplete - totals.phoneEffective;
  const syncTone = totals.mismatch ? "warning" : comparableEffective ? "ok" : "pending";
  const traceableCodes = Math.max(0, totals.total - totals.withoutCode);
  const phoneEffectivePct = safePercentValue(totals.phoneEffective, comparableDenominator) ?? 0;
  const platformEffectivePct = safePercentValue(totals.platformComplete, comparableDenominator) ?? 0;
  const matchedPct = safePercentValue(totals.matchedEffective, comparableDenominator) ?? 0;
  const traceablePct = safePercentValue(traceableCodes, Math.max(1, totals.total)) ?? 0;
  const summaryItems = [
    { key: "phone", label: "Tel. efectivas", value: totals.phoneEffective, pct: safePercentValue(totals.phoneEffective, comparableDenominator), tone: "effective", hint: "estado telefónico efectivo" },
    { key: "platform", label: "Kobo valida", value: totals.platformComplete, pct: safePercentValue(totals.platformComplete, comparableDenominator), tone: "platform", hint: "pasan filtro y completan" },
    { key: "matched", label: "Kobo + tel.", value: totals.matchedEffective, pct: safePercentValue(totals.matchedEffective, comparableDenominator), tone: "ok", hint: `${effectiveMatchLabel} con ambos estados` },
    { key: "mismatch", label: "Pendiente tel.", value: totals.platformWithoutPhone, pct: safePercentValue(totals.platformWithoutPhone, comparableDenominator), tone: totals.platformWithoutPhone ? "warning" : "ok", hint: phoneCodPulsoDifferenceHint(totals) },
  ];
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--platform-match" aria-label="Comparación CodPulso entre barrido y Kobo">
      <header className="mon-phone-ops-head">
        <div>
          <span>CodPulso</span>
          <strong>Lo registrado en la hoja contra lo entrevistado</strong>
          <small>Kobo define las efectivas; el barrido confirma o queda pendiente por código individual.</small>
        </div>
        <em>{effectiveBadge}</em>
      </header>
      <div className={`mon-phone-codpulso-stage is-${syncTone}`} aria-label="Trazabilidad visual por CodPulso">
        <section
          className="mon-phone-codpulso-source is-phone"
          style={{ "--codpulso-source-pct": `${Math.max(2, Math.min(100, phoneEffectivePct))}%` } as CSSProperties}
        >
          <span><PhoneCall size={13} /> Tel. efectivas</span>
          <strong>{formatMetric(totals.phoneEffective)}</strong>
          <em>estado telefónico efectivo</em>
          <i aria-hidden="true" />
        </section>
        <div
          className="mon-phone-codpulso-keyway"
          style={{ "--codpulso-match-pct": `${Math.max(0, Math.min(100, matchedPct))}%` } as CSSProperties}
        >
          <div className="mon-phone-codpulso-ring" aria-hidden="true">
            <strong>{effectiveMatchLabel}</strong>
            <em>alineadas</em>
          </div>
          <span><KeyRound size={14} /> CodPulso individual</span>
          <p>
            {totals.mismatch
              ? `${formatMetric(totals.platformWithoutPhone)} efectivas Kobo tienen estado telefónico pendiente.`
              : comparableEffective
                ? "Las efectivas telefonicas estan alineadas con Kobo por codigo."
                : "Aún no hay efectivas comparables por código."}
          </p>
        </div>
        <section
          className="mon-phone-codpulso-source is-kobo"
          style={{ "--codpulso-source-pct": `${Math.max(2, Math.min(100, platformEffectivePct))}%` } as CSSProperties}
        >
          <span><ListChecks size={13} /> Kobo valida</span>
          <strong>{formatMetric(totals.platformComplete)}</strong>
          <em>{platformDelta === 0 ? "mismo volumen efectivo" : `${platformDelta > 0 ? "+" : ""}${formatMetric(platformDelta)} frente al barrido`}</em>
          <i aria-hidden="true" />
        </section>
        <aside
          className="mon-phone-codpulso-trace"
          style={{ "--codpulso-trace-pct": `${Math.max(0, Math.min(100, traceablePct))}%` } as CSSProperties}
        >
          <span>Registros comparados</span>
          <strong>{formatMetric(totals.total)}</strong>
          <em>{totals.withoutCode ? `${formatMetric(totals.withoutCode)} sin CodPulso` : `${formatMetric(traceableCodes)} con CodPulso`}</em>
          <i aria-hidden="true" />
        </aside>
      </div>
      <div className="mon-phone-codpulso-proof" aria-label="Evidencia resumida de alineación efectiva">
        {summaryItems.map((item) => (
          <section
            key={item.key}
            className={`is-${item.tone}`}
            style={{ "--phone-proof-pct": `${Math.max(0, Math.min(100, item.pct ?? 0))}%` } as CSSProperties}
          >
            <span>{item.label}</span>
            <strong>{formatMetric(item.value)}</strong>
            <em>{item.key === "matched" ? "alineadas" : item.key === "mismatch" ? "por revisar" : "casos"}</em>
            <i aria-hidden="true" />
            <small>{item.key === "matched" || item.key === "mismatch" ? item.hint : `${phonePercentLabel(item.pct)} · ${item.hint}`}</small>
          </section>
        ))}
      </div>
      <div className="mon-phone-compare-board" aria-label="Casos priorizados por CodPulso">
        <header>
          <span>{mismatchRows.length ? "Estados por actualizar" : "Alineación efectiva"}</span>
          <strong>{mismatchRows.length ? `${formatMetric(mismatchRows.length)} códigos necesitan revisión` : `${effectiveMatchLabel} efectivas alineadas`}</strong>
          <em>{mismatchRows.length ? "Prioriza códigos donde Kobo ya cuenta y el barrido sigue pendiente o distinto." : "Muestra de códigos efectivos para confirmar trazabilidad."}</em>
        </header>
        <div className="mon-phone-compare-cases">
          {focusRows.map((row, index) => (
            <AcreditacionPhoneComparisonCaseCard key={`${phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "")}-${index}`} row={row} index={index} />
          ))}
        </div>
      </div>
      <details className="mon-phone-compare-evidence">
        <summary>
          <span><FileCheck2 size={13} /> Evidencia por llave</span>
          <em>{formatMetric(evidenceRows.length)} visibles{hiddenEvidenceCount ? ` · ${formatMetric(hiddenEvidenceCount)} más` : ""}</em>
        </summary>
        <div className="mon-phone-compare-evidence-list" aria-label="Evidencia visual de comparación por CodPulso">
          {evidenceRows.map((row, index) => (
            <AcreditacionPhoneComparisonEvidenceItem
              key={`evidence-${phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "")}-${index}`}
              row={row}
              index={index}
            />
          ))}
        </div>
      </details>
    </article>
  );
}

function AcreditacionPhoneOperationsWorkbench({
  reports,
  activeTab,
  fallbackEffective = 0,
  standalone = false,
  corte = null,
  goals = [],
}: {
  reports: MonitoreoAcreditacionReports;
  activeTab: AcreditacionPhoneTab;
  fallbackEffective?: number;
  standalone?: boolean;
  /** Contrato de corte para el embudo de portada; sin él, el embudo no se dibuja. */
  corte?: MonitoreoCorte | null;
  /** Metas del proyecto: aportan el objetivo declarado por cuota. */
  goals?: MonitoreoGoal[];
}) {
  const summaryRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
  const quotaRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  // Mismo origen que en la vista de cuotas: el nombre lo declara el estudio en
  // `control_vars` y viaja en la columna `Variable` de cada fila.
  const segmentoDeLasCuotas = nombreDelSegmento(phoneQuotaRowsForPanel(quotaRows).map((row) => row.variable));
  const responsibleRows = mergeAcreditacionPhoneResponsibleRows(
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["operacion_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["efectivos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["responsables_barrido"]),
  );
  const pendingRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]);
  const insistenceRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["insistencia_no_contesta"]);
  const detailRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["detalle_no_contesta"]);
  const reattemptRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["reintentos_responsable"]);
  // Bloques que el engine ya producía y nadie consumía: estados por encuestador
  // y cruce plataforma↔barrido por responsable (plan §3).
  const statusByResponsibleRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_responsable"]);
  const platformByResponsibleRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["campo_vs_plataforma_responsable"]);
  const alertRows = rowsForSheetBlock(reports, "alertas", ["alertas"]);
  const reconciliationRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  const dailyBlock = phoneDailyBlockForPanel(reports);
  const dailyRows = dailyBlock?.rows ?? [];
  const statusDailyRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_dia", "estados_dia", "estatus_telefonico_dia"]);
  const timeRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]);
  const comparison = phonePlatformComparisonTotals(reconciliationRows);
  const statusMatrix = buildTelefonicoStatusMatrix(statusByResponsibleRows);
  const platformGap = buildTelefonicoPlatformGap(platformByResponsibleRows);
  const platformLabel = phonePlatformShortLabel(platformByResponsibleRows, reconciliationRows);
  // El cuadro de conciliación se dibuja solo si el corte trae el cruce caso a
  // caso; sin él no hay cifra que mostrar y no se inventa una equivalente.
  const reconciliationTotals = reconciliationRows.length
    ? {
      plataforma: comparison.platformComplete,
      barrido: comparison.phoneEffective,
      cruzadas: comparison.matchedEffective,
      pendientes: comparison.platformWithoutPhone,
    }
    : null;
  const dailyBlockIsKoboEffective = normalizeSourceMatch(dailyBlock?.id ?? "").includes("avance_efectivo");
  const dailyPoints = buildAcreditacionPhoneDailyPoints(dailyRows);
  const dailyKoboEffective = dailyBlockIsKoboEffective
    ? dailyPoints.reduce((sum, point) => sum + point.effective, 0)
    : 0;
  const queries = normalizeInternalQueries(reports.internal_queries);
  const queryCases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const consultedCases = telefonicoConsultedEffectiveCasesFromSources(queryCases, reconciliationRows);
  const fallbackStatusRows = groupedCaseRows(queryCases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const fallbackResponsibleRows = groupedCaseRows(
    queryCases,
    (item) => internalQueryCollectorDisplayLabel(item) || item.collector_id || "Sin responsable",
    (value) => value,
  );
  const visibleStatusRows = statusRows.length ? statusRows : fallbackStatusRows;
  const visibleResponsibleRows = responsibleRows.length ? responsibleRows : fallbackResponsibleRows;
  const totals = phoneOperationTotals(summaryRows, visibleStatusRows, visibleResponsibleRows);
  const koboEffectiveForSupervision = comparison.platformComplete || dailyKoboEffective || null;
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";

  // Cumplimiento: la producción la valida la plataforma; el barrido aporta la
  // reserva y el volumen trabajado. El modo (cuotas / total / sin meta) lo
  // decide el propio modelo según lo que el usuario haya declarado (plan §5).
  const parsedQuotasForGoal = phoneQuotaRowsForPanel(quotaRows);
  const cumplimiento = buildTelefonicoCumplimiento({
    categorias: parsedQuotasForGoal.map((row) => ({
      clave: row.key,
      etiqueta: row.value,
      contexto: row.variable,
      universo: row.universe,
      minimo: row.meta,
      logrado: row.effective,
      objetivo: objetivoDeclaradoParaCuota(goals, row),
    })),
    logradoTotal: comparison.platformComplete || dailyKoboEffective || totals.effective,
    porBarrer: totals.unswept,
    barridos: totals.swept,
    serieDiaria: dailyPoints.map((point) => point.effective),
  });

  return (
    <section
      className={`pulso-panel mon-phone-panel${standalone ? " is-standalone-phone" : " mon-fill-panel"}`}
      // El panel recortaba en silencio todo lo que no cabía en el viewport
      // (2.342 px en el corte de acnur_pdm). El scroll lo toma el workbench.
      style={{ minHeight: 0, overflow: "visible" } as CSSProperties}
      aria-label={standalone ? "Monitoreo telefónico standalone" : "Monitoreo telefónico canónico"}
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Llamadas</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><PhoneCall size={16} /> Estado de la operación telefónica</span></h2>
          <p className="pulso-panel-hint">
            {standalone
              ? "Estados telefónicos, barrido, responsables y cruce individual con Kobo por CodPulso."
              : "Responsables, asignación, insistencia y estados propios del barrido."}
          </p>
        </div>
        <div className="mon-phone-meta">
          <span>{formatMetric(queryCases.length)} casos trazables</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-phone-tabbody">
        {activeTab === "consultados" ? (
          <div className="mon-phone-layout">
            <TelefonicoConsultedWorkbench cases={consultedCases} segmento={segmentoDeLasCuotas} />
          </div>
        ) : activeTab === "dia" ? (
          <div className="mon-phone-layout mon-phone-layout--alerts">
            <AcreditacionPhoneDailyTrend rows={dailyRows} statusRows={statusDailyRows} />
          </div>
        ) : activeTab === "tiempos" ? (
          <div className="mon-phone-layout mon-phone-layout--time">
            <AcreditacionPhoneTimeWorkbench alertRows={alertRows} timeRows={timeRows} assignmentRows={reconciliationRows} totals={totals} platformEffective={koboEffectiveForSupervision} />
          </div>
        ) : activeTab === "responsables" ? (
          <div className="mon-phone-layout mon-phone-layout--responsables">
            <TelefonicoStatusMatrixPanel matrix={statusMatrix} />
            <TelefonicoPlatformGapPanel gap={platformGap} plataformaLabel={platformLabel} />
            <AcreditacionPhoneResponsibleCards rows={visibleResponsibleRows} />
          </div>
        ) : activeTab === "incidencia" ? (
          <div className="mon-phone-layout mon-phone-layout--incidence">
            <AcreditacionPhonePendingInsistence pendingRows={pendingRows} insistenceRows={insistenceRows} detailRows={detailRows} reattemptRows={reattemptRows} />
          </div>
        ) : activeTab === "alertas" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneQualityAlertsPanel model={buildAcreditacionPhoneRealAlertModel({ alertRows })} generatedAt={reports.generated_at} />
          </div>
        ) : activeTab === "supervision" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneSupervisionBoard reports={reports} alertRows={alertRows} responsibleRows={visibleResponsibleRows} assignmentRows={reconciliationRows} pendingRows={pendingRows} insistenceRows={insistenceRows} reattemptRows={reattemptRows} timeRows={timeRows} totals={totals} platformEffective={koboEffectiveForSupervision} />
          </div>
        ) : (
          <div className="mon-phone-layout mon-phone-layout--summary">
            {reconciliationTotals ? (
              <TelefonicoReconciliationSummary
                plataforma={reconciliationTotals.plataforma}
                barrido={reconciliationTotals.barrido}
                cruzadas={reconciliationTotals.cruzadas}
                pendientes={reconciliationTotals.pendientes}
                plataformaLabel={platformLabel}
              />
            ) : null}
            {/* Sin el panel de cumplimiento.
              *
              * «¿Llegamos a la meta?» es la pregunta de Avance, y allí se
              * responde entera: cuota por cuota, con su base, su ritmo y sus
              * estados. Aquí presidía la portada repitiendo esa misma tabla
              * —Faltan 31, 70 de 100, logradas/mínimo/falta por categoría— y
              * empujaba hacia abajo lo que sí es de esta sección. Llamadas
              * responde otra cosa: cuánto de la base se ha barrido y en qué
              * estado quedó. Las cifras de cierre que solo estaban aquí
              * —reserva, ritmo, proyección y rendimiento— viajaron a la
              * cabecera de Avance › Cuotas, que es donde se decide si alcanza. */}
            {/* El embudo sube a franja: es una cadena de tres cifras y se leía
              * de arriba abajo en una columna de un tercio, mientras las dos
              * barras apiladas de al lado —que sí necesitan ancho— se apretaban
              * para dejarle sitio. Arriba ocupa una línea y devuelve el ancho a
              * quien lo aprovecha. */}
            {corte ? <TelefonicoEmbudo corte={corte} /> : null}
            <section className="mon-phone-overview-grid" aria-label="Resumen de barrido telefónico">
              <AcreditacionPhoneStorage totals={totals} />
              <AcreditacionPhoneStatusStorage rows={visibleStatusRows} total={totals.total} />
              {corte ? null : <AcreditacionPhoneQuotaPanel rows={quotaRows} />}
            </section>
            <section className="mon-phone-summary-secondary" aria-label="Lectura operativa del barrido">
              <AcreditacionPhoneIncidenceSection responsibleRows={visibleResponsibleRows} />
              <AcreditacionPhoneResponsibleCards rows={visibleResponsibleRows} />
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

function renderPhoneView(
  reports: MonitoreoAcreditacionReports,
  activeTab: AcreditacionPhoneTab = "resumen",
  fallbackEffective = 0,
  standalone = false,
  corte: MonitoreoCorte | null = null,
  goals: MonitoreoGoal[] = [],
) {
  return <AcreditacionPhoneOperationsWorkbench reports={reports} activeTab={activeTab} fallbackEffective={fallbackEffective} standalone={standalone} corte={corte} goals={goals} />;
}

function uniqueDisplayValues(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = String(value ?? "").trim();
    const key = normalizeSourceMatch(label);
    if (!label || !key || key === "sin dato" || key === "sin actor" || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function sourceProviderLabel(kind: MonitoreoSource["kind"]) {
  if (kind === "google_sheets") return "Google Sheets";
  if (kind === "surveymonkey") return "SurveyMonkey";
  if (kind === "kobo") return "KoboToolbox";
  return kind;
}

function sourceActorLabel(source: MonitoreoSource) {
  return String(
    source.dimensions?.actor
    ?? source.dimensions?.carrera
    ?? source.dimensions?.segmento
    ?? source.dimensions?.unidad
    ?? "",
  ).trim() || "Sin actor";
}

function sourceChannelLabel(source: MonitoreoSource) {
  return acreditacionSourceChannel(source) || (source.kind === "google_sheets" ? "Base" : "Sin canal");
}

function sourceExternalId(source: MonitoreoSource) {
  if (source.kind === "surveymonkey") return source.survey_id || source.id;
  if (source.kind === "kobo") return source.asset_uid || source.id;
  return [
    sourceSheetField(source, "spreadsheet_id"),
    sourceSheetField(source, "sheet_name"),
  ].filter(Boolean).join(" / ") || source.id;
}

function isPlatformResponseSource(source: MonitoreoSource) {
  return (source.kind === "surveymonkey" || source.kind === "kobo")
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id) || Boolean(source.asset_uid));
}

function isSurveyMonkeyResponseSource(source: MonitoreoSource) {
  return source.kind === "surveymonkey"
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id));
}

function isKoboResponseSource(source: MonitoreoSource) {
  return source.kind === "kobo"
    && (source.role === "respuestas" || !source.role || Boolean(source.asset_uid));
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const edge = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function sourceFlatField(source: MonitoreoSource, key: string) {
  const value = (source as unknown as Record<string, unknown>)[key];
  return String(value ?? "").trim();
}

function sourceSpreadsheetUrl(source: MonitoreoSource) {
  const raw = sourceSheetField(source, "spreadsheet_id");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const id = embeddedId || raw;
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
}

function sourceSpreadsheetDisplay(source: MonitoreoSource) {
  const raw = sourceSheetField(source, "spreadsheet_id");
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const value = embeddedId || raw;
  return value ? shortenMiddle(value.replace(/^https?:\/\//i, ""), 42) : "Abrir spreadsheet";
}

function actorInitialLabel(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalizeSourceMatch(normalized) === "sin actor") return "?";
  const words = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => word.charAt(0)).join("")
    : (words[0] ?? normalized).slice(0, 2);
  return letters.toLocaleUpperCase("es-PE");
}

function sourcesForPreset(sources: MonitoreoSource[], preset: AcreditacionSourcePreset) {
  if (preset.key === "respuestas_surveymonkey") {
    return sources.filter(isPlatformResponseSource);
  }
  return sources.filter((source) => source.kind === "google_sheets" && source.role === preset.role);
}

function presetSourceStatus(sources: MonitoreoSource[]) {
  if (!sources.length) return "Pendiente";
  if (sources.some((source) => source.enabled)) return "Lista";
  return "Inactiva";
}

function mostRecentSyncLabel(sources: MonitoreoSource[]) {
  const stamps = sources
    .map((source) => source.last_sync_at)
    .filter((value): value is string => Boolean(value));
  if (!stamps.length) return "Sin sync";
  const sorted = stamps.sort((a, b) => {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
  return formatDate(sorted[0]);
}

function sourceRowsForTable(sources: MonitoreoSource[], { phoneMode = false }: { phoneMode?: boolean } = {}) {
  return sources.map((source) => ({
    Fuente: source.label || source.id,
    Servicio: sourceProviderLabel(source.kind),
    Rol: source.role || "respuestas",
    ...(phoneMode
      ? { Segmento: sourceActorLabel(source) === "Sin actor" ? "Sin segmentar" : sourceActorLabel(source) }
      : { Actor: sourceActorLabel(source) }),
    Canal: acreditacionChannelLabel(sourceChannelLabel(source)),
    Estado: source.enabled ? "Activa" : "Inactiva",
    "Ultimo sync": sourceSyncLabel(source),
    ID: sourceExternalId(source),
  }));
}

function sourcePackageRows(sources: MonitoreoSource[]) {
  return ACREDITACION_SOURCE_PRESETS.map((preset) => {
    const presetSources = sourcesForPreset(sources, preset);
    const active = presetSources.filter((source) => source.enabled);
    return {
      Pieza: preset.label,
      Servicio: preset.service,
      Rol: preset.role,
      Configuradas: presetSources.length,
      Activas: active.length,
      Estado: presetSourceStatus(presetSources),
      "Ultimo sync": mostRecentSyncLabel(presetSources),
    };
  });
}

function cleanSourceDimensions(dimensions: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, String(value ?? "").trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}

function sourceDimensionEntries(dimensions: Record<string, string> | undefined) {
  return Object.entries(dimensions ?? {})
    .filter(([, value]) => String(value ?? "").trim())
    .slice(0, 8);
}

function dimensionLabel(key: string) {
  const labels: Record<string, string> = {
    actor: "Actor",
    carrera: "Carrera",
    canal: "Canal",
    channel: "Canal",
    segmento: "Segmento",
    servicio: "Servicio",
    territorio: "Territorio",
    sheet_name: "Pestaña",
    survey_title: "Encuesta",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

function sourcePayloadFromExisting(source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>): MonitoreoSourcePayload {
  const fallbackSheetBinding = sourceSheetField(source, "spreadsheet_id")
    ? {
      spreadsheet_id: sourceSheetField(source, "spreadsheet_id"),
      sheet_name: sourceSheetField(source, "sheet_name"),
      header_row: Number(source.sheet_binding?.header_row ?? 1),
      range: sourceSheetField(source, "range"),
    }
    : undefined;
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    enabled: source.enabled,
    role: source.role,
    integration_mode: source.integration_mode,
    sheet_binding: source.sheet_binding ?? fallbackSheetBinding,
    asset_uid: source.asset_uid,
    survey_id: source.survey_id,
    survey_title: source.survey_title,
    base_url: source.base_url,
    connection_profile_id: source.connection_profile_id,
    declared_person_code_var: source.declared_person_code_var,
    declared_person_code_label: source.declared_person_code_label,
    dimensions: source.dimensions,
    ...patch,
  };
}

function normalizeCollectorUse(value: unknown): MonitoreoCollectorUse {
  return MODEL_COLLECTOR_USE_OPTIONS.some((option) => option.value === value)
    ? value as MonitoreoCollectorUse
    : "sin_clasificar";
}

function normalizeModelModality(value: unknown): MonitoreoStrategyPhase["modality"] {
  return MODEL_MODALITY_OPTIONS.some((option) => option.value === value)
    ? value as MonitoreoStrategyPhase["modality"]
    : "mixto";
}

function collectorUseOption(value: MonitoreoCollectorUse) {
  return MODEL_COLLECTOR_USE_OPTIONS.find((option) => option.value === value)
    ?? MODEL_COLLECTOR_USE_OPTIONS[MODEL_COLLECTOR_USE_OPTIONS.length - 1];
}

function modalityForCollectorUse(value: MonitoreoCollectorUse): MonitoreoStrategyPhase["modality"] {
  return collectorUseOption(value).modality;
}

function collectorChannelForUse(value: MonitoreoCollectorUse) {
  return collectorUseOption(value).channel;
}

function channelOptionForValue(value: unknown) {
  const key = acreditacionChannelKey(String(value ?? ""));
  return ACREDITACION_CHANNEL_OPTIONS.find((option) => option.key === key)
    ?? ACREDITACION_CHANNEL_OPTIONS[0];
}

function channelVisualForValue(value: unknown, emptyLabel = "Elegir canal") {
  const raw = String(value ?? "").trim();
  const key = acreditacionChannelKey(raw);
  if (key === "desconocido") {
    return {
      key,
      label: raw || emptyLabel,
      icon: SlidersHorizontal,
    };
  }
  const option = ACREDITACION_CHANNEL_OPTIONS.find((item) => item.key === key) ?? ACREDITACION_CHANNEL_OPTIONS[0];
  return {
    key: option.key,
    label: option.label,
    icon: option.icon,
  };
}

function AcreditacionChannelSelect({
  value,
  onChange,
  disabled,
  allowEmpty = false,
  label = "Canal",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  label?: string;
}) {
  const visual = channelVisualForValue(value);
  const Icon = visual.icon;
  const selectValue = allowEmpty ? value : channelOptionForValue(value).value;
  return (
    <label className="mon-channel-select mon-channel-select-field">
      <span>{label}</span>
      <div className={`mon-channel-select-control is-${visual.key}`} data-channel={visual.key}>
        <span className="mon-channel-select-icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        <select
          value={selectValue}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          aria-label={label}
        >
          {allowEmpty ? <option value="">Elegir canal</option> : null}
          {ACREDITACION_CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function AcreditacionChannelDeclarationPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const current = channelOptionForValue(value).value;
  return (
    <div className="mon-acr-channel-declare-field">
      <span>Canal base</span>
      <div className="mon-acr-channel-choice-strip" role="radiogroup" aria-label="Canal base de la encuesta">
        {ACREDITACION_CHANNEL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              className={`is-${option.key}${active ? " is-active" : ""}`}
              aria-pressed={active}
              aria-label={option.label}
              title={option.label}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              <Icon size={13} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function acreditacionChannelModality(value: unknown): MonitoreoStrategyPhase["modality"] {
  return channelOptionForValue(value).modality;
}

function collectorTypeLabel(value: string) {
  const normalized = normalizeSourceMatch(value);
  if (normalized === "email") return "Envío por correo";
  if (normalized === "weblink" || normalized === "web_link" || normalized === "web link") return "Link abierto";
  if (normalized === "sms") return "SMS";
  return value || "Enlace";
}

function collectorDisplayName(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector) {
  const raw = String(item.collector_name || item.collector_id || "Recopilador").trim();
  if (/^collector\s+/i.test(raw)) return raw.replace(/^collector/i, "Recopilador");
  if (/^colector\s+/i.test(raw)) return raw.replace(/^colector/i, "Recopilador");
  return raw;
}

function collectorNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countFromRecord(record: Record<string, number> | undefined, keys: string[]) {
  if (!record) return 0;
  return keys.reduce((sum, key) => sum + collectorNumber(record[key]), 0);
}

function collectorConfigFromDiscovery(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector): MonitoreoLinkCollector {
  const operationalUse = normalizeCollectorUse(item.operational_use || ("suggested_use" in item ? item.suggested_use : ""));
  const channel = String(item.channel || collectorChannelForUse(operationalUse) || "Desconocido").trim() || "Desconocido";
  const modality = normalizeModelModality(item.modality || acreditacionChannelModality(channel) || modalityForCollectorUse(operationalUse));
  return {
    id: item.id || `${item.source_id}::${item.collector_id}`,
    source_id: item.source_id,
    source_label: item.source_label,
    survey_id: item.survey_id,
    collector_id: item.collector_id,
    collector_name: item.collector_name,
    collector_type: item.collector_type,
    enabled: item.enabled ?? true,
    channel,
    operational_use: operationalUse,
    modality,
    roster_required: item.roster_required ?? operationalUse === "telefono_asistido",
  };
}

function AcreditacionCollectorMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ready" | "warning" }) {
  return (
    <div className={`mon-collector-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{fmt(value)}</strong>
    </div>
  );
}

function AcreditacionChannelSelectorMatrix({
  sources,
  config,
  onConfigChange,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  onConfigChange: (config: MonitoreoConfig) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = useMemo(() => sources.filter((source) => source.kind === "surveymonkey"), [sources]);
  const activeSurveySources = useMemo(() => surveySources.filter((source) => source.enabled), [surveySources]);
  const sourceIds = useMemo(() => activeSurveySources.map((source) => source.id), [activeSurveySources]);
  const sourceSignature = useMemo(() => surveySources.map((source) => `${source.id}:${sourceChannelLabel(source)}:${source.enabled}`).join("|"), [surveySources]);
  const [sourceChannels, setSourceChannels] = useState<Record<string, string>>({});
  const [items, setItems] = useState<MonitoreoSurveyMonkeyCollector[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"sources" | "collectors" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const [loadedAt, setLoadedAt] = useState("");
  const [loadMode, setLoadMode] = useState<"local_snapshot" | "surveymonkey" | "">("");

  useEffect(() => {
    setSourceChannels(Object.fromEntries(
      surveySources.map((source) => [source.id, channelOptionForValue(sourceChannelLabel(source)).value]),
    ));
  }, [sourceSignature, surveySources]);

  const configuredMap = useMemo(() => {
    const out = new Map<string, MonitoreoLinkCollector>();
    for (const item of config.operational_model.link_collectors) {
      out.set(`${item.source_id}::${item.collector_id}`, item);
    }
    return out;
  }, [config.operational_model.link_collectors]);
  const sourceChannelById = useMemo(() => new Map(
    surveySources.map((source) => [
      source.id,
      sourceChannels[source.id] || channelOptionForValue(sourceChannelLabel(source)).value,
    ]),
  ), [sourceChannels, surveySources]);

  const mergedItems = useMemo(() => items.map((item) => {
    const saved = configuredMap.get(`${item.source_id}::${item.collector_id}`);
    const operationalUse = normalizeCollectorUse(saved?.operational_use ?? item.operational_use ?? item.configured_use ?? item.suggested_use);
    const sourceChannel = sourceChannelById.get(item.source_id);
    const channel = String(saved?.channel || item.channel || sourceChannel || collectorChannelForUse(operationalUse)).trim() || "Desconocido";
    return {
      ...item,
      ...saved,
      channel,
      operational_use: operationalUse,
      configured_use: operationalUse,
      modality: normalizeModelModality(saved?.modality ?? item.modality ?? acreditacionChannelModality(channel)),
      roster_required: saved?.roster_required ?? item.roster_required ?? operationalUse === "telefono_asistido",
    };
  }), [configuredMap, items, sourceChannelById]);

  const summary = useMemo(() => {
    const recipients = mergedItems.reduce((sum, item) => sum + collectorNumber(item.recipient_summary?.total), 0);
    const links = mergedItems.reduce((sum, item) => sum + collectorNumber(item.recipient_summary?.personalized_link_count), 0);
    const active = mergedItems.reduce((sum, item) => sum + collectorNumber(item.active_response_count || item.response_count), 0);
    const unclassified = mergedItems.filter((item) => normalizeCollectorUse(item.operational_use) === "sin_clasificar").length;
    const channels = new Set([
      ...surveySources.map((source) => acreditacionChannelKey(sourceChannels[source.id] || sourceChannelLabel(source))),
      ...mergedItems.map((item) => acreditacionChannelKey(item.channel || "")),
    ]);
    return { recipients, links, active, unclassified, channels: channels.size };
  }, [mergedItems, sourceChannels, surveySources]);

  const dirtySourceCount = useMemo(() => surveySources.filter((source) => (
    (sourceChannels[source.id] || "") !== channelOptionForValue(sourceChannelLabel(source)).value
  )).length, [sourceChannels, surveySources]);

  async function loadCollectors(remote = false) {
    if (!sourceIds.length) {
      setItems([]);
      setLoadMode("");
      setLoadedAt("");
      return;
    }
    setLoading(true);
    setStatus({ tone: "info", message: remote ? "Leyendo recopiladores desde SurveyMonkey..." : "Leyendo recopiladores desde snapshot local..." });
    try {
      const result = await apiMonitoreoSurveyMonkeyCollectors(sourceIds, {
        remote,
        includeRecipients: remote,
        includeDetails: remote,
      });
      setItems(result.collectors);
      setLoadedAt(result.generated_at);
      setLoadMode(result.mode);
      setStatus({ tone: "success", message: `${fmt(result.collectors.length)} recopiladores disponibles para clasificar.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollectors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIds.join("|")]);

  function updateCollector(item: MonitoreoSurveyMonkeyCollector, patch: Partial<MonitoreoLinkCollector>) {
    const key = `${item.source_id}::${item.collector_id}`;
    const current = configuredMap.get(key) ?? collectorConfigFromDiscovery(item);
    const operationalUse = normalizeCollectorUse(patch.operational_use ?? current.operational_use);
    const nextChannel = String(patch.channel ?? current.channel ?? item.channel ?? collectorChannelForUse(operationalUse)).trim() || "Desconocido";
    const nextModality = patch.modality
      ?? (patch.operational_use ? modalityForCollectorUse(operationalUse) : patch.channel ? acreditacionChannelModality(nextChannel) : current.modality);
    const nextItem: MonitoreoLinkCollector = {
      ...current,
      ...patch,
      channel: nextChannel,
      operational_use: operationalUse,
      modality: normalizeModelModality(nextModality),
      roster_required: patch.roster_required ?? (patch.operational_use ? operationalUse === "telefono_asistido" : current.roster_required),
    };
    const others = config.operational_model.link_collectors.filter((collector) => `${collector.source_id}::${collector.collector_id}` !== key);
    onConfigChange({
      ...config,
      operational_model: {
        ...config.operational_model,
        link_collectors: [...others, nextItem],
      },
    });
  }

  function applySuggestions() {
    const next = mergedItems.map((item) => {
      const suggested = normalizeCollectorUse(item.suggested_use);
      const channel = item.channel || collectorChannelForUse(suggested);
      return collectorConfigFromDiscovery({
        ...item,
        operational_use: suggested,
        channel,
        modality: acreditacionChannelModality(channel),
        roster_required: suggested === "telefono_asistido",
      });
    });
    onConfigChange({
      ...config,
      operational_model: {
        ...config.operational_model,
        link_collectors: next,
      },
    });
    setStatus({ tone: "info", message: "Sugerencias aplicadas al borrador. Revisa y guarda para persistir." });
  }

  async function saveCollectors() {
    setSaving("collectors");
    setStatus({ tone: "info", message: "Guardando clasificación de recopiladores..." });
    try {
      const payload = mergedItems.length
        ? mergedItems.map(collectorConfigFromDiscovery)
        : config.operational_model.link_collectors;
      const result = await apiMonitoreoCollectorsConfig(payload);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Recopiladores guardados en el modelo operativo." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(null);
    }
  }

  async function saveSourceChannels() {
    const changed = surveySources.filter((source) => (
      (sourceChannels[source.id] || "") !== channelOptionForValue(sourceChannelLabel(source)).value
    ));
    if (!changed.length) return;
    setSaving("sources");
    setStatus({ tone: "info", message: `Guardando canal en ${fmt(changed.length)} encuesta${changed.length === 1 ? "" : "s"}...` });
    try {
      let nextState: MonitoreoState | null = null;
      for (const source of changed) {
        const channel = sourceChannels[source.id] || "Desconocido";
        const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
          dimensions: cleanSourceDimensions({
            ...source.dimensions,
            canal: channel,
          }),
        }));
        nextState = result.state;
      }
      if (nextState) onStateChange?.(nextState);
      setStatus({ tone: "success", message: "Canales de encuesta guardados." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-channel-selector-matrix" aria-label="Selector de canal por encuesta y recopilador">
      <div className="mon-contract-block-head">
        <span>Canales, enlaces y recopiladores</span>
        <div className="mon-collector-actions">
          <button type="button" onClick={() => { void loadCollectors(false); }} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Snapshot
          </button>
          <button type="button" onClick={() => { void loadCollectors(true); }} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <PlugZap size={13} />}
            SurveyMonkey
          </button>
          <button type="button" onClick={applySuggestions} disabled={!mergedItems.length}>
            <CheckCircle2 size={13} />
            Sugerir usos
          </button>
          <button type="button" onClick={() => { void saveSourceChannels(); }} disabled={saving != null || !dirtySourceCount}>
            {saving === "sources" ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
            Guardar canales
          </button>
          <button type="button" className="pulso-primary" onClick={() => { void saveCollectors(); }} disabled={saving != null || loading}>
            {saving === "collectors" ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
            Guardar recopiladores
          </button>
        </div>
      </div>

      <div className="mon-collector-summary" aria-label="Resumen de canales y recopiladores">
        <span>{fmt(surveySources.length)} encuestas SM</span>
        <span>{fmt(mergedItems.length)} recopiladores</span>
        <span>{fmt(summary.channels)} canales</span>
        <span>{fmt(summary.active)} respuestas</span>
        <span>{fmt(summary.recipients)} destinatarios</span>
        <span>{fmt(summary.links)} links usados</span>
        {summary.unclassified ? <span>{fmt(summary.unclassified)} sin clasificar</span> : null}
        {dirtySourceCount ? <span>{fmt(dirtySourceCount)} canales sin guardar</span> : null}
        {loadMode ? <span>{loadMode === "surveymonkey" ? "API SurveyMonkey" : "Snapshot local"}</span> : null}
        {loadedAt ? <span>{formatDate(loadedAt)}</span> : null}
      </div>

      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}

      <div className="mon-channel-matrix-layout">
        <div className="mon-survey-channel-panel" aria-label="Canal por encuesta">
          <header>
            <div>
              <span>Encuestas conectadas</span>
              <strong>Canal operativo por fuente</strong>
            </div>
            <em>{fmt(activeSurveySources.length)} activas</em>
          </header>
          <div className="mon-survey-channel-list">
            {surveySources.map((source) => {
              const selected = sourceChannels[source.id] || channelOptionForValue(sourceChannelLabel(source)).value;
              return (
                <article key={source.id} className={`mon-survey-channel-row${source.enabled ? "" : " is-disabled"}`}>
                  <div className="mon-survey-channel-main">
                    <AcreditacionChannelBadge channel={selected} />
                    <div>
                      <strong>{source.survey_title || source.label || source.id}</strong>
                      <em>{sourceActorLabel(source)} · {sourceExternalId(source)}</em>
                    </div>
                  </div>
                  <AcreditacionChannelSelect
                    value={selected}
                    onChange={(channel) => setSourceChannels((current) => ({ ...current, [source.id]: channel }))}
                    disabled={saving != null}
                  />
                </article>
              );
            })}
            {!surveySources.length ? (
              <div className="mon-sm-empty">Conecta una fuente SurveyMonkey para clasificar canales y recopiladores.</div>
            ) : null}
          </div>
        </div>

        <div className="mon-collector-body mon-collector-body--matrix" aria-label="Canal por recopilador">
          {loading ? (
            <div className="mon-collector-loading">
              <Loader2 size={16} className="pulso-spin" />
              <span>Leyendo recopiladores locales...</span>
            </div>
          ) : null}
          {!loading && sourceIds.length > 0 && !mergedItems.length ? (
            <div className="mon-sm-empty">Sin recopiladores detectados. Revisa el snapshot local o lee SurveyMonkey de forma explícita.</div>
          ) : null}
          {!sourceIds.length ? (
            <div className="mon-sm-empty">No hay encuestas SurveyMonkey activas para descubrir recopiladores.</div>
          ) : null}
          <div className="mon-collector-list">
            {mergedItems.map((item) => {
              const operationalUse = normalizeCollectorUse(item.operational_use);
              const useOption = collectorUseOption(operationalUse);
              const UseIcon = useOption.icon;
              const channel = item.channel || collectorChannelForUse(operationalUse);
              const completeCount = countFromRecord(item.recipient_summary?.response_status_counts, ["completely_responded", "completed", "complete"]);
              return (
                <article key={`${item.source_id}-${item.collector_id}`} className={`mon-collector-card mon-collector-card--channel is-${item.modality}`}>
                  <div className="mon-collector-title">
                    <span className="mon-collector-use-icon"><UseIcon size={14} /></span>
                    <div>
                      <strong>{collectorDisplayName(item)}</strong>
                      <em>{item.source_label || item.source_id}</em>
                    </div>
                    <span className="mon-collector-chip">{collectorTypeLabel(item.collector_type)}</span>
                  </div>

                  <div className="mon-collector-metrics">
                    <AcreditacionCollectorMetric label="Respuestas" value={collectorNumber(item.active_response_count || item.response_count)} tone={collectorNumber(item.active_response_count || item.response_count) ? "ready" : "neutral"} />
                    <AcreditacionCollectorMetric label="Dest. obs." value={collectorNumber(item.recipient_summary?.total)} />
                    <AcreditacionCollectorMetric label="Links usados" value={collectorNumber(item.recipient_summary?.personalized_link_count)} />
                    <AcreditacionCollectorMetric label="Efectivas" value={completeCount} tone={completeCount ? "ready" : "neutral"} />
                  </div>

                  <div className="mon-collector-controls mon-collector-controls--channel">
                    <label>
                      <span>Uso</span>
                      <select
                        value={operationalUse}
                        onChange={(event) => updateCollector(item, { operational_use: event.currentTarget.value as MonitoreoCollectorUse })}
                      >
                        {MODEL_COLLECTOR_USE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <AcreditacionChannelSelect
                      value={channelOptionForValue(channel).value}
                      onChange={(channelValue) => updateCollector(item, { channel: channelValue })}
                    />
                    <label>
                      <span>Modalidad</span>
                      <select
                        value={normalizeModelModality(item.modality)}
                        onChange={(event) => updateCollector(item, { modality: event.currentTarget.value as MonitoreoStrategyPhase["modality"] })}
                      >
                        {MODEL_MODALITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mon-switch-line mon-collector-roster">
                      <input
                        type="checkbox"
                        checked={Boolean(item.roster_required)}
                        onChange={(event) => updateCollector(item, { roster_required: event.currentTarget.checked })}
                      />
                      <span>Barrido</span>
                    </label>
                  </div>

                  <div className="mon-collector-channel-line">
                    <AcreditacionChannelBadge channel={channel} />
                    <span>{collectorDisplayName(item)} · {item.collector_id}</span>
                  </div>

                  {(item.warnings?.length || item.recipient_summary?.truncated) ? (
                    <div className="mon-collector-warnings">
                      {item.recipient_summary?.truncated ? <span>Conteo de destinatarios muestreado</span> : null}
                      {item.warnings?.map((warning) => <span key={warning}>{warning}</span>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function inferAcreditacionSurveyChannel(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const institutionalActor = text.includes("docent") || text.includes("administr");
  if (text.includes("correo") || text.includes("email") || text.includes("mail")) return "Correo";
  if (text.includes("telefon")) return "Telefónico";
  if (text.includes("presencial") || text.includes("qr")) return "Presencial (Ficha QR)";
  if (institutionalActor && !text.includes("whatsapp") && !text.includes("sms")) return "Correo";
  if (text.includes("whatsapp") || text.includes("sms") || text.includes("web") || text.includes("link") || text.includes("enlace")) return "Enlace personalizado (Whatsapp)";
  if (text.includes("egresad")) return "Telefónico";
  return "Correo";
}

function inferAcreditacionSurveyActor(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const actor = ACREDITACION_DEFAULT_ACTORS.find((option) => (
    text.includes(normalizeSourceMatch(option))
  ));
  return actor ?? "Sin actor";
}

function surveyMonkeyDisplayTitle(survey: SurveyMonkeyMultibaseListItem) {
  return survey.nickname || survey.title || survey.id;
}

function AcreditacionSourceStatusStrip({
  sources,
  reports,
  phoneMode = false,
  status,
  busy,
  progress = null,
  papelAlConectar = "universo",
  actoresSugeridos = [],
  onStateChange,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sources: MonitoreoSource[];
  reports: MonitoreoAcreditacionReports;
  phoneMode?: boolean;
  status?: AcreditacionActionStatus;
  busy: boolean;
  progress?: SourceSyncActionsProgress | null;
  papelAlConectar?: "universo" | "barrido" | "respuestas";
  actoresSugeridos?: string[];
  onStateChange?: (state: MonitoreoState) => void;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  const activeSources = sources.filter((source) => source.enabled);
  const phoneContract = phoneMode ? buildAcreditacionPhoneSourceContract(sources) : null;
  const phoneReadyCount = phoneContract ? phoneContractReadyCount(phoneContract) : 0;
  const packageActiveCount = phoneContract ? phoneReadyCount : activeSources.length;
  const packageTotalCount = piezasRequeridas(Boolean(phoneContract), sources.length);
  const sheetCount = activeSources.filter((source) => source.kind === "google_sheets").length;
  const surveyCount = phoneContract ? phoneContract.platform.sources.filter((source) => source.enabled).length : activeSources.filter(isPlatformResponseSource).length;
  const baseCount = phoneContract ? (phoneContract.universe.ready ? 1 : 0) : sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[0]).length;
  const sweepCount = phoneContract ? (phoneContract.sweep.ready ? 1 : 0) : sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[1]).length;
  // La lectura más reciente de las fuentes que están activas: es la que explica
  // de cuándo son las cifras del corte.
  const lastSyncLabel = activeSources
    .map((source) => sourceSyncLabel(source))
    .filter((label) => label && label !== "Sin sync")[0] ?? "";
  const statusMetrics = [
    {
      className: packageActiveCount >= packageTotalCount && packageTotalCount ? "is-ready" : "is-warning",
      icon: PlugZap,
      label: "Fuentes",
      value: `${fmt(packageActiveCount)}/${fmt(packageTotalCount)}`,
      detail: "paquete activo",
    },
    {
      className: baseCount ? "is-ready" : "is-warning",
      icon: Layers3,
      label: "Base",
      value: fmt(baseCount),
      detail: "fuentes base",
    },
    {
      className: surveyCount ? "is-ready" : "is-warning",
      icon: ListChecks,
      label: "Plataforma",
      value: fmt(surveyCount),
      detail: `${fmt(sweepCount)} barrido`,
    },
  ];
  return (
    <section className={`mon-acr-source-status-strip${phoneContract ? " is-phone" : ""}`} aria-label="Estado de fuentes de acreditación">
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      <header>
        <span>Fuentes</span>
        <strong>{phoneContract ? "Paquete telefónico" : "Paquete de acreditación"}</strong>
        <p>{fmt(packageTotalCount)} operativas · {fmt(packageActiveCount)} listas · corte {formatDate(reports.generated_at)}</p>
      </header>
      {/* En telefónico esta franja no lleva métricas.
        *
        * Decía `Fuentes 3/3 · Base 1 · Kobo 1` justo debajo de la franja de
        * lectura, que dice `Fuentes 3/3 · Base 2.726 · Corte Listo`: «Fuentes»
        * repetido con el mismo valor, y «Base» con dos significados —una hoja
        * contra 2.726 registros— a 20 px de distancia. Cada franja se queda con
        * un papel: arriba se lee el corte, aquí se actúa sobre las fuentes.
        *
        * Lo que ocupa su lugar es la fecha de la última lectura, que estaba
        * repetida en tres sitios de la misma pantalla y en ninguno junto al
        * botón que la cambia. */}
      {phoneContract ? (
        <p className="mon-acr-source-status-sync">
          <em>Última lectura</em>
          <strong>{lastSyncLabel || "Sin sincronizar"}</strong>
        </p>
      ) : (
        <div className="mon-acr-source-status-metrics">
          {statusMetrics.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.label} className={item.className}>
                <Icon size={14} />
                <em>{item.label}</em>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </span>
            );
          })}
        </div>
      )}
      <div className="mon-acr-source-status-tools">
        <AcreditacionSourceSyncActions
          sheetCount={sheetCount}
          surveyCount={surveyCount}
          totalCount={activeSources.length}
          busy={busy}
          progress={progress}
          surveyLabel={phoneContract ? "Kobo" : "encuestas"}
          surveyTitle={phoneContract ? "fuentes Kobo activas" : "encuestas de plataforma activas"}
          onSyncSheets={onSyncSheets}
          onSyncSurvey={onSyncSurvey}
          onSyncAll={onSyncAll}
        />
        {/* La puerta única de §4.3, que hasta ahora sólo montaba Acreditación.
          * En telefónico agregar una fuente era pulsar «Nueva» dentro del editor
          * de otra fuente y pegar un identificador a mano en un campo rotulado
          * «Enlace del Google Sheet». */}
        {phoneContract ? (
          <PanelConectarFuente
            sources={sources}
            familia="telefonico"
            actoresSugeridos={actoresSugeridos}
            papelInicial={papelAlConectar}
            onStateChange={onStateChange}
          />
        ) : null}
      </div>
    </section>
  );
}

function AcreditacionSourceBlueprint({
  sources,
  activePresetKey,
  onSelectPreset,
}: {
  sources: MonitoreoSource[];
  activePresetKey: AcreditacionSourcePresetKey;
  onSelectPreset: (key: AcreditacionSourcePresetKey) => void;
}) {
  return (
    <div className="mon-acr-fixed-source-head">
      <div className="mon-acr-fixed-source-title">
        <span><PlugZap size={13} /> Configuración fija</span>
        <strong>Arquitectura de fuentes de acreditación</strong>
        <em>Sheets define universo y barrido; Kobo/SurveyMonkey aportan respuestas exactas por actor y canal.</em>
      </div>
      <div className="mon-acr-fixed-source-summary" aria-label="Resumen de paquete">
        {ACREDITACION_SOURCE_PRESETS.map((preset) => {
          const presetSources = sourcesForPreset(sources, preset);
          const ready = presetSources.some((source) => source.enabled);
          return (
            <span key={preset.key} className={ready ? "is-ready" : "is-warning"}>
              {ready ? `${preset.label} lista` : `Falta ${preset.label.toLowerCase()}`}
            </span>
          );
        })}
      </div>
      <div className="mon-acr-source-blueprint" aria-label="Flujo de fuentes de acreditación">
        {ACREDITACION_SOURCE_PRESETS.map((preset, index) => {
          const Icon = preset.icon;
          const presetSources = sourcesForPreset(sources, preset);
          const ready = presetSources.some((source) => source.enabled);
          return (
            <button
              key={preset.key}
              type="button"
              className={`mon-acr-source-blueprint-step${ready ? " is-ready" : ""}${activePresetKey === preset.key ? " is-active" : ""}`}
              onClick={() => onSelectPreset(preset.key)}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              <Icon size={15} />
              <strong>{preset.label}</strong>
              <em>{presetSources.length ? `${fmt(presetSources.length)} fuente${presetSources.length === 1 ? "" : "s"}` : "pendiente"}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AcreditacionSourceRequirementCard({
  preset,
  sources,
  active,
  onSelect,
}: {
  preset: AcreditacionSourcePreset;
  sources: MonitoreoSource[];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = preset.icon;
  const ready = sources.some((source) => source.enabled);
  const sheetLabels = uniqueDisplayValues(sources.map((source) => (
    source.sheet_binding?.sheet_name
    ?? sourceActorLabel(source)
    ?? source.label
  )));
  const actorLabels = uniqueDisplayValues(sources.map(sourceActorLabel));
  const spreadsheetLinks = sources
    .map((source) => ({ href: sourceSpreadsheetUrl(source), label: sourceSpreadsheetDisplay(source) }))
    .filter((link) => link.href)
    .filter((link, index, list) => list.findIndex((item) => item.href === link.href) === index)
    .slice(0, 3);
  const visibleSheets = sheetLabels.slice(0, 5);
  const visibleActors = actorLabels.slice(0, 4);
  const visibleTags = uniqueDisplayValues([...visibleSheets, ...visibleActors]).slice(0, 8);
  const hiddenTagCount = Math.max(0, sheetLabels.length + actorLabels.length - visibleTags.length);
  const lastSync = mostRecentSyncLabel(sources);
  return (
    <article className={`mon-acr-requirement-card${active ? " is-active" : ""}${ready ? " is-ready" : ""}`}>
      <div className="mon-acr-requirement-main">
        <span className="mon-acr-requirement-icon"><Icon size={15} /></span>
        <span className="mon-acr-requirement-copy">
          <strong>{preset.label}</strong>
          <em>{sources.length ? `${fmt(sources.length)} fuente${sources.length === 1 ? "" : "s"}` : "Pendiente"}</em>
        </span>
        <span className="mon-acr-requirement-status">{ready ? "Lista" : "Falta"}</span>
        <button type="button" className="mon-acr-requirement-adjust" onClick={onSelect}>
          Ajustar
        </button>
      </div>
      <p className="mon-acr-requirement-detail">
        {sources.length ? preset.detail : preset.key === "base_trabajada" ? "Lee las pestañas del universo." : preset.key === "barrido_telefonico" ? "Selecciona la pestaña de barrido." : "Asigna encuestas por actor y canal."}
      </p>
      <div className="mon-acr-requirement-data">
        <div className="mon-acr-requirement-field">
          <span>{preset.provider === "google_sheets" ? "Spreadsheet" : "Encuesta"}</span>
          <div className="mon-acr-requirement-links">
            {spreadsheetLinks.length ? spreadsheetLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" title={link.href}>
                <Link2 size={12} />
                <span>{link.label}</span>
              </a>
            )) : (
              <em>{preset.provider === "google_sheets" ? "Enlace pendiente" : "Survey ID pendiente"}</em>
            )}
          </div>
        </div>
        <div className="mon-acr-requirement-field">
          <span>{preset.key === "base_trabajada" ? "Pestañas / actores" : preset.key === "barrido_telefonico" ? "Pestaña de barrido" : "Actores / canales"}</span>
          <div className="mon-acr-requirement-sheets">
            {visibleTags.map((label) => <i key={label}>{label}</i>)}
            {hiddenTagCount > 0 ? <i>+{fmt(hiddenTagCount)}</i> : null}
            {!sheetLabels.length && !actorLabels.length ? <i>Pendiente</i> : null}
          </div>
        </div>
      </div>
      {sources.length ? (
        <div className={`mon-acr-requirement-ops is-${preset.key === "barrido_telefonico" ? "phone" : "universe"}`}>
          <div className="mon-acr-requirement-ops-copy">
            <span>{preset.service}</span>
            <p>{preset.detail}</p>
          </div>
          <div className="mon-acr-requirement-metrics">
            <span className="mon-acr-requirement-metric">
              <em>Activas</em>
              <strong>{fmt(sources.filter((source) => source.enabled).length)}</strong>
              <span>sincronizables</span>
            </span>
            <span className="mon-acr-requirement-metric">
              <em>Cortes</em>
              <strong>{fmt(Math.max(sheetLabels.length, actorLabels.length, sources.length))}</strong>
              <span>segmentos</span>
            </span>
            <span className="mon-acr-requirement-metric">
              <em>Último sync</em>
              <strong>{lastSync === "Sin sync" ? "Sin sync" : "Listo"}</strong>
              <span>{lastSync}</span>
            </span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AcreditacionSheetSourceEditor({
  preset,
  sources,
  onStateChange,
}: {
  preset: AcreditacionSourcePreset;
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const firstSource = sources[0] ?? null;
  const [editingSourceId, setEditingSourceId] = useState(firstSource?.id ?? "");
  const [spreadsheetId, setSpreadsheetId] = useState(firstSource?.sheet_binding?.spreadsheet_id ?? "");
  const [sheetName, setSheetName] = useState(firstSource?.sheet_binding?.sheet_name ?? "");
  const [sourceLabel, setSourceLabel] = useState(firstSource?.label || preset.sourceLabel);
  const [range, setRange] = useState(firstSource?.sheet_binding?.range ?? "");
  const [inspection, setInspection] = useState<MonitoreoSheetsInspectResult | null>(null);
  const [busy, setBusy] = useState<"inspect" | "save" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  // Se arma con lo que hay escrito, no con lo guardado: sirve para comprobar
  // que lo que se acaba de pegar apunta al documento correcto antes de guardar.
  const lecturaDelSpreadsheet = leerDireccionDeSheets(spreadsheetId);
  const enlaceDelSpreadsheet = lecturaDelSpreadsheet.ok && lecturaDelSpreadsheet.servicio === "google_sheets"
    ? `https://docs.google.com/spreadsheets/d/${lecturaDelSpreadsheet.spreadsheetId}`
    : "";

  useEffect(() => {
    const next = sources[0] ?? null;
    setEditingSourceId(next?.id ?? "");
    setSpreadsheetId(next?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(next?.sheet_binding?.sheet_name ?? "");
    setSourceLabel(next?.label || preset.sourceLabel);
    setRange(next?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  }, [preset.key]);

  const selectSource = (sourceId: string) => {
    const selected = sources.find((source) => source.id === sourceId) ?? null;
    setEditingSourceId(sourceId);
    setSpreadsheetId(selected?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(selected?.sheet_binding?.sheet_name ?? "");
    setSourceLabel(selected?.label || preset.sourceLabel);
    setRange(selected?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  };

  const inspectSheets = async () => {
    if (!spreadsheetId.trim()) {
      setStatus({ tone: "error", message: "Pega el Spreadsheet ID o URL antes de leer pestañas." });
      return;
    }
    setBusy("inspect");
    setStatus({ tone: "info", message: "Leyendo pestañas desde Google Sheets..." });
    try {
      const result = await apiMonitoreoSheetsInspect({
        spreadsheet_id: spreadsheetId.trim(),
        sheet_name: sheetName.trim(),
        header_row: 1,
        range: range.trim(),
      });
      setInspection(result);
      setStatus({ tone: "success", message: `${fmt(result.sheets.length)} pestañas detectadas en ${result.title || "Spreadsheet"}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const saveSheet = async () => {
    if (!spreadsheetId.trim() || !sheetName.trim()) {
      setStatus({ tone: "error", message: "Spreadsheet y pestaña son obligatorios." });
      return;
    }
    setBusy("save");
    setStatus({ tone: "info", message: editingSourceId ? "Guardando ajuste de fuente..." : "Registrando fuente Sheets..." });
    try {
      const result = await apiMonitoreoSheetsSource({
        id: editingSourceId || undefined,
        kind: "google_sheets",
        label: sourceLabel.trim() || preset.sourceLabel,
        enabled: true,
        role: preset.role,
        integration_mode: "connected_read",
        sheet_binding: {
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          header_row: 1,
          range: range.trim(),
        },
        dimensions: cleanSourceDimensions({
          actor: preset.key === "barrido_telefonico" ? "Egresados" : sheetName.trim(),
          carrera: preset.key === "base_trabajada" ? sheetName.trim() : "",
          canal: preset.key === "barrido_telefonico" ? "Telefónico" : "Base",
          servicio: preset.label,
          sheet_name: sheetName.trim(),
        }),
      });
      onStateChange?.(result.state);
      setEditingSourceId(result.source.id);
      setStatus({ tone: "success", message: `${result.source.label || preset.label} quedó registrada en el paquete.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mon-acr-source-editor mon-acr-sheet-adjustment" aria-label={`Editor de ${preset.label}`}>
      <div className="mon-acr-sheet-adjustment-head">
        <div>
          <span>{editingSourceId ? "Editando fuente" : "Nueva fuente"}</span>
          <strong>{preset.label}</strong>
        </div>
        <button type="button" className="mon-acr-sheet-adjustment-close" onClick={() => selectSource("")}>
          Nueva
        </button>
      </div>
      {sources.length > 0 ? (
        <label className="mon-acr-sheet-source-select">
          <span>Fuente</span>
          <select value={editingSourceId} onChange={(event) => selectSource(event.currentTarget.value)} disabled={Boolean(busy)}>
            <option value="">{preset.key === "base_trabajada" ? "Nueva pestaña" : "Nuevo barrido"}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label || source.sheet_binding?.sheet_name || source.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mon-acr-sheet-form">
        <label>
          {/* El rótulo decía «Enlace del Google Sheet» sobre un campo que
            * muestra el identificador guardado —`1V9Tjh-suREXNEyZ8Za…`—, que no
            * es un enlace ni lleva a ninguna parte. El campo admite las dos
            * formas, así que se rotula por lo que es y el enlace de verdad va
            * al lado, construido a partir de lo que haya escrito (R2). */}
          <span>
            Dirección del Google Sheet
            {enlaceDelSpreadsheet ? (
              <a href={enlaceDelSpreadsheet} target="_blank" rel="noreferrer">Abrir</a>
            ) : null}
          </span>
          <input
            value={spreadsheetId}
            onChange={(event) => setSpreadsheetId(event.currentTarget.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>{preset.sheetLabel ?? "Pestaña"}</span>
          <input
            value={sheetName}
            onChange={(event) => setSheetName(event.currentTarget.value)}
            placeholder={preset.key === "barrido_telefonico" ? "Barrido" : "Administrativos"}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Nombre para reconocerla</span>
          <input
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.currentTarget.value)}
            placeholder={preset.sourceLabel}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Rango de celdas</span>
          <input
            value={range}
            onChange={(event) => setRange(event.currentTarget.value)}
            placeholder="Opcional"
            disabled={Boolean(busy)}
          />
        </label>
        <div className="mon-acr-sheet-actions">
          <button type="button" onClick={() => { void inspectSheets(); }} disabled={Boolean(busy) || !spreadsheetId.trim()}>
            {busy === "inspect" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
            Leer pestañas
          </button>
          <button type="button" onClick={() => { void saveSheet(); }} disabled={Boolean(busy) || !spreadsheetId.trim() || !sheetName.trim()}>
            {busy === "save" ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
            {editingSourceId ? "Guardar ajuste" : "Registrar base"}
          </button>
        </div>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {inspection ? (
        <div className="mon-acr-sheet-inspection">
          <div className="mon-acr-sheet-inspection-head">
            <strong>{inspection.title || inspection.spreadsheet_id}</strong>
            <span>{fmt(inspection.sheets.length)} pestañas · {fmt(inspection.headers.length)} encabezados</span>
          </div>
          <div className="mon-acr-sheet-tabs">
            {inspection.sheets.slice(0, 14).map((sheet) => (
              <button key={sheet.title} type="button" onClick={() => setSheetName(sheet.title)}>
                {sheet.title}
              </button>
            ))}
          </div>
          {inspection.headers.length ? (
            <div className="mon-source-dim-badges">
              {inspection.headers.slice(0, 12).map((header) => <span key={header}>{header}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AcreditacionSurveySourcePicker({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const configuredSurveyIds = useMemo(() => new Set(
    sources.map((source) => source.survey_id).filter((value): value is string => Boolean(value)),
  ), [sources]);
  const [query, setQuery] = useState("");
  const [months, setMonths] = useState(6);
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<SurveyMonkeyMultibaseListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [inspections, setInspections] = useState<Record<string, { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null }>>({});
  const [meta, setMeta] = useState<{ totalRecent: number; months: number; fromCache: boolean } | null>(null);
  const [busy, setBusy] = useState<"search" | "refresh" | "bulk" | string | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  const visibleSurveys = useMemo(() => {
    const needle = normalizeSourceMatch(filter);
    const filtered = needle
      ? results.filter((survey) => normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""} ${survey.id} ${actors[survey.id] ?? ""} ${channels[survey.id] ?? ""}`).includes(needle))
      : results;
    return filtered.sort((a, b) => {
      const aSelected = a.id === selectedId;
      const bSelected = b.id === selectedId;
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const aAdded = configuredSurveyIds.has(a.id);
      const bAdded = configuredSurveyIds.has(b.id);
      if (aAdded !== bAdded) return aAdded ? 1 : -1;
      return surveyMonkeyDisplayTitle(a).localeCompare(surveyMonkeyDisplayTitle(b), "es");
    });
  }, [actors, channels, configuredSurveyIds, filter, results, selectedId]);
  const selectedSurvey = results.find((survey) => survey.id === selectedId) ?? visibleSurveys[0] ?? null;
  const bulkCandidates = results.filter((survey) => !configuredSurveyIds.has(survey.id)).slice(0, 12);

  const hydrateSurveyDefaults = (surveys: SurveyMonkeyMultibaseListItem[]) => {
    setLabels((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = surveyMonkeyDisplayTitle(survey);
      });
      return next;
    });
    setActors((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = "";
      });
      return next;
    });
    setChannels((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = "";
      });
      return next;
    });
  };

  const searchSurveys = async (forceRefresh = false) => {
    setBusy(forceRefresh ? "refresh" : "search");
    setStatus({ tone: "info", message: forceRefresh ? "Actualizando catálogo SurveyMonkey..." : "Buscando encuestas SurveyMonkey..." });
    try {
      const result = await apiSurveyMonkeyMultibaseListSurveys(query, 100, months, { forceRefresh });
      hydrateSurveyDefaults(result.surveys);
      setResults(result.surveys);
      setSelectedId((current) => current || result.surveys[0]?.id || "");
      setMeta({ totalRecent: result.total_recent, months: result.months, fromCache: result.from_cache });
      setStatus({ tone: "success", message: `${fmt(result.surveys.length)} encuestas visibles para el filtro.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const inspectSurvey = async (survey: SurveyMonkeyMultibaseListItem) => {
    setInspections((prev) => ({
      ...prev,
      [survey.id]: { loading: true, error: "", data: prev[survey.id]?.data ?? null },
    }));
    try {
      const data = await apiSurveyMonkeyMultibaseInspectSurvey(survey.id, 5, "https://api.surveymonkey.com/v3");
      setInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: "", data },
      }));
    } catch (error) {
      setInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: (error as Error).message, data: prev[survey.id]?.data ?? null },
      }));
    }
  };

  const payloadForSurvey = (survey: SurveyMonkeyMultibaseListItem): MonitoreoSourcePayload => {
    const actor = actors[survey.id] || "";
    const channel = channels[survey.id] || "";
    const label = labels[survey.id] || surveyMonkeyDisplayTitle(survey) || survey.title;
    return {
      kind: "surveymonkey",
      label,
      survey_id: survey.id,
      survey_title: survey.title,
      base_url: "https://api.surveymonkey.com/v3",
      role: "respuestas",
      integration_mode: "connected_read",
      dimensions: cleanSourceDimensions({
        actor,
        segmento: actor,
        carrera: actor,
        canal: channel,
        servicio: "Respuestas SurveyMonkey",
        survey_title: survey.title,
      }),
    };
  };

  const addSurvey = async (survey: SurveyMonkeyMultibaseListItem) => {
    if (configuredSurveyIds.has(survey.id)) return;
    setBusy(survey.id);
    setStatus({ tone: "info", message: `Agregando ${surveyMonkeyDisplayTitle(survey)}...` });
    try {
      const result = await apiMonitoreoSource(payloadForSurvey(survey));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || survey.title} quedó agregada al paquete.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const addDetectedSurveys = async () => {
    if (!bulkCandidates.length) return;
    setBusy("bulk");
    setStatus({ tone: "info", message: `Agregando ${fmt(bulkCandidates.length)} encuestas detectadas...` });
    try {
      const result = await apiMonitoreoSources(bulkCandidates.map(payloadForSurvey));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${fmt(result.sources.length)} fuentes SurveyMonkey quedaron registradas.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`mon-acr-source-editor mon-acr-survey-add${results.length ? " has-results" : " is-compact"}`} aria-label="Picker de respuestas SurveyMonkey">
      <div className="mon-acr-survey-add-head">
        <label>
          <span>Buscar encuesta SurveyMonkey</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Egresados, Estudiantes, Docentes..."
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Periodo</span>
          <select value={months} onChange={(event) => setMonths(Number(event.currentTarget.value) || 1)} disabled={Boolean(busy)}>
            <option value={1}>Último mes</option>
            <option value={2}>Últimos 2 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Último año</option>
            <option value={36}>Histórico reciente</option>
          </select>
        </label>
        <button type="button" onClick={() => { void searchSurveys(false); }} disabled={Boolean(busy)}>
          {busy === "search" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
          Buscar
        </button>
        {results.length ? (
          <button type="button" onClick={() => { void searchSurveys(true); }} disabled={Boolean(busy)}>
            {busy === "refresh" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
            Actualizar
          </button>
        ) : null}
        {results.length ? (
          <button type="button" onClick={() => { void addDetectedSurveys(); }} disabled={Boolean(busy) || !bulkCandidates.length}>
            {busy === "bulk" ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
            Agregar detectadas
          </button>
        ) : null}
      </div>
      {meta ? (
        <div className="mon-sm-meta">
          {fmt(results.length)} visibles · {fmt(meta.totalRecent)} recientes en {meta.months === 1 ? "el último mes" : `los últimos ${fmt(meta.months)} meses`}
          {meta.fromCache ? " · catálogo local" : " · SurveyMonkey"}
        </div>
      ) : null}
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {results.length ? (
        <div className="mon-sm-survey-workflow">
          <div className="mon-sm-survey-catalog">
            <div className="pulso-sm-survey-picker">
              <label className="pulso-sm-search">
                <Search size={14} />
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.currentTarget.value)}
                  placeholder="Filtrar por nombre, actor o ID"
                  disabled={Boolean(busy)}
                />
              </label>
              <div className="pulso-sm-list-caption">{fmt(visibleSurveys.length)} de {fmt(results.length)} encuestas</div>
            </div>
            <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
              {visibleSurveys.map((survey) => {
                const selected = survey.id === selectedSurvey?.id;
                const added = configuredSurveyIds.has(survey.id);
                return (
                  <button
                    key={survey.id}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}${added ? " is-added" : ""}`}
                    onClick={() => setSelectedId(survey.id)}
                    disabled={Boolean(busy)}
                    aria-pressed={selected}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{surveyMonkeyDisplayTitle(survey)}</strong>
                      <small>{survey.id}{survey.date_modified ? ` · ${formatDate(survey.date_modified)}` : ""}</small>
                      <span className="pulso-sm-survey-card-meta">
                        {survey.pais_guess ? <b>{survey.pais_guess}</b> : null}
                        {survey.response_count != null ? <i>{fmt(survey.response_count)} respuestas</i> : null}
                      </span>
                    </span>
                    <em>{added ? "Agregada" : selected ? "En edición" : "Elegir"}</em>
                  </button>
                );
              })}
              {!visibleSurveys.length ? <div className="pulso-sm-empty">No hay coincidencias con el filtro actual.</div> : null}
            </div>
          </div>
          {selectedSurvey ? (
            <div className="mon-sm-selected-survey">
              <div className="pulso-sm-selected-head">
                <strong>Encuesta seleccionada</strong>
                <span>{surveyMonkeyDisplayTitle(selectedSurvey)} · {selectedSurvey.id}</span>
              </div>
              <div className="mon-sm-result">
                <div className="mon-sm-result-main">
                  <strong>{selectedSurvey.title}</strong>
                  <span>{selectedSurvey.date_modified ? formatDate(selectedSurvey.date_modified) : "Sin fecha de modificación"}</span>
                </div>
                <label className="mon-source-name-field">
                  <span>Nombre real en plataforma</span>
                  <input value={labels[selectedSurvey.id] ?? ""} onChange={(event) => setLabels((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))} placeholder={selectedSurvey.title || "Nombre visible"} />
                </label>
                <label className="mon-source-name-field">
                  <span>Actor / carrera</span>
                  <input value={actors[selectedSurvey.id] ?? ""} onChange={(event) => setActors((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))} placeholder="Actor" />
                </label>
                <AcreditacionChannelSelect
                  value={channels[selectedSurvey.id] ?? ""}
                  onChange={(channel) => setChannels((prev) => ({ ...prev, [selectedSurvey.id]: channel }))}
                  allowEmpty
                />
                <div className="mon-sm-result-actions">
                  <button type="button" onClick={() => { void inspectSurvey(selectedSurvey); }} disabled={Boolean(busy) || inspections[selectedSurvey.id]?.loading}>
                    {inspections[selectedSurvey.id]?.loading ? <Loader2 size={14} className="pulso-spin" /> : <Eye size={14} />}
                    Ver datos
                  </button>
                  <button type="button" onClick={() => { void addSurvey(selectedSurvey); }} disabled={Boolean(busy) || configuredSurveyIds.has(selectedSurvey.id)}>
                    {busy === selectedSurvey.id ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                    {configuredSurveyIds.has(selectedSurvey.id) ? "Ya agregada" : "Agregar al proyecto"}
                  </button>
                </div>
                <AcreditacionSurveyInspectionCard inspection={inspections[selectedSurvey.id]} />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mon-source-picker-note is-empty">
          <Search size={15} />
          <div>
            <strong>Busca respuestas SurveyMonkey</strong>
            <span>Los resultados aparecerán aquí antes de agregarlos al paquete de acreditación.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AcreditacionKoboSourcePicker({
  sources,
  phoneMode = false,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  phoneMode?: boolean;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const configuredAssetIds = useMemo(() => new Set(
    sources.map((source) => source.asset_uid).filter((value): value is string => Boolean(value)),
  ), [sources]);
  const configuredBaseUrl = sources[0]?.base_url || "";
  const configuredProfileId = sources[0]?.connection_profile_id || "";
  const [koboConnection, setKoboConnection] = useState<ConnectionTokenState | null>(null);
  const [baseUrl, setBaseUrl] = useState(configuredBaseUrl || KOBO_DEFAULT_BASE_URL);
  const [profileId, setProfileId] = useState(configuredProfileId);
  const [filter, setFilter] = useState("");
  const [assets, setAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"list" | string | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheckResult | null>(null);
  const profiles = koboConnection?.profiles ?? [];

  const preferredKoboProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === koboConnection?.active_profile_id)
      ?? profiles.find((profile) => profile.is_default)
      ?? profiles.find((profile) => profile.base_url)
      ?? profiles[0]
      ?? null;
  }, [koboConnection, profiles]);
  const preferredBaseUrl = koboConnection?.active_profile_base_url || preferredKoboProfile?.base_url || "";
  const preferredProfileId = koboConnection?.active_profile_id || preferredKoboProfile?.id || "";
  const normalizedBaseUrl = normalizeKoboBaseUrl(baseUrl);
  const requestedProfileId = profileId.trim();
  const requestedProfile = profiles.find((profile) => profile.id === requestedProfileId) ?? null;
  const compatibleProfile = profiles.find((profile) =>
    normalizeKoboBaseUrl(profile.base_url || preferredBaseUrl) === normalizedBaseUrl && profile.has_token,
  ) ?? null;
  const resolvedProfile = requestedProfile ?? compatibleProfile ?? (!requestedProfileId ? preferredKoboProfile : null);
  const resolvedProfileId = resolvedProfile?.id ?? requestedProfileId;
  const resolvedProfileLabel = resolvedProfile
    ? `${resolvedProfile.alias || resolvedProfile.id}${resolvedProfile.server_label || resolvedProfile.base_url ? ` · ${resolvedProfile.server_label || resolvedProfile.base_url}` : ""}`
    : requestedProfileId || "Automático por servidor";
  const hasAnyKoboToken = Boolean(koboConnection?.has_token || profiles.some((profile) => profile.has_token));
  const portabilityNotice = useMemo((): { tone: "info" | "warning"; title: string; text: string } | null => {
    if (!koboConnection) return null;
    if (!hasAnyKoboToken) {
      return {
        tone: "warning",
        title: "Token Kobo pendiente en este equipo",
        text: "El proyecto conserva servidor y encuesta, pero cada computadora debe guardar su propio token Kobo antes de listar o actualizar respuestas.",
      };
    }
    if (requestedProfileId && !requestedProfile && !compatibleProfile) {
      return {
        tone: "warning",
        title: "Perfil Kobo no encontrado en este equipo",
        text: `El .pulso referencia ${requestedProfileId}. Crea un perfil local para ${normalizedBaseUrl} o deja el perfil vacío para usar el predeterminado.`,
      };
    }
    if (requestedProfileId && !requestedProfile && compatibleProfile) {
      return {
        tone: "info",
        title: "Perfil equivalente por servidor",
        text: `El ID guardado no existe aquí, pero este equipo usará ${compatibleProfile.alias || compatibleProfile.id} para ${normalizedBaseUrl}.`,
      };
    }
    return null;
  }, [compatibleProfile, hasAnyKoboToken, koboConnection, normalizedBaseUrl, requestedProfile, requestedProfileId]);

  useEffect(() => {
    let cancelled = false;
    void apiConnectionTokenLoad("kobo")
      .then((connection) => {
        if (cancelled) return;
        setKoboConnection(connection);
      })
      .catch(() => {
        if (!cancelled) setKoboConnection(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (configuredBaseUrl) {
      setBaseUrl(configuredBaseUrl);
    } else if (preferredBaseUrl) {
      setBaseUrl((current) => {
        const trimmed = current.trim();
        return trimmed && trimmed !== KOBO_DEFAULT_BASE_URL ? current : preferredBaseUrl;
      });
    }
    if (configuredProfileId) {
      setProfileId(configuredProfileId);
    } else if (preferredProfileId) {
      setProfileId((current) => current.trim() ? current : preferredProfileId);
    }
  }, [configuredBaseUrl, configuredProfileId, preferredBaseUrl, preferredProfileId]);

  const visibleAssets = useMemo(() => {
    const needle = normalizeSourceMatch(filter);
    const filtered = needle
      ? assets.filter((asset) => normalizeSourceMatch(`${asset.name} ${asset.uid}`).includes(needle))
      : assets;
    return [...filtered].sort((a, b) => {
      const aSelected = a.uid === selectedUid;
      const bSelected = b.uid === selectedUid;
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const aAdded = configuredAssetIds.has(a.uid);
      const bAdded = configuredAssetIds.has(b.uid);
      if (aAdded !== bAdded) return aAdded ? 1 : -1;
      return (a.name || a.uid).localeCompare(b.name || b.uid, "es");
    });
  }, [assets, configuredAssetIds, filter, selectedUid]);
  const selectedAsset = assets.find((asset) => asset.uid === selectedUid) ?? visibleAssets[0] ?? null;

  const hydrateKoboDefaults = (items: MonitoreoKoboAssetItem[]) => {
    setLabels((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = asset.name || asset.uid;
      });
      return next;
    });
    setActors((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = "";
      });
      return next;
    });
    setChannels((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = "";
      });
      return next;
    });
  };

  const checkConnection = async () => {
    setBusy("check");
    setConnectionCheck(null);
    setStatus({ tone: "info", message: "Probando conexión Kobo en este equipo..." });
    try {
      const result = await apiConnectionCheck("kobo", {
        base_url: normalizedBaseUrl,
        profile_id: resolvedProfileId || undefined,
      });
      setConnectionCheck(result);
      const refreshed = await apiConnectionTokenLoad("kobo").catch(() => null);
      if (refreshed) setKoboConnection(refreshed);
      if (result.ok) {
        setStatus({
          tone: "success",
          message: `Kobo respondió en ${result.base_url || normalizedBaseUrl}; ${fmt(result.count ?? 0)} formulario${result.count === 1 ? "" : "s"} visibles.`,
        });
      } else {
        setStatus({ tone: "error", message: result.error });
      }
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const listAssets = async () => {
    setBusy("list");
    setConnectionCheck(null);
    setStatus({ tone: "info", message: "Leyendo formularios Kobo disponibles..." });
    try {
      const result = await apiMonitoreoKoboAssets(normalizedBaseUrl, 100, {
        connection_profile_id: resolvedProfileId || undefined,
      });
      hydrateKoboDefaults(result.assets);
      setAssets(result.assets);
      setSelectedUid((current) => current || result.assets[0]?.uid || "");
      setStatus({ tone: "success", message: `${fmt(result.assets.length)} formulario${result.assets.length === 1 ? "" : "s"} Kobo disponibles para seleccionar.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const payloadForAsset = (asset: MonitoreoKoboAssetItem): MonitoreoSourcePayload => {
    const actor = phoneMode ? "" : actors[asset.uid] || "";
    const segment = actors[asset.uid] || "";
    const channel = phoneMode ? "Kobo" : channels[asset.uid] || "";
    const label = labels[asset.uid] || asset.name || asset.uid;
    return {
      kind: "kobo",
      label,
      asset_uid: asset.uid,
      survey_title: asset.name || label,
      base_url: normalizedBaseUrl,
      connection_profile_id: resolvedProfileId,
      role: "respuestas",
      integration_mode: "connected_read",
      dimensions: cleanSourceDimensions({
        actor,
        segmento: phoneMode ? segment : actor,
        carrera: phoneMode ? segment : actor,
        canal: channel,
        servicio: "Respuestas Kobo",
        survey_title: asset.name || label,
      }),
    };
  };

  const addAsset = async (asset: MonitoreoKoboAssetItem) => {
    if (configuredAssetIds.has(asset.uid)) return;
    setBusy(asset.uid);
    setStatus({ tone: "info", message: `Registrando ${asset.name || asset.uid} como ${phoneMode ? "instrumento" : "encuesta"} Kobo...` });
    try {
      const result = await apiMonitoreoSource(payloadForAsset(asset));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || asset.name || asset.uid} quedó como ${phoneMode ? "instrumento" : "encuesta"} Kobo.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`mon-acr-source-editor mon-acr-survey-add mon-acr-kobo-add${assets.length ? " has-results" : " is-compact"}`} aria-label="Selector de encuesta Kobo en plataforma">
      <div className="mon-acr-survey-add-head">
        <label>
          <span>Servidor de Kobo</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            placeholder={preferredBaseUrl || KOBO_DEFAULT_BASE_URL}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Cuenta</span>
          {profiles.length ? (
            <select
              value={profileId}
              onChange={(event) => setProfileId(event.currentTarget.value)}
              disabled={Boolean(busy)}
              title={resolvedProfileLabel}
            >
              <option value="">Automático por servidor</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.alias || profile.id}
                  {profile.server_label || profile.base_url ? ` · ${profile.server_label || profile.base_url}` : ""}
                  {profile.has_token ? "" : " · sin token"}
                </option>
              ))}
              {configuredProfileId && !profiles.some((profile) => profile.id === configuredProfileId) ? (
                <option value={configuredProfileId}>Perfil del proyecto · {shortenMiddle(configuredProfileId, 18)}</option>
              ) : null}
            </select>
          ) : (
            <input
              value={profileId}
              onChange={(event) => setProfileId(event.currentTarget.value)}
              placeholder="Configura token en Conexiones"
              disabled={Boolean(busy)}
            />
          )}
        </label>
        <label>
          <span>Buscar</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Buscar formulario"
            disabled={Boolean(busy)}
          />
        </label>
        <div className="mon-kobo-source-actions">
          <button type="button" onClick={() => { void checkConnection(); }} disabled={Boolean(busy)}>
            {busy === "check" ? <Loader2 size={14} className="pulso-spin" /> : <KeyRound size={14} />}
            Probar
          </button>
          <button type="button" onClick={() => { void listAssets(); }} disabled={Boolean(busy)}>
            {busy === "list" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
            Listar Kobo
          </button>
        </div>
      </div>
      {portabilityNotice ? (
        <div className={`mon-kobo-portability-note is-${portabilityNotice.tone}`}>
          {portabilityNotice.tone === "warning" ? <ShieldAlert size={15} /> : <KeyRound size={15} />}
          <div>
            <strong>{portabilityNotice.title}</strong>
            <span>{portabilityNotice.text}</span>
          </div>
        </div>
      ) : null}
      {connectionCheck ? (
        <div className={`mon-kobo-portability-note is-${connectionCheck.ok ? "info" : "warning"}`}>
          {connectionCheck.ok ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
          <div>
            <strong>{connectionCheck.ok ? "Conexión Kobo verificada" : "Conexión Kobo no disponible"}</strong>
            <span>
              {connectionCheck.ok
                ? `${connectionCheck.base_url || normalizedBaseUrl} respondió con ${fmt(connectionCheck.count ?? 0)} formulario${connectionCheck.count === 1 ? "" : "s"} visibles.`
                : connectionCheck.error}
            </span>
          </div>
        </div>
      ) : null}
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {assets.length ? (
        <div className="mon-sm-survey-workflow">
          <div className="mon-sm-survey-catalog">
            <div className="pulso-sm-survey-picker">
              <div className="pulso-sm-list-caption">{fmt(visibleAssets.length)} de {fmt(assets.length)} formularios Kobo</div>
            </div>
            <div className="pulso-sm-survey-list" aria-label="Formularios Kobo">
              {visibleAssets.map((asset) => {
                const selected = asset.uid === selectedAsset?.uid;
                const added = configuredAssetIds.has(asset.uid);
                return (
                  <button
                    key={asset.uid}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}${added ? " is-added" : ""}`}
                    onClick={() => setSelectedUid(asset.uid)}
                    disabled={Boolean(busy)}
                    aria-pressed={selected}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{asset.name || asset.uid}</strong>
                      <small>{asset.uid}{asset.date_modified ? ` · ${formatDate(asset.date_modified)}` : ""}</small>
                      <span className="pulso-sm-survey-card-meta">
                        <b>{asset.deployment_active ? "Deploy activo" : "Sin deploy activo"}</b>
                        {asset.version_id ? <i>{asset.version_id}</i> : null}
                      </span>
                    </span>
                    <em>{added ? "Agregada" : selected ? "En edición" : "Elegir"}</em>
                  </button>
                );
              })}
              {!visibleAssets.length ? <div className="pulso-sm-empty">No hay formularios Kobo con ese filtro.</div> : null}
            </div>
          </div>
          {selectedAsset ? (
            <div className="mon-sm-selected-survey">
              <div className="pulso-sm-selected-head">
                <strong>Encuesta Kobo seleccionada</strong>
                <span>{selectedAsset.name || selectedAsset.uid} · {shortenMiddle(selectedAsset.uid, 34)}</span>
              </div>
              <div className="mon-sm-result">
                <label className="mon-source-name-field">
                  <span>{phoneMode ? "Nombre del instrumento" : "Nombre real en plataforma"}</span>
                  <input value={labels[selectedAsset.uid] ?? ""} onChange={(event) => setLabels((prev) => ({ ...prev, [selectedAsset.uid]: event.currentTarget.value }))} placeholder={selectedAsset.name || "Nombre visible"} />
                </label>
                <label className="mon-source-name-field">
                  <span>{phoneMode ? "Segmento operativo" : "Actor / carrera"}</span>
                  <input value={actors[selectedAsset.uid] ?? ""} onChange={(event) => setActors((prev) => ({ ...prev, [selectedAsset.uid]: event.currentTarget.value }))} placeholder={phoneMode ? "Opcional: sede u otro segmento" : "Actor"} />
                </label>
                {phoneMode ? (
                  <div className="mon-phone-kobo-fixed-channel">
                    <ListChecks size={14} />
                    <span>
                      <strong>Kobo es la plataforma rectora</strong>
                      <em>El canal no define efectivas; solo el filtro guardado.</em>
                    </span>
                  </div>
                ) : (
                  <AcreditacionChannelSelect
                    value={channels[selectedAsset.uid] ?? ""}
                    onChange={(channel) => setChannels((prev) => ({ ...prev, [selectedAsset.uid]: channel }))}
                    allowEmpty
                  />
                )}
                <div className="mon-sm-result-actions">
                  <button type="button" onClick={() => { void addAsset(selectedAsset); }} disabled={Boolean(busy) || configuredAssetIds.has(selectedAsset.uid)}>
                    {busy === selectedAsset.uid ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                    {configuredAssetIds.has(selectedAsset.uid) ? "Ya agregada" : phoneMode ? "Usar como instrumento" : "Usar como plataforma"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mon-source-picker-note is-empty">
          <Search size={15} />
          <div>
            <strong>Selecciona la encuesta Kobo de plataforma</strong>
            {/* Qué está en juego al elegir, no cómo funciona el control. */}
            <span>{phoneMode ? "Es el formulario que cuenta las efectivas contra CodPulso." : "Es el que alimenta el avance contra la base de barrido."}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AcreditacionSurveyInspectionCard({
  inspection,
}: {
  inspection?: { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null };
}) {
  if (!inspection) return null;
  if (inspection.loading && !inspection.data) {
    return (
      <div className="mon-sm-inspection">
        <Loader2 size={14} className="pulso-spin" />
        <span>Cargando estructura y respuestas...</span>
      </div>
    );
  }
  if (inspection.error && !inspection.data) {
    return <div className="mon-sm-error mon-sm-inspection-error">{inspection.error}</div>;
  }
  const data = inspection.data;
  if (!data) return null;
  const columns = data.columns.slice(0, 12);
  const questions = data.questions.slice(0, 8);
  return (
    <div className="mon-sm-inspection">
      <div className="mon-sm-inspection-head">
        <div>
          <span>Datos detectados</span>
          <strong>{data.title || data.survey_id}</strong>
        </div>
        {inspection.loading ? <Loader2 size={14} className="pulso-spin" /> : null}
      </div>
      {inspection.error ? <div className="mon-sm-error">{inspection.error}</div> : null}
      <div className="mon-sm-inspection-metrics">
        <span>{fmt(data.n_pages)} páginas</span>
        <span>{fmt(data.n_questions)} preguntas</span>
        <span>{data.responses.total == null ? "Sin total" : `${fmt(data.responses.total)} respuestas`}</span>
        <span>{fmt(data.columns.length)} columnas</span>
      </div>
      {columns.length ? (
        <div className="mon-sm-column-list">
          {columns.map((column) => (
            <span key={column.name} title={column.examples.join(" · ")}>
              {column.name}
              <em>{fmt(column.non_empty)}</em>
            </span>
          ))}
        </div>
      ) : null}
      {questions.length ? (
        <div className="mon-sm-question-list">
          {questions.map((question) => (
            <div key={`${question.qid}-${question.pos}`}>
              <strong>Q{question.pos}</strong>
              <span>{question.heading || question.family}</span>
              <em>{question.family}{question.n_choices ? ` · ${fmt(question.n_choices)} opciones` : ""}</em>
            </div>
          ))}
        </div>
      ) : null}
      {!data.responses.available && data.responses.error ? <div className="mon-sm-error">{data.responses.error}</div> : null}
    </div>
  );
}

function AcreditacionActorAssignableField({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const currentKey = normalizeSourceMatch(value);
  const visibleOptions = options.slice(0, 8);
  return (
    <div className="mon-acr-actor-field">
      <label>
        <span>Actor</span>
        <input
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Escribir actor o elegir sugerencia"
          disabled={disabled}
        />
      </label>
      {visibleOptions.length ? (
        <div className="mon-acr-actor-choice-row" aria-label="Actores sugeridos">
          {visibleOptions.map((actor) => {
            const active = normalizeSourceMatch(actor) === currentKey;
            return (
              <button
                key={actor}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => onChange(actor)}
                disabled={disabled}
              >
                {active ? <CheckCircle2 size={12} /> : null}
                {actor}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AcreditacionPlatformSurveySourcesView({
  sources,
  config,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter(isSurveyMonkeyResponseSource);
  const koboSources = sources.filter(isKoboResponseSource);
  const platformSources = sources.filter(isPlatformResponseSource);
  const platformProviders = proveedoresDeFuentes(platformSources);
  const linkCollectors = config?.operational_model.link_collectors ?? [];
  const configuredActorOptions = acreditacionActorOptions(platformSources);
  const actorOptions = acreditacionActorOptions(platformSources, ACREDITACION_DEFAULT_ACTORS);
  const [drafts, setDrafts] = useState<Record<string, { actor: string; channel: string }>>({});
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(platformSources.map((source) => [
      source.id,
      {
        actor: sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source),
        channel: channelOptionForValue(sourceChannelLabel(source)).value,
      },
    ])));
  }, [platformSources.map((source) => `${source.id}:${sourceActorLabel(source)}:${sourceChannelLabel(source)}`).join("|")]);

  const declarationGroups = useMemo(() => {
    const groups = new Map<string, { actor: string; sources: MonitoreoSource[] }>();
    platformSources.forEach((source) => {
      const actor = drafts[source.id]?.actor || sourceActorLabel(source);
      const key = normalizeSourceMatch(actor) || source.id;
      const group = groups.get(key) ?? { actor, sources: [] };
      group.sources.push(source);
      groups.set(key, group);
    });
    return Array.from(groups.values()).map((group) => {
      const channels = new Map<string, ReturnType<typeof channelVisualForValue> & { count: number }>();
      group.sources.forEach((source) => {
        const channel = channelVisualForValue(drafts[source.id]?.channel || sourceChannelLabel(source), "Canal sin declarar");
        const current = channels.get(channel.key);
        channels.set(channel.key, current ? { ...current, count: current.count + 1 } : { ...channel, count: 1 });
      });
      return { ...group, channels: Array.from(channels.values()) };
    });
  }, [drafts, platformSources]);

  async function saveSurvey(source: MonitoreoSource) {
    const draft = drafts[source.id];
    if (!draft) return;
    setSavingId(source.id);
    setStatus({ tone: "info", message: `Guardando declaracion de ${acreditacionSurveySourceName(source)}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
        label: acreditacionSurveySourceName(source),
        enabled: source.enabled,
        dimensions: cleanSourceDimensions({
          ...source.dimensions,
          actor: draft.actor,
          segmento: draft.actor,
          carrera: draft.actor,
          canal: draft.channel,
          servicio: source.kind === "kobo" ? "Respuestas Kobo" : "Respuestas SurveyMonkey",
          survey_title: source.survey_title || source.label,
        }),
      }));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || source.id} quedo declarada.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="mon-acr-source-view mon-acr-platform-surveys">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <details className="mon-acr-source-disclosure" open={!platformSources.length}>
        <summary>
          <span><Plus size={14} /> Agregar SurveyMonkey</span>
          <em>{surveySources.length ? "Catalogo cerrado por defecto" : "Sin SurveyMonkey configuradas"}</em>
        </summary>
        <AcreditacionSurveySourcePicker
          sources={surveySources}
          onStateChange={onStateChange}
        />
      </details>
      <details className="mon-acr-source-disclosure" open={!platformSources.length && !koboSources.length}>
        <summary>
          <span><ListChecks size={14} /> Seleccionar encuesta Kobo</span>
          <em>{koboSources.length ? `${fmt(koboSources.length)} Kobo seleccionada${koboSources.length === 1 ? "" : "s"}` : "Sin Kobo"}</em>
        </summary>
        <AcreditacionKoboSourcePicker
          sources={koboSources}
          onStateChange={onStateChange}
        />
      </details>

      <section className="mon-acr-object-surface" aria-label="Encuestas en plataforma configuradas">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Encuestas en plataforma</span>
            <strong title={platformProviders.length ? `Vienen de ${platformProviders.join(" y ")}` : undefined}>
              {fmt(platformSources.length)} encuesta{platformSources.length === 1 ? "" : "s"} conectada{platformSources.length === 1 ? "" : "s"}
            </strong>
          </div>
          <em>{fmt(configuredActorOptions.length)} actores detectados</em>
        </div>
        {declarationGroups.length ? (
          <div className="mon-acr-survey-declaration-map" aria-label="Declarador de encuestas por actor y canal">
            <header>
              <span><Route size={14} /> Declaración actor-canal</span>
              <strong>Qué actor usa qué encuesta y por qué canal</strong>
            </header>
            <div className="mon-acr-survey-declaration-list">
              {declarationGroups.map((group) => (
                <article key={normalizeSourceMatch(group.actor) || group.actor}>
                  <div className="mon-acr-survey-declaration-main">
                    <ContactRound size={14} />
                    <span>
                      <small>Actor</small>
                      <strong>{group.actor}</strong>
                    </span>
                    <em>{fmt(group.sources.length)} encuesta{group.sources.length === 1 ? "" : "s"}</em>
                  </div>
                  <div className="mon-acr-survey-declaration-surveys">
                    {group.sources.slice(0, 3).map((source) => {
                      const channel = channelVisualForValue(drafts[source.id]?.channel || sourceChannelLabel(source), "Canal sin declarar");
                      const Icon = channel.icon;
                      return (
                        <span key={source.id} className={`is-${channel.key}`}>
                          <Icon size={12} />
                          <strong>{acreditacionSurveySourceName(source)}</strong>
                          <small>{channel.label}</small>
                        </span>
                      );
                    })}
                    {group.sources.length > 3 ? <span className="is-more">+{fmt(group.sources.length - 3)} más</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mon-acr-survey-card-grid">
          {platformSources.map((source) => {
            const draft = drafts[source.id] ?? {
              actor: sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source),
              channel: channelOptionForValue(sourceChannelLabel(source)).value,
            };
            const collectorCount = acreditacionCollectorCountForSource(source, linkCollectors);
            const collectorRows = acreditacionCollectorsForSource(source, linkCollectors);
            const overrideCount = collectorRows.filter((row) => (
              row.saved?.channel
              && acreditacionChannelKey(row.saved.channel) !== acreditacionChannelKey(draft.channel)
            )).length;
            const inheritedCount = Math.max(0, collectorRows.length - overrideCount);
            const sourceActor = draft.actor || sourceActorLabel(source);
            const actorInitial = actorInitialLabel(sourceActor);
            const responseCount = acreditacionSourceResponseCount(source, linkCollectors);
            const channel = channelVisualForValue(draft.channel, "Canal sin declarar");
            const ChannelIcon = channel.icon;
            const dirty = draft.actor !== (sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source))
              || draft.channel !== channelOptionForValue(sourceChannelLabel(source)).value;
            return (
              <article key={source.id} className={`mon-acr-source-object-card${source.enabled ? "" : " is-disabled"}`}>
                <div className="mon-acr-source-object-main">
                  <span className="mon-acr-source-object-icon" role="img" aria-label={`Actor ${sourceActor}`}>
                    {actorInitial}
                  </span>
                  <div>
                    <strong>{acreditacionSurveySourceName(source)}</strong>
                    <em>{source.survey_id || source.asset_uid || source.id}</em>
                  </div>
                  <span className={source.enabled ? "is-ready" : "is-muted"}>{source.enabled ? "Activa" : "Inactiva"}</span>
                </div>
                <div className="mon-acr-source-object-metrics">
                  <span><small>Recopiladores</small><strong>{fmt(collectorCount)}</strong></span>
                  <span><small>Ultimo sync</small><strong>{sourceSyncLabel(source)}</strong></span>
                  <span><small>Respuestas</small><strong>{fmt(responseCount)}</strong></span>
                </div>
                <div className="mon-acr-source-object-routing" aria-label="Declaración operativa de la encuesta">
                  <AcreditacionActorAssignableField
                    value={draft.actor}
                    options={actorOptions}
                    disabled={Boolean(savingId)}
                    onChange={(actor) => setDrafts((current) => ({ ...current, [source.id]: { ...draft, actor } }))}
                  />
                  <AcreditacionChannelDeclarationPicker
                    value={draft.channel}
                    disabled={Boolean(savingId)}
                    onChange={(nextChannel) => setDrafts((current) => ({ ...current, [source.id]: { ...draft, channel: nextChannel } }))}
                  />
                  <div className="mon-acr-source-inheritance">
                    <span className={`is-${channel.key}`}><ChannelIcon size={13} /> Base {channel.label}</span>
                    <span><CheckCircle2 size={13} /> {fmt(inheritedCount)} heredan</span>
                    <span><ShieldAlert size={13} /> {fmt(overrideCount)} excepciones</span>
                  </div>
                  <button type="button" onClick={() => { void saveSurvey(source); }} disabled={Boolean(savingId) || !dirty}>
                    {savingId === source.id ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
                    Guardar declaración
                  </button>
                </div>
              </article>
            );
          })}
          {!platformSources.length ? (
            <div className="mon-acr-empty-state">
              <ListChecks size={18} />
              <strong>Sin encuestas conectadas</strong>
              <span>Agrega SurveyMonkey o selecciona una encuesta Kobo de plataforma y después asigna cada una al actor correcto.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AcreditacionSheetsByActorView({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter(isPlatformResponseSource);
  const baseSources = sources.filter((source) => source.kind === "google_sheets" && source.role === "universo");
  const sweepSources = sources.filter((source) => source.kind === "google_sheets" && source.role === "barrido");
  const [manualActor, setManualActor] = useState("");
  const [manualActors, setManualActors] = useState<string[]>([]);
  const actorOptions = acreditacionActorOptions([...surveySources, ...baseSources], manualActors);
  const [selectedActor, setSelectedActor] = useState(actorOptions[0] ?? "");
  const selectedSource = baseSources.find((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(selectedActor)) ?? null;
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [range, setRange] = useState("");
  const [inspection, setInspection] = useState<MonitoreoSheetsInspectResult | null>(null);
  const [busy, setBusy] = useState<"inspect" | "save" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    if (!selectedActor && actorOptions.length) setSelectedActor(actorOptions[0]);
  }, [actorOptions, selectedActor]);

  useEffect(() => {
    setSpreadsheetId(selectedSource?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(selectedSource?.sheet_binding?.sheet_name ?? "");
    setRange(selectedSource?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  }, [selectedSource?.id, selectedActor]);

  async function inspectSheets() {
    if (!spreadsheetId.trim()) {
      setStatus({ tone: "error", message: "Pega el Spreadsheet ID o URL antes de leer pestañas." });
      return;
    }
    setBusy("inspect");
    setStatus({ tone: "info", message: "Leyendo pestañas desde Google Sheets..." });
    try {
      const result = await apiMonitoreoSheetsInspect({
        spreadsheet_id: spreadsheetId.trim(),
        sheet_name: sheetName.trim(),
        header_row: 1,
        range: range.trim(),
      });
      setInspection(result);
      setStatus({ tone: "success", message: `${fmt(result.sheets.length)} pestañas detectadas en ${result.title || "Spreadsheet"}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function saveActorSheet() {
    if (!selectedActor.trim() || !spreadsheetId.trim() || !sheetName.trim()) {
      setStatus({ tone: "error", message: "Actor, Spreadsheet y pestaña son obligatorios." });
      return;
    }
    setBusy("save");
    setStatus({ tone: "info", message: selectedSource ? "Guardando base por actor..." : "Registrando base por actor..." });
    try {
      const result = await apiMonitoreoSheetsSource({
        id: selectedSource?.id,
        kind: "google_sheets",
        label: `Base ${selectedActor.trim()}`,
        enabled: true,
        role: "universo",
        integration_mode: "connected_read",
        sheet_binding: {
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          header_row: 1,
          range: range.trim(),
        },
        dimensions: cleanSourceDimensions({
          actor: selectedActor.trim(),
          carrera: selectedActor.trim(),
          segmento: selectedActor.trim(),
          canal: "Base",
          servicio: "Base en Sheets",
          sheet_name: sheetName.trim(),
        }),
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `Base ${selectedActor.trim()} quedo vinculada.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function addManualActor() {
    const label = manualActor.trim();
    if (!label) return;
    setManualActors((current) => acreditacionActorOptions([], [...current, label]));
    setSelectedActor(label);
    setManualActor("");
  }

  return (
    <div className="mon-acr-source-view mon-acr-sheets-by-actor">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <section className="mon-acr-object-surface">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Bases en Sheets</span>
            <strong>Una base por actor requerido</strong>
          </div>
          <em>{fmt(baseSources.length)}/{fmt(actorOptions.length)} actores vinculados</em>
        </div>
        <div className="mon-acr-actor-source-layout">
          <div className="mon-acr-actor-rail" aria-label="Actores para bases Sheets">
            <div className="mon-acr-manual-actor">
              <input
                value={manualActor}
                onChange={(event) => setManualActor(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addManualActor();
                }}
                placeholder="Agregar actor manual"
              />
              <button type="button" onClick={addManualActor} disabled={!manualActor.trim()}>
                <Plus size={14} />
              </button>
            </div>
            {actorOptions.map((actor) => {
              const actorSource = baseSources.find((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(actor));
              return (
                <button
                  key={actor}
                  type="button"
                  className={`mon-acr-actor-sheet-card${actor === selectedActor ? " is-active" : ""}${actorSource ? " is-ready" : ""}`}
                  onClick={() => setSelectedActor(actor)}
                >
                  <span>{actorSource ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}</span>
                  <strong>{actor}</strong>
                  <em>{actorSource?.sheet_binding?.sheet_name || "Base pendiente"}</em>
                </button>
              );
            })}
            {!actorOptions.length ? (
              <div className="mon-sm-empty">Configura actores en Encuestas en plataforma o agrega uno manualmente.</div>
            ) : null}
          </div>
          <div className="mon-acr-actor-sheet-editor">
            <div className="mon-acr-sheet-adjustment-head">
              <div>
                <span>{selectedSource ? "Base vinculada" : "Base pendiente"}</span>
                <strong>{selectedActor || "Selecciona un actor"}</strong>
              </div>
            </div>
            <div className="mon-acr-sheet-form">
              <label>
                <span>Enlace del Google Sheet</span>
                <input value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.currentTarget.value)} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={Boolean(busy) || !selectedActor} />
              </label>
              <label>
                <span>Pestaña del actor</span>
                <input value={sheetName} onChange={(event) => setSheetName(event.currentTarget.value)} placeholder={selectedActor || "Actor"} disabled={Boolean(busy) || !selectedActor} />
              </label>
              <label>
                <span>Rango de celdas</span>
                <input value={range} onChange={(event) => setRange(event.currentTarget.value)} placeholder="Opcional" disabled={Boolean(busy) || !selectedActor} />
              </label>
              <div className="mon-acr-sheet-actions">
                <button type="button" onClick={() => { void inspectSheets(); }} disabled={Boolean(busy) || !spreadsheetId.trim() || !selectedActor}>
                  {busy === "inspect" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                  Leer pestañas
                </button>
                <button type="button" onClick={() => { void saveActorSheet(); }} disabled={Boolean(busy) || !selectedActor || !spreadsheetId.trim() || !sheetName.trim()}>
                  {busy === "save" ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
                  Confirmar base
                </button>
              </div>
            </div>
            {inspection ? (
              <div className="mon-acr-sheet-inspection">
                <div className="mon-acr-sheet-inspection-head">
                  <strong>{inspection.title || inspection.spreadsheet_id}</strong>
                  <span>{fmt(inspection.sheets.length)} pestañas · {fmt(inspection.headers.length)} encabezados</span>
                </div>
                <div className="mon-acr-sheet-tabs">
                  {inspection.sheets.slice(0, 14).map((sheet) => (
                    <button key={sheet.title} type="button" onClick={() => setSheetName(sheet.title)}>
                      {sheet.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <details className="mon-acr-source-disclosure">
        <summary>
          <span><PhoneCall size={14} /> Barrido telefónico</span>
          <em>{sweepSources.length ? `${fmt(sweepSources.length)} fuente${sweepSources.length === 1 ? "" : "s"}` : "Opcional si existe"}</em>
        </summary>
        <AcreditacionSheetSourceEditor
          preset={ACREDITACION_SOURCE_PRESETS[1]}
          sources={sweepSources}
          onStateChange={onStateChange}
        />
      </details>
    </div>
  );
}

function collectorConfigFromRow(row: AcreditacionCollectorRow, patch: Partial<MonitoreoLinkCollector> = {}): MonitoreoLinkCollector {
  const operationalUse = normalizeCollectorUse(patch.operational_use ?? row.saved?.operational_use ?? row.operationalUse);
  const channel = String(patch.channel ?? row.saved?.channel ?? row.channel ?? collectorChannelForUse(operationalUse)).trim() || "Sin clasificar";
  const collectorName = String(patch.collector_name ?? (row.alias || row.saved?.collector_name || row.platformName || row.collectorId)).trim();
  return {
    id: row.saved?.id || row.key,
    source_id: row.sourceId,
    source_label: row.sourceName,
    survey_id: row.surveyId,
    collector_id: row.collectorId,
    collector_name: collectorName,
    collector_type: row.collectorType,
    enabled: patch.enabled ?? row.enabled,
    channel,
    operational_use: operationalUse,
    modality: normalizeModelModality(patch.modality ?? row.saved?.modality ?? row.modality ?? acreditacionChannelModality(channel)),
    roster_required: patch.roster_required ?? row.saved?.roster_required ?? row.rosterRequired,
  };
}

function AcreditacionCollectorsSourceView({
  sources,
  config,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter((source) => source.kind === "surveymonkey" && source.enabled);
  const configuredCollectors = config?.operational_model.link_collectors ?? [];
  const [selectedSourceId, setSelectedSourceId] = useState(surveySources[0]?.id ?? "");
  const [draftCollectors, setDraftCollectors] = useState<MonitoreoLinkCollector[]>(configuredCollectors);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDraftCollectors(configuredCollectors);
  }, [configuredCollectors.map((collector) => `${collector.source_id}:${collector.collector_id}:${collector.enabled}:${collector.collector_name}:${collector.channel}:${collector.operational_use}`).join("|")]);

  useEffect(() => {
    if (!selectedSourceId && surveySources.length) setSelectedSourceId(surveySources[0].id);
    if (selectedSourceId && surveySources.length && !surveySources.some((source) => source.id === selectedSourceId)) setSelectedSourceId(surveySources[0].id);
  }, [selectedSourceId, surveySources]);

  const selectedSource = surveySources.find((source) => source.id === selectedSourceId) ?? surveySources[0] ?? null;
  const selectedHasMetadata = Boolean(selectedSource?.collectors?.length);
  const collectorRows = selectedSource && selectedHasMetadata
    ? acreditacionCollectorsForSource(selectedSource, draftCollectors).filter((row) => row.hasPlatformMetadata)
    : [];
  const selectedSavedCount = selectedSource
    ? draftCollectors.filter((collector) => collector.source_id === selectedSource.id || collector.survey_id === selectedSource.survey_id).length
    : 0;

  function updateCollector(row: AcreditacionCollectorRow, patch: Partial<MonitoreoLinkCollector>) {
    const next = collectorConfigFromRow(row, patch);
    setDraftCollectors((current) => [
      ...current.filter((collector) => `${collector.source_id}::${collector.collector_id}` !== `${next.source_id}::${next.collector_id}`),
      next,
    ]);
  }

  async function saveCollectors() {
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando recopiladores incluidos, alias y uso operativo..." });
    try {
      const result = await apiMonitoreoCollectorsConfig(draftCollectors);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Cambios de recopiladores confirmados." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mon-acr-source-view mon-acr-collectors-view">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <section className="mon-acr-object-surface">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Recopiladores</span>
            <strong>{selectedSource ? acreditacionSurveySourceName(selectedSource) : "Sin encuesta activa"}</strong>
          </div>
          <button type="button" className="pulso-primary" onClick={() => { void saveCollectors(); }} disabled={saving || !surveySources.length}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            Confirmar cambios
          </button>
        </div>
        <div className="mon-acr-collector-picker">
          {surveySources.map((source) => {
            const count = acreditacionCollectorCountForSource(source, draftCollectors);
            const hasMetadata = Boolean(source.collectors?.length);
            const channel = sourceChannelLabel(source);
            return (
              <button
                key={source.id}
                type="button"
                className={`${source.id === selectedSource?.id ? "is-active" : ""}${hasMetadata ? "" : " is-missing"}`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <AcreditacionChannelBadge channel={channel} />
                <span>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <em>{sourceActorLabel(source)} · {sourceExternalId(source)}</em>
                </span>
                <b>{hasMetadata ? `${fmt(count)} recopiladores` : "Sin metadata"}</b>
              </button>
            );
          })}
          {!surveySources.length ? <div className="mon-sm-empty">No hay encuestas SurveyMonkey activas.</div> : null}
        </div>
        {selectedSource && !selectedHasMetadata ? (
          <div className="mon-acr-metadata-missing">
            <AlertCircle size={16} />
            <div>
              <strong>Falta metadata real de recopiladores</strong>
              <span>Ejecuta Actualizar todo para guardar los nombres reales de plataforma. No se muestran nombres inventados desde IDs o alias antiguos.</span>
              {selectedSavedCount ? <em>{fmt(selectedSavedCount)} relaciones guardadas se usaran en Avance.</em> : null}
            </div>
          </div>
        ) : null}
        <div className="mon-acr-collector-list">
          {collectorRows.map((row) => {
            const operationalUse = normalizeCollectorUse(row.saved?.operational_use ?? row.operationalUse);
            const useOption = collectorUseOption(operationalUse);
            const UseIcon = useOption.icon;
            return (
              <article key={row.key} className={`mon-collector-card mon-acr-collector-row is-${row.modality}${row.enabled ? "" : " is-disabled"}`}>
                <div className="mon-collector-title">
                  <span className="mon-collector-use-icon"><UseIcon size={14} /></span>
                  <div>
                    <strong>{row.platformName}</strong>
                    <em>{row.alias ? `Alias: ${row.alias}` : "Sin alias operativo"}</em>
                  </div>
                  <span className="mon-collector-chip">{collectorTypeLabel(row.collectorType)}</span>
                </div>
                <div className="mon-collector-metrics">
                  <AcreditacionCollectorMetric label="Respuestas" value={row.responseCount} tone={row.responseCount ? "ready" : "neutral"} />
                  <AcreditacionCollectorMetric label="Uso" value={row.enabled ? 1 : 0} tone={row.enabled ? "ready" : "warning"} />
                  <AcreditacionCollectorMetric label="Alias" value={row.alias ? 1 : 0} />
                  <AcreditacionCollectorMetric label="Barrido" value={row.rosterRequired ? 1 : 0} />
                </div>
                <div className="mon-collector-controls mon-acr-collector-controls">
                  <label className="mon-switch-line">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateCollector(row, { enabled: event.currentTarget.checked })}
                    />
                    <span>
                      <strong>{row.enabled ? "Incluido" : "Excluido"}</strong>
                      <em>{row.enabled ? "Cuenta en este canal" : "No participa"}</em>
                    </span>
                  </label>
                  <label>
                    <span>Alias</span>
                    <input
                      value={row.alias}
                      onChange={(event) => updateCollector(row, { collector_name: event.currentTarget.value })}
                      placeholder="Alias opcional"
                    />
                  </label>
                  <label>
                    <span>Uso</span>
                    <select
                      value={operationalUse}
                      onChange={(event) => updateCollector(row, { operational_use: event.currentTarget.value as MonitoreoCollectorUse })}
                    >
                      {MODEL_COLLECTOR_USE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <AcreditacionChannelSelect
                    value={channelOptionForValue(row.saved?.channel ?? row.channel).value}
                    onChange={(channel) => updateCollector(row, { channel })}
                  />
                </div>
              </article>
            );
          })}
          {selectedHasMetadata && !collectorRows.length ? (
            <div className="mon-sm-empty">Esta encuesta no tiene recopiladores persistidos.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AcreditacionActiveSourcesView({
  sources,
  config,
  reportSources,
  state,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  reportSources: Array<Record<string, unknown>>;
  state?: MonitoreoState | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const linkCollectors = config?.operational_model.link_collectors ?? [];
  const summary = buildAcreditacionActiveSourcesSummary(sources, linkCollectors);
  const surveySources = sources.filter((source) => isPlatformResponseSource(source) && source.enabled);
  const sheetSources = sources.filter((source) => source.kind === "google_sheets" && source.enabled);
  const packageRows = sourcePackageRows(sources);
  const isPhoneView = isTelefonicoMonitoreoState(state);
  const activeRows = sourceRowsForTable(sources.filter((source) => source.enabled), { phoneMode: isPhoneView });

  if (isPhoneView) {
    const contract = buildAcreditacionPhoneSourceContract(sources);
    const slots = [contract.universe, contract.sweep, contract.platform];
    const readySlots = slots.filter((slot) => slot.ready).length;
    const phoneSheetSources = Array.from(new Map(
      [...contract.universe.sources, ...contract.sweep.sources]
        .filter((source) => source.enabled)
        .map((source) => [source.id, source] as const),
    ).values());
    const koboSources = contract.platform.sources.filter((source) => source.enabled);
    return (
      <div className="mon-acr-source-view mon-acr-active-sources">
        <section className="mon-acr-active-hero">
          <div>
            <span>Paquete telefónico</span>
            <strong>{fmt(readySlots)}/3 fuentes listas para monitoreo</strong>
            <p>Base telefónica, barrido y Kobo se mantienen separados: Kobo manda efectivas y el barrido aporta estados telefónicos.</p>
          </div>
          <div className="mon-acr-active-kpis">
            <StatTile label="Fuentes" value={`${fmt(readySlots)}/3`} tone={readySlots === 3 ? "good" : "warn"} />
            <StatTile label="Sheets" value={fmt(phoneSheetSources.length)} tone={phoneSheetSources.length >= 2 ? "good" : "warn"} />
            <StatTile label="Kobo" value={fmt(koboSources.length)} tone={koboSources.length ? "good" : "warn"} />
            <StatTile label="Ultimo sync" value={summary.lastSync ? formatDate(summary.lastSync) : "Sin sync"} tone={summary.lastSync ? "good" : "warn"} />
          </div>
        </section>
        <div className="mon-acr-active-grid">
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Contrato telefónico</span>
                <strong>{fmt(readySlots)} de 3 piezas listas</strong>
              </div>
              <em>{contract.ready ? "Paquete completo" : "Faltan piezas"}</em>
            </div>
            <div className="mon-acr-active-source-list">
              {slots.map((slot) => (
                <article key={slot.key} className={slot.ready ? "is-ready" : "is-warning"}>
                  <strong>{slot.label}</strong>
                  <span>{slot.purpose}</span>
                  <em>{slot.ready ? `${fmt(slot.sources.filter((source) => source.enabled).length)} activa` : "Pendiente"}</em>
                </article>
              ))}
            </div>
          </section>
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Base y barrido</span>
                <strong>{fmt(phoneSheetSources.length)} fuente{phoneSheetSources.length === 1 ? "" : "s"} Sheets</strong>
              </div>
              <em>estados en paralelo</em>
            </div>
            <div className="mon-acr-active-source-list">
              {phoneSheetSources.map((source) => (
                <article key={source.id}>
                  <strong>{source.label || source.sheet_binding?.sheet_name || source.id}</strong>
                  <span>{source.role === "barrido" ? "Barrido telefónico" : "Base telefónica"} · {source.sheet_binding?.sheet_name || "Sin pestaña"}</span>
                  <em>{sourceSyncLabel(source)}</em>
                </article>
              ))}
              {!phoneSheetSources.length ? <div className="mon-sm-empty">Sin Sheets telefónicas activas.</div> : null}
            </div>
          </section>
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Kobo efectivo</span>
                <strong>{fmt(koboSources.length)} encuesta{ koboSources.length === 1 ? "" : "s"} activa{ koboSources.length === 1 ? "" : "s"}</strong>
              </div>
              <em>avance por CodPulso</em>
            </div>
            <div className="mon-acr-active-source-list">
              {koboSources.map((source) => (
                <article key={source.id}>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <span>{sourceProviderLabel(source.kind)} · {shortenMiddle(sourceExternalId(source), 34)}</span>
                  <em>{fmt(acreditacionSourceResponseCount(source))} respuestas</em>
                </article>
              ))}
              {!koboSources.length ? <div className="mon-sm-empty">Sin Kobo activo.</div> : null}
            </div>
          </section>
        </div>
        <details className="mon-acr-source-disclosure">
          <summary>
            <span><Table2 size={14} /> Detalle de fuentes</span>
            <em>{fmt(activeRows.length)} activas</em>
          </summary>
          <div className="mon-profile-grid">
            <section className="mon-profile-panel">
              <div className="mon-profile-panel-head">
                <h3>Fuentes activas</h3>
                <span>{fmt(activeRows.length)} filas</span>
              </div>
              <DataTable rows={activeRows} empty="No hay fuentes activas." preferredColumns={["Fuente", "Servicio", "Rol", "Estado", "Ultimo sync", "ID"]} />
            </section>
            <section className="mon-profile-panel">
              <div className="mon-profile-panel-head">
                <h3>Fuentes del corte</h3>
                <span>{fmt(reportSources.length)} filas</span>
              </div>
              <DataTable rows={reportSources} empty="El corte no declaró fuentes." />
            </section>
          </div>
          <AcreditacionConfiguredSourcesList
            sources={sources}
            syncFallback={state?.synced_at ?? state?.generated_at}
            phoneMode
            onStateChange={onStateChange}
          />
        </details>
      </div>
    );
  }

  return (
    <div className="mon-acr-source-view mon-acr-active-sources">
      <section className="mon-acr-active-hero">
        <div>
          <span>Fuentes activas</span>
          <strong>{fmt(summary.activeSurveys + summary.activeSheetBases)} piezas alimentando monitoreo</strong>
          <p>Resumen operativo de lo que se usara para nutrir avance, actores, bases y recopiladores.</p>
        </div>
        <div className="mon-acr-active-kpis">
          <StatTile label="Encuestas" value={fmt(summary.activeSurveys)} tone={summary.activeSurveys ? "good" : "warn"} />
          <StatTile label="Bases actor" value={fmt(summary.activeSheetBases)} tone={summary.missingSheetActors.length ? "warn" : "good"} />
          <StatTile label="Recop. incluidos" value={fmt(summary.includedCollectors)} tone={summary.includedCollectors ? "good" : "neutral"} />
          <StatTile label="Ultimo sync" value={summary.lastSync ? formatDate(summary.lastSync) : "Sin sync"} tone={summary.lastSync ? "good" : "warn"} />
        </div>
      </section>
      <div className="mon-acr-active-grid">
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Actores y cobertura</span>
              <strong>{fmt(summary.actorsWithSurvey.length)} actores con encuesta</strong>
            </div>
            <em>{summary.missingSheetActors.length ? `${fmt(summary.missingSheetActors.length)} bases faltantes` : "Bases alineadas"}</em>
          </div>
          <div className="mon-acr-active-actor-list">
            {summary.actorsWithSurvey.map((actor) => {
              const hasSheet = summary.actorsWithSheet.some((sheetActor) => normalizeSourceMatch(sheetActor) === normalizeSourceMatch(actor));
              const actorSurveys = surveySources.filter((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(actor));
              return (
                <article key={actor} className={hasSheet ? "is-ready" : "is-warning"}>
                  <strong>{actor}</strong>
                  <span>{fmt(actorSurveys.length)} encuesta{actorSurveys.length === 1 ? "" : "s"}</span>
                  <em>{hasSheet ? "Base Sheets vinculada" : "Falta base Sheets"}</em>
                </article>
              );
            })}
            {!summary.actorsWithSurvey.length ? <div className="mon-sm-empty">Sin actores activos desde encuestas.</div> : null}
          </div>
        </section>
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Recopiladores</span>
              <strong>{fmt(summary.includedCollectors)} incluidos · {fmt(summary.excludedCollectors)} excluidos</strong>
            </div>
            <em>{summary.missingCollectorMetadata ? `${fmt(summary.missingCollectorMetadata)} sin metadata` : "Metadata real lista"}</em>
          </div>
          <div className="mon-acr-active-source-list">
            {surveySources.map((source) => {
              const rows = acreditacionCollectorsForSource(source, linkCollectors);
              return (
                <article key={source.id}>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <span>{sourceActorLabel(source)} · {fmt(rows.filter((row) => row.enabled).length)} incluidos</span>
                  <em>{source.collectors?.length ? `${fmt(source.collectors.length)} nombres reales` : "Falta Actualizar todo"}</em>
                </article>
              );
            })}
            {!surveySources.length ? <div className="mon-sm-empty">Sin encuestas activas.</div> : null}
          </div>
        </section>
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Bases Sheets vinculadas</span>
              <strong>{fmt(sheetSources.length)} fuente{sheetSources.length === 1 ? "" : "s"}</strong>
            </div>
            <em>{state?.has_snapshot ? "Snapshot local listo" : "Sin snapshot"}</em>
          </div>
          <div className="mon-acr-active-source-list">
            {sheetSources.map((source) => (
              <article key={source.id}>
                <strong>{source.label || sourceActorLabel(source)}</strong>
                <span>{source.sheet_binding?.sheet_name || "Sin pestaña"} · {sourceActorLabel(source)}</span>
                <em>{sourceSyncLabel(source)}</em>
              </article>
            ))}
            {!sheetSources.length ? <div className="mon-sm-empty">Sin bases Sheets activas.</div> : null}
          </div>
        </section>
      </div>
      <details className="mon-acr-source-disclosure">
        <summary>
          <span><Table2 size={14} /> Detalle tecnico</span>
          <em>{fmt(activeRows.length)} fuentes activas</em>
        </summary>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Cobertura fija</h3>
              <span>{fmt(packageRows.length)} piezas</span>
            </div>
            <DataTable rows={packageRows} empty="No hay cobertura de fuentes para acreditacion." preferredColumns={["Pieza", "Servicio", "Configuradas", "Activas", "Estado", "Ultimo sync"]} />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes configuradas</h3>
              <span>{fmt(activeRows.length)} activas</span>
            </div>
            <DataTable rows={activeRows} empty="No hay fuentes activas." preferredColumns={["Fuente", "Servicio", "Actor", "Canal", "Estado", "Ultimo sync", "ID"]} />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes del reporte</h3>
              <span>{fmt(reportSources.length)} filas</span>
            </div>
            <DataTable rows={reportSources} empty="El reporte no declaro fuentes para este corte." />
          </section>
        </div>
        <AcreditacionConfiguredSourcesList
          sources={sources}
          syncFallback={state?.synced_at ?? state?.generated_at}
          onStateChange={onStateChange}
        />
      </details>
    </div>
  );
}

function AcreditacionConfiguredSourcesList({
  sources,
  syncFallback,
  phoneMode = false,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  syncFallback?: string;
  phoneMode?: boolean;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const phoneContract = phoneMode ? buildAcreditacionPhoneSourceContract(sources) : null;
  // La cabecera cuenta lo que la lista muestra.
  //
  // Decía «3 seleccionadas» junto a «3/3 operativas» sobre una lista con una
  // fuente marcada INACTIVA: dos denominadores distintos —fuentes conectadas y
  // piezas del contrato— bajo la misma cabecera, y el segundo desmentido por la
  // propia lista. Las piezas del contrato ya las cuenta la cadena de arriba;
  // aquí lo que hace falta saber es cuántas de las conectadas están en uso, que
  // es lo único que esta superficie muestra y ninguna otra.
  const unusedCount = sources.filter((source) => !source.enabled).length;
  const activeCount = phoneContract ? phoneContractReadyCount(phoneContract) : sources.filter((source) => source.enabled).length;
  const totalCount = piezasRequeridas(Boolean(phoneContract), sources.length);

  const updateSource = async (source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>) => {
    setSavingId(source.id);
    setStatus({ tone: "info", message: `Guardando ${source.label || source.id}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, patch));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || source.id} actualizado.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
      throw error;
    } finally {
      setSavingId("");
    }
  };

  return (
    <aside className="mon-source-configured-panel mon-acr-configured-sources-panel" aria-label="Fuentes configuradas">
      <div className="mon-source-configured-head">
        <div>
          <span className="mon-source-list-head">Fuentes configuradas</span>
          <strong>{sources.length ? `${fmt(sources.length)} conectadas` : "Sin fuentes"}</strong>
        </div>
        <em className={phoneContract && unusedCount ? "is-aviso" : undefined}>
          {phoneContract
            ? unusedCount
              ? `${fmt(unusedCount)} sin usar en el corte`
              : "todas en uso"
            : `${fmt(activeCount)}/${fmt(totalCount || 0)} activas`}
        </em>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <div className="mon-source-list">
        {sources.map((source) => {
          const dims = sourceDimensionEntries(source.dimensions);
          const saving = savingId === source.id;
          const syncLabel = sourceSyncLabel(source);
          const displayedSync = syncLabel === "Sin sync" && source.enabled && syncFallback ? formatDate(syncFallback) : syncLabel;
          return (
            <div key={source.id} className={`mon-source-item${source.enabled ? "" : " is-disabled"}`}>
              <div className="mon-source-main">
                <label className="mon-source-alias">
                  <span>Nombre de base</span>
                  <input
                    defaultValue={source.label}
                    disabled={Boolean(savingId)}
                    onBlur={(event) => {
                      const label = event.currentTarget.value.trim();
                      if (label && label !== source.label) {
                        void updateSource(source, { label }).catch(() => {
                          event.currentTarget.value = source.label;
                        });
                      } else {
                        event.currentTarget.value = source.label;
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        event.currentTarget.value = source.label;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                {dims.length ? (
                  <div className="mon-source-dim-badges">
                    {dims.map(([key, value]) => <span key={key}>{dimensionLabel(key)}: {value}</span>)}
                  </div>
                ) : null}
              </div>
              {/* R1: el identificador no ocupa una columna.
                *
                * Era `1V9Tjh-suREXNEyZ8Za…` recortado en cada fila: no dice
                * nada, no lleva a ninguna parte y desplazaba a lo único que
                * esa esquina puede aportar —cómo abrir la fuente—. El enlace
                * ocupa su sitio y el identificador viaja en el `title`. */}
              <span>
                {saving ? "Guardando..." : (() => {
                  const enlace = enlaceDeFuente(source);
                  return enlace.estado === "enlace" ? (
                    <a href={enlace.href} target="_blank" rel="noreferrer" title={sourceExternalId(source)}>
                      Abrir
                    </a>
                  ) : <i title={sourceExternalId(source)}>{sourceProviderLabel(source.kind)}</i>;
                })()}
              </span>
              <em>{displayedSync}</em>
            </div>
          );
        })}
        {!sources.length ? <div className="mon-sm-empty">Aún no hay fuentes configuradas</div> : null}
      </div>
    </aside>
  );
}

// Adaptador local sobre la tira canónica compartida (components/SourceSyncActions):
// conserva la firma histórica de este profile y aplica el vocabulario uniforme
// (fuentes por nombre + "Todo" para el sync completo).
function AcreditacionSourceSyncActions({
  sheetCount,
  surveyCount,
  totalCount,
  busy,
  progress = null,
  surveyLabel = "encuestas",
  surveyTitle = "encuestas de plataforma activas",
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sheetCount: number;
  surveyCount: number;
  totalCount: number;
  busy: boolean;
  progress?: SourceSyncActionsProgress | null;
  surveyLabel?: string;
  surveyTitle?: string;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  return (
    <SourceSyncActions
      className="mon-acr-source-sync-actions"
      ariaLabel="Actualizar fuentes telefónicas"
      busy={busy}
      progress={progress}
      actions={[
        { key: "sheets", label: "Sheets", title: sheetCount ? `${sheetCount} fuentes Sheets activas` : "Sin fuentes Sheets activas", icon: Layers3, disabled: !sheetCount, onRun: onSyncSheets },
        { key: "survey", label: surveyLabel, title: surveyCount ? `${surveyCount} ${surveyTitle}` : `Sin ${surveyTitle}`, icon: ListChecks, disabled: !surveyCount, onRun: onSyncSurvey },
        { key: "all", label: "Todo", title: totalCount ? `${totalCount} fuentes activas` : "Sin fuentes activas", icon: RefreshCw, disabled: !totalCount, primary: true, onRun: onSyncAll },
      ]}
    />
  );
}

function AcreditacionSourcePackageConsole({
  sources,
  activePresetKey,
  status,
  busy,
  onSelectPreset,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sources: MonitoreoSource[];
  activePresetKey: AcreditacionSourcePresetKey;
  status: AcreditacionActionStatus;
  busy: boolean;
  onSelectPreset: (key: AcreditacionSourcePresetKey) => void;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  const activePreset = ACREDITACION_SOURCE_PRESETS.find((preset) => preset.key === activePresetKey) ?? ACREDITACION_SOURCE_PRESETS[0];
  const basePreset = ACREDITACION_SOURCE_PRESETS[0];
  const sweepPreset = ACREDITACION_SOURCE_PRESETS[1];
  const surveyPreset = ACREDITACION_SOURCE_PRESETS[2];
  const baseSources = sourcesForPreset(sources, basePreset);
  const sweepSources = sourcesForPreset(sources, sweepPreset);
  const surveySources = sourcesForPreset(sources, surveyPreset);
  const activeSources = sources.filter((source) => source.enabled);
  const sheetCount = activeSources.filter((source) => source.kind === "google_sheets").length;
  const surveyCount = activeSources.filter(isPlatformResponseSource).length;

  return (
    <section className="mon-acr-sources-panel mon-acr-sources-panel--standalone">
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      <div className="mon-acr-fixed-source-shell">
        <AcreditacionSourceBlueprint
          sources={sources}
          activePresetKey={activePreset.key}
          onSelectPreset={onSelectPreset}
        />
        <AcreditacionSourceSyncActions
          sheetCount={sheetCount}
          surveyCount={surveyCount}
          totalCount={activeSources.length}
          busy={busy}
          onSyncSheets={onSyncSheets}
          onSyncSurvey={onSyncSurvey}
          onSyncAll={onSyncAll}
        />
        <div className="mon-acr-fixed-source-grid">
          <section className="mon-acr-platform-panel mon-acr-platform-panel--sheets" aria-label="Bases de Sheets">
            <header className="mon-acr-platform-head">
              <div>
                <span><Layers3 size={14} /> Paso 1 · Google Sheets</span>
                <strong>Base trabajada y barrido telefónico</strong>
              </div>
              <em>{fmt(baseSources.length + sweepSources.length)} conectadas</em>
            </header>
            <div className="mon-acr-requirement-grid">
              <AcreditacionSourceRequirementCard
                preset={basePreset}
                sources={baseSources}
                active={activePreset.key === basePreset.key}
                onSelect={() => onSelectPreset(basePreset.key)}
              />
              <AcreditacionSourceRequirementCard
                preset={sweepPreset}
                sources={sweepSources}
                active={activePreset.key === sweepPreset.key}
                onSelect={() => onSelectPreset(sweepPreset.key)}
              />
            </div>
          </section>
          <section className="mon-acr-platform-panel mon-acr-platform-panel--survey" aria-label="Encuestas de plataforma">
            <header className="mon-acr-platform-head">
              <div>
                <span><ListChecks size={14} /> Paso 2 · Kobo/plataforma</span>
                <strong>Respuestas por actor, segmento y canal</strong>
              </div>
              <em>{fmt(surveySources.length)} seleccionadas</em>
            </header>
            <AcreditacionSourceRequirementCard
              preset={surveyPreset}
              sources={surveySources}
              active={activePreset.key === surveyPreset.key}
              onSelect={() => onSelectPreset(surveyPreset.key)}
            />
            <div className="mon-acr-source-context">
              <strong>{activePreset.label}</strong>
              <span>{activePreset.detail}</span>
              <div className="mon-acr-source-step-tags">
                {activePreset.bullets.map((bullet) => <i key={bullet}>{bullet}</i>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function AcreditacionPhoneSourceSlotCard({
  slot,
  icon,
  syncFallback,
  rowFallback = 0,
  onSelect,
  onCambiar,
}: {
  slot: AcreditacionPhoneSourceSlot;
  icon: ReactNode;
  syncFallback?: string;
  rowFallback?: number;
  onSelect?: () => void;
  /** Abre el panel de conexión sobre la fuente de esta pieza. */
  onCambiar?: () => void;
}) {
  const active = slot.sources.filter((source) => source.enabled);
  const primary = active[0] ?? slot.sources[0] ?? null;
  const statusLabel = slot.status === "ready" ? "Lista" : slot.status === "inactive" ? "Inactiva" : "Pendiente";
  const statusDetail = slot.key === "universo"
    ? "define la base y las cuotas"
    : slot.key === "barrido"
      ? "define responsables y estados"
      : "define avance y cruce CodPulso";
  const rows = slot.sources.reduce((sum, source) => (
    sum + (slot.key === "plataforma" ? acreditacionSourceResponseCount(source) : sourceRowCount(source))
  ), 0) || rowFallback;
  const enlacePrimario = primary ? enlaceDeFuente(primary) : null;
  const syncLabel = primary ? sourceSyncLabel(primary) : "Sin sync";
  const displayedSync = syncLabel === "Sin sync" && slot.ready && syncFallback ? formatDate(syncFallback) : syncLabel;
  const isPlatform = slot.key === "plataforma";
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  return (
    <article
      className={`mon-phone-source-slot is-${slot.status}${onSelect ? " is-clickable" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="mon-phone-source-slot-main">
        <span className="mon-phone-source-slot-icon">{icon}</span>
        <div>
          <strong>{slot.label}</strong>
          <em>{slot.purpose}</em>
        </div>
        <span className="mon-phone-source-slot-status">{statusLabel}</span>
      </div>
      {/* Tres datos, no seis campos de formulario.
        *
        * Decía «Nombre: Barrido», «Abrir: Barrido» y «Pestaña: Barrido ·
        * Barrido!A1:Y2297»: el mismo nombre tres veces y un rango de hoja de
        * cálculo a la vista. Ahora el volumen manda —es lo que se viene a ver—,
        * el origen va en una línea con el enlace por delante y el rango baja al
        * `title`, y «Último sync» pasa a «Actualizada». «Se lee» solo aparece
        * cuando hay más de una fuente, que es cuando dice algo. */}
      <div className="mon-phone-source-slot-data">
        {/* Sin cifra no hay bloque: un «Listo» a 19 px ocupaba el sitio del
          * número y se leía como si fuera el dato. El estado ya lo dice el
          * distintivo de la cabecera. */}
        {rows ? (
          <span className="is-volumen">
            <strong>{fmt(rows)}</strong>
            <em>{isPlatform ? "respuestas" : slot.key === "universo" ? "personas por llamar" : "casos registrados"}</em>
          </span>
        ) : null}
        <span className="is-origen">
          <em>{isPlatform ? "Encuesta" : "Hoja"}</em>
          {enlacePrimario?.estado === "enlace" ? (
            <a
              href={enlacePrimario.href}
              target="_blank"
              rel="noreferrer"
              title={[enlacePrimario.titulo, !isPlatform ? sourceSheetField(primary, "range") : null].filter(Boolean).join(" · ")}
              onClick={(event) => event.stopPropagation()}
            >
              {primary ? nombreDeFuente(primary) : enlacePrimario.texto}
            </a>
          ) : (
            <strong>{enlacePrimario?.mensaje ?? "Sin fuente vinculada"}</strong>
          )}
        </span>
        <span>
          <em>Actualizada</em>
          <strong>{displayedSync}</strong>
        </span>
        {slot.sources.length > 1 ? (
          <span>
            <em>Se leen</em>
            <strong>{fmt(active.length)} de {fmt(slot.sources.length)}</strong>
          </span>
        ) : null}
      </div>
      <div className="mon-phone-source-slot-tags" aria-label={`Columnas esperadas para ${slot.label}`}>
        {slot.expected.map((item) => <i key={item}>{item}</i>)}
      </div>
      {/* La única puerta al cableado, y va al panel que ya conoce el guion del
        * estudio. Antes cada pestaña llevaba su propio formulario con la
        * dirección, la pestaña y el rango a la vista: dos caminos para lo mismo,
        * y el de Fuentes sin saber en qué orden pide las piezas este modo. */}
      {onCambiar ? (
        <button
          type="button"
          className="mon-phone-source-slot-cambiar"
          onClick={(event) => { event.stopPropagation(); onCambiar(); }}
        >
          {primary ? "Cambiar conexión" : "Conectar"}
        </button>
      ) : null}
    </article>
  );
}

function AcreditacionPhoneEffectiveFilterEditor({
  state,
  variables,
  platformSources,
  onStateChange,
}: {
  state?: MonitoreoState | null;
  variables: MonitoreoVariable[];
  platformSources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const filtroGuardado = state?.config?.monitoreo_profile?.platform_effective_filter;
  const criteriosGuardados = useMemo(() => criteriosDesdeFiltro(filtroGuardado), [filtroGuardado]);
  const filterKey = JSON.stringify(criteriosGuardados);
  const options = phoneEffectiveFilterQuestionOptions(variables, state?.source_metadata, platformSources);
  // Un criterio en edición es una variable y UN valor: los estudios declaran
  // «Consent = Yes», no un conjunto. La lista de valores del contrato sigue
  // existiendo para leer proyectos que sí traigan varios.
  const [borrador, setBorrador] = useState<Array<{ variable: string; value: string }>>(
    () => criteriosGuardados.map((criterio) => ({ variable: criterio.variable, value: criterio.values[0] ?? "" })),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const opcionDe = (variable: string) => (
    options.find((option) => normalizeSourceMatch(option.value) === normalizeSourceMatch(variable)) ?? null
  );
  const likelyFilterOptions = options.filter((option) => phoneEffectiveFilterQuestionScore(option) <= 2);
  // Las candidatas solo tienen sentido mientras no hay nada declarado: con un
  // criterio puesto, proponer «la pregunta que probablemente sea» compite con lo
  // que el usuario ya decidió.
  const suggestedOptions = (borrador.length ? [] : uniqueDisplayValues(
    likelyFilterOptions.map((option) => option.value),
  ).map((value) => options.find((option) => option.value === value)).filter(Boolean).slice(0, 3)) as PhoneEffectiveFilterQuestionOption[];
  const criterios = borrador
    .filter((item) => item.variable.trim() && item.value.trim())
    .map((item) => ({
      variable: item.variable.trim(),
      values: [item.value.trim()],
      label: (() => { const option = opcionDe(item.variable); return option ? phoneEffectiveFilterLabel(option) : item.variable.trim(); })(),
      value_label: item.value.trim(),
    }));
  const configured = criterios.length > 0;

  useEffect(() => {
    setBorrador(criteriosGuardados.map((criterio) => ({ variable: criterio.variable, value: criterio.values[0] ?? "" })));
  }, [filterKey]);

  const agregarCriterio = () => setBorrador((actual) => [...actual, { variable: "", value: "" }]);
  const quitarCriterio = (indice: number) => setBorrador((actual) => actual.filter((_, i) => i !== indice));
  const cambiarCriterio = (indice: number, cambio: { variable?: string; value?: string }) => {
    setBorrador((actual) => actual.map((item, i) => (i === indice ? { ...item, ...cambio } : item)));
  };

  const saveFilter = async () => {
    if (!state?.config) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando filtro Kobo..." });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: {
          ...state.config.monitoreo_profile,
          platform_effective_filter: filtroDesdeCriterios(criterios),
        },
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Filtro Kobo actualizado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`mon-platform-rejection-rule mon-phone-effective-filter${configured ? " is-configured" : " is-empty"}`} aria-label="Filtro de efectiva Kobo">
      {/* El título decía «Intro/Consent = Yes» y las celdas de abajo lo componen
        * otra vez, campo a campo, a 40 px. Aquí va lo que la superficie hace; el
        * valor vive en las filas, que es donde se cambia.
        *
        * También sale el párrafo que describía los propios controles: «Pregunta
        * de selección única» y «Valor que cuenta» ya se rotulan solos. */}
      <header>
        <div>
          <span><Filter size={12} /> Filtro de efectiva Kobo</span>
          <strong>{resumenDeCriterios(criterios)}</strong>
        </div>
        <button type="button" onClick={() => void saveFilter()} disabled={saving || !state?.config}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar filtro
        </button>
      </header>
      {suggestedOptions.length ? (
        <div className="mon-phone-filter-suggestions" aria-label="Sugerencias de filtro de efectiva">
          <span>Preguntas candidatas</span>
          {suggestedOptions.map((option) => {
            const value = preferredPhoneEffectiveValue(option.choices);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBorrador([{ variable: option.value, value }])}
                disabled={saving}
              >
                <strong>{phoneEffectiveFilterLabel(option)}</strong>
                <em>{value ? `Cuenta: ${value}` : `${fmt(option.choices.length)} valores`}</em>
              </button>
            );
          })}
        </div>
      ) : null}
      {/* Los criterios se exigen todos a la vez. El «y» entre filas no es
        * decorativo: es la única operación posible, y decirlo evita que alguien
        * lea la lista como alternativas. */}
      <div className="mon-platform-rule-list mon-phone-filter-criterios">
        {borrador.map((item, indice) => {
          const option = opcionDe(item.variable);
          const valueOptions = phoneEffectiveFilterAnswerOptions(options, item.variable, item.value);
          return (
            <article key={indice} className="mon-platform-rule-row mon-platform-rule-row--filter">
              <i className="mon-phone-filter-conjuncion" aria-hidden="true">{indice === 0 ? "Cuenta si" : "y"}</i>
              <label>
                <span>Pregunta de selección única</span>
                <select
                  value={item.variable}
                  onChange={(event) => {
                    const variable = event.target.value;
                    const elegida = options.find((candidata) => candidata.value === variable);
                    const value = elegida?.choices.some((choice) => normalizeSourceMatch(choice) === normalizeSourceMatch(item.value))
                      ? item.value
                      : preferredPhoneEffectiveValue(elegida?.choices ?? []);
                    cambiarCriterio(indice, { variable, value });
                  }}
                  disabled={saving}
                >
                  <option value="">Seleccionar pregunta</option>
                  {options.map((candidata) => (
                    <option key={candidata.value} value={candidata.value} title={phoneEffectiveFilterLabel(candidata)}>
                      {compactSelectLabel(phoneEffectiveFilterLabel(candidata))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Valor que cuenta</span>
                <select
                  value={item.value}
                  onChange={(event) => cambiarCriterio(indice, { value: event.target.value })}
                  disabled={saving || !item.variable}
                >
                  {valueOptions.length ? valueOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  )) : <option value={item.value}>{item.value || "Sin valores"}</option>}
                </select>
              </label>
              <button
                type="button"
                className="mon-phone-filter-quitar"
                onClick={() => quitarCriterio(indice)}
                disabled={saving}
                aria-label={`Quitar criterio ${option ? phoneEffectiveFilterLabel(option) : indice + 1}`}
              >
                <X size={13} />
              </button>
            </article>
          );
        })}
        <button
          type="button"
          className="mon-phone-filter-agregar"
          onClick={agregarCriterio}
          disabled={saving}
        >
          <Plus size={13} />
          <span>{borrador.length ? "Agregar otra condición" : "Definir la primera condición"}</span>
        </button>
      </div>
      <footer>
        <span>{fmt(options.length)} preguntas con valores</span>
        <span>{platformSources.length ? `${fmt(platformSources.length)} fuente${platformSources.length === 1 ? "" : "s"} Kobo` : "Sin Kobo"}</span>
      </footer>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionPhoneSourcesContractPanel({
  state,
  sources,
  reports,
  syncedAt,
  nRows = 0,
  pestana = "activas",
  onStateChange,
  onSourceTabChange,
}: {
  state?: MonitoreoState | null;
  sources: MonitoreoSource[];
  /** El corte: de él salen los estados crudos que el barrido trajo. */
  reports: MonitoreoAcreditacionReports;
  syncedAt?: string;
  nRows?: number;
  pestana?: PestanaDeFuentes;
  onStateChange?: (state: MonitoreoState) => void;
  onSourceTabChange?: (tab: AcreditacionSourceTab) => void;
}) {
  const contract = buildAcreditacionPhoneSourceContract(sources);
  // El reparto por pestaña vive en `fuentes/repartoDePestanas`, con test. Antes
  // eran cinco booleanos aquí, y dos de ellos sólo gobernaban el `open` del
  // `<details>`: los dos bloques de configuración se montaban en las tres
  // pestañas, así que «Encuestas» ofrecía configurar hojas de cálculo.
  const reparto = repartoDeFuentes(pestana, contract.ready);
  const abrirConectarFuente = useAbrirConectarFuente();
  // Los crudos salen del bloque que el motor ya publica: el definidor no inventa
  // estados, confirma los que ESTE corte trajo, con su volumen.
  const estadosDelBarrido = useMemo(
    () => rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]).map((fila) => ({
      label: phoneRowValue(fila, ["Estado", "Estatus", "Categoria", "Categoría"], ""),
      value: phoneRowNumber(fila, ["Casos", "Valor", "Total"], 0),
    })),
    [reports],
  );
  const platformSources = contract.platform.sources;
  const respuestasLeidas = platformSources
    .filter((source) => source.enabled)
    .reduce((sum, source) => sum + acreditacionSourceResponseCount(source), 0);
  const missingLabel = contract.missing.length
    ? contract.missing.map((item) => (
      item === "universo"
        ? "base de universo"
        : item === "barrido"
          ? "barrido"
          : "la encuesta"
    )).join(", ")
    : "contrato completo";
  // El título declara qué es esta superficie (C1). No lleva antetítulo: el
  // chrome ya dice el nombre de la pestaña justo encima, y repetirlo ahí era la
  // tercera vez que se leía «Universo y barrido» en la misma pantalla.
  //
  // Y no lleva sermón. Los detalles decían «Los estados del barrido son consulta
  // operativa; la efectiva la decide Kobo» o «El consentimiento decide cuáles
  // cuentan en el avance»: enunciados de doctrina, verdaderos y sin uso, que
  // ocupaban el sitio donde debía ir el dato de ESTE corte. El único detalle que
  // sobrevive es el que informa de algo que está pasando y que no se ve en
  // ningún otro sitio —una encuesta conectada que no ha traído nada, con el
  // avance en cero y nada roto que mirar—.
  const titulos: Record<PestanaDeFuentes, { title: string; detail?: string }> = {
    sheets: { title: "Universo y barrido" },
    survey: {
      title: "Encuesta",
      detail: contract.platform.ready && !respuestasLeidas
        ? "Conectada, sin respuestas todavía. Sincroniza Kobo."
        : undefined,
    },
    activas: { title: "Fuentes del estudio" },
  };
  const copia = titulos[pestana];
  const slotPorClave: Record<RepartoDeFuentes["slots"][number], AcreditacionPhoneSourceSlot> = {
    universo: contract.universe,
    barrido: contract.sweep,
    plataforma: contract.platform,
  };
  return (
    <section className={`mon-phone-source-contract is-pestana-${pestana}${contract.ready ? " is-ready" : " has-missing"}`} aria-label="Contrato de fuentes telefónicas">
      <header className="mon-phone-source-contract-head">
        <div>
          <strong>{copia.title}</strong>
          {copia.detail ? <p>{copia.detail}</p> : null}
        </div>
        <em>{contract.ready ? "Listo para monitoreo" : `Falta ${missingLabel}`}</em>
      </header>
      {/* El resumen muestra la cadena; las pestañas de decisión, sus tarjetas.
        * Ninguna pinta las dos cosas: eso era lo que hacía de «Fuentes activas»
        * la unión literal de las otras dos. */}
      {reparto.cadena ? (
        <CadenaDeFuentes
          eslabones={eslabonesDelContrato(contract, nRows, syncedAt)}
          onIr={(clave) => onSourceTabChange?.(clave === "plataforma" ? "survey" : "sheets")}
        />
      ) : null}
      {reparto.slots.length ? (
        <div className="mon-phone-source-contract-grid">
          {reparto.slots.map((clave) => (
            <AcreditacionPhoneSourceSlotCard
              key={clave}
              slot={slotPorClave[clave]}
              icon={clave === "universo" ? <Layers3 size={15} /> : clave === "barrido" ? <PhoneCall size={15} /> : <ListChecks size={15} />}
              rowFallback={clave === "universo" ? nRows : undefined}
              syncFallback={syncedAt}
              onCambiar={() => abrirConectarFuente.abrirParaCambiar(
                slotPorClave[clave].sources.find((source) => source.enabled)?.id
                  ?? slotPorClave[clave].sources[0]?.id,
              )}
            />
          ))}
        </div>
      ) : null}
      {/* Sin bloque de instrumento intermedio: decía el nombre de la encuesta
        * tres veces más —cabecera, «Instrumento activo» y el paso 1 de su
        * tira—, repetía el filtro que el editor de abajo ya declara, y uno de
        * sus cuatro pasos hablaba de las hojas, que se deciden en otra pestaña.
        * El formulario lo declara su tarjeta, con enlace; el filtro, el editor. */}
      {reparto.decisionKobo ? (
        <AcreditacionPhoneEffectiveFilterEditor
          state={state}
          variables={state?.variables ?? []}
          platformSources={platformSources}
          onStateChange={onStateChange}
        />
      ) : null}
      {/* Sin editores de conexión: la dirección de la hoja, su pestaña, el rango
        * y el servidor de Kobo se declaran al conectar la fuente, y esta sección
        * no es donde se cablea el estudio sino donde se declara qué significan
        * sus números. La puerta al cableado es «Cambiar conexión» en la tarjeta
        * de cada pieza, que abre el mismo panel con esa fuente cargada.
        *
        * Lo que sí se decide aquí es el significado: qué familia y qué color le
        * corresponde a cada estado que el cliente escribió en su hoja de
        * barrido. El vocabulario lo pone él y cambia entre estudios; hasta ahora
        * lo clasificaba una heurística sola y sin que nadie pudiera corregirla,
        * y los colores estaban escritos a mano en cada vista que los pintaba. */}
      {reparto.declaracionDeEstados ? (
        <DefinidorDeEstados
          entradas={estadosDelBarrido}
          config={state?.config}
          onStateChange={onStateChange}
        />
      ) : null}
    </section>
  );
}

function AcreditacionSourcesWorkbench({
  reports,
  state,
  activeTab = "survey",
  onStateChange,
  onSourceTabChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionSourceTab;
  onStateChange?: (state: MonitoreoState) => void;
  onSourceTabChange?: (tab: AcreditacionSourceTab) => void;
}) {
  const client = reports.client_report;
  const reportSources = (client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"])) as Array<Record<string, unknown>>;
  const configuredSources = state?.sources ?? [];
  const operationalSources = useMemo(
    () => configuredSources.map((source) => acreditacionSourceWithOperationalMetadata(source, state?.source_metadata)),
    [configuredSources, state?.source_metadata],
  );
  // Acciones de sincronización extraídas a sync/useSourceSyncActions: Sheets
  // corre como job en segundo plano (async opt-in) y la espera sigue amarrada
  // al desmontaje del componente.
  const { syncBusy, syncStatus, syncProgress, syncSheets, syncExternal } = useSourceSyncActions({ onStateChange });
  const isPhoneSourceModel = isTelefonicoMonitoreoState(state);
  const platformSources = isPhoneSourceModel ? acreditacionKoboResponseSources(operationalSources) : operationalSources.filter(isPlatformResponseSource);
  const sheetSources = operationalSources.filter((source) => source.kind === "google_sheets");
  const activeSources = operationalSources.filter((source) => source.enabled);
  const activeSurveySources = platformSources.filter((source) => source.enabled);
  const activeSheetSources = sheetSources.filter((source) => source.enabled);

  const sourceStatus = (
    <AcreditacionSourceStatusStrip
      sources={operationalSources}
      reports={reports}
      phoneMode={isPhoneSourceModel}
      status={syncStatus}
      busy={Boolean(syncBusy)}
      progress={syncProgress}
      // El papel llega precargado desde la pestaña: quien está en «Encuestas»
      // viene a conectar respuestas, no una hoja de universo.
      papelAlConectar={repartoDeFuentes(pestanaDeFuentesDesde(activeTab), true).papelAlConectar}
      actoresSugeridos={acreditacionActorOptions(operationalSources)}
      onStateChange={onStateChange}
      onSyncSheets={() => syncSheets(activeSheetSources.map((source) => source.id))}
      onSyncSurvey={() => syncExternal("survey", activeSurveySources.map((source) => source.id), isPhoneSourceModel ? "Actualizacion Kobo" : "Actualizacion de plataforma", "full")}
      onSyncAll={() => syncExternal("all", activeSources.map((source) => source.id), "Actualizacion completa", "full")}
    />
  );
  const phoneSourceContract = (pestana: PestanaDeFuentes = "activas") => isPhoneSourceModel ? (
    <AcreditacionPhoneSourcesContractPanel
      state={state}
      sources={operationalSources}
      reports={reports}
      syncedAt={state?.synced_at ?? reports.generated_at}
      nRows={state?.n_rows ?? 0}
      pestana={pestana}
      onStateChange={onStateChange}
      onSourceTabChange={onSourceTabChange}
    />
  ) : null;

  if (activeTab === "survey") {
    return (
      <div className="mon-profile-stack mon-phone-source-tab is-kobo">
        {sourceStatus}
        {isPhoneSourceModel ? phoneSourceContract("survey") : (
          <AcreditacionPlatformSurveySourcesView
            sources={operationalSources}
            config={state?.config}
            onStateChange={onStateChange}
          />
        )}
      </div>
    );
  }

  if (activeTab === "sheets") {
    return (
      <div className="mon-profile-stack mon-phone-source-tab is-sheets">
        {sourceStatus}
        {phoneSourceContract("sheets")}
        {!isPhoneSourceModel ? (
          <AcreditacionSheetsByActorView
            sources={operationalSources}
            onStateChange={onStateChange}
          />
        ) : null}
      </div>
    );
  }

  if (activeTab === "collectors") {
    return (
      <div className="mon-profile-stack">
        {sourceStatus}
        <AcreditacionCollectorsSourceView
          sources={operationalSources}
          config={state?.config}
          onStateChange={onStateChange}
        />
      </div>
    );
  }

  return (
    <div className={`mon-profile-stack${isPhoneSourceModel ? " mon-phone-source-tab is-package" : ""}`}>
      {sourceStatus}
      {isPhoneSourceModel ? (
        <>
          {phoneSourceContract("activas")}
          <AcreditacionConfiguredSourcesList
            sources={operationalSources}
            syncFallback={state?.synced_at ?? reports.generated_at}
            phoneMode={isPhoneSourceModel}
            onStateChange={onStateChange}
          />
        </>
      ) : (
        <AcreditacionActiveSourcesView
          sources={operationalSources}
          config={state?.config}
          reportSources={reportSources}
          state={state}
          onStateChange={onStateChange}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className={`mon-profile-stat mon-profile-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
  maxColumns = 8,
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
  maxColumns?: number;
}) {
  if (!rows.length) return <p className="mon-profile-muted">{empty}</p>;
  // Ningún recorte en silencio: ochenta filas y ocho columnas seguían siendo el
  // límite, pero antes desaparecían datos sin que nada lo dijera.
  const todasLasColumnas = compactColumns(rows, preferredColumns, Number.MAX_SAFE_INTEGER);
  const recorteColumnas = recorteTabla(todasLasColumnas, maxColumns, "columna");
  const columns = recorteColumnas.visibles;
  const recorteFilas = recorteTabla(rows, 80);
  const avisos = [recorteFilas.etiqueta, recorteColumnas.etiqueta].filter(Boolean);
  return (
    <div className="mon-profile-table-wrap">
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {recorteFilas.visibles.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{rowValue(row, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {avisos.length ? (
        <p className="mon-profile-table-recorte">{avisos.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function downloadRowsAsCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length || typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return;
  const columns = compactColumns(rows, [], 60);
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

type AcreditacionCaseFilters = {
  search: string;
  actor: string;
  date: string;
  channel: string;
  source: string;
  collector: string;
  response: string;
  crossing: string;
};

const EMPTY_CASE_FILTERS: AcreditacionCaseFilters = {
  search: "",
  actor: "",
  date: "",
  channel: "",
  source: "",
  collector: "",
  response: "",
  crossing: "",
};

const RESPONSE_FILTER_ORDER = ["complete", "partial", "refusal", "pending"];

function normalizeCaseSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

function caseIdentity(item: MonitoreoInternalQueryCase) {
  return item.response_id || item.case_key || `${item.actor}-${item.response_row}-${item.person_label}`;
}

function caseDisplayName(item: MonitoreoInternalQueryCase) {
  return String(item.person_label || item.case_key || item.response_id || "Caso sin llave")
    .toLocaleLowerCase("es-PE")
    .replace(/(^|[\s,.'’()-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("es-PE")}`);
}

function caseMatchesFilters(item: MonitoreoInternalQueryCase, filters: AcreditacionCaseFilters) {
  return filterInternalQueryCases([item], {
    search: filters.search,
    actor: filters.actor,
    date: filters.date,
    channel: filters.channel,
    collector: filters.collector,
    source: filters.source,
    response: filters.response,
    state: "",
    crossing: filters.crossing,
  }).length > 0;
}

function consultaFiltersForTab(filters: AcreditacionCaseFilters, tab: AcreditacionConsultaTab): AcreditacionCaseFilters {
  if (tab === "base") {
    return {
      ...EMPTY_CASE_FILTERS,
      search: filters.search,
      actor: filters.actor,
      response: filters.response,
    };
  }
  return filters;
}

function countCaseOptions(
  cases: MonitoreoInternalQueryCase[],
  valueForCase: (item: MonitoreoInternalQueryCase) => string,
  labelForValue: (value: string) => string = (value) => value,
  order: string[] = [],
) {
  const counts = new Map<string, number>();
  cases.forEach((item) => {
    const value = valueForCase(item);
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: labelForValue(value), count }))
    .sort((a, b) => {
      const aIndex = order.indexOf(a.value);
      const bIndex = order.indexOf(b.value);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      return a.label.localeCompare(b.label, "es");
    });
}

function caseChannelValue(item: MonitoreoInternalQueryCase) {
  return item.channel || "";
}

function caseSourceValue(item: MonitoreoInternalQueryCase) {
  return item.source_label || item.source_id || item.base_source || "";
}

function telefonicoCaseActorValue(item: MonitoreoInternalQueryCase) {
  const value = String(item.actor ?? "").trim();
  if (!value) return "";
  const key = normalizeSourceMatch(value);
  if (
    key.includes("base de barrido") ||
    key.includes("base telefonica") ||
    key.includes("listado telefonico") ||
    key.includes("acnur pdm")
  ) {
    return "";
  }
  return value;
}

function telefonicoBaseLocationLabel(value: string) {
  if (value === "cruzo_llave" || value === "cruzo_correo") return "CodPulso ubicado";
  if (value === "sin_llave") return "Sin CodPulso";
  if (value === "sin_cruce" || value === "no_cruzo") return "Fuera de base";
  return internalCaseCrossingLabel(value);
}

function caseCollectorValue(item: MonitoreoInternalQueryCase) {
  return internalQueryCollectorValue(item) || item.collector_id || "";
}

function caseToneClass(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "is-effective";
  if (response === "partial") return "is-partial";
  if (response === "refusal") return "is-refusal";
  return "is-muted";
}

function caseWithoutCrossing(item: MonitoreoInternalQueryCase) {
  const crossing = internalCaseCrossingValue(item);
  return crossing === "sin_cruce" || crossing === "sin_llave" || crossing === "sin_base";
}

function caseHasPlatformResponse(item: MonitoreoInternalQueryCase) {
  if (String(item.response_id || "").trim()) return true;
  const responseMarker = String(item.source_id || item.source_label || "").trim() || Number(item.response_row ?? 0) > 0;
  if (!responseMarker) return false;
  const responseState = internalCaseResponseStateValue(item);
  if (responseState && responseState !== "pending") return true;
  const platformState = normalizeCaseSearch(item.platform_state);
  return Boolean(platformState && !platformState.includes("sin respuesta") && !platformState.includes("pending"));
}

function caseResponseSortTime(item: MonitoreoInternalQueryCase) {
  const raw = String(item.response_datetime || item.date || "").trim();
  if (!raw || normalizeCaseSearch(raw).includes("sin fecha")) return 0;
  const date = raw.includes("T") || raw.includes(":") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function caseResponseDateTimeLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (rawDateTime) {
    const date = new Date(rawDateTime);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    }
    return rawDateTime;
  }
  const rawDate = String(item.date || "").trim();
  if (!rawDate) return "Sin fecha";
  return formatInternalQueryDateLabel(rawDate);
}

export function caseResponseTimeDetailLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (!rawDateTime) return "Sin hora registrada";
  const date = new Date(rawDateTime);
  if (Number.isNaN(date.getTime())) return "Hora no normalizada";
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function comparePlatformCases(a: MonitoreoInternalQueryCase, b: MonitoreoInternalQueryCase) {
  return caseResponseSortTime(b) - caseResponseSortTime(a) ||
    String(b.response_row ?? "").localeCompare(String(a.response_row ?? ""), "es", { numeric: true }) ||
    caseDisplayName(a).localeCompare(caseDisplayName(b), "es");
}

export function caseIsSubsanacionCandidate(item: MonitoreoInternalQueryCase) {
  return caseHasPlatformResponse(item) && caseWithoutCrossing(item);
}

export function caseIsActionableSubsanacion(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  return caseIsSubsanacionCandidate(item) && (response === "complete" || response === "partial");
}

function caseSubsanacionActionLabel(item: MonitoreoInternalQueryCase) {
  if (caseIsActionableSubsanacion(item)) return "Subsanar";
  if (internalCaseResponseStateValue(item) === "refusal") return "No accionable";
  if (internalCaseResponseStateValue(item) === "pending") return "Sin respuesta";
  return assistedReviewVisible(item) ? "Revisar" : "Explicar";
}

function caseIsAuditable(item: MonitoreoInternalQueryCase) {
  return (
    item.advancement !== "effective" ||
    caseWithoutCrossing(item) ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    caseCountsInAdvance(item) === false ||
    Boolean(casePhoneAction(item)) ||
    Boolean(String(item.issue_type || "").trim())
  );
}

function explicitBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "si", "sí", "yes", "cuenta", "cuenta en avance"].includes(normalized)) return true;
  if (["false", "0", "no", "no cuenta", "no cuenta en avance"].includes(normalized)) return false;
  return null;
}

function caseCountsInAdvance(item: MonitoreoInternalQueryCase): boolean | null {
  const explicit = explicitBoolean(item.counts_in_advance);
  if (explicit !== null) return explicit;
  const status = String(item.duplicate_counting_status ?? "").toLowerCase();
  if (status.includes("no cuenta")) return false;
  if (status.includes("cuenta")) return true;
  if (item.advancement === "effective") return true;
  if (["partial", "refusal", "pending", "excluded"].includes(item.advancement)) return false;
  return null;
}

function telefonicoCaseHasEffectiveCaveat(item: MonitoreoInternalQueryCase) {
  const key = normalizeCaseSearch([
    item.issue_type,
    item.decision,
    item.decision_reason,
    item.base_result,
    item.rule,
  ].join(" "));
  return (
    key.includes("salvedad") ||
    key.includes("sin cruce") ||
    key.includes("sin base") ||
    key.includes("fuera base") ||
    key.includes("fuera de base") ||
    key.includes("no identific") ||
    (caseCountsInAdvance(item) === true && caseWithoutCrossing(item))
  );
}

function telefonicoCaseDeclaresEffective(item: MonitoreoInternalQueryCase) {
  const key = normalizeCaseSearch([
    item.base_status,
    item.secondary_identity_value,
    item.phone_audit?.link_base?.status,
  ].join(" "));
  if (!key || key.includes("sin efectiva") || key.includes("no efectiva")) return false;
  return key.includes("efectiv");
}

function telefonicoCasePlatformEffective(item: MonitoreoInternalQueryCase) {
  const key = normalizeCaseSearch([
    item.platform_state,
    item.decision_reason,
    item.rule,
    item.decision,
    item.advancement,
  ].join(" "));
  if (key.includes("sin efectiva kobo") || key.includes("sin plataforma") || key.includes("tel efectiva sin efectiva kobo")) return false;
  if (key.includes("efectiva kobo") || key.includes("completa")) return true;
  if (item.counts_in_advance === false || item.counts_in_advance === "false") return false;
  return item.advancement === "effective";
}

function telefonicoCaseIsConsultedEffective(item: MonitoreoInternalQueryCase) {
  const responseState = internalCaseResponseStateValue(item);
  const platformState = normalizeCaseSearch(item.platform_state);
  const counts = caseCountsInAdvance(item);
  const complete = responseState === "complete" || platformState.includes("completa") || platformState.includes("complete");
  const effectiveAdvance = item.advancement === "effective" || item.advancement === "included_review" || counts === true;
  return caseHasPlatformResponse(item) && complete && effectiveAdvance && counts !== false;
}

function telefonicoCleanCodPulso(value: unknown) {
  const raw = String(value ?? "").replace(/^codigo:/i, "").trim();
  if (!raw) return "";
  const match = raw.match(/^(?:PDM\s*)?(\d{3,6})$/i);
  if (match) return `PDM ${match[1]}`;
  const embedded = raw.match(/PDM\s*(\d{3,6})/i);
  if (embedded) return `PDM ${embedded[1]}`;
  return raw;
}

function telefonicoCaseCodPulsoLabel(item: MonitoreoInternalQueryCase) {
  return telefonicoCleanCodPulso(item.person_label || item.case_key || item.base_record || item.response_id) || "Sin CodPulso";
}

function telefonicoCaseOutsideBase(item: MonitoreoInternalQueryCase) {
  return normalizeCaseSearch([
    item.base_status,
    item.base_result,
    item.decision_reason,
    item.rule,
    item.phone_audit?.recommended_action,
  ].join(" ")).includes("fuera de base");
}

function telefonicoCaseBaseTrace(item: MonitoreoInternalQueryCase) {
  const outsideBase = telefonicoCaseOutsideBase(item);
  const rawRecord = item.base_record || item.phone_audit?.link_base?.record || "";
  const cleaned = telefonicoCleanCodPulso(rawRecord || item.case_key);
  const hasBaseRecord = !outsideBase && Boolean(rawRecord);
  if (outsideBase) {
    return {
      outsideBase,
      found: false,
      tone: "warning" as const,
      label: "Fuera de base",
      detail: "Kobo trae la efectiva, pero no hay respaldo en la base telefónica.",
    };
  }
  if (hasBaseRecord) {
    return {
      outsideBase,
      found: true,
      tone: "base" as const,
      label: "CodPulso ubicado",
      detail: cleaned
        ? `${cleaned} esta en la base; esto no cambia el estado telefonico.`
        : "CodPulso ubicado; esto no cambia el estado telefonico.",
    };
  }
  return {
    outsideBase,
    found: false,
    tone: "caveat" as const,
    label: "Base por revisar",
    detail: item.base_result || item.decision_reason || "Sin registro de base confirmado.",
  };
}

function telefonicoConsultedEffectiveCases(cases: MonitoreoInternalQueryCase[]) {
  return cases.filter(telefonicoCaseIsConsultedEffective).sort((a, b) => (
    Number(telefonicoCaseHasEffectiveCaveat(b)) - Number(telefonicoCaseHasEffectiveCaveat(a)) ||
    comparePlatformCases(a, b)
  ));
}

function phoneComparisonDateValue(row: Record<string, unknown>) {
  const rawDate = phoneRowValue(row, [
    "Fecha Kobo",
    "Fecha plataforma",
    "Fecha respuesta",
    "Fecha",
    "Última respuesta",
    "Ultima respuesta",
    "submitted_at",
    "submission_time",
  ], "");
  if (isAcreditacionNoDateLabel(rawDate)) return { date: "", responseDatetime: "" };
  const isoDate = rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  const hasTime = /(?:T|\s)\d{1,2}:\d{2}/.test(rawDate);
  return {
    date: isoDate || rawDate,
    responseDatetime: hasTime ? rawDate : "",
  };
}

function phoneComparisonRowIsTest(row: Record<string, unknown>) {
  const key = normalizeSourceMatch(phoneRowValue(row, [
    "Es prueba",
    "Prueba",
    "Tipo entrevista",
    "Tipo de entrevista",
    "Entrevista",
    "Entrevista real",
    "Detalles de la entrevista / ¿Es una entrevista real?",
  ], ""));
  return key.includes("prueba") || key.includes("test");
}

function phoneComparisonRowToConsultedCase(row: Record<string, unknown>, index: number): MonitoreoInternalQueryCase {
  const rawCode = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código", "Llave"], "");
  const code = telefonicoCleanCodPulso(rawCode);
  const responseId = phoneRowValue(row, [
    "Response ID",
    "Respuesta ID",
    "ID respuesta",
    "ID Kobo",
    "_id",
    "uuid",
    "submission_id",
  ], "") || `kobo-${code || "sin-codpulso"}-${index + 1}`;
  const responsible = phoneRowValue(row, ["Responsable", "Operador", "Encuestador", "Asignado", "Recolector"], "");
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  const platformStatus = phoneRowValue(row, ["Avance plataforma", "Estado plataforma", "Estado Kobo"], "") || "Completa";
  const actor = phoneRowValue(row, ["Sede", "Cuota", "Segmento", "Variable rectora"], "");
  const source = phoneRowValue(row, ["Fuente", "Encuesta / asset", "Encuesta", "Asset", "Servicio"], "") || "KoboToolbox";
  const baseRecord = phoneRowValue(row, ["Base", "Base record", "Registro base", "CodPulso base", "Código base"], "") || code;
  const mismatch = phonePlatformComparisonIsMismatch(row);
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const phoneStatusKey = normalizeCaseSearch(phoneStatus);
  const identityCaveat = !code || phoneStatusKey.includes("fuera de base");
  const baseResult = !code
    ? "Sin CodPulso para ubicar en base"
    : platformComplete && !phoneEffective
      ? "CodPulso ubicado; estado telefónico pendiente"
      : phoneEffective && !platformComplete
        ? "CodPulso ubicado; tel. efectiva sin Kobo"
        : mismatch
          ? "CodPulso ubicado; estados no alineados"
          : "CodPulso ubicado y efectivas alineadas";
  const { date, responseDatetime } = phoneComparisonDateValue(row);
  const label = phonePlatformComparisonLabel(row);

  return {
    actor,
    person_label: code || rawCode || responseId,
    case_key: code || rawCode,
    response_id: responseId,
    date,
    response_datetime: responseDatetime,
    source_id: "kobo",
    source_label: source,
    channel: "Kobo",
    collector_id: responsible,
    collector_name: responsible,
    platform_state: platformStatus,
    base_result: baseResult,
    base_record: baseRecord,
    base_source: "Base telefónica / barrido",
    base_status: phoneStatus,
    decision: platformComplete ? identityCaveat ? "include_with_caveat" : mismatch ? "effective_phone_pending" : "effective" : phoneEffective ? "telefono_sin_kobo" : "sin_efectiva",
    decision_reason: label,
    advancement: platformComplete ? "effective" : "pending",
    issue_type: identityCaveat ? "salvedad_codpulso" : mismatch ? "diferencia_estado_telefonico" : "",
    rule: label,
    pending_exit: false,
    recovery_collector: false,
    response_row: index + 1,
    duplicate_count: 1,
    counts_in_advance: platformComplete,
    identity_status: identityCaveat ? "sin_cruce" : "en_base",
    channel_key_strategy: "codpulso",
    channel_key_strategy_label: "Kobo: CodPulso declarado",
    primary_identity_label: "CodPulso Kobo",
    primary_identity_value: code || rawCode,
    secondary_identity_label: "Estado telefónico",
    secondary_identity_value: phoneStatus,
    review_priority: mismatch ? 1 : 0,
    phone_audit: {
      final_codpulso: code || rawCode,
      responsible,
      phone_match_level: identityCaveat ? "salvedad" : mismatch ? "diferencia_estado" : "coincide",
      recommended_action: identityCaveat ? "Revisar base frente a Kobo" : mismatch ? "Actualizar o explicar estado telefónico" : "Sin acción",
      link_base: {
        record: baseRecord,
        person_label: code || rawCode,
        case_key: code || rawCode,
        status: phoneStatus,
        responsible,
        source: "Barrido telefónico",
      },
    },
    assisted_review: null,
  };
}

function phoneComparisonRowIsComparable(row: Record<string, unknown>) {
  if (phoneComparisonRowIsTest(row)) return false;
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const matchLabel = normalizeSourceMatch(phoneRowValue(row, ["Coinciden efectivas"], ""));
  return phoneEffective || platformComplete || matchLabel === "no";
}

function telefonicoConsultedEffectiveCasesFromComparison(rows: Array<Record<string, unknown>>) {
  return rows
    .filter((row) => phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]) && !phoneComparisonRowIsTest(row))
    .map(phoneComparisonRowToConsultedCase)
    .sort((a, b) => (
      Number(telefonicoCaseHasEffectiveCaveat(b)) - Number(telefonicoCaseHasEffectiveCaveat(a)) ||
      comparePlatformCases(a, b)
    ));
}

function telefonicoComparableCasesFromComparison(rows: Array<Record<string, unknown>>) {
  return rows
    .filter(phoneComparisonRowIsComparable)
    .map(phoneComparisonRowToConsultedCase)
    .sort((a, b) => (
      Number(telefonicoCasePlatformEffective(b) !== telefonicoCaseDeclaresEffective(b)) -
      Number(telefonicoCasePlatformEffective(a) !== telefonicoCaseDeclaresEffective(a)) ||
      Number(telefonicoCaseHasEffectiveCaveat(b)) - Number(telefonicoCaseHasEffectiveCaveat(a)) ||
      comparePlatformCases(a, b)
    ));
}

function telefonicoConsultedEffectiveCasesFromSources(
  queryCases: MonitoreoInternalQueryCase[],
  comparisonRows: Array<Record<string, unknown>>,
) {
  const queryEffective = telefonicoConsultedEffectiveCases(queryCases);
  const comparisonEffective = telefonicoConsultedEffectiveCasesFromComparison(comparisonRows);
  return comparisonEffective.length > queryEffective.length ? comparisonEffective : queryEffective;
}

function caseCountsLabel(item: MonitoreoInternalQueryCase) {
  const counts = caseCountsInAdvance(item);
  if (counts === true) return "Cuenta";
  if (counts === false) return "No cuenta";
  return "Revisar";
}

function caseDuplicateLabel(item: MonitoreoInternalQueryCase) {
  const duplicateCount = Number(item.duplicate_count ?? item.duplicate_group_size ?? 0);
  if (duplicateCount > 1) return item.duplicate_counting_status || `${fmt(duplicateCount)} respuestas`;
  return item.duplicate_counting_status || "Sin duplicado";
}

function casePartialLabel(item: MonitoreoInternalQueryCase) {
  const answered = Number(item.partial_answered_questions ?? Number.NaN);
  const total = Number(item.partial_total_questions ?? Number.NaN);
  const pctValue = Number(item.partial_completion_pct ?? Number.NaN);
  if (Number.isFinite(answered) && Number.isFinite(total) && total > 0) {
    const percent = Number.isFinite(pctValue) ? pctValue : (answered / total) * 100;
    return `${fmt(answered)}/${fmt(total)} (${pct(percent)})`;
  }
  if (Number.isFinite(pctValue)) return pct(pctValue);
  return internalCaseResponseStateValue(item) === "partial" ? "Parcial sin detalle" : "";
}

function casePrimaryEvidence(item: MonitoreoInternalQueryCase) {
  const label = item.primary_identity_label || item.identity_label || item.channel_key_strategy_label || "Llave";
  const value = item.primary_identity_value || item.case_key || item.phone_audit?.cv_id || item.response_id || "";
  return value ? `${label}: ${value}` : "Sin evidencia primaria";
}

function caseSecondaryEvidence(item: MonitoreoInternalQueryCase) {
  const phone = item.phone_audit;
  if (item.secondary_identity_value) {
    return `${item.secondary_identity_label || "Evidencia secundaria"}: ${item.secondary_identity_value}`;
  }
  if (phone?.final_codpulso) return `Código final: ${phone.final_codpulso}`;
  if (phone?.declared_phone) return `Celular declarado: ${phone.declared_phone}`;
  if (phone?.manual_code_base?.case_key) return `Código manual: ${phone.manual_code_base.case_key}`;
  return "";
}

type AcreditacionCaseKeyEvidenceTone = "primary" | "secondary" | "base";

type AcreditacionCaseKeyEvidenceRow = {
  label: string;
  value: string;
  tone: AcreditacionCaseKeyEvidenceTone;
};

function cleanCaseKeyText(value: unknown) {
  return String(value ?? "").trim();
}

function caseKeyStrategyFallbackLabel(item: MonitoreoInternalQueryCase) {
  const key = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
    item.channel,
    item.collector_name,
    item.source_label,
  ].join(" "));
  if (key.includes("telefon")) return "Telefónico: enlace personalizado + código final";
  if (key.includes("whatsapp")) return "WhatsApp: pregunta de código PUCP";
  if (key.includes("qr") || key.includes("presencial") || key.includes("ficha")) return "QR presencial: pregunta de código PUCP";
  if (key.includes("correo") || key.includes("email") || key.includes("mail")) return "Correo: metadata del envío";
  if (key.includes("enlace") || key.includes("web") || key.includes("link") || key.includes("sms")) return "Enlace: pregunta de código PUCP";
  return "Llave configurada por fuente";
}

function caseKeyStrategyHint(item: MonitoreoInternalQueryCase) {
  const strategyKey = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
  ].join(" "));
  const channel = acreditacionChannelDisplay(item.channel || item.source_label);
  if (strategyKey.includes("llave configurada") || strategyKey.includes("configurada")) {
    return `Primero llave configurada para ${channel}; usar auxiliares para explicar o subsanar.`;
  }
  const key = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
    item.channel,
    item.collector_name,
    item.source_label,
  ].join(" "));
  if (key.includes("telefon")) return "Primero enlace personalizado; si no cruza, revisar código final y celular declarado.";
  if (key.includes("correo") || key.includes("email") || key.includes("mail")) return "Primero correo o metadata de envío; código declarado queda como apoyo.";
  if (key.includes("qr") || key.includes("presencial") || key.includes("ficha")) return "Primero código PUCP declarado en ficha QR; revisar digitación si queda sin cruce.";
  if (key.includes("whatsapp") || key.includes("enlace") || key.includes("web") || key.includes("link") || key.includes("sms")) return "Primero código PUCP declarado en el enlace; usar correo o nombre como apoyo.";
  return "Primero variable de llave configurada; usar auxiliares para explicar o subsanar.";
}

export function caseKeyTraceSummary(item: MonitoreoInternalQueryCase) {
  const phone = item.phone_audit;
  const channelLabel = acreditacionChannelDisplay(item.channel || item.source_label);
  const strategyLabelRaw = cleanCaseKeyText(item.channel_key_strategy_label) || caseKeyStrategyFallbackLabel(item);
  const strategyLabel = normalizeCaseSearch(strategyLabelRaw).includes("llave configurada") && channelLabel !== "Sin canal"
    ? `${channelLabel}: llave configurada por fuente`
    : strategyLabelRaw;
  const primaryLabel = cleanCaseKeyText(item.primary_identity_label || item.identity_label) || (
    normalizeCaseSearch(strategyLabel).includes("telefon") ? "Enlace usado" : "Llave leída"
  );
  const primaryValue = cleanCaseKeyText(item.primary_identity_value) ||
    cleanCaseKeyText(phone?.cv_id) ||
    cleanCaseKeyText(item.case_key);
  const secondaryLabel = cleanCaseKeyText(item.secondary_identity_label) || "Evidencia auxiliar";
  const secondaryValue = cleanCaseKeyText(item.secondary_identity_value) ||
    cleanCaseKeyText(phone?.final_codpulso) ||
    cleanCaseKeyText(phone?.declared_phone) ||
    cleanCaseKeyText(phone?.manual_code_base?.case_key);
  const baseValue = cleanCaseKeyText(item.base_record) ||
    cleanCaseKeyText(item.base_source) ||
    internalCaseCrossingLabel(internalCaseCrossingValue(item));
  const rows: AcreditacionCaseKeyEvidenceRow[] = [];
  const seen = new Set<string>();
  const addRow = (label: string, value: string, tone: AcreditacionCaseKeyEvidenceTone) => {
    const normalizedValue = cleanCaseKeyText(value);
    if (!normalizedValue) return;
    const id = `${normalizeCaseSearch(label)}:${normalizeCaseSearch(normalizedValue)}`;
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ label, value: normalizedValue, tone });
  };
  if (primaryValue) {
    addRow(primaryLabel, primaryValue, "primary");
  } else {
    rows.push({ label: primaryLabel, value: "Sin llave declarada", tone: "primary" });
  }
  addRow(secondaryLabel, secondaryValue, "secondary");
  addRow("Base / cruce", baseValue, "base");
  return {
    strategyLabel,
    strategyHint: caseKeyStrategyHint(item),
    channelLabel,
    primaryEvidence: rows[0] ? `${rows[0].label}: ${rows[0].value}` : "Sin evidencia primaria",
    secondaryEvidence: rows[1] ? `${rows[1].label}: ${rows[1].value}` : "",
    evidenceRows: rows,
  };
}

type AcreditacionSubsanacionGuideTone = "ready" | "warning" | "blocked" | "done";

function assistedReviewCandidateCountForCase(item: MonitoreoInternalQueryCase) {
  const seen = new Set<string>();
  [...(item.assisted_review?.candidates ?? []), ...(item.assisted_review?.assignment_candidates ?? [])].forEach((candidate) => {
    const id = cleanCaseKeyText(candidate.candidate_id || candidate.case_key || candidate.base_record || candidate.person_label);
    if (id) seen.add(id);
  });
  return seen.size;
}

export function acreditacionSubsanacionCaseGuide(item: MonitoreoInternalQueryCase | null) {
  if (!item) {
    return {
      tone: "warning" as AcreditacionSubsanacionGuideTone,
      badge: "Sin selección",
      title: "Elige un caso accionable",
      detail: "Empieza por una completa o parcial sin cruce; luego revisa llave, evidencia auxiliar y decisión.",
      primaryAction: "Seleccionar caso",
      steps: ["Abrir accionable", "Leer llave por canal", "Decidir con constancia"],
    };
  }
  const trace = caseKeyTraceSummary(item);
  const response = internalCaseResponseStateValue(item);
  const manual = item.assisted_review?.manual_decision ?? null;
  const candidateCount = assistedReviewCandidateCountForCase(item);
  const hasDeclaredKey = !normalizeCaseSearch(trace.primaryEvidence).includes("sin llave declarada");
  if (manual) {
    return {
      tone: "done" as AcreditacionSubsanacionGuideTone,
      badge: "Con constancia",
      title: manual.action === "include_with_caveat" ? "Ya fue incluida con salvedad" : "Ya quedó excluida",
      detail: manual.note || "Revisa la persona asignada y la nota registrada antes de cambiar la decisión.",
      primaryAction: "Auditar decisión registrada",
      steps: ["Revisar persona asignada", "Leer nota", "Mantener trazabilidad"],
    };
  }
  if (caseIsActionableSubsanacion(item)) {
    if (candidateCount > 0) {
      return {
        tone: "ready" as AcreditacionSubsanacionGuideTone,
        badge: `${fmt(candidateCount)} coincidencia${candidateCount === 1 ? "" : "s"}`,
        title: "Puede decidirse con evidencia",
        detail: "Compara la llave del canal con las coincidencias. Si la persona es correcta, confirma e incluye con salvedad; si no, mantenla excluida.",
        primaryAction: "Elegir persona o mantener excluida",
        steps: ["Confirmar llave", "Comparar candidato", "Guardar decisión"],
      };
    }
    if (!hasDeclaredKey && trace.secondaryEvidence) {
      return {
        tone: "warning" as AcreditacionSubsanacionGuideTone,
        badge: "Falta llave",
        title: "Primero identifica con evidencia auxiliar",
        detail: "No hay llave principal declarada. Usa correo, nombre u otra evidencia para buscar a la persona antes de incluirla.",
        primaryAction: "Buscar coincidencia antes de incluir",
        steps: ["Usar correo/nombre", "Buscar en universo", "Decidir con nota"],
      };
    }
    return {
      tone: "warning" as AcreditacionSubsanacionGuideTone,
      badge: caseCountsLabel(item),
      title: "Revisar llave antes de decidir",
      detail: "Hay una respuesta completa o parcial sin cruce, pero no hay coincidencia automática confiable.",
      primaryAction: "Verificar llave o mantener excluida",
      steps: ["Leer llave usada", "Contrastar base", "Guardar constancia"],
    };
  }
  if (response === "refusal") {
    return {
      tone: "blocked" as AcreditacionSubsanacionGuideTone,
      badge: "No accionable",
      title: "No se asigna al universo",
      detail: "Un rechazo sin identificación no debe moverse al avance. Déjalo explicado salvo que exista evidencia externa documentada.",
      primaryAction: "Mantener excluida",
      steps: ["Leer motivo", "Confirmar no identificación", "Dejar constancia"],
    };
  }
  return {
    tone: "blocked" as AcreditacionSubsanacionGuideTone,
    badge: "Explicativo",
    title: "Solo explica la diferencia",
    detail: "Este caso ayuda a entender la brecha, pero no trae una respuesta asignable al avance.",
    primaryAction: "Revisar sin incluir",
    steps: ["Leer estado", "Revisar evidencia", "Mantener fuera del avance"],
  };
}

function casePhoneAction(item: MonitoreoInternalQueryCase) {
  return String(item.phone_audit?.recommended_action || "").trim();
}

function caseNeedsReconciliationReview(item: MonitoreoInternalQueryCase) {
  return (
    caseCountsInAdvance(item) !== true ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    internalCaseResponseStateValue(item) === "partial" ||
    Boolean(casePhoneAction(item)) ||
    Boolean(String(item.issue_type || "").trim())
  );
}

function assistedReviewFlagTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "t", "yes", "si", "sí"].includes(String(value ?? "").trim().toLowerCase());
}

function assistedCandidateId(candidate: MonitoreoAssistedReviewCandidate) {
  return candidate.candidate_id || candidate.case_key || `${candidate.base_source}:${candidate.base_row}`;
}

function assistedCandidateEvidenceLevel(candidate: MonitoreoAssistedReviewCandidate) {
  const level = normalizeCaseSearch(candidate.evidence_level);
  const matchType = normalizeCaseSearch(candidate.match_type);
  if (level.includes("exact") || matchType.includes("exact")) return "exact";
  if (level.includes("possible") || level.includes("probable") || matchType.includes("similar")) return "possible";
  return "manual";
}

function assistedCandidateEvidenceLabel(candidate: MonitoreoAssistedReviewCandidate) {
  const level = assistedCandidateEvidenceLevel(candidate);
  const matchType = normalizeCaseSearch(candidate.match_type);
  const label = normalizeCaseSearch(candidate.evidence_label);
  if (level === "exact") {
    if ((matchType.includes("email") || label.includes("correo")) && (matchType.includes("code") || label.includes("codigo"))) {
      return "Correo y código exactos";
    }
    if (matchType.includes("email") || label.includes("correo")) return "Correo exacto";
    if (matchType.includes("code") || label.includes("codigo")) return "Código exacto";
    return "Coincidencia exacta";
  }
  if (level === "possible") {
    if (matchType.includes("email") || label.includes("correo")) return "Correo compatible";
    if (matchType.includes("code") || label.includes("codigo")) return "Código compatible";
    return "Coincidencia compatible";
  }
  return "Búsqueda manual";
}

function assistedCandidateEvidenceRank(candidate: MonitoreoAssistedReviewCandidate) {
  const level = assistedCandidateEvidenceLevel(candidate);
  if (level === "exact") return 0;
  if (level === "possible") return 1;
  return 2;
}

function assistedReviewVisible(item: MonitoreoInternalQueryCase) {
  const review = item.assisted_review;
  const issueKey = normalizeCaseSearch(item.issue_type);
  const baseKey = normalizeCaseSearch(item.base_result);
  const reviewableCase = Boolean(
    item.response_id &&
    (
      issueKey === "fuera_base" ||
      issueKey === "fuera base" ||
      issueKey === "sin_llave" ||
      issueKey === "sin llave" ||
      issueKey === "incluido_con_salvedad" ||
      issueKey === "incluido con salvedad" ||
      baseKey.includes("sin cruce") ||
      baseKey.includes("sin llave")
    ),
  );
  return Boolean(
    reviewableCase ||
    review?.manual_decision ||
    assistedReviewFlagTruthy(review?.eligible) ||
    review?.candidates?.length ||
    review?.assignment_candidates?.length ||
    review?.warnings?.length,
  );
}

function assistedReviewDecisionNotes(
  warnings: string[],
  candidates: MonitoreoAssistedReviewCandidate[],
  selectedCandidate: MonitoreoAssistedReviewCandidate | null,
) {
  const notes: Array<{ tone: "info" | "warning"; title: string; detail: string }> = [];
  const add = (note: { tone: "info" | "warning"; title: string; detail: string }) => {
    if (notes.some((item) => item.title === note.title && item.detail === note.detail)) return;
    notes.push(note);
  };
  warnings.forEach((warning) => {
    const key = normalizeCaseSearch(warning);
    if (key.includes("codigo declarado no coincide")) {
      add({
        tone: "warning",
        title: "Código y correo no apuntan igual",
        detail: "Si decides incluir, la nota debe explicar por qué la persona asignada es la correcta.",
      });
      return;
    }
    if (key.includes("correo") || key.includes("compatible")) {
      add({
        tone: "info",
        title: "Evidencia secundaria",
        detail: "Hay una pista de identidad, pero no cuenta hasta asignarla, confirmarla y guardar.",
      });
      return;
    }
    add({ tone: "warning", title: "Revisar antes de decidir", detail: warning });
  });
  if (candidates.some((candidate) => assistedReviewFlagTruthy(candidate.already_effective))) {
    add({
      tone: "warning",
      title: "Ya asignada",
      detail: "La persona detectada tiene otra respuesta reconciliada; este caso no debe sumar avance por sí solo.",
    });
  }
  if (selectedCandidate) {
    const level = assistedCandidateEvidenceLevel(selectedCandidate);
    if (level === "manual") {
      add({ tone: "info", title: "Nota requerida para incluir", detail: "Documenta la evidencia externa antes de guardar." });
    } else if (level === "possible") {
      add({ tone: "info", title: "Nota requerida para incluir", detail: "La evidencia es compatible, no exacta; documenta por qué esta persona es la correcta." });
    }
  }
  return notes;
}

function AcreditacionAssistedReviewBlock({
  item,
  busy,
  onDecision,
}: {
  item: MonitoreoInternalQueryCase;
  busy: boolean;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const review = item.assisted_review;
  const candidates = useMemo<MonitoreoAssistedReviewCandidate[]>(() => (
    Array.isArray(review?.candidates) ? review.candidates : []
  ), [review?.candidates]);
  const assignmentCandidates = useMemo<MonitoreoAssistedReviewCandidate[]>(() => (
    Array.isArray(review?.assignment_candidates) ? review.assignment_candidates : []
  ), [review?.assignment_candidates]);
  const warnings = useMemo(() => (
    Array.isArray(review?.warnings)
      ? review.warnings.map((warning) => String(warning ?? "")).filter(Boolean)
      : []
  ), [review?.warnings]);
  const manual = review?.manual_decision ?? null;
  const visible = assistedReviewVisible(item);
  const evidenceRows = useMemo(() => {
    const seen = new Set<string>();
    const out: MonitoreoAssistedReviewCandidate[] = [];
    [...candidates, ...assignmentCandidates].forEach((candidate) => {
      const id = assistedCandidateId(candidate);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(candidate);
    });
    return out.sort((a, b) => assistedCandidateEvidenceRank(a) - assistedCandidateEvidenceRank(b) ||
      String(a.person_label || a.case_key).localeCompare(String(b.person_label || b.case_key), "es"));
  }, [assignmentCandidates, candidates]);
  const assignmentOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: MonitoreoAssistedReviewCandidate[] = [];
    [...candidates, ...assignmentCandidates].forEach((candidate) => {
      const id = assistedCandidateId(candidate);
      if (!id || seen.has(id) || assistedReviewFlagTruthy(candidate.already_effective)) return;
      seen.add(id);
      out.push(candidate);
    });
    return out.sort((a, b) => String(a.person_label || a.case_key).localeCompare(String(b.person_label || b.case_key), "es"));
  }, [assignmentCandidates, candidates]);
  const candidateKey = candidates.map(assistedCandidateId).join("|");
  const assignmentKey = assignmentCandidates.map(assistedCandidateId).join("|");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentConfirmed, setAssignmentConfirmed] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setSelectedCandidateId("");
    setAssignmentSearch("");
    setAssignmentConfirmed(false);
    setNote("");
  }, [assignmentKey, candidateKey, item.response_id]);

  if (!visible) return null;

  const platformComplete = normalizeCaseSearch(internalCaseResponseStateLabel(internalCaseResponseStateValue(item))).includes("completa") ||
    normalizeCaseSearch(item.platform_state).includes("completa");
  const platformPartial = internalCaseResponseStateValue(item) === "partial" ||
    normalizeCaseSearch(item.platform_state).includes("parcial");
  const validatableState = platformComplete || platformPartial;
  const selectedCandidate = assignmentOptions.find((candidate) => assistedCandidateId(candidate) === selectedCandidateId) ?? null;
  const selectedEvidenceLevel = selectedCandidate ? assistedCandidateEvidenceLevel(selectedCandidate) : "";
  const contradiction = warnings.some((warning) => normalizeCaseSearch(warning).includes("codigo declarado no coincide"));
  const noteRequired = Boolean(platformPartial || contradiction || (selectedCandidate && selectedEvidenceLevel !== "exact"));
  const assignmentQuery = normalizeCaseSearch(assignmentSearch);
  const candidateMatchesSearch = (candidate: MonitoreoAssistedReviewCandidate) => {
    if (!assignmentQuery) return true;
    const haystack = normalizeCaseSearch([
      candidate.person_label,
      candidate.case_key,
      candidate.base_record,
      candidate.base_source,
      candidate.base_status,
      candidate.current_status,
      candidate.match_label,
      candidate.evidence_label,
      candidate.evidence_level,
      ...(candidate.evidence_fields ?? []),
    ].join(" "));
    return assignmentQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
  };
  const visibleEvidenceRows = evidenceRows.slice(0, 5);
  const filteredAssignmentOptions = assignmentOptions.filter(candidateMatchesSearch);
  const visibleAssignmentOptions = filteredAssignmentOptions.slice(0, assignmentQuery ? 12 : 8);
  const unavailableMatches = assignmentQuery
    ? evidenceRows.filter((candidate) => assistedReviewFlagTruthy(candidate.already_effective) && candidateMatchesSearch(candidate))
    : [];
  const selectedCandidatePayloadId = selectedCandidate ? (selectedCandidate.candidate_id || selectedCandidate.case_key || "") : "";
  const includeDisabled = !onDecision || !selectedCandidate || !selectedCandidatePayloadId || !validatableState || busy || !assignmentConfirmed || (noteRequired && !note.trim());
  const keepDisabled = !onDecision || busy || !item.response_id;
  const includeHint = !validatableState
    ? "Solo una respuesta completa o una parcial revisable puede incluirse con salvedad."
    : !selectedCandidate
      ? "Selecciona una persona pendiente del universo para incluir con salvedad."
      : !selectedCandidatePayloadId
        ? "La coincidencia no tiene un identificador guardable."
      : !assignmentConfirmed
        ? "Confirma esta asignación antes de guardar."
      : noteRequired && !note.trim()
          ? platformPartial
            ? "Agrega una nota para documentar por qué la parcial cuenta con validación explícita."
            : "Agrega una nota para documentar la evidencia o contradicción."
          : "";
  const decisionNotes = assistedReviewDecisionNotes(warnings, evidenceRows, selectedCandidate);
  const declaredCode = review?.declared_code || review?.primary_key || item.case_key || "S/D";
  const declaredEmail = review?.declared_email || "S/D";
  const submit = (action: "keep_excluded" | "include_with_caveat") => {
    if (!onDecision || !item.response_id) return;
    if (action === "include_with_caveat" && !selectedCandidate) return;
    onDecision({
      response_id: item.response_id,
      action,
      candidate_id: action === "include_with_caveat" ? selectedCandidatePayloadId : undefined,
      note: note.trim(),
    });
  };

  return (
    <section className="mon-assisted-review mon-acr-assisted-review" aria-label="Revisión asistida del caso">
      <header>
        <span><ShieldAlert size={14} /> Revisión asistida</span>
        {manual ? <em>{manual.action === "include_with_caveat" ? "Incluida con salvedad" : "Excluida"}</em> : <em>Sin decisión</em>}
      </header>
      <div className="mon-assisted-review-evidence">
        <div><dt>Código declarado</dt><dd>{declaredCode}</dd></div>
        <div><dt>Correo declarado</dt><dd>{declaredEmail}</dd></div>
      </div>
      <div className="mon-assisted-evidence-found" aria-label="Evidencia encontrada">
        <span>Evidencia encontrada · no asigna automáticamente</span>
        {visibleEvidenceRows.length ? (
          <div>
            {visibleEvidenceRows.map((candidate) => {
              const alreadyCovered = assistedReviewFlagTruthy(candidate.already_effective);
              return (
                <article key={assistedCandidateId(candidate)} className={alreadyCovered ? "is-covered" : ""}>
                  <strong>{assistedCandidateEvidenceLabel(candidate)}</strong>
                  <small>{[candidate.person_label || candidate.base_record, candidate.case_key || "Sin código oficial"].filter(Boolean).join(" · ")}</small>
                  {alreadyCovered ? <em>Ya asignada</em> : null}
                </article>
              );
            })}
            {evidenceRows.length > visibleEvidenceRows.length ? <small className="mon-assisted-evidence-more">+{fmt(evidenceRows.length - visibleEvidenceRows.length)} coincidencias compatibles.</small> : null}
          </div>
        ) : (
          <p>Sin coincidencia por código o correo.</p>
        )}
      </div>
      {onDecision ? (
        <div className="mon-assisted-assignment" aria-label="Asignación a persona del universo">
          <label>
            <span>Asignación a persona pendiente</span>
            <small>La evidencia orienta; solo se aplica cuando eliges una persona, confirmas y guardas.</small>
            <input
              type="search"
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              placeholder="Buscar nombre, código o correo..."
            />
          </label>
          {unavailableMatches.length ? (
            <div className="mon-assisted-assignment-found" aria-label="Resultado encontrado fuera de pendientes">
              <span>Resultado encontrado fuera de pendientes</span>
              {unavailableMatches.slice(0, 4).map((candidate) => (
                <article key={`unavailable-${assistedCandidateId(candidate)}`}>
                  <strong>{candidate.person_label || candidate.base_record || "Persona del universo"}</strong>
                  <small>{[candidate.case_key || "Sin código oficial", "No está en pendientes"].join(" · ")}</small>
                  <em>Ya asignada</em>
                </article>
              ))}
            </div>
          ) : null}
          {assignmentOptions.length ? (
            <div className="mon-assisted-assignment-list">
              {visibleAssignmentOptions.map((candidate) => {
                const id = assistedCandidateId(candidate);
                const selected = id === selectedCandidateId;
                const level = assistedCandidateEvidenceLevel(candidate);
                return (
                  <button
                    key={id}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => setSelectedCandidateId(id)}
                  >
                    <span>
                      <strong>{candidate.person_label || candidate.base_record || "Persona del universo"}</strong>
                      <small>{[candidate.case_key || "Sin código oficial", candidate.current_status || candidate.base_status || "Pendiente en universo/base", candidate.base_source].filter(Boolean).join(" · ")}</small>
                    </span>
                    <em className={`is-${level}`}>{assistedCandidateEvidenceLabel(candidate)}</em>
                  </button>
                );
              })}
              {filteredAssignmentOptions.length > visibleAssignmentOptions.length ? <small>Mostrando {fmt(visibleAssignmentOptions.length)} de {fmt(filteredAssignmentOptions.length)} personas pendientes.</small> : null}
              {assignmentQuery && !visibleAssignmentOptions.length ? <small>No hay personas pendientes que coincidan con la búsqueda.</small> : null}
            </div>
          ) : (
            <p className="mon-assisted-review-empty">No hay personas pendientes disponibles en el universo de este actor.</p>
          )}
        </div>
      ) : null}
      {selectedCandidate ? (
        <div className="mon-assisted-selected">
          <span>Persona seleccionada</span>
          <strong>{selectedCandidate.person_label || selectedCandidate.base_record || "Persona del universo"}</strong>
          <small>{[selectedCandidate.case_key || "Sin código oficial", item.actor].filter(Boolean).join(" · ")}</small>
          <p>La asignación no se aplica hasta guardar.</p>
        </div>
      ) : null}
      {selectedCandidate ? (
        <label className="mon-assisted-confirm">
          <input
            type="checkbox"
            checked={assignmentConfirmed}
            onChange={(event) => setAssignmentConfirmed(event.target.checked)}
          />
          <span>Confirmo esta asignación. La evidencia por correo/código solo orienta; no decide automáticamente.</span>
        </label>
      ) : null}
      {decisionNotes.length ? (
        <div className="mon-assisted-decision-notes" role="status" aria-label="Lectura para decidir">
          {decisionNotes.map((item) => (
            <article key={`${item.title}-${item.detail}`} className={`is-${item.tone}`}>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      ) : null}
      {manual ? (
        <div className="mon-assisted-manual">
          <span>Decisión registrada</span>
          <strong>{manual.action === "include_with_caveat" ? "Incluida con salvedad" : "Mantener excluida"}</strong>
          <small>{[manual.assigned_person_label, manual.assigned_case_key, manual.match_type].filter(Boolean).join(" · ") || "Sin asignación al universo"}</small>
          {manual.note ? <p>{manual.note}</p> : null}
        </div>
      ) : null}
      {onDecision ? (
        <div className="mon-assisted-actions">
          <label>
            <span>Nota</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={noteRequired ? "Nota requerida para incluir con salvedad" : "Nota opcional"}
            />
          </label>
          <div>
            <button type="button" className="is-keep" disabled={keepDisabled} onClick={() => submit("keep_excluded")}>
              {busy ? <Loader2 size={14} className="pulso-spin" /> : <XCircle size={14} />}
              <span>Mantener excluida</span>
            </button>
            <button type="button" className="is-include" disabled={includeDisabled} onClick={() => submit("include_with_caveat")}>
              {busy ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
              <span>Incluir con salvedad</span>
            </button>
          </div>
          {includeHint ? <small className="mon-assisted-action-hint">{includeHint}</small> : null}
        </div>
      ) : null}
    </section>
  );
}

function responseCounts(cases: MonitoreoInternalQueryCase[]) {
  return cases.reduce(
    (acc, item) => {
      const response = internalCaseResponseStateValue(item);
      acc.total += 1;
      if (response === "complete") acc.complete += 1;
      else if (response === "partial") acc.partial += 1;
      else if (response === "refusal") acc.refusal += 1;
      else acc.pending += 1;
      if (caseWithoutCrossing(item)) acc.withoutCrossing += 1;
      return acc;
    },
    { total: 0, complete: 0, partial: 0, refusal: 0, pending: 0, withoutCrossing: 0 },
  );
}

function groupedCaseRows(
  cases: MonitoreoInternalQueryCase[],
  groupValue: (item: MonitoreoInternalQueryCase) => string,
  groupLabel: (value: string) => string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = groupValue(item) || "Sin dato";
    const bucket = groups.get(value) ?? [];
    bucket.push(item);
    groups.set(value, bucket);
  });
  return Array.from(groups.entries())
    .map(([value, rows]) => {
      const counts = responseCounts(rows);
      return {
        Grupo: groupLabel(value),
        Casos: counts.total,
        Completas: counts.complete,
        Parciales: counts.partial,
        Rechazos: counts.refusal,
        "Sin respuesta": counts.pending,
        "Sin cruce": counts.withoutCrossing,
      };
    })
    .sort((a, b) => Number(b.Casos) - Number(a.Casos) || String(a.Grupo).localeCompare(String(b.Grupo), "es"));
}

function caseAuditRows(cases: MonitoreoInternalQueryCase[]) {
  return cases.filter(caseIsAuditable).map((item) => ({
    Actor: item.actor || "Sin actor",
    Persona: caseDisplayName(item),
    "Estado respuesta": internalCaseResponseStateLabel(internalCaseResponseStateValue(item)),
    "Cuenta avance": caseCountsLabel(item),
    Cruce: internalCaseCrossingLabel(internalCaseCrossingValue(item)),
    Decisión: item.decision || advancementLabel(item.advancement),
    Motivo: item.decision_reason || item.rule || item.issue_type || "Regla estándar",
    "Evidencia primaria": casePrimaryEvidence(item),
    "Evidencia secundaria": caseSecondaryEvidence(item),
    "Acción telefónica": casePhoneAction(item),
    Duplicados: caseDuplicateLabel(item),
    Parcial: casePartialLabel(item),
    "Response ID": item.response_id || "",
  }));
}

function advancementLabel(value: string) {
  if (value === "effective") return "Efectiva";
  if (value === "included_review") return "Incluida auditada";
  if (value === "partial") return "Parcial";
  if (value === "refusal") return "Rechazo";
  if (value === "pending") return "Sin respuesta";
  if (value === "excluded") return "Excluida";
  return value || "Revisión";
}

function AcreditacionCaseFilterChips({
  label,
  value,
  allLabel,
  allCount,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <section className="mon-acr-case-chip-filter" aria-label={`Filtro por ${label}`}>
      <span>{label}</span>
      <div>
        <button type="button" className={!value ? "is-active" : ""} aria-pressed={!value} onClick={() => onChange("")}>
          <strong>{allLabel}</strong>
          <em>{fmt(allCount)}</em>
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[value === option.value ? "is-active" : "", `is-${option.value}`].filter(Boolean).join(" ")}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <em>{fmt(option.count)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function CaseStatusPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-status-pill is-${value}`}>
      {internalCaseResponseStateLabel(value)}
    </span>
  );
}

function CaseCrossingPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-cross-pill is-${value}`}>
      {internalCaseCrossingLabel(value)}
    </span>
  );
}

function AcreditacionCaseDonut({ summary }: { summary: ReturnType<typeof summarizeInternalCases> }) {
  const total = Math.max(1, summary.total);
  const effective = (summary.effective / total) * 360;
  const partial = effective + (summary.partial / total) * 360;
  const refusal = partial + (summary.refusal / total) * 360;
  const style = {
    "--donut-effective": `${effective}deg`,
    "--donut-partial": `${partial}deg`,
    "--donut-refusal": `${refusal}deg`,
  } as CSSProperties;

  return (
    <div className="mon-acr-case-donut" style={style} aria-label={`Resumen de ${fmt(summary.total)} casos`}>
      <div className="mon-acr-case-donut-ring" aria-hidden="true">
        <span>
          <strong>{fmt(summary.effective)}</strong>
          <em>completas</em>
        </span>
      </div>
      <div className="mon-acr-case-donut-caption">
        <span>Respuesta validada</span>
        <strong>{pctFrom(summary.effective, summary.total || 1)}</strong>
      </div>
    </div>
  );
}

function AcreditacionCaseOverview({
  summary,
  allSummary,
  filteredCount,
  totalCount,
}: {
  summary: ReturnType<typeof summarizeInternalCases>;
  allSummary: ReturnType<typeof summarizeInternalCases>;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <section className="mon-acr-case-overview" aria-label="Resumen de consultas">
      <AcreditacionCaseDonut summary={summary.total ? summary : allSummary} />
      <div className="mon-acr-case-kpis">
        <StatTile label="Casos visibles" value={`${fmt(filteredCount)} / ${fmt(totalCount)}`} tone={filteredCount ? "good" : "neutral"} />
        <StatTile label="Completas" value={fmt(summary.effective)} tone="good" />
        <StatTile label="Parciales" value={fmt(summary.partial)} tone={summary.partial ? "warn" : "neutral"} />
        <StatTile label="Rechazos / sin respuesta" value={`${fmt(summary.refusal)} / ${fmt(summary.pending)}`} tone={summary.refusal || summary.pending ? "warn" : "neutral"} />
      </div>
    </section>
  );
}

function AcreditacionConsultaTabs({
  active,
  counts,
  onChange,
  profileMode = "acreditacion",
}: {
  active: AcreditacionConsultaTab;
  counts: Record<AcreditacionConsultaTab, number>;
  onChange: (tab: AcreditacionConsultaTab) => void;
  profileMode?: AcreditacionProfileMode;
}) {
  return (
    <GlidingTabList as="nav" activeKey={active} className="mon-acr-query-tabs" role="tablist" aria-label="Pestañas de consultas internas">
      {ACREDITACION_CONSULTA_TABS.map((tab) => {
        const phoneTab = profileMode === "telefonico"
          ? ({
            plataforma: { label: "Efectivas Kobo", detail: "Pasan filtro" },
            base: { label: "Base telefónica", detail: "Universo y estados" },
            cruces: { label: "Estado tel.", detail: "Kobo vs barrido" },
            subsanacion: { label: "Salvedades", detail: "No identificables" },
          } as Partial<Record<AcreditacionConsultaTab, { label: string; detail: string }>>)[tab.key]
          : null;
        const Icon = tab.icon;
        const selected = active === tab.key;
        return (
          <button
            key={tab.key} id={`mon-acr-query-tab-${tab.key}`}
            type="button" role="tab"
            data-gliding-key={tab.key} aria-controls={`mon-acr-query-panel-${tab.key}`}
            aria-selected={selected}
            className={selected ? "is-active" : ""}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={14} />
            <span>
              <strong>{phoneTab?.label ?? tab.label}</strong>
              <em>{phoneTab?.detail ?? tab.detail}</em>
            </span>
            <small>{fmt(counts[tab.key])}</small>
          </button>
        );
      })}
    </GlidingTabList>
  );
}

function AcreditacionCrucesView({ cases }: { cases: MonitoreoInternalQueryCase[] }) {
  const crossingRows = groupedCaseRows(cases, internalCaseCrossingValue, internalCaseCrossingLabel);
  const actorRows = groupedCaseRows(cases, (item) => item.actor || "Sin actor", (value) => value);
  const sourceRows = groupedCaseRows(cases, (item) => item.source_label || acreditacionChannelDisplay(item.channel, "Sin fuente"), (value) => value);
  return (
    <div className="mon-acr-insight-grid">
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Cruce por llave</h3>
          <span>{fmt(crossingRows.length)} tipos</span>
        </div>
        <DataTable rows={crossingRows} empty="No hay cruces para los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Actor y estado</h3>
          <span>{fmt(actorRows.length)} actores</span>
        </div>
        <DataTable rows={actorRows} empty="No hay actores para los filtros activos." />
      </section>
      <section className="mon-profile-panel mon-acr-insight-wide">
        <div className="mon-profile-panel-head">
          <h3>Fuente y respuesta</h3>
          <span>{fmt(sourceRows.length)} fuentes</span>
        </div>
        <DataTable rows={sourceRows} empty="No hay fuentes para los filtros activos." />
      </section>
    </div>
  );
}

function AcreditacionAuditoriaView({
  cases,
  issues,
}: {
  cases: MonitoreoInternalQueryCase[];
  issues: Array<Record<string, unknown>>;
}) {
  const auditRows = caseAuditRows(cases);
  const noCrossing = cases.filter(caseWithoutCrossing).length;
  const duplicates = cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1).length;
  const partials = cases.filter((item) => internalCaseResponseStateValue(item) === "partial").length;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Casos auditables" value={fmt(auditRows.length)} tone={auditRows.length ? "warn" : "good"} />
        <StatTile label="Sin cruce" value={fmt(noCrossing)} tone={noCrossing ? "warn" : "good"} />
        <StatTile label="Duplicados" value={fmt(duplicates)} tone={duplicates ? "warn" : "neutral"} />
        <StatTile label="Parciales" value={fmt(partials)} tone={partials ? "warn" : "neutral"} />
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Casos que explican diferencias</h3>
          <span>{fmt(auditRows.length)} filas</span>
        </div>
        <DataTable rows={auditRows} empty="No hay casos auditables con los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Alertas internas</h3>
          <span>{fmt(issues.length)} alertas</span>
        </div>
        <DataTable rows={issues} empty="No hay alertas internas para este corte." />
      </section>
    </div>
  );
}

function AcreditacionReconciliacionView({
  cases,
  busyId = "",
  status = null,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  busyId?: string;
  status?: AcreditacionActionStatus;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const reviewCases = cases.filter(caseNeedsReconciliationReview);
  const assistedCases = cases.filter(assistedReviewVisible);
  const visible = (assistedCases.length ? assistedCases : reviewCases.length ? reviewCases : cases).slice(0, 120);
  const countsAdvance = cases.filter((item) => caseCountsInAdvance(item) === true).length;
  const notCounting = cases.filter((item) => caseCountsInAdvance(item) === false).length;
  const duplicates = cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1).length;
  const phoneActions = cases.filter((item) => Boolean(casePhoneAction(item))).length;
  const visibleTotal = assistedCases.length || reviewCases.length || cases.length;

  return (
    <div className="mon-acr-recon">
      <section className="mon-profile-stat-row" aria-label="Resumen de reconciliación">
        <StatTile label="Cuentan" value={fmt(countsAdvance)} tone={countsAdvance ? "good" : "neutral"} />
        <StatTile label="No cuentan" value={fmt(notCounting)} tone={notCounting ? "warn" : "good"} />
        <StatTile label="Duplicados" value={fmt(duplicates)} tone={duplicates ? "warn" : "good"} />
        <StatTile label="Revisión asistida" value={fmt(assistedCases.length)} tone={assistedCases.length ? "warn" : "neutral"} />
        <StatTile label="Acción tel." value={fmt(phoneActions)} tone={phoneActions ? "warn" : "neutral"} />
      </section>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}

      <section className="mon-profile-panel mon-acr-recon-panel">
        <div className="mon-profile-panel-head">
          <h3>Reconciliación persona · respuesta · barrido</h3>
          <span>{fmt(visible.length)} de {fmt(visibleTotal)} casos</span>
        </div>
        {visible.length ? (
          <div className="mon-acr-recon-table-wrap">
            <table className="mon-acr-recon-table">
              <thead>
                <tr>
                  <th>Persona / código</th>
                  <th>Cuenta</th>
                  <th>Evidencia</th>
                  <th>Teléfono / acción</th>
                  <th>Duplicado y parcial</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const counts = caseCountsInAdvance(item);
                  const phoneAction = casePhoneAction(item);
                  const reviewVisible = assistedReviewVisible(item);
                  const id = caseIdentity(item);
                  return (
                    <Fragment key={id}>
                      <tr className={counts === true ? "is-counting" : counts === false ? "is-not-counting" : "is-review"}>
                        <td>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"} · {item.response_id || "sin response_id"}</small>
                        </td>
                        <td>
                          <span className={`mon-acr-count-pill ${counts === true ? "is-yes" : counts === false ? "is-no" : "is-review"}`}>
                            {caseCountsLabel(item)}
                          </span>
                          <small>{item.decision || advancementLabel(item.advancement)}</small>
                        </td>
                        <td>
                          <strong>{casePrimaryEvidence(item)}</strong>
                          <small>{caseSecondaryEvidence(item) || internalCaseCrossingLabel(internalCaseCrossingValue(item))}</small>
                        </td>
                        <td>
                          <strong>{phoneAction || item.base_status || acreditacionChannelDisplay(item.channel, "Sin acción telefónica")}</strong>
                          <small>{item.source_label || "Sin fuente"} · {internalQueryCollectorDisplayLabel(item)}</small>
                        </td>
                        <td>
                          <strong>{caseDuplicateLabel(item)}</strong>
                          <small>{casePartialLabel(item) || item.rule || item.issue_type || "Sin parcialidad reportada"}</small>
                        </td>
                      </tr>
                      {reviewVisible ? (
                        <tr className="mon-acr-recon-review-row">
                          <td colSpan={5}>
                            <AcreditacionAssistedReviewBlock
                              item={item}
                              busy={busyId === item.response_id}
                              onDecision={onDecision}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mon-profile-muted">No hay casos de reconciliación para los filtros activos.</p>
        )}
      </section>
    </div>
  );
}

export function acreditacionRowsForConsultaTab(
  cases: MonitoreoInternalQueryCase[],
  tab: AcreditacionConsultaTab,
  profileMode: AcreditacionProfileMode = "acreditacion",
) {
  if (profileMode === "telefonico" && tab === "plataforma") {
    return telefonicoConsultedEffectiveCases(cases);
  }
  if (tab === "plataforma") {
    return cases.filter(caseHasPlatformResponse).sort(comparePlatformCases);
  }
  if (tab === "cruces") {
    if (profileMode === "telefonico") {
      return cases.filter((item) => (
        telefonicoCasePlatformEffective(item) ||
        telefonicoCaseDeclaresEffective(item) ||
        telefonicoCaseHasEffectiveCaveat(item)
      )).sort((a, b) => (
        Number(telefonicoCasePlatformEffective(b) !== telefonicoCaseDeclaresEffective(b)) -
        Number(telefonicoCasePlatformEffective(a) !== telefonicoCaseDeclaresEffective(a)) ||
        Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0) ||
        comparePlatformCases(a, b)
      ));
    }
    return cases.filter(caseHasPlatformResponse).sort((a, b) => (
      Number(caseWithoutCrossing(b)) - Number(caseWithoutCrossing(a)) ||
      Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0) ||
      comparePlatformCases(a, b)
    ));
  }
  if (tab === "subsanacion") {
    if (profileMode === "telefonico") {
      return telefonicoConsultedEffectiveCases(cases)
        .filter(telefonicoCaseHasEffectiveCaveat)
        .sort(comparePlatformCases);
    }
    return cases.filter(caseIsSubsanacionCandidate).sort((a, b) => (
      Number(caseIsActionableSubsanacion(b)) - Number(caseIsActionableSubsanacion(a)) ||
      Number(assistedReviewVisible(b)) - Number(assistedReviewVisible(a)) ||
      Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0) ||
      comparePlatformCases(a, b)
    ));
  }
  return cases;
}

export function acreditacionConsultaShowsCutStatusStrip(tab: AcreditacionConsultaTab, profileMode: AcreditacionProfileMode = "acreditacion") {
  return tab === "cruces" && profileMode !== "telefonico";
}

function acreditacionIssuesForConsultaTab(issues: MonitoreoInternalQueryIssue[], tab: AcreditacionConsultaTab) {
  if (tab === "subsanacion") {
    return issues.filter((issue) => {
      const key = normalizeCaseSearch(issue.issue_type);
      return key.includes("sin llave") || key.includes("fuera base") || key.includes("sin cruce");
    });
  }
  return issues;
}

function acreditacionQueryAnswerCopy(
  tab: AcreditacionConsultaTab,
  summary: ReturnType<typeof summarizeInternalCases>,
  allSummary: ReturnType<typeof summarizeInternalCases>,
  activeFilters: boolean,
  profileMode: AcreditacionProfileMode = "acreditacion",
) {
  const scope = activeFilters ? "con los filtros activos" : "en este corte";
  if (profileMode === "telefonico" && tab === "cruces") {
    return {
      icon: Link2,
      tone: summary.review || summary.total ? "warning" : "base",
      heading: "Estado tel. vs Kobo",
      title: `${fmt(summary.total)} CodPulso con Kobo efectiva o teléfono efectivo ${scope}.`,
      detail: "CodPulso ubicado no significa caso barrido: esta vista separa base, estado telefónico leído y efectiva Kobo.",
    };
  }
  if (tab === "plataforma") {
    return {
      icon: ListChecks,
      tone: "base",
      heading: "Registros recibidos",
      title: `${formatCaseLabel(summary.total)} de plataforma ${scope}.`,
      detail: "Ordenados por última respuesta, separando estado, actor, hora y cruce con la base.",
    };
  }
  if (tab === "base") {
    return {
      icon: Table2,
      tone: "pending",
      heading: "Estado de la base",
      title: `${formatCaseLabel(summary.total)} del universo ${scope}.`,
      detail: `${fmt(summary.effective)} completas, ${fmt(summary.partial)} parciales, ${fmt(summary.refusal)} rechazos y ${fmt(summary.pending)} sin respuesta.`,
    };
  }
  if (tab === "cruces") {
    return {
      icon: Link2,
      tone: "warning",
      heading: "Cruce y no cruce",
      title: `${formatCaseLabel(summary.total)} explicado${summary.total === 1 ? "" : "s"} ${scope}.`,
      detail: "Cada fila muestra por qué cruzó, por qué no cruzó, si el no cruce es esperable o si requiere subsanación.",
    };
  }
  if (tab === "subsanacion") {
    return {
      icon: ShieldAlert,
      tone: "partial",
      heading: "Subsanación auditada",
      title: `${formatCaseLabel(summary.total)} sin cruce ${scope}.`,
      detail: "Las completas/parciales pueden resolverse con candidato y nota; los rechazos no identificables quedan documentados.",
    };
  }
  return {
    icon: Search,
    tone: "base",
    heading: "Casos, respuesta y cruce",
    title: `${formatCaseLabel(summary.total)} visible${summary.total === 1 ? "" : "s"} de ${formatCaseLabel(allSummary.total)}.`,
    detail: "La tabla separa respuesta de SurveyMonkey, cruce con base/universo y decisión de avance caso por caso.",
  };
}

function caseToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  if (item.advancement === "effective") return "effective";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusal";
  if (assistedReviewVisible(item) || caseNeedsReconciliationReview(item)) return "warning";
  return "muted";
}

function platformToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "effective";
  if (response === "partial") return "partial";
  if (response === "refusal") return "refusal";
  if (response === "pending") return "muted";
  return "warning";
}

function crossingToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const crossing = internalCaseCrossingValue(item);
  if (crossing === "cruzo_llave" || crossing === "cruzo_correo") return "effective";
  if (crossing === "sin_cruce" || crossing === "sin_llave") return "warning";
  return "muted";
}

function issueToneValue(issue: MonitoreoInternalQueryIssue): "danger" | "warning" | "info" {
  const severity = normalizeCaseSearch(issue.severity);
  if (severity.includes("alta")) return "danger";
  if (severity.includes("media")) return "warning";
  return "info";
}

function caseDimensionRows(
  cases: MonitoreoInternalQueryCase[],
  dimension: "actor" | "source_label" | "channel" | "date",
  label: string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const key = String(item[dimension] || "Sin dato");
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([group, rows]) => {
      const summary = summarizeInternalCases(rows);
      return {
        [label]: group,
        Total: summary.total,
        Efectivas: summary.effective,
        Parciales: summary.partial,
        Rechazos: summary.refusal,
        "Sin respuesta": summary.pending,
      };
    })
    .sort((a, b) => Number(b.Total) - Number(a.Total) || String(a[label]).localeCompare(String(b[label]), "es"));
}

type AcreditacionCaseBreakdownDimension = "actor" | "source" | "channel" | "date" | "collector";

type AcreditacionCaseBreakdownRow = {
  value: string;
  label: string;
  total: number;
  effective: number;
  partial: number;
  refusal: number;
  pending: number;
  review: number;
};

function acreditacionCaseBreakdownValue(item: MonitoreoInternalQueryCase, dimension: AcreditacionCaseBreakdownDimension) {
  if (dimension === "actor") return item.actor || "";
  if (dimension === "source") return caseSourceValue(item);
  if (dimension === "channel") return caseChannelValue(item);
  if (dimension === "date") return item.date || "";
  return caseCollectorValue(item);
}

function acreditacionCaseBreakdownLabel(value: string, dimension: AcreditacionCaseBreakdownDimension) {
  if (!value) return "Sin dato";
  if (dimension === "channel") return acreditacionChannelLabel(value);
  if (dimension === "collector") return internalQueryCollectorDisplayLabel(value);
  return value;
}

function acreditacionCaseBreakdownRows(
  cases: MonitoreoInternalQueryCase[],
  dimension: AcreditacionCaseBreakdownDimension,
): AcreditacionCaseBreakdownRow[] {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = acreditacionCaseBreakdownValue(item, dimension);
    const key = value || "__missing__";
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const value = key === "__missing__" ? "" : key;
      const summary = summarizeInternalCases(rows);
      return {
        value,
        label: acreditacionCaseBreakdownLabel(value, dimension),
        total: summary.total,
        effective: summary.effective,
        partial: summary.partial,
        refusal: summary.refusal,
        pending: summary.pending,
        review: summary.review,
      };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function acreditacionQueryDonutBackground(segments: Array<{ value: number; color: string }>) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (!total) return "conic-gradient(#dbe2ec 0deg 360deg)";
  let start = 0;
  const parts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const end = start + (segment.value / total) * 360;
      const part = `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      start = end;
      return part;
    });
  return `conic-gradient(${parts.join(", ")})`;
}

function AcreditacionConsultaStatusStrip({
  reports,
  model,
  officialCases,
  sources = [],
}: {
  reports: MonitoreoAcreditacionReports;
  model: ReturnType<typeof normalizeInternalQueries>;
  officialCases: MonitoreoInternalQueryCase[];
  sources?: MonitoreoSource[];
}) {
  const summary = summarizeInternalCases(officialCases);
  const auditSummary = summarizeInternalCases(model.cases);
  const caseSources = new Set(officialCases.map(caseSourceValue).filter(Boolean));
  const sourceCount = sources.length || caseSources.size || reports.sheets?.length || 0;
  const actors = new Set([...officialCases, ...model.cases].map((item) => item.actor).filter(Boolean)).size;
  const missingKey = model.cases.filter((item) => internalCaseCrossingValue(item) === "sin_llave").length;
  const issueCount = model.issues.reduce((sum, issue) => sum + Number(issue.count || 1), 0);
  return (
    <section className="mon-query-status-strip" aria-label="Estado del corte disponible">
      <header>
        <span>Estado del corte</span>
        <strong>Corte listo para explorar casos</strong>
        <p>{`Corte ${formatDate(reports.generated_at)}. ${fmt(sourceCount)} fuentes · ${formatCaseLabel(officialCases.length)} en universo · ${formatCaseLabel(model.cases.length)} auditables.`}</p>
      </header>
      <div className="mon-query-status-metrics">
        <span className={officialCases.length ? "is-base" : "is-warning"}>
          <Layers3 size={14} />
          <em>Universo</em>
          <strong>{fmt(officialCases.length)}</strong>
          <small>{fmt(actors)} actores</small>
        </span>
        <span className={summary.pending || missingKey ? "is-warning" : "is-ready"}>
          <Search size={14} />
          <em>Casos</em>
          <strong>{fmt(summary.total)}</strong>
          <small>{fmt(summary.pending)} sin respuesta · {fmt(missingKey)} sin llave</small>
        </span>
        <span className={sourceCount ? "is-base" : "is-warning"}>
          <PlugZap size={14} />
          <em>Fuentes</em>
          <strong>{fmt(sourceCount)}</strong>
          <small>{fmt(reports.reference_tabs?.length ?? 0)} pestañas de referencia</small>
        </span>
        <span className={issueCount || auditSummary.duplicates ? "is-warning" : "is-ready"}>
          <ShieldAlert size={14} />
          <em>Alertas</em>
          <strong>{fmt(issueCount)}</strong>
          <small>{fmt(auditSummary.duplicates)} duplicados</small>
        </span>
      </div>
    </section>
  );
}

function AcreditacionQuerySelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mon-query-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionPlatformCapsuleSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`mon-acr-platform-filter-pill${value ? " is-active" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {compactSelectLabel(option.label, 34)} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionPlatformFilterCapsules({
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  activeFilters,
  onFilter,
  onClear,
}: {
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mon-acr-platform-filters" aria-label="Filtros de registros en plataforma">
      <label className={`mon-acr-platform-search-pill${filters.search ? " is-active" : ""}`}>
        <Search size={14} />
        <input
          value={filters.search}
          onChange={(event) => onFilter({ search: event.target.value })}
          placeholder="Buscar código, nombre, correo o response_id"
        />
      </label>
      <AcreditacionPlatformCapsuleSelect label="Actor" value={filters.actor} options={actorOptions} allLabel="Todos" onChange={(actor) => onFilter({ actor })} />
      <AcreditacionPlatformCapsuleSelect label="Respuesta" value={filters.response} options={responseOptions} allLabel="Todas" onChange={(response) => onFilter({ response })} />
      <AcreditacionPlatformCapsuleSelect label="Cruce" value={filters.crossing} options={crossingOptions} allLabel="Todos" onChange={(crossing) => onFilter({ crossing })} />
      <AcreditacionPlatformCapsuleSelect label="Fecha" value={filters.date} options={dateOptions} allLabel="Todas" onChange={(date) => onFilter({ date })} />
      <AcreditacionPlatformCapsuleSelect label="Canal" value={filters.channel} options={channelOptions} allLabel="Todos" onChange={(channel) => onFilter({ channel })} />
      <AcreditacionPlatformCapsuleSelect label="Fuente" value={filters.source} options={sourceOptions} allLabel="Todas" onChange={(source) => onFilter({ source })} />
      <AcreditacionPlatformCapsuleSelect label="Recopilador" value={filters.collector} options={collectorOptions} allLabel="Todos" onChange={(collector) => onFilter({ collector })} />
      <button type="button" className="mon-acr-platform-clear-pill" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
        <XCircle size={14} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}

function AcreditacionCaseExplorerToolbar({
  summary,
  allSummary,
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  profileMode = "acreditacion",
  activeFilters,
  onFilter,
  onClear,
}: {
  summary: ReturnType<typeof summarizeInternalCases>;
  allSummary: ReturnType<typeof summarizeInternalCases>;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  profileMode?: AcreditacionProfileMode;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  const isPhoneMode = profileMode === "telefonico";
  return (
    <header className="mon-case-explorer-toolbar">
      <div className="mon-case-explorer-title">
        <span>Explorador</span>
        <strong><Search size={16} /> Casos del corte</strong>
        <p>
          {isPhoneMode
            ? `${formatCaseLabel(summary.total)} visibles de ${formatCaseLabel(allSummary.total)}. Cada fila separa CodPulso/base, estado telefónico leído y efectiva Kobo.`
            : `${formatCaseLabel(summary.total)} visibles de ${formatCaseLabel(allSummary.total)}. Cada fila separa respuesta, cruce con base y decisión de avance.`}
        </p>
      </div>
      <div className="mon-case-filterbar" aria-label="Filtros de casos">
        <label className="mon-query-search">
          <Search size={14} />
          <input
            value={filters.search}
            onChange={(event) => onFilter({ search: event.target.value })}
            placeholder="Buscar código, nombre, correo o response_id..."
          />
        </label>
        <AcreditacionQuerySelect label="Actor" value={filters.actor} options={actorOptions} allLabel="Todos" onChange={(actor) => onFilter({ actor })} />
        <AcreditacionQuerySelect label="Fecha" value={filters.date} options={dateOptions} allLabel="Todas" onChange={(date) => onFilter({ date })} />
        <AcreditacionQuerySelect label="Canal" value={filters.channel} options={channelOptions} allLabel="Todos" onChange={(channel) => onFilter({ channel })} />
        <AcreditacionQuerySelect label="Fuente" value={filters.source} options={sourceOptions} allLabel="Todas" onChange={(source) => onFilter({ source })} />
        <AcreditacionQuerySelect label="Recopilador" value={filters.collector} options={collectorOptions} allLabel="Todos" onChange={(collector) => onFilter({ collector })} />
        <AcreditacionQuerySelect label="Respuesta" value={filters.response} options={responseOptions} allLabel="Todas" onChange={(response) => onFilter({ response })} />
        <AcreditacionQuerySelect label={isPhoneMode ? "CodPulso/base" : "Cruce"} value={filters.crossing} options={crossingOptions} allLabel="Todos" onChange={(crossing) => onFilter({ crossing })} />
        <button type="button" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
          <XCircle size={14} />
          <span>Limpiar</span>
        </button>
      </div>
    </header>
  );
}

function AcreditacionPendingRiskStrip({
  cases,
  onReview,
}: {
  cases: MonitoreoInternalQueryCase[];
  onReview: () => void;
}) {
  if (!cases.length) return null;
  const actorCounts = cases.reduce<Map<string, number>>((acc, item) => {
    const actor = item.actor || "Sin actor";
    acc.set(actor, (acc.get(actor) ?? 0) + 1);
    return acc;
  }, new Map());
  const actorEntries = Array.from(actorCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const exactCount = cases.reduce((sum, item) => sum + (item.assisted_review?.assignment_candidates ?? []).filter((candidate) => assistedCandidateEvidenceLevel(candidate) === "exact").length, 0);
  const possibleCount = cases.reduce((sum, item) => sum + (item.assisted_review?.assignment_candidates ?? []).filter((candidate) => assistedCandidateEvidenceLevel(candidate) === "possible").length, 0);
  return (
    <section className="mon-pending-risk-strip" aria-label="Pendientes con posible respuesta no reconciliada">
      <span><AlertCircle size={15} /></span>
      <div>
        <strong>{formatCaseLabel(cases.length)} revisables pueden afectar la lista de no respuesta</strong>
        <p>Hay respuestas excluidas o sin llave con correo/código compatible. No cuentan hasta decidirlas con nota.</p>
      </div>
      <ul>
        {actorEntries.slice(0, 3).map(([actor, count]) => (
          <li key={actor}><b>{actor}</b><em>{fmt(count)}</em></li>
        ))}
      </ul>
      <small>{fmt(exactCount)} exactas · {fmt(possibleCount)} similares</small>
      <button type="button" onClick={onReview}>
        Ver casos revisables
      </button>
    </section>
  );
}

function AcreditacionIssueList({
  issues,
  onFilter,
}: {
  issues: MonitoreoInternalQueryIssue[];
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
}) {
  if (!issues.length) {
    return <p className="mon-profile-muted">Sin alertas para esta lectura.</p>;
  }
  return (
    <div className="mon-query-issue-list">
      {issues.slice(0, 24).map((issue, index) => (
        <button
          key={`${issue.issue_type}-${issue.response_id}-${issue.case_key}-${index}`}
          type="button"
          className={`is-${issueToneValue(issue)}`}
          onClick={() => onFilter({
            actor: issue.actor || "",
            search: issue.response_id || issue.case_key || issue.detail || issue.label,
          })}
        >
          <span>
            <strong>{issue.label || issue.issue_type || "Alerta"}</strong>
            <small>{issue.detail || issue.case_key || issue.response_id || "Sin detalle"}</small>
          </span>
          <em>{formatCaseLabel(Number(issue.count || 1))}</em>
        </button>
      ))}
    </div>
  );
}

function AcreditacionTraceStep({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <span>
      <i>{icon}</i>
      <em>{label}</em>
      <strong>{value}</strong>
      {hint && hint !== value ? <small>{hint}</small> : null}
    </span>
  );
}

function AcreditacionCaseKeyTrace({ item }: { item: MonitoreoInternalQueryCase }) {
  const trace = caseKeyTraceSummary(item);
  return (
    <section className="mon-case-key-trace" aria-label="Llave por canal">
      <header>
        <span><KeyRound size={14} /> Llave por canal</span>
        <strong>{trace.strategyLabel}</strong>
        <em>{trace.channelLabel}</em>
      </header>
      <div className="mon-case-key-evidence">
        {trace.evidenceRows.map((row) => (
          <span key={`${row.label}-${row.value}`} className={`is-${row.tone}`}>
            <em>{row.label}</em>
            <strong>{row.value}</strong>
          </span>
        ))}
      </div>
      <p>{trace.strategyHint}</p>
    </section>
  );
}

function AcreditacionSubsanacionCoach({ item }: { item: MonitoreoInternalQueryCase }) {
  const guide = acreditacionSubsanacionCaseGuide(item);
  return (
    <section className={`mon-acr-subsanacion-coach is-${guide.tone}`} aria-label="Qué hacer ahora">
      <header>
        <span><Target size={14} /> Qué hacer ahora</span>
        <em>{guide.badge}</em>
        <strong>{guide.title}</strong>
        <p>{guide.detail}</p>
      </header>
      <div>
        {guide.steps.map((step, index) => (
          <span key={step}>
            <em>{index + 1}</em>
            <strong>{step}</strong>
          </span>
        ))}
      </div>
      <small><CheckCircle2 size={13} /> {guide.primaryAction}</small>
    </section>
  );
}

function AcreditacionCasesTable({
  cases,
  selectedCase,
  onCaseSelect,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
}) {
  if (!cases.length) {
    return <p className="mon-profile-muted">No hay casos con los filtros activos.</p>;
  }
  const visible = cases.slice(0, 120);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-query-table-wrap">
      <table className="mon-query-table">
        <colgroup>
          <col className="mon-query-col-case" />
          <col className="mon-query-col-state" />
          <col className="mon-query-col-base" />
          <col className="mon-query-col-response" />
          <col className="mon-query-col-channel" />
        </colgroup>
        <thead>
          <tr>
            <th>Persona / llave</th>
            <th>Estado respuesta</th>
            <th>Cruce</th>
            <th>Respuesta</th>
            <th>Canal / recopilador</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            const id = caseIdentity(item);
            const selected = id === selectedId;
            const responseValue = internalCaseResponseStateValue(item);
            const crossingValue = internalCaseCrossingValue(item);
            return (
              <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                <td>
                  <button type="button" onClick={() => onCaseSelect(item)}>
                    <strong>{caseDisplayName(item)}</strong>
                    <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"}</small>
                  </button>
                </td>
                <td>
                  <span className={`mon-query-badge is-${platformToneValue(item)}`}>{internalCaseResponseStateLabel(responseValue)}</span>
                  <small>Avance: {advancementLabel(item.advancement)}</small>
                </td>
                <td>
                  <span className={`mon-query-badge is-${crossingToneValue(item)}`}>{internalCaseCrossingLabel(crossingValue)}</span>
                  <small>{item.base_record || item.base_source || item.base_result || "Sin base"}</small>
                </td>
                <td>
                  <span>{item.response_id || "sin response_id"}</span>
                  <small>{item.date || "sin fecha"} · {item.source_label || "SurveyMonkey"}</small>
                </td>
                <td>
                  <span>{internalQueryCollectorDisplayLabel(item)}</span>
                  <small>{acreditacionChannelDisplay(item.channel)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cases.length > visible.length ? (
        <p className="mon-query-table-more">
          Mostrando {fmt(visible.length)} de {fmt(cases.length)} casos. Usa filtros para acotar.
        </p>
      ) : null}
    </div>
  );
}

function AcreditacionCaseDetail({
  item,
  busyId = "",
  onDecision,
  showSubsanacionGuide = false,
}: {
  item: MonitoreoInternalQueryCase | null;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
  showSubsanacionGuide?: boolean;
}) {
  if (!item) {
    return (
      <aside className="mon-query-detail is-empty" aria-label="Detalle de caso">
        <EmptyPanel title="Selecciona un caso" detail="El detalle muestra base, respuesta, recopilador, regla y decisión." />
      </aside>
    );
  }
  const responseValue = internalCaseResponseStateValue(item);
  const crossingValue = internalCaseCrossingValue(item);
  const showAssisted = assistedReviewVisible(item);
  const isTelefonicoCase = Boolean(item.phone_audit) || item.channel_key_strategy === "codpulso" || normalizeSourceMatch(item.base_source).includes("barrido telefonico");
  const telefonicoPhoneEffective = isTelefonicoCase ? telefonicoCaseDeclaresEffective(item) : false;
  const telefonicoBaseTrace = isTelefonicoCase ? telefonicoCaseBaseTrace(item) : null;
  const telefonicoOutsideBase = Boolean(telefonicoBaseTrace?.outsideBase);
  const telefonicoPlatformEffective = isTelefonicoCase ? telefonicoCasePlatformEffective(item) : false;
  const telefonicoBaseLabel = telefonicoBaseTrace?.label ?? "Base por revisar";
  const telefonicoPhoneState = item.base_status || item.secondary_identity_value || "Sin estado";
  const telefonicoDecisionTitle = telefonicoOutsideBase
    ? "Kobo efectiva fuera de base"
    : telefonicoPlatformEffective && telefonicoPhoneEffective
      ? "Kobo y barrido coinciden"
      : telefonicoPlatformEffective
        ? "Kobo efectiva; estado telefónico pendiente"
        : telefonicoPhoneEffective
          ? "Tel. efectiva sin efectiva Kobo"
          : "Sin efectiva comparable";
  const telefonicoDecisionDetail = telefonicoOutsideBase
    ? "La respuesta cuenta en Kobo, pero su CodPulso no queda respaldado por la base telefónica del corte."
    : telefonicoPlatformEffective && telefonicoPhoneEffective
      ? "La plataforma cuenta la efectiva y el barrido telefonico declara efectivo el mismo CodPulso."
      : telefonicoPlatformEffective
        ? `La plataforma cuenta la efectiva y el CodPulso esta en base; el barrido todavia declara "${telefonicoPhoneState}".`
      : telefonicoPhoneEffective
          ? "El barrido declara efectiva, pero Kobo no trae una respuesta completa valida para ese CodPulso."
          : "El caso no tiene efectiva Kobo ni efectiva telefónica con los criterios activos.";
  const telefonicoHeaderMeta = [
    item.base_status || item.secondary_identity_value,
    internalQueryCollectorDisplayLabel(item),
  ].filter(Boolean).join(" · ");
  const telefonicoHeaderStatus = telefonicoPlatformEffective
    ? "Kobo efectiva"
    : telefonicoPhoneEffective
      ? "Tel. efectiva"
      : advancementLabel(item.advancement);
  return (
    <aside className={`mon-query-detail is-${caseToneValue(item)}`} aria-label="Detalle de caso seleccionado">
      <header>
        <span>
          {isTelefonicoCase
            ? `Ficha CodPulso${telefonicoHeaderMeta ? ` · ${telefonicoHeaderMeta}` : ""}`
            : `Ficha 360 del caso · ${item.actor || "Sin actor"}`}
        </span>
        <strong>{isTelefonicoCase ? telefonicoCaseCodPulsoLabel(item) : caseDisplayName(item)}</strong>
        <em>{isTelefonicoCase ? telefonicoHeaderStatus : advancementLabel(item.advancement)}</em>
      </header>

      <section className="mon-query-decision-card" aria-label="Explicación de la decisión final">
        <span><CheckCircle2 size={14} /> {isTelefonicoCase ? "Lectura operativa" : "Decisión final"}</span>
        <strong>{isTelefonicoCase ? telefonicoDecisionTitle : item.decision || advancementLabel(item.advancement)}</strong>
        <p>{isTelefonicoCase ? telefonicoDecisionDetail : item.decision_reason || item.rule || item.issue_type || "Clasificación construida con la regla estándar del estudio."}</p>
        <div>
          <em>Respuesta: {internalCaseResponseStateLabel(responseValue)}</em>
          {isTelefonicoCase ? (
            <>
              <em>CodPulso/base: {telefonicoBaseLabel}</em>
              <em>Barrido: {telefonicoPhoneEffective ? "Efectiva" : telefonicoPhoneState}</em>
            </>
          ) : (
            <em>Cruce: {internalCaseCrossingLabel(crossingValue)}</em>
          )}
          <em>Avance: {advancementLabel(item.advancement)}</em>
          {item.pending_exit ? <em>Sale de pendientes</em> : null}
          {Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? <em>{fmt(item.duplicate_count ?? item.duplicate_group_size)} duplicados</em> : null}
        </div>
      </section>

      {showSubsanacionGuide ? <AcreditacionSubsanacionCoach item={item} /> : null}

      <AcreditacionCaseKeyTrace item={item} />

      {showAssisted ? (
        <AcreditacionAssistedReviewBlock
          item={item}
          busy={busyId === item.response_id}
          onDecision={onDecision}
        />
      ) : null}

      <div className="mon-query-trace-chain" aria-label="Cadena de trazabilidad">
        <AcreditacionTraceStep
          icon={<Layers3 size={14} />}
          label={isTelefonicoCase ? "CodPulso/base" : "Universo / base oficial"}
          value={isTelefonicoCase ? telefonicoBaseLabel : item.base_record || item.case_key || "Sin registro en base"}
          hint={isTelefonicoCase ? telefonicoBaseTrace?.detail ?? "Sin detalle de base" : `${item.base_source || "Sin fuente"} · ${item.base_status || item.base_result || "Sin estado"}`}
        />
        <AcreditacionTraceStep
          icon={<ClipboardCheck size={14} />}
          label="Respuesta"
          value={item.response_id || "Sin response_id"}
          hint={`${internalCaseResponseStateLabel(responseValue)} · ${item.date || "Sin fecha"}`}
        />
        <AcreditacionTraceStep
          icon={<Route size={14} />}
          label="Canal operativo / recopilador"
          value={internalQueryCollectorDisplayLabel(item)}
          hint={item.channel ? acreditacionChannelDisplay(item.channel) : item.source_label || "Sin canal"}
        />
        <AcreditacionTraceStep
          icon={<SlidersHorizontal size={14} />}
          label={isTelefonicoCase ? "Regla de lectura" : "Regla de base"}
          value={item.rule || item.issue_type || "Regla estándar"}
          hint={item.decision_reason || "Sin motivo adicional"}
        />
      </div>

      <dl className="mon-query-detail-facts">
        <div><dt>{isTelefonicoCase ? "CodPulso" : "CodPulso / llave"}</dt><dd>{item.case_key || "Sin llave"}</dd></div>
        <div><dt>{isTelefonicoCase ? "CodPulso/base" : "Cruce"}</dt><dd>{isTelefonicoCase ? telefonicoBaseLabel : internalCaseCrossingLabel(crossingValue)}</dd></div>
        {isTelefonicoCase ? <div><dt>Estado telefónico</dt><dd>{telefonicoPhoneEffective ? "Efectiva" : telefonicoPhoneState}</dd></div> : null}
        <div><dt>Cuenta avance</dt><dd>{caseCountsLabel(item)}</dd></div>
        <div><dt>Responsable/recopilador</dt><dd>{internalQueryCollectorDisplayLabel(item)}</dd></div>
        <div><dt>Response ID</dt><dd>{item.response_id || "Sin response_id"}</dd></div>
        <div><dt>Fecha y hora</dt><dd>{caseResponseDateTimeLabel(item)}</dd></div>
        <div><dt>Hora respuesta</dt><dd>{caseResponseTimeDetailLabel(item)}</dd></div>
        <div><dt>Duplicados</dt><dd>{Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? fmt(item.duplicate_count ?? item.duplicate_group_size) : "No"}</dd></div>
      </dl>
    </aside>
  );
}

function AcreditacionQueryBreakdownCard({
  title,
  dimension,
  rows,
  icon,
  onSelect,
}: {
  title: string;
  dimension: AcreditacionCaseBreakdownDimension;
  rows: AcreditacionCaseBreakdownRow[];
  icon: ReactNode;
  onSelect: (value: string) => void;
}) {
  const limitedRows = rows.slice(0, 10);
  const totals = rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    effective: acc.effective + row.effective,
    partial: acc.partial + row.partial,
    refusal: acc.refusal + row.refusal,
    pending: acc.pending + row.pending,
    review: acc.review + row.review,
  }), { total: 0, effective: 0, partial: 0, refusal: 0, pending: 0, review: 0 });
  const effectivePct = safePercentValue(totals.effective, totals.total);
  const donutSegments = [
    { value: totals.effective, color: COLOR_RESULTADO.efectiva },
    { value: totals.partial, color: COLOR_RESULTADO.parcial },
    { value: totals.refusal, color: COLOR_RESULTADO.rechazo },
    { value: totals.pending, color: COLOR_RESULTADO.pendiente },
    { value: totals.review, color: "#474f5b" },
  ];

  if (!limitedRows.length) {
    return (
      <section className="mon-query-chart-card">
        <header><span>{icon}{title}</span></header>
        <div className="mon-query-breakdown-empty">
          <EmptyPanel title="Sin casos para este filtro" detail="El filtro actual no devuelve casos. Ajusta los criterios para ampliar la lectura." />
        </div>
      </section>
    );
  }

  return (
    <section className="mon-query-chart-card">
      <header>
        <span>{icon}{title}</span>
        <em>{formatCaseLabel(totals.total)}</em>
      </header>
      <div className="mon-query-chart-legend" aria-label="Series del desglose">
        <span className="is-effective">Efectivas</span>
        <span className="is-partial">Parciales</span>
        <span className="is-refusal">Rechazos</span>
        <span>Sin respuesta</span>
        <span className="is-review">Revisión</span>
      </div>
      <div className="mon-query-breakdown">
        <div
          className="mon-query-donut"
          style={{ "--query-donut-bg": acreditacionQueryDonutBackground(donutSegments) } as CSSProperties}
          aria-label={`${formatPercentLabel(effectivePct)} de efectivas`}
        >
          <span>{formatPercentLabel(effectivePct)}</span>
          <em>efectivas</em>
        </div>
        <div className="mon-query-breakdown-table-wrap">
          <table className="mon-query-breakdown-table">
            <thead>
              <tr>
                <th>{title.replace(/^Por\s+/i, "")}</th>
                <th>Total</th>
                <th>Efec.</th>
                <th>Parc.</th>
                <th>Rech.</th>
                <th>Sin resp.</th>
              </tr>
            </thead>
            <tbody>
              {limitedRows.map((row) => (
                <tr key={`${dimension}-${row.value || "sin-dato"}`}>
                  <td>
                    <button
                      type="button"
                      onClick={() => row.value && onSelect(row.value)}
                      disabled={!row.value}
                      title={row.value ? "Filtrar por este valor" : "Sin valor filtrable"}
                    >
                      {row.label}
                    </button>
                  </td>
                  <td>{fmt(row.total)}</td>
                  <td>{fmt(row.effective)}</td>
                  <td>{fmt(row.partial)}</td>
                  <td>{fmt(row.refusal)}</td>
                  <td>{fmt(row.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limitedRows.length ? (
            <p>{fmt(rows.length - limitedRows.length)} valores adicionales disponibles con filtros.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AcreditacionDistributionView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const byActor = acreditacionCaseBreakdownRows(cases, "actor");
  const bySource = acreditacionCaseBreakdownRows(cases, "source");
  const byChannel = acreditacionCaseBreakdownRows(cases, "channel");
  return (
    <div className="mon-query-grid mon-query-grid--distribution">
      <div className="mon-query-chart-grid">
        <AcreditacionQueryBreakdownCard
          title="Por actor"
          dimension="actor"
          rows={byActor}
          icon={<ContactRound size={15} />}
          onSelect={(actor) => onFilter({ actor })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por fuente/base"
          dimension="source"
          rows={bySource}
          icon={<Layers3 size={15} />}
          onSelect={(source) => onFilter({ source })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por canal"
          dimension="channel"
          rows={byChannel}
          icon={<Route size={15} />}
          onSelect={(channel) => onFilter({ channel })}
        />
      </div>

      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos dentro de la distribución"
        busyId={busyId}
        onDecision={onDecision}
      />
    </div>
  );
}

function AcreditacionEffectivesView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const summary = summarizeInternalCases(cases);
  const byDate = acreditacionCaseBreakdownRows(cases, "date");
  const byChannel = acreditacionCaseBreakdownRows(cases, "channel");
  const byCollector = acreditacionCaseBreakdownRows(cases, "collector");
  return (
    <div className="mon-query-grid mon-query-grid--effectives">
      <section className="mon-query-kpi-strip" aria-label="Indicadores de efectivas">
        <span className="is-effective"><em>Efectivas reales</em><strong>{fmt(summary.effective)}</strong><small>completas válidas</small></span>
        <span className="is-partial"><em>Parciales</em><strong>{fmt(summary.partial)}</strong><small>no inflan avance</small></span>
        <span className="is-refusal"><em>Rechazos</em><strong>{fmt(summary.refusal)}</strong><small>consentimiento u otro filtro</small></span>
        <span className="is-warning"><em>Sin respuesta</em><strong>{fmt(summary.pending)}</strong><small>en base</small></span>
      </section>

      <div className="mon-query-chart-grid">
        <AcreditacionQueryBreakdownCard
          title="Por fecha"
          dimension="date"
          rows={byDate}
          icon={<CalendarRange size={15} />}
          onSelect={(date) => onFilter({ date })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por canal"
          dimension="channel"
          rows={byChannel}
          icon={<Route size={15} />}
          onSelect={(channel) => onFilter({ channel })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por recopilador"
          dimension="collector"
          rows={byCollector}
          icon={<ListChecks size={15} />}
          onSelect={(collector) => onFilter({ collector })}
        />
      </div>

      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos efectivos"
        busyId={busyId}
        onDecision={onDecision}
      />
    </div>
  );
}

function AcreditacionPendingExitView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const visibleSelectedCase = selectedCase && cases.some((item) => caseIdentity(item) === caseIdentity(selectedCase))
    ? selectedCase
    : cases[0] ?? null;
  return (
    <div className="mon-query-grid mon-query-grid--pending">
      <section className={`mon-query-flow-panel${cases.length ? "" : " is-empty-flow"}`} aria-label="Flujo de salida de pendientes">
        <header className="mon-query-section-head">
          <div>
            <span>Faltantes y barrido</span>
            <strong><Route size={16} /> Base operativa → respuesta → avance</strong>
          </div>
          <em>{formatCaseLabel(cases.length)}</em>
        </header>
        {cases.length ? (
          <DataTable
            rows={caseDimensionRows(cases, "actor", "Actor")}
            empty="No hay flujo por actor para este corte."
          />
        ) : (
          <EmptyPanel
            title="Sin flujo disponible"
            detail="No hay casos recuperados desde faltantes o barrido con los filtros activos."
          />
        )}
      </section>
      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={visibleSelectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos que salen de pendientes"
        busyId={busyId}
        onDecision={onDecision}
        showDetailWhenEmpty={false}
      />
    </div>
  );
}

function AcreditacionPlatformRecordsView({
  cases,
  selectedCase,
  profileMode = "acreditacion",
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
  onJumpToSubsanacion,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  profileMode?: AcreditacionProfileMode;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
}) {
  if (profileMode === "telefonico") {
    return (
      <TelefonicoEffectiveConsultedView
        cases={cases}
        selectedCase={selectedCase}
        filters={filters}
        actorOptions={actorOptions}
        dateOptions={dateOptions}
        sourceOptions={sourceOptions}
        collectorOptions={collectorOptions}
        activeFilters={activeFilters}
        onCaseSelect={onCaseSelect}
        onFilter={onFilter}
        onClear={onClear}
      />
    );
  }
  const visible = cases.slice(0, 160);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-acr-platform-grid">
      <section className="mon-query-table-panel mon-acr-platform-table-panel" aria-label="Registros en plataforma">
        <header className="mon-query-section-head">
          <div>
            <span>Registros en plataforma</span>
            <strong><ListChecks size={16} /> Respuestas por última actualización</strong>
          </div>
          <em>{fmt(cases.length)} filas</em>
        </header>
        <AcreditacionPlatformFilterCapsules
          filters={filters}
          actorOptions={actorOptions}
          channelOptions={channelOptions}
          dateOptions={dateOptions}
          sourceOptions={sourceOptions}
          collectorOptions={collectorOptions}
          responseOptions={responseOptions}
          crossingOptions={crossingOptions}
          activeFilters={activeFilters}
          onFilter={onFilter}
          onClear={onClear}
        />
        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-platform-table">
              <thead>
                <tr>
                  <th>Actor / caso</th>
                  <th>Respuesta</th>
                  <th>Fecha y hora</th>
                  <th>Canal / fuente</th>
                  <th>Cruce</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  const canOpenSubsanacion = caseIsSubsanacionCandidate(item);
                  const trace = caseKeyTraceSummary(item);
                  return (
                    <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"}</small>
                        </button>
                      </td>
                      <td>
                        <CaseStatusPill value={internalCaseResponseStateValue(item)} />
                        <DetalleDeCelda referencia={caseDisplayName(item)} detalle={item.response_id} />
                      </td>
	                      <td>
	                        <span>{caseResponseDateTimeLabel(item)}</span>
	                        <DetalleDeCelda referencia={caseResponseDateTimeLabel(item)} detalle={caseResponseTimeDetailLabel(item)} />
	                      </td>
                      <td>
                        <span>{acreditacionChannelLabel(item.channel || item.source_label)}</span>
                        <small>{[trace.strategyLabel, item.source_label, internalQueryCollectorDisplayLabel(item)].filter(Boolean).join(" · ")}</small>
                      </td>
                      <td>
                        <CaseCrossingPill value={internalCaseCrossingValue(item)} />
                        <DetalleDeCelda referencia={internalCaseCrossingLabel(internalCaseCrossingValue(item))} detalle={item.base_record || item.base_source || item.base_result} />
                      </td>
                      <td>
                        {canOpenSubsanacion ? (
                          <button type="button" className="mon-acr-table-action" onClick={() => onJumpToSubsanacion(item)}>
                            <ShieldAlert size={13} />
                            <span>{caseSubsanacionActionLabel(item)}</span>
                          </button>
                        ) : (
                          <span className="mon-acr-action-muted">Sin subsanación</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin registros de plataforma" detail="No hay respuestas de plataforma con los filtros activos." />
        )}
        {cases.length > visible.length ? <p className="mon-query-table-more">Mostrando {fmt(visible.length)} de {fmt(cases.length)} registros. Usa filtros para acotar.</p> : null}
      </section>
    </div>
  );
}

function AcreditacionBaseStateChips({
  value,
  options,
  allCount,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allCount: number;
  onChange: (value: string) => void;
}) {
  const ordered = ["complete", "partial", "refusal", "pending"];
  const optionMap = new Map(options.map((option) => [option.value, option]));
  const visibleOptions = ordered
    .map((key) => optionMap.get(key) ?? { value: key, label: internalCaseResponseStateLabel(key), count: 0 });
  return (
    <section className="mon-acr-state-capsules" aria-label="Filtro por estado de respuesta en base">
      <button type="button" className={!value ? "is-active" : ""} aria-pressed={!value} onClick={() => onChange("")}>
        <span>Todos</span>
        <em>{fmt(allCount)}</em>
      </button>
      {visibleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${value === option.value ? "is-active " : ""}is-${option.value}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          <em>{fmt(option.count)}</em>
        </button>
      ))}
    </section>
  );
}

function AcreditacionBaseCapsuleSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`mon-acr-base-filter-pill${value ? " is-active" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {compactSelectLabel(option.label, 34)} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionBaseFilterBar({
  filters,
  actorOptions,
  responseOptions,
  responseAllCount,
  activeFilters,
  onFilter,
  onClear,
}: {
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mon-acr-base-filters" aria-label="Filtros de estado de la base">
      <label className={`mon-acr-base-search-pill${filters.search ? " is-active" : ""}`}>
        <Search size={14} />
        <input
          value={filters.search}
          onChange={(event) => onFilter({ search: event.target.value })}
          placeholder="Buscar nombre, código o correo en la base"
        />
      </label>
      <AcreditacionBaseCapsuleSelect
        label="Actor"
        value={filters.actor}
        options={actorOptions}
        allLabel="Todos los actores"
        onChange={(actor) => onFilter({ actor })}
      />
      <AcreditacionBaseStateChips
        value={filters.response}
        options={responseOptions}
        allCount={responseAllCount}
        onChange={(response) => onFilter({ response })}
      />
      <button type="button" className="mon-acr-base-clear-pill" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
        <XCircle size={14} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}

function AcreditacionBaseStatusView({
  cases,
  selectedCase,
  filters,
  actorOptions,
  responseOptions,
  responseAllCount,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  const visible = cases;
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-acr-base-grid">
      <section className="mon-query-table-panel mon-acr-base-table-panel" aria-label="Estado de la base por actor">
        <header className="mon-query-section-head">
          <div>
            <span>Estado de la base</span>
            <strong><Table2 size={16} /> Universo persona por persona</strong>
          </div>
          <em>{fmt(cases.length)} casos</em>
        </header>
        <AcreditacionBaseFilterBar
          filters={filters}
          actorOptions={actorOptions}
          responseOptions={responseOptions}
          responseAllCount={responseAllCount}
          activeFilters={activeFilters}
          onFilter={onFilter}
          onClear={onClear}
        />
        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-base-table">
              <thead>
                <tr>
                  <th>Persona / código</th>
                  <th>Actor</th>
                  <th>Estado respuesta</th>
                  <th>Última respuesta</th>
                  <th>Cruce</th>
                  <th>Avance final</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  return (
                    <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.case_key || item.base_record || "sin código"}</small>
                        </button>
                      </td>
                      <td>{item.actor || "Sin actor"}</td>
                      <td><CaseStatusPill value={internalCaseResponseStateValue(item)} /></td>
                      <td>
                        <span>{caseHasPlatformResponse(item) ? caseResponseDateTimeLabel(item) : "Sin respuesta"}</span>
                        <small>{item.response_id || item.base_status || "Pendiente en base"}</small>
                      </td>
                      <td>
                        <CaseCrossingPill value={internalCaseCrossingValue(item)} />
                        <small>{item.base_source || item.base_result || "Sin base"}</small>
                      </td>
                      <td>
                        <span>{advancementLabel(item.advancement)}</span>
                        <small>{caseCountsLabel(item)}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin casos de base" detail="No hay filas del universo con los filtros activos." />
        )}
      </section>
    </div>
  );
}

function AcreditacionCrossingsView({
  cases,
  selectedCase,
  profileMode = "acreditacion",
  phoneMetrics = null,
  onCaseSelect,
  onJumpToSubsanacion,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  profileMode?: AcreditacionProfileMode;
  phoneMetrics?: PhonePlatformComparisonTotals | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
}) {
  // Agrupado por lo que se puede hacer con cada caso. El límite es por grupo:
  // con un tope global el grupo mayor se lo come entero y el resto queda
  // inalcanzable.
  const filasAgrupadas = filasDeCruceDeCasos(cases, 45);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  const isPhoneMode = profileMode === "telefonico";
  const phonePlatformEffective = isPhoneMode ? phoneMetrics?.platformComplete ?? cases.filter(telefonicoCasePlatformEffective).length : 0;
  const phoneSweepEffective = isPhoneMode ? phoneMetrics?.phoneEffective ?? cases.filter(telefonicoCaseDeclaresEffective).length : 0;
  const phoneMatchedEffective = isPhoneMode ? phoneMetrics?.matchedEffective ?? cases.filter((item) => telefonicoCasePlatformEffective(item) && telefonicoCaseDeclaresEffective(item)).length : 0;
  const phonePlatformWithoutSweep = isPhoneMode ? phoneMetrics?.platformWithoutPhone ?? cases.filter((item) => telefonicoCasePlatformEffective(item) && !telefonicoCaseDeclaresEffective(item)).length : 0;
  const phoneSweepWithoutPlatform = isPhoneMode ? phoneMetrics?.phoneWithoutPlatform ?? cases.filter((item) => !telefonicoCasePlatformEffective(item) && telefonicoCaseDeclaresEffective(item)).length : 0;
  const phoneReviewCount = isPhoneMode ? phoneMetrics?.mismatch ?? phonePlatformWithoutSweep + phoneSweepWithoutPlatform : 0;
  const crossingHeading = isPhoneMode
    ? `${fmt(phoneMatchedEffective)}/${fmt(phonePlatformEffective)} Kobo con tel. efectiva`
    : "Razón de cruce o no cruce";
  return (
    <div className="mon-acr-crossing-grid">
      <section className="mon-query-table-panel" aria-label={isPhoneMode ? "Entrevistas y su estado en la hoja" : "Cruces efectivos"}>
        <header className="mon-query-section-head">
          <div>
            <span>{isPhoneMode ? "Teléfono vs Kobo" : "Cruces efectivos"}</span>
          <strong><Link2 size={16} /> {crossingHeading}</strong>
          <small>
            {isPhoneMode
                ? "Kobo manda el avance; esta vista separa CodPulso/base, estado telefónico y efectiva Kobo."
                : lecturaDeCruceDeCasos(cases)}
          </small>
          </div>
          <em>{isPhoneMode ? `${fmt(phoneReviewCount)} por revisar` : `${fmt(cases.length)} registros`}</em>
        </header>
        {isPhoneMode ? (
          <div className="mon-phone-crossing-summary" aria-label="Resumen de alineación barrido-Kobo por CodPulso">
            <span className="is-platform"><em>Kobo efectivas</em><strong>{fmt(phonePlatformEffective)}</strong><small>completas y con consentimiento</small></span>
            <span className="is-phone"><em>Tel. efectivas</em><strong>{fmt(phoneSweepEffective)}</strong><small>estado telefónico efectivo</small></span>
            <span className={phoneReviewCount ? "is-warning" : "is-ready"}><em>Kobo + tel.</em><strong>{fmt(phoneMatchedEffective)}/{fmt(phonePlatformEffective)}</strong><small>{phoneReviewCount ? "mismo CodPulso en ambos lados" : "CodPulso alineados"}</small></span>
            <span className={phonePlatformWithoutSweep ? "is-warning" : "is-ready"}><em>Tel. pendiente</em><strong>{fmt(phonePlatformWithoutSweep)}</strong><small>{phonePlatformWithoutSweep ? "Kobo cuenta; barrido aun no declara efectiva" : "sin brecha Kobo-tel."}</small></span>
          </div>
        ) : null}
        {filasAgrupadas.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-crossing-table">
	              <thead>
	                <tr>
	                  <th>Caso</th>
	                  <th>{isPhoneMode ? "Estado de la llamada" : "Cruce"}</th>
	                  <th>{isPhoneMode ? "Qué pasa" : "Razón"}</th>
	                  {isPhoneMode ? null : <th>Evidencia</th>}
	                  <th>{isPhoneMode ? "Qué hacer" : "Decisión / acción"}</th>
	                </tr>
	              </thead>
              <tbody>
                {filasAgrupadas.map((fila) => {
                  if (fila.tipo === "grupo") {
                    return (
                      <tr key={`grupo-${fila.clave}`} className={`mon-acr-crossing-group is-${fila.clave}`}>
                        {/* El flex vive dentro del `th`: sobre la celda anula el colSpan. */}
                        <th scope="rowgroup" colSpan={isPhoneMode ? 4 : 5}>
                          <span>
                            <strong>{fila.titulo}</strong>
                            <small>{fila.detalle}</small>
                            <em>{fmt(fila.total)}</em>
                          </span>
                        </th>
                      </tr>
                    );
                  }
                  const item = fila.item;
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  const explanation = buildCaseCrossingExplanation(item);
                  const canOpenSubsanacion = caseIsSubsanacionCandidate(item);
                  const trace = caseKeyTraceSummary(item);
                  const phoneCaveat = isPhoneMode && telefonicoCaseHasEffectiveCaveat(item);
                  const phonePlatformOk = isPhoneMode && telefonicoCasePlatformEffective(item);
                  const phoneSweepOk = isPhoneMode && telefonicoCaseDeclaresEffective(item);
                  const phoneNeedsReview = isPhoneMode && (phonePlatformOk !== phoneSweepOk || phoneCaveat);
                  const phoneCaseTitle = telefonicoCaseCodPulsoLabel(item);
                  const phoneStatus = item.base_status || item.secondary_identity_value || "Sin estado";
                  const phoneCaseDetail = [
                    phoneStatus,
                    caseResponseDateTimeLabel(item),
                  ].filter((value) => value && value !== "Sin respuesta").join(" · ");
                  const baseTrace = isPhoneMode ? telefonicoCaseBaseTrace(item) : null;
                  const reasonTitle = isPhoneMode
                    ? phonePlatformOk && !phoneSweepOk
                      ? baseTrace?.found
                        ? "Falta marcarla en la hoja"
                        : "Sin respaldo en la base"
                      : !phonePlatformOk && phoneSweepOk
                        ? "Marcada sin encuesta completa"
                        : phoneNeedsReview
                          ? "Diferencia por revisar"
                          : "Todo coincide"
                    : explanation.title;
	                  const reasonDetail = isPhoneMode
	                    ? phonePlatformOk && !phoneSweepOk
	                      ? baseTrace?.found
	                        ? "La persona respondió la encuesta completa, pero en la hoja sigue como no efectiva."
	                        : "Respondió la encuesta, pero su código no se encuentra en la base."
	                      : !phonePlatformOk && phoneSweepOk
	                        ? "La hoja la marca como efectiva, pero no hay encuesta completa con ese código."
	                        : phoneNeedsReview
	                          ? "El código y el estado no coinciden entre la hoja y la plataforma."
	                          : "La hoja y la plataforma coinciden."
                    : explanation.detail;
                  const decisionLabel = isPhoneMode
                    ? phonePlatformOk && !phoneSweepOk
                      ? "Actualizar la hoja"
                      : phoneNeedsReview ? "Revisar el caso" : "Nada pendiente"
                    : explanation.decisionLabel;
                  const actionLabel = isPhoneMode
                    ? phoneNeedsReview
                      ? phonePlatformOk
                        ? "Ya cuenta para el avance; falta registrar el estado."
                        : "No cuenta para el avance hasta aclarar por qué se marcó."
                      : "Cuenta para el avance."
                    : explanation.action;
                  return (
                    <tr key={id} className={`is-${explanation.tone}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{isPhoneMode ? phoneCaseTitle : caseDisplayName(item)}</strong>
                          <small>
                            {isPhoneMode
                              ? phoneCaseDetail || "Efectiva Kobo"
                              : `${item.actor || "Sin actor"} · ${item.response_id || item.case_key || "sin llave"}`}
                          </small>
                        </button>
                      </td>
	                      <td>
	                        {isPhoneMode ? (
	                          <span className={`mon-phone-crossing-pill ${phoneNeedsReview ? "is-warning" : "is-ready"}`}>
	                            {phoneSweepOk ? "Efectivo" : phoneStatus}
	                          </span>
	                        ) : (
	                          <CaseCrossingPill value={internalCaseCrossingValue(item)} />
	                        )}
	                        {isPhoneMode ? null : <small>{internalCaseResponseStateLabel(internalCaseResponseStateValue(item))}</small>}
	                      </td>
                      <td>
                        <strong>{reasonTitle}</strong>
                        <small>{reasonDetail}</small>
                      </td>
                      {isPhoneMode ? null : (
                        <td>
                          <span>{trace.primaryEvidence}</span>
                          <small>{[trace.strategyLabel, trace.secondaryEvidence || explanation.evidenceDetail].filter(Boolean).join(" · ")}</small>
                        </td>
                      )}
                      <td>
                        <strong>{decisionLabel}</strong>
                        <small>{actionLabel}</small>
                        {canOpenSubsanacion ? (
                          <button type="button" className="mon-acr-inline-action" onClick={() => onJumpToSubsanacion(item)}>
                            {caseSubsanacionActionLabel(item)}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin registros de plataforma" detail="No hay cruces para los filtros activos." />
        )}
      </section>
      <AcreditacionCaseDetail item={selectedCase} />
    </div>
  );
}

function AcreditacionSubsanacionView({
  cases,
  selectedCase,
  busyId,
  onCaseSelect,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  busyId?: string;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  // Recuperables primero: una completa que no cruza se rescata y suma. Lo que el
  // canal ya explica —rechazo, parcial que cortó antes del código— va al final.
  const { paso, setPaso, conteo, visibles, grupos, motivoDe } = useBandejaDeSubsanacion(cases);
  const selectedVisible = selectedCase && visibles.some((item) => caseIdentity(item) === caseIdentity(selectedCase)) ? selectedCase : visibles[0] ?? null;
  return (
    <div className="mon-acr-subsanacion-grid">
      <section className="mon-query-issues-panel" aria-label="Lista de subsanación">
        <header className="mon-query-section-head">
          <div>
            <span>Subsanación</span>
            <strong><ShieldAlert size={16} /> Bandeja de decisión</strong>
            <small>Trabaja primero las completas/parciales sin cruce; cada caso debe terminar incluido con salvedad o explicado.</small>
          </div>
          <em>{fmt(visibles.length)} casos</em>
        </header>
        <RutaDeSubsanacion paso={paso} conteo={conteo} onPaso={setPaso} />
        {visibles.length ? (
          <div className="mon-acr-subsanacion-list">
            {grupos.map((group) => (
              <section key={group.title}>
                <span>{group.title} <small>{group.detalle}</small></span>
                {group.rows.length ? group.rows.slice(0, 80).map((item) => {
                  const selected = selectedVisible && caseIdentity(selectedVisible) === caseIdentity(item);
                  const motivo = motivoDe(item);
                  // El motivo dice qué pasó con la llave; la segunda línea, por
                  // dónde y cuándo entró, que es lo que distingue casos que
                  // comparten motivo.
                  return (
                    <button key={caseIdentity(item)} type="button" className={selected ? "is-active" : ""} onClick={() => onCaseSelect(item)}>
                      <strong>{caseDisplayName(item)}</strong>
                      <span className="mon-acr-motivo">{motivo.etiqueta}</span>
                      {/* Sin `title` el texto recortado se pierde del todo. */}
                      <small title={`${item.actor || "Sin actor"} · ${formatInternalQueryDateLabel(item.date)} · ${internalQueryCollectorDisplayLabel(item)}`}>
                        {item.actor || "Sin actor"} · {formatInternalQueryDateLabel(item.date)} · {internalQueryCollectorDisplayLabel(item)}
                      </small>
                      <em>{caseSubsanacionActionLabel(item)}</em>
                    </button>
                  );
                }) : <p>Sin casos en este grupo.</p>}
              </section>
            ))}
          </div>
        ) : (
          <EmptyPanel title="Sin no cruces" detail="No hay casos sin cruce con los filtros activos." />
        )}
      </section>
      <AcreditacionCaseDetail item={selectedVisible} busyId={busyId} onDecision={onDecision} showSubsanacionGuide />
    </div>
  );
}

function AcreditacionCasesWorkspace({
  cases,
  selectedCase,
  onCaseSelect,
  title = "Casos trazables",
  busyId = "",
  onDecision,
  showDetailWhenEmpty = true,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  title?: string;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
  showDetailWhenEmpty?: boolean;
}) {
  const showDetail = Boolean(selectedCase || showDetailWhenEmpty);
  return (
    <div className={`mon-query-cases-workspace${showDetail ? "" : " mon-query-cases-workspace--no-detail"}`}>
      <section className="mon-query-table-panel" aria-label={title}>
        <div className="mon-query-table-head-stack">
          <header className="mon-query-section-head">
            <div>
              <span>Detalle local</span>
              <strong><Search size={16} /> {title}</strong>
            </div>
            <em>{fmt(cases.length)} filas</em>
          </header>
        </div>
        <AcreditacionCasesTable cases={cases} selectedCase={selectedCase} onCaseSelect={onCaseSelect} />
      </section>
      {showDetail ? <AcreditacionCaseDetail item={selectedCase} busyId={busyId} onDecision={onDecision} /> : null}
    </div>
  );
}

function TelefonicoEffectiveConsultedView({
  cases,
  selectedCase,
  filters,
  segmento = "Actor",
  actorOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  filters: AcreditacionCaseFilters;
  /** Cómo llama este estudio al segmento de cuotas. Ver `segmentoDeCuotas.ts`.
   *  Por defecto «Actor», el mismo respaldo que ya usaba `scopeLabel`: nunca
   *  «Sede», que es justo el hardcodeo que la decisión 5a prohíbe. */
  segmento?: string;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  const visible = cases.slice(0, 160);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  const caveatCount = cases.filter(telefonicoCaseHasEffectiveCaveat).length;
  const phoneAlignedCount = cases.filter((item) => !telefonicoCaseHasEffectiveCaveat(item) && telefonicoCaseDeclaresEffective(item)).length;
  const phonePendingCount = Math.max(0, cases.length - caveatCount - phoneAlignedCount);
  return (
    <div className="mon-phone-consulted-grid">
      <section className="mon-query-table-panel mon-phone-consulted-panel" aria-label="Efectivas Kobo consultadas">
        <header className="mon-query-section-head">
          <div>
            <span>Efectivas Kobo</span>
            <strong><CheckCircle2 size={16} /> Efectivas Kobo por CodPulso</strong>
            <small>Entrevistas completas con consentimiento. La columna de la derecha dice qué falta hacer con cada una.</small>
          </div>
          {/* El corte se anuncia en la cabecera, no solo al pie de la tabla. */}
          <em>
            {cases.length > visible.length
              ? `${fmt(visible.length)} de ${fmt(cases.length)} efectivas`
              : `${fmt(cases.length)} efectivas`}
          </em>
        </header>

        <div className="mon-phone-consulted-summary" aria-label="Resumen de efectivas consultadas">
          <span className="is-effective">
            <CheckCircle2 size={14} />
            <em>CodPulso alineado</em>
            <strong>{fmt(phoneAlignedCount)}</strong>
          </span>
          <span className={phonePendingCount ? "is-pending" : "is-muted"}>
            <PhoneCall size={14} />
            <em>Tel. pendiente</em>
            <strong>{fmt(phonePendingCount)}</strong>
          </span>
          <span className="is-base">
            <ListChecks size={14} />
            <em>Total Kobo</em>
            <strong>{fmt(cases.length)}</strong>
          </span>
        </div>

        <TelefonicoEffectiveConsultedFilters
          filters={filters}
          segmento={segmento}
          formatOptionLabel={(option) => `${compactSelectLabel(option.label, 34)} (${fmt(option.count)})`}
          actorOptions={actorOptions}
          dateOptions={dateOptions}
          sourceOptions={sourceOptions}
          collectorOptions={collectorOptions}
          activeFilters={activeFilters}
          onFilter={onFilter}
          onClear={onClear}
        />

        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-phone-consulted-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Entrevista</th>
                  <th>En la base</th>
                  <th>Estado de la llamada</th>
                  <th>Qué falta</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  const caveat = telefonicoCaseHasEffectiveCaveat(item);
                  const trace = caseKeyTraceSummary(item);
                  const responsible = item.phone_audit?.responsible || internalQueryCollectorDisplayLabel(item);
                  const phoneDeclaresEffective = telefonicoCaseDeclaresEffective(item);
                  const baseTrace = telefonicoCaseBaseTrace(item);
                  const outsideBase = baseTrace.outsideBase;
                  const phoneState = item.base_status || item.secondary_identity_value || "Sin estado";
                  const phoneReading = outsideBase
                    ? "Revisar la base"
                    : phoneDeclaresEffective
                      ? "Nada"
                      : "Marcarla en la hoja";
                  const phoneReadingDetail = outsideBase
                    ? "Respondió, pero su código no está en la base."
                    : phoneDeclaresEffective
                      ? ""
                      : "Respondió la encuesta y la hoja no lo refleja.";
                  return (
                    <tr key={id} className={`${caveat ? "is-warning" : "is-effective"}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{telefonicoCaseCodPulsoLabel(item)}</strong>
                          <small>{responsible || "Sin responsable"}</small>
                        </button>
                      </td>
                      <td>
                        <CaseStatusPill value={internalCaseResponseStateValue(item)} />
                        <small>{caseResponseDateTimeLabel(item)}</small>
                      </td>
                      <td>
                        <span className={`mon-phone-base-pill is-${baseTrace.tone}`}>
                          {baseTrace.label}
                        </span>
                        {outsideBase ? <small>fuera de la base</small> : null}
                      </td>
                      <td>
                        <span className={`mon-phone-state-pill ${phoneDeclaresEffective ? "is-effective" : "is-pending"}`}>
                          {phoneDeclaresEffective ? "Efectiva" : phoneState}
                        </span>
                      </td>
                      <td>
                        <span className={`mon-phone-consulted-tag ${outsideBase || caveat ? "is-caveat" : phoneDeclaresEffective ? "is-ok" : "is-pending"}`}>
                          {phoneReading}
                        </span>
                        {phoneReadingDetail ? <small>{phoneReadingDetail}</small> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin efectivas para estos filtros" detail="El filtro de efectivas no devuelve respuestas completas. Ajusta los criterios o revisa su configuración." />
        )}
        {cases.length > visible.length ? (
          <p className="mon-query-table-more">
            Mostrando {fmt(visible.length)} de {fmt(cases.length)} efectivas. Usa filtros para acotar.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function TelefonicoCaveatsView({
  cases,
  selectedCase,
  reviewedCount = 0,
  onCaseSelect,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  reviewedCount?: number;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
}) {
  const visible = cases.slice(0, 80);
  const selectedVisible = selectedCase && cases.some((item) => caseIdentity(item) === caseIdentity(selectedCase))
    ? selectedCase
    : cases[0] ?? null;

  if (!cases.length) {
    return (
      <div className="mon-phone-caveats mon-phone-caveats--empty">
        <section className="mon-phone-caveats-panel is-empty" aria-label="Salvedades CodPulso">
          <div className="mon-phone-caveats-empty-icon">
            <CheckCircle2 size={20} />
          </div>
          <span>Salvedades CodPulso</span>
          <strong>Sin efectivas con salvedad</strong>
          <p>Con los filtros activos, todas las efectivas de Kobo se pudieron identificar. Si alguna deja de identificarse, aparece aquí con su CodPulso, fecha, responsable y lectura del barrido.</p>
          <div className="mon-phone-caveats-empty-metrics" aria-label="Resumen de salvedades">
            <span><em>Efectivas revisadas</em><strong>{fmt(reviewedCount)}</strong></span>
            <span><em>Salvedades</em><strong>0</strong></span>
            <span><em>No identificables</em><strong>0</strong></span>
          </div>
          <div className="mon-phone-caveats-empty-guide" aria-label="Criterios de salvedad CodPulso">
            <span>
              <em>Cuenta</em>
              <strong>Completa + filtro</strong>
              <small>Pruebas quedan fuera.</small>
            </span>
            <span>
              <em>CodPulso</em>
              <strong>PDM 1234 o 1234</strong>
              <small>Sugerir PDM 1234.</small>
            </span>
            <span>
              <em>Salvedad</em>
              <strong>Sin cruce claro</strong>
              <small>Revisión separada.</small>
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mon-phone-caveats">
      <section className="mon-phone-caveats-panel" aria-label="Efectivas con salvedad">
        <header className="mon-query-section-head">
          <div>
            <span>Salvedades CodPulso</span>
            <strong><ShieldAlert size={16} /> Efectivas no identificables</strong>
            <small>Casos que cuentan en Kobo, pero requieren revisar llave, base o estado telefónico antes del corte final.</small>
          </div>
          <em>{fmt(cases.length)} casos</em>
        </header>
        <div className="mon-phone-caveats-list">
          {visible.map((item) => {
            const id = caseIdentity(item);
            const selected = selectedVisible && caseIdentity(selectedVisible) === id;
            const responsible = item.phone_audit?.responsible || internalQueryCollectorDisplayLabel(item) || "Sin responsable";
            const action = item.phone_audit?.recommended_action || "Revisar barrido frente a Kobo";
            return (
              <button key={id} type="button" className={selected ? "is-active" : ""} onClick={() => onCaseSelect(item)}>
                <span>
                  <em>{caseResponseDateTimeLabel(item)}</em>
                  <strong>{telefonicoCaseCodPulsoLabel(item)}</strong>
                  <small>{responsible}</small>
                </span>
                <span>
                  <em>Kobo</em>
                  <strong>{internalCaseResponseStateLabel(internalCaseResponseStateValue(item))}</strong>
                  <small>{item.source_label || "KoboToolbox"}</small>
                </span>
                <span>
                  <em>Barrido</em>
                  <strong>{item.base_status || item.base_result || "Revisar"}</strong>
                  <small>{action}</small>
                </span>
              </button>
            );
          })}
        </div>
        {cases.length > visible.length ? (
          <p className="mon-query-table-more">Mostrando {fmt(visible.length)} de {fmt(cases.length)} salvedades.</p>
        ) : null}
      </section>
      <AcreditacionCaseDetail item={selectedVisible} />
    </div>
  );
}

function TelefonicoConsultedWorkbench({ cases, segmento }: { cases: MonitoreoInternalQueryCase[]; segmento: string }) {
  const [filters, setFilters] = useState<AcreditacionCaseFilters>({ ...EMPTY_CASE_FILTERS });
  const [selectedId, setSelectedId] = useState("");
  const activeFilters = Object.values(filters).some(Boolean);
  const filteredCases = useMemo(() => cases.filter((item) => caseMatchesFilters(item, filters)), [cases, filters]);
  const actorFacetCases = useMemo(() => cases.filter((item) => caseMatchesFilters(item, { ...filters, actor: "" })), [cases, filters]);
  const dateFacetCases = useMemo(() => cases.filter((item) => caseMatchesFilters(item, { ...filters, date: "" })), [cases, filters]);
  const sourceFacetCases = useMemo(() => cases.filter((item) => caseMatchesFilters(item, { ...filters, source: "" })), [cases, filters]);
  const collectorFacetCases = useMemo(() => cases.filter((item) => caseMatchesFilters(item, { ...filters, collector: "" })), [cases, filters]);
  const actorOptions = useMemo(
    () => countCaseOptions(actorFacetCases, telefonicoCaseActorValue),
    [actorFacetCases],
  );
  const dateOrder = useMemo(
    () => Array.from(new Set(dateFacetCases.map((item) => item.date).filter(Boolean))).sort(compareInternalQueryDateValues),
    [dateFacetCases],
  );
  const dateOptions = useMemo(
    () => countCaseOptions(dateFacetCases, (item) => item.date, formatInternalQueryDateLabel, dateOrder),
    [dateFacetCases, dateOrder],
  );
  const sourceOptions = useMemo(
    () => countCaseOptions(sourceFacetCases, caseSourceValue),
    [sourceFacetCases],
  );
  const collectorOptions = useMemo(
    () => countCaseOptions(collectorFacetCases, caseCollectorValue, internalQueryCollectorDisplayLabel),
    [collectorFacetCases],
  );
  const selectedCase = filteredCases.find((item) => caseIdentity(item) === selectedId) ?? filteredCases[0] ?? null;

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredCases.some((item) => caseIdentity(item) === selectedId)) setSelectedId("");
  }, [filteredCases, selectedId]);

  const patchFilters = (patch: Partial<AcreditacionCaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <TelefonicoEffectiveConsultedView
      cases={filteredCases}
      selectedCase={selectedCase}
      filters={filters}
      segmento={segmento}
      actorOptions={actorOptions}
      dateOptions={dateOptions}
      sourceOptions={sourceOptions}
      collectorOptions={collectorOptions}
      activeFilters={activeFilters}
      onCaseSelect={(item) => setSelectedId(caseIdentity(item))}
      onFilter={patchFilters}
      onClear={() => setFilters({ ...EMPTY_CASE_FILTERS })}
    />
  );
}

function AcreditacionConsultaBody({
  activeTab,
  profileMode = "acreditacion",
  modeCases,
  selectedCase,
  phoneMetrics = null,
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  responseAllCount,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
  onJumpToSubsanacion,
  busyId,
  onDecision,
}: {
  activeTab: AcreditacionConsultaTab;
  profileMode?: AcreditacionProfileMode;
  modeCases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  phoneMetrics?: PhonePlatformComparisonTotals | null;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  if (activeTab === "base") {
    return (
      <AcreditacionBaseStatusView
        cases={modeCases}
        selectedCase={selectedCase}
        filters={filters}
        actorOptions={actorOptions}
        responseOptions={responseOptions}
        responseAllCount={responseAllCount}
        activeFilters={activeFilters}
        onFilter={onFilter}
        onClear={onClear}
        onCaseSelect={onCaseSelect}
      />
    );
  }
  if (activeTab === "cruces") {
    return (
      <AcreditacionCrossingsView
        cases={modeCases}
        selectedCase={selectedCase}
        profileMode={profileMode}
        phoneMetrics={phoneMetrics}
        onCaseSelect={onCaseSelect}
        onJumpToSubsanacion={onJumpToSubsanacion}
      />
    );
  }
  if (activeTab === "subsanacion") {
    if (profileMode === "telefonico") {
      return (
        <TelefonicoCaveatsView
          cases={modeCases}
          selectedCase={selectedCase}
          reviewedCount={responseAllCount}
          onCaseSelect={onCaseSelect}
        />
      );
    }
    return (
      <AcreditacionSubsanacionView
        cases={modeCases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        busyId={busyId}
        onDecision={onDecision}
      />
    );
  }
  return (
    <AcreditacionPlatformRecordsView
      cases={modeCases}
      selectedCase={selectedCase}
      profileMode={profileMode}
      filters={filters}
      actorOptions={actorOptions}
      channelOptions={channelOptions}
      dateOptions={dateOptions}
      sourceOptions={sourceOptions}
      collectorOptions={collectorOptions}
      responseOptions={responseOptions}
      crossingOptions={crossingOptions}
      activeFilters={activeFilters}
      onCaseSelect={onCaseSelect}
      onFilter={onFilter}
      onClear={onClear}
      onJumpToSubsanacion={onJumpToSubsanacion}
    />
  );
}

function AcreditacionConsultasPanel({
  reports,
  sources = [],
  state = null,
  profileMode = "acreditacion",
  activeTab: controlledActiveTab,
  onActiveTabChange,
  caseReconciliationBusyId = "",
  caseReconciliationStatus = null,
  onCaseReconciliationDecision,
}: {
  reports: MonitoreoAcreditacionReports;
  sources?: MonitoreoSource[];
  state?: MonitoreoState | null;
  profileMode?: AcreditacionProfileMode;
  activeTab?: AcreditacionConsultaTab;
  onActiveTabChange?: (tab: AcreditacionConsultaTab) => void;
  caseReconciliationBusyId?: string;
  caseReconciliationStatus?: AcreditacionActionStatus;
  onCaseReconciliationDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const model = useMemo(() => normalizeInternalQueries(reports.internal_queries), [reports.internal_queries]);
  const officialCases = useMemo(() => (
    model.case_rollup?.length ? model.case_rollup : model.cases
  ), [model.case_rollup, model.cases]);
  const [fallbackActiveTab, setFallbackActiveTab] = useState<AcreditacionConsultaTab>("plataforma");
  const setActiveTab = onActiveTabChange ?? setFallbackActiveTab;
  const activeTab = controlledActiveTab ?? fallbackActiveTab;
  const phoneComparisonRows = useMemo(() => {
    if (profileMode !== "telefonico") return [];
    const directRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
    if (directRows.length) return directRows;
    const fallbackReports = reportsFromState(state);
    return fallbackReports
      ? rowsForSheetBlock(fallbackReports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
      : [];
  }, [profileMode, reports, state]);
  const phoneComparisonCases = useMemo(() => (
    profileMode === "telefonico"
      ? telefonicoConsultedEffectiveCasesFromComparison(phoneComparisonRows)
      : []
  ), [phoneComparisonRows, profileMode]);
  const phoneComparableCases = useMemo(() => (
    profileMode === "telefonico"
      ? telefonicoComparableCasesFromComparison(phoneComparisonRows)
      : []
  ), [phoneComparisonRows, profileMode]);
  const phoneCrossingMetrics = useMemo(() => (
    profileMode === "telefonico" && phoneComparisonRows.length ? phonePlatformComparisonTotals(phoneComparisonRows) : null
  ), [phoneComparisonRows, profileMode]);
  const platformExplorerCases = useMemo(() => {
    if (profileMode !== "telefonico") return model.cases;
    const queryEffective = telefonicoConsultedEffectiveCases(model.cases);
    return phoneComparisonCases.length > queryEffective.length ? phoneComparisonCases : queryEffective;
  }, [model.cases, phoneComparisonCases, profileMode]);
  const phoneCrossingExplorerCases = profileMode === "telefonico" && phoneComparableCases.length
    ? phoneComparableCases
    : platformExplorerCases;
  const explorerCases = activeTab === "base"
    ? officialCases
    : profileMode === "telefonico"
      ? activeTab === "cruces"
        ? phoneCrossingExplorerCases
        : platformExplorerCases
      : activeTab === "plataforma"
        ? platformExplorerCases
        : model.cases;
  const [filters, setFilters] = useState<AcreditacionCaseFilters>({ ...EMPTY_CASE_FILTERS });
  const activeCaseFilters = useMemo(() => consultaFiltersForTab(filters, activeTab), [activeTab, filters]);
  const [selectedId, setSelectedId] = useState("");
  const filteredCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, activeCaseFilters)), [activeCaseFilters, explorerCases]);
  const actorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, actor: "" })), [activeCaseFilters, explorerCases]);
  const dateFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, date: "" })), [activeCaseFilters, explorerCases]);
  const channelFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, channel: "" })), [activeCaseFilters, explorerCases]);
  const sourceFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, source: "" })), [activeCaseFilters, explorerCases]);
  const collectorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, collector: "" })), [activeCaseFilters, explorerCases]);
  const responseFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, response: "" })), [activeCaseFilters, explorerCases]);
  const crossingFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, crossing: "" })), [activeCaseFilters, explorerCases]);
  const actorOptions = useMemo(
    () => countCaseOptions(
      actorFacetCases,
      profileMode === "telefonico" ? telefonicoCaseActorValue : (item) => item.actor,
    ),
    [actorFacetCases, profileMode],
  );
  const channelOptions = useMemo(
    () => countCaseOptions(channelFacetCases, caseChannelValue),
    [channelFacetCases],
  );
  const dateOrder = useMemo(
    () => Array.from(new Set(dateFacetCases.map((item) => item.date).filter(Boolean))).sort(compareInternalQueryDateValues),
    [dateFacetCases],
  );
  const dateOptions = useMemo(
    () => countCaseOptions(dateFacetCases, (item) => item.date, formatInternalQueryDateLabel, dateOrder),
    [dateFacetCases, dateOrder],
  );
  const sourceOptions = useMemo(
    () => countCaseOptions(sourceFacetCases, caseSourceValue),
    [sourceFacetCases],
  );
  const collectorOptions = useMemo(
    () => countCaseOptions(collectorFacetCases, caseCollectorValue, internalQueryCollectorDisplayLabel),
    [collectorFacetCases],
  );
  const responseOptions = useMemo(
    () => countCaseOptions(responseFacetCases, internalCaseResponseStateValue, internalCaseResponseStateLabel, RESPONSE_FILTER_ORDER),
    [responseFacetCases],
  );
  const crossingChipOptions = useMemo(
    () => countCaseOptions(
      crossingFacetCases,
      internalCaseCrossingValue,
      profileMode === "telefonico" ? telefonicoBaseLocationLabel : internalCaseCrossingLabel,
    ),
    [crossingFacetCases, profileMode],
  );
  const modeCases = useMemo(() => {
    if (profileMode === "telefonico" && activeTab === "plataforma") return filteredCases;
    return acreditacionRowsForConsultaTab(filteredCases, activeTab, profileMode);
  }, [activeTab, filteredCases, profileMode]);
  const allModeCases = useMemo(() => {
    if (profileMode === "telefonico" && activeTab === "plataforma") return explorerCases;
    return acreditacionRowsForConsultaTab(explorerCases, activeTab, profileMode);
  }, [activeTab, explorerCases, profileMode]);
  const summary = useMemo(() => summarizeInternalCases(modeCases), [modeCases]);
  const allSummary = useMemo(() => summarizeInternalCases(allModeCases), [allModeCases]);
  const selectedCase = modeCases.find((item) => caseIdentity(item) === selectedId) ?? modeCases[0] ?? null;
  const responseAllCount = responseOptions.reduce((sum, option) => sum + option.count, 0);
  const platformTabFilters = useMemo(() => consultaFiltersForTab(filters, "plataforma"), [filters]);
  const baseTabFilters = useMemo(() => consultaFiltersForTab(filters, "base"), [filters]);
  const crossingTabFilters = useMemo(() => consultaFiltersForTab(filters, "cruces"), [filters]);
  const filteredPlatformCases = useMemo(
    () => platformExplorerCases.filter((item) => caseMatchesFilters(item, platformTabFilters)),
    [platformExplorerCases, platformTabFilters],
  );
  const filteredPhoneCrossingCases = useMemo(
    () => phoneCrossingExplorerCases.filter((item) => caseMatchesFilters(item, crossingTabFilters)),
    [crossingTabFilters, phoneCrossingExplorerCases],
  );
  const filteredOfficialCases = useMemo(
    () => officialCases.filter((item) => caseMatchesFilters(item, baseTabFilters)),
    [baseTabFilters, officialCases],
  );
  const queryTabCounts = useMemo<Record<AcreditacionConsultaTab, number>>(() => ({
    plataforma: profileMode === "telefonico"
      ? filteredPlatformCases.length
      : acreditacionRowsForConsultaTab(filteredPlatformCases, "plataforma", profileMode).length,
    base: filteredOfficialCases.length,
    cruces: acreditacionRowsForConsultaTab(profileMode === "telefonico" ? filteredPhoneCrossingCases : filteredPlatformCases, "cruces", profileMode).length,
    subsanacion: acreditacionRowsForConsultaTab(filteredPlatformCases, "subsanacion", profileMode).length,
  }), [filteredOfficialCases.length, filteredPhoneCrossingCases, filteredPlatformCases, profileMode]);
  const activeFilters = Object.values(activeCaseFilters).some(Boolean);
  const pendingRiskCases = useMemo(() => (
    filteredPlatformCases.filter((item) => caseIsActionableSubsanacion(item) || assistedReviewVisible(item))
  ), [filteredPlatformCases]);
  const queryAnswer = acreditacionQueryAnswerCopy(activeTab, summary, allSummary, activeFilters, profileMode);
  const QueryAnswerIcon = queryAnswer.icon;
  const isPhoneCaveatsTab = profileMode === "telefonico" && activeTab === "subsanacion";
  const isTableOnlyTab = activeTab === "plataforma" || activeTab === "base" || isPhoneCaveatsTab;
  const showCutStatusStrip = acreditacionConsultaShowsCutStatusStrip(activeTab, profileMode);
  const compactStage = !showCutStatusStrip && controlledActiveTab;
  const patchFilters = (patch: Partial<AcreditacionCaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedId("");
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_CASE_FILTERS });
    setSelectedId("");
  };
  return (
    <div className={`mon-stage mon-stage--consultas mon-acr-cases mon-acr-cases--canonical${compactStage ? " is-no-cut-strip" : ""}`}>
      {showCutStatusStrip ? <AcreditacionConsultaStatusStrip reports={reports} model={model} officialCases={officialCases} sources={sources} /> : null}
      {controlledActiveTab ? null : <AcreditacionConsultaTabs active={activeTab} counts={queryTabCounts} onChange={setActiveTab} profileMode={profileMode} />}

      <section className={`mon-case-explorer${isTableOnlyTab ? " is-platform-table-only" : ""}`} aria-label="Explorador de casos del monitoreo" role={controlledActiveTab ? undefined : "tabpanel"} id={controlledActiveTab ? undefined : `mon-acr-query-panel-${activeTab}`} aria-labelledby={controlledActiveTab ? undefined : `mon-acr-query-tab-${activeTab}`}>
        {isTableOnlyTab ? null : (
          <section className={`mon-query-answer is-${queryAnswer.tone}`} aria-label="Lectura activa del explorador">
            <span><QueryAnswerIcon size={16} /> {queryAnswer.heading}</span>
            <strong>{queryAnswer.title}</strong>
            <p>{queryAnswer.detail}</p>
          </section>
        )}
        {isTableOnlyTab ? null : (
          <AcreditacionCaseExplorerToolbar
            summary={summary}
            allSummary={allSummary}
            filters={activeCaseFilters}
            actorOptions={actorOptions}
            channelOptions={channelOptions}
            dateOptions={dateOptions}
            sourceOptions={sourceOptions}
	            collectorOptions={collectorOptions}
	            responseOptions={responseOptions}
	            crossingOptions={crossingChipOptions}
	            profileMode={profileMode}
	            activeFilters={activeFilters}
	            onFilter={patchFilters}
	            onClear={clearFilters}
          />
        )}
        {isTableOnlyTab && !caseReconciliationStatus ? null : (
          <div className="mon-acr-explorer-meta-row">
            {isTableOnlyTab ? null : (
              <AcreditacionPendingRiskStrip
                cases={pendingRiskCases}
                onReview={() => {
                  setActiveTab("subsanacion");
                  setFilters((current) => ({
                    ...current,
                    actor: "",
                    search: "",
                    crossing: "",
                  }));
                  setSelectedId("");
                }}
              />
            )}
            {caseReconciliationStatus ? (
              <span className={`mon-acr-model-action-status is-${caseReconciliationStatus.tone}`}>
                {caseReconciliationStatus.message}
              </span>
            ) : null}
          </div>
        )}
        <div className="mon-case-explorer-body">
          <AcreditacionConsultaBody
            activeTab={activeTab}
            profileMode={profileMode}
            modeCases={modeCases}
            selectedCase={selectedCase}
            phoneMetrics={phoneCrossingMetrics}
            filters={activeCaseFilters}
            actorOptions={actorOptions}
            channelOptions={channelOptions}
            dateOptions={dateOptions}
            sourceOptions={sourceOptions}
            collectorOptions={collectorOptions}
            responseOptions={responseOptions}
            crossingOptions={crossingChipOptions}
            responseAllCount={responseAllCount}
            activeFilters={activeFilters}
            onCaseSelect={(item) => setSelectedId(caseIdentity(item))}
            onFilter={patchFilters}
            onClear={clearFilters}
            onJumpToSubsanacion={(item) => {
              setActiveTab("subsanacion");
              setFilters((current) => ({
                ...current,
                actor: item.actor || current.actor,
                crossing: "",
                search: item.response_id || item.case_key || caseDisplayName(item),
              }));
              setSelectedId(caseIdentity(item));
            }}
            busyId={caseReconciliationBusyId}
            onDecision={onCaseReconciliationDecision}
          />
        </div>
      </section>
    </div>
  );
}

export type AcreditacionAdvanceCard = {
  id: string;
  actor: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  pending: number;
  meta: number | null;
  missing: number | null;
  progress: number | null;
  coverage: number | null;
  statusTone: "complete" | "steady" | "low" | "muted";
};

type AcreditacionActorMechanism = {
  id: string;
  label: string;
  provider: string;
  role: "Universo" | "Barrido" | "Respuestas";
  modality: "base" | "sweep" | "response" | "telefono" | "presencial" | "email";
  observed: number | null;
  channel: string;
};

type AcreditacionActorCard = AcreditacionAdvanceCard & {
  status: string;
  mechanisms: AcreditacionActorMechanism[];
  dailyPoints: AcreditacionAdvanceDailyPoint[];
};

function phoneCodPulsoEffectiveMatchLabel(comparison: Pick<PhonePlatformComparisonTotals, "phoneEffective" | "platformComplete" | "matchedEffective">) {
  const comparableEffective = Math.max(comparison.phoneEffective, comparison.platformComplete);
  return comparableEffective ? `${fmt(comparison.matchedEffective)}/${fmt(comparableEffective)}` : "S/D";
}

type AcreditacionAdvanceDailySeries = {
  id: string;
  label: string;
  actor?: string;
  channel?: string;
  sourceId?: string;
  collectorId?: string;
  collector?: string;
  collectorDisplay?: string;
  points: AcreditacionAdvanceDailyPoint[];
  completed: number;
  partial: number;
  refusals: number;
  total: number;
};

type AcreditacionAdvanceSurveyRow = {
  id: string;
  sourceId: string;
  title: string;
  actor: string;
  channel: string;
  surveyId: string;
  total: number;
  effective: number;
  partial: number;
  refusals: number;
  states: Array<{ label: string; value: number }>;
};

type AcreditacionControlVariableRow = {
  actor: string;
  variable: string;
  value: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  unanswered: number;
  baseShare: number | null;
  effectiveShare: number | null;
  deltaPp: number | null;
};

function rowText(row: Record<string, unknown>, keys: string[], fallback = "") {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (!hit) continue;
    const value = row[hit];
    if (value != null && value !== "") return String(value);
  }
  return fallback;
}

function safePercentValue(value: number | null | undefined, total: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(total)) || Number(total) <= 0) return null;
  return (Number(value) / Number(total)) * 100;
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function formatSignedPp(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })} pp`;
}

function normalizeReportMatch(value: unknown) {
  return normalizeSourceMatch(value);
}

function reportBlockForSheet(
  reports: MonitoreoAcreditacionReports | null | undefined,
  sheetId: string,
  blockId?: string,
) {
  const sheetKey = normalizeReportMatch(sheetId);
  const sheet = reports?.sheets.find((item) => normalizeReportMatch(item.id) === sheetKey) ?? null;
  if (!sheet) return null;
  if (!blockId) return sheet.blocks[0] ?? null;
  const blockKey = normalizeReportMatch(blockId);
  return sheet.blocks.find((block) => normalizeReportMatch(block.id) === blockKey) ?? null;
}

function reportBlockColumns(block: MonitoreoReportBlock | null | undefined) {
  if (!block) return [];
  return block.columns.length ? block.columns : Array.from(new Set(block.rows.flatMap((row) => Object.keys(row))));
}

function reportNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportPercentValue(value: unknown, column: string) {
  const normalized = normalizeReportMatch(column);
  if (!normalized.includes("avance") && !String(column).includes("%") && !normalized.includes("porcentaje") && !normalized.includes("del total") && !normalized.includes("ratio")) return null;
  if (value == null || value === "") return null;
  const parsed = reportNumberValue(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) <= 10 ? parsed * 100 : parsed;
}

function reportStateTone(value: string) {
  const normalized = normalizeReportMatch(value);
  if (normalized.includes("alta") || normalized.includes("rechazo") || normalized.includes("riesgo") || normalized.includes("no ")) return "risk";
  if (normalized.includes("media") || normalized.includes("parcial") || normalized.includes("contactar") || normalized.includes("pendiente")) return "warn";
  if (normalized.includes("ok") || normalized.includes("efectiv") || normalized.includes("completa")) return "good";
  return "muted";
}

function advanceGoalForActor(actor: string, goals: MonitoreoGoal[]) {
  const actorKey = normalizeSourceMatch(actor);
  const direct = goals.find((goal) => Object.values(goal.filters ?? {}).some((value) => normalizeSourceMatch(value) === actorKey));
  return direct && Number.isFinite(Number(direct.meta)) ? Number(direct.meta) : null;
}

export function advanceCardsFromRows(rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []): AcreditacionAdvanceCard[] {
  // Gemelo del fix en el perfil de acreditación: dos actores que normalizan al
  // mismo slug compartían `id`, React lo leía como key duplicada y podía omitir
  // una tarjeta entera sin avisar.
  const slugsVistos = new Map<string, number>();
  const idUnico = (actor: string, index: number) => {
    const base = normalizeSourceMatch(actor) || String(index);
    const repeticion = slugsVistos.get(base) ?? 0;
    slugsVistos.set(base, repeticion + 1);
    return repeticion === 0 ? `avance-${base}` : `avance-${base}-${repeticion + 1}`;
  };

  return rows.map((row, index) => {
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`);
    const universe = rowNumber(row, ["Base reportada", "Universo", "Total", "Base", "Casos"], 0);
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], 0);
    const partial = rowNumber(row, ["Parciales", "Partial"], 0);
    const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Refusals"], 0);
    const explicitPending = rowNumber(row, ["Sin respuesta", "Pendientes", "Unanswered", "Pending"], NaN);
    const pending = Number.isFinite(explicitPending) ? explicitPending : Math.max(0, universe - effective - partial - refusals);
    const rowMeta = rowNumber(row, ["Meta", "Objetivo", "Meta efectiva", "Target"], NaN);
    const goalMeta = advanceGoalForActor(actor, goals);
    const meta = Number.isFinite(rowMeta) && rowMeta > 0 ? rowMeta : goalMeta;
    const missing = meta != null ? Math.max(0, meta - effective) : null;
    const progress = safePercentValue(effective, universe);
    const coverage = progress;
    const targetProgress = meta != null ? safePercentValue(effective, meta) : null;
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : missing === 0
        ? "complete"
        : (targetProgress ?? 0) >= 70
          ? "steady"
          : "low";
    return {
      id: idUnico(actor, index),
      actor,
      universe,
      effective,
      partial,
      refusals,
      pending,
      meta,
      missing,
      progress,
      coverage,
      statusTone,
    };
  }).sort((a, b) => {
    const aNeeds = a.meta == null ? 1 : 0;
    const bNeeds = b.meta == null ? 1 : 0;
    return aNeeds - bNeeds || b.effective - a.effective || a.actor.localeCompare(b.actor, "es");
  });
}

function preferredPhoneAdvanceQuotaVariable(rows: AcreditacionPhoneQuotaRow[]) {
  const withMeta = rows.filter((row) => row.meta != null && row.meta > 0);
  const variables = uniqueDisplayValues((withMeta.length ? withMeta : rows).map((row) => row.variable));
  const priority = ["sede", "distrito", "grupo", "segmento", "actor"];
  return variables.find((variable) => priority.includes(normalizeSourceMatch(variable)))
    ?? variables[0]
    ?? "";
}

function phoneQuotaCategoryNoun(variable: string) {
  const key = normalizeSourceMatch(variable);
  if (key.includes("sede")) return "sede";
  if (key.includes("distrito")) return "distrito";
  if (key.includes("grupo")) return "grupo";
  if (key.includes("segmento")) return "segmento";
  if (key.includes("actor")) return "actor";
  if (key.includes("zona")) return "zona";
  if (key.includes("sexo")) return "sexo";
  if (key.includes("edad")) return "rango";
  return "categoría";
}

export function phoneQuotaAdvanceCardsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceCard[] {
  const quotaRows = phoneQuotaRowsForPanel(rows);
  const variable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const sourceRows = (variable ? quotaRows.filter((row) => row.variable === variable) : quotaRows)
    .filter((row) => row.meta != null || row.universe > 0);
  return sourceRows.map((row, index) => {
    const meta = row.meta != null ? Math.max(0, Number(row.meta) || 0) : null;
    const missing = meta != null ? Math.max(0, meta - row.effective) : null;
    const targetProgress = meta != null ? safePercentValue(row.effective, meta) : null;
    const coverage = safePercentValue(row.effective, row.universe);
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : missing === 0
        ? "complete"
        : (targetProgress ?? 0) >= 70
          ? "steady"
          : "low";
    return {
      id: `phone-quota-${normalizeSourceMatch(row.variable)}-${normalizeSourceMatch(row.value) || index}`,
      actor: row.value,
      universe: row.universe,
      effective: row.effective,
      partial: row.partial,
      refusals: row.refusals,
      pending: row.unswept,
      meta,
      missing,
      progress: targetProgress,
      coverage,
      statusTone,
    };
  }).sort((a, b) => (
    (b.missing ?? -1) - (a.missing ?? -1)
    || b.universe - a.universe
    || a.actor.localeCompare(b.actor, "es", { numeric: true })
  ));
}

function advanceTotals(cards: AcreditacionAdvanceCard[]) {
  return cards.reduce((acc, card) => ({
    universe: acc.universe + card.universe,
    effective: acc.effective + card.effective,
    partial: acc.partial + card.partial,
    refusals: acc.refusals + card.refusals,
    pending: acc.pending + card.pending,
    metas: acc.metas + (card.meta != null ? 1 : 0),
    brechas: acc.brechas + (card.missing != null && card.missing > 0 ? 1 : 0),
  }), { universe: 0, effective: 0, partial: 0, refusals: 0, pending: 0, metas: 0, brechas: 0 });
}

const ACREDITACION_DAILY_HEADER_LABELS = new Set(["fecha", "echa", "dia", "día", "date"]);

function isAcreditacionDailyHeaderLabel(value: unknown) {
  const key = normalizeSourceMatch(value);
  return ACREDITACION_DAILY_HEADER_LABELS.has(key);
}

function isDatedAcreditacionDailyPoint(point: AcreditacionAdvanceDailyPoint) {
  return !isAcreditacionNoDateLabel(point.date) && Boolean(parseAcreditacionDailyDate(point.date));
}

function normalizeAcreditacionDailyDateLabel(value: unknown) {
  const text = String(value ?? "").trim();
  return isAcreditacionNoDateLabel(text) ? ACREDITACION_DAILY_NO_DATE_LABEL : text;
}

export function dailyPointsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceDailyPoint[] {
  return rows.flatMap((row) => {
    const rawDate = rowText(row, ["Fecha", "Dia", "Día", "Date"], "");
    if (isAcreditacionDailyHeaderLabel(rawDate)) return [];
    const date = normalizeAcreditacionDailyDateLabel(rawDate);
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
    const partial = rowNumber(row, ["Parciales", "Partial"], 0);
    const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Rechazos telefónicos", "Rechazos plataforma", "Refusals"], 0);
    const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], effective + partial + refusals);
    return [{ date, effective, partial, refusals, total }];
  });
}

function phoneKoboDailyPointsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceDailyPoint[] {
  return rows.flatMap((row) => {
    const rawDate = rowText(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Dia", "Día", "Date"], "");
    if (isAcreditacionDailyHeaderLabel(rawDate) || isAcreditacionNoDateLabel(rawDate)) return [];
    const parsedDate = parseAcreditacionDailyDate(rawDate);
    if (!parsedDate) return [];
    const date = calendarIsoDate(parsedDate);
    const effectiveKobo = rowNumber(row, [
      "Efectivas Kobo",
      "Kobo efectivas",
      "Completas Kobo",
      "Plataforma completa",
      "Efectivas plataforma",
    ], Number.NaN);
    const fallbackEffective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
    const effective = Math.max(0, Number.isFinite(effectiveKobo) ? effectiveKobo : fallbackEffective);
    if (!effective) return [];
    return [{ date, effective, partial: 0, refusals: 0, total: effective }];
  });
}

function acreditacionReportRowValue(row: Record<string, unknown>, candidates: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [normalizeSourceMatch(key), key]));
  for (const candidate of candidates) {
    const hit = normalized.get(normalizeSourceMatch(candidate));
    if (hit) return row[hit];
  }
  return null;
}

function acreditacionReportColumn(block: MonitoreoReportBlock | null | undefined, candidates: string[]) {
  const wanted = candidates.map(normalizeSourceMatch);
  return reportBlockColumns(block).find((column) => wanted.includes(normalizeSourceMatch(column))) ?? null;
}

function acreditacionReportBlockDateColumns(block: MonitoreoReportBlock | null | undefined) {
  const excluded = new Set([
    "unidad",
    "actor",
    "corte",
    "carrera",
    "canal",
    "modalidad",
    "estado",
    "estatus",
    "total",
    "fecha",
    "dia",
    "día",
    "fuente",
    "source",
    "source_id",
    "source id",
    "id fuente",
    "encuesta",
    "survey_id",
    "survey id",
    "id encuesta",
    "recopilador",
    "collector",
    "collector_id",
    "collector id",
    "id recopilador",
    "tipo recopilador",
    "tipo_recopilador",
    "efectivas",
    "validas",
    "válidas",
    "completas",
    "completed",
    "parciales",
    "partial",
    "rechazo",
    "rechazos",
    "rechazos plataforma",
    "refusals",
    "respuestas",
    "total respuestas",
    "acumulado",
    "avance",
    "porcentaje",
  ]);
  return reportBlockColumns(block).filter((column) => {
    const key = normalizeSourceMatch(column);
    if (!key || excluded.has(key)) return false;
    return /\d/.test(column) || (block?.rows ?? []).some((row) => reportNumberValue(row[column]) > 0);
  });
}

function acreditacionSurveyStateTone(state: string): "completed" | "partial" | "refusals" | "pending" {
  const key = normalizeSourceMatch(state);
  if (key.includes("completa") || key.includes("efectiva") || key.includes("valida")) return "completed";
  if (key.includes("parcial")) return "partial";
  if (key.includes("rechazo") || key.includes("rechaz")) return "refusals";
  return "pending";
}

function uniqueNormalizedKeys(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const key = normalizeSourceMatch(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

function addAcreditacionDailyValue(
  points: Map<string, AcreditacionAdvanceDailyPoint>,
  date: string,
  tone: ReturnType<typeof acreditacionSurveyStateTone>,
  value: number,
) {
  if (!value) return;
  const point = points.get(date) ?? { date, effective: 0, partial: 0, refusals: 0, total: 0 };
  if (tone === "completed") point.effective += value;
  if (tone === "partial") point.partial += value;
  if (tone === "refusals") point.refusals += value;
  point.total += value;
  points.set(date, point);
}

function dailySeriesTotals(points: AcreditacionAdvanceDailyPoint[]) {
  const totals = dailyPointTotals(points);
  return {
    completed: totals.effective,
    partial: totals.partial,
    refusals: totals.refusals,
    total: totals.total,
  };
}

function buildAcreditacionAdvanceDailySeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
  blockId: string,
  groupColumn: string,
  allowedGroups?: Set<string>,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "resumen", blockId)
    ?? reportBlockForSheet(reports, "reporte", blockId);
  if (!block) return [];
  const groupCandidates = normalizeSourceMatch(groupColumn) === "unidad"
    ? ["Unidad", "Actor", "Corte", "Carrera"]
    : [groupColumn];
  const groupKey = acreditacionReportColumn(block, groupCandidates);
  if (!groupKey) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, { label: string; points: Map<string, AcreditacionAdvanceDailyPoint> }>();
  block.rows.forEach((row, index) => {
    const label = String(row[groupKey] ?? "").trim() || `${groupColumn} ${index + 1}`;
    const key = normalizeSourceMatch(label) || `${normalizeSourceMatch(groupColumn)}-${index}`;
    if (allowedGroups?.size && !allowedGroups.has(key)) return;
    const surveyState = String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? "").trim();
    const tone = acreditacionSurveyStateTone(surveyState);
    const entry = grouped.get(key) ?? { label, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionAdvanceDailySourceSeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "avance_encuesta", "avance_fuente_dia");
  if (!block) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  block.rows.forEach((row, index) => {
    const sourceId = String(acreditacionReportRowValue(row, ["source_id", "source id", "id fuente"]) ?? "").trim();
    const label = String(acreditacionReportRowValue(row, ["fuente", "source", "encuesta"]) ?? `Fuente ${index + 1}`).trim() || `Fuente ${index + 1}`;
    const actor = String(acreditacionReportRowValue(row, ["actor", "unidad", "corte", "carrera"]) ?? "").trim();
    const channel = String(acreditacionReportRowValue(row, ["canal", "modalidad", "channel"]) ?? "").trim();
    const key = normalizeSourceMatch(sourceId || label) || `source-${index}`;
    const tone = acreditacionSurveyStateTone(String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? ""));
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.actor ?? "").localeCompare(b.actor ?? "", "es") || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionAdvanceDailyCollectorSeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "avance_encuesta", "avance_recopilador_dia");
  if (!block) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  block.rows.forEach((row, index) => {
    const sourceId = String(acreditacionReportRowValue(row, ["source_id", "source id", "id fuente"]) ?? "").trim();
    const label = String(acreditacionReportRowValue(row, ["fuente", "source", "encuesta"]) ?? `Fuente ${index + 1}`).trim() || `Fuente ${index + 1}`;
    const actor = String(acreditacionReportRowValue(row, ["actor", "unidad", "corte", "carrera"]) ?? "").trim();
    const channel = String(acreditacionReportRowValue(row, ["canal", "modalidad", "channel"]) ?? "").trim();
    const collectorId = String(acreditacionReportRowValue(row, ["collector_id", "collector id", "id recopilador"]) ?? "").trim();
    const collector = String(acreditacionReportRowValue(row, ["recopilador", "collector", "responsable"]) ?? "").trim() || collectorId || "Sin recopilador";
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const tone = acreditacionSurveyStateTone(String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? ""));
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function fallbackDailyDateFromRow(row: Record<string, unknown>, index: number) {
  return rowText(row, [
    "Última respuesta",
    "Ultima respuesta",
    "Última efectiva",
    "Ultima efectiva",
    "Primer día",
    "Primer dia",
    "Fecha",
    "Dia",
    "Día",
  ], `Corte ${index + 1}`);
}

function dailyPointFromSummaryRow(row: Record<string, unknown>, index: number): AcreditacionAdvanceDailyPoint {
  const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], 0);
  const partial = rowNumber(row, ["Parciales", "Partial"], 0);
  const refusals = rowNumber(row, ["Rechazos plataforma", "Rechazos", "Rechazo", "Refusals"], 0);
  const explicitTotal = rowNumber(row, ["Total respuestas", "Total", "Respuestas", "Casos"], NaN);
  return {
    date: fallbackDailyDateFromRow(row, index),
    effective,
    partial,
    refusals,
    total: Number.isFinite(explicitTotal) ? explicitTotal : effective + partial + refusals,
  };
}

function buildAcreditacionDailySourceSeriesFromRows(
  rows: Array<Record<string, unknown>> = [],
): AcreditacionAdvanceDailySeries[] {
  const block = {
    id: "source_rows",
    title: "Fuentes por día",
    columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
    rows: rows as MonitoreoRow[],
  } as MonitoreoReportBlock;
  const dates = acreditacionReportBlockDateColumns(block);
  if (dates.length && rows.some((row) => rowText(row, ["Estado", "Estatus"], ""))) {
    const grouped = new Map<string, {
      label: string;
      actor: string;
      channel: string;
      sourceId: string;
      points: Map<string, AcreditacionAdvanceDailyPoint>;
    }>();
    rows.forEach((row, index) => {
      const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
      const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
      const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
      const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
      const key = normalizeSourceMatch(sourceId || label) || `source-date-${index}`;
      const tone = acreditacionSurveyStateTone(rowText(row, ["Estado", "Estatus"], ""));
      const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
      dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
      grouped.set(key, entry);
    });
    return Array.from(grouped.entries()).map(([id, entry]) => {
      const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
        .filter((point) => point.total > 0 || point.effective > 0);
      const totals = dailySeriesTotals(points);
      return {
        id,
        label: entry.label,
        actor: entry.actor,
        channel: entry.channel,
        sourceId: entry.sourceId,
        points,
        completed: totals.completed,
        partial: totals.partial,
        refusals: totals.refusals,
        total: totals.total,
      };
    }).filter((item) => item.total > 0 || item.completed > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  }
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    points: AcreditacionAdvanceDailyPoint[];
  }>();
  rows.forEach((row, index) => {
    const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
    const key = normalizeSourceMatch(sourceId || label) || `source-summary-${index}`;
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: [] };
    const point = dailyPointFromSummaryRow(row, index);
    if (point.total > 0 || point.effective > 0) entry.points.push(point);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const pointsByDate = new Map<string, AcreditacionAdvanceDailyPoint>();
    entry.points.forEach((point) => {
      const existing = pointsByDate.get(point.date) ?? { date: point.date, effective: 0, partial: 0, refusals: 0, total: 0 };
      existing.effective += point.effective;
      existing.partial += point.partial;
      existing.refusals += point.refusals;
      existing.total += point.total;
      pointsByDate.set(point.date, existing);
    });
    const points = sortAcreditacionDailyPoints(Array.from(pointsByDate.values()));
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionDailyCollectorSeriesFromRows(
  rows: Array<Record<string, unknown>> = [],
): AcreditacionAdvanceDailySeries[] {
  const block = {
    id: "collector_rows",
    title: "Recopiladores por día",
    columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
    rows: rows as MonitoreoRow[],
  } as MonitoreoReportBlock;
  const dates = acreditacionReportBlockDateColumns(block);
  if (dates.length && rows.some((row) => rowText(row, ["Estado", "Estatus"], ""))) {
    const grouped = new Map<string, {
      label: string;
      actor: string;
      channel: string;
      sourceId: string;
      collectorId: string;
      collector: string;
      points: Map<string, AcreditacionAdvanceDailyPoint>;
    }>();
    rows.forEach((row, index) => {
      const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
      const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
      const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
      const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
      const collectorId = rowText(row, ["collector_id", "collector id", "id recopilador"], "");
      const collector = rowText(row, ["Recopilador", "Collector", "Responsable"], collectorId || "Sin recopilador");
      const sourceKey = normalizeSourceMatch(sourceId || label) || `source-date-${index}`;
      const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-date-${index}`;
      const key = `${sourceKey}\r${collectorKey}`;
      const tone = acreditacionSurveyStateTone(rowText(row, ["Estado", "Estatus"], ""));
      const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
      dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
      grouped.set(key, entry);
    });
    return Array.from(grouped.entries()).map(([id, entry]) => {
      const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
        .filter((point) => point.total > 0 || point.effective > 0);
      const totals = dailySeriesTotals(points);
      return {
        id,
        label: entry.label,
        actor: entry.actor,
        channel: entry.channel,
        sourceId: entry.sourceId,
        collectorId: entry.collectorId,
        collector: entry.collector,
        points,
        completed: totals.completed,
        partial: totals.partial,
        refusals: totals.refusals,
        total: totals.total,
      };
    }).filter((item) => item.total > 0 || item.completed > 0)
      .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
  }
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: AcreditacionAdvanceDailyPoint[];
  }>();
  rows.forEach((row, index) => {
    const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
    const collectorId = rowText(row, ["collector_id", "collector id", "id recopilador"], "");
    const collector = rowText(row, ["Recopilador", "Collector", "Responsable"], collectorId || "Sin recopilador");
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-summary-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-summary-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: [] };
    const point = dailyPointFromSummaryRow(row, index);
    if (point.total > 0 || point.effective > 0) entry.points.push(point);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const pointsByDate = new Map<string, AcreditacionAdvanceDailyPoint>();
    entry.points.forEach((point) => {
      const existing = pointsByDate.get(point.date) ?? { date: point.date, effective: 0, partial: 0, refusals: 0, total: 0 };
      existing.effective += point.effective;
      existing.partial += point.partial;
      existing.refusals += point.refusals;
      existing.total += point.total;
      pointsByDate.set(point.date, existing);
    });
    const points = sortAcreditacionDailyPoints(Array.from(pointsByDate.values()));
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function caseDailyTone(item: MonitoreoInternalQueryCase): ReturnType<typeof acreditacionSurveyStateTone> {
  if (item.advancement === "effective") return "completed";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusals";
  return acreditacionSurveyStateTone(item.platform_state);
}

function buildAcreditacionDailyCollectorSeriesFromInternalQueries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const cases = normalizeInternalQueries(reports?.internal_queries).cases;
  if (!cases.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  cases.forEach((item, index) => {
    const sourceId = item.source_id || "";
    const label = item.source_label || sourceId || `Fuente ${index + 1}`;
    const collector = internalQueryCollectorDisplayLabel(item);
    const collectorId = item.collector_id || collector;
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-case-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-case-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const entry = grouped.get(key) ?? {
      label,
      actor: item.actor || "",
      channel: item.channel || "",
      sourceId,
      collectorId,
      collector,
      points: new Map<string, AcreditacionAdvanceDailyPoint>(),
    };
    addAcreditacionDailyValue(entry.points, item.date || "Sin fecha", caseDailyTone(item), 1);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function groupAcreditacionCollectorsBySource(series: AcreditacionAdvanceDailySeries[]) {
  const grouped = new Map<string, AcreditacionAdvanceDailySeries[]>();
  series.forEach((item) => {
    uniqueNormalizedKeys([item.sourceId, item.label]).forEach((key) => {
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    });
  });
  return grouped;
}

function collectorDisplayLookupKey(sourceKey: string, collectorKey: string) {
  return `${sourceKey}\r${collectorKey}`;
}

function isTechnicalAcreditacionCollectorLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const key = normalizeSourceMatch(text);
  return /^\d{6,}$/.test(text)
    || /^[a-f0-9]{10,}$/i.test(text)
    || /^(collector|colector|web|link)[-_]?\d+$/i.test(text)
    || key === "web link"
    || key === "weblink";
}

function acreditacionCollectorDisplayFromRow(row: AcreditacionCollectorRow) {
  return [
    row.alias,
    row.platformName,
    row.saved?.collector_name,
    row.platform?.name,
    row.platform?.collector_name,
  ].map((value) => String(value ?? "").trim())
    .find((value) => value && !isTechnicalAcreditacionCollectorLabel(value)) ?? "";
}

function buildAcreditacionCollectorDisplayIndex(
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const index = new Map<string, string>();
  sources.forEach((source) => {
    acreditacionCollectorsForSource(source, linkCollectors).forEach((collector) => {
      const display = acreditacionCollectorDisplayFromRow(collector);
      if (!display) return;
      const sourceKeys = uniqueNormalizedKeys([
        source.id,
        source.survey_id,
        source.label,
        source.survey_title,
        source.dimensions?.survey_title,
        collector.sourceId,
        collector.surveyId,
        collector.sourceName,
      ]);
      const collectorKeys = uniqueNormalizedKeys([
        collector.collectorId,
        collector.alias,
        collector.platformName,
        collector.saved?.collector_name,
        collector.platform?.name,
        collector.platform?.collector_name,
      ]);
      collectorKeys.forEach((collectorKey) => {
        if (!index.has(collectorKey)) index.set(collectorKey, display);
      });
      sourceKeys.forEach((sourceKey) => {
        collectorKeys.forEach((collectorKey) => {
          index.set(collectorDisplayLookupKey(sourceKey, collectorKey), display);
        });
      });
    });
  });
  return index;
}

function resolveAcreditacionCollectorDisplay(
  series: AcreditacionAdvanceDailySeries,
  displayIndex: Map<string, string>,
  index: number,
) {
  const sourceKeys = uniqueNormalizedKeys([series.sourceId, series.label]);
  const collectorKeys = uniqueNormalizedKeys([series.collectorId, series.collector]);
  for (const sourceKey of sourceKeys) {
    for (const collectorKey of collectorKeys) {
      const match = displayIndex.get(collectorDisplayLookupKey(sourceKey, collectorKey));
      if (match) return match;
    }
  }
  for (const collectorKey of collectorKeys) {
    const match = displayIndex.get(collectorKey);
    if (match) return match;
  }
  const raw = String(series.collector ?? "").trim();
  if (raw && !isTechnicalAcreditacionCollectorLabel(raw)) return raw;
  return `Recopilador ${index + 1}`;
}

function applyAcreditacionCollectorDisplayNames(
  series: AcreditacionAdvanceDailySeries[],
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const displayIndex = buildAcreditacionCollectorDisplayIndex(sources, linkCollectors);
  return series.map((item, index) => ({
    ...item,
    collectorDisplay: resolveAcreditacionCollectorDisplay(item, displayIndex, index),
  }));
}

function acreditacionCollectorSeriesDisplayName(series: AcreditacionAdvanceDailySeries) {
  return series.collectorDisplay
    || (series.collector && !isTechnicalAcreditacionCollectorLabel(series.collector) ? series.collector : "")
    || "Recopilador";
}

function acreditacionCollectorsForSurvey(
  row: AcreditacionAdvanceSurveyRow,
  grouped: Map<string, AcreditacionAdvanceDailySeries[]>,
) {
  const seen = new Set<string>();
  const out: AcreditacionAdvanceDailySeries[] = [];
  uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]).forEach((key) => {
    (grouped.get(key) ?? []).forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push(item);
    });
  });
  return out;
}

function actorStatusLabel(card: AcreditacionAdvanceCard) {
  if (card.meta == null) return "Meta pendiente";
  if (card.statusTone === "complete") return "Meta cubierta";
  if (card.statusTone === "steady") return "En ruta";
  return "Requiere impulso";
}

function actorGoalSummary(cards: AcreditacionAdvanceCard[]) {
  const configured = cards.filter((card) => card.meta != null);
  const complete = configured.filter((card) => (card.missing ?? 0) <= 0).length;
  const gaps = configured.filter((card) => (card.missing ?? 0) > 0);
  const totalGap = gaps.reduce((sum, card) => sum + (card.missing ?? 0), 0);
  return {
    configured: configured.length,
    complete,
    gaps: gaps.length,
    totalGap,
    missingMeta: Math.max(0, cards.length - configured.length),
  };
}

function actorGoalValue(summary: ReturnType<typeof actorGoalSummary>) {
  return summary.configured ? `${fmt(summary.complete)}/${fmt(summary.configured)}` : "S/M";
}

function actorGoalHint(summary: ReturnType<typeof actorGoalSummary>) {
  if (!summary.configured) return "metas pendientes";
  if (summary.gaps) return `${fmt(summary.gaps)} con brecha · ${fmt(summary.totalGap)} faltan`;
  if (summary.missingMeta) return `${fmt(summary.missingMeta)} sin meta`;
  return "metas cubiertas";
}

function actorGoalTone(summary: ReturnType<typeof actorGoalSummary>): "base" | "target" | "ready" | "warning" {
  if (!summary.configured) return "target";
  return summary.gaps ? "warning" : "ready";
}

function sourceRoleForActor(source: MonitoreoSource) {
  const role = normalizeSourceMatch(source.role);
  const label = normalizeSourceMatch(source.label);
  if (role.includes("universo") || role.includes("base")) return "Universo";
  if (role.includes("barrido") || label.includes("barrido") || label.includes("telefon")) return "Barrido";
  return "Respuestas";
}

function sourceModalityForActor(source: MonitoreoSource): AcreditacionActorMechanism["modality"] {
  const role = sourceRoleForActor(source);
  const channel = normalizeSourceMatch(sourceChannelLabel(source));
  const label = normalizeSourceMatch(source.label);
  if (role === "Universo") return "base";
  if (role === "Barrido") return "sweep";
  if (channel.includes("telefono") || channel.includes("whatsapp") || label.includes("telefon")) return "telefono";
  if (channel.includes("presencial")) return "presencial";
  if (channel.includes("email") || channel.includes("correo")) return "email";
  return "response";
}

function mechanismKind(item: AcreditacionActorMechanism) {
  if (item.role === "Universo") return "base";
  if (item.role === "Barrido") return "sweep";
  return "response";
}

function mechanismIcon(value: AcreditacionActorMechanism["modality"]) {
  if (value === "base") return Table2;
  if (value === "sweep" || value === "telefono") return PhoneCall;
  if (value === "presencial") return ContactRound;
  if (value === "email") return Link2;
  return ListChecks;
}

function compactMechanismLabel(label: string) {
  return String(label || "Fuente")
    .replace(/\s+/g, " ")
    .replace(/^respuestas?\s+/i, "")
    .replace(/^base\s+/i, "Base ")
    .trim();
}

function actorMechanismObserved(
  actor: string,
  source: MonitoreoSource,
  sourceRows: Array<Record<string, unknown>>,
  progressRows: MonitoreoRow[] = [],
) {
  const actorKey = normalizeSourceMatch(actor);
  const sourceKey = normalizeSourceMatch(source.label);
  const row = sourceRows.find((item) => {
    const rowActor = normalizeSourceMatch(rowText(item, ["Actor", "Unidad", "Corte", "Carrera"]));
    const rowSource = normalizeSourceMatch(rowText(item, ["Fuente", "Encuesta", "Source"]));
    if (rowActor && rowActor !== actorKey) return false;
    return rowSource && (rowSource === sourceKey || rowSource.includes(sourceKey) || sourceKey.includes(rowSource));
  });
  if (row) {
    const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], NaN);
    if (Number.isFinite(total)) return total;
    return rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas"], 0)
      + rowNumber(row, ["Parciales"], 0)
      + rowNumber(row, ["Rechazos plataforma", "Rechazos"], 0);
  }
  const progress = progressRows.find((item) => {
    const rowActor = normalizeSourceMatch(item.dim_actor);
    const rowSource = normalizeSourceMatch(item[".source_label"] ?? item.source_label);
    return rowActor === actorKey && rowSource && (rowSource === sourceKey || rowSource.includes(sourceKey) || sourceKey.includes(rowSource));
  });
  return progress ? num(progress.observado, 0) : null;
}

function actorMechanismsForCard(
  card: AcreditacionAdvanceCard,
  sources: MonitoreoSource[] = [],
  sourceRows: Array<Record<string, unknown>> = [],
  progressRows: MonitoreoRow[] = [],
): AcreditacionActorMechanism[] {
  const actorKey = normalizeSourceMatch(card.actor);
  const seen = new Set<string>();
  const mechanisms: AcreditacionActorMechanism[] = [];
  const actorSources = sources.filter((source) => {
    const sourceActor = normalizeSourceMatch(sourceActorLabel(source));
    return sourceActor === actorKey || (!sourceActor && normalizeSourceMatch(source.label).includes(actorKey));
  });
  actorSources.forEach((source) => {
    const role = sourceRoleForActor(source);
    const modality = sourceModalityForActor(source);
    const id = source.id || `${actorKey}-${normalizeSourceMatch(source.label)}`;
    if (seen.has(id)) return;
    seen.add(id);
    mechanisms.push({
      id,
      label: compactMechanismLabel(source.label),
      provider: sourceProviderLabel(source.kind),
      role,
      modality,
      observed: role === "Universo" && card.universe ? card.universe : actorMechanismObserved(card.actor, source, sourceRows, progressRows),
      channel: sourceChannelLabel(source),
    });
  });
  sourceRows.forEach((row, index) => {
    const rowActor = normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"]));
    if (rowActor !== actorKey) return;
    const sourceLabel = rowText(row, ["Fuente", "Encuesta", "Source"], "Respuestas");
    const id = `${actorKey}-source-row-${normalizeSourceMatch(sourceLabel)}-${index}`;
    if (seen.has(id) || actorSources.some((source) => normalizeSourceMatch(source.label) === normalizeSourceMatch(sourceLabel))) return;
    seen.add(id);
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "Plataforma");
    const observed = rowNumber(row, ["Total respuestas", "Total"], NaN);
    mechanisms.push({
      id,
      label: compactMechanismLabel(sourceLabel),
      provider: "Reporte",
      role: "Respuestas",
      modality: normalizeSourceMatch(channel).includes("telefon") ? "telefono" : "response",
      observed: Number.isFinite(observed)
        ? observed
        : rowNumber(row, ["Efectivas", "Validas", "Válidas"], 0) + rowNumber(row, ["Parciales"], 0) + rowNumber(row, ["Rechazos"], 0),
      channel,
    });
  });
  if (!mechanisms.some((item) => item.role === "Universo") && card.universe > 0) {
    mechanisms.unshift({
      id: `${actorKey}-universo`,
      label: "Base trabajada",
      provider: "Google Sheets",
      role: "Universo",
      modality: "base",
      observed: card.universe,
      channel: "Universo",
    });
  }
  if (!mechanisms.some((item) => item.role === "Respuestas") && card.effective + card.partial + card.refusals > 0) {
    mechanisms.push({
      id: `${actorKey}-respuestas`,
      label: "Respuestas conectadas",
      provider: "Reporte",
      role: "Respuestas",
      modality: "response",
      observed: card.effective + card.partial + card.refusals,
      channel: "Plataforma",
    });
  }
  return mechanisms.sort((a, b) => {
    const rank = (item: AcreditacionActorMechanism) => item.role === "Universo" ? 0 : item.role === "Barrido" ? 1 : 2;
    return rank(a) - rank(b) || (b.observed ?? -1) - (a.observed ?? -1) || a.label.localeCompare(b.label, "es");
  });
}

function dailyPointsForActor(actor: string, dailyRows: Array<Record<string, unknown>> = []) {
  const actorKey = normalizeSourceMatch(actor);
  return dailyRows
    .filter((row) => {
      const rowActor = normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"]));
      return rowActor && rowActor === actorKey;
    })
    .map((row, index) => {
      const date = rowText(row, ["Fecha", "Dia", "Día", "Date"], `Dia ${index + 1}`);
      const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
      const partial = rowNumber(row, ["Parciales", "Partial"], 0);
      const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Refusals"], 0);
      const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], effective + partial + refusals);
      return { date, effective, partial, refusals, total };
    });
}

function actorCardsForDashboard({
  actorRows,
  sourceRows,
  dailyRows,
  actorDailySeries,
  goals,
  sources,
  progressRows,
}: {
  actorRows: Array<Record<string, unknown>>;
  sourceRows?: Array<Record<string, unknown>>;
  dailyRows?: Array<Record<string, unknown>>;
  actorDailySeries?: AcreditacionAdvanceDailySeries[];
  goals?: MonitoreoGoal[];
  sources?: MonitoreoSource[];
  progressRows?: MonitoreoRow[];
}): AcreditacionActorCard[] {
  const dailyByActor = new Map((actorDailySeries ?? []).map((series) => [normalizeSourceMatch(series.label), series.points]));
  return advanceCardsFromRows(actorRows, goals ?? []).map((card) => ({
    ...card,
    status: actorStatusLabel(card),
    mechanisms: actorMechanismsForCard(card, sources ?? [], sourceRows ?? [], progressRows ?? []),
    dailyPoints: dailyByActor.get(normalizeSourceMatch(card.actor)) ?? dailyPointsForActor(card.actor, dailyRows ?? []),
  }));
}

function phoneQuotaDailyPointsByValue(
  reports: MonitoreoAcreditacionReports,
  quotaRows: AcreditacionPhoneQuotaRow[],
) {
  const variable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const variableLabel = phoneQuotaVariableLabel(variable);
  const valueKeys = new Set(quotaRows.map((row) => normalizeSourceMatch(row.value)).filter(Boolean));
  const out = new Map<string, Map<string, AcreditacionAdvanceDailyPoint>>();
  const addPoint = (value: string, date: string, effective = 1) => {
    const valueKey = normalizeSourceMatch(value);
    if (!valueKey || !valueKeys.has(valueKey)) return;
    const cleanDate = normalizeAcreditacionDailyDateLabel(date);
    if (isAcreditacionNoDateLabel(cleanDate)) return;
    const amount = Math.max(0, Number(effective) || 0);
    if (!amount) return;
    const points = out.get(valueKey) ?? new Map<string, AcreditacionAdvanceDailyPoint>();
    const point = points.get(cleanDate) ?? { date: cleanDate, effective: 0, partial: 0, refusals: 0, total: 0 };
    point.effective += amount;
    point.total += amount;
    points.set(cleanDate, point);
    out.set(valueKey, points);
  };
  const variableDailyRows = rowsForSheetBlock(reports, "monitoreo_telefonico", [
    "avance_efectivo_variable_dia",
    "avance_cuota_dia",
    "avance_efectivo_cuota_dia",
  ]);
  variableDailyRows.forEach((row) => {
    const rowVariable = phoneRowValue(row, ["Variable", "variable", "Cuota"], "");
    if (variable && normalizeSourceMatch(rowVariable) !== normalizeSourceMatch(variable)) return;
    const value = phoneRowValue(row, ["Valor", variable, variableLabel, "Sede", "Distrito", "Segmento", "Grupo"], "");
    const date = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Día", "Dia"], "");
    const effective = phoneRowNumber(row, ["Efectivas Kobo", "Efectivas", "Completas", "Total"], 0);
    addPoint(value, date, effective);
  });
  if (out.size) {
    return new Map(Array.from(out.entries()).map(([key, points]) => [key, sortAcreditacionDailyPoints(Array.from(points.values()))]));
  }
  const comparisonRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  comparisonRows.forEach((row, index) => {
    if (!phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"])) return;
    const value = phoneRowValue(row, [
      variable,
      variableLabel,
      "Sede",
      "Distrito",
      "Segmento",
      "Grupo",
      "Categoria",
      "Categoría",
      "Valor",
    ], "");
    const valueKey = normalizeSourceMatch(value);
    if (!valueKey || !valueKeys.has(valueKey)) return;
    const date = normalizeAcreditacionDailyDateLabel(phoneRowValue(row, [
      "Fecha Kobo",
      "Fecha plataforma",
      "Última respuesta",
      "Ultima respuesta",
      "Fecha",
      "Día",
      "Dia",
    ], `Corte ${index + 1}`));
    addPoint(value, date, 1);
  });
  return new Map(Array.from(out.entries()).map(([key, points]) => [key, sortAcreditacionDailyPoints(Array.from(points.values()))]));
}

export function phoneQuotaCardsForDashboard(reports: MonitoreoAcreditacionReports): AcreditacionActorCard[] {
  const quotaRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  const parsedQuotaRows = phoneQuotaRowsForPanel(quotaRows);
  const dailyByValue = phoneQuotaDailyPointsByValue(reports, parsedQuotaRows);
  return phoneQuotaAdvanceCardsFromRows(quotaRows).map((card) => ({
    ...card,
    status: actorStatusLabel(card),
    mechanisms: [],
    dailyPoints: dailyByValue.get(normalizeSourceMatch(card.actor)) ?? [],
  }));
}

function AcreditacionAdvanceMetric({
  label,
  value,
  hint,
  tone = "base",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "base" | "target" | "ready" | "warning";
}) {
  return (
    <span className={`mon-advance-metric is-${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
      {hint && hint !== value ? <small>{hint}</small> : null}
    </span>
  );
}

function AcreditacionAdvanceStorage({
  cards,
  scopeLabel = "actor",
  phoneContext = null,
}: {
  cards: AcreditacionAdvanceCard[];
  scopeLabel?: string;
  phoneContext?: {
    universe: number;
    platformEffective: number;
    phoneEffective: number;
    phoneSwept: number;
    phoneSweptWithoutEffective: number;
    phonePending: number;
  } | null;
}) {
  const totals = advanceTotals(cards);
  const universe = Math.max(0, totals.universe);
  const isPhoneScope = normalizeSourceMatch(scopeLabel) !== "actor";
  const phoneUniverse = phoneContext?.universe && phoneContext.universe > 0 ? phoneContext.universe : universe;
  const phoneEffective = phoneContext?.phoneEffective ?? totals.effective;
  const phonePending = phoneContext?.phonePending ?? totals.pending;
  const phoneSwept = phoneContext?.phoneSwept ?? Math.max(0, phoneUniverse - phonePending);
  const phoneSweptWithoutEffective = phoneContext?.phoneSweptWithoutEffective ?? Math.max(0, phoneSwept - phoneEffective);
  const segments = isPhoneScope
    ? [
      { key: "completed", label: "Tel. efectivas", value: phoneEffective, pct: safePercentValue(phoneEffective, phoneUniverse) ?? 0, hint: "estado efectivo", detail: "Casos que el barrido telefónico declara como efectivos; se contrastan con Kobo por CodPulso." },
      { key: "phone", label: "Sin efectiva tel.", value: phoneSweptWithoutEffective, pct: safePercentValue(phoneSweptWithoutEffective, phoneUniverse) ?? 0, hint: "barridas no efectivas", detail: "Casos ya barridos con un estado telefonico distinto de efectivo." },
      { key: "pending", label: "Por barrer", value: phonePending, pct: safePercentValue(phonePending, phoneUniverse) ?? 0, hint: "base telefonica", detail: "Casos de la base telefonica que todavia no tienen estado de llamada." },
    ]
    : [
      { key: "completed", label: "Efectivas", value: totals.effective, pct: safePercentValue(totals.effective, universe) ?? 0, hint: "del universo", detail: "Respuestas completas que cuentan para el avance." },
      { key: "partial", label: "Parciales", value: totals.partial, pct: safePercentValue(totals.partial, universe) ?? 0, hint: "no cuentan como efectivas", detail: "Respuestas iniciadas o incompletas que no cuentan como efectivas." },
      { key: "refusals", label: "Rechazos", value: totals.refusals, pct: safePercentValue(totals.refusals, universe) ?? 0, hint: "requieren trazabilidad", detail: "Casos con rechazo registrado en plataforma o campo." },
      { key: "pending", label: "Sin respuesta", value: totals.pending, pct: safePercentValue(totals.pending, universe) ?? 0, hint: "por cerrar", detail: "Casos del universo que todavia no tienen respuesta util para avance." },
    ];
  const legendSegments = isPhoneScope
    ? [
      { key: "swept", label: "Barridos", value: phoneSwept, pct: safePercentValue(phoneSwept, phoneUniverse) ?? 0, hint: "con estado", tone: "phone", detail: "Casos de la base telefonica que ya tienen algun estado de llamada registrado." },
      ...segments,
      { key: "platform", label: "Efectivas Kobo", value: phoneContext?.platformEffective ?? totals.effective, pct: safePercentValue(phoneContext?.platformEffective ?? totals.effective, phoneUniverse) ?? 0, hint: "avance", tone: "completed", detail: "Respuestas Kobo completas, no prueba y que pasan el filtro de consentimiento; son las que mandan el avance." },
    ]
    : segments;
  let storageSegmentOffset = 0;
  const positionedStorageSegments = segments.map((segment) => {
    const segmentPct = Math.max(0, Math.min(100, segment.pct));
    const start = storageSegmentOffset;
    storageSegmentOffset += segmentPct;
    return { ...segment, pct: segmentPct, center: Math.max(6, Math.min(94, start + segmentPct / 2)) };
  });
  const [hoveredStorageSegmentKey, setHoveredStorageSegmentKey] = useState("");
  const hoveredStorageSegment = positionedStorageSegments.find((segment) => segment.key === hoveredStorageSegmentKey) ?? null;
  const storageSegmentTooltip = (segment: { label: string; value: number; pct: number | null | undefined; hint: string; detail?: string }) => (
    `${segment.label}: ${fmt(segment.value)} casos · ${pct(segment.pct)} ${segment.hint}.${segment.detail ? ` ${segment.detail}` : ""}`
  );
  const actorUniverse = [...cards].filter((card) => card.universe > 0).sort((a, b) => b.universe - a.universe).slice(0, 4);
  const storageAriaLabel = isPhoneScope ? "Base telefónica y estados de llamada" : "Universo y avance de acreditación";
  const storageHeading = isPhoneScope ? "Base telefónica" : "Universo de avance";
  const storageProgress = isPhoneScope ? `${pctFrom(phoneSwept, phoneUniverse)} barrido` : `${pctFrom(totals.effective, universe)} efectivas`;
  return (
    <section className="mon-advance-storage" aria-label={storageAriaLabel}>
      <header>
        <div>
          <span>{storageHeading}</span>
          <strong>{fmt(isPhoneScope ? phoneUniverse : universe)} casos</strong>
        </div>
        <em>{storageProgress}</em>
      </header>
      <div className="mon-advance-actor-breakdown" aria-label={`Casos por ${scopeLabel.toLowerCase()}`}>
        {actorUniverse.map((card) => (
          <span
            key={`${card.id}-universe`}
            title={`${card.actor}: ${fmt(card.universe)} casos (${pctFrom(card.universe, universe)})`}
            style={{ "--advance-actor-size": `${Math.max(0, Math.min(100, safePercentValue(card.universe, universe) ?? 0))}%` } as CSSProperties}
          >
            <em>{card.actor}</em>
            <strong>{fmt(card.universe)}</strong>
            <i aria-hidden="true" />
          </span>
        ))}
      </div>
      <div className="mon-advance-storage-chart">
        <div className="mon-advance-storage-bar" role="list" aria-label={`${fmt(isPhoneScope ? phoneSwept : totals.effective)} ${isPhoneScope ? "casos barridos" : "efectivas"} de ${fmt(isPhoneScope ? phoneUniverse : universe)} casos base`}>
          {positionedStorageSegments.some((segment) => segment.value > 0)
            ? positionedStorageSegments.map((segment) => (
              <i
                key={segment.key}
                role="listitem"
                tabIndex={0}
                aria-label={storageSegmentTooltip(segment)}
                className={`is-${segment.key}`}
                title={storageSegmentTooltip(segment)}
                onBlur={() => setHoveredStorageSegmentKey("")}
                onFocus={() => setHoveredStorageSegmentKey(segment.key)}
                onMouseEnter={() => setHoveredStorageSegmentKey(segment.key)}
                onMouseLeave={() => setHoveredStorageSegmentKey("")}
                style={{ "--advance-storage-size": `${Math.max(0, Math.min(100, segment.pct))}%` } as CSSProperties}
              />
            ))
            : <i className="is-empty" style={{ "--advance-storage-size": "100%" } as CSSProperties} />}
        </div>
        {hoveredStorageSegment ? (
          <div
            className="mon-phone-bar-tooltip"
            style={{ "--phone-bar-tooltip-x": `${hoveredStorageSegment.center}%` } as CSSProperties}
          >
            <strong>{hoveredStorageSegment.label}</strong>
            <span>{fmt(hoveredStorageSegment.value)} casos</span>
            <em>{pct(hoveredStorageSegment.pct)} {hoveredStorageSegment.hint}</em>
          </div>
        ) : null}
      </div>
      <div className="mon-advance-storage-legend">
        {legendSegments.map((segment) => (
          <span
            key={segment.key}
            className={`is-${"tone" in segment ? segment.tone : segment.key}`}
            aria-label={storageSegmentTooltip(segment)}
            title={storageSegmentTooltip(segment)}
          >
            <em>{segment.label}</em>
            <strong>{fmt(segment.value)}</strong>
            <small>{segment.hint}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function AcreditacionPhoneQuotaRhythmBoard({
  cards,
  variable,
  cutDate,
  statusActorRows = [],
  stateRules = [],
  cierre = null,
}: {
  cards: AcreditacionActorCard[];
  variable: string;
  cutDate?: string;
  /** `estatus_actor_dia`: la composición del barrido, desglosada por cuota. */
  statusActorRows?: Array<Record<string, unknown>>;
  stateRules?: MonitoreoStateRule[];
  /** Si la base alcanza para cerrar: reserva, ritmo, proyección y rendimiento. */
  cierre?: {
    reserva: number;
    reservaAlcanza: boolean | null;
    reservaTitulo: string;
    porDia: string | null;
    diasProyectados: number | null;
    costoPorEfectiva: string | null;
  } | null;
}) {
  // Los colores del apilado son los que el usuario confirmó en el definidor de
  // estados: la tabla de Fuentes y este gráfico leen la misma declaración y no
  // pueden discrepar.
  const declaracionesDeEstado = useMemo(
    () => acreditacionDeclaracionesDesdeReglas(stateRules),
    [stateRules],
  );
  const quotaCards = [...cards].sort((a, b) => (
    (b.missing ?? -1) - (a.missing ?? -1)
    || b.universe - a.universe
    || a.actor.localeCompare(b.actor, "es")
  ));
  const cardsWithSeries = quotaCards.filter((card) => card.dailyPoints.length);
  const totalEffective = quotaCards.reduce((sum, card) => sum + card.effective, 0);
  const totalMeta = quotaCards.reduce((sum, card) => sum + (card.meta ?? 0), 0);
  const totalGap = quotaCards.reduce((sum, card) => sum + (card.missing ?? 0), 0);
  const visibleCards = (cardsWithSeries.length ? cardsWithSeries : quotaCards).slice(0, 8);
  const datedEffective = quotaCards.reduce((sum, card) => (
    sum + card.dailyPoints.reduce((inner, point) => inner + dailyEffectiveValue(point), 0)
  ), 0);
  const datedLabel = totalEffective && datedEffective !== totalEffective
    ? `${fmt(datedEffective)}/${fmt(totalEffective)}`
    : fmt(datedEffective || totalEffective);
  const hasSeries = cardsWithSeries.length > 0;
  return (
    <section className={`mon-phone-quota-rhythm${hasSeries ? " has-series" : " is-missing-series"}`} aria-label={`Avance diario por ${variable}`}>
      <header>
        <div>
          <span><CalendarRange size={13} /> Ritmo por {variable.toLowerCase()}</span>
          <strong>{hasSeries ? "Cuotas con ritmo diario" : "Falta fecha por cuota"}</strong>
        </div>
        <div className="mon-phone-quota-rhythm-kpis">
          <span><em>{variable}</em><strong>{fmt(quotaCards.length)}</strong></span>
          <span><em>Meta</em><strong>{totalMeta ? fmt(totalMeta) : "S/M"}</strong></span>
          <span className={totalGap ? "is-warning" : "is-ready"}><em>Faltan</em><strong>{fmt(totalGap)}</strong></span>
          <span className="is-ready"><em>Fechadas</em><strong>{datedLabel}</strong></span>
          {/* Las cifras de cierre. Vivían en Llamadas, dentro de un panel que
            * repetía esta misma tabla de cuotas; son las únicas que no estaban
            * aquí y son las que contestan si la base alcanza para cerrar. */}
          {cierre ? (
            <>
              <span className={cierre.reservaAlcanza === false ? "is-warning" : ""} title={cierre.reservaTitulo}>
                <em>Reserva</em><strong>{fmt(cierre.reserva)}</strong>
              </span>
              {cierre.porDia != null ? (
                <span><em>Ritmo</em><strong>{cierre.porDia}<small>/día</small></strong></span>
              ) : null}
              {cierre.diasProyectados != null ? (
                // «Cierre» y no «Proyección»: es más corto —el rótulo largo se
                // truncaba— y dice lo que se viene a saber, que es cuándo.
                <span title="Días que tomaría cerrar la brecha al ritmo observado">
                  <em>Cierre</em><strong>{fmt(cierre.diasProyectados)}<small> días</small></strong>
                </span>
              ) : null}
              {cierre.costoPorEfectiva != null ? (
                // Sin el sufijo «por efectiva» dentro de la cifra: en una casilla
                // de 135 px truncaba el rótulo y el valor a la vez. Vive en el
                // `title`, que es donde no le quita sitio a nada.
                <span title="Registros de base consumidos por cada efectiva lograda">
                  <em>Rendimiento</em><strong>{cierre.costoPorEfectiva}</strong>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </header>
      <div className="mon-phone-quota-rhythm-grid">
        {visibleCards.length ? visibleCards.map((card) => {
          const progress = card.meta ? safePercentValue(card.effective, card.meta) ?? 0 : card.coverage ?? 0;
          const cardDated = card.dailyPoints.reduce((sum, point) => sum + dailyEffectiveValue(point), 0);
          const orderedDaily = sortAcreditacionDailyPoints(card.dailyPoints)
            .filter((point) => isDatedAcreditacionDailyPoint(point) && dailyEffectiveValue(point) > 0);
          const latestDatedPoint = orderedDaily.at(-1) ?? null;
          // El barrido del segmento en tres tramos que suman el universo. Se
          // deriva por resta y no se lee de otro sitio para que los tres no
          // puedan contradecirse: lo trabajado sin lograr entrevista es lo que
          // queda entre las efectivas y lo que aún no se ha llamado.
          const barridoSinEfectiva = Math.max(0, card.universe - card.effective - card.pending);
          const porcentaje = (parte: number) => (card.universe > 0
            ? Math.max(0, Math.min(100, (parte / card.universe) * 100))
            : 0);
          const pctEfectiva = porcentaje(card.effective);
          const pctBarrido = porcentaje(barridoSinEfectiva);
          const pctPorBarrer = porcentaje(card.pending);
          const estadosDeLaCuota = buildAcreditacionPhoneDailyStatusSeries(
            estadosPorDiaDeLaCuota(statusActorRows, card.actor),
          );
          return (
            <article key={card.id} className={`mon-phone-quota-rhythm-row ${card.dailyPoints.length ? "has-series" : "is-missing-series"}`}>
              <div className="mon-phone-quota-rhythm-row-summary">
                <div className="mon-phone-quota-rhythm-card-head">
                  <div>
                    <span>{variable}</span>
                    <strong>{card.actor}</strong>
                  </div>
                </div>
                <div className="mon-phone-quota-rhythm-progress" aria-label={`${card.actor}: ${formatPercentLabel(progress)} de avance`}>
                  <span className="mon-phone-quota-rhythm-donut" aria-hidden="true">
                    <i style={{ "--phone-quota-rhythm-pct": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties} />
                  </span>
                  <b className="mon-phone-quota-rhythm-progress-value">{formatPercentLabel(progress)}</b>
                  <span className="mon-phone-quota-rhythm-progress-copy">
                    <strong>{fmt(card.effective)}</strong>
                    <em>{card.meta == null ? "sin meta" : `de ${fmt(card.meta)}`}</em>
                    <small>{card.missing == null ? "meta pendiente" : card.missing > 0 ? `${fmt(card.missing)} faltan` : "cuota cubierta"}</small>
                  </span>
                </div>
                {/* Cuánto de este segmento se ha barrido, en vertical.
                  *
                  * «Faltan 25» solo se puede leer sabiendo con qué se cuenta
                  * para cubrirlas: 25 con la base entera por delante es una
                  * situación y 25 con la base agotada es otra. La cifra sola no
                  * distingue las dos, y era lo único que había.
                  *
                  * Vertical y no horizontal por el sitio: la fila creció cuando
                  * el apilado de estados se metió debajo del ritmo, y la
                  * columna del resumen se quedó con un hueco del alto de un
                  * gráfico. Una barra vertical lo ocupa, y de paso deja cada
                  * cifra a la altura de su tramo en vez de en una leyenda
                  * aparte que hay que emparejar por color.
                  *
                  * Se fueron de aquí «Base», «Faltan» y «Fechadas»: los tres
                  * estaban dichos ya. La base es el total de la barra, las que
                  * faltan las dice el anillo, y las fechadas solo aportan
                  * cuando no coinciden con las efectivas. */}
                {card.universe > 0 ? (
                  <div
                    className="mon-phone-quota-rhythm-barrido"
                    role="img"
                    aria-label={`${fmt(card.effective)} efectivas, ${fmt(barridoSinEfectiva)} barrido sin efectiva y ${fmt(card.pending)} por barrer de ${fmt(card.universe)}`}
                    style={{
                      "--tramo-efectiva": `${pctEfectiva}fr`,
                      "--tramo-barrido": `${pctBarrido}fr`,
                      "--tramo-por-barrer": `${pctPorBarrer}fr`,
                    } as CSSProperties}
                  >
                    <i className="is-efectiva" aria-hidden="true" />
                    <span className="is-efectiva">
                      <strong>{fmt(card.effective)}</strong>
                      <em>Efectivas</em>
                    </span>
                    <i className="is-barrido" aria-hidden="true" />
                    <span className="is-barrido">
                      <strong>{fmt(barridoSinEfectiva)}</strong>
                      <em>Sin efectiva</em>
                    </span>
                    <i className="is-por-barrer" aria-hidden="true" />
                    <span className="is-por-barrer">
                      <strong>{fmt(card.pending)}</strong>
                      <em>Por barrer</em>
                    </span>
                    <b>{fmt(card.universe)} en la base</b>
                  </div>
                ) : null}
                {/* El pie, con rótulo por dato.
                  *
                  * Decía «Último día ago 08 · 4 efectivas Kobo» en una línea
                  * corrida, y esas 4 se leían como el total de la cuota —que
                  * son 14, dos centímetros más arriba—. Son las de ESE día, y
                  * ahora cada cifra lleva encima de qué está hablando. */}
                <footer className="mon-phone-quota-rhythm-pie">
                  {latestDatedPoint ? (
                    <>
                      <span>
                        <em>Último día</em>
                        <strong>{inlineAdvanceDateTickLabel(latestDatedPoint.date).replace("<br>", " ")}</strong>
                      </span>
                      <span>
                        <em>Ese día</em>
                        <strong>{fmt(dailyEffectiveValue(latestDatedPoint))} efectivas</strong>
                      </span>
                    </>
                  ) : (
                    <span>
                      <em>Serie diaria</em>
                      <strong>Sin fechas</strong>
                    </span>
                  )}
                  {/* Solo cuando difiere: si todas las efectivas tienen fecha,
                    * repetir la cifra del anillo no informa de nada. */}
                  {cardDated && cardDated !== card.effective ? (
                    <span>
                      <em>Con fecha</em>
                      <strong>{fmt(cardDated)} de {fmt(card.effective)}</strong>
                    </span>
                  ) : null}
                </footer>
              </div>
              <div className="mon-phone-quota-rhythm-row-chart">
                <AcreditacionAdvanceDailyMini
                  points={orderedDaily}
                  title={`Ritmo diario de ${card.actor}`}
                  variant="actor"
                  effectiveOnly
                  compact
                  compactHeight={218}
                />
                {/* Debajo del ritmo, no al lado: son dos lecturas del mismo
                  * periodo —efectivas Kobo arriba, composición del barrido
                  * abajo— y el ritmo por sí solo no dice a costa de qué se
                  * consiguieron esas efectivas.
                  *
                  * Las filas son las de ESTA cuota. Con el bloque global el
                  * gráfico sería idéntico para las dos y afirmaría que el
                  * barrido de una cuota de 27 casos es el del estudio entero. */}
                {estadosDeLaCuota.length ? (
                  <GraficoDeEstadosPorDia
                    series={estadosDeLaCuota}
                    declaraciones={declaracionesDeEstado}
                  />
                ) : null}
              </div>
            </article>
          );
        }) : (
          <EmptyPanel title="Sin cuotas" detail={`Define ${variable.toLowerCase()} y metas Kobo para ver el avance diario por cuota.`} />
        )}
      </div>
    </section>
  );
}

function AcreditacionActorDashboardTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "base" | "target" | "ready" | "warning";
}) {
  return (
    <div className={`mon-actor-dashboard-tile is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </div>
  );
}

function AcreditacionActorFlowNode({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "base" | "target" | "ready" | "warning";
}) {
  return (
    <span className={`mon-actor-flow-node is-${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function AcreditacionActorMechanismGroup({
  title,
  caption,
  value,
  tone,
  children,
}: {
  title: string;
  caption: string;
  value: string;
  tone: "base" | "responses";
  children: ReactNode;
}) {
  return (
    <section className={`mon-actor-mechanism-group is-${tone}`}>
      <header>
        <div>
          <span>{title}</span>
          <em>{caption}</em>
        </div>
        <strong>{value}</strong>
      </header>
      <div className="mon-actor-mechanism-list">{children}</div>
    </section>
  );
}

function AcreditacionActorMechanismRow({
  item,
  universe,
}: {
  item: AcreditacionActorMechanism;
  universe: number | null | undefined;
}) {
  const Icon = mechanismIcon(item.modality);
  const pctValue = safePercentValue(item.observed ?? 0, universe ?? null);
  const kind = mechanismKind(item);
  const channelLabel = item.channel ? acreditacionChannelLabel(item.channel) : "";
  const visibleChannel = channelLabel && channelLabel !== "Sin canal" ? channelLabel : "";
  return (
    <div className={`mon-actor-mechanism is-${item.modality} is-${kind}`}>
      <span className="mon-actor-mechanism-icon"><Icon size={13} /></span>
      <div>
        <strong>{item.label}</strong>
        <span>{item.provider} · {item.role}{visibleChannel ? ` · ${visibleChannel}` : ""}</span>
      </div>
      <em>
        {item.observed == null ? "S/D" : fmt(item.observed)}
        <small>{item.role === "Universo" ? "universo" : item.role === "Barrido" ? "base" : "respuestas"}</small>
      </em>
      <i style={{ "--mechanism-pct": `${Math.max(0, Math.min(100, pctValue ?? 0))}%` } as CSSProperties} />
    </div>
  );
}

function AcreditacionActorProgressCardView({
  card,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
  scopeLabel = "Actor",
}: {
  card: AcreditacionActorCard;
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
  scopeLabel?: string;
}) {
  const totalProgress = card.progress ?? card.coverage ?? safePercentValue(card.effective, card.universe);
  const dial = Math.max(0, Math.min(100, totalProgress ?? 0)) * 3.6;
  const isPhoneQuotaScope = scopeLabel !== "Actor";
  const completedPct = safePercentValue(card.effective, card.universe) ?? 0;
  const sweptWithoutEffective = isPhoneQuotaScope
    ? Math.max(0, card.universe - card.effective - card.pending)
    : card.partial;
  const partialPct = safePercentValue(sweptWithoutEffective, card.universe) ?? 0;
  const refusalsPct = isPhoneQuotaScope ? 0 : safePercentValue(card.refusals, card.universe) ?? 0;
  const unansweredPct = isPhoneQuotaScope
    ? safePercentValue(card.pending, card.universe) ?? 0
    : Math.max(0, 100 - completedPct - partialPct - refusalsPct);
  const targetPct = safePercentValue(card.meta, card.universe);
  const clampedTargetPct = targetPct == null ? 0 : Math.max(0, Math.min(100, targetPct));
  const targetReached = card.missing != null ? card.missing <= 0 : card.meta != null && card.effective >= card.meta;
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  return (
    <article
      className={`mon-actor-card is-${card.statusTone}${isPhoneQuotaScope ? " is-phone-quota" : ""}`}
      style={{
        "--actor-dial": `${dial}deg`,
        "--actor-complete": `${Math.max(0, Math.min(100, completedPct))}%`,
        "--actor-partial": `${Math.max(0, Math.min(100, completedPct + partialPct))}%`,
        "--actor-refusal": `${Math.max(0, Math.min(100, completedPct + partialPct + refusalsPct))}%`,
        "--actor-target": `${clampedTargetPct}%`,
      } as CSSProperties}
    >
      <header className="mon-actor-card-head">
        <div>
          <span>{scopeLabel}</span>
          <strong>{card.actor}</strong>
        </div>
        <em>{card.status}</em>
      </header>
      <div className="mon-actor-card-body">
        <div className="mon-actor-radar" aria-label={`Avance de ${card.actor}`}>
          <div className={`mon-actor-dial is-${card.statusTone}`}>
            <strong>{formatPercentLabel(totalProgress)}</strong>
            <span>{isPhoneQuotaScope ? "Meta" : "Total"}</span>
          </div>
          <div
            className={`mon-actor-pipeline-wrap${targetPct == null ? "" : " has-target"}`}
            role="img"
            aria-label={`${fmt(card.effective)} efectivas de ${fmt(card.universe)} universo`}
          >
            <div className="mon-actor-pipeline" aria-hidden="true">
              <span className="is-complete" />
              <span className="is-partial" />
              <span className="is-refusal" />
              <span className="is-pending" style={{ width: `${unansweredPct}%` }} />
            </div>
            {targetPct != null ? (
              <span
                className={`mon-actor-target ${targetReached ? "is-reached" : "is-open"}`}
                title={`Meta ${fmt(card.meta)} (${formatPercentLabel(targetPct)} del universo)`}
                aria-hidden="true"
              />
            ) : null}
          </div>
          <p>
            <span>{fmt(card.effective)} efectivas</span>
            <strong>{fmt(card.pending)} {isPhoneQuotaScope ? "por barrer" : "pendientes"}</strong>
          </p>
        </div>
        <div className="mon-actor-flow" aria-label={`Meta de ${scopeLabel.toLowerCase()}`}>
          <AcreditacionActorFlowNode label="Universo" value={fmt(card.universe)} tone="base" />
          <AcreditacionActorFlowNode label="Meta" value={card.meta == null ? "S/M" : fmt(card.meta)} tone="target" />
          <AcreditacionActorFlowNode label="Efectivas" value={fmt(card.effective)} tone="ready" />
          <AcreditacionActorFlowNode label={isPhoneQuotaScope ? "Pendiente" : "Brecha"} value={card.missing == null ? "S/M" : fmt(card.missing)} tone={card.missing != null && card.missing > 0 ? "warning" : "ready"} />
        </div>
      </div>
      {card.dailyPoints.length ? (
        <AcreditacionAdvanceDailyMini
          points={card.dailyPoints}
          title={card.actor}
          variant="actor"
          cutDate={cutDate}
          reportCuts={reportCuts}
          reportWeekday={reportWeekday}
          effectiveOnly={scopeLabel !== "Actor"}
          compact={isPhoneQuotaScope}
        />
      ) : isPhoneQuotaScope ? (
        <div className="mon-phone-quota-series-note" role="note">
          <CalendarRange size={16} aria-hidden="true" />
          <div>
            <strong>Ritmo diario pendiente</strong>
            <span>El corte trae meta y efectivas de esta cuota, pero falta la fecha de cada CodPulso asociada a la variable para dibujar la serie.</span>
          </div>
        </div>
      ) : null}
      {!isPhoneQuotaScope ? (
      <div className="mon-actor-mechanisms" aria-label={`Fuentes y avance de ${card.actor}`}>
        <AcreditacionActorMechanismGroup
          title="Universo y bases"
          caption="Base trabajada y barrido"
          value={card.universe ? `${fmt(card.universe)} universo` : `${fmt(baseMechanisms.length)} fuentes`}
          tone="base"
        >
          {baseMechanisms.length ? baseMechanisms.map((item) => (
            <AcreditacionActorMechanismRow key={item.id} item={item} universe={card.universe} />
          )) : (
            <div className="mon-actor-mechanism-empty">Sin base registrada para esta unidad.</div>
          )}
        </AcreditacionActorMechanismGroup>
        <AcreditacionActorMechanismGroup
          title="Avance en plataformas"
          caption="Respuestas por canal"
          value={`${fmt(card.effective)} efectivas`}
          tone="responses"
        >
          {responseMechanisms.length ? responseMechanisms.map((item) => (
            <AcreditacionActorMechanismRow key={item.id} item={item} universe={card.universe} />
          )) : (
            <div className="mon-actor-mechanism-empty">Sin respuestas conectadas para este actor.</div>
          )}
        </AcreditacionActorMechanismGroup>
      </div>
      ) : null}
    </article>
  );
}

function AcreditacionAdvanceActorsWorkbench({
  reports,
  state,
  actorRows,
  sourceRows,
  dailyRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  sourceRows: Array<Record<string, unknown>>;
  dailyRows: Array<Record<string, unknown>>;
}) {
  const allowedActors = new Set(actorRows.map((row, index) => normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`))));
  const actorDailySeries = buildAcreditacionAdvanceDailySeries(reports, "avance_general_dia", "Unidad", allowedActors);
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaCards = useMemo(() => phoneQuotaCardsForDashboard(reports), [reports]);
  const cards = isPhoneModel && phoneQuotaCards.length ? phoneQuotaCards : actorCardsForDashboard({
    actorRows,
    sourceRows,
    dailyRows,
    actorDailySeries,
    goals: state?.config.goals ?? [],
    sources: state?.sources ?? [],
    progressRows: state?.dashboard?.progress ?? [],
  });
  // Cómo se llama el segmento de cuotas en ESTE estudio. Ver
  // `segmentoDeCuotas.ts`: estaba escrito «Sede» a mano en cinco sitios, y en
  // PDM MedVida el segmento es `Actor`.
  const esCuotaTelefonica = isPhoneModel && phoneQuotaCards.length > 0;
  const segmentoDeLasCuotas = useMemo(
    () => nombreDelSegmento(
      phoneQuotaRowsForPanel(
        rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]),
      ).map((row) => row.variable),
    ),
    [reports],
  );
  const scopeLabel = esCuotaTelefonica ? segmentoDeLasCuotas : "Actor";
  const totals = advanceTotals(cards);
  const goals = actorGoalSummary(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const mechanismTotal = cards.reduce((sum, card) => sum + card.mechanisms.length, 0);
  const unitCountLabel = contarSegmentos(cards.length, scopeLabel);
  const mechanismSummary = esCuotaTelefonica
    ? `${fmt(cards.filter((card) => card.meta != null).length)} metas`
    : `${fmt(mechanismTotal)} mecanismos`;
  const phoneQuotaWithMeta = cards.filter((card) => card.meta != null).length;
  const phoneQuotaReached = cards.filter((card) => card.meta != null && (card.missing ?? 0) <= 0).length;
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const statusActorDayRows = useMemo(
    () => rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_actor_dia"]),
    [reports],
  );
  // Si la base alcanza para cerrar. Se calcula con el mismo modelo que usaba el
  // panel de cumplimiento en Llamadas —de donde vienen estas cifras— para que
  // ninguna de las dos pantallas invente su propia versión.
  const cierreDeCuotas = useMemo(() => {
    if (!esCuotaTelefonica) return null;
    const { reserva, ritmo } = buildTelefonicoCumplimiento({
      categorias: cards.map((card) => ({
        clave: card.id,
        etiqueta: card.actor,
        universo: card.universe,
        minimo: card.meta,
        logrado: card.effective,
      })),
      logradoTotal: cards.reduce((sum, card) => sum + card.effective, 0),
      porBarrer: cards.reduce((sum, card) => sum + card.pending, 0),
      barridos: cards.reduce((sum, card) => sum + Math.max(0, card.universe - card.pending), 0),
      // El ritmo del estudio es la suma por día de todas las cuotas, no la
      // concatenación de sus series: dos cuotas que trabajan el mismo día son
      // un día, no dos.
      serieDiaria: [...cards
        .flatMap((card) => card.dailyPoints)
        .reduce((porDia, point) => {
          const dia = String(point.date ?? "");
          if (!dia) return porDia;
          porDia.set(dia, (porDia.get(dia) ?? 0) + dailyEffectiveValue(point));
          return porDia;
        }, new Map<string, number>())
        .values()],
    });
    if (!reserva) return null;
    return {
      reserva: reserva.disponible,
      reservaAlcanza: reserva.suficiente,
      reservaTitulo: reserva.necesariaEstimada != null && reserva.suficiente === false
        ? `No alcanza: se estiman ${fmt(reserva.necesariaEstimada)} para cerrar`
        : "Casos de la base todavía sin trabajar",
      porDia: ritmo ? ritmo.porDia.toLocaleString("es-PE", { maximumFractionDigits: 1 }) : null,
      diasProyectados: ritmo?.diasProyectados ?? null,
      costoPorEfectiva: reserva.costoPorEfectiva != null
        ? reserva.costoPorEfectiva.toLocaleString("es-PE", { maximumFractionDigits: 1 })
        : null,
    };
  }, [cards, esCuotaTelefonica]);

  if (isPhoneModel) {
    return (
      <section
        className="pulso-panel mon-fill-panel mon-strata-dashboard mon-actor-dashboard mon-phone-quota-lane-workbench"
        style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
        aria-label={`Cuotas Kobo por ${scopeLabel.toLowerCase()}`}
      >
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Avance</span>
            <h2 className="pulso-panel-title">
              <span className="mon-title-icon">
                <Layers3 size={16} /> Cuotas Kobo por {scopeLabel.toLocaleLowerCase("es")}
              </span>
            </h2>
          </div>
          <div className="pulso-panel-actions mon-actor-dashboard-actions">
            <span>{unitCountLabel}</span>
            <span>{mechanismSummary}</span>
            {generatedAt ? <span>{generatedAt}</span> : null}
          </div>
        </header>
        <AcreditacionPhoneQuotaRhythmBoard
          cards={cards}
          variable={scopeLabel}
          cutDate={reports.generated_at}
          statusActorRows={statusActorDayRows}
          stateRules={state?.config?.operational_model?.state_rules ?? []}
          cierre={cierreDeCuotas}
        />
      </section>
    );
  }

  return (
    <section
      className="pulso-panel mon-fill-panel mon-strata-dashboard mon-actor-dashboard"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label={isPhoneModel ? `Cuotas Kobo por ${scopeLabel.toLowerCase()}` : "Avance canónico por actor"}
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><Layers3 size={16} /> {isPhoneModel ? `Cuotas Kobo por ${scopeLabel.toLowerCase()}` : `Avance por ${scopeLabel.toLowerCase()}`}</span></h2>
          <p className="pulso-panel-hint">{isPhoneModel ? `Meta, efectivas Kobo, pendiente por cumplir y base telefónica por ${scopeLabel.toLowerCase()}.` : `Universo, meta, brecha y fuentes por ${scopeLabel.toLowerCase()}.`}</p>
        </div>
        <div className="pulso-panel-actions mon-actor-dashboard-actions">
          <span>{unitCountLabel}</span>
          <span>{mechanismSummary}</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--actors">
        <div className="mon-advance-hero-copy">
          <span>{isPhoneModel ? `Cuota por ${scopeLabel.toLowerCase()}` : `Corte por ${scopeLabel.toLowerCase()}`}</span>
          <strong>{fmt(totals.effective)} {isPhoneModel ? "efectivas Kobo" : "efectivas"} de {fmt(totals.universe)}</strong>
          <p>{isPhoneModel ? `Cada ${scopeLabel.toLowerCase()} muestra la base telefónica, la meta, las efectivas Kobo y lo que falta cumplir.` : `Lee cada ${scopeLabel.toLowerCase()} como una unidad operativa: universo/base, meta, avance real y mecanismos que alimentan el corte.`}</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label={pluralDelSegmento(scopeLabel)} value={fmt(cards.length)} hint={mechanismSummary} tone="base" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Cuotas cumplidas" : `Metas ${scopeLabel.toLowerCase()}`}
            value={isPhoneModel ? `${fmt(phoneQuotaReached)}/${fmt(phoneQuotaWithMeta || cards.length)}` : actorGoalValue(goals)}
            hint={isPhoneModel ? `${fmt(phoneQuotaWithMeta)} con meta Kobo` : actorGoalHint(goals)}
            tone={isPhoneModel ? (phoneQuotaWithMeta && phoneQuotaReached >= phoneQuotaWithMeta ? "ready" : "target") : actorGoalTone(goals)}
          />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${formatPercentLabel(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Por barrer" : "Pendientes"}
            value={fmt(totals.pending)}
            hint={isPhoneModel ? "estado telefónico pendiente" : `${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`}
            tone={totals.pending ? "warning" : "base"}
          />
        </div>
      </div>
      <div className={`mon-actor-grid${isPhoneModel ? " mon-actor-grid--phone-quota" : ""}`}>
        {cards.length ? cards.map((card) => (
          <AcreditacionActorProgressCardView
            key={card.id}
            card={card}
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            scopeLabel={scopeLabel}
          />
        )) : (
          <EmptyPanel
            title={isPhoneModel ? "Sin cuotas operativas" : "Sin cortes operativos"}
            detail={isPhoneModel ? "El reporte telefónico aún no trae categorías de cuota para mostrar metas, efectivas Kobo y pendientes." : "El reporte de avance aún no trae actores para mostrar metas, fuentes y brechas."}
          />
        )}
      </div>
    </section>
  );
}

function acreditacionChannelKey(value: string): AcreditacionChannelToneKey {
  const normalized = normalizeSourceMatch(value);
  if (!normalized || normalized === "sin canal" || normalized === "sin dato" || normalized === "desconocido") return "desconocido";
  if (normalized.includes("kobo")) return "kobo";
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "presencial";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("whatsapp") || normalized.includes("sms") || normalized.includes("web") || normalized.includes("link") || normalized.includes("enlace")) return "enlace";
  return "desconocido";
}

export function acreditacionChannelLabel(value: string) {
  const key = acreditacionChannelKey(value);
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "presencial") return "Ficha QR";
  if (key === "enlace") return "Enlace";
  if (key === "kobo") return "Kobo";
  return "Sin canal";
}

function acreditacionChannelDisplay(value: unknown, fallback = "Sin canal") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const label = acreditacionChannelLabel(raw);
  return label === "Sin canal" ? raw : label;
}

function AcreditacionChannelBadge({ channel }: { channel: string }) {
  const key = acreditacionChannelKey(channel);
  const option = ACREDITACION_CHANNEL_OPTIONS.find((item) => item.key === key);
  const Icon = option?.icon ?? Route;
  return (
    <span className={`mon-channel-badge is-${key}`}>
      <Icon size={12} />
      {option?.label ?? acreditacionChannelLabel(channel)}
    </span>
  );
}

function surveySourceForAcreditacionId(sourceId: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(sourceId);
  if (!key) return null;
  return sources.find((source) => normalizeSourceMatch(source.id) === key || normalizeSourceMatch(source.survey_id) === key) ?? null;
}

function surveySourceForAcreditacionTitle(title: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(title);
  if (!key) return null;
  return sources.find((source) => [
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    source.survey_id,
  ].some((value) => normalizeSourceMatch(value) === key))
    ?? sources.find((source) => {
      const label = normalizeSourceMatch(source.survey_title || source.dimensions?.survey_title || source.label);
      return label && (label.includes(key) || key.includes(label));
    })
    ?? null;
}

function addAcreditacionSurveyState(row: AcreditacionAdvanceSurveyRow, label: string, value: number) {
  if (!value) return;
  const existing = row.states.find((item) => normalizeSourceMatch(item.label) === normalizeSourceMatch(label));
  if (existing) existing.value += value;
  else row.states.push({ label, value });
}

function buildAcreditacionSurveyRows(
  sourceRows: Array<Record<string, unknown>>,
  sources: MonitoreoSource[] = [],
): AcreditacionAdvanceSurveyRow[] {
  const grouped = new Map<string, AcreditacionAdvanceSurveyRow>();
  sourceRows.forEach((row, index) => {
    const rawTitle = rowText(row, ["Fuente", "Encuesta", "Source"], `Encuesta ${index + 1}`).trim() || `Encuesta ${index + 1}`;
    const rowSourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const source = (rowSourceId ? surveySourceForAcreditacionId(rowSourceId, sources) : null)
      ?? surveySourceForAcreditacionTitle(rawTitle, sources);
    const title = String(source?.survey_title ?? source?.dimensions?.survey_title ?? source?.label ?? rawTitle).trim() || rawTitle;
    const actor = String(source ? sourceActorLabel(source) : rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "Sin actor")).trim() || "Sin actor";
    const channel = String(source ? sourceChannelLabel(source) : rowText(row, ["Canal", "Modalidad", "Channel"], "Mixto")).trim() || "Mixto";
    const surveyId = String(source?.survey_id ?? rowText(row, ["survey_id", "survey id", "id encuesta", "Survey ID"], "")).trim();
    const sourceId = String(source?.id ?? rowSourceId ?? "").trim();
    const key = normalizeSourceMatch(sourceId || surveyId || title || rawTitle) || `survey-${index}`;
    const existing = grouped.get(key) ?? {
      id: key,
      sourceId,
      title,
      actor,
      channel,
      surveyId,
      total: 0,
      effective: 0,
      partial: 0,
      refusals: 0,
      states: [],
    };
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], NaN);
    const partial = rowNumber(row, ["Parciales", "Partial"], NaN);
    const refusals = rowNumber(row, ["Rechazos plataforma", "Rechazos", "Rechazo", "Refusals"], NaN);
    const explicitTotal = rowNumber(row, ["Total respuestas", "Total", "Respuestas", "Casos"], NaN);
    const hasParts = Number.isFinite(effective) || Number.isFinite(partial) || Number.isFinite(refusals);
    const partsTotal = (Number.isFinite(effective) ? effective : 0)
      + (Number.isFinite(partial) ? partial : 0)
      + (Number.isFinite(refusals) ? refusals : 0);
    const total = Number.isFinite(explicitTotal) ? explicitTotal : partsTotal;
    const rawState = rowText(row, ["Estado", "Estatus"], "");

    if (hasParts) {
      const eff = Number.isFinite(effective) ? effective : 0;
      const part = Number.isFinite(partial) ? partial : 0;
      const ref = Number.isFinite(refusals) ? refusals : 0;
      existing.effective += eff;
      existing.partial += part;
      existing.refusals += ref;
      existing.total += Number.isFinite(explicitTotal) ? explicitTotal : eff + part + ref;
      addAcreditacionSurveyState(existing, "Efectivas", eff);
      addAcreditacionSurveyState(existing, "Parciales", part);
      addAcreditacionSurveyState(existing, "Rechazos", ref);
    } else if (rawState) {
      const tone = acreditacionSurveyStateTone(rawState);
      const value = Number.isFinite(total) ? total : 0;
      if (tone === "completed") existing.effective += value;
      if (tone === "partial") existing.partial += value;
      if (tone === "refusals") existing.refusals += value;
      existing.total += value;
      addAcreditacionSurveyState(existing, rawState, value);
    } else if (Number.isFinite(total) && total > 0) {
      existing.total += total;
      addAcreditacionSurveyState(existing, "Total respuestas", total);
    }
    grouped.set(key, existing);
  });
  return Array.from(grouped.values()).map((row) => ({
    ...row,
    states: row.states.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es")),
  })).sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es") || a.title.localeCompare(b.title, "es"));
}

function mergeAcreditacionSurveyRowsWithDailySeries(
  rows: AcreditacionAdvanceSurveyRow[],
  series: AcreditacionAdvanceDailySeries[],
) {
  const keys = new Set(rows.flatMap((row) => uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId])));
  const out = rows.map((row) => {
    const match = series.find((item) => uniqueNormalizedKeys([item.sourceId, item.label]).some((key) => uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]).includes(key)));
    if (!match || row.total > 0) return row;
    return {
      ...row,
      total: match.total,
      effective: match.completed,
      partial: match.partial,
      refusals: match.refusals,
      states: [
        { label: "Efectivas", value: match.completed },
        { label: "Parciales", value: match.partial },
        { label: "Rechazos", value: match.refusals },
      ].filter((item) => item.value > 0),
    };
  });
  if (rows.length) return out;
  series.forEach((item, index) => {
    const itemKeys = uniqueNormalizedKeys([item.sourceId, item.label]);
    if (itemKeys.some((key) => keys.has(key))) return;
    itemKeys.forEach((key) => keys.add(key));
    out.push({
      id: itemKeys[0] || `daily-source-${index}`,
      sourceId: item.sourceId ?? "",
      title: item.label,
      actor: item.actor || "Sin actor",
      channel: item.channel || "Mixto",
      surveyId: "",
      total: item.total,
      effective: item.completed,
      partial: item.partial,
      refusals: item.refusals,
      states: [
        { label: "Efectivas", value: item.completed },
        { label: "Parciales", value: item.partial },
        { label: "Rechazos", value: item.refusals },
      ].filter((state) => state.value > 0),
    });
  });
  return out.sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es") || a.title.localeCompare(b.title, "es"));
}

function groupAcreditacionSurveyRows(rows: AcreditacionAdvanceSurveyRow[]) {
  const grouped = new Map<string, { actor: string; rows: AcreditacionAdvanceSurveyRow[]; effective: number; partial: number; refusals: number; total: number }>();
  rows.forEach((row) => {
    const actor = row.actor || "Sin actor";
    const key = normalizeSourceMatch(actor) || "sin-actor";
    const current = grouped.get(key) ?? { actor, rows: [], effective: 0, partial: 0, refusals: 0, total: 0 };
    current.rows.push(row);
    current.effective += row.effective;
    current.partial += row.partial;
    current.refusals += row.refusals;
    current.total += row.total;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).map((group) => ({
    ...group,
    rows: group.rows.sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "es")),
  })).sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es"));
}

function dailySeriesForSurvey(
  row: AcreditacionAdvanceSurveyRow,
  series: AcreditacionAdvanceDailySeries[],
) {
  const rowKeys = uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]);
  return series.find((item) => uniqueNormalizedKeys([item.sourceId, item.label]).some((key) => rowKeys.includes(key))) ?? null;
}

function AcreditacionAdvanceSurveyDailyChart({
  actor,
  row,
  daily,
  collectorSeries,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  actor: string;
  row: AcreditacionAdvanceSurveyRow;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const collectors = useMemo(
    () => [...collectorSeries].sort((a, b) => (
      b.total - a.total
      || acreditacionCollectorSeriesDisplayName(a).localeCompare(acreditacionCollectorSeriesDisplayName(b), "es")
    )),
    [collectorSeries],
  );
  const [selectedCollectorId, setSelectedCollectorId] = useState("total");
  const selectedCollector = selectedCollectorId === "total"
    ? null
    : collectors.find((item) => item.id === selectedCollectorId) ?? null;
  const fallbackCollector = !daily ? collectors[0] ?? null : null;
  const active = selectedCollector ?? daily ?? fallbackCollector;
  const selectValue = selectedCollector?.id ?? (daily ? "total" : fallbackCollector?.id ?? "total");

  useEffect(() => {
    if (selectedCollectorId === "total") return;
    if (!collectors.some((item) => item.id === selectedCollectorId)) setSelectedCollectorId("total");
  }, [collectors, selectedCollectorId]);

  if (!active) return null;
  const isCollector = Boolean(selectedCollector) || (!daily && Boolean(fallbackCollector));
  const datedDays = active.points.filter((point) => parseAcreditacionDailyDate(point.date)).length;
  const collectorTotal = collectors.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="mon-advance-survey-chart-stack">
      {collectors.length ? (
        <label className="mon-advance-collector-switch">
          <span>Recopilador</span>
          <select value={selectValue} onChange={(event) => setSelectedCollectorId(event.currentTarget.value)}>
            {daily ? <option value="total">Encuesta completa</option> : null}
            {collectors.map((item) => (
              <option key={item.id} value={item.id} title={item.collectorId ? `ID ${item.collectorId}` : undefined}>
                {acreditacionCollectorSeriesDisplayName(item)} · {fmt(item.total)}
              </option>
            ))}
          </select>
          <em>{fmt(collectors.length)} recopilador{collectors.length === 1 ? "" : "es"} · {fmt(collectorTotal)} respuestas</em>
        </label>
      ) : null}
      <AcreditacionAdvanceDailyMini
        title={isCollector ? `${acreditacionCollectorSeriesDisplayName(active)} · ${row.title}` : row.title}
        points={active.points}
        variant="source"
        cutDate={cutDate}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
      <div className="mon-advance-daily-foot">
        <span><strong>{actor}</strong> · {acreditacionChannelLabel(row.channel)}</span>
        <span><strong>{fmt(datedDays)}</strong> días con fecha</span>
      </div>
    </div>
  );
}

function AcreditacionAdvanceSurveyCard({
  row,
  max,
  daily,
  collectorSeries,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  row: AcreditacionAdvanceSurveyRow;
  max: number;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const width = row.total > 0 ? Math.max(3, Math.min(100, safePercentValue(row.total, max) ?? 0)) : 0;
  return (
    <article className="mon-advance-survey-card">
      <div className="mon-advance-survey-main">
        <header>
          <AcreditacionChannelBadge channel={row.channel} />
          <strong>{row.title}</strong>
          <span>{acreditacionChannelLabel(row.channel)}{row.surveyId ? ` · ${row.surveyId}` : ""}</span>
        </header>
        <div className="mon-advance-survey-meter" aria-label={`Respuestas de ${row.title}`}>
          <strong>{fmt(row.total)}</strong>
          <span>respuestas</span>
          <i style={{ "--advance-survey-total": `${width}%` } as CSSProperties} />
        </div>
        <div className="mon-advance-survey-states">
          {(row.states.length ? row.states : [
            { label: "Efectivas", value: row.effective },
            { label: "Parciales", value: row.partial },
            { label: "Rechazos", value: row.refusals },
          ]).slice(0, 4).map((state) => (
            <span key={`${row.id}-${state.label}`} className={`is-${acreditacionSurveyStateTone(state.label)}`}>
              <em>{state.label}</em>
              <strong>{fmt(state.value)}</strong>
            </span>
          ))}
        </div>
      </div>
      <AcreditacionAdvanceSurveyDailyChart
        actor={row.actor}
        row={row}
        daily={daily}
        collectorSeries={collectorSeries}
        cutDate={cutDate}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
    </article>
  );
}

function AcreditacionAdvancePhoneKoboCard({
  row,
  max,
  daily,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  row: AcreditacionAdvanceSurveyRow;
  max: number;
  daily: AcreditacionAdvanceDailySeries | null;
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const effective = Math.max(row.effective, daily?.completed ?? 0);
  const responses = Math.max(row.total, daily?.total ?? effective);
  const width = responses > 0 ? Math.max(3, Math.min(100, safePercentValue(responses, max) ?? 0)) : 0;
  return (
    <article className="mon-advance-survey-card mon-advance-survey-card--phone">
      <div className="mon-advance-survey-main">
        <header>
          <AcreditacionChannelBadge channel="Kobo" />
          <strong>{row.title}</strong>
          <span>{row.surveyId || row.sourceId ? `Encuesta ${row.surveyId || row.sourceId}` : "Encuesta Kobo vinculada"}</span>
        </header>
        <div className="mon-advance-survey-meter" aria-label={`Efectivas Kobo de ${row.title}`}>
          <strong>{fmt(effective)}</strong>
          <span>efectivas Kobo</span>
          <i style={{ "--advance-survey-total": `${width}%` } as CSSProperties} />
        </div>
        <div className="mon-advance-phone-kobo-facts">
          <span className="is-effective"><em>Pasan filtro</em><strong>{fmt(effective)}</strong></span>
          <span><em>Respuestas Kobo</em><strong>{fmt(responses)}</strong></span>
        </div>
      </div>
      <div className="mon-advance-survey-chart-stack">
        {daily ? (
          <AcreditacionAdvanceDailyMini
            title={`Efectivas por día · ${row.title}`}
            points={daily.points}
            variant="source"
            cutDate={cutDate}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly
          />
        ) : (
          <div className="mon-phone-kobo-no-chart">
            <CalendarRange size={16} />
            <strong>Sin fecha por encuesta</strong>
            <span>El corte trae efectivas Kobo, pero no una serie diaria para esta fuente.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function AcreditacionAdvancePhoneKoboWorkbench({
  reports,
  state,
  rows,
  sourceDailySeries,
  reportCuts,
  reportWeekday,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  rows: AcreditacionAdvanceSurveyRow[];
  sourceDailySeries: AcreditacionAdvanceDailySeries[];
  reportCuts: AcreditacionDailyReportCut[];
  reportWeekday: MonitoreoReportWeekday | "";
}) {
  const koboKeys = new Set((state?.sources ?? [])
    .filter(isKoboResponseSource)
    .flatMap((source) => uniqueNormalizedKeys([source.id, source.survey_id, source.label, source.survey_title, source.dimensions?.survey_title])));
  const koboRows = koboKeys.size
    ? rows.filter((row) => uniqueNormalizedKeys([row.sourceId, row.surveyId, row.title]).some((key) => koboKeys.has(key)))
    : rows;
  const comparisonRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  const comparison = phonePlatformComparisonTotals(comparisonRows);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
  const quotaRows = phoneQuotaRowsForPanel(rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]));
  const filter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const filterConfigured = Boolean(filter.enabled && filter.variable && filter.values.length);
  const totalEffective = comparison.platformComplete || koboRows.reduce((sum, row) => sum + Math.max(row.effective, dailySeriesForSurvey(row, sourceDailySeries)?.completed ?? 0), 0);
  const totalResponses = koboRows.reduce((sum, row) => sum + Math.max(row.total, dailySeriesForSurvey(row, sourceDailySeries)?.total ?? 0), 0) || totalEffective;
  const max = Math.max(1, totalResponses, ...koboRows.map((row) => row.total), ...sourceDailySeries.map((series) => series.total));
  const statusTotal = Math.max(1, statusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0));
  const statusItems = statusRows.map((row, index) => ({
    key: `${phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`)}-${index}`,
    label: phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`),
    value: phoneRowNumber(row, ["Casos", "Valor", "Total"], 0),
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const quotaVariable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const quotaPreview = (quotaVariable ? quotaRows.filter((row) => row.variable === quotaVariable) : quotaRows)
    .slice(0, 5);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-advance-surveys mon-advance-phone-kobo"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Avance telefónico por Kobo"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><ListChecks size={16} /> Kobo efectivo</span></h2>
          <p className="pulso-panel-hint">Kobo manda el avance; el barrido telefónico se lee en paralelo como estado de consulta.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(koboRows.length)} encuesta{koboRows.length === 1 ? "" : "s"} Kobo</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--surveys">
        <div className="mon-advance-hero-copy">
          <span>Fuente rectora</span>
          <strong>{fmt(totalEffective)} efectivas Kobo</strong>
          <p>Cuenta solo respuestas completas que pasan el filtro configurado. La alineación con llamadas se verifica por CodPulso, no por suma agregada.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Kobo" value={fmt(totalEffective)} hint={filterConfigured ? "filtro aplicado" : "filtro pendiente"} tone={filterConfigured ? "ready" : "warning"} />
          <AcreditacionAdvanceMetric label="Barrido efectivo" value={fmt(comparison.phoneEffective)} hint="declarado en base" tone="base" />
          <AcreditacionAdvanceMetric label="CodPulso" value={phoneCodPulsoEffectiveMatchLabel(comparison)} hint={phoneCodPulsoDifferenceHint(comparison)} tone={comparison.mismatch ? "warning" : "ready"} />
          <AcreditacionAdvanceMetric label="Cuotas" value={quotaRows.length ? fmt(quotaRows.length) : "S/D"} hint={quotaVariable || "sin variable"} tone={quotaRows.length ? "target" : "base"} />
        </div>
      </div>
      <div className="mon-phone-kobo-parallel">
        <section className="mon-phone-kobo-status-panel" aria-label="Estados telefónicos paralelos">
          <header>
            <span>Estados telefónicos</span>
            <strong>Barrido como consulta</strong>
            <em>Estos estados explican operación; no reemplazan la efectiva Kobo.</em>
          </header>
          <div>
            {statusItems.length ? statusItems.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <i style={{ "--phone-status-pct": `${Math.max(2, Math.min(100, safePercentValue(item.value, statusTotal) ?? 0))}%` } as CSSProperties} />
                <strong>{fmt(item.value)}</strong>
              </span>
            )) : (
              <em>Sin distribución de estados telefónicos en el corte.</em>
            )}
          </div>
        </section>
        <section className="mon-phone-kobo-status-panel mon-phone-kobo-status-panel--quota" aria-label="Cuotas telefónicas">
          <header>
            <span>Cuotas</span>
            <strong>{quotaVariable || "Variable pendiente"}</strong>
            <em>Meta visual para saber cuánto falta cumplir por categoría.</em>
          </header>
          <div>
            {quotaPreview.length ? quotaPreview.map((row) => {
              const pctValue = row.advancePct ?? safePercentValue(row.effective, row.meta ?? row.universe) ?? 0;
              return (
                <span key={row.key}>
                  <small>{row.value}</small>
                  <i style={{ "--phone-status-pct": `${Math.max(2, Math.min(100, pctValue))}%` } as CSSProperties} />
                  <strong>{row.gap == null ? fmt(row.effective) : `${fmt(row.gap)} faltan`}</strong>
                </span>
              );
            }) : (
              <em>Sin cuotas por variable en el corte.</em>
            )}
          </div>
        </section>
      </div>
      <div className="mon-advance-survey-actor-stack">
        {koboRows.length ? (
          <article className="mon-advance-survey-actor-card mon-advance-survey-actor-card--phone">
            <header className="mon-advance-survey-actor-head">
              <div>
                <span>Instrumentos Kobo</span>
                <strong>Efectivas filtradas</strong>
                <em>{fmt(totalResponses)} respuestas Kobo leídas · {filterConfigured ? `${filter.variable} = ${filter.values[0]}` : "elige filtro de consentimiento"}</em>
              </div>
              <div className="mon-advance-survey-actor-kpis mon-advance-survey-actor-kpis--phone">
                <span className="is-effective"><em>Efectivas</em><strong>{fmt(totalEffective)}</strong></span>
                <span><em>Encuestas</em><strong>{fmt(koboRows.length)}</strong></span>
              </div>
            </header>
            <div className="mon-advance-survey-actor-sources">
              {koboRows.map((row) => (
                <AcreditacionAdvancePhoneKoboCard
                  key={row.id}
                  row={row}
                  max={max}
                  daily={dailySeriesForSurvey(row, sourceDailySeries)}
                  cutDate={reports.generated_at}
                  reportCuts={reportCuts}
                  reportWeekday={reportWeekday}
                />
              ))}
            </div>
          </article>
        ) : (
          <EmptyPanel title="Sin encuesta Kobo activa" detail="Selecciona la encuesta Kobo en Fuentes para que el avance tenga una fuente rectora." />
        )}
      </div>
    </section>
  );
}

function AcreditacionAdvanceSurveysWorkbench({
  reports,
  state,
  sourceRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  sourceRows: Array<Record<string, unknown>>;
}) {
  const sourceDailySeries = useMemo(() => {
    const fromReport = buildAcreditacionAdvanceDailySourceSeries(reports);
    const fallbackRows = [
      ...((reports.client_report?.sources ?? []) as Array<Record<string, unknown>>),
      ...rowsFromSheets(reports.sheets, ["fuente"]),
    ];
    return fromReport.length
      ? fromReport
      : buildAcreditacionDailySourceSeriesFromRows(fallbackRows);
  }, [reports]);
  const collectorDailySeries = useMemo(() => {
    const fromReport = buildAcreditacionAdvanceDailyCollectorSeries(reports);
    const fallbackRows = [
      ...((reports.client_report?.collector_sources ?? []) as Array<Record<string, unknown>>),
      ...rowsFromSheets(reports.sheets, ["recopilador", "collector"]),
    ];
    const fromRows = buildAcreditacionDailyCollectorSeriesFromRows(fallbackRows);
    const fromCases = buildAcreditacionDailyCollectorSeriesFromInternalQueries(reports);
    const rawSeries = fromReport.length
      ? fromReport
      : fromRows.length
        ? fromRows
        : fromCases;
    return applyAcreditacionCollectorDisplayNames(
      rawSeries,
      state?.sources ?? [],
      state?.config?.operational_model?.link_collectors ?? [],
    );
  }, [reports, state?.config?.operational_model?.link_collectors, state?.sources]);
  const rows = useMemo(() => mergeAcreditacionSurveyRowsWithDailySeries(
    buildAcreditacionSurveyRows(sourceRows, state?.sources ?? []),
    sourceDailySeries,
  ), [sourceRows, state?.sources, sourceDailySeries]);
  const groups = useMemo(() => groupAcreditacionSurveyRows(rows), [rows]);
  const collectorsBySource = useMemo(() => groupAcreditacionCollectorsBySource(collectorDailySeries), [collectorDailySeries]);
  const max = Math.max(1, ...rows.map((row) => row.total), ...sourceDailySeries.map((series) => series.total));
  const channelCount = uniqueDisplayValues(rows.map((row) => acreditacionChannelLabel(row.channel))).length;
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const totalResponses = rows.reduce((sum, row) => sum + row.total, 0);
  const totalPartial = rows.reduce((sum, row) => sum + row.partial, 0);
  const totalRefusals = rows.reduce((sum, row) => sum + row.refusals, 0);
  const totalCollectors = collectorDailySeries.length;
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  if (isTelefonicoMonitoreoState(state)) {
    return (
      <AcreditacionAdvancePhoneKoboWorkbench
        reports={reports}
        state={state}
        rows={rows}
        sourceDailySeries={sourceDailySeries}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
    );
  }
  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-advance-surveys"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Avance canónico por encuesta y canal"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><ListChecks size={16} /> Encuestas, canales y recopiladores</span></h2>
          <p className="pulso-panel-hint">Fuentes exactas integradas por actor, canal y ritmo diario de respuesta.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(rows.length)} fuentes</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--surveys">
        <div className="mon-advance-hero-copy">
          <span>Fuentes y canales</span>
          <strong>{fmt(totalEffective)} efectivas de {fmt(totalResponses)} respuestas</strong>
          <p>Integra la producción por encuesta, canal y recopilador para distinguir qué plataforma sostiene el avance de cada actor.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Fuentes" value={fmt(rows.length)} hint={`${fmt(channelCount)} canales · ${fmt(groups.length)} actores`} tone="base" />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totalEffective)} hint={`${fmt(totalPartial)} parciales`} tone="ready" />
          <AcreditacionAdvanceMetric label="Rechazos" value={fmt(totalRefusals)} hint={totalCollectors ? `${fmt(totalCollectors)} recopiladores` : "sin serie por recopilador"} tone={totalRefusals ? "warning" : "base"} />
          <AcreditacionAdvanceMetric label="Recopiladores" value={fmt(totalCollectors)} hint={totalCollectors ? "selección diaria disponible" : `${fmt(totalResponses)} respuestas`} tone={totalCollectors ? "ready" : "target"} />
        </div>
      </div>
      {groups.length ? (
        <div className="mon-advance-survey-actor-stack">
          {groups.map((group) => (
            <article key={normalizeSourceMatch(group.actor)} className="mon-advance-survey-actor-card">
              <header className="mon-advance-survey-actor-head">
                <div>
                  <span>Actor</span>
                  <strong>{group.actor}</strong>
                  <em>{fmt(group.rows.length)} fuentes exactas · {fmt(group.total)} respuestas</em>
                </div>
                <div className="mon-advance-survey-actor-kpis">
                  <span className="is-effective"><em>Efectivas</em><strong>{fmt(group.effective)}</strong></span>
                  <span className="is-partial"><em>Parciales</em><strong>{fmt(group.partial)}</strong></span>
                  <span className="is-refusals"><em>Rechazos</em><strong>{fmt(group.refusals)}</strong></span>
                </div>
              </header>
              <div className="mon-advance-survey-actor-sources">
                {group.rows.map((row) => {
                  const daily = dailySeriesForSurvey(row, sourceDailySeries);
                  const collectorSeries = acreditacionCollectorsForSurvey(row, collectorsBySource);
                  return (
                    <AcreditacionAdvanceSurveyCard
                      key={row.id}
                      row={row}
                      max={max}
                      daily={daily}
                      collectorSeries={collectorSeries}
                      cutDate={reports.generated_at}
                      reportCuts={reportCuts}
                      reportWeekday={reportWeekday}
                    />
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanel title="Sin respuestas de fuentes" detail="Sincroniza las fuentes de plataforma o barrido para ver este desglose por canal." />
      )}
    </section>
  );
}

function AcreditacionAdvanceFocus({ cards, scopeLabel = "Actor" }: { cards: AcreditacionAdvanceCard[]; scopeLabel?: string }) {
  const ranked = [...cards].sort((a, b) => (b.missing ?? -1) - (a.missing ?? -1) || b.universe - a.universe).slice(0, 5);
  const totals = advanceTotals(cards);
  const isPhoneQuotaScope = scopeLabel !== "Actor";
  return (
    <section className="mon-advance-focus" aria-label={`${scopeLabel}s y ${isPhoneQuotaScope ? "pendientes" : "brechas"}`}>
      <header>
        <span>{scopeLabel}</span>
        <strong>
          {totals.brechas
            ? `${fmt(totals.brechas)} ${isPhoneQuotaScope ? "con pendiente" : "con brecha"}`
            : `${fmt(totals.metas)} metas cubiertas`}
        </strong>
      </header>
      <div>
        {ranked.length ? ranked.map((card) => {
          const progress = card.progress ?? card.coverage ?? 0;
          const metaLabel = card.meta == null
            ? "Meta pendiente"
            : card.missing && card.missing > 0
              ? `${fmt(card.missing)} faltan de ${fmt(card.meta)}`
              : `Meta ${fmt(card.meta)} cubierta`;
          return (
            <article key={card.id} className={`is-${card.statusTone}`}>
              <div>
                <strong>{card.actor}</strong>
                <span>{fmt(card.effective)} efectivas · {fmt(card.universe)} universo</span>
              </div>
              <em>{metaLabel}</em>
              <i style={{ "--advance-focus-pct": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties} />
            </article>
          );
        }) : (
          <EmptyPanel title={`Sin ${scopeLabel.toLowerCase()}s`} detail={`No hay cortes por ${scopeLabel.toLowerCase()} para priorizar ${isPhoneQuotaScope ? "pendientes" : "brechas"}.`} />
        )}
      </div>
    </section>
  );
}

function controlVariableRows(
  reports: MonitoreoAcreditacionReports | null | undefined,
  fallbackRows: Array<Record<string, unknown>> = [],
): AcreditacionControlVariableRow[] {
  const block = reportBlockForSheet(reports, "reporte", "detalle_variables_control")
    ?? reportBlockForSheet(reports, "cliente_variables_control", "variables_control");
  const sourceRows = block?.rows.length ? block.rows : fallbackRows;
  const rows = sourceRows.map((row) => {
    const record = row as Record<string, unknown>;
    const actor = rowText(record, ["actor", "unidad", "corte", "carrera"], "").trim();
    const variable = rowText(record, ["variable", "variable control", "variable_control", "control", "segmento"], "").trim();
    const value = rowText(record, ["valor", "categoria", "categoría", "nivel", "segmento", "grupo"], "").trim();
    const universe = rowNumber(record, ["universo", "base reportada", "base", "total"], 0);
    const effective = rowNumber(record, ["efectivas", "validas", "válidas", "completas"], 0);
    const partial = rowNumber(record, ["parciales", "partial"], 0);
    const refusals = rowNumber(record, ["rechazos plataforma", "rechazos", "rechazo"], 0);
    const unanswered = rowNumber(record, ["sin respuesta plataforma", "sin respuesta", "pendientes"], Math.max(0, universe - effective - partial - refusals));
    return {
      actor,
      variable,
      value,
      universe,
      effective,
      partial,
      refusals,
      unanswered,
      baseShare: null,
      effectiveShare: null,
      deltaPp: null,
    };
  }).filter((row) => row.actor && row.variable && row.value && row.universe > 0);

  const totals = new Map<string, { universe: number; effective: number }>();
  rows.forEach((row) => {
    const key = `${normalizeReportMatch(row.actor)}::${normalizeReportMatch(row.variable)}`;
    const current = totals.get(key) ?? { universe: 0, effective: 0 };
    current.universe += row.universe;
    current.effective += row.effective;
    totals.set(key, current);
  });

  return rows.map((row) => {
    const totalsForVariable = totals.get(`${normalizeReportMatch(row.actor)}::${normalizeReportMatch(row.variable)}`);
    const baseShare = totalsForVariable && totalsForVariable.universe > 0 ? (row.universe / totalsForVariable.universe) * 100 : null;
    const effectiveShare = totalsForVariable && totalsForVariable.effective > 0 ? (row.effective / totalsForVariable.effective) * 100 : null;
    const deltaPp = baseShare != null && effectiveShare != null ? effectiveShare - baseShare : null;
    return { ...row, baseShare, effectiveShare, deltaPp };
  }).sort((a, b) => a.actor.localeCompare(b.actor, "es") || a.variable.localeCompare(b.variable, "es") || a.value.localeCompare(b.value, "es", { numeric: true }));
}

function groupControlVariableRows(rows: AcreditacionControlVariableRow[]) {
  const actorMap = new Map<string, Map<string, AcreditacionControlVariableRow[]>>();
  rows.forEach((row) => {
    const variables = actorMap.get(row.actor) ?? new Map<string, AcreditacionControlVariableRow[]>();
    const values = variables.get(row.variable) ?? [];
    values.push(row);
    variables.set(row.variable, values);
    actorMap.set(row.actor, variables);
  });
  return Array.from(actorMap.entries()).map(([actor, variables]) => ({
    actor,
    variables: Array.from(variables.entries()).map(([variable, variableRows]) => ({
      variable,
      rows: variableRows.sort((a, b) => b.universe - a.universe || a.value.localeCompare(b.value, "es", { numeric: true })),
    })),
  }));
}

function AcreditacionControlVariablesPanel({
  reports,
  fallbackRows,
}: {
  reports: MonitoreoAcreditacionReports | null | undefined;
  fallbackRows?: Array<Record<string, unknown>>;
}) {
  const rows = controlVariableRows(reports, fallbackRows);
  const groups = groupControlVariableRows(rows);
  const totalVariables = groups.reduce((sum, group) => sum + group.variables.length, 0);
  if (!rows.length) {
    return (
      <section className="pulso-panel mon-control-detail-panel" aria-label="Variables de control">
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Variables de control</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><SlidersHorizontal size={16} /> Distribución del corte</span></h2>
          </div>
        </header>
        <div className="mon-control-detail-brief">
          <div>
            <span>Lectura de representatividad</span>
            <strong>Sin variables de control detectadas</strong>
            <p>Cuando el corte incluya variables como año de egreso, dedicación o área, aparecerá la comparación entre universo y corte efectivo.</p>
          </div>
          <div className="mon-control-detail-legend" aria-label="Leyenda de variables de control">
            <span className="is-base">Universo</span>
            <span className="is-effective">Corte efectivo</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pulso-panel mon-control-detail-panel" aria-label="Variables de control">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Variables de control</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><SlidersHorizontal size={16} /> Universo vs corte efectivo</span></h2>
        </div>
        <div className="pulso-panel-actions mon-control-detail-meta">
          <span>{groups.length} actores</span>
          <span>{totalVariables} variables</span>
        </div>
      </header>
      <div className="mon-control-detail-brief">
        <div>
          <span>Lectura de representatividad</span>
          <strong>Proporción esperada frente a proporción lograda</strong>
          <p>Compara cuánto pesa cada categoría dentro del universo y cuánto pesa dentro de las efectivas del corte. No mide cobertura de la categoría, mide similitud de composición.</p>
        </div>
        <div className="mon-control-detail-legend" aria-label="Leyenda de variables de control">
          <span className="is-base">Universo</span>
          <span className="is-effective">Corte efectivo</span>
          <span className="is-partial">Parciales</span>
          <span className="is-refusals">Rechazos</span>
        </div>
      </div>
      <div className="mon-control-detail-grid">
        {groups.map((group) => (
          <section key={group.actor} className="mon-control-actor-card">
            <header>
              <div>
                <span>Actor</span>
                <strong>{group.actor}</strong>
              </div>
              <em>{group.variables.length} variable{group.variables.length === 1 ? "" : "s"}</em>
            </header>
            {group.variables.map((variable) => (
              <article key={`${group.actor}-${variable.variable}`} className="mon-control-variable-card">
                <header>
                  <div>
                    <span>Variable de control</span>
                    <strong>{variable.variable}</strong>
                  </div>
                  <em>{formatMetric(variable.rows.reduce((sum, row) => sum + row.universe, 0))} universo</em>
                </header>
                <div className="mon-control-variable-rows">
                  {variable.rows.map((row) => (
                    <AcreditacionControlVariableComparisonRow key={`${group.actor}-${variable.variable}-${row.value}`} row={row} />
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function AcreditacionControlVariableComparisonRow({ row }: { row: AcreditacionControlVariableRow }) {
  const basePct = row.baseShare;
  const effectivePct = row.effectiveShare;
  const delta = row.deltaPp;
  const tone = delta == null || Math.abs(delta) <= 4 ? "steady" : delta > 0 ? "over" : "under";
  return (
    <div className={`mon-control-variable-row is-${tone}`}>
      <div className="mon-control-variable-label">
        <strong>{row.value}</strong>
        <span>{formatMetric(row.effective)} efectivas · {formatMetric(row.universe)} en universo</span>
      </div>
      <div className="mon-control-variable-bars" aria-label={`${row.value}: ${formatPercentLabel(basePct)} del universo y ${formatPercentLabel(effectivePct)} del corte efectivo`}>
        <span className="is-base">
          <em>Universo</em>
          <i style={{ "--control-pct": `${Math.max(1, Math.min(100, basePct ?? 0))}%` } as CSSProperties} />
          <strong>{formatPercentLabel(basePct)}</strong>
        </span>
        <span className="is-effective">
          <em>Corte</em>
          <i style={{ "--control-pct": `${Math.max(1, Math.min(100, effectivePct ?? 0))}%` } as CSSProperties} />
          <strong>{formatPercentLabel(effectivePct)}</strong>
        </span>
      </div>
      <div className="mon-control-variable-kpis">
        <span className="is-partial"><em>Parciales</em><strong>{formatMetric(row.partial)}</strong></span>
        <span className="is-refusals"><em>Rechazos</em><strong>{formatMetric(row.refusals)}</strong></span>
        <span className={`is-delta is-${tone}`}><em>Desvío</em><strong>{formatSignedPp(delta)}</strong></span>
      </div>
    </div>
  );
}

function clientReportSheetsForPanel(client: MonitoreoAcreditacionReports["client_report"] | null | undefined) {
  if (!client) return [];
  const mainBlocks: MonitoreoReportBlock[] = [];
  if (client.actors?.length) {
    mainBlocks.push({
      id: "resumen_actor",
      title: "Resumen por actor",
      columns: compactColumns(client.actors as Array<Record<string, unknown>>, ["Actor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "Sin respuesta", "Avance universo", "Meta", "Brecha meta"]),
      rows: client.actors,
    });
  }
  if (client.daily_general?.length) {
    mainBlocks.push({
      id: "avance_diario",
      title: "Avance diario general",
      columns: compactColumns(client.daily_general as Array<Record<string, unknown>>, ["Fecha", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Acumulado"]),
      rows: client.daily_general,
    });
  }
  if (client.controls?.length) {
    mainBlocks.push({
      id: "variables_control",
      title: "Distribución por variable de control",
      columns: compactColumns(client.controls as Array<Record<string, unknown>>, ["Actor", "Variable", "Valor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "% base", "% efectivas", "Diferencia pp"]),
      rows: client.controls,
    });
  }
  const out: MonitoreoReportSheet[] = [];
  if (mainBlocks.length) {
    out.push({
      id: "reporte",
      title: "Reporte",
      description: "Integra avance por actor, cortes diarios, distribución y brechas de respuesta desde el client_report del corte.",
      scope: "cliente",
      blocks: mainBlocks,
    });
  }
  if (client.sources?.length) {
    out.push({
      id: "avance_encuesta",
      title: "Encuestas",
      description: "Producción de respuestas por fuente y canal para revisar qué plataformas aportan al avance.",
      scope: "cliente",
      blocks: [{
        id: "fuentes_actor",
        title: "Fuentes por actor",
        columns: compactColumns(client.sources as Array<Record<string, unknown>>, ["Actor", "Canal", "Fuente", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Primer día", "Última respuesta"]),
        rows: client.sources,
      }],
    });
  }
  return out;
}

function reportSheetsForPanel(reports: MonitoreoAcreditacionReports | null | undefined) {
  const sheets = reports?.sheets ?? [];
  const byId = new Map(sheets.map((sheet) => [normalizeReportMatch(sheet.id), sheet]));
  const report = byId.get("reporte");
  const summary = byId.get("resumen");
  const survey = byId.get("avance_encuesta");
  const reportBlocks = report?.blocks?.length ? report.blocks : summary?.blocks ?? [];
  const blocks = [...reportBlocks];
  const distribution = summary?.blocks.find((block) => normalizeReportMatch(block.id) === "distribucion_egresados");
  if (distribution && !blocks.some((block) => normalizeReportMatch(block.id) === normalizeReportMatch(distribution.id))) blocks.push(distribution);
  const mainReport: MonitoreoReportSheet | null = (report ?? summary) ? {
    ...(report ?? summary)!,
    id: "reporte",
    title: "Reporte",
    description: "Integra avance por actor, cortes diarios, distribución y brechas de respuesta en una sola lectura.",
    scope: "estudio",
    blocks,
  } : null;
  const panelSheets = [
    mainReport,
    survey ? {
      ...survey,
      title: "Encuestas",
      description: "Producción de respuestas por encuesta y canal para revisar qué plataformas aportan al avance.",
      scope: "estudio",
    } : null,
  ].filter((sheet): sheet is MonitoreoReportSheet => Boolean(sheet));
  return panelSheets.length ? panelSheets : clientReportSheetsForPanel(reports?.client_report);
}

function reportPanelSheetTitle(sheet: MonitoreoReportSheet) {
  if (normalizeReportMatch(sheet.id) === "reporte" || normalizeReportMatch(sheet.id) === "resumen") return "Reporte";
  if (normalizeReportMatch(sheet.id) === "avance_encuesta") return "Encuestas";
  return sheet.title.replace(/\binterno\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function reportPanelSheetDescription(sheet: MonitoreoReportSheet) {
  if (normalizeReportMatch(sheet.id) === "reporte" || normalizeReportMatch(sheet.id) === "resumen") {
    return "Integra avance por actor, cortes diarios, distribución y brechas de respuesta en una sola lectura.";
  }
  if (normalizeReportMatch(sheet.id) === "avance_encuesta") {
    return "Producción de respuestas por encuesta y canal para revisar qué plataformas aportan al avance.";
  }
  return sheet.description.replace(/\bProsecnur\b/gi, "").replace(/\binterno\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function reportPanelScopeLabel(scope: string) {
  if (scope === "cliente") return "Reporte";
  if (scope === "estudio") return "Corte del estudio";
  return "Corte operativo";
}

function reportColumnDisplayLabel(column: string) {
  const normalized = normalizeReportMatch(column);
  if (normalized === "actor") return "Actor";
  if (normalized === "actores") return "Actores";
  return columnLabel(column);
}

function reportSheetTone(id: string) {
  const key = normalizeReportMatch(id);
  if (key.includes("alert")) return "risk";
  if (key.includes("telefon")) return "phone";
  if (key.includes("encuesta")) return "survey";
  if (key.includes("reporte")) return "report";
  return "summary";
}

function reportBlockTone(blockId: string, sheetId: string) {
  const id = normalizeReportMatch(`${sheetId} ${blockId}`);
  if (id.includes("alert")) return "risk";
  if (id.includes("telefon") || id.includes("estatus") || id.includes("responsable")) return "phone";
  if (id.includes("encuesta")) return "survey";
  if (id.includes("dia") || id.includes("avance")) return "trend";
  return "summary";
}

function sheetTitleIcon(id: string) {
  const key = normalizeReportMatch(id);
  if (key.includes("alert")) return <ShieldAlert size={14} />;
  if (key.includes("telefon")) return <PhoneCall size={14} />;
  if (key.includes("reporte")) return <FileCheck2 size={14} />;
  if (key.includes("encuesta")) return <BarChart3 size={14} />;
  return <ClipboardCheck size={14} />;
}

function buildReportSheetStats(sheet: MonitoreoReportSheet) {
  const totalRows = sheet.blocks.reduce((sum, block) => sum + block.rows.length, 0);
  const mainMetric = sheet.blocks.map(reportBlockMetric).find((metric) => metric.tone !== "neutral") ?? reportBlockMetric(sheet.blocks[0]);
  return [
    { label: "Bloques", value: fmt(sheet.blocks.length) },
    { label: "Filas", value: fmt(totalRows) },
    { label: mainMetric.label, value: mainMetric.value },
  ];
}

function shortColumnLabel(column: string) {
  return column.replace(/^% del /i, "% ").replace(/^Avance /i, "").slice(0, 18);
}

function reportBlockMetric(block?: MonitoreoReportBlock) {
  if (!block || !block.rows.length) return { label: "Filas", value: "0", tone: "neutral" };
  const cols = reportBlockColumns(block);
  const pick = (candidates: string[]) => cols.find((column) => {
    const normalized = normalizeReportMatch(column);
    return candidates.some((candidate) => normalized.includes(candidate));
  });
  const pctCol = pick(["avance total", "avance minimo", "porcentaje", "del total", "universo", "efectivas"]);
  if (pctCol) {
    const values = block.rows.map((row) => reportPercentValue(row[pctCol], pctCol)).filter((value): value is number => value != null);
    if (values.length) {
      const value = values.reduce((sum, item) => sum + item, 0) / values.length;
      return { label: shortColumnLabel(pctCol), value: formatPercentLabel(value), tone: value >= 70 ? "good" : value > 0 ? "warn" : "neutral" };
    }
  }
  const numericCol = pick(["total", "casos", "respuestas", "completas", "efectivas", "alerta"]);
  if (numericCol) {
    const total = block.rows.reduce((sum, row) => sum + reportNumberValue(row[numericCol]), 0);
    return { label: shortColumnLabel(numericCol), value: fmt(total), tone: total > 0 ? "good" : "neutral" };
  }
  return { label: "Filas", value: fmt(block.rows.length), tone: "neutral" };
}

function formatReportCell(value: unknown, column: string) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const normalized = normalizeReportMatch(column);
    if (normalized.includes("avance") || String(column).includes("%") || normalized.includes("ratio")) {
      const pctValue = Math.abs(value) <= 10 ? value * 100 : value;
      return `${pctValue.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
    }
    return Number.isInteger(value) ? fmt(value) : value.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  }
  const text = String(value);
  if (normalizeReportMatch(column).includes("fecha")) return text;
  const normalized = normalizeReportMatch(text);
  if (normalized === "no barridos") return "Por barrer";
  if (normalized === "casos barridos") return "Barridos";
  return text;
}

function ReportTableCell({ value, column, rowContext = "" }: { value: unknown; column: string; rowContext?: string }) {
  const text = formatReportCell(value, column);
  const normalized = normalizeReportMatch(column);
  const percent = reportPercentValue(value, column);
  if (percent != null) {
    return (
      <span className="mon-report-cell mon-report-cell--percent" style={{ "--mon-report-pct": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}>
        <i />
        <span>{text}</span>
      </span>
    );
  }
  if (normalized.includes("nivel") || normalized.includes("estado") || normalized.includes("estatus") || normalized.includes("avance")) {
    return <span className={`mon-report-cell mon-report-cell--state is-${reportStateTone(`${text} ${rowContext}`)}`}>{text || "S/D"}</span>;
  }
  if (typeof value === "number") return <span className="mon-report-cell mon-report-cell--number">{text}</span>;
  return <span className="mon-report-cell">{text}</span>;
}

function GsReportBlockTable({ sheet, block }: { sheet: MonitoreoReportSheet; block: MonitoreoReportBlock }) {
  const columns = reportBlockColumns(block);
  const rows = block.rows.slice(0, 18);
  const metric = reportBlockMetric(block);
  const clipped = block.rows.length > rows.length;
  return (
    <section className={`mon-gs-report-block is-${reportBlockTone(block.id, sheet.id)}`}>
      <header>
        <div>
          <strong>{block.title}</strong>
          <small>{fmt(columns.length)} columnas · {fmt(block.rows.length)} filas</small>
        </div>
        <span className={`mon-gs-block-metric is-${metric.tone}`}>
          <em>{metric.label}</em>
          <strong>{metric.value}</strong>
        </span>
      </header>
      {rows.length ? (
        <div className="mon-gs-report-table-wrap">
          <table className="mon-gs-report-table">
            <thead>
              <tr>{columns.map((column) => <th key={`${block.id}-${column}`}>{reportColumnDisplayLabel(column)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const rowContext = `${sheet.id} ${block.id} ${Object.values(row).join(" ")}`;
                return (
                  <tr key={`${sheet.id}-${block.id}-${rowIndex}`}>
                    {columns.map((column) => (
                      <td key={`${sheet.id}-${block.id}-${rowIndex}-${column}`}>
                        <ReportTableCell value={row[column]} column={column} rowContext={rowContext} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mon-profile-muted">Sin filas.</p>
      )}
      {clipped && <span className="mon-gs-report-overflow">Mostrando 18 de {fmt(block.rows.length)} filas. Usa el scroll horizontal para revisar columnas.</span>}
      {block.note && <em>{block.note}</em>}
    </section>
  );
}

function AcreditacionGsReportsPanel({ reports }: { reports: MonitoreoAcreditacionReports | null | undefined }) {
  const sheets = useMemo(() => reportSheetsForPanel(reports), [reports]);
  const [activeId, setActiveId] = useState(sheets[0]?.id ?? "");
  const activeSheet = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0] ?? null;
  useEffect(() => {
    if (!sheets.length) return;
    if (!sheets.some((sheet) => sheet.id === activeId)) setActiveId(sheets[0].id);
  }, [activeId, sheets]);

  if (!reports || !activeSheet) {
    return (
      <section className="pulso-panel mon-gs-report-panel mon-gs-report-panel--avance" aria-label="Reporte de avance">
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Lectura del avance</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><ClipboardCheck size={16} /> Reporte</span></h2>
          </div>
        </header>
        <EmptyPanel title="Reporte sin bloques" detail="El corte todavía no trae las tablas de reporte para revisar detalle de avance." />
      </section>
    );
  }

  const totalRows = activeSheet.blocks.reduce((sum, block) => sum + block.rows.length, 0);
  const reportStats = buildReportSheetStats(activeSheet);
  const title = reportPanelSheetTitle(activeSheet);
  const description = reportPanelSheetDescription(activeSheet);
  return (
    <section className="pulso-panel mon-gs-report-panel mon-gs-report-panel--avance" aria-label="Reporte de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Lectura del avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><ClipboardCheck size={16} /> Reporte</span></h2>
        </div>
        <div className="pulso-panel-actions mon-gs-report-meta">
          <span>Corte del estudio</span>
          <span>{fmt(totalRows)} filas</span>
          <span>{formatDate(reports.generated_at)}</span>
        </div>
      </header>
      <div className={`mon-gs-report-brief is-${reportSheetTone(activeSheet.id)}`}>
        <div className="mon-gs-report-brief-main">
          <span className="mon-gs-report-chip">{sheetTitleIcon(activeSheet.id)} {reportPanelScopeLabel(activeSheet.scope)}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="mon-gs-report-brief-stats" aria-label="Indicadores del reporte">
          {reportStats.map((stat) => (
            <span key={stat.label}>
              <em>{stat.label}</em>
              <strong>{stat.value}</strong>
            </span>
          ))}
        </div>
      </div>
      <GlidingTabList activeKey={activeSheet.id} className="mon-gs-report-tabs" role="tablist" aria-label="Pestañas de reporte de acreditación">
        {sheets.map((sheet) => (
          <button
            key={sheet.id} id={`mon-gs-report-tab-${sheet.id}`}
            type="button" role="tab"
            data-gliding-key={sheet.id} aria-controls={`mon-gs-report-panel-${sheet.id}`}
            aria-selected={sheet.id === activeSheet.id}
            className={sheet.id === activeSheet.id ? "is-active" : ""}
            onClick={() => setActiveId(sheet.id)}
          >
            {sheetTitleIcon(sheet.id)}
            <span>{reportPanelSheetTitle(sheet)}</span>
          </button>
        ))}
      </GlidingTabList>
      <div className="mon-gs-report-body" data-report-sheet={activeSheet.id} role="tabpanel" id={`mon-gs-report-panel-${activeSheet.id}`} aria-labelledby={`mon-gs-report-tab-${activeSheet.id}`}>
        <p>{description}</p>
        <div className="mon-gs-report-blocks">
          {activeSheet.blocks.map((block) => (
            <GsReportBlockTable key={block.id} sheet={activeSheet} block={block} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AcreditacionAdvanceDetailWorkbench({
  reports,
  state,
  actorRows,
  controlRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  controlRows: Array<Record<string, unknown>>;
}) {
  const cards = useMemo(() => advanceCardsFromRows(actorRows, state?.config.goals ?? []), [actorRows, state?.config.goals]);
  const totals = advanceTotals(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  return (
    <section className="pulso-panel mon-advance-panel" aria-label="Detalle canónico de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><BarChart3 size={16} /> Reporte</span></h2>
          <p className="pulso-panel-hint">Variables de control, tablas de reporte y lectura de composición.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(state?.n_rows ?? totals.universe)} registros</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero">
        <div className="mon-advance-hero-copy">
          <span>Corte sincronizado</span>
          <strong>{fmt(totals.effective)} efectivas de {fmt(totals.universe)}</strong>
          <p>Revisa si el corte efectivo conserva la composición esperada del universo y abre las tablas publicables del reporte.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Variables" value={fmt(controlVariableRows(reports, controlRows).length)} hint="categorías de control" tone="target" />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${completionPct == null ? "S/D" : pct(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric label="Reporte" value={fmt(reportSheetsForPanel(reports).length)} hint="pestañas disponibles" />
        </div>
      </div>
      <div className="mon-advance-tabbody">
        <div className="mon-advance-detail-stack">
          <AcreditacionControlVariablesPanel reports={reports} fallbackRows={controlRows} />
          <AcreditacionGsReportsPanel reports={reports} />
        </div>
      </div>
    </section>
  );
}

function AcreditacionAdvanceSummaryWorkbench({
  reports,
  state,
  actorRows,
  dailyRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  dailyRows: Array<Record<string, unknown>>;
}) {
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaCards = useMemo(() => phoneQuotaCardsForDashboard(reports), [reports]);
  const cards = useMemo(() => (
    isPhoneModel && phoneQuotaCards.length
      ? phoneQuotaCards
      : advanceCardsFromRows(actorRows, state?.config.goals ?? [])
  ), [actorRows, isPhoneModel, phoneQuotaCards, state?.config.goals]);
  // El nombre del segmento lo declara el estudio, no la vista. Ver
  // `segmentoDeCuotas.ts`.
  const segmentoDeLasCuotas = useMemo(
    () => nombreDelSegmento(
      phoneQuotaRowsForPanel(
        rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]),
      ).map((row) => row.variable),
    ),
    [reports],
  );
  const scopeLabel = isPhoneModel && phoneQuotaCards.length ? segmentoDeLasCuotas : "Actor";
  const rawDailyPoints = useMemo(() => (
    isPhoneModel ? phoneKoboDailyPointsFromRows(dailyRows) : dailyPointsFromRows(dailyRows)
  ), [dailyRows, isPhoneModel]);
  const dailyPoints = useMemo(() => (
    isPhoneModel ? rawDailyPoints.filter(isDatedAcreditacionDailyPoint) : rawDailyPoints
  ), [isPhoneModel, rawDailyPoints]);
  const totals = advanceTotals(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const phoneComparisonRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
    : [];
  const phoneComparison = isPhoneModel ? phonePlatformComparisonTotals(phoneComparisonRows) : null;
  const phoneStatusRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"])
    : [];
  // La serie temporal del barrido. Cuando el corte no la trae —estudios sin
  // fecha de estado— se cae a la lista de totales, que es peor lectura pero es
  // la que hay: dejar el hueco vacío escondería estados que sí existen.
  const estadosPorDia = useMemo(
    () => (isPhoneModel
      ? buildAcreditacionPhoneDailyStatusSeries(
        rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_dia", "estados_dia", "estatus_telefonico_dia"]),
      )
      : []),
    [isPhoneModel, reports],
  );
  const declaracionesDeEstado = useMemo(
    () => acreditacionDeclaracionesDesdeReglas(state?.config?.operational_model?.state_rules ?? []),
    [state?.config?.operational_model?.state_rules],
  );
  const phoneStatusRawTotal = phoneStatusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0);
  const phoneStatusTotal = Math.max(1, phoneStatusRawTotal);
  const phoneStatusCount = (matches: (key: string) => boolean) => phoneStatusRows.reduce((sum, row) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], "");
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    return matches(normalizeSourceMatch(label)) ? sum + value : sum;
  }, 0);
  const phoneNoSweepTotal = isPhoneModel
    ? phoneStatusCount((key) => key.includes("no barrido") || key.includes("por barrer"))
    : 0;
  const phoneEffectiveStatusTotal = isPhoneModel
    ? phoneStatusCount((key) => key === "efectivo" || key === "efectiva" || key === "efectivos" || key === "efectivas")
    : 0;
  const phoneStatusItems = phoneStatusRows.map((row, index) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`);
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    return { key: `${normalizeSourceMatch(label)}-${index}`, label, value, tone: phoneStatusTone(label) };
  }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const phoneFilter = isPhoneModel ? normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter) : null;
  const phoneFilterConfigured = Boolean(phoneFilter?.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phoneDailySignalPoints = isPhoneModel
    ? mergeAcreditacionDailyPoints(sortAcreditacionDailyPoints(dailyPoints))
    : dailyPoints;
  const dailySignalDays = phoneDailySignalPoints.filter((point) => dailyEffectiveValue(point) > 0).length;
  const undatedPhoneEffective = isPhoneModel
    ? rawDailyPoints.filter((point) => !isDatedAcreditacionDailyPoint(point)).reduce((sum, point) => sum + dailyEffectiveValue(point), 0)
    : 0;

  if (isPhoneModel) {
	    const comparison = phoneComparison ?? {
	      phoneEffective: 0,
	      platformComplete: totals.effective,
	      matchedEffective: 0,
	      mismatch: 0,
	      phoneWithoutPlatform: 0,
	      platformWithoutPhone: 0,
	      withoutCode: 0,
	      total: 0,
    };
    const platformEffective = comparison.platformComplete || totals.effective;
    const phoneEffectiveTotal = comparison.phoneEffective || phoneEffectiveStatusTotal;
    const phoneSweptTotal = Math.max(0, phoneStatusTotal - phoneNoSweepTotal);
    const phoneStorageContext = {
      universe: phoneStatusTotal,
      platformEffective,
      phoneEffective: phoneEffectiveTotal,
      phoneSwept: phoneSweptTotal,
      phoneSweptWithoutEffective: Math.max(0, phoneSweptTotal - phoneEffectiveTotal),
      phonePending: phoneNoSweepTotal,
    };
    return (
      <section className="pulso-panel mon-advance-panel mon-phone-advance-summary" aria-label="Resumen de avance telefónico">
        <div className="mon-phone-advance-grid">
          <AcreditacionAdvanceDailyMini
            points={dailyPoints}
            title="Ritmo general Kobo"
            variant="general"
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly
          />
          <section className="mon-phone-advance-parallel" aria-label="Estados de plataforma y estados telefónicos en paralelo">
            <header>
              {/* Decía «La llamada explica operación; Kobo valida avance»: la
                * misma doctrina que ya está en el modelo, sobre un bloque que
                * enfrenta dos cifras. Lo que hace falta saber es cuánto se
                * separan, que es la única razón para mirarlo. */}
              <div>
                <span>Contexto telefónico</span>
                <strong>
                  {comparison.mismatch
                    ? `${fmt(Math.abs(comparison.phoneEffective - platformEffective))} de diferencia`
                    : "Kobo y barrido coinciden"}
                </strong>
              </div>
              <em>{fmt(dailySignalDays)} día{dailySignalDays === 1 ? "" : "s"} con efectivas{undatedPhoneEffective ? ` · ${fmt(undatedPhoneEffective)} sin fecha` : ""}</em>
            </header>
            <div className="mon-phone-advance-parallel-grid">
              <article>
                <span>Kobo efectivo</span>
                <strong>{fmt(platformEffective)} efectivas</strong>
                <p>{phoneFilterConfigured ? "Pasan filtro y cuentan para cuota." : "Pendiente definir filtro de efectiva."}</p>
                <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(platformEffective, totals.universe) ?? 0))}%` } as CSSProperties} />
              </article>
	              <article>
	                <span>Barrido telefónico</span>
	                <strong>{fmt(comparison.phoneEffective)} efectivas declaradas</strong>
	                <p>{phoneCodPulsoDifferenceSentence(comparison)}</p>
	                <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(comparison.phoneEffective, totals.universe) ?? 0))}%` } as CSSProperties} />
	              </article>
            </div>
            {/* La composición del barrido, en el tiempo y no como lista suelta.
              *
              * Aquí había la misma tabla de estados que ya pinta Llamadas ›
              * Resumen —Efectivo 72, No contesta 35, Apagado 16…— con los
              * mismos números y sin nada que Avance aporte. Duplicaba una
              * lectura y no respondía la pregunta de esta pantalla, que es
              * cómo se movió el campo día a día. */}
            {estadosPorDia.length ? (
              <GraficoDeEstadosPorDia series={estadosPorDia} declaraciones={declaracionesDeEstado} />
            ) : (
              <div className="mon-phone-advance-status-list" aria-label="Distribución de estados telefónicos">
                {phoneStatusItems.length ? phoneStatusItems.map((item) => (
                  <span key={item.key} className={`is-${item.tone}`}>
                    <em>{item.label}</em>
                    <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(item.value, phoneStatusTotal) ?? 0))}%` } as CSSProperties} />
                    <strong>{fmt(item.value)}</strong>
                  </span>
                )) : (
                  <span className="is-muted"><em>Sin estados telefónicos</em><strong>S/D</strong></span>
                )}
              </div>
            )}
          </section>
          {/* Sin el bloque de foco por cuota: era la tercera columna y decía lo
            * mismo que la pestaña Cuotas —cada cuota con su meta, sus efectivas
            * y lo que le falta— en versión recortada a cinco filas y sin la
            * base ni el ritmo. La pestaña de al lado lo cuenta entero; aquí solo
            * quitaba sitio a las dos lecturas que sí son de esta pantalla. */}
          <AcreditacionAdvanceStorage cards={cards} scopeLabel={scopeLabel} phoneContext={phoneStorageContext} />
        </div>
      </section>
    );
  }

  return (
    <section className="pulso-panel mon-advance-panel" aria-label="Resumen canónico de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><BarChart3 size={16} /> Reporte</span></h2>
          <p className="pulso-panel-hint">Corte cliente, universo, metas y ritmo diario.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(state?.n_rows ?? totals.universe)} registros</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero">
        <div className="mon-advance-hero-copy">
          <span>Corte sincronizado</span>
          <strong>{fmt(totals.effective)} efectivas de {fmt(totals.universe)}</strong>
          <p>Distingue universo, metas por {scopeLabel.toLowerCase()} y respuestas de plataforma para leer el avance sin mezclar fuentes.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label={`Metas ${scopeLabel.toLowerCase()}`} value={totals.metas ? `${fmt(totals.metas - totals.brechas)}/${fmt(totals.metas)}` : "S/M"} hint={totals.brechas ? `${fmt(totals.brechas)} con brecha` : "sin brecha"} tone={totals.brechas ? "target" : "ready"} />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${completionPct == null ? "S/D" : pct(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Por barrer" : "Pendientes"}
            value={fmt(totals.pending)}
            hint={isPhoneModel ? "estado telefónico pendiente" : `${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`}
            tone={totals.pending ? "warning" : "base"}
          />
        </div>
      </div>
      <div className="mon-advance-tabbody">
        <div className="mon-advance-summary-grid">
          <AcreditacionAdvanceDailyMini
            points={dailyPoints}
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly={isPhoneModel}
          />
          <AcreditacionAdvanceStorage cards={cards} scopeLabel={scopeLabel} />
          <AcreditacionAdvanceFocus cards={cards} scopeLabel={scopeLabel} />
        </div>
      </div>
    </section>
  );
}

function AcreditacionLoadingPanel({ view, label, phoneMode = false }: { view: MonitoreoSeccion; label: string; phoneMode?: boolean }) {
  // Decía «Actualizando cache local» con tres fichas de jerga («Cache local»,
  // «Corte reportes», «Vista Llamadas») ocupando la pantalla entera. Un estado
  // de carga se explica en una línea y no reserva media vista.
  return (
    <section className={`mon-acr-loading-card is-${view}`} aria-live="polite" aria-label={`Preparando ${label}`}>
      <div className="mon-acr-loading-card__copy">
        <span><Loader2 size={14} className="pulso-spin" /> Un momento</span>
        <strong>Preparando {label.toLowerCase()}</strong>
        <p>
          {view === "consultas"
            ? phoneMode
              ? "Cruzando las entrevistas con la base de llamadas."
              : "Cruzando respuestas con la base de cada actor."
            : "Leyendo los datos del último corte."}
        </p>
      </div>
      <div className="mon-acr-loading-card__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

/**
 * Corte canónico del perfil telefónico.
 *
 * El modelo exige tres fuentes —base, barrido y Kobo—. La auditoría encontró
 * Fuentes/Paquete declarando "2/3 · Falta Kobo · Sin sync" mientras Avance/Salidas
 * ofrecía PDFs con 9 efectivas: dos superficies leyendo distinto el mismo corte.
 * El conteo de fuentes viaja dentro del corte para que el gate lo vea.
 */
function corteTelefonicoDeReports(
  state: MonitoreoState | null | undefined,
  reports: MonitoreoAcreditacionReports | null | undefined,
) {
  const esTelefonico = isTelefonicoMonitoreoState(state ?? null);
  const fuentes = {
    fuentesActivas: activeSourceCount(state ?? null),
    fuentesRequeridas: esTelefonico
      ? PIEZAS_DEL_PAQUETE_TELEFONICO.length
      : (state?.sources?.length ?? null),
  };
  if (!reports) return corteAcreditacion(state, [], fuentes);
  const actorRows = reports.client_report?.actors?.length
    ? reports.client_report.actors
    : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const cards = advanceCardsFromRows(
    actorRows as Array<Record<string, unknown>>,
    state?.config?.goals ?? [],
  );
  return corteAcreditacion(state, cards, { ...fuentes, generatedAt: reports.generated_at });
}

function renderAcreditacionView(
  view: MonitoreoSeccion,
  reports: MonitoreoAcreditacionReports | null,
  options: {
    activeSourceTab?: AcreditacionSourceTab;
    activeModelTab?: AcreditacionModelTab;
    activeConsultaTab?: AcreditacionConsultaTab;
    activePhoneTab?: AcreditacionPhoneTab;
    activeAdvanceTab?: AcreditacionAdvanceTab;
    acreditacion?: MonitoreoAcreditacion | null;
    actionStatus?: AcreditacionActionStatus;
    caseReconciliationBusyId?: string;
    caseReconciliationStatus?: AcreditacionActionStatus;
    onSaveSeguimiento?: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
    onCerrar?: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
    onConsultaTabChange?: (tab: AcreditacionConsultaTab) => void;
    onCaseReconciliationDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
    state?: MonitoreoState | null;
    onStateChange?: (state: MonitoreoState) => void;
    onPublished?: () => void;
    onNavigateLocalTab?: (view: MonitoreoSeccion, tab: AcreditacionLocalTabKey) => void;
    routeLabel?: string;
    savingAcreditacion?: boolean;
    /** Las mismas cifras que pinta el chrome, para el vacío sin corte. */
    fuentesActivas?: number;
    fuentesRequeridas?: number;
  } = {},
) {
  if (view === "avance" && options.activeAdvanceTab === "salidas") {
    const outputState = options.state;
    const isPhoneOutputs = isTelefonicoMonitoreoState(outputState);
    return (
      <MonitoreoOutputsWorkbench
        family={isPhoneOutputs ? "telefonico" : "acreditacion"}
        routeLabel={isPhoneOutputs ? "Monitoreo telefónico" : options.routeLabel ?? "Acreditación"}
        defaultTitle={isPhoneOutputs ? "" : outputState?.config?.acreditacion?.estudio?.titulo || "reporte-monitoreo"}
        config={outputState?.config}
        clientSheets={outputState?.publication?.client_last_sheets ?? null}
        internalSheets={outputState?.publication?.internal_last_sheets ?? null}
        corte={corteTelefonicoDeReports(outputState, reports)}
        syncedAt={outputState?.synced_at ?? ""}
        onPublished={options.onPublished}
      />
    );
  }
  // Fuentes va ANTES del guardia del corte: es la sección que produce el corte.
  // Detrás del guardia, un estudio recién abierto veía «Resumen pendiente» en el
  // único sitio donde podía conectar sus tres fuentes. Ver `core/corteVacio`.
  if (view === "fuentes") {
    return (
      <AcreditacionSourcesWorkbench
        reports={reports ?? CORTE_VACIO}
        state={options.state}
        activeTab={options.activeSourceTab ?? pestanaDeFuentesInicial(isTelefonicoMonitoreoState(options.state))}
        onStateChange={options.onStateChange}
        onSourceTabChange={(tab) => options.onNavigateLocalTab?.("fuentes", tab)}
      />
    );
  }
  if (!reports) {
    return (
      <CorteAusente
        fuentesActivas={options.fuentesActivas ?? 0}
        fuentesRequeridas={options.fuentesRequeridas ?? 0}
        onIrAFuentes={() => options.onNavigateLocalTab?.("fuentes", "activas")}
      />
    );
  }
  const client = reports.client_report;
  if (view === "modelo") {
    return (
      <AcreditacionModelWorkbench
        acreditacion={options.acreditacion}
        reports={reports}
        state={options.state}
        activeTab={options.activeModelTab ?? "estructura"}
        saving={Boolean(options.savingAcreditacion)}
        actionStatus={options.actionStatus ?? null}
        onSaveSeguimiento={options.onSaveSeguimiento}
        onCerrar={options.onCerrar}
        onStateChange={options.onStateChange}
      />
    );
  }
  if (view === "consultas") {
    return (
      <AcreditacionConsultasPanel
        reports={reports}
        sources={options.state?.sources ?? []}
        state={options.state ?? null}
        profileMode={isTelefonicoMonitoreoState(options.state) ? "telefonico" : "acreditacion"}
        activeTab={options.activeConsultaTab ?? "plataforma"}
        onActiveTabChange={options.onConsultaTabChange}
        caseReconciliationBusyId={options.caseReconciliationBusyId}
        caseReconciliationStatus={options.caseReconciliationStatus}
        onCaseReconciliationDecision={options.onCaseReconciliationDecision}
      />
    );
  }
  if (view === "telefonico") {
    return renderPhoneView(
      reports,
      options.activePhoneTab ?? "resumen",
      num(options.state?.dashboard?.kpis?.valid, 0),
      isTelefonicoMonitoreoState(options.state),
      corteTelefonicoDeReports(options.state, reports),
      options.state?.config?.goals ?? [],
    );
  }
  const isPhoneModel = isTelefonicoMonitoreoState(options.state);
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const phoneDailyRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["avance_efectivo_dia", "produccion_dia"])
    : [];
  const clientDailyRows = client?.daily_general ?? [];
  const dailyRows = isPhoneModel
    ? (phoneDailyRows.length ? phoneDailyRows : clientDailyRows)
    : (clientDailyRows.length ? clientDailyRows : phoneDailyRows);
  const sheetActorDailyRows = rowsForSheetBlock(reports, "cliente_avance_actor", ["avance_actor_dia"]);
  const actorDailyRows = client?.daily_actor?.length
    ? client.daily_actor
    : sheetActorDailyRows.length
      ? sheetActorDailyRows
      : dailyRows;
  const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"]);
  const controlRows = client?.controls?.length ? client.controls : rowsFromSheets(reports.sheets, ["control", "segmento", "meta"]);
  if (view === "avance" && options.activeAdvanceTab === "actores") {
    return (
      <AcreditacionAdvanceActorsWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        sourceRows={sourceRows as Array<Record<string, unknown>>}
        dailyRows={actorDailyRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance" && !isPhoneModel && options.activeAdvanceTab === "encuestas") {
    return (
      <AcreditacionAdvanceSurveysWorkbench
        reports={reports}
        state={options.state}
        sourceRows={sourceRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance" && !isPhoneModel && options.activeAdvanceTab === "detalle") {
    return (
      <AcreditacionAdvanceDetailWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        controlRows={controlRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance") {
    return (
      <AcreditacionAdvanceSummaryWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        dailyRows={dailyRows as Array<Record<string, unknown>>}
      />
    );
  }
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Avance por actor</h3>
            <span>{fmt(actorRows.length)} filas</span>
          </div>
          <DataTable rows={actorRows as Array<Record<string, unknown>>} empty="No hay avance por actor preparado." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Ritmo diario</h3>
            <span>{fmt(dailyRows.length)} dias</span>
          </div>
          <DataTable rows={dailyRows as Array<Record<string, unknown>>} empty="No hay serie diaria preparada." />
        </section>
      </div>
    </div>
  );
}

function phoneContractReadyCount(contract: AcreditacionPhoneSourceContract) {
  return [contract.universe, contract.sweep, contract.platform].filter((slot) => slot.ready).length;
}

function activeSourceCount(state: MonitoreoState | null) {
  if (isTelefonicoMonitoreoState(state)) {
    return phoneContractReadyCount(buildAcreditacionPhoneSourceContract(state?.sources ?? []));
  }
  return (state?.sources ?? []).filter((source) => source.enabled).length;
}

type AcreditacionRailStatus = NonNullable<MonitoreoWorkbenchRailTab["estado"]>;

/**
 * Estado de una pestaña del rail. Ver la nota gemela en el perfil de
 * acreditación: `ready` significa evidencia completa, no "hay filas".
 */
function readyStatus(ready: boolean, risk = false): AcreditacionRailStatus {
  if (risk) return "bloqueado";
  return ready ? "listo" : "parcial";
}

function railTab(
  tab: typeof ACREDITACION_SOURCE_TABS[number]
    | typeof ACREDITACION_MODEL_TABS[number]
    | typeof ACREDITACION_CONSULTA_TABS[number]
    | typeof ACREDITACION_PHONE_TABS[number]
    | typeof ACREDITACION_ADVANCE_TABS[number],
  patch: Partial<Pick<MonitoreoWorkbenchRailTab, "label" | "detail" | "badge" | "estado">> = {},
): MonitoreoWorkbenchRailTab {
  return { ...tab, ...patch };
}

function acreditacionRailSourceStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const sources = (state?.sources ?? []).map((source) => acreditacionSourceWithOperationalMetadata(source, state?.source_metadata));
  const enabled = sources.filter((source) => source.enabled);
  const platform = sources.filter(isPlatformResponseSource);
  const sheets = sources.filter((source) => source.kind === "google_sheets");
  const collectors = state?.config?.operational_model.link_collectors ?? [];
  const reportSources = reports?.client_report?.sources?.length
    ? reports.client_report.sources
    : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"]);
  return {
    total: sources.length,
    enabled: enabled.length,
    platform: platform.length,
    platformEnabled: platform.filter((source) => source.enabled).length,
    sheets: sheets.length,
    sheetsEnabled: sheets.filter((source) => source.enabled).length,
    collectors: collectors.length,
    reportSources: reportSources.length,
  };
}

function acreditacionRailModelStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const client = reports?.client_report;
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"]);
  const phoneQuotaRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const quotaVariables = uniqueDisplayValues(phoneQuotaRows.map((row) => phoneRowValue(row, ["Variable"], ""))).length;
  const phases = state?.config?.strategy_phases ?? [];
  const scheduleDraft = acreditacionScheduleDraftFromPhases(phases);
  const goals = state?.config?.goals?.filter((goal) => Number(goal.meta) > 0).length ?? 0;
  return {
    actors: actorRows.length,
    goals,
    phases: phases.length,
    schedule: scheduleDraft.durationWeeks
      ? `${fmt(scheduleDraft.durationWeeks)} sem · ${calendarReportWeekdayLabel(scheduleDraft.reportWeekday)}`
      : phases.length
        ? countText(phases.length, "fase")
        : "sin cronograma",
    phoneQuotaRows: phoneQuotaRows.length,
    phoneQuotaVariables: quotaVariables,
  };
}

function acreditacionRailPhoneStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const contract = buildAcreditacionPhoneSourceContract(state?.sources ?? []);
  const summaryRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]) : [];
  const statusRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]) : [];
  const quotaRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const parsedQuotaRows = phoneQuotaRowsForPanel(quotaRows);
  const quotaVariable = preferredPhoneAdvanceQuotaVariable(parsedQuotaRows);
  const quotaCategoryRows = quotaVariable
    ? parsedQuotaRows.filter((row) => row.variable === quotaVariable)
    : parsedQuotaRows;
  const quotaCategoryNoun = phoneQuotaCategoryNoun(quotaVariable);
  const quotaEffective = quotaCategoryRows.reduce((sum, row) => sum + row.effective, 0);
  const quotaGap = quotaCategoryRows.reduce((sum, row) => sum + (row.gap ?? 0), 0);
  const responsibleRows = reports ? mergeAcreditacionPhoneResponsibleRows(
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["operacion_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["efectivos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["responsables_barrido"]),
  ) : [];
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const queryCases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const fallbackStatusRows = groupedCaseRows(queryCases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const fallbackResponsibleRows = groupedCaseRows(
    queryCases,
    (item) => internalQueryCollectorDisplayLabel(item) || item.collector_id || "Sin responsable",
    (value) => value,
  );
  const visibleStatusRows = statusRows.length ? statusRows : fallbackStatusRows;
  const visibleResponsibleRows = responsibleRows.length ? responsibleRows : fallbackResponsibleRows;
  const dailyRows = reports ? phoneDailyBlockForPanel(reports)?.rows ?? [] : [];
  const totals = phoneOperationTotals(summaryRows, visibleStatusRows, visibleResponsibleRows);
  const pendingRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]) : [];
  const insistenceRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["insistencia_no_contesta"]) : [];
  const detailRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["detalle_no_contesta"]) : [];
  const reattemptRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["reintentos_responsable"]) : [];
  const alertRows = reports ? rowsForSheetBlock(reports, "alertas", ["alertas"]) : [];
  const alertModel = buildAcreditacionPhoneRealAlertModel({ alertRows });
  const timeRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]) : [];
  const comparisonRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]) : [];
  const comparison = phonePlatformComparisonTotals(comparisonRows);
  const consultedCases = telefonicoConsultedEffectiveCasesFromSources(queryCases, comparisonRows);
  const consultedCaveatCases = consultedCases.filter(telefonicoCaseHasEffectiveCaveat);
  const phoneDailyBlock = reports ? phoneDailyBlockForPanel(reports) : null;
  const platformEffectiveFromDaily = normalizeSourceMatch(phoneDailyBlock?.id ?? "").includes("avance_efectivo")
    ? buildAcreditacionPhoneDailyPoints(phoneDailyBlock?.rows ?? []).reduce((sum, point) => sum + point.effective, 0)
    : 0;
  const platformEffective = comparison.platformComplete || platformEffectiveFromDaily || totals.effective;
  const phoneFilter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const phoneFilterConfigured = Boolean(phoneFilter.enabled && phoneFilter.variable && phoneFilter.values.length);
  const sourceReady = phoneContractReadyCount(contract);
  const timeModel = buildAcreditacionPhoneTimeControl({
    alerts: alertModel.alerts,
    totalEffective: platformEffective,
    rows: timeRows,
  });
  return {
    contract,
    sourceReady,
    koboSources: contract.platform.sources.filter((source) => source.enabled).length,
    sheetReady: [contract.universe, contract.sweep].filter((slot) => slot.ready).length,
    totals,
    dailyRows: dailyRows.length,
    quotaRows: quotaRows.length,
    quotaCategoryRows: quotaCategoryRows.length,
    quotaCategoryNoun,
    quotaVariable,
    quotaEffective,
    quotaGap,
    responsibleRows: visibleResponsibleRows.length,
    pendingRows: pendingRows.length + insistenceRows.length + detailRows.length + reattemptRows.length,
    alerts: alertModel.activeAlertCount,
    alertObservations: alertModel.activeAlerts.length,
    timeRows: timeRows.length,
    timeUnder2: timeModel.under2,
    timeUnder5: timeModel.under5,
    timeMissing: timeModel.missing,
    comparisonRows: comparisonRows.length,
    comparison,
    platformEffective,
    consultedCases: consultedCases.length,
    consultedCaveatCases: consultedCaveatCases.length,
    phoneFilterConfigured,
  };
}

function telefonicoConsultaCaveatCount(reports: MonitoreoAcreditacionReports | null) {
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const comparisonRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]) : [];
  return telefonicoConsultedEffectiveCasesFromSources(cases, comparisonRows)
    .filter(telefonicoCaseHasEffectiveCaveat)
    .length;
}

function acreditacionRailAdvanceStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const client = reports?.client_report;
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"]);
  const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"]);
  const controlRows = client?.controls?.length ? client.controls : rowsFromSheets(reports?.sheets ?? [], ["control", "segmento", "meta"]);
  const phone = acreditacionRailPhoneStats(state, reports);
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0), true);
  return {
    actors: actorRows.length,
    sources: sourceRows.length,
    controls: controlRows.length,
    summary,
    phone,
  };
}

// Gemelo deliberado de `localTabsForAcreditacionView`
// (profiles/acreditacion/AcreditacionMonitoreoPage.tsx): telefónico es un fork
// vivo, no una copia pendiente de unificar. Sus ramas `isPhoneRoute` divergen a
// propósito y NO deben re-fusionarse en un catálogo parametrizado:
//   · modelo    → sin «Resumen/Lectura» (telefónico no lee Fuentes desde Modelo)
//   · consultas → rama propia: Efectivas Kobo + CodPulso, y «Salvedades» solo
//                 cuando hay casos con salvedad (acreditación no tiene rama phone)
//   · telefónico→ Resumen operativo, Tiempos, Incidencia, Responsables, Alertas
//                 (acreditación usa Día y Supervisión, que aquí no aplican)
//   · avance    → Diario, Cuotas por categoría y Salidas (sin Contexto ni CodPulso)
// Las ramas no-phone de abajo son herencia del fork y hoy son inalcanzables
// (este archivo siempre monta `mode="telefonico"`); se conservan para que el
// componente siga siendo montable con `mode="acreditacion"`.
// Los catálogos base también divergen: aquí ACREDITACION_PHONE_TABS trae 8
// entradas (suma `consultados` y `tiempos`) frente a las 6 de acreditación.
export function localTabsForTelefonicoView(
  view: MonitoreoSeccion,
  state: MonitoreoState | null,
  reports: MonitoreoAcreditacionReports | null,
  route: typeof ACREDITACION_ROUTE,
) {
  const isPhoneRoute = route.family === "telefonico" || isTelefonicoMonitoreoState(state);
  const sourceStats = acreditacionRailSourceStats(state, reports);
  const modelStats = acreditacionRailModelStats(state, reports);
  const phoneStats = isPhoneRoute ? acreditacionRailPhoneStats(state, reports) : null;
  const advanceStats = acreditacionRailAdvanceStats(state, reports);

  if (view === "fuentes") {
    if (isPhoneRoute && phoneStats) {
      const { survey, sheets, activas: active } = pestanasDeFuentesPorClave();
      // El resumen va primero: es la única que se lee sin decidir nada, y es
      // donde está la puerta para conectar. Detrás, las dos pestañas de
      // decisión en el orden en que dependen una de otra.
      return [
        railTab(active, {
          detail: `${phoneStats.sourceReady}/3 conectadas · de dónde salen los números`,
          badge: `${phoneStats.sourceReady}/3`,
          estado: readyStatus(phoneStats.sourceReady === 3),
        }),
        railTab(sheets, {
          detail: `${phoneStats.sheetReady}/2 hojas · a quién llamar y qué pasó`,
          badge: `${phoneStats.sheetReady}/2`,
          estado: readyStatus(phoneStats.sheetReady === 2),
        }),
        railTab(survey, {
          detail: phoneStats.contract.platform.ready
            ? `${countText(phoneStats.koboSources, "encuesta")} · ${phoneStats.phoneFilterConfigured ? "filtro listo" : "elige filtro"}`
            : "elige encuesta y filtro de efectiva",
          badge: phoneStats.koboSources ? fmt(phoneStats.koboSources) : undefined,
          estado: readyStatus(phoneStats.contract.platform.ready && phoneStats.phoneFilterConfigured),
        }),
      ];
    }
    const { survey, sheets, collectors, activas: active } = pestanasDeFuentesPorClave();
    return [
      railTab(survey, {
        label: "Encuestas",
        detail: sourceStats.platform ? `${countText(sourceStats.platformEnabled, "activa")} · respuestas` : "conecta encuestas",
        badge: sourceStats.platform ? fmt(sourceStats.platform) : undefined,
        estado: readyStatus(sourceStats.platformEnabled > 0),
      }),
      railTab(sheets, {
        label: "Universo",
        detail: sourceStats.sheets ? `${countText(sourceStats.sheetsEnabled, "activa")} · universo` : "conecta Sheets",
        badge: sourceStats.sheets ? fmt(sourceStats.sheets) : undefined,
        estado: readyStatus(sourceStats.sheetsEnabled > 0),
      }),
      railTab(collectors, {
        label: "Recopiladores",
        detail: sourceStats.collectors ? `${countText(sourceStats.collectors, "enlace")} · inclusión` : "vincula enlaces",
        badge: sourceStats.collectors ? fmt(sourceStats.collectors) : undefined,
        estado: readyStatus(sourceStats.collectors > 0),
      }),
      railTab(active, {
        label: "Fuentes activas",
        detail: `${sourceStats.enabled}/${sourceStats.total || 0} fuentes · ${countText(sourceStats.reportSources, "fila")}`,
        badge: sourceStats.total ? `${sourceStats.enabled}/${sourceStats.total}` : undefined,
        estado: readyStatus(sourceStats.total > 0 && sourceStats.enabled === sourceStats.total),
      }),
    ];
  }

  if (view === "modelo") {
    const [structure, schedule, summary] = ACREDITACION_MODEL_TABS;
    if (isPhoneRoute && phoneStats) {
      void summary;
      return [
        railTab(structure, {
          detail: modelStats.phoneQuotaRows
            ? `${countText(modelStats.phoneQuotaVariables, "variable")} · metas Kobo`
            : "define metas por variable",
          badge: modelStats.phoneQuotaRows ? fmt(modelStats.phoneQuotaRows) : undefined,
          estado: readyStatus(modelStats.phoneQuotaRows > 0),
        }),
        railTab(schedule, {
          detail: modelStats.schedule,
          badge: modelStats.phases ? fmt(modelStats.phases) : undefined,
          estado: readyStatus(modelStats.phases > 0),
        }),
      ];
    }
    return [
      railTab(structure, {
        detail: modelStats.actors ? `${countText(modelStats.actors, "actor")} · ${countText(modelStats.goals, "meta")}` : "define actores y metas",
        badge: modelStats.actors ? fmt(modelStats.actors) : undefined,
        estado: readyStatus(modelStats.actors > 0 || modelStats.goals > 0),
      }),
      railTab(schedule, {
        detail: modelStats.schedule,
        badge: modelStats.phases ? fmt(modelStats.phases) : undefined,
        estado: readyStatus(modelStats.phases > 0),
      }),
      railTab(summary, {
        label: "Lectura",
        detail: `${sourceStats.enabled}/${sourceStats.total || 0} fuentes · sin editar`,
        badge: sourceStats.total ? `${sourceStats.enabled}/${sourceStats.total}` : undefined,
        estado: readyStatus(sourceStats.enabled > 0),
      }),
    ];
  }

  if (view === "consultas") {
    const queries = normalizeInternalQueries(reports?.internal_queries);
    const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
    const caseSummary = summarizeInternalCases(cases);
    const issues = queries.issues.reduce((acc, issue) => acc + (num(issue.count, 1) || 1), 0);
    const [platform, base, crosses, fixes] = ACREDITACION_CONSULTA_TABS;
    if (isPhoneRoute) {
      const comparisonRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]) : [];
      const effectiveCases = telefonicoConsultedEffectiveCasesFromSources(cases, comparisonRows);
      const crossingCases = comparisonRows.length ? telefonicoComparableCasesFromComparison(comparisonRows) : effectiveCases;
      const crossingReview = crossingCases.filter((item) => telefonicoCasePlatformEffective(item) !== telefonicoCaseDeclaresEffective(item)).length;
      const crossingMatched = crossingCases.filter((item) => telefonicoCasePlatformEffective(item) && telefonicoCaseDeclaresEffective(item)).length;
      const crossingPlatform = crossingCases.filter(telefonicoCasePlatformEffective).length;
      const crossingSweep = crossingCases.filter(telefonicoCaseDeclaresEffective).length;
      const crossingComparable = Math.max(crossingPlatform, crossingSweep);
      const crossingMatchLabel = crossingPlatform ? `${fmt(crossingMatched)}/${fmt(crossingPlatform)}` : "S/D";
      const caveatCases = effectiveCases.filter(telefonicoCaseHasEffectiveCaveat);
      const phoneConsultaTabs = [
        railTab(platform, {
          detail: effectiveCases.length ? `${countText(effectiveCases.length, "caso efectivo", "casos efectivos")} · pasan filtro` : "sin efectivas Kobo",
          badge: effectiveCases.length ? fmt(effectiveCases.length) : undefined,
          estado: readyStatus(effectiveCases.length > 0),
        }),
        railTab(crosses, {
          detail: crossingComparable
            ? `${crossingMatchLabel} coinciden${crossingReview ? ` · ${fmt(crossingReview)} revisar` : ""}`
            : `${countText(effectiveCases.length, "efectiva")} · sin cruce`,
          badge: crossingComparable && crossingMatchLabel !== "S/D" ? crossingMatchLabel : undefined,
          estado: readyStatus(crossingComparable > 0 && crossingReview === 0, crossingReview > 0),
        }),
      ];
      if (caveatCases.length) {
        phoneConsultaTabs.push(railTab(fixes, {
          detail: `${countText(caveatCases.length, "caso")} · no identificable`,
          badge: fmt(caveatCases.length),
          estado: "parcial",
        }));
      }
      void base;
      return phoneConsultaTabs;
    }
    return [
      railTab(platform, {
        detail: cases.length ? `${countText(cases.length, "caso")} · respuestas` : "sin casos trazados",
        badge: cases.length ? fmt(cases.length) : undefined,
        estado: readyStatus(cases.length > 0),
      }),
      railTab(base, {
        detail: `${countText(caseSummary.pending, "pendiente")} · base`,
        badge: caseSummary.pending ? fmt(caseSummary.pending) : undefined,
        estado: readyStatus(cases.length > 0),
      }),
      railTab(crosses, {
        detail: `${countText(caseSummary.effective, "efectiva")} · cruce`,
        badge: caseSummary.effective ? fmt(caseSummary.effective) : undefined,
        estado: readyStatus(caseSummary.effective > 0),
      }),
      railTab(fixes, {
        detail: issues ? `${countText(issues, "alerta")} · revisar` : "sin alertas",
        badge: issues ? fmt(issues) : undefined,
        estado: readyStatus(!issues, issues > 0),
      }),
    ];
  }

  if (view === "telefonico" && phoneStats) {
    const [summary, consulted, day, times, incidence, responsible, alerts, supervision] = ACREDITACION_PHONE_TABS;
    void consulted;
    void day;
    void supervision;
    return [
      railTab(summary, {
        detail: `${fmt(phoneStats.totals.effective)} efectivas tel. · ${fmt(phoneStats.totals.unswept)} por barrer`,
        badge: phoneStats.totals.total ? fmt(phoneStats.totals.total) : undefined,
        estado: readyStatus(phoneStats.totals.total > 0, phoneStats.totals.unswept > 0),
      }),
      railTab(times, {
        detail: phoneStats.timeRows
          ? `${fmt(phoneStats.timeRows)} efectivas · ${fmt(phoneStats.timeUnder2 + phoneStats.timeUnder5)} revisar`
          : "sin tabla de duración",
        badge: phoneStats.timeRows ? fmt(phoneStats.timeRows) : undefined,
        estado: readyStatus(phoneStats.timeRows > 0, phoneStats.timeUnder2 + phoneStats.timeUnder5 + phoneStats.timeMissing > 0),
      }),
      railTab(incidence, {
        detail: `${fmt(phoneStats.totals.incidents)} sin efectiva · ${fmt(phoneStats.totals.unswept)} por barrer`,
        badge: phoneStats.pendingRows ? fmt(phoneStats.pendingRows) : undefined,
        estado: phoneStats.totals.incidents || phoneStats.totals.unswept ? "parcial" : "listo",
      }),
      railTab(responsible, {
        detail: `${countText(phoneStats.totals.responsables || phoneStats.responsibleRows, "persona")} · carga`,
        badge: phoneStats.totals.responsables ? fmt(phoneStats.totals.responsables) : undefined,
        estado: readyStatus(phoneStats.responsibleRows > 0),
      }),
      railTab(alerts, {
        detail: phoneStats.alertObservations
          ? `${countText(phoneStats.alertObservations, "observación", "observaciones")} · ${fmt(phoneStats.alerts)} casos`
          : "sin observaciones activas",
        badge: phoneStats.alertObservations ? fmt(phoneStats.alertObservations) : undefined,
        estado: readyStatus(!phoneStats.alertObservations, phoneStats.alertObservations > 0),
      }),
    ];
  }

  if (view === "avance") {
    const [summary, actors, surveys, detail, outputs] = ACREDITACION_ADVANCE_TABS;
    if (isPhoneRoute && phoneStats) {
      void surveys;
      void detail;
      return [
        railTab(summary, {
          detail: `${countText(phoneStats.platformEffective, "efectiva")} · ritmo Kobo`,
          badge: phoneStats.platformEffective ? fmt(phoneStats.platformEffective) : undefined,
          estado: readyStatus(phoneStats.platformEffective > 0 && phoneStats.phoneFilterConfigured),
        }),
        railTab(actors, {
          detail: phoneStats.quotaCategoryRows
            ? `${countText(phoneStats.quotaCategoryRows, phoneStats.quotaCategoryNoun)} · ${fmt(phoneStats.quotaEffective)} efectivas${phoneStats.quotaGap ? ` · ${fmt(phoneStats.quotaGap)} faltan` : ""}`
            : "sin cuotas leídas",
          badge: phoneStats.quotaCategoryRows ? fmt(phoneStats.quotaCategoryRows) : undefined,
          estado: readyStatus(phoneStats.quotaCategoryRows > 0),
        }),
        railTab(outputs, {
          detail: "publica PDF y hojas de avance",
          estado: state?.has_snapshot ? "listo" : "sin-configurar",
        }),
      ];
    }
    return [
      railTab(summary, {
        detail: `${fmt(advanceStats.summary.effective)} efectivas · ${fmt(advanceStats.summary.universe)} universo`,
        badge: advanceStats.summary.effective ? fmt(advanceStats.summary.effective) : undefined,
        estado: readyStatus(advanceStats.summary.effective > 0),
      }),
      railTab(actors, {
        detail: `${countText(advanceStats.actors, "actor")} · brechas`,
        badge: advanceStats.actors ? fmt(advanceStats.actors) : undefined,
        estado: readyStatus(advanceStats.actors > 0),
      }),
      railTab(surveys, {
        detail: `${countText(advanceStats.sources, "fuente")} · canales`,
        badge: advanceStats.sources ? fmt(advanceStats.sources) : undefined,
        estado: readyStatus(advanceStats.sources > 0),
      }),
      railTab(detail, {
        detail: `${countText(advanceStats.controls, "control")} · reglas`,
        badge: advanceStats.controls ? fmt(advanceStats.controls) : undefined,
        estado: readyStatus(advanceStats.controls > 0),
      }),
      railTab(outputs, {
        detail: "publica PDF y hojas cliente",
        estado: state?.has_snapshot ? "listo" : "sin-configurar",
      }),
    ];
  }

  return [];
}

function AcreditacionWorkbenchRail({
  route,
  seccionActiva,
  pestanaActiva,
  onCambioPestana,
  syncedAt,
  state,
  reports,
}: {
  route: typeof ACREDITACION_ROUTE;
  seccionActiva: MonitoreoSeccion;
  pestanaActiva: string;
  onCambioPestana: (view: MonitoreoSeccion, tab: AcreditacionLocalTabKey) => void;
  syncedAt: string;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const views = seccionesDelModo(route);
  const isPhoneRoute = route.family === "telefonico";
  const activeSection = views.find((item) => item.key === seccionActiva) ?? views[0] ?? {
    label: route.shortLabel,
    desc: "Vista operativa",
    icon: route.icon,
  };
  const localTabs = localTabsForTelefonicoView(seccionActiva, state, reports, route);

  return (
    <MonitoreoWorkbenchRail
      pestanaActiva={pestanaActiva}
      activeSection={activeSection}
      seccionActiva={seccionActiva}
      ariaLabel={isPhoneRoute ? "Flujos de monitoreo telefónico" : "Flujos de monitoreo de acreditación"}
      className={isPhoneRoute ? "is-telefonico" : "is-acreditacion"}
      emptyDetail={reports?.report_scope ?? activeSection.desc ?? "Vista operativa"}
      iconOnlyTabs
      localTabs={localTabs}
      modeCountLabel={`${localTabs.length || 1} pestañas`}
      routeLabel={route.shortLabel}
      routeSectionLabel={`${route.shortLabel} · sección`}
      routeShortLabel={route.shortLabel}
      statusAriaLabel="Última actualización del monitoreo"
      statusItems={[
        {
          label: "Última actualización",
          value: syncedAt || "Sin actualización",
          ready: Boolean(syncedAt),
        },
      ]}
      onCambioPestana={(key) => onCambioPestana(seccionActiva, key as AcreditacionLocalTabKey)}
    />
  );
}

function AcreditacionWorkbenchHead({
  route,
  seccionActiva,
  pestanaActiva,
  state,
  reports,
}: {
  route: typeof ACREDITACION_ROUTE;
  seccionActiva: MonitoreoSeccion;
  pestanaActiva?: string;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const views = seccionesDelModo(route);
  const meta = views.find((item) => item.key === seccionActiva) ?? views[0];
  const Icon = meta.icon;
  const activeSources = activeSourceCount(state);
  const preferActors = seccionActiva === "modelo" || seccionActiva === "avance";
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0), preferActors);
  const valid = num(state?.dashboard?.kpis?.valid, 0) || summary.effective;
  const mechanisms = state?.config?.strategy_phases?.length ?? 0;
  const actorCount = reports?.client_report?.actors?.length ?? 0;
  const lastPill = seccionActiva === "modelo"
    ? `${fmt(actorCount)} actores`
    : `${fmt(mechanisms)} mecanismos`;

  // El nombre y el estado de la pestaña activa se dicen acá: el rail es
  // icon-only y su cuadrante no lleva rótulo ni marcas.
  const pestanas = localTabsForTelefonicoView(seccionActiva, state, reports, route);
  const pestanaDef = pestanas.find((tab) => tab.key === pestanaActiva);

  return (
    <MonitoreoWorkbenchHead
      icon={Icon}
      eyebrow={`${route.shortLabel} · flujo actual`}
      title={meta.label}
      pestanaLabel={pestanaDef?.label}
      pestanaEstado={pestanaDef?.estado}
      detail={meta.desc}
      pills={[
        `${activeSources} fuentes`,
        `${fmt(state?.n_rows ?? 0)} recibidas`,
        `${fmt(valid)} válidas`,
        lastPill,
      ]}
    />
  );
}

function AcreditacionClarityStrip({
  seccionActiva,
  state,
  reports,
}: {
  seccionActiva: MonitoreoSeccion;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const isPhoneState = isTelefonicoMonitoreoState(state);
  const sourceTotal = piezasRequeridas(isPhoneState, state?.sources?.length ?? 0);
  const activeSources = activeSourceCount(state);
  const sourceGap = Math.max(0, sourceTotal - activeSources);
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0));
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const caseSummary = summarizeInternalCases(cases);
  const issueCount = queries.issues.reduce((acc, issue) => acc + (num(issue.count, 1) || 1), 0);
  const phoneSummaryRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]) : [];
  const phoneRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico", "estatus_telefonico"]) : [];
  const phoneStatusSheetRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]) : [];
  const phoneStatusRows = phoneStatusSheetRows.length
    ? phoneStatusSheetRows
    : groupedCaseRows(cases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const phoneStatusTotal = phoneStatusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0);
  const phoneBaseFromReport = phoneSummaryValue(phoneSummaryRows, "total telefonico")
    ?? phoneSummaryValue(phoneSummaryRows, "total telefónico")
    ?? phoneStatusTotal;
  const phoneBaseTotal = phoneBaseFromReport
    || summary.universe
    || state?.n_rows
    || 0;
  const phonePendingTotal = phoneSummaryValue(phoneSummaryRows, "no barridos") ?? summary.unanswered;
  const platformCaseCount = cases.length;
  const platformHasReport = Boolean(
    platformCaseCount ||
      reports?.client_report?.actors?.length ||
      reports?.client_report?.sources?.length ||
      reports?.client_report?.daily_general?.length,
  );
  const phoneComparisonRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]) : [];
  const phoneComparison = phonePlatformComparisonTotals(phoneComparisonRows);
  const phoneCaveatCount = isPhoneState ? telefonicoConsultaCaveatCount(reports) : 0;
  const phoneDailyBlock = reports ? phoneDailyBlockForPanel(reports) : null;
  const phoneEffectiveFromDaily = normalizeSourceMatch(phoneDailyBlock?.id ?? "").includes("avance_efectivo")
    ? buildAcreditacionPhoneDailyPoints(phoneDailyBlock?.rows ?? []).reduce((sum, point) => sum + point.effective, 0)
    : 0;
  const phonePlatformEffective = isPhoneState
    ? phoneComparison.platformComplete || phoneEffectiveFromDaily
    : summary.effective;
  const actorRows = reports?.client_report?.actors ?? [];
  const configuredGoals = state?.config?.goals?.filter((goal) => Number(goal.meta) > 0).length ?? 0;
  const bloqueos = state?.acreditacion?.dashboard?.bloqueos ?? 0;
  const phoneQuotaReportRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const phoneQuotaVariable = isPhoneState && state?.config
    ? preferredPhoneQuotaVariable(state.variables ?? [], state.config.control_vars ?? [], phoneQuotaReportRows, state.config.goals ?? [])
    : "";
  const phoneQuotaEditorRows = isPhoneState && state?.config
    ? buildAcreditacionPhoneQuotaEditorRows({
      variable: phoneQuotaVariable,
      variables: state.variables ?? [],
      goals: state.config.goals ?? [],
      quotaRows: phoneQuotaReportRows,
    })
    : [];
  const phoneQuotaGoal = phoneQuotaVariable && state?.config ? phoneQuotaGoalTotal(state.config.goals ?? [], phoneQuotaVariable) : 0;
  const phoneFilter = isPhoneState ? normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter) : null;
  const phoneFilterConfigured = Boolean(phoneFilter?.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phoneFilterRailValue = phoneFilterConfigured
    ? `${phoneQuotaVariableLabel(phoneFilter?.label || phoneFilter?.variable || "")} = ${phoneQuotaVariableLabel(phoneFilter?.value_label || phoneFilter?.values[0] || "valor")}`
    : "Pendiente";
  const phoneFilterRailHint = phoneFilterConfigured
    ? "opción válida"
    : "define consentimiento";
  const itemsByView = {
    fuentes: [
      { label: "Fuentes", value: `${activeSources}/${sourceTotal || 0}`, hint: sourceGap ? `${sourceGap} pendientes` : "paquete listo", tone: sourceGap ? "warning" : "ready", icon: ClipboardCheck },
      { label: "Base", value: state?.n_rows ? fmt(state.n_rows) : "S/D", hint: "registros leídos", tone: state?.n_rows ? "base" : "warning", icon: Table2 },
      { label: "Corte", value: reports ? "Listo" : "Pendiente", hint: reports?.generated_at ? formatDate(reports.generated_at) : "requiere corte", tone: reports ? "ready" : "warning", icon: RefreshCw },
    ],
    modelo: isPhoneState ? [
      { label: "Filtro Kobo", value: phoneFilterRailValue, hint: phoneFilterRailHint, tone: phoneFilterConfigured ? "ready" : "warning", icon: Filter },
      { label: "CodPulso", value: phoneComparisonRows.length ? phoneCodPulsoEffectiveMatchLabel(phoneComparison) : "S/D", hint: phoneComparison.mismatch ? "tel. pendiente" : "tel. alineado", tone: phoneComparison.mismatch ? "warning" : "ready", icon: Search },
      { label: "Base tel.", value: phoneBaseTotal ? fmt(phoneBaseTotal) : "S/D", hint: phoneQuotaVariable ? `${fmt(phoneQuotaEditorRows.length)} cuotas` : "define variable", tone: phoneBaseTotal && phoneQuotaEditorRows.length ? "base" : "warning", icon: Table2 },
    ] : [
      { label: "Actores", value: fmt(actorRows.length), hint: "cortes del reporte", tone: actorRows.length ? "base" : "warning", icon: ClipboardCheck },
      { label: "Metas", value: fmt(configuredGoals), hint: "configuradas", tone: configuredGoals ? "ready" : "warning", icon: Target },
      { label: "Bloqueos", value: fmt(bloqueos), hint: bloqueos ? "requieren cierre" : "sin bloqueos", tone: bloqueos ? "warning" : "ready", icon: ShieldAlert },
    ],
    avance: isPhoneState ? [
      { label: "Efectivas Kobo", value: phonePlatformEffective ? fmt(phonePlatformEffective) : "S/D", hint: "pasan filtro", tone: phonePlatformEffective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "CodPulso", value: phoneComparisonRows.length ? phoneCodPulsoEffectiveMatchLabel(phoneComparison) : "S/D", hint: phoneComparisonRows.length ? phoneCodPulsoDifferenceHint(phoneComparison) : "sin cruce", tone: phoneComparison.mismatch ? "warning" : "ready", icon: Search },
      { label: "Base tel.", value: phoneBaseTotal ? fmt(phoneBaseTotal) : fmt(state?.n_rows ?? 0), hint: "universo de llamadas", tone: phoneBaseTotal || state?.n_rows ? "base" : "warning", icon: Table2 },
    ] : [
      { label: "Efectivas", value: summary.effective ? fmt(summary.effective) : "S/D", hint: summary.universe ? `${pctFrom(summary.effective, summary.universe)} del universo` : "plataforma completa", tone: summary.effective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "Parciales", value: fmt(summary.partial), hint: "no cuentan como efectivas", tone: summary.partial ? "partial" : "ready", icon: AlertCircle },
      { label: "Universo", value: summary.universe ? fmt(summary.universe) : fmt(state?.n_rows ?? 0), hint: summary.referenceLabel, tone: summary.universe || state?.n_rows ? "base" : "warning", icon: Table2 },
    ],
    consultas: isPhoneState ? [
      { label: "Efectivas Kobo", value: phonePlatformEffective ? fmt(phonePlatformEffective) : "S/D", hint: "pasan filtro", tone: phonePlatformEffective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "CodPulso", value: phoneComparisonRows.length ? phoneCodPulsoEffectiveMatchLabel(phoneComparison) : "S/D", hint: phoneComparisonRows.length ? phoneCodPulsoDifferenceHint(phoneComparison) : "sin cruce", tone: phoneComparison.mismatch ? "warning" : "ready", icon: Search },
      { label: "Salvedades", value: fmt(phoneCaveatCount), hint: phoneCaveatCount ? "efectivas no identificables" : "sin salvedades", tone: phoneCaveatCount ? "warning" : "ready", icon: ShieldAlert },
    ] : [
      { label: "Efectivas", value: cases.length ? fmt(caseSummary.effective) : "S/D", hint: "reales trazadas", tone: caseSummary.effective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "Salen pendientes", value: fmt(caseSummary.pendingExit), hint: "faltantes recuperados", tone: caseSummary.pendingExit ? "ready" : "base", icon: Link2 },
      { label: "Alertas", value: fmt(issueCount), hint: "casos de revisión", tone: issueCount ? "warning" : "ready", icon: ShieldAlert },
    ],
	    telefonico: [
	      { label: "Base tel.", value: phoneBaseTotal ? fmt(phoneBaseTotal) : "Pendiente", hint: phoneRows.length ? "base de barrido" : "requiere corte", tone: phoneBaseTotal ? "base" : "warning", icon: PhoneCall },
	      { label: "Efectivas Kobo", value: phonePlatformEffective ? fmt(phonePlatformEffective) : (platformHasReport ? "Listo" : "Pendiente"), hint: phonePlatformEffective ? "pasan filtro" : "comparación no cargada", tone: phonePlatformEffective || platformHasReport ? "ready" : "warning", icon: Search },
	      { label: "Por barrer", value: fmt(phonePendingTotal), hint: "operación telefónica", tone: phonePendingTotal ? "pending" : "ready", icon: AlertCircle },
	    ],
    ocurrencias: [],
    calidad: [],
  };
  const items = itemsByView[seccionActiva] ?? itemsByView.fuentes;
  const clarityLabel = isPhoneState ? "Lectura operativa de monitoreo telefónico" : "Lectura operativa de acreditación";

  return (
    <section className={`mon-clarity-strip is-${seccionActiva}`} aria-label={clarityLabel}>
      <div className="mon-clarity-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span key={`${seccionActiva}-${item.label}`} className={`mon-clarity-card is-${item.tone}`}>
              <Icon size={14} />
              <span>
                <em>{item.label}</em>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function AcreditacionProfilePage({ mode = "acreditacion" }: { mode?: AcreditacionProfileMode }) {
  const isPhone = mode === "telefonico";
  const route = isPhone ? TELEFONICO_ROUTE : ACREDITACION_ROUTE;
  const profileLabel = isPhone ? "Monitoreo telefónico" : "Acreditación";
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [seccionActiva, setActiveView] = useState<MonitoreoSeccion>(() => seccionInicialMonitoreo("fuentes", seccionesDelModo(route)));
  const [activeSourceTab, setActiveSourceTab] = useState<AcreditacionSourceTab>(() =>
    // El aterrizaje lo declara el catálogo, no este useState: era el segundo
    // sitio donde se decidía lo mismo. Ver `pestanasDeFuentes`.
    pestanaInicialDeSeccion("fuentes", seccionActiva, pestanaDeFuentesInicial(isPhone), ACREDITACION_SOURCE_TABS.map((tab) => tab.key)));
  const [activeModelTab, setActiveModelTab] = useState<AcreditacionModelTab>(() =>
    pestanaInicialDeSeccion("modelo", seccionActiva, "estructura", ACREDITACION_MODEL_TABS.map((tab) => tab.key)));
  const [activeConsultaTab, setActiveConsultaTab] = useState<AcreditacionConsultaTab>(() =>
    pestanaInicialDeSeccion("consultas", seccionActiva, "plataforma", ACREDITACION_CONSULTA_TABS.map((tab) => tab.key)));
  const [activePhoneTab, setActivePhoneTab] = useState<AcreditacionPhoneTab>(() =>
    pestanaInicialDeSeccion("telefonico", seccionActiva, "resumen", ACREDITACION_PHONE_TABS.map((tab) => tab.key)));
  const [activeAdvanceTab, setActiveAdvanceTab] = useState<AcreditacionAdvanceTab>(() =>
    pestanaInicialDeSeccion("avance", seccionActiva, "resumen", ACREDITACION_ADVANCE_TABS.map((tab) => tab.key)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAcreditacion, setSavingAcreditacion] = useState(false);
  // Aislamiento del sync (unidad 2.2): la raíz solo se suscribe a `syncing`
  // (dos flips por sync); el progreso por segundo vive en el store y lo
  // consume únicamente AcreditacionModuleChromeConSync.
  const sourceSyncing = useSourceSyncStore((s) => s.syncing);
  const [actionStatus, setActionStatus] = useState<AcreditacionActionStatus>(null);
  const [caseReconciliationBusyId, setCaseReconciliationBusyId] = useState("");
  const [caseReconciliationStatus, setCaseReconciliationStatus] = useState<AcreditacionActionStatus>(null);
  const activeViewRef = useRef<MonitoreoSeccion>(seccionActiva);
  const loadSeqRef = useRef(0);
  const initialLoadStartedRef = useRef(false);
  const warmedScopesRef = useRef(new Set<string>());
  const stateByScopeRef = useRef(new Map<string, MonitoreoState>());
  const inFlightScopeRef = useRef(new Map<string, Promise<MonitoreoState | null>>());
  const scopeCacheEpochRef = useRef(0);
  // Ciclo de vida de los polls (1.5b/1.5c): timeouts de prefetch cancelados y
  // espera de jobs cortada al desmontar el perfil.
  const prefetchTimeoutsRef = usePrefetchTimeouts();
  const waitForSourceSyncJob = useWaitForSourceSyncJob();

  const routeWorkbenchViews = useMemo(() => seccionesDelModo(route), [route]);
  const activeDef = useMemo(
    () => routeWorkbenchViews.find((item) => item.key === seccionActiva)
      ?? MONITOREO_SECCIONES.find((item) => item.key === seccionActiva)
      ?? routeWorkbenchViews[0]
      ?? MONITOREO_SECCIONES[0],
    [seccionActiva, routeWorkbenchViews],
  );
  // Identidad estable por state (unidad 2.3): sin el memo, cada render de la
  // raíz repartía un objeto nuevo e incapacitaba la memoización aguas abajo.
  const reports = useMemo(() => reportsFromState(state), [state]);
  const phoneConsultaCaveatCount = isPhone ? telefonicoConsultaCaveatCount(reports) : 0;

  useEffect(() => {
    const phoneHiddenConsultaTab = activeConsultaTab === "base" ||
      (activeConsultaTab === "subsanacion" && phoneConsultaCaveatCount === 0);
    if (isPhone && seccionActiva === "consultas" && phoneHiddenConsultaTab) {
      setActiveConsultaTab("plataforma");
    }
  }, [activeConsultaTab, seccionActiva, isPhone, phoneConsultaCaveatCount]);
  useEffect(() => {
    if (isPhone && seccionActiva === "modelo" && activeModelTab === "resumen") {
      setActiveModelTab("estructura");
    }
  }, [activeModelTab, seccionActiva, isPhone]);
  const prefetchBackgroundScopes = useCallback((view: MonitoreoSeccion) => {
    const activeScope = scopeForView(view, route.family);
    const scopes = [activeScope, ...backgroundScopesForView(view, route.family)]
      .filter((scope, index, all) => scope !== "full" && all.indexOf(scope) === index);
    schedulePrefetchScopes(
      { stateByScopeRef, warmedScopesRef, inFlightScopeRef, scopeCacheEpochRef },
      prefetchTimeoutsRef,
      scopes,
      (index) => route.family === "telefonico" ? 420 + index * 420 : 240 + index * 180,
    );
  }, [prefetchTimeoutsRef, route.family]);

  // Nota (unidad 3.4): a diferencia del perfil territorial (invalidación
  // selectiva por fase+fuente), aquí el caché guarda MonitoreoState COMPLETOS
  // keyed solo por scope; toda mutación de este perfil cambia config/KPIs que
  // cualquier vista lee del state cacheado, así que conservar scopes tras una
  // mutación mostraría estado visiblemente stale. El clear total sigue siendo
  // la invalidación correcta para este perfil.
  const clearScopeStateCache = useCallback(() => {
    scopeCacheEpochRef.current += 1;
    stateByScopeRef.current.clear();
    warmedScopesRef.current.clear();
    inFlightScopeRef.current.clear();
  }, []);

  const loadView = useCallback(async (view: MonitoreoSeccion, force = false) => {
    const seq = ++loadSeqRef.current;
    const reportScope = scopeForView(view, route.family);
    if (force) {
      clearScopeStateCache();
    } else {
      const cachedState = stateByScopeRef.current.get(reportScope);
      if (cachedState) {
        setState(cachedState);
        setError("");
        setLoading(false);
        warmedScopesRef.current.add(reportScope);
        prefetchBackgroundScopes(view);
        return;
      }
    }
    setLoading(true);
    const cacheEpoch = scopeCacheEpochRef.current;
    try {
      const existingRequest = force ? null : inFlightScopeRef.current.get(reportScope);
      const request = existingRequest ?? apiMonitoreoState({
          includeReports: true,
          reportScope,
          warmupCache: !force,
          force,
        }).finally(() => {
          if (inFlightScopeRef.current.get(reportScope) === request) inFlightScopeRef.current.delete(reportScope);
        });
      if (!existingRequest) inFlightScopeRef.current.set(reportScope, request);
      const next = await request;
      if (!next) return;
      if (cacheEpoch !== scopeCacheEpochRef.current && !force) return;
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      stateByScopeRef.current.set(reportScope, next);
      warmedScopesRef.current.add(reportScope);
      setState(next);
      setError("");
      prefetchBackgroundScopes(view);
    } catch (e) {
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setError((e as Error).message);
    } finally {
      if (seq === loadSeqRef.current && view === activeViewRef.current) setLoading(false);
    }
  }, [clearScopeStateCache, prefetchBackgroundScopes, route.family]);

  useEffect(() => {
    activeViewRef.current = seccionActiva;
  }, [seccionActiva]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadView(seccionActiva);
  }, [seccionActiva, loadView]);

  // El store del sync sobrevive al desmontaje del perfil; si el poll quedó
  // cortado a media sincronización, no debe amanecer "sincronizando".
  useEffect(() => () => {
    sourceSyncActions.finish();
  }, []);

  useEffect(() => {
    if (!isPhone || seccionActiva !== "fuentes" || activeSourceTab !== "collectors") return;
    setActiveSourceTab("survey");
  }, [activeSourceTab, seccionActiva, isPhone]);

  useEffect(() => {
    if (!isPhone) return;
    if (!isTelefonicoVisiblePhoneTab(activePhoneTab)) setActivePhoneTab("resumen");
    if (!isTelefonicoVisibleAdvanceTab(activeAdvanceTab)) setActiveAdvanceTab("resumen");
  }, [activeAdvanceTab, activePhoneTab, isPhone]);

  const refreshCurrentView = useCallback(() => {
    void loadView(seccionActiva, true);
  }, [seccionActiva, loadView]);
  const applyStateChange = useCallback((nextState: MonitoreoState) => {
    clearScopeStateCache();
    setState(nextState);
    // El estado se cachea bajo el scope que TRAE, no bajo el que la vista
    // quería. Al revés, un payload de `source` devuelto por una mutación
    // quedaba archivado como si fuera el corte de Avance, y la siguiente
    // visita a Avance lo servía desde caché sin volver a pedirlo: el desajuste
    // dejaba de ser transitorio y se hacía permanente.
    const reportScope = nextState.dashboard?.acreditacion_reports?.report_scope
      ?? scopeForView(activeViewRef.current, route.family);
    stateByScopeRef.current.set(reportScope, nextState);
    warmedScopesRef.current.add(reportScope);
  }, [clearScopeStateCache, route.family]);
  const saveSeguimiento = useCallback(async (payload: MonitoreoAcreditacionSeguimientoPayload) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoAcreditacionSeguimiento(payload);
      clearScopeStateCache();
      setState(result.state);
      setActionStatus({ tone: "success", message: "Avance registrado en el seguimiento." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, [clearScopeStateCache]);
  const closeAcreditacion = useCallback(async (planRefuerzo: string, aprobarBrechas: boolean) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoCierre({ plan_refuerzo: planRefuerzo, aprobar_brechas: aprobarBrechas });
      clearScopeStateCache();
      setState(result.state);
      setActionStatus({ tone: "success", message: "Cierre de acreditación actualizado." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, [clearScopeStateCache]);
  const saveCaseReconciliationDecision = useCallback(async (payload: AcreditacionCaseReconciliationPayload) => {
    const responseId = payload.response_id.trim();
    if (!responseId) return;
    setCaseReconciliationBusyId(responseId);
    setCaseReconciliationStatus(null);
    setError("");
    try {
      const result = await apiMonitoreoAcreditacionCaseReconciliation({ ...payload, response_id: responseId });
      clearScopeStateCache();
      setState(result.state);
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: "queries_summary",
        warmupCache: false,
        force: true,
      });
      stateByScopeRef.current.set("queries_summary", next);
      warmedScopesRef.current.add("queries_summary");
      setState(next);
      setCaseReconciliationStatus({
        tone: "success",
        message: result.decision.action === "include_with_caveat"
          ? "Caso incluido con salvedad y reporte actualizado."
          : "Caso mantenido fuera del avance y reporte actualizado.",
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setCaseReconciliationStatus({ tone: "error", message });
    } finally {
      setCaseReconciliationBusyId("");
    }
  }, [clearScopeStateCache]);
  const runProfileSourceSync = useCallback(async (syncMode: "full" | "advance") => {
    const sourceIds = fuentesSincronizables(state?.sources ?? [], syncMode, route.family).map((source) => source.id);
    if (!sourceIds.length) {
      // Sin fuentes que leer no hay fallo que reportar: el botón ya está
      // apagado con esta misma cuenta y su título dice por qué. Este camino
      // queda como respaldo —una fuente puede desactivarse entre el render y el
      // click— y por eso informa por el canal de estado, no por `setError`, que
      // marca la vista como rota y le tumba la readiness.
      setActionStatus({ tone: "info", message: motivoSinFuentes(syncMode) });
      return;
    }
    sourceSyncActions.start({
      mode: syncMode,
      percent: 2,
      phase: "Preparando",
      message: syncMode === "full" ? "Preparando actualización completa..." : "Preparando avance...",
    });
    setError("");
    setActionStatus({ tone: "info", message: syncMode === "full" ? "Actualizando todas las fuentes activas..." : "Actualizando solo avance de respuestas..." });
    try {
      const start = await apiMonitoreoSync(state?.config, sourceIds, { syncMode });
      sourceSyncActions.report({
        mode: syncMode,
        percent: 8,
        phase: "En cola",
        message: `Job ${start.job_id} en cola.`,
      });
      setActionStatus({ tone: "info", message: `Sincronizacion ${syncMode === "full" ? "completa" : "de avance"} en job ${start.job_id}.` });
      // El tick por segundo del poll entra al store, no a un useState de la
      // raíz: solo re-renderiza al chrome conectado (unidad 2.2).
      await waitForSourceSyncJob(start.job_id, (progress) => {
        sourceSyncActions.report({
          mode: syncMode,
          ...progress,
        });
      });
      clearScopeStateCache();
      const reportScope = scopeForView(activeViewRef.current, route.family);
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope,
        warmupCache: false,
        force: true,
      });
      stateByScopeRef.current.set(reportScope, next);
      warmedScopesRef.current.add(reportScope);
      setState(next);
      setActionStatus({
        tone: "success",
        message: syncMode === "full"
          ? "Actualizacion completa lista; recopiladores persistidos si la API devolvio metadata."
          : route.family === "telefonico"
            ? "Avance actualizado con las entrevistas de la plataforma y la hoja de llamadas."
            : "Avance actualizado usando la relacion guardada de recopiladores.",
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      sourceSyncActions.finish();
    }
  }, [clearScopeStateCache, route.family, state?.config, state?.sources]);
  // El botón se apaga con la misma cuenta con la que la acción se rendiría: la
  // afordancia y lo que hace no pueden discrepar. Ver `core/fuentesSincronizables`.
  const sinFuentesFull = !fuentesSincronizables(state?.sources ?? [], "full", route.family).length;
  const sinFuentesAvance = !fuentesSincronizables(state?.sources ?? [], "advance", route.family).length;
  const sourceTotal = piezasRequeridas(isPhone, state?.sources?.length ?? 0);
  const activeSources = activeSourceCount(state);
  const chromeBusy = savingAcreditacion || sourceSyncing || Boolean(caseReconciliationBusyId);
  const refreshTitle = sourceSyncing ? "Sincronizando fuentes..." : loading ? "Actualizando vista..." : `Actualizar ${activeDef.shortLabel ?? activeDef.label}`;
  const pestanaActiva = seccionActiva === "fuentes"
    ? activeSourceTab
    : seccionActiva === "modelo"
      ? activeModelTab
      : seccionActiva === "consultas"
        ? activeConsultaTab
        : seccionActiva === "telefonico"
          ? activePhoneTab
          : seccionActiva === "avance"
            ? activeAdvanceTab
            : "";
  // `changeLocalTab` se declara mas abajo; la ref rompe ese orden sin reatar
  // este callback en cada render.
  const cambiarPestanaRef = useRef<((seccion: MonitoreoSeccion, pestana: AcreditacionLocalTabKey) => void) | null>(null);
  const navigateSection = useCallback((view: MonitoreoSeccion) => {
    if (view === activeViewRef.current) return;
    activeViewRef.current = view;
    setActiveView(view);
    if (view !== "avance") setActiveAdvanceTab("resumen");
    // Si la peticion viene de una DIRECCION que ademas trae pestana, se aplica
    // aqui, junto con su seccion. Sin esto la pestana activa de la seccion
    // nueva se publicaba en la URL y pisaba la pedida: medido en acreditacion,
    // `?seccion=avance&pestana=detalle` desde Consultas aterrizaba en
    // `resumen`. La vista quedaba alcanzable por clic y no por direccion.
    //
    // Se exige que la SECCION de la URL coincida con la que se activa: eso
    // distingue «vengo de una direccion» de «vengo de un clic», donde la URL
    // todavia trae la pestana de la seccion anterior.
    if (monitoreoSeccionDesdeParams(window.location.search) === view) {
      const pedida = monitoreoPestanaDesdeParams(window.location.search);
      if (pedida) cambiarPestanaRef.current?.(view, pedida as AcreditacionLocalTabKey);
    }
    void loadView(view);
  }, [loadView]);
  useMonitoreoDireccion(seccionActiva, pestanaActiva || undefined, modoIdDesdeFamily(route.family), {
    onSeccionPedida: navigateSection,
    // `changeLocalTab` ya valida la pestaña contra el catálogo de la sección.
    onPestanaPedida: (pestana, seccion) =>
      changeLocalTab(seccion, pestana as AcreditacionLocalTabKey),
  });
  // Publica las pestañas de esta sección para que el inspector las enumere.
  useRegistrarPestanasMonitoreo(
    modoIdDesdeFamily(route.family),
    seccionActiva,
    localTabsForTelefonicoView(seccionActiva, state, reports, route),
  );
  const hideWorkbenchStatus = seccionActiva === "consultas" && (activeConsultaTab === "plataforma" || (!isPhone && activeConsultaTab === "base"));
  const changeLocalTab = useCallback((view: MonitoreoSeccion, tab: AcreditacionLocalTabKey) => {
    if (view === "fuentes" && ACREDITACION_SOURCE_TABS.some((item) => item.key === tab)) {
      setActiveSourceTab(tab as AcreditacionSourceTab);
    } else if (
      view === "modelo" &&
      ACREDITACION_MODEL_TABS.some((item) => item.key === tab) &&
      (!isPhone || tab !== "resumen")
    ) {
      setActiveModelTab(tab as AcreditacionModelTab);
    } else if (
      view === "consultas" &&
      ACREDITACION_CONSULTA_TABS.some((item) => item.key === tab) &&
      (!isPhone || tab !== "base") &&
      (!isPhone || tab !== "subsanacion" || phoneConsultaCaveatCount > 0)
    ) {
      setActiveConsultaTab(tab as AcreditacionConsultaTab);
    } else if (view === "telefonico" && ACREDITACION_PHONE_TABS.some((item) => item.key === tab) && (!isPhone || isTelefonicoVisiblePhoneTab(tab))) {
      setActivePhoneTab(tab as AcreditacionPhoneTab);
    } else if (view === "avance" && ACREDITACION_ADVANCE_TABS.some((item) => item.key === tab) && (!isPhone || isTelefonicoVisibleAdvanceTab(tab))) {
      setActiveAdvanceTab(tab as AcreditacionAdvanceTab);
    }
  }, [isPhone, phoneConsultaCaveatCount]);
  cambiarPestanaRef.current = changeLocalTab;
  const navigateLocalTab = useCallback((view: MonitoreoSeccion, tab: AcreditacionLocalTabKey) => {
    changeLocalTab(view, tab);
    navigateSection(view);
  }, [changeLocalTab, navigateSection]);
  const loadedReportScope = state?.dashboard?.acreditacion_reports?.report_scope;
  // Un estudio sin corte también termina de cargar.
  //
  // La readiness colgaba entera del scope del corte, así que un proyecto recién
  // abierto —el que todavía no ha conectado ninguna fuente— no la publicaba
  // nunca: `window.__pulsoNav.listo()` respondía `sin-marca-de-readiness` y el
  // QA visual no podía gatear la pantalla del primer día. Justo la pantalla
  // donde se conectan las fuentes que producen el corte.
  //
  // Sin corte no hay scope que comparar, y no hay nada más que esperar: cada
  // sección ya está en su estado final —Fuentes con sus tarjetas por conectar,
  // el resto con su vacío declarado—. `loading`, `error` y `state` siguen
  // mandando; lo único que se retira es la exigencia de un corte que este
  // proyecto todavía no tiene.
  //
  // Y un corte de OTRA sección no es esta sección cargada. El estado se
  // reemplaza entero cada vez que algo lo devuelve, y las mutaciones traen el
  // scope que su endpoint decidió: guardar desde un panel mientras se mira
  // Avance dejaba en pantalla un corte de `source`. La vista se quedaba callada
  // —sin readiness, sin recargar, con cifras ajenas— y ese silencio no se
  // distingue de «cargando» ni de «esto está bien». Ver `core/coberturaDelCorte`.
  const cobertura = coberturaDelCorte(
    loadedReportScope,
    scopeForView(seccionActiva, isPhone ? "telefonico" : "acreditacion"),
  );
  const seccionCargando = loading || Boolean(state && !error && cobertura === "otra-seccion");
  const auditReady = !seccionCargando && !error && Boolean(state);
  // Pedir el corte que falta, una vez por desajuste observado. El tope no es
  // defensivo de más: si el backend devolviera siempre un scope que no cubre,
  // reintentar sin límite convertiría un dato incompleto en un bucle de red.
  const desajusteAtendido = useRef("");
  useEffect(() => {
    if (loading || error || cobertura !== "otra-seccion") return;
    const marca = `${seccionActiva}|${loadedReportScope ?? ""}`;
    if (desajusteAtendido.current === marca) return;
    desajusteAtendido.current = marca;
    void loadView(seccionActiva, true);
  }, [cobertura, error, loadView, loading, loadedReportScope, seccionActiva]);

  return (
    <div className={`mon-profile-canonical-shell ${isPhone ? "is-telefonico-profile" : "is-acreditacion-profile"}`} style={MODULE_TONES.monitoreo as CSSProperties}>
        <PageFrame
          title={route.label}
        layout="workbench"
        scrollOwner="panels"
        bodyMode="fill"
        headerMode="sr-only"
        className="mon-page"
        resetScrollKey={`${seccionActiva}:${pestanaActiva}`}
        density="compact"
      >
        <span
          hidden
          data-audit-ready={auditReady ? (isPhone ? "monitoreo-telefonico" : "monitoreo-acreditacion") : undefined}
          data-audit-loading={seccionCargando ? "true" : "false"}
          data-audit-has-dashboard={state?.dashboard ? "true" : "false"}
        />
        {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}

        <AcreditacionModuleChromeConSync
          routes={[route]}
          route={route}
          routeSelected
          seccionActiva={seccionActiva}
          saving={chromeBusy}
          syncedAt={state?.synced_at ?? ""}
          generatedAt={state?.generated_at ?? reports?.generated_at ?? ""}
          generationStatus={state?.generation_status ?? ""}
          pendingRegeneration={Boolean(state?.pending_regeneration)}
          syncErrors={state?.sync_errors ?? state?.errors ?? []}
          sourceTotal={sourceTotal}
          activeSources={activeSources}
          nRows={state?.n_rows ?? 0}
          hasSnapshot={Boolean(state?.has_snapshot)}
          syncing={loading || sourceSyncing}
          syncDisabled={loading || sourceSyncing || sinFuentesFull}
          syncLabel="Todo"
          syncTitle={sinFuentesFull ? motivoSinFuentes("full") : "Actualizar todas las fuentes activas"}
          onSyncAll={() => { void runProfileSourceSync("full"); }}
          advanceSyncDisabled={loading || sourceSyncing || sinFuentesAvance}
          advanceSyncLabel="Avance"
          advanceSyncTitle={sinFuentesAvance ? motivoSinFuentes("advance") : refreshTitle}
          onSyncAdvance={() => { void runProfileSourceSync("advance"); }}
          onCambioSeccion={navigateSection}
        />

        <MonitoreoWorkbenchChrome
          seccionActiva={seccionActiva}
          ariaLabel={`Mesa de trabajo de ${isPhone ? "monitoreo telefónico" : "acreditación"}: ${activeDef.label}`}
          className="is-acreditacion"
          contentRole="tabpanel"
          contentAriaLabelledBy={`monitoreo-${seccionActiva}-tab-${pestanaActiva}`}
          scrollResetKey={`${seccionActiva}/${pestanaActiva}`}
          rail={(
            <AcreditacionWorkbenchRail
              route={route}
              seccionActiva={seccionActiva}
              pestanaActiva={pestanaActiva}
              onCambioPestana={changeLocalTab}
              syncedAt={state?.synced_at ?? ""}
              state={state}
              reports={reports}
            />
          )}
          head={(
            <AcreditacionWorkbenchHead
              route={route}
              seccionActiva={seccionActiva}
              pestanaActiva={pestanaActiva}
              state={state}
              reports={reports}
            />
          )}
          clarity={(
            <AcreditacionClarityStrip
              seccionActiva={seccionActiva}
              state={state}
              reports={reports}
            />
          )}
          status={null}
        >
          {seccionCargando ? (
            <AcreditacionLoadingPanel view={seccionActiva} label={activeDef.label} phoneMode={isPhone} />
          ) : renderAcreditacionView(seccionActiva, reports, {
            activeSourceTab,
            activeModelTab,
            activeConsultaTab,
            activePhoneTab,
            activeAdvanceTab,
            acreditacion: state?.acreditacion ?? null,
            actionStatus,
            caseReconciliationBusyId,
            caseReconciliationStatus,
            onSaveSeguimiento: saveSeguimiento,
            onCerrar: closeAcreditacion,
            onConsultaTabChange: setActiveConsultaTab,
            onCaseReconciliationDecision: saveCaseReconciliationDecision,
            state,
            onStateChange: applyStateChange,
            onPublished: refreshCurrentView,
            onNavigateLocalTab: navigateLocalTab,
            routeLabel: profileLabel,
            savingAcreditacion,
            fuentesActivas: activeSources,
            fuentesRequeridas: sourceTotal,
          })}
        </MonitoreoWorkbenchChrome>
      </PageFrame>
    </div>
  );
}

export default function TelefonicoMonitoreoPage() {
  return <AcreditacionProfilePage mode="telefonico" />;
}
