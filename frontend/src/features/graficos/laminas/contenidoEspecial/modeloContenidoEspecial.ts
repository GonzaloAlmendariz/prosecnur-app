// Contenido especial de una lámina en Inspector › Contenido (A10 W-B; paridad C35 y C38 del retiro del Editor anterior):
// qué argumentos tienen editor propio en vez de un campo de texto (las filas de la ficha técnica y el ícono de
// población/objetivo) y qué título sale si el analista no escribe uno. Sin React, para probarlo solo.

import type { ArgMetadata, Slide, VarInfo } from "../../../../api/graficos";
import { inferSlideVariableTitle } from "../../slideAutoTitle";
import type { IconoConfig } from "../../store";

/** Las filas {criterio, detalle} de la ficha técnica. `filas` como texto es la forma vieja: el editor anterior la trataba igual. */
export function esArgFilas(a: Pick<ArgMetadata, "name" | "tipo_input">): boolean {
  return a.tipo_input === "technical_rows" || (a.name === "filas" && (a.tipo_input === "textarea" || a.tipo_input === "string"));
}

/** El ícono subido de una lámina de población u objetivo. */
export function esArgIcono(a: Pick<ArgMetadata, "tipo_input">): boolean {
  return a.tipo_input === "icono";
}

export function esArgEspecial(a: Pick<ArgMetadata, "name" | "tipo_input">): boolean {
  return esArgFilas(a) || esArgIcono(a);
}

export type ContenidoEspecial = { filas: ArgMetadata[]; iconos: ArgMetadata[] };

/** Los argumentos de la lámina que se editan con su editor propio, en el orden del registro. */
/** Las láminas de población no llevan ícono (Gonzalo: «ya quedamos en que población no lleva ícono»), aunque el
 *  registro todavía declare el campo; el motor lo quita al abrir el plan. */
export function esLaminaPoblacion(tipo: string | undefined): boolean {
  return typeof tipo === "string" && /_poblacion(_|$)/.test(tipo);
}

export function contenidoEspecialDe(args: readonly ArgMetadata[], tipo?: string): ContenidoEspecial {
  const iconos = esLaminaPoblacion(tipo) ? [] : args.filter((a) => !esArgFilas(a) && esArgIcono(a));
  return { filas: args.filter(esArgFilas), iconos };
}

export type TituloPorDefecto = {
  /** Lo que se ve en el campo vacío. */
  placeholder: string;
  /** Qué sale si el campo queda vacío; `null` si no hay nada que explicar. */
  ayuda: string | null;
};

/**
 * C35: el título de una lámina sin título escrito. Como en el editor anterior, `inferSlideVariableTitle` lo toma del
 * nombre de la pregunta del único gráfico de la lámina; el motor hace lo mismo al exportar. No se escribe en el plan:
 * cambiar la pregunta cambia el título mientras el analista no escriba otro.
 */
export function tituloPorDefecto(slide: Slide, variables: readonly (VarInfo & { source?: string })[], tipoLabel: string): TituloPorDefecto {
  // El motor rotula el objetivo «Objetivo del estudio» cuando no se escribe otro (`.lam_laminas_objetivo`).
  if (slide.tipo === "p_slide_objetivo_icono") return { placeholder: "Objetivo del estudio", ayuda: "Vacío, sale Objetivo del estudio." };
  const inferido = inferSlideVariableTitle(slide, [...variables]);
  if (inferido.source === "variable" && inferido.title) {
    return { placeholder: inferido.title, ayuda: `Vacío, sale “${inferido.title}”: el nombre de la pregunta del gráfico.` };
  }
  return { placeholder: tipoLabel, ayuda: null };
}

export type IconoElegido =
  | { estado: "ninguno" }
  | { estado: "subido"; icono: IconoConfig }
  /** El plan nombra un ícono que no está entre los subidos: se conserva y se dice, nunca se borra solo. */
  | { estado: "desconocido"; id: string };

export function iconoElegido(valor: unknown, iconos: readonly IconoConfig[]): IconoElegido {
  const id = typeof valor === "string" ? valor.trim() : "";
  if (!id) return { estado: "ninguno" };
  const icono = iconos.find((i) => i.id === id);
  return icono ? { estado: "subido", icono } : { estado: "desconocido", id };
}

/** El nombre visible de un ícono subido. */
export function nombreIcono(icono: Pick<IconoConfig, "nombre">): string {
  return icono.nombre.trim() || "Ícono sin nombre";
}
