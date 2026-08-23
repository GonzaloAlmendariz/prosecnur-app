import { useMemo } from "react";

import { MessageSquareText } from "../../../../vendor/lucide-react";
import { observacionesDeCampo } from "./observacionesDeCampo";
import { fmt } from "./kpisDeAulas";

/**
 * Lo que el campo reportó.
 *
 * `field_note` se escribía en el formulario de registro y **no se leía en
 * ninguna pantalla**: el aplicador anotaba lo que pasó en el aula y eso no
 * llegaba a nadie. Es el dato más barato y más perdido del perfil.
 *
 * Va en Validación, que es donde entra el jefe de campo, y **agrupado por lo que
 * dice**: en el corte las 16 observaciones son la misma frase entre dos equipos.
 * Una a una serían dieciséis incidencias; juntas son un patrón del operativo
 * —«el docente pide empezar al final de la clase»— que cambia cómo se agenda.
 */

export function AulasObservacionesDeCampo({ partes, registros = [] }: {
  partes: ReadonlyArray<Readonly<Record<string, unknown>>>;
  /**
   * Las filas del plan, que es donde el registro de ESTA app guarda su
   * `field_note`. Sin ellas el panel leía sólo los partes del libro mientras su
   * vacío decía «se escriben al registrar un aula» — el camino que no miraba.
   */
  registros?: ReadonlyArray<Readonly<Record<string, unknown>>>;
}) {
  const r = useMemo(() => observacionesDeCampo(partes, registros), [partes, registros]);

  if (!r.observaciones.length) {
    // C5 categoría 1: el vacío dice de dónde saldría el dato y quién lo escribe.
    // El vacío declara lo mismo que la rama con datos: es un miembro del grupo
    // y posee su hueco. Sin esto, en un estudio sin partes de campo el único
    // miembro visible pasa a ser el encabezado del panel y el gate canta
    // `capacity-drift` sobre sus 4 px de padding — medido con el plan real,
    // tres paneles a la vez.
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {/* Dos causas distintas, y la frase las decía igual. Con 152 partes y
            ninguna nota, el campo no está escribiendo lo que ve y eso SÍ es un
            aviso sobre el libro. Con cero partes no se ha mirado nada: decir
            «ninguno de los 0 partes trae observaciones» afirma haber contado
            sobre un conjunto vacío. Misma familia que `c4af437d`. */}
        {r.partes
          ? `Ninguna de las ${fmt(r.partes)} aulas con parte o registro trae observaciones. Se escriben al registrar un aula aquí, o en la columna «Observaciones» del libro, y son lo que el aplicador vio y no cabe en un número.`
          : "Todavía no hay partes ni registros de campo. Las observaciones se escriben al registrar un aula aquí, o en la columna «Observaciones» del libro, y son lo que el aplicador vio y no cabe en un número."}
      </p>
    );
  }

  return (
    <div className="aulas-observaciones" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(r.conNota)}</strong> de {fmt(r.partes)} partes traen
        observación
        {r.observaciones.length < r.conNota ? (
          <>
            {" "}· <strong>{fmt(r.observaciones.length)}</strong>{" "}
            {r.observaciones.length === 1 ? "cosa distinta" : "cosas distintas"}
          </>
        ) : null}
      </p>
      <ul className="aulas-observaciones-lista">
        {r.observaciones.slice(0, 12).map((o) => (
          <li key={o.texto}>
            <p className="aulas-observaciones-texto">
              <MessageSquareText size={13} aria-hidden="true" />
              {o.texto}
            </p>
            <p className="aulas-observaciones-quien">
              {/* Las aulas primero: una observación repetida en ocho aulas es
                  otra cosa que la misma frase en una. */}
              <strong>{o.aulas === 1 ? "1 aula" : `${fmt(o.aulas)} aulas`}</strong>
              {o.aplicadores.length ? <> · {o.aplicadores.join(", ")}</> : null}
              {o.facultades.length === 1 ? <> · {o.facultades[0]}</> : null}
              {o.facultades.length > 1 ? <> · {fmt(o.facultades.length)} facultades</> : null}
              {o.codigos.length ? (
                <span className="aulas-observaciones-codigos">
                  {o.codigos.slice(0, 6).join(" · ")}
                  {o.codigos.length > 6 ? ` y ${fmt(o.codigos.length - 6)} más` : ""}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      {r.observaciones.length > 12 ? (
        <p className="mon-profile-muted">
          Las doce más repetidas, de {fmt(r.observaciones.length)}.
        </p>
      ) : null}
    </div>
  );
}
