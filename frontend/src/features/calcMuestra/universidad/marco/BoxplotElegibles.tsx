/**
 * Mini-boxplot de la distribución de elegibles por aula de un tipo de sesión
 * (reunión Ramiro §9). Sobre una escala COMPARTIDA entre los tipos de la
 * facultad para que se lean sobre el mismo eje: caja = Q1–Q3, línea gruesa =
 * mediana, punto = media. La media a la derecha de la mediana delata las aulas
 * gigantes que jalan el promedio — la lección que el número solo no muestra.
 * Presentación pura: la geometría 0..1 la calcula `boxplotPosiciones` en el
 * modelo; aquí solo se dibuja. Colores por tokens `--pulso-*` (marco.css).
 */
import { fmtDec, fmtInt } from "../../sharedCore";
import { boxplotPosiciones, type BoxplotResumen } from "./exploradorModel";

const W = 132;
const H = 22;
const PAD_X = 4;
const INNER = W - PAD_X * 2;

/**
 * Eje X compartido de los boxplots de la facultad: la escala numérica de
 * elegibles por aula (0 … max) para que las cajas se lean en unidades reales.
 * Se dibuja UNA vez bajo la columna (misma escala `escalaMax` que las cajas).
 */
export function BoxplotEjeX({ escalaMax }: { escalaMax: number }) {
  const medio = Math.round(escalaMax / 2);
  return (
    <div className="cmv2-boxplot-eje" style={{ width: W }}>
      <svg viewBox={`0 0 ${W} 6`} width={W} height={6} aria-hidden="true" preserveAspectRatio="none">
        <line className="cmv2-boxplot-eje-line" x1={PAD_X} y1={1} x2={W - PAD_X} y2={1} />
        {[0, 0.5, 1].map((f) => (
          <line key={f} className="cmv2-boxplot-eje-tick" x1={PAD_X + f * INNER} y1={0} x2={PAD_X + f * INNER} y2={5} />
        ))}
      </svg>
      <div className="cmv2-boxplot-eje-labels" aria-label={`Escala de elegibles por aula: 0 a ${fmtInt(escalaMax)}`}>
        <span>0</span>
        <span>{fmtInt(medio)}</span>
        <span>{fmtInt(escalaMax)}</span>
      </div>
    </div>
  );
}
const BOX_TOP = 5;
const BOX_H = H - 10;
const CY = H / 2;

/** Texto accesible y de tooltip con el resumen literal, sin caja negra. */
function resumenTexto(caja: BoxplotResumen): string {
  const media =
    caja.media != null ? ` · media ${fmtDec(caja.media, 1)}` : " · media sin dato";
  return (
    `Elegibles por aula — min ${fmtDec(caja.min, 0)} · ` +
    `Q1 ${fmtDec(caja.q1, 0)} · mediana ${fmtDec(caja.mediana, 0)} · ` +
    `Q3 ${fmtDec(caja.q3, 0)} · max ${fmtDec(caja.max, 0)}${media}`
  );
}

export function BoxplotElegibles({
  caja,
  escalaMax,
  tipo,
}: {
  caja: BoxplotResumen;
  /** Máximo compartido de la facultad (mismo eje para todos los tipos). */
  escalaMax: number;
  tipo: string;
}) {
  const pos = boxplotPosiciones(caja, escalaMax);
  const x = (frac: number) => PAD_X + frac * INNER;
  const anchoCaja = Math.max(1.5, x(pos.q3) - x(pos.q1));
  const texto = `${tipo}: ${resumenTexto(caja)}`;
  return (
    <svg
      className="cmv2-boxplot"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={texto}
      preserveAspectRatio="none"
    >
      <title>{texto}</title>
      {/* Bigote min–max */}
      <line className="cmv2-boxplot-whisker" x1={x(pos.min)} y1={CY} x2={x(pos.max)} y2={CY} />
      {/* Topes en los extremos */}
      <line className="cmv2-boxplot-cap" x1={x(pos.min)} y1={BOX_TOP + 1} x2={x(pos.min)} y2={BOX_TOP + BOX_H - 1} />
      <line className="cmv2-boxplot-cap" x1={x(pos.max)} y1={BOX_TOP + 1} x2={x(pos.max)} y2={BOX_TOP + BOX_H - 1} />
      {/* Caja intercuartílica Q1–Q3 */}
      <rect
        className="cmv2-boxplot-box"
        x={x(pos.q1)}
        y={BOX_TOP}
        width={anchoCaja}
        height={BOX_H}
        rx={2.5}
      />
      {/* Mediana (Q2) */}
      <line className="cmv2-boxplot-mediana" x1={x(pos.mediana)} y1={BOX_TOP - 1} x2={x(pos.mediana)} y2={BOX_TOP + BOX_H + 1} />
      {/* Media: marcador aparte para ver la distorsión de las aulas gigantes */}
      {pos.media != null && (
        <circle className="cmv2-boxplot-media" cx={x(pos.media)} cy={CY} r={2.6} />
      )}
    </svg>
  );
}
