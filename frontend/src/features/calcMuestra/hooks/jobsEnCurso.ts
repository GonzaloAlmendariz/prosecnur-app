/**
 * Memoria mínima de los trabajos largos que quedaron corriendo.
 *
 * Medido en el recorrido de un usuario nuevo: se lanza «Comparar métodos» —el
 * paso más lento del módulo, más de diez minutos con un marco real—, se recarga
 * la página y la app vuelve diciendo «Falta comparar los métodos», mientras el
 * servidor sigue respondiendo `status: "running"` por ese mismo trabajo. Quien
 * recibe la app vuelve a pulsar y lanza un segundo trabajo encima del primero.
 *
 * El backend conserva el trabajo y responde por su id; lo que faltaba era que
 * la pantalla recordara ESE id al volver. Vive en `sessionStorage` a propósito:
 * es memoria de la pestaña, no del proyecto, y no debe sobrevivir a cerrar la
 * app ni viajar en el `.pulso`.
 */
export type JobLargo = "comparar" | "seleccionar" | "simular" | "construir" | "reporte";

/** Almacén mínimo: lo justo para recordar un id, y así se puede testear sin DOM. */
export type AlmacenJobs = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function almacen(dado?: AlmacenJobs | null): AlmacenJobs | null {
  if (dado) return dado;
  // Fuera del navegador (tests de nodo, SSR) no hay dónde recordar: la app
  // sigue funcionando exactamente como antes de que este módulo existiera.
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  return window.sessionStorage;
}

function clave(sid: string, kind: JobLargo): string | null {
  const s = sid.trim();
  // Sin sesión no hay dueño: un job que no se puede atribuir tampoco se puede
  // retomar con seguridad, y recordarlo invitaría a mostrar el trabajo de otra
  // sesión como propio.
  if (!s) return null;
  return `pulso.job.${s}.${kind}`;
}

export function recordarJobEnCurso(sid: string, kind: JobLargo, jobId: string, store0?: AlmacenJobs | null): void {
  const k = clave(sid, kind);
  if (!k || !jobId.trim()) return;
  const store = almacen(store0);
  if (!store) return;
  try {
    store.setItem(k, jobId.trim());
  } catch {
    // sessionStorage puede fallar (modo privado, cuota). Es memoria de apoyo:
    // sin ella la app se comporta como antes, no peor.
  }
}

export function leerJobEnCurso(sid: string, kind: JobLargo, store0?: AlmacenJobs | null): string | null {
  const k = clave(sid, kind);
  if (!k) return null;
  const store = almacen(store0);
  if (!store) return null;
  try {
    const v = store.getItem(k);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function olvidarJobEnCurso(sid: string, kind: JobLargo, store0?: AlmacenJobs | null): void {
  const k = clave(sid, kind);
  if (!k) return;
  const store = almacen(store0);
  if (!store) return;
  try {
    store.removeItem(k);
  } catch {
    // idem
  }
}
