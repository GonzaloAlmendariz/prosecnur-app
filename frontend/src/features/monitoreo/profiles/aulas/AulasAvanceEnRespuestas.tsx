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

export function AulasAvanceEnRespuestas({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const a = useMemo(() => avanceEnRespuestas(filas), [filas]);

  if (!a.meta) {
    return (
      // El vacío dentro de `.mon-profile-table-wrap` y no como `p` suelto, por
      // la misma razón medida en `AulasAvanceCuota`: las reglas del perfil que
      // matan el margen del `p` y ciñen el panel cuelgan del wrap, y el wrap
      // exento (`owned` + member) saca al head del fallback de miembros.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          {a.sinMeta
            ? `Ninguno de los ${a.sinMeta} cursos-horario del plan declara cuántas respuestas espera.`
            : "El plan todavía no declara metas por curso-horario."}
        </p>
      </div>
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
