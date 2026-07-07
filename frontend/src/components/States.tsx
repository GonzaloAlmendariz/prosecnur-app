import { AlertTriangle } from "lucide-react";

import "./states.css";

// Componentes de estado compartidos entre los editores de Configuración
// global. Antes vivían inline en cada editor (PaletasEditor, IconosEditor,
// OverridesEditor, DefaultsModal) con copias divergentes — extraerlos acá
// unifica el look y facilita ajustes globales.
//
// Estilos en states.css. Los min-height de LoadingBlock siguen inline
// porque son prop (minHeight) con default por variante.

export function LoadingBlock({
  label = "Cargando…",
  minHeight,
  variant = "panel",
}: {
  label?: string;
  minHeight?: number;
  // "panel" — centrado, generoso (260px) para cargas de sección completa.
  // "inline" — altura mínima (60px) para cargas dentro de un pane
  //   que ya tiene otros elementos visibles.
  variant?: "panel" | "inline";
}) {
  const effectiveMinHeight = minHeight ?? (variant === "inline" ? 60 : 260);
  return (
    <div
      role="status"
      className={`pulso-loading-block pulso-loading-block--${variant}`}
      style={{ minHeight: effectiveMinHeight }}
    >
      <span className="pulso-states-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({
  label,
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div role="alert" className="pulso-error-block">
      <span className="pulso-error-block-icon" aria-hidden="true">
        <AlertTriangle size={14} />
      </span>
      <span className="pulso-error-block-copy">
        <strong>{label ?? "Error"}</strong>
        {detail && <span className="pulso-error-block-detail">{detail}</span>}
      </span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  cta,
  variant = "panel",
}: {
  icon: JSX.Element;
  title: string;
  hint?: string;
  cta?: JSX.Element;
  // "panel" — grande, para secciones principales
  // "inline" — compacto, para columnas o sidebars
  variant?: "panel" | "inline";
}) {
  return (
    <div className={`pulso-empty-state pulso-empty-state--${variant}`}>
      <span className="pulso-empty-state-icon">{icon}</span>
      <h4 className="pulso-empty-state-title">{title}</h4>
      {hint && <p className="pulso-empty-state-hint">{hint}</p>}
      {cta && <div className="pulso-empty-state-cta">{cta}</div>}
    </div>
  );
}

// Header tipo "eyebrow" con label uppercase + hint opcional. Usado
// arriba de la sidebar / columnas para contextualizar el contenido.
export function SectionEyebrow({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.5,
          color: "var(--pulso-text-soft)",
        }}
      >
        {label}
      </span>
      {hint && (
        <p style={{
          margin: 0, fontSize: 11, lineHeight: 1.5,
          color: "var(--pulso-text-soft)",
        }}>
          {hint}
        </p>
      )}
    </div>
  );
}
