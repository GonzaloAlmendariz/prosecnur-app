// Qué dice cada ícono del editor de formularios (pedido de Gonzalo, 2026-11-01: «un botoncito de pregunta al lado del
// aviso que enseñe de forma visual e intuitiva qué significa cada ícono, tanto los de tipo de pregunta como los de
// lógica o restricciones»). Lee los mismos catálogos que pintan la Estructura, así que la leyenda no puede decir un
// nombre que el sello no tenga.

import type { ClaveMarca } from "../kit/glifosMarca";
import { INFO_MARCA } from "../kit/marcasNodo";
import { NOMBRE_GRUPO, TIPOS_PREGUNTA, type GrupoTipo, type TipoPregunta } from "../kit/tiposPregunta";

/** El orden en que se leen los grupos: lo que más se usa primero, lo automático al final. */
const ORDEN_GRUPOS: readonly GrupoTipo[] = ["opciones", "captura", "fecha", "evidencia", "ubicacion", "estructura", "metadato"];

/** Los cierres no se ven como pieza propia en la Estructura: el cierre es el borde de la sección. */
const SIN_SELLO_PROPIO = new Set(["end_group", "end_repeat"]);

export type GrupoLeyenda = { grupo: GrupoTipo; nombre: string; tipos: readonly TipoPregunta[] };

export function gruposDeTipos(): GrupoLeyenda[] {
  return ORDEN_GRUPOS.map((grupo) => ({
    grupo,
    nombre: NOMBRE_GRUPO[grupo],
    tipos: TIPOS_PREGUNTA.filter((t) => t.grupo === grupo && !SIN_SELLO_PROPIO.has(t.base)),
  })).filter((g) => g.tipos.length > 0);
}

/** Lo que significa cada marca del riel, en una línea que se entiende sin saber XLSForm. */
const SIGNIFICADO_MARCA: Readonly<Record<ClaveMarca, string>> = {
  oblig: "Hay que responderla para seguir.",
  cond: "Sólo aparece si se cumple una condición sobre otra respuesta.",
  hered: "Aparece según la condición de la sección que la contiene.",
  regla: "Sólo acepta respuestas que cumplan una regla (un rango, un formato).",
  calc: "Su valor sale de una fórmula; nadie la responde.",
  filtro: "Muestra sólo algunas opciones según otra respuesta.",
  repite: "Está dentro de una repetición: se responde una vez por cada registro.",
};

const ORDEN_MARCAS: readonly ClaveMarca[] = ["oblig", "cond", "hered", "regla", "calc", "filtro", "repite"];

export type MarcaLeyenda = { clave: ClaveMarca; nombre: string; significado: string };

export function marcasDeLaLeyenda(): MarcaLeyenda[] {
  return ORDEN_MARCAS.map((clave) => ({ clave, nombre: INFO_MARCA[clave].nombre, significado: SIGNIFICADO_MARCA[clave] }));
}
