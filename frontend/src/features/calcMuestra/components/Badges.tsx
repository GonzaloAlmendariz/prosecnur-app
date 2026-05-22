import type { CalcMuestraNaturaleza, CalcMuestraNivelRespaldo } from "../../../api/client";

const NATURALEZA_META: Record<CalcMuestraNaturaleza, { label: string; color: string; bg: string; border: string }> = {
  prob: { label: "Probabilístico", color: "var(--pulso-info-fg)", bg: "var(--pulso-info-bg)", border: "var(--pulso-info-border)" },
  operativo: { label: "Operativo", color: "var(--pulso-success-fg)", bg: "var(--pulso-success-bg)", border: "var(--pulso-success-border)" },
  no_prob: { label: "No probabilístico", color: "var(--pulso-warn-fg)", bg: "var(--pulso-warn-bg)", border: "var(--pulso-warn-border)" },
};

const RESPALDO_META: Record<CalcMuestraNivelRespaldo, { label: string; color: string; bg: string }> = {
  representatividad_estadistica: { label: "Repres. estadística", color: "var(--pulso-info-fg)", bg: "var(--pulso-info-bg)" },
  representatividad_operacional: { label: "Repres. operacional", color: "var(--pulso-success-fg)", bg: "var(--pulso-success-bg)" },
  representatividad_teorica_controlada: { label: "Repres. teórica/controlada", color: "var(--pulso-role-target-fg)", bg: "var(--pulso-role-target-bg)" },
  cobertura_balanceada: { label: "Cobertura balanceada", color: "var(--pulso-primary)", bg: "var(--pulso-primary-soft)" },
  evidencia_descriptiva: { label: "Evidencia descriptiva", color: "var(--pulso-warn-fg)", bg: "var(--pulso-warn-bg)" },
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid transparent",
};

export function NaturalezaBadge({ naturaleza }: { naturaleza: CalcMuestraNaturaleza }) {
  const meta = NATURALEZA_META[naturaleza];
  return (
    <span style={{ ...badgeBase, color: meta.color, background: meta.bg, borderColor: meta.border }}>
      {meta.label}
    </span>
  );
}

export function NivelRespaldoBadge({ nivel }: { nivel: CalcMuestraNivelRespaldo }) {
  const meta = RESPALDO_META[nivel];
  return (
    <span style={{ ...badgeBase, color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

export function PermiteMargenBadge({ permite }: { permite: boolean }) {
  return (
    <span
      style={{
        ...badgeBase,
        color: permite ? "var(--pulso-info-fg)" : "var(--pulso-warn-fg)",
        background: permite ? "var(--pulso-info-bg)" : "var(--pulso-warn-bg)",
      }}
    >
      {permite ? "✓ Permite margen de error" : "✗ No permite margen formal"}
    </span>
  );
}
