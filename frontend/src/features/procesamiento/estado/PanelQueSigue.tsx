import { EstadoChip } from "../../../components/EstadoChip";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { CheckCircle2, ListChecks } from "../../../vendor/lucide-react";
import type { TareaPorHacer } from "./porHacerModel";
import type { PasoSiguiente } from "./queSigueModel";

export type PanelQueSigueProps = {
  /** `null` mientras la sesión no se ha leído: sin ella no se sabe qué sigue. */
  tareas: readonly TareaPorHacer[] | null;
  /** El paso del estudio: sin tareas, su destino es la acción del vacío. */
  paso: PasoSiguiente | null;
  /** Clave de la tarea que está activando su base antes de ir. */
  yendo: string | null;
  onIr: (tarea: TareaPorHacer) => void;
  onAbrir: (to: string) => void;
};

/**
 * "Por hacer": el siguiente paso del estudio, las bases que esperan su
 * aprobación y las secciones que la banda marca como bloqueadas o incompletas,
 * numerados y cada uno con su "Ir".
 */
export function PanelQueSigue({ tareas, paso, yendo, onIr, onAbrir }: PanelQueSigueProps) {
  return (
    <PanelDeMesa
      zona="estado-por-hacer"
      titulo="Por hacer"
      icono={<ListChecks size={16} />}
      conteo={tareas && tareas.length > 0 ? tareas.length : undefined}
    >
      {tareas === null ? (
        <div className="pulso-estado-estudio-cuerpo pulso-estado-estudio-espera" role="status" aria-busy="true">
          <span className="pulso-sr-only">Cargando el estado del estudio</span>
          <Skeleton forma="titulo" ancho="70%" />
          <Skeleton forma="texto" ancho="88%" />
          <Skeleton forma="fila" />
        </div>
      ) : tareas.length === 0 ? (
        <div className="pulso-estado-estudio-cuerpo">
          <EstadoVacio
            tamano="compacto"
            icono={<CheckCircle2 size={18} />}
            titulo="Sin pasos pendientes"
            accion={
              paso ? (
                <PulsoButton variant="secondary" size="sm" nav onClick={() => onAbrir(paso.to)}>
                  {paso.accion}
                </PulsoButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ol
          className="pulso-estado-sigue-pendientes"
          aria-label="Pasos pendientes"
          data-qa-geometry-group="estado-estudio-pendientes"
          data-qa-geometry-contract="intrinsic"
        >
          {tareas.map((tarea, i) => (
            <li key={tarea.clave} className="pulso-estado-sigue-pendiente">
              <span className="pulso-estado-sigue-numero" aria-hidden="true">
                {i + 1}
              </span>
              <div className="pulso-estado-sigue-pendiente-texto">
                <span className="pulso-estado-sigue-pendiente-nombre">{tarea.titulo}</span>
                {tarea.detalle ? <span className="pulso-estado-sigue-pendiente-motivo">{tarea.detalle}</span> : null}
              </div>
              {tarea.bloqueada ? (
                <EstadoChip label="Bloqueada" tone="neutral" detail={tarea.detalle ?? undefined} />
              ) : (
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  nav
                  disabled={yendo !== null}
                  aria-label={`Ir a ${tarea.destino}: ${tarea.titulo}`}
                  onClick={() => onIr(tarea)}
                >
                  Ir
                </PulsoButton>
              )}
            </li>
          ))}
        </ol>
      )}
    </PanelDeMesa>
  );
}
