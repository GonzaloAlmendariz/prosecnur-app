// Normalizador defensivo de lo que devuelve el backend al generar un archivo.
//
// Formas que llegan (ADR 0133 §1):
//  - una base: `{ file_id, filename, size, modulo, rotulo, guardado_en, aviso_guardado }`;
//  - varias bases: `{ zip: { …lo mismo… }, bases: [...] }`. El entregable es el
//    ZIP: es lo único que se copia junto al proyecto.
// El unboxed-JSON de R entrega un NULL como `{}` o como arreglo vacío y un
// escalar a veces como arreglo de uno; todo eso se lee como ausente o como el
// escalar. Sin `file_id` no hay archivo.

import { normalizeEntregableGuardado } from "../../api/jobs";
import type { ArchivoEntregable } from "./tipos";

function comoObjeto(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function texto(valor: unknown): string | null {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numero(valor: unknown): number | null {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Extensión en minúsculas del nombre («Libro.XLSX» → «xlsx»); vacía si no hay. */
export function formatoDelNombre(nombre: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(nombre.trim());
  return m ? m[1].toLowerCase() : "";
}

/**
 * Último tramo de una ruta, sea de Windows (`C:\…\x_2.xlsx`) o POSIX (`/…/x_2.xlsx`); null si no queda nada.
 * Si la copia junto al proyecto se renombró para no pisar otra (`_2`), el nombre que vale es el de esa copia.
 */
export function nombreDeRuta(ruta: string | null | undefined): string | null {
  const ultimo = (ruta ?? "").split(/[\\/]+/).filter(Boolean).pop();
  return ultimo?.trim() ? ultimo.trim() : null;
}

export function archivoDesdeRespuesta(raw: unknown): ArchivoEntregable[] {
  const raiz = comoObjeto(raw);
  if (!raiz) return [];
  const meta = comoObjeto(raiz.zip) ?? raiz;
  const fileId = texto(meta.file_id);
  if (!fileId) return [];
  const guardado = normalizeEntregableGuardado(raiz);
  const nombre = nombreDeRuta(guardado.guardadoEn)
    ?? texto(meta.filename) ?? texto(meta.original_name) ?? guardado.rotulo ?? "Entregable";
  return [
    {
      fileId,
      nombre,
      formato: formatoDelNombre(nombre),
      tamano: numero(meta.size),
      guardadoEn: guardado.guardadoEn,
      avisoGuardado: guardado.avisoGuardado,
      modulo: guardado.modulo,
      rotulo: guardado.rotulo,
    },
  ];
}
