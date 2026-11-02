import { fmtN, fmtValor } from "./explorarModelo";

const W = 640;
const H = 300;
const PAD = { izq: 48, der: 12, arr: 12, aba: 28 };

/** E8 — dispersión (SVG simple) con la recta de tendencia si el motor la manda. */
export default function CruceDispersion({
  puntos,
  tendencia,
  n,
  rotuloX,
  rotuloY,
}: {
  puntos: readonly [number, number][];
  tendencia: { pendiente: number; intercepto: number } | null;
  n: number;
  rotuloX: string;
  rotuloY: string;
}) {
  if (!puntos.length) return <p className="vx-pie">Sin pares de valores para dibujar.</p>;
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => PAD.izq + (x1 > x0 ? ((x - x0) / (x1 - x0)) * (W - PAD.izq - PAD.der) : (W - PAD.izq - PAD.der) / 2);
  const sy = (y: number) => H - PAD.aba - (y1 > y0 ? ((y - y0) / (y1 - y0)) * (H - PAD.arr - PAD.aba) : (H - PAD.arr - PAD.aba) / 2);
  return (
    <>
      <svg className="vx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Dispersión de ${rotuloX} (horizontal) frente a ${rotuloY} (vertical), ${fmtN(n)} casos`}>
        <line className="vx-svg-eje" x1={PAD.izq} y1={H - PAD.aba} x2={W - PAD.der} y2={H - PAD.aba} />
        <line className="vx-svg-eje" x1={PAD.izq} y1={PAD.arr} x2={PAD.izq} y2={H - PAD.aba} />
        {puntos.map(([x, y], i) => (
          <circle key={i} className="vx-svg-punto" cx={sx(x)} cy={sy(y)} r={3} />
        ))}
        {tendencia && x1 > x0 && (
          <line
            className="vx-svg-tendencia"
            x1={sx(x0)}
            y1={sy(tendencia.intercepto + tendencia.pendiente * x0)}
            x2={sx(x1)}
            y2={sy(tendencia.intercepto + tendencia.pendiente * x1)}
          />
        )}
        <text x={PAD.izq} y={H - 8}>{fmtValor(x0)}</text>
        <text x={W - PAD.der} y={H - 8} textAnchor="end">{fmtValor(x1)}</text>
        <text x={PAD.izq - 6} y={H - PAD.aba} textAnchor="end">{fmtValor(y0)}</text>
        <text x={PAD.izq - 6} y={PAD.arr + 8} textAnchor="end">{fmtValor(y1)}</text>
      </svg>
      <div className="vx-leyenda">
        <span>Horizontal: {rotuloX}</span>
        <span>Vertical: {rotuloY}</span>
        {tendencia && <span>Tendencia: pendiente {fmtValor(tendencia.pendiente)}</span>}
      </div>
    </>
  );
}
