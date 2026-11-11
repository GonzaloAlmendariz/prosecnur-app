import { EstadoChip } from "../../../components/EstadoChip";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { ListChecks } from "../../../vendor/lucide-react";
import type { QueSigue } from "./queSigueModel";

const TITULO = (
  <>
    <ListChecks size={16} aria-hidden="true" />
    <span>Por hacer</span>
  </>
);

export type PanelQueSigueProps = {
  /** `null` mientras la sesión no se ha leído: sin ella no se sabe qué sigue. */
  sigue: QueSigue | null;
  onAbrir: (to: string) => void;
};

/**
 * El siguiente paso del estudio, con su causa, y las secciones que la banda ya
 * marca como bloqueadas o incompletas. Lee el estado de la sesión: describe el
 * estudio, no una base.
 */
export function PanelQueSigue({ sigue, onAbrir }: PanelQueSigueProps) {
  if (!sigue) {
    return (
      <Panel title={TITULO} noPadding className="pulso-estado-estudio-panel">
        <div
          className="pulso-estado-estudio-cuerpo pulso-estado-estudio-espera"
          role="status"
          aria-busy="true"
          data-qa-geometry-capacity="owned"
        >
          <span className="pulso-sr-only">Cargando el estado del estudio</span>
          <Skeleton forma="titulo" ancho="70%" />
          <Skeleton forma="texto" ancho="88%" />
          <Skeleton forma="fila" />
        </div>
      </Panel>
    );
  }
  const { paso, pendientes } = sigue;

  return (
    <Panel title={TITULO} noPadding className="pulso-estado-estudio-panel">
      <div className="pulso-estado-sigue" data-qa-geometry-capacity="owned">
        <div className="pulso-estado-sigue-paso">
          <p className="pulso-estado-sigue-titulo">{paso.titulo}</p>
          {paso.causa ? <p className="pulso-estado-sigue-causa">{paso.causa}</p> : null}
          <PulsoButton
            variant={sigue.completo ? "secondary" : "primary"}
            size="lg"
            nav
            className="pulso-estado-sigue-accion"
            onClick={() => onAbrir(paso.to)}
          >
            {paso.accion}
          </PulsoButton>
        </div>

        {pendientes.length > 0 ? (
          <ul
            className="pulso-estado-sigue-pendientes"
            aria-label="Secciones pendientes"
            data-qa-geometry-group="estado-estudio-pendientes"
            data-qa-geometry-contract="intrinsic"
          >
            {pendientes.map((pendiente) => (
              <li key={pendiente.seccion} className="pulso-estado-sigue-pendiente">
                <div className="pulso-estado-sigue-pendiente-texto">
                  <span className="pulso-estado-sigue-pendiente-nombre">{pendiente.nombre}</span>
                  <span className="pulso-estado-sigue-pendiente-motivo">{pendiente.motivo}</span>
                </div>
                {pendiente.estado === "bloqueada" ? (
                  <EstadoChip label="Bloqueada" tone="neutral" detail={pendiente.motivo} />
                ) : (
                  <PulsoButton variant="secondary" size="sm" nav onClick={() => onAbrir(pendiente.to)}>
                    {`Abrir ${pendiente.nombre}`}
                  </PulsoButton>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
