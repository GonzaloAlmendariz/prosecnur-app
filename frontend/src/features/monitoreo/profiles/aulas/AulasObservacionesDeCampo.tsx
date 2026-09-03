import { useMemo } from "react";

import { MessageSquareText } from "../../../../vendor/lucide-react";
import { ChipDato } from "./AulasSistemaPabellon";
import { observacionesDeCampo } from "./observacionesDeCampo";
import { fmt } from "./kpisDeAulas";
import "./aulasObservacionesDeCampo.css";

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
          // Con la norma puesta —siempre se anota algo al gestionar—, cero
          // observaciones sobre aulas ya gestionadas deja de ser un vacío
          // neutro: dice que lo anotado se está quedando fuera de la app.
          ? `Ninguno de los ${fmt(r.partes)} cursos-horario gestionados trae observación, y anotarlas es lo normal: se escriben al agendar o registrar un curso-horario aquí, o en la columna «Observaciones» del libro. Si el equipo las está apuntando en otro sitio, aquí no llegan.`
          : "Todavía no hay cursos-horario gestionados. Las observaciones se escriben al agendar o registrar un curso-horario aquí, o en la columna «Observaciones» del libro, y son lo que el equipo vio y no cabe en un número."}
      </p>
    );
  }

  return (
    <div className="aulas-observaciones" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* **Escribir observación es la norma, no la excepción.** Gonzalo,
          2026-08-24: «la observación va a ser algo que el agendador siempre va a
          escribir, por lo que ponerlo como algo que a veces se hace no es muy
          realista». La línea decía «4 de 13 partes traen observación» y se leía
          como un dato curioso; con la norma puesta, lo que hay que mirar es el
          hueco —las gestionadas que NO traen nota—, porque ésas son las que
          faltan por anotar. Y el denominador se llama por lo que es: aulas
          gestionadas, no partes. */}
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(r.conNota)}</strong> de {fmt(r.partes)}{" "}
        {r.partes === 1 ? "aula gestionada trae" : "aulas gestionadas traen"} observación
        {r.observaciones.length < r.conNota ? (
          <>
            {" "}· <strong>{fmt(r.observaciones.length)}</strong>{" "}
            {r.observaciones.length === 1 ? "cosa distinta" : "cosas distintas"}
          </>
        ) : null}
        {r.partes > r.conNota ? (
          <>
            {" "}·{" "}
            <span className="aulas-observaciones-hueco">
              {fmt(r.partes - r.conNota)} sin anotar
            </span>
          </>
        ) : null}
      </p>
      {/* La lista ENTERA: el techo de doce quedó revocado con el resto (B33).
          Lo repetido sigue yendo primero, y lo que no quepa lo recorre el
          scroll de la sección, que es suyo. */}
      <ul className="aulas-observaciones-lista">
        {r.observaciones.map((o) => {
          /* Loop mejora-ui E11: la fecha tecleada susurra. El equipo antepone
             «2/09 » a casi toda observación y ese prefijo pesaba igual que las
             palabras — en una pared de 49 tarjetas, lo que se escanea es QUÉ
             pasó, no el sello de cuándo. Presentación pura: el texto queda
             intacto (es contenido tecleado, no se parsea para datos) y sin
             prefijo reconocible se pinta tal cual. */
          const conFecha = /^(\d{1,2}\/\d{1,2})\s+([\s\S]*)$/.exec(o.texto);
          return (
          <li key={o.texto}>
            <p className="aulas-observaciones-texto">
              <MessageSquareText size={13} aria-hidden="true" />
              {conFecha ? (
                <>
                  <span className="aulas-observaciones-fecha">{conFecha[1]}</span>
                  {" "}{conFecha[2]}
                </>
              ) : o.texto}
            </p>
            <p className="aulas-observaciones-quien">
              {/* **De qué columna salió.** El libro tiene dos: «OBSERVACIONES»
                  en la hoja de agendadas y «OBSERVACIONES SOBRE APLICACIONES» en
                  la de aplicadas, y son dos hechos distintos —lo que costó
                  conseguir el aula y lo que pasó dentro—. Mezclarlas sin decir
                  cuál es cuál convierte «el docente pidió otro día» y «el
                  docente pidió empezar al final» en la misma cosa. Cuando un
                  texto viene de las dos se marcan las dos: se anticipó al
                  agendar y volvió a pasar al aplicar. */}
              {o.origenes.map((org) => (
                <span key={org} className={`aulas-observaciones-origen es-${org}`}>
                  {org === "agenda" ? "Agendación" : "Aplicación"}
                </span>
              ))}
              {/* Las aulas primero: una observación repetida en ocho aulas es
                  otra cosa que la misma frase en una. */}
              <strong>{o.aulas === 1 ? "1 curso-horario" : `${fmt(o.aulas)} cursos-horario`}</strong>
              {o.aplicadores.length ? <> · {o.aplicadores.join(", ")}</> : null}
              {o.facultades.length === 1 ? <> · {o.facultades[0]}</> : null}
              {o.facultades.length > 1 ? <> · {fmt(o.facultades.length)} facultades</> : null}
              {/* TODOS los códigos, como badges que envuelven (B33: jamás
                  «y N más» — la lista se organiza, no se esconde). Una
                  observación repetida en cuarenta cursos-horario es un patrón
                  del operativo, y esconder 34 le quitaba justo el tamaño. */}
              {o.codigos.length ? (
                <span className="aulas-observaciones-codigos">
                  <span className="aulas-chips-fila">
                    {o.codigos.map((c) => <ChipDato key={c}>{c}</ChipDato>)}
                  </span>
                </span>
              ) : null}
            </p>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
