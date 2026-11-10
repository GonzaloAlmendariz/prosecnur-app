import { NOMBRE_NSE } from "../territorio/capaDistritos";
import { ORDEN_NSE } from "./nsePorDistrito";
import "./barraNseDistrito.css";

// Nombres literales: el contrato de tokens no lee nombres armados.
const NSE_TOKEN = ["--pulso-nse-0", "--pulso-nse-1", "--pulso-nse-2", "--pulso-nse-3", "--pulso-nse-4", "--pulso-nse-5"] as const;

/**
 * Las UMP titulares de un distrito repartidas por NSE (revisión del 10 nov 2026: la columna de Manzanas eran seis
 * renglones y el resto vacío). El largo compara distritos —el que más UMP tiene llena la fila— y los tramos dicen de
 * qué NSE salieron, con la paleta de la capa NSE del mapa.
 */
export function BarraNseDistrito({ conteos, largo, distrito }: { conteos: readonly number[]; largo: number; distrito: string }) {
  const total = conteos.reduce((a, v) => a + v, 0);
  if (!total) return null;
  const etiqueta = `${distrito}, UMP titulares por NSE: ${ORDEN_NSE.filter((k) => conteos[k]).map((k) => `${NOMBRE_NSE[k]} ${conteos[k]}`).join(", ")}`;
  return (
    <span className="hr-nse-distrito" role="img" aria-label={etiqueta} title={etiqueta}>
      <span style={{ width: `${Math.max(8, Math.min(100, largo * 100))}%` }}>
        {ORDEN_NSE.map((k) => (conteos[k] ? <i key={k} style={{ flexGrow: conteos[k], background: `var(${NSE_TOKEN[k]})` }} /> : null))}
      </span>
    </span>
  );
}
