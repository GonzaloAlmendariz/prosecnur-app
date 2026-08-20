/**
 * «Cuánto recorta cada criterio» — el vistazo que faltaba arriba de las
 * tarjetas de criterios de estudiante: una barra por criterio, medida SOLO
 * (las mordidas no se suman), con su capa declarada — marco recorta el marco;
 * instrumento actúa al encuestar. El acumulado real lo dice el pie con el
 * dato del motor, nunca sumando barras.
 */
import { fmtInt } from "../../sharedCore";
import { mordidasEstudiante } from "./mordidasEstudianteModel";
import "./mordidasEstudiante.css";

export function MordidasEstudianteCard({
  reporte,
  elegiblesFinal,
}: {
  reporte: Parameters<typeof mordidasEstudiante>[0];
  /** eligible_student_rows del audit del marco; null si no viaja. */
  elegiblesFinal: number | null;
}) {
  const datos = mordidasEstudiante(reporte);
  if (!datos) return null;
  const maxFuera = Math.max(1, ...datos.mordidas.map((m) => m.fuera));

  return (
    <section className="cmv2-generales-card cmv2-mordidas" aria-label="Cuánto recorta cada criterio de estudiante">
      <header>
        <strong>Cuánto recorta cada criterio</strong>
        <span>
          cada barra mide su criterio por separado sobre las {fmtInt(datos.filasTotal)} filas de
          matrícula — las mordidas se superponen, no se suman
        </span>
      </header>
      <ul className="cmv2-mordidas-lista">
        {datos.mordidas.map((m) => (
          <li key={m.clave} className="cmv2-mordidas-fila">
            <span className="cmv2-mordidas-nombre">
              {m.etiqueta}
              {m.capa === "instrumento" ? (
                <small title="No recorta el marco: se aplica al encuestar, dentro del aula">
                  al encuestar
                </small>
              ) : null}
            </span>
            <span className="cmv2-mordidas-track" data-capa={m.capa}>
              <i style={{ width: `${Math.max(1.5, (m.fuera / maxFuera) * 100)}%` }} />
            </span>
            <b className="cmv2-mordidas-cifra">
              −{fmtInt(m.fuera)} <small>({m.pctFuera.toFixed(1).replace(".", ",")}%)</small>
            </b>
          </li>
        ))}
      </ul>
      {elegiblesFinal != null && (
        <p className="cmv2-mordidas-pie">
          Aplicados juntos, los criterios de marco dejan{" "}
          <strong>{fmtInt(elegiblesFinal)}</strong> de {fmtInt(datos.filasTotal)} filas de matrícula
          ({((elegiblesFinal / datos.filasTotal) * 100).toFixed(1).replace(".", ",")}%); los de «al
          encuestar» actúan dentro del aula, no reducen el marco.
        </p>
      )}
    </section>
  );
}
