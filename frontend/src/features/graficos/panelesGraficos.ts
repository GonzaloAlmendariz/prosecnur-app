import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PANEL_GUIAS_LAMINA } from "./laminas/guias/panelGuias";
import { PANEL_TIPO_GRAFICO, PANEL_TIPO_LAMINA } from "./laminas/selectores/panelesSelectores";

export const PANEL_BIBLIOTECA_SLIDES: PanelDeclarado = {
  id: "biblioteca-slides",
  label: "Biblioteca de slides",
  clase: "dialogo",
};

export const PANEL_BIBLIOTECA_GRAFICADORES: PanelDeclarado = {
  id: "biblioteca-graficadores",
  label: "Biblioteca de graficadores",
  clase: "dialogo",
};

/** Estructura del informe en la pestaña Láminas: lateral izquierdo, excluyente con el inspector (F6.1). */
export const PANEL_ESTRUCTURA_LAMINAS: PanelDeclarado = {
  id: "estructura",
  label: "Estructura del informe",
  clase: "sideover",
};

/** Inspector de la pestaña Láminas: lateral derecho (sideover en el compacto), excluyente con la Estructura (F6.1). */
export const PANEL_INSPECTOR_LAMINA: PanelDeclarado = {
  id: "inspector",
  label: "Ajustes de la lámina",
  clase: "sideover",
};

/** Avisos del informe en la pestaña Láminas: lo que bloquea exportar, lo que conviene revisar y lo que dijo el motor. */
export const PANEL_AVISOS_INFORME: PanelDeclarado = {
  id: "avisos",
  label: "Avisos del informe",
  clase: "sideover",
};

/** «Armar desde…» (planes sugeridos, perfiles y sincronizar equivalencias): popover direccionable (A5 rebanada 2b). */
export const PANEL_ARMAR_DESDE: PanelDeclarado = {
  id: "armar-desde",
  label: "Armar desde un plan sugerido",
  clase: "popover",
};

/** Biblioteca de íconos de un capítulo del índice (A5 rebanada 2b). */
export const PANEL_ICONOS: PanelDeclarado = {
  id: "iconos",
  label: "Íconos del índice",
  clase: "dialogo",
};

/** Biblioteca de íconos de un actor consultado de la lámina de objetivo (Gonzalo, 2026-10-13). */
export const PANEL_ICONO_ACTOR: PanelDeclarado = {
  id: "icono-actor",
  label: "Ícono del actor",
  clase: "dialogo",
};

/** Plan portátil (C11) desde el menú ⋯ de Láminas: exportar, inspeccionar y aplicar el paquete (decisión 10). */
export const PANEL_PLAN_PORTATIL: PanelDeclarado = {
  id: "plan-portatil",
  label: "Plan portátil",
  clase: "dialogo",
};

/** Exportar o importar el plan por secciones en JSON (C12) desde el menú ⋯ de Láminas (decisión 10). */
export const PANEL_SECCIONES_JSON: PanelDeclarado = {
  id: "secciones-json",
  label: "Exportar o importar secciones",
  clase: "dialogo",
};

/** W8: el Word real, generado y convertido en páginas, desde la pestaña Word. */
export const PANEL_PREVIA_WORD: PanelDeclarado = {
  id: "previa-word",
  label: "Vista previa del Word",
  clase: "dialogo",
};

/** Atajos de teclado de Gráficos (tecla «?»): `?panel=atajos`. */
export const PANEL_ATAJOS_GRAFICOS: PanelDeclarado = {
  id: "atajos",
  label: "Atajos de teclado",
  clase: "dialogo",
};

/**
 * Diferencias entre grupos (ADR 0126). La regla del estudio, una para láminas, Word y tablas de cruces:
 * `?panel=diferencias-regla` (diálogo, desde el inspector o la revisión).
 */
export const PANEL_DIFERENCIAS_REGLA: PanelDeclarado = {
  id: "diferencias-regla",
  label: "Regla de diferencias del estudio",
  clase: "dialogo",
};

/**
 * «Por qué» de las marcas de una lámina: capa anclada con el par elegido y la tabla de pares. La lámina la dice `foco`
 * (`?foco=<slide.id>&panel=diferencias-lamina`); el par elegido es estado efímero del feature, no de la dirección.
 */
export const PANEL_DIFERENCIAS_LAMINA: PanelDeclarado = {
  id: "diferencias-lamina",
  label: "Por qué se marca",
  clase: "popover",
};

/** Revisión en lote de las diferencias del informe: `?panel=diferencias` (sideover, desde el menú ⋯ de Láminas). */
export const PANEL_DIFERENCIAS_INFORME: PanelDeclarado = {
  id: "diferencias",
  label: "Diferencias del informe",
  clase: "sideover",
};

export const PANELES_GRAFICOS = [
  PANEL_BIBLIOTECA_SLIDES,
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_ESTRUCTURA_LAMINAS,
  PANEL_INSPECTOR_LAMINA,
  PANEL_AVISOS_INFORME,
  PANEL_TIPO_LAMINA,
  PANEL_TIPO_GRAFICO,
  PANEL_GUIAS_LAMINA,
  PANEL_ARMAR_DESDE,
  PANEL_ICONOS,
  PANEL_ICONO_ACTOR,
  PANEL_PLAN_PORTATIL,
  PANEL_SECCIONES_JSON,
  PANEL_PREVIA_WORD,
  PANEL_ATAJOS_GRAFICOS,
  PANEL_DIFERENCIAS_REGLA,
  PANEL_DIFERENCIAS_LAMINA,
  PANEL_DIFERENCIAS_INFORME,
] as const satisfies readonly PanelDeclarado[];
