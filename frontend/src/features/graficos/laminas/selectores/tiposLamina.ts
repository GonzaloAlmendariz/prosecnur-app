// Tipos de lámina por intención (F6.2; dirección F6 §4.3 «¿Qué lámina?»). El analista no elige un layout por su nombre:
// elige qué quiere mostrar (una pregunta, dos juntas, un público…) y ve las composiciones que lo resuelven. Las
// intenciones agrupan los tipos que el registro ofrece (`en_selector`); las láminas de población antiguas quedan fuera
// del selector pero se siguen dibujando y editando en los planes que las usan.
//
// Las variantes son de las láminas de estructura que el motor dibuja en varias composiciones (portada 23–25, índice,
// separador, cierre 61–65): viven en `payload.meta` salvo la del cierre, que el registro declara como arg `variante`.

import type { Slide, SlideType } from "../../../../api/graficos";
import { conSlideMeta, leerSlideMeta, type SlideMeta } from "../../slideMeta";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { esSlotCifra } from "../../iconos/composicion";
import { composicionIndiceEfectiva, composicionIndicePorDefecto } from "../../indice/modeloIndice";

export type IntencionLamina = "una" | "dos" | "varias" | "publico" | "cifras" | "mensaje" | "estructura";

export type Intencion = { id: IntencionLamina; label: string; descripcion: string; tipos: readonly SlideType[] };

export const INTENCIONES: readonly Intencion[] = [
  {
    id: "una",
    label: "Una sola pregunta",
    descripcion: "Un gráfico, solo o con su lectura al lado.",
    tipos: ["p_slide_1_grafico", "p_slide_1_grafico_narrativo", "p_slide_grafico_texto_derecha", "p_slide_grafico_texto_izquierda"],
  },
  {
    id: "dos",
    label: "Dos preguntas juntas",
    descripcion: "Dos gráficos que se leen en paralelo, apilados o uno que manda.",
    tipos: [
      "p_slide_2_graficos", "p_slide_2_graficos_narrativo", "p_slide_2_graficos_vertical", "p_slide_2_graficos_asimetrico",
      "p_slide_2_graficos_texto_izquierda", "p_slide_2_graficos_texto_derecha",
    ],
  },
  {
    id: "varias",
    label: "Varias preguntas de un tema",
    descripcion: "Tres o cuatro gráficos de un mismo tema en un reparto fijo.",
    tipos: ["p_slide_3_graficos_fila", "p_slide_3_graficos_2mas1", "p_slide_3_graficos_1mas2", "p_slide_3_graficos_1arriba", "p_slide_4_graficos"],
  },
  {
    id: "publico",
    label: "Describir a un público",
    descripcion: "El perfil de un público, con su ícono en la cabecera.",
    tipos: ["p_slide_3_graficos_poblacion_tira", "p_slide_3_graficos_poblacion_corona", "p_slide_5_graficos_poblacion", "p_slide_6_graficos_poblacion"],
  },
  {
    id: "cifras",
    label: "Destacar cifras",
    descripcion: "Las cifras mandan y los gráficos las acompañan.",
    tipos: ["p_slide_cifras_y_graficos", "p_slide_3_graficos_poblacion_cifras"],
  },
  {
    id: "mensaje",
    label: "Dejar un mensaje",
    descripcion: "Texto: conclusiones o notas metodológicas breves.",
    tipos: ["p_slide_texto"],
  },
  {
    id: "estructura",
    label: "Estructura del informe",
    descripcion: "Portada, índice, objetivo, ficha técnica, cómo leer, separador y cierre.",
    tipos: [
      "p_slide_portada", "p_slide_indice", "p_slide_objetivo_icono", "p_slide_tabla_tecnica", "p_slide_top_two_box",
      "p_slide_redondeo", "p_slide_seccion", "p_slide_cierre",
    ],
  },
];

/** Población antigua (Gonzalo, 2026-10-10: «bórralos, en el recetario tampoco están»): fuera del selector. */
export const TIPOS_FUERA_DEL_SELECTOR: ReadonlySet<SlideType> = new Set<SlideType>([
  "p_slide_2_graficos_poblacion",
  "p_slide_3_graficos_poblacion",
  "p_slide_4_graficos_poblacion",
]);

export function intencionDe(tipo: SlideType): IntencionLamina | null {
  return INTENCIONES.find((i) => i.tipos.includes(tipo))?.id ?? null;
}

/** Ranuras de gráfico y de cifra del tipo. */
export function ranurasDeTipo(tipo: SlideType): { graficos: number; cifras: number } {
  const slots = SLIDE_GRAF_SLOTS[tipo] ?? [];
  const cifras = slots.filter(esSlotCifra).length;
  return { graficos: slots.length - cifras, cifras };
}

/** «2 gráficos», «2 gráficos y 3 cifras», «Sin gráficos». */
export function rotuloRanuras(tipo: SlideType): string {
  const { graficos, cifras } = ranurasDeTipo(tipo);
  const g = graficos ? `${graficos} ${graficos === 1 ? "gráfico" : "gráficos"}` : "";
  const c = cifras ? `${cifras} ${cifras === 1 ? "cifra" : "cifras"}` : "";
  if (g && c) return `${g} y ${c}`;
  return g || c || "Sin gráficos";
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

export type OpcionVariante = { valor: string; label: string; detalle?: string };

export type VariantesTipo = {
  /** Dónde se guarda: una clave de `payload.meta` o un arg del payload. */
  donde: { en: "meta"; clave: "variante" | "composicion" | "nivel" } | { en: "payload"; clave: "variante" };
  label: string;
  defecto: string;
  opciones: readonly OpcionVariante[];
};

export const VARIANTES_LAMINA: Partial<Record<SlideType, VariantesTipo>> = {
  // lamina_identidad.R `.lam_portada_variante`: «centrada» (23, por defecto), «izquierda» (24), «banda» (25).
  p_slide_portada: {
    donde: { en: "meta", clave: "variante" },
    label: "Composición de la portada",
    defecto: "centrada",
    opciones: [
      { valor: "centrada", label: "Centrada", detalle: undefined },
      { valor: "izquierda", label: "Alineada a la izquierda", detalle: "Lámina 24" },
      { valor: "banda", label: "Banda al pie", detalle: "Lámina 25" },
    ],
  },
  // lamina_identidad.R `.lam_laminas_indice`: «arcos» (31, por defecto), «facetas», «circulos», «bloques».
  p_slide_indice: {
    donde: { en: "meta", clave: "composicion" },
    label: "Ilustración del índice",
    defecto: "arcos",
    opciones: [
      { valor: "arcos", label: "Arcos", detalle: undefined },
      { valor: "facetas", label: "Facetas" },
      { valor: "circulos", label: "Círculos" },
      { valor: "bloques", label: "Bloques" },
    ],
  },
  // lamina_identidad.R `.lam_secciones_numeradas`: `meta.nivel = "subcapitulo"`; sin él, capítulo.
  p_slide_seccion: {
    // G8 (2026-10-13): las siete versiones del recetario (52–57). El valor junta nivel y versión: `conVariante` escribe
    // `meta.nivel` y `meta.variante` (lamina_seccion_variantes.R).
    donde: { en: "meta", clave: "nivel" },
    label: "Separador",
    defecto: "capitulo",
    opciones: [
      { valor: "capitulo", label: "Capítulo con rótulo", detalle: "«Capítulo 2» sobre un filete; el título manda" },
      { valor: "capitulo:numero", label: "Capítulo con número", detalle: "El número grande en coral, con un filete" },
      { valor: "capitulo:fondo", label: "Capítulo con número de fondo", detalle: "El número detrás, como marca de agua" },
      { valor: "subcapitulo", label: "Subcapítulo sobrio", detalle: "Número y título en una línea" },
      { valor: "subcapitulo:barra", label: "Subcapítulo con barra", detalle: "Junto a una barra coral" },
      { valor: "subcapitulo:banda", label: "Subcapítulo en banda", detalle: "Una banda clara a lo ancho" },
    ],
  },
  // graficos_metadata.R `p_slide_cierre$args$variante` y lamina_identidad.R `.lam_cierre_variante` (61–65).
  p_slide_cierre: {
    donde: { en: "payload", clave: "variante" },
    label: "Composición del cierre",
    defecto: "contraportada",
    opciones: [
      { valor: "contraportada", label: "Contacto al pie", detalle: undefined },
      { valor: "banda_azul", label: "Banda azul al pie", detalle: "Lámina 61" },
      { valor: "banda_clara", label: "Banda clara al pie", detalle: "Lámina 62" },
      { valor: "contacto", label: "Contacto bajo el logo", detalle: "Lámina 63" },
      { valor: "tres_columnas", label: "Contacto en tres columnas", detalle: "Lámina 64" },
    ],
  },
};

/**
 * El defecto que el motor aplica a ESTA lámina cuando no se declara variante (E2). Hoy sólo difiere en el índice —con
 * ajustes de focos el motor elige «círculos» (`.lam_indice_composicion`)—; A6 pasará el del Estilo del cliente.
 */
export function defectoEfectivoDe(slide: Pick<Slide, "tipo" | "payload">): string | undefined {
  if (slide.tipo === "p_slide_indice") return composicionIndicePorDefecto(slide.payload ?? {});
  return undefined;
}

function defectoDe(slide: Pick<Slide, "tipo" | "payload">, v: VariantesTipo, defectoEfectivo?: string): string {
  const d = defectoEfectivo ?? defectoEfectivoDe(slide);
  return d && v.opciones.some((o) => o.valor === d) ? d : v.defecto;
}

/**
 * Las variantes del tipo, con las etiquetas del registro cuando las declara (`choices` del arg). Con `defectoEfectivo`
 * la opción por defecto es la que el motor usaría para la lámina (la del recetario o, desde A6, la del cliente).
 */
export function variantesDe(
  tipo: SlideType,
  choicesRegistro?: ReadonlyArray<{ value: string; label: string }>,
  defectoEfectivo?: string,
): VariantesTipo | null {
  const base = VARIANTES_LAMINA[tipo];
  if (!base) return null;
  const defecto = defectoEfectivo && base.opciones.some((o) => o.valor === defectoEfectivo) ? defectoEfectivo : base.defecto;
  if (!choicesRegistro?.length) return { ...base, defecto };
  const porValor = new Map(base.opciones.map((o) => [o.valor, o]));
  return {
    ...base,
    defecto,
    opciones: choicesRegistro.map((c) => ({ valor: c.value, label: c.label, detalle: porValor.get(c.value)?.detalle })),
  };
}

/**
 * La variante con la que sale la lámina. `null` si el tipo no tiene variantes. En el índice es la composición efectiva
 * del motor (`composicionIndiceEfectiva`), que puede ser «focos» (ruta anterior) y no estar entre las opciones.
 */
export function varianteDe(slide: Pick<Slide, "tipo" | "payload">, defectoEfectivo?: string): string | null {
  const v = VARIANTES_LAMINA[slide.tipo];
  if (!v) return null;
  if (slide.tipo === "p_slide_indice") return composicionIndiceEfectiva(slide);
  if (slide.tipo === "p_slide_seccion") {
    const meta = leerSlideMeta(slide);
    const compuesto = `${meta.nivel === "subcapitulo" ? "subcapitulo" : "capitulo"}${meta.variante ? `:${meta.variante}` : ""}`;
    return v.opciones.some((o) => o.valor === compuesto) ? compuesto : meta.nivel === "subcapitulo" ? "subcapitulo" : "capitulo";
  }
  const valor = v.donde.en === "meta"
    ? leerSlideMeta(slide)[v.donde.clave]
    : (slide.payload as Record<string, unknown>)[v.donde.clave];
  return typeof valor === "string" && v.opciones.some((o) => o.valor === valor) ? valor : defectoDe(slide, v, defectoEfectivo);
}

/**
 * El payload con la variante puesta. En `meta`, la de por defecto EFECTIVA borra la clave (el motor ya la usa sin ella);
 * cualquier otra se declara, también la del recetario cuando el motor elegiría otra (índice con focos → «círculos»: sin
 * declarar «arcos», se exportaría «círculos»). El arg del cierre se escribe siempre, como lo nace `DEFAULT_PAYLOADS`.
 */
export function conVariante(slide: Pick<Slide, "tipo" | "payload">, valor: string, defectoEfectivo?: string): Record<string, unknown> {
  const v = VARIANTES_LAMINA[slide.tipo];
  if (!v) return { ...slide.payload };
  if (v.donde.en === "payload") return { ...slide.payload, [v.donde.clave]: valor };
  if (slide.tipo === "p_slide_seccion") {
    const [nivel, variante] = valor.split(":");
    return conSlideMeta(slide, { nivel: nivel === "subcapitulo" ? "subcapitulo" : undefined, variante: variante || undefined }).payload;
  }
  const cambio: Partial<SlideMeta> = { [v.donde.clave]: valor === defectoDe(slide, v, defectoEfectivo) ? undefined : valor };
  return conSlideMeta(slide, cambio).payload;
}
