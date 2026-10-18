import type { AddMenuItem } from "../types";

// Tipos que se pueden agregar (2026-10-17): FUENTE ÚNICA del «+» de la Estructura y del menú «Añadir pieza» de la
// página (que los mapea y suma el cierre suelto de sección). La clave es la del menú (su maqueta) y `base` el tipo que
// recibe `onInsertar`. El cierre suelto no está aquí: en la Estructura el cierre es el borde de la sección.

type TipoInsertable = { key: string; base: string; label: string; hint: string; group: NonNullable<AddMenuItem["group"]> };

export const TIPOS_INSERTABLES: readonly TipoInsertable[] = [
  { key: "text", base: "text", label: "Pregunta abierta", hint: "Respuesta escrita libre.", group: "capture" },
  { key: "integer", base: "integer", label: "Número entero", hint: "Edad, cantidad o puntaje.", group: "capture" },
  { key: "decimal", base: "decimal", label: "Número decimal", hint: "Monto, proporción o medida.", group: "capture" },
  { key: "date", base: "date", label: "Fecha", hint: "Día, mes y año.", group: "capture" },
  { key: "select_one", base: "select_one", label: "Selección única", hint: "Una respuesta de una lista.", group: "choices" },
  { key: "select_multiple", base: "select_multiple", label: "Selección múltiple", hint: "Varias respuestas de una lista.", group: "choices" },
  { key: "image", base: "image", label: "Foto o imagen", hint: "Foto desde la cámara o la galería.", group: "evidence" },
  { key: "audio", base: "audio", label: "Audio", hint: "Grabación de voz.", group: "evidence" },
  { key: "video", base: "video", label: "Video", hint: "Clip de video.", group: "evidence" },
  { key: "file", base: "file", label: "Archivo", hint: "Documento adjunto.", group: "evidence" },
  { key: "barcode", base: "barcode", label: "Código de barras", hint: "Escaneo de código o QR.", group: "evidence" },
  { key: "geopoint", base: "geopoint", label: "Punto GPS", hint: "Coordenadas GPS.", group: "evidence" },
  { key: "note", base: "note", label: "Nota informativa", hint: "Texto visible sin respuesta.", group: "logic" },
  { key: "calculate", base: "calculate", label: "Cálculo", hint: "Valor calculado con una fórmula.", group: "logic" },
  { key: "section", base: "begin_group", label: "Sección", hint: "Grupo de preguntas con inicio y cierre.", group: "logic" },
];

/** Ítems del menú de tipos; elegir uno llama `alElegir` con el tipo base. */
export function itemsInsertar(alElegir: (base: string) => void): AddMenuItem[] {
  return TIPOS_INSERTABLES.map((t) => ({
    key: t.key,
    label: t.label,
    hint: t.hint,
    group: t.group,
    // El menú dibuja la maqueta del tipo para estas claves: el ícono no se usa.
    icon: null,
    action: () => alElegir(t.base),
  }));
}
