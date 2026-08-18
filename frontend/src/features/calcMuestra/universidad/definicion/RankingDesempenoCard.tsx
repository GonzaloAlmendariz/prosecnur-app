/**
 * «Qué cursos-horario rindieron mejor» — el ranking del estudio anterior, por
 * facultad, en el Histórico de Datos.
 *
 * Pedido textual de Gonzalo en el checklist (I15). La tarjeta responde sus
 * cinco preguntas por columna: qué curso, de qué tipo, de qué ciclo, con
 * cuántos alumnos, qué porcentaje asistió — y EN QUÉ SEMANA del campo se
 * aplicó, porque un aula tardía rinde contra un marco más agotado.
 *
 * Tres coberturas se declaran en el encabezado en vez de esconderse: cuántas
 * aulas aplicadas hay, cuántas traen semana (la base 2025 no fecha todas) y
 * cuántas existen en el catálogo vigente (tipo/ciclo salen de ese join). Un
 * ranking sin denominadores se leería como censo, y no lo es.
 */
import type { CalcMuestraReferenciaAsistencia } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";
import {
  construirRankingDesempeno,
  type AulaFrameRowLike,
} from "./rankingDesempenoModel";
import "../shared/tablas.css";
import "./rankingDesempeno.css";

function pctTxt(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

/** «9 · 7» (mujeres · hombres); un lado sin dato va como guion, nunca como 0. */
function parSexo(mujeres: number | null, hombres: number | null): string {
  if (mujeres == null && hombres == null) return "—";
  const m = mujeres == null ? "—" : fmtInt(mujeres);
  const h = hombres == null ? "—" : fmtInt(hombres);
  return `${m} · ${h}`;
}

export function RankingDesempenoCard({
  referencia,
  aulaFrame,
}: {
  referencia: CalcMuestraReferenciaAsistencia;
  aulaFrame: ReadonlyArray<AulaFrameRowLike> | null;
}) {
  const ranking = construirRankingDesempeno(
    referencia.cadenas_reemplazo?.filas ?? null,
    aulaFrame,
  );
  // C3: sin cadenas con detalle por aula no hay ranking posible, y la tarjeta
  // lo dice en vez de desaparecer o fingir un top vacío.
  if (!ranking) {
    return (
      <section className="cmv2-rankdes" aria-label="Desempeño por curso-horario del estudio anterior">
        <header className="cmv2-rankdes-head">
          <span className="cmv2-eyebrow">Lo que mejor rindió</span>
          <h4>Qué cursos-horario rindieron mejor</h4>
          <p>
            La base del estudio anterior no trae el detalle por aula de las
            cadenas de selección, así que no se puede rankear su desempeño.
          </p>
        </header>
      </section>
    );
  }
  const { cobertura, minElegibles, topPorFacultad } = ranking;

  return (
    <section className="cmv2-rankdes" aria-label="Desempeño por curso-horario del estudio anterior">
      <header className="cmv2-rankdes-head">
        <span className="cmv2-eyebrow">Lo que mejor rindió</span>
        <h4>Qué cursos-horario rindieron mejor</h4>
        <p>
          Las {fmtInt(topPorFacultad)} mejores aulas aplicadas de cada facultad,
          por porcentaje de asistencia sobre sus elegibles. Sólo compiten aulas
          con {fmtInt(minElegibles)}+ elegibles ({fmtInt(cobertura.descartadasPorMinimo)}{" "}
          quedaron fuera por tamaño: con pocos alumnos el porcentaje salta solo
          {cobertura.desbordadas > 0 ? (
            <>
              ; {fmtInt(cobertura.desbordadas)} más quedaron fuera por traer más
              efectivas que elegibles, un desborde de la base que no puede competir
            </>
          ) : null}
          ). De las {fmtInt(cobertura.aplicadas)} aulas aplicadas,{" "}
          {fmtInt(cobertura.conSemana)} traen semana de campo y{" "}
          {fmtInt(cobertura.conJoin)} existen en el catálogo vigente — de ahí
          salen tipo, ciclo y los elegibles por sexo; un guion es un curso que
          ya no se dicta. <strong>M·H</strong>: quiénes respondieron en el
          estudio anterior y quiénes son elegibles HOY — la base anterior no
          trae elegibles por sexo por aula, así que la previsión por sexo que
          se puede decir con verdad es la del marco vigente.
        </p>
      </header>
      <ul className="cmv2-rankdes-grid">
        {ranking.grupos.map((grupo) => (
          <li key={grupo.facultad} className="cmv2-rankdes-fac">
            <header>
              <strong>{grupo.facultad}</strong>
              <span>{fmtInt(grupo.consideradas)} aulas compiten</span>
            </header>
            <table className="cmv2-tabla">
              <thead>
                <tr>
                  <th scope="col">Curso-horario</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="cmv2-num">Ciclo</th>
                  <th scope="col" className="cmv2-num">Alumnos</th>
                  <th scope="col" className="cmv2-num">Asistencia</th>
                  <th scope="col" className="cmv2-num">Resp. M·H</th>
                  <th scope="col" className="cmv2-num">Eleg. hoy M·H</th>
                  <th scope="col" className="cmv2-num">Semana</th>
                </tr>
              </thead>
              <tbody>
                {grupo.filas.map((fila) => (
                  <tr key={`${fila.cursoHorario}-${fila.rol}`}>
                    <th scope="row">
                      <span className="cmv2-rankdes-curso">{fila.nombreCurso || fila.cursoHorario}</span>
                      <small>
                        {fila.cursoHorario}
                        {fila.rol.toLowerCase() === "titular" ? "" : ` · ${fila.rol.toLowerCase()}`}
                      </small>
                    </th>
                    <td>{fila.tipo ? fila.tipo.toLowerCase() : "—"}</td>
                    <td className="cmv2-num">{fila.ciclo == null ? "—" : fmtInt(fila.ciclo)}</td>
                    <td className="cmv2-num">{fmtInt(fila.elegibles)}</td>
                    <td className="cmv2-num">
                      <strong>{pctTxt(fila.rendimiento)}</strong>
                    </td>
                    <td className="cmv2-num">{parSexo(fila.efectivasMujeres, fila.efectivasHombres)}</td>
                    <td className="cmv2-num">{parSexo(fila.elegiblesHoyMujeres, fila.elegiblesHoyHombres)}</td>
                    <td className="cmv2-num">{fila.semana == null ? "—" : fmtInt(fila.semana)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </section>
  );
}
