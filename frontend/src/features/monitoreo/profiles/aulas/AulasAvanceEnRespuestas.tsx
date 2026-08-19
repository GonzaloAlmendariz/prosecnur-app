import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { avanceEnRespuestas } from "./avanceEnRespuestas";

/**
 * Cuánto se lleva de la meta del plan, en respuestas.
 *
 * Encabeza Avance porque es la primera pregunta de la sección —¿se está
 * cumpliendo?— y hasta ahora sólo se podía contestar a ojo, restando la meta a
 * las válidas, que da un número equivocado.
 *
 * Barra en CSS y no Plotly, como el histórico: es una lectura de tres tramos.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasAvanceEnRespuestas({ filas, resumen, validasTotales = 0 }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * El agregado del motor, cuando viene. Se prefiere SIEMPRE al cálculo local:
   * éste suma sobre `course_status`, que el motor recorta a 500 filas, así que
   * sobre un plan de 2 615 enseñaría la meta de un subconjunto arbitrario
   * presentada como el total del estudio. Es el mismo defecto que ya obligó a
   * mover el perfil por facultad al motor.
   */
  resumen?: {
    meta: number; validas: number; cubierto: number; excedente: number;
    falta: number; aulas_con_brecha: number; sin_meta: number;
  } | null;
  /**
   * Las respuestas válidas del corte, del KPI. Sirve para explicar el hueco
   * entre «3 700 válidas» y «0 de 3 743»: sin ella, la pantalla enseña las dos
   * cifras juntas y se lee como una avería.
   */
  validasTotales?: number;
}) {
  const a = useMemo(() => {
    if (resumen && Number(resumen.meta) > 0) {
      const meta = Number(resumen.meta) || 0;
      const cubierto = Number(resumen.cubierto) || 0;
      return {
        meta,
        validas: Number(resumen.validas) || 0,
        cubierto,
        excedente: Number(resumen.excedente) || 0,
        falta: Number(resumen.falta) || 0,
        aulasConBrecha: Number(resumen.aulas_con_brecha) || 0,
        sinMeta: Number(resumen.sin_meta) || 0,
        avance: meta > 0 ? Math.round((1000 * cubierto) / meta) / 10 : 0,
      };
    }
    return avanceEnRespuestas(filas);
  }, [filas, resumen]);

  if (!a.meta) {
    return (
      <p className="mon-profile-muted">
        {a.sinMeta
          ? `Ninguno de los ${a.sinMeta} cursos-horario del plan declara cuántas respuestas espera.`
          : "El plan todavía no declara metas por curso-horario."}
      </p>
    );
  }

  // El excedente se dibuja PEGADO al final de la barra y fuera de la meta: no
  // cabe dentro porque no cubre nada, y ponerlo aparte lo convertiría en una
  // nota que nadie relaciona con la barra.
  const anchoCubierto = Math.round((100 * a.cubierto) / a.meta);
  const anchoExcedente = a.excedente ? Math.max(2, Math.round((100 * a.excedente) / a.meta)) : 0;

  return (
    <div className="aulas-avance-respuestas">
      <p className="aulas-avance-titular">
        <strong>{fmt(a.cubierto)}</strong> de <strong>{fmt(a.meta)}</strong> respuestas que pide
        el plan · <span className="aulas-avance-pct">{a.avance}%</span>
      </p>
      {/* El hueco entre lo recogido y lo atribuido, DICHO. Hay estudios donde
          llegan miles de respuestas y ninguna se puede colgar de un aula
          —vienen anónimas, sin el enlace que las ata a su curso-horario— y esta
          pantalla enseñaba «3 700 válidas» arriba y «0 de 3 743» aquí, sin nada
          en medio. Se lee como una avería y no lo es: es una propiedad de la
          fuente, y el panel la sabe. */}
      {validasTotales > 0 && a.validas === 0 ? (
        <p className="aulas-avance-sin-atribuir">
          Las <strong>{fmt(validasTotales)}</strong> respuestas del corte llegan sin identificar
          su curso-horario, así que ninguna cuenta para la meta de un aula.
        </p>
      ) : null}
      <div className="aulas-avance-carril" role="img" aria-label={`${a.avance}% de la meta cubierta`}>
        <span className="aulas-avance-meta">
          <i style={{ width: `${anchoCubierto}%`, background: COLOR_RESULTADO.efectiva }} />
          <i style={{ width: `${100 - anchoCubierto}%`, background: COLOR_RESULTADO.pendiente }} />
        </span>
        {anchoExcedente ? (
          <span className="aulas-avance-excedente" style={{ width: `${anchoExcedente}%` }} />
        ) : null}
      </div>
      <ul className="aulas-avance-mermas" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="es-cubierto">
          <strong>{fmt(a.cubierto)}</strong> cubren meta
        </li>
        <li className="es-falta">
          <strong>{fmt(a.falta)}</strong> faltan, en {fmt(a.aulasConBrecha)} cursos-horario
        </li>
        {a.excedente ? (
          <li className="es-excedente">
            {/* La frase entera: sin ella, «excedente» se lee como logro. */}
            <strong>{fmt(a.excedente)}</strong> de más en aulas que ya cumplieron — no cubren
            la falta de ninguna otra
          </li>
        ) : null}
        {a.sinMeta ? (
          <li className="es-sin-meta">
            {fmt(a.sinMeta)} {a.sinMeta === 1 ? "curso-horario no declara" : "cursos-horario no declaran"} su
            meta y quedan fuera de esta cuenta
          </li>
        ) : null}
      </ul>
    </div>
  );
}
