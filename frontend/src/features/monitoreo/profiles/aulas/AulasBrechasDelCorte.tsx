import type { ReactNode } from "react";

import { brechasDelCorte, repartoDeBrechas, type BrechaDeCurso } from "./brechasDelCorte";
import { fmt, pctPerfil } from "./kpisDeAulas";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import "./aulasBrechasDelCorte.css";

/**
 * «Cursos-horario con brecha», rediseñado sobre el ensayo del 2026-09-10.
 *
 * Gonzalo, viendo la tabla genérica que había: «esas tablas de la aplicación se
 * ven mal»; y del ensayo: «el diseño que tú has generado del artefacto es el
 * que tiene que tener».
 *
 * Tres cosas que la tabla de columnas del payload no podía hacer:
 *
 * - **La severidad se ve antes de leerse.** Una franja de color a la izquierda
 *   dice de un barrido si el aula no se aplicó, si se quedó muy corta o si está
 *   cerca. El número sigue ahí para quien lo necesita.
 * - **«Rinde» se compara contra la tasa prevista de SU facultad.** Un 48 % es
 *   malo donde se preveía 74 y bueno donde se preveía 40; una columna con el
 *   porcentaje pelado no dice ninguna de las dos cosas.
 * - **Cada fila tiene salida.** El botón nombra lo que toca —agendar lo que no
 *   se aplicó, complementar lo que rindió poco— y abre el popover con ese
 *   curso-horario dentro.
 */
export function AulasBrechasDelCorte({ filas, onRelevo }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined;
  /** Abre el popover de candidatos con ese curso-horario. */
  onRelevo?: (codigo: string) => void;
}): ReactNode {
  const brechas = brechasDelCorte(filas);

  if (!brechas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Ningún curso-horario tiene brecha abierta en este corte.
      </p>
    );
  }

  const r = repartoDeBrechas(brechas);
  // La lista es larga —136 en el corte del 10 de setiembre— y se lee de arriba
  // abajo hasta que deja de haber trabajo: se publica lo que pide atención y el
  // resto se cuenta.
  const visibles = brechas.filter((b) => b.severidad !== "cumplida").slice(0, 40);
  const cumplidas = brechas.length - brechas.filter((b) => b.severidad !== "cumplida").length;
  const restantes = brechas.filter((b) => b.severidad !== "cumplida").length - visibles.length;

  return (
    <div className="aulas-brc" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-brc-lectura">
        <strong>{fmt(r.faltanEnTotal)}</strong> respuestas por conseguir en{" "}
        <strong>{fmt(r.total)}</strong> cursos-horario
        {r.sinAplicar ? <> · <strong>{fmt(r.sinAplicar)}</strong> todavía sin aplicar</> : null}
        {r.muyPorDebajo ? <> · <strong>{fmt(r.muyPorDebajo)}</strong> rinden menos de la mitad de lo previsto</> : null}
      </p>

      <div className="aulas-brc-marco">
        <table className="aulas-brc-tabla">
          <caption className="aulas-brc-caption">
            Cursos-horario con brecha, ordenados por lo que hay que atender primero.
          </caption>
          <thead>
            <tr>
              <th scope="col">Curso-horario</th>
              <th scope="col">Cuándo</th>
              <th scope="col" className="es-num">Rinde</th>
              <th scope="col" className="es-num">Faltan</th>
              <th scope="col">Qué toca</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((b) => <Fila key={b.codigo} b={b} onRelevo={onRelevo} />)}
          </tbody>
        </table>
      </div>

      {restantes || cumplidas ? (
        <p className="aulas-brc-pie">
          {restantes ? <>Hay <strong>{fmt(restantes)}</strong> más con brecha abierta, por debajo de éstos. </> : null}
          {cumplidas ? <><strong>{fmt(cumplidas)}</strong> ya cumplieron su meta y no piden nada.</> : null}
        </p>
      ) : null}
    </div>
  );
}

const PALABRA: Record<BrechaDeCurso["severidad"], string> = {
  sin_aplicar: "sin aplicar",
  muy_por_debajo: "muy por debajo",
  por_debajo: "por debajo",
  cerca: "cerca de lo previsto",
  cumplida: "cumplida",
};

function Fila({ b, onRelevo }: { b: BrechaDeCurso; onRelevo?: (codigo: string) => void }): ReactNode {
  const pct = (v: number | null) => (v == null ? "—" : pctPerfil(v * 100));
  return (
    <tr className={`es-${b.severidad}`}>
      <th scope="row" className="aulas-brc-aula">
        {/* La severidad en FORMA y no sólo en número: se barre la columna sin
            leer una cifra. La palabra viaja en el `title` para quien no
            distingue los tonos. */}
        <span className="aulas-brc-severidad" title={PALABRA[b.severidad]} />
        <span className="aulas-brc-quien">
          <b>{b.codigo}</b>
          <em>
            {b.facultad || "Sin facultad"}
            {b.donde ? ` · ${b.donde}` : ""}
            {/* Su composición: decide si un relevo suyo cerraría lo que falta. */}
            {b.mujeres || b.hombres ? ` · ${fmt(b.mujeres)} M · ${fmt(b.hombres)} H` : ""}
          </em>
        </span>
      </th>
      <td>{b.cuando ? <span className="aulas-brc-cuando">{b.cuando}</span> : <span className="aulas-brc-nada">—</span>}</td>
      <td className="es-num">
        {b.severidad === "sin_aplicar" ? (
          <span className="aulas-brc-nada">sin campo</span>
        ) : (
          <span className={`aulas-brc-rinde${b.observada != null && b.prevista != null && b.observada >= b.prevista ? " es-ok" : " es-bajo"}`}>
            <b>{pct(b.observada)}</b>
            {/* Contra lo que preveía SU facultad: sin esa referencia, el
                porcentaje no dice si es bueno o malo. */}
            <em>de {pct(b.prevista)} previsto</em>
          </span>
        )}
      </td>
      <td className="es-num"><b className="aulas-brc-faltan">{fmt(b.faltan)}</b></td>
      <td>
        {b.accion === "nada" ? (
          <span className="aulas-brc-nada">ya cumplió</span>
        ) : (
          <button
            type="button"
            className="aulas-brc-boton"
            onClick={() => onRelevo?.(b.codigo)}
            /* El botón nombra lo que toca: agendar lo que no se aplicó,
               complementar lo que se aplicó y rindió poco. Complementar la que
               nadie visitó sería gastar una reserva por un hueco que nadie ha
               intentado llenar. */
            title={b.accion === "reemplazo"
              ? "Todavía no se ha ido a este curso-horario: lo que toca es agendarlo, y si no sale, buscarle relevo."
              : "Se aplicó y se quedó corto: se le suma una reserva y los dos cuentan."}
          >
            {b.accion === "reemplazo" ? "Buscar relevo" : "Complementar"}
          </button>
        )}
      </td>
    </tr>
  );
}
