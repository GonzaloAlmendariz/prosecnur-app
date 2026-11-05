// El criterio con que el motor propone los hallazgos del resumen ejecutivo, dicho arriba de la propuesta (H14 del checklist
// de usabilidad del editor). Con preguntas clave marcadas, una línea; sin ninguna, el criterio de respaldo y un enlace a
// la tarjeta del primer gráfico del informe que cuenta para la propuesta, que es donde se marcan. El enlace sólo cambia el `foco` (lámina y ranura):
// la sección Gráficos y el inspector abiertos los pone el workbench (LaminasWorkbench.tsx).

import { Link, useLocation } from "react-router-dom";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { focoDeId } from "../../focoLamina";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { leerPreguntasClave, motivoNoCuenta, primerGraficoConPregunta } from "../preguntasClave/modeloPreguntasClave";
import { leerTwoBox } from "../tarjetaGrafico/twoBox";
import { CRITERIO_CON_CLAVES, CRITERIO_SIN_CLAVES } from "./modeloPropuesta";

export function CriterioPropuesta() {
  const location = useLocation();
  const guardadas = usePlanStore((s) => s.plan.preguntas_clave);
  const slides = usePlanStore((s) => s.plan.slides);
  const presets = usePlanStore((s) => s.presets) as Record<string, Record<string, unknown>>;
  const n = leerPreguntasClave({ preguntas_clave: guardadas }).length;
  if (n > 0) {
    return (
      <p className="pulso-f6-propuesta-criterio" data-qa-geometry-member>
        {CRITERIO_CON_CLAVES}
        <span className="pulso-f6-propuesta-criterio-n">
          {n === 1 ? "1 pregunta clave marcada" : `${formatoConteo(n)} preguntas clave marcadas`}
        </span>
      </p>
    );
  }
  // El enlace lleva a un gráfico que cuenta para la propuesta (el mismo criterio que la tarjeta).
  const destino = primerGraficoConPregunta(slides, SLIDE_GRAF_SLOTS, (tipoLamina, graficador, args) => !motivoNoCuenta({
    tipoLamina, graficador, args, conTwoBox: (leerTwoBox(graficador, args, presets)?.top.etiquetas.length ?? 0) > 0,
  }));
  return (
    <div className="pulso-f6-propuesta-sin-claves" role="note" data-qa="propuesta-sin-claves" data-qa-geometry-member>
      <p className="pulso-f6-propuesta-criterio">{CRITERIO_SIN_CLAVES}</p>
      {destino ? (
        <Link className="pulso-f6-propuesta-enlace" replace
          to={{ pathname: location.pathname, search: conNivel(location.search, "foco", focoDeId(destino.id, destino.ranura)) }}>
          Marca tus preguntas clave para que la propuesta se base en ellas
        </Link>
      ) : (
        <span className="pulso-f6-propuesta-criterio">Marca tus preguntas clave para que la propuesta se base en ellas.</span>
      )}
      <span className="pulso-f6-dato-ayuda">Se marcan en la tarjeta de cada gráfico, en Datos.</span>
    </div>
  );
}
