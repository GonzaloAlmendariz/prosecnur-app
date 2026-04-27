import { useEffect, useMemo, useState } from "react";
import { Database, FileSpreadsheet, FolderOpen, Loader2, Upload } from "lucide-react";
import {
  apiDashboardSourceGet,
  apiDashboardSourceImport,
  apiUpload,
  type DashboardSourceFileCandidate,
  type DashboardSourcePayload,
  type UploadKind,
} from "../../../api/client";
import { EmptyState } from "../shared/EmptyState";

type SourceGroup = "project" | "session";

export function DashboardSourceGate({
  onImported,
  compact = false,
}: {
  onImported: () => void;
  compact?: boolean;
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
        setPayload(r.payload);
        const projectReady =
          r.payload.candidates.project.xlsforms.length > 0 &&
          r.payload.candidates.project.data.length > 0;
        const nextGroup: SourceGroup = projectReady ? "project" : "session";
        setGroup(nextGroup);
        const xls = pickCandidate(r.payload.candidates[nextGroup].xlsforms);
        const dat = pickCandidate(r.payload.candidates[nextGroup].data);
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
      const dataKind: UploadKind = dataFile.name.toLowerCase().endsWith(".sav") ? "sav" : "data";
      const dat = await apiUpload(dataFile, dataKind);
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
      <div className="dash-cardbox-header">
        <div>
          <h2 className="dash-cardbox-title" style={{ margin: 0 }}>
            Fuente del dashboard
          </h2>
          <p className="dash-cardbox-help" style={{ margin: "4px 0 0" }}>
            Carga un XLSForm y una base para construir este tablero de forma independiente.
          </p>
        </div>
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
              accept=".xlsx,.xls,.csv,.sav"
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
    </section>
  );
}

function pickCandidate(items: DashboardSourceFileCandidate[]) {
  return items.find((x) => x.suggested) ?? items[0] ?? null;
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
