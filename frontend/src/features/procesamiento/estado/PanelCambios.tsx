import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { Skeleton } from "../../../components/Skeleton";
import { History } from "../../../vendor/lucide-react";
import { PEDIDO_CAMBIOS, type CambioReciente } from "./cambiosRecientesModel";

/** "Cambios recientes": lo que pasó en cada base, con su fecha, del más reciente al más antiguo. */
export function PanelCambios({ cambios }: {
  /** `null` mientras el estudio se lee. */
  cambios: readonly CambioReciente[] | null;
}) {
  return (
    <PanelDeMesa zona="estado-cambios" titulo="Cambios recientes" icono={<History size={16} />}>
      {cambios === null ? (
        <div className="pulso-estado-estudio-cuerpo pulso-estado-estudio-espera" role="status" aria-busy="true">
          <span className="pulso-sr-only">Cargando los cambios recientes</span>
          <Skeleton forma="texto" />
          <Skeleton forma="texto" ancho="80%" />
        </div>
      ) : cambios.length === 0 ? (
        <div className="pulso-estado-estudio-cuerpo" data-causa-pendiente={PEDIDO_CAMBIOS}>
          <EstadoVacio
            tamano="compacto"
            icono={<History size={18} />}
            titulo="Sin cambios con fecha"
            descripcion="Aparecen al agregar una base o leer SurveyMonkey."
          />
        </div>
      ) : (
        <ul
          className="pulso-estado-cambios"
          aria-label="Cambios recientes del estudio"
          data-causa-pendiente={PEDIDO_CAMBIOS}
          data-qa-geometry-group="estado-estudio-cambios"
          data-qa-geometry-contract="intrinsic"
        >
          {cambios.map((cambio) => (
            <li key={cambio.clave} className="pulso-estado-cambio">
              <time className="pulso-estado-cambio-fecha" dateTime={new Date(cambio.instante).toISOString()}>
                {cambio.fecha}
              </time>
              <span className="pulso-estado-cambio-texto">
                <b>{cambio.base}:</b> {cambio.hecho}.
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelDeMesa>
  );
}
