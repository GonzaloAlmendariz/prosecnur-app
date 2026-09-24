/**
 * Pestañas de Muestra general y Acreditación (E15 · aulas como patrón): qué
 * pestaña está activa, cuál abre por defecto y adónde lleva la siguiente
 * condición de la cabecera. Puro: la dirección entra como texto y sale como
 * texto; el componente sólo lo conecta a React Router.
 */
import {
  CALC_MUESTRA_ACREDITACION_PESTANAS,
  CALC_MUESTRA_GENERAL_PESTANAS,
  type PestanaCalcMuestraUniversidad,
} from "../../../lib/navegacion/catalogos/calcMuestra";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import type { AccionSiguiente } from "./bandaDisenoModelo";
import type { ModoMesa } from "./secciones";

export type PestanaMesa = PestanaCalcMuestraUniversidad;

/** Las pestañas que declara el manifiesto para esa sección; vacío si no se parte. */
export function pestanasDeSeccion(modo: ModoMesa, seccion: string): readonly PestanaMesa[] {
  if (modo === "acreditacion") {
    return seccion === "seleccion" ? CALC_MUESTRA_ACREDITACION_PESTANAS.seleccion : [];
  }
  if (seccion === "marco" || seccion === "metodo" || seccion === "seleccion") {
    return CALC_MUESTRA_GENERAL_PESTANAS[seccion];
  }
  return [];
}

/**
 * La pestaña activa: la de la dirección si la sección la declara (un enlace
 * pegado aterriza donde dice); si no, la que la mesa propone por defecto; y
 * como piso, la primera.
 */
export function resolverPestana(
  pedida: string | null | undefined,
  pestanas: readonly Pick<PestanaMesa, "id">[],
  porDefecto?: string | null,
): string {
  if (pedida && pestanas.some((p) => p.id === pedida)) return pedida;
  if (porDefecto && pestanas.some((p) => p.id === porDefecto)) return porDefecto;
  return pestanas[0]?.id ?? "";
}

/** Marco de Muestra general: con el marco declarado se abre en su archivo (P3). */
export function pestanaPorDefectoMarco(hayMarcoDeclarado: boolean): string {
  return hayMarcoDeclarado ? "marco-archivo" : "marco-forma";
}

/** Selección de un actor: sin su archivo, primero el archivo; con él, el sorteo. */
export function pestanaPorDefectoActor(conMarco: boolean): string {
  return conMarco ? "seleccion-sorteo" : "seleccion-marco";
}

/** Id del tab del rail y de su panel: estables por sección para `aria-*`. */
export function idTabMesa(seccion: string, pestana: string): string {
  return `cmg-tab-${seccion}-${pestana}`;
}

export function idPanelMesa(seccion: string): string {
  return `cmg-panel-${seccion}`;
}

/** El `search` con sección y pestaña escritas; el `foco` se conserva. */
export function searchConSeccionYPestana(search: string, seccion: string, pestana: string | null): string {
  const conSeccion = searchConNivel(search, "seccion", seccion);
  return pestana ? conNivel(conSeccion, "pestana", pestana) : conSeccion;
}

export type EnlaceSiguiente = { etiqueta: string; seccion: string; pestana: string | null };

/**
 * Adónde lleva la siguiente condición (P4, patrones 9–10 de aulas): la
 * cabecera no ejecuta nada, enlaza con la pestaña donde se resuelve. Calcular
 * vive en Método › Parámetros (Muestra general) o en Actores (Acreditación,
 * donde se declaran N, canal y meta); sortear, en Selección › Sorteo.
 *
 * `null` cuando ya se está donde se resuelve: un enlace a sí mismo no dice nada.
 */
export function enlaceSiguiente(
  modo: ModoMesa,
  accion: AccionSiguiente | null,
  actual: { seccion: string; pestana: string | null },
): EnlaceSiguiente | null {
  if (!accion) return null;
  const destino = destinoDeAccion(modo, accion);
  if (destino.seccion !== actual.seccion) return destino;
  if (!destino.pestana || destino.pestana === actual.pestana) return null;
  // Ya en la sección: «Ir a Selección» no dice nada; se nombra la pestaña.
  const label = pestanasDeSeccion(modo, destino.seccion).find((p) => p.id === destino.pestana)?.label;
  return label && accion.tipo !== "calcular" ? { ...destino, etiqueta: `Ir a ${label}` } : destino;
}

function destinoDeAccion(modo: ModoMesa, accion: AccionSiguiente): EnlaceSiguiente {
  if (accion.tipo === "calcular") {
    return modo === "acreditacion"
      ? { etiqueta: "Calcular en Actores", seccion: "actores", pestana: null }
      : { etiqueta: "Calcular en Parámetros", seccion: "metodo", pestana: "metodo-parametros" };
  }
  const pestana = pestanaDestino(modo, accion.seccion);
  return { etiqueta: accion.etiqueta, seccion: accion.seccion, pestana };
}

function pestanaDestino(modo: ModoMesa, seccion: string): string | null {
  if (seccion === "seleccion") return "seleccion-sorteo";
  if (modo === "marco_disponible" && seccion === "marco") return "marco-archivo";
  return null;
}

