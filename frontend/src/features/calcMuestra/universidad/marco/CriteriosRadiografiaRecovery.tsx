import { BarChart3, Loader2, RefreshCw } from "../../../../vendor/lucide-react";
import type { CriterioScope } from "../../../../api/client";
import "./criteriosRadiografiaRecovery.css";

export function CriteriosRadiografiaRecovery({
  scope,
  onActualizar,
  puedeActualizar = false,
  actualizando = false,
  sinCriteriosDeclarados = false,
}: {
  scope: CriterioScope;
  onActualizar?: () => void;
  puedeActualizar?: boolean;
  actualizando?: boolean;
  /**
   * No hay ninguna suite de criterios activa todavía. La radiografía se
   * calcula SOBRE los criterios (`if (n_aulas && suite_activa)` en
   * calc_muestra_aulas_criterios.R), así que en este estado reconstruir el
   * marco no la produce por mucho que se insista: medido en vivo, el botón
   * disparaba dos builds de ~40 s y la tarjeta seguía igual.
   */
  sinCriteriosDeclarados?: boolean;
}) {
  const sujeto = scope === "alumno" ? "los criterios del estudiante" : "los criterios de curso-horario";
  const cuales = scope === "alumno" ? "del estudiante" : "de curso-horario";

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
        {sinCriteriosDeclarados ? (
          <>
            <h3 id={`cmv2-crc-recovery-title-${scope}`}>La radiografía aparece cuando declaras criterios</h3>
            <p>
              Todavía no hay criterios {cuales} declarados, y esta radiografía se calcula sobre ellos:
              muestra qué recorta cada criterio en cada facultad. Elige las categorías que entran en al
              menos una variable y confírmalas; entonces se publica aquí con las cifras del motor.
            </p>
          </>
        ) : (
          <>
            <h3 id={`cmv2-crc-recovery-title-${scope}`}>Este marco conserva datos, pero aún no publica su detalle analítico</h3>
            <p>
              El frame guardado no incluye el contrato que publica {sujeto} por facultad: se construyó antes de
              esta capacidad. Actualízalo con el motor R para ver sus distribuciones y denominadores reales;
              esta pantalla no los reemplaza con ceros ni cálculos locales.
            </p>
          </>
        )}
      </div>
      {/* Sin criterios declarados no se ofrece actualizar: el camino es
          declararlos, no reconstruir. */}
      {onActualizar && !sinCriteriosDeclarados ? (
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
