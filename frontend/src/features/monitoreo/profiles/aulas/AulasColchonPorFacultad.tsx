import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { colchonPorFacultad, SIN_VALOR_DEL_EJE } from "./consumoDeCadena";
import {
  etiquetaDelEje, etiquetaPluralDelEje, etiquetaSinValorDelEje,
  etiquetaDeValorEnGrafico, type EjeDeclarado,
} from "./etiquetaDelEje";
import { fmt } from "./kpisDeAulas";

/**
 * Dónde se está quedando sin reservas el operativo.
 *
 * La franja de consumo contesta si el plan aguanta; ésta, dónde se rompe. Son
 * preguntas distintas porque **la cuota es por facultad**: un operativo con
 * veinte reservas libres puede tener una facultad a cero, y esa facultad no
 * cierra su cuota por muchas reservas que sobren en las otras.
 *
 * De 11 a 20 facultades es lo normal, así que cada facultad es UNA línea y las
 * de riesgo abren la lista.
 */

export function AulasColchonPorFacultad({ filas, eje }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * La declaración del eje (`avance_cuota.eje`), que decide por qué columna se
   * agrupa y con qué palabra se dice. Es la misma generalización que su hermano
   * «Consumo de la reserva»: sin ella, en un estudio de una sola facultad este
   * panel cae a UNA línea y deja de contestar su única pregunta —dónde se rompe
   * la reserva—.
   */
  eje?: EjeDeclarado;
}) {
  const columna = eje?.columna || "faculty";
  const facultades = useMemo(() => colchonPorFacultad(filas, columna), [filas, columna]);
  const unidad = etiquetaDelEje(eje).toLocaleLowerCase("es");
  const unidades = etiquetaPluralDelEje(eje).toLocaleLowerCase("es");
  const nombre = (valor: string) =>
    valor === SIN_VALOR_DEL_EJE ? etiquetaSinValorDelEje(eje) : etiquetaDeValorEnGrafico(valor, eje);

  if (!facultades.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {`El plan todavía no reparte cursos-horario por ${unidad}.`}
      </p>
    );
  }

  const conAgotadas = facultades.filter((f) => f.agotadas > 0).length;
  const cadenasNuncaTuvo = facultades.reduce((s, f) => s + f.nuncaTuvo, 0);
  // La escala se comparte entre todas las líneas: si cada barra se normalizara
  // a su propia facultad, la que tiene 2 reservas se vería igual de larga que
  // la que tiene 30 y la comparación —que es para lo que existe la lista— diría
  // lo contrario de lo que pasa.
  const tope = Math.max(1, ...facultades.map((f) => f.libres + f.gastadas));

  return (
    <div className="aulas-colchon">
      {/* Las dos cifras NO se suman: la primera es del operativo —gastó lo que
          tenía— y la segunda del diseño muestral, que nunca dotó esas cadenas.
          Juntas dirían que el campo se comió un colchón que jamás existió. */}
      <p className="aulas-colchon-lectura">
        {conAgotadas
          ? <>
              <strong>{fmt(conAgotadas)}</strong>{" "}
              {conAgotadas === 1 ? `${unidad} agotó` : `${unidades} agotaron`} la
              reserva de alguna de sus cadenas
            </>
          : <>{`Ningún grupo de ${unidad} ha agotado la reserva de una cadena.`}</>}
        {cadenasNuncaTuvo
          ? <> · el plan dejó <strong>{fmt(cadenasNuncaTuvo)}</strong> {cadenasNuncaTuvo === 1 ? "curso-horario" : "cursos-horario"} sin
              ninguna reserva desde el diseño</>
          : null}
      </p>
      <ul
        role="table"
        aria-label={`Reservas por ${unidad}`}
        className="aulas-colchon-lista"
        data-qa-geometry-capacity="owned"
        data-qa-geometry-member
      >
        {/* Roles de tabla sobre la rejilla, no `<table>`: el defecto era la
            cabecera oculta, no la maquetación. */}
        <li className="aulas-colchon-cabecera" role="row">
          <span role="columnheader">{etiquetaDelEje(eje)}</span>
          <span role="columnheader">Reservas gastadas y libres</span>
          <span role="columnheader">Agotadas</span>
          <span role="columnheader">Sin dotar</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad} role="row" className={f.agotadas ? "es-riesgo" : "es-cubierta"}>
            {/* La clave del grupo vacío es un centinela, no un rótulo: quien
                pinta le pone la palabra, y cuál es la palabra lo dice el eje. */}
            <span role="rowheader" className="aulas-colchon-nombre" title={nombre(f.facultad)}>
              {nombre(f.facultad)}
              <em>{fmt(f.titulares)} {f.titulares === 1 ? "curso-horario" : "cursos-horario"}</em>
            </span>
            {/* La barra conserva su `role="img"` dentro de una celda propia: si
                el rol de celda fuera suyo, el lector perdería la posición. */}
            <span role="cell" className="aulas-colchon-barra-celda">
            <span
              className="aulas-colchon-barra"
              role="img"
              aria-label={`${fmt(f.gastadas)} reservas gastadas y ${fmt(f.libres)} libres`}
            >
              {f.gastadas ? (
                <i style={{ width: `${(100 * f.gastadas) / tope}%`, background: COLOR_RESULTADO.rechazo }}>
                  {f.gastadas}
                </i>
              ) : null}
              {f.libres ? (
                <i style={{ width: `${(100 * f.libres) / tope}%`, background: COLOR_RESULTADO.efectiva }}>
                  {f.libres}
                </i>
              ) : null}
              {/* Sin barra no se distingue «no le dieron reservas» de «se las
                  gastó todas», y son dos problemas distintos: el primero es del
                  diseño muestral y el segundo del operativo. */}
              {!f.gastadas && !f.libres ? <em>el plan no le dio reservas</em> : null}
            </span>
            </span>
            <span role="cell" className="aulas-colchon-riesgo">
              {f.agotadas ? <strong>{fmt(f.agotadas)}</strong> : <em>—</em>}
            </span>
            <span role="cell" className="aulas-colchon-sindotar">
              {f.nuncaTuvo ? fmt(f.nuncaTuvo) : <em>—</em>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-colchon-pie">
        <strong>Agotadas</strong> son cadenas que tenían reserva y ya la usaron;
        <strong> sin dotar</strong>, las que el diseño muestral nunca dotó. La reserva cuenta
        para la facultad del curso-horario que reemplaza. Los extras no aparecen acá: no reponen a
        nadie y su reparto por facultad está en su pestaña.
      </p>
    </div>
  );
}
