import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { sigueDormida } from "./candidatosDeReemplazo";

/**
 * Quién entra a las vistas de la agenda (ruta, tabla, contacto).
 *
 * Los titulares siempre. Una reserva —de cadena o del banco— solo cuando
 * DESPERTÓ: el filtro por rol a secas era más burdo que la doctrina («sólo
 * entra en juego el día que su titular se declara caída») y escondía justo a
 * la que YA entró — en el caso A del dictado 2026-09-03 el titular salía con
 * su Rechazo pero la cita del relevo no aparecía en ruta, tabla ni citas
 * fijadas. El criterio de dormida es el del espejo sancionado
 * (`sigueDormida`); la dormida sigue oculta: enseñarlas todas multiplica la
 * lista por 3,6 y dice que hay 700 aulas que atender donde hay 193.
 *
 * En módulo propio para tener UNA verdad nombrada y testeable de «quién se
 * ve» — y porque la página está congelada a crecimiento.
 */
export function filaVisibleEnAgenda(fila: Record<string, unknown>): boolean {
  const rol = String(fila.sample_role ?? "");
  if (rol !== "extra_reserve_pool" && rol !== "chain_reserve") return true;
  return !sigueDormida(fila as unknown as MonitoreoAulasPlanRow);
}
