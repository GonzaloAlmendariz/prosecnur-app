// Lo que la vista previa de Frecuencias dice bajo la tabla: las preguntas
// pedidas que no tienen tabla y por qué, la ponderación que no se aplicó, los
// avisos del motor y, con varias bases, de cuál es la vista previa.

import type { FrecuenciasPreview } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PieDeLaHoja, type LineaDelPie } from "./PieDeLaHoja";
import { avisosDelMotor, causaSinTabla, dicePorBase, ponderacionSinAplicar } from "./vistaPreviaModelo";

export function PieDeVistaPrevia({ preview, sinTabla, releyendo = false, etiquetaDeBase = (b) => b }: {
  preview: FrecuenciasPreview;
  /** Las preguntas pedidas que no tienen tabla. */
  sinTabla: FrecuenciasPreview["sin_tabla"];
  /** Lo que se ve es de una lectura anterior. */
  releyendo?: boolean;
  /** El nombre que ve el usuario de una base, por su identificador. */
  etiquetaDeBase?: (base: string) => string;
}) {
  const avisos = avisosDelMotor(preview);
  const lineas: LineaDelPie[] = [
    ...sinTabla.map((s) => ({ clave: `sin/${s.variable}`, alerta: true, texto: <><code className="tablas-codigo">{s.variable}</code> {causaSinTabla(s.motivo)}</> })),
    ...(ponderacionSinAplicar(preview)
      ? [{ clave: "pesos", alerta: true, texto: <>La ponderación está activada y no se aplicó: las tablas salen sin pesos. Revísala en Ponderación.</> }]
      : []),
    ...avisos.map((a, i) => ({ clave: `aviso/${i}`, alerta: true, texto: <>{a}</> })),
    ...(dicePorBase(preview, releyendo)
      ? [{
        clave: "bases",
        alerta: false,
        texto: <>Vista previa de la base &quot;{etiquetaDeBase(preview.base.nombre)}&quot;. Al generar sale un archivo por cada una de las {formatoConteo(preview.base.n_bases)} bases.</>,
      }]
      : []),
  ];
  return <PieDeLaHoja recorte={null} lineas={lineas} />;
}
