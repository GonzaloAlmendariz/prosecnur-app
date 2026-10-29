import { useState } from "react";
import { JobProgress } from "../../../../components/JobProgress";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaReporteDecisionalIniciar, hojasRutaReporteDecisionalUrl } from "../../../../api/hojasRuta";
import { FileText } from "../../../../vendor/lucide-react";

/**
 * «Ver el informe» (brecha B22): el informe de diseño muestral (U16) que arma el motor
 * en un job; al terminar se abre en una pestaña propia. Nada se calcula aquí.
 */
export function InformeDiseno({ deshabilitado }: { deshabilitado: boolean }) {
  const [job, setJob] = useState<string | null>(null);
  const [error, setError] = useState("");
  const iniciar = () => {
    setError("");
    apiHojasRutaReporteDecisionalIniciar("html")
      .then((r) => setJob(r.job_id))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo preparar el informe"));
  };
  return (
    <section className="hr-muestra-grupo" aria-label="Informe de diseño muestral">
      <h3>Informe de diseño muestral</h3>
      <p className="hr-mapa-nota">Territorio, población, tamaño, marco elegible y sorteo, con sus supuestos, para compartir con el cliente.</p>
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      <PulsoButton variant="secondary" size="sm" disabled={deshabilitado || job != null} onClick={iniciar}>
        <FileText size={13} aria-hidden /> {job ? "Preparando el informe…" : "Ver el informe"}
      </PulsoButton>
      <JobProgress
        label="Preparando el informe"
        jobId={job}
        onDone={() => {
          setJob(null);
          window.open(hojasRutaReporteDecisionalUrl({ inline: true }), "_blank", "noopener,noreferrer");
        }}
        onError={(msg) => {
          setJob(null);
          setError(msg);
        }}
        onCancelled={() => setJob(null)}
      />
    </section>
  );
}
