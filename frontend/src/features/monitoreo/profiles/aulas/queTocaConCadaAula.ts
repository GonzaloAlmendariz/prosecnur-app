import { esMuestraAgendada } from "./muestraAgendada";
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
// sin_contactar, en_contacto, agendada, reagendada, rechazo, en_reserva,
// reemplazada, refuerzo_por_contactar— más los dos ejes
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
  // Aplicado o cerrado: el agendador ya no tiene nada que hacer aquí.
  //
  // **«Aplicado», no «—».** El guion decía bien que no toca nada y no decía por
  // qué, y en esa misma fila la columna de al lado marca «Sin contactar»
  // —`sample_status` llega vacío del libro y el motor lo normaliza así—. Las dos
  // juntas se leen como un aula olvidada. Medido el 2026-08-24 con la
  // simulación de campo: CH 1 a CH 5, aplicadas entre el 1 y el 5 de
  // septiembre, salían «Sin contactar · —».
  //
  // Sigue sin ser una acción, que es lo que esta columna promete para el resto
  // de filas; es el motivo de que no haya ninguna, y eso es justo lo que
  // faltaba para poder leer la fila entera.
  if (tieneParte || aplicacion === "aplicada" || aplicacion === "cerrada") return "Aplicado";

  const estado = clave(fila.sample_status);
  // Un reemplazado salió del plan por su reserva: ya no se llama a este docente.
  // **La cola del agendador.** La app acaba de poner esta aula por delante como
  // complemento (B) o refuerzo (C) y nadie la ha llamado: lo que toca es
  // justamente eso, y es lo primero de su lista. Sin esta rama caía al genérico
  // y se perdía entre las que nunca se tocaron.
  if (estado === "refuerzo_por_contactar") return "Contactar: refuerzo";
  if (estado === "reemplazada") return "Reemplazado";
  if (estado === "en_reserva") return "En reserva";
  // El docente dijo que no: no se le vuelve a llamar; la cadena releva (B13b).
  if (estado === "rechazo") return "Rechazado";

  const fecha = texto(fila.scheduled_date);
  if (!fecha) {
    // Contactada pero sin fecha cerrada: es el caso que más se atasca, y decir
    // «llamar» otra vez sería empezar de cero un trabajo que ya avanzó.
    if (esMuestraAgendada(estado)) return "Cerrar fecha";
    // En contacto ya avanzo (llamadas hechas, sin acuerdo): insistir, no
    // empezar de cero (B13b).
    if (estado === "en_contacto") return "Volver a llamar";
    return "Llamar al docente";
  }

  // Con fecha: sólo queda esperar… salvo que el día ya pasara sin parte.
  if (corte && fecha < corte) return "Confirmar si se aplicó";
  return "Esperar al día";
}
