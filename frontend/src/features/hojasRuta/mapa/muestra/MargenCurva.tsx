/**
 * Curva del margen total según el N (brecha B54): la misma fórmula del motor
 * (`margenTotalParaN`) evaluada en una grilla, con el objetivo en línea
 * discontinua y el N en uso como punto. Con `onElegirN` (Ajustes del diseño, modo N total) un clic en la
 * curva o el deslizador de abajo proponen el N de ese punto, redondeado a rutas completas; sin él sólo dibuja.
 */
import type { MouseEvent } from "react";

const H = 128;
const IZQ = 36;
const ABAJO = 18;
const TOPE = 0.12;
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

/**
 * `ancho`: el ancho del dibujo en unidades del viewBox. Se dibuja al ancho en que se va a ver (300 en la
 * columna del inspector, más en la ventana de Ajustes) para que los rótulos no crezcan al estirarla.
 */
type Props = { margenPara: (n: number) => number | null; nUsado: number; objetivo: number; porRuta: number; onElegirN?: (n: number) => void; ancho?: number };

/** El múltiplo de k más cercano a n, nunca menor que k. */
export const alMultiplo = (n: number, k: number) => (k > 0 ? Math.max(k, Math.round(n / k) * k) : Math.round(n));

export function MargenCurva({ margenPara, nUsado, objetivo, porRuta, onElegirN, ancho: W = 300 }: Props) {
  const x0 = Math.max(porRuta, 100);
  const x1 = Math.max(3600, nUsado * 1.3);
  const mx = (n: number) => IZQ + ((n - x0) / (x1 - x0)) * (W - IZQ - 6);
  const my = (m: number) => 6 + (1 - Math.min(TOPE, m) / TOPE) * (H - ABAJO - 6);
  const puntos: string[] = [];
  for (let k = 0; k <= 80; k++) {
    const n = x0 + ((x1 - x0) * k) / 80;
    const m = margenPara(n);
    if (m != null) puntos.push(`${mx(n).toFixed(1)},${my(m).toFixed(1)}`);
  }
  const actual = margenPara(nUsado);
  if (!puntos.length) return null;
  const alClic = (e: MouseEvent<SVGSVGElement>) => {
    if (!onElegirN) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caja.left) / caja.width) * W;
    const n = x0 + ((x - IZQ) / (W - IZQ - 6)) * (x1 - x0);
    onElegirN(alMultiplo(Math.min(x1, Math.max(x0, n)), porRuta));
  };
  const curva = (
    <svg className="hr-margen-curva" data-interactiva={onElegirN ? "" : undefined} onClick={onElegirN ? alClic : undefined} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Margen total según N: con ${fmt(nUsado)} entrevistas, ±${((actual ?? 0) * 100).toFixed(1)} %`}>
      {[0.03, 0.06, 0.09, 0.12].map((m) => (
        <g key={m}>
          <line x1={IZQ} x2={W - 6} y1={my(m)} y2={my(m)} className="hr-margen-curva-guia" />
          <text x={IZQ - 6} y={my(m) + 3} textAnchor="end">±{Math.round(m * 100)}%</text>
        </g>
      ))}
      <line x1={IZQ} x2={W - 6} y1={my(objetivo)} y2={my(objetivo)} className="hr-margen-curva-objetivo" />
      <text x={W - 8} y={my(objetivo) - 4} textAnchor="end" className="hr-margen-curva-objetivo-texto">objetivo</text>
      <polyline points={puntos.join(" ")} className="hr-margen-curva-linea" />
      {actual != null && nUsado >= x0 && nUsado <= x1 ? <circle cx={mx(nUsado)} cy={my(actual)} r={4.5} className="hr-margen-curva-punto" /> : null}
      {[x0, (x0 + x1) / 2, x1].map((n, i) => (
        <text key={i} x={mx(n)} y={H - 4} textAnchor={i === 0 ? "start" : i === 1 ? "middle" : "end"}>{fmt(Math.round(n / 10) * 10)}</text>
      ))}
    </svg>
  );
  if (!onElegirN) return curva;
  return (
    <div className="hr-margen-curva-caja">
      {curva}
      <input
        type="range"
        className="hr-margen-curva-deslizador"
        min={alMultiplo(x0, porRuta)}
        max={alMultiplo(x1, porRuta)}
        step={porRuta}
        value={alMultiplo(nUsado, porRuta)}
        aria-label="Número de encuestas"
        aria-valuetext={`${fmt(nUsado)} encuestas`}
        onChange={(e) => onElegirN(alMultiplo(Number(e.target.value), porRuta))}
      />
    </div>
  );
}
