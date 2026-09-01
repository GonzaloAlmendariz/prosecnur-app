import type { TonoAviso } from "./avisoLibroImportado";
import { fmt } from "./kpisDeAulas";

/**
 * Qué pasó con cada hoja al publicar el libro en el Sheets del operativo.
 *
 * La regla de dueño —«Aulas Agendadas» y «Aulas Aplicadas (Campo)» son del
 * equipo; «Base de control» es de la app— la cumple el motor, pero si la UI no
 * la cuenta, una hoja `respetada` se lee como una hoja que falló. Por eso
 * `respetada` lleva SIEMPRE su motivo: es la decisión de Gonzalo hecha
 * visible, no una omisión.
 *
 * La lista de acciones es ABIERTA a propósito: una acción que este código no
 * conoce viaja con su nombre en vez de tragarse la hoja —la lección más cara
 * del repo son las listas cerradas que descartan en silencio—.
 *
 * Tercera pieza de la familia: generar dice qué salió, importar qué entró,
 * publicar qué quedó escrito (y qué se respetó).
 */
export type HojaDelLibroPublicada = {
  hoja?: string;
  accion?: string;
  /** Filas de DATOS (sin cabeceras); en `respetada`, las que el equipo ya tiene. */
  filas?: number | null;
};

function conFilas(filas: number | null | undefined): string {
  const n = Number(filas);
  if (!Number.isFinite(n)) return "";
  return n === 1 ? " (1 fila)" : ` (${fmt(n)} filas)`;
}

function fraseDeHoja(h: HojaDelLibroPublicada): string {
  const nombre = String(h.hoja ?? "").trim() || "Una hoja sin nombre";
  const accion = String(h.accion ?? "").trim();
  switch (accion) {
    case "actualizada":
      return `«${nombre}» actualizada${conFilas(h.filas)}`;
    case "sembrada":
      // Sólo pasa cuando la pestaña no existía o estaba vacía: la primera y
      // única vez que la app escribe en una hoja que no es suya.
      return `«${nombre}» sembrada${conFilas(h.filas)}`;
    case "sin_cambios":
      return `«${nombre}» sin cambios`;
    case "respetada":
      return `«${nombre}» respetada${conFilas(h.filas)}: la llena el equipo, no la app`;
    default:
      return accion
        ? `«${nombre}» ${accion}${conFilas(h.filas)}`
        : `«${nombre}» sin acción declarada`;
  }
}

export function avisoLibroPublicado(res: {
  hojas?: HojaDelLibroPublicada[] | null;
  destino_guardado?: boolean;
}): { texto: string; tono: TonoAviso } {
  const hojas = res.hojas ?? [];
  if (!hojas.length) {
    // Sin resumen no se finge un verde: algo se publicó pero no se sabe qué.
    return {
      texto: "La publicación terminó pero no dijo qué pasó con cada hoja.",
      tono: "atencion",
    };
  }
  const partes = [`Libro publicado: ${hojas.map(fraseDeHoja).join(" · ")}.`];
  if (res.destino_guardado) {
    partes.push("El enlace quedó guardado: leer y publicar lo usarán sin volver a pedirlo.");
  }
  return { texto: partes.join(" "), tono: "ok" };
}
