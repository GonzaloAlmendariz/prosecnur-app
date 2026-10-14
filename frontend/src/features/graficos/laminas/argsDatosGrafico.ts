// Qué datos de un gráfico se editan en la tarjeta del inspector (F6.1, parte 2; dirección F6 §4.1 y §7).
//
// Lista BLANCA contra la Parte B del inventario: sólo argumentos que la salida nativa lee (qué pregunta, cómo se
// divide, qué entra y en qué orden, significancia). Todo lo de estilo ggplot queda fuera aunque el registro lo
// declare. Cada entrada trae un rótulo corto y, si hace falta, una ayuda de una línea; el texto largo del registro no
// se muestra (va en el título del «?»).
//
// C40 (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md): cada arg asignado se verificó contra su `tipo_input`,
// `choices` y `default` en api/R/graficos_metadata.R y contra los formals de su constructor del plan — un arg que no es
// formal se cae en `.clean_rebuild_args` (router_graficos.R) y un control suyo prometería algo que la lámina no dibuja
// (C5). Las guardas van como ayuda visible junto al control; lo retirado no sale y su valor guardado no se toca.

import type { ArgMetadata } from "../../../api/graficos";
import { argAplica } from "../argDependencias";

export type ControlDato = "variable" | "variable_opcional" | "variables" | "interruptor" | "numero" | "opciones" | "texto" | "codigos" | "nombres_base";

type Valores = Readonly<Record<string, unknown>>;

type Entrada = {
  rotulo: string;
  ayuda?: string;
  /** Texto del campo vacío (códigos y textos). */
  placeholder?: string;
  control?: ControlDato;
  /** Sólo con este arg encendido; si no está guardado manda su `default` del registro. Sin ese arg en el registro, nunca. */
  siActivo?: string;
  /** Su `depende` tiene que cumplirse con un valor ya elegido: con el modo sin elegir no se muestra (lo multibase). */
  estricto?: boolean;
  /** Sólo en estos graficadores: el mismo nombre significa otra cosa (o no tiene efecto nativo) en los demás. */
  soloEn?: readonly string[];
  /** Nunca en estos graficadores: ahí el arg se elige dentro de otro control. */
  excepto?: readonly string[];
  /** Condición extra sobre los valores actuales (p. ej. cuántas mediciones tiene la serie). */
  cuando?: (valores: Valores) => boolean;
  /** Guarda propia de un graficador: reemplaza `siActivo` y `cuando` ahí (el mismo arg se activa con otro control). */
  porGraficador?: Readonly<Record<string, Pick<Entrada, "siActivo" | "cuando" | "defecto">>>;
  /**
   * Lo que el motor dibuja sin valor guardado cuando el registro no declara `default` (el formal del constructor). El
   * campo lleva el arg con este `default`: el interruptor y el placeholder dicen lo mismo que la lámina.
   */
  defecto?: unknown;
  /**
   * Opciones del registro que la tarjeta ya no ofrece (6a), con el aviso que acompaña a un valor guardado con ellas: ese
   * valor se conserva y se muestra como la opción actual, pero no se puede volver a elegir.
   */
  opcionesRetiradas?: Readonly<Record<string, string>>;
};

// Guardas C40 (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md): el texto que la tarjeta muestra junto al control.
export const AYUDA_CEROS = "Las respuestas especiales 90–99 sin casos nunca se muestran.";
export const AYUDA_EJE_MIN =
  "0 = automático. Un piso alto acerca las diferencias; si deja fuera un dato, el eje baja solo y la lámina lo avisa.";
export const AYUDA_BRECHA = "El primer grupo menos el segundo, restando las cifras ya rotuladas.";
export const AYUDA_MIN_N = "Con menos casos válidos el distrito va como «Sin encuestas» y la lámina lo avisa.";
export const AYUDA_CORTES = "Porcentajes entre 0 y 100, separados por comas. Vacío: 55, 65 y 75.";
export const AYUDA_LIMITE_SUPERIOR = "Vacío: sin tope. Lo que lo supera va en la última barra, rotulada con «+» (p. ej. «60+»).";
export const AYUDA_TIPO_RANGO = "La leyenda de la lámina dice qué abarca la barra.";
// 6a (Gonzalo, 2026-10-11): «custom» depende de `probs_rango`, que no tiene control en la tarjeta.
export const AVISO_RANGO_CUSTOM = "Personalizado: se dibuja con los percentiles guardados.";
export const AYUDA_CORTE_SCORE = "Obligatorio en «Dispersión»: separa los puntajes altos de los bajos.";
export const AYUDA_CORTES_CHIP = "Dos valores que separan rojo, ámbar y verde. Vacío: 60 y 80.";

/**
 * 5a (Gonzalo, 2026-10-11; docs/qa/estudio-paletas-por-lista-f6-2026-10-11.md): los graficadores cuya lámina NO es
 * nativa —salida «ruta_anterior» o «marco» en `.GRAFICOS_SALIDA_EDITOR` (api/R/graficos_metadata.R), es decir
 * `salida_nativa = FALSE`— conservan sus controles mientras no tengan versión nativa: en ellos el dibujo ggplot SÍ es la
 * salida, así que lo RETIRADO («sin efecto en la lámina nativa») no se les oculta. Lista explícita porque el payload del
 * registro que llega al front no trae `salida`; argsDatosGrafico.c40.test.ts la contrasta con el registro R y con el
 * catálogo generado (api/inst/catalogos/graficos_tipos.json). Cuando uno gane versión nativa, sale de aquí.
 */
export const GRAFICADORES_NO_NATIVOS: ReadonlySet<string> = new Set([
  // p_puntos_comparativos salió el 2026-10-13 (G11): ya sale como el ranking con puntos. p_dim_radar también: con tres
  // ejes o más ya salía nativo y el registro decía lo contrario (test-dim-radar-nativo.R).
  // p_nube_palabras también (G11): sale con el ranking nativo de la lámina 101; y p_tabla, como la tabla del diseño.
  "p_dim_foda",
]);
const TABLA = ["p_tabla"];
const FODA = ["p_dim_foda"];

/**
 * Públicos distintos de una lámina por temas (`{ tema: [base$var, …] }`): no el máximo por tema. En la lámina 10 de Arte
 * cada tema tiene dos, pero entre todos son tres, como dice la base.
 */
export function publicosDistintos(varsPorTema: Readonly<Record<string, unknown>>): number {
  const base = (r: unknown) => (typeof r === "string" && r.includes("$") ? r.slice(0, r.indexOf("$")) : String(r));
  return new Set(Object.values(varsPorTema).flatMap((v) => (Array.isArray(v) ? v : [])).map(base)).size;
}

/** ¿La multiapilada compara públicos? Algún tema (o tema de un bloque) con preguntas de dos bases o más. */
export function comparaPublicos(valores: Valores): boolean {
  const base = (r: unknown) => (typeof r === "string" && r.includes("$") ? r.slice(0, r.indexOf("$")) : null);
  const temas = (vars: unknown): unknown[][] =>
    vars && typeof vars === "object" && !Array.isArray(vars) ? Object.values(vars as Record<string, unknown>).map((v) => (Array.isArray(v) ? v : [])) : [];
  const conVarias = (vars: unknown) => temas(vars).some((refs) => new Set(refs.map(base).filter(Boolean)).size >= 2);
  if (conVarias(valores.vars)) return true;
  const bloques = Array.isArray(valores.bloques) ? (valores.bloques as Record<string, unknown>[]) : [];
  return bloques.some((b) => conVarias(b?.vars));
}

/** Mediciones (periodos) de una serie temporal: `orden_periodos` si se declaró; si no, las fuentes del primer tema. */
export function medicionesDeSerie(valores: Valores): number {
  const orden = valores.orden_periodos;
  if (Array.isArray(orden) && orden.length) return new Set(orden.map(String)).size;
  const vars = valores.vars;
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return 0;
  const primero = Object.values(vars as Record<string, unknown>)[0];
  const refs = Array.isArray(primero) ? primero : typeof primero === "string" ? [primero] : [];
  const fuentes = refs.map((r) => String(r).split("$")[0].trim()).filter(Boolean);
  return new Set(fuentes).size;
}

/** Con dos mediciones la serie sale nativa y no lee sus cifras; con tres o más va en el marco del recetario, que sí. */
const serieEnMarco = (v: Valores) => medicionesDeSerie(v) >= 3;
const MEDIA_RANGO = ["p_media_rango"];
/** En torta y dona «Otros» aparece con `top_k`: no tienen `agrupar_resto_en_otros`. */
const conTopK = (v: Valores) => typeof v.top_k === "number" && Number.isFinite(v.top_k) && v.top_k >= 1;
const OTROS_POR_TOP_K = { siActivo: undefined, cuando: conTopK };

/** Orden de aparición = orden de las claves. */
/** ¿El gráfico ya trae su lista de preguntas (`vars`)? Entonces la «Pregunta» suelta no aplica (catálogo, I1). */
export const tieneVars = (v: Valores) =>
  (Array.isArray(v.vars) && v.vars.length > 0) || (!!v.vars && typeof v.vars === "object" && Object.keys(v.vars as object).length > 0);

const LISTA_BLANCA: Record<string, Entrada> = {
  // La pregunta filtro de «Filtro y subpregunta» se elige en su tarjeta, junto con lo que habilita.
  var: { rotulo: "Pregunta", cuando: (v) => !tieneVars(v), excepto: ["p_filtro_subpregunta"] },
  // I1 (catálogo del recetario, 2026-10-14): la lista de preguntas no tenía control y el inspector decía «Elige una
  // pregunta…» con seis preguntas en la lámina. Las multiapiladas, la brecha y la matriz la editan en su propia tarjeta.
  vars: { rotulo: "Preguntas", excepto: ["p_barras_multiapiladas", "p_dumbbell", "p_matriz_cuadrantes", "p_significancia_publicos"] },
  // En multiapiladas el modo se elige en «Bloques» (G12/U2, 2026-10-13): una fila «Modo» aparte era un segundo camino.
  modo: { rotulo: "Modo", excepto: ["p_barras_multiapiladas"] },
  // Mapa de cobertura territorial: la lámina nativa lee los cuatro (p_mapa_cobertura_territorial, graficador_mapa_cobertura.R).
  scope: { rotulo: "Alcance", soloEn: ["p_mapa_cobertura_territorial"] },
  ubigeo: {
    rotulo: "UBIGEO del distrito",
    soloEn: ["p_mapa_cobertura_territorial"],
    cuando: (v) => (v.scope ?? "district") === "district",
  },
  unit: { rotulo: "Unidad", soloEn: ["p_mapa_cobertura_territorial"] },
  coverage_mode: { rotulo: "Cobertura", soloEn: ["p_mapa_cobertura_territorial"] },
  // G12 (2026-10-13): en multiapiladas el grupo se elige dentro de su modo («Una pregunta por grupos»…); un «Dividir por»
  // suelto en la tarjeta era un segundo camino a lo mismo.
  cruces: { rotulo: "Dividir por", ayuda: "Vacío: una sola serie.", excepto: ["p_barras_multiapiladas"] },
  // G17: en la brecha el cruce, los grupos y el corte se eligen en su propia tarjeta (BrechaEntreGrupos).
  cruce: { rotulo: "Dividir por", ayuda: "Vacío: una sola serie.", excepto: ["p_barras_multiapiladas", "p_dumbbell"] },
  corte: { rotulo: "Corte", excepto: ["p_dumbbell", "p_significancia_publicos"] },
  corte_etiqueta: { rotulo: "Rótulo del corte" },
  // C44: el radar «entre públicos» rotula cada columna de su tabla con el nombre técnico de la base.
  tabla_encabezados: { rotulo: "Nombre de cada público", ayuda: "Vacío conserva el nombre de la base.", estricto: true },
  mostrar_tabla: { rotulo: "Tabla al costado", estricto: true, soloEn: ["p_radar"] },
  tabla_titulo: { rotulo: "Encabezado de la primera columna", ayuda: "Vacío: «Tema».", estricto: true, soloEn: ["p_radar"] },
  eje_min: { rotulo: "El eje arranca en (%)", ayuda: AYUDA_EJE_MIN, estricto: true, soloEn: ["p_radar"] },
  objetivo: { rotulo: "Objetivo" },
  metrica: { rotulo: "Métrica" },
  categoria: { rotulo: "Categoría" },
  direccion_escala: { rotulo: "Dirección de la escala" },
  n_negativas: { rotulo: "Categorías negativas" },
  incluir_neutro: { rotulo: "Incluir el punto medio" },
  // FODA (5a): formal `incluir_total = TRUE` de p_dim_foda (reporte_plan_slides.R); el registro no declara default.
  incluir_total: { rotulo: "Columna Total", soloEn: ["p_dim_heatmap", ...FODA], porGraficador: { p_dim_foda: { defecto: true } } },
  // Matriz FODA (5a, ruta anterior): formales de p_dim_foda; sin valor manda el primero de su `match.arg`.
  nivel: { rotulo: "Nivel de análisis", soloEn: FODA, defecto: "subindices" },
  modo_foda: { rotulo: "Disposición", soloEn: FODA, defecto: "matriz" },
  corte_score: { rotulo: "Corte de puntaje", ayuda: AYUDA_CORTE_SCORE, soloEn: FODA, cuando: (v) => v.modo_foda === "dispersion" },
  usar_pesos: { rotulo: "Aplicar pesos", soloEn: FODA, defecto: true },
  cortes_chip: { rotulo: "Cortes del semáforo", ayuda: AYUDA_CORTES_CHIP, placeholder: "60, 80", soloEn: FODA },
  orden_barras: { rotulo: "Orden" },
  orden: { rotulo: "Orden", soloEn: ["p_dumbbell", "p_lollipop"] },
  orden_periodos: {
    rotulo: "Orden de los periodos",
    ayuda: "Nombres de las fuentes, todas y sin repetir. Vacío: el orden declarado.",
    placeholder: "Orden declarado",
    soloEn: ["p_serie_temporal"],
  },
  max_categorias: { rotulo: "Máximo de categorías" },
  top_k: { rotulo: "Máximo de categorías" },
  // Sólo el del ranking: en radar y tabla `top_n` espera la nota «Se muestran X de Y» del motor (C40, D1).
  top_n: {
    rotulo: "Máximo de categorías",
    ayuda: "Recorte sólo visual: no cambia el denominador.",
    placeholder: "Todas",
    soloEn: ["p_lollipop"],
  },
  agrupar_resto_en_otros: { rotulo: "Agrupar el resto en «Otros»", siActivo: undefined },
  // Formal de p_barras_agrupadas (e93c51d), p_pie y p_donut (reporte_plan_slides.R). En agrupadas sale con la agrupación
  // encendida (default TRUE del registro); en torta y dona, con `top_k`. Sin ninguna de las dos guardas, nunca.
  etiqueta_otros: {
    rotulo: "Nombre de «Otros»",
    placeholder: "Otros",
    siActivo: "agrupar_resto_en_otros",
    porGraficador: { p_pie: OTROS_POR_TOP_K, p_donut: OTROS_POR_TOP_K },
  },
  mostrar_ceros: { rotulo: "Mostrar opciones sin casos", ayuda: AYUDA_CEROS },
  // Formal de p_barras_apiladas y p_barras_multiapiladas (e93c51d); la misma guarda de 90–99 que `mostrar_ceros`.
  mostrar_categorias_en_cero: {
    rotulo: "Mostrar categorías en 0 %",
    ayuda: AYUDA_CEROS,
    soloEn: ["p_barras_apiladas", "p_barras_multiapiladas"],
  },
  // M10 de la maqueta (Gonzalo, 2026-10-13): «poder mostrar o quitar el número de respuestas por actor».
  mostrar_respuestas: {
    rotulo: "Respuestas por público",
    ayuda: "«116 respuestas» bajo el nombre de cada público.",
    soloEn: ["p_barras_apiladas", "p_barras_multiapiladas"],
  },
  // G11 (2026-10-13): la nube con su ranking de las diez palabras más dichas (lámina 101 del diseño), o sola.
  mostrar_ranking: { rotulo: "Ranking de palabras", soloEn: ["p_nube_palabras"] },
  // G16: la matriz de cuadrantes; los temas, sus respuestas y los nombres de los cuadrantes van en su tarjeta (MatrizCuadrantes).
  eje_x: { rotulo: "Nombre del eje horizontal", placeholder: "Satisfacción", soloEn: ["p_matriz_cuadrantes"] },
  eje_y: { rotulo: "Nombre del eje vertical", placeholder: "Importancia", soloEn: ["p_matriz_cuadrantes"] },
  linea: { rotulo: "Dónde cortan las líneas", soloEn: ["p_matriz_cuadrantes"] },
  linea_x: { rotulo: "Línea del eje horizontal (%)", soloEn: ["p_matriz_cuadrantes"], cuando: (v) => v.linea === "valor" },
  linea_y: { rotulo: "Línea del eje vertical (%)", soloEn: ["p_matriz_cuadrantes"], cuando: (v) => v.linea === "valor" },
  destacado: { rotulo: "Cuadrante destacado", ayuda: "Lleva fondo y, a la derecha, la lista de lo que cae en él.", soloEn: ["p_matriz_cuadrantes"] },
  // G15 (Gonzalo, 2026-10-13): el reparto de ancho por lámina, en tres pasos. Lo dibuja la lámina que compara públicos.
  // Sólo donde hace algo: la lámina que compara públicos (Gonzalo, 2026-10-13: «que sus opciones tengan sentido»).
  ancho_tema: { rotulo: "Ancho de los temas", soloEn: ["p_barras_multiapiladas"], cuando: comparaPublicos },
  excluir_opciones: { rotulo: "Excluir respuestas", ayuda: "Códigos separados por comas (p. ej. 88, 99)." },
  excluir_grupos: { rotulo: "Excluir grupos", ayuda: "Códigos separados por comas." },
  // Tabla (5a, ruta anterior): formales de p_tabla (p_radar_split.R); `sm_omit_na = TRUE` sin default en el registro.
  // `top_n` y `sm_omit_codes` siguen sin control: recortan antes del denominador (C40, D1).
  sm_omit_na: { rotulo: "Omitir sin respuesta", soloEn: TABLA, defecto: true },
  umbral_rojo_pct: { rotulo: "Resaltar en rojo bajo (%)", ayuda: "0 desactiva el resaltado.", soloEn: TABLA },
  mostrar_significancia: { rotulo: "Marcar diferencias significativas" },
  // Pregunta filtro y subpregunta (recetario p192–p194): las preguntas y lo que habilita van en su tarjeta.
  grafico_sub: { rotulo: "Gráfico de la subpregunta", soloEn: ["p_filtro_subpregunta"] },
  disposicion: { rotulo: "Disposición", soloEn: ["p_filtro_subpregunta"], cuando: (v) => v.grafico_filtro !== "torta" && v.grafico_filtro !== "dona" },
  // Diferencias significativas entre públicos (recetario p111–p112): los temas y lo que suma van en su tarjeta.
  alpha: { rotulo: "Nivel de significancia", soloEn: ["p_significancia_publicos"] },
  // Inventario de configuraciones, ítem 3 (recetario p74–p75): formal de p_barras_agrupadas() → overrides.
  marcas_eje: { rotulo: "Marcas del eje", ayuda: "0, 25, 50, 75 y 100 % bajo las barras.", soloEn: ["p_barras_agrupadas"] },
  significancia_alpha: { rotulo: "Nivel de significancia", siActivo: "mostrar_significancia" },
  mostrar_brecha: { rotulo: "Mostrar la brecha", ayuda: AYUDA_BRECHA, soloEn: ["p_dumbbell"] },
  // Formal de p_dumbbell (e93c51d): sólo se escribe junto a la brecha, así que sin brecha no hay qué rotular.
  etiqueta_brecha: { rotulo: "Unidad de la brecha", placeholder: "pts", siActivo: "mostrar_brecha", soloEn: ["p_dumbbell"] },
  // Formales de p_media_rango (e93c51d): `decimales_promedio` es el que llega (el constructor lo pasa a `chip_decimales`).
  decimales_promedio: { rotulo: "Decimales de la media", soloEn: MEDIA_RANGO },
  tipo_rango: {
    rotulo: "Qué abarca la barra", ayuda: AYUDA_TIPO_RANGO, soloEn: MEDIA_RANGO, opcionesRetiradas: { custom: AVISO_RANGO_CUSTOM },
  },
  // Formal de p_histograma (e93c51d); sin default en el registro: vacío = sin tope.
  limite_superior: { rotulo: "Límite superior", ayuda: AYUDA_LIMITE_SUPERIOR, placeholder: "Sin tope", soloEn: ["p_histograma"] },
  mostrar_valores: { rotulo: "Mostrar cifras", soloEn: ["p_serie_temporal"], cuando: serieEnMarco },
  max_series_con_cifras: {
    rotulo: "Máximo de series con cifras",
    ayuda: "Con más series las cifras se apagan solas para no pisarse.",
    siActivo: "mostrar_valores",
    soloEn: ["p_serie_temporal"],
    cuando: serieEnMarco,
  },
  min_n: { rotulo: "Casos mínimos por distrito", ayuda: AYUDA_MIN_N, soloEn: ["p_mapa_resultado_distrital"] },
  cortes: { rotulo: "Cortes de las clases (%)", ayuda: AYUDA_CORTES, placeholder: "55, 65, 75", soloEn: ["p_mapa_resultado_distrital"] },
  // I-c: en la serie temporal los decimales son decisión del informe (Estilo del informe › Cálculos); sólo el radar.
  valores_decimales: { rotulo: "Decimales", soloEn: ["p_radar"] },
};

/**
 * RETIRADOS (C40, I-e): sin efecto en la lámina nativa, no salen en la tarjeta aunque el registro los declare. El valor
 * guardado NO se toca: la tarjeta sólo escribe la clave del campo que se edita (`mergeSlotArgsPatch` conserva el resto).
 */
export const RETIRADOS: ReadonlySet<string> = new Set([
  "invertir_leyenda", "tipo_pie", "umbral_brecha_pct", "tabla_ancho_tema", "tabla_proporcion", "sm_omit_na",
  "umbral_rojo_pct", "mostrar_tabla_derecha", "modo_semaforo", "mostrar_ref_label", "mostrar_n_cruce_x", "radar_min_ejes",
  "bins", "ancho_bin", "grupo", "mostrar_bins_vacios", "otros_al_final", "mostrar_saldo", "umbral_etiqueta_pct",
  "mostrar_promedio", "formato_valor", "cortes_chip",
]);
/** Familias retiradas enteras: las brechas declaradas (`brecha_*`) y los args propios de la matriz FODA. */
const RETIRADO_PREFIJO = ["brecha_"];
const RETIRADO_EN: Readonly<Record<string, ReadonlySet<string>>> = {
  p_dim_foda: new Set(["nivel", "modo_foda", "usar_pesos", "corte_score", "titulos_areas_foda", "incluir_total", "iter_var", "iter_level"]),
  p_dim_comparativo_radarbar: new Set(["incluir_total"]),
};

/** Args retirados en general que en un graficador nativo siguen teniendo efecto: cambian los datos, no el dibujo. */
const VIGENTE_EN: Readonly<Record<string, ReadonlySet<string>>> = {
  // G11: «Omitir sin respuesta» cambia las filas de la tabla, que ahora sale nativa.
  p_tabla: new Set(["sm_omit_na"]),
};

export function esRetirado(name: string, graficador?: string): boolean {
  // 5a: en un graficador no nativo lo retirado sigue teniendo efecto (lo dibuja ggplot).
  if (graficador && GRAFICADORES_NO_NATIVOS.has(graficador)) return false;
  if (graficador && VIGENTE_EN[graficador]?.has(name)) return false;
  if (RETIRADOS.has(name) || RETIRADO_PREFIJO.some((p) => name.startsWith(p))) return true;
  return !!graficador && !!RETIRADO_EN[graficador]?.has(name);
}

/** Tipos de control que la tarjeta sabe dibujar en una línea. */
const CONTROL_POR_TIPO: Partial<Record<ArgMetadata["tipo_input"], ControlDato>> = {
  variable: "variable",
  variable_opt: "variable_opcional",
  variables_list: "variables",
  bool: "interruptor",
  number: "numero",
  choice: "opciones",
  string: "texto",
  codigos_list: "codigos",
  base_labels: "nombres_base",
};

export type CampoDato = {
  arg: ArgMetadata;
  rotulo: string;
  ayuda: string | null;
  /** Descripción larga del registro, para el título del «?». */
  detalle: string;
  control: ControlDato;
  placeholder: string | null;
  /** Opciones que la tarjeta ofrece (control «opciones»): las del registro menos las retiradas, salvo la guardada. */
  opciones: NonNullable<ArgMetadata["choices"]>;
  /** Aviso de un valor guardado que ya no se ofrece (6a). */
  aviso: string | null;
};

/** Valor efectivo de un interruptor: el guardado o, sin guardar, el `default` del registro (lo que el motor dibuja). */
export function interruptorEncendido(arg: Pick<ArgMetadata, "default">, valor: unknown): boolean {
  return (valor ?? arg.default) === true;
}

/**
 * Los campos de datos de un graficador, en el orden de la lista blanca; respeta `siActivo` y el `depende` del registro
 * con los valores actuales (los campos de otro modo se esconden, como en el Editor anterior). `base_config` («Base del
 * gráfico») no está en la lista: el catálogo no la sirve a la UI (`.normalize_args_for_ui`) y el pie de base sale del
 * cálculo automático de la lámina.
 */
export function camposDeDatos(args: readonly ArgMetadata[], valores: Valores, graficador?: string): CampoDato[] {
  const porNombre = new Map(args.map((a) => [a.name, a]));
  const salida: CampoDato[] = [];
  for (const [name, e] of Object.entries(LISTA_BLANCA)) {
    const arg = porNombre.get(name);
    if (!arg || esRetirado(name, graficador)) continue;
    if (e.soloEn && !(graficador && e.soloEn.includes(graficador))) continue;
    if (e.excepto && graficador && e.excepto.includes(graficador)) continue;
    const control = e.control ?? CONTROL_POR_TIPO[arg.tipo_input];
    if (!control) continue;
    const guarda = (graficador && e.porGraficador?.[graficador]) || e;
    if (guarda.siActivo) {
      const ref = porNombre.get(guarda.siActivo);
      if (!ref || !interruptorEncendido(ref, valores[guarda.siActivo])) continue;
    }
    if (guarda.cuando && !guarda.cuando(valores)) continue;
    if (!argAplica(arg, valores)) continue;
    if (e.estricto && !dependenciaElegida(arg, valores)) continue;
    const defecto = "defecto" in guarda ? guarda.defecto : e.defecto;
    const conDefecto = defecto !== undefined && (arg.default === undefined || arg.default === null) ? { ...arg, default: defecto } : arg;
    const guardado = valores[name];
    const retiradas = e.opcionesRetiradas ?? {};
    const opciones = (arg.choices ?? []).filter((o) => !Object.hasOwn(retiradas, o.value) || o.value === guardado);
    const aviso = typeof guardado === "string" && Object.hasOwn(retiradas, guardado) ? retiradas[guardado] : null;
    salida.push({
      arg: conDefecto, rotulo: e.rotulo, ayuda: e.ayuda ?? null, detalle: arg.descripcion ?? "", control,
      placeholder: e.placeholder ?? null, opciones, aviso,
    });
  }
  return salida;
}

/** El `depende` del arg se cumple con un valor ya elegido (sin `depende`, siempre). */
function dependenciaElegida(arg: ArgMetadata, valores: Valores): boolean {
  const dep = arg.depende;
  if (!dep) return true;
  const actual = valores[dep.arg];
  const texto = Array.isArray(actual) ? actual[0] : actual;
  return typeof texto === "string" && dep.valores.includes(texto);
}

/** «88, 99» ⇄ ["88","99"]. */
export function codigosATexto(v: unknown): string {
  return Array.isArray(v) ? v.map(String).join(", ") : typeof v === "string" ? v : "";
}
export function textoACodigos(t: string): string[] {
  return t.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
}

/** La etiqueta corta de una variable vive en `overrides.etiquetas_vars[variable]` (K12a, 07d43c5f7). */
export function leerEtiquetaCorta(args: Readonly<Record<string, unknown>>, variable: string): string {
  const o = args.overrides;
  const m = o && typeof o === "object" ? (o as Record<string, unknown>).etiquetas_vars : null;
  const v = m && typeof m === "object" ? (m as Record<string, unknown>)[variable] : null;
  return typeof v === "string" ? v : "";
}

export function conEtiquetaCorta(args: Readonly<Record<string, unknown>>, variable: string, etiqueta: string): Record<string, unknown> {
  const overrides = { ...((args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>) };
  const mapa = { ...((overrides.etiquetas_vars && typeof overrides.etiquetas_vars === "object" ? overrides.etiquetas_vars : {}) as Record<string, unknown>) };
  if (etiqueta.trim()) mapa[variable] = etiqueta.trim();
  else delete mapa[variable];
  if (Object.keys(mapa).length) overrides.etiquetas_vars = mapa;
  else delete overrides.etiquetas_vars;
  return overrides;
}
