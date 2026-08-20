import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { perfilDesdeElMotor, perfilPorFacultad, type FilaDeFacultadDelMotor } from "./perfilPorFacultad";

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

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasPerfilPorFacultad({ filas, resumen, facultadEnFoco }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** `avance_por_facultad` del motor. Cuando llega, MANDA. */
  resumen?: ReadonlyArray<FilaDeFacultadDelMotor>;
  /** La facultad enfocada. **No filtra: resalta** — ver la nota en `AulasRitmoPorFacultad`. */
  facultadEnFoco?: string;
}) {
  const { facultades, sinFacultad, tope, cumplidas } = useMemo(
    // El bloque del motor manda porque agrega sobre el conjunto correcto: un
    // aula por slot y sin banco. Calcularlo aquí sobre `course_status` medía
    // 500 filas de 2 615, reservas dormidas incluidas. El cálculo local se
    // queda como respaldo para un payload viejo que aún no traiga el bloque.
    () => (resumen?.length ? perfilDesdeElMotor(resumen) : perfilPorFacultad(filas)),
    [filas, resumen],
  );

  if (!facultades.length) {
    return (
      <p className="mon-profile-muted">
        {sinFacultad
          ? `Ninguno de los ${fmt(sinFacultad)} cursos-horario del plan declara facultad.`
          : "El plan todavía no trae cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-facultades">
      <p className="aulas-facultades-lectura">
        <strong>{fmt(facultades.length)}</strong>{" "}
        {facultades.length === 1 ? "facultad" : "facultades"} ·{" "}
        <strong>{fmt(cumplidas)}</strong> con su meta cumplida
        {sinFacultad ? <> · {fmt(sinFacultad)} cursos-horario sin facultad declarada</> : null}
      </p>
      {/* El envoltorio lleva el scroll; la rejilla conserva su `1fr`, que es lo
          que iguala las filas. Ponerlo en la propia rejilla las descuadra. */}
      <div className="aulas-facultades-scroll">
      <ol className="aulas-facultades-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {facultades.map((f) => (
          <li key={f.facultad} className={f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
            <span className="aulas-facultad-nombre">
              {f.facultad}
              {/* Con una sola aula la tasa es un caso, no una tendencia: se
                  dice, en vez de dejar que se lea como perfil de la facultad. */}
              {/* Con espacio: el nombre y su cuenta salian pegados —«Gestion14
                  cursos-horario»— porque el `gap` del flex no viaja al texto. */}
              <em>{" "}{f.aulas === 1 ? "1 curso-horario" : `${fmt(f.aulas)} cursos-horario`}</em>
            </span>
            <span
              className="aulas-facultad-carril"
              style={{ width: `${tope ? Math.max(8, (100 * f.meta) / tope) : 0}%` }}
              role="img"
              aria-label={`${f.facultad}: ${f.avance}% de su meta`}
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
                  <strong>{fmt(f.falta)}</strong>
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
                  <em>{" "}respuestas faltan · {f.avance}%</em>
                </>
              ) : (
                <em className="es-cumplida">meta cumplida</em>
              )}
            </span>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}
