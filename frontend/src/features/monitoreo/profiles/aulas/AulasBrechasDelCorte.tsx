import type { ReactNode } from "react";

import { brechasDelCorte, repartoDeBrechas, type BrechaDeCurso } from "./brechasDelCorte";
import { facultadCorta } from "./facultadEnPalabras";
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
  /**
   * **La tabla lista lo APLICADO que se quedó corto, y sólo eso.**
   *
   * Gonzalo, 2026-09-10: «no entiendo por qué está mostrando los sin campo
   * cuando debería mostrar los aplicados que tienen bajo rendimiento».
   *
   * Un curso-horario sin aplicar no tiene rendimiento que juzgar: su columna
   * «Rinde» iría vacía y su «Faltan» sería la meta entera, así que ordenado por
   * lo que falta copaba las primeras filas y empujaba fuera de la vista justo lo
   * que esta tabla existe para encontrar. Su salida tampoco es la misma —se
   * agenda, no se complementa—, y ese trabajo vive en Agendación.
   *
   * No desaparece: se cuenta en la lectura de arriba, que es donde una cifra
   * grande que no cabe en la tabla tiene que seguir viéndose.
   */
  const atendibles = brechas.filter((b) => b.severidad !== "cumplida" && b.severidad !== "sin_aplicar");
  // El parte en conflicto se LISTA —va primero, es lo que hay que mirar— pero no
  // se cuenta entre los aplicados que rinden mal: todavía no se sabe si se
  // aplicó. Contarlo ahí daba por bueno el registro que se pide revisar.
  const enConflicto = atendibles.filter((b) => b.severidad === "parte_en_conflicto");
  const rindenMal = atendibles.filter((b) => b.severidad !== "parte_en_conflicto");
  const visibles = atendibles.slice(0, 40);
  const cumplidas = brechas.filter((b) => b.severidad === "cumplida").length;
  const restantes = atendibles.length - visibles.length;

  if (!atendibles.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Ningún curso-horario aplicado se quedó por debajo de lo previsto
        {r.sinAplicar ? <> · quedan {fmt(r.sinAplicar)} sin aplicar, que se resuelven agendando</> : null}.
      </p>
    );
  }

  return (
    <div className="aulas-brc" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {/* La lectura encabeza con lo que la tabla contesta —cuántos aplicados se
          quedaron cortos— y deja lo que no está aquí al final, nombrado y con su
          salida, para que no parezca que se perdió. */}
      <p className="aulas-brc-lectura">
        <strong>{fmt(rindenMal.length)}</strong> cursos-horario aplicados rinden por debajo
        {" y suman "}<strong>{fmt(rindenMal.reduce((n, b) => n + Math.max(0, b.faltan), 0))}</strong>
        {" respuestas por conseguir"}
        {r.muyPorDebajo ? <> · <strong>{fmt(r.muyPorDebajo)}</strong> rinden menos de la mitad de lo previsto</> : null}
        {r.sinAplicar ? (
          <> · aparte, <strong>{fmt(r.sinAplicar)}</strong> todavía sin aplicar: ésos se agendan, no se complementan</>
        ) : null}
        {/* **El conflicto va con nombre propio.** No es un aplicado que rinde
            mal ni uno sin aplicar: es un registro que no se sostiene, y ya pilló
            un duplicado del coordinador el 2026-09-11. */}
        {enConflicto.length ? (
          <> · <strong>{fmt(enConflicto.length)}</strong>{" "}
            {enConflicto.length === 1
              ? "tiene el parte en conflicto y encabeza la tabla: revísalo antes de decidir"
              : "tienen el parte en conflicto y encabezan la tabla: revísalos antes de decidir"}</>
        ) : null}
      </p>

      <div className="aulas-brc-marco">
        <table className="aulas-brc-tabla">
          <caption className="aulas-brc-caption">
            Cursos-horario aplicados que rindieron por debajo, del más grave al menos.
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
  // No es un grado de rendimiento: es un registro que no se sostiene.
  parte_en_conflicto: "el parte no cuadra",
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
            {/* Normalizada, como en el mapa y en el popover: el libro las
                escribe en mayúsculas y en la misma pantalla convivían las dos
                grafías. La decisión vive en `facultadEnPalabras`. */}
            {facultadCorta(b.facultad) || "Sin facultad"}
            {b.donde ? ` · ${b.donde}` : ""}
            {/* Su composición: decide si un relevo suyo cerraría lo que falta. */}
            {b.mujeres || b.hombres ? ` · ${fmt(b.mujeres)} M · ${fmt(b.hombres)} H` : ""}
          </em>
        </span>
      </th>
      <td>{b.cuando ? <span className="aulas-brc-cuando">{b.cuando}</span> : <span className="aulas-brc-nada">—</span>}</td>
      <td className="es-num">
        {b.severidad === "parte_en_conflicto" ? (
          // **Ni aplicada ni pendiente: en conflicto.** El parte la da por
          // aplicada y no hay fecha, ni contacto cerrado, ni una encuesta.
          // Elegir un lado en silencio esconde que alguien marcó esa casilla.
          <span className="aulas-brc-conflicto">
            revisar el parte
            {b.enElAula != null ? <em>dice aplicada · {fmt(b.enElAula)} en el aula · 0 válidas</em> : null}
          </span>
        ) : b.severidad === "sin_aplicar" ? (
          <span className="aulas-brc-nada">sin campo</span>
        ) : (
          <span className={`aulas-brc-rinde${b.observada != null && b.prevista != null && b.observada >= b.prevista ? " es-ok" : " es-bajo"}`}>
            <b>{pct(b.observada)}</b>
            {/* **Un cero necesita su porqué.** Gonzalo, 2026-09-11, sobre CH 3
                con «0.0 %»: «no entiendo, ¿la CH 3 no hizo nada?». Sí fue: el
                parte anotó 15 alumnos en el aula y no salió ni una encuesta
                válida. Sin esa cifra, el cero se lee como que nadie pisó el
                aula, y volver a aplicar donde hay gente no se parece en nada a
                agendar donde no se llegó. */}
            {b.efectivas === 0 && b.enElAula != null ? (
              <em>{b.enElAula === 0
                ? "el parte no encontró a nadie"
                : `${fmt(b.enElAula)} en el aula · ninguna válida`}</em>
            ) : (
              // Contra lo que preveía SU facultad: sin esa referencia, el
              // porcentaje no dice si es bueno o malo.
              <em>de {pct(b.prevista)} previsto</em>
            )}
          </span>
        )}
      </td>
      <td className="es-num"><b className="aulas-brc-faltan">{fmt(b.faltan)}</b></td>
      <td>
        {b.severidad === "parte_en_conflicto" ? (
          // Decía «ya cumplió», que es justo lo contrario de lo que pasa: no se
          // sabe si se aplicó. Visto en pantalla el 2026-09-11 sobre CH 3.
          <span className="aulas-brc-nada">revisar el registro</span>
        ) : b.accion === "nada" ? (
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
