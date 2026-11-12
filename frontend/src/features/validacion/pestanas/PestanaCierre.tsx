/**
 * Pestaña Cierre de Validación (plan de fidelidad, rebanada V4; prototipo
 * `validacion-cierre`): la mesa de `cierre/`, con la cadena de los casos
 * recibidos a los que cuentan, las decisiones aplicadas por grupo, qué base
 * rige para el análisis y los archivos del cierre con su estado (motor M5).
 *
 * Reemplaza el montaje de transición de la rebanada V2 de P6, que apilaba la
 * banda "Cerrar y generar base" (`limpieza/CierreDeBase.tsx`), los avisos
 * (`limpieza/AvisosDeLimpieza.tsx`), el efecto de las decisiones
 * (`components/ImpactoDecisiones.tsx`), la promoción
 * (`components/PromocionBase.tsx`) y el paquete metodológico
 * (`limpieza/PaqueteMetodologico.tsx`): esas funciones están en la cabecera,
 * la franja, "Lista para análisis" y "Archivos".
 *
 * Readiness: la marca de la pestaña va en la raíz; mientras se lee el cierre,
 * la carga de bloque del kit (`CargaDeBloque`) la retiene.
 */
import { PestanaCierreMesa } from "../cierre/PestanaCierreMesa";
import "../cierre/cierre.css";

export default function PestanaCierre() {
  return (
    <div className="pulso-validacion-pestana-cierre" data-audit-ready="validacion-cierre">
      <PestanaCierreMesa />
    </div>
  );
}
