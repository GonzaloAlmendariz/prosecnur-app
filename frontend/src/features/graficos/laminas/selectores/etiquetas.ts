// Nombres que los selectores muestran: de la lámina, de sus ranuras y de lo que hay en cada una.

import type { GraficadorMetadata, GraficadorRef, Slide, SlideMetadata, SlideType } from "../../../../api/graficos";
import { rotuloDeRanura } from "../disposicion/modeloDisposicion";
import { getSlotLabel } from "../../slotLabels";
import { graficadorDisplayName, humanizeIdentifier } from "../../graficadorDisplay";
import { RANURAS_ESTANDAR } from "../../iconos/ranurasEstandar.generated";
import { firstVariableRefFromGraph } from "../../slideAutoTitle";
import { SLIDE_LABELS } from "../../store";

/**
 * Las láminas de población ya no llevan el ícono del público ni forman familia propia (Gonzalo, 2026-10-14), pero el
 * registro y `SLIDE_LABELS` todavía las titulan «+ ícono»: el selector las nombra por su reparto.
 */
export const NOMBRES_SIN_ICONO: Readonly<Partial<Record<SlideType, string>>> = {
  p_slide_3_graficos_poblacion_tira: "Tres gráficos en franjas",
  p_slide_3_graficos_poblacion_corona: "Tres gráficos: dos arriba + uno ancho",
  p_slide_3_graficos_poblacion_cifras: "Tres gráficos + cifras",
  p_slide_5_graficos_poblacion: "Cinco gráficos",
  p_slide_6_graficos_poblacion: "Seis gráficos",
};

export function nombreLamina(tipo: SlideType, meta?: SlideMetadata): string {
  return NOMBRES_SIN_ICONO[tipo] || meta?.titulo_humano?.trim() || SLIDE_LABELS[tipo] || RANURAS_ESTANDAR[tipo]?.nombre || humanizeIdentifier(tipo, "Lámina");
}

/**
 * Nombre de la ranura: el del registro (`slot_specs`) o el conocido del editor, salvo que no describa el lugar que la
 * ranura ocupa en la lámina; entonces, ese lugar (con «2+3» la tercera ranura ya no es «Superior derecha»; en «Dos
 * gráficos + texto», «Izquierda» y «Derecha», como el catálogo; ronda 19).
 */
export function nombreSlot(slot: string, meta?: SlideMetadata, slide?: Pick<Slide, "tipo" | "payload">): string {
  const spec = meta?.slot_specs?.find((s) => s.name === slot);
  const conocido = getSlotLabel(slot);
  const catalogo = spec?.label.trim() || (conocido === slot ? humanizeIdentifier(slot, "Ranura") : conocido);
  const lamina = slide ?? (meta?.name ? { tipo: meta.name as Slide["tipo"], payload: {} } : undefined);
  return rotuloDeRanura(lamina, slot, catalogo);
}

/** «Barras apiladas · P12». */
export function nombreGrafico(g: GraficadorRef, graficadoresById: Readonly<Record<string, GraficadorMetadata>>): string {
  const variable = firstVariableRefFromGraph(g);
  return `${graficadorDisplayName(g.graficador, graficadoresById[g.graficador])}${variable ? `, ${rotuloVariable(variable)}` : ""}`;
}

/** «ciclo (estudiantes)» en vez de la referencia cruda «estudiantes$ciclo». */
export function rotuloVariable(ref: string): string {
  const i = ref.indexOf("$");
  return i > 0 ? `${ref.slice(i + 1)} (${ref.slice(0, i)})` : ref;
}

const CAMPOS_CONOCIDOS: Readonly<Record<string, string>> = {
  titulo: "Título",
  subtitulo: "Subtítulo",
  texto: "Texto",
  bullets: "Viñetas",
  base: "Base",
  pie: "Pie",
  etiqueta: "Etiqueta",
  icono: "Ícono",
  fecha: "Fecha",
  subtexto: "Texto descriptivo",
  filas: "Filas de la ficha",
  introduccion_word: "Introducción en el Word",
};

/** Nombre de un campo de texto: el del registro (`args`), o uno conocido. */
export function nombreCampo(clave: string, meta?: SlideMetadata): string {
  return meta?.args.find((a) => a.name === clave)?.label || CAMPOS_CONOCIDOS[clave] || humanizeIdentifier(clave, "Campo");
}
