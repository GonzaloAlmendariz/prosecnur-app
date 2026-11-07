// Grupos de la tarjeta del gráfico (O7b del rediseño, 2026-10-15; aprobado por Gonzalo): Datos, Categorías y orden,
// Cifras, Diferencias entre grupos (ADR 0128), Colores y En el Word. Cada campo de la lista blanca cae en uno; lo no listado es Datos. Un grupo sin nada para
// ese tipo de gráfico no se muestra (CSS), así cada tipo enseña su propio juego de ajustes.

export type GrupoTarjeta = "datos" | "orden" | "cifras";

/** Las secciones de la tarjeta, en el orden en que salen (H4: cada una se pliega y el índice salta a ella). */
export type SeccionTarjeta = GrupoTarjeta | "diferencias" | "colores" | "word";

export const SECCIONES_TARJETA: readonly SeccionTarjeta[] = ["datos", "orden", "cifras", "diferencias", "colores", "word"];

export const TITULO_GRUPO: Readonly<Record<SeccionTarjeta, string>> = {
  datos: "Datos",
  orden: "Categorías y orden",
  cifras: "Cifras",
  // ADR 0128: el interruptor y el resumen de las marcas; reemplaza al «Nivel de significancia» de Cifras.
  diferencias: "Diferencias entre grupos",
  colores: "Colores",
  word: "En el Word",
};

const ORDEN: ReadonlySet<string> = new Set([
  "orden_barras", "orden", "orden_periodos", "max_categorias", "top_k", "top_n", "agrupar_resto_en_otros", "etiqueta_otros",
  "mostrar_ceros", "mostrar_categorias_en_cero", "mostrar_respuestas", "filete_temas", "mostrar_ranking", "ancho_tema", "premisa_posicion", "limite_superior",
  "invertir_barras", "otros_al_final", "residuales_gris", "normalizar_etiquetas", "max_palabras", "min_chars", "limites",
  "separar_tras",
]);

const CIFRAS: ReadonlySet<string> = new Set([
  "marcas_eje", "alpha", "mostrar_brecha", "etiqueta_brecha", "decimales_promedio",
  "tipo_rango", "mostrar_valores", "max_series_con_cifras", "valores_decimales", "umbral_rojo_pct", "cortes_chip", "min_n", "cortes",
  "decimales", "mostrar_leyenda", "referencia",
  // U6 (2026-11-05): cómo se dibujan las barras y la mediana.
  "pista_barras", "colorear_por_opcion", "marca_mediana",
  // U10: los casos bajo el porcentaje del histograma.
  "mostrar_frecuencia",
]);

export function grupoDeCampo(arg: string): GrupoTarjeta {
  return ORDEN.has(arg) ? "orden" : CIFRAS.has(arg) ? "cifras" : "datos";
}

/** Rótulo de la sección en el índice de arriba: una palabra, para que el índice quepa en una línea del inspector. */
export const ROTULO_INDICE: Readonly<Record<SeccionTarjeta, string>> = {
  datos: "Datos",
  orden: "Orden",
  cifras: "Cifras",
  diferencias: "Diferencias",
  colores: "Colores",
  word: "Word",
};

/**
 * H4 (checklist de usabilidad, 2026-11-05): a 1024x600 la tarjeta entera abierta eran ocho pantallas. Arranca abierta
 * sólo Datos (la pregunta y lo que divide); las demás muestran su cabecera y se abren con un clic o desde el índice.
 */
export const ABIERTA_POR_DEFECTO: Readonly<Record<SeccionTarjeta, boolean>> = {
  datos: true,
  orden: false,
  cifras: false,
  diferencias: false,
  colores: false,
  word: false,
};

export type SeccionesAbiertas = Partial<Record<SeccionTarjeta, boolean>>;

export function seccionAbierta(abiertas: SeccionesAbiertas, s: SeccionTarjeta): boolean {
  return abiertas[s] ?? ABIERTA_POR_DEFECTO[s];
}

export function conSeccion(abiertas: SeccionesAbiertas, s: SeccionTarjeta, abierta: boolean): SeccionesAbiertas {
  return seccionAbierta(abiertas, s) === abierta ? abiertas : { ...abiertas, [s]: abierta };
}

export function esSeccionTarjeta(v: unknown): v is SeccionTarjeta {
  return typeof v === "string" && (SECCIONES_TARJETA as readonly string[]).includes(v);
}
