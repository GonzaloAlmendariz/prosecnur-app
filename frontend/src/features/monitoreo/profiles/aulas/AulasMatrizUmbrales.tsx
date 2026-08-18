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
      {v.indeterminadas ? (
        // Ni efectivas ni fallidas: la hoja no trae con qué decidirlo. Sumarlas
        // a «ninguno» diría que fallaron, y no se sabe.
        <p className="mon-profile-table-recorte">
          <strong>{fmt(v.indeterminadas)}</strong>{" "}
          {v.indeterminadas === 1 ? "aula no se puede evaluar" : "aulas no se pueden evaluar"}:
          la hoja no trae sus dos umbrales.
        </p>
      ) : null}
    </div>
  );
}
