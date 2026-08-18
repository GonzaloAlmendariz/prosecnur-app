import { useMemo } from "react";
import type { CSSProperties } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { historiaDeCadena, type EslabonDeCadena, type HistoriaDeCadena } from "./historiaDeCadena";

/**
 * Cómo llegó cada cadena a su meta —o por qué sigue abierta.
 *
 * Contesta las tres preguntas del cierre en el orden en que se hacen: si
 * cumplimos con el titular, cómo fue su reemplazo, y cuál de los dos cerró.
 */

/** Un eslabón: código, sus efectivas contra su meta, y si cerró. */
function Eslabon({ eslabon, cerro }: { eslabon: EslabonDeCadena; cerro: boolean }) {
  return (
    <li className={`aulas-eslabon${cerro ? " es-cierre" : ""}${eslabon.orden === 0 ? " es-titular" : ""}`}>
      <span className="aulas-eslabon-codigo">{eslabon.codigo}</span>
      <span className="aulas-eslabon-rol">
        {/* `EN RESERVA n` es como el Excel numera el eslabón. */}
        {eslabon.orden === 0 ? "titular" : `en reserva ${eslabon.orden}`}
      </span>
      <span className="aulas-eslabon-cifra">
        {eslabon.validas} de {eslabon.meta}
      </span>
      {cerro ? <span className="aulas-eslabon-sello">cumple</span> : null}
    </li>
  );
}

/**
 * Lo más cerca que llegó una cadena abierta, o nada si nadie se movió.
 */
function loMasCerca(historia: HistoriaDeCadena) {
  if (!historia.validas) return null;
  return historia.eslabones.reduce((a, b) => (
    (b.meta > 0 ? b.validas / b.meta : 0) > (a.meta > 0 ? a.validas / a.meta : 0) ? b : a
  ));
}

/**
 * Las cadenas abiertas, en TABLA.
 *
 * Eran veintiuna tarjetas con borde, radio de tarjeta y franja de color, todas
 * diciendo «1 reserva · sin una sola respuesta»: un muro de cápsulas idénticas
 * en el que no se distingue una fila de otra ni se puede comparar nada. Y es
 * justo la sección donde Gonzalo pidió tablas —«mira cómo los demás monitoreos
 * usan tablas en consultas y en lo demás usan cosas más visuales»—.
 *
 * En columnas alineadas la lista vuelve a ser legible: el ojo baja por
 * «Reservas» y por «Lo más cerca» y ve dónde queda margen sin leer veintiún
 * párrafos. Las que SÍ cerraron conservan su forma narrada, porque ahí cada
 * cadena cuenta algo distinto y son tres, no veintiuna.
 */
function CadenasAbiertas({ historias }: { historias: ReadonlyArray<HistoriaDeCadena> }) {
  return (
    <div className="mon-profile-table-wrap" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <table className="mon-profile-table aulas-cadenas-tabla">
        <thead>
          <tr>
            {/* `scope="col"` en todas: la tabla del control ya lo declaraba y
                éstas no, así que el perfil tenía dos tablas de datos con dos
                criterios. Sin él, un lector de pantalla no sabe qué encabezado
                gobierna cada celda salvo que lo adivine. */}
            <th scope="col">Curso-horario</th>
            <th scope="col">Facultad</th>
            <th scope="col" className="es-cifra">Reservas</th>
            <th scope="col" className="es-cifra">Válidas</th>
            <th scope="col" className="es-cifra">Meta</th>
            <th scope="col">Lo más cerca</th>
          </tr>
        </thead>
        <tbody>
          {historias.map((historia) => {
            const mejor = loMasCerca(historia);
            return (
              <tr key={historia.titular}>
                <td><strong>{historia.titular}</strong></td>
                <td>{historia.facultad}</td>
                <td className="es-cifra">{historia.eslabones.length - 1}</td>
                <td className="es-cifra">{historia.validas}</td>
                <td className="es-cifra">{historia.meta}</td>
                <td>
                  {/* «—» y no una frase: en el operativo real casi ninguna
                      cadena abierta recibió respuestas, y repetir veintiuna
                      veces «nadie recibió respuestas» grita más que el dato.
                      El hecho se dice UNA vez, en la lectura de arriba. */}
                  {mejor ? `${mejor.codigo}, ${mejor.validas} de ${mejor.meta}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Los grupos, en el orden en que se decide: primero lo que hay que resolver,
 * después lo que ya se resolvió y sirve de registro. `titular` no lleva grupo
 * propio porque una cadena que cerró con su titular no consumió reserva: se
 * cuenta en la lectura de arriba y no ocupa una sección.
 */
const GRUPOS = [
  { desenlace: "abierta" as const, titulo: "Sin cerrar" },
  { desenlace: "reemplazo" as const, titulo: "Cerraron con un reemplazo" },
  { desenlace: "titular" as const, titulo: "Cerraron con el titular" },
];

export function AulasHistoriaCadena({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { historias, sinReserva, cerraronEnTitular, cerraronEnReemplazo, abiertas } =
    useMemo(() => historiaDeCadena(filas), [filas]);
  // Se dice aquí y no en cada fila: es la misma frase para casi todas.
  const sinRespuestaAlguna = historias
    .filter((h) => h.desenlace === "abierta" && !h.validas).length;

  if (!historias.length) {
    return (
      <p className="mon-profile-muted">
        {sinReserva
          // No es lo mismo «no hay plan» que «el diseño no asignó reservas».
          // Decía «ninguno necesitó reemplazo», que suena a la mejor noticia
          // posible y es justo lo contrario: son las aulas que, si caen, no
          // tienen con qué cubrirse.
          ? `Ninguno de los ${sinReserva} cursos-horario titulares tiene reserva asignada.`
          : "El plan todavía no declara cadenas de reemplazo."}
      </p>
    );
  }

  return (
    <div className="aulas-cadenas">
      <p className="aulas-cadenas-lectura">
        <strong>{cerraronEnTitular}</strong> cerraron con el titular ·{" "}
        <strong>{cerraronEnReemplazo}</strong> con un reemplazo ·{" "}
        <strong>{abiertas}</strong> sin cerrar
        {sinReserva ? ` · ${sinReserva} sin reserva asignada` : ""}
        {sinRespuestaAlguna
          ? ` · ${sinRespuestaAlguna} de las abiertas no han recibido ni una respuesta`
          : ""}
      </p>
      {/* Agrupadas por desenlace. Eran 24 cajas idénticas en 1 554 px de alto:
          las tres que cerraron —la respuesta a «cuál fue la cadena que nos
          permitió llegar a la meta»— quedaban enterradas entre veintiuna que se
          ven exactamente igual. Primero las que piden decisión, después las que
          son registro de lo que funcionó. */}
      {GRUPOS.map((grupo) => {
        const propias = historias.filter((h) => h.desenlace === grupo.desenlace);
        if (!propias.length) return null;
        const maxEslabones = propias.reduce((max, h) => Math.max(max, h.eslabones.length), 1);
        return (
          <section key={grupo.desenlace} className="aulas-cadenas-grupo">
            <h4>
              {grupo.titulo}
              <span>{propias.length}</span>
            </h4>
            {/* Las abiertas van en tabla y las cerradas narradas: no es una
                inconsistencia, es que son dos preguntas distintas. En las
                abiertas se compara —quién tiene margen— y en las cerradas se
                lee una historia de tres eslabones. */}
            {grupo.desenlace === "abierta" ? <CadenasAbiertas historias={propias} /> : (
            <ol
              className="aulas-cadenas-lista"
              /* Cuántos eslabones tiene la cadena más larga de ESTE grupo. Con
                 él, el eslabón n.º 2 de una cadena cae bajo el n.º 2 de la de
                 al lado, y la profundidad —cuántos reemplazos hizo falta— se
                 ve por POSICIÓN en vez de leerse contando burbujas. Antes cada
                 burbuja medía según su texto —129, 166 y 222 px— así que el
                 tercero de una cadena caía donde el segundo de otra. */
              style={{ "--aulas-eslabones": maxEslabones } as CSSProperties}
            >
              {propias.map((historia) => (
                <li key={historia.titular} className={`aulas-cadena es-${historia.desenlace}`}>
                  <div className="aulas-cadena-head">
                    <strong>{historia.titular}</strong>
                    <span>{historia.facultad}</span>
                    {/* El desenlace ya lo dice el grupo; en la fila sólo hace
                        falta CUÁL cerró, que es lo que cambia de una a otra. */}
                    {historia.cerro ? <em>cerró {historia.cerro}</em> : null}
                    {/* Una cadena abierta no tiene historia que contar: sus tres
                        eslabones dicen lo mismo. Se resume en una línea y el
                        detalle queda para las que cerraron, que sí la cuentan.
                        Eran 21 cajas de 59 px repitiendo «0 de N» tres veces. */}
                  </div>
                  <ul className="aulas-cadena-eslabones">
                    {historia.eslabones.map((eslabon) => (
                      <Eslabon
                        key={eslabon.codigo}
                        eslabon={eslabon}
                        cerro={eslabon.codigo === historia.cerro}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
