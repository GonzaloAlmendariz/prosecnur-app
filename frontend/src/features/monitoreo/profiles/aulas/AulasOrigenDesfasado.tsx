import { AlertTriangle } from "../../../../vendor/lucide-react";

/**
 * El plan de aulas que Monitoreo enseña no es el del sorteo vigente.
 *
 * Recopiladores ya avisaba de esto para su plan de recolección, con su botón de
 * rehacer. Monitoreo no, y es **donde se mira el avance del campo**: se
 * re-sortea y esta pantalla sigue enseñando el avance de un plan que ya no
 * existe, con sus cursos-horario, sus cuotas y sus atrasos.
 *
 * El aviso no ofrece botón a propósito: rehacer el plan de Monitoreo es volver a
 * importarlo desde Cálculo de muestra, y esa es una decisión con consecuencias
 * —se pierde lo que el libro haya traído encima— que no cabe detrás de un clic
 * puesto al paso.
 */
export function AulasOrigenDesfasado({ origen }: {
  origen?: { plan_run_id?: string; selection_run_id?: string; desfasado?: boolean } | null;
}) {
  if (!origen?.desfasado) return null;

  return (
    <div className="aulas-origen-desfasado" role="status" data-qa-geometry-capacity="owned">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>
        Este plan viene de <strong>otra corrida del sorteo</strong>
        {fechaDeCorrida(origen.plan_run_id) ? <> (del {fechaDeCorrida(origen.plan_run_id)})</> : null}
        {" "}y la selección vigente es otra
        {fechaDeCorrida(origen.selection_run_id)
          ? <> (del {fechaDeCorrida(origen.selection_run_id)})</> : null}
        . El avance que ves es el de los cursos-horario del sorteo anterior:
        vuelve a importar el plan desde Cálculo de muestra para medir sobre el vigente.
      </span>
    </div>
  );
}

/**
 * La fecha dentro de `sel_aulas_AAAAMMDDHHMMSS_hash`.
 *
 * Un id de corrida no le dice nada a nadie; la fecha sí, y es lo único que hace
 * falta para saber cuál de los dos planes es el viejo. Misma lectura que hace
 * `PlanSection` en Recopiladores.
 */
export function fechaDeCorrida(runId?: string): string {
  const m = /_(\d{4})(\d{2})(\d{2})\d{6}_/.exec(runId ?? "");
  if (!m) return "";
  const [, a, mes, d] = m;
  const fecha = new Date(Number(a), Number(mes) - 1, Number(d));
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
}
