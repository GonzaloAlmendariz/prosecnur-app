/**
 * Mini-boxplot de la distribución de elegibles por aula de un tipo de sesión
 * (reunión Ramiro §9). ESCALA POR GRÁFICA: cada boxplot mapea su propio
 * [min…max] a todo el ancho, así una distribución estrecha (SEMINARIO 18–23) se
 * lee con el mismo detalle que una ancha (TEÓRICO 15–156). Los valores rotulados
 * son los CUARTILES (Q1 · mediana · Q3, la caja) y la MEDIA (el punto), cada uno
 * sobre su marca; el bigote sigue mostrando min–max sin número. Etiquetas muy
 * juntas se separan (anti-solape) conservando su fila y color para no perder la
 * asociación con la marca. Presentación pura: la geometría 0..1 la calcula
 * `boxplotPosicionesPropias` en el modelo; aquí solo se dibuja.
 */
import { fmtDec, fmtInt } from "../../sharedCore";
import { boxplotPosicionesPropias, type BoxplotResumen } from "./exploradorModel";

const W = 200;
const H = 46;
const PAD_X = 8;
const INNER = W - PAD_X * 2;
/** Centro vertical de la caja/bigote; filas de etiqueta arriba y abajo. */
const CY = 23;
const BOX_TOP = 17;
const BOX_H = 12;
const Y_TOP_LABEL = 10;
const Y_BOTTOM_LABEL = 43;
/** Separación mínima entre centros de etiqueta en una fila (evita solape). */
const MIN_GAP = 17;

type Etiqueta = { key: string; x: number; text: string; cls: string };

/** Separa etiquetas de una fila para que no se solapen: empuja a la derecha las
 *  demasiado juntas y luego reencuadra el bloque dentro de [lo, hi]. */
function separarFila(items: Etiqueta[], lo: number, hi: number): Etiqueta[] {
  const s = [...items].sort((a, b) => a.x - b.x).map((it) => ({ ...it }));
  for (let i = 1; i < s.length; i++) {
    if (s[i].x - s[i - 1].x < MIN_GAP) s[i].x = s[i - 1].x + MIN_GAP;
  }
  const over = s[s.length - 1].x - hi;
  if (over > 0) for (const it of s) it.x -= over;
  const under = lo - s[0].x;
  if (under > 0) for (const it of s) it.x += under;
  return s;
}

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
  tipo,
}: {
  caja: BoxplotResumen;
  tipo: string;
}) {
  const pos = boxplotPosicionesPropias(caja);
  const x = (frac: number) => PAD_X + frac * INNER;
  const texto = `${tipo}: ${resumenTexto(caja)}`;
  // Rango degenerado (un único valor de elegibles): sin dispersión que dibujar,
  // se marca el punto central con su valor y basta.
  const degenerado = caja.max <= caja.min;
  const anchoCaja = Math.max(3, x(pos.q3) - x(pos.q1));
  const cajaX = x(pos.q1) + (x(pos.q3) - x(pos.q1)) / 2 - anchoCaja / 2;

  // Fila superior: mediana (Q2) + media, cada una sobre su marca; anti-solape.
  const topItems: Etiqueta[] = [
    { key: "med", x: x(pos.mediana), text: fmtInt(caja.mediana), cls: "cmv2-boxplot-val cmv2-boxplot-val--med" },
  ];
  if (pos.media != null) {
    topItems.push({ key: "mean", x: x(pos.media), text: fmtInt(caja.media ?? 0), cls: "cmv2-boxplot-val cmv2-boxplot-val--mean" });
  }
  // Fila inferior: los cuartiles Q1 y Q3 (bordes de la caja); si coinciden, uno.
  const bottomItems: Etiqueta[] =
    caja.q1 === caja.q3
      ? [{ key: "q", x: x(pos.q1), text: fmtInt(caja.q1), cls: "cmv2-boxplot-val" }]
      : [
          { key: "q1", x: x(pos.q1), text: fmtInt(caja.q1), cls: "cmv2-boxplot-val" },
          { key: "q3", x: x(pos.q3), text: fmtInt(caja.q3), cls: "cmv2-boxplot-val" },
        ];
  const lo = PAD_X + 9;
  const hi = W - PAD_X - 9;
  const top = separarFila(topItems, lo, hi);
  const bottom = separarFila(bottomItems, lo, hi);

  return (
    <svg
      className="cmv2-boxplot"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={texto}
    >
      <title>{texto}</title>
      {degenerado ? (
        <>
          <line className="cmv2-boxplot-whisker" x1={x(0.5) - 10} y1={CY} x2={x(0.5) + 10} y2={CY} />
          <circle className="cmv2-boxplot-media" cx={x(0.5)} cy={CY} r={3} />
          <text className="cmv2-boxplot-val cmv2-boxplot-val--med" x={x(0.5)} y={Y_TOP_LABEL} textAnchor="middle">
            {fmtInt(caja.mediana)}
          </text>
        </>
      ) : (
        <>
          {/* Bigote min–max (abarca todo el ancho: min en 0, max en 1) */}
          <line className="cmv2-boxplot-whisker" x1={x(pos.min)} y1={CY} x2={x(pos.max)} y2={CY} />
          <line className="cmv2-boxplot-cap" x1={x(pos.min)} y1={BOX_TOP + 1} x2={x(pos.min)} y2={BOX_TOP + BOX_H - 1} />
          <line className="cmv2-boxplot-cap" x1={x(pos.max)} y1={BOX_TOP + 1} x2={x(pos.max)} y2={BOX_TOP + BOX_H - 1} />
          {/* Caja intercuartílica Q1–Q3 */}
          <rect className="cmv2-boxplot-box" x={cajaX} y={BOX_TOP} width={anchoCaja} height={BOX_H} rx={2.5} />
          {/* Mediana (Q2) */}
          <line className="cmv2-boxplot-mediana" x1={x(pos.mediana)} y1={BOX_TOP - 1.5} x2={x(pos.mediana)} y2={BOX_TOP + BOX_H + 1.5} />
          {/* Media: marcador aparte para ver la distorsión de las aulas gigantes */}
          {pos.media != null && (
            <circle className="cmv2-boxplot-media" cx={x(pos.media)} cy={CY} r={3} />
          )}
          {/* Etiquetas de valor: cuartiles (Q1 abajo-izq, Q3 abajo-der) y mediana
              + media arriba, cada una alineada a su marca (anti-solape). */}
          {top.map((it) => (
            <text key={it.key} className={it.cls} x={it.x} y={Y_TOP_LABEL} textAnchor="middle">
              {it.text}
            </text>
          ))}
          {bottom.map((it) => (
            <text key={it.key} className={it.cls} x={it.x} y={Y_BOTTOM_LABEL} textAnchor="middle">
              {it.text}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}
