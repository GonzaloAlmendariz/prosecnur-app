// Lo que la vista previa de Frecuencias dice bajo la hoja: cuántas tablas se
// ven de cuántas tiene el archivo (con el botón para ver más), las preguntas
// pedidas que no tienen tabla y por qué, la ponderación que no se aplicó, los
// avisos del motor y, con varias bases, de cuál es la vista previa.

import type { FrecuenciasPreview } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PieDeLaHoja, type LineaDelPie } from "./PieDeLaHoja";
import { avisosDelMotor, causaSinTabla, dicePorBase, ponderacionSinAplicar, siguienteLimite } from "./vistaPreviaModelo";

export function PieDeVistaPrevia({ preview, sinTabla, limite, onMostrarMas, releyendo = false }: {
  preview: FrecuenciasPreview;
  /** Las preguntas pedidas que no tienen tabla, de la hoja y de la pregunta elegida. */
  sinTabla: FrecuenciasPreview["sin_tabla"];
  limite: number;
  onMostrarMas?: () => void;
  /** Lo que se ve es de una lectura anterior. */
  releyendo?: boolean;
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
        texto: <>Vista previa de la base &quot;{preview.base.nombre}&quot;. Al generar sale un archivo por cada una de las {formatoConteo(preview.base.n_bases)} bases.</>,
      }]
      : []),
  ];
  const recorte = preview.recortado
    ? { devueltas: preview.devueltas, total: preview.total_variables, limite, siguiente: siguienteLimite(limite, preview.total_variables), onMostrarMas }
    : null;
  return <PieDeLaHoja recorte={recorte} lineas={lineas} />;
}
