/**
 * «De dónde sale cada titular» — el sustento del dimensionamiento, por
 * facultad, con la fórmula del motor abierta en columnas.
 *
 * I2+J3. Responde la pregunta textual de Gonzalo («¿es exclusivamente por el
 * estadístico del primer cuartil, o también tiene algo que ver el ratio de
 * asistencia?»): son LAS DOS, multiplicadas, y aquí se ve cuánto pone cada
 * una en cada facultad. Las filas fijadas a mano (botón «¿un aula más?») se
 * marcan con la cifra que daría la fórmula: nada manual sin registrar.
 */
import type { CalcMuestraAulasEstrato } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";
import { construirSustento } from "./sustentoDimensionamientoModel";
import "./sustentoDimensionamiento.css";

export function SustentoDimensionamientoCard({
  filas,
}: {
  filas: CalcMuestraAulasEstrato[] | null;
}) {
  const sustento = construirSustento(filas);
  if (!sustento) return null;
  const { tauGlobal, totales } = sustento;
  const estadisticoNombres = [...new Set(sustento.filas.map((f) => f.estadisticoNombre))];

  return (
    <section className="cmv2-sustento" aria-label="Sustento del dimensionamiento por facultad">
      <header className="cmv2-sustento-head">
        <span className="cmv2-eyebrow">De dónde sale cada titular</span>
        <h4>La cuenta del dimensionamiento, facultad por facultad</h4>
        <p>
          El motor usa una sola fórmula por facultad:{" "}
          <strong>
            titulares = cuota ÷ (alumnos por aula × tasa de respuesta)
          </strong>
          , redondeada hacia arriba. Los alumnos por aula son{" "}
          {estadisticoNombres.join(" / ")} de los elegibles por curso-horario de
          esa facultad en el marco vigente
          {tauGlobal != null ? (
            <>
              ; la tasa de respuesta ({Math.round(tauGlobal * 100)}%, la
              realizada por el estudio anterior){" "}
              <strong>hoy es una sola para todas las facultades</strong> — la
              asistencia por facultad del Histórico permitiría afinarla, y esa
              es una decisión de diseño pendiente
            </>
          ) : (
            <>; la tasa de respuesta es propia de cada facultad</>
          )}
          . Sobre los titulares se suma 50% de reservas.
          {sustento.ajustadasAMano > 0 ? (
            <>
              {" "}
              <strong>{fmtInt(sustento.ajustadasAMano)}</strong>{" "}
              {sustento.ajustadasAMano === 1 ? "facultad está fijada" : "facultades están fijadas"}{" "}
              a mano y la fila lo dice con la cifra que daría la fórmula.
            </>
          ) : null}
        </p>
      </header>
      <div className="cmv2-sustento-wrap">
        <table className="cmv2-sustento-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">Cuota</th>
              <th scope="col">÷ alumnos/aula</th>
              <th scope="col">× respuesta</th>
              <th scope="col">= titulares</th>
              <th scope="col">+ reservas</th>
              <th scope="col">a coordinar</th>
            </tr>
          </thead>
          <tbody>
            {sustento.filas.map((fila) => (
              <tr key={fila.facultad} data-ajustada={fila.ajustadaAMano || undefined}>
                <th scope="row">{fila.facultad}</th>
                <td>{fmtInt(fila.cuota)}</td>
                <td>{fila.estadisticoValor == null ? "—" : fmtInt(fila.estadisticoValor)}</td>
                <td>{fila.tau == null ? "—" : `${Math.round(fila.tau * 100)}%`}</td>
                <td>
                  <strong>{fmtInt(fila.aulasBase)}</strong>
                  {fila.ajustadaAMano ? (
                    <small className="cmv2-sustento-ajuste">
                      {" "}fijada a mano · fórmula: {fila.aulasFormula == null ? "—" : fmtInt(fila.aulasFormula)}
                    </small>
                  ) : null}
                </td>
                <td>{fmtInt(fila.reservas)}</td>
                <td>{fmtInt(fila.aCoordinar)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Todas las facultades</th>
              <td>{fmtInt(totales.cuota)}</td>
              <td>—</td>
              <td>{tauGlobal == null ? "varía" : `${Math.round(tauGlobal * 100)}%`}</td>
              <td><strong>{fmtInt(totales.aulasBase)}</strong></td>
              <td>{fmtInt(totales.reservas)}</td>
              <td>{fmtInt(totales.aCoordinar)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="cmv2-sustento-nota">
        El estudio anterior declaró 170 titulares: su fórmula —con la mediana y
        sin tasa de respuesta explícita— daba alrededor de 133, y las
        facultades grandes se ajustaron a mano en agenda. Este diseño publica
        la cuenta entera, con cada factor a la vista y los ajustes marcados.
      </p>
    </section>
  );
}
