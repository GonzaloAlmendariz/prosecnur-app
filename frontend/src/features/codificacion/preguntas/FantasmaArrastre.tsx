import type { PreguntaAbierta } from "../../../api/codificacion";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { etiquetaCorta, tipoDeFicha } from "./modeloUnidades";

/** Lo que sigue al puntero mientras se arrastra una pregunta: su ficha, levantada. */
export function FantasmaArrastre({ pregunta }: { pregunta: PreguntaAbierta }) {
  const etiqueta = etiquetaCorta(pregunta.parent_label, 56);
  return (
    <div className="pulso-preg-fantasma">
      <FichaPregunta
        tipo={tipoDeFicha(pregunta.tipo)}
        codigo={etiqueta ? pregunta.parent : undefined}
        etiqueta={etiqueta || pregunta.parent}
      />
    </div>
  );
}
