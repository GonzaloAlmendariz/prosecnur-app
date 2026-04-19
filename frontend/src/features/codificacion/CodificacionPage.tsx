import { useState } from "react";
import { Download } from "lucide-react";
import {
  apiCodifAplicar,
  AplicarResult,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PreguntasLanding } from "./PreguntasLanding";

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const [error, setError] = useState<string>("");
  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);
  const [aplicarJobId, setAplicarJobId] = useState<string | null>(null);

  const prereqOk = !!state?.xlsform && !!state?.data;

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
    setAdaptados({ data: data.data_adaptada.file_id, inst: data.instrumento_adaptado.file_id });
    setAplicarJobId(null);
    void refresh();
  }
  function onAplicarError(msg: string) { setError(msg); setAplicarJobId(null); }
  function onAplicarCancelled() { setAplicarJobId(null); }

  return (
    <section>
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        Codifica cada pregunta abierta agrupando respuestas y asignando códigos. La app detecta y clasifica automáticamente según tu XLSForm.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      {prereqOk && (
        <>
          <PreguntasLanding />
          <div style={{ marginTop: 24, padding: 14, background: "var(--pulso-surface)", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>
              Cuando termines de codificar, aplica los cambios para generar los archivos adaptados.
            </div>
            <div style={{ flex: 1 }} />
            <button className="pulso-primary" disabled={!!aplicarJobId} onClick={() => void onAplicar()}>
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
