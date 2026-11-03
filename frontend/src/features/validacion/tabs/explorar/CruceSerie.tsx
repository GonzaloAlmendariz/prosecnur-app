import type { ExploradorCrucePunto } from "../../../../api/validacionExplorar";
import { fmtN, fmtPct, fmtValor } from "./explorarModelo";
import { barrasApiladas, type ModoSerie } from "./serieModelo";

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

function Leyenda({ series }: { series: readonly string[] }) {
  if (series.length < 2) return null;
  return (
    <div className="vx-leyenda">
      {series.map((s, k) => (
        <span key={s || "serie"}>
          <i style={{ background: TONOS[k % TONOS.length] }} aria-hidden />
          {s || "Sin categoría"}
        </span>
      ))}
    </div>
  );
}

/**
 * E8 — serie por fecha. Única: barras apiladas por día (E8j); múltiple: líneas en %
 * (E8k); numérica: mediana con la banda p25–p75 (E8l). Ver `serieModelo.ts`.
 */
export default function CruceSerie({ puntos, modo = "mediana" }: { puntos: readonly ExploradorCrucePunto[]; modo?: ModoSerie }) {
  if (!puntos.length) return <p className="vx-pie">Sin fechas que dibujar.</p>;
  const ancho = W - PAD.izq - PAD.der;
  const alto = H - PAD.arr - PAD.aba;

  if (modo === "apilada") {
    const { fechas, series, barras, max } = barrasApiladas(puntos);
    const paso = ancho / Math.max(1, fechas.length);
    const anchoBarra = Math.max(1, paso * 0.8);
    const sy = (y: number) => H - PAD.aba - (max > 0 ? (y / max) * alto : 0);
    return (
      <>
        <svg
          className="vx-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Casos por día del ${fechas[0]} al ${fechas[fechas.length - 1]}, apilados por categoría; el día con más casos tiene ${fmtN(max)}`}
        >
          <line className="vx-svg-eje" x1={PAD.izq} y1={H - PAD.aba} x2={W - PAD.der} y2={H - PAD.aba} />
          <line className="vx-svg-eje" x1={PAD.izq} y1={PAD.arr} x2={PAD.izq} y2={H - PAD.aba} />
          {barras.map((b, i) => (
            <g key={b.fecha}>
              <title>{`${b.fecha}: ${fmtN(b.total)} casos`}</title>
              {b.tramos.map((t, k) =>
                t.n > 0 ? (
                  <rect
                    key={t.serie || "serie"}
                    className="vx-svg-barra"
                    x={PAD.izq + i * paso + (paso - anchoBarra) / 2}
                    y={sy(t.hasta)}
                    width={anchoBarra}
                    height={Math.max(0, sy(t.desde) - sy(t.hasta))}
                    style={{ fill: TONOS[k % TONOS.length] }}
                  />
                ) : null,
              )}
            </g>
          ))}
          <text x={PAD.izq} y={H - 8}>{fechas[0]}</text>
          <text x={W - PAD.der} y={H - 8} textAnchor="end">{fechas[fechas.length - 1]}</text>
          <text x={PAD.izq - 6} y={H - PAD.aba} textAnchor="end">0</text>
          <text x={PAD.izq - 6} y={PAD.arr + 8} textAnchor="end">{fmtN(max)}</text>
        </svg>
        <Leyenda series={series} />
      </>
    );
  }

  const fechas = [...new Set(puntos.map((p) => p.fecha))].sort();
  const series = [...new Set(puntos.map((p) => p.serie ?? ""))];
  const valores = puntos.flatMap((p) => [p.valor, p.baja, p.alta].filter((v): v is number => v !== null));
  // En % la escala va de 0 a 100: una línea que llega a 40 dice 40 %, no «el máximo».
  const [y0, y1] = modo === "porcentaje" ? [0, 100] : [Math.min(0, ...valores), Math.max(...valores)];
  const rotulo = (y: number) => (modo === "porcentaje" ? fmtPct(y) : fmtValor(y));
  const sx = (fecha: string) => {
    const i = fechas.indexOf(fecha);
    return PAD.izq + (fechas.length > 1 ? (i / (fechas.length - 1)) * ancho : ancho / 2);
  };
  const sy = (y: number) => H - PAD.aba - (y1 > y0 ? ((y - y0) / (y1 - y0)) * alto : 0);
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
        <text x={PAD.izq - 6} y={H - PAD.aba} textAnchor="end">{rotulo(y0)}</text>
        <text x={PAD.izq - 6} y={PAD.arr + 8} textAnchor="end">{rotulo(y1)}</text>
      </svg>
      <Leyenda series={series} />
    </>
  );
}
