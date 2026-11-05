// Canal `meta` de una lámina (F6.0b.3; inventario F6, parte A, problema de fondo 1).
//
// Las decisiones del recetario que no son datos del gráfico —variante de portada o cierre, composición e íconos del
// índice, actores del objetivo, antetítulo, nivel/número/rótulo del separador, método de redondeo, motor nativo— viajan
// en `payload.meta`, que los 33 constructores `p_slide_*` aceptan. El backend la normaliza
// (`api/R/graficos_slide_meta.R`). Este módulo es la única puerta del editor para leerla y escribirla.

import type { Slide } from "../../api/graficos";

export type SlideMeta = {
  /** Portada («centrada», «izquierda», «banda») o cierre. */
  variante?: string;
  /**
   * Índice: «arcos», «facetas», «circulos», «bloques». En la lámina de dos gráficos, «cifra_lateral»: la cifra al lado y
   * el gráfico con su desglose bajo cada barra (lamina_cifra_y_grafico.R; laminas/cifraLateral/).
   */
  composicion?: string;
  /** La cifra de la composición «cifra_lateral»: `fila` (la respuesta que cuenta), `rotulo`, `texto`, `franja`, `comparacion`. */
  cifra?: Record<string, unknown>;
  /** Índice: ícono por capítulo, en orden. */
  iconos?: string[];
  /** Objetivo: actores consultados. */
  actores?: string[];
  /** Objetivo: ícono de cada actor, alineado con `actores` («» = el que el motor elige por el nombre). */
  actores_iconos?: string[];
  /** Objetivo «dimensiones» (recetario 28): las tarjetas de «Conocer la percepción sobre», hasta cuatro. */
  dimensiones?: string[];
  /** Antetítulo propio; sin él la lámina hereda el del separador vigente. */
  antetitulo?: string;
  /** Separador. */
  nivel?: "capitulo" | "subcapitulo";
  numero?: string;
  rotulo?: string;
  /** Lámina de redondeo: «estandar», «resto_mayor» o «ambos». */
  metodo?: "estandar" | "resto_mayor" | "ambos";
  /** `false` pide la ruta anterior para esta lámina. */
  motor_nativo?: boolean;
  /**
   * Láminas de dos gráficos: el de `de` habilita al otro con esas respuestas (DependenciaLamina, graficos_dependencia.R).
   * En la de tres gráficos en fila, `habilita` va por ranura dependiente (dependenciaTres.ts).
   */
  dependencia?: { de: string; habilita: string[] | Record<string, string[]>; frase?: string };
  /**
   * ADR 0129: tarjetas de diferencias junto al total (graficos_tarjetas_diferencias.R). `true` o la opción completa; en
   * la lámina de dos gráficos, un mapa por ranura (graficos_tarjetas_ranuras.R).
   */
  tarjetas_diferencias?: boolean | TarjetasDiferenciasMeta | TarjetasPorRanura;
};

/**
 * Opción de las tarjetas de diferencias (ADR 0129). El inspector edita `activo`, `todas`, `cruces`, `rotulos`, `cortos`,
 * `publico` y `max` (laminas/diferencias/); `modo`, `indicador` y cualquier otra clave se conservan sin tocarse.
 */
export type TarjetasDiferenciasMeta = {
  activo?: boolean;
  /** Cuántas tarjetas como máximo: 1 a 9, 4 por defecto; en una ranura de dos gráficos, 2 como máximo. */
  max?: number;
  /** Una tarjeta por cruce con todos los grupos comparables, haya o no diferencias (ítem 23 de la v7 RV). */
  todas?: boolean;
  /** Variables de cruce, en orden; vacío, los cruces del estudio. */
  cruces?: string[];
  /** Nombre de cada cruce por su variable sin base («area» → «Área»). */
  rotulos?: Record<string, string>;
  /** Rótulo corto de un grupo largo («Economía y Finanzas» → «Econ. y Finanzas»). */
  cortos?: Record<string, string>;
  /** Cómo se nombran los casos en la lectura («estudiantes»); vacío, «personas encuestadas». */
  publico?: string;
  /** «en_linea»: el desglose pegado a su barra (lamina_tarjetas_en_linea.R). */
  modo?: string;
  indicador?: string;
};

/** Tarjetas por gráfico en `p_slide_2_graficos`: la opción de cada ranura. */
export type TarjetasPorRanura = {
  izquierda?: boolean | TarjetasDiferenciasMeta;
  derecha?: boolean | TarjetasDiferenciasMeta;
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** La `meta` guardada en la lámina (vacía si no hay). */
export function leerSlideMeta(slide: Pick<Slide, "payload">): SlideMeta {
  const m = slide.payload?.meta;
  return esObjeto(m) ? (m as SlideMeta) : {};
}

/**
 * La lámina con `meta` actualizada. Un valor `undefined`, cadena vacía o lista vacía borra la clave; si no queda
 * ninguna, `meta` sale del payload (el motor usa sus valores por defecto). No muta la lámina original.
 */
export function conSlideMeta<T extends Pick<Slide, "payload">>(slide: T, cambios: Partial<SlideMeta>): T {
  const siguiente: Record<string, unknown> = { ...leerSlideMeta(slide) };
  for (const [clave, valor] of Object.entries(cambios)) {
    const vacio = valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0);
    if (vacio) delete siguiente[clave];
    else siguiente[clave] = valor;
  }
  const { meta: _anterior, ...resto } = slide.payload ?? {};
  const payload = Object.keys(siguiente).length ? { ...resto, meta: siguiente } : resto;
  return { ...slide, payload };
}
