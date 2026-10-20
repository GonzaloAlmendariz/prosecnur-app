// Decisiones puras del editor de «qué acepta» (E3): qué se borra al quitar un atajo y cuándo avisar que el mensaje
// vigente es de otra regla.

/** Quitar un atajo borra su regla. El mensaje se va sólo si era uno sugerido (el del atajo); uno escrito a mano se queda. */
export function cambiosAlQuitarAtajo(mensaje: string, sugeridos: readonly string[]): Record<string, string> {
  const m = mensaje.trim();
  return m && sugeridos.includes(m) ? { constraint: "", constraint_message: "" } : { constraint: "" };
}

/** Al aplicar un formato: sin mensaje se escribe la sugerencia; con uno distinto se avisa y se ofrece. */
export function alAplicarFormato(constraint: string, mensaje: string, sugerencia: string | null): { cambios: Record<string, string>; ofrecer: string | null } {
  const m = mensaje.trim();
  if (!sugerencia) return { cambios: { constraint }, ofrecer: null };
  if (!m) return { cambios: { constraint, constraint_message: sugerencia }, ofrecer: null };
  return { cambios: { constraint }, ofrecer: m === sugerencia ? null : sugerencia };
}
