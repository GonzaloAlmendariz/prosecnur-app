import { Repeat } from "lucide-react";

import "./mesa.css";

/**
 * Cambiar el tipo de estudio es una decisión sobre el estudio entero, no un
 * atajo de cada sección: vive en la ficha del estudio de la primera sección
 * (Marco en Muestra general, Contexto en Acreditación), como en aulas, donde la
 * barra del módulo no lleva acciones.
 */
export function CambiarTipoEstudio({ onCambiarTipo }: { onCambiarTipo: () => void }) {
  return (
    <div className="cmg-cambiar-tipo">
      <button type="button" className="cmv2-ghost" onClick={() => onCambiarTipo()} aria-describedby="cmg-cambiar-tipo-nota">
        <Repeat size={14} aria-hidden="true" /> Cambiar el tipo de estudio
      </button>
      <small id="cmg-cambiar-tipo-nota" className="cmg-motivo">Vuelve a elegir el tipo de estudio.</small>
    </div>
  );
}
