import { Ban, Loader2 } from "lucide-react";

type Props = {
  /** Texto completo del banner (etapa + tiempo transcurrido). */
  label: string;
  /**
   * Id del job activo en el backend. Cuando es distinto de `null`, el proceso
   * es cancelable y se muestra el botón "Cancelar". Cuando es `null` el banner
   * corresponde a una operación no-job (subir Excel, preparar mesa…) y no se
   * ofrece cancelar.
   */
  jobId: string | null;
  /** True mientras se está confirmando la cancelación con el backend. */
  cancelling: boolean;
  onCancel: () => void;
};

/**
 * Banner de progreso de los jobs largos de la mesa de aulas (comparar métodos,
 * sorteo de cursos-horario). Muestra la etapa del worker y, cuando hay un job
 * activo, un botón para cancelarlo sin quedar atrapado esperando >1h.
 */
export function JobProgressBanner({ label, jobId, cancelling, onCancel }: Props) {
  return (
    <div className="cmv2-busy" role="status">
      <Loader2 size={16} className="pulso-spin" aria-hidden="true" />
      <span className="cmv2-busy-label">{label}</span>
      {jobId && (
        <button
          type="button"
          className="cmv2-busy-cancel"
          onClick={onCancel}
          disabled={cancelling}
        >
          <Ban size={13} aria-hidden="true" />
          {cancelling ? "Cancelando…" : "Cancelar"}
        </button>
      )}
    </div>
  );
}
