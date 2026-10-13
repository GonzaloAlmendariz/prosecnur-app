// G18: los avisos de una etiqueta en la revisión de datos. Cita el fragmento y, cuando hay una corrección mecánica,
// ofrece aplicarla; el analista decide (D4). La etiqueta sólo cambia en el borrador hasta que confirma la revisión.

import type { ProblemaEtiqueta } from "./detectorEtiquetas";
import "./avisosEtiqueta.css";

export function AvisosEtiqueta({ problemas, onAplicar }: { problemas: readonly ProblemaEtiqueta[]; onAplicar: (etiqueta: string) => void }) {
  if (!problemas.length) return null;
  return (
    <ul className="pulso-avisos-etiqueta" aria-label="Detalles de redacción de la etiqueta">
      {problemas.map((p) => (
        <li key={`${p.tipo}-${p.fragmento}`} className="pulso-avisos-etiqueta__item">
          <span>{p.mensaje} <q>{p.fragmento}</q></span>
          {p.sugerencia !== undefined && (
            <button type="button" className="pulso-ghost pulso-avisos-etiqueta__accion" onClick={() => onAplicar(p.sugerencia as string)}>
              Corregir
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
