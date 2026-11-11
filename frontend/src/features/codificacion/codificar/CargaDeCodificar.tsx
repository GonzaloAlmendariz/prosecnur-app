import { Panel } from "../../../components/Panel";
import { Skeleton } from "../../../components/Skeleton";

/**
 * La mesa mientras llegan las respuestas: los dos paneles en su sitio, con la silueta de lo que traen.
 * No escribe `data-audit-ready`: esa marca es de la vista con datos.
 */
export function CargaDeCodificar({ rotulo }: { rotulo: string }) {
  return (
    <div className="pulso-cc-mesa" role="status" aria-busy="true">
      <span className="pulso-sr-only">{rotulo}</span>
      <div className="pulso-cc-barra" aria-hidden="true">
        <Skeleton forma="texto" ancho="14rem" />
      </div>
      <div className="pulso-cv2-split pulso-cc-split" aria-hidden="true">
        <Panel noPadding className="pulso-cc-panel">
          <div className="pulso-cc-panel-cab">
            <Skeleton forma="titulo" ancho="7rem" />
          </div>
          <div className="pulso-cc-carga-filas">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} forma="fila" />
            ))}
          </div>
        </Panel>
        <Panel noPadding className="pulso-cc-panel">
          <div className="pulso-cc-panel-cab">
            <Skeleton forma="titulo" ancho="6rem" />
          </div>
          <div className="pulso-cc-carga-filas">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} forma="card" alto="4.5rem" />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
