import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
import "./criteriosI18b.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

function fmt(value: number): string {
  return NUMBER.format(value);
}

/**
 * Dominio compartido de un bloque de boxplots.
 *
 * Sin él cada caja se normalizaba contra su propio P10–P90 y todas salían del
 * mismo ancho: dos facultades con distribuciones distintas dibujaban lo mismo,
 * que es justo lo único que un boxplot sirve para responder. El dominio se
 * calcula una vez sobre todas las distribuciones del bloque y se pasa a cada
 * figura; ninguna figura se normaliza sola.
 */
export type BoxplotDomain = { low: number; high: number };

export function boxplotDomain(
  distributions: ReadonlyArray<CalcMuestraAulasCriterioRadiografiaV2Distribution | null | undefined>,
): BoxplotDomain | null {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const d of distributions) {
    if (!d) continue;
    for (const value of [d.p10, d.p25, d.p50, d.p75, d.p90, d.media]) {
      if (value === null || !Number.isFinite(value)) continue;
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

const VIEW_LEFT = 20;
const VIEW_SPAN = 200;

export function CriterioBoxplotPercentilar({
  label,
  distribution,
  domain,
}: {
  label: string;
  distribution: CalcMuestraAulasCriterioRadiografiaV2Distribution;
  /** Dominio del bloque. Sin él la figura no se dibuja comparable y lo declara. */
  domain?: BoxplotDomain | null;
}) {
  const { media, p10, p25, p50, p75, p90 } = distribution;
  if ([media, p10, p25, p50, p75, p90].some((value) => value === null)) {
    return (
      <div className="cmv2-i18b-boxplot-empty" role="status" data-state="sin_distribucion">
        Sin distribución percentilar publicable
      </div>
    );
  }

  const low = domain?.low ?? (p10 as number);
  const high = domain?.high ?? (p90 as number);
  const span = high - low;
  const position = (value: number) => {
    if (span <= 0) return VIEW_LEFT + VIEW_SPAN / 2;
    return VIEW_LEFT + Math.min(1, Math.max(0, (value - low) / span)) * VIEW_SPAN;
  };
  const x10 = position(p10 as number);
  const x25 = position(p25 as number);
  const x50 = position(p50 as number);
  const x75 = position(p75 as number);
  const x90 = position(p90 as number);
  const xMean = position(media as number);
  const accessible = [
    label,
    `P10 ${fmt(p10 as number)}`,
    `P25 ${fmt(p25 as number)}`,
    `P50 ${fmt(p50 as number)}`,
    `P75 ${fmt(p75 as number)}`,
    `P90 ${fmt(p90 as number)}`,
    `Media ${fmt(media as number)}`,
    domain ? `escala compartida ${fmt(low)}–${fmt(high)}` : "escala propia",
  ].join(" · ");

  return (
    <figure className="cmv2-i18b-boxplot" data-scale={domain ? "compartida" : "propia"}>
      <svg viewBox="0 0 240 40" role="img" aria-label={accessible}>
        <title>{accessible}</title>
        {/* Riel del dominio: hace visible que la caja ocupa una fracción de la
            escala del bloque y no todo el ancho disponible. */}
        <line className="cmv2-i18b-boxplot-domain" x1={VIEW_LEFT} x2={VIEW_LEFT + VIEW_SPAN} y1="20" y2="20" />
        <line className="cmv2-i18b-boxplot-axis" x1={x10} x2={x90} y1="20" y2="20" data-mark="p10-p90" />
        <line className="cmv2-i18b-boxplot-cap" x1={x10} x2={x10} y1="12" y2="28" />
        <line className="cmv2-i18b-boxplot-cap" x1={x90} x2={x90} y1="12" y2="28" />
        <rect
          className="cmv2-i18b-boxplot-box"
          x={Math.min(x25, x75)}
          y="8"
          width={Math.max(1, Math.abs(x75 - x25))}
          height="24"
          rx="4"
          data-mark="p25-p75"
        />
        <line className="cmv2-i18b-boxplot-median" x1={x50} x2={x50} y1="8" y2="32" data-mark="p50" />
        <circle className="cmv2-i18b-boxplot-mean" cx={xMean} cy="20" r="4" data-mark="media" />
      </svg>
    </figure>
  );
}

/**
 * Leyenda y escala del bloque. Se emite UNA vez por bloque de distribución, no
 * bajo cada figura: con el payload completo la versión anterior repetía la
 * misma leyenda decenas de veces por pestaña.
 */
export function CriterioBoxplotLeyenda({
  domain,
  unidad,
}: {
  domain: BoxplotDomain | null;
  unidad?: string;
}) {
  return (
    <p className="cmv2-i18b-boxplot-legend" data-scale={domain ? "compartida" : "propia"}>
      {domain ? (
        <>
          <span className="cmv2-i18b-boxplot-legend-scale">
            Escala compartida {fmt(domain.low)} – {fmt(domain.high)}
            {unidad ? ` ${unidad}` : ""}
          </span>
          <span>caja P25–P75</span>
          <span>línea P50</span>
          <span>● media</span>
          <span>bigotes P10–P90</span>
        </>
      ) : (
        <span>Sin escala publicable para este bloque.</span>
      )}
    </p>
  );
}
