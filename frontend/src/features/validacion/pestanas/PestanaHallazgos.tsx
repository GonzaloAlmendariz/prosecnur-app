/**
 * Pestaña Hallazgos de Validación (plan de fidelidad, rebanada V3; prototipo
 * `validacion-hallazgos*`): la mesa de tres columnas de `hallazgos/`, con la
 * cola, el hallazgo abierto según su tipo y la decisión con su efecto
 * previsto, más el caso completo en su panel (`panel=caso&foco=<id_caso>`).
 *
 * Reemplaza el montaje de transición de la rebanada V2 de P6, que apilaba la
 * auditoría del formulario (`instrumento/AuditoriaDelFormulario`), la banda y
 * la cola con el editor (`limpieza/CierreDeBase.StatusBar`,
 * `limpieza/ColaYDecision`) y los resultados (`instrumento/ResultadosDelFormulario`,
 * `instrumento/DetalleDeRegla`): esas funciones están en la cabecera, la cola,
 * la decisión y Reglas.
 *
 * Readiness: la marca de la pestaña va en la raíz; mientras la cola o los
 * casos del hallazgo se leen, la carga de bloque del kit (`CargaDeBloque`) la
 * retiene.
 */
import { PestanaHallazgosMesa } from "../hallazgos/PestanaHallazgosMesa";
import "../reglas/lista/lista.css";
import "../reglas/panel/panel.css";
import "../hallazgos/hallazgos.css";

export default function PestanaHallazgos() {
  return (
    <div className="pulso-validacion-pestana-hallazgos" data-audit-ready="validacion-hallazgos">
      <PestanaHallazgosMesa />
    </div>
  );
}
