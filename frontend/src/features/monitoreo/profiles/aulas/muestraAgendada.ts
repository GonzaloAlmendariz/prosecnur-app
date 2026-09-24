/**
 * «¿Tiene cita?» mirando el STATUS DE MUESTRA, en un solo sitio.
 *
 * Estaba escrito a mano en siete archivos —`startsWith("agendada") ||
 * startsWith("reagendada")`— y el 2026-09-24 llegó un tercer estado con cita:
 * «REFUERZO AGENDADO» (Gonzalo: «sería bueno tenerla como agendada como
 * refuerzo»). Con siete copias, el que no se actualizara lo contaría como sin
 * agendar. Acepta la forma del libro («REFUERZO AGENDADO») y la del payload
 * (`refuerzo_agendado`), igual que el backend (`MONITOREO_AULAS_MUESTRA_AGENDADA`).
 */
export const claveDeMuestra = (v: unknown): string =>
  String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export function esMuestraAgendada(v: unknown): boolean {
  const k = claveDeMuestra(v);
  return k.startsWith("agendada") || k.startsWith("reagendada") || k.startsWith("refuerzo_agendad");
}

/** El refuerzo que ya tiene fecha: agendado y, además, refuerzo. */
export function esRefuerzoAgendado(v: unknown): boolean {
  return claveDeMuestra(v).startsWith("refuerzo_agendad");
}
