import type { ReactNode } from "react";

import type { BrechaPorSexo } from "./candidatosDeReemplazo";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt } from "./kpisDeAulas";
import "./aulasLlamadaDeFacultad.css";

/**
 * **La entrada al refuerzo, al pie de la tabla de brechas.**
 *
 * Es la nota del ensayo «El refuerzo no sale de una fila»: *«cuando la brecha
 * es de la facultad, ninguna aula la explica. Esa entrada va abajo, separada, y
 * es la del refuerzo»*.
 *
 * Y por eso va FUERA de la tabla y no como una fila más: cada fila de arriba
 * ofrece complementar un curso-horario concreto, y aquí no hay curso-horario
 * que señalar —la cuota no la rompió ninguno en particular—. Meterla dentro
 * pediría elegir una fila arbitraria para colgarle la acción.
 *
 * Se dice además **si alguna sola la explica**, porque eso cambia la decisión:
 * con un curso-horario que arrastre él solo lo que falta, lo barato es
 * complementarlo; si la deuda está repartida, no hay atajo y toca meter aula.
 */
export function AulasLlamadaDeFacultad({ facultad, deuda, mayorBrecha, onRefuerzo }: {
  facultad: string;
  /** Lo que la facultad debe hoy, por sexo. Sale de las cuotas. */
  deuda: BrechaPorSexo | null | undefined;
  /** La brecha del curso-horario que más arrastra de esa facultad. */
  mayorBrecha: number;
  onRefuerzo: (facultad: string) => void;
}): ReactNode {
  if (!facultad || !deuda) return null;
  const m = Math.max(0, Math.round(deuda.mujeres));
  const h = Math.max(0, Math.round(deuda.hombres));
  if (m + h === 0) return null;

  // «Ninguna la explica sola»: ni el curso-horario que más arrastra llega a la
  // mitad de lo que la facultad debe.
  const solaLaExplica = mayorBrecha >= (m + h) / 2;
  const nombre = facultadCorta(facultad);

  return (
    <div className="aulas-llamada" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <span className="aulas-llamada-dice">
        A <strong>{nombre}</strong> le {m + h === 1 ? "falta" : "faltan"}{" "}
        {m ? <><strong>{fmt(m)}</strong> {m === 1 ? "mujer" : "mujeres"}</> : null}
        {m && h ? " y " : null}
        {h ? <><strong>{fmt(h)}</strong> {h === 1 ? "hombre" : "hombres"}</> : null}
        {solaLaExplica
          ? <>, y hay un curso-horario que arrastra <strong>{fmt(mayorBrecha)}</strong> él solo: sale más barato complementarlo.</>
          : <>, y ninguno de sus cursos-horario explica la brecha solo.</>}
      </span>
      <button type="button" className="aulas-llamada-boton" onClick={() => onRefuerzo(facultad)}>
        Reforzar la facultad
      </button>
    </div>
  );
}
