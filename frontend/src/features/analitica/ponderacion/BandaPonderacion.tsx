// Banda de la pestaña: las variables de ajuste con metas, la suma de pesos y
// el interruptor que enciende la ponderación. Las cifras del
// resultado viven en el panel "Efecto de ponderar" y aquí no se repiten.

import type { PonderPreview } from "../../../api/analitica";
import { CifrasPestana } from "../CifrasPestana";
import { InterruptorOpcion } from "../InterruptorOpcion";
import type { PonderacionConfig } from "../store";
import { cifrasDeLaBanda } from "./cifrasDePonderacion";

export function BandaPonderacion({ pond, preview, onAlternar }: {
  pond: PonderacionConfig;
  preview: PonderPreview | null;
  onAlternar: () => void;
}) {
  return (
    <div className="pond-banda">
      <CifrasPestana ariaLabel="Cifras de la ponderación" cifras={cifrasDeLaBanda(pond, preview)} />
      <InterruptorOpcion
        variante="linea"
        className="pond-banda-interruptor"
        checked={pond.enabled}
        onToggle={onAlternar}
        titulo="Usar pesos en frecuencias, cruces y dimensiones"
        descripcion="Queda declarado en la ficha técnica."
      />
    </div>
  );
}
