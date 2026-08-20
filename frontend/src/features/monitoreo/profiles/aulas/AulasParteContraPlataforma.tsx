import { useMemo } from "react";

import { TriangleAlert } from "../../../../vendor/lucide-react";
import { parteContraPlataforma } from "./parteContraPlataforma";

/**
 * Lo que el aplicador declaró contra lo que llegó a plataforma.
 *
 * Es la pregunta del analista —«¿coincide lo de plataforma con lo que se vio en
 * el aula?»— y tiene dos lecturas opuestas según cuántas aulas descuadren. Con
 * unas pocas son casos que revisar; con casi todas, el problema es el mapeo del
 * identificador y listarlas acusaría al equipo de un error de configuración.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasParteContraPlataforma({ partes, agenda }: {
  partes: ReadonlyArray<Readonly<Record<string, unknown>>>;
  agenda: ReadonlyArray<Readonly<Record<string, unknown>>>;
}) {
  const r = useMemo(() => parteContraPlataforma(partes, agenda), [partes, agenda]);

  if (!r.comparables) {
    return (
      <p className="mon-profile-muted">
        Ningún aula tiene parte y respuestas a la vez, así que no hay nada que
        cruzar todavía.
      </p>
    );
  }

  if (r.fuentesSinCorrespondencia) {
    // El caso que no se puede listar: cuando descuadra casi todo, el cruce ya
    // no habla del campo.
    return (
      <div className="aulas-cruce">
        <p className="aulas-cruce-alarma">
          <TriangleAlert size={14} aria-hidden="true" />
          Las dos fuentes no se corresponden
        </p>
        <p className="mon-profile-muted">
          Descuadran <strong>{fmt(r.descuadran)}</strong> de{" "}
          {fmt(r.comparables)} aulas comparables. Con esa proporción el problema
          no está en lo que anotó el campo: es que las respuestas no se están
          atribuyendo al mismo curso-horario que declara el parte. Revisa qué
          columna identifica el aula en la base, en Fuentes.
        </p>
      </div>
    );
  }

  if (!r.descuadran) {
    return (
      <p className="mon-profile-muted">
        Las {fmt(r.comparables)} aulas comparables cuadran: lo que el aplicador
        declaró es lo que llegó a plataforma.
      </p>
    );
  }

  return (
    <div className="aulas-cruce">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(r.descuadran)}</strong> de {fmt(r.comparables)} aulas
        comparables no cuadran con plataforma
      </p>
      <ul className="aulas-cruce-lista">
        {r.casos.slice(0, 10).map((c) => (
          <li key={c.codigo}>
            <span className="aulas-cruce-cod">{c.codigo}</span>
            <span className="aulas-cruce-n">
              <strong>{c.diferencia > 0 ? `+${fmt(c.diferencia)}` : fmt(c.diferencia)}</strong>
            </span>
            <span className="aulas-cruce-por">
              {/* Los dos números, siempre: la diferencia sola no dice si son 20
                  contra 18 o 2 contra 0. */}
              parte {fmt(c.declaradas)} · plataforma {fmt(c.enPlataforma)}
              {c.facultad ? ` · ${c.facultad}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {r.casos.length > 10 ? (
        <p className="mon-profile-muted">
          Las diez de mayor diferencia, de {fmt(r.casos.length)}.
        </p>
      ) : null}
    </div>
  );
}
