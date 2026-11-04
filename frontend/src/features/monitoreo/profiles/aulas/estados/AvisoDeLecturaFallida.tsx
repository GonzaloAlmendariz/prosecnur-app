import { AlertCircle, RefreshCw } from "lucide-react";

import "./estados.css";

/**
 * S3 · Falló (aulas.md, G6). Un error se dice con su código `E_*` y su
 * `error_id` cuando los trae, y con lo que sigue valiendo: el corte anterior.
 * Sin esto, «Failed to fetch» dejaba creer que el tablero entero se perdió.
 */
export type ErrorLeido = { mensaje: string; codigo: string; errorId: string };

export function leerError(error: string): ErrorLeido {
  const texto = error.trim();
  const codigo = /(?:^|\s·\s)(E_[A-Z0-9_]+)\s*$/.exec(texto)?.[1] ?? "";
  const errorId = /error[_\s]?id[:\s=]+([A-Za-z0-9-]{6,})/i.exec(texto)?.[1] ?? "";
  const mensaje = texto.replace(/\s·\sE_[A-Z0-9_]+\s*$/, "").trim();
  return { mensaje, codigo, errorId };
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
function corteLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]}${m[4] ? ` a las ${Number(m[4])}:${m[5]}` : ""}`;
}

export function AvisoDeLecturaFallida({ error, corte, onReintentar }: {
  error: string;
  /** El `synced_at` del corte que sigue en pantalla; vacío si no hay ninguno. */
  corte: string;
  onReintentar?: () => void;
}) {
  const e = leerError(error);
  return (
    <div className="mon-profile-error aulas-s3" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>
        {e.mensaje}
        {e.codigo || e.errorId ? (
          <small className="aulas-s3-codigo">{[e.codigo, e.errorId ? `error_id ${e.errorId}` : ""].filter(Boolean).join(", ")}</small>
        ) : null}
        {corte ? <small className="aulas-s3-vigente">El corte del {corteLegible(corte)} sigue vigente.</small> : null}
      </span>
      {onReintentar ? (
        <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={onReintentar}>
          <RefreshCw size={14} aria-hidden="true" /> Reintentar
        </button>
      ) : null}
    </div>
  );
}
