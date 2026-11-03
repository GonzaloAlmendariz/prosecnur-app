import EjesSvg, { altoUtil, anchoUtil, type Marco, xDe, yDe } from "./EjesSvg";
import { encuadre, escalaLinda } from "./escalas";
import { fmtN, fmtValor } from "./explorarModelo";
import { useAncho } from "./useAncho";

const ALTO = 340;
const ALTO_MAX = 520;
/** Bajo este número de casos, la nota lo dice: una nube de 30 puntos no sostiene una tendencia. */
export const NUBE_CHICA = 30;

/**
 * Una numérica que por lo que mide no puede ser negativa: una duración o una edad, en segundos, minutos o años. Se
 * lee del nombre y del rótulo con palabras enteras («sociedad» no es «edad»); «tiempo» o «cantidad» no bastan,
 * porque una diferencia o un cambio sí pueden ser negativos. Si no se reconoce, no se marca nada: mejor callar que
 * afirmar un dato imposible (revisión metodológica, 2026-11-03).
 */
export function noPuedeSerNegativa(nombre: string, rotulo = ""): boolean {
  const t = `${nombre} ${rotulo}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/_/g, " ");
  return /\bduracion(es)?\b|\bduration\b|\bedad(es)?\b|\bage\b|\bsegundos\b|\bminutos\b|\banos cumplidos\b/.test(t);
}

/** Cuántos valores de un eje (0 = x, 1 = y) están por debajo de 0 cuando la variable no puede serlo. */
export function negativosImposibles(puntos: readonly [number, number][], noNegativa: boolean, eje: 0 | 1 = 1): number {
  return noNegativa ? puntos.filter((p) => p[eje] < 0).length : 0;
}

/**
 * E8h — dispersión de dos numéricas. El encuadre sigue al grueso de los datos: un atípico lejano (más de 3 rangos
 * intercuartílicos) se cuenta en la nota en vez de aplastar a los demás contra el borde. Si la variable vertical
 * no puede ser negativa y tiene valores bajo 0, se sombrea esa zona y la tendencia no se dibuja: el aviso lo dice
 * antes del gráfico (`avisoDispersion`).
 */
export default function CruceDispersion({
  puntos,
  tendencia,
  n,
  rotuloX,
  rotuloY,
  noNegativaY = false,
  noNegativaX = false,
}: {
  puntos: readonly [number, number][];
  tendencia: { pendiente: number; intercepto: number } | null;
  n: number;
  rotuloX: string;
  rotuloY: string;
  noNegativaY?: boolean;
  noNegativaX?: boolean;
}) {
  const [ref, ancho, alto] = useAncho<HTMLDivElement>();
  if (!puntos.length) return <p className="vx-pie">Sin pares de valores para dibujar.</p>;
  const ex = encuadre(puntos.map((p) => p[0]));
  const ey = encuadre(puntos.map((p) => p[1]));
  const imposibles = negativosImposibles(puntos, noNegativaY);
  const imposiblesX = negativosImposibles(puntos, noNegativaX, 0);
  // Con datos imposibles el cero entra al encuadre: es la referencia que hace ver que están del lado equivocado.
  const y = escalaLinda(imposibles ? Math.min(ey.min, 0) : ey.min, imposibles ? Math.max(ey.max, 0) : ey.max, 5);
  const x = escalaLinda(imposiblesX ? Math.min(ex.min, 0) : ex.min, imposiblesX ? Math.max(ex.max, 0) : ex.max, 6);
  const dentro = puntos.filter(([a, b]) => a >= ex.min && a <= ex.max && b >= ey.min && b <= ey.max);
  const fuera = puntos.length - dentro.length;
  const marco: Marco = { W: Math.max(320, ancho), H: Math.min(ALTO_MAX, Math.max(ALTO, alto)), izq: 68, der: 16, arr: 14, aba: 48 };
  const cero = yDe(marco, 0, y);
  const dibujaTendencia = !!tendencia && !imposibles && !imposiblesX && x.hasta > x.desde;
  const notas = [
    fuera > 0 ? `${fmtN(fuera)} ${fuera === 1 ? "caso queda" : "casos quedan"} fuera del encuadre por atípico lejano.` : null,
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
          {imposibles > 0 && (
            <g>
              <rect className="vx-svg-imposible" x={marco.izq} y={cero} width={anchoUtil(marco)} height={Math.max(0, marco.H - marco.aba - cero)} />
              <line className="vx-svg-imposible-borde" x1={marco.izq} x2={marco.W - marco.der} y1={cero} y2={cero} />
            </g>
          )}
          <EjesSvg marco={marco} y={y} rotuloY={fmtValor} x={x} rotuloX={fmtValor} tituloX={rotuloX} tituloY={rotuloY} />
          {imposibles > 0 && (
            <text className="vx-svg-imposible-texto" x={marco.izq + 10} y={Math.min(cero + 18, marco.arr + altoUtil(marco) - 6)}>
              {anchoUtil(marco) < 440 ? "Imposible: menor que 0" : `Por debajo de 0: imposible para ${rotuloY}`}
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
          <span><i className="vx-muestra is-tendencia" aria-hidden />Tendencia con los {fmtN(n)} casos</span>
        </div>
      )}
      {notas.length > 0 && <p className="vx-pie">{notas.join(" ")}</p>}
    </>
  );
}

/**
 * El aviso de E8h, antes del gráfico: cambia cómo se lee todo lo demás. Se cuenta sobre los puntos dibujados; si son
 * una muestra de la base, el texto lo dice en vez de hablar de «los N valores».
 */
export function AvisoImposible({ imposibles, dibujados, n, rotulo }: { imposibles: number; dibujados: number; n: number; rotulo: string }) {
  const muestra = dibujados < n;
  const cuantos = muestra
    ? `${fmtN(imposibles)} de los ${fmtN(dibujados)} valores dibujados`
    : imposibles === n ? `los ${fmtN(n)} valores` : `${fmtN(imposibles)} de ${fmtN(n)} valores`;
  return (
    <div className="vx-aviso" role="note">
      <strong>Dato imposible:</strong> {cuantos} de {rotulo} están por debajo de 0. No se dibuja la tendencia.
    </div>
  );
}
