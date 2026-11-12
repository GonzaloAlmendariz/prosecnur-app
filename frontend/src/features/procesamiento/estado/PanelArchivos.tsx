import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { Skeleton } from "../../../components/Skeleton";
import { Folder } from "../../../vendor/lucide-react";
import {
  ENTREGABLES,
  PEDIDO_ARCHIVOS_POR_BASE,
  type CeldaDeArchivo,
  type FilaDeArchivos,
} from "./archivosDelEstudioModel";

const ROTULO: Readonly<Record<CeldaDeArchivo["estado"], string>> = {
  generado: "Generado",
  "por-generar": "Por generar",
  "sin-dato": "Sin dato",
};

function Celda({ celda, activa }: { celda: CeldaDeArchivo; activa: boolean }) {
  return (
    <div
      role="cell"
      className="pulso-estado-archivo"
      data-estado={celda.estado}
      data-qa-geometry-member=""
      // Sin dato: el motor guarda el indicador de esta base pero no lo publica.
      data-causa-pendiente={celda.estado === "sin-dato" ? PEDIDO_ARCHIVOS_POR_BASE : undefined}
      title={celda.estado === "sin-dato" && !activa ? "Se ve al activar la base." : undefined}
    >
      <span className="pulso-estado-archivo-punto" aria-hidden="true" />
      <span className="pulso-estado-archivo-texto">
        <span className="pulso-estado-archivo-estado">{ROTULO[celda.estado]}</span>
        {celda.detalle ? <span className="pulso-estado-archivo-detalle">{celda.detalle}</span> : null}
      </span>
    </div>
  );
}

/** "Archivos del estudio": qué entregable de Analítica y Gráficos tiene cada base. */
export function PanelArchivos({ filas }: {
  /** `null` mientras el estudio se lee. */
  filas: readonly FilaDeArchivos[] | null;
}) {
  return (
    <PanelDeMesa zona="estado-archivos" titulo="Archivos del estudio" icono={<Folder size={16} />}>
      {filas === null ? (
        <div className="pulso-estado-estudio-cuerpo pulso-estado-estudio-espera" role="status" aria-busy="true">
          <span className="pulso-sr-only">Cargando los archivos del estudio</span>
          <Skeleton forma="fila" />
          <Skeleton forma="fila" />
        </div>
      ) : filas.length === 0 ? (
        // Sin bases no hay archivos; la acción para agregarlas ya la da el avance.
        <div className="pulso-estado-estudio-cuerpo">
          <EstadoVacio tamano="compacto" icono={<Folder size={18} />} titulo="Sin archivos" descripcion="Se generan en Analítica y Gráficos." />
        </div>
      ) : (
        <div role="table" aria-label="Archivos de cada base" className="pulso-estado-archivos">
          <div role="rowgroup" className="pulso-estado-archivos-encabezado">
            <div role="row" className="pulso-estado-archivos-cabecera">
              <span role="columnheader">Base</span>
              {ENTREGABLES.map((e) => (
                <span role="columnheader" key={e.id}>
                  {e.nombre}
                </span>
              ))}
            </div>
          </div>
          <div
            role="rowgroup"
            data-qa-geometry-group="estado-estudio-archivos"
            data-qa-geometry-contract="intrinsic"
          >
            {filas.map((fila) => (
              <div
                role="row"
                key={fila.nombre}
                className="pulso-estado-archivos-fila"
                data-qa-geometry-group="estado-estudio-archivos-celdas"
                data-qa-geometry-contract="equal"
              >
                <span role="rowheader" className="pulso-estado-archivos-base">
                  {fila.etiqueta}
                </span>
                {fila.celdas.map((celda) => (
                  <Celda key={celda.entregable} celda={celda} activa={fila.activa} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelDeMesa>
  );
}
