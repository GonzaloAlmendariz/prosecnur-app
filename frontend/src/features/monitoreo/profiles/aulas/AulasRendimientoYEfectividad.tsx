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
          sobre la misma regla. */}
      {lectura.previsto != null && lectura.observado != null ? (
        <div className="aulas-rye-carril" role="img" aria-label={lectura.frase}>
          <span
            className="aulas-rye-marca is-previsto"
            style={{ left: `${Math.min(100, Math.max(0, lectura.previsto * 100))}%` }}
          />
          <span
            className="aulas-rye-marca is-observado"
            style={{ left: `${Math.min(100, Math.max(0, lectura.observado * 100))}%` }}
          />
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
