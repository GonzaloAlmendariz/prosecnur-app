import type { ReactNode } from "react";
import { pctPerfil } from "./kpisDeAulas";

import { representatividadEfectiva } from "./representatividadEfectiva";
import "./aulasRepresentatividad.css";

/**
 * Si la muestra que se está aplicando sigue pareciéndose a la que se sorteó.
 *
 * Es la otra mitad de «Estratos», y hasta el 2026-09-08 no existía: el motor
 * calculaba el bloque `representativity` en cada refresco del estado y **ningún
 * archivo del frontend lo leía**. La pestaña se quedaba con la tabla de avance
 * por estrato, que dice cuánto se ha recogido en cada uno; esto dice otra cosa,
 * que ninguna otra superficie de Avance contesta: si lo recogido **se parece a
 * lo que se pidió**. Un estudio puede ir al 100 % de su cuota con la composición
 * torcida, y al revés.
 *
 * **Barras divergentes, y no una tabla.** La pregunta es «¿cuál se movió y hacia
 * dónde?», que es comparación y signo, no consulta fila a fila: cada estrato
 * sale de una línea central, a la izquierda si le falta peso y a la derecha si
 * le sobra, ordenados por magnitud. Una tabla de 73 filas con dos proporciones y
 * una resta obligaría a hacer la comparación de cabeza, que es exactamente lo
 * que la sección hacía mal.
 *
 * Los que no se movieron no se pintan —una barra de cero no es un dato— pero **sí
 * se cuentan**: sin esa cifra, «tres estratos desviados» no distingue tres de
 * cuatro de tres de setenta.
 */
export function AulasRepresentatividad({ bloque }: {
  bloque: Record<string, unknown> | null | undefined;
}): ReactNode {
  const vista = representatividadEfectiva(bloque);

  if (vista.vacio !== null) {
    // El vacío se clasifica y nombra su causa (C3). Cuando el motor tiene la
    // suya —«Sin datos suficientes para distancia efectiva»— se repite la suya,
    // no se redacta otra.
    return <p className="mon-profile-muted aulas-repr-vacio">{vista.vacio}</p>;
  }

  // La escala del carril es el desvío MÁS GRANDE, no un tope fijo: con desvíos
  // de décimas de punto un eje de 0 a 10 pp dejaría todas las barras invisibles,
  // y con uno de 30 pp un eje corto las saturaría todas por igual.
  const tope = Math.max(...vista.desvios.map((d) => d.magnitud), 0.1);

  return (
    <div className="aulas-repr">
      <div className="aulas-repr-cabeza">
        <p className="aulas-repr-puntaje">
          <strong>{vista.efectivo === null ? "—" : vista.efectivo.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong>
          <span> de 100</span>
        </p>
        <p className="aulas-repr-lectura">
          La muestra que se está aplicando se desvía{" "}
          <strong>{vista.desvioMedio === null ? "—" : `${vista.desvioMedio.toLocaleString("es-PE", { maximumFractionDigits: 1 })} pp`}</strong>{" "}
          en promedio de la que sorteó el diseño
          {vista.cursosHorarioEnPie !== null && vista.cursosHorarioDelSorteo !== null
            ? ` · ${vista.cursosHorarioEnPie.toLocaleString("es-PE")} cursos-horario en pie de los ${vista.cursosHorarioDelSorteo.toLocaleString("es-PE")} del sorteo`
            : ""}
          {". "}
          <span className="aulas-repr-escala">100 es composición idéntica; 0 es una desviación media de 5 pp o más.</span>
        </p>
        {/* El aviso lo redacta el motor y viaja tal cual: quién decide qué es una
            desviación grave es él, no esta pantalla. */}
        {vista.aviso ? <p className="aulas-repr-aviso">{vista.aviso}</p> : null}
      </div>

      <ol className="aulas-repr-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {vista.desvios.map((d) => (
          <li key={d.clave} title={`Diseñado ${pctPerfil(d.disenada * 100)} · aplicándose ${pctPerfil(d.efectiva * 100)}`}>
            <span className="aulas-repr-rotulo">{d.etiqueta}</span>
            <span className="aulas-repr-carril" role="img"
              aria-label={`${d.etiqueta}: ${d.desvio > 0 ? "sobra" : "falta"} ${Math.abs(d.desvio).toFixed(1)} puntos porcentuales`}>
              {/* Una sola barra que arranca del centro. El lado lo da el signo y
                  el largo la magnitud contra el mayor desvío de la lista. */}
              <i
                data-lado={d.desvio > 0 ? "sobra" : "falta"}
                style={{ width: `${(d.magnitud / tope) * 50}%` }}
              />
            </span>
            <span className="aulas-repr-cifra" data-lado={d.desvio > 0 ? "sobra" : "falta"}>
              {d.desvio > 0 ? "+" : "−"}{Math.abs(d.desvio).toLocaleString("es-PE", { maximumFractionDigits: 1 })} pp
            </span>
          </li>
        ))}
      </ol>

      <p className="aulas-repr-pie">
        {vista.sinMoverse > 0
          ? `Los otros ${vista.sinMoverse.toLocaleString("es-PE")} estratos conservan su peso del sorteo.`
          : "Todos los estratos del sorteo se han movido."}
      </p>
    </div>
  );
}
