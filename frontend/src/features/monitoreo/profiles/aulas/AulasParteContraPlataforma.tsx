import { useMemo } from "react";

import { TriangleAlert } from "../../../../vendor/lucide-react";
import { parteContraPlataforma } from "./parteContraPlataforma";
import { fmt } from "./kpisDeAulas";

/**
 * Lo que el aplicador declaró contra lo que llegó a plataforma.
 *
 * Es la pregunta del analista —«¿coincide lo de plataforma con lo que se vio en
 * el aula?»— y tiene dos lecturas opuestas según cuántas aulas descuadren. Con
 * unas pocas son casos que revisar; con casi todas, el problema es el mapeo del
 * identificador y listarlas acusaría al equipo de un error de configuración.
 *
 * El filtro se descuenta antes de acusar a la atribución (B8): las diferencias
 * que el filtro explica se dicen con su causa, no como descuadre; sólo la
 * residual se lista. Y cuando la base no trae el crudo, el panel declara que
 * compara contra las efectivas.
 */

export function AulasParteContraPlataforma({ partes, agenda }: {
  partes: ReadonlyArray<Readonly<Record<string, unknown>>>;
  agenda: ReadonlyArray<Readonly<Record<string, unknown>>>;
}) {
  const r = useMemo(() => parteContraPlataforma(partes, agenda), [partes, agenda]);

  if (!r.comparables) {
    // El vacío declara lo mismo que la rama con datos: es un miembro del grupo
    // y posee su hueco. Sin esto, en un estudio sin partes de campo el único
    // miembro visible pasa a ser el encabezado del panel y el gate canta
    // `capacity-drift` sobre sus 4 px de padding — medido con el plan real,
    // tres paneles a la vez.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Ningún curso-horario tiene parte y respuestas a la vez, así que no hay nada que
        cruzar todavía.
      </p>
    );
  }

  if (r.fuentesSinCorrespondencia) {
    // El caso que no se puede listar: cuando descuadra casi todo, el cruce ya
    // no habla del campo. Llega aquí sólo con los descuadres RESIDUALES: lo
    // que el filtro explica ya se descontó y no infla esta proporción.
    return (
      <div className="aulas-cruce" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <p className="aulas-cruce-alarma">
          <TriangleAlert size={14} aria-hidden="true" />
          Las dos fuentes no se corresponden
        </p>
        <p className="mon-profile-muted">
          Descuadran <strong>{fmt(r.descuadran)}</strong> de{" "}
          {fmt(r.comparables)} cursos-horario comparables. Con esa proporción el problema
          no está en lo que anotó el campo: es que las respuestas no se están
          atribuyendo al mismo curso-horario que declara el parte. Revisa qué
          columna identifica el curso-horario en la base, en Fuentes.
          {r.sinCrudo ? (
            <> La base no publica el total de respuestas atribuidas; la
            comparación es contra las efectivas, sin descontar el filtro.</>
          ) : null}
        </p>
      </div>
    );
  }

  if (!r.descuadran) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {/* «Registra», neutro a propósito: con crudo se comparó contra lo que
            llegó; sin él, contra las efectivas — y la frase de limitación de
            abajo dice cuál fue. Afirmar aquí «lo que llegó» contradiría esa
            limitación en el mismo párrafo. */}
        Los {fmt(r.comparables)} cursos-horario comparables cuadran: lo que el
        aplicador declaró es lo que la plataforma registra.
        {/* La diferencia con las efectivas, dicha con su causa (B8): sin esta
            frase, el lector que mire la columna de efectivas creería que el
            veredicto de arriba está mal. */}
        {r.explicadasPorFiltro ? (
          <>
            {" "}El filtro del instrumento explica{" "}
            {r.explicadasPorFiltro === 1
              ? "la única diferencia"
              : `las ${fmt(r.explicadasPorFiltro)} diferencias`}{" "}
            con las efectivas.
          </>
        ) : null}
        {/* Cuántos venían partidos en varias filas: «los 150 cuadran» dice otra
            cosa si detrás hay 160 partes que si hay 150. */}
        {r.conVariosPartes ? (
          <> {fmt(r.conVariosPartes)} de ellos suman más de un parte de campo.</>
        ) : null}
        {r.sinCrudo ? (
          <> La base no publica el total de respuestas atribuidas; la
          comparación es contra las efectivas, sin descontar el filtro.</>
        ) : null}
      </p>
    );
  }

  return (
    <div className="aulas-cruce" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(r.descuadran)}</strong> de {fmt(r.comparables)} cursos-horario
        comparables no cuadran con plataforma
        {r.conVariosPartes ? (
          <> · {fmt(r.conVariosPartes)} suman varios partes</>
        ) : null}
      </p>
      {/* El descuento, dicho antes de la lista (B8): lo que el filtro explica
          no es descuadre, y lo listado es la residual que queda tras
          descontarlo. Sin esta frase, el lector no sabe que hubo más
          diferencias ni por qué no están. */}
      {r.explicadasPorFiltro ? (
        <p className="mon-profile-muted">
          El filtro del instrumento explica {fmt(r.explicadasPorFiltro)} de las{" "}
          {fmt(r.explicadasPorFiltro + r.descuadran)} diferencias;{" "}
          {r.descuadran === 1
            ? "la que se lista queda después de descontarlo."
            : `las ${fmt(r.descuadran)} listadas quedan después de descontarlo.`}
        </p>
      ) : null}
      {r.sinCrudo ? (
        <p className="mon-profile-muted">
          La base no publica el total de respuestas atribuidas; la comparación
          es contra las efectivas, sin descontar el filtro.
        </p>
      ) : null}
      {/* La lista ENTERA, de mayor a menor diferencia: el techo de diez quedó
          revocado (B33, principio 3). El orden es la priorización; el scroll
          de la sección recorre lo que no quepa. */}
      <ul className="aulas-cruce-lista">
        {r.casos.map((c) => (
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
    </div>
  );
}
