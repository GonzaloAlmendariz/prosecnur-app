// Tarjetas de diferencias junto al total (ADR 0129, propuesta P08): qué láminas las admiten y cómo se guarda el
// interruptor en `payload.meta.tarjetas_diferencias`. El motor decide qué tarjetas hay; aquí sólo se enciende.

import type { SlideMeta, TarjetasDiferenciasMeta } from "../../slideMeta";

/** Graficadores cuyo total es un gráfico de categorías o una batería de escala (lo que el motor acompaña). */
export const GRAFICADORES_CON_TARJETAS: ReadonlySet<string> = new Set([
  "p_barras_agrupadas",
  "p_barras_apiladas",
  "p_barras_multiapiladas",
]);

/** Tope del formato aprobado: las principales, nunca más de seis. */
export const TARJETAS_MAX = 6;

/** ¿La lámina admite tarjetas? Una lámina de un gráfico, de un tipo que el motor acompaña, sin cruce propio. */
export function admiteTarjetas(tipoLamina: string, graficador: string, cruce: string): boolean {
  return tipoLamina === "p_slide_1_grafico" && GRAFICADORES_CON_TARJETAS.has(graficador) && cruce.trim() === "";
}

/** ¿Están encendidas? `true` o una opción sin `activo: false`. */
export function tarjetasActivas(meta: SlideMeta): boolean {
  const t = meta.tarjetas_diferencias;
  if (t === true) return true;
  return !!t && typeof t === "object" && t.activo !== false;
}

/**
 * El valor de `tarjetas_diferencias` al alternar. Apagar conserva la opción (rótulos cortos, cruces) con
 * `activo: false`, para que volver a encender no la pierda; sin opción que conservar, la clave se borra.
 */
export function tarjetasAlternadas(meta: SlideMeta, activo: boolean): boolean | TarjetasDiferenciasMeta | undefined {
  const t = meta.tarjetas_diferencias;
  const opcion: TarjetasDiferenciasMeta = t && typeof t === "object" ? { ...t } : {};
  const { activo: _previo, ...resto } = opcion;
  const tieneConfig = Object.keys(resto).length > 0;
  if (activo) return tieneConfig ? { ...resto, activo: true } : true;
  return tieneConfig ? { ...resto, activo: false } : undefined;
}
