import { proyectar, type Escala } from "./escalas";

export type Marco = { W: number; H: number; izq: number; der: number; arr: number; aba: number };

export const anchoUtil = (m: Marco) => m.W - m.izq - m.der;
export const altoUtil = (m: Marco) => m.H - m.arr - m.aba;
export const xDe = (m: Marco, v: number, e: Pick<Escala, "desde" | "hasta">) => m.izq + proyectar(v, e, anchoUtil(m));
export const yDe = (m: Marco, v: number, e: Pick<Escala, "desde" | "hasta">) => m.H - m.aba - proyectar(v, e, altoUtil(m));

/**
 * Rejilla y rótulos de un gráfico del explorador: líneas tenues en cada marca del
 * eje vertical, rótulos en las dos direcciones y, si se piden, los títulos de los
 * ejes. Las marcas del eje horizontal pueden ser números (escala) o posiciones
 * ya calculadas con su texto (fechas, categorías).
 */
export default function EjesSvg({
  marco,
  y,
  rotuloY,
  x,
  marcasX,
  rotuloX,
  tituloX,
  tituloY,
}: {
  marco: Marco;
  y: Escala;
  rotuloY: (v: number) => string;
  x?: Escala;
  marcasX?: { pos: number; texto: string }[];
  rotuloX?: (v: number) => string;
  tituloX?: string;
  tituloY?: string;
}) {
  const m = marco;
  const abajo = m.H - m.aba;
  const horizontales = x ? x.marcas.map((v) => ({ pos: xDe(m, v, x), texto: (rotuloX ?? String)(v) })) : marcasX ?? [];
  return (
    <g className="vx-ejes" aria-hidden>
      {y.marcas.map((v) => {
        const py = yDe(m, v, y);
        return (
          <g key={`y${v}`}>
            <line className="vx-svg-rejilla" x1={m.izq} y1={py} x2={m.W - m.der} y2={py} />
            <text className="vx-svg-marca" x={m.izq - 8} y={py + 4} textAnchor="end">{rotuloY(v)}</text>
          </g>
        );
      })}
      {x &&
        horizontales.map((h) => (
          <line key={`gx${h.pos}`} className="vx-svg-rejilla is-vertical" x1={h.pos} y1={m.arr} x2={h.pos} y2={abajo} />
        ))}
      <line className="vx-svg-eje" x1={m.izq} y1={abajo} x2={m.W - m.der} y2={abajo} />
      {horizontales.map((h, i) => (
        <text
          key={`x${h.pos}-${i}`}
          className="vx-svg-marca"
          x={h.pos}
          y={abajo + 18}
          textAnchor={i === 0 && h.pos <= m.izq + 1 ? "start" : i === horizontales.length - 1 && h.pos >= m.W - m.der - 1 ? "end" : "middle"}
        >
          {h.texto}
        </text>
      ))}
      {tituloX && (
        <text className="vx-svg-titulo-eje" x={m.izq + anchoUtil(m) / 2} y={m.H - 4} textAnchor="middle">{tituloX}</text>
      )}
      {tituloY && (
        <text className="vx-svg-titulo-eje" x={12} y={m.arr + altoUtil(m) / 2} textAnchor="middle" transform={`rotate(-90 12 ${m.arr + altoUtil(m) / 2})`}>
          {tituloY}
        </text>
      )}
    </g>
  );
}
