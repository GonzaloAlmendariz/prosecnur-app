import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  apiV2InstrumentoDrill,
  apiV2Limpieza,
  apiV2LimpiezaDecisionDelete,
  apiV2LimpiezaDecisionSave,
  apiV2LimpiezaFinalize,
  apiV2LimpiezaRevertirPromocion,
  type InstrumentoDrillResult,
} from "../../../api/client";
import type {
  DecisionesPreservadas,
  LimpiezaArtifactsBundle,
  LimpiezaDecision,
  LimpiezaDecisionActionType,
  LimpiezaQueueItem,
  LimpiezaSummary,
  ReglaTreatmentScope,
} from "../types";
import { EmptyState, LoadingBlock } from "../../../components/States";
import PromocionBase from "../components/PromocionBase";
import { extractArtifacts } from "../limpiezaArtifacts";
import { useValidacionStore } from "../store";
import {
  RuleNarrative,
  DecisionStorageBar,
  VariableChip,
} from "../components/v2";
import type {
  DecisionCounts,
  DecisionKind,
  ReglaLike,
  VariableHoverData,
} from "../components/v2";

// =============================================================================
// Limpieza y transformación
// =============================================================================
// Tab de cierre: decide qué hacer con cada hallazgo (documentar, excluir
// o corregir valores) y genera la base final.
//
// Dos zonas:
//   1. StatusBar: estado del cierre, progreso, CTA de cerrar base.
//   2. Workbench: cola de hallazgos + editor de decisión con flujo
//      "Guardar y siguiente" (Cmd/Ctrl+Enter) que auto-avanza al siguiente
//      pendiente.
// =============================================================================

const NEW_DECISION = "__new__";

const numberFormatter = new Intl.NumberFormat("es-PE");
const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type EditorForm = {
  id: string;
  source_type: LimpiezaDecision["source_type"];
  action_type: LimpiezaDecisionActionType;
  target_variable: string;
  rationale: string;
  scope_mode: ReglaTreatmentScope;
  use_all_cases: boolean;
  target_case_ids: string[];
  replace_from: string;
  replace_to: string;
  normalize_from: string;
  normalize_to: string;
  hierarchy_map_json: string;
  set_value: string;
  recode_map_json: string;
  nullify_variables_text: string;
  sm_add_codes: string;
  sm_remove_codes: string;
  impute_method: "fixed" | "mode" | "median";
  impute_fixed_value: string;
};

type CaseRow = {
  id: string;
  raw: Record<string, unknown>;
  summary: string;
};

type ChoiceOption = {
  code: string;
  label: string;
  n: number | null;
};

type DecisionReadiness = {
  ready: boolean;
  issues: string[];
};

const ACTION_OPTIONS: Array<{
  value: LimpiezaDecisionActionType;
  label: string;
}> = [
  { value: "ignore_rule", label: "Registrar sin cambios" },
  { value: "replace_value", label: "Corregir valor" },
  { value: "set_value", label: "Asignar valor" },
  { value: "recode_map", label: "Recodificar equivalencias" },
  { value: "complete_select_multiple_hierarchy", label: "Completar selección múltiple" },
  { value: "adjust_select_multiple", label: "Agregar o quitar opciones" },
  { value: "nullify_fields", label: "Anular campos" },
  { value: "exclude_cases", label: "Excluir registros" },
];

const LEGACY_ACTION_OPTIONS: Array<{
  value: LimpiezaDecisionActionType;
  label: string;
}> = [
  { value: "normalize_value", label: "Normalizar valor (anterior)" },
  { value: "impute_value", label: "Imputar (anterior)" },
];

// -----------------------------------------------------------------------------
// Helper: derivar distribución de decisiones para DecisionStorageBar.
// Los counts son por CASOS (no por reglas) — cada regla con decisión lista
// contribuye sus n_casos al kind correspondiente. Las pendientes van al
// segmento striped.
// -----------------------------------------------------------------------------
function deriveDecisionCounts(queue: LimpiezaQueueItem[]): DecisionCounts {
  const counts: DecisionCounts = {
    ignore: 0, exclude: 0, change: 0, pending: 0,
  };
  for (const item of queue) {
    const n = item.n_casos ?? 0;
    if (!n) continue;
    const covered = item.n_casos_cubiertos ?? (item.pending ? 0 : n);
    const pending = item.n_casos_pendientes ?? (item.pending ? n : 0);
    if (pending > 0) counts.pending += pending;
    if (covered <= 0) continue;
    // Item tiene decisión lista — inferir kind desde current_action (string
    // legible) o source_type.
    const action = (item.current_action ?? "").toLowerCase();
    if (isDocumentedActionLabel(action)) counts.ignore += covered;
    else if (action.startsWith("excluir")) counts.exclude += covered;
    else if (isCorrectionActionLabel(action)) counts.change += covered;
    else counts.ignore += covered; // fallback conservador si el label no calza
  }
  return counts;
}

function isDocumentedActionLabel(action: string) {
  return action.startsWith("documentar") || action.startsWith("no modificar") || action.startsWith("ignorar");
}

function isCorrectionActionLabel(action: string) {
  return (
    action.startsWith("corregir") ||
    action.startsWith("reemplazar") ||
    action.startsWith("asignar") ||
    action.startsWith("recodificar") ||
    action.startsWith("anular") ||
    action.startsWith("ajustar") ||
    action.startsWith("normalizar") ||
    action.startsWith("imputar") ||
    action.startsWith("completar")
  );
}

function actionOptionsFor(actionType: LimpiezaDecisionActionType, item?: LimpiezaQueueItem | null) {
  const smSuggested = isSelectMultipleItem(item);
  const values = new Set<LimpiezaDecisionActionType>([
    "ignore_rule",
    "replace_value",
    "set_value",
    "recode_map",
    "nullify_fields",
    "exclude_cases",
  ]);
  if (smSuggested || actionType === "complete_select_multiple_hierarchy" || actionType === "adjust_select_multiple") {
    values.add("complete_select_multiple_hierarchy");
    values.add("adjust_select_multiple");
  }
  const base = ACTION_OPTIONS.filter((option) => values.has(option.value));
  if (actionType === "normalize_value" || actionType === "impute_value") {
    return [
      ...base,
      ...LEGACY_ACTION_OPTIONS.filter((option) => option.value === actionType),
    ];
  }
  return base;
}

// Convierte un LimpiezaQueueItem al shape ReglaLike que consume RuleNarrative.
function queueItemToRule(
  item: LimpiezaQueueItem,
  drill?: InstrumentoDrillResult | null,
): ReglaLike {
  const reglaDrill = drill?.regla;
  return {
    id: item.source_id,
    nombre: item.nombre_regla,
    tipo_regla: item.tipo_regla,
    tipo_observacion: item.tipo_observacion,
    tipo_variable: item.tipo_variable,
    fuente: item.fuente,
    hallazgo_kind: item.hallazgo_kind ?? null,
    origen_detalle: item.origen_detalle ?? null,
    severidad: item.severidad,
    categoria_ux: item.categoria_ux,
    objetivo: reglaDrill?.objetivo ?? null,
    variables: item.variables ?? [],
    variable_roles: null, // derivar por fallback (primera var = target)
    presentation: null,
    n_casos: item.n_casos,
    porcentaje: item.porcentaje,
  };
}

// Hover data para una variable: label del instrumento + sección + tabla, si hay drill.
// Deriva label por variable desde drill.regla.variable_roles.labels (si viene)
// y usa tables para inferir el grupo.
function buildVariableHoverLookup(
  drill: InstrumentoDrillResult | null,
): (varName: string) => VariableHoverData | undefined {
  if (!drill?.regla) return () => undefined;
  const seccion = drill.regla.seccion ?? null;
  const roles = drill.regla.variable_roles ?? null;
  const labels = roles?.labels ?? null;
  const tables = roles?.tables ?? null;
  return (varName: string): VariableHoverData | undefined => {
    if (!varName) return undefined;
    return {
      label: labels?.[varName] ?? null,
      seccion,
      grupo: tables?.[varName] ?? null,
    };
  };
}

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------
export default function LimpiezaTab() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);

  const [data, setData] = useState<LimpiezaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);

  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>("");

  const [drill, setDrill] = useState<InstrumentoDrillResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");

  const [form, setForm] = useState<EditorForm>(() => emptyEditorForm());
  // Filtro por kind de decisión activado desde DecisionStorageBar. Null = sin filtro.
  const [activeFilterKind, setActiveFilterKind] = useState<DecisionKind | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const loadLimpieza = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (opts?.quiet) setRefreshBusy(true);
      else setLoading(true);
      setError("");
      try {
        const next = await apiV2Limpieza(baseNombre);
        setData(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (opts?.quiet) setRefreshBusy(false);
        else setLoading(false);
      }
    },
    [baseNombre],
  );

  useEffect(() => {
    setSelectedSourceId("");
    setSelectedDecisionId("");
    setDrill(null);
    setDrillError("");
    setNotice("");
    setActionError("");
    setForm(emptyEditorForm());
    void loadLimpieza();
  }, [baseNombre, version, loadLimpieza]);

  // Orden de la cola: pendientes primero (arriba), listos al fondo.
  const orderedQueue = useMemo(() => {
    if (!data) return [];
    return [...data.decision_queue].sort((a, b) => {
      if (a.pending !== b.pending) return a.pending ? -1 : 1;
      return (b.n_casos ?? 0) - (a.n_casos ?? 0);
    });
  }, [data]);

  // Distribución por tipo de decisión (alimenta DecisionStorageBar).
  const decisionCounts = useMemo(() => deriveDecisionCounts(orderedQueue), [orderedQueue]);

  const availableSourceIds = useMemo(
    () =>
      uniqueStrings([
        ...orderedQueue.map((item) => item.source_id),
        ...(data?.decision_draft ?? []).map((decision) => decision.source_id),
      ]),
    [data?.decision_draft, orderedQueue],
  );

  useEffect(() => {
    if (!availableSourceIds.length) {
      setSelectedSourceId("");
      setSelectedDecisionId(NEW_DECISION);
      return;
    }
    setSelectedSourceId((current) => {
      if (current && availableSourceIds.includes(current)) return current;
      // Auto-selecciona el primer pendiente al entrar.
      const firstPending = orderedQueue.find((item) => item.pending);
      return firstPending?.source_id ?? availableSourceIds[0];
    });
  }, [availableSourceIds, orderedQueue]);

  const selectedQueueItem = useMemo(
    () => data?.decision_queue.find((item) => item.source_id === selectedSourceId) ?? null,
    [data, selectedSourceId],
  );

  const relatedDecisions = useMemo(() => {
    if (!data || !selectedSourceId) return [];
    return [...data.decision_draft]
      .filter((decision) => decision.source_id === selectedSourceId)
      .sort((a, b) => {
        const left = new Date(b.updated_at ?? 0).getTime();
        const right = new Date(a.updated_at ?? 0).getTime();
        return left - right;
      });
  }, [data, selectedSourceId]);

  useEffect(() => {
    setSelectedDecisionId((current) => {
      if (!selectedSourceId) return NEW_DECISION;
      if (current === NEW_DECISION) return current;
      if (relatedDecisions.some((decision) => decision.id === current)) return current;
      return relatedDecisions[0]?.id ?? NEW_DECISION;
    });
  }, [relatedDecisions, selectedSourceId]);

  const selectedDecision = useMemo(() => {
    if (selectedDecisionId === NEW_DECISION) return null;
    return relatedDecisions.find((decision) => decision.id === selectedDecisionId) ?? null;
  }, [relatedDecisions, selectedDecisionId]);

  // Drill de casos observados para la regla seleccionada.
  useEffect(() => {
    if (!selectedSourceId || !data?.progreso.auditoria_corrida) {
      setDrill(null);
      setDrillError("");
      return;
    }
    let cancelled = false;
    setDrillLoading(true);
    setDrillError("");
    apiV2InstrumentoDrill(selectedSourceId, baseNombre)
      .then((out) => {
        if (!cancelled) setDrill(out);
      })
      .catch((err) => {
        if (!cancelled) {
          setDrill(null);
          setDrillError((err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setDrillLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseNombre, data?.progreso.auditoria_corrida, selectedSourceId]);

  const variableOptions = useMemo(() => {
    const drillVars = drill?.regla.variables ?? [];
    const queueVars = selectedQueueItem?.variables ?? [];
    const firstRowKeys = drill?.casos.length ? Object.keys(drill.casos[0] ?? {}) : [];
    return uniqueStrings([
      ...queueVars,
      ...drillVars,
      ...firstRowKeys.filter((key) => !isSystemColumn(key) && key !== (drill?.uuid_col ?? "")),
    ]);
  }, [drill, selectedQueueItem]);

  const caseRows = useMemo(() => buildCaseRows(drill, selectedQueueItem), [drill, selectedQueueItem]);

  const caseColumns = useMemo(() => {
    const preferred = uniqueStrings([
      ...(selectedQueueItem?.variables ?? []),
      ...(drill?.regla.variables ?? []),
    ]);
    const firstKeys = caseRows.length ? Object.keys(caseRows[0].raw) : [];
    return uniqueStrings([
      ...preferred,
      ...firstKeys.filter((key) => !isSystemColumn(key) && key !== (drill?.uuid_col ?? "")),
    ]).slice(0, 4);
  }, [caseRows, drill?.regla.variables, drill?.uuid_col, selectedQueueItem?.variables]);

  useEffect(() => {
    if (!selectedSourceId) {
      setForm(emptyEditorForm());
      return;
    }
    setForm(buildEditorForm(selectedSourceId, selectedQueueItem, selectedDecision, variableOptions));
    setActionError("");
  }, [selectedDecision, selectedQueueItem, selectedSourceId, variableOptions]);

  const artifacts = useMemo(() => extractArtifacts(data?.artifacts), [data?.artifacts]);
  const canFinalize = !!data?.progreso.auditoria_corrida && !!data?.summary.ready_to_finalize;
  const selectedCaseIdsSet = useMemo(() => new Set(form.target_case_ids), [form.target_case_ids]);

  // Navegación por cola: siguiente/anterior pendiente.
  const findNextPendingSourceId = useCallback(
    (skipId: string): string | null => {
      const pendings = orderedQueue.filter((item) => item.pending && item.source_id !== skipId);
      return pendings[0]?.source_id ?? null;
    },
    [orderedQueue],
  );

  const navigateQueue = useCallback(
    (direction: "next" | "prev") => {
      if (!orderedQueue.length) return;
      const idx = orderedQueue.findIndex((item) => item.source_id === selectedSourceId);
      if (idx < 0) {
        setSelectedSourceId(orderedQueue[0].source_id);
        return;
      }
      const nextIdx =
        direction === "next"
          ? Math.min(orderedQueue.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      if (nextIdx === idx) return;
      setSelectedSourceId(orderedQueue[nextIdx].source_id);
      setSelectedDecisionId(NEW_DECISION);
      editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [orderedQueue, selectedSourceId],
  );

  async function handleSave(status: "draft" | "ready", options?: { advance?: boolean }) {
    if (!selectedSourceId) return;
    setSaveBusy(true);
    setActionError("");
    setNotice("");
    try {
      const coversSelectedHallazgo =
        form.action_type === "ignore_rule" ||
        form.use_all_cases ||
        (caseRows.length > 0 && form.target_case_ids.length >= caseRows.length);
      const payload = buildDecisionPayload({
        form,
        status,
        sourceId: selectedSourceId,
        sourceType: selectedQueueItem?.source_type ?? inferSourceType(selectedSourceId),
      });
      const response = await apiV2LimpiezaDecisionSave(payload, baseNombre);
      setSelectedDecisionId(response.decision.id);
      await loadLimpieza({ quiet: true });

      if (status === "ready" && options?.advance) {
        if (!coversSelectedHallazgo) {
          setSelectedDecisionId(NEW_DECISION);
          setNotice("Decisión guardada. Este hallazgo aún tiene registros pendientes.");
          editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        const nextId = findNextPendingSourceId(selectedSourceId);
        if (nextId) {
          setSelectedSourceId(nextId);
          setSelectedDecisionId(NEW_DECISION);
          setNotice("Decisión guardada. Siguiente hallazgo cargado.");
          editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setNotice("Todo listo. Ya puedes cerrar la base.");
        }
      } else if (status === "ready") {
        setNotice("Decisión lista para aplicar.");
      } else {
        setNotice("Borrador guardado.");
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleDeleteDecision() {
    if (!selectedDecision || !selectedDecision.id) return;
    setSaveBusy(true);
    setActionError("");
    setNotice("");
    try {
      await apiV2LimpiezaDecisionDelete(selectedDecision.id, baseNombre);
      setSelectedDecisionId(NEW_DECISION);
      setNotice("Decisión eliminada del borrador.");
      await loadLimpieza({ quiet: true });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleFinalize() {
    setFinalizeBusy(true);
    setActionError("");
    setNotice("");
    try {
      await apiV2LimpiezaFinalize(baseNombre);
      setNotice("Base limpia generada.");
      await loadLimpieza({ quiet: true });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setFinalizeBusy(false);
    }
  }

  // ADR 0076 — revertir la promoción devuelve la base anterior al estudio. Las
  // decisiones no se tocan; lo que se pierde es el estado aguas abajo, que el
  // backend invalida porque el insumo volvió a cambiar.
  async function handleRevertirPromocion() {
    setRevertBusy(true);
    setActionError("");
    setNotice("");
    try {
      await apiV2LimpiezaRevertirPromocion(baseNombre);
      setNotice("La base del estudio volvió a la versión anterior al cierre.");
      await loadLimpieza({ quiet: true });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRevertBusy(false);
    }
  }

  // Atajos de teclado: Cmd/Ctrl+Enter = Guardar y siguiente.
  //                    Cmd/Ctrl+Shift+Enter = Guardar borrador.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!selectedSourceId) return;
      const isEnter = event.key === "Enter";
      const hasCmd = event.metaKey || event.ctrlKey;
      if (!isEnter || !hasCmd || saveBusy) return;
      event.preventDefault();
      if (event.shiftKey) {
        void handleSave("draft");
      } else {
        void handleSave("ready", { advance: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceId, saveBusy, form]);

  // ---------- render ----------
  if (loading) return <LoadingBlock label="Cargando Limpieza y transformación…" />;

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="No se pudo cargar la sección"
        hint={error}
      />
    );
  }

  if (!data) return null;

  const auditReady = !!data.progreso.auditoria_corrida;
  const preservadas = describirDecisionesPreservadas(data.decisiones_preservadas);

  return (
    <div
      data-audit-ready="validacion-limpieza"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <StatusBar
        auditReady={auditReady}
        canFinalize={canFinalize}
        finalizedAt={artifacts?.finalized_at}
        refreshBusy={refreshBusy}
        finalizeBusy={finalizeBusy}
        decisionCounts={decisionCounts}
        activeFilterKind={activeFilterKind}
        onFilterKind={setActiveFilterKind}
        onRefresh={() => void loadLimpieza({ quiet: true })}
        onFinalize={() => void handleFinalize()}
      />

      <PromocionBase
        promocion={artifacts?.promocion}
        busy={revertBusy}
        onRevertir={() => void handleRevertirPromocion()}
      />

      {/* En verde a propósito: no es una alerta sino la buena noticia de que
          recargar el instrumento ya no cuesta las exclusiones. Además la banda
          de "Corre la auditoría" que va debajo es ámbar, y dos del mismo tono
          pegadas se leen como una sola. */}
      {preservadas && (
        <InlineMessage
          tone={preservadas.tone}
          icon={preservadas.tone === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          text={preservadas.texto}
        />
      )}
      {notice && (
        <InlineMessage tone="success" icon={<CheckCircle2 size={14} />} text={notice} />
      )}
      {actionError && (
        <InlineMessage tone="danger" icon={<AlertTriangle size={14} />} text={actionError} />
      )}
      {!auditReady && (
        <InlineMessage
          tone="warn"
          icon={<AlertTriangle size={14} />}
          text="Corre la auditoría para habilitar las decisiones y el cierre de base."
        />
      )}

      <Workbench
        queue={orderedQueue}
        selectedSourceId={selectedSourceId}
        onSelect={(sourceId) => {
          setSelectedSourceId(sourceId);
          setSelectedDecisionId(NEW_DECISION);
          editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        auditReady={auditReady}
        editorRef={editorRef}
        activeFilterKind={activeFilterKind}
        onClearFilterKind={() => setActiveFilterKind(null)}
        drill={drill}
      >
        {!selectedSourceId ? (
          <EditorEmpty auditReady={auditReady} />
        ) : (
          <EditorPanel
            item={selectedQueueItem}
            drill={drill}
            form={form}
            setForm={setForm}
            variableOptions={variableOptions}
            caseRows={caseRows}
            caseColumns={caseColumns}
            selectedCaseIdsSet={selectedCaseIdsSet}
            drillLoading={drillLoading}
            drillError={drillError}
            relatedDecisions={relatedDecisions}
            selectedDecisionId={selectedDecisionId}
            onPickHistory={(id) => setSelectedDecisionId(id)}
            onNewDecision={() => setSelectedDecisionId(NEW_DECISION)}
            historyOpen={historyOpen}
            setHistoryOpen={setHistoryOpen}
            saveBusy={saveBusy}
            onSaveDraft={() => void handleSave("draft")}
            onSaveAndNext={() => void handleSave("ready", { advance: true })}
            onDelete={() => void handleDeleteDecision()}
            onNav={navigateQueue}
            canDelete={!!selectedDecision}
          />
        )}
      </Workbench>
    </div>
  );
}

// =============================================================================
// Zona 1 — StatusBar (sticky, compacto)
// =============================================================================
function StatusBar({
  auditReady,
  canFinalize,
  finalizedAt,
  refreshBusy,
  finalizeBusy,
  decisionCounts,
  activeFilterKind,
  onFilterKind,
  onRefresh,
  onFinalize,
}: {
  auditReady: boolean;
  canFinalize: boolean;
  finalizedAt?: string;
  refreshBusy: boolean;
  finalizeBusy: boolean;
  decisionCounts: DecisionCounts;
  activeFilterKind: DecisionKind | null;
  onFilterKind: (k: DecisionKind | null) => void;
  onRefresh: () => void;
  onFinalize: () => void;
}) {
  const total =
    decisionCounts.ignore +
    decisionCounts.exclude +
    decisionCounts.change +
    decisionCounts.pending;

  const statusLabel = !auditReady
    ? "Sin auditoría"
    : canFinalize
      ? "Listo para cerrar"
      : decisionCounts.pending > 0
        ? `${decisionCounts.pending} caso${decisionCounts.pending === 1 ? "" : "s"} pendiente${decisionCounts.pending === 1 ? "" : "s"}`
        : "En preparación";

  const statusTone: "neutral" | "success" | "warn" = !auditReady
    ? "warn"
    : canFinalize
      ? "success"
      : "neutral";

  return (
    <section
      style={{
        position: "sticky",
        top: 0,
        zIndex: 4,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 18px",
        borderRadius: "var(--pulso-radius-panel)",
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface)",
        boxShadow: "var(--pulso-shadow-soft)",
      }}
    >
      {/* Fila 1: título + estado + botones */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--pulso-text)" }}>
              Limpieza y transformación
            </div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              {finalizedAt
                ? `Último cierre: ${formatDateTime(finalizedAt)}`
                : "Decisiones sobre los hallazgos detectados"}
            </div>
          </div>
          <StatusPill tone={statusTone} label={statusLabel} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshBusy}
            style={secondaryButtonStyle}
          >
            {refreshBusy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCcw size={13} />}
            Recalcular
          </button>
          <button
            type="button"
            onClick={onFinalize}
            disabled={!canFinalize || finalizeBusy}
            className="pulso-primary"
            style={primaryButtonStyle}
          >
            {finalizeBusy ? <Loader2 size={13} className="pulso-spin" /> : <Check size={13} />}
            Cerrar y generar base
          </button>
        </div>
      </div>

      {/* Fila 2: barra de decisiones estilo almacenamiento. Solo si hay queue. */}
      {total > 0 && (
        <DecisionStorageBar
          counts={decisionCounts}
          activeKind={activeFilterKind}
          onSelectKind={(k) =>
            activeFilterKind === k ? onFilterKind(null) : onFilterKind(k)
          }
          showLegend
          showTotals
          height={14}
        />
      )}
    </section>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "neutral" | "success" | "warn";
  label: string;
}) {
  const colors =
    tone === "success"
      ? { bg: "var(--pulso-success-bg)", border: "var(--pulso-success-border)", fg: "var(--pulso-success-fg)" }
      : tone === "warn"
        ? { bg: "var(--pulso-warn-bg)", border: "var(--pulso-warn-border)", fg: "var(--pulso-warn-fg)" }
        : { bg: "var(--pulso-surface-2)", border: "var(--pulso-border)", fg: "var(--pulso-text-soft)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.3,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.fg,
      }}
    >
      {label}
    </span>
  );
}

// =============================================================================
// Zona 2 — Workbench (cola + editor)
// =============================================================================
function Workbench({
  queue,
  selectedSourceId,
  onSelect,
  auditReady,
  editorRef,
  activeFilterKind,
  onClearFilterKind,
  drill,
  children,
}: {
  queue: LimpiezaQueueItem[];
  selectedSourceId: string;
  onSelect: (sourceId: string) => void;
  auditReady: boolean;
  editorRef: React.RefObject<HTMLDivElement>;
  activeFilterKind: DecisionKind | null;
  onClearFilterKind: () => void;
  drill: InstrumentoDrillResult | null;
  children: ReactNode;
}) {
  // Filtro por categoría UX (taxonomía nueva). "all" = sin filtro.
  const [filterCat, setFilterCat] = useState<string>("all");
  const categoriasUx = useMemo(() => {
    const set = new Map<string, number>();
    for (const item of queue) {
      const cat = item.categoria_ux || "Otras";
      set.set(cat, (set.get(cat) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
  }, [queue]);

  const filteredQueue = useMemo(() => {
    let q = queue;
    if (filterCat !== "all") {
      q = q.filter((item) => (item.categoria_ux || "Otras") === filterCat);
    }
    if (activeFilterKind) {
      q = q.filter((item) => {
        const action = (item.current_action ?? "").toLowerCase();
        if (activeFilterKind === "pending") return item.pending;
        if (activeFilterKind === "ignore") return isDocumentedActionLabel(action);
        if (activeFilterKind === "exclude") return action.startsWith("excluir");
        if (activeFilterKind === "change") return isCorrectionActionLabel(action);
        return true;
      });
    }
    return q;
  }, [queue, filterCat, activeFilterKind]);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.6fr)",
        gap: 16,
        alignItems: "stretch",
      }}
    >
      <aside
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "16px",
          borderRadius: 16,
          border: "1px solid var(--pulso-border)",
          background: "white",
          boxShadow: "var(--pulso-shadow-low)",
          maxHeight: 780,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pulso-text)" }}>
              Cola de hallazgos
            </div>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              {filterCat === "all" ? queue.length : `${filteredQueue.length} / ${queue.length}`}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            Las pendientes aparecen primero; las que ya decidiste bajan al final.
          </div>
        </header>

        {auditReady && categoriasUx.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            <FilterChip
              label="Todas"
              count={queue.length}
              active={filterCat === "all"}
              onClick={() => setFilterCat("all")}
            />
            {categoriasUx.map(([cat, count]) => (
              <FilterChip
                key={cat}
                label={cat}
                count={count}
                active={filterCat === cat}
                onClick={() => setFilterCat(cat)}
              />
            ))}
          </div>
        )}

        {activeFilterKind && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 10,
              background: "var(--pulso-primary-soft)",
              border: "1px solid var(--pulso-primary-border)",
              fontSize: 11,
              color: "var(--pulso-primary)",
              fontWeight: 700,
            }}
          >
            <span>Filtrado por tipo de decisión</span>
            <button
              type="button"
              onClick={onClearFilterKind}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid var(--pulso-primary-border)",
                background: "white",
                color: "var(--pulso-primary)",
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
          </div>
        )}

        {!auditReady ? (
          <div style={emptyDashedStyle}>
            La cola aparece después de correr la auditoría.
          </div>
        ) : queue.length === 0 ? (
          <div style={emptyDashedStyle}>
            No hay hallazgos pendientes.
          </div>
        ) : filteredQueue.length === 0 ? (
          <div style={emptyDashedStyle}>
            No hay hallazgos en «{filterCat}».
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 }}>
            {filteredQueue.map((item, idx) => {
              // Insertar un separador "Ya decididas" justo antes del primer
              // item no-pending (cuando hay al menos uno pendiente antes).
              const prev = idx > 0 ? filteredQueue[idx - 1] : null;
              const showDivider = !item.pending && (prev?.pending ?? false);
              return (
                <div key={item.source_id}>
                  {showDivider && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        margin: "8px 2px 10px",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "var(--pulso-text-soft)",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      <span>Ya decididas</span>
                      <span style={{ flex: 1, height: 1, background: "var(--pulso-border)" }} />
                    </div>
                  )}
                  <QueueRow
                    item={item}
                    selected={item.source_id === selectedSourceId}
                    onClick={() => onSelect(item.source_id)}
                    drill={item.source_id === selectedSourceId ? drill : null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </aside>

      <div
        ref={editorRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "18px",
          borderRadius: 16,
          border: "1px solid var(--pulso-border)",
          background: "white",
          boxShadow: "var(--pulso-shadow-low)",
          maxHeight: 780,
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function QueueRow({
  item,
  selected,
  onClick,
  drill,
}: {
  item: LimpiezaQueueItem;
  selected: boolean;
  onClick: () => void;
  drill: InstrumentoDrillResult | null;
}) {
  const rule = useMemo(() => queueItemToRule(item, drill), [item, drill]);
  const variableHoverLookup = useMemo(() => buildVariableHoverLookup(drill), [drill]);
  return (
    <RuleNarrative
      rule={rule}
      variant="compact"
      status={item.pending ? "pending" : "ready"}
      selected={selected}
      onClick={onClick}
      nCasos={item.n_casos ?? null}
      porcentaje={item.porcentaje ?? null}
      currentAction={item.current_action ?? null}
      variableHoverLookup={variableHoverLookup}
      // Sin hover en la cola: con muchas reglas pendientes los portals
      // se acumulaban y tiraban la app. El hovercard rico aparece en el
      // hero del editor (a la derecha), donde sí aporta valor.
      disableVariableHover
    />
  );
}

// Chip con el filtro por categoria_ux (pildorazo clickeable).
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        border: `1px solid ${active ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        background: active ? "var(--pulso-primary-soft)" : "white",
        color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ opacity: 0.65 }}>{count}</span>
    </button>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "error"
      ? "var(--pulso-danger-fg)"
      : severity === "advertencia"
        ? "var(--pulso-warn-fg)"
        : "var(--pulso-text-soft)";
  return (
    <span
      aria-label={severity}
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: color,
        marginTop: 3,
        flexShrink: 0,
      }}
    />
  );
}

function EditorEmpty({ auditReady }: { auditReady: boolean }) {
  return (
    <div style={{ ...emptyDashedStyle, padding: "40px 20px", textAlign: "center" }}>
      {auditReady
        ? "Selecciona un hallazgo de la cola para decidir."
        : "Corre la auditoría para poder decidir sobre las reglas."}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Editor de decisión (3 bloques visuales + historial colapsable)
// -----------------------------------------------------------------------------
function EditorPanel({
  item,
  drill,
  form,
  setForm,
  variableOptions,
  caseRows,
  caseColumns,
  selectedCaseIdsSet,
  drillLoading,
  drillError,
  relatedDecisions,
  selectedDecisionId,
  onPickHistory,
  onNewDecision,
  historyOpen,
  setHistoryOpen,
  saveBusy,
  onSaveDraft,
  onSaveAndNext,
  onDelete,
  onNav,
  canDelete,
}: {
  item: LimpiezaQueueItem | null;
  drill: InstrumentoDrillResult | null;
  form: EditorForm;
  setForm: Dispatch<SetStateAction<EditorForm>>;
  variableOptions: string[];
  caseRows: CaseRow[];
  caseColumns: string[];
  selectedCaseIdsSet: Set<string>;
  drillLoading: boolean;
  drillError: string;
  relatedDecisions: LimpiezaDecision[];
  selectedDecisionId: string;
  onPickHistory: (id: string) => void;
  onNewDecision: () => void;
  historyOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  saveBusy: boolean;
  onSaveDraft: () => void;
  onSaveAndNext: () => void;
  onDelete: () => void;
  onNav: (direction: "next" | "prev") => void;
  canDelete: boolean;
}) {
  const needsVariable = actionNeedsVariable(form.action_type);
  const allowsCaseSubset = form.action_type !== "ignore_rule";
  const selectable = allowsCaseSubset && !form.use_all_cases;

  // Rule narrativo para el hero del editor.
  const heroRule = useMemo(
    () => (item ? queueItemToRule(item, drill) : null),
    [item, drill],
  );
  const variableHoverLookup = useMemo(
    () => buildVariableHoverLookup(drill),
    [drill],
  );
  const choiceOptions = useMemo(
    () => buildChoiceOptions(drill, form.target_variable),
    [drill, form.target_variable],
  );
  const choiceOptionsByCode = useMemo(
    () => new Map(choiceOptions.map((option) => [option.code, option])),
    [choiceOptions],
  );
  const readiness = useMemo(
    () => getDecisionReadiness(form),
    [form],
  );
  const selectedCount = form.use_all_cases ? caseRows.length : form.target_case_ids.length;
  const coversWholeFinding =
    form.action_type === "ignore_rule" ||
    form.use_all_cases ||
    (caseRows.length > 0 && form.target_case_ids.length >= caseRows.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {item && heroRule && (
        <RuleNarrative
          rule={heroRule}
          variant="hero"
          nCasos={item.n_casos ?? null}
          porcentaje={item.porcentaje ?? null}
          status={item.pending ? "pending" : "ready"}
          variableHoverLookup={variableHoverLookup}
        />
      )}

      {/* Grid 2 columnas: formulario a la izquierda, casos + contexto a la derecha. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Columna izquierda: formulario de decisión */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Bloque 1: ¿Qué hacer? */}
          <DecisionBlock title="¿Qué hacer?">
        <FormField label="Acción">
          <select
            value={form.action_type}
            onChange={(event) => {
              const nextAction = event.target.value as LimpiezaDecisionActionType;
              setForm((current) => ({
                ...current,
                action_type: nextAction,
                scope_mode: nextAction === "ignore_rule" ? "all" : current.scope_mode,
                use_all_cases: nextAction === "ignore_rule" ? true : current.use_all_cases,
                target_case_ids: nextAction === "ignore_rule"
                  ? []
                  : current.scope_mode === "single"
                    ? current.target_case_ids.slice(0, 1)
                    : current.target_case_ids,
                target_variable: actionNeedsVariable(nextAction)
                  ? current.target_variable || variableOptions[0] || ""
                  : "",
              }));
            }}
            style={inputStyle}
          >
            {actionOptionsFor(form.action_type, item).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        {needsVariable && (
          <FormField label="Variable objetivo">
            <select
              value={form.target_variable}
              onChange={(event) => {
                const variable = event.target.value;
                setForm((current) => ({ ...current, target_variable: variable }));
              }}
              style={inputStyle}
            >
              {variableOptions.length === 0 ? (
                <option value="">Sin variables detectadas</option>
              ) : (
                variableOptions.map((variable) => (
                  <option key={variable} value={variable}>
                    {variable}
                  </option>
                ))
              )}
            </select>
          </FormField>
        )}

        {renderActionSpecificFields(form, setForm, choiceOptions)}
      </DecisionBlock>

      {/* Bloque 2: ¿Sobre qué casos? */}
      {allowsCaseSubset && (
        <DecisionBlock title="¿Sobre qué casos?">
          <ScopeModeSelector
            value={form.scope_mode}
            totalCases={caseRows.length}
            selectedCount={selectedCount}
            onChange={(mode) => {
              setForm((current) => ({
                ...current,
                scope_mode: mode,
                use_all_cases: mode === "all",
                target_case_ids: mode === "all"
                  ? []
                  : mode === "single"
                    ? current.target_case_ids.slice(0, 1)
                    : current.target_case_ids,
              }));
            }}
          />
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {form.scope_mode === "all"
              ? "La acción se aplicará a todos los hallazgos de esta señal."
              : form.scope_mode === "single"
                ? "Selecciona un registro. Para resolver otros registros, guarda otra decisión para este mismo hallazgo."
                : "Selecciona los registros a los que aplicarás esta decisión."}
          </div>
      </DecisionBlock>
      )}

          <DecisionApplySummary
            form={form}
            readiness={readiness}
            totalCases={caseRows.length}
            selectedCount={selectedCount}
            optionsByCode={choiceOptionsByCode}
          />

          {/* Bloque 3: ¿Por qué? */}
          <DecisionBlock title="¿Por qué?">
            <FormField label="Justificación (obligatoria para dejar lista)">
              <textarea
                value={form.rationale}
                onChange={(event) => {
                  const rationale = event.target.value;
                  setForm((current) => ({ ...current, rationale }));
                }}
                rows={3}
                placeholder="Explica brevemente el motivo de esta decisión."
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              />
            </FormField>
          </DecisionBlock>
        </div>

        {/* Columna derecha: casos observados co-ubicados con el form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 8 }}>
          <DecisionBlock title={`Casos observados${drill?.casos?.length ? ` (${drill.casos.length})` : ""}`}>
            <CasesTable
              rows={caseRows}
              columns={caseColumns}
              uuidCol={drill?.uuid_col ?? null}
              loading={drillLoading}
              error={drillError}
              selectable={selectable}
              selectionMode={form.scope_mode === "single" ? "single" : "multiple"}
              selectedCaseIds={selectedCaseIdsSet}
              onToggle={(caseId) => {
                setForm((current) => {
                  if (current.scope_mode === "single") {
                    return { ...current, target_case_ids: [caseId] };
                  }
                  const next = new Set(current.target_case_ids);
                  if (next.has(caseId)) next.delete(caseId);
                  else next.add(caseId);
                  return { ...current, target_case_ids: Array.from(next) };
                });
              }}
              onSelectAll={() => {
                setForm((current) => ({
                  ...current,
                  target_case_ids: caseRows.map((row) => row.id),
                }));
              }}
              onClear={() => {
                setForm((current) => ({ ...current, target_case_ids: [] }));
              }}
            />
          </DecisionBlock>
        </div>
      </div>

      {/* Historial colapsable */}
      {relatedDecisions.length > 0 && (
        <details open={historyOpen} onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}>
          <summary style={summaryStyle}>
            {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {relatedDecisions.length} decisión{relatedDecisions.length === 1 ? "" : "es"} previa{relatedDecisions.length === 1 ? "" : "s"} para esta regla
          </summary>
          <div style={{ paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={onNewDecision} style={secondaryButtonStyle}>
              Nueva decisión
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {relatedDecisions.map((decision) => (
                <button
                  key={decision.id}
                  type="button"
                  onClick={() => onPickHistory(decision.id)}
                  style={{
                    ...secondaryButtonStyle,
                    borderColor: decision.id === selectedDecisionId ? "var(--pulso-primary-border)" : undefined,
                    background: decision.id === selectedDecisionId ? "var(--pulso-primary-soft)" : "white",
                  }}
                >
                  <StatusBadge status={decision.status} />
                  <span>{humanizeAction(decision.action_type)}</span>
                  <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
                    {formatDateTime(decision.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Barra de acciones */}
      <ActionBar
        saveBusy={saveBusy}
        readiness={readiness}
        coversWholeFinding={coversWholeFinding}
        canDelete={canDelete}
        onSaveDraft={onSaveDraft}
        onSaveAndNext={onSaveAndNext}
        onDelete={onDelete}
        onNav={onNav}
      />
    </div>
  );
}

function DecisionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--pulso-text-soft)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ScopeModeSelector({
  value,
  totalCases,
  selectedCount,
  onChange,
}: {
  value: ReglaTreatmentScope;
  totalCases: number;
  selectedCount: number;
  onChange: (value: ReglaTreatmentScope) => void;
}) {
  const totalLabel = totalCases > 0 ? `${totalCases} caso${totalCases === 1 ? "" : "s"}` : "todos los casos";
  const selectedLabel = selectedCount > 0
    ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`
    : "elige casos";
  const items: Array<{ value: ReglaTreatmentScope; label: string; hint: string }> = [
    { value: "all", label: "Todos", hint: `Cubrir ${totalLabel}.` },
    { value: "selected", label: "Selección", hint: selectedLabel },
    { value: "single", label: "Uno por uno", hint: selectedCount === 1 ? "1 registro elegido" : "elige 1 registro" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 8,
      }}
      role="radiogroup"
      aria-label="Alcance de la decisión"
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            style={{
              display: "grid",
              gap: 3,
              minHeight: 62,
              padding: "9px 10px",
              borderRadius: 10,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <strong style={{ fontSize: 12, lineHeight: 1.2 }}>{item.label}</strong>
            <span style={{ fontSize: 10.5, lineHeight: 1.3, color: "var(--pulso-text-soft)" }}>
              {item.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DecisionApplySummary({
  form,
  readiness,
  totalCases,
  selectedCount,
  optionsByCode,
}: {
  form: EditorForm;
  readiness: DecisionReadiness;
  totalCases: number;
  selectedCount: number;
  optionsByCode: Map<string, ChoiceOption>;
}) {
  const action = humanizeAction(form.action_type);
  const scope =
    form.action_type === "ignore_rule"
      ? "El hallazgo quedará registrado sin modificar la base."
      : form.use_all_cases
        ? `Cubrirá ${totalCases || "todos los"} caso${totalCases === 1 ? "" : "s"} de este hallazgo.`
        : form.scope_mode === "single"
          ? selectedCount === 1
            ? "Cubrirá solo el registro seleccionado."
            : "Falta elegir un registro."
          : selectedCount > 0
            ? `Cubrirá ${selectedCount} registro${selectedCount === 1 ? "" : "s"} seleccionado${selectedCount === 1 ? "" : "s"}.`
            : "Falta elegir registros.";
  const procedure = decisionProcedureText(form, optionsByCode);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${readiness.ready ? "var(--pulso-primary-border)" : "var(--pulso-warn-border)"}`,
        background: readiness.ready ? "var(--pulso-primary-soft)" : "var(--pulso-warn-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 12.5, color: "var(--pulso-text)" }}>Decisión a guardar</strong>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10.5,
            fontWeight: 800,
            color: readiness.ready ? "var(--pulso-primary)" : "var(--pulso-warn-fg)",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {readiness.ready ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {readiness.ready ? "Lista" : "Incompleta"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 5, fontSize: 11.5, color: "var(--pulso-text-soft)", lineHeight: 1.35 }}>
        <span><strong style={{ color: "var(--pulso-text)" }}>{action}</strong></span>
        <span>{scope}</span>
        {procedure && <span>{procedure}</span>}
      </div>
    </div>
  );
}

function ActionBar({
  saveBusy,
  readiness,
  coversWholeFinding,
  canDelete,
  onSaveDraft,
  onSaveAndNext,
  onDelete,
  onNav,
}: {
  saveBusy: boolean;
  readiness: DecisionReadiness;
  coversWholeFinding: boolean;
  canDelete: boolean;
  onSaveDraft: () => void;
  onSaveAndNext: () => void;
  onDelete: () => void;
  onNav: (direction: "next" | "prev") => void;
}) {
  const primaryDisabled = saveBusy || !readiness.ready;
  const primaryLabel = coversWholeFinding ? "Guardar y siguiente" : "Guardar decisión parcial";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: "1px solid var(--pulso-border)" }}>
      {!readiness.ready && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--pulso-warn-border)",
            background: "var(--pulso-warn-bg)",
            color: "var(--pulso-warn-fg)",
            fontSize: 11.5,
            lineHeight: 1.35,
          }}
        >
          <AlertTriangle size={14} />
          <span>{readiness.issues[0]}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onNav("prev")} style={secondaryButtonStyle} title="Anterior">
            ← Anterior
          </button>
          <button type="button" onClick={() => onNav("next")} style={secondaryButtonStyle} title="Siguiente">
            Siguiente →
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={saveBusy} style={dangerButtonStyle}>
              <Trash2 size={13} />
              Eliminar
            </button>
          )}
          <button type="button" onClick={onSaveDraft} disabled={saveBusy} style={secondaryButtonStyle}>
            <Save size={13} />
            Guardar borrador
          </button>
          <button
            type="button"
            onClick={onSaveAndNext}
            disabled={primaryDisabled}
            className="pulso-primary"
            style={primaryButtonStyle}
            title={
              readiness.ready
                ? coversWholeFinding
                  ? "Guardar decisión y pasar al siguiente hallazgo"
                  : "Guardar esta decisión y mantener el hallazgo pendiente"
                : readiness.issues[0]
            }
          >
            {saveBusy ? <Loader2 size={13} className="pulso-spin" /> : <ArrowRight size={13} />}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Case selection panel + helpers visuales
// =============================================================================
function CasesTable({
  rows,
  columns,
  uuidCol,
  loading,
  error,
  selectable,
  selectionMode,
  selectedCaseIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  rows: CaseRow[];
  columns: string[];
  uuidCol: string | null;
  loading: boolean;
  error: string;
  selectable: boolean;
  selectionMode: "multiple" | "single";
  selectedCaseIds: Set<string>;
  onToggle: (caseId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pulso-text-soft)" }}>
        <Loader2 size={14} className="pulso-spin" />
        Cargando casos…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-danger-fg)" }}>
        No se pudo cargar el detalle de casos: {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
        Sin detalle de casos disponible para esta regla.
      </div>
    );
  }

  const uuidLabel = uuidCol ?? "Caso";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {selectable && selectionMode === "multiple" && (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={onSelectAll} style={secondaryButtonStyle}>
            Seleccionar todos
          </button>
          <button type="button" onClick={onClear} style={secondaryButtonStyle}>
            Limpiar
          </button>
        </div>
      )}
      <div
        style={{
          maxHeight: 320,
          overflow: "auto",
          borderRadius: 10,
          border: "1px solid var(--pulso-border)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--pulso-surface-2)" }}>
              {selectable && <th style={tableHeadCell}>{selectionMode === "single" ? "Elegir" : "Incluir"}</th>}
              <th style={tableHeadCell}>{uuidLabel}</th>
              {columns.map((column) => (
                <th key={column} style={tableHeadCell}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--pulso-border)" }}>
                {selectable && (
                  <td style={tableCell}>
                    <input
                      type={selectionMode === "single" ? "radio" : "checkbox"}
                      name="limpieza-case-selection"
                      checked={selectedCaseIds.has(row.id)}
                      onChange={() => onToggle(row.id)}
                    />
                  </td>
                )}
                <td style={{ ...tableCell, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                  {row.id}
                </td>
                {columns.map((column) => (
                  <td key={`${row.id}-${column}`} style={tableCell}>
                    {stringifyCellValue(row.raw[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Las decisiones que sobrevivieron a una recarga de instrumento esperan en
// cuarentena: no se aplican ni salen en la cola hasta que su regla reaparezca y
// su variable siga en el formulario. Si la pestaña no lo dice, el analista da
// por perdido un trabajo que sigue ahí.
//
// El motivo cambia lo que hay que hacer, así que cambia el mensaje y el tono:
// esperar la auditoría es una buena noticia, y quedarse sin la variable es una
// pérdida real que ya no se recupera sola.
export function describirDecisionesPreservadas(
  preservadas: DecisionesPreservadas | undefined,
): { texto: string; tone: "success" | "warn" } | null {
  const n = preservadas?.n ?? 0;
  if (!Number.isFinite(n) || n <= 0) return null;
  const cuantas = n === 1 ? "1 decisión" : `${n} decisiones`;

  const sinEvaluar = preservadas?.n_sin_evaluar ?? 0;
  if (sinEvaluar > 0) {
    const casos = preservadas?.n_casos ?? 0;
    const cuantos = casos === 1 ? "1 caso" : `${casos} casos`;
    return {
      tone: "success",
      texto: `Se conservaron ${cuantas} (${cuantos}) del instrumento anterior. Vuelven a la cola al correr la auditoría, si su regla y su variable siguen existiendo.`,
    };
  }

  const motivos: string[] = [];
  const sinRegla = preservadas?.n_sin_regla ?? 0;
  const sinVariable = preservadas?.n_sin_variable ?? 0;
  const sinInstrumento = preservadas?.n_sin_instrumento ?? 0;
  if (sinRegla > 0) motivos.push(`${sinRegla} sin su regla`);
  if (sinVariable > 0) motivos.push(`${sinVariable} sin su variable`);
  if (sinInstrumento > 0) motivos.push(`${sinInstrumento} sin poder leer el formulario`);
  return {
    tone: "warn",
    texto: `${cuantas} del instrumento anterior no volvieron a la cola: ${motivos.join(", ")}. Siguen guardadas y no se aplican.`,
  };
}

function InlineMessage({
  tone,
  icon,
  text,
}: {
  tone: "success" | "warn" | "danger";
  icon: ReactNode;
  text: string;
}) {
  const colors =
    tone === "success"
      ? { bg: "var(--pulso-success-bg)", border: "var(--pulso-success-border)", fg: "var(--pulso-success-fg)" }
      : tone === "danger"
        ? { bg: "var(--pulso-danger-bg)", border: "var(--pulso-danger-border)", fg: "var(--pulso-danger-fg)" }
        : { bg: "var(--pulso-warn-bg)", border: "var(--pulso-warn-border)", fg: "var(--pulso-warn-fg)" };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.fg,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <span style={{ marginTop: 1 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function StatusBadge({
  status,
  text,
}: {
  status: LimpiezaDecision["status"] | "pending" | "ready";
  text?: string;
}) {
  const ready = status === "ready";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        background: ready ? "var(--pulso-success-bg)" : "var(--pulso-warn-bg)",
        border: `1px solid ${ready ? "var(--pulso-success-border)" : "var(--pulso-warn-border)"}`,
        color: ready ? "var(--pulso-success-fg)" : "var(--pulso-warn-fg)",
      }}
    >
      {text ?? (ready ? "Lista" : "Pendiente")}
    </span>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>{label}</span>
      {children}
    </label>
  );
}

type HierarchyDecisionRow = {
  trigger: string;
  required: string;
};

function HierarchyDecisionEditor({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
}) {
  const rows = hierarchyRowsFromDecisionText(value);
  const visibleRows = rows.length ? rows : [{ trigger: "", required: "" }];
  const hasOptions = options.length > 0;
  const optionsByCode = useMemo(
    () => new Map(options.map((option) => [option.code, option])),
    [options],
  );

  function commit(nextRows: HierarchyDecisionRow[]) {
    const map: Record<string, string[]> = {};
    for (const row of nextRows) {
      const trigger = row.trigger.trim();
      const required = parseLineList(row.required).filter((code) => code !== trigger);
      if (trigger && required.length) map[trigger] = required;
    }
    onChange(Object.keys(map).length ? JSON.stringify(map, null, 2) : "");
  }

  function update(idx: number, patch: Partial<HierarchyDecisionRow>) {
    commit(visibleRows.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, ...patch };
      if (patch.trigger != null) {
        next.required = parseLineList(next.required).filter((code) => code !== patch.trigger).join("\n");
      }
      return next;
    }));
  }

  function remove(idx: number) {
    const next = visibleRows.filter((_, i) => i !== idx);
    commit(next.length ? next : [{ trigger: "", required: "" }]);
  }

  function addRow() {
    const used = new Set(visibleRows.map((row) => row.trigger).filter(Boolean));
    const nextTrigger = options.find((option) => !used.has(option.code))?.code ?? "";
    commit([...visibleRows, { trigger: nextTrigger, required: "" }]);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {visibleRows.map((row, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(130px, .8fr) minmax(180px, 1.2fr) 32px",
            gap: 8,
            alignItems: "start",
            padding: 10,
            border: "1px solid var(--pulso-border)",
            borderRadius: 10,
            background: "var(--pulso-surface-2)",
          }}
        >
          <FormField label="Cuando aparece">
            {hasOptions ? (
              <OptionRadioPicker
                options={options}
                value={row.trigger}
                onChange={(code) => update(idx, { trigger: code })}
                name={`limpieza-hierarchy-trigger-${idx}`}
                compact
              />
            ) : (
              <input
                value={row.trigger}
                onChange={(event) => update(idx, { trigger: event.target.value })}
                style={inputStyle}
                placeholder="Código u opción marcada"
              />
            )}
          </FormField>
          <FormField label="Completar también con">
            {hasOptions ? (
              <OptionChecklist
                options={options.filter((option) => option.code !== row.trigger)}
                value={parseLineList(row.required)}
                onChange={(codes) => update(idx, { required: codes.join("\n") })}
                compact
              />
            ) : (
              <textarea
                rows={2}
                value={row.required}
                onChange={(event) => update(idx, { required: event.target.value })}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Una opción por línea"
              />
            )}
          </FormField>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="pulso-icon"
            aria-label="Quitar relación"
            title="Quitar relación"
            style={{ width: 30, height: 30, marginTop: 23, background: "white" }}
          >
            <Trash2 size={12} />
          </button>
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "7px 9px",
              borderRadius: 8,
              background: "white",
              border: "1px solid var(--pulso-border)",
              fontSize: 11,
              color: "var(--pulso-text-soft)",
            }}
          >
            <span>Si aparece</span>
            <strong style={{ color: "var(--pulso-text)" }}>
              {choiceOptionLabel(row.trigger, optionsByCode, "opción marcada")}
            </strong>
            <span>se completará</span>
            <strong style={{ color: "var(--pulso-text)" }}>
              {choiceOptionsLabel(parseLineList(row.required), optionsByCode, "opciones esperadas")}
            </strong>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{ ...secondaryButtonStyle, justifySelf: "start" }}
      >
        Agregar relación
      </button>
    </div>
  );
}

function OptionRadioPicker({
  options,
  value,
  onChange,
  name,
  compact = false,
}: {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  compact?: boolean;
}) {
  return (
    <div className={`pulso-option-picker${compact ? " is-compact" : ""}`}>
      <div className="pulso-option-picker-list">
        {options.map((option) => {
          const checked = value === option.code;
          return (
            <label key={option.code} className={`pulso-option-picker-row${checked ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange(option.code)}
              />
              <span>
                <strong>{option.label || option.code}</strong>
                {option.code !== option.label && <small>{option.code}</small>}
              </span>
              {option.n != null && <em>n={option.n}</em>}
            </label>
          );
        })}
        {!options.length && (
          <div className="pulso-option-picker-empty">Sin opciones del catálogo.</div>
        )}
      </div>
    </div>
  );
}

function OptionChecklist({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: ChoiceOption[];
  value: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
}) {
  const selected = new Set(value);
  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next));
  }

  return (
    <div className={`pulso-option-picker${compact ? " is-compact" : ""}`}>
      <div className="pulso-option-picker-list">
        {options.map((option) => {
          const checked = selected.has(option.code);
          return (
            <label key={option.code} className={`pulso-option-picker-row${checked ? " is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.code)}
              />
              <span>
                <strong>{option.label || option.code}</strong>
                {option.code !== option.label && <small>{option.code}</small>}
              </span>
              {option.n != null && <em>n={option.n}</em>}
            </label>
          );
        })}
        {!options.length && (
          <div className="pulso-option-picker-empty">Sin opciones disponibles.</div>
        )}
      </div>
    </div>
  );
}

function renderActionSpecificFields(
  form: EditorForm,
  setForm: Dispatch<SetStateAction<EditorForm>>,
  choiceOptions: ChoiceOption[],
) {
  if (form.action_type === "replace_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Valor actual (opcional)">
          <input
            value={form.replace_from}
            onChange={(event) => {
              const replaceFrom = event.target.value;
              setForm((current) => ({ ...current, replace_from: replaceFrom }));
            }}
            style={inputStyle}
            placeholder="Ej. Sii"
          />
        </FormField>
        <FormField label="Valor corregido">
          <input
            value={form.replace_to}
            onChange={(event) => {
              const replaceTo = event.target.value;
              setForm((current) => ({ ...current, replace_to: replaceTo }));
            }}
            style={inputStyle}
            placeholder="Ej. Sí"
          />
        </FormField>
      </div>
    );
  }

  if (form.action_type === "set_value") {
    return (
      <FormField label="Valor a asignar">
        <input
          value={form.set_value}
          onChange={(event) => {
            const setValue = event.target.value;
            setForm((current) => ({ ...current, set_value: setValue }));
          }}
          style={inputStyle}
          placeholder="Ej. No aplica"
        />
      </FormField>
    );
  }

  if (form.action_type === "recode_map") {
    return (
      <FormField label="Mapa de recodificación">
        <textarea
          rows={6}
          value={form.recode_map_json}
          onChange={(event) => {
            const recodeMapJson = event.target.value;
            setForm((current) => ({ ...current, recode_map_json: recodeMapJson }));
          }}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          placeholder={'{\n  "Sii": "Sí",\n  "N": "No"\n}'}
        />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Usa JSON: cada clave es el valor actual y cada valor es la recodificación.
        </span>
      </FormField>
    );
  }

  if (form.action_type === "nullify_fields") {
    return (
      <FormField label="Variables a anular">
        <textarea
          rows={4}
          value={form.nullify_variables_text}
          onChange={(event) => {
            const nullifyVariablesText = event.target.value;
            setForm((current) => ({ ...current, nullify_variables_text: nullifyVariablesText }));
          }}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
          placeholder={`Deja vacío para anular solo la variable objetivo.\nO escribe una variable por línea.`}
        />
      </FormField>
    );
  }

  if (form.action_type === "normalize_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Etiqueta a normalizar">
          <input
            value={form.normalize_from}
            onChange={(event) => {
              const normalizeFrom = event.target.value;
              setForm((current) => ({ ...current, normalize_from: normalizeFrom }));
            }}
            style={inputStyle}
            placeholder="Ej. SI / si / Sí"
          />
        </FormField>
        <FormField label="Etiqueta estándar">
          <input
            value={form.normalize_to}
            onChange={(event) => {
              const normalizeTo = event.target.value;
              setForm((current) => ({ ...current, normalize_to: normalizeTo }));
            }}
            style={inputStyle}
            placeholder="Ej. Sí"
          />
        </FormField>
      </div>
    );
  }

  if (form.action_type === "impute_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Método">
          <select
            value={form.impute_method}
            onChange={(event) => {
              const imputeMethod = event.target.value as EditorForm["impute_method"];
              setForm((current) => ({ ...current, impute_method: imputeMethod }));
            }}
            style={inputStyle}
          >
            <option value="fixed">Valor fijo</option>
            <option value="mode">Moda</option>
            <option value="median">Mediana</option>
          </select>
        </FormField>
        {form.impute_method === "fixed" && (
          <FormField label="Valor fijo">
            <input
              value={form.impute_fixed_value}
              onChange={(event) => {
                const imputeFixedValue = event.target.value;
                setForm((current) => ({ ...current, impute_fixed_value: imputeFixedValue }));
              }}
              style={inputStyle}
              placeholder="Escribe el valor"
            />
          </FormField>
        )}
      </div>
    );
  }

  if (form.action_type === "complete_select_multiple_hierarchy") {
    return (
      <FormField label="Relación de opciones">
        <HierarchyDecisionEditor
          value={form.hierarchy_map_json}
          options={choiceOptions}
          onChange={(hierarchyMapJson) => {
            setForm((current) => ({ ...current, hierarchy_map_json: hierarchyMapJson }));
          }}
        />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Se lee así: cuando aparece la opción de la izquierda, también deben aparecer las de la derecha.
        </span>
      </FormField>
    );
  }

  if (form.action_type === "adjust_select_multiple") {
    const addCodes = parseLineList(form.sm_add_codes);
    const removeCodes = parseLineList(form.sm_remove_codes);
    const optionsByCode = new Map(choiceOptions.map((option) => [option.code, option]));
    if (choiceOptions.length > 0) {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <FormField label="Agregar">
              <OptionChecklist
                options={choiceOptions.filter((option) => !removeCodes.includes(option.code))}
                value={addCodes}
                onChange={(codes) => {
                  setForm((current) => ({ ...current, sm_add_codes: codes.join("\n") }));
                }}
                compact
              />
            </FormField>
            <FormField label="Quitar">
              <OptionChecklist
                options={choiceOptions.filter((option) => !addCodes.includes(option.code))}
                value={removeCodes}
                onChange={(codes) => {
                  setForm((current) => ({ ...current, sm_remove_codes: codes.join("\n") }));
                }}
                compact
              />
            </FormField>
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
            {addCodes.length > 0 && (
              <span>
                Agregar: <strong style={{ color: "var(--pulso-text)" }}>{choiceOptionsLabel(addCodes, optionsByCode, "opciones")}</strong>.
              </span>
            )}
            {addCodes.length > 0 && removeCodes.length > 0 && <span> </span>}
            {removeCodes.length > 0 && (
              <span>
                Quitar: <strong style={{ color: "var(--pulso-text)" }}>{choiceOptionsLabel(removeCodes, optionsByCode, "opciones")}</strong>.
              </span>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Opciones a agregar">
          <textarea
            rows={4}
            value={form.sm_add_codes}
            onChange={(event) => {
              const smAddCodes = event.target.value;
              setForm((current) => ({ ...current, sm_add_codes: smAddCodes }));
            }}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            placeholder="Una opción por línea"
          />
        </FormField>
        <FormField label="Opciones a quitar">
          <textarea
            rows={4}
            value={form.sm_remove_codes}
            onChange={(event) => {
              const smRemoveCodes = event.target.value;
              setForm((current) => ({ ...current, sm_remove_codes: smRemoveCodes }));
            }}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            placeholder="Una opción por línea"
          />
        </FormField>
      </div>
    );
  }

  return null;
}

// =============================================================================
// Helpers puros
// =============================================================================
function buildChoiceOptions(drill: InstrumentoDrillResult | null, variable: string): ChoiceOption[] {
  if (!drill || !variable) return [];
  const rawLabels = drill.regla.value_labels?.[variable] ?? null;
  const counts = countChoiceValues(drill, variable);
  const options: ChoiceOption[] = [];

  if (rawLabels && typeof rawLabels === "object") {
    for (const [code, rawLabel] of Object.entries(rawLabels)) {
      const cleanCode = String(code).trim();
      if (!cleanCode) continue;
      const label = String(rawLabel ?? cleanCode).trim() || cleanCode;
      options.push({ code: cleanCode, label, n: counts.get(cleanCode) ?? null });
    }
  }

  if (!options.length) {
    for (const code of Array.from(counts.keys()).sort(naturalCodeSort)) {
      options.push({ code, label: code, n: counts.get(code) ?? null });
    }
  }

  return options;
}

function countChoiceValues(drill: InstrumentoDrillResult, variable: string) {
  const counts = new Map<string, number>();
  for (const row of drill.casos ?? []) {
    const value = row[variable];
    for (const code of tokenizeSelectMultipleValue(value)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    const labels = drill.regla.value_labels?.[variable] ?? {};
    for (const code of Object.keys(labels)) {
      const dummy = row[`${variable}.${code}`] ?? row[`${variable}_${code}`];
      if (isTruthyDummy(dummy)) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

function tokenizeSelectMultipleValue(value: unknown) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return uniqueStrings(value.map((item) => String(item)));
  return uniqueStrings(String(value).split(/[\s,;|]+/).map((item) => item.trim()));
}

function isTruthyDummy(value: unknown) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "t", "yes", "y", "si", "sí", "x"].includes(text);
}

function naturalCodeSort(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

function choiceOptionLabel(code: string, optionsByCode: Map<string, ChoiceOption>, fallback: string) {
  const clean = code.trim();
  if (!clean) return fallback;
  const option = optionsByCode.get(clean);
  if (!option) return clean;
  return option.label || option.code;
}

function choiceOptionsLabel(codes: string[], optionsByCode: Map<string, ChoiceOption>, fallback: string) {
  const labels = codes
    .map((code) => choiceOptionLabel(code, optionsByCode, ""))
    .filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
}

function decisionProcedureText(form: EditorForm, optionsByCode: Map<string, ChoiceOption>) {
  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok || !Object.keys(parsed.value).length) return "Define qué opciones deben completarse.";
    const bits = Object.entries(parsed.value).map(([trigger, required]) => {
      const triggerLabel = choiceOptionLabel(trigger, optionsByCode, trigger);
      const requiredLabel = choiceOptionsLabel(required, optionsByCode, required.join(", "));
      return `${triggerLabel} → ${requiredLabel}`;
    });
    return `Relación: ${bits.join(" · ")}`;
  }
  if (form.action_type === "adjust_select_multiple") {
    const add = parseLineList(form.sm_add_codes);
    const remove = parseLineList(form.sm_remove_codes);
    const parts = [];
    if (add.length) parts.push(`agregar ${choiceOptionsLabel(add, optionsByCode, add.join(", "))}`);
    if (remove.length) parts.push(`quitar ${choiceOptionsLabel(remove, optionsByCode, remove.join(", "))}`);
    return parts.length ? `Ajuste: ${parts.join("; ")}.` : "Define opciones para agregar o quitar.";
  }
  if (form.action_type === "nullify_fields") return "Los campos quedarán vacíos para los registros cubiertos.";
  if (form.action_type === "exclude_cases") return "Los registros cubiertos quedarán fuera de la base final.";
  return "";
}

function getDecisionReadiness(form: EditorForm): DecisionReadiness {
  const issues: string[] = [];
  if (form.action_type !== "ignore_rule" && form.scope_mode === "single" && form.target_case_ids.length !== 1) {
    issues.push("Selecciona un registro para guardar una decisión uno por uno.");
  } else if (form.action_type !== "ignore_rule" && !form.use_all_cases && form.target_case_ids.length === 0) {
    issues.push("Selecciona registros o cambia el alcance a Todos.");
  }
  if (actionNeedsVariable(form.action_type) && !form.target_variable) {
    issues.push("Selecciona una variable objetivo.");
  }
  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok || Object.keys(parsed.value).length === 0) {
      issues.push("Define al menos una relación de opciones.");
    }
  }
  if (form.action_type === "adjust_select_multiple" && !parseLineList(form.sm_add_codes).length && !parseLineList(form.sm_remove_codes).length) {
    issues.push("Define al menos una opción para agregar o quitar.");
  }
  if (form.action_type === "replace_value" && !form.replace_to.trim()) {
    issues.push("Indica el valor corregido.");
  }
  if (form.action_type === "set_value" && !form.set_value.trim()) {
    issues.push("Indica el valor a asignar.");
  }
  if (form.action_type === "recode_map") {
    const parsed = parseJsonObject(form.recode_map_json, "El mapa de recodificación debe ser JSON válido.");
    if (!parsed.ok || Object.keys(parsed.value).length === 0) issues.push("Define el mapa de recodificación.");
  }
  if (!form.rationale.trim()) {
    issues.push("Escribe una justificación para dejar la decisión lista.");
  }
  return { ready: issues.length === 0, issues };
}

function emptyEditorForm(): EditorForm {
  return {
    id: "",
    source_type: "instrument_rule",
    action_type: "ignore_rule",
    target_variable: "",
    rationale: "",
    scope_mode: "all",
    use_all_cases: true,
    target_case_ids: [],
    replace_from: "",
    replace_to: "",
    normalize_from: "",
    normalize_to: "",
    hierarchy_map_json: "",
    set_value: "",
    recode_map_json: "",
    nullify_variables_text: "",
    sm_add_codes: "",
    sm_remove_codes: "",
    impute_method: "fixed",
    impute_fixed_value: "",
  };
}

function buildEditorForm(
  sourceId: string,
  item: LimpiezaQueueItem | null,
  decision: LimpiezaDecision | null,
  variableOptions: string[],
): EditorForm {
  const actionType = decision?.action_type ?? normalizePlannedAction(item?.planned_action_type);
  const plannedScope = normalizePlannedScope(item?.recommended_scope, actionType);
  const scopeMode = decision ? decisionScopeMode(decision) : plannedScope;
  const useAllCases = decision
    ? (decision.target_case_ids?.length ?? 0) === 0
    : actionType === "ignore_rule" || scopeMode === "all";
  const plannedParams = item?.planned_action_params ?? {};
  return {
    id: decision?.id ?? "",
    source_type: decision?.source_type ?? item?.source_type ?? inferSourceType(sourceId),
    action_type: actionType,
    target_variable: decision?.target_variable ?? (actionNeedsVariable(actionType) ? variableOptions[0] ?? "" : ""),
    rationale: decision?.rationale ?? "",
    scope_mode: actionType === "ignore_rule" ? "all" : scopeMode,
    use_all_cases: actionType === "ignore_rule" ? true : useAllCases,
    target_case_ids: decision?.target_case_ids ?? [],
    replace_from: readActionParam(decision, "from_value"),
    replace_to: readActionParam(decision, "to_value"),
    normalize_from: readActionParam(decision, "from_value"),
    normalize_to: readActionParam(decision, "normalized_value") || readActionParam(decision, "to_value"),
    hierarchy_map_json: readHierarchyMapParam(decision) || readHierarchyMapParamFromParams(plannedParams),
    set_value: readActionParam(decision, "value") || readActionParam(decision, "to_value"),
    recode_map_json: readObjectParam(decision, "recode_map") || readObjectParam(decision, "map") || readObjectFromParams(plannedParams, "recode_map"),
    nullify_variables_text: readListParam(decision, "target_variables") || readListFromParams(plannedParams, "target_variables"),
    sm_add_codes: readListParam(decision, "add_codes") || readListFromParams(plannedParams, "add_codes"),
    sm_remove_codes: readListParam(decision, "remove_codes") || readListFromParams(plannedParams, "remove_codes"),
    impute_method: readImputeMethod(decision),
    impute_fixed_value: readActionParam(decision, "fixed_value") || readActionParam(decision, "value"),
  };
}

function buildDecisionPayload({
  form,
  status,
  sourceId,
  sourceType,
}: {
  form: EditorForm;
  status: "draft" | "ready";
  sourceId: string;
  sourceType: LimpiezaDecision["source_type"];
}) {
  if (status === "ready" && !form.rationale.trim()) {
    throw new Error("Escribe una justificación para dejar la decisión lista.");
  }

  if (actionNeedsVariable(form.action_type) && !form.target_variable) {
    throw new Error("Selecciona una variable objetivo.");
  }

  if (form.action_type !== "ignore_rule" && !form.use_all_cases && form.target_case_ids.length === 0) {
    throw new Error("Selecciona al menos un caso o marca que aplica a todos.");
  }

  if (form.action_type !== "ignore_rule" && form.scope_mode === "single" && form.target_case_ids.length !== 1) {
    throw new Error("Para revisar uno por uno, selecciona exactamente un registro.");
  }

  const actionParams: Record<string, unknown> = {};

  if (form.action_type === "replace_value") {
    if (!form.replace_to.trim()) {
      throw new Error("Indica el valor corregido.");
    }
    if (form.replace_from.trim()) actionParams.from_value = form.replace_from.trim();
    actionParams.to_value = form.replace_to.trim();
  }

  if (form.action_type === "set_value") {
    if (!form.set_value.trim()) {
      throw new Error("Indica el valor a asignar.");
    }
    actionParams.value = form.set_value.trim();
  }

  if (form.action_type === "recode_map") {
    const parsed = parseJsonObject(form.recode_map_json, "El mapa de recodificación debe ser JSON válido.");
    if (!parsed.ok) throw new Error(parsed.error);
    if (Object.keys(parsed.value).length === 0) {
      throw new Error("Define al menos una recodificación.");
    }
    actionParams.recode_map = parsed.value;
  }

  if (form.action_type === "nullify_fields") {
    const variables = parseLineList(form.nullify_variables_text);
    if (variables.length) actionParams.target_variables = variables;
  }

  if (form.action_type === "normalize_value") {
    if (!form.normalize_to.trim()) {
      throw new Error("Indica la etiqueta estándar.");
    }
    if (form.normalize_from.trim()) actionParams.from_value = form.normalize_from.trim();
    actionParams.normalized_value = form.normalize_to.trim();
  }

  if (form.action_type === "impute_value") {
    actionParams.method = form.impute_method;
    if (form.impute_method === "fixed") {
      if (!form.impute_fixed_value.trim()) {
        throw new Error("Escribe el valor fijo de imputación.");
      }
      actionParams.fixed_value = form.impute_fixed_value.trim();
    }
  }

  if (form.action_type === "complete_select_multiple_hierarchy") {
    const parsed = parseHierarchyMap(form.hierarchy_map_json);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    if (Object.keys(parsed.value).length === 0) {
      throw new Error("Define al menos una opción activadora en el mapa manual.");
    }
    actionParams.hierarchy_map = parsed.value;
  }

  if (form.action_type === "adjust_select_multiple") {
    const addCodes = parseLineList(form.sm_add_codes);
    const removeCodes = parseLineList(form.sm_remove_codes);
    if (!addCodes.length && !removeCodes.length) {
      throw new Error("Define al menos una opción para agregar o quitar.");
    }
    if (addCodes.length) actionParams.add_codes = addCodes;
    if (removeCodes.length) actionParams.remove_codes = removeCodes;
  }

  const scope: LimpiezaDecision["scope"] =
    form.action_type === "ignore_rule"
      ? "rule"
      : form.action_type === "exclude_cases"
        ? "case_subset"
        : form.use_all_cases
          ? "variable"
          : "cell_subset";

  return {
    ...(form.id ? { id: form.id } : {}),
    source_id: sourceId,
    source_type: sourceType,
    scope,
    target_case_ids: form.use_all_cases ? [] : form.target_case_ids,
    target_variable: actionNeedsVariable(form.action_type) ? form.target_variable : undefined,
    action_type: form.action_type,
    action_params: actionParams,
    rationale: form.rationale.trim(),
    status,
  };
}

function buildCaseRows(drill: InstrumentoDrillResult | null, item: LimpiezaQueueItem | null): CaseRow[] {
  if (!drill) return [];
  const preferredKeys = uniqueStrings([...(item?.variables ?? []), ...(drill.regla.variables ?? [])]);
  return (drill.casos ?? []).map((raw, index) => {
    const caseId = drill.case_ids?.[index] ?? `${drill.regla.id}::row::${index + 1}`;
    return {
      id: caseId,
      raw,
      summary: buildCaseSummary(raw, preferredKeys),
    };
  });
}

function buildCaseSummary(row: Record<string, unknown>, preferredKeys: string[]) {
  const candidateKeys = uniqueStrings([
    ...preferredKeys,
    ...Object.keys(row).filter((key) => !isSystemColumn(key)),
  ]).slice(0, 3);
  const bits = candidateKeys
    .map((key) => {
      const value = row[key];
      if (value == null || value === "") return null;
      return `${key}: ${stringifyCellValue(value)}`;
    })
    .filter((value): value is string => !!value);
  return bits.join(" | ");
}

function actionNeedsVariable(actionType: LimpiezaDecisionActionType) {
  return (
    actionType === "replace_value" ||
    actionType === "set_value" ||
    actionType === "recode_map" ||
    actionType === "nullify_fields" ||
    actionType === "normalize_value" ||
    actionType === "impute_value" ||
    actionType === "complete_select_multiple_hierarchy" ||
    actionType === "adjust_select_multiple"
  );
}

function normalizePlannedAction(value: unknown): LimpiezaDecisionActionType {
  const raw = String(value ?? "");
  return ACTION_OPTIONS.some((option) => option.value === raw)
    ? (raw as LimpiezaDecisionActionType)
    : "ignore_rule";
}

function normalizePlannedScope(
  value: unknown,
  actionType: LimpiezaDecisionActionType,
): ReglaTreatmentScope {
  if (actionType === "ignore_rule") return "all";
  const raw = String(value ?? "");
  if (raw === "all" || raw === "selected" || raw === "single") return raw;
  return actionType === "exclude_cases" ? "selected" : "all";
}

function decisionScopeMode(decision: LimpiezaDecision): ReglaTreatmentScope {
  const n = decision.target_case_ids?.length ?? 0;
  if (n === 0) return "all";
  if (n === 1) return "single";
  return "selected";
}

function readActionParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  return value == null ? "" : String(value);
}

function readObjectParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return JSON.stringify(value, null, 2);
}

function readListParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "string") return value;
  return "";
}

function readObjectFromParams(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return JSON.stringify(value, null, 2);
}

function readListFromParams(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "string") return value;
  return "";
}

function readImputeMethod(decision: LimpiezaDecision | null): EditorForm["impute_method"] {
  const raw = String(decision?.action_params?.method ?? "fixed");
  if (raw === "mode" || raw === "median") return raw;
  return "fixed";
}

function readHierarchyMapParam(decision: LimpiezaDecision | null) {
  const value = decision?.action_params?.hierarchy_map ?? decision?.action_params?.map;
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value, null, 2);
}

function readHierarchyMapParamFromParams(params: Record<string, unknown>) {
  const value = params.hierarchy_map ?? params.map;
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value, null, 2);
}

function hierarchyRowsFromDecisionText(text: string): HierarchyDecisionRow[] {
  const parsed = parseHierarchyMap(text);
  if (parsed.ok) {
    return Object.entries(parsed.value).map(([trigger, values]) => ({
      trigger,
      required: values.join("\n"),
    }));
  }
  return [{ trigger: "", required: "" }];
}

function parseHierarchyMap(text: string): { ok: true; value: Record<string, string[]> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Define el mapa manual de jerarquía." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "El mapa manual debe ser JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El mapa debe ser un objeto JSON con listas de códigos." };
  }
  const out: Record<string, string[]> = {};
  for (const [trigger, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const key = trigger.trim();
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
    const clean = values.map((value) => String(value).trim()).filter((value) => value && value !== key);
    if (key && clean.length) out[key] = Array.from(new Set(clean));
  }
  return { ok: true, value: out };
}

function parseJsonObject(text: string, error: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El valor debe ser un objeto JSON." };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

function parseLineList(text: string) {
  return uniqueStrings(text.split(/\r?\n|,/).map((value) => value.trim()));
}

function isSelectMultipleItem(item?: LimpiezaQueueItem | null) {
  const tipoRegla = String(item?.tipo_regla ?? item?.tipo_observacion ?? "").toLowerCase();
  const tipoVariable = String(item?.tipo_variable ?? "").toLowerCase();
  return tipoRegla.includes("select_multiple") || tipoVariable.includes("select_multiple") || tipoVariable === "sm";
}

function inferSourceType(sourceId: string): LimpiezaDecision["source_type"] {
  return sourceId.startsWith("RC_") ? "custom_rule" : "instrument_rule";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value == null ? "" : String(value).trim()))
        .filter((value) => !!value),
    ),
  );
}

function isSystemColumn(key: string) {
  return key.startsWith("_") || key === ".__case_id__";
}

function stringifyCellValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return Number.isFinite(value) ? numberFormatter.format(value) : String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

function humanizeAction(actionType?: LimpiezaDecisionActionType | null) {
  if (!actionType) return "Decisión";
  return actionOptionsFor(actionType).find((option) => option.value === actionType)?.label ?? "Decisión";
}

// =============================================================================
// Estilos compartidos
// =============================================================================
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: 13,
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "9px 12px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid var(--pulso-danger-border)",
  background: "var(--pulso-danger-bg)",
  color: "var(--pulso-danger-fg)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const tableHeadCell: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  color: "var(--pulso-text-soft)",
  whiteSpace: "nowrap",
};

const tableCell: CSSProperties = {
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--pulso-text)",
  verticalAlign: "top",
};

const emptyDashedStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px dashed var(--pulso-border)",
  background: "var(--pulso-surface-2)",
  fontSize: 12,
  color: "var(--pulso-text-soft)",
  textAlign: "center",
};

const summaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  background: "var(--pulso-surface-2)",
  border: "1px solid var(--pulso-border)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--pulso-text)",
  cursor: "pointer",
  listStyle: "none",
};
