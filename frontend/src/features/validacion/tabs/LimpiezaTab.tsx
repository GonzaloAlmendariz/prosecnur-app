import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
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
  downloadUrl,
  type InstrumentoDrillResult,
} from "../../../api/client";
import type {
  LimpiezaArtifactsBundle,
  LimpiezaDecision,
  LimpiezaDecisionActionType,
  LimpiezaQueueItem,
  LimpiezaSummary,
} from "../types";
import { EmptyState, LoadingBlock } from "../../../components/States";
import { useValidacionStore } from "../store";
import PlotlyView from "../components/PlotlyView";
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
// Limpieza y normalización
// =============================================================================
// Tab de cierre: decide qué hacer con cada inconsistencia (ignorar, excluir,
// reemplazar, normalizar, imputar) y genera la base final + reporte.
//
// Tres zonas:
//   1. StatusBar: estado del cierre, progreso, CTA de cerrar base.
//   2. Workbench: cola de inconsistencias + editor de decisión con flujo
//      "Guardar y siguiente" (Cmd/Ctrl+Enter) que auto-avanza al siguiente
//      pendiente.
//   3. Reporte de cambios: colapsado por defecto, muestra impacto simulado,
//      residual proyectado y entregables cuando ya se cerró la base.
// =============================================================================

const NEW_DECISION = "__new__";

const numberFormatter = new Intl.NumberFormat("es-PE");
const percentFormatter = new Intl.NumberFormat("es-PE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
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
  use_all_cases: boolean;
  target_case_ids: string[];
  replace_from: string;
  replace_to: string;
  normalize_from: string;
  normalize_to: string;
  impute_method: "fixed" | "mode" | "median";
  impute_fixed_value: string;
};

type CaseRow = {
  id: string;
  raw: Record<string, unknown>;
  summary: string;
};

const ACTION_OPTIONS: Array<{
  value: LimpiezaDecisionActionType;
  label: string;
}> = [
  { value: "ignore_rule", label: "Ignorar regla" },
  { value: "exclude_cases", label: "Excluir casos" },
  { value: "replace_value", label: "Reemplazar valor" },
  { value: "normalize_value", label: "Normalizar valor" },
  { value: "impute_value", label: "Imputar" },
];

// Map action_type → kind de la DecisionStorageBar.
const ACTION_KIND_MAP: Record<LimpiezaDecisionActionType, DecisionKind> = {
  ignore_rule: "ignore",
  exclude_cases: "exclude",
  replace_value: "replace",
  normalize_value: "normalize",
  impute_value: "impute",
};

// -----------------------------------------------------------------------------
// Helper: derivar distribución de decisiones para DecisionStorageBar.
// Los counts son por CASOS (no por reglas) — cada regla con decisión lista
// contribuye sus n_casos al kind correspondiente. Las pendientes van al
// segmento striped.
// -----------------------------------------------------------------------------
function deriveDecisionCounts(queue: LimpiezaQueueItem[]): DecisionCounts {
  const counts: DecisionCounts = {
    ignore: 0, exclude: 0, replace: 0, normalize: 0, impute: 0, pending: 0,
  };
  for (const item of queue) {
    const n = item.n_casos ?? 0;
    if (!n) continue;
    if (item.pending) {
      counts.pending += n;
      continue;
    }
    // Item tiene decisión lista — inferir kind desde current_action (string
    // legible) o source_type.
    const action = (item.current_action ?? "").toLowerCase();
    if (action.startsWith("ignorar")) counts.ignore += n;
    else if (action.startsWith("excluir")) counts.exclude += n;
    else if (action.startsWith("reemplazar")) counts.replace += n;
    else if (action.startsWith("normalizar")) counts.normalize += n;
    else if (action.startsWith("imputar")) counts.impute += n;
    else counts.ignore += n; // fallback conservador si el label no calza
  }
  return counts;
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

  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>("");

  const [drill, setDrill] = useState<InstrumentoDrillResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");

  const [form, setForm] = useState<EditorForm>(() => emptyEditorForm());
  // Filtro por kind de decisión activado desde DecisionStorageBar. Null = sin filtro.
  const [activeFilterKind, setActiveFilterKind] = useState<DecisionKind | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [resumenOpen, setResumenOpen] = useState(false);
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
        const nextId = findNextPendingSourceId(selectedSourceId);
        if (nextId) {
          setSelectedSourceId(nextId);
          setSelectedDecisionId(NEW_DECISION);
          setNotice("Decisión guardada. Siguiente inconsistencia cargada.");
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
      setNotice("Base limpia, reporte HTML y Excel de decisiones generados.");
      setReportOpen(true);
      await loadLimpieza({ quiet: true });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setFinalizeBusy(false);
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
  if (loading) return <LoadingBlock label="Cargando Limpieza y normalización…" />;

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
  const preview = data.before_after_preview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      <ReporteCambios
        open={reportOpen}
        onToggle={() => setReportOpen((v) => !v)}
        preview={preview}
        artifacts={artifacts}
      />

      {(data.top_reglas || data.top_variables) && (
        <ResumenVisualDrawer
          open={resumenOpen}
          onToggle={() => setResumenOpen((v) => !v)}
          topReglas={data.top_reglas}
          topVariables={data.top_variables}
        />
      )}
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
    decisionCounts.replace +
    decisionCounts.normalize +
    decisionCounts.impute +
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
              Limpieza y normalización
            </div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              {finalizedAt
                ? `Último cierre: ${formatDateTime(finalizedAt)}`
                : "Decisiones sobre las inconsistencias detectadas"}
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
        if (activeFilterKind === "ignore") return action.startsWith("ignorar");
        if (activeFilterKind === "exclude") return action.startsWith("excluir");
        if (activeFilterKind === "replace") return action.startsWith("reemplazar");
        if (activeFilterKind === "normalize") return action.startsWith("normalizar");
        if (activeFilterKind === "impute") return action.startsWith("imputar");
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
              Cola de inconsistencias
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
            No hay inconsistencias pendientes.
          </div>
        ) : filteredQueue.length === 0 ? (
          <div style={emptyDashedStyle}>
            No hay inconsistencias en «{filterCat}».
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
        ? "Selecciona una inconsistencia de la cola para decidir."
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
                use_all_cases: nextAction === "ignore_rule" ? true : current.use_all_cases,
                target_variable: actionNeedsVariable(nextAction)
                  ? current.target_variable || variableOptions[0] || ""
                  : "",
              }));
            }}
            style={inputStyle}
          >
            {ACTION_OPTIONS.map((option) => (
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

        {renderActionSpecificFields(form, setForm)}
      </DecisionBlock>

      {/* Bloque 2: ¿Sobre qué casos? */}
      {allowsCaseSubset && (
        <DecisionBlock title="¿Sobre qué casos?">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pulso-text)" }}>
            <input
              type="checkbox"
              checked={form.use_all_cases}
              onChange={(event) => {
                const useAll = event.target.checked;
                setForm((current) => ({
                  ...current,
                  use_all_cases: useAll,
                  target_case_ids: useAll ? [] : current.target_case_ids,
                }));
              }}
            />
            Aplicar a todos los casos observados por esta regla
          </label>
          {!form.use_all_cases && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              Marca arriba los casos a los que aplicar la acción.
            </div>
          )}
        </DecisionBlock>
      )}

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
              selectedCaseIds={selectedCaseIdsSet}
              onToggle={(caseId) => {
                setForm((current) => {
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

function ActionBar({
  saveBusy,
  canDelete,
  onSaveDraft,
  onSaveAndNext,
  onDelete,
  onNav,
}: {
  saveBusy: boolean;
  canDelete: boolean;
  onSaveDraft: () => void;
  onSaveAndNext: () => void;
  onDelete: () => void;
  onNav: (direction: "next" | "prev") => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
        paddingTop: 10,
        borderTop: "1px solid var(--pulso-border)",
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
          disabled={saveBusy}
          className="pulso-primary"
          style={primaryButtonStyle}
          title="Cmd/Ctrl + Enter"
        >
          {saveBusy ? <Loader2 size={13} className="pulso-spin" /> : <ArrowRight size={13} />}
          Guardar y siguiente
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Zona 3 — Reporte de cambios (colapsado por defecto)
// =============================================================================
function ReporteCambios({
  open,
  onToggle,
  preview,
  artifacts,
}: {
  open: boolean;
  onToggle: () => void;
  preview: LimpiezaSummary["before_after_preview"];
  artifacts: LimpiezaArtifactsBundle | null;
}) {
  const listas = preview?.decisions_ready ?? 0;
  const hasArtifacts = !!artifacts && (artifacts.files?.length ?? 0) > 0;

  return (
    <section
      style={{
        borderRadius: 16,
        border: "1px solid var(--pulso-border)",
        background: "white",
        boxShadow: "var(--pulso-shadow-low)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          background: "white",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pulso-text)" }}>
              Reporte de cambios
            </div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
              {hasArtifacts
                ? `Entregables generados · ${artifacts?.files.length ?? 0} archivos`
                : listas > 0
                  ? `${listas} decisión${listas === 1 ? "" : "es"} lista${listas === 1 ? "" : "s"} · impacto simulado`
                  : "Aparece al guardar decisiones listas"}
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 18px 18px" }}>
          <ImpactPreview preview={preview} />
          {hasArtifacts && <ArtifactGrid artifacts={artifacts!} />}
        </div>
      )}
    </section>
  );
}

function ImpactPreview({ preview }: { preview: LimpiezaSummary["before_after_preview"] }) {
  if (!preview) {
    return (
      <div style={emptyDashedStyle}>
        Sin decisiones listas todavía. Al guardar la primera verás el impacto simulado.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <ImpactChip label="Filas antes" value={formatNumber(preview.before.filas_base)} />
        <ImpactChip label="Filas después" value={formatNumber(preview.after.filas_base)} />
        <ImpactChip label="Reglas resueltas" value={formatNumber(preview.impact.rules_resolved)} />
        <ImpactChip label="Casos excluidos" value={formatNumber(preview.impact.cases_excluded)} />
        <ImpactChip label="Reemplazos" value={formatNumber(preview.impact.replacements)} />
        <ImpactChip label="Normalizaciones" value={formatNumber(preview.impact.normalizations)} />
        <ImpactChip label="Imputaciones" value={formatNumber(preview.impact.imputations)} />
      </div>

      {preview.residual_final && preview.residual_final.length > 0 && (
        <details>
          <summary style={summaryStyle}>
            Residual proyectado ({preview.residual_final.length} reglas con casos)
          </summary>
          <ResidualTable rows={preview.residual_final} />
        </details>
      )}
    </div>
  );
}

function ArtifactGrid({ artifacts }: { artifacts: LimpiezaArtifactsBundle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pulso-text)" }}>Entregables</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {artifacts.files.map((artifact) => (
          <ArtifactCard
            key={artifact.file_id}
            artifact={artifact}
            recommended={artifact.file_id === artifacts.recommended_file_id}
          />
        ))}
      </div>
    </div>
  );
}

function ArtifactCard({
  artifact,
  recommended,
}: {
  artifact: LimpiezaArtifactsBundle["files"][number];
  recommended: boolean;
}) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px",
        borderRadius: 12,
        border: `1px solid ${recommended ? "var(--pulso-success-border)" : "var(--pulso-border)"}`,
        background: recommended ? "var(--pulso-success-bg)" : "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>{artifact.label}</div>
        {recommended && <StatusBadge status="ready" text="Recomendada" />}
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{artifact.original_name}</div>
      <div style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
        {formatDateTime(artifact.generated_at)}
      </div>
      <a
        href={downloadUrl(artifact.file_id)}
        style={{
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--pulso-primary-border)",
          color: "var(--pulso-primary)",
          background: "white",
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <Download size={13} />
        Descargar
      </a>
    </article>
  );
}

function ResidualTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0] ?? {}).slice(0, 6);
  return (
    <div
      style={{
        marginTop: 10,
        maxHeight: 280,
        overflow: "auto",
        borderRadius: 10,
        border: "1px solid var(--pulso-border)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--pulso-surface-2)" }}>
            {columns.map((column) => (
              <th key={column} style={tableHeadCell}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((row, index) => (
            <tr key={index} style={{ borderTop: "1px solid var(--pulso-border)" }}>
              {columns.map((column) => (
                <td key={`${index}-${column}`} style={tableCell}>
                  {stringifyCellValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Drawer opcional — Resumen visual (top reglas / top variables)
// =============================================================================
function ResumenVisualDrawer({
  open,
  onToggle,
  topReglas,
  topVariables,
}: {
  open: boolean;
  onToggle: () => void;
  topReglas: LimpiezaSummary["top_reglas"];
  topVariables: LimpiezaSummary["top_variables"];
}) {
  return (
    <section
      style={{
        borderRadius: 16,
        border: "1px solid var(--pulso-border)",
        background: "white",
        boxShadow: "var(--pulso-shadow-low)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          background: "white",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          Ver resumen visual
        </span>
      </button>
      {open && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 14,
            padding: "0 18px 18px",
          }}
        >
          {topReglas && <PlotlyView view={topReglas} />}
          {topVariables && <PlotlyView view={topVariables} />}
        </div>
      )}
    </section>
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
      {selectable && (
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
              {selectable && <th style={tableHeadCell}>Incluir</th>}
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
                      type="checkbox"
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

function ImpactChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface-2)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pulso-text)" }}>{value}</div>
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

function renderActionSpecificFields(
  form: EditorForm,
  setForm: Dispatch<SetStateAction<EditorForm>>,
) {
  if (form.action_type === "replace_value") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <FormField label="Valor original (opcional)">
          <input
            value={form.replace_from}
            onChange={(event) => {
              const replaceFrom = event.target.value;
              setForm((current) => ({ ...current, replace_from: replaceFrom }));
            }}
            style={inputStyle}
            placeholder="Ej. Otro"
          />
        </FormField>
        <FormField label="Nuevo valor">
          <input
            value={form.replace_to}
            onChange={(event) => {
              const replaceTo = event.target.value;
              setForm((current) => ({ ...current, replace_to: replaceTo }));
            }}
            style={inputStyle}
            placeholder="Ej. No especifica"
          />
        </FormField>
      </div>
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

  return null;
}

// =============================================================================
// Helpers puros
// =============================================================================
function emptyEditorForm(): EditorForm {
  return {
    id: "",
    source_type: "instrument_rule",
    action_type: "ignore_rule",
    target_variable: "",
    rationale: "",
    use_all_cases: true,
    target_case_ids: [],
    replace_from: "",
    replace_to: "",
    normalize_from: "",
    normalize_to: "",
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
  const actionType = decision?.action_type ?? "ignore_rule";
  const useAllCases = decision
    ? (decision.target_case_ids?.length ?? 0) === 0
    : actionType !== "exclude_cases";
  return {
    id: decision?.id ?? "",
    source_type: decision?.source_type ?? item?.source_type ?? inferSourceType(sourceId),
    action_type: actionType,
    target_variable: decision?.target_variable ?? (actionNeedsVariable(actionType) ? variableOptions[0] ?? "" : ""),
    rationale: decision?.rationale ?? "",
    use_all_cases: actionType === "ignore_rule" ? true : useAllCases,
    target_case_ids: decision?.target_case_ids ?? [],
    replace_from: readActionParam(decision, "from_value"),
    replace_to: readActionParam(decision, "to_value"),
    normalize_from: readActionParam(decision, "from_value"),
    normalize_to: readActionParam(decision, "normalized_value") || readActionParam(decision, "to_value"),
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

  const actionParams: Record<string, unknown> = {};

  if (form.action_type === "replace_value") {
    if (!form.replace_to.trim()) {
      throw new Error("Indica el nuevo valor del reemplazo.");
    }
    if (form.replace_from.trim()) actionParams.from_value = form.replace_from.trim();
    actionParams.to_value = form.replace_to.trim();
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

function extractArtifacts(value: LimpiezaSummary["artifacts"] | undefined): LimpiezaArtifactsBundle | null {
  if (!value || typeof value !== "object" || !("files" in value)) return null;
  const files = (value as LimpiezaArtifactsBundle).files;
  if (!Array.isArray(files)) return null;
  return value as LimpiezaArtifactsBundle;
}

function actionNeedsVariable(actionType: LimpiezaDecisionActionType) {
  return actionType === "replace_value" || actionType === "normalize_value" || actionType === "impute_value";
}

function readActionParam(decision: LimpiezaDecision | null, key: string) {
  const value = decision?.action_params?.[key];
  return value == null ? "" : String(value);
}

function readImputeMethod(decision: LimpiezaDecision | null): EditorForm["impute_method"] {
  const raw = String(decision?.action_params?.method ?? "fixed");
  if (raw === "mode" || raw === "median") return raw;
  return "fixed";
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

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = Math.abs(value) > 1 ? value / 100 : value;
  return percentFormatter.format(pct);
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

function humanizeAction(actionType?: LimpiezaDecisionActionType | null) {
  return ACTION_OPTIONS.find((option) => option.value === actionType)?.label ?? "Decisión";
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
