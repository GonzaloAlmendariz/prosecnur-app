import { useMemo, useState } from "react";

import { filasDelRol, repartoPorRol, type RolDeCursoHorario } from "./filasPorRol";
import { fmt } from "./kpisDeAulas";
import type { TablaDelPerfil } from "./tablaDelPerfil";

/**
 * «Avance por curso-horario» con su selector de rol.
 *
 * Gonzalo, el 2026-09-09: «no se pueden ver todos, por qué no hay un selector
 * entre titulares y reemplazo 1, 2 etc». El motor manda 500 filas de las 1 392
 * del plan y las ordena por dónde está cada una en el circuito, así que los 174
 * titulares encabezan y las 326 reservas quedaban al fondo de una tabla de 500
 * sin forma de pedirlas: C4 incumplido —todo alcanzable— en la superficie que
 * más se lee como un censo.
 *
 * El selector arregla también lo otro que dijo, «no están en orden». No es que
 * el orden esté mal: el motor pone primero las que están en campo y dentro de
 * cada tramo por brecha, así que en pantalla saltan 8, 7, 30, 27 y eso se lee
 * como desorden. Filtrando a un rol, la serie por brecha se ve seguida.
 *
 * **Y lo que el selector NO puede arreglar se dice, no se esconde**: las 892
 * filas que el motor no manda no están aquí y ningún filtro las traerá. Eso es
 * un recorte del payload y necesita su propia decisión.
 *
 * Chips con `aulas-sexo-chip`, que es el control segmentado que este perfil ya
 * tiene y ya estila —la hoja lo reusa para los descartes, así que no es una
 * clase de un solo dueño— y `aulasMonitoreo.css` está congelado a crecimiento.
 */
export function AulasAvancePorCurso({
  filas, total, tabla, preferredColumns,
}: {
  filas: ReadonlyArray<Record<string, unknown>>;
  /** `course_status_total`: lo que el plan tiene, no lo que llegó. */
  total: number;
  tabla: TablaDelPerfil;
  preferredColumns?: string[];
}) {
  const [rol, setRol] = useState<RolDeCursoHorario>("todos");
  const reparto = useMemo(() => repartoPorRol(filas, total), [filas, total]);
  const visibles = useMemo(() => filasDelRol(filas, rol), [filas, rol]);
  const Tabla = tabla;

  const opciones: Array<{ clave: RolDeCursoHorario; texto: string; n: number }> = [
    { clave: "todos", texto: "Todos", n: reparto.recibidas },
    { clave: "titular", texto: "Titulares", n: reparto.titulares },
    { clave: "reserva", texto: "Reservas", n: reparto.reservas },
  ];

  return (
    <div data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <div className="aulas-sexo-chips" role="group" aria-label="Ver por rol de muestra">
        {opciones.map((o) => (
          <span key={o.clave} className="aulas-sexo-chip" aria-pressed={rol === o.clave}>
            <button
              type="button"
              onClick={() => setRol(o.clave)}
              // El conteo va en el botón y no en un aparte: es lo que deja
              // elegir sin probar, y dice de una vez que las reservas existen.
              aria-label={`${o.texto}: ${fmt(o.n)} cursos-horario`}
            >
              {o.texto} {fmt(o.n)}
            </button>
          </span>
        ))}
      </div>
      <Tabla
        rows={visibles as Array<Record<string, unknown>>}
        empty={rol === "reserva"
          ? "Entre las que llegaron no hay ninguna reserva."
          : "Todavía no hay respuestas que atribuir a un curso-horario."}
        preferredColumns={preferredColumns}
        /* El total del rol elegido, no el del plan: con «Reservas» marcado, un
           «de 1 392» diría que faltan mil filas de una lista que ya está
           entera. El recorte del plan lo declara el pie de abajo, una vez. */
        totalReal={visibles.length}
      />
      {reparto.restantes > 0 ? (
        // **Esto no es una nota al pie.** Una tabla se lee como un censo: quien
        // la recorre hasta el final cree haber visto el plan, y ha visto un
        // tercio. Ningún filtro puede traer estas filas: el recorte es del
        // payload, no de la vista.
        <p className="mon-profile-table-recorte">
          Faltan {fmt(reparto.restantes)} cursos-horario de los {fmt(reparto.total)} del plan: el
          motor manda {fmt(reparto.recibidas)} y el selector sólo reparte esas. Las que no llegaron
          son reservas dormidas, y se cuentan en «Estado de aplicación».
        </p>
      ) : null}
    </div>
  );
}
