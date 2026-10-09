import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Cuántos cursos-horario del plan siguen SIN FECHA.
 *
 * Es la cifra que reconcilia los dos paneles que proyectan el cierre y que, sin
 * ella, decían cosas opuestas de la misma pantalla (auditoría del 2026-09-08):
 *
 * - **«Qué metas van a cerrar y cuáles no»** (Metas) suma lo que traerán TODOS
 *   los cursos-horario en juego, tengan fecha o no. Proyecta 3 650 contra una
 *   cuota de 2 500 y marca las 30 celdas con un ✓ — incluida DERECHO mujeres,
 *   que lleva 8 de 237.
 * - **El acumulado de «Rendimiento diario»** sólo proyecta sobre lo agendado:
 *   2 066 contra 2 500, y por eso dice que no se llega.
 *
 * Las dos son correctas sobre universos distintos, y ninguna lo declaraba. La
 * diferencia entre ambas ES este número: 59 el 2026-09-08, de 174 titulares con
 * 115 agendados. La brecha es de AGENDA, no de rendimiento, y son dos remedios
 * distintos —uno se arregla agendando y el otro mandando más gente a la misma
 * aula—.
 *
 * **Vive en un helper y no en cada panel** porque los dos tienen que citar el
 * MISMO número: una regla copiada en dos sitios es la forma más barata de que un
 * día digan cifras distintas, que es el defecto que esta sección lleva todo el
 * día corrigiendo.
 *
 * Sólo TITULARES: una reserva sin fecha no es una cita que falte por poner, es
 * una reserva que no ha entrado. El rol vacío cuenta como titular, que es como
 * lo escribe el plan cuando no lo declara.
 */
export function cursosHorarioSinFecha(plan: ReadonlyArray<MonitoreoRow>): number {
  return plan.filter((u) => {
    const fila = u as Record<string, unknown>;
    const rol = String(fila.sample_role ?? "").trim();
    if (rol && rol !== "titular") return false;
    const fecha = String(fila.scheduled_date ?? fila.fecha ?? "").trim();
    return !fecha;
  }).length;
}
