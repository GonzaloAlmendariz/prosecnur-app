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
// (C5). Las guardas van en el «?» del control junto con la descripción del registro (ADR 0135 §8: sin párrafos de ayuda
// bajo los controles); lo retirado no sale y su valor guardado no se toca.

import type { ArgMetadata } from "../../../api/graficos";
import { argAplica } from "../argDependencias";
import { argDeLaVersion } from "./coberturaCategorias/modeloUniversoCategorias";
import { filasEnLaTarjeta, separadoresDe } from "./brecha/separadoresFilas";
import { preguntasDelMapa } from "./modeloAgruparLista";
import { leerOrden, ordenAGuardar } from "./ordenCategorias";
import { GRAFICOS_CON_RESALTE, mayorActiva } from "./realce";
import { GRAFICADORES_LETRA_Y_EJE, leerLetraYEje } from "./tarjetaGrafico/letraYEje";

export type ControlDato =
  | "variable" | "variable_opcional" | "variables" | "interruptor" | "numero" | "opciones" | "texto" | "codigos" | "nombres_base"
  | "partes" | "grupos_lista" | "regla_preguntas" | "universo_categorias" | "triestado";

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
  /** Rótulo, ayuda y texto vacío propios de un graficador: el mismo arg se lee distinto ahí (con los valores actuales). */
  textosEn?: Readonly<Record<string, (valores: Valores) => Pick<Entrada, "rotulo" | "ayuda" | "placeholder">>>;
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

// Guardas C40 (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md): el texto que abre el «?» del control.
export const AYUDA_CEROS = "Las respuestas especiales 90–99 sin casos nunca se muestran.";
export const AYUDA_EJE_MIN =
  "0 = automático. Un piso alto acerca las diferencias; si deja fuera un dato, el eje baja solo y la lámina lo avisa.";
export const AYUDA_TABLA =
  "Automática la pone junto al radar y a las líneas y puntos; con Barras comparativas, elige “Sí”. Si no cabe al costado va debajo y, si tampoco, se omite con aviso.";
// Sin encabezado de fábrica (motor, graficos_radar_tabla.R): vacío queda vacío y el informe avisa.
export const AYUDA_TABLA_TITULO = "Lo escribe el analista. Vacío, la celda queda vacía y el informe avisa.";
export const AYUDA_BRECHA = "El primer grupo menos el segundo, restando las cifras ya rotuladas.";
export const AYUDA_MIN_N = "Con menos casos válidos el distrito va como Sin encuestas y la lámina lo avisa.";
export const AYUDA_CORTES = "Tres cortes dan cuatro clases. Vacío: 55, 65 y 75.";
export const AYUDA_LIMITE_SUPERIOR = "Vacío: sin tope. Lo que lo supera va en la última barra, rotulada con + (p. ej. 60+).";
export const AYUDA_TIPO_RANGO = "La leyenda de la lámina dice qué abarca la barra.";
// 6a (Gonzalo, 2026-10-11): «custom» depende de `probs_rango`, que no tiene control en la tarjeta.
export const AVISO_RANGO_CUSTOM = "Personalizado: se dibuja con los percentiles guardados.";
// ADR 0134: los gráficos del resumen ejecutivo (Arte y Diseño FG 2026).
export const AYUDA_ESTILO = "Cómo se compone la lámina; el cálculo es el mismo.";
export const AYUDA_UNIVERSOS = "Para escribir la base como n (cobertura %). Un grupo sin padrón va sólo con n.";
export const AYUDA_SEPARAR_TRAS = "Línea punteada entre dos grupos de preguntas. 0: sin separador.";
export const AYUDA_BASE_EN = "Por defecto, en la nota de la base (abajo a la izquierda); la tabla lleva sólo la diferencia.";
export const AYUDA_REFERENCIA = 'La línea punteada y la columna "Bajo" de la tabla.';

/**
 * 5a (Gonzalo, 2026-10-11; docs/qa/estudio-paletas-por-lista-f6-2026-10-11.md): los graficadores cuya lámina NO es
 * nativa —salida «ruta_anterior» o «marco» en `.GRAFICOS_SALIDA_EDITOR` (api/R/graficos_metadata.R), es decir
 * `salida_nativa = FALSE`— conservan sus controles mientras no tengan versión nativa: en ellos el dibujo ggplot SÍ es la
 * salida, así que lo RETIRADO («sin efecto en la lámina nativa») no se les oculta. Lista explícita porque el payload del
 * registro que llega al front no trae `salida`; argsDatosGrafico.c40.test.ts la contrasta con el registro R y con el
 * catálogo generado (api/inst/catalogos/graficos_tipos.json). Cuando uno gane versión nativa, sale de aquí.
 */
export const GRAFICADORES_NO_NATIVOS: ReadonlySet<string> = new Set<string>([
  // p_puntos_comparativos salió el 2026-10-13 (G11): ya sale como el ranking con puntos; p_nube_palabras también
  // (G11): sale con el ranking nativo de la lámina 101; y p_tabla, como la tabla del diseño. p_dim_foda, el último,
  // se borró con el ADR 0137 fase 2: hoy los 31 graficadores salen nativos y la lista queda vacía.
]);
const TABLA = ["p_tabla"];

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

/** Brecha y divergentes con el estilo del resumen ejecutivo (ADR 0134): los ajustes que sólo ese estilo dibuja. */
export const esEstiloResumen = (v: Valores) => v.estilo === "resumen";
const ESTILO_RESUMEN = ["p_dumbbell", "p_barras_divergentes"];
/** Los graficadores de resumen que eligen sus preguntas con `regla` (ADR 0135 §2). */
const GRAFICADORES_REGLA = ["p_panorama", "p_dumbbell", "p_barras_divergentes", "p_fortalezas"];
const resumenOConRegla = (v: Valores) => esEstiloResumen(v) || (!!v.regla && typeof v.regla === "object");

/** Orden de aparición = orden de las claves. */
/** ¿El gráfico ya trae su lista de preguntas (`vars`)? Entonces la «Pregunta» suelta no aplica (catálogo, I1). */
export const tieneVars = (v: Valores) =>
  (Array.isArray(v.vars) && v.vars.length > 0) || (!!v.vars && typeof v.vars === "object" && Object.keys(v.vars as object).length > 0);

/**
 * Los cortes del mapa de distribución con la escala que el motor usa si quedan vacíos (graficos_mapa_distribucion_plan.R,
 * `.MAPA_DIST$cortes_conteo`; personas: contrato del 2026-11-03).
 */
export function cortesDistribucion(v: Valores): Pick<Entrada, "rotulo" | "ayuda" | "placeholder"> {
  if (v.medida === "tasa") return { rotulo: "Dónde empieza cada clase (por 10 000)", ayuda: "Desde la segunda clase.", placeholder: "0.5, 1, 2, 3" };
  const personas = v.unidad === "personas";
  const placeholder = personas ? "6, 11, 21, 51" : v.area === "peru" ? "3, 6, 11" : "3, 6, 11, 21";
  return {
    rotulo: `Dónde empieza cada clase (${personas ? "personas" : "estudiantes"})`,
    ayuda: "Desde la segunda clase. Ninguna área queda fuera de la escala.",
    placeholder,
  };
}

/** Las claves de la lista blanca, en su orden: cada una tiene su sección en `SECCION_DE_CAMPO` (gruposTarjeta.ts). */
export function camposDeLaListaBlanca(): string[] {
  return Object.keys(LISTA_BLANCA);
}

const conPunto = (t: string): string => (/[.!?…]$/.test(t) ? t : `${t}.`);

/** Una frase comparable: sin caja, tildes, espacios dobles ni el punto final. */
const fraseComparable = (t: string): string =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").replace(/[.!?…]+$/, "").trim();

/** Las frases de un texto: se corta tras «.», «!» o «?» seguidos de espacio (no tras «…;» de una enumeración). */
const frasesDe = (t: string): string[] => t.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);

/**
 * El texto del «?» de un control (ADR 0135 §8): la guarda de la tarjeta, lo que significa marcar y la descripción del
 * registro, sin repetir y cada uno con su punto. Vacío si no hay nada que decir (entonces no hay «?»).
 *
 * R6-8: se deduplica por FRASE, no por parte: la ayuda de la tarjeta y la descripción del registro suelen compartir una
 * frase («Residuales en gris»: la descripción repite la ayuda y le suma otra), y una frase ya dicha —o contenida en una
 * ya dicha— no se repite.
 */
export function textoAyuda(...partes: readonly (string | null | undefined)[]): string {
  const vistas: string[] = [];
  const salida: string[] = [];
  for (const p of partes) {
    for (const f of frasesDe(p?.trim() ?? "")) {
      const c = fraseComparable(f);
      if (!c || vistas.some((v) => v.includes(c))) continue;
      vistas.push(c);
      salida.push(conPunto(f));
    }
  }
  return salida.join(" ");
}

/** La ayuda del campo de códigos escrito: sólo vale para el respaldo de texto, no para las fichas (oleada I2, ítem 1). */
export const AYUDA_CODIGOS = "Escribe los códigos separados por comas, por ejemplo 88, 99.";

const LISTA_BLANCA: Record<string, Entrada> = {
  // La pregunta filtro de «Filtro y subpregunta» se elige en su tarjeta, junto con lo que habilita.
  var: { rotulo: "Pregunta", cuando: (v) => !tieneVars(v), excepto: ["p_filtro_subpregunta"] },
  // I1 (catálogo del recetario, 2026-10-14): la lista de preguntas no tenía control y el inspector decía «Elige una
  // pregunta…» con seis preguntas en la lámina. Las multiapiladas, la brecha y la matriz la editan en su propia tarjeta.
  vars: { rotulo: "Preguntas", excepto: ["p_barras_multiapiladas", "p_dumbbell", "p_matriz_cuadrantes"] },
  // ADR 0135 §2: la lámina de resumen elige sus preguntas con una regla (reglaPreguntas/ReglaPreguntas.tsx). En la brecha
  // y la divergente la regla es del estilo resumen (el constructor la rechaza con «recetario»); una ya guardada se muestra.
  regla: {
    rotulo: "Regla de preguntas",
    soloEn: GRAFICADORES_REGLA,
    porGraficador: { p_dumbbell: { cuando: resumenOConRegla }, p_barras_divergentes: { cuando: resumenOConRegla } },
  },
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
  // Mapa de distribución (lámina aprobada por Gonzalo el 2026-11-03; contrato en
  // docs/qa/contrato-ui-mapas-dependientes-2026-11-03.md). `juntar`, `unidad` y `otra_respuesta` sólo salen cuando el
  // registro los declara: la tarjeta no promete lo que el motor todavía no dibuja.
  area: { rotulo: "Mapa", soloEn: ["p_mapa_distribucion"] },
  juntar: {
    rotulo: "Juntar con",
    ayuda: "Suma sus respuestas en el mismo mapa, como el distrito del Callao al de Lima.",
    soloEn: ["p_mapa_distribucion"],
  },
  // CCSS Perfil 2026: la lista decía «Callao 12» y el resto del Callao caía en «Otros distritos». Filas con rótulo y las
  // preguntas del propio mapa (AgruparLista.tsx); se guarda la lista con nombre que lee el motor, nunca el texto, así
  // que un valor guardado como lista con nombre se lee y no lo pisa un campo de texto.
  agrupar_lista: {
    rotulo: "Agrupar en la lista",
    ayuda: "Suma en una sola fila de la lista las áreas de las preguntas marcadas. El mapa no cambia.",
    control: "grupos_lista",
    soloEn: ["p_mapa_distribucion"],
    cuando: (v) => preguntasDelMapa(v).length > 0 || (v.agrupar_lista !== undefined && v.agrupar_lista !== null),
  },
  medida: { rotulo: "Qué se pinta", soloEn: ["p_mapa_distribucion"] },
  unidad: { rotulo: "Se cuentan", soloEn: ["p_mapa_distribucion"] },
  otra_respuesta: {
    rotulo: "Áreas de otra respuesta",
    ayuda: "Van en gris rayado, porque las cubre otra respuesta de la pregunta filtro.",
    placeholder: "Lima Metropolitana, Callao, Lima provincias",
    soloEn: ["p_mapa_distribucion"],
    // Guardada como grupos con nombre ({"Lima provincias": [...]}) se edita en el plan: el campo de texto la borraría.
    cuando: (v) => !v.otra_respuesta || Array.isArray(v.otra_respuesta) || typeof v.otra_respuesta === "string",
  },
  otra_respuesta_rotulo: {
    rotulo: "Rótulo en la leyenda",
    placeholder: "Lima y Callao",
    soloEn: ["p_mapa_distribucion"],
    cuando: (v) => Array.isArray(v.otra_respuesta) ? v.otra_respuesta.length > 0 : typeof v.otra_respuesta === "string" && v.otra_respuesta.trim() !== "",
  },
  encuadre: { rotulo: "Encuadre", soloEn: ["p_mapa_distribucion"] },
  puntos: { rotulo: "Puntos de referencia", control: "texto", placeholder: "PUCP | -12.0693, -77.0794", soloEn: ["p_mapa_distribucion"] },
  // G12 (2026-10-13): en multiapiladas el grupo se elige dentro de su modo («Una pregunta por grupos»…); un «Dividir por»
  // suelto en la tarjeta era un segundo camino a lo mismo.
  cruces: { rotulo: "Dividir por", ayuda: "Sin dividir, el gráfico muestra una sola serie.", excepto: ["p_barras_multiapiladas"] },
  // G17: en la brecha el cruce, los grupos y el corte se eligen en su propia tarjeta (BrechaEntreGrupos).
  // En «Total y línea por nivel» el cruce no divide: es el eje, con un punto por nivel (registro: «Niveles del eje»).
  cruce: {
    rotulo: "Dividir por", ayuda: "Sin dividir, el gráfico muestra una sola serie.", excepto: ["p_barras_multiapiladas", "p_dumbbell"],
    textosEn: {
      p_lineas_nivel: () => ({ rotulo: "Niveles del eje", ayuda: "Un punto por nivel, de menor a mayor." }),
      // ADR 0137: en el mapa de calor por cruce el cruce no es opcional; sus grupos son las filas de la tabla.
      p_heatmap_cruce: () => ({ rotulo: "Cruce", ayuda: "Sus grupos van en las filas, después del Total." }),
    },
  },
  // U5 del checklist del mazo (2026-11-05): los textos y los niveles de la línea por nivel se escribían a mano en el plan.
  // Formales de p_lineas_nivel (graficos_lineas_nivel.R) y declarados en el registro (graficos_metadata.R). El texto vacío
  // dice lo que el motor escribe sin valor: «Total», «casos», «nivel» y, sobre las líneas, nada.
  grupos: { rotulo: "Niveles que se muestran", soloEn: ["p_lineas_nivel"] },
  titulo_seccion: {
    rotulo: "Título de las líneas", control: "texto", soloEn: ["p_lineas_nivel"], placeholder: "Sin título", ayuda: 'P. ej. "Según nivel curricular".',
  },
  publico: {
    rotulo: "Cómo se nombran los casos", control: "texto", soloEn: ["p_lineas_nivel"], placeholder: "casos",
    ayuda: 'Va bajo cada nivel con su número: "estudiantes" escribe "119 estudiantes".',
  },
  nombre_nivel: {
    rotulo: "Qué crece", control: "texto", soloEn: ["p_lineas_nivel"], placeholder: "nivel",
    ayuda: 'La palabra del aviso de cada línea: "Crece con el nivel".',
  },
  // Gonzalo (revisión del PPT v7.11, lámina 45): la nota en gris bajo la línea por nivel se escribía a mano en el plan.
  lectura: {
    rotulo: "Lectura", control: "texto", soloEn: ["p_lineas_nivel"],
    ayuda: "Una o dos frases en gris junto al gráfico. Vacío, no se muestra.",
    placeholder: "La diferencia por nivel se mantiene al comparar estudiantes de la misma edad.",
  },
  // Gonzalo (2026-11-04): las líneas y las partes de la franja del total se escribían a mano en el plan. Filas
  // { rotulo, codigos } sobre las respuestas de la pregunta (PartesLineas.tsx); `y` y `color` se conservan sin editarse.
  series: { rotulo: "Líneas", ayuda: "Hasta tres.", soloEn: ["p_lineas_nivel"] },
  total_arriba: { rotulo: "Total arriba", ayuda: "La franja con el total de la pregunta.", soloEn: ["p_lineas_nivel"] },
  rotulo_total: {
    rotulo: "Título del total", control: "texto", soloEn: ["p_lineas_nivel"], siActivo: "total_arriba", placeholder: "Total",
  },
  segmentos_total: {
    rotulo: "Partes del total", ayuda: "Vacío, la franja se arma sola.", soloEn: ["p_lineas_nivel"], siActivo: "total_arriba",
  },
  corte: { rotulo: "Corte", excepto: ["p_dumbbell"] },
  corte_etiqueta: { rotulo: "Rótulo del corte" },
  // ADR 0134: la composición del resumen ejecutivo; el padrón sólo lo escribe el contraste con tabla de base.
  estilo: { rotulo: "Estilo", ayuda: AYUDA_ESTILO, soloEn: ESTILO_RESUMEN },
  universos: {
    rotulo: "Padrón de cada grupo", ayuda: AYUDA_UNIVERSOS, placeholder: "Docentes: 123; Estudiantes: 327",
    soloEn: ["p_dumbbell"], cuando: esEstiloResumen,
  },
  // ADR 0140: la cobertura por categorías de una variable. Su `depende` (modo = "categorias") se cumple sólo en esa versión;
  // en "Por públicos" no salen (estricto). El universo es una tabla por base (coberturaCategorias/UniversoCategorias.tsx).
  variable: { rotulo: "Variable", soloEn: ["p_cobertura"], estricto: true },
  universo_categorias: { rotulo: "Universo", soloEn: ["p_cobertura"], estricto: true },
  tolerancia_pts: {
    rotulo: "Tolerancia (pts)", placeholder: "Sin tolerancia", soloEn: ["p_cobertura"], estricto: true,
    ayuda: "Opcional. Vacío, la lámina no la menciona.",
  },
  base_en: { rotulo: "Dónde va la base", ayuda: AYUDA_BASE_EN, soloEn: ["p_dumbbell"], cuando: esEstiloResumen },
  // C44: el radar «entre públicos» rotula cada columna de su tabla con el nombre técnico de la base.
  tabla_encabezados: { rotulo: "Nombre de cada público", ayuda: "Vacío conserva el nombre de la base.", estricto: true },
  // Radar entre públicos (Gonzalo, 2026-10-23): la tabla de datos es una opción del radar y de sus variantes. `tabla`
  // reemplaza a `mostrar_tabla` (alias que el motor migra al cargar: aquí solo se lee y se escribe `tabla`).
  forma: { rotulo: "Forma del gráfico", estricto: true, soloEn: ["p_radar"] },
  // Eje y alternativa de las líneas y puntos: el front no conoce el número de criterios, así que salen siempre en
  // «entre públicos»; la ayuda del registro dice cuándo rigen. Desde/hasta sólo con el eje personalizado.
  fallback_pocos: { rotulo: "Con menos de 5 criterios", estricto: true, soloEn: ["p_radar"] },
  eje_pocos: { rotulo: "Eje del gráfico de líneas y puntos", estricto: true, soloEn: ["p_radar"] },
  eje_pocos_min: { rotulo: "Desde (%)", estricto: true, soloEn: ["p_radar"], cuando: (v) => v.modo === "publicos" },
  eje_pocos_max: { rotulo: "Hasta (%)", estricto: true, soloEn: ["p_radar"], cuando: (v) => v.modo === "publicos" },
  tabla: { rotulo: "Tabla de datos", ayuda: AYUDA_TABLA, estricto: true, soloEn: ["p_radar"] },
  tabla_titulo: { rotulo: "Encabezado de la primera columna", ayuda: AYUDA_TABLA_TITULO, estricto: true, soloEn: ["p_radar"] },
  eje_min: { rotulo: "El eje arranca en (%)", ayuda: AYUDA_EJE_MIN, estricto: true, soloEn: ["p_radar"] },
  metrica: { rotulo: "Métrica" },
  categoria: { rotulo: "Categoría" },
  direccion_escala: { rotulo: "Dirección de la escala" },
  // Sin valor el motor parte las opciones sustantivas por la mitad (graficos_metadata.R): el campo queda vacío.
  n_negativas: { rotulo: "Categorías negativas", placeholder: "La mitad" },
  incluir_neutro: { rotulo: "Incluir el punto medio" },
  orden_barras: { rotulo: "Orden" },
  orden: { rotulo: "Orden", soloEn: ["p_dumbbell", "p_lollipop", "p_barras_divergentes"] },
  // ADR 0134: formal de p_dumbbell(); sólo lo dibuja el contraste con tabla de base.
  // D4 (ronda 19): con las filas a la vista en Datos, el separador se pone entre ellas; el número queda para cuando no se
  // ven (`base$*`, la regla) y mientras guarde una sola posición.
  separar_tras: {
    rotulo: "Separador después de la fila", ayuda: AYUDA_SEPARAR_TRAS, soloEn: ["p_dumbbell"],
    cuando: (v) => esEstiloResumen(v) && !filasEnLaTarjeta(v) && separadoresDe(v).length <= 1,
  },
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
  agrupar_resto_en_otros: { rotulo: "Agrupar el resto en Otros", siActivo: undefined },
  // Formal de p_barras_agrupadas (e93c51d), p_pie y p_donut (reporte_plan_slides.R). En agrupadas sale con la agrupación
  // encendida (default TRUE del registro); en torta y dona, con `top_k`. Sin ninguna de las dos guardas, nunca.
  etiqueta_otros: {
    rotulo: "Nombre de Otros",
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
    ayuda: 'Opcional, apagado por defecto: escribe "116 respuestas" bajo el nombre de cada público. El pie "Base" no cambia.',
    soloEn: ["p_barras_apiladas", "p_barras_multiapiladas"],
  },
  // N2 (Renzo, 2026-10-22): la línea gris entre un tema y el siguiente de la multiapilada.
  filete_temas: { rotulo: "Línea entre temas", soloEn: ["p_barras_multiapiladas"] },
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
  // v7.25, ítem 4 (Gonzalo: «la etiqueta arriba de la barra ¿es configurable?»): formal de p_barras_multiapiladas() que el
  // constructor pasa a `overrides` (reporte_plan_slides.R). La lámina sólo lo aplica a una batería sin públicos ni grupos
  // dentro del tema (`.lam_escala_arriba_aplica`, lamina_escala_premisa_arriba.R): ahí el enunciado va siempre a la izquierda.
  premisa_posicion: {
    rotulo: "Enunciado de cada barra",
    ayuda: "Encima, la barra usa todo el ancho. Automático lo pone encima sólo cuando la lámina lleva tarjetas de diferencias.",
    soloEn: ["p_barras_multiapiladas"],
    cuando: (v) => !comparaPublicos(v) && v.modo !== "var_cruce",
  },
  excluir_opciones: {
    rotulo: "Excluir respuestas",
    ayuda: AYUDA_CODIGOS,
    // En el mapa no es un ajuste de categorías: define a quién retrata (nacidos fuera de Lima Metropolitana y el Callao).
    textosEn: { p_mapa_distribucion: () => ({ rotulo: "Quitar del mapa", ayuda: "Salen del mapa y de su base." }) },
  },
  // Histograma por grupos: la tarjeta no tenía dónde elegir la pregunta que divide, y «Excluir grupos» pedía elegirla
  // (pasada final 2026-10-15). Sin grupo elegido no hay grupos que excluir.
  // `grupo` salió de RETIRADOS: el histograma por grupos tiene su dibujo (c440f928b) y es el único que lo declara.
  grupo: { rotulo: "Dividir por", ayuda: "Sin dividir, un solo histograma.", soloEn: ["p_histograma"] },
  // R6-15: el histograma divide por `grupo`; las apiladas, agrupadas y multiapiladas (en modo cruce) por `cruces`
  // (b606cb545 en el motor). La guarda sigue a la variable que divide (variableQueExcluye).
  excluir_grupos: {
    rotulo: "Excluir grupos", cuando: (v) => variableQueExcluye("", v) !== "",
    porGraficador: { p_barras_multiapiladas: { cuando: (v) => variableQueExcluye("p_barras_multiapiladas", v) !== "" } },
  },
  // Tabla (5a, ruta anterior): formales de p_tabla (p_radar_split.R); `sm_omit_na = TRUE` sin default en el registro.
  // `top_n` y `sm_omit_codes` siguen sin control: recortan antes del denominador (C40, D1).
  sm_omit_na: { rotulo: "Omitir sin respuesta", soloEn: TABLA, defecto: true },
  umbral_rojo_pct: { rotulo: "Resaltar en rojo bajo (%)", ayuda: "0 desactiva el resaltado.", soloEn: TABLA },
  // `mostrar_significancia` y `significancia_alpha` salen de la lista: los lleva la sección «Diferencias entre grupos»
  // (diferencias/DiferenciasInspector.tsx; ADR 0128). El nivel ya no es de cada lámina sino de la regla del estudio.
  // Pregunta filtro y subpregunta (recetario p192–p194): las preguntas y lo que habilita van en su tarjeta.
  grafico_sub: { rotulo: "Gráfico de la subpregunta", soloEn: ["p_filtro_subpregunta"] },
  disposicion: { rotulo: "Disposición", soloEn: ["p_filtro_subpregunta"], cuando: (v) => v.grafico_filtro !== "torta" && v.grafico_filtro !== "dona" },
  // Inventario de configuraciones, ítem 3 (recetario p74–p75): formal de p_barras_agrupadas() → overrides.
  marcas_eje: { rotulo: "Marcas del eje", ayuda: "0, 25, 50, 75 y 100 % bajo las barras.", soloEn: ["p_barras_agrupadas"] },
  mostrar_brecha: { rotulo: "Mostrar la brecha", ayuda: AYUDA_BRECHA, soloEn: ["p_dumbbell"] },
  // Formal de p_dumbbell (e93c51d): sólo se escribe junto a la brecha, así que sin brecha no hay qué rotular.
  etiqueta_brecha: { rotulo: "Unidad de la brecha", placeholder: "pts", siActivo: "mostrar_brecha", soloEn: ["p_dumbbell"] },
  // Ronda 18 (Gonzalo, 2026-11-09): «TC (24)». Sin default en el registro: NULL es «Automático» (con tres o cuatro grupos
  // va el n; con dos, como el dumbbell de siempre), así que va en tres estados y no en un interruptor (tarjetaGrafico/triestado.ts).
  leyenda_con_n: {
    rotulo: "N en la leyenda", control: "triestado", soloEn: ["p_dumbbell"],
    ayuda: "Junto a cada grupo, sus casos sin ponderar: TC (24). Automático: va con tres o cuatro grupos.",
  },
  // ADR 0134: formal de p_panorama(); la mediana de cada público se lee contra esta línea.
  referencia: { rotulo: "Referencia (%)", ayuda: AYUDA_REFERENCIA, soloEn: ["p_panorama"] },
  // Formales de p_media_rango (e93c51d): `decimales_promedio` es el que llega (el constructor lo pasa a `chip_decimales`).
  decimales_promedio: { rotulo: "Decimales de la media", soloEn: MEDIA_RANGO },
  tipo_rango: {
    rotulo: "Qué abarca la barra", ayuda: AYUDA_TIPO_RANGO, soloEn: MEDIA_RANGO, opcionesRetiradas: { custom: AVISO_RANGO_CUSTOM },
  },
  // Formal de p_histograma (e93c51d); sin default en el registro: vacío = sin tope.
  limite_superior: { rotulo: "Límite superior", ayuda: AYUDA_LIMITE_SUPERIOR, placeholder: "Sin tope", soloEn: ["p_histograma"] },
  // O7c (383c1fe2b): el motor ya acepta estos ajustes desde el gráfico y usa el del tipo debajo.
  invertir_barras: { rotulo: "Invertir el orden de las barras", soloEn: ["p_barras_agrupadas", "p_barras_apiladas", "p_barras_multiapiladas"] },
  otros_al_final: { rotulo: "Otros al final", ayuda: "La categoría Otros va al final, sin importar su frecuencia.", soloEn: ["p_barras_agrupadas"] },
  normalizar_etiquetas: { rotulo: "Escritura de las categorías", soloEn: ["p_barras_agrupadas", "p_barras_categoricas"] },
  // Opcional y apagado por defecto (Gonzalo, 2026-10-23): formal de p_barras_agrupadas / p_lollipop y `...` de p_barras_categoricas.
  residuales_gris: {
    rotulo: "Residuales en gris", ayuda: "Pinta de gris “Prefiero no responder”, “No sabe”, “Otros”…; apagado por defecto.",
    soloEn: ["p_barras_agrupadas", "p_barras_categoricas", "p_lollipop"],
  },
  max_palabras: { rotulo: "Máximo de palabras", soloEn: ["p_nube_palabras"] },
  min_chars: { rotulo: "Mínimo de letras por palabra", soloEn: ["p_nube_palabras"] },
  decimales: { rotulo: "Decimales", soloEn: ["p_numerico", "p_histograma"] },
  mostrar_leyenda: { rotulo: "Mostrar la leyenda", soloEn: ["p_serie_temporal", "p_numerico"] },
  mostrar_valores: { rotulo: "Mostrar cifras", soloEn: ["p_serie_temporal"], cuando: serieEnMarco },
  max_series_con_cifras: {
    rotulo: "Máximo de series con cifras",
    ayuda: "Con más series las cifras se apagan solas para no pisarse.",
    siActivo: "mostrar_valores",
    soloEn: ["p_serie_temporal"],
    cuando: serieEnMarco,
  },
  min_n: { rotulo: "Casos mínimos por distrito", ayuda: AYUDA_MIN_N, soloEn: ["p_mapa_resultado_distrital"] },
  cortes: {
    rotulo: "Cortes de las clases (%)", ayuda: AYUDA_CORTES, placeholder: "55, 65, 75", soloEn: ["p_mapa_resultado_distrital", "p_mapa_distribucion"],
    // En el mapa de distribución las clases se cuentan en estudiantes o personas, no en %: la ayuda anterior decía «55, 65 y 75».
    textosEn: { p_mapa_distribucion: cortesDistribucion },
  },
  // I-c: en la serie temporal los decimales son decisión del informe (Estilo del informe › Cálculos); sólo el radar.
  valores_decimales: { rotulo: "Decimales", soloEn: ["p_radar"] },
  // U6 (checklist de mandos del mazo, 2026-11-05): `via_overrides` en el registro. La tarjeta los escribe en espejo en
  // `args` y `overrides` (mandosPorOverrides.ts, desde `updateSlotArgs`); el motor los lee de `overrides`.
  pista_barras: {
    rotulo: "Pista gris hasta el 100%", ayuda: "Automática: en toda barra de una serie.",
    soloEn: ["p_barras_agrupadas", "p_barras_categoricas"],
  },
  colorear_por_opcion: {
    rotulo: "Un color por opción", ayuda: "Con una sola serie, cada barra con el color de su respuesta.", soloEn: ["p_barras_agrupadas"],
  },
  marca_mediana: { rotulo: "Marca de la mediana", soloEn: ["p_histograma"] },
  // U10 (2026-11-05): la lámina nativa lo lee (graficador_histograma_recetario.R); viaja en espejo como los de U6.
  // `ancho_bin` y `mostrar_bins_vacios` siguen en RETIRADOS: con un ancho declarado el histograma deja la lámina nativa y
  // sale como imagen (`.histograma_recetario_aplica`), y los intervalos vacíos sólo existen en esa ruta.
  mostrar_frecuencia: { rotulo: "Casos junto al %", ayuda: "Bajo cada porcentaje, cuántos casos son.", soloEn: ["p_histograma"] },
};

/**
 * RETIRADOS (C40, I-e): sin efecto en la lámina nativa, no salen en la tarjeta aunque el registro los declare. El valor
 * guardado NO se toca: la tarjeta sólo escribe la clave del campo que se edita (`mergeSlotArgsPatch` conserva el resto).
 */
export const RETIRADOS: ReadonlySet<string> = new Set([
  "invertir_leyenda", "tipo_pie", "umbral_brecha_pct", "tabla_ancho_tema", "tabla_proporcion", "sm_omit_na",
  "umbral_rojo_pct", "mostrar_tabla_derecha", "modo_semaforo", "mostrar_ref_label", "mostrar_n_cruce_x", "radar_min_ejes",
  "bins", "ancho_bin", "mostrar_bins_vacios", "mostrar_saldo", "umbral_etiqueta_pct",
  "mostrar_promedio", "formato_valor", "cortes_chip",
  // Reemplazado por `tabla` (auto | si | no); el valor guardado lo migra el motor al cargar.
  "mostrar_tabla",
]);
/** Familias retiradas enteras: las brechas declaradas (`brecha_*`). */
const RETIRADO_PREFIJO = ["brecha_"];

/** Args retirados en general que en un graficador nativo siguen teniendo efecto: cambian los datos, no el dibujo. */
const VIGENTE_EN: Readonly<Record<string, ReadonlySet<string>>> = {
  // G11: «Omitir sin respuesta» cambia las filas de la tabla, que ahora sale nativa.
  p_tabla: new Set(["sm_omit_na"]),
};

export function esRetirado(name: string, graficador?: string): boolean {
  // 5a: en un graficador no nativo lo retirado sigue teniendo efecto (lo dibuja ggplot).
  if (graficador && GRAFICADORES_NO_NATIVOS.has(graficador)) return false;
  if (graficador && VIGENTE_EN[graficador]?.has(name)) return false;
  return RETIRADOS.has(name) || RETIRADO_PREFIJO.some((p) => name.startsWith(p));
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
  partes: "partes",
  regla_preguntas: "regla_preguntas",
  universo_categorias: "universo_categorias",
};

export type CampoDato = {
  arg: ArgMetadata;
  rotulo: string;
  /** La guarda de la tarjeta (C40): abre el «?» junto con `detalle`. */
  ayuda: string | null;
  /** Descripción larga del registro, para el «?». */
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
    if (graficador && !argDeLaVersion(graficador, valores, name)) continue;
    const defecto = "defecto" in guarda ? guarda.defecto : e.defecto;
    const conDefecto = defecto !== undefined && (arg.default === undefined || arg.default === null) ? { ...arg, default: defecto } : arg;
    const guardado = valores[name];
    const retiradas = e.opcionesRetiradas ?? {};
    const opciones = (arg.choices ?? []).filter((o) => !Object.hasOwn(retiradas, o.value) || o.value === guardado);
    const aviso = typeof guardado === "string" && Object.hasOwn(retiradas, guardado) ? retiradas[guardado] : null;
    const t = { ...e, ...((graficador && e.textosEn?.[graficador]?.(valores)) || {}) };
    salida.push({
      arg: conDefecto, rotulo: t.rotulo, ayuda: t.ayuda ?? null, detalle: arg.descripcion ?? "", control,
      placeholder: t.placeholder ?? null, opciones, aviso,
    });
  }
  return salida;
}

/**
 * H2 (checklist de usabilidad, 2026-11-05): mandos de opciones cuya ayuda describe la opción ELEGIDA con el `hint` del
 * registro («Nunca: la barra sola, sin pista»), no siempre la de por defecto. Sin `hint` para esa opción, la ayuda fija.
 */
const AYUDA_DE_LA_OPCION: ReadonlySet<string> = new Set(["pista_barras"]);

/**
 * La ayuda que va en el «?» del control con el valor que rige (`valor`, o el `default` del registro si no hay). Ítem 9 de
 * la oleada del inspector (2026-11-08): con las opciones a la vista en un segmentado, el `hint` de la elegida va al «?»
 * de todo mando de opciones, detrás de su guarda; en `pista_barras` la reemplaza, porque la guarda describe la opción por
 * defecto.
 */
export function ayudaDeLaOpcion(campo: Pick<CampoDato, "arg" | "ayuda" | "opciones">, valor: unknown): string | null {
  const elegida = typeof valor === "string" && valor !== "" ? valor : campo.arg.default;
  const op = campo.opciones.find((o) => o.value === elegida);
  const hint = op?.hint?.trim();
  if (!op || !hint) return campo.ayuda;
  const deLaOpcion = `${op.label}: ${hint.charAt(0).toLowerCase()}${hint.slice(1)}`;
  if (AYUDA_DE_LA_OPCION.has(campo.arg.name)) return deLaOpcion;
  return textoAyuda(campo.ayuda, deLaOpcion);
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

/**
 * P21 (enmienda al ADR 0103): en los gráficos que comparan públicos por tema el corte viaja como cadena «3,4»
 * (contrato con api/R/graficos_temas_titulos.R): una lista podía llegar al motor reducida a su primer código.
 */
export const CORTE_EN_CADENA: ReadonlySet<string> = new Set(["p_radar", "p_serie_temporal", "p_dumbbell"]);

/** Lo que guarda un control de códigos: la lista, o la cadena unida con comas para el corte de esos gráficos. */
export function codigosEmitidos(t: string, graficador: string | undefined, arg: string): string | string[] {
  const codigos = textoACodigos(t);
  return arg === "corte" && graficador && CORTE_EN_CADENA.has(graficador) ? codigos.join(",") : codigos;
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

/** Tope de líneas de «Línea por nivel» (`.LINEAS_NIVEL_MAX_SERIES`, api/R/graficos_lineas_nivel.R). */
export const MAX_LINEAS_NIVEL = 3;

/**
 * Una fila de `series` o `segmentos_total`. `resto` guarda lo que la tarjeta no edita (`y`, `color` y cualquier otra
 * clave) tal como llegó: editar el rótulo o las respuestas no lo toca.
 */
export type FilaParte = { clave: string; rotulo: string; codigos: string[]; resto: Readonly<Record<string, unknown>> };

const codigosDeParte = (v: unknown): string[] =>
  typeof v === "number" ? [String(v)] : textoACodigos(codigosATexto(v));

/** Lo guardado (lista, una parte suelta sin envolver o nada) como filas; lo que no es objeto no es una parte. */
export function partesAFilas(valor: unknown): FilaParte[] {
  if (!valor || typeof valor !== "object") return [];
  const suelta = !Array.isArray(valor) && ("rotulo" in valor || "codigos" in valor);
  const lista: unknown[] = Array.isArray(valor) ? valor : suelta ? [valor] : [];
  return lista.flatMap((p, i) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return [];
    const { rotulo, codigos, ...resto } = p as Record<string, unknown>;
    return [{ clave: `p${i}`, rotulo: typeof rotulo === "string" ? rotulo : rotulo == null ? "" : String(rotulo), codigos: codigosDeParte(codigos), resto }];
  });
}

/** El motor rechaza una parte sin rótulo o sin respuestas: esa fila se muestra, pero no se guarda. */
export function filaCompleta(f: Pick<FilaParte, "rotulo" | "codigos">): boolean {
  return f.rotulo.trim() !== "" && f.codigos.length > 0;
}

/** Fuera del tope de líneas: el motor rechazaría la lista entera. */
const fueraDelTope = (arg: string, indice: number) => arg === "series" && indice >= MAX_LINEAS_NIVEL;

/**
 * Lo que se guarda: sólo las filas que el motor acepta, con lo que la tarjeta no edita intacto. Sin ninguna, las partes
 * del total van como `null` (la franja se arma sola); las líneas, como lista vacía.
 */
export function filasAPartes(filas: readonly FilaParte[], arg: string): Record<string, unknown>[] | null {
  const partes = filas
    .filter((f, i) => filaCompleta(f) && !fueraDelTope(arg, i))
    .map((f) => ({ rotulo: f.rotulo.trim(), codigos: [...f.codigos], ...f.resto }));
  return partes.length ? partes : arg === "segmentos_total" ? null : [];
}

/** El aviso discreto de una fila que no se guarda (o `null` si se guarda). */
export function avisoParte(f: Pick<FilaParte, "rotulo" | "codigos">, indice: number, arg: string): string | null {
  if (fueraDelTope(arg, indice)) return "Hasta tres líneas: esta no sale.";
  const sinRotulo = f.rotulo.trim() === "";
  const sinCodigos = f.codigos.length === 0;
  if (sinRotulo && sinCodigos) return "Falta el rótulo y las respuestas: no sale.";
  if (sinRotulo) return "Falta el rótulo: no sale.";
  if (sinCodigos) return "Elige al menos una respuesta: no sale.";
  return null;
}

/** Lo que la fila trae y la tarjeta no edita, dicho en una línea de solo lectura. */
export function notaParte(f: Pick<FilaParte, "resto">): string | null {
  const notas: string[] = [];
  const y = f.resto.y;
  if (y && typeof y === "object" && !Array.isArray(y)) {
    const v = (y as Record<string, unknown>).var;
    notas.push(`Suma una segunda pregunta: ${typeof v === "string" && v.trim() ? v.trim() : "sin nombre"}.`);
  }
  if (typeof f.resto.color === "string" && f.resto.color.trim()) notas.push(`Color: ${f.resto.color.trim()}.`);
  return notas.length ? notas.join(" ") : null;
}

/** ¿Lo guardado y el borrador de la tarjeta dicen lo mismo al motor? Si no, cambió afuera (deshacer, el plan). */
export function mismasPartes(valor: unknown, filas: readonly FilaParte[], arg: string): boolean {
  return JSON.stringify(filasAPartes(partesAFilas(valor), arg)) === JSON.stringify(filasAPartes(filas, arg));
}

/**
 * R6-4: los ajustes de Aspecto que no son campos del registro y también son propios del gráfico, para la cabecera
 * plegada: el orden elegido («Orden»), la letra, el espacio de las etiquetas y el eje libre de las agrupadas (que viajan
 * en `overrides`, letraYEje.ts) y lo destacado. `destacadas`: lo que el gráfico destaca (`destacadasDe`), `null` si el
 * gráfico no destaca.
 */
export function propiosDeAspecto(p: { graficador: string; args: Readonly<Record<string, unknown>>; conOrden: boolean; destacadas: readonly string[] | null }): string[] {
  const out: string[] = [];
  if (p.conOrden && ordenAGuardar(leerOrden(p.args)) !== null) out.push("Orden");
  if (p.destacadas && (p.destacadas.length > 0 || (GRAFICOS_CON_RESALTE.has(p.graficador) && mayorActiva({ ...p.args }, p.destacadas)))) out.push("Destacar");
  if (GRAFICADORES_LETRA_Y_EJE.has(p.graficador)) {
    const l = leerLetraYEje(p.args);
    if (l.rotuloPt !== null || l.cifraPt !== null) out.push("Letra");
    if (l.etiquetasPct !== null) out.push("Espacio para las etiquetas");
    if (l.ejeLibre) out.push("Eje libre");
  }
  return out;
}

/** Los modos de la multiapilada en que el gráfico se divide por el cruce. */
const MODOS_MULTI_CON_CRUCE: ReadonlySet<string> = new Set(["cruce", "var_cruce"]);

/**
 * R7-19: el patch que cambia el modo de la multiapilada a uno sin cruce quita `excluir_grupos` del plan: quedaba oculto
 * (sin control que lo muestre) y el motor avisaba en cada exportación. Sin cambio de modo, el patch queda igual.
 */
export function sinGruposHuerfanos(args: Readonly<Record<string, unknown>>, patch: Record<string, unknown>): Record<string, unknown> {
  if (!("modo" in patch) || MODOS_MULTI_CON_CRUCE.has(String(patch.modo ?? ""))) return patch;
  return args.excluir_grupos === undefined || args.excluir_grupos === null ? patch : { ...patch, excluir_grupos: null };
}

const primerTexto = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x.trim() : "";
};

/**
 * R6-15: la variable cuyos grupos lista «Excluir grupos»: `grupo` (histograma) o, sin él, el primer `cruces` (apiladas,
 * agrupadas y multiapiladas; el motor acepta códigos y rótulos). En la multiapilada sólo rige en modo cruce o var_cruce.
 * Vacío si el gráfico no se divide.
 */
export function variableQueExcluye(graficador: string, args: Readonly<Record<string, unknown>>): string {
  const grupo = primerTexto(args.grupo);
  if (grupo) return grupo;
  if (graficador === "p_barras_multiapiladas" && !MODOS_MULTI_CON_CRUCE.has(String(args.modo ?? ""))) return "";
  return primerTexto(args.cruces) || primerTexto(args.cruce);
}
