/**
 * Selector GLOBAL del método de «estudiantes por aula» (el divisor del cálculo
 * de aulas): una sola elección para todas las facultades. Al cambiarlo, la tabla
 * por facultad recalcula los CH necesarios en vivo (el método gobierna el
 * divisor). Cada opción trae su ayuda de una línea — nada de caja negra.
 */
import { HelpCircle } from "lucide-react";
import type { ResumenEstAula } from "../../dominio";
import { METODOS_EST_AULA, metodoEstAula } from "./estAulaMetodo";

export function MetodoEstAulaSelector({
  value,
  onChange,
}: {
  value: ResumenEstAula;
  onChange: (metodo: ResumenEstAula) => void;
}) {
  const activo = metodoEstAula(value);
  return (
    <div className="cmv2-ch-metodo">
      <div className="cmv2-ch-metodo-row">
        <span className="cmv2-ch-metodo-label">Estudiantes por aula</span>
        <div className="cmv2-segment" role="radiogroup" aria-label="Método de estudiantes por aula (divisor del cálculo de aulas)">
          {METODOS_EST_AULA.map((metodo) => (
            <button
              key={metodo.id}
              type="button"
              role="radio"
              aria-checked={value === metodo.id}
              data-active={value === metodo.id || undefined}
              title={metodo.ayuda}
              onClick={() => onChange(metodo.id)}
            >
              {metodo.label}
            </button>
          ))}
        </div>
      </div>
      <p className="cmv2-ch-metodo-ayuda">
        <HelpCircle size={13} aria-hidden="true" />
        <span><strong>{activo.label}:</strong> {activo.ayuda}</span>
      </p>
    </div>
  );
}
