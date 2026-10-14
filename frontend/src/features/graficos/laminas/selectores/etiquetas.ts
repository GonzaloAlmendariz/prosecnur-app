// Nombres que los selectores muestran: de la lámina, de sus ranuras y de lo que hay en cada una.

import type { GraficadorMetadata, GraficadorRef, SlideMetadata, SlideType } from "../../../../api/graficos";
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

/** Nombre de la ranura: el del registro (`slot_specs`), o el conocido del editor. */
export function nombreSlot(slot: string, meta?: SlideMetadata): string {
  const spec = meta?.slot_specs?.find((s) => s.name === slot);
  if (spec?.label.trim()) return spec.label.trim();
  const conocido = getSlotLabel(slot);
  return conocido === slot ? humanizeIdentifier(slot, "Ranura") : conocido;
}

/** «Barras apiladas · P12». */
export function nombreGrafico(g: GraficadorRef, graficadoresById: Readonly<Record<string, GraficadorMetadata>>): string {
  const variable = firstVariableRefFromGraph(g);
  return `${graficadorDisplayName(g.graficador, graficadoresById[g.graficador])}${variable ? ` · ${rotuloVariable(variable)}` : ""}`;
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
