/**
 * Qué ajustes ofrece el inspector para un bloque.
 *
 * La lista la decide el backend por layout (`zone.editable`, que sale de
 * `COLLECTION_MATERIAL_LAYOUT_CAPS`): sólo las propiedades que cambian la tinta
 * en ESA cara. Aquí se ordenan, se nombran en castellano y se descartan las que
 * el editor todavía no sabe editar —mejor no ofrecer un control que ofrecer uno
 * que escribe algo que el validador rechaza—.
 */

import type { CollectionBlockType } from "../../../api/recopiladores";

export type PropiedadEditable =
  | "text"
  | "binding"
  | "max_lines"
  | "fields"
  | "rows"
  | "labels"
  | "correction"
  | "quiet_zone"
  | "assets"
  | "align"
  | "max_height_mm";

export type ClaveDeAjuste = { propiedad: PropiedadEditable; rotulo: string };

/** Orden en que se muestran: primero qué dice, luego cuánto, luego cómo se ve. */
const ORDEN: readonly PropiedadEditable[] = [
  "binding", "text", "fields", "rows", "labels", "max_lines",
  "correction", "quiet_zone", "assets", "align", "max_height_mm",
];

const ROTULO: Record<PropiedadEditable, string> = {
  text: "Texto",
  binding: "Dato que muestra",
  max_lines: "Líneas como máximo",
  fields: "Campos",
  rows: "Renglones",
  labels: "Rótulos de los renglones",
  correction: "Corrección del QR",
  quiet_zone: "Margen blanco del QR",
  assets: "Logos",
  align: "Alineación",
  max_height_mm: "Alto de los logos (mm)",
};

function esEditable(valor: string): valor is PropiedadEditable {
  return (ORDEN as readonly string[]).includes(valor);
}

export function ajustesVisibles(type: CollectionBlockType, editable: readonly string[]): ClaveDeAjuste[] {
  const pedidas = new Set(editable.filter(esEditable));
  return ORDEN
    .filter((propiedad) => pedidas.has(propiedad))
    .map((propiedad) => ({
      propiedad,
      rotulo: propiedad === "rows" && type === "application_log" ? "Renglones del registro" : ROTULO[propiedad],
    }));
}
