import type { ReactNode } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { fmt } from "./kpisDeAulas";
import { estadoPorRol, sinColocar, type GrupoDeRol, type TramoDeRol } from "./estadoPorRol";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import "./aulasEstadoPorRol.css";

/**
 * «Estado de aplicación», por ROL y con el idioma del libro.
 *
 * Sustituye al eje plano de cinco tramos, que mezclaba tres cosas —el estado de
 * agendamiento, el rol en el sorteo y el desenlace— y por eso metía las 1 173
 * reservas de cadena en un solo cajón. Gonzalo, 2026-09-10: «no entiendo por qué
 * en reserva hay mil ciento sesenta y nueve».
 *
 * **Una barra por ROL, no una sola.** Los tres grupos tienen tamaños que no se
 * comparan —174 titulares contra 1 173 reservas contra 45 del banco—: en una
 * barra común los titulares serían una raya de doce píxeles. Cada barra reparte
 * SU grupo al 100 %, y el tamaño relativo lo dice la cifra del encabezado, que
 * es donde se lee bien.
 */

const TONOS: Record<TramoDeRol["tono"], string> = {
  efectiva: COLOR_RESULTADO.efectiva,
  parcial: COLOR_RESULTADO.parcial,
  pendiente: COLOR_RESULTADO.pendiente,
  rechazo: COLOR_RESULTADO.rechazo,
  revision: COLOR_RESULTADO.revision,
  // Los que ya no piden nada —reemplazados y reservas al aire— van en gris de
  // marca: el color es atención, y gastarlo en lo que no hay que hacer es lo
  // que tenía este panel gritando por 1 169 aulas dormidas.
  apagado: "var(--pulso-border)",
};

function Grupo({ grupo }: { grupo: GrupoDeRol }): ReactNode {
  const huerfanos = sinColocar(grupo);
  const tramos = grupo.tramos.filter((t) => t.aulas > 0);
  return (
    <li className="aulas-epr-grupo">
      <p className="aulas-epr-cabeza">
        <strong>{fmt(grupo.total)}</strong> {grupo.etiqueta}
        <em>{grupo.nota}</em>
      </p>
      {grupo.total > 0 ? (
        <span className="aulas-epr-barra" role="img"
          aria-label={`${grupo.etiqueta}: ${tramos.map((t) => `${t.etiqueta} ${t.aulas}`).join(", ")}`}>
          {tramos.map((t) => (
            <i key={t.clave}
              style={{ width: `${(100 * t.aulas) / grupo.total}%`, background: TONOS[t.tono] }} />
          ))}
        </span>
      ) : null}
      <ul className="aulas-epr-leyenda">
        {tramos.map((t) => (
          <li key={t.clave}>
            <i style={{ background: TONOS[t.tono] }} />
            <span><strong>{fmt(t.aulas)}</strong> {t.etiqueta}</span>
            <em>{t.detalle}</em>
          </li>
        ))}
        {/* **Lo que no cae en ninguna rama se DICE.** El motor ya comprueba en su
            test que los estados de cada rol suman el total, pero el payload puede
            venir de una versión distinta de la que dibuja, y una lista cerrada
            que se traga lo que no reconoce es el defecto más caro de este perfil. */}
        {huerfanos > 0 ? (
          <li className="es-sin-colocar">
            <i style={{ background: COLOR_RESULTADO.revision }} />
            <span><strong>{fmt(huerfanos)}</strong> sin clasificar</span>
            <em>el motor los cuenta en el total y no en ningún estado: hay una versión por medio</em>
          </li>
        ) : null}
      </ul>
    </li>
  );
}

export function AulasEstadoPorRol({ dashboard, facultadEnFoco }: {
  dashboard: MonitoreoAulasDashboard | null | undefined;
  /** Con una facultad en foco, el panel enseña SÓLO la suya. */
  facultadEnFoco?: string;
}): ReactNode {
  const grupos = estadoPorRol(dashboard, facultadEnFoco);
  // C3: el vacío nombra SU causa. «No hay datos» y «este tablero se generó con
  // una versión anterior del cálculo» se arreglan de maneras distintas.
  if (!grupos) {
    // Los dos vacíos son distintos y se arreglan de maneras distintas (C3): una
    // facultad sin cursos-horario no es un tablero viejo.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {facultadEnFoco
          ? `El sorteo no dejó ningún curso-horario en ${facultadEnFoco}.`
          : "Este tablero se generó con una versión anterior del cálculo, que todavía no reparte los cursos-horario por rol. Vuelve a traer respuestas para recalcularlo."}
      </p>
    );
  }
  return (
    <div className="aulas-epr" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <ul className="aulas-epr-grupos">
        {grupos.map((g) => <Grupo key={g.clave} grupo={g} />)}
      </ul>
    </div>
  );
}
