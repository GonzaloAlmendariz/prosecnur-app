import type { ExploradorCrucePunto } from "../../../../api/validacionExplorar";
import { fmtValor } from "./explorarModelo";

const W = 640;
const H = 280;
const PAD = { izq: 48, der: 12, arr: 12, aba: 28 };
const TONOS = [
  "var(--module-accent, var(--pulso-primary))",
  "var(--pulso-accent-violet)",
  "var(--pulso-accent-amber)",
  "var(--pulso-accent-cyan)",
  "var(--pulso-accent-steel)",
  "var(--pulso-accent-rose)",
  "var(--pulso-accent-green)",
  "var(--pulso-accent-sky)",
];

/** E8 — serie por fecha (una línea por serie, con su banda si el motor la manda). */
export default function CruceSerie({ puntos }: { puntos: readonly ExploradorCrucePunto[] }) {
  if (!puntos.length) return <p className="vx-pie">Sin fechas que dibujar.</p>;
  const fechas = [...new Set(puntos.map((p) => p.fecha))].sort();
  const series = [...new Set(puntos.map((p) => p.serie ?? ""))];
  const valores = puntos.flatMap((p) => [p.valor, p.baja, p.alta].filter((v): v is number => v !== null));
  const [y0, y1] = [Math.min(0, ...valores), Math.max(...valores)];
  const sx = (fecha: string) => {
    const i = fechas.indexOf(fecha);
    return PAD.izq + (fechas.length > 1 ? (i / (fechas.length - 1)) * (W - PAD.izq - PAD.der) : (W - PAD.izq - PAD.der) / 2);
  };
  const sy = (y: number) => H - PAD.aba - (y1 > y0 ? ((y - y0) / (y1 - y0)) * (H - PAD.arr - PAD.aba) : 0);
  return (
    <>
      <svg className="vx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Serie del ${fechas[0]} al ${fechas[fechas.length - 1]}`}>
        <line className="vx-svg-eje" x1={PAD.izq} y1={H - PAD.aba} x2={W - PAD.der} y2={H - PAD.aba} />
        <line className="vx-svg-eje" x1={PAD.izq} y1={PAD.arr} x2={PAD.izq} y2={H - PAD.aba} />
        {series.map((s, k) => {
          const tono = TONOS[k % TONOS.length];
          const propios = puntos.filter((p) => (p.serie ?? "") === s).sort((a, b) => a.fecha.localeCompare(b.fecha));
          const conBanda = propios.filter((p) => p.baja !== null && p.alta !== null);
          const banda =
            conBanda.length > 1
              ? [
                  ...conBanda.map((p) => `${sx(p.fecha)},${sy(p.alta ?? p.valor)}`),
                  ...[...conBanda].reverse().map((p) => `${sx(p.fecha)},${sy(p.baja ?? p.valor)}`),
                ].join(" ")
              : null;
          return (
            <g key={s || "serie"}>
              {banda && <polygon className="vx-svg-banda" points={banda} style={{ fill: tono }} />}
              <polyline
                className="vx-svg-linea"
                points={propios.map((p) => `${sx(p.fecha)},${sy(p.valor)}`).join(" ")}
                style={{ stroke: tono }}
              />
            </g>
          );
        })}
        <text x={PAD.izq} y={H - 8}>{fechas[0]}</text>
        <text x={W - PAD.der} y={H - 8} textAnchor="end">{fechas[fechas.length - 1]}</text>
        <text x={PAD.izq - 6} y={H - PAD.aba} textAnchor="end">{fmtValor(y0)}</text>
        <text x={PAD.izq - 6} y={PAD.arr + 8} textAnchor="end">{fmtValor(y1)}</text>
      </svg>
      {series.length > 1 && (
        <div className="vx-leyenda">
          {series.map((s, k) => (
            <span key={s || "serie"}>
              <i style={{ background: TONOS[k % TONOS.length] }} aria-hidden />
              {s || "Sin categoría"}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
