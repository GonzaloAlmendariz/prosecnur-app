// Monitoreo sobre el kit de entregables (ADR 0133, fase 5): lo que el módulo
// agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_MONITOREO`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `archivoAnidado`: el XLSForm de ocurrencias llega dentro de `file`
//   (`{ file: { file_id, original_name, size }, state, … }`); el kit lo lee en
//   la raíz. Se sube conservando los campos del entregable.
// - `archivosSueltos`: los archivos que acompañan al entregable principal
//   (las piezas del ZIP de Procesamiento, los directos de la evidencia, los del
//   paquete operativo), con su rótulo y en el orden pedido; los que no llegaron
//   no salen.

export const MODULO_MONITOREO = "Monitoreo";

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** La respuesta con el archivo de `file` en la raíz, donde lo busca el kit. Sin `file`, la respuesta tal cual. */
export function archivoAnidado(respuesta: unknown, clave = "file"): unknown {
  if (!esRegistro(respuesta)) return respuesta;
  const anidado = respuesta[clave];
  if (!esRegistro(anidado) || !texto(anidado.file_id)) return respuesta;
  return { ...anidado, filename: texto(anidado.filename) ?? texto(anidado.original_name) ?? undefined };
}

export type ArchivoSuelto = { clave: string; rotulo: string; fileId: string; nombre: string };

/** Los archivos de `files` que llegaron con `file_id`, en el orden y con el rótulo de `rotulos`. */
export function archivosSueltos(files: unknown, rotulos: ReadonlyArray<readonly [string, string]>): ArchivoSuelto[] {
  if (!esRegistro(files)) return [];
  return rotulos.flatMap(([clave, rotulo]) => {
    const meta = files[clave];
    if (!esRegistro(meta)) return [];
    const fileId = texto(meta.file_id);
    if (!fileId) return [];
    return [{ clave, rotulo, fileId, nombre: texto(meta.filename) ?? texto(meta.original_name) ?? rotulo }];
  });
}
