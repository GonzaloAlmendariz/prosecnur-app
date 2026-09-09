import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { perfilDesdeElMotor, perfilPorFacultad, type FilaDeFacultadDelMotor } from "./perfilPorFacultad";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, fmtCuenta, pctPerfil } from "./kpisDeAulas";

/**
 * Cada facultad contra su meta, ordenadas por lo que falta.
 *
 * Cierra la lectura de Avance: primero cuánto se cubrió en total, después en qué
 * punto está cada aula, y aquí a dónde hay que ir. La barra ocupa lo que esa
 * facultad pide del total, así que una facultad grande a medias se ve distinta
 * de una pequeña vacía sin leer una cifra.
 *
 * Barras en CSS, sin Plotly, como el resto de la sección.
 */

/** ⚠ SIN MONTAR desde el 2026-09-08. Era «Dónde falta más» en Resumen, y ese
    panel medía contra la cuota del estudio —la pregunta de Metas, donde ya se
    contesta dos veces con más detalle—. Registrado en
    `componentesSinMontar.test.ts`. */
export function AulasPerfilPorFacultad({ filas, resumen, facultadEnFoco, onFoco }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** `avance_por_facultad` del motor. Cuando llega, MANDA. */
  resumen?: ReadonlyArray<FilaDeFacultadDelMotor>;
  /** La facultad enfocada. **No filtra: resalta** — ver la nota en `AulasRitmoPorFacultad`. */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const { facultades, sinFacultad, tope, cumplidas, vara } = useMemo(
    // El bloque del motor manda porque agrega sobre el conjunto correcto: un
    // aula por slot y sin banco. Calcularlo aquí sobre `course_status` medía
    // 500 filas de 2 615, reservas dormidas incluidas. El cálculo local se
    // queda como respaldo para un payload viejo que aún no traiga el bloque.
    () => (resumen?.length ? perfilDesdeElMotor(resumen) : perfilPorFacultad(filas)),
    [filas, resumen],
  );

  if (!facultades.length) {
    return (
      // La anatomía del vacío del perfil (precedente en `AulasAvanceCuota`):
      // el wrap exento declara su capacidad y sus reglas ciñen el `p`, en
      // cualquier pestaña donde este componente se monte.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {sinFacultad
            ? `Ninguno de los ${fmt(sinFacultad)} cursos-horario del plan declara facultad.`
            : "El plan todavía no trae cursos-horario."}
        </p>
      </div>
    );
  }

  return (
    <div className="aulas-facultades">
      <p className="aulas-facultades-lectura">
        <strong>{fmt(facultades.length)}</strong>{" "}
        {facultades.length === 1 ? "facultad" : "facultades"} ·{" "}
        <strong>{fmt(cumplidas)}</strong> con su {vara === "cuota del estudio" ? "cuota" : "meta"} cumplida
        {sinFacultad ? <> · {fmt(sinFacultad)} cursos-horario sin facultad declarada</> : null}
      </p>
      {/* El envoltorio lleva el scroll; la rejilla conserva su `1fr`, que es lo
          que iguala las filas. Ponerlo en la propia rejilla las descuadra. */}
      <div className="aulas-facultades-scroll">
      <ol className="aulas-facultades-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {facultades.map((f) => (
          <li key={f.facultad} className={f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-facultad-nombre"
              enFoco={f.facultad === facultadEnFoco}>
              {/* En su propio elemento para poder elipsarlo: como texto suelto
                  dentro del grid genera una caja anónima, y `text-overflow` no
                  se aplica a una caja anónima. Medido: «Ciencias y Artes de la
                  Comunicación» pedía 227 px en una celda de 190 y los 37 de más
                  se salían de la caja sin puntos suspensivos. El nombre entero
                  sigue en el `title` del botón. */}
              <span className="aulas-facultad-rotulo">{f.facultad}</span>
              {/* Con una sola aula la tasa es un caso, no una tendencia: se
                  dice, en vez de dejar que se lea como perfil de la facultad. */}
              {/* Con espacio: el nombre y su cuenta salian pegados —«Gestion14
                  cursos-horario»— porque el `gap` del flex no viaja al texto. */}
              <em>{" "}{f.aulas === 1 ? "1 curso-horario" : `${fmt(f.aulas)} cursos-horario`}</em>
            </NombreDeFacultad>
            <span
              className="aulas-facultad-carril"
              style={{ width: `${tope ? Math.max(8, (100 * f.meta) / tope) : 0}%` }}
              role="img"
              aria-label={`${f.facultad}: ${pctPerfil(f.avance)} de su meta`}
            >
              <i
                style={{
                  width: `${f.meta ? Math.round((100 * f.cubierto) / f.meta) : 0}%`,
                  background: COLOR_RESULTADO.efectiva,
                }}
              />
            </span>
            <span className="aulas-facultad-cifra">
              {f.falta ? (
                <>
                  <strong>{fmtCuenta(f.falta)}</strong>
                  {/* Con espacio de verdad: el `gap` del flex separaba a la
                      vista pero el texto decía «287faltan», y eso es lo que lee
                      un lector de pantalla. Mismo defecto que la agenda por día
                      tenía con «19 3 sin empezar». */}
                  {/* «respuestas» DICHO. La fila pone «9 cursos-horario» y
                      «232 faltan» pegados, con dos unidades distintas y sólo
                      una nombrada: el número grande son RESPUESTAS y la palabra
                      no aparecía en ninguna parte de la fila. No cabe en el
                      título —«Dónde faltan más respuestas» terminaría igual que
                      «Cumplimiento en respuestas», que es el choque que el
                      guard de títulos ya tumbó una vez—, así que va donde vive
                      la ambigüedad. */}
                  {/* El porcentaje NOMBRA lo que mide. «532 respuestas faltan
                      · 20%» pegaba dos cifras de sentido opuesto y se leía como
                      «falta el 20 %», cuando es lo CONSEGUIDO. Y con el formato
                      de la casa —un decimal y espacio antes del «%»—, que es el
                      que usa la tabla del cliente para este mismo cociente. */}
                  <em>{" "}respuestas faltan · {pctPerfil(f.avance)} conseguido</em>
                </>
              ) : (
                <em className="es-cumplida">{vara === "cuota del estudio" ? "cuota" : "meta"} cumplida</em>
              )}
              {/* **De qué lado va corta.** El número de arriba es el total de la
                  facultad y puede leerse cubierto con una celda de sexo corta:
                  «lo que me interesa es que TODAS LAS FACULTADES CUMPLAN CON SU
                  CUOTA DE SEXO». Sin esta línea la fila contesta la pregunta
                  equivocada.

                  Se escribe sólo el lado que falta. Con las dos cubiertas no se
                  dice nada: una fila que repite «0 · 0» compite por la atención
                  con las que sí piden algo. */}
              {f.mujeresFalta || f.hombresFalta ? (
                /* **Las dos celdas suman el total de arriba**, desde que el
                   avance se mide contra la CUOTA y no contra el pronóstico. El
                   prefijo «para su cuota» que llevaba aquí sobraba en cuanto
                   dejó de haber dos varas. */
                <em className="aulas-facultad-sexo">
                  {f.mujeresFalta ? `faltan ${fmtCuenta(f.mujeresFalta)} mujeres` : ""}
                  {f.mujeresFalta && f.hombresFalta ? " y " : ""}
                  {f.hombresFalta ? `${fmtCuenta(f.hombresFalta)} hombres` : ""}
                </em>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}
