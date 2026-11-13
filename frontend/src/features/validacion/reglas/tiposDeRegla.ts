/**
 * Tipos de regla propia que ofrece el panel de regla, con lo que cada uno
 * revisa.
 *
 * `label` es el nombre con que la regla se nombra sola si nadie le pone uno
 * (`nombreSugerido`): no cambia, porque cambiaría lo que se guarda. `rotulo` y
 * `ejemploCorto` son los textos de la tesela de "Qué quieres revisar"
 * (prototipo `TIPOS_REGLA`, `vistas.js:526`). El orden del arreglo es el de
 * las teselas dentro de su columna.
 */
import type { TipoReglaPropia } from "./tiposDelMotor";

export type GrupoDeTipo = "respuesta" | "coherencia" | "seleccion";

export type TipoMeta = {
  key: TipoReglaPropia;
  label: string;
  /** El nombre de la tesela. */
  rotulo: string;
  /** El caso de ejemplo bajo el nombre de la tesela. */
  ejemploCorto: string;
  /** Lo que revisa, en una oración: es la frase mientras la regla no está completa. */
  descripcion: string;
  /** Cuántas preguntas lleva: fijo o [mínimo, máximo]. `condiciones` las toma de sus condiciones. */
  nVars: number | [number, number];
  grupo: GrupoDeTipo;
  /**
   * Tipos que el selector ya no ofrece para crear (D-F11, hoy solo los valores
   * extremos): solo aparecen si la regla que se edita ya es de ese tipo.
   * Respuesta obligatoria y fuera de lista volvieron al selector el 2026-11-12:
   * sin ellas un practicante no tenía cómo revisar respuestas vacías ni códigos
   * fuera de la lista.
   */
  legacyHidden?: boolean;
};

export const GRUPOS_DE_TIPOS: ReadonlyArray<{ key: GrupoDeTipo; rotulo: string }> = [
  { key: "respuesta", rotulo: "Rangos y fechas" },
  { key: "coherencia", rotulo: "Coherencia de la encuesta" },
  { key: "seleccion", rotulo: "Preguntas de opción múltiple" },
];

export const TIPOS: TipoMeta[] = [
  {
    key: "rango_num",
    label: "Valor fuera de rango",
    rotulo: "Valor fuera de rango",
    ejemploCorto: "Edad menor de 18 o mayor de 99",
    descripcion: "Se marca cuando un número queda por debajo del mínimo o por encima del máximo.",
    nVars: 1,
    grupo: "respuesta",
  },
  {
    key: "rango_fecha",
    label: "Fecha fuera del operativo",
    rotulo: "Fecha fuera del operativo",
    ejemploCorto: "Encuestas con fecha anterior al inicio del campo",
    descripcion: "Se marca cuando una fecha cae antes del inicio o después del cierre del operativo, o no se puede leer.",
    // Una pregunta con la fecha entera, o tres (día, mes y año).
    nVars: [1, 3],
    grupo: "respuesta",
  },
  {
    key: "comparar_fechas",
    label: "Dos fechas u horas que deben cuadrar",
    rotulo: "Dos fechas u horas que deben cuadrar",
    ejemploCorto: "La hora de fin es anterior a la de inicio",
    descripcion: "Se marca cuando la segunda fecha u hora es anterior a la primera, o cuando la duración entre ambas queda fuera del rango.",
    // Inicio y fin, cada uno de una a tres preguntas.
    nVars: [2, 6],
    grupo: "respuesta",
  },
  {
    key: "no_nulo",
    label: "Respuesta obligatoria",
    rotulo: "Respuesta obligatoria",
    ejemploCorto: "Una pregunta que no debía quedar vacía",
    descripcion: "Se marca cuando la pregunta queda vacía.",
    nVars: 1,
    grupo: "respuesta",
  },
  {
    key: "outliers_iqr",
    label: "Outliers (IQR)",
    rotulo: "Valores extremos por rango intercuartílico",
    ejemploCorto: "Ingresos muy alejados del resto",
    descripcion: "Se marca cuando un número se aleja del resto más de lo que admite el rango intercuartílico.",
    nVars: 1,
    grupo: "respuesta",
    legacyHidden: true,
  },
  {
    key: "outliers_z",
    label: "Outliers (Z-score)",
    rotulo: "Valores extremos por puntaje z",
    ejemploCorto: "Conteos muy alejados de la media",
    descripcion: "Se marca cuando un número está demasiadas desviaciones estándar lejos de la media.",
    nVars: 1,
    grupo: "respuesta",
    legacyHidden: true,
  },
  {
    key: "fuera_catalogo",
    label: "Respuesta fuera de lista",
    rotulo: "Respuesta fuera de lista",
    ejemploCorto: "Un código que no está en la lista permitida",
    descripcion: "Se marca cuando la respuesta no está en la lista de valores permitidos.",
    nVars: 1,
    grupo: "respuesta",
  },
  {
    key: "formato",
    label: "Formato de la respuesta",
    rotulo: "Formato de la respuesta",
    ejemploCorto: "Un teléfono que no tiene 9 dígitos que empiezan con 9",
    descripcion: "Se marca cuando la respuesta no está escrita como se pide: cantidad de dígitos, cómo empieza, un correo o un patrón.",
    nVars: 1,
    grupo: "respuesta",
  },
  {
    key: "coherencia_2v",
    label: "Dos respuestas que deben cuadrar",
    rotulo: "Dos respuestas que deben cuadrar",
    ejemploCorto: "Egresó en 2025 y declara 8 años de experiencia",
    descripcion: "Se marca cuando la primera respuesta cumple su condición y la segunda no cumple la que se espera.",
    nVars: 2,
    grupo: "coherencia",
  },
  {
    key: "duplicados",
    label: "Duplicados operativos",
    rotulo: "Respuestas repetidas",
    ejemploCorto: "El mismo documento en dos encuestas",
    descripcion: "Se marca cuando las mismas respuestas en estas preguntas aparecen en más de una encuesta.",
    nVars: [1, 5],
    grupo: "coherencia",
  },
  {
    key: "condiciones",
    label: "Condiciones combinadas",
    rotulo: "Condiciones combinadas",
    ejemploCorto: "Egresó antes de ingresar o después de 2026",
    descripcion: "Se marca cuando se cumplen todas las condiciones, o alguna de ellas.",
    nVars: [1, 20],
    grupo: "coherencia",
  },
  {
    key: "bateria",
    label: "Patrón en una batería",
    rotulo: "Patrón en una batería",
    ejemploCorto: "La misma respuesta en los 14 ítems de una escala",
    descripcion: "Se marca cuando las preguntas de una batería tienen todas la misma respuesta, repiten un código o quedan vacías.",
    nVars: [2, 300],
    grupo: "coherencia",
  },
  {
    key: "combinacion_catalogo",
    label: "Combinación fuera de catálogo",
    rotulo: "Combinación fuera de catálogo",
    ejemploCorto: "El distrito no pertenece a la provincia declarada",
    descripcion: "Se marca cuando el lugar declarado en varias preguntas no existe en el catálogo de ubigeos o sus partes no calzan.",
    // Dos a cuatro papeles: departamento, provincia, distrito y ubigeo.
    nVars: [2, 4],
    grupo: "coherencia",
  },
  {
    key: "select_multiple_hierarchy",
    label: "Completar opciones asumidas",
    rotulo: "Opciones que van juntas",
    ejemploCorto: 'Marcó "Hijos" y no marcó "Familia"',
    descripcion: "Se marca cuando una opción está marcada y falta otra que debía ir con ella.",
    nVars: 1,
    grupo: "seleccion",
  },
  {
    key: "select_multiple_exclusive",
    label: "Opciones incompatibles",
    rotulo: "Opciones incompatibles",
    ejemploCorto: 'Marcó "Ninguna" junto con otra opción',
    descripcion: "Se marca cuando una opción excluyente aparece junto con otra.",
    nVars: 1,
    grupo: "seleccion",
  },
  {
    key: "select_multiple_cardinality",
    label: "Cantidad de opciones marcada",
    rotulo: "Cantidad de opciones marcadas",
    ejemploCorto: "Más de tres donde se pedían hasta tres",
    descripcion: "Se marca cuando hay menos o más opciones marcadas que las esperadas.",
    nVars: 1,
    grupo: "seleccion",
  },
  {
    key: "select_multiple_selection",
    label: "Opciones esperadas o prohibidas",
    rotulo: "Opciones esperadas o prohibidas",
    ejemploCorto: "No marcó la opción que debía marcar",
    descripcion: "Se marca cuando la respuesta no incluye las opciones esperadas o incluye una prohibida.",
    nVars: 1,
    grupo: "seleccion",
  },
];

export function metaDeTipo(tipo: TipoReglaPropia | null | undefined): TipoMeta | null {
  return TIPOS.find((t) => t.key === tipo) ?? null;
}

/** Las teselas de un grupo: los tipos ocultos solo si son el de la regla que se edita (D-F11). */
export function tiposDelGrupo(grupo: GrupoDeTipo, tipoDeLaRegla: TipoReglaPropia | null): TipoMeta[] {
  return TIPOS.filter((t) => t.grupo === grupo && (!t.legacyHidden || t.key === tipoDeLaRegla));
}

/** Cuántas preguntas admite el tipo, como [mínimo, máximo]. */
export function rangoDePreguntas(meta: TipoMeta): [number, number] {
  return typeof meta.nVars === "number" ? [meta.nVars, meta.nVars] : meta.nVars;
}
