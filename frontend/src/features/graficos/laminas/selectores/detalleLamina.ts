// Textos de la ficha de «¿Qué lámina?» (columna derecha), en lenguaje de analista: una sola frase de para qué sirve, qué
// admite, el tamaño de su texto dicho en palabras y lo que hace el botón. Las medidas del estándar (puntos, pulgadas)
// no salen de aquí: viven sólo en el plegable «Medidas del estándar».

import type { SlideType } from "../../../../api/graficos";
import type { FamiliaEstandar } from "../../iconos/estandarLaminas.generated";
import type { ModoSelectorLamina } from "./selectoresStore";
import type { VariantesTipo } from "./tiposLamina";

/** El texto del estándar no menciona el ícono del público: esas láminas ya no lo llevan (Gonzalo, 2026-10-14). */
const MENCIONA_ICONO = /[íi]cono/i;

const conPunto = (s: string): string => (/[.!?…]$/.test(s) ? s : `${s}.`);

/**
 * Una sola frase. Manda el «para qué se usa» del estándar (la misma idea que la tarjeta); la descripción del registro
 * sólo entra si el estándar no la tiene (láminas de estructura, cuya tarjeta lleva la versión corta) y no habla del
 * ícono. Nunca las dos juntas: repetían la idea («La lámina estándar: una pregunta, un gráfico. Lámina estándar con un solo gráfico…»).
 */
export function fraseDetalle(uso: string | undefined, descripcion: string | undefined): string {
  const u = uso?.trim() ?? "";
  if (u) return conPunto(u);
  const d = descripcion?.trim() ?? "";
  return d && !MENCIONA_ICONO.test(d) ? conPunto(d) : "";
}

/**
 * Para qué sirve cada lámina de estructura, en una línea de tarjeta. El estándar sólo trae el «uso» de las láminas con
 * gráficos; la descripción del registro de estas es larga (la del redondeo pasa de 200 caracteres) y en la tarjeta
 * quedaba cortada con «…». La descripción completa sigue en la ficha.
 */
const USO_ESTRUCTURA: Readonly<Partial<Record<SlideType, string>>> = {
  p_slide_portada: "Título, encargo y fecha del informe",
  p_slide_indice: "Los capítulos del informe",
  p_slide_objetivo_icono: "El objetivo del estudio y quiénes opinan",
  p_slide_tabla_tecnica: "Ficha técnica o parámetros en dos columnas",
  p_slide_top_two_box: "Cómo se lee el Top Two Box",
  p_slide_redondeo: "Por qué una barra suma 99 % o 101 %",
  p_slide_seccion: "Abre un capítulo o un subcapítulo",
  p_slide_cierre: "Logo y contacto al cierre",
};

/** La línea de la tarjeta: el «uso» del estándar o, en estructura, el propio. Nunca la descripción larga ni el ícono. */
export function usoDeTarjeta(tipo: SlideType, usoEstandar: string | undefined, descripcion: string | undefined): string {
  const u = usoEstandar?.trim() || USO_ESTRUCTURA[tipo];
  if (u) return u;
  const d = descripcion?.trim() ?? "";
  return d && !MENCIONA_ICONO.test(d) ? d.split(/(?<=\.)\s/)[0].replace(/\.$/, "") : "";
}

/** «Estándar», «Reducido» o «Pequeño», según el rótulo que el compositor le aplica a la familia. */
export function tamanoTexto(familia: Pick<FamiliaEstandar, "rotulo_pt"> | null | undefined): string | null {
  if (!familia) return null;
  if (familia.rotulo_pt >= 12) return "Estándar";
  if (familia.rotulo_pt >= 11) return "Reducido";
  return "Pequeño";
}

export type EstadoBoton = { texto: string; deshabilitado: boolean };

export type EntradaBoton = {
  modo: ModoSelectorLamina;
  /** Sólo al cambiar: si es el mismo tipo y cuántos gráficos no caben. */
  cambio: { mismoTipo: boolean; sobrantes: readonly unknown[] } | null;
  variantes: VariantesTipo | null;
  variante: string | null;
  varianteActual: string | null;
  confirmando: boolean;
};

/** Lo que el botón del pie hace, dicho con la palabra de la columna: composición o variante. */
export function etiquetaBoton(p: EntradaBoton): EstadoBoton {
  if (p.modo === "insertar") return { texto: "Insertar esta composición", deshabilitado: false };
  if (p.cambio?.mismoTipo) {
    if (!p.variantes) return { texto: "Es la composición actual", deshabilitado: true };
    return p.variante === p.varianteActual
      ? { texto: "Es la variante actual", deshabilitado: true }
      : { texto: "Usar esta variante", deshabilitado: false };
  }
  const n = p.cambio?.sobrantes.length ?? 0;
  if (p.confirmando && n > 0) return { texto: `Cambiar y quitar ${n === 1 ? "1 gráfico" : `${n} gráficos`}`, deshabilitado: false };
  if (p.confirmando) return { texto: "Cambiar de todos modos", deshabilitado: false };
  return { texto: "Usar esta composición", deshabilitado: false };
}
