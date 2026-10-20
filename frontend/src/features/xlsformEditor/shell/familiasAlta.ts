// Familias del menú «Añadir pieza» (2026-10-20). Pedido de Gonzalo: cada tipo con su sello solo, sin recuadro, y
// agrupado por familia con un rótulo chico, para que se distinga de un vistazo. La familia sale del catálogo de tipos
// del kit (la misma que tiñe el sello), así el grupo y el color no pueden contradecirse.

import { tipoPregunta, type FamiliaTipo } from "../kit";
import type { AddMenuItem } from "../types";

export type FamiliaAlta = "texto" | "opciones" | "fecha" | "multimedia" | "estructura" | "calculo";

export const FAMILIAS_ALTA: readonly { id: FamiliaAlta; nombre: string }[] = [
  { id: "texto", nombre: "Texto y números" },
  { id: "opciones", nombre: "Opciones" },
  { id: "fecha", nombre: "Fecha y lugar" },
  { id: "multimedia", nombre: "Multimedia" },
  { id: "estructura", nombre: "Estructura" },
  { id: "calculo", nombre: "Cálculo y nota" },
];

/** Clave del menú → tipo XLSForm cuyo sello se pinta. */
export const BASE_DE_CLAVE: Readonly<Record<string, string>> = {
  section: "begin_group",
  section_end: "end_group",
  repeat: "begin_repeat",
};

export function baseDeClave(key: string): string {
  return BASE_DE_CLAVE[key] ?? key;
}

const FAMILIA_DE_TIPO: Record<FamiliaTipo, FamiliaAlta> = {
  texto: "texto",
  numero: "texto",
  opciones: "opciones",
  fecha: "fecha",
  ubicacion: "fecha",
  evidencia: "multimedia",
  seccion: "estructura",
  repeticion: "estructura",
  calculo: "calculo",
  nota: "calculo",
  metadato: "calculo",
  otro: "estructura",
};

export function familiaDeAlta(key: string): FamiliaAlta {
  return FAMILIA_DE_TIPO[tipoPregunta(baseDeClave(key)).familia];
}

/** Los ítems en el orden de las familias; las familias sin ítems no aparecen. */
export function agruparAlta(items: readonly AddMenuItem[]): { id: FamiliaAlta; nombre: string; items: AddMenuItem[] }[] {
  return FAMILIAS_ALTA
    .map((f) => ({ ...f, items: items.filter((i) => familiaDeAlta(i.key) === f.id) }))
    .filter((g) => g.items.length > 0);
}
