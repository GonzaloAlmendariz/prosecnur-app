import { useMemo } from "react";

import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { produccionPorAplicador } from "./produccionPorAplicador";
import { fmt } from "./kpisDeAulas";

/**
 * Cómo trabaja cada equipo.
 *
 * Vive en Validación porque es lo que el jefe de campo viene a ver: qué está
 * rindiendo cada aplicador y si alguno tiene un problema de calidad. Existía
 * sólo como el cuarto de nueve paneles en Avance, midiendo encuestas por aula.
 *
 * **La banda manda sobre el ranking.** Con ~25 aulas por equipo y una
 * dispersión de casi 9 encuestas, una diferencia de cinco entre el primero y el
 * último cabe entera en el ruido. La lista se ordena, sí, pero lo que se dice en
 * grande es si alguien se separa de verdad — y cuando nadie se separa, eso es
 * el hallazgo, no un vacío.
 */

// Se llamaba `fmt`, igual que el formateador de enteros que usan los otros
// treinta archivos del perfil, y hacía otra cosa: aquí SÍ hay decimal, porque
// «2,4 días de respuesta» es el dato. Dos comportamientos bajo el mismo nombre
// obligan a abrir el archivo para saber cuál manda.
const fmtUnDecimal = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
/**
 * Las medias SIEMPRE con un decimal.
 *
 * Sin esto, un equipo con media exacta salía «23» entre un «23,8» y un «21,9»:
 * en una columna tabular, la cifra sin decimal se lee como de otra magnitud.
 */
const fmt1 = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function AulasTrabajoDeLosEquipos({ partes }: {
  partes: ReadonlyArray<Readonly<Record<string, unknown>>>;
}) {
  const r = useMemo(() => produccionPorAplicador(partes), [partes]);

  if (!r) {
    // El vacío declara lo mismo que la rama con datos: es un miembro del grupo
    // y posee su hueco. Sin esto, en un estudio sin partes de campo el único
    // miembro visible pasa a ser el encabezado del panel y el gate canta
    // `capacity-drift` sobre sus 4 px de padding — medido con el plan real,
    // tres paneles a la vez.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Los partes no dicen quién aplicó cada aula, así que no hay producción que
        repartir. El aplicador se anota al registrar el aula.
      </p>
    );
  }

  const tope = Math.max(...r.equipos.map((e) => e.porAula), 1);

  return (
    <div className="aulas-equipos" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        {r.distinguibles === 0 ? (
          <>
            Ningún equipo se separa de las <strong>{fmt1(r.mediaDelEstudio)}</strong>{" "}
            encuestas por aula del estudio
          </>
        ) : (
          <>
            <strong>{fmt(r.distinguibles)}</strong>{" "}
            {r.distinguibles === 1 ? "equipo se separa" : "equipos se separan"} de las{" "}
            {fmt1(r.mediaDelEstudio)} encuestas por aula del estudio
          </>
        )}
      </p>
      <ul className="aulas-equipos-lista">
        {r.equipos.map((e) => (
          <li key={e.aplicador} className={e.seDistingue ? "es-distinto" : undefined}>
            <span className="aulas-equipos-nombre">{e.aplicador}</span>
            <span className="aulas-equipos-barra">
              <span style={{
                width: `${(e.porAula / tope) * 100}%`,
                background: e.seDistingue
                  ? (e.porAula >= r.mediaDelEstudio ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.rechazo)
                  : undefined,
              }} />
            </span>
            <span className="aulas-equipos-n"><strong>{fmt1(e.porAula)}</strong></span>
            <span className="aulas-equipos-por">
              por aula en {e.aulas} · ±{fmt1(2 * e.ee)}
              {e.rechazosPorCien !== null && e.rechazosPorCien > 0
                ? ` · ${fmtUnDecimal(e.rechazosPorCien)} rechazos/100`
                : ""}
              {e.duplicadosPorCien !== null && e.duplicadosPorCien > 0
                ? ` · ${fmtUnDecimal(e.duplicadosPorCien)} duplicados/100`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-equipos-pie">
        {/* Qué significa el ± y por qué está. Sin esto, la lista ordenada se lee
            como un ranking de personas. */}
        El ± es lo que puede moverse la media de un equipo por el reparto de
        aulas que le tocó. Cuando dos bandas se solapan, la diferencia entre esos
        equipos no se puede atribuir a cómo trabajan.
        {" "}Rechazos y duplicados van por cada cien encuestas conseguidas: en
        bruto, quien hace más aulas parece siempre el más problemático.
      </p>
    </div>
  );
}
