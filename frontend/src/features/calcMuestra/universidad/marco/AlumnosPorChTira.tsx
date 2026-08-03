import "./alumnosPorCh.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

function fmt(value: number | null): string {
  return value === null ? "NA" : NUMBER.format(value);
}

/**
 * S2/S4 · La decisión de «Alumnos por CH» se toma **viendo** de qué
 * distribución sale cada estadístico.
 *
 * La tabla publicaba P25, mediana y media en tres columnas de números: dieciocho
 * facultades y ningún gráfico, así que no se podía ver que una facultad tiene su
 * P25 pegado a la mediana y otra las tiene muy separadas — que es justo lo que
 * decide si el estadístico conservador cuesta caro o no.
 *
 * Presenta, no calcula: los tres valores y el dominio vienen publicados por R.
 * El dominio es **compartido por toda la tabla** (S4: sin escala común no hay
 * comparación) y el Total actúa de referencia visible.
 */
export type TiraDominio = { low: number; high: number };

export function alumnosPorChDominio(
  filas: ReadonlyArray<{ p25: number | null; p50: number | null; media: number | null }>,
): TiraDominio | null {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const fila of filas) {
    for (const valor of [fila.p25, fila.p50, fila.media]) {
      if (valor === null || !Number.isFinite(valor)) continue;
      if (valor < low) low = valor;
      if (valor > high) high = valor;
    }
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

const LEFT = 4;
const SPAN = 132;

export function AlumnosPorChTira({
  label,
  p25,
  p50,
  media,
  dominio,
  referencia,
}: {
  label: string;
  p25: number | null;
  p50: number | null;
  media: number | null;
  dominio: TiraDominio | null;
  /** Valor del Total: se dibuja como línea de referencia en cada fila. */
  referencia?: number | null;
}) {
  if (!dominio || [p25, p50, media].every((valor) => valor === null)) {
    return <span className="cmv2-alumnos-ch-tira-vacia">Sin distribución publicable</span>;
  }
  const span = dominio.high - dominio.low;
  const x = (valor: number) => {
    if (span <= 0) return LEFT + SPAN / 2;
    return LEFT + Math.min(1, Math.max(0, (valor - dominio.low) / span)) * SPAN;
  };
  const accesible = [
    label,
    `P25 ${fmt(p25)}`,
    `mediana ${fmt(p50)}`,
    `media ${fmt(media)}`,
    `escala compartida ${fmt(dominio.low)}–${fmt(dominio.high)}`,
  ].join(" · ");

  return (
    <div className="cmv2-alumnos-ch-tira">
      <svg viewBox="0 0 140 26" role="img" aria-label={accesible}>
        <title>{accesible}</title>
        <line className="cmv2-alumnos-ch-tira-riel" x1={LEFT} x2={LEFT + SPAN} y1="13" y2="13" />
        {referencia != null && Number.isFinite(referencia) ? (
          <line
            className="cmv2-alumnos-ch-tira-ref"
            x1={x(referencia)}
            x2={x(referencia)}
            y1="3"
            y2="23"
            data-mark="referencia"
          />
        ) : null}
        {p25 !== null && p50 !== null ? (
          <line className="cmv2-alumnos-ch-tira-rango" x1={x(p25)} x2={x(p50)} y1="13" y2="13" />
        ) : null}
        {p25 !== null ? <circle className="cmv2-alumnos-ch-tira-p25" cx={x(p25)} cy="13" r="4" data-mark="p25" /> : null}
        {p50 !== null ? <line className="cmv2-alumnos-ch-tira-p50" x1={x(p50)} x2={x(p50)} y1="6" y2="20" data-mark="p50" /> : null}
        {media !== null ? <circle className="cmv2-alumnos-ch-tira-media" cx={x(media)} cy="13" r="3" data-mark="media" /> : null}
      </svg>
      <span className="cmv2-alumnos-ch-tira-cifras">
        <em>P25</em> {fmt(p25)} · <em>med</em> {fmt(p50)} · <em>x̄</em> {fmt(media)}
      </span>
    </div>
  );
}

/** Leyenda y escala del bloque: una sola vez, nunca por fila. */
export function AlumnosPorChTiraLeyenda({ dominio }: { dominio: TiraDominio | null }) {
  if (!dominio) return null;
  return (
    <p className="cmv2-alumnos-ch-tira-leyenda">
      <span className="cmv2-alumnos-ch-tira-leyenda-escala">
        Escala compartida {fmt(dominio.low)} – {fmt(dominio.high)} alumnos por CH
      </span>
      <span>● P25</span>
      <span>│ mediana</span>
      <span>● media</span>
      <span>┆ Total como referencia</span>
    </p>
  );
}
