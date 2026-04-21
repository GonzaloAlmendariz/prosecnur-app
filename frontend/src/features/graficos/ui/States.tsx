import { Loader2 } from "lucide-react";

// Componentes de estado compartidos entre los editores de Configuración
// global. Antes vivían inline en cada editor (PaletasEditor, IconosEditor,
// OverridesEditor, DefaultsModal) con copias divergentes — extraerlos acá
// unifica el look y facilita ajustes globales.

export function LoadingBlock({
  label = "Cargando…",
  minHeight = 260,
}: {
  label?: string;
  minHeight?: number;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, minHeight,
        fontSize: 12, color: "var(--pulso-text-soft)",
      }}
    >
      <Loader2
        size={16}
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
        fontSize: 12, color: "#991b1b",
        padding: "10px 14px", borderRadius: 6,
        background: "#fef2f2",
        border: "1px solid #fecaca",
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
