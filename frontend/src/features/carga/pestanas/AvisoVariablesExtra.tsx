import { ArrowRightLeft, FileWarning } from "../../../vendor/lucide-react";

/** Aviso de Revisión cuando la base trae variables que el formulario no declara. */
export function AvisoVariablesExtra({
  baseNombre,
  resumen,
  onRevisar,
}: {
  baseNombre: string | null | undefined;
  resumen: string;
  onRevisar: () => void;
}) {
  return (
    <div className="pulso-recon-panel" data-audit-ready="true">
      <span className="pulso-recon-panel-icon" aria-hidden="true">
        <FileWarning size={16} />
      </span>
      <div className="pulso-recon-panel-copy">
        <span className="pulso-recon-panel-title">
          Variables extra{baseNombre ? ` de ${baseNombre}` : " en la data"}
        </span>
        <span className="pulso-recon-panel-summary">{resumen}</span>
      </div>
      <button
        type="button"
        className="pulso-recon-panel-button"
        onClick={onRevisar}
      >
        <ArrowRightLeft size={14} aria-hidden="true" />
        Revisar variables extra
      </button>
    </div>
  );
}
