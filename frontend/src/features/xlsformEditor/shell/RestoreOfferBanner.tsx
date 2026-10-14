// =============================================================================
// shell/RestoreOfferBanner.tsx — «Continuar formulario guardado»
// =============================================================================
// Extraído de XlsformEditorPage (2026-10-14) para que la página no crezca.
// =============================================================================

import { Trash2 } from "../../../vendor/lucide-react";
import { IconForward, IconHint } from "../../../lib/icons";
import { formatRelativeTime } from "./editorMetrics";

/**
 * Banner que aparece cuando al montar detectamos un snapshot persistido en
 * localStorage o backend. Le ofrece al usuario
 * restaurar lo que estaba editando vs descartarlo.
 */
export function RestoreOfferBanner({
  snapshot,
  onAccept,
  onDismiss,
}: {
  snapshot: { savedAt: number; sourceName: string | null };
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Restaurar formulario anterior"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 12,
        background: "color-mix(in srgb, var(--pulso-info-bg) 82%, #ffffff 18%)",
        border: "1px solid color-mix(in srgb, var(--pulso-info-border) 72%, var(--pulso-border))",
        color: "var(--pulso-text)",
        flexWrap: "wrap",
        boxShadow: "var(--xls-shadow-hairline, 0 1px 2px rgba(15, 23, 42, 0.06))",
      }}
    >
      <button
        type="button"
        onClick={onAccept}
        style={{
          flex: "1 1 420px",
          minWidth: 280,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          border: "1px solid transparent",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.72)",
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            borderRadius: 9,
            background: "color-mix(in srgb, var(--pulso-info-fg) 10%, #ffffff)",
            color: "var(--pulso-info-fg)",
          }}
        >
          <IconHint size={16} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>
            Continuar formulario guardado
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            {/* Defensivo: en localStorage viejo `sourceName` puede haber
                quedado como objeto en algún caso edge. Solo lo mostramos
                si es string no vacío. */}
            {typeof snapshot.sourceName === "string" && snapshot.sourceName
              ? `Archivo: ${snapshot.sourceName} · `
              : ""}
            Guardado automáticamente {formatRelativeTime(snapshot.savedAt)}.
          </span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--pulso-info-fg)",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Entrar <IconForward size={14} />
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 36,
          padding: "8px 10px",
          border: "1px solid var(--pulso-border)",
          borderRadius: 9,
          background: "#ffffff",
          color: "var(--pulso-text-soft)",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <Trash2 size={14} /> Descartar guardado
      </button>
    </div>
  );
}
