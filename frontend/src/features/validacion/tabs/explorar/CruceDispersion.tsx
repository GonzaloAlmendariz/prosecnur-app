import type { ExploradorRestriccion } from "../../../../api/validacionExplorar";
import EjesSvg, { anchoUtil, altoUtil, type Marco, xDe, yDe } from "./EjesSvg";
import { encuadre, escalaLinda, type Escala } from "./escalas";
import { fmtN, fmtValor } from "./explorarModelo";
import { useAncho } from "./useAncho";

const ALTO = 340;
const ALTO_MAX = 520;
/** Bajo este número de casos, la nota lo dice: una nube de 30 puntos no sostiene una tendencia. */
export const NUBE_CHICA = 30;

/**
 * La cota más baja (≥ / >) y la más alta (≤ / <) que se INCUMPLEN: sólo ese lado se sombrea (una edad de 150 no
 * sombrea también lo que hay bajo 18).
 */
function extremos(r: ExploradorRestriccion): { min: number | null; max: number | null } {
  const incumplidas = r.cotas.filter((c) => c.fuera > 0);
  const mins = incumplidas.filter((c) => c.op === ">=" || c.op === ">").map((c) => c.valor);
  const maxs = incumplidas.filter((c) => c.op === "<=" || c.op === "<").map((c) => c.valor);
  return { min: mins.length ? Math.max(...mins) : null, max: maxs.length ? Math.min(...maxs) : null };
}

/** El encuadre de un eje abierto hasta las cotas incumplidas: la línea de la cota es la referencia que se lee. */
function escalaCon(e: { min: number; max: number }, r: ExploradorRestriccion | null, cuantas: number): Escala {
  if (!r || r.fuera === 0) return escalaLinda(e.min, e.max, cuantas);
  const { min, max } = extremos(r);
  const desde = min !== null && e.min < min ? Math.min(e.min, min) : e.min;
  const hasta = max !== null && e.max > max ? Math.max(e.max, max) : e.max;
  return escalaLinda(Math.min(desde, min ?? desde), Math.max(hasta, max ?? hasta), cuantas);
}

/**
 * E8h — dispersión de dos numéricas. El encuadre sigue al grueso de los datos: un atípico lejano (más de 3 rangos
 * intercuartílicos) se cuenta en la nota en vez de aplastar a los demás contra el borde. Si una variable declara en
 * el XLSForm una restricción que la base incumple, la zona fuera de ella se sombrea (en su eje) y el aviso lo dice
 * antes del gráfico (`AvisoRestriccion`); sin restricción declarada no se marca nada.
 */
export default function CruceDispersion({
  puntos,
  tendencia,
  n,
  n_tendencia = n,
  rotuloX,
  rotuloY,
  restriccion_x = null,
  restriccion_y = null,
}: {
  puntos: readonly [number, number][];
  tendencia: { pendiente: number; intercepto: number } | null;
  n: number;
  n_tendencia?: number;
  rotuloX: string;
  rotuloY: string;
  restriccion_x?: ExploradorRestriccion | null;
  restriccion_y?: ExploradorRestriccion | null;
}) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  if (!puntos.length) return <p className="vx-pie">Sin pares de valores para dibujar.</p>;
  const ex = encuadre(puntos.map((p) => p[0]));
  const ey = encuadre(puntos.map((p) => p[1]));
  const x = escalaCon(ex, restriccion_x, 6);
  const y = escalaCon(ey, restriccion_y, 5);
  const dentro = puntos.filter(([a, b]) => a >= ex.min && a <= ex.max && b >= ey.min && b <= ey.max);
  const fuera = puntos.length - dentro.length;
  const marco: Marco = { W: Math.max(320, ancho), H: Math.min(ALTO_MAX, Math.max(ALTO, alto)), izq: 68, der: 16, arr: 14, aba: 48 };
  const izq = marco.izq;
  const der = marco.W - marco.der;
  const arriba = marco.arr;
  const abajo = marco.H - marco.aba;
  const zonas: { x: number; y: number; w: number; h: number; borde: [number, number, number, number] }[] = [];
  if (restriccion_y && restriccion_y.fuera > 0) {
    const { min, max } = extremos(restriccion_y);
    if (min !== null) { const c = yDe(marco, min, y); zonas.push({ x: izq, y: c, w: der - izq, h: Math.max(0, abajo - c), borde: [izq, c, der, c] }); }
    if (max !== null) { const c = yDe(marco, max, y); zonas.push({ x: izq, y: arriba, w: der - izq, h: Math.max(0, c - arriba), borde: [izq, c, der, c] }); }
  }
  if (restriccion_x && restriccion_x.fuera > 0) {
    const { min, max } = extremos(restriccion_x);
    if (min !== null) { const c = xDe(marco, min, x); zonas.push({ x: izq, y: arriba, w: Math.max(0, c - izq), h: abajo - arriba, borde: [c, arriba, c, abajo] }); }
    if (max !== null) { const c = xDe(marco, max, x); zonas.push({ x: c, y: arriba, w: Math.max(0, der - c), h: abajo - arriba, borde: [c, arriba, c, abajo] }); }
  }
  // El motor ya ajusta la tendencia sólo con los casos dentro de la restricción y sin especiales; con menos de 30, no
  // la publica (revisión metodológica, 2026-11-03).
  // Si hay atípicos lejanos fuera del encuadre, la recta (que los incluye) no pasa por la nube que se ve: no se dibuja.
  const dibujaTendencia = !!tendencia && x.hasta > x.desde && fuera === 0;
  const conRestriccion = !!(restriccion_x || restriccion_y);
  const notas = [
    fuera > 0
      ? `${fmtN(fuera)} ${fuera === 1 ? "caso queda" : "casos quedan"} fuera del encuadre por atípico lejano${tendencia ? "; la tendencia no se dibuja porque la arrastran" : ""}.`
      : null,
    puntos.length < n ? `Se dibujan ${fmtN(puntos.length)} de ${fmtN(n)} puntos, al azar.` : null,
    n < NUBE_CHICA ? `Base chica: ${fmtN(n)} casos.` : null,
  ].filter(Boolean);
  return (
    <>
      <div ref={ref} className="vx-svg-caja is-llena" style={{ minHeight: ALTO }}>
        <svg
          className="vx-svg"
          width={marco.W}
          height={marco.H}
          viewBox={`0 0 ${marco.W} ${marco.H}`}
          role="img"
          aria-label={`Dispersión de ${rotuloX} (horizontal) frente a ${rotuloY} (vertical), ${fmtN(n)} casos`}
        >
          {zonas.map((z, i) => (
            <g key={i}>
              <rect className="vx-svg-imposible" x={z.x} y={z.y} width={z.w} height={z.h} />
              <line className="vx-svg-imposible-borde" x1={z.borde[0]} y1={z.borde[1]} x2={z.borde[2]} y2={z.borde[3]} />
            </g>
          ))}
          <EjesSvg marco={marco} y={y} rotuloY={fmtValor} x={x} rotuloX={fmtValor} tituloX={rotuloX} tituloY={rotuloY} />
          {zonas.length > 0 && (
            <text className="vx-svg-imposible-texto" x={izq + 10} y={Math.min(arriba + 16, arriba + altoUtil(marco) - 6)}>
              {anchoUtil(marco) < 440 ? "Fuera de la restricción" : "Sombreado: fuera de la restricción del formulario"}
            </text>
          )}
          {dentro.map(([a, b], i) => (
            <circle key={i} className="vx-svg-punto" cx={xDe(marco, a, x)} cy={yDe(marco, b, y)} r={4.5}>
              <title>{`${rotuloX}: ${fmtValor(a)} · ${rotuloY}: ${fmtValor(b)}`}</title>
            </circle>
          ))}
          {dibujaTendencia && tendencia && (
            <line
              className="vx-svg-tendencia"
              x1={xDe(marco, x.desde, x)}
              y1={yDe(marco, tendencia.intercepto + tendencia.pendiente * x.desde, y)}
              x2={xDe(marco, x.hasta, x)}
              y2={yDe(marco, tendencia.intercepto + tendencia.pendiente * x.hasta, y)}
            />
          )}
        </svg>
      </div>
      {dibujaTendencia && (
        <div className="vx-leyenda">
          <span>
            <i className="vx-muestra is-tendencia" aria-hidden />
            {conRestriccion && n_tendencia < n
              ? `Tendencia sobre los ${fmtN(n_tendencia)} casos dentro de la restricción del formulario`
              : `Tendencia con los ${fmtN(n_tendencia)} casos`}
          </span>
        </div>
      )}
      {notas.length > 0 && <p className="vx-pie">{notas.join(" ")}</p>}
    </>
  );
}

/**
 * El aviso de E8h, antes del gráfico: cita la restricción que declara el formulario y cuántos casos de la base (no de
 * la muestra) la incumplen, y aparte los códigos especiales, que no son datos imposibles. Una línea por eje.
 */
export function AvisoRestriccion({ items, sinTendencia }: { items: { eje: "x" | "y"; rotulo: string; r: ExploradorRestriccion }[]; sinTendencia: boolean }) {
  return (
    <div className="vx-aviso" role="note">
      {items.map(({ eje, rotulo, r }) => (
        <p key={eje}>
          <strong>{r.fuera === r.n ? `Los ${fmtN(r.n)} valores` : `${fmtN(r.fuera)} de ${fmtN(r.n)} valores`}</strong> de {rotulo} están fuera de la restricción del formulario ({r.texto})
          {r.especiales > 0 ? `; ${fmtN(r.especiales)} ${r.especiales === 1 ? "código especial no cuenta" : "códigos especiales no cuentan"}` : ""}.
        </p>
      ))}
      {sinTendencia && <p>No se dibuja la tendencia: quedan menos de {NUBE_CHICA} casos dentro de la restricción.</p>}
    </div>
  );
}
