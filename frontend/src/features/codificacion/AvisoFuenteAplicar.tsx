import { Alert } from "../../components/Alert";
import "./AdaptarAplicacion.css";

// B1 (2026-10-24): `/aplicar` avisa cuando Codificación leyó otro número de casos que el de la base
// (codificacion_fuente_aviso_n, api/R/codificacion_fuente_actual.R). Lo adaptado no corresponde a la base vigente:
// se dice en texto llano, sin el nombre interno de la base. Sin aviso no pinta.

const PATRON = /ley[oó]\s+(\d+)\s+casos\s+y\s+la\s+base\s+.+?\s+tiene\s+(\d+)/i;

/** El texto del backend en llano; si no reconoce la forma, lo deja tal cual. */
export function textoAvisoFuente(aviso: string): string {
  const m = PATRON.exec(aviso);
  if (!m) return aviso;
  const leidos = Number(m[1]);
  const base = Number(m[2]);
  return `Se leyeron ${leidos} ${leidos === 1 ? "respuesta" : "respuestas"}, pero la base tiene ${base}: los archivos adaptados no corresponden a la base actual. Revisa la fuente de Codificación antes de usarlos.`;
}

export function AvisoFuenteAplicar({ aviso }: { aviso: string | null }) {
  if (!aviso) return null;
  return (
    <div className="pulso-codif-aviso-fuente" data-testid="codificacion-aviso-fuente" role="status">
      <Alert kind="warn">
        <strong>La adaptación no usó la base actual</strong>
        <p>{textoAvisoFuente(aviso)}</p>
      </Alert>
    </div>
  );
}
