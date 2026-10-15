// =============================================================================
// inspector/InspectorPrimitives.tsx — building blocks UI del inspector
// =============================================================================
// Componentes mínimos que reusamos en todas las tabs (Básico/Apariencia/Más/
// Lógica). Mantienen la mismas reglas visuales:
//   - InspectorField: par label + hint + control (rótulo asociado, ver abajo).
//   - InspectorBlock: agrupador con borde sutil y separación interna.
//   - InspectorEyebrow: cabecera tipo "small caps" con icono opcional.
//
// El monolito tenía `<Field>` y `<InspectorGroup>` similares pero con styles
// inline; aquí los movemos a clases del theme para que la jerarquía visual
// sea coherente con el resto del editor.
// =============================================================================

import { useId, type ReactNode } from "react";

/**
 * Lo que `InspectorField` entrega a su control para asociarlo al rótulo.
 *  - `id`: va en el `id` del input/textarea/select; el rótulo es un `<label
 *    htmlFor>` y el control toma de ahí su nombre accesible.
 *  - `labelId`: para controles que no son etiquetables con `htmlFor` (un
 *    `contentEditable` con `role="textbox"`): se pasa a `aria-labelledby`.
 *  - `hintId`: id de la ayuda, para `aria-describedby`; ausente si no hay.
 */
export type InspectorFieldControl = {
  id: string;
  labelId: string;
  hintId: string | undefined;
};

/**
 * Par rótulo + control + ayuda.
 *
 * Asociar el rótulo es opt-in y explícito: si `children` es una función, el
 * campo genera los ids y se los pasa; el rótulo pasa a ser un `<label
 * htmlFor>` y la ayuda queda enlazada por `aria-describedby`. Si `children`
 * es un nodo (un control compuesto: selector de tipo, chip de lista, lectura
 * con botón), el rótulo sigue siendo texto y nombra al grupo
 * (`role="group"` + `aria-labelledby`), porque no hay un único control al
 * que atarlo.
 */
export function InspectorField({
  label,
  hint,
  children,
}: {
  /** Texto del label. Acepta nodos para incrustar `<TechTerm />`. */
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode | ((control: InspectorFieldControl) => ReactNode);
}) {
  const baseId = useId();
  const control: InspectorFieldControl = {
    id: `${baseId}-control`,
    labelId: `${baseId}-label`,
    hintId: hint ? `${baseId}-hint` : undefined,
  };
  const bound = typeof children === "function";
  return (
    <div className="pulso-inspector-field">
      {bound ? (
        <label id={control.labelId} htmlFor={control.id} className="pulso-inspector-field-label">
          {label}
        </label>
      ) : (
        <span id={control.labelId} className="pulso-inspector-field-label">
          {label}
        </span>
      )}
      {bound ? (
        <div className="pulso-inspector-field-control">{children(control)}</div>
      ) : (
        <div
          className="pulso-inspector-field-control"
          role="group"
          aria-labelledby={control.labelId}
          aria-describedby={control.hintId}
        >
          {children}
        </div>
      )}
      {hint && (
        <span id={control.hintId} className="pulso-inspector-field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

// `intrinsic` y no `equal`: un bloque agrupa campos de la misma variante, pero
// el alto de cada uno lo fija su control —un editor de texto enriquecido no
// mide lo que un select o una casilla—. Declararlo aquí, en el primitivo,
// cubre todos los bloques del inspector de una sola vez.
export function InspectorBlock({ children }: { children: ReactNode }) {
  return (
    <div
      className="pulso-inspector-block"
      data-qa-geometry-group="xlsform/inspector-bloque"
      data-qa-geometry-contract="intrinsic"
    >
      {children}
    </div>
  );
}

export function InspectorEyebrow({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <header className="pulso-inspector-eyebrow">
      <div className="pulso-inspector-eyebrow-row">
        {icon && <span className="pulso-inspector-eyebrow-icon">{icon}</span>}
        <span className="pulso-inspector-eyebrow-title">{title}</span>
      </div>
      {hint && <p className="pulso-inspector-eyebrow-hint">{hint}</p>}
    </header>
  );
}
