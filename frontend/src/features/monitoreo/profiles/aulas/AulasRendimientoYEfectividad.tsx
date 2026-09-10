import type { ReactNode } from "react";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { fmt } from "./kpisDeAulas";
import {
  lecturaDeEfectividad, proyeccionDeLaFacultad, riesgoDeCierre,
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
  const proyeccion = facultad ? proyeccionDeLaFacultad(fila) : null;
  const banda = lectura.bandaBajo != null && lectura.bandaAlto != null
    ? `${(lectura.bandaBajo * 100).toFixed(1)} – ${(lectura.bandaAlto * 100).toFixed(1)} %`
    : "";

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
      {lectura.previsto != null && lectura.observado != null ? (
        <div className="aulas-rye-regla">
          <div className="aulas-rye-carril" role="img" aria-label={lectura.frase}>
            {/* Los tercios de la escala. Sin ellos el lector no sabe si el
                carril va de 0 a 100 o del mínimo al máximo observado. */}
            <span className="aulas-rye-tick" style={{ left: "25%" }} />
            <span className="aulas-rye-tick" style={{ left: "50%" }} />
            <span className="aulas-rye-tick" style={{ left: "75%" }} />
            {/* La banda de la observada, que es lo que impide leer el punto como
                exacto: con tres cursos-horario aplicados ocupa media regla. */}
            {lectura.bandaBajo != null && lectura.bandaAlto != null ? (
              <span
                className="aulas-rye-banda"
                title={`La tasa observada cae entre ${banda}`}
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
              {lectura.bandaBajo != null ? <>{" · "}<i className="aulas-rye-clave is-banda" /> su banda</> : null}
            </em>
            <span>100 %</span>
          </p>
        </div>
      ) : null}
      <p className="aulas-rye-base">
        {/* De dónde sale la observada. Una tasa sin su base se lee como exacta,
            y con tres cursos-horario aplicados no lo es — por eso viaja la banda. */}
        Sobre {fmt(lectura.aulas)} {lectura.aulas === 1 ? "curso-horario aplicado" : "cursos-horario aplicados"}
        {" · "}{fmt(lectura.efectivas)} efectivas de {fmt(lectura.elegibles)} elegibles
        {banda ? <> · la observada cae entre {banda}</> : null}
      </p>
      {riesgo ? <p className="aulas-rye-cierre">{riesgo.frase}</p> : null}
      {proyeccion ? <p className="aulas-rye-cierre">{proyeccion.frase}</p> : null}
    </div>
  );
}
