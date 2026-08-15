// ADR 0078, punto 2 — «no categorizar» es una decisión de primera clase.
//
// Al revisar ACNUR V3 decidimos no categorizar `NowSalary` (16 respuestas) ni
// `PastSalary` (4) por n insuficiente. Es una decisión metodológica correcta y
// no tenía dónde vivir: la única salida era desmarcarlas, que borra la
// intención y con ella el rastro de que alguien lo evaluó.
//
// El motivo es obligatorio a propósito. Una decisión sin porqué no se
// distingue de un olvido, que es justo lo que este ADR vino a arreglar.

import { useState } from "react";

import { Loader2, Undo2 } from "lucide-react";

import type { CodifDecision } from "../../api/codificacion";

export type NoCategorizarActionProps = {
  parent: string;
  decision: CodifDecision;
  motivo?: string;
  busy?: boolean;
  onRegistrar: (motivo: string) => void;
  onRevertir: () => void;
};

export default function NoCategorizarAction({
  parent,
  decision,
  motivo,
  busy = false,
  onRegistrar,
  onRevertir,
}: NoCategorizarActionProps) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  if (decision === "no_categorizar") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRevertir();
        }}
        disabled={busy}
        title={motivo ? `Motivo registrado: ${motivo}` : undefined}
        style={enlaceStyle}
        aria-label={`Volver a dejar ${parent} pendiente de codificar`}
      >
        {busy ? <Loader2 size={11} className="pulso-spin" /> : <Undo2 size={11} />}
        Volver a pendiente
      </button>
    );
  }

  // Sólo tiene sentido decidir sobre lo que sigue abierto: una categorizada no
  // necesita esta salida, y una sin respuestas ya se cerró sola.
  if (decision !== "pendiente" && decision !== "pendiente_parcial") return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAbierto(true);
        }}
        disabled={busy}
        style={enlaceStyle}
        aria-label={`Registrar que ${parent} no se va a categorizar`}
      >
        No categorizar…
      </button>
    );
  }

  const listo = texto.trim().length > 0;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: "1 1 220px" }}
    >
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && listo) onRegistrar(texto.trim());
          if (e.key === "Escape") setAbierto(false);
        }}
        placeholder="Por qué no se categoriza"
        aria-label={`Motivo por el que ${parent} no se categoriza`}
        style={{
          flex: "1 1 160px", minWidth: 0,
          padding: "4px 8px", borderRadius: 6, fontSize: 11,
          border: "1px solid var(--pulso-border)",
          background: "var(--pulso-surface)", color: "var(--pulso-text)",
        }}
      />
      <button
        type="button"
        onClick={() => onRegistrar(texto.trim())}
        disabled={!listo || busy}
        style={{ ...enlaceStyle, opacity: listo ? 1 : 0.5, fontWeight: 800 }}
      >
        {busy ? <Loader2 size={11} className="pulso-spin" /> : null}
        Registrar
      </button>
      <button type="button" onClick={() => setAbierto(false)} disabled={busy} style={enlaceStyle}>
        Cancelar
      </button>
    </div>
  );
}

const enlaceStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--pulso-text-soft)",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
} as const;
