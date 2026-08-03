import { BarChart3, Loader2, RefreshCw } from "../../../../vendor/lucide-react";
import type { CriterioScope } from "../../../../api/client";
import "./criteriosRadiografiaRecovery.css";

export function CriteriosRadiografiaRecovery({
  scope,
  onActualizar,
  puedeActualizar = false,
  actualizando = false,
}: {
  scope: CriterioScope;
  onActualizar?: () => void;
  puedeActualizar?: boolean;
  actualizando?: boolean;
}) {
  const sujeto = scope === "alumno" ? "los criterios del estudiante" : "los criterios de curso-horario";

  return (
    <section
      className="cmv2-crc-recovery"
      data-recovery="criterios-radiografia"
      data-audit-ready="false"
      data-qa-geometry-group="calc-muestra/criterios-radiografia-recuperacion"
      data-qa-geometry-contract="intrinsic"
      aria-labelledby={`cmv2-crc-recovery-title-${scope}`}
    >
      <span className="cmv2-crc-recovery-icon" aria-hidden="true">
        <BarChart3 size={22} />
      </span>
      <div className="cmv2-crc-recovery-copy" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <span className="cmv2-crc-recovery-eyebrow">Radiografía por facultad pendiente</span>
        <h3 id={`cmv2-crc-recovery-title-${scope}`}>Este marco conserva datos, pero aún no publica su detalle analítico</h3>
        <p>
          El frame guardado no incluye el contrato que publica {sujeto} por facultad. Puede ser anterior a esta
          capacidad o requerir criterios confirmados. Actualízalo con el motor R para ver sus distribuciones y
          denominadores reales; esta pantalla no los reemplaza con ceros ni cálculos locales.
        </p>
      </div>
      {onActualizar ? (
        <div className="cmv2-crc-recovery-action" data-qa-geometry-member data-qa-geometry-capacity="owned">
          <button
            type="button"
            onClick={onActualizar}
            disabled={!puedeActualizar || actualizando}
            aria-busy={actualizando ? "true" : undefined}
          >
            {actualizando ? (
              <Loader2 size={16} className="pulso-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            {actualizando ? "Actualizando radiografía…" : "Actualizar radiografía por facultad"}
          </button>
          {!puedeActualizar && !actualizando ? (
            <small>Completa o corrige las fuentes del marco para habilitar esta actualización.</small>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
