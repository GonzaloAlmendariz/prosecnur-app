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
      {/* La cadena declara su geometría: sus piezas —cuota, divisor, τ, operadores—
          tienen anchos propios por diseño, así que el contrato es `intrinsic` y
          no el `equal` que se asume por defecto. Sin declararlo, el gate visual
          contaba seis colecciones sin contrato y la vista no podía pasar por
          conformidad, sólo por que nadie mirara. */}
      <ol className="cmv2-cadfor-linea" data-qa-geometry-group="calc-muestra/cadena-formula" data-qa-geometry-contract="intrinsic">
        <li className="cmv2-cadfor-pieza" data-qa-geometry-capacity="owned" data-rol="entrada">
          <b>cuota</b>
          <small>de la afijación del diseño</small>
        </li>
        <li className="cmv2-cadfor-op" data-qa-geometry-capacity="owned" aria-hidden="true">÷</li>
        <li className="cmv2-cadfor-grupo" data-qa-geometry-group="calc-muestra/cadena-formula-grupo" data-qa-geometry-contract="intrinsic">
          <span className="cmv2-cadfor-parentesis" data-qa-geometry-capacity="owned" aria-hidden="true">(</span>
          <span className="cmv2-cadfor-pieza" data-qa-geometry-capacity="owned" data-rol="factor">
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
          <span className="cmv2-cadfor-op" data-qa-geometry-capacity="owned" aria-hidden="true">×</span>
          <span className="cmv2-cadfor-pieza" data-qa-geometry-capacity="owned" data-rol="factor">
            <b>tasa de efectividad</b>
            <small>composición × razón O/E</small>
          </span>
          <span className="cmv2-cadfor-parentesis" data-qa-geometry-capacity="owned" aria-hidden="true">)</span>
        </li>
        <li className="cmv2-cadfor-op" data-qa-geometry-capacity="owned" aria-hidden="true">→</li>
        <li className="cmv2-cadfor-pieza" data-qa-geometry-capacity="owned" data-rol="salida">
          <b>titulares</b>
          <small>las aulas que hay que visitar</small>
        </li>
      </ol>
      {/* La tabla mostraba además un «cupo de reserva» que esta nota tenía que
          explicar. Se retiró —no lo consumía nadie y lo calculaba un fijo de 1
          por facultad—, así que la nota ya no desambigua una columna: dice
          dónde vive el reemplazo de verdad, que es lo que el analista busca al
          no encontrarlo aquí. */}
      <p className="cmv2-cadfor-nota">
        Estos son los <b>titulares</b>: las aulas que hay que visitar, y las que el sorteo
        reparte por facultad. El reemplazo no se dimensiona aquí — la selección construye
        una cadena por titular (R1, R2…) más un banco de extras por facultad, y son
        bastantes más; viven en <i>Selección → Reemplazos</i>.
      </p>
    </div>
  );
}
