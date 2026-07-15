/**
 * Control compacto "Orden de jerarquía" del criterio de tipo de docente (ADR
 * 0035). El académico ordena las categorías canónicas de teacher_type de mayor a
 * menor rango; el motor cataloga cada curso-horario por su docente de mayor
 * jerarquía (`teacher_type_top`). NO toca la inclusión: para que un curso-horario
 * entre basta con que UN docente sea de un tipo aceptado. Presentacional: recibe
 * la variable del catálogo y el orden guardado, emite el nuevo orden de claves.
 */
import { useMemo } from "react";
import { ChevronDown, ChevronUp, ListOrdered } from "../../../../vendor/lucide-react";
import type { CriterioVariable } from "../../../../api/client";
import {
  moverTeacherTypeOrden,
  teacherTypeCategoriasCatalogo,
  teacherTypeOrdenDisplay,
} from "./teacherTypeOrdenModel";

export function TeacherTypeOrden({
  variable,
  orden,
  onOrden,
}: {
  variable: CriterioVariable;
  /** Orden guardado (claves canónicas, ALTO→BAJO); vacío ⇒ orden del catálogo. */
  orden: string[] | undefined;
  /** Persiste el nuevo orden completo de claves. */
  onOrden: (keys: string[]) => void;
}) {
  const catalogo = useMemo(() => teacherTypeCategoriasCatalogo(variable), [variable]);
  const display = useMemo(() => teacherTypeOrdenDisplay(catalogo, orden), [catalogo, orden]);

  if (catalogo.length <= 1) return null;

  const keys = display.map((c) => c.key);
  const mover = (index: number, dir: -1 | 1) => {
    const next = moverTeacherTypeOrden(keys, index, dir);
    if (next !== keys) onOrden(next);
  };

  return (
    <section className="cmv2-crit-ttorden" aria-label="Orden de jerarquía de tipos de docente">
      <header className="cmv2-crit-ttorden-head">
        <ListOrdered size={14} aria-hidden="true" />
        <strong>Orden de jerarquía</strong>
      </header>
      <p className="cmv2-crit-ttorden-hint">
        El curso-horario se cataloga con su docente de mayor jerarquía; ordena los tipos de mayor a menor. Para incluir el
        curso-horario basta con que UN docente sea de un tipo aceptado (no se descarta por tener jefes de práctica).
      </p>
      <ol className="cmv2-crit-ttorden-list">
        {display.map((cat, index) => {
          const first = index === 0;
          const last = index === display.length - 1;
          return (
            <li key={cat.key} className="cmv2-crit-ttorden-item">
              <span className="cmv2-crit-ttorden-rank" aria-hidden="true">
                {index + 1}
              </span>
              <span className="cmv2-crit-ttorden-label">
                {cat.label}
                {cat.group && cat.group !== cat.label ? (
                  <span className="cmv2-crit-ttorden-group">{cat.group}</span>
                ) : null}
              </span>
              <span className="cmv2-crit-ttorden-moves">
                <button
                  type="button"
                  className="cmv2-crit-ttorden-move"
                  disabled={first}
                  aria-label={`Subir ${cat.label}`}
                  onClick={() => mover(index, -1)}
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="cmv2-crit-ttorden-move"
                  disabled={last}
                  aria-label={`Bajar ${cat.label}`}
                  onClick={() => mover(index, 1)}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
