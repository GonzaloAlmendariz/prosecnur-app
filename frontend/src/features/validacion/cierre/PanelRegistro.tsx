/**
 * El registro completo de las decisiones (`panel=registro`, D-F7f): todas las
 * decisiones guardadas de la base, listas y borradores, la más reciente
 * primero, con su tratamiento, su fecha y su motivo. Es el panel del kit
 * (`Sideover`) abierto por la dirección.
 */
import { Sideover } from "../../../components/Sideover";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { History } from "../../../vendor/lucide-react";
import { PANEL_REGISTRO_VALIDACION } from "../panelesValidacion";
import type { FilaDeRegistro } from "./modeloCierre";

export function PanelRegistro({ filas, onAbrirHallazgo }: {
  filas: readonly FilaDeRegistro[];
  onAbrirHallazgo: (sourceId: string) => void;
}) {
  return (
    <Sideover
      panel={PANEL_REGISTRO_VALIDACION}
      className="pulso-ci-registro"
      title="Registro de decisiones"
      icon={<History size={16} />}
      closeLabel="Cerrar el registro"
      footerStatus={<span>Los casos excluidos, uno por fila, están en la hoja "Excluidos por caso" del Registro de limpieza.</span>}
    >
      {filas.length === 0 ? (
        <EstadoVacio tamano="normal" icono={<History size={20} />} titulo="Sin decisiones guardadas" descripcion="Las decisiones se toman en Hallazgos." />
      ) : (
        <ol className="pulso-ci-registro-lista" data-qa-geometry-group="validacion/cierre-registro" data-qa-geometry-contract="intrinsic">
          {filas.map((f) => (
            <li key={f.id}>
              <div className="pulso-ci-registro-cabeza">
                <button type="button" className="pulso-ci-nombre" onClick={() => onAbrirHallazgo(f.sourceId)}>{f.hallazgo}</button>
                <span className="pulso-ci-estado-decision" data-estado={f.estado === "Lista" ? "lista" : "borrador"}>{f.estado}</span>
              </div>
              <span className="pulso-ci-registro-linea">
                {f.tratamiento}
                {f.fecha ? `, ${f.fecha}` : ""}
              </span>
              {f.motivo ? <span className="pulso-ci-registro-motivo">{f.motivo}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </Sideover>
  );
}
