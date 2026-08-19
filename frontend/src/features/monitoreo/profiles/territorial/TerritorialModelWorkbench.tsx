import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ContactRound,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Table2,
  Target,
} from "lucide-react";
import {
  apiJobStatus,
  apiMonitoreoSync,
  type JobSnapshot,
  type MonitoreoConfig,
  type MonitoreoSource,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type TerritorialBlockProgress,
} from "../../../../api/client";
import { TerritorialRouteCoverageAtlas } from "./TerritorialRouteCoverageAtlas";

type TerritorialModelTab = "resumen" | "tabla";

export type TerritorialModelWorkbenchProps = {
  pestanaActiva?: string;
  busy?: boolean;
  phase: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  onError?: (message: string) => void;
  onReload: () => void;
};

type RouteMetricCard = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Route;
};

function isModelTab(value: unknown): value is TerritorialModelTab {
  return value === "resumen" || value === "tabla";
}

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function phaseLabel(phase: MonitoreoTerritorialPhase) {
  return phase === "pilot" ? "Piloto" : "Campo";
}

function sourcePhase(source: MonitoreoSource | null | undefined): MonitoreoTerritorialPhase | "" {
  const phase = source?.dimensions?.territorial_phase;
  return phase === "pilot" || phase === "field" ? phase : "";
}

function koboSourceForPhase(sources: MonitoreoSource[], config: MonitoreoConfig, phase: MonitoreoTerritorialPhase) {
  const phaseSource = config.territorial.phase_sources?.[phase];
  return sources.find((source) => source.id && source.id === phaseSource?.source_id)
    ?? sources.find((source) => source.kind === "kobo" && source.asset_uid && source.asset_uid === phaseSource?.asset_uid)
    ?? sources.find((source) => source.kind === "kobo" && sourcePhase(source) === phase)
    ?? sources.find((source) => source.kind === "kobo" && source.enabled && source.role !== "ocurrencias_campo")
    ?? sources.find((source) => source.kind === "kobo" && source.role !== "ocurrencias_campo")
    ?? null;
}

function routeBlocksFromReports(reports: MonitoreoTerritorialDashboard | null) {
  if (!reports) return [];
  if (reports.route_blocks?.length) return reports.route_blocks;
  if (reports.map?.blocks?.length) return reports.map.blocks;
  return reports.block_progress ?? [];
}

function routeBlockStableKey(block: TerritorialBlockProgress | null | undefined) {
  if (!block) return "";
  return String(block.id_manzana || [
    block.ubigeo,
    block.zona,
    block.manzana,
    block.tipo_manzana,
    block.hoja_num,
    block.rango_inicio,
  ].join("|"));
}

function routeRangeStart(block: TerritorialBlockProgress) {
  return numberOrNull(block.rango_inicio) ?? Number.MAX_SAFE_INTEGER;
}

function routeUmpNumber(block: TerritorialBlockProgress) {
  return numberOrNull(block.hoja_num)
    ?? numberOrNull(block.orden_seleccion)
    ?? numberOrNull(block.ump)
    ?? numberOrNull(block.titular_hoja_num)
    ?? Number.MAX_SAFE_INTEGER;
}

function routeReplacementOrder(block: TerritorialBlockProgress) {
  return numberOrNull(block.replacement_order)
    ?? numberOrNull(block.hoja_num)
    ?? numberOrNull(block.orden_seleccion)
    ?? Number.MAX_SAFE_INTEGER;
}

function routeBlockComparator(a: TerritorialBlockProgress, b: TerritorialBlockProgress) {
  const aReplacement = a.tipo_manzana === "reemplazo" ? 1 : 0;
  const bReplacement = b.tipo_manzana === "reemplazo" ? 1 : 0;
  return routeRangeStart(a) - routeRangeStart(b)
    || aReplacement - bReplacement
    || routeUmpNumber(a) - routeUmpNumber(b)
    || String(a.distrito || "").localeCompare(String(b.distrito || ""), "es-PE")
    || String(a.zona || "").localeCompare(String(b.zona || ""), "es-PE", { numeric: true })
    || String(a.manzana || "").localeCompare(String(b.manzana || ""), "es-PE", { numeric: true });
}

function routePrimaryUmpNumber(block: TerritorialBlockProgress) {
  if (block.tipo_manzana === "reemplazo") {
    return numberOrNull(block.titular_hoja_num)
      ?? numberOrNull(block.titular_orden_seleccion)
      ?? Number.MAX_SAFE_INTEGER;
  }
  return routeUmpNumber(block);
}

function routePrimaryUmpLabel(block: TerritorialBlockProgress) {
  const value = routePrimaryUmpNumber(block);
  return Number.isFinite(value) && value !== Number.MAX_SAFE_INTEGER ? `UMP ${fmt(value)}` : "UMP por definir";
}

function routeReplacementUmpNumber(block: TerritorialBlockProgress) {
  return numberOrNull(block.titular_hoja_num)
    ?? numberOrNull(block.titular_orden_seleccion)
    ?? numberOrNull(block.ump);
}

function routeReplacementLabel(block: TerritorialBlockProgress) {
  const unit = routeReplacementUmpNumber(block);
  const order = numberOrNull(block.replacement_order);
  if (unit != null) {
    return order != null && order > 1 ? `R ${fmt(unit)}.${fmt(order)}` : `R ${fmt(unit)}`;
  }
  const fallbackOrder = routeReplacementOrder(block);
  return Number.isFinite(fallbackOrder) && fallbackOrder !== Number.MAX_SAFE_INTEGER ? `R ${fmt(fallbackOrder)}` : "R";
}

function routeOperationalLabel(block: TerritorialBlockProgress) {
  if (block.tipo_manzana === "reemplazo") {
    const primary = routePrimaryUmpLabel(block);
    const replacement = routeReplacementLabel(block);
    return primary === "UMP por definir" ? replacement : `${primary} · ${replacement}`;
  }
  return routePrimaryUmpLabel(block);
}

function physicalBlockLabel(block: TerritorialBlockProgress) {
  return `Mz ${block.manzana || block.id_manzana || "S/D"}`;
}

function routeBlockResponsible(block: TerritorialBlockProgress | null | undefined) {
  const record = block as (TerritorialBlockProgress & Record<string, unknown>) | null | undefined;
  const value = record?.responsable
    ?? record?.responsible_display
    ?? record?.responsible
    ?? record?.encuestador
    ?? record?.assigned_to;
  return String(value ?? "").trim();
}

function routeBlockResponsibleLabel(block: TerritorialBlockProgress | null | undefined, fallback = "S/D") {
  return routeBlockResponsible(block) || fallback;
}

function routeRangeLabel(block: TerritorialBlockProgress) {
  const start = numberOrNull(block.rango_inicio);
  const end = numberOrNull(block.rango_fin);
  if (start != null && end != null) return `${fmt(start)}-${fmt(end)}`;
  const meta = numberOrNull(block.entrevistas ?? block.meta);
  return meta != null ? `1-${fmt(meta)}` : "Por definir";
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("es-PE");
}

function replacementMatchesTitular(replacement: TerritorialBlockProgress, titular: TerritorialBlockProgress) {
  if (replacement.tipo_manzana !== "reemplazo") return false;
  const titularId = normalizeText(titular.id_manzana);
  if (titularId && normalizeText(replacement.titular_id_manzana) === titularId) return true;
  const sameUbigeo = normalizeText(replacement.titular_ubigeo || replacement.ubigeo) === normalizeText(titular.ubigeo);
  const sameZone = normalizeText(replacement.titular_zona || replacement.zona) === normalizeText(titular.zona);
  const sameRange = numberOrNull(replacement.titular_rango_inicio) === numberOrNull(titular.rango_inicio)
    && numberOrNull(replacement.titular_rango_fin) === numberOrNull(titular.rango_fin);
  const sameUmp = numberOrNull(replacement.titular_hoja_num) === numberOrNull(titular.hoja_num)
    || numberOrNull(replacement.titular_orden_seleccion) === numberOrNull(titular.orden_seleccion);
  return sameUbigeo && sameZone && (sameRange || sameUmp);
}

function resolveRouteSet(block: TerritorialBlockProgress | null, blocks: TerritorialBlockProgress[]) {
  if (!block) return { titularBlock: null, replacementBlocks: [] as TerritorialBlockProgress[], routeBlocks: [] as TerritorialBlockProgress[] };
  const titularBlock = block.tipo_manzana !== "reemplazo"
    ? block
    : blocks.find((candidate) => candidate.tipo_manzana !== "reemplazo" && replacementMatchesTitular(block, candidate)) ?? null;
  const replacementBlocks = titularBlock
    ? blocks.filter((candidate) => replacementMatchesTitular(candidate, titularBlock)).sort(routeBlockComparator)
    : [];
  return {
    titularBlock,
    replacementBlocks,
    routeBlocks: [...(titularBlock ? [titularBlock] : []), ...replacementBlocks],
  };
}

function findQuotaForBlock(
  reports: MonitoreoTerritorialDashboard | null,
  block: TerritorialBlockProgress | null,
) {
  if (!reports || !block) return null;
  const rows = reports.route_quota_marginals?.blocks ?? [];
  return rows.find((row) => (
    normalizeText(row.id_manzana) === normalizeText(block.id_manzana)
    || (
      normalizeText(row.ubigeo) === normalizeText(block.ubigeo)
      && normalizeText(row.zona) === normalizeText(block.zona)
      && normalizeText(row.manzana) === normalizeText(block.manzana)
    )
  )) ?? null;
}

function jobProgressText(job: JobSnapshot | null) {
  const progress = job?.progress;
  if (!progress) return "";
  if ("message" in progress && typeof progress.message === "string" && progress.message) return progress.message;
  if ("phase" in progress && typeof progress.phase === "string" && progress.phase) return progress.phase;
  return "";
}

function isTerminalJob(job: JobSnapshot | null) {
  return job?.status === "done" || job?.status === "error" || job?.status === "cancelled";
}

function TerritorialModelWorkbenchImpl({
  pestanaActiva,
  busy = false,
  phase,
  reports,
  state,
  onError,
  onReload,
}: TerritorialModelWorkbenchProps) {
  const activeTab: TerritorialModelTab = isModelTab(pestanaActiva) ? pestanaActiva : "resumen";
  const config = state?.config ?? null;
  const sources = state?.sources ?? [];
  const koboSource = config ? koboSourceForPhase(sources, config, phase) : null;
  const [syncing, setSyncing] = useState(false);
  const [syncJob, setSyncJob] = useState<JobSnapshot | null>(null);
  const [syncJobId, setSyncJobId] = useState("");
  const syncJobReloadedRef = useRef("");

  const blocks = useMemo(() => routeBlocksFromReports(reports), [reports]);
  const titularBlocks = useMemo(() => blocks.filter((block) => block.tipo_manzana !== "reemplazo").sort(routeBlockComparator), [blocks]);
  const [selectedBlockKey, setSelectedBlockKey] = useState("");
  const [inspectedBlockKey, setInspectedBlockKey] = useState("");

  useEffect(() => {
    if (!titularBlocks.length) {
      setSelectedBlockKey("");
      setInspectedBlockKey("");
      return;
    }
    const currentExists = selectedBlockKey && titularBlocks.some((block) => routeBlockStableKey(block) === selectedBlockKey);
    if (!currentExists) {
      const preferredId = reports?.selected_block_context?.default_block_id || "";
      const preferred = titularBlocks.find((block) => block.id_manzana === preferredId) ?? titularBlocks[0];
      const key = routeBlockStableKey(preferred);
      setSelectedBlockKey(key);
      setInspectedBlockKey(key);
    }
  }, [reports?.selected_block_context?.default_block_id, selectedBlockKey, titularBlocks]);

  const selectedBlock = titularBlocks.find((block) => routeBlockStableKey(block) === selectedBlockKey) ?? null;
  const selectedRouteSet = useMemo(() => resolveRouteSet(selectedBlock, blocks), [blocks, selectedBlock]);
  const selectedRouteKeys = useMemo(() => new Set(selectedRouteSet.routeBlocks.map(routeBlockStableKey)), [selectedRouteSet.routeBlocks]);

  useEffect(() => {
    if (!selectedBlock) {
      if (inspectedBlockKey) setInspectedBlockKey("");
      return;
    }
    if (!inspectedBlockKey || !selectedRouteKeys.has(inspectedBlockKey)) {
      setInspectedBlockKey(selectedBlockKey);
    }
  }, [inspectedBlockKey, selectedBlock, selectedBlockKey, selectedRouteKeys]);

  const inspectedBlock = useMemo(() => {
    if (inspectedBlockKey) {
      const candidate = selectedRouteSet.routeBlocks.find((block) => routeBlockStableKey(block) === inspectedBlockKey);
      if (candidate) return candidate;
    }
    return selectedBlock;
  }, [inspectedBlockKey, selectedBlock, selectedRouteSet.routeBlocks]);

  const notifyError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    onError?.(message);
    return message;
  }, [onError]);

  useEffect(() => {
    if (!syncJobId) return;
    if (isTerminalJob(syncJob)) {
      if (syncJob?.status === "done" && syncJobReloadedRef.current !== syncJobId) {
        syncJobReloadedRef.current = syncJobId;
        onReload();
      }
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await apiJobStatus(syncJobId);
        if (cancelled) return;
        setSyncJob(next);
        if (next.status === "done" && syncJobReloadedRef.current !== syncJobId) {
          syncJobReloadedRef.current = syncJobId;
          onReload();
        }
        if (next.status === "error" || next.status === "cancelled") {
          setSyncJobId("");
        }
      } catch (error) {
        if (!cancelled) {
          notifyError(error);
          setSyncJobId("");
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 1400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [notifyError, onReload, syncJob?.status, syncJobId]);

  const syncKobo = useCallback(async () => {
    if (!config || !koboSource?.id) return;
    setSyncing(true);
    try {
      const result = await apiMonitoreoSync(config, [koboSource.id]);
      setSyncJobId(result.job_id);
      syncJobReloadedRef.current = "";
      const first = await apiJobStatus(result.job_id).catch(() => null);
      setSyncJob(first);
      onReload();
    } catch (error) {
      notifyError(error);
    } finally {
      setSyncing(false);
    }
  }, [config, koboSource?.id, notifyError, onReload]);

  const activeSourceName = koboSource?.label || reports?.source_coherence?.asset_name || "Formulario Kobo activo";
  const activeAsset = koboSource?.asset_uid || reports?.source_coherence?.asset_uid || "sin asset";
  const activeVersion = reports?.source_coherence?.version_id || "sin versión";
  const routeOverview = reports?.route_overview ?? null;
  const routeSheet = reports?.route_sheet ?? null;
  const responseCount = reports?.source_validity?.total_responses ?? reports?.kpis.total_respuestas ?? 0;
  const routeMeta = routeOverview?.total_entrevistas ?? reports?.kpis.meta ?? null;
  const replacementCount = routeOverview?.replacement_count ?? Math.max(0, blocks.length - titularBlocks.length);
  const crossedDistricts = routeOverview?.district_count ?? reports?.district_progress?.length ?? 0;
  const responsibleCount = reports?.responsible_summary?.configured ? reports.responsible_summary.distinct_count : null;
  const responsibleHint = responsibleCount == null ? "por configurar" : responsibleCount > 0 ? "detectados" : "sin asignar";
  // Sin techo. El `Math.min(100, …)` que estaba aquí servía para la barra, pero
  // el MISMO valor se imprime como texto: con 1 693 respuestas sobre una meta de
  // 1 200 decía «100% de 1,200 entrevistas» en vez de 141 %. Pasarse de la meta
  // es un dato del operativo, no un desbordamiento que haya que esconder —y la
  // pestaña vecina ya enseña «107 %» sin problema—. El techo va donde hace falta,
  // que es el ancho de la barra.
  const progressPct = routeMeta && routeMeta > 0 ? Math.max(0, Math.round((responseCount / routeMeta) * 100)) : null;
  const cards: RouteMetricCard[] = [
    { label: "Titulares", value: fmt(titularBlocks.length || reports?.block_progress.length || 0), hint: "manzanas seleccionadas", icon: Route },
    { label: "Reemplazos", value: fmt(replacementCount), hint: `${routeOverview?.replacement_per_route == null ? "Por definir" : fmt(routeOverview.replacement_per_route)} por titular`, icon: Link2 },
    { label: "Distritos", value: fmt(crossedDistricts), hint: "con manzanas", icon: MapPin },
    { label: "Responsables", value: responsibleCount == null ? "Por definir" : fmt(responsibleCount), hint: responsibleHint, icon: ContactRound },
    { label: "Respuestas Kobo", value: fmt(responseCount), hint: "sincronizadas", icon: ClipboardCheck },
    { label: "Meta fase", value: routeMeta == null ? "Por definir" : fmt(routeMeta), hint: "entrevistas previstas", icon: Target },
  ];

  return (
    <div className="mon-stage mon-stage--modelo">
      <div className="mon-territorial-panel mon-territorial-route-panel">
        <div className="mon-territorial-route-workbench" data-model-tab={activeTab}>
          <section className="mon-territorial-route-command" aria-label="Resumen de UMPs">
            <div className="mon-territorial-route-title">
              <span><Route size={15} /> UMPs</span>
              <strong title={activeSourceName}>{activeSourceName}</strong>
              <em>{phaseLabel(phase)} · {activeAsset} · {activeVersion}</em>
            </div>
            <div className="mon-territorial-route-command-facts" aria-label="Estado de selección territorial">
              <span><strong>{fmt(titularBlocks.length || reports?.block_progress.length || 0)}</strong><em>titulares</em></span>
              <span><strong>{fmt(replacementCount)}</strong><em>reemplazos</em></span>
              <span><strong>{fmt(crossedDistricts)}</strong><em>distritos</em></span>
              <span><strong>{routeMeta == null ? "S/D" : fmt(routeMeta)}</strong><em>meta fase</em></span>
            </div>
            <button type="button" className="pulso-button is-primary" onClick={() => { void syncKobo(); }} disabled={busy || syncing || !koboSource?.id}>
              {syncing ? <Loader2 size={15} className="pulso-spin" /> : <RefreshCw size={15} />}
              <span>{phase === "pilot" ? "Sincronizar piloto" : "Sincronizar campo"}</span>
            </button>
          </section>

          {syncJob ? (
            <div className={`mon-territorial-route-sheet-strip ${syncJob.status === "error" ? "is-warning" : "is-ready"}`} aria-label="Estado de sincronización de Modelo">
              <header>
                <span><RefreshCw size={13} /> Job Kobo</span>
                <strong>{syncJob.status}</strong>
                <em>{jobProgressText(syncJob) || syncJob.id}</em>
              </header>
              <div className="mon-territorial-route-sheet-metrics">
                <span className={syncJob.status === "done" ? "is-ready" : "is-warning"}><CheckCircle2 size={13} /><strong>{syncJob.status === "done" ? "OK" : "En curso"}</strong><em>estado</em><small>{syncJob.finished_at ? "finalizado" : "pendiente"}</small></span>
                <span><ClipboardCheck size={13} /><strong>{syncJob.has_file_result ? "Sí" : "No"}</strong><em>archivo</em><small>{syncJob.result_filename || "sin resultado"}</small></span>
              </div>
              <div className="mon-territorial-route-sheet-actions">
                <span className={syncJob.status === "done" ? "is-ready" : "is-warning"}>{syncJob.id}</span>
              </div>
            </div>
          ) : null}

          {!reports ? (
            <div className="mon-territorial-route-map-placeholder">
              <span><Route size={18} /></span>
              <strong>Sin manzanas seleccionadas</strong>
              <em>Sincroniza Kobo y confirma que el proyecto tiene corrida piloto/campo en Hojas de Ruta.</em>
            </div>
          ) : activeTab === "tabla" ? (
            <div className="mon-territorial-route-table-workspace">
              <aside className="mon-territorial-route-sidebar" aria-label="Lista y ficha técnica de UMP">
                <RouteBlockTable
                  blocks={blocks}
                  selectedBlockKey={selectedBlockKey}
                  inspectedBlockKey={inspectedBlockKey}
                  onSelectBlock={(key) => {
                    setSelectedBlockKey(key);
                    setInspectedBlockKey(key);
                  }}
                  onInspectBlock={setInspectedBlockKey}
                />
                <RouteBlockContext
                  reports={reports}
                  block={inspectedBlock}
                  routeBlocks={selectedRouteSet.routeBlocks}
                  onInspectBlock={setInspectedBlockKey}
                />
              </aside>
            </div>
          ) : (
            <RouteSummary
              cards={cards}
              reports={reports}
              blocks={blocks}
              routeMeta={routeMeta}
              responseCount={responseCount}
              progressPct={progressPct}
              phase={phase}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ⚠ SIN MONTAR. Definida y nunca referenciada en todo `src`.
function RouteSheetStrip({
  routeSheet,
  onReload,
}: {
  routeSheet: MonitoreoTerritorialDashboard["route_sheet"] | null | undefined;
  onReload: () => void;
}) {
  const connected = Boolean(routeSheet?.connected && routeSheet.headers_ok);
  const metrics = routeSheet?.metrics ?? null;
  const batchCount = routeSheet?.recommendations?.batch?.length ?? 0;
  const warnings = routeSheet?.warnings ?? [];
  return (
    <section className={`mon-territorial-route-sheet-strip ${connected ? "is-ready" : "is-warning"}`} aria-label="Asignación operativa de hoja de ruta">
      <header>
        <span><Table2 size={13} /> Hoja de ruta operativa</span>
        <strong>{connected ? routeSheet?.source_label || "Conectada" : "Pendiente o incompleta"}</strong>
        <em>{warnings[0]?.message || routeSheet?.reason || "Cruce de asignaciones, responsables y manzanas."}</em>
      </header>
      <div className="mon-territorial-route-sheet-metrics">
        <span className={connected ? "is-ready" : "is-warning"}><CheckCircle2 size={13} /><strong>{fmt(metrics?.assignments ?? 0)}</strong><em>asignaciones</em><small>{fmt(metrics?.matched_rows ?? 0)} cruzadas</small></span>
        <span className={(metrics?.assigned_without_response ?? 0) ? "is-warning" : "is-ready"}><ClipboardCheck size={13} /><strong>{fmt(metrics?.assigned_without_response ?? 0)}</strong><em>sin encuesta</em><small>{fmt(metrics?.orphan_responses ?? 0)} huerfanas</small></span>
        <span className={batchCount ? "is-warning" : "is-ready"}><Link2 size={13} /><strong>{fmt(batchCount)}</strong><em>reconciliar</em><small>{fmt(metrics?.wrong_ump_candidates ?? 0)} UMP</small></span>
        <span><ContactRound size={13} /><strong>{fmt(routeSheet?.assignment_progress?.length ?? 0)}</strong><em>responsables</em><small>{fmt(metrics?.assigned_encuestadores ?? 0)} asignados</small></span>
      </div>
      <div className="mon-territorial-route-sheet-actions">
        <span className={connected ? "is-ready" : "is-warning"}>{connected ? "Hoja lista" : "Revisar fuente"}</span>
        <button type="button" onClick={onReload}>
          <RefreshCw size={13} />
          <span>Releer modelo</span>
        </button>
      </div>
    </section>
  );
}

function RouteSummary({
  cards,
  reports,
  blocks,
  routeMeta,
  responseCount,
  progressPct,
  phase,
}: {
  cards: RouteMetricCard[];
  reports: MonitoreoTerritorialDashboard;
  blocks: TerritorialBlockProgress[];
  routeMeta: number | null;
  responseCount: number;
  progressPct: number | null;
  phase: MonitoreoTerritorialPhase;
}) {
  return (
    <TerritorialRouteCoverageAtlas
      cards={cards}
      reports={reports}
      blocks={blocks}
      routeMeta={routeMeta}
      responseCount={responseCount}
      progressPct={progressPct}
      phaseLabel={phaseLabel(phase)}
    />
  );
}

function RouteBlockTable({
  blocks,
  selectedBlockKey,
  inspectedBlockKey,
  onSelectBlock,
  onInspectBlock,
}: {
  blocks: TerritorialBlockProgress[];
  selectedBlockKey: string;
  inspectedBlockKey: string;
  onSelectBlock: (key: string) => void;
  onInspectBlock: (key: string) => void;
}) {
  const [districtFilter, setDistrictFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(() => new Set());
  const titularRows = useMemo(() => blocks.filter((block) => block.tipo_manzana !== "reemplazo").sort(routeBlockComparator), [blocks]);
  const replacementCount = blocks.filter((block) => block.tipo_manzana === "reemplazo").length;
  const replacementsByTitularKey = useMemo(() => {
    const map = new Map<string, TerritorialBlockProgress[]>();
    titularRows.forEach((block) => {
      const key = routeBlockStableKey(block);
      if (key) map.set(key, resolveRouteSet(block, blocks).replacementBlocks);
    });
    return map;
  }, [blocks, titularRows]);
  const districtOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    titularRows.forEach((block) => {
      const value = String(block.ubigeo || block.distrito || "").trim();
      if (value && !map.has(value)) map.set(value, { value, label: block.distrito || value });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es-PE"));
  }, [titularRows]);
  const filtered = useMemo(() => {
    const q = normalizeText(searchQuery);
    return titularRows.filter((block) => {
      const districtOk = !districtFilter || String(block.ubigeo || block.distrito || "") === districtFilter;
      const haystack = normalizeText([
        block.ump,
        block.hoja_num,
        block.id_manzana,
        block.distrito,
        block.zona,
        block.manzana,
        routeBlockResponsible(block),
        block.territorio_muestral,
      ].join(" "));
      return districtOk && (!q || haystack.includes(q));
    });
  }, [districtFilter, searchQuery, titularRows]);
  const filtersActive = Boolean(districtFilter || searchQuery.trim());

  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.some((block) => routeBlockStableKey(block) === selectedBlockKey)) {
      const key = routeBlockStableKey(filtered[0]);
      onSelectBlock(key);
      onInspectBlock(key);
    }
  }, [filtered, onInspectBlock, onSelectBlock, selectedBlockKey]);

  useEffect(() => {
    setExpandedBlocks((previous) => {
      const available = new Set(filtered.map(routeBlockStableKey).filter(Boolean));
      const next = new Set(Array.from(previous).filter((key) => available.has(key)));
      if (selectedBlockKey && available.has(selectedBlockKey)) next.add(selectedBlockKey);
      if (!next.size && filtered[0]) next.add(routeBlockStableKey(filtered[0]));
      return next;
    });
  }, [filtered, selectedBlockKey]);

  const selectTitularBlock = (key: string) => {
    onSelectBlock(key);
    onInspectBlock(key);
    setExpandedBlocks((previous) => new Set(previous).add(key));
  };
  const inspectReplacementBlock = (titularKey: string, replacementKey: string) => {
    onSelectBlock(titularKey);
    onInspectBlock(replacementKey);
    setExpandedBlocks((previous) => new Set(previous).add(titularKey));
  };

  return (
    <section className="mon-territorial-route-table-card" aria-label="Manzanas titulares de Hojas de Ruta">
      <header>
        <span><Table2 size={13} /> Manzanas titulares</span>
        <strong>{filtersActive ? `${fmt(filtered.length)} / ${fmt(titularRows.length)} titulares` : `${fmt(titularRows.length)} titulares`}{replacementCount ? ` · ${fmt(replacementCount)} reemplazos` : ""}</strong>
      </header>
      <div className="mon-territorial-route-table-filters" aria-label="Filtros de manzanas">
        <label>
          <span>Distrito</span>
          <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
            <option value="">Todos</option>
            {districtOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="is-search">
          <span>Buscar UMP</span>
          <div className="mon-territorial-route-search-field">
            <Search size={13} />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="UMP 89, Mz 0590, responsable" />
          </div>
        </label>
        <button type="button" onClick={() => { setDistrictFilter(""); setSearchQuery(""); }} disabled={!filtersActive}>Limpiar</button>
      </div>
      <div className="mon-territorial-route-table-scroll mon-territorial-route-accordion-scroll">
        {filtered.map((block) => {
          const key = routeBlockStableKey(block);
          const expanded = expandedBlocks.has(key);
          const selected = key === selectedBlockKey;
          const inspected = key === inspectedBlockKey;
          const replacements = replacementsByTitularKey.get(key) ?? [];
          return (
            <article key={key} className={`mon-territorial-route-accordion-item${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}>
              <button
                type="button"
                className="mon-territorial-route-accordion-trigger"
                aria-expanded={expanded}
                onClick={() => {
                  selectTitularBlock(key);
                  if (selected) {
                    setExpandedBlocks((previous) => {
                      const next = new Set(previous);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }
                }}
              >
                <ChevronDown size={14} className={expanded ? "is-expanded" : ""} />
                <span className="mon-territorial-route-accordion-title">
                  <strong title={`${block.distrito || block.ubigeo || ""} · ${physicalBlockLabel(block)}`}>{routeOperationalLabel(block)}</strong>
                  <em>{block.distrito || "Sin distrito"} · {physicalBlockLabel(block)} · Zona {block.zona || "S/D"} · Rango {routeRangeLabel(block)}</em>
                  <small>{routeBlockResponsibleLabel(block, "Sin responsable")}</small>
                </span>
                <span className="mon-territorial-route-accordion-meta">
                  <b>{replacements.length ? `${fmt(replacements.length)} reemplazos` : "sin reemplazos"}</b>
                  <i className="mon-territorial-route-badge is-titular">UMP titular</i>
                </span>
              </button>
              {expanded ? (
                <div className="mon-territorial-route-accordion-body">
                  <button type="button" className={`mon-territorial-route-primary-block${inspected ? " is-inspected" : ""}`} onClick={() => selectTitularBlock(key)}>
                    <span className="mon-territorial-route-badge is-titular">Titular</span>
                    <strong>{routeOperationalLabel(block)}</strong>
                    <em>{physicalBlockLabel(block)} · Zona {block.zona || "S/D"}</em>
                    <small>{routeBlockResponsibleLabel(block, "Sin responsable")} · {block.ubigeo || "sin ubigeo"} · {block.territorio_muestral || block.ump || "sin territorio"}</small>
                  </button>
                  <div className="mon-territorial-route-replacement-list" aria-label={`Reemplazos de ${block.manzana || block.id_manzana || "la titular"}`}>
                    {replacements.map((replacement) => {
                      const replacementKey = routeBlockStableKey(replacement);
                      return (
                        <button key={replacementKey} type="button" className={`mon-territorial-route-replacement-row${replacementKey === inspectedBlockKey ? " is-inspected" : ""}`} onClick={() => inspectReplacementBlock(key, replacementKey)}>
                          <span className="mon-territorial-route-badge is-replacement">{routeReplacementLabel(replacement)}</span>
                          <strong>{routeOperationalLabel(replacement)}</strong>
                          <em>{physicalBlockLabel(replacement)} · Zona {replacement.zona || "S/D"}</em>
                          <small>{routeBlockResponsibleLabel(replacement, "Sin responsable")} · Reemplazo de {routePrimaryUmpLabel(replacement)} · rango titular {routeRangeLabel(block)}</small>
                        </button>
                      );
                    })}
                    {!replacements.length ? <p className="mon-territorial-route-replacement-empty">Esta titular no tiene reemplazos asociados.</p> : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {!filtered.length ? <div className="mon-territorial-route-accordion-empty">Sin titulares para los filtros seleccionados.</div> : null}
      </div>
    </section>
  );
}

function RouteBlockContext({
  reports,
  block,
  routeBlocks,
  onInspectBlock,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  block: TerritorialBlockProgress | null;
  routeBlocks: TerritorialBlockProgress[];
  onInspectBlock: (key: string) => void;
}) {
  const quota = findQuotaForBlock(reports, block);
  const assignmentRows = reports?.route_sheet?.assignments?.filter((row) => (
    block && (
      normalizeText(row.matched_block_id) === normalizeText(block.id_manzana)
      || (
        normalizeText(row.matched_distrito || row.distrito) === normalizeText(block.distrito)
        && normalizeText(row.matched_zona || row.zona) === normalizeText(block.zona)
        && normalizeText(row.matched_manzana || row.manzana) === normalizeText(block.manzana)
      )
    )
  )) ?? [];
  const inspectedKey = routeBlockStableKey(block);
  const familyBlocks = routeBlocks.length ? routeBlocks : block ? [block] : [];
  return (
    <section className="mon-territorial-route-context-card" aria-label="Ficha operativa de manzana">
      <header>
        <span><Route size={13} /> Ficha UMP</span>
        <strong>{block ? routeOperationalLabel(block) : "Sin seleccion"}</strong>
      </header>
      {block ? (
        <div className="mon-territorial-route-context-body">
          <div className="mon-territorial-route-context-overview">
            <div className="mon-territorial-route-context-hero">
              <span className={`mon-territorial-route-badge ${block.tipo_manzana === "reemplazo" ? "is-replacement" : "is-titular"}`}>{block.tipo_manzana === "reemplazo" ? routeReplacementLabel(block) : "Titular"}</span>
              <strong>{routeOperationalLabel(block)}</strong>
              <em>{block.distrito || "Sin distrito"} · {physicalBlockLabel(block)} · Zona {block.zona || "S/D"}</em>
              <p>{block.tipo_manzana === "reemplazo" ? `Reemplazo de ${routePrimaryUmpLabel(block)}` : block.territorio_muestral || "Manzana titular de la ruta"}</p>
            </div>
            <div className="mon-territorial-route-context-metrics">
              <span><em>Rango</em><strong>{routeRangeLabel(block)}</strong></span>
              <span><em>Meta</em><strong>{fmt(block.meta ?? block.entrevistas, "S/D")}</strong></span>
              <span><em>Válidas</em><strong>{fmt(block.validas)}</strong></span>
              <span><em>Revisión</em><strong>{fmt(block.revision)}</strong></span>
              <span><em>Brecha</em><strong>{fmt(block.brecha, "S/D")}</strong></span>
              <span><em>Responsable</em><strong>{routeBlockResponsibleLabel(block)}</strong></span>
              <span><em>Avance</em><strong>{block.avance_pct == null ? "S/D" : `${fmt(block.avance_pct)}%`}</strong></span>
            </div>
          </div>
          {familyBlocks.length > 1 ? (
            <div className="mon-territorial-route-context-family" aria-label="Ruta UMP titular y reemplazos">
              <header>
                <span><Route size={12} /> Ruta UMP</span>
                <strong>{fmt(familyBlocks.length)} manzanas</strong>
              </header>
              <div>
                {familyBlocks.map((item) => {
                  const key = routeBlockStableKey(item);
                  const replacement = item.tipo_manzana === "reemplazo";
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`mon-territorial-route-context-family-row${key === inspectedKey ? " is-active" : ""}${replacement ? " is-replacement" : " is-titular"}`}
                      onClick={() => onInspectBlock(key)}
                    >
                      <span className={`mon-territorial-route-badge ${replacement ? "is-replacement" : "is-titular"}`}>{replacement ? routeReplacementLabel(item) : "Titular"}</span>
                      <strong>{routeOperationalLabel(item)}</strong>
                      <em>{physicalBlockLabel(item)} · Zona {item.zona || "S/D"}</em>
                      <small>{replacement ? `Reemplazo de ${routePrimaryUmpLabel(item)}` : `Rango ${routeRangeLabel(item)}`} · {routeBlockResponsibleLabel(item, "Sin responsable")}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="mon-territorial-route-context-tables">
            <details className="mon-territorial-route-context-details" open={assignmentRows.length > 0}>
              <summary><span>Asignaciones hoja</span><strong>{fmt(assignmentRows.length)} filas</strong></summary>
              <section className="mon-territorial-route-mini-table">
                {assignmentRows.length ? (
                  <div>
                    <table>
                      <thead><tr><th>Encuestador</th><th>Estado</th><th>Válidas</th></tr></thead>
                      <tbody>
                        {assignmentRows.slice(0, 8).map((row, index) => (
                          <tr key={`${row.source_row ?? index}-${row.encuestador ?? ""}`}>
                            <td>{row.encuestador || row.expected_code || "S/D"}</td>
                            <td>{row.estado || row.match_status || "S/D"}</td>
                            <td>{fmt(row.validas ?? row.response_count ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p>Sin asignaciones cruzadas para esta manzana.</p>}
              </section>
            </details>
            <details className="mon-territorial-route-context-details" open={Boolean(quota)}>
              <summary><span>Cuotas requeridas</span><strong>{quota?.total == null ? "No disponible" : `${fmt(quota.total)} cuotas`}</strong></summary>
              <section className="mon-territorial-route-mini-table mon-territorial-route-quota-marginals">
                {quota ? (
                  <div className="mon-territorial-route-quota-body">
                    <div className="mon-territorial-route-quota-chips">
                      {quota.sex_totals.slice(0, 2).map((row) => <span key={row.label}><em>{row.label}</em><strong>{fmt(row.value)}</strong></span>)}
                      <span className="is-total"><em>Total</em><strong>{fmt(quota.total)}</strong></span>
                    </div>
                    <table>
                      <thead><tr><th>Rango edad</th><th>Total</th></tr></thead>
                      <tbody>
                        {quota.age_totals.slice(0, 6).map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{fmt(row.value)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                ) : <p>No disponible en la fuente.</p>}
              </section>
            </details>
          </div>
        </div>
      ) : (
        <div className="mon-territorial-route-map-placeholder">
          <span><AlertTriangle size={18} /></span>
          <strong>Sin manzana inspeccionada</strong>
          <em>Selecciona una UMP titular para ver reemplazos, rango, cuotas y asignaciones.</em>
        </div>
      )}
    </section>
  );
}

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialModelWorkbench = memo(TerritorialModelWorkbenchImpl);
