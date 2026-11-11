import { AlertTriangle, ArrowRight, ClipboardCheck, Loader2, UploadCloud } from "../../../vendor/lucide-react";
import type { CargaMonitoreoHandoffStatus } from "../../../api/client";
import { formatoConteo } from "../../../lib/formatoNumero";
import { handoffCount } from "./cargaPaginaModelo";

// Tarjeta primaria del puente Monitoreo → Procesamiento: el trabajo de campo
// ya validado se ofrece con su formulario, sin jerga de "promote"/"universo".
export function FieldWorkHandoffCallout({
  status,
  selectedSourceId,
  busy,
  onBring,
  onUploadInstrument,
}: {
  status: CargaMonitoreoHandoffStatus;
  selectedSourceId: string | null;
  busy: boolean;
  onBring: () => void;
  onUploadInstrument: (file: File) => void;
}) {
  const { counts, source } = status;
  const selectedSource = status.sources?.find((item) => item.source_id === selectedSourceId);
  const processable = handoffCount(selectedSource?.counts.processable ?? counts.processable);
  const excluded = handoffCount(counts.no_defendible);
  const studyLabel = selectedSource?.label?.trim() || source.label?.trim();
  // El instrumento de procesamiento es SIEMPRE local. Está listo solo cuando
  // hay un XLSForm local disponible; si falta, la UI ofrece subirlo.
  const instrumentReady =
    source.instrument_source === "local" && source.instrument_available === true;
  const instrumentNeedsUpload =
    source.instrument_needs_upload === true || source.instrument_source === "needs_upload";
  const instrumentMissing = !instrumentReady;
  // En el camino general sin status resoluble (validity "all_rows") no todas las
  // filas son "validadas": traemos todo el corte de la fuente. En territorial y en
  // el camino por status, sí se filtró a las respuestas válidas.
  const filteredByValidity =
    source.validity !== undefined && source.validity !== "" && source.validity !== "all_rows";
  const countLine = filteredByValidity
    ? `${formatoConteo(processable)} respuestas validadas listas para procesar.`
    : `${formatoConteo(processable)} respuestas listas para procesar.`;
  // Si ya hay una base cruda cargada (import previo sin filtrar), el traer la
  // reemplaza en sitio por la selección validada — lo decimos con claridad.
  const replacing =
    status.existing_base.present && !status.existing_base.is_territorial;
  const replacedRows = status.existing_base.present ? status.existing_base.n_filas : 0;
  const instrumentNote = instrumentReady
    ? "Usaremos el formulario (XLSForm) ya cargado en el proyecto."
    : instrumentNeedsUpload
      ? "Falta el formulario (XLSForm). Súbelo para traer el trabajo de campo con su estructura."
      : "El formulario del estudio todavía no está disponible.";

  return (
    <section
      className={`pulso-carga-handoff${instrumentMissing ? " is-warning" : ""}`}
      aria-label="Trabajo de campo listo para procesar"
    >
      <span className="pulso-carga-handoff-icon" aria-hidden="true">
        <ClipboardCheck size={18} />
      </span>
      <div className="pulso-carga-handoff-copy">
        <span className="pulso-carga-handoff-eyebrow">Desde Monitoreo</span>
        <strong className="pulso-carga-handoff-title">
          Tu trabajo de campo está listo para procesar
        </strong>
        {studyLabel ? (
          <span className="pulso-carga-handoff-study">
            {studyLabel}{selectedSource?.kind ? `, ${selectedSource.kind}` : ""}
          </span>
        ) : null}
        <p className="pulso-carga-handoff-count">
          {countLine}
          {excluded > 0 ? (
            <span className="pulso-carga-handoff-aside">
              {" "}{formatoConteo(excluded)} quedan fuera por no ser defendibles.
            </span>
          ) : null}
        </p>
        {replacing ? (
          <span className="pulso-carga-handoff-note is-warning">
            <AlertTriangle size={13} aria-hidden="true" />
            Reemplaza la base actual ({formatoConteo(replacedRows)} sin filtrar)
            por esta selección validada.
          </span>
        ) : null}
        <span className={`pulso-carga-handoff-note${instrumentMissing ? " is-warning" : ""}`}>
          {instrumentMissing ? <AlertTriangle size={13} aria-hidden="true" /> : null}
          {instrumentNote}
        </span>
      </div>
      <div className="pulso-carga-handoff-actions">
        {instrumentNeedsUpload ? (
          <label
            className={`pulso-carga-handoff-upload${busy ? " is-disabled" : ""}`}
            title="Sube el XLSForm del formulario (última versión de Kobo)"
          >
            <UploadCloud size={14} aria-hidden="true" />
            Sube el XLSForm del formulario
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Limpiamos el value para permitir re-subir el mismo archivo
                // tras un error de compatibilidad form↔data.
                e.target.value = "";
                if (file) onUploadInstrument(file);
              }}
              style={{ display: "none" }}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="pulso-carga-handoff-primary"
          onClick={onBring}
          disabled={busy || instrumentMissing}
          title={
            instrumentReady
              ? "Traer el trabajo de campo al procesamiento"
              : instrumentNeedsUpload
                ? "Sube el formulario (XLSForm) para traer el trabajo de campo"
                : "El formulario del estudio todavía no está disponible"
          }
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <ArrowRight size={14} />}
          {replacing ? "Reemplazar por la validada" : "Traer al procesamiento"}
        </button>
      </div>
    </section>
  );
}
