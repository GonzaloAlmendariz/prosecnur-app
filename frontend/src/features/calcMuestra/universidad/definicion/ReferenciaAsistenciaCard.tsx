import type { ReactNode } from "react";
import type {
  CalcMuestraReferenciaAsistencia,
  CalcMuestraReferenciaAsistenciaCelda,
  CalcMuestraReferenciaAsistenciaTramo,
} from "../../../../api/calcMuestra";
import { fmtInt, fmtPct } from "../../sharedCore";
import "./referenciaAsistencia.css";

function rateLabel(value: number | null) {
  return value === null ? "S/D" : fmtPct(value);
}

function ChainLink({ tramo }: { tramo: CalcMuestraReferenciaAsistenciaTramo }) {
  return (
    <article className="cmv2-ref-asist-chain-link">
      <small>{tramo.label}</small>
      <strong>{rateLabel(tramo.tasa)}</strong>
      <span>k={fmtInt(tramo.k)}</span>
    </article>
  );
}

function publicationLabel(row: CalcMuestraReferenciaAsistenciaCelda) {
  if (row.fuente_publicada === "global") return "publica global";
  if (row.fuente_publicada === "sin_publicacion") return "sin publicación";
  return "publica celda";
}

function intervalLabel(row: CalcMuestraReferenciaAsistenciaCelda) {
  if (row.ic_low === null || row.ic_high === null) return "Sin IC";
  return `IC 95% ${rateLabel(row.ic_low)}–${rateLabel(row.ic_high)}`;
}

function translatedWarning(
  warning: string,
  referencia: CalcMuestraReferenciaAsistencia,
) {
  const countWarning = warning.match(
    /^(asistentes_mayor_matriculados|enviadas_mayor_asistentes|validas_mayor_enviadas):(\d+)$/,
  );
  if (countWarning) {
    const count = countWarning[2];
    const labels: Record<string, string> = {
      asistentes_mayor_matriculados: "con más asistentes que matriculados",
      enviadas_mayor_asistentes: "con más encuestas enviadas que asistentes",
      validas_mayor_enviadas: "con más respuestas válidas que encuestas enviadas",
    };
    return `${count} registros ${labels[countWarning[1]!]}`;
  }
  if (warning === "tipo_sesion_ausente_rellenado_sin_dato") {
    return "La fuente no declaró el tipo de sesión; esos registros se agruparon como Sin dato.";
  }
  if (warning === "marginales_no_combinables") {
    // «Marginales independientes» es exacto y no se entiende sin saberlo de
    // antes. Lo que hay que evitar es que alguien cruce dos dimensiones.
    return "Cada dimensión se leyó por separado: no se pueden cruzar entre sí (por ejemplo, facultad con tipo de sesión).";
  }
  const degradedWarning = warning.match(/^([^:]+):([^:]+):k_(\d+)_publica_global$/);
  if (degradedWarning) {
    const [, dimensionKey, cellKey, k] = degradedWarning;
    const cell = referencia.dimensiones
      .find((dimension) => dimension.dimension_key === dimensionKey)
      ?.filas.find((row) => row.celda_key === cellKey);
    return `${cell?.celda_label ?? "Una celda"} tiene k=${k}; publica global por cobertura insuficiente.`;
  }
  return null;
}

export function ReferenciaAsistenciaCard({
  referencia,
  children,
}: {
  referencia: CalcMuestraReferenciaAsistencia | null;
  children?: ReactNode;
}) {
  const sizeRows = referencia?.dimensiones
    .find((dimension) => dimension.dimension_key === "tamano")
    ?.filas.filter((row) => ["T1", "T2", "T3", "T4", "T5"].includes(row.celda_key)) ?? [];
  const degradedRows = referencia?.dimensiones.flatMap((dimension) =>
    dimension.filas
      .filter((row) => row.fuente_publicada !== "celda")
      .map((row) => ({ dimensionKey: dimension.dimension_key, row })),
  ) ?? [];
  const warnings = referencia?.advertencias
    .map((warning) => translatedWarning(warning, referencia))
    .filter((warning): warning is string => Boolean(warning)) ?? [];

  return (
    <section
      className="cmv2-ref-asist"
      data-qa-geometry-group="calc-muestra/referencia-asistencia-fuente"
      data-qa-geometry-contract="intrinsic"
      aria-labelledby="cmv2-ref-asist-title"
    >
      <header className="cmv2-ref-asist-head" data-qa-geometry-member>
        <div>
          <span className="cmv2-eyebrow">Fuente opcional · evidencia histórica</span>
          <h3 id="cmv2-ref-asist-title">Referencia de asistencia</h3>
        </div>
        <p>
          Calibra un modelo post hoc por celda. No modifica el marco, el sorteo ni el
          supuesto τ vigente.
        </p>
      </header>

      {children ? (
        <div className="cmv2-ref-asist-upload" data-qa-geometry-member>
          {children}
        </div>
      ) : null}

      {!referencia ? (
        <div className="cmv2-ref-asist-empty" role="status" data-qa-geometry-member>
          <strong>Sin referencia histórica de asistencia</strong>
          <span>
            Sube una base de control para publicar tasas agregadas con su cobertura y
            verificación de identidad.
          </span>
        </div>
      ) : (
        <>
          <div className="cmv2-ref-asist-provenance" data-qa-geometry-member>
            <div>
              <small>Dueño</small>
              <strong>Estudio histórico externo</strong>
            </div>
            <div>
              <small>Estudio</small>
              <strong>{referencia.estudio.label}</strong>
              <span>
                {[referencia.estudio.periodo, referencia.estudio.fuente]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div>
              <small>Transferencia</small>
              <strong>Modelo por celda</strong>
              <span>Cada dimensión por separado · no se cruzan</span>
            </div>
          </div>

          <div className="cmv2-ref-asist-coverage" data-qa-geometry-member>
            <article>
              <strong>{fmtInt(referencia.cobertura.agendados)} agendados</strong>
              <span>cursos-horario en la fuente</span>
            </article>
            <article>
              <strong>{fmtInt(referencia.cobertura.aplicados)} aplicados</strong>
              <span>con estado de aplicación</span>
            </article>
            <article>
              <strong>{fmtInt(referencia.cobertura.observados)} observados</strong>
              <span>con asistencia disponible</span>
            </article>
          </div>

          <div className="cmv2-ref-asist-chain" data-qa-geometry-member>
            <div className="cmv2-ref-asist-chain-head">
              <div>
                <small>Cadena histórica</small>
                <strong>Asistencia → completitud → validez</strong>
              </div>
              <div className="cmv2-ref-asist-product">
                <small>Producto del estudio</small>
                <strong>{rateLabel(referencia.cadena.producto.tasa)}</strong>
                <span>k={fmtInt(referencia.cadena.producto.k)}</span>
              </div>
            </div>
            <div className="cmv2-ref-asist-chain-grid">
              <ChainLink tramo={referencia.cadena.asistencia} />
              <ChainLink tramo={referencia.cadena.completitud} />
              <ChainLink tramo={referencia.cadena.validez} />
            </div>
          </div>

          {sizeRows.length > 0 ? (
            <section className="cmv2-ref-asist-gradient" data-qa-geometry-member>
              <header>
                <small>Dato del engine R</small>
                <strong>Gradiente observado por tamaño</strong>
              </header>
              <div className="cmv2-ref-asist-gradient-grid">
                {sizeRows.map((row) => (
                  <article key={row.celda_key}>
                    <small>{row.celda_key}</small>
                    <strong>{row.celda_label}</strong>
                    <span>k={fmtInt(row.k)}</span>
                    <span>{intervalLabel(row)}</span>
                    <b>{rateLabel(row.tasa)}</b>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {degradedRows.length > 0 || warnings.length > 0 ? (
            <section
              className="cmv2-ref-asist-degraded"
              role="alert"
              data-qa-geometry-member
            >
              <header>
                <small>Lectura cauta</small>
                <strong>Celdas con publicación degradada</strong>
              </header>
              {degradedRows.length > 0 ? (
                <div className="cmv2-ref-asist-degraded-grid">
                  {degradedRows.map(({ dimensionKey, row }) => (
                    <article key={`${dimensionKey}:${row.celda_key}`}>
                      <div>
                        <strong>{row.celda_label}</strong>
                        <span>k={fmtInt(row.k)}</span>
                      </div>
                      <p>
                        <b>{rateLabel(row.tasa)} observada</b>
                        <span>{rateLabel(row.tasa_publicada)} publicada</span>
                      </p>
                      <span>{intervalLabel(row)}</span>
                      <em>{publicationLabel(row)}</em>
                    </article>
                  ))}
                </div>
              ) : null}
              {warnings.length > 0 ? (
                <ul className="cmv2-ref-asist-warnings">
                  {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
            </section>
          ) : null}

          <div
            className={`cmv2-ref-asist-identity${referencia.identidad.verificada ? " is-valid" : " is-review"}`}
            role="status"
            data-qa-geometry-member
          >
            <strong>
              {referencia.identidad.verificada
                ? "Identidad verificada"
                : "Identidad por revisar"}
            </strong>
            <span>
              {fmtInt(referencia.identidad.verificables)} filas verificables · {fmtInt(referencia.identidad.inconsistentes)} inconsistencias
            </span>
          </div>
        </>
      )}
    </section>
  );
}
