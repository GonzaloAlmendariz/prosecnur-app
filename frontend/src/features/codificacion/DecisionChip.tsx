// ADR 0078 — el chip que distingue las cuatro situaciones que se veían iguales
// en la lista de preguntas. El motivo de «no se categoriza» va en el chip
// mismo, no en un tooltip: es la información que evita que la próxima persona
// lo confunda con un olvido, y esconderla detrás de un hover la pierde.

import type { CSSProperties } from "react";

import type { CodifDecision } from "../../api/codificacion";
import { presentarDecision, type DecisionTono } from "./decisionCodificacion";

const TONOS: Record<DecisionTono, { bg: string; border: string; fg: string }> = {
  abierto: {
    bg: "var(--pulso-warn-bg)",
    border: "var(--pulso-warn-border)",
    fg: "var(--pulso-warn-fg)",
  },
  cerrado: {
    bg: "var(--pulso-success-bg)",
    border: "var(--pulso-success-border)",
    fg: "var(--pulso-success-fg)",
  },
  neutro: {
    bg: "var(--pulso-surface-2)",
    border: "var(--pulso-border)",
    fg: "var(--pulso-text-soft)",
  },
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};

export default function DecisionChip({
  decision,
  motivo,
}: {
  decision: CodifDecision;
  motivo?: string;
}) {
  const meta = presentarDecision(decision);
  if (!meta) return null;
  const tono = TONOS[meta.tono];
  const razon = motivo?.trim();

  return (
    <span
      data-decision={decision}
      title={razon ? `${meta.detalle} Motivo: ${razon}` : meta.detalle}
      style={{
        ...chipStyle,
        background: tono.bg,
        border: `1px solid ${tono.border}`,
        color: tono.fg,
        maxWidth: "100%",
      }}
    >
      {meta.etiqueta}
      {razon && (
        <span
          style={{
            fontWeight: 600,
            opacity: 0.85,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 220,
          }}
        >
          · {razon}
        </span>
      )}
    </span>
  );
}
