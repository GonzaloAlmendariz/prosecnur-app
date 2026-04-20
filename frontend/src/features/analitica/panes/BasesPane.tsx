import { Database, Download, Play } from "lucide-react";
import { apiAnaliticaSpss, downloadUrl, FileJobResult } from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { JobProgress } from "../../../components/JobProgress";
import { useReporteRun } from "../useReporteRun";

// Bases — exporta el dataset etiquetado como .sav + sintaxis .sps en zip.
// No tiene argumentos configurables; siempre usa la data preparada en
// el estado actual (respetando el toggle de fuente del header global).

export function BasesPane() {
  const run = useReporteRun();

  async function onGenerate() {
    await run.runAsync(() => apiAnaliticaSpss());
  }

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Database size={16} /> Bases</span>}
      hint={<>Exporta el dataset etiquetado como <code>.sav</code> (lee SPSS) y la sintaxis de niveles como <code>.sps</code>, empaquetados en un zip.</>}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="pulso-primary"
          onClick={onGenerate}
          disabled={run.busy || !!run.jobId}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Play size={14} /> {run.jobId ? "Exportando…" : "Exportar bases"}
        </button>
        {run.fileId && (
          <a
            href={downloadUrl(run.fileId)}
            style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Download size={13} /> bases.zip
          </a>
        )}
      </div>

      {run.jobId && (
        <div style={{ marginTop: 12 }}>
          <JobProgress<FileJobResult>
            label="Exportando bases"
            jobId={run.jobId}
            onDone={run.onJobDone}
            onError={run.onJobError}
            onCancelled={run.onJobCancelled}
          />
        </div>
      )}

      {run.error && (
        <div style={{ marginTop: 10 }}>
          <Alert kind="error">{run.error}</Alert>
        </div>
      )}

      <div
        style={{
          marginTop: 14, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5,
          padding: "8px 12px", background: "var(--pulso-surface)", borderRadius: 6,
        }}
      >
        No hay opciones extra: el archivo incluye todas las variables del instrumento con value-labels y measures SPSS correspondientes. Si quieres filtrar variables o columnas, hazlo desde SPSS una vez descargada la base.
      </div>
    </Panel>
  );
}
