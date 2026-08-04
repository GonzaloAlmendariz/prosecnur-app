// =============================================================================
// pendingFlushRegistry — flushes pendientes de sincronización cliente→backend
// =============================================================================
// Guardar o duplicar un proyecto serializa la sesión del backend TAL CUAL está
// en ese instante. Cualquier autosave debounced (editor XLSForm, plan de
// gráficos, …) que todavía no despachó su POST deja el .pulso con estado viejo:
// en el path original localStorage lo enmascara, pero la copia duplicada nace
// sin ese amortiguador y el trabajo "desaparece" (G-13).
//
// Las features con autosave registran aquí un flusher; los flujos de guardado
// (`useProject.save/saveAs/duplicate`) los esperan ANTES de llamar a la API.
// Un flusher debe ser idempotente y resolver aunque no tenga nada pendiente.

type PendingFlusher = () => Promise<unknown>;

const flushers = new Set<PendingFlusher>();

/** Registra un flusher y devuelve la función para des-registrarlo. */
export function registerPendingFlush(flusher: PendingFlusher): () => void {
  flushers.add(flusher);
  return () => {
    flushers.delete(flusher);
  };
}

/** Espera todos los flushes registrados. Nunca rechaza: un flusher caído no
 *  debe bloquear el guardado del proyecto (el backend serializa lo que sí
 *  llegó, igual que hoy — solo que sin la ventana del debounce). */
export async function flushPendingSyncs(): Promise<void> {
  await Promise.allSettled(Array.from(flushers, (flusher) => flusher()));
}

/** Solo para tests: vacía el registro. */
export function __resetPendingFlushRegistry(): void {
  flushers.clear();
}
