/**
 * El aviso de un salto cuya pregunta filtro trae, en los casos marcados, un
 * código que no está en su lista (ítem 41). Va arriba de las pautas: antes de
 * corregir respuestas hay que mirar el formulario. El texto es el del motor
 * (`validacion_salto_filtro_fuera_lista.R`), con su cifra sobre los casos que
 * la regla marca.
 */
import { AlertTriangle } from "../../../vendor/lucide-react";
import type { FiltroFueraDeLista } from "./filtroFueraDeLista";

export function AvisoFiltroFueraDeLista({ filtros }: { filtros: readonly FiltroFueraDeLista[] }) {
  if (!filtros.length) return null;
  return (
    <div
      className="pulso-hz-filtro-fuera"
      role="note"
      data-qa-geometry-group="validacion/hallazgos-filtro-fuera"
      data-qa-geometry-contract="intrinsic"
    >
      <AlertTriangle size={14} aria-hidden="true" />
      <div>
        {filtros.map((f) => <p key={f.variable}>{f.texto}</p>)}
      </div>
    </div>
  );
}
