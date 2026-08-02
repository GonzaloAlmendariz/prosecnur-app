import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
import "./criteriosI18b.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

function fmt(value: number): string {
  return NUMBER.format(value);
}

export function CriterioBoxplotPercentilar({
  label,
  distribution,
}: {
  label: string;
  distribution: CalcMuestraAulasCriterioRadiografiaV2Distribution;
}) {
  const { media, p10, p25, p50, p75, p90 } = distribution;
  if ([media, p10, p25, p50, p75, p90].some((value) => value === null)) {
    return (
      <div className="cmv2-i18b-boxplot-empty" role="status" data-state="sin_distribucion">
        Sin distribución percentilar publicable
      </div>
    );
  }

  const low = p10 as number;
  const high = p90 as number;
  const span = high - low;
  const position = (value: number) => {
    if (span === 0) return 120;
    return 20 + Math.min(1, Math.max(0, (value - low) / span)) * 200;
  };
  const x10 = position(low);
  const x25 = position(p25 as number);
  const x50 = position(p50 as number);
  const x75 = position(p75 as number);
  const x90 = position(high);
  const xMean = position(media as number);
  const accessible = [
    label,
    `P10 ${fmt(low)}`,
    `P25 ${fmt(p25 as number)}`,
    `P50 ${fmt(p50 as number)}`,
    `P75 ${fmt(p75 as number)}`,
    `P90 ${fmt(high)}`,
    `Media ${fmt(media as number)}`,
  ].join(" · ");

  return (
    <figure className="cmv2-i18b-boxplot">
      <svg viewBox="0 0 240 54" role="img" aria-label={accessible}>
        <title>{accessible}</title>
        <line className="cmv2-i18b-boxplot-axis" x1={x10} x2={x90} y1="27" y2="27" data-mark="p10-p90" />
        <line className="cmv2-i18b-boxplot-cap" x1={x10} x2={x10} y1="18" y2="36" />
        <line className="cmv2-i18b-boxplot-cap" x1={x90} x2={x90} y1="18" y2="36" />
        <rect
          className="cmv2-i18b-boxplot-box"
          x={Math.min(x25, x75)}
          y="14"
          width={Math.max(1, Math.abs(x75 - x25))}
          height="26"
          rx="4"
          data-mark="p25-p75"
        />
        <line className="cmv2-i18b-boxplot-median" x1={x50} x2={x50} y1="14" y2="40" data-mark="p50" />
        <circle className="cmv2-i18b-boxplot-mean" cx={xMean} cy="27" r="4" data-mark="media" />
      </svg>
      <figcaption>
        <span>P10–P90</span>
        <span>P25–P75</span>
        <span>● media</span>
      </figcaption>
    </figure>
  );
}
