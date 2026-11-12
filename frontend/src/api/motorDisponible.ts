// Si el motor de la app (el backend R que sirve `/api/*`) responde.
//
// `apiFetch` (core.ts) avisa aquí de cada respuesta y de cada fallo de red. Sin
// esto, cuando el motor se cae cada pestaña pintaba su propio error con el
// mensaje del navegador ("Failed to fetch") y nadie decía la causa común.
// Procesamiento lee este estado para mostrar un solo aviso en lugar de la
// sección (features/procesamiento/sinMotor).
//
// Dos señales cuentan como "el motor no responde":
//  - el fetch rechaza con el error de red del navegador (Chrome: "Failed to
//    fetch"; Firefox: "NetworkError when attempting to fetch resource"; Safari:
//    "Load failed"). Un AbortError no cuenta: lo pidió la propia app.
//  - en desarrollo, el proxy de Vite contesta 500 con `text/plain` vacío cuando
//    no alcanza al backend; el motor nunca responde así (sus errores son JSON),
//    y tampoco 502, 503 ni 504.
// Cualquier otra respuesta, incluso un error del motor, prueba que responde.

export type EstadoDelMotor = {
  /** El último pedido no llegó al motor. */
  sinRespuesta: boolean;
  /** Cuándo empezó la racha sin respuesta (ms epoch); null si responde. */
  desde: number | null;
};

const RESPONDE: EstadoDelMotor = { sinRespuesta: false, desde: null };

let estado: EstadoDelMotor = RESPONDE;
const oyentes = new Set<() => void>();

function publicar(siguiente: EstadoDelMotor) {
  if (siguiente.sinRespuesta === estado.sinRespuesta) return;
  estado = siguiente;
  for (const oyente of oyentes) oyente();
}

export function esFalloDeRed(e: unknown): boolean {
  if (!(e instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(e.message);
}

export function respuestaSinMotor(res: Pick<Response, "status" | "headers">): boolean {
  if (res.status === 502 || res.status === 503 || res.status === 504) return true;
  if (res.status !== 500) return false;
  // Defensivo: los dobles de prueba de `fetch` a veces no traen cabeceras.
  const tipo = typeof res.headers?.get === "function" ? res.headers.get("content-type") ?? "" : "";
  return /^text\/plain/i.test(tipo);
}

export function notificarRespuesta(res: Pick<Response, "status" | "headers"> | null | undefined, ahora: number = Date.now()) {
  if (!res || typeof res.status !== "number") return;
  if (respuestaSinMotor(res)) publicar({ sinRespuesta: true, desde: estado.desde ?? ahora });
  else publicar(RESPONDE);
}

export function notificarFallo(e: unknown, ahora: number = Date.now()) {
  if (esFalloDeRed(e)) publicar({ sinRespuesta: true, desde: estado.desde ?? ahora });
}

export function leerEstadoDelMotor(): EstadoDelMotor {
  return estado;
}

export function suscribirEstadoDelMotor(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Solo para pruebas: vuelve al estado inicial. */
export function reiniciarEstadoDelMotor() {
  estado = RESPONDE;
}
