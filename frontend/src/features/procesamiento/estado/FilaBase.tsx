import { EstadoChip } from "../../../components/EstadoChip";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import {
  Activity,
  Check,
  Cloud,
  Database,
  FileSpreadsheet,
  Repeat,
  type LucideIcon,
} from "../../../vendor/lucide-react";
import type { FilaDeBase, OrigenDeBase } from "./basesDelEstudioModel";

const ICONO_DE_ORIGEN: Readonly<Record<OrigenDeBase, LucideIcon>> = {
  SurveyMonkey: Cloud,
  Kobo: Cloud,
  Archivo: FileSpreadsheet,
  "Grupo repetido": Repeat,
  Monitoreo: Activity,
  "Otro origen": Database,
};

export type FilaBaseProps = {
  fila: FilaDeBase;
  /** El estudio tiene más de una base: la fila lleva la columna para activarla. */
  conAccion: boolean;
  /** Base a la que se está cambiando ahora, si hay un cambio en curso. */
  activandoA: string | null;
  onActivar: (nombre: string) => void;
};

/** Una base del estudio: cuánto mide, de dónde viene y en qué va cada fase, con su causa. */
export function FilaBase({ fila, conAccion, activandoA, onActivar }: FilaBaseProps) {
  const IconoOrigen = ICONO_DE_ORIGEN[fila.origen];
  const activandoEsta = activandoA === fila.nombre;

  return (
    <div
      role="row"
      className="pulso-estado-base"
      // Con una sola base no hay otra de la que distinguirla: la fila no se marca.
      data-activa={conAccion && fila.activa ? "" : undefined}
      data-grupo-repetido={fila.madre ? "" : undefined}
      // Las cinco fases de una fila son pares: mismo ancho y mismo alto (C2).
      data-qa-geometry-group={fila.fases ? "estado-estudio-fases" : undefined}
      data-qa-geometry-contract={fila.fases ? "equal" : undefined}
    >
      <div role="rowheader" className="pulso-estado-base-nombre">
        <span className="pulso-estado-base-etiqueta">{fila.etiqueta}</span>
        {/* Las filas de un grupo repetido son instancias, no respuestas. */}
        {fila.filas != null ? (
          <span className="pulso-estado-base-tamano">
            {fila.madre ? formatoConteoDe(fila.filas, "fila") : formatoConteoDe(fila.filas, "respuesta")}
          </span>
        ) : null}
        <span
          className="pulso-estado-base-origen"
          title={fila.madre ? `Grupo repetido de ${fila.madre}` : undefined}
        >
          <IconoOrigen size={12} aria-hidden="true" />
          {fila.origen}
        </span>
      </div>

      {fila.fases ? (
        fila.fases.map((fase) => (
          <div
            role="cell"
            key={fase.fase}
            className="pulso-estado-base-fase"
            data-qa-geometry-member=""
            data-causa-pendiente={fase.causaPendiente ?? undefined}
          >
            {/* El nombre de la fase sólo se ve cuando la fila se apila y la cabecera de columnas se retira. */}
            <span className="pulso-estado-base-fase-nombre">{fase.nombre}</span>
            <EstadoChip label={fase.estado} tone={fase.tono} detail={`${fase.nombre}: ${fase.detalle}`} />
            {fase.causa ? <span className="pulso-estado-base-causa">{fase.causa}</span> : null}
          </div>
        ))
      ) : (
        <div role="cell" className="pulso-estado-base-sin-fases">
          Sin dato de estado
        </div>
      )}

      {conAccion ? (
        <div role="cell" className="pulso-estado-base-accion">
          {fila.activa ? (
            <span className="pulso-estado-base-activa">
              <Check size={13} aria-hidden="true" />
              Activa
            </span>
          ) : (
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={activandoA !== null}
              aria-label={`Activar ${fila.etiqueta}`}
              onClick={() => onActivar(fila.nombre)}
            >
              {activandoEsta ? "Activando" : "Activar"}
            </PulsoButton>
          )}
        </div>
      ) : null}
    </div>
  );
}
