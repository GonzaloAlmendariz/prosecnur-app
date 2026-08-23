// queTocaConCadaAula.ts — la columna que dice qué hacer.
//
// Patrón 7 del catálogo: la tabla «Detalle por facultad» de Cálculo termina en
// **A COORDINAR**, en negrita, porque es lo que hay que hacer. Las tablas de
// Monitoreo llevan las columnas que trae el payload y ninguna dice qué toca.
//
// Y es la vista del AGENDADOR: su trabajo es llevar cada titular de «sin
// contactar» a «con fecha cerrada». Una tabla que le enseña el estado le obliga
// a traducirlo a una acción en su cabeza, fila por fila, 193 veces.
//
// Los estados son los canónicos del motor —`monitoreo_aulas_estados_muestra()`:
// agendada, reagendada, en_reserva, reemplazada, sin_contactar— más los dos ejes
// que el motor mantiene separados a propósito: cómo se consiguió el aula y cómo
// fue la aplicación.

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const clave = (v: unknown): string =>
  texto(v).toLowerCase().replace(/[\s-]+/g, "_");

/** Una fila de la agenda, con lo que hace falta para saber qué toca. */
export type FilaDeAgenda = {
  sample_status?: unknown;
  scheduled_date?: unknown;
  applied_at?: unknown;
  applied_date?: unknown;
  operational_status?: unknown;
};

/**
 * Qué toca hacer con esta aula, hoy.
 *
 * @param corte día contra el que se mide el atraso (`AAAA-MM-DD`), el mismo
 *   sello del tablero que usa el resto del perfil — no el reloj del navegador,
 *   que haría que la misma tabla dijera cosas distintas según cuándo se abra.
 */
export function queTocaConCadaAula(fila: FilaDeAgenda, corte: string): string {
  const aplicacion = clave(fila.operational_status);
  const tieneParte = Boolean(texto(fila.applied_at) || texto(fila.applied_date));
  // Aplicada o cerrada: el agendador ya no tiene nada que hacer aquí.
  if (tieneParte || aplicacion === "aplicada" || aplicacion === "cerrada") return "—";

  const estado = clave(fila.sample_status);
  // Una reemplazada salió del plan por su reserva: ya no se llama a este docente.
  if (estado === "reemplazada") return "Reemplazada";
  if (estado === "en_reserva") return "En reserva";

  const fecha = texto(fila.scheduled_date);
  if (!fecha) {
    // Contactada pero sin fecha cerrada: es el caso que más se atasca, y decir
    // «llamar» otra vez sería empezar de cero un trabajo que ya avanzó.
    return estado === "agendada" || estado === "reagendada" ? "Cerrar fecha" : "Llamar al docente";
  }

  // Con fecha: sólo queda esperar… salvo que el día ya pasara sin parte.
  if (corte && fecha < corte) return "Confirmar si se aplicó";
  return "Esperar al día";
}
