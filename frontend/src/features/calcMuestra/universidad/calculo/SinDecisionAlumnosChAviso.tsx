/**
 * Cuando el estudio calcula sin decidir los alumnos por curso-horario, que se
 * vea.
 *
 * El resolutor devuelve el estudio intacto cuando la decisión de alumnos por CH
 * es `NULL` —compatibilidad con proyectos anteriores al contrato v1— y el motor
 * sigue adelante y calcula las aulas de las quince facultades con **un único
 * promedio global**. Ese silencio es el defecto.
 *
 * No es una aproximación menor: la cantidad de aulas de cada facultad depende de
 * cuántos elegibles hay por curso-horario ALLÍ, de 16 en Letras y Ciencias
 * Humanas a 46 en Estudios Generales Letras. En las facultades pequeñas cambia
 * si el estudio es siquiera factible.
 *
 * No se firma nada por el analista: la decisión sigue exigiendo su
 * `confirmado_at`. Sólo se hace visible que falta.
 */
import type { CalcMuestraAulasEstrato } from "../../../../api/calcMuestra";
import { fmtInt } from "../../sharedCore";

export function SinDecisionAlumnosChAviso({
  filas,
}: {
  filas: CalcMuestraAulasEstrato[] | null | undefined;
}) {
  const sinDecision = (filas ?? []).filter(
    (f) => f.alumnos_por_ch?.estado === "sin_decision",
  );
  if (!sinDecision.length) return null;
  // El aviso del motor ya viene redactado y con su instrucción; se usa el
  // primero en vez de reescribirlo, que es como se pierden los matices.
  const aviso = sinDecision.find((f) => f.alumnos_por_ch?.aviso)?.alumnos_por_ch?.aviso ?? "";

  return (
    <section
      className="cmv2-sindecision-aviso"
      role="status"
      aria-label="Decisión de alumnos por curso-horario pendiente"
    >
      <strong>
        {sinDecision.length === 1
          ? "Una facultad se calculó con el promedio global"
          : `Las ${fmtInt(sinDecision.length)} facultades se calcularon con el promedio global`}
      </strong>
      {aviso ? <p>{aviso}</p> : null}
      <p className="cmv2-sindecision-detalle">
        Cada facultad tiene su propia cantidad de alumnos por curso-horario, y de
        ella depende cuántas aulas necesita. Confirma la decisión en{" "}
        <strong>Marco &gt; Alumnos por CH</strong> para que cada una use su cifra.
      </p>
    </section>
  );
}
