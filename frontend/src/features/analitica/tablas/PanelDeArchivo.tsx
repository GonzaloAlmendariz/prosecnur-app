// El panel "Archivo" de Frecuencias y Cruces, al pie de la columna derecha: el
// Excel que genera la pestaña y en qué punto está. Antes de generar, su nombre
// y el motivo si no se puede todavía; al generar, el contenedor de entregables
// del kit con el avance, el archivo listo y sus acciones, o el fallo.
//
// El estado es el de esta vista (`useReporteRun`): la app no guarda cuándo se
// generó el archivo ni si quedó atrás de los ajustes, así que no lo dice.

import { Panel } from "../../../components/Panel";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { TileFormato } from "../../../components/entregables/TileFormato";
import { FolderOpen } from "../../../vendor/lucide-react";
import { ArchivosPorBase } from "../PaneKit";
import type { ReporteRunState } from "../useReporteRun";

export function PanelDeArchivo({ nombre, run, bloqueo, idDelMotivo, etiquetaDeBase }: {
  /** El entregable en palabras: "Frecuencias", "Cruces". */
  nombre: string;
  run: Pick<ReporteRunState, "generacion" | "perBase">;
  /** Por qué no se puede generar todavía. */
  bloqueo?: string;
  /** El `id` del texto del motivo, que nombra el botón de la cabecera. */
  idDelMotivo: string;
  /** El nombre que ve el usuario de cada base, para los archivos por base. */
  etiquetaDeBase?: (base: string) => string;
}) {
  const { estado, cerrar } = run.generacion;
  const porBase = run.perBase.length > 1 ? run.perBase : [];
  const motivo = bloqueo ? <span id={idDelMotivo} className="tablas-archivo-motivo">{bloqueo}</span> : null;
  return (
    <Panel
      noPadding
      data-entra="sube"
      className="tablas-panel tablas-panel--archivo"
      title={<><span className="tablas-panel-tesela" aria-hidden="true"><FolderOpen size={16} /></span><span>Archivo</span></>}
    >
      <div className="tablas-archivo-cuerpo" data-qa-geometry-capacity="owned">
        {estado.fase === "inactiva" ? (
          <div className="tablas-archivo-fila">
            <TileFormato formato="xlsx" />
            <div className="tablas-archivo-texto">
              <strong>{nombre}</strong>
              {motivo ?? <span className="tablas-archivo-motivo">Por generar</span>}
            </div>
          </div>
        ) : (
          <>
            <ContenedorEntregable
              estado={estado}
              forma="bloque"
              onCerrar={cerrar}
              pie={estado.fase === "lista" && porBase.length > 0 ? <ArchivosPorBase bases={porBase} etiquetaDe={etiquetaDeBase} /> : undefined}
            />
            {motivo}
          </>
        )}
      </div>
    </Panel>
  );
}
