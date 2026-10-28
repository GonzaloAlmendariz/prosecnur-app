import type { HojasRutaSampleSizeConfig } from "../../../api/hojasRuta";
import { computeMarginError } from "./margen";
import "./curvaMargenN.css";

// «Qué compra cada N»: el margen de error total contra el N, con cada N
// traducido a rutas (UMP) para imprimir y recorrer. La decisión del N deja de
// ser una lista de diez cifras al mismo nivel y pasa a ser un punto sobre una
// curva, con la alternativa de sumar rutas a la vista.

export type PuntoCurva = { n: number; margen: number };

/** La curva entre un tercio y el triple del N, en pasos de una ruta. */
export function puntosDeLaCurva(n: number, poblacion: number, supuestos: HojasRutaSampleSizeConfig, porRuta: number): PuntoCurva[] {
  const paso = Math.max(1, Math.round(porRuta));
  const desde = Math.max(paso, Math.floor(n / 3 / paso) * paso);
  const hasta = Math.max(desde + paso * 4, Math.ceil((n * 3) / paso) * paso);
  const salto = Math.max(paso, Math.round((hasta - desde) / 60 / paso) * paso);
  const puntos: PuntoCurva[] = [];
  for (let x = desde; x < hasta; x += salto) {
    const m = computeMarginError(poblacion, x, supuestos);
    if (m != null) puntos.push({ n: x, margen: m });
  }
  const ultimo = computeMarginError(poblacion, hasta, supuestos);
  if (ultimo != null) puntos.push({ n: hasta, margen: ultimo });
  return puntos;
}

/** El N con un 20 % más de entrevistas, redondeado a rutas completas. */
export function nAlternativo(n: number, porRuta: number): number {
  const paso = Math.max(1, Math.round(porRuta));
  return n + Math.max(paso, Math.round((n * 0.2) / paso) * paso);
}

const entero = (v: number) => new Intl.NumberFormat("es-PE").format(Math.round(v));
const porcentaje = (v: number) => `±${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v * 100)} %`;

export function CurvaMargenN({
  n,
  poblacion,
  supuestos,
  porRuta,
}: {
  n: number;
  poblacion: number;
  supuestos: HojasRutaSampleSizeConfig;
  porRuta: number;
}) {
  const puntos = n > 0 && poblacion > 0 ? puntosDeLaCurva(n, poblacion, supuestos, porRuta) : [];
  const margenActual = computeMarginError(poblacion, n, supuestos);
  if (puntos.length < 2 || margenActual == null) return null;

  const W = 560;
  const H = 210;
  const izq = 48;
  const der = 14;
  const arriba = 12;
  const abajo = 42;
  const nMin = puntos[0].n;
  const nMax = puntos[puntos.length - 1].n;
  const mMax = Math.max(...puntos.map((p) => p.margen), supuestos.margin_total);
  const mMin = Math.min(...puntos.map((p) => p.margen));
  const X = (v: number) => izq + ((v - nMin) / (nMax - nMin)) * (W - izq - der);
  const Y = (m: number) => arriba + ((mMax - m) / (mMax - mMin || 1)) * (H - arriba - abajo);
  const trazo = puntos.map((p, i) => `${i ? "L" : "M"}${X(p.n).toFixed(1)} ${Y(p.margen).toFixed(1)}`).join("");
  const alterno = nAlternativo(n, porRuta);
  const margenAlterno = computeMarginError(poblacion, alterno, supuestos) ?? margenActual;
  const rutas = (v: number) => Math.round(v / Math.max(1, porRuta));
  const marcasN = [nMin, Math.round((nMin + nMax) / 2 / porRuta) * porRuta, nMax];
  const marcasM = [mMax, (mMax + mMin) / 2, mMin];
  const cajaX = Math.min(X(n) + 12, W - der - 210);
  const objetivoVisible = supuestos.margin_total >= mMin && supuestos.margin_total <= mMax;

  return (
    <figure className="hr-curva-n">
      <figcaption>
        <strong>Qué compra cada N</strong>
        <span>Margen total al {Math.round(supuestos.confidence_level * 100)} % · cada ruta son {entero(porRuta)} entrevistas</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Con N ${entero(n)} el margen es ${porcentaje(margenActual)} y salen ${entero(rutas(n))} rutas; con ${entero(alterno)} baja a ${porcentaje(margenAlterno)}.`}>
        {marcasM.map((m) => (
          <g key={`m${m}`}>
            <line className="hr-curva-rejilla" x1={izq} x2={W - der} y1={Y(m)} y2={Y(m)} />
            <text className="hr-curva-eje" x={izq - 8} y={Y(m) + 4} textAnchor="end">{porcentaje(m)}</text>
          </g>
        ))}
        {marcasN.map((v) => (
          <g key={`n${v}`}>
            <text className="hr-curva-eje" x={X(v)} y={H - 24} textAnchor="middle">{entero(v)}</text>
            <text className="hr-curva-eje is-rutas" x={X(v)} y={H - 10} textAnchor="middle">{entero(rutas(v))} rutas</text>
          </g>
        ))}
        {objetivoVisible ? (
          <g>
            <line className="hr-curva-objetivo" x1={izq} x2={W - der} y1={Y(supuestos.margin_total)} y2={Y(supuestos.margin_total)} />
            <text className="hr-curva-objetivo-texto" x={W - der} y={Y(supuestos.margin_total) - 5} textAnchor="end">objetivo {porcentaje(supuestos.margin_total)}</text>
          </g>
        ) : null}
        <path className="hr-curva-trazo" d={trazo} />
        <line className="hr-curva-guia" x1={X(n)} x2={X(n)} y1={Y(margenActual)} y2={H - abajo} />
        <circle className="hr-curva-punto" cx={X(n)} cy={Y(margenActual)} r={5.5} />
        {alterno <= nMax ? <circle className="hr-curva-punto is-alterno" cx={X(alterno)} cy={Y(margenAlterno)} r={4.5} /> : null}
        <rect className="hr-curva-caja" x={cajaX} y={arriba} width={210} height={38} rx={8} />
        <text className="hr-curva-caja-titulo" x={cajaX + 10} y={arriba + 16}>N {entero(n)} · {porcentaje(margenActual)}</text>
        <text className="hr-curva-caja-detalle" x={cajaX + 10} y={arriba + 31}>{entero(rutas(n))} rutas para imprimir y recorrer</text>
      </svg>
      <p className="hr-curva-alterna">
        Con {entero(alterno - n)} entrevistas más ({entero(rutas(alterno) - rutas(n))} rutas) el margen baja a <strong>{porcentaje(margenAlterno)}</strong>.
      </p>
    </figure>
  );
}
