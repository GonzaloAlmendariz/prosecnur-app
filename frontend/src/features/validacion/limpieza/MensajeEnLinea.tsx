/** Aviso en línea y estado de una decisión del historial. Salieron de `tabs/LimpiezaTab.tsx`. */
import type { ReactNode } from "react";
import type { LimpiezaDecision } from "../types";
import { EstadoChip } from "../../../components/EstadoChip";

export function InlineMessage({
  tone,
  icon,
  text,
  accion,
}: {
  tone: "success" | "warn" | "danger";
  icon: ReactNode;
  text: string;
  /** Un control que resuelve el aviso (p. ej. ir a la pestaña donde se hace). */
  accion?: ReactNode;
}) {
  const colors =
    tone === "success"
      ? { bg: "var(--pulso-success-bg)", border: "var(--pulso-success-border)", fg: "var(--pulso-success-fg)" }
      : tone === "danger"
        ? { bg: "var(--pulso-danger-bg)", border: "var(--pulso-danger-border)", fg: "var(--pulso-danger-fg)" }
        : { bg: "var(--pulso-warn-bg)", border: "var(--pulso-warn-border)", fg: "var(--pulso-warn-fg)" };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.fg,
        fontSize: "var(--pulso-type-body-size)",
        lineHeight: 1.5,
      }}
    >
      <span style={{ marginTop: 1 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
      {accion}
    </div>
  );
}

export function StatusBadge({
  status,
  text,
}: {
  status: LimpiezaDecision["status"] | "pending" | "ready";
  text?: string;
}) {
  const ready = status === "ready";
  return <EstadoChip tone={ready ? "success" : "warn"} label={text ?? (ready ? "Lista" : "Pendiente")} />;
}
