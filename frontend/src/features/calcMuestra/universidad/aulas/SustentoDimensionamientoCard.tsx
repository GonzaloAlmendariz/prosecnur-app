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
              ; la tasa de efectividad ({Math.round(tauGlobal * 100)}%) es{" "}
              <strong>la misma para todas las facultades</strong> porque este
              estudio no declaró un histórico del que derivar una propia
            </>
          ) : (
            <>
              ; la tasa de efectividad <strong>es propia de cada facultad</strong>{" "}
              y se construye por estandarización, en dos partes: su{" "}
              <strong>composición por tamaño</strong> (qué mezcla de aulas grandes
              y chicas tiene en el marco vigente, donde las chicas rinden más)
              por su <strong>razón observado/esperado</strong> del estudio
              anterior, que recoge lo que rindió por encima o por debajo de lo que
              su tamaño predecía. La sección Cálculo, en «Tasa de efectividad por
              facultad», abre esa cuenta término a término
            </>
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
              {/* «a coordinar» era falso para el total: las reservas son
                  cupos del plan, no visitas que se agenden (Gonzalo,
                  2026-08-21). */}
              <th scope="col" className="cmv2-num">= del plan</th>
              {/*
                * Esta columna NO es una alternativa descartada, y llamarla
                * «referencial» hacía creer que el histórico se ignoró. Lo que
                * esa facultad rindió en 2025 (Σefectivas/Σelegibles sobre sus
                * aulas aplicadas, k ≥ 12) es el INSUMO del que sale el factor
                * de facultad, y ese factor ya está dentro de la tasa que
                * dimensiona. Lo que la columna enseña es otra cosa: cuántas
                * aulas saldrían usando ese rendimiento CRUDO, sin corregir el
                * cambio de composición del marco entre un año y otro. Medido
                * en HSVG2026: 194 titulares contra los 190 del diseño, y la
                * mayor parte de la brecha es Arte y Diseño (+3), cuyo marco
                * 2026 tiene aulas más chicas que las que aplicó en 2025.
                */}
              <th scope="col" className="cmv2-num cmv2-sustento-ref">su tasa 2025 sin estandarizar</th>
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
                    <span title="Esta facultad aplicó menos de 12 aulas en 2025, así que no se le estima un factor propio: sobre tan pocos casos sería ruido. NO se le aplica una tasa global — su tasa sale de su propio mix de tamaños en el marco vigente, con factor de facultad neutro (1).">
                      sin factor propio (k&lt;12)
                    </span>
                  ) : (
                    <span title={`Esta facultad rindió ${Math.round(fila.tauPropio * 100)}% en 2025 (${fila.kPropio} aulas aplicadas). De ahí sale su factor de facultad, que YA está dentro de la tasa que dimensiona. Usar ese ${Math.round(fila.tauPropio * 100)}% en crudo daría ${fila.aulasConTauPropio} titulares en vez de ${fila.aulasBase}: la diferencia es el cambio de composición del marco entre 2025 y hoy, que la tasa vigente sí corrige.`}>
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
              <td className="cmv2-sustento-ref">sin corregir</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="cmv2-sustento-nota">
        La columna «tasa propia 2025» es <strong>referencial</strong>: muestra qué
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
