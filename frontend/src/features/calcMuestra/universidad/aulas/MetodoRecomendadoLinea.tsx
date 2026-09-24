import type { ClassroomLabModel } from "./classroomLabModel";
import { classroomMethodLabel } from "./classroomLabels";

/**
 * «Recomendado: X». En Selección y Reemplazos es el único sitio que nombra el
 * método vigente (en Método y Simulación ya lo dice la tarjeta de
 * recomendación). Pieza propia para que mover o quitar una barra de comandos
 * no se la lleve de paso — pasó en E15 AD8 al integrar «Probar reemplazos».
 */
export function MetodoRecomendadoLinea({ model }: { model: ClassroomLabModel }) {
  if (!model.comparison?.recommendation) return null;
  return (
    <span className="cmv2-classroom-recommendation">
      Recomendado: <strong>{classroomMethodLabel(model.recommendedMethodId) || model.comparison.recommendation.method_label}</strong>
    </span>
  );
}
