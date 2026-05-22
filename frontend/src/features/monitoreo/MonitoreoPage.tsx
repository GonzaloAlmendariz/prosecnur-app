import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  Link2,
  Loader2,
  PhoneCall,
  PlugZap,
  RefreshCw,
  Save,
  ShieldAlert,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  apiMonitoreoAcreditacionSeguimiento,
  apiMonitoreoConfig,
  apiMonitoreoCierre,
  apiMonitoreoDemo,
  apiMonitoreoExport,
  apiMonitoreoImportFromCalcMuestra,
  apiMonitoreoSource,
  apiMonitoreoState,
  apiMonitoreoSupervisionSample,
  apiMonitoreoSync,
  downloadUrl,
  MonitoreoConfig,
  MonitoreoAcreditacion,
  MonitoreoAcreditacionComponente,
  MonitoreoAcreditacionIntentos,
  MonitoreoAcreditacionSeguimientoPayload,
  MonitoreoDashboard,
  MonitoreoGoal,
  MonitoreoRow,
  MonitoreoSourceKind,
  MonitoreoState,
  MonitoreoSyncResult,
  MonitoreoVariable,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Panel";
import { EmptyState, LoadingBlock } from "../../components/States";
import { useAnaliticaAutosave } from "../analitica/useAnaliticaAutosave";
import { EnumeradoresPane } from "../analitica/panes/EnumeradoresPane";
import "./monitoreo.css";

const EMPTY_ACREDITACION: MonitoreoAcreditacion = {
  enabled: false,
  modo_trabajo: "seguimiento_campo",
  estudio: {
    id: "",
    titulo: "Estudio de acreditacion",
    cliente: "",
    macro_familia: "acreditacion",
    creado_desde_calc_muestra: false,
  },
  componentes: [],
  plan_refuerzo: "",
  aprobacion_metodologica: false,
  cierre_at: "",
  dashboard: {
    cards: [],
    alertas: [],
    cierre_habilitado: false,
    bloqueos: 0,
  },
};

const EMPTY_CONFIG: MonitoreoConfig = {
  enumerator_var: "",
  date_var: "",
  start_var: "",
  end_var: "",
  duration_var: "",
  status_var: "",
  valid_statuses: ["completed", "valid", "approved", "aprobado"],
  id_var: "",
  contact_var: "",
  control_vars: [],
  critical_vars: [],
  goals: [],
  objetivo_total: null,
  min_duration_seconds: 60,
  max_duration_seconds: 7200,
  supervision_n: 20,
  supervision_seed: 20260514,
  acreditacion: EMPTY_ACREDITACION,
};

type SourceDraft = {
  kind: MonitoreoSourceKind;
  label: string;
  token: string;
  survey_id: string;
  asset_uid: string;
  base_url: string;
};

const DEFAULT_SOURCE: SourceDraft = {
  kind: "kobo",
  label: "",
  token: "",
  survey_id: "",
  asset_uid: "",
  base_url: "https://kf.kobotoolbox.org",
};

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "" || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrFallback(value: unknown, fallback: number): number {
  const n = numberOrNull(value);
  return n == null ? fallback : n;
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function mergeAcreditacion(value: unknown): MonitoreoAcreditacion {
  const acr = (value && typeof value === "object" ? value : {}) as Partial<MonitoreoAcreditacion>;
  const dashboard = acr.dashboard ?? EMPTY_ACREDITACION.dashboard;
  return {
    ...EMPTY_ACREDITACION,
    ...acr,
    estudio: { ...EMPTY_ACREDITACION.estudio, ...(acr.estudio ?? {}) },
    componentes: arrayOrEmpty<MonitoreoAcreditacionComponente>(acr.componentes),
    dashboard: {
      ...EMPTY_ACREDITACION.dashboard,
      ...dashboard,
      cards: arrayOrEmpty(dashboard.cards),
      alertas: arrayOrEmpty(dashboard.alertas),
    },
  };
}

function mergeConfig(config: Partial<MonitoreoConfig> | undefined): MonitoreoConfig {
  const next = { ...EMPTY_CONFIG, ...(config ?? {}) };
  return {
    ...next,
    valid_statuses: arrayOrEmpty<string>(next.valid_statuses).length ? arrayOrEmpty<string>(next.valid_statuses) : EMPTY_CONFIG.valid_statuses,
    control_vars: arrayOrEmpty<string>(next.control_vars),
    critical_vars: arrayOrEmpty<string>(next.critical_vars),
    goals: arrayOrEmpty<MonitoreoGoal>(next.goals),
    objetivo_total: numberOrNull(next.objetivo_total),
    min_duration_seconds: numberOrFallback(next.min_duration_seconds, EMPTY_CONFIG.min_duration_seconds),
    max_duration_seconds: numberOrFallback(next.max_duration_seconds, EMPTY_CONFIG.max_duration_seconds),
    supervision_n: numberOrFallback(next.supervision_n, EMPTY_CONFIG.supervision_n),
    supervision_seed: numberOrFallback(next.supervision_seed, EMPTY_CONFIG.supervision_seed),
    acreditacion: mergeAcreditacion(next.acreditacion),
  };
}

export default function MonitoreoPage() {
  useAnaliticaAutosave();

  const [state, setState] = useState<MonitoreoState | null>(null);
  const [config, setConfig] = useState<MonitoreoConfig>(EMPTY_CONFIG);
  const [source, setSource] = useState<SourceDraft>(DEFAULT_SOURCE);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingAcreditacion, setSavingAcreditacion] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exportLink, setExportLink] = useState<{ href: string; filename: string } | null>(null);
  const [sample, setSample] = useState<MonitoreoRow[]>([]);

  async function refresh() {
    setError("");
    const next = await apiMonitoreoState();
    setState(next);
    setConfig(mergeConfig(next.config));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiMonitoreoState()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setConfig(mergeConfig(next.config));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variables = state?.variables ?? [];
  const sources = state?.sources ?? [];
  const activeSources = sources.filter((s) => s.enabled);
  const acreditacion = mergeAcreditacion(state?.acreditacion ?? config.acreditacion);
  const rawDashboard = state?.dashboard;
  const dashboard: MonitoreoDashboard | null =
    rawDashboard?.kpis && Array.isArray(rawDashboard.progress) && Array.isArray(rawDashboard.production)
      ? {
          ...rawDashboard,
          progress: rawDashboard.progress ?? [],
          production: rawDashboard.production ?? [],
          inconsistencies: rawDashboard.inconsistencies ?? [],
        }
      : null;

  async function saveSource() {
    setSavingSource(true);
    setError("");
    try {
      const result = await apiMonitoreoSource({
        kind: source.kind,
        label: source.label || undefined,
        token: source.token || undefined,
        survey_id: source.kind === "surveymonkey" ? source.survey_id : undefined,
        asset_uid: source.kind === "kobo" ? source.asset_uid : undefined,
        base_url: source.base_url || undefined,
      });
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
      setSource((prev) => ({ ...prev, token: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSource(false);
    }
  }

  async function loadDemo() {
    setLoadingDemo(true);
    setError("");
    setExportLink(null);
    setSample([]);
    try {
      const result = await apiMonitoreoDemo();
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingDemo(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setError("");
    try {
      const result = await apiMonitoreoConfig(config);
      setState(result.state);
      setConfig(mergeConfig(result.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function importCalcMuestra() {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoImportFromCalcMuestra();
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function saveAcreditacionSeguimiento(payload: MonitoreoAcreditacionSeguimientoPayload) {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoAcreditacionSeguimiento(payload);
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function closeAcreditacion(plan_refuerzo: string, aprobar_brechas: boolean) {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoCierre({ plan_refuerzo, aprobar_brechas });
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function syncNow() {
    setError("");
    setExportLink(null);
    try {
      await apiMonitoreoConfig(config);
      const start = await apiMonitoreoSync(config);
      setJobId(start.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function exportReport() {
    setError("");
    try {
      const out = await apiMonitoreoExport(config);
      setExportLink({ href: downloadUrl(out.file_id), filename: out.filename ?? "monitoreo.xlsx" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function buildSample() {
    setError("");
    try {
      const out = await apiMonitoreoSupervisionSample({
        config,
        n: config.supervision_n,
        seed: config.supervision_seed,
      });
      setSample(out.sample);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <LoadingBlock label="Cargando monitoreo..." />;

  return (
    <PageFrame
      title="Monitoreo de campo"
      lead="Avance, calidad y supervision desde Kobo y SurveyMonkey."
      toolbar={
        <div className="mon-toolbar">
          <button type="button" onClick={syncNow} disabled={!activeSources.length || !!jobId}>
            {jobId ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
            Sincronizar
          </button>
          <button type="button" onClick={loadDemo} disabled={loadingDemo || !!jobId}>
            {loadingDemo ? <Loader2 size={14} className="pulso-spin" /> : <Database size={14} />}
            Cargar demo
          </button>
          <button type="button" onClick={saveConfig} disabled={savingConfig}>
            <Save size={14} />
            Guardar config
          </button>
          <button type="button" onClick={importCalcMuestra} disabled={savingAcreditacion}>
            {savingAcreditacion ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            Importar diseño
          </button>
          <button type="button" onClick={exportReport} disabled={!state?.has_snapshot}>
            <Download size={14} />
            Exportar
          </button>
          {exportLink && (
            <a className="mon-download-link" href={exportLink.href} download={exportLink.filename}>
              {exportLink.filename}
            </a>
          )}
        </div>
      }
      bodyMode="scroll"
      className="mon-page"
    >
      {error && <Alert kind="error">{error}</Alert>}
      <JobProgress<MonitoreoSyncResult>
        label="Sincronizando monitoreo"
        jobId={jobId}
        onDone={async () => {
          setJobId(null);
          await refresh();
        }}
        onError={(msg) => {
          setJobId(null);
          setError(msg);
        }}
        onCancelled={() => setJobId(null)}
      />

      {dashboard ? (
        <>
          <DashboardSummary dashboard={dashboard} syncedAt={state?.synced_at ?? ""} nRows={state?.n_rows ?? 0} />
          <div className="mon-grid mon-grid--wide mon-grid--tables">
            <TablePanel title="Avance de metas" icon={<Target size={16} />} rows={dashboard.progress} />
            <TablePanel title="Produccion" icon={<Activity size={16} />} rows={dashboard.production} />
          </div>
          <div className="mon-grid mon-grid--wide mon-grid--tables">
            <TablePanel title="Inconsistencias" icon={<ShieldAlert size={16} />} rows={dashboard.inconsistencies} />
            <div className="mon-table-panel">
              <Panel
                eyebrow="Supervision"
                title={<span className="mon-title-icon"><PhoneCall size={16} /> Llamadas</span>}
                actions={<button type="button" onClick={buildSample} disabled={!state?.has_snapshot}>Generar muestra</button>}
              >
                <div className="mon-panel-fill">
                  {sample.length ? (
                    <DataTable rows={sample} />
                  ) : (
                    <EmptyState icon={<PhoneCall size={18} />} title="Sin muestra generada" variant="inline" />
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<RefreshCw size={18} />}
          title="Sin datos sincronizados"
          hint="Carga la demo o conecta una fuente para ver el tablero operativo."
          cta={
            <button type="button" className="mon-inline-action" onClick={loadDemo} disabled={loadingDemo}>
              {loadingDemo ? <Loader2 size={14} className="pulso-spin" /> : <Database size={14} />}
              Cargar demo
            </button>
          }
        />
      )}

      <AcreditacionPanel
        acreditacion={acreditacion}
        saving={savingAcreditacion}
        onImport={importCalcMuestra}
        onSaveSeguimiento={saveAcreditacionSeguimiento}
        onCerrar={closeAcreditacion}
      />

      <EnumeradoresPane />

      <div className="mon-grid mon-grid--wide mon-grid--intro">
        <DemoPanel loading={loadingDemo} onLoad={loadDemo} />
        <ConnectionManual />
      </div>

      <div className="mon-grid mon-grid--setup">
        <SourcePanel
          draft={source}
          setDraft={setSource}
          saving={savingSource}
          state={state}
          onSave={saveSource}
        />
        <MappingPanel
          config={config}
          setConfig={setConfig}
          variables={variables}
        />
      </div>
    </PageFrame>
  );
}

function DemoPanel({ loading, onLoad }: { loading: boolean; onLoad: () => void }) {
  return (
    <Panel
      eyebrow="Modo prueba"
      title={<span className="mon-title-icon"><Database size={16} /> Datos demo</span>}
      actions={
        <button type="button" onClick={onLoad} disabled={loading}>
          {loading ? <Loader2 size={14} className="pulso-spin" /> : <Database size={14} />}
          Cargar demo
        </button>
      }
    >
      <p className="mon-help-text">
        Carga una base ficticia con Kobo y SurveyMonkey simulados, metas, estados validos, duraciones,
        duplicados y campos criticos vacios. No usa internet ni tokens.
      </p>
      <div className="mon-demo-strip">
        <span>96 entrevistas</span>
        <span>2 fuentes simuladas</span>
        <span>12 llamadas sugeridas</span>
      </div>
    </Panel>
  );
}

function ConnectionManual() {
  const [platform, setPlatform] = useState<MonitoreoSourceKind>("kobo");
  const isKobo = platform === "kobo";
  return (
    <Panel eyebrow="Manual" title={<span className="mon-title-icon"><BookOpen size={16} /> Conexion por plataforma</span>}>
      <div className="mon-segmented" role="tablist" aria-label="Plataforma">
        <button type="button" className={isKobo ? "is-active" : ""} onClick={() => setPlatform("kobo")}>Kobo</button>
        <button type="button" className={!isKobo ? "is-active" : ""} onClick={() => setPlatform("surveymonkey")}>SurveyMonkey</button>
      </div>
      {isKobo ? (
        <div className="mon-manual">
          <h4>KoboToolbox</h4>
          <ol>
            <li>En Kobo, abre el proyecto y copia el UID del formulario desde la URL del asset.</li>
            <li>Crea o copia tu token de API desde la cuenta de Kobo.</li>
            <li>En Monitoreo, elige KoboToolbox, pega el Asset UID y el token.</li>
            <li>Usa la base URL segun servidor: `https://kf.kobotoolbox.org` o el servidor institucional.</li>
            <li>Guarda la fuente y presiona Sincronizar. El token queda cifrado en secrets, no en `.pulso`.</li>
          </ol>
        </div>
      ) : (
        <div className="mon-manual">
          <h4>SurveyMonkey</h4>
          <ol>
            <li>Reutiliza el token ya guardado en el editor XLSForm si existe.</li>
            <li>Verifica que la app/token tenga permiso `responses_read_detail` ademas del acceso a estructura.</li>
            <li>Copia el Survey ID desde SurveyMonkey o desde el listado del editor XLSForm.</li>
            <li>En Monitoreo, elige SurveyMonkey, pega el Survey ID y deja el token vacio si ya esta guardado.</li>
            <li>Guarda la fuente. Si falta scope de respuestas, la app lo avisara antes de sincronizar.</li>
          </ol>
        </div>
      )}
    </Panel>
  );
}

function SourcePanel({
  draft,
  setDraft,
  saving,
  state,
  onSave,
}: {
  draft: SourceDraft;
  setDraft: (fn: (prev: SourceDraft) => SourceDraft) => void;
  saving: boolean;
  state: MonitoreoState | null;
  onSave: () => void;
}) {
  const isSm = draft.kind === "surveymonkey";
  return (
    <Panel
      eyebrow="Fuentes"
      title={<span className="mon-title-icon"><PlugZap size={16} /> Conexion</span>}
      actions={
        <button type="button" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          Guardar fuente
        </button>
      }
    >
      <div className="mon-form">
        <label>
          <span>Tipo</span>
          <select
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as MonitoreoSourceKind;
              setDraft((prev) => ({
                ...prev,
                kind,
                base_url: kind === "kobo" ? "https://kf.kobotoolbox.org" : "https://api.surveymonkey.com/v3",
              }));
            }}
          >
            <option value="kobo">KoboToolbox</option>
            <option value="surveymonkey">SurveyMonkey</option>
          </select>
        </label>
        <label>
          <span>{isSm ? "Survey ID" : "Asset UID"}</span>
          <input
            value={isSm ? draft.survey_id : draft.asset_uid}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((prev) => isSm ? { ...prev, survey_id: value } : { ...prev, asset_uid: value });
            }}
          />
        </label>
        <label>
          <span>Token</span>
          <input
            type="password"
            value={draft.token}
            onChange={(e) => setDraft((prev) => ({ ...prev, token: e.target.value }))}
            placeholder={isSm && state?.sources.some((s) => s.kind === "surveymonkey") ? "Usar token guardado" : ""}
          />
        </label>
        <label>
          <span>Base URL</span>
          <input
            value={draft.base_url}
            onChange={(e) => setDraft((prev) => ({ ...prev, base_url: e.target.value }))}
          />
        </label>
      </div>

      <div className="mon-source-list">
        {(state?.sources ?? []).map((src) => (
          <div key={src.id} className={`mon-source-item${src.enabled ? "" : " is-disabled"}`}>
            <strong>{src.label}</strong>
            <span>{src.kind === "kobo" ? src.asset_uid : src.survey_id}</span>
            {src.enabled ? (src.last_sync_at && <em>{formatDate(src.last_sync_at)}</em>) : <em>demo</em>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MappingPanel({
  config,
  setConfig,
  variables,
}: {
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  variables: MonitoreoVariable[];
}) {
  const names = variables.map((v) => v.name);
  const set = (patch: Partial<MonitoreoConfig>) => setConfig({ ...config, ...patch });
  return (
    <Panel eyebrow="Control" title="Variables y metas">
      <div className="mon-form mon-form--two">
        <VarSelect label="Enumerador" value={config.enumerator_var} vars={names} onChange={(v) => set({ enumerator_var: v })} />
        <VarSelect label="Fecha" value={config.date_var} vars={names} onChange={(v) => set({ date_var: v })} />
        <VarSelect label="Estado" value={config.status_var} vars={names} onChange={(v) => set({ status_var: v })} />
        <VarSelect label="Duracion" value={config.duration_var} vars={names} onChange={(v) => set({ duration_var: v })} />
        <VarSelect label="ID" value={config.id_var} vars={names} onChange={(v) => set({ id_var: v })} />
        <VarSelect label="Contacto" value={config.contact_var} vars={names} onChange={(v) => set({ contact_var: v })} />
        <label>
          <span>Meta total</span>
          <input
            type="number"
            min={0}
            value={config.objetivo_total ?? ""}
            onChange={(e) => set({ objetivo_total: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label>
          <span>Estados validos</span>
          <input
            value={config.valid_statuses.join(", ")}
            onChange={(e) => set({ valid_statuses: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
          />
        </label>
      </div>
      <ChipPicker label="Variables de control" vars={names} selected={config.control_vars} onChange={(control_vars) => set({ control_vars })} />
      <ChipPicker label="Campos criticos" vars={names} selected={config.critical_vars} onChange={(critical_vars) => set({ critical_vars })} />
      <GoalsEditor goals={config.goals} vars={names} onChange={(goals) => set({ goals })} />
    </Panel>
  );
}

function VarSelect({ label, value, vars, onChange }: { label: string; value: string; vars: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {vars.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

function ChipPicker({ label, vars, selected, onChange }: { label: string; vars: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="mon-chip-block">
      <span>{label}</span>
      <div className="mon-chip-list">
        {vars.map((v) => {
          const active = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              className={active ? "is-active" : ""}
              onClick={() => onChange(active ? selected.filter((x) => x !== v) : [...selected, v])}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GoalsEditor({ goals, vars, onChange }: { goals: MonitoreoGoal[]; vars: string[]; onChange: (next: MonitoreoGoal[]) => void }) {
  function update(i: number, next: MonitoreoGoal) {
    onChange(goals.map((g, idx) => idx === i ? next : g));
  }
  return (
    <div className="mon-goals">
      <div className="mon-goals-head">
        <span>Metas por control</span>
        <button type="button" onClick={() => onChange([...goals, { filters: {}, meta: 0 }])}>Agregar meta</button>
      </div>
      {goals.map((goal, i) => {
        const key = Object.keys(goal.filters)[0] ?? "";
        const value = key ? goal.filters[key] ?? "" : "";
        return (
          <div key={i} className="mon-goal-row">
            <select
              value={key}
              onChange={(e) => update(i, { ...goal, filters: e.target.value ? { [e.target.value]: value } : {} })}
            >
              <option value="">Variable</option>
              {vars.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input value={value} onChange={(e) => key && update(i, { ...goal, filters: { [key]: e.target.value } })} />
            <input type="number" min={0} value={goal.meta} onChange={(e) => update(i, { ...goal, meta: Number(e.target.value) || 0 })} />
            <button type="button" aria-label="Quitar meta" onClick={() => onChange(goals.filter((_, idx) => idx !== i))}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DashboardSummary({ dashboard, syncedAt, nRows }: { dashboard: MonitoreoDashboard; syncedAt: string; nRows: number }) {
  const kpis = dashboard.kpis;
  const target = numberOrNull(kpis.target);
  const avancePct = numberOrNull(kpis.avance_pct);
  const ritmoDiario = numberOrNull(kpis.ritmo_diario);
  const durationP95 = numberOrNull(kpis.duration_p95);
  const items = [
    ["Validas", numberOrFallback(kpis.valid, 0)],
    ["Meta", target ?? "S/M"],
    ["Avance", avancePct == null ? "S/M" : `${avancePct}%`],
    ["Ritmo diario", ritmoDiario ?? "S/F"],
    ["P95 tiempo", durationP95 == null ? "S/T" : `${Math.round(durationP95)}s`],
    ["Alertas", numberOrFallback(kpis.inconsistencies, 0)],
  ];
  return (
    <div className="mon-dashboard-panel">
      <Panel eyebrow={syncedAt ? `Sync ${formatDate(syncedAt)}` : "Tablero"} title={`${nRows} registros sincronizados`}>
        <div className="mon-kpi-grid">
          {items.map(([label, value]) => (
            <div key={label} className="mon-kpi">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

type SeguimientoDraft = {
  n_efectivo: string;
  notas_campo: string;
  intentos: Record<keyof MonitoreoAcreditacionIntentos, string>;
};

const CANALES: Array<keyof MonitoreoAcreditacionIntentos> = ["email", "whatsapp", "sms", "telefono", "presencial"];

function draftFromComponent(comp: MonitoreoAcreditacionComponente | null): SeguimientoDraft {
  const intentos = comp?.seguimiento.intentos_canal ?? { email: 0, whatsapp: 0, sms: 0, telefono: 0, presencial: 0 };
  return {
    n_efectivo: String(comp?.seguimiento.n_efectivo ?? 0),
    notas_campo: comp?.seguimiento.notas_campo ?? "",
    intentos: {
      email: String(intentos.email ?? 0),
      whatsapp: String(intentos.whatsapp ?? 0),
      sms: String(intentos.sms ?? 0),
      telefono: String(intentos.telefono ?? 0),
      presencial: String(intentos.presencial ?? 0),
    },
  };
}

function AcreditacionPanel({
  acreditacion,
  saving,
  onImport,
  onSaveSeguimiento,
  onCerrar,
}: {
  acreditacion: MonitoreoAcreditacion;
  saving: boolean;
  onImport: () => void;
  onSaveSeguimiento: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
  onCerrar: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
}) {
  const componentes = acreditacion.componentes ?? [];
  const [activeId, setActiveId] = useState(componentes[0]?.id ?? "");
  const selected = componentes.find((comp) => comp.id === activeId) ?? componentes[0] ?? null;
  const [draft, setDraft] = useState<SeguimientoDraft>(() => draftFromComponent(selected));
  const [planRefuerzo, setPlanRefuerzo] = useState(acreditacion.plan_refuerzo ?? "");
  const [aprobarBrechas, setAprobarBrechas] = useState(acreditacion.aprobacion_metodologica ?? false);

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
    setPlanRefuerzo(acreditacion.plan_refuerzo ?? "");
    setAprobarBrechas(acreditacion.aprobacion_metodologica ?? false);
  }, [acreditacion.plan_refuerzo, acreditacion.aprobacion_metodologica]);

  async function saveSelected() {
    if (!selected) return;
    const intentos_canal = CANALES.reduce<Partial<MonitoreoAcreditacionIntentos>>((acc, canal) => {
      acc[canal] = Math.max(0, Number(draft.intentos[canal]) || 0);
      return acc;
    }, {});
    await onSaveSeguimiento({
      id: selected.id,
      n_efectivo: Math.max(0, Number(draft.n_efectivo) || 0),
      notas_campo: draft.notas_campo,
      intentos_canal,
    });
  }

  if (!acreditacion.enabled) {
    return (
      <Panel
        eyebrow="Acreditacion"
        title={<span className="mon-title-icon"><ClipboardCheck size={16} /> Acreditacion multi-actor</span>}
        actions={
          <button type="button" onClick={onImport} disabled={saving}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            Importar diseño
          </button>
        }
      >
        <EmptyState
          icon={<ClipboardCheck size={18} />}
          title="Sin estudio multi-componente"
          hint="Importa un diseño validado del calculador para activar seguimiento por actor."
          variant="inline"
        />
      </Panel>
    );
  }

  const dashboard = acreditacion.dashboard;
  const cierreListo = dashboard.cierre_habilitado || planRefuerzo.trim().length > 0 || aprobarBrechas;
  return (
    <Panel
      eyebrow={acreditacion.modo_trabajo === "cierre_campo" ? "Cierre de campo" : "Seguimiento de campo"}
      title={<span className="mon-title-icon"><ClipboardCheck size={16} /> {acreditacion.estudio.titulo}</span>}
      actions={
        <div className="mon-acr-actions">
          <button type="button" onClick={onImport} disabled={saving}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            Reimportar
          </button>
          <button
            type="button"
            onClick={() => onCerrar(planRefuerzo, aprobarBrechas)}
            disabled={saving || acreditacion.modo_trabajo === "cierre_campo" || !cierreListo}
          >
            <FileCheck2 size={14} />
            Marcar cierre
          </button>
        </div>
      }
    >
      <div className="mon-acr-grid">
        {dashboard.cards.map((card) => {
          const pct = numberOrNull(card.avance_pct);
          const width = Math.max(0, Math.min(100, pct ?? 0));
          const bench = card.benchmark_comparado;
          return (
            <button
              key={card.id}
              type="button"
              className={`mon-acr-card mon-acr-card--${card.estado}${selected?.id === card.id ? " is-active" : ""}`}
              onClick={() => setActiveId(card.id)}
            >
              <span className="mon-acr-card-head">
                <strong>{card.actor}</strong>
                <EstadoBadge estado={card.estado} />
              </span>
              <span className="mon-acr-count">
                {card.n_efectivo.toLocaleString("es-PE")} / {card.n_objetivo?.toLocaleString("es-PE") ?? "S/M"}
              </span>
              <span className="mon-acr-progress" aria-hidden="true"><i style={{ width: `${width}%` }} /></span>
              <span className="mon-acr-meta">
                {pct == null ? "Sin meta" : `${pct.toFixed(1)}%`}
                {bench ? ` · mediana ${formatRatioPct(bench.mediana_historica)}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {dashboard.alertas.length > 0 && (
        <div className="mon-acr-alerts">
          {dashboard.alertas.slice(0, 5).map((alerta, i) => (
            <div key={`${alerta.componente_id}-${alerta.tipo}-${i}`} className={`mon-acr-alert is-${alerta.severidad}`}>
              <AlertTriangle size={14} />
              <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="mon-acr-detail">
          <div className="mon-acr-detail-head">
            <div>
              <h3>{selected.actor}</h3>
              <p>{selected.tecnica || "Sin tecnica"} · {selected.variable_control || "Sin variable de control"}</p>
            </div>
            <EstadoBadge estado={selected.seguimiento.cumplimiento.estado} />
          </div>

          <div className="mon-acr-metrics">
            <Metric label="Universo" value={selected.marco.universo_bruto} />
            <Metric label="Marco act." value={selected.marco.marco_actualizado} />
            <Metric label="Contactable" value={selected.marco.marco_contactable} />
            <Metric label="Meta" value={selected.meta.n_objetivo} />
          </div>

          <div className="mon-form mon-form--two mon-acr-form">
            <label>
              <span>n efectivo</span>
              <input
                type="number"
                min={0}
                value={draft.n_efectivo}
                onChange={(e) => setDraft((prev) => ({ ...prev, n_efectivo: e.target.value }))}
              />
            </label>
            {CANALES.map((canal) => (
              <label key={canal}>
                <span>{canal}</span>
                <input
                  type="number"
                  min={0}
                  value={draft.intentos[canal]}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    intentos: { ...prev.intentos, [canal]: e.target.value },
                  }))}
                />
              </label>
            ))}
          </div>
          <label className="mon-acr-notes">
            <span>Notas de campo</span>
            <textarea value={draft.notas_campo} onChange={(e) => setDraft((prev) => ({ ...prev, notas_campo: e.target.value }))} />
          </label>
          <div className="mon-acr-footer">
            <div className="mon-acr-close-controls">
              <input
                value={planRefuerzo}
                onChange={(e) => setPlanRefuerzo(e.target.value)}
                placeholder="Plan de refuerzo o justificacion de cierre"
              />
              <label>
                <input
                  type="checkbox"
                  checked={aprobarBrechas}
                  onChange={(e) => setAprobarBrechas(e.target.checked)}
                />
                Aprobacion metodologica
              </label>
            </div>
            <button type="button" onClick={saveSelected} disabled={saving}>
              {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
              Registrar avance
            </button>
          </div>

          {Object.keys(selected.seguimiento.sub_cuotas_progreso).length > 0 && (
            <MiniTable
              title="Subcuotas"
              rows={Object.entries(selected.seguimiento.sub_cuotas_progreso).map(([celda, row]) => ({ celda, ...row }))}
            />
          )}
          {selected.seguimiento.bolsa_operativa.length > 0 && (
            <MiniTable title="Bolsa operativa" rows={selected.seguimiento.bolsa_operativa} />
          )}
        </div>
      )}
    </Panel>
  );
}

function EstadoBadge({ estado }: { estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"] }) {
  const icon = estado === "cumple_meta"
    ? <CheckCircle2 size={13} />
    : estado === "brecha_relevante"
      ? <XCircle size={13} />
      : estado === "brecha_menor_documentada"
        ? <AlertTriangle size={13} />
        : <Target size={13} />;
  return <span className={`mon-acr-badge is-${estado}`}>{icon}{estadoLabel(estado)}</span>;
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mon-acr-metric">
      <span>{label}</span>
      <strong>{value == null ? "S/D" : value.toLocaleString("es-PE")}</strong>
    </div>
  );
}

function MiniTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <div className="mon-acr-mini">
      <h4>{title}</h4>
      <DataTable rows={rows as MonitoreoRow[]} />
    </div>
  );
}

function TablePanel({ title, icon, rows }: { title: string; icon: ReactNode; rows: MonitoreoRow[] }) {
  return (
    <div className="mon-table-panel">
      <Panel eyebrow="Tablero" title={<span className="mon-title-icon">{icon}{title}</span>}>
        <div className="mon-panel-fill">
          {rows.length ? (
            <DataTable rows={rows} />
          ) : (
            <EmptyState icon={<Activity size={18} />} title="Sin filas" variant="inline" />
          )}
        </div>
      </Panel>
    </div>
  );
}

function DataTable({ rows }: { rows: MonitoreoRow[] }) {
  const columns = useMemo(() => Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 10), [rows]);
  return (
    <div className="mon-table-wrap">
      <table className="mon-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{formatCell(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("es-PE") : value.toFixed(1);
  return String(value);
}

function estadoLabel(estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"]) {
  switch (estado) {
    case "cumple_meta":
      return "Cumple";
    case "brecha_menor_documentada":
      return "Brecha menor";
    case "brecha_relevante":
      return "Brecha relevante";
    default:
      return "Sin meta";
  }
}

function formatRatioPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}
