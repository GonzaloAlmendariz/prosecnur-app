/**
 * La cadena que convierte cuota en titulares, como fórmula viva.
 *
 * Gonzalo, 2026-08-21: «en cursos-horario facultad por facultad hay un cuadro
 * de texto gigante llamado "la cadena completa por facultad". Eso debería
 * explicarse de forma más dinámica, no simplemente un cuadro de texto sencillo,
 * simple, que no explique nada».
 *
 * Era un párrafo de cinco líneas que enunciaba la división y luego aclaraba de
 * dónde venía cada término. Acá cada término es una pieza con su nombre y su
 * procedencia debajo: se lee la fórmula de un vistazo y se sabe dónde se decide
 * cada factor sin buscarlo en la prosa.
 *
 * El nombre del divisor NO se escribe a mano: lo elige el analista en Marco ›
 * Alumnos por CH y esta pieza lo muestra tal cual quedó decidido.
 */
import "./cadenaFormula.css";

export function CadenaFormulaFacultad({
  nombreDivisor,
  onIrAAlumnosPorCh,
}: {
  /** Etiqueta del estadístico decidido («P25», «Mínimo entre media y mediana»…). */
  nombreDivisor: string;
  /** Lleva a donde se decide ese estadístico. */
  onIrAAlumnosPorCh?: () => void;
}) {
  return (
    <div className="cmv2-cadfor" aria-label="Cómo se calculan los titulares de cada facultad">
      <ol className="cmv2-cadfor-linea">
        <li className="cmv2-cadfor-pieza" data-rol="entrada">
          <b>cuota</b>
          <small>de la afijación del diseño</small>
        </li>
        <li className="cmv2-cadfor-op" aria-hidden="true">÷</li>
        <li className="cmv2-cadfor-grupo">
          <span className="cmv2-cadfor-parentesis" aria-hidden="true">(</span>
          <span className="cmv2-cadfor-pieza" data-rol="factor">
            <b>{nombreDivisor.toLowerCase() === "aula típica" ? "aula típica" : nombreDivisor}</b>
            <small>
              alumnos por curso-horario ·{" "}
              {onIrAAlumnosPorCh ? (
                <button type="button" className="cmv2-cadfor-ir" onClick={onIrAAlumnosPorCh}>
                  lo eliges en Marco
                </button>
              ) : (
                "se elige en Marco"
              )}
            </small>
          </span>
          <span className="cmv2-cadfor-op" aria-hidden="true">×</span>
          <span className="cmv2-cadfor-pieza" data-rol="factor">
            <b>tasa de efectividad</b>
            <small>composición × razón O/E</small>
          </span>
          <span className="cmv2-cadfor-parentesis" aria-hidden="true">)</span>
        </li>
        <li className="cmv2-cadfor-op" aria-hidden="true">→</li>
        <li className="cmv2-cadfor-pieza" data-rol="salida">
          <b>titulares</b>
          <small>las aulas que hay que visitar</small>
        </li>
      </ol>
      <p className="cmv2-cadfor-nota">
        Las <b>reservas</b> de esta tabla son cupos dimensionados del plan; las rutas concretas de
        reemplazo (R1, R2…) viven en <i>Selección → Reemplazos</i>.
      </p>
    </div>
  );
}
