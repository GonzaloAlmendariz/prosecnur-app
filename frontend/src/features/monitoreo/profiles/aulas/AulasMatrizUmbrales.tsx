import type { VeredictoDeControl } from "./AulasControlDelLibro";

/**
 * Los dos umbrales, como matriz.
 *
 * «Se consiguió llegar al 70 % de asistentes elegibles y al 70 % de alumnos
 * elegibles, independiente si asistieron o no, y eso declaraba si el aula había
 * sido efectiva»: un aula es efectiva cuando cumple LOS DOS. El veredicto ya
 * traía los cuatro casos —los dos, sólo uno, sólo el otro, ninguno— y se leían
 * como una lista de frases.
 *
 * En dos ejes se ve de un golpe lo que la lista obliga a reconstruir: cuántas
 * quedaron a un solo umbral de ser efectivas, y por cuál de los dos. Que es lo
 * que decide si volver al aula sirve de algo — si faltó gente en clase, volver
 * a la misma sesión no la trae.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasMatrizUmbrales({ v, aulas }: { v: VeredictoDeControl; aulas: number }) {
  const solo = (v.solo_asistentes ?? 0) + (v.solo_poblacion ?? 0);
  // El desglose sólo se dibuja si suma lo mismo que el total de «cumple una»:
  // un motor viejo no lo trae, y repartir a ojo inventaría el diagnóstico.
  const desglosado = v.cumple_una > 0 && solo === v.cumple_una;
  if (!aulas) return null;

  const celdas = desglosado
    ? [
        { clave: "efectivas", n: v.efectivas, rotulo: "Los dos", tono: "es-efectiva" },
        { clave: "solo_t", n: v.solo_asistentes ?? 0, rotulo: "Sólo asistentes", tono: "es-parcial" },
        { clave: "solo_p", n: v.solo_poblacion ?? 0, rotulo: "Sólo matriculados", tono: "es-parcial" },
        { clave: "ninguno", n: v.no_efectivas, rotulo: "Ninguno", tono: "es-fallo" },
      ]
    : [
        { clave: "efectivas", n: v.efectivas, rotulo: "Los dos", tono: "es-efectiva" },
        { clave: "una", n: v.cumple_una, rotulo: "Sólo uno", tono: "es-parcial" },
        { clave: "ninguno", n: v.no_efectivas, rotulo: "Ninguno", tono: "es-fallo" },
      ];

  return (
    <div className="aulas-umbrales">
      <ul className="aulas-umbrales-celdas">
        {celdas.map((c) => (
          <li key={c.clave} className={c.tono}>
            <strong>{fmt(c.n)}</strong>
            <span>{c.rotulo}</span>
            {/* El porcentaje va dentro de la celda y no en una fila aparte: es
                la misma cifra vista de otra forma, no un dato nuevo. */}
            <em>{aulas ? Math.round((100 * c.n) / aulas) : 0}%</em>
          </li>
        ))}
      </ul>
      {/* De qué son estos porcentajes.
          Dos centímetros más abajo, el titular dice «23 efectivas de 102
          evaluadas · 23 %», y aquí la misma casilla de 23 dice 15 %. Las dos
          son correctas y no miden lo mismo: esto es un REPARTO de las filas del
          libro —por eso incluye a las que nadie evaluó y por eso suman 100 %—,
          y aquélla es una TASA sobre lo evaluado. Sin esta línea, el lector ve
          dos porcentajes distintos para el mismo número y uno de los dos tiene
          que estar mal. */}
      {aulas ? (
        <p className="mon-profile-muted aulas-umbrales-base">
          Reparto de las {fmt(aulas)} filas de la hoja, evaluadas o no.
        </p>
      ) : null}
      {v.indeterminadas ? (
        // Ni a un lado ni al otro: la hoja no trae con qué situarlas. Sumarlas
        // a «ninguno» diría que fallaron, y no se sabe.
        //
        // **Con su porcentaje**, y con el MISMO denominador que las celdas. Sin
        // él las cuatro celdas sumaban 68 % y el tercio que falta sólo estaba
        // como un conteo suelto: los porcentajes de una partición tienen que
        // poder sumarse a la vista, o quien lee concluye que no cuadra. Pasó
        // leyendo esta misma pantalla.
        <p className="mon-profile-table-recorte">
          <strong>{fmt(v.indeterminadas)}</strong>{" "}
          {v.indeterminadas === 1 ? "aula sin sus dos umbrales" : "aulas sin sus dos umbrales"} en
          la hoja · {aulas ? Math.round((100 * v.indeterminadas) / aulas) : 0} %
        </p>
      ) : null}
      {/* DE QUIÉN es este corte, y qué NO decide.
          Gonzalo, 2026-08-18: «que una intervención sea válida o no válida es un
          valor que en el Excel se agregó, pero que técnicamente no es algo que
          nosotros verifiquemos… no importa si cumple o no el 70 % de asistencia,
          porque si es un aula con cien elegibles, no importa que sea el 50 o el
          40 %, igual son bastantes alumnos y hay que ir a aplicar».
          Sin esta línea, cuatro celdas con colores de acierto y fallo se leen
          como un veredicto de la app sobre cada aula, y no lo son. El ejemplo va
          con números porque es lo que hace evidente que el tamaño manda: 40 de
          100 es más que 14 de 20. */}
      <p className="mon-profile-muted aulas-umbrales-nota">
        Es el corte que el equipo escribió en el libro, no un criterio que la app
        verifique. No dice a qué aula conviene ir: un aula con 100 elegibles al 40 %
        rinde 40 encuestas, y una con 20 al 70 % rinde 14.
      </p>
    </div>
  );
}
