/**
 * El paquete metodológico (la metodología de la validación en PDF y su script
 * en R, en un ZIP) en la pestaña Cierre.
 *
 * Hasta la rebanada V2 de P6 era un botón del paso 1 de "Reglas del
 * formulario"; el plan lo pone en Cierre, junto a los demás archivos que salen
 * de la validación. Usa la misma generación del kit (`useEntregasInstrumento`)
 * y su contenedor en bloque bajo el panel.
 */
import { FileText } from "../../../vendor/lucide-react";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { Panel } from "../../../components/Panel";
import { useEntregasInstrumento } from "../entregas/useEntregasInstrumento";

export default function PaqueteMetodologico({
  baseNombre,
  planConstruido,
}: {
  baseNombre: string | null;
  planConstruido: boolean;
}) {
  const { paquete, generarPaquete } = useEntregasInstrumento(baseNombre);
  return (
    <>
      <Panel
        className="pulso-validacion-paquete"
        aria-labelledby="pulso-validacion-paquete-titulo"
        title={<span id="pulso-validacion-paquete-titulo">Paquete metodológico</span>}
        hint={planConstruido
          ? "La metodología de la validación en PDF y su script en R, en un ZIP."
          : "Requiere el plan de reglas, que se construye en Reglas."}
        actions={(
          <button
            type="button"
            className="pulso-instrumento-action"
            onClick={() => void generarPaquete()}
            disabled={!planConstruido || paquete.enCurso}
          >
            <FileText size={12} /> Generar paquete
          </button>
        )}
      >
        {null}
      </Panel>
      <ContenedorEntregable estado={paquete.estado} forma="bloque" onCerrar={paquete.cerrar} />
    </>
  );
}
