// La entrega de un archivo, en un solo sitio: descargarlo, abrirlo, mostrarlo
// en su carpeta, guardarlo en otro lugar y copiar su ruta. Las pantallas no
// llaman a `downloadUrl`/`descargarArchivo`/`saveEntregableDialog` por su
// cuenta: lo hacen a través del kit (ratchet en entregablesRatchet.contract).

import { downloadUrl } from "../../api/core";
import { apiSaveFileAs } from "../../api/workspace";
import { descargarArchivo } from "../../lib/descargas";
import { abrirArchivo, mostrarEnCarpeta } from "../../lib/escritorio";
import { copiarTexto } from "../../lib/portapapeles";
import { toast } from "../toasterStore";
import { errorLegible } from "./generacionModelo";

function puente() {
  return typeof window === "undefined" ? undefined : window.prosecnurApi;
}

/** Hay escritorio con «Abrir» y «Mostrar en la carpeta» (preload de la fase 3). */
export function hayPuenteDeArchivos(): boolean {
  const p = puente();
  return typeof p?.abrirArchivo === "function" && typeof p?.mostrarEnCarpeta === "function";
}

/** Hay diálogo de «Guardar como…» (Electron). */
export function hayGuardarComo(): boolean {
  return typeof puente()?.saveEntregableDialog === "function";
}

/** Descarga un archivo servido por el backend (Descargas, sin diálogo en Electron). */
export function descargarDelServidor(fileId: string, nombre: string): void {
  descargarArchivo(downloadUrl(fileId), nombre);
}

export async function abrirEntregable(ruta: string): Promise<void> {
  if (!(await abrirArchivo(ruta))) {
    toast.error("No se pudo abrir el archivo", { detalle: "Puede que se haya movido o borrado. Usa Mostrar en la carpeta para ubicarlo." });
  }
}

export async function mostrarEntregable(ruta: string): Promise<void> {
  if (!(await mostrarEnCarpeta(ruta))) {
    toast.error("No se pudo mostrar la carpeta", { detalle: "Puede que el archivo se haya movido o borrado." });
  }
}

export async function copiarRuta(ruta: string): Promise<void> {
  try {
    await copiarTexto(ruta);
    toast.exito("Ruta copiada");
  } catch {
    toast.error("No se pudo copiar la ruta");
  }
}

/** «Guardar como…»: diálogo de Electron y copia del archivo de la sesión a esa ruta. */
export async function guardarComo(fileId: string, nombre: string, carpetaSugerida: string | null): Promise<void> {
  const p = puente();
  if (typeof p?.saveEntregableDialog !== "function") return;
  const ext = nombre.includes(".") ? nombre.split(".").pop() || "*" : "*";
  const sep = carpetaSugerida?.includes("\\") ? "\\" : "/";
  try {
    const destino = await p.saveEntregableDialog({
      defaultName: nombre,
      defaultPath: carpetaSugerida ? `${carpetaSugerida}${sep}${nombre}` : undefined,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: "Todos", extensions: ["*"] }],
    });
    if (!destino) return;
    const guardado = await apiSaveFileAs(fileId, destino, { overwrite: true });
    toast.exito(`Guardado como ${guardado.filename}`);
  } catch (e) {
    const { causa, codigo } = errorLegible(e);
    toast.error("No se pudo guardar el archivo", { detalle: codigo ? `${causa} (${codigo})` : causa });
  }
}
