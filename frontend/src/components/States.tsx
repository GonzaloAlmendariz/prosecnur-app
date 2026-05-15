import { Loader2 } from "lucide-react";

// Componentes de estado compartidos entre los editores de Configuración
// global. Antes vivían inline en cada editor (PaletasEditor, IconosEditor,
// OverridesEditor, DefaultsModal) con copias divergentes — extraerlos acá
// unifica el look y facilita ajustes globales.

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
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, minHeight: effectiveMinHeight,
        fontSize: 12, color: "var(--pulso-text-soft)",
      }}
    >
      <Loader2
        size={variant === "inline" ? 14 : 16}
        color="var(--pulso-primary)"
        className="pulso-spin"
      />
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
    <div
      role="alert"
      style={{
        fontSize: 12, color: "var(--pulso-danger-fg)",
        padding: "10px 14px", borderRadius: 6,
        background: "var(--pulso-danger-bg)",
        border: "1px solid var(--pulso-danger-border)",
        display: "flex", flexDirection: "column", gap: 3,
      }}
    >
      <strong>{label ?? "Error"}</strong>
      {detail && <span style={{ fontWeight: 400 }}>{detail}</span>}
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
  const isInline = variant === "inline";
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        gap: isInline ? 6 : 8,
        padding: isInline ? "18px 14px" : "40px 20px",
        minHeight: isInline ? 140 : 240,
        color: "var(--pulso-text-soft)",
        border: isInline ? "1px dashed var(--pulso-border)" : "none",
        borderRadius: isInline ? 8 : 0,
        background: isInline ? "var(--pulso-surface)" : "transparent",
      }}
    >
      <span
        style={{
          width: isInline ? 34 : 42,
          height: isInline ? 34 : 42,
          borderRadius: isInline ? 8 : 10,
          background: "white",
          color: "var(--pulso-text-soft)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--pulso-border)",
        }}
      >
        {icon}
      </span>
      <h4 style={{ margin: 0, fontSize: 13, color: "var(--pulso-text)" }}>{title}</h4>
      {hint && (
        <p style={{
          margin: 0, fontSize: 11, lineHeight: 1.5,
          maxWidth: isInline ? 200 : 320,
        }}>
          {hint}
        </p>
      )}
      {cta && <div style={{ marginTop: 4 }}>{cta}</div>}
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
