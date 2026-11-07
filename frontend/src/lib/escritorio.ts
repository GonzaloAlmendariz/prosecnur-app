/**
 * Puente de escritorio para las descargas sin diálogo (ADR 0133, fase 3).
 *
 * En Electron, lo que no quedó guardado junto al proyecto se descarga sin
 * diálogo a la carpeta de Descargas del sistema; el main avisa al terminar y
 * permite «Abrir» y «Mostrar en la carpeta» sobre la ruta avisada (la valida
 * él: Descargas o `<proyecto>/Entregables`). En el navegador, o con un shell
 * cuyo preload aún no expone estas funciones, todo devuelve `false` o una
 * desuscripción vacía: el llamador decide si ofrece esas acciones.
 */

export type EstadoDescarga = "completed" | "cancelled" | "interrupted";

export type DescargaTerminada = {
  estado: EstadoDescarga | string;
  nombre: string;
  ruta: string;
};

type RespuestaEntregable = { ok: true } | { ok: false; motivo?: string };

function puente() {
  if (typeof window === "undefined" || !window) return undefined;
  return window.prosecnurApi;
}

async function llamar(
  funcion: ((ruta: string) => Promise<RespuestaEntregable>) | undefined,
  ruta: string,
): Promise<boolean> {
  if (typeof funcion !== "function") return false;
  try {
    const respuesta: unknown = await funcion(ruta);
    return (
      typeof respuesta === "object" &&
      respuesta !== null &&
      (respuesta as { ok?: unknown }).ok === true
    );
  } catch {
    return false;
  }
}

/** Muestra el archivo en el explorador del sistema. `true` si el main lo hizo. */
export function mostrarEnCarpeta(ruta: string): Promise<boolean> {
  return llamar(puente()?.mostrarEnCarpeta, ruta);
}

/** Abre el archivo con la aplicación del sistema. `true` si el main lo hizo. */
export function abrirArchivo(ruta: string): Promise<boolean> {
  return llamar(puente()?.abrirArchivo, ruta);
}

/** Suscribe al aviso de descarga terminada. Devuelve la desuscripción. */
export function alTerminarDescarga(callback: (descarga: DescargaTerminada) => void): () => void {
  const suscribir = puente()?.onDescargaTerminada;
  if (typeof suscribir !== "function") return () => {};
  try {
    const desuscribir = suscribir(callback);
    return typeof desuscribir === "function" ? desuscribir : () => {};
  } catch {
    return () => {};
  }
}
