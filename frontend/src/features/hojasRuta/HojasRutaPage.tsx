import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, MapPinned, Play, RotateCcw } from "lucide-react";
import {
  apiHojasRutaGenerate,
  apiHojasRutaPreview,
  apiHojasRutaSaveConfig,
  apiHojasRutaState,
  downloadUrl,
  HojasRutaConfig,
  HojasRutaJobResult,
  HojasRutaPreview,
  HojasRutaState,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageHeader } from "../../components/PageHeader";
import { Panel } from "../../components/Panel";
import { EmptyState, LoadingBlock } from "../../components/States";

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--pulso-primary)",
  background: "var(--pulso-primary)",
  color: "white",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  background: "white",
  color: "var(--pulso-text)",
};

function emptyConfig(cacheDir = ""): HojasRutaConfig {
  return {
    row_var: "",
    col_var: "",
    value_var: "",
    count_mode: "frecuencia",
    cartografia_dir: cacheDir,
    project_code: "",
    max_umps: null,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
        background: ok ? "var(--pulso-success-bg)" : "var(--pulso-warn-bg)",
        border: `1px solid ${ok ? "var(--pulso-success-border)" : "var(--pulso-warn-border)"}`,
        color: ok ? "var(--pulso-success-fg)" : "var(--pulso-warn-fg)",
      }}
    >
      {text}
    </span>
  );
}

export default function HojasRutaPage() {
  const [state, setState] = useState<HojasRutaState | null>(null);
  const [config, setConfig] = useState<HojasRutaConfig>(emptyConfig());
  const [preview, setPreview] = useState<HojasRutaPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<HojasRutaJobResult | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await apiHojasRutaState();
      setState(s);
      setConfig({ ...emptyConfig(s.cache_dir), ...(s.config ?? {}) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const variables = state?.variables ?? [];
  const requiredOk = !!state?.campos?.ok;
  const configOk = !!preview?.ok;

  const quotaOptions = useMemo(
    () => variables.filter((v) => !["IDMANZANA"].includes(v.nombre)),
    [variables],
  );

  function patchConfig(patch: Partial<HojasRutaConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
    setPreview(null);
    setResult(null);
  }

  async function saveAndPreview() {
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      await apiHojasRutaSaveConfig(config);
      const p = await apiHojasRutaPreview(config);
      setPreview(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    setBusy("generate");
    setError("");
    setResult(null);
    try {
      const started = await apiHojasRutaGenerate(config);
      setJobId(started.job_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <LoadingBlock label="Cargando hojas de ruta" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Hojas de ruta para campo"
        lead="Genera fichas imprimibles por UMP desde la base activa del estudio."
        meta={state?.has_data ? <StatusPill ok={requiredOk} text={requiredOk ? "Base lista" : "Revisar base"} /> : null}
      />

      {error && <Alert kind="error">{error}</Alert>}

      {!state?.has_data ? (
        <Panel>
          <EmptyState
            icon={<FileText size={18} />}
            title="No hay base cargada"
            hint="Carga un estudio en Prosecnur para activar este modulo."
          />
        </Panel>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Panel title="Base estandarizada" eyebrow="Paso 1">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {(state.campos?.columns ?? []).map((c) => (
                    <div
                      key={c.nombre}
                      style={{
                        border: "1px solid var(--pulso-border)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        background: c.estado === "listo" ? "white" : "var(--pulso-warn-bg)",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{c.nombre}</span>
                        <StatusPill ok={c.estado === "listo"} text={c.estado === "listo" ? "ok" : "falta"} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.tipo ?? "sin columna"}
                      </div>
                    </div>
                  ))}
                </div>
                {(state.campos?.invalid ?? []).map((it) => (
                  <Alert key={`${it.campo}:${it.mensaje}`} kind="warn">{it.mensaje}</Alert>
                ))}
              </div>
            </Panel>

            <Panel
              title="Asistente de cuotas"
              eyebrow="Paso 2"
              actions={
                <button type="button" style={btnSecondary} onClick={() => void loadState()}>
                  <RotateCcw size={14} /> Refrescar
                </button>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <Field label="Filas">
                  <select
                    style={fieldStyle}
                    value={config.row_var}
                    onChange={(e) => patchConfig({ row_var: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {quotaOptions.map((v) => <option key={v.nombre} value={v.nombre}>{v.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Columnas">
                  <select
                    style={fieldStyle}
                    value={config.col_var}
                    onChange={(e) => patchConfig({ col_var: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {quotaOptions.map((v) => <option key={v.nombre} value={v.nombre}>{v.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Calculo">
                  <select
                    style={fieldStyle}
                    value={config.count_mode}
                    onChange={(e) => patchConfig({ count_mode: e.target.value as HojasRutaConfig["count_mode"] })}
                  >
                    <option value="frecuencia">Frecuencia</option>
                    <option value="suma">Suma</option>
                  </select>
                </Field>
                <Field label="Campo de suma">
                  <select
                    style={{ ...fieldStyle, opacity: config.count_mode === "suma" ? 1 : 0.55 }}
                    value={config.value_var}
                    disabled={config.count_mode !== "suma"}
                    onChange={(e) => patchConfig({ value_var: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {variables.map((v) => <option key={v.nombre} value={v.nombre}>{v.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Codigo de estudio">
                  <input
                    style={fieldStyle}
                    value={config.project_code}
                    onChange={(e) => patchConfig({ project_code: e.target.value })}
                  />
                </Field>
                <Field label="Limite UMP">
                  <input
                    style={fieldStyle}
                    type="number"
                    min={0}
                    value={config.max_umps ?? ""}
                    onChange={(e) => patchConfig({ max_umps: e.target.value ? Number(e.target.value) : null })}
                  />
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Carpeta/cache de cartografia">
                    <input
                      style={fieldStyle}
                      value={config.cartografia_dir}
                      onChange={(e) => patchConfig({ cartografia_dir: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                <button type="button" style={btnPrimary} onClick={() => void saveAndPreview()} disabled={!requiredOk || busy === "preview"}>
                  {busy === "preview" ? <Loader2 size={14} className="pulso-spin" /> : <MapPinned size={14} />}
                  Previsualizar
                </button>
                {preview?.config_issues?.length ? (
                  <span style={{ fontSize: 12, color: "var(--pulso-warn-fg)" }}>
                    {preview.config_issues.length} ajuste(s) pendiente(s)
                  </span>
                ) : null}
              </div>
            </Panel>
          </div>

          <Panel
            title="Revision"
            eyebrow="Paso 3"
            actions={
              <button type="button" style={btnPrimary} onClick={() => void generate()} disabled={!configOk || !!jobId || busy === "generate"}>
                <Play size={14} /> Generar ZIP
              </button>
            }
          >
            {!preview ? (
              <EmptyState
                icon={<MapPinned size={18} />}
                title="Sin preview"
                hint="Configura cuotas y previsualiza para revisar las UMPs."
                variant="inline"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <StatusPill ok={preview.ok} text={preview.ok ? "Listo para generar" : "Pendiente"} />
                  <StatusPill ok={preview.mapas_faltantes === 0} text={`${preview.n_umps} UMPs`} />
                  <StatusPill ok={preview.mapas_faltantes === 0} text={`${preview.mapas_faltantes} mapas faltantes`} />
                </div>
                <div style={{ overflowX: "auto", border: "1px solid var(--pulso-border)", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "var(--pulso-header-row)" }}>
                      <tr>
                        {["UMP", "IDMANZANA", "Mapa", "Estado", "Archivo"].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--pulso-border)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 80).map((r) => (
                        <tr key={`${r.index}:${r.idmanzana}`}>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--pulso-border)" }}>{r.ump}</td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--pulso-border)", fontFamily: "ui-monospace,monospace" }}>{r.idmanzana}</td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--pulso-border)", fontFamily: "ui-monospace,monospace" }}>{r.mapa}</td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--pulso-border)" }}>
                            <StatusPill ok={r.mapa_encontrado} text={r.mapa_encontrado ? "mapa ok" : "sin mapa"} />
                          </td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--pulso-border)" }}>{r.filename}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Panel>

          <JobProgress<HojasRutaJobResult>
            label="Generando hojas de ruta"
            jobId={jobId}
            onDone={(data) => {
              setResult(data);
              setJobId(null);
            }}
            onError={(msg) => {
              setError(msg);
              setJobId(null);
            }}
            onCancelled={() => setJobId(null)}
          />

          {result && (
            <Panel title="ZIP generado" eyebrow="Paso 4">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <StatusPill ok text={`${result.n_pdfs} PDFs`} />
                <StatusPill ok={result.mapas_faltantes === 0} text={`${result.mapas_faltantes} mapas faltantes`} />
                <a href={downloadUrl(result.file_id)} style={{ ...btnPrimary, textDecoration: "none" }}>
                  <Download size={14} /> Descargar ZIP
                </a>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
