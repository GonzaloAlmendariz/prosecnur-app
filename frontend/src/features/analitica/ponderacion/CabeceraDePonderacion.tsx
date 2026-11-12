// La cabecera de Ponderación (prototipo, `tabHeading` de Analítica ›
// Ponderación): antetítulo "Analítica", título, estado, las cifras de lo
// declarado y, como acción principal, el interruptor que pone los pesos en las
// tablas. Es la cabecera común del kit; aquí solo se le da su contenido.

import type { PonderPreview } from "../../../api/analitica";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import { InterruptorOpcion } from "../InterruptorOpcion";
import type { PonderacionConfig } from "../store";
import { CIFRAS_PENDIENTES_DE_LA_CABECERA, cifrasDeLaCabecera, estadoDePonderacion } from "./estadoYCifrasDeCabecera";
import type { LecturaDelEfecto } from "./calculoDePonderacion";

export function CabeceraDePonderacion({ pond, lectura, preview, onAlternar }: {
  pond: PonderacionConfig;
  lectura: LecturaDelEfecto;
  preview: PonderPreview | null;
  onAlternar: () => void;
}) {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === "ponderacion") ?? PROCESAMIENTO_PESTANAS.analitica[0];
  return (
    <CabeceraDePestana
      seccion="Analítica"
      titulo={meta.label}
      icono={meta.icon}
      estado={estadoDePonderacion(pond, lectura)}
      cifras={cifrasDeLaCabecera(pond, preview)}
      ariaCifras="Cifras de la ponderación"
      cifrasPendientes={CIFRAS_PENDIENTES_DE_LA_CABECERA}
      className="pond-cabecera"
      acciones={(
        <InterruptorOpcion
          variante="linea"
          className="pond-usar-pesos"
          checked={pond.enabled}
          onToggle={onAlternar}
          titulo="Usar pesos en frecuencias, cruces y dimensiones"
          title="Queda declarado en la ficha técnica."
        />
      )}
    />
  );
}
