import type { ExploradorDistNum } from "../../../../api/validacionExplorar";
import CajaResumen from "./CajaResumen";
import { fmtN, fmtValor } from "./explorarModelo";

/**
 * E6 — numérica: histograma, la caja debajo en la misma escala y el resumen.
 * Los atípicos se cuentan; no se recortan del eje en silencio.
 */
export default function DistribucionNumerica({ num }: { num: ExploradorDistNum }) {
  const maxN = Math.max(0, ...num.bins.map((b) => b.n));
  const escala = {
    min: num.bins.length ? Math.min(num.min, num.bins[0].desde) : num.min,
    max: num.bins.length ? Math.max(num.max, num.bins[num.bins.length - 1].hasta) : num.max,
  };
  return (
    <div className="vx-barras">
      {num.bins.length > 0 && (
        <div className="vx-hist" role="img" aria-label={`Histograma en ${num.bins.length} tramos`}>
          {num.bins.map((b, i) => (
            <span
              key={i}
              title={`${fmtValor(b.desde)} a ${fmtValor(b.hasta)} · ${fmtN(b.n)} casos`}
              style={{ height: `${maxN > 0 ? Math.max(b.n > 0 ? 2 : 0, (100 * b.n) / maxN) : 0}%` }}
            />
          ))}
        </div>
      )}
      <div className="vx-eje" aria-hidden>
        <span>{fmtValor(escala.min)}</span>
        <span>{fmtValor(escala.max)}</span>
      </div>
      <CajaResumen {...num} escala={escala} etiqueta="Resumen" />
      <div className="vx-resumen">
        <span>Mediana <strong>{fmtValor(num.mediana)}</strong></span>
        <span>p25–p75 <strong>{fmtValor(num.p25)}–{fmtValor(num.p75)}</strong></span>
        <span>Media <strong>{fmtValor(num.media)}</strong></span>
        <span>Atípicos <strong>{fmtN(num.n_atipicos)}</strong></span>
      </div>
    </div>
  );
}
