/**
 * Curva del margen total según el N (brecha B54): la misma fórmula del motor
 * (`margenTotalParaN`) evaluada en una grilla, con el objetivo en línea
 * discontinua y el N en uso como punto. Sólo dibuja: no decide nada.
 */

const W = 300;
const H = 128;
const IZQ = 36;
const ABAJO = 18;
const TOPE = 0.12;
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

type Props = { margenPara: (n: number) => number | null; nUsado: number; objetivo: number; porRuta: number };

export function MargenCurva({ margenPara, nUsado, objetivo, porRuta }: Props) {
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
  return (
    <svg className="hr-margen-curva" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Margen total según N: con ${fmt(nUsado)} entrevistas, ±${((actual ?? 0) * 100).toFixed(1)} %`}>
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
}
