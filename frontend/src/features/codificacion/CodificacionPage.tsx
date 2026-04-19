import { useState } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import {
  apiCodifAplicar,
  AplicarResult,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { FamiliasEditor } from "./FamiliasEditor";
import { CodigosEditor } from "./CodigosEditor";
import { PreguntasLanding } from "./PreguntasLanding";

type Mode = "task" | "advanced";
const MODE_KEY = "pulso.codif.mode";

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const [error, setError] = useState<string>("");

  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);
  const [aplicarJobId, setAplicarJobId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) === "advanced" ? "advanced" : "task"));

  const prereqOk = !!state?.xlsform && !!state?.data;

  function toggleMode() {
    const next: Mode = mode === "task" ? "advanced" : "task";
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  }

  async function onAplicar() {
    setError("");
    setAdaptados(null);
    try {
      const out = await apiCodifAplicar();
      setAplicarJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onAplicarDone(data: AplicarResult) {
    setAdaptados({
      data: data.data_adaptada.file_id,
      inst: data.instrumento_adaptado.file_id,
    });
    setAplicarJobId(null);
    void refresh();
  }
  function onAplicarError(msg: string) { setError(msg); setAplicarJobId(null); }
  function onAplicarCancelled() { setAplicarJobId(null); }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
          <p className="pulso-page-lead">
            {mode === "task"
              ? "Codifica cada pregunta abierta agrupando respuestas y asignando códigos. La app detecta y clasifica automáticamente."
              : "Vista avanzada: edita familias y plantilla de códigos como tablas. Útil para configurar padre/hijo y casos no cubiertos por el flujo guiado."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, padding: "6px 12px",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            background: "white", cursor: "pointer", whiteSpace: "nowrap",
          }}
          title={mode === "task" ? "Cambiar a modo avanzado (tabla)" : "Volver al modo guiado"}
        >
          <SlidersHorizontal size={13} />
          {mode === "task" ? "Modo avanzado" : "Modo guiado"}
        </button>
      </div>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      {mode === "task" && prereqOk && (
        <>
          <PreguntasLanding />
          <div style={{ marginTop: 24, padding: 14, background: "var(--pulso-surface)", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>
              Cuando termines de codificar, aplica los cambios para generar los archivos adaptados.
            </div>
            <div style={{ flex: 1 }} />
            <button
              className="pulso-primary"
              disabled={!!aplicarJobId}
              onClick={() => void onAplicar()}
            >
              Aplicar codificación
            </button>
          </div>
          {aplicarJobId && (
            <div style={{ marginTop: 12 }}>
              <JobProgress<AplicarResult>
                label="Aplicando codificación"
                jobId={aplicarJobId}
                onDone={onAplicarDone}
                onError={onAplicarError}
                onCancelled={onAplicarCancelled}
              />
            </div>
          )}
        </>
      )}

      {mode === "advanced" && prereqOk && (
        <>
          <Panel eyebrow="Paso 1" title="Editar familias (tabla)">
            <FamiliasEditor />
          </Panel>
          <Panel eyebrow="Paso 2" title="Asignar códigos (tabla)">
            <CodigosEditor onApply={onAplicar} applyBusy={!!aplicarJobId} />
            {aplicarJobId && (
              <div style={{ marginTop: 12 }}>
                <JobProgress<AplicarResult>
                  label="Aplicando codificación"
                  jobId={aplicarJobId}
                  onDone={onAplicarDone}
                  onError={onAplicarError}
                  onCancelled={onAplicarCancelled}
                />
              </div>
            )}
          </Panel>
        </>
      )}

      {adaptados && (
        <Panel eyebrow="Resultado" title="Archivos adaptados">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={downloadUrl(adaptados.data)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> data_adaptada.xlsx
            </a>
            <a href={downloadUrl(adaptados.inst)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> instrumento_adaptado.xlsx
            </a>
          </div>
        </Panel>
      )}

      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
