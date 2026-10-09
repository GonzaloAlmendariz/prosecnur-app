import { Repeat } from "lucide-react";

import "./mesa.css";

/**
 * Ver los otros tipos de estudio. Es una decisión sobre el estudio entero, no
 * un atajo de cada sección: vive arriba en la ficha del estudio (Marco en
 * Muestra general, Contexto en Acreditación, Datos en aulas) y, además, el
 * indicador «Tipo» de la barra abre lo mismo. Abrir el selector no borra
 * nada: cambiar de tipo se confirma aparte (VistaPreviaTipo).
 */
export function CambiarTipoEstudio({ onCambiarTipo }: { onCambiarTipo: () => void }) {
  return (
    <div className="cmg-cambiar-tipo">
      <button
        type="button"
        className="cmv2-ghost"
        onClick={() => onCambiarTipo()}
        title="Abre el selector; tu estudio no cambia hasta que confirmes otro tipo"
      >
        <Repeat size={14} aria-hidden="true" /> Ver otros tipos de estudio
      </button>
    </div>
  );
}
