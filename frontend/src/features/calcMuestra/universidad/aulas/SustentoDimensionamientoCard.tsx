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
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraReferenciaAsistencia,
} from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";
import { construirSustento } from "./sustentoDimensionamientoModel";
import "../shared/tablas.css";
import "./sustentoDimensionamiento.css";

export function SustentoDimensionamientoCard({
  filas,
  referencia = null,
}: {
  filas: CalcMuestraAulasEstrato[] | null;
  /** El estudio anterior, SOLO para la lectura referencial de la tasa propia. */
  referencia?: CalcMuestraReferenciaAsistencia | null;
}) {
  const sustento = construirSustento(filas, referencia?.cadenas_reemplazo?.filas ?? null);
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
            titulares = cuota ÷ (alumnos por aula × tasa de efectividad)
          </strong>
          , redondeada hacia arriba. Los alumnos por aula son{" "}
          {estadisticoNombres.join(" / ")} de los elegibles por curso-horario de
          esa facultad en el marco vigente
          {tauGlobal != null ? (
            <>
              ; la tasa de efectividad ({Math.round(tauGlobal * 100)}%, la
              realizada por el estudio anterior) es{" "}
              <strong>una sola para todas las facultades por decisión de
              diseño</strong> — la tasa propia de cada una se muestra al final
              como referencia, sin redimensionar nada
            </>
          ) : (
            <>; la tasa de efectividad es propia de cada facultad</>
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
        <table className="cmv2-tabla cmv2-sustento-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="cmv2-num">Cuota</th>
              <th scope="col" className="cmv2-num">÷ alumnos/aula</th>
              <th scope="col" className="cmv2-num">× respuesta</th>
              <th scope="col" className="cmv2-num">= titulares</th>
              <th scope="col" className="cmv2-num">+ reservas</th>
              <th scope="col" className="cmv2-num">a coordinar</th>
              {/* Decisión de Gonzalo: la tasa propia es REFERENCIAL — se muestra,
                  no redimensiona. Sale de las aulas aplicadas 2025 de la
                  facultad (Σefectivas/Σelegibles, k ≥ 12). */}
              <th scope="col" className="cmv2-num cmv2-sustento-ref">tasa propia 2025 (ref.)</th>
            </tr>
          </thead>
          <tbody>
            {sustento.filas.map((fila) => (
              <tr key={fila.facultad} data-ajustada={fila.ajustadaAMano || undefined}>
                <th scope="row">{fila.facultad}</th>
                <td className="cmv2-num">{fmtInt(fila.cuota)}</td>
                <td className="cmv2-num">{fila.estadisticoValor == null ? "—" : fmtInt(fila.estadisticoValor)}</td>
                <td className="cmv2-num">{fila.tau == null ? "—" : `${Math.round(fila.tau * 100)}%`}</td>
                <td className="cmv2-num">
                  <strong>{fmtInt(fila.aulasBase)}</strong>
                  {fila.ajustadaAMano ? (
                    <small className="cmv2-sustento-ajuste">
                      {" "}fijada a mano · fórmula: {fila.aulasFormula == null ? "—" : fmtInt(fila.aulasFormula)}
                    </small>
                  ) : null}
                </td>
                <td className="cmv2-num">{fmtInt(fila.reservas)}</td>
                <td className="cmv2-num">{fmtInt(fila.aCoordinar)}</td>
                <td className="cmv2-num cmv2-sustento-ref">
                  {fila.tauPropio == null ? (
                    <span title="Menos de 12 aulas aplicadas en 2025: una tasa propia sería ruido.">— (k&lt;12)</span>
                  ) : (
                    <span title={`Con la tasa propia de la facultad (${Math.round(fila.tauPropio * 100)}%, de ${fila.kPropio} aulas aplicadas en 2025) la misma fórmula daría ${fila.aulasConTauPropio} titulares. Referencial: no cambia el diseño.`}>
                      {Math.round(fila.tauPropio * 100)}% → {fila.aulasConTauPropio == null ? "—" : fmtInt(fila.aulasConTauPropio)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Todas las facultades</th>
              <td className="cmv2-num">{fmtInt(totales.cuota)}</td>
              <td className="cmv2-num">—</td>
              <td className="cmv2-num">{tauGlobal == null ? "varía" : `${Math.round(tauGlobal * 100)}%`}</td>
              <td className="cmv2-num"><strong>{fmtInt(totales.aulasBase)}</strong></td>
              <td className="cmv2-num">{fmtInt(totales.reservas)}</td>
              <td className="cmv2-num">{fmtInt(totales.aCoordinar)}</td>
              <td className="cmv2-sustento-ref">referencial</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="cmv2-sustento-nota">
        La columna «τ propio 2025» es <strong>referencial</strong>: muestra qué
        daría la misma fórmula con la tasa de efectividad que esa facultad
        realizó el año pasado (solo facultades con 12+ aulas aplicadas), sin
        cambiar el diseño vigente. El estudio anterior declaró 170 titulares: su fórmula —con la mediana y
        sin tasa de efectividad explícita— daba alrededor de 133, y las
        facultades grandes se ajustaron a mano en agenda. Este diseño publica
        la cuenta entera, con cada factor a la vista y los ajustes marcados.
      </p>
    </section>
  );
}
