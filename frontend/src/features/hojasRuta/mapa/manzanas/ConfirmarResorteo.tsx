import { PulsoButton } from "../../../../components/PulsoButton";
import { fechaDelSorteo } from "./fechaSorteo";

type Props = {
  /** Cuándo se envió la muestra a Material (ISO), si se sabe. */
  enviadoEl: string | null;
  guardando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/**
 * Volver a sortear una muestra ya enviada no es de un clic (decisión de Gonzalo, 1 nov 2026):
 * antes de sortear se dice que Material de campo y Monitoreo quedan desfasados de la muestra
 * enviada hasta que se envíe de nuevo. Va dentro del inspector, no como diálogo: es un paso
 * más del mismo botón, no una vista.
 */
export function ConfirmarResorteo({ enviadoEl, guardando, onConfirmar, onCancelar }: Props) {
  const cuando = fechaDelSorteo(enviadoEl);
  return (
    <section className="hr-sorteo-v1" role="alert" aria-label="Volver a sortear una muestra enviada">
      <strong>Esta muestra ya está en Material de campo{cuando ? ` (enviada el ${cuando})` : ""}</strong>
      <p>
        Si sorteas de nuevo, Material de campo y Monitoreo siguen trabajando con la muestra enviada: quedan desfasados
        hasta que la vuelvas a enviar. Las fichas, los paquetes y el avance que ya salieron no cambian solos.
      </p>
      <span className="hr-sorteo-confirmar">
        <PulsoButton variant="secondary" size="sm" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </PulsoButton>
        <PulsoButton variant="primary" size="sm" disabled={guardando} onClick={onConfirmar}>
          {guardando ? "Sorteando…" : "Sortear igual"}
        </PulsoButton>
      </span>
    </section>
  );
}
