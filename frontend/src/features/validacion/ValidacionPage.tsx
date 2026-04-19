import { useState } from "react";
import {
  apiUpload,
  apiValidacionAuditoria,
  apiValidacionAuditoriaRegla,
  apiValidacionBuildPlan,
  apiValidacionExportPlan,
  apiValidacionImportPlan,
  downloadUrl,
  PlanResumen,
  PlanRow,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e3e3e8", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

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
    const out = await run("ejecutando auditoría…", () => apiValidacionAuditoria());
    if (!out) return;
    setTotal(out.total_inconsistencias);
    setTopReglas(out.top_reglas);
  }

  async function onDrill(id: string) {
    const out = await run(`cargando regla ${id}…`, () => apiValidacionAuditoriaRegla(id));
    if (out) setReglaDetalle({ id, rows: out.detalle });
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Fase 2 — Validación</h1>
      <p style={{ color: "#666" }}>
        Construye el plan de limpieza desde el XLSForm, edítalo offline si quieres, y audita la base de datos contra las reglas.
      </p>

      {!xlsformReady && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem", fontSize: 14 }}>
          Necesitas cargar el XLSForm primero en <strong>1. Carga</strong>.
        </div>
      )}

      <Panel title="Paso 1 — Construir plan de limpieza">
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!xlsformReady || !!busy} onClick={onBuildPlan}>
            {nReglas == null ? "Construir plan" : "Reconstruir"}
          </button>
          {nReglas != null && (
            <>
              <span style={{ color: "#555" }}>{nReglas} reglas generadas</span>
              <button disabled={!!busy} onClick={onExport} style={{ marginLeft: "auto" }}>
                Descargar Excel
              </button>
              {exportFileId && (
                <a href={downloadUrl(exportFileId)} style={{ fontSize: 14 }}>plan_limpieza.xlsx →</a>
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

      <Panel title="Paso 2 — Importar plan editado (opcional)">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Si editaste el Excel exportado arriba, súbelo aquí para reemplazar el plan en memoria antes de auditar.
        </p>
        <label style={{ fontSize: 14 }}>
          <input
            type="file"
            accept=".xlsx"
            disabled={!!busy}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </label>
      </Panel>

      <Panel title="Paso 3 — Auditar consistencia de la base de datos">
        {!dataReady && <div style={{ fontSize: 13, color: "#999", marginBottom: "0.5rem" }}>Requiere una base de datos cargada.</div>}
        <button disabled={!dataReady || nReglas == null || !!busy} onClick={onAudit}>
          Ejecutar auditoría
        </button>
        {total != null && (
          <div style={{ marginTop: "1rem", fontSize: 15 }}>
            <strong>Total de inconsistencias:</strong> {total}
          </div>
        )}
        {topReglas && topReglas.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h4>Reglas con más inconsistencias</h4>
            <KeyValueTable rows={topReglas} />
            <div style={{ marginTop: "0.75rem", fontSize: 13 }}>
              Drill-down por <code>id_regla</code>:{" "}
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
              <div style={{ marginTop: "0.75rem" }}>
                <strong>Detalle regla {reglaDetalle.id}:</strong>
                <KeyValueTable rows={reglaDetalle.rows} />
              </div>
            )}
          </div>
        )}
      </Panel>

      <p style={{ fontSize: 13, color: "#888" }}>
        ¿Necesitas revisar la estructura del XLSForm (secciones, preguntas, reglas declaradas)? Los mapas interactivos
        están ahora en <strong>1. Carga</strong>.
      </p>

      {busy && <div style={{ color: "#0066cc" }}>{busy}</div>}
      {error && <div style={{ color: "#c00" }}>⚠ {error}</div>}
    </section>
  );
}
