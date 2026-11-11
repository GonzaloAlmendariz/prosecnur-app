/** Estilos en línea que comparten las piezas de la mesa de limpieza (salieron de `tabs/LimpiezaTab.tsx`). */
import type { CSSProperties } from "react";

// =============================================================================
// Estilos compartidos
// =============================================================================
export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: "var(--pulso-type-body-size)",
  outline: "none",
};

export const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "9px 12px",
  borderRadius: 10,
  fontSize: "var(--pulso-type-subtitle-size)",
  fontWeight: 700,
  cursor: "pointer",
};

export const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
  fontSize: "var(--pulso-type-subtitle-size)",
  fontWeight: 700,
  cursor: "pointer",
};

export const dangerButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid var(--pulso-danger-border)",
  background: "var(--pulso-danger-bg)",
  color: "var(--pulso-danger-fg)",
  fontSize: "var(--pulso-type-subtitle-size)",
  fontWeight: 700,
  cursor: "pointer",
};

export const tableHeadCell: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "var(--pulso-type-caption-size)",
  fontWeight: 800,
  color: "var(--pulso-text-soft)",
  whiteSpace: "nowrap",
};

export const tableCell: CSSProperties = {
  padding: "8px 10px",
  fontSize: "var(--pulso-type-body-size)",
  color: "var(--pulso-text)",
  verticalAlign: "top",
};

export const summaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  background: "var(--pulso-surface-2)",
  border: "1px solid var(--pulso-border)",
  fontSize: "var(--pulso-type-caption-size)",
  fontWeight: 700,
  color: "var(--pulso-text)",
  cursor: "pointer",
  listStyle: "none",
};
