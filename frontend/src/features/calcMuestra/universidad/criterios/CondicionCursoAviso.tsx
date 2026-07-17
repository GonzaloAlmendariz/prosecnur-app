/**
 * Aviso de calidad de la condición del curso: línea de cobertura que aparece
 * en la tarjeta condicion_curso cuando el bucket "Sin condición" domina
 * (≥ 30% de los CH). Solo informa y orienta — la decisión sigue siendo del
 * usuario (nada se auto-decide). El cálculo vive en condicionCursoAvisoModel;
 * la voz visual es el aviso unificado del módulo (QA H7).
 */
import type { CriterioVariable } from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { condicionCursoCobertura } from "./condicionCursoAvisoModel";

export function CondicionCursoAviso({ variable }: { variable: CriterioVariable }) {
  const cobertura = condicionCursoCobertura(variable);
  if (!cobertura) return null;
  const pct = Math.round(cobertura.share * 100);
  return (
    <AvisoModulo
      tone="info"
      role="note"
      title={`${fmtInt(cobertura.sinDato)} de ${fmtInt(cobertura.total)} cursos-horario (${pct}%) sin dato de condición.`}
    >
      Esta columna es referencial (reunión del diseño muestral): úsala para orientar, no como corte
      duro; puedes completarla mapeando la columna de condición de la hoja de matrícula en Variables.
    </AvisoModulo>
  );
}
