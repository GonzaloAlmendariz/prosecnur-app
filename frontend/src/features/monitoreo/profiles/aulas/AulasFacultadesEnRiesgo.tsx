import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import { fechaEnPalabras } from "./fichaDeCursoHorario";
import { fmt } from "./kpisDeAulas";
import { facultadesEnRiesgo } from "./facultadesEnRiesgo";
import "./aulasFacultadesEnRiesgo.css";

/**
 * **Las facultades que el ranking de rendimiento no puede ver.**
 *
 * Gonzalo, 2026-09-11, mirando el ranking: «si en Gestión falta y estamos por
 * debajo de lo esperado, ¿por qué no se notifica aquí, o ni siquiera aparece
 * esa facultad?».
 *
 * Por dos motivos, y los dos son el mismo hueco: Gestión tiene **un**
 * curso-horario aplicado y el ranking exige tres para comparar, así que entraba
 * en un «5 quedan fuera» sin nombre; y aunque tuviera campo, ese ranking
 * compara tasas y Gestión no está mal de tasa —está mal de agenda: sus 5
 * cursos-horario pendientes esperan traer 94 contra una cuota de 105—.
 *
 * Este panel contesta lo otro: **quién no va a llegar con lo que tiene por
 * delante, y quién todavía no puede saberlo.**
 */
export function AulasFacultadesEnRiesgo({ bloque, celdasDeCuota, plan, facultadEnFoco, onFoco }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  celdasDeCuota: ReadonlyArray<Record<string, unknown>> | null | undefined;
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  facultadEnFoco?: string | null;
  onFoco?: (facultad: string) => void;
}): ReactNode {
  const filas = facultadesEnRiesgo(bloque, celdasDeCuota, plan);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Ninguna facultad se queda corta con lo que tiene agendado, y todas
        llevan campo suficiente para medirse con su propia tasa.
      </p>
    );
  }

  const cortas = filas.filter((f) => f.aviso === "agenda_corta").length;
  const ciegas = filas.length - cortas;
  const foco = (facultadEnFoco ?? "").trim();

  return (
    <div className="aulas-riesgo" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-riesgo-lectura">
        {/* **La base, dicha.** Arriba, «Rendimiento y efectividad» proyecta
            sobre todo el eslabón en juego —reservas incluidas— y dice que
            todas cierran. Éste cuenta sólo lo que tiene fecha, que es lo que se
            puede aplicar sin activar nada. Sin decirlo, las dos frases se leen
            como una contradicción. */}
        {cortas ? (
          <><strong>{fmt(cortas)}</strong>{" "}
            {cortas === 1 ? "facultad no llega" : "facultades no llegan"} a su cuota con
            lo que tiene <b>agendado hoy</b>: el resto tendría que salir de sus reservas.</>
        ) : null}
        {ciegas ? (
          <>{cortas ? " " : ""}<strong>{fmt(ciegas)}</strong>{" "}
            {ciegas === 1 ? "no tiene" : "no tienen"} campo suficiente para medirse
            con tasa propia: lo que se les prevé sale del perfil del estudio.</>
        ) : null}
      </p>

      <ul className="aulas-riesgo-lista">
        {filas.map((f) => {
          const corta = f.aviso === "agenda_corta";
          return (
            <li
              key={f.clave || f.facultad}
              className={`${corta ? "es-corta" : "es-ciega"}${f.facultad === foco ? " es-foco" : ""}`}
            >
              <span className="aulas-riesgo-marca">{corta ? "No llega" : "Sin medir"}</span>
              <span className="aulas-riesgo-quien">
                {onFoco ? (
                  <button type="button" onClick={() => onFoco(f.facultad)}>{facultadCorta(f.facultad)}</button>
                ) : <b>{facultadCorta(f.facultad)}</b>}
                <em>
                  {f.aplicados === 0
                    ? "sin cursos-horario aplicados"
                    : `${fmt(f.aplicados)} ${f.aplicados === 1 ? "aplicado" : "aplicados"}`}
                  {" · "}{fmt(f.logrado)} de {fmt(f.meta)} respuestas
                </em>
              </span>
              <span className="aulas-riesgo-dice">
                {corta ? (
                  // La cuenta entera, porque es la que justifica activar una
                  // reserva: lo agendado, lo que traería y lo que faltaría igual.
                  <>Sus <b>{fmt(f.cursosEnCamino)}</b> {f.cursosEnCamino === 1
                    ? "curso-horario agendado espera" : "cursos-horario agendados esperan"} traer{" "}
                    <b>{fmt(f.enCamino)}</b>: le {f.quedaria === 1 ? "faltaría" : "faltarían"}{" "}
                    <b className="es-falta">{fmt(f.quedaria)}</b> aunque todos salgan bien.</>
                ) : f.cursosEnCamino ? (
                  // Lo que está en juego y con qué margen: «trae 35 para los 20
                  // que faltan» dice a la vez que alcanza y que nadie lo ha
                  // comprobado en esa facultad.
                  <>Vuelve a medirse el <b>{fechaEnPalabras(f.proximaFecha)}</b>: sus{" "}
                    <b>{fmt(f.cursosEnCamino)}</b> {f.cursosEnCamino === 1
                      ? "curso-horario agendado espera" : "cursos-horario agendados esperan"} traer{" "}
                    <b>{fmt(f.enCamino)}</b> para {f.falta === 1
                      ? <>la respuesta que le falta</> : <>las <b>{fmt(f.falta)}</b> que le faltan</>}
                    {/* **De dónde sale ese número.** Sin campo el motor no
                        proyecta —caer a la tasa prevista publicaría el supuesto
                        como medición— y esta cifra la estima el perfil. */}
                    {f.medido ? "." : ", con una tasa prestada: en esta facultad todavía no se ha comprobado ninguna."}</>
                ) : (
                  // El caso que de verdad urge: sin campo y sin nada agendado,
                  // nadie va a medirla si no se activa una reserva.
                  <>No tiene ningún curso-horario agendado: sin activar una reserva
                    no hay fecha en la que pueda medirse.</>
                )}
              </span>
              <span className="aulas-riesgo-reservas">
                <b>{fmt(f.reservasLibres)}</b>
                <em>{f.reservasLibres === 1 ? "reserva libre" : "reservas libres"}</em>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="aulas-riesgo-pie">
        Lo que se espera de un curso-horario agendado es una proyección sobre su
        padrón, no un hecho: sirve para decidir a quién reforzar hoy, no para dar
        una cuota por cubierta. Las reservas no se comparten entre facultades.
      </p>
    </div>
  );
}
