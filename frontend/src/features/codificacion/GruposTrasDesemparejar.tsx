// Codificación › Preguntas: al desemparejar una pregunta que ya tenía respuestas
// agrupadas, se pregunta qué hacer con esos grupos. Sin esto quedaban huérfanos
// —sin texto ni modo— y Adaptar dejaba la pregunta fuera sin decir por qué
// (P29_10 en HSyVbG 2026, 2026-10-16).

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiCodifGrupos } from "../../api/codificacion";
import { PulsoButton } from "../../components/PulsoButton";
import { formatoConteoDe } from "../../lib/formatoNumero";

export type GruposPendientes = { parent: string; n: number };

export function GruposTrasDesemparejar({
  pendiente,
  onListo,
}: {
  pendiente: GruposPendientes | null;
  onListo: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  if (!pendiente) return null;
  const descartar = async () => {
    setOcupado(true);
    setError("");
    try {
      await apiCodifGrupos(pendiente.parent, []);
      onListo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
        padding: "8px 12px", borderRadius: "var(--pulso-radius-panel)",
        border: "1px solid var(--pulso-warn-border)", background: "var(--pulso-warn-bg)",
        color: "var(--pulso-text)", fontSize: 12,
      }}
    >
      <AlertTriangle size={14} style={{ color: "var(--pulso-warn-fg)", flex: "0 0 auto" }} />
      <span style={{ flex: "1 1 260px" }}>
        <strong>{pendiente.parent}</strong> quedó sin texto emparejado y tiene{" "}
        {formatoConteoDe(pendiente.n, "respuesta agrupada", "respuestas agrupadas")} de ese emparejamiento.
        Sin texto no se pueden aplicar.
      </span>
      <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => void descartar()}>
        Descartar esos grupos
      </PulsoButton>
      <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onListo}>
        Conservarlos
      </PulsoButton>
      {error && <span className="pulso-armon-error" role="alert">{error}</span>}
    </div>
  );
}
