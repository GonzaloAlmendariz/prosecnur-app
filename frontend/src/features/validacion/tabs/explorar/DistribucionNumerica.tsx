import type { ExploradorDistNum } from "../../../../api/validacionExplorar";
import EjesSvg, { type Marco, xDe, yDe } from "./EjesSvg";
import { escalaDesdeCero, escalaLinda } from "./escalas";
import { fmtN, fmtValor } from "./explorarModelo";
import { useAncho } from "./useAncho";

const ALTO_HIST = 220;
/** D3: si la tarjeta se estira, el histograma crece hasta este alto (la caja queda igual). */
const ALTO_HIST_MAX = 460;
/** Bajo el histograma: la caja (20 px) y sus dos rótulos, en la misma escala horizontal. */
const ALTO_CAJA = 62;

/**
 * E6 — numérica: histograma con su rejilla y la caja debajo en la misma escala.
 * Todos los tramos del mismo color; la mediana es una línea punteada rotulada.
 * Los atípicos no se recortan del eje: los cuenta la tira de cifras de arriba.
 */
export default function DistribucionNumerica({ num }: { num: ExploradorDistNum }) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  if (!num.bins.length) return <p className="vx-pie">Sin valores numéricos que dibujar.</p>;
  const desde = Math.min(num.min, num.bins[0].desde);
  const hasta = Math.max(num.max, num.bins[num.bins.length - 1].hasta);
  const x = escalaLinda(desde, hasta, 8);
  const top = num.bins.reduce((m, b) => (b.n > m.n ? b : m), num.bins[0]);
  const y = escalaDesdeCero(top.n, 4);
  const altoHist = Math.min(ALTO_HIST_MAX, Math.max(ALTO_HIST, alto - ALTO_CAJA));
  const H = altoHist + ALTO_CAJA;
  const marco: Marco = { W: Math.max(320, ancho), H: altoHist, izq: 44, der: 10, arr: 24, aba: 26 };
  const X = (v: number) => xDe(marco, v, x);
  const cy = altoHist + 22;
  const md = X(num.mediana);
  return (
    <div ref={ref} className="vx-svg-caja is-llena" style={{ minHeight: ALTO_HIST + ALTO_CAJA }}>
      <svg
        className="vx-svg"
        width={marco.W}
        height={H}
        viewBox={`0 0 ${marco.W} ${H}`}
        role="img"
        aria-label={`Histograma en ${fmtN(num.bins.length)} tramos, de ${fmtValor(num.min)} a ${fmtValor(num.max)}; mediana ${fmtValor(num.mediana)}, mitad central de ${fmtValor(num.p25)} a ${fmtValor(num.p75)}`}
      >
        <EjesSvg marco={marco} y={y} rotuloY={fmtN} x={x} rotuloX={fmtValor} />
        {num.bins.map((b, i) => (
          <rect
            key={i}
            className="vx-svg-columna is-dist"
            x={X(b.desde) + 1}
            y={yDe(marco, b.n, y)}
            width={Math.max(1, X(b.hasta) - X(b.desde) - 2)}
            height={Math.max(0, yDe(marco, 0, y) - yDe(marco, b.n, y))}
            rx={2}
          >
            <title>{`${fmtValor(b.desde)} a ${fmtValor(b.hasta)}: ${fmtN(b.n)} ${b.n === 1 ? "caso" : "casos"}`}</title>
          </rect>
        ))}
        <line className="vx-svg-mediana" x1={md} x2={md} y1={marco.arr - 6} y2={altoHist - marco.aba} />
        <text className="vx-svg-anota" x={md + 6} y={marco.arr - 8}>{`Mediana ${fmtValor(num.mediana)}`}</text>
        <g>
          <title>{`Mínimo ${fmtValor(num.min)}, p25 ${fmtValor(num.p25)}, mediana ${fmtValor(num.mediana)}, p75 ${fmtValor(num.p75)}, máximo ${fmtValor(num.max)}`}</title>
          <line className="vx-svg-bigote" x1={X(num.min)} x2={X(num.max)} y1={cy} y2={cy} />
          <rect className="vx-svg-cajita" x={X(num.p25)} y={cy - 10} width={Math.max(2, X(num.p75) - X(num.p25))} height={20} rx={4} />
          <line className="vx-svg-cajita-mediana" x1={md} x2={md} y1={cy - 12} y2={cy + 12} />
          <text className="vx-svg-marca" x={X(num.p25)} y={cy + 28} textAnchor="middle">{fmtValor(num.p25)}</text>
          <text className="vx-svg-marca" x={X(num.p75)} y={cy + 28} textAnchor="middle">{fmtValor(num.p75)}</text>
        </g>
      </svg>
    </div>
  );
}
