import { useMemo } from "react";

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
 * Una cadena abierta, en una línea.
 *
 * Sus eslabones no cuentan una historia: todos se quedaron cortos, y en el
 * operativo real casi todos en cero. Lo que sí decide algo es cuánta reserva
 * lleva consumida y si alguno llegó a moverse.
 */
function resumenAbierta(historia: HistoriaDeCadena) {
  const eslabones = historia.eslabones.length;
  const reservas = eslabones - 1;
  const cuantos = reservas === 1 ? "1 reserva" : `${reservas} reservas`;
  if (!historia.validas) {
    // «Ninguno recibió una respuesta» es un caso distinto de «se quedó cerca»,
    // y en el fixture es el de las veintiuna: decirlo evita leer el «0 de 15»
    // de cada eslabón para llegar a la misma conclusión.
    return `${cuantos} · sin una sola respuesta`;
  }
  const mejor = historia.eslabones.reduce((a, b) => (
    (b.meta > 0 ? b.validas / b.meta : 0) > (a.meta > 0 ? a.validas / a.meta : 0) ? b : a
  ));
  return `${cuantos} · lo más cerca, ${mejor.codigo} con ${mejor.validas} de ${mejor.meta}`;
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
      </p>
      {/* Agrupadas por desenlace. Eran 24 cajas idénticas en 1 554 px de alto:
          las tres que cerraron —la respuesta a «cuál fue la cadena que nos
          permitió llegar a la meta»— quedaban enterradas entre veintiuna que se
          ven exactamente igual. Primero las que piden decisión, después las que
          son registro de lo que funcionó. */}
      {GRUPOS.map((grupo) => {
        const propias = historias.filter((h) => h.desenlace === grupo.desenlace);
        if (!propias.length) return null;
        return (
          <section key={grupo.desenlace} className="aulas-cadenas-grupo">
            <h4>
              {grupo.titulo}
              <span>{propias.length}</span>
            </h4>
            <ol className={`aulas-cadenas-lista${grupo.desenlace === "abierta" ? " es-compacta" : ""}`}>
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
                    {grupo.desenlace === "abierta" ? (
                      <em className="aulas-cadena-resumen">{resumenAbierta(historia)}</em>
                    ) : null}
                  </div>
                  <ul className="aulas-cadena-eslabones">
                    {grupo.desenlace === "abierta" ? null : historia.eslabones.map((eslabon) => (
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
          </section>
        );
      })}
    </div>
  );
}
