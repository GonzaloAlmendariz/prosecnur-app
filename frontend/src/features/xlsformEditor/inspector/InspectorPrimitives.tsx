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
  label: string;
  hint?: string;
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

export function InspectorBlock({ children }: { children: ReactNode }) {
  return <div className="pulso-inspector-block">{children}</div>;
}

export function InspectorEyebrow({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
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
