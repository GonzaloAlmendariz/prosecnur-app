import { useState } from "react";
import { Download, Upload, Play, Search } from "lucide-react";
import {
  apiUpload,
  apiValidacionAuditoria,
  apiValidacionAuditoriaRegla,
  apiValidacionBuildPlan,
  apiValidacionExportPlan,
  apiValidacionImportPlan,
  AuditoriaResult,
  downloadUrl,
  PlanResumen,
  PlanRow,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";

function KeyValueTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return <em style={{ color: "#888" }}>sin resultados</em>;
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return (
    <div style={{ overflowX: "auto", maxHeight: 380, border: "1px solid #eee", borderRadius: 4 }}>
      <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
        <thead style={{ background: "#fafafa", position: "sticky", top: 0 }}>
          <tr>{cols.map((c) => <th key={c} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #e3e3e8" }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f2f2f2" }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "4px 10px", verticalAlign: "top" }}>
                  {r[c] == null ? <span style={{ color: "#bbb" }}>—</span> : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ValidacionPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [resumen, setResumen] = useState<PlanResumen[] | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanRow[] | null>(null);
  const [nReglas, setNReglas] = useState<number | null>(null);
  const [exportFileId, setExportFileId] = useState<string | null>(null);

  const [total, setTotal] = useState<number | null>(null);
  const [topReglas, setTopReglas] = useState<Record<string, unknown>[] | null>(null);
  const [reglaDetalle, setReglaDetalle] = useState<{ id: string; rows: Record<string, unknown>[] } | null>(null);
  const [auditJobId, setAuditJobId] = useState<string | null>(null);

  const xlsformReady = !!state?.xlsform;
  const dataReady = !!state?.data;

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setError("");
    setBusy(label);
    try {
      const out = await fn();
      await refresh();
      return out;
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onBuildPlan() {
    const out = await run("construyendo plan…", () => apiValidacionBuildPlan());
    if (!out) return;
    setResumen(out.resumen);
    setPlanPreview(out.plan_preview);
    setNReglas(out.n_reglas);
    setExportFileId(null);
  }

  async function onExport() {
    const out = await run("exportando a Excel…", () => apiValidacionExportPlan());
    if (out) setExportFileId(out.file_id);
  }

  async function onImport(file?: File) {
    if (!file) return;
    await run(`importando ${file.name}…`, async () => {
      const up = await apiUpload(file, "plan_limpieza");
      return apiValidacionImportPlan(up.file_id);
    }).then((out) => {
      if (!out) return;
      setPlanPreview(out.plan_preview);
      setNReglas(out.n_reglas);
    });
  }

  async function onAudit() {
    setError("");
    setTotal(null);
    setTopReglas(null);
    setReglaDetalle(null);
    try {
      const out = await apiValidacionAuditoria();
      setAuditJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onAuditDone(data: AuditoriaResult) {
    setTotal(data.total_inconsistencias);
    setTopReglas(data.top_reglas);
    setAuditJobId(null);
    void refresh();
  }

  function onAuditError(msg: string) {
    setError(msg);
    setAuditJobId(null);
  }

  function onAuditCancelled() {
    setAuditJobId(null);
  }

  async function onDrill(id: string) {
    const out = await run(`cargando regla ${id}…`, () => apiValidacionAuditoriaRegla(id));
    if (out) setReglaDetalle({ id, rows: out.detalle });
  }

  return (
    <section>
      <h1 className="pulso-page-title">Fase 2 — Validación</h1>
      <p className="pulso-page-lead">
        Construye el plan de limpieza desde el XLSForm, edítalo offline si quieres, y audita la base de datos contra las reglas.
      </p>

      {!xlsformReady && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm primero en <strong>1. Carga</strong>.</Alert>
        </div>
      )}

      <Panel eyebrow="Paso 1" title="Construir plan de limpieza">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="pulso-primary" disabled={!xlsformReady || !!busy} onClick={onBuildPlan}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> {nReglas == null ? "Construir plan" : "Reconstruir"}
          </button>
          {nReglas != null && (
            <>
              <span style={{ color: "var(--pulso-text-soft)", fontSize: 13 }}>{nReglas} reglas generadas</span>
              <button disabled={!!busy} onClick={onExport} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Download size={14} /> Descargar Excel
              </button>
              {exportFileId && (
                <a href={downloadUrl(exportFileId)} style={{ fontSize: 13 }}>plan_limpieza.xlsx</a>
              )}
            </>
          )}
        </div>
        {resumen && resumen.length > 0 && (
          <details open style={{ marginTop: "1rem" }}>
            <summary>Resumen por tipo de observación</summary>
            <KeyValueTable rows={resumen as unknown as Record<string, unknown>[]} />
          </details>
        )}
        {planPreview && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Vista previa del plan (primeras 50 filas)</summary>
            <KeyValueTable rows={planPreview} />
          </details>
        )}
      </Panel>

      <Panel eyebrow="Paso 2" title="Importar plan editado (opcional)" hint="Si editaste el Excel exportado arriba, súbelo aquí para reemplazar el plan en memoria antes de auditar.">
        <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Upload size={14} color="var(--pulso-text-soft)" />
          <input
            type="file"
            accept=".xlsx"
            disabled={!!busy}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </label>
      </Panel>

      <Panel eyebrow="Paso 3" title="Auditar consistencia de la base de datos">
        {!dataReady && <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", marginBottom: 8 }}>Requiere una base de datos cargada.</div>}
        <button className="pulso-primary" disabled={!dataReady || nReglas == null || !!busy || !!auditJobId} onClick={onAudit}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Play size={14} /> Ejecutar auditoría
        </button>
        {auditJobId && (
          <div style={{ marginTop: 12 }}>
            <JobProgress<AuditoriaResult>
              label="Ejecutando auditoría"
              jobId={auditJobId}
              onDone={onAuditDone}
              onError={onAuditError}
              onCancelled={onAuditCancelled}
            />
          </div>
        )}
        {total != null && (
          <div style={{ marginTop: "1rem", fontSize: 15 }}>
            <strong>Total de inconsistencias:</strong> {total}
          </div>
        )}
        {topReglas && topReglas.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="pulso-section-title">Reglas con más inconsistencias</div>
            <KeyValueTable rows={topReglas} />
            <div style={{ marginTop: 12, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color="var(--pulso-text-soft)" />
              <span>Drill-down por <code>id_regla</code>:</span>
              <input
                placeholder="ej. R_001"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) void onDrill(v);
                  }
                }}
              />
            </div>
            {reglaDetalle && (
              <div style={{ marginTop: 12 }}>
                <div className="pulso-section-title">Detalle regla {reglaDetalle.id}</div>
                <KeyValueTable rows={reglaDetalle.rows} />
              </div>
            )}
          </div>
        )}
      </Panel>

      <p style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
        ¿Necesitas revisar la estructura del XLSForm (secciones, preguntas, reglas declaradas)? Los mapas interactivos
        están ahora en <strong>1. Carga</strong>.
      </p>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
