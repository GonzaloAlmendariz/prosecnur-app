/**
 * Estado y acciones de la mesa de limpieza: carga la cola de hallazgos de la
 * base activa, elige el hallazgo y su decisión, trae los casos de la regla,
 * guarda, borra, cierra la base y revierte la promoción.
 *
 * Salió sin cambios de `tabs/LimpiezaTab.tsx` (rebanada V1 de P6): los
 * efectos conservan su orden, que vigila la huella de pedidos de la
 * caracterización (`caracterizacion/limpieza.test.tsx`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiV2InstrumentoDrill,
  apiV2Limpieza,
  apiV2LimpiezaDecisionDelete,
  apiV2LimpiezaDecisionSave,
  apiV2LimpiezaRevertirPromocion,
  type InstrumentoDrillResult,
} from "../../../api/client";
import type { LimpiezaSummary } from "../types";
import type { DecisionKind } from "../components/v2";
import { calcularImpacto } from "../impactoDecisiones";
import { extractArtifacts } from "../limpiezaArtifacts";
import { useCierreLimpieza } from "../entregas/useCierreLimpieza";
import { useValidacionStore } from "../store";
import {
  type EditorForm,
  NEW_DECISION,
  buildCaseRows,
  buildDecisionPayload,
  buildEditorForm,
  deriveDecisionCounts,
  emptyEditorForm,
  inferSourceType,
  isSystemColumn,
  uniqueStrings,
} from "./modeloLimpieza";

export function useMesaDeLimpieza() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);

  const [data, setData] = useState<LimpiezaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  // ADR 0133: "Cerrar y generar base" ofrece sus archivos en el contenedor del kit de entregables.
  const cierre = useCierreLimpieza(baseNombre);
  const finalizeBusy = cierre.cerrando;
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
  // V3: el motor simula en cada guardado y devuelve el antes/después; hasta
  // ahora ese payload llegaba acá y no lo miraba nadie.
  const impacto = useMemo(
    () => calcularImpacto(data?.before_after_preview, data?.summary),
    [data?.before_after_preview, data?.summary],
  );
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

  // El resultado (los archivos del cierre o su fallo) sale en el contenedor bajo "Cerrar y generar base".
  async function handleFinalize() {
    setActionError("");
    setNotice("");
    if (await cierre.finalizar()) await loadLimpieza({ quiet: true });
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


  return {
    loading,
    error,
    data,
    canFinalize,
    artifacts,
    refreshBusy,
    finalizeBusy,
    decisionCounts,
    activeFilterKind,
    setActiveFilterKind,
    loadLimpieza,
    handleFinalize,
    cierre,
    impacto,
    revertBusy,
    handleRevertirPromocion,
    notice,
    actionError,
    orderedQueue,
    selectedSourceId,
    setSelectedSourceId,
    setSelectedDecisionId,
    editorRef,
    drill,
    selectedQueueItem,
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
    historyOpen,
    setHistoryOpen,
    saveBusy,
    handleSave,
    handleDeleteDecision,
    navigateQueue,
    selectedDecision,
  };
}

export type MesaDeLimpieza = ReturnType<typeof useMesaDeLimpieza>;
