/**
 * Visuales didácticos de los parámetros de la fórmula (sección Cálculo).
 *
 * Extraídos de la antigua pestaña «Supuestos» para que «Diseño» sea el único
 * hogar de los parámetros: la campana de confianza (±z), la curva de varianza
 * p·(1−p) y la fila de supuesto con su ayuda contextual. Presentación pura; el
 * ámbito «Universidad / Facultades» acompaña cada visual.
 */
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover } from "../../../../components/Popover";
import { zFromConfidence } from "../../didactica/motorPreview";
import { fmtNum } from "./calculoUi";

/** Confianza bilateral desde z, invirtiendo la MISMA réplica qnorm del motor. */
export function confianzaDesdeZExacta(z: number) {
  let lo = 0.5;
  let hi = 0.9999;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (zFromConfidence(mid) < z) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Decimales visibles en español; las expresiones KaTeX conservan punto. */
export function fmtDecimal(value: number | null | undefined, digits = 3) {
  return fmtNum(value, digits).replace(".", ",");
}

export function AmbitosSupuesto({
  universidad,
  facultades,
}: {
  universidad: string;
  facultades: string;
}) {
  return (
    <div className="cmv2-calc-ambitos" aria-label={`Universidad: ${universidad}. Facultades: ${facultades}.`}>
      <span><i data-ambito="universidad" /> Universidad <strong>{universidad}</strong></span>
      <span><i data-ambito="facultades" /> Facultades <strong>{facultades}</strong></span>
    </div>
  );
}

/** Micro-curva p·(1−p) con marcador en el p actual. */
export function CurvaP({ p, pFacultades }: { p: number; pFacultades: number }) {
  const puntos: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    puntos.push(`${(8 + t * 144).toFixed(1)},${(56 - 4 * t * (1 - t) * 42).toFixed(1)}`);
  }
  const px = 8 + Math.min(Math.max(p, 0), 1) * 144;
  const py = 56 - 4 * p * (1 - p) * 42;
  const pFac = Math.min(Math.max(pFacultades, 0), 1);
  const pxFac = 8 + pFac * 144;
  const pyFac = 56 - 4 * pFac * (1 - pFac) * 42;
  return (
    <>
      <AmbitosSupuesto universidad={`p = ${fmtDecimal(p, 2)}`} facultades={`p = ${fmtDecimal(pFacultades, 2)}`} />
      <svg
        className="cmv2-calc-svg"
        viewBox="0 0 160 64"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Curva de varianza. Universidad p igual a ${fmtDecimal(p, 2)}; facultades p igual a ${fmtDecimal(pFacultades, 2)}.`}
      >
        <line x1="8" y1="56" x2="152" y2="56" className="cmv2-calc-svg-eje" />
        <line x1="80" y1="56" x2="80" y2="12" className="cmv2-calc-svg-guia" />
        <polyline points={puntos.join(" ")} pathLength={1} className="cmv2-calc-svg-curva cmv2-calc-svg-draw" />
        <circle
          cx={0}
          cy={0}
          r="3.5"
          className="cmv2-calc-svg-punto cmv2-calc-svg-punto-movil"
          style={{ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)` }}
        />
        <circle
          cx={0}
          cy={0}
          r="3.5"
          className="cmv2-calc-svg-punto cmv2-calc-svg-punto-movil is-facultades"
          style={{ transform: `translate(${pxFac.toFixed(1)}px, ${pyFac.toFixed(1)}px)` }}
        />
      </svg>
    </>
  );
}

/** Mini-campana normal con el área central cubierta por ±z sombreada. */
export function CampanaZ({ z, zFacultades }: { z: number; zFacultades: number }) {
  const X = (t: number) => 8 + ((t + 3.4) / 6.8) * 144;
  const Y = (t: number) => 58 - Math.exp((-t * t) / 2) * 46;
  const curva: string[] = [];
  for (let i = 0; i <= 68; i++) {
    const t = -3.4 + (i / 68) * 6.8;
    curva.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  const zc = Math.min(Math.max(Math.abs(z), 0.4), 3.3);
  const zcFac = Math.min(Math.max(Math.abs(zFacultades), 0.4), 3.3);
  const area: string[] = [`${X(-zc).toFixed(1)},58.0`];
  for (let i = 0; i <= 40; i++) {
    const t = -zc + (i / 40) * 2 * zc;
    area.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  area.push(`${X(zc).toFixed(1)},58.0`);
  return (
    <>
      <AmbitosSupuesto universidad={`z = ${fmtDecimal(z, 2)}`} facultades={`z = ${fmtDecimal(zFacultades, 2)}`} />
      <svg
        className="cmv2-calc-svg"
        viewBox="0 0 160 64"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Curva normal. Universidad z igual a ${fmtDecimal(z, 2)}; facultades z igual a ${fmtDecimal(zFacultades, 2)}.`}
      >
        <polygon points={area.join(" ")} className="cmv2-calc-svg-area cmv2-calc-svg-revela" />
        <polyline points={curva.join(" ")} pathLength={1} className="cmv2-calc-svg-curva cmv2-calc-svg-draw" />
        <line x1={X(-zcFac)} y1="58" x2={X(-zcFac)} y2={Y(-zcFac)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela is-facultades" />
        <line x1={X(zcFac)} y1="58" x2={X(zcFac)} y2={Y(zcFac)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela is-facultades" />
        <line x1={X(-zc)} y1="58" x2={X(-zc)} y2={Y(-zc)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela" />
        <line x1={X(zc)} y1="58" x2={X(zc)} y2={Y(zc)} className="cmv2-calc-svg-marca cmv2-calc-svg-revela" />
        <line x1="8" y1="58" x2="152" y2="58" className="cmv2-calc-svg-eje" />
      </svg>
    </>
  );
}

export function SupuestoFila({
  id,
  titulo,
  resumen,
  popover,
  controles,
  visual,
}: {
  id: string;
  titulo: string;
  resumen: string;
  popover: ReactNode;
  controles: ReactNode;
  visual: ReactNode;
}) {
  return (
    <article className="cmv2-calc-supuesto" data-supuesto={id}>
      <div className="cmv2-calc-supuesto-info">
        <div className="cmv2-calc-supuesto-titulo">
          <strong>{titulo}</strong>
          <Popover
            openOn="hover"
            ariaLabel={`Por qué importa ${titulo}`}
            trigger={
              <button
                type="button"
                className="cmv2-calc-porque"
                aria-label={`Información sobre ${titulo}`}
                title={`Información sobre ${titulo}`}
              >
                <CircleHelp size={15} aria-hidden="true" />
              </button>
            }
          >
            <div className="cmv2-calc-porque-pop">{popover}</div>
          </Popover>
        </div>
        <p className="cmv2-calc-supuesto-resumen">{resumen}</p>
        <div className="cmv2-calc-supuesto-controles">{controles}</div>
      </div>
      <div className="cmv2-calc-supuesto-visual">{visual}</div>
    </article>
  );
}
