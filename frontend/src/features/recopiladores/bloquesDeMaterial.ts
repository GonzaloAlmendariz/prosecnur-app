/**
 * Cómo se nombra cada tipo de bloque de una plantilla de material en el editor.
 *
 * El vocabulario lo fija el backend (`COLLECTION_MATERIAL_BLOCK_TYPES`,
 * api/R/collection_materials.R) y aquí se espeja en `COLLECTION_BLOCK_TYPES`.
 * Cuando el espejo se quedó en 9 de 13, la careta del afiche (`brand_strip`)
 * salía como una fila vacía en la lista, una cabecera en blanco en el lienzo y
 * «brand_header» en el inspector: el <select> del tipo no tenía su opción y
 * caía a la primera. El `Record` exhaustivo hace que el próximo tipo nuevo no
 * compile sin su rótulo.
 */

import {
  COLLECTION_BLOCK_TYPES,
  type CollectionBlockType,
  type CollectionMaterialBlock,
} from "../../api/recopiladores";

export const ROTULOS_DE_BLOQUE: Record<CollectionBlockType, string> = {
  brand_header: "Cabecera de marca",
  brand_strip: "Careta de logos",
  status_tag: "Etiqueta de estado",
  heading: "Título",
  body: "Texto",
  access_qr: "QR de acceso",
  field_grid: "Campos de la unidad",
  form_lines: "Renglones para llenar",
  instructions: "Instrucciones",
  application_log: "Registro de aplicación",
  divider: "Separador",
  footer: "Pie de página",
  campus_map: "Croquis del campus",
};

function esTipoConocido(type: string): type is CollectionBlockType {
  return (COLLECTION_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * El rótulo del bloque. Un tipo que el frontend no conoce todavía no se queda
 * mudo: dice que es un bloque y cuál, para que la fila no salga en blanco.
 */
export function rotuloDeBloque(type: string): string {
  return esTipoConocido(type) ? ROTULOS_DE_BLOQUE[type] : `Bloque ${type}`;
}

/**
 * Las opciones del <select> «Tipo» del inspector: los 13 tipos y, si el bloque
 * trae uno desconocido, también ese. Sin su opción el navegador pinta la
 * primera y el inspector afirma un tipo que el bloque no tiene.
 */
export function opcionesDeTipo(actual: string): Array<{ value: string; label: string }> {
  const opciones = COLLECTION_BLOCK_TYPES.map((type) => ({ value: type as string, label: ROTULOS_DE_BLOQUE[type] }));
  return esTipoConocido(actual) ? opciones : [...opciones, { value: actual, label: rotuloDeBloque(actual) }];
}

/**
 * Los tipos que «Añadir bloque» puede sembrar con una semilla que el backend
 * acepta. La careta pide ids de logo, los renglones piden sus campos y el
 * croquis vive en el dorso: sembrarlos vacíos dejaría una plantilla que el
 * guardado rechaza. Se ven y se editan si el preset los trae; no se inventan.
 */
export const TIPOS_QUE_SE_AGREGAN: readonly CollectionBlockType[] = COLLECTION_BLOCK_TYPES.filter(
  (type) => type !== "brand_strip" && type !== "form_lines" && type !== "campus_map",
);

function cuenta(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("es-PE")} ${n === 1 ? singular : plural}`;
}

const ALINEACION: Record<string, string> = {
  left: "a la izquierda",
  center: "centrada",
  right: "a la derecha",
};

/**
 * Lo que pinta un bloque que no tiene texto ni dato propio. La careta y los
 * renglones no llevan `text` ni `binding`, y sin esto el lienzo los dibujaba
 * como una caja con sólo el rótulo.
 */
export function resumenDelBloque(block: Pick<CollectionMaterialBlock, "type"> & Record<string, unknown>): string {
  if (block.type === "brand_strip") {
    const logos = Array.isArray(block.assets) ? block.assets.length : 0;
    const align = typeof block.align === "string" ? ALINEACION[block.align] : undefined;
    return [cuenta(logos, "logo", "logos"), align].filter(Boolean).join(" · ");
  }
  if (block.type === "form_lines") {
    const rows = Array.isArray(block.rows) ? block.rows.length : 0;
    return `${cuenta(rows, "renglón", "renglones")} que se llenan a mano`;
  }
  if (block.type === "campus_map") return "El pabellón del aula, resaltado";
  return "";
}
