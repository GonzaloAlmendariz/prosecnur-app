import type { CalcMuestraReferenciaAsistencia } from "../../../../api/calcMuestra";
import "./referenciaAsistenciaTau.css";

const PERCENT = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function fmtRate(value: number | null): string {
  return value == null ? "—" : PERCENT.format(value);
}

function fmtInterval(low: number | null, high: number | null): string {
  if (low == null || high == null) return "IC 95% —";
  return `IC 95% ${fmtRate(low)}–${fmtRate(high)}`;
}

export function ReferenciaAsistenciaTau({
  tauActual,
  referencia,
}: {
  tauActual: number;
  referencia: CalcMuestraReferenciaAsistencia | null;
}) {
  const hayDegradacion = referencia?.dimensiones.some((dimension) =>
    dimension.filas.some((celda) => celda.fuente_publicada === "global"),
  ) ?? false;

  return (
    <section
      className="cmv2-ref-tau"
      aria-label="Referencia histórica de rendimiento"
      data-qa-geometry-group="calc-muestra/referencia-asistencia-tau"
      data-qa-geometry-contract="intrinsic"
    >
      {referencia == null ? (
        <p
          className="cmv2-ref-tau-empty"
          role="status"
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
        >
          Sin referencia histórica para calibrar τ
        </p>
      ) : (
        <>
          <header className="cmv2-ref-tau-head" data-qa-geometry-member>
            <span>Estudio histórico externo</span>
            <strong>{referencia.estudio.label}</strong>
            <small>{referencia.estudio.periodo}</small>
          </header>

          <div className="cmv2-ref-tau-comparison" data-qa-geometry-member>
            <div>
              {/* El símbolo se explica en otro punto de la página, no aquí: un
                  chip suelto con «τ» obliga a buscar su definición. */}
              <span title="Tasa de rendimiento: proporción de encuestas completas por intento">
                Rendimiento actual (τ)
              </span>
              <strong>{fmtRate(tauActual)}</strong>
            </div>
            <div>
              <span>Producto de referencia</span>
              <strong>{fmtRate(referencia.cadena.producto.tasa)}</strong>
            </div>
          </div>

          <div className="cmv2-ref-tau-chain" aria-label="Cadena histórica de rendimiento">
            {[
              referencia.cadena.asistencia,
              referencia.cadena.completitud,
              referencia.cadena.validez,
            ].map((tramo) => (
              <article key={tramo.key} data-qa-geometry-member>
                <div>
                  <span>{tramo.label}</span>
                  <strong>{fmtRate(tramo.tasa)}</strong>
                </div>
                <p>
                  <span>k={tramo.k}</span>
                  <span>{fmtInterval(tramo.ic_low, tramo.ic_high)}</span>
                </p>
              </article>
            ))}
          </div>

          {hayDegradacion ? (
            <p
              className="cmv2-ref-tau-alert"
              role="alert"
              data-qa-geometry-member
              data-qa-geometry-capacity="owned"
            >
              Referencia degradada al global
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
