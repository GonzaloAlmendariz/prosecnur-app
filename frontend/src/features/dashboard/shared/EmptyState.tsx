export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
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
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--dash-primario)" }}>{title}</div>
      {subtitle && <div style={{ marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
