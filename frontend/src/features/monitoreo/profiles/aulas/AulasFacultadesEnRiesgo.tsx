import type { ReactNode } from "react";

import type { MonitoreoAulasPlanRow, MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";
import { facultadCorta } from "./facultadEnPalabras";
import type { RiesgoDeFacultad } from "./facultadesEnRiesgo";
import { fechaEnPalabras } from "./fichaDeCursoHorario";
import { fmt } from "./kpisDeAulas";
import { citasVencidas, facultadesEnRiesgo, gestionesSinVia, rechazoDelOperativo } from "./facultadesEnRiesgo";
import { pctPerfil } from "./kpisDeAulas";
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
/**
 * **Qué gestiones hay que cubrir con reserva SIN esperar a que fallen.**
 *
 * Gonzalo, 2026-09-11: «si vemos que los titulares no confirman, poder ir
 * reforzando con reemplazos disponibles», y la premisa de la que parte: «un
 * refuerzo tampoco es una aplicación garantizada». Justamente porque la reserva
 * necesita su propio contacto y confirmación, esperar a que el titular falle
 * del todo llega tarde.
 *
 * Se separan porque no son lo mismo: sin teléfono válido no hay gestión que
 * madure —es una baja de hecho— y una gestión estancada todavía puede cerrar,
 * sólo que ya no conviene apostarlo todo a ella.
 */
function AvisoDeCubrir({ fila }: { fila: RiesgoDeFacultad }): ReactNode {
  if (!fila.cursosSinVia && !fila.cursosEstancados) {
    return fila.cursosSinAgendar === 1
      ? <>Si no cierra, queda su reserva.</>
      : <>Si no cierran, quedan sus reservas.</>;
  }
  return (
    <b className="aulas-riesgo-cubrir">
      {fila.cursosSinVia ? (
        // Con los códigos delante, el aviso deja de ser un diagnóstico y pasa a
        // ser una lista de llamadas que hacer.
        <>{fila.codigosSinVia.length
          ? <>{fila.codigosSinVia.join(", ")}
              {fila.cursosSinVia > fila.codigosSinVia.length
                ? <> y {fmt(fila.cursosSinVia - fila.codigosSinVia.length)} más</>
                : null}{" "}
              {fila.cursosSinVia === 1 ? "no tiene" : "no tienen"} teléfono válido</>
          : <><b>{fmt(fila.cursosSinVia)}</b>{" "}
              {fila.cursosSinVia === 1 ? "no tiene" : "no tienen"} teléfono válido</>}</>
      ) : null}
      {fila.cursosSinVia && fila.cursosEstancados ? " y " : null}
      {fila.cursosEstancados ? (
        <><b>{fmt(fila.cursosEstancados)}</b>{" "}
          {fila.cursosEstancados === 1 ? "lleva" : "llevan"} días sin cerrar</>
      ) : null}
      : empieza a cubrir{fila.cursosSinVia + fila.cursosEstancados === 1 ? "la" : "las"} con reserva
      en paralelo, que el refuerzo también tarda en confirmar.
    </b>
  );
}

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

  const rechazo = rechazoDelOperativo(bloque);
  const vencidas = citasVencidas(bloque);
  const sinVia = gestionesSinVia(bloque);
  // Sólo las que no salen ya nombradas en una fila: repetirlas aquí sería
  // contarlas dos veces en la misma pantalla.
  const sinViaFuera = sinVia - filas.reduce((a, f) => a + f.cursosSinVia, 0);
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
                    <b className="es-falta">{fmt(f.quedaria)}</b> aunque todos salgan bien.
                    {/* **Y qué corresponde hacer, que no es lo mismo en las
                        dos.** Sin esto, la única lectura posible de «le faltan
                        91» es pedir refuerzo, y en Derecho el aforo ya existe:
                        lo que falta es fecha. Una reserva gastada de más no
                        vuelve, y no se comparte entre facultades. */}
                    {/* **Por dónde empezar, no qué excluir.** Gonzalo,
                        2026-09-11: «el toca agendar a veces puede que no logre
                        agendar sobre los titulares, por lo que aplicar
                        refuerzos; y a los refuerzos también se les contacta y
                        recién se agenda previa su confirmación, por lo que no
                        es una aplicación asegurada». El consejo dice el orden y
                        el riesgo de cada vía, no una sola puerta. */}
                    {f.loQueToca === "agendar" ? (
                      <span className="aulas-riesgo-toca es-agendar">
                        {/* **Tres redacciones, porque son tres situaciones.** Con
                            todo lo que queda ya en gestión, «empieza por tus 2 —
                            pero 2 están en gestión» se contradice a sí mismo; y
                            en singular, «sus 1 curso-horario […] no gastan
                            reserva» no concuerda. Visto en pantalla el
                            2026-09-11 en Psicología y Ciencias Sociales. */}
                        {!f.cursosSinAgendar ? (
                          <>Con su plan completo cerraría: el hueco es de agenda, no de aforo.{" "}</>
                        ) : f.cursosEnGestion >= f.cursosSinAgendar ? (
                          <>{f.cursosSinAgendar === 1
                            ? <>El curso-horario que le queda sin fecha bastaría, y ya está en
                                gestión sin cerrar.</>
                            : <>Los <b>{fmt(f.cursosSinAgendar)}</b> que le quedan sin fecha
                                bastarían, y ya están todos en gestión sin cerrar.</>}{" "}</>
                        ) : (
                          <>{f.cursosSinAgendar === 1
                            ? <>Empieza por el curso-horario que le queda sin fecha: bastaría y no
                                gasta reserva.</>
                            : <>Empieza por sus <b>{fmt(f.cursosSinAgendar)}</b> cursos-horario sin
                                fecha, que bastarían y no gastan reserva
                                {f.cursosEnGestion
                                  ? <> —<b>{fmt(f.cursosEnGestion)}</b> ya{" "}
                                      {f.cursosEnGestion === 1 ? "está" : "están"} en gestión—</>
                                  : null}.</>}{" "}</>
                        )}
                        <AvisoDeCubrir fila={f} />
                      </span>
                    ) : f.loQueToca === "reforzar" ? (
                      <span className="aulas-riesgo-toca es-reforzar">
                        Ni agendando {f.cursosSinAgendar
                          ? <>{f.cursosSinAgendar === 1 ? "el que le queda" : <>los <b>{fmt(f.cursosSinAgendar)}</b> que le quedan</>} sin fecha</>
                          : "el resto de su plan"} llegaría: hay que contactar docentes
                        de cursos-horario de refuerzo ya, además de cerrar lo que esté en
                        gestión.{" "}
                        <AvisoDeCubrir fila={f} />
                      </span>
                    ) : null}</>
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
        {/* **Y lo planificado tampoco es aforo seguro.** Gonzalo, 2026-09-11:
            «hasta que no esté agendado no sabemos realmente si vamos a poder
            aplicar allí». Se dice con lo ya ocurrido, no con una previsión. */}
        {/* **Las citas que se pasaron.** No entran en la proyección —una fecha
            que pasó no es un día en que aplicar— y aquí se dicen, porque lo que
            piden es reagendarlas o darlas por caídas. */}
        {/* **Las que no caen en ninguna facultad listada.** Una cita que no se
            puede concertar es trabajo perdido aunque su facultad vaya sobrada:
            de las 6 del estudio, 3 no aparecían en ningún sitio. */}
        {sinViaFuera > 0 ? (
          <> Fuera de estas facultades hay <b>{fmt(sinViaFuera)}</b>{" "}
            {sinViaFuera === 1 ? "gestión más sin teléfono válido" : "gestiones más sin teléfono válido"}:
            tampoco {sinViaFuera === 1 ? "va a cerrar" : "van a cerrar"} sola
            {sinViaFuera === 1 ? "" : "s"}.</>
        ) : null}
        {vencidas ? (
          <> <b>{fmt(vencidas.cursos)}</b>{" "}
            {vencidas.cursos === 1 ? "cita se pasó" : "citas se pasaron"} sin aplicarse
            ({fmt(vencidas.elegibles)} alumnos): no cuentan en ninguna proyección hasta
            que se reagenden.</>
        ) : null}
        {/* **Ni el titular ni el refuerzo son aforo asegurado.** El refuerzo
            pasa por el mismo embudo: se le contacta, confirma, y recién
            entonces se agenda. Sin decirlo, «activa una reserva» se lee como
            «ya tienes las respuestas». */}
        {" "}Un curso-horario del plan sin fecha todavía no es una aplicación —y un
        refuerzo tampoco: también hay que contactarlo y sólo se agenda cuando el
        docente confirma—. El docente puede rechazar
        {rechazo
          ? <>, y en este operativo lo {rechazo.rechazos === 1 ? "ha hecho" : "han hecho"}{" "}
            <b>{fmt(rechazo.rechazos)}</b> de {fmt(rechazo.resueltos)} titulares
            ya contactados ({pctPerfil(rechazo.porCiento)}).</>
          : "."}
      </p>
    </div>
  );
}
