import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import type { DesenlacesDelLibro } from "./desenlacesDelLibro";
import "./aulasDesenlacesDelLibro.css";

/**
 * Reemplazos (A), complementos (B) y refuerzos (C), contados por separado.
 *
 * Gonzalo, 2026-09-10: «quiero empezar a ver la parte de reemplazos para aulas
 * complementarias (B) o aulas de refuerzo (C)».
 *
 * **Las tres letras se dibujan siempre, también en cero.** Un tipo que
 * desaparece cuando no ha pasado nunca deja al lector sin saber que existe, y
 * son justo las tres decisiones que el operativo puede tomar cuando un
 * curso-horario no da lo suyo. El cero es un dato: «todavía no ha hecho falta».
 */
export function AulasDesenlacesDelLibro({ desenlaces }: {
  desenlaces: DesenlacesDelLibro | null;
}): ReactNode {
  if (!desenlaces) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Este tablero se generó con una versión anterior del cálculo y todavía no
        publica el reparto por tipo de relevo.
      </p>
    );
  }
  const d = desenlaces;

  return (
    <div className="aulas-abc" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-abc-lectura">{d.frase}</p>

      <ul className="aulas-abc-tipos">
        {d.tipos.map((t) => (
          <li key={t.letra} className={t.total ? "" : "es-cero"}>
            <span className="aulas-abc-letra" aria-hidden="true">{t.letra}</span>
            <span className="aulas-abc-cuerpo">
              <span className="aulas-abc-nombre">
                {t.nombre}
                {/* La definición al alcance del cursor: son tres decisiones
                    parecidas y lo que las separa es una frase. */}
                <em title={t.detalle}>{t.detalle}</em>
              </span>
              {t.total && t.porFacultad.length ? (
                <span className="aulas-abc-facultades">
                  {t.porFacultad.slice(0, 4).map((f, i) => (
                    <span key={f.facultad}>
                      {i ? " · " : ""}<b>{fmt(f.aulas)}</b> {f.facultad}
                    </span>
                  ))}
                  {t.porFacultad.length > 4
                    ? <> · y {fmt(t.porFacultad.length - 4)} facultades más</>
                    : null}
                </span>
              ) : null}
            </span>
            <span className="aulas-abc-cifra">
              <strong>{fmt(t.total)}</strong>
              {/* **Lo que el libro dice contra lo que el campo vive.** El verbo
                  se teclea al aplicar, así que un relevo ocurre antes de que
                  nadie lo escriba; la diferencia dice cuánto le falta al
                  registro para estar al día. */}
              {t.total && t.enCurso ? (
                <i title="El hecho ya ocurrió y el libro todavía no lo dice: el verbo se teclea al aplicar.">
                  {t.declarados ? `${fmt(t.enCurso)} sin declarar` : "sin declarar"}
                </i>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {d.caidosSinRelevo || d.sinAulaUtilizada ? (
        <p className="aulas-abc-pie">
          {d.caidosSinRelevo ? (
            <>
              {/* Un titular caído sin relevo NO es un reemplazo: su hueco sigue
                  abierto y alguien tiene que llamar. */}
              <strong>{fmt(d.caidosSinRelevo)}</strong>{" "}
              {d.caidosSinRelevo === 1 ? "curso-horario cayó" : "cursos-horario cayeron"} y
              todavía no tienen relevo activado: su hueco sigue abierto.
            </>
          ) : null}
          {d.caidosSinRelevo && d.sinAulaUtilizada ? " · " : null}
          {d.sinAulaUtilizada ? (
            <>
              {/* «Reemplazada POR» y «complementada CON» terminan en preposición
                  porque piden un cuál; sin él no se puede seguir la cadena. */}
              <strong>{fmt(d.sinAulaUtilizada)}</strong> no dicen con qué
              curso-horario se resolvieron
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
