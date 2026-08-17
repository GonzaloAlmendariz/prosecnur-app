import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { historiaDeCadena, type EslabonDeCadena } from "./historiaDeCadena";

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

export function AulasHistoriaCadena({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { historias, sinMovimiento, cerraronEnTitular, cerraronEnReemplazo, abiertas } =
    useMemo(() => historiaDeCadena(filas), [filas]);

  if (!historias.length) {
    return (
      <p className="mon-profile-muted">
        {sinMovimiento
          // No es lo mismo «no hay plan» que «ningún curso-horario necesitó
          // reemplazo», que es la mejor noticia posible del operativo.
          ? `Ninguno de los ${sinMovimiento} cursos-horario titulares necesitó reemplazo.`
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
        {sinMovimiento ? ` · ${sinMovimiento} no necesitaron reemplazo` : ""}
      </p>
      <ol className="aulas-cadenas-lista">
        {historias.map((historia) => (
          <li key={historia.titular} className={`aulas-cadena es-${historia.desenlace}`}>
            <div className="aulas-cadena-head">
              <strong>{historia.titular}</strong>
              <span>{historia.facultad}</span>
              <em>
                {historia.desenlace === "abierta"
                  ? "sin cerrar"
                  : `cerró ${historia.cerro}`}
              </em>
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
    </div>
  );
}
