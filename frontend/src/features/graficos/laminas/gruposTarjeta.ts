// Secciones de la tarjeta del gráfico (ADR 0135 §8, «inspector uniforme»; maqueta graficos-sintesis «Configuraciones»):
// Datos, Cálculo y Aspecto, las mismas para todos los graficadores. Reemplazan a las seis del rediseño O7b (Datos,
// Categorías y orden, Cifras, Diferencias entre grupos, Colores y En el Word): el orden, las cifras, los colores y el
// Word son Aspecto; las diferencias entre grupos, Cálculo.
//
// Cada campo de la lista blanca (argsDatosGrafico.ts) tiene su sección en `SECCION_DE_CAMPO`, explícita: un campo nuevo
// sin sección hace fallar gruposTarjeta.test.ts. Las tarjetas propias (Brecha, Matriz, Two Box, Colores…) declaran la
// suya donde DatosGrafico las monta. Una sección sin nada para ese tipo de gráfico no se muestra (CSS).

export type SeccionTarjeta = "datos" | "calculo" | "aspecto";

/** Antes eran grupos y secciones aparte; hoy son lo mismo. Se conserva el nombre para quien lo importa. */
export type GrupoTarjeta = SeccionTarjeta;

/** Las secciones de la tarjeta, en el orden en que salen (H4: cada una se pliega y el índice salta a ella). */
export const SECCIONES_TARJETA: readonly SeccionTarjeta[] = ["datos", "calculo", "aspecto"];

export const TITULO_GRUPO: Readonly<Record<SeccionTarjeta, string>> = {
  datos: "Datos",
  calculo: "Cálculo",
  aspecto: "Aspecto",
};

/** Rótulo de la sección en el índice de arriba: una palabra. */
export const ROTULO_INDICE: Readonly<Record<SeccionTarjeta, string>> = TITULO_GRUPO;

/**
 * Qué pregunta, de qué público, dividida por qué y con qué filtro: Datos. Qué se cuenta y cómo (indicador, corte,
 * redondeo, significancia, umbrales que cambian lo que entra en una clase): Cálculo. Cómo se ve (orden, recortes
 * visuales, cifras, leyenda, colores, Word): Aspecto.
 */
export const SECCION_DE_CAMPO: Readonly<Record<string, SeccionTarjeta>> = {
  // Datos
  var: "datos", vars: "datos", regla: "datos", modo: "datos", scope: "datos", ubigeo: "datos", unit: "datos", coverage_mode: "datos",
  area: "datos", juntar: "datos", agrupar_lista: "datos", medida: "datos", unidad: "datos", otra_respuesta: "datos",
  cruces: "datos", cruce: "datos", grupos: "datos", grupo: "datos", excluir_opciones: "datos", excluir_grupos: "datos",
  series: "datos", total_arriba: "datos", segmentos_total: "datos", grafico_sub: "datos", tabla_encabezados: "datos",
  categoria: "datos", universos: "datos", variable: "datos", universo_categorias: "datos", tolerancia_pts: "datos",
  // Cálculo
  corte: "calculo", corte_etiqueta: "calculo", metrica: "calculo", direccion_escala: "calculo", n_negativas: "calculo",
  incluir_neutro: "calculo", referencia: "calculo", decimales_promedio: "calculo", tipo_rango: "calculo", valores_decimales: "calculo",
  decimales: "calculo", min_n: "calculo", cortes: "calculo", cortes_chip: "calculo", sm_omit_na: "calculo",
  // Aspecto
  estilo: "aspecto", base_en: "aspecto", forma: "aspecto", fallback_pocos: "aspecto", eje_pocos: "aspecto",
  eje_pocos_min: "aspecto", eje_pocos_max: "aspecto", tabla: "aspecto", tabla_titulo: "aspecto", eje_min: "aspecto",
  orden_barras: "aspecto", orden: "aspecto", separar_tras: "aspecto", orden_periodos: "aspecto",
  max_categorias: "aspecto", top_k: "aspecto", top_n: "aspecto", agrupar_resto_en_otros: "aspecto", etiqueta_otros: "aspecto",
  mostrar_ceros: "aspecto", mostrar_categorias_en_cero: "aspecto", mostrar_respuestas: "aspecto", filete_temas: "aspecto",
  mostrar_ranking: "aspecto", eje_x: "aspecto", eje_y: "aspecto", linea: "aspecto", linea_x: "aspecto", linea_y: "aspecto",
  destacado: "aspecto", ancho_tema: "aspecto", premisa_posicion: "aspecto", umbral_rojo_pct: "aspecto",
  disposicion: "aspecto", marcas_eje: "aspecto", mostrar_brecha: "aspecto", etiqueta_brecha: "aspecto", leyenda_con_n: "aspecto",
  limite_superior: "aspecto", invertir_barras: "aspecto", otros_al_final: "aspecto", normalizar_etiquetas: "aspecto",
  residuales_gris: "aspecto", max_palabras: "aspecto", min_chars: "aspecto", mostrar_leyenda: "aspecto",
  mostrar_valores: "aspecto", max_series_con_cifras: "aspecto", pista_barras: "aspecto", referencia_barra: "aspecto", colorear_por_opcion: "aspecto",
  marca_mediana: "aspecto", mostrar_frecuencia: "aspecto", titulo_seccion: "aspecto", publico: "aspecto",
  nombre_nivel: "aspecto", lectura: "aspecto", rotulo_total: "aspecto", encuadre: "aspecto", puntos: "aspecto",
  otra_respuesta_rotulo: "aspecto", limites: "aspecto",
};

export function grupoDeCampo(arg: string): SeccionTarjeta {
  return SECCION_DE_CAMPO[arg] ?? "datos";
}

/** Las claves de las seis secciones anteriores (direcciones y estado guardados): a cuál de las tres van. */
const SECCION_ANTERIOR: Readonly<Record<string, SeccionTarjeta>> = {
  orden: "aspecto", cifras: "aspecto", colores: "aspecto", word: "aspecto", diferencias: "calculo",
};

/** La sección de una clave nueva o anterior; `null` si no es de la tarjeta. */
export function seccionDeClave(v: unknown): SeccionTarjeta | null {
  if (esSeccionTarjeta(v)) return v;
  return typeof v === "string" ? SECCION_ANTERIOR[v] ?? null : null;
}

/**
 * H4 (checklist de usabilidad, 2026-11-05): a 1024x600 la tarjeta entera abierta eran ocho pantallas. Arranca abierta
 * sólo Datos (la pregunta y lo que divide); las demás muestran su cabecera y se abren con un clic o desde el índice.
 */
export const ABIERTA_POR_DEFECTO: Readonly<Record<SeccionTarjeta, boolean>> = {
  datos: true,
  calculo: false,
  aspecto: false,
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
