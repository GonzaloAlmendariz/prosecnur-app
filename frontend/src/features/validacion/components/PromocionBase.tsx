// =============================================================================
// PromocionBase — qué base del estudio rige después de cerrar la limpieza
// =============================================================================
// ADR 0076: la base depurada se promueve, no se recomienda. El motor cambia la
// base que consumen Codificación, Analítica y los entregables; esta superficie
// declara ese hecho y ofrece volver atrás.
//
// Cuatro estados, un mismo marco (C2):
//   · rige         — la promoción está activa: N antes → N después, y se revierte.
//   · sin respaldo — rige, pero el plan y las decisiones que la justifican ya no
//                    están: recargar el instrumento vacía el workspace de
//                    validación y deja la base depurada en pie. Se avisa fuerte
//                    (ADR 0077) porque el daño sigue produciéndose — cada
//                    entregable sale con los casos excluidos y sin poder
//                    justificarlos.
//   · bloqueada    — el motor no pudo promover (hoy: bases con grupos repetibles).
//                    Sin esto el analista creería que su exclusión rigió.
//   · revertida    — se volvió a la base anterior; las decisiones siguen ahí.
//
// Sin linaje no hay superficie: el componente devuelve null (todavía no hay
// nada que declarar, no es un vacío que esta tarjeta deba contener).
// =============================================================================

import type { CSSProperties } from "react";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Undo2 } from "lucide-react";

import type { LimpiezaPromocion } from "../types";

export type PromocionBaseProps = {
  promocion?: LimpiezaPromocion | null;
  busy?: boolean;
  onRevertir: () => void;
};

type Tone = "success" | "warn" | "danger" | "neutral";

const TONES: Record<Tone, { bg: string; border: string; fg: string }> = {
  success: {
    bg: "var(--pulso-success-bg)",
    border: "var(--pulso-success-border)",
    fg: "var(--pulso-success-fg)",
  },
  warn: {
    bg: "var(--pulso-warn-bg)",
    border: "var(--pulso-warn-border)",
    fg: "var(--pulso-warn-fg)",
  },
  // `sin respaldo` no puede compartir el ámbar de `bloqueada`: la pestaña ya
  // muestra el aviso rutinario de "corre la auditoría" en ese tono, y dos
  // bandas ámbar pegadas se leen como una sola. Además la gravedad es otra —
  // bloqueada dice "tu exclusión no rigió", sin respaldo dice "está rigiendo y
  // no puedes justificarla".
  danger: {
    bg: "var(--pulso-danger-bg)",
    border: "var(--pulso-danger-border)",
    fg: "var(--pulso-danger-fg)",
  },
  neutral: {
    bg: "var(--pulso-surface-2)",
    border: "var(--pulso-border)",
    fg: "var(--pulso-text-soft)",
  },
};

export default function PromocionBase({ promocion, busy = false, onRevertir }: PromocionBaseProps) {
  const [confirming, setConfirming] = useState(false);

  if (!promocion) return null;

  const bloqueo = typeof promocion.bloqueo === "string" ? promocion.bloqueo.trim() : "";
  const rige = !!promocion.enabled && !bloqueo;
  const sinRespaldo = rige && promocion.sin_respaldo === true;
  const antes = asCount(promocion.n_casos_antes);
  const despues = asCount(promocion.n_casos_despues);

  const tone: Tone = sinRespaldo ? "danger" : bloqueo ? "warn" : rige ? "success" : "neutral";
  const colors = TONES[tone];

  const estado = bloqueo ? "bloqueada" : sinRespaldo ? "sin-respaldo" : rige ? "rige" : "revertida";

  const titulo = bloqueo
    ? "La depuración no llegó a la base del estudio"
    : sinRespaldo
      ? "La base depurada rige, pero ya no puede explicarse"
      : rige
        ? "La base del estudio quedó depurada"
        : "Volviste a la base anterior";

  return (
    <section
      data-testid="limpieza-promocion"
      data-estado={estado}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        padding: "12px 16px",
        borderRadius: "var(--pulso-radius-panel)",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0, flex: "1 1 320px" }}>
        <span style={{ color: colors.fg, display: "flex", paddingTop: 2 }}>
          {bloqueo || sinRespaldo ? (
            <AlertTriangle size={16} />
          ) : rige ? (
            <CheckCircle2 size={16} />
          ) : (
            <Undo2 size={16} />
          )}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pulso-text)" }}>{titulo}</div>
          <div style={{ fontSize: 12, color: "var(--pulso-text)", lineHeight: 1.45 }}>
            {sinRespaldo ? (
              <>
                Pasó de <Cifra n={antes} /> a <Cifra n={despues} /> casos y los entregables usan esta base,
                pero el plan y las decisiones que lo justifican se borraron al recargar el instrumento. Sin
                ellos no sale el informe metodológico ni el Excel de decisiones: vuelve a construir el plan,
                o revierte a <Cifra n={antes} /> casos.
              </>
            ) : rige ? (
              <>
                Pasó de <Cifra n={antes} /> a <Cifra n={despues} /> casos
                {promocion.applied_at ? ` el ${formatDateTime(promocion.applied_at)}` : ""}. Codificación,
                Analítica y los entregables ya usan esta base.
              </>
            ) : bloqueo ? (
              <>
                {bloqueo} La base del estudio sigue con <Cifra n={antes} /> casos: lo que excluiste está
                registrado, pero no llegó a Codificación ni a los entregables.
              </>
            ) : (
              <>
                La base del estudio tiene <Cifra n={antes} /> casos
                {promocion.reverted_at ? ` desde el ${formatDateTime(promocion.reverted_at)}` : ""}. Tus
                decisiones siguen guardadas: vuelve a cerrar la base para que rijan.
              </>
            )}
          </div>
        </div>
      </div>

      {rige && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", maxWidth: 300, lineHeight: 1.35 }}>
                Vuelve a {formatCount(antes)} casos y obliga a rehacer codificación y analítica.
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onRevertir();
                }}
                disabled={busy}
                style={dangerButtonStyle}
              >
                {busy ? <Loader2 size={13} className="pulso-spin" /> : <RotateCcw size={13} />}
                Revertir
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={ghostButtonStyle}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={busy} style={ghostButtonStyle}>
              {busy ? <Loader2 size={13} className="pulso-spin" /> : <RotateCcw size={13} />}
              Revertir
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Cifra({ n }: { n: number | null }) {
  return <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(n)}</strong>;
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCount(value: number | null): string {
  return value === null ? "—" : String(value);
}

// `hourCycle: h23` a propósito: el formato de 12 h de es-PE termina en "p. m."
// y la frase que lo contiene cierra con punto, así que quedaría "12:35 p. m..".
const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostButtonStyle: CSSProperties = {
  ...buttonBase,
  border: "1px solid var(--pulso-border)",
  background: "var(--pulso-surface)",
  color: "var(--pulso-text)",
};

const dangerButtonStyle: CSSProperties = {
  ...buttonBase,
  border: "1px solid var(--pulso-danger-border)",
  background: "var(--pulso-danger-bg)",
  color: "var(--pulso-danger-fg)",
};
