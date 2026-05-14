import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, FileSpreadsheet, FolderOpen, Layers, ListChecks, Loader2, RotateCcw, Upload, X } from "lucide-react";
import {
  apiDashboardSourceGet,
  apiDashboardSourceImport,
  apiUpload,
  uploadKindForDataFile,
  type DashboardRecodVar,
  type DashboardSourceFileCandidate,
  type DashboardSourcePayload,
} from "../../../api/client";
import { EmptyState } from "../shared/EmptyState";
import { useDashboardStore } from "../store";
import { useDashboardAllVars } from "../useDashboardData";

type SourceGroup = "project" | "session";

export function DashboardSourceGate({
  onImported,
  onCancel,
  compact = false,
  recodVars = [],
}: {
  onImported: () => void;
  onCancel?: () => void;
  compact?: boolean;
  recodVars?: DashboardRecodVar[];
}) {
  const [payload, setPayload] = useState<DashboardSourcePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<SourceGroup>("project");
  const [xlsId, setXlsId] = useState("");
  const [dataId, setDataId] = useState("");
  const [xlsFile, setXlsFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardSourceGet()
      .then((r) => {
        if (cancelled) return;
        const nextPayload = normalizeSourcePayload(r.payload);
        setPayload(nextPayload);
        const projectReady =
          nextPayload.candidates.project.xlsforms.length > 0 &&
          nextPayload.candidates.project.data.length > 0;
        const nextGroup: SourceGroup = projectReady ? "project" : "session";
        setGroup(nextGroup);
        const xls = pickCandidate(nextPayload.candidates[nextGroup].xlsforms);
        const dat = pickCandidate(nextPayload.candidates[nextGroup].data);
        setXlsId(xls?.id ?? "");
        setDataId(dat?.id ?? "");
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

  const groupCandidates = payload?.candidates[group];
  const selectedXls = useMemo(
    () => groupCandidates?.xlsforms.find((x) => x.id === xlsId) ?? null,
    [groupCandidates, xlsId],
  );
  const selectedData = useMemo(
    () => groupCandidates?.data.find((x) => x.id === dataId) ?? null,
    [groupCandidates, dataId],
  );

  function switchGroup(next: SourceGroup) {
    setGroup(next);
    const xls = pickCandidate(payload?.candidates[next].xlsforms ?? []);
    const dat = pickCandidate(payload?.candidates[next].data ?? []);
    setXlsId(xls?.id ?? "");
    setDataId(dat?.id ?? "");
  }

  async function importSelected() {
    if (!selectedXls || !selectedData) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedXls.file_id && selectedData.file_id) {
        await apiDashboardSourceImport({
          xlsform_file_id: selectedXls.file_id,
          data_file_id: selectedData.file_id,
        });
      } else if (selectedXls.path && selectedData.path) {
        await apiDashboardSourceImport({
          xlsform_path: selectedXls.path,
          data_path: selectedData.path,
        });
      } else {
        throw new Error("El XLSForm y la data deben venir del mismo origen.");
      }
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAndImport() {
    if (!xlsFile || !dataFile) return;
    setSaving(true);
    setError(null);
    try {
      const xls = await apiUpload(xlsFile, "xlsform");
      const dat = await apiUpload(dataFile, uploadKindForDataFile(dataFile));
      await apiDashboardSourceImport({
        xlsform_file_id: xls.file_id,
        data_file_id: dat.file_id,
      });
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <EmptyState title="Buscando archivos del dashboard…" />;

  const projectReady =
    (payload?.candidates.project.xlsforms.length ?? 0) > 0 &&
    (payload?.candidates.project.data.length ?? 0) > 0;
  const sessionReady =
    (payload?.candidates.session.xlsforms.length ?? 0) > 0 &&
    (payload?.candidates.session.data.length ?? 0) > 0;

  return (
    <section className={`dash-source dash-cardbox ${compact ? "is-compact" : ""}`}>
      <div className="dash-cardbox-header dash-cardbox-header--top">
        <div className="dash-cardbox-copy">
          <h2 className="dash-cardbox-title">
            Fuente del dashboard
          </h2>
          <p className="dash-cardbox-help dash-cardbox-help--attached">
            Carga un XLSForm y una base para construir este tablero de forma independiente.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            className="dash-icon-btn"
            onClick={onCancel}
            aria-label="Cerrar y volver al dashboard"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {payload?.has_source && (
        <div className="dash-source-current">
          <Database size={14} />
          <span>
            Actual: <strong>{payload.source.xlsform_name}</strong> +{" "}
            <strong>{payload.source.data_name}</strong>
          </span>
        </div>
      )}

      <div className="dash-source-grid">
        <div className="dash-source-panel">
          <div className="dash-source-panel-head">
            <FolderOpen size={15} />
            <span>Desde proyecto o sesión</span>
          </div>

          <div className="dash-source-segments">
            <button
              type="button"
              className={`dash-source-segment ${group === "project" ? "is-active" : ""}`}
              disabled={!projectReady}
              onClick={() => switchGroup("project")}
            >
              Proyecto
            </button>
            <button
              type="button"
              className={`dash-source-segment ${group === "session" ? "is-active" : ""}`}
              disabled={!sessionReady}
              onClick={() => switchGroup("session")}
            >
              Sesión
            </button>
          </div>

          {group === "project" && payload?.project_dir && (
            <div className="dash-source-path">{payload.project_dir}</div>
          )}

          <SourceSelect
            label="XLSForm"
            value={xlsId}
            onChange={setXlsId}
            candidates={groupCandidates?.xlsforms ?? []}
          />
          <SourceSelect
            label="Data"
            value={dataId}
            onChange={setDataId}
            candidates={groupCandidates?.data ?? []}
          />

          <button
            type="button"
            className="dash-primary-btn"
            disabled={saving || !selectedXls || !selectedData}
            onClick={importSelected}
          >
            {saving ? <Loader2 size={13} className="pulso-spin" /> : <FileSpreadsheet size={13} />}
            Cargar fuente
          </button>
        </div>

        <div className="dash-source-panel">
          <div className="dash-source-panel-head">
            <Upload size={15} />
            <span>Subir archivos</span>
          </div>
          <label className="dash-source-upload">
            <span>XLSForm</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setXlsFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="dash-source-upload">
            <span>Data</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
              onChange={(e) => setDataFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="dash-primary-btn"
            disabled={saving || !xlsFile || !dataFile}
            onClick={uploadAndImport}
          >
            {saving ? <Loader2 size={13} className="pulso-spin" /> : <Upload size={13} />}
            Subir y cargar
          </button>
        </div>
      </div>

      {error && <div className="dash-curation-error">{error}</div>}

      <VariablesPanel />
    </section>
  );
}

// Fila editable del panel "Personalizar variables". Tiene state local
// `draft` que arranca PRE-CARGADO con el label override (si existe) o el
// label original del XLSForm — así el usuario puede editar pequeños
// detalles sin tener que reescribir todo el texto desde cero.
function VariableRow({
  v,
  override,
  onToggle,
  onCommitLabel,
  onReset,
}: {
  v: { name: string; label: string };
  override: { enabled: boolean; label: string } | undefined;
  onToggle: (enabled: boolean) => void;
  onCommitLabel: (draft: string) => void;
  onReset: () => void;
}) {
  const enabled = override ? override.enabled !== false : true;
  const overrideLabel = override?.label ?? "";
  const initial = overrideLabel || v.label;
  const [draft, setDraft] = useState(initial);

  // Si el override viene a cambiar desde fuera (ej. import de un .pulso
  // o reset), sincronizamos el draft local. La comparación contra
  // `initial` evita ciclos cuando el usuario está tipeando.
  useEffect(() => {
    const next = (override?.label && override.label.length > 0)
      ? override.label
      : v.label;
    setDraft(next);
    // Solo cuando override.label cambia (desde fuera) o v.label cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override?.label, v.label]);

  const dirty = !!override && (override.enabled === false || (override.label && override.label.length > 0));

  return (
    <li className={`dash-source-vars-row ${enabled ? "" : "is-off"}`}>
      <label className="dash-source-vars-toggle" title={enabled ? "Incluir en dashboard" : "Excluida"}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="dash-source-vars-toggle-slider" />
      </label>
      <div className="dash-source-vars-row-info">
        <code className="dash-source-vars-row-name">{v.name}</code>
        <span className="dash-source-vars-row-orig" title={v.label}>
          {v.label}
        </span>
      </div>
      <input
        className="dash-input dash-source-vars-row-input"
        value={draft}
        disabled={!enabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommitLabel(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(initial);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {dirty && (
        <button
          type="button"
          className="dash-source-vars-reset"
          onClick={() => {
            setDraft(v.label);
            onReset();
          }}
          title="Restablecer al valor por defecto"
          aria-label="Restablecer"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </li>
  );
}

function pickCandidate(items: DashboardSourceFileCandidate[]) {
  return items.find((x) => x.suggested) ?? items[0] ?? null;
}

function normalizeSourcePayload(payload: DashboardSourcePayload): DashboardSourcePayload {
  const rawCandidates = payload.candidates as unknown as {
    project?: { xlsforms?: unknown; data?: unknown };
    session?: { xlsforms?: unknown; data?: unknown };
  };

  return {
    ...payload,
    candidates: {
      project: {
        xlsforms: normalizeCandidateList(rawCandidates.project?.xlsforms),
        data: normalizeCandidateList(rawCandidates.project?.data),
      },
      session: {
        xlsforms: normalizeCandidateList(rawCandidates.session?.xlsforms),
        data: normalizeCandidateList(rawCandidates.session?.data),
      },
    },
  };
}

function normalizeCandidateList(value: unknown): DashboardSourceFileCandidate[] {
  if (Array.isArray(value)) return value.filter(isDashboardSourceFileCandidate);
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).filter(isDashboardSourceFileCandidate);
}

function isDashboardSourceFileCandidate(value: unknown): value is DashboardSourceFileCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardSourceFileCandidate>;
  return typeof candidate.id === "string" && typeof candidate.name === "string";
}

function SourceSelect({
  label,
  value,
  onChange,
  candidates,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  candidates: DashboardSourceFileCandidate[];
}) {
  return (
    <label className="dash-source-field">
      <span>{label}</span>
      <select
        className="dash-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={candidates.length === 0}
      >
        {candidates.length === 0 && <option value="">Sin archivos detectados</option>}
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.suggested ? "• " : ""}{c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// Panel "Personalizar variables" — lista TODAS las variables del XLSForm
// agrupadas por sección y permite incluir/excluir cada una y reescribir
// su label (útil cuando varias variables comparten título — ej. p10_ule
// vs p10_ciam vs p10_demuna). Persiste en config.dashboard_var_overrides.
function VariablesPanel() {
  const { loading, error, secciones } = useDashboardAllVars();
  const overrides = useDashboardStore((s) => s.config.dashboard_var_overrides ?? {});
  const setVarOverride = useDashboardStore((s) => s.setVarOverride);
  const removeVarOverride = useDashboardStore((s) => s.removeVarOverride);
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});

  if (loading) return null;
  if (error) {
    return (
      <div className="dash-source-vars-error">
        No se pudo cargar el catálogo de variables: {error}
      </div>
    );
  }
  if (!secciones.length) return null;

  const total = secciones.reduce((acc, s) => acc + s.vars.length, 0);
  const excluded = Object.values(overrides).filter((o) => o && o.enabled === false).length;
  const renamed = Object.values(overrides).filter((o) => o && o.label && o.label.length > 0).length;

  function toggle(sec: string) {
    setOpenSec((prev) => ({ ...prev, [sec]: !prev[sec] }));
  }

  function setEnabled(name: string, enabled: boolean) {
    const cur = overrides[name] ?? { enabled: true, label: "" };
    if (enabled && !cur.label) {
      // Si vuelve a habilitar y no hay label custom, limpiar el override
      // entero (el state vuelve al default natural).
      removeVarOverride(name);
    } else {
      setVarOverride(name, { ...cur, enabled });
    }
  }
  function commitLabel(name: string, originalLabel: string, draft: string) {
    const cur = overrides[name] ?? { enabled: true, label: "" };
    const trimmed = draft.trim();
    // Solo se considera override si el label difere del original. Si el
    // usuario lo deja igual o vacío, limpiamos para no acumular entradas
    // basura en el config.
    if (!trimmed || trimmed === originalLabel) {
      if (cur.enabled) removeVarOverride(name);
      else setVarOverride(name, { enabled: false, label: "" });
    } else {
      setVarOverride(name, { ...cur, label: trimmed });
    }
  }

  return (
    <div className="dash-source-vars">
      <div className="dash-source-vars-head">
        <ListChecks size={15} />
        <div>
          <strong>Personalizar variables</strong>
          <p className="dash-source-vars-help">
            {total} {total === 1 ? "variable" : "variables"} disponibles.
            Marca cuáles incluir en el dashboard y reescribe la etiqueta cuando varias compartan título
            (ej. <code>p10_ule</code> vs <code>p10_ciam</code>).
            {excluded > 0 && ` ${excluded} excluida(s).`}
            {renamed > 0 && ` ${renamed} renombrada(s).`}
          </p>
        </div>
      </div>

      <ul className="dash-source-vars-secciones">
        {secciones.map((sec) => {
          const open = openSec[sec.seccion] ?? false;
          const Icon = open ? ChevronDown : ChevronRight;
          return (
            <li key={sec.seccion} className="dash-source-vars-sec">
              <button
                type="button"
                className="dash-source-vars-sec-head"
                onClick={() => toggle(sec.seccion)}
                aria-expanded={open}
              >
                <Icon size={14} />
                <span className="dash-source-vars-sec-name">{sec.seccion}</span>
                <span className="dash-source-vars-sec-meta">
                  {sec.vars.length} {sec.vars.length === 1 ? "var" : "vars"}
                </span>
              </button>
              {open && (
                <ul className="dash-source-vars-list">
                  {sec.vars.map((v) => (
                    <VariableRow
                      key={v.name}
                      v={v}
                      override={overrides[v.name]}
                      onToggle={(en) => setEnabled(v.name, en)}
                      onCommitLabel={(draft) => commitLabel(v.name, v.label, draft)}
                      onReset={() => removeVarOverride(v.name)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
