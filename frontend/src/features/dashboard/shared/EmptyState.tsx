import type { ReactNode } from "react";

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "20px 16px",
        textAlign: "center",
        color: "var(--dash-texto-suave)",
        fontSize: 13,
        background: "var(--dash-superficie-2)",
        border: "1px dashed var(--dash-borde)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon && (
        <div style={{ color: "var(--dash-primario)", opacity: 0.7 }}>{icon}</div>
      )}
      <div style={{ fontWeight: 700, color: "var(--dash-primario)" }}>{title}</div>
      {subtitle && <div style={{ marginTop: 0 }}>{subtitle}</div>}
    </div>
  );
}
