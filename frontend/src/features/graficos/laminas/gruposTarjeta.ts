// Grupos de la tarjeta del gráfico (O7b del rediseño, 2026-10-15; aprobado por Gonzalo): Datos, Categorías y orden,
// Cifras, Colores y En el Word. Cada campo de la lista blanca cae en uno; lo no listado es Datos. Un grupo sin nada para
// ese tipo de gráfico no se muestra (CSS), así cada tipo enseña su propio juego de ajustes.

export type GrupoTarjeta = "datos" | "orden" | "cifras";

export const TITULO_GRUPO: Readonly<Record<GrupoTarjeta | "colores" | "word", string>> = {
  datos: "Datos",
  orden: "Categorías y orden",
  cifras: "Cifras",
  colores: "Colores",
  word: "En el Word",
};

const ORDEN: ReadonlySet<string> = new Set([
  "orden_barras", "orden", "orden_periodos", "max_categorias", "top_k", "top_n", "agrupar_resto_en_otros", "etiqueta_otros",
  "mostrar_ceros", "mostrar_categorias_en_cero", "mostrar_respuestas", "filete_temas", "mostrar_ranking", "ancho_tema", "limite_superior",
  "invertir_barras", "otros_al_final", "residuales_gris", "normalizar_etiquetas", "max_palabras", "min_chars", "limites",
]);

const CIFRAS: ReadonlySet<string> = new Set([
  "marcas_eje", "mostrar_significancia", "significancia_alpha", "alpha", "mostrar_brecha", "etiqueta_brecha", "decimales_promedio",
  "tipo_rango", "mostrar_valores", "max_series_con_cifras", "valores_decimales", "umbral_rojo_pct", "cortes_chip", "min_n", "cortes",
  "decimales", "mostrar_leyenda",
]);

export function grupoDeCampo(arg: string): GrupoTarjeta {
  return ORDEN.has(arg) ? "orden" : CIFRAS.has(arg) ? "cifras" : "datos";
}
