import type { ReactNode } from "react";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { fmt } from "./kpisDeAulas";
import {
  lecturaDeEfectividad, proyeccionDeLaFacultad, repartoDeSenales, riesgoDeCierre,
} from "./resumenDeEfectividad";
import "./aulasRendimientoYEfectividad.css";

/**
 * El resumen de Rendimiento y Efectividad, que Resumen no tenía.
 *
 * Gonzalo, dos veces: «no estás resumiendo la información ni de rendimiento ni
 * de efectividad… si Resumen tiene que ser un resumen». Las dos pestañas
 * contestan la misma pregunta en dos granos —cuánto deja cada curso-horario— y hasta
 * ahora había que abrirlas para saber si el operativo va a alcanzar con los
 * cursos-horario que tiene.
 *
 * **Dos líneas y una barra, no un tercer gráfico.** Un resumen que reproduce el
 * gráfico de la pestaña no resume: la traslada. Lo que se trae aquí es la
 * comparación —lo que supuso el diseño contra lo que está dando el campo— y su
 * consecuencia —si con lo agendado se cierra—, que son las dos frases con las
 * que se decide por la mañana si hay que pedir aulas.
 *
 * Todas las cifras salen de `efectividad_seguimiento` (ADR 0082), calculado por
 * el motor: aquí no se divide nada.
 */
export function AulasRendimientoYEfectividad({ bloque, fila, facultad = "" }: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  /** La facultad en foco, si la hay. Sin ella se lee el conjunto. */
  fila?: MonitoreoAulasEfectividadFacultad | null;
  facultad?: string;
}): ReactNode {
  const lectura = lecturaDeEfectividad(bloque, fila ?? null);
  if (!lectura) {
    return (
      // La anatomía del vacío del perfil: el wrap exento declara su capacidad.
      <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="mon-profile-muted">
          Este estudio no trae el seguimiento de la tasa prevista, así que no se
          puede contrastar lo que supuso el diseño con lo que está dando el campo.
        </p>
      </div>
    );
  }

  const riesgo = facultad ? null : riesgoDeCierre(bloque);
  // **La otra mitad de lo que hay que resumir.** El carril contesta si el
  // operativo rinde lo que se supuso; esto, si eso es parejo. Una media de 58 %
  // puede ser quince facultades en 58 o siete en 40 y ocho en 75, y las dos
  // piden cosas distintas. Sin foco: con una facultad puesta, el reparto de las
  // quince no es lo que se está mirando.
  const reparto = facultad ? null : repartoDeSenales(bloque);
  const proyeccion = facultad ? proyeccionDeLaFacultad(fila) : null;
  const intervalo = lectura.bandaBajo != null && lectura.bandaAlto != null
    ? `${(lectura.bandaBajo * 100).toFixed(1)} – ${(lectura.bandaAlto * 100).toFixed(1)} %`
    : "";
  /**
   * **Cómo se calculó el intervalo, en el `title` de quien lo enseña.**
   *
   * No es decoración metodológica: es lo que impide leer un IC ancho como un
   * problema de la facultad en vez de como lo que es —pocos cursos-horario
   * aplicados todavía—.
   */
  const comoSeCalcula = "Intervalo de confianza al 95 % de la tasa observada (τ = efectivas ÷ elegibles), "
    + "estimador de razón con los cursos-horario como conglomerados: los elegibles de uno comparten "
    + "profesor, hora y sala, así que no son ensayos independientes. Con menos de dos cursos-horario "
    + "aplicados no hay dispersión que medir y el intervalo no se publica.";

  return (
    <div className="aulas-rye" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className={`aulas-rye-lectura is-${lectura.tono || "sin"}`}>{lectura.frase}</p>
      {/* **Las dos tasas en un carril común**, que es lo que hace visible el
          contraste sin pedir un gráfico: la marca del diseño y la del campo
          sobre la misma regla.
 
          Primera versión: dos rayitas sobre un fondo que no se veía. En pantalla
          eran dos marcas flotando en el aire —sin regla, sin escala y sin la
          banda a la que pertenecen—, así que no se podía saber si 51,4 y 58,1
          estaban cerca o lejos, ni de qué. La regla se dibuja, se rotulan sus
          extremos y la banda se pinta: sólo entonces las marcas están EN algún
          sitio. Una tasa va de 0 a 100 y el carril también, porque comprimirlo
          al tramo con datos exagera la distancia entre las dos. */}
      <div className="aulas-rye-cuerpo">
      {lectura.previsto != null && lectura.observado != null ? (
        <div className="aulas-rye-regla">
          <div className="aulas-rye-carril" role="img" aria-label={lectura.frase}>
            {/* Los tercios de la escala. Sin ellos el lector no sabe si el
                carril va de 0 a 100 o del mínimo al máximo observado. */}
            <span className="aulas-rye-tick" style={{ left: "25%" }} />
            <span className="aulas-rye-tick" style={{ left: "50%" }} />
            <span className="aulas-rye-tick" style={{ left: "75%" }} />
            {/* El IC 95 % de la observada, que es lo que impide leer el punto
                como exacto: con tres cursos-horario aplicados ocupa media
                regla, y eso no es un problema de la facultad — es que todavía
                no hay con qué estrecharlo. */}
            {lectura.bandaBajo != null && lectura.bandaAlto != null ? (
              <span
                className="aulas-rye-banda"
                title={`IC 95 %: ${intervalo}. ${comoSeCalcula}`}
                style={{
                  left: `${Math.min(100, Math.max(0, lectura.bandaBajo * 100))}%`,
                  width: `${Math.min(100, Math.max(0, (lectura.bandaAlto - lectura.bandaBajo) * 100))}%`,
                }}
              />
            ) : null}
            <span
              className="aulas-rye-marca is-previsto"
              title={`El diseño supuso ${((lectura.previsto ?? 0) * 100).toFixed(1)} %`}
              style={{ left: `${Math.min(100, Math.max(0, lectura.previsto * 100))}%` }}
            />
            <span
              className="aulas-rye-marca is-observado"
              title={`El campo está dando ${((lectura.observado ?? 0) * 100).toFixed(1)} %`}
              style={{ left: `${Math.min(100, Math.max(0, lectura.observado * 100))}%` }}
            />
          </div>
          <p className="aulas-rye-escala">
            <span>0 %</span>
            {/* La leyenda va aquí abajo y no flotando sobre las marcas: dos
                rótulos a 6,7 puntos de distancia se pisan, y el perfil ya tiene
                un guard que caza justo eso. */}
            <em>
              <i className="aulas-rye-clave is-previsto" /> diseño
              {" · "}
              <i className="aulas-rye-clave is-observado" /> campo
              {lectura.bandaBajo != null ? (
                <>{" · "}<i className="aulas-rye-clave is-banda" />{" "}
                <abbr title={comoSeCalcula}>IC 95 %</abbr></>
              ) : null}
            </em>
            <span>100 %</span>
          </p>
        </div>
      ) : null}
      {reparto ? (
        /* Al lado del carril y no debajo: son la misma pregunta en dos granos
           —el conjunto y sus partes— y el carril, que sólo ocupa el tramo entre
           el 51 % y el 64 %, dejaba media superficie del panel en blanco. */
        <ul className="aulas-rye-reparto">
          <li><strong>{fmt(reparto.conforme)}</strong> como lo previsto</li>
          {reparto.sobre ? <li><strong>{fmt(reparto.sobre)}</strong> por encima de su vara</li> : null}
          {reparto.bajo ? <li className="es-bajo"><strong>{fmt(reparto.bajo)}</strong> por debajo de su vara</li> : null}
          {reparto.sinVara ? <li className="es-sin"><strong>{fmt(reparto.sinVara)}</strong> sin vara todavía</li> : null}
          <li className="es-pie">de {fmt(reparto.total)} facultades</li>
        </ul>
      ) : null}
      </div>
      <p className="aulas-rye-base">
        {/* De dónde sale la observada. Una tasa sin su base se lee como exacta,
            y con tres cursos-horario aplicados no lo es — por eso viaja su
            intervalo de confianza. */}
        Sobre {fmt(lectura.aulas)} {lectura.aulas === 1 ? "curso-horario aplicado" : "cursos-horario aplicados"}
        {" · "}{fmt(lectura.efectivas)} efectivas de {fmt(lectura.elegibles)} elegibles
        {intervalo ? (
          <> · <abbr title={comoSeCalcula}>IC 95 %</abbr>{" "}
          {lectura.margen != null ? <>± {lectura.margen.toFixed(1)} pts, </> : null}
          {intervalo}</>
        ) : null}
      </p>
      {riesgo ? <p className="aulas-rye-cierre">{riesgo.frase}</p> : null}
      {proyeccion ? <p className="aulas-rye-cierre">{proyeccion.frase}</p> : null}
    </div>
  );
}
