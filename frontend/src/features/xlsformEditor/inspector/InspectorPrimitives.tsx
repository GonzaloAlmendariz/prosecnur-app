// =============================================================================
// inspector/InspectorPrimitives.tsx — building blocks UI del inspector
// =============================================================================
// Componentes mínimos que reusamos en todas las tabs (Básico/Apariencia/Más/
// Lógica). Mantienen la mismas reglas visuales:
//   - InspectorField: par label + hint + control.
//   - InspectorBlock: agrupador con borde sutil y separación interna.
//   - InspectorEyebrow: cabecera tipo "small caps" con icono opcional.
//
// El monolito tenía `<Field>` y `<InspectorGroup>` similares pero con styles
// inline; aquí los movemos a clases del theme para que la jerarquía visual
// sea coherente con el resto del editor.
// =============================================================================

import type { ReactNode } from "react";

export function InspectorField({
  label,
  hint,
  children,
}: {
  /** Texto del label. Acepta nodos para incrustar `<TechTerm />`. */
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pulso-inspector-field">
      <span className="pulso-inspector-field-label">{label}</span>
      <div className="pulso-inspector-field-control">{children}</div>
      {hint && <span className="pulso-inspector-field-hint">{hint}</span>}
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
