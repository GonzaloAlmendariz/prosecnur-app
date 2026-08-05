/**
 * Cómo se leen los VALORES de las columnas que calcula el marco.
 *
 * G47 · Gonzalo: «las variables que calcula el marco no se están viendo del todo
 * bien en algunas categorías; por ejemplo el motivo de exclusión no es una
 * categoría que se vea muy elegante, se ve muy técnica. Hay que perfeccionar las
 * etiquetas tanto del nombre de la variable como de sus opciones».
 *
 * G43 tradujo los NOMBRES de columna y dejó los valores como los escribe el
 * motor. En una columna del archivo eso es lo correcto —el valor es del usuario
 * y se enseña tal cual— pero en una derivada el valor también es del motor:
 *
 *     min_eligible_per_class|modality|session_type|enrolled_total|min_eligible
 *
 * Eso no es una categoría, es el registro interno de qué filtros tumbaron ese
 * curso-horario. Aquí se traduce, conservando el crudo en el `title` para poder
 * volver al dato.
 *
 * Regla que no se cruza: esto SÓLO se aplica a columnas derivadas. Traducir los
 * valores de una columna del archivo sería reescribir la base del usuario.
 */

/** Motivos de exclusión: el motor los concatena con `|` cuando hay varios. */
const MOTIVOS: Record<string, string> = {
  min_eligible: "Mínimo de alumnos elegibles",
  // El filtro legacy de la configuración, distinto del criterio por facultad:
  // aparecen juntos y con el mismo nombre eran indistinguibles.
  min_eligible_per_class: "Mínimo por aula (filtro base)",
  modality: "Modalidad",
  session_type: "Tipo de sesión",
  teacher_type: "Tipo de docente",
  condicion_curso: "Condición del curso",
  course_level: "Nivel del curso",
  campus: "Sede",
  enrolled_total: "Matriculados",
  c7: "Prevalencia de elegibles",
  c8: "Mismo nivel del curso",
  c8_facultad: "Misma facultad del curso",
  manual: "Exclusión manual",
  manual_excluded: "Exclusión manual",
  faculty: "Facultad del estudiante",
  formation: "Formación",
  condition: "Condición de matrícula",
  age: "Edad",
  level: "Ciclo o nivel del estudiante",
};

/** Valores de una sola pieza, por columna. */
const POR_COLUMNA: Record<string, Record<string, string>> = {
  included: { true: "Entra al marco", false: "Queda fuera" },
  level_reference: {
    curso: "Nivel declarado del curso",
    modal: "Nivel más frecuente del aula",
  },
  size_group: {
    g1: "Tramo 1 · los más pequeños",
    g2: "Tramo 2",
    g3: "Tramo 3",
    g4: "Tramo 4 · los más grandes",
  },
  sex_top_1: { f: "Femenino", m: "Masculino" },
  sex_top_2: { f: "Femenino", m: "Masculino" },
};

/**
 * Un valor en `snake_case` sin espacios delata una clave normalizada del motor
 * —`docente_contratado_contratado`, `estudios_generales_letras`— y se lee mejor
 * con espacios y mayúscula inicial. Los valores del archivo no pasan por aquí,
 * así que no hay riesgo de "corregir" un dato que el usuario escribió así.
 */
function humanizarClave(valor: string): string | null {
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(valor)) return null;
  const texto = valor.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Etiqueta legible de un valor. Devuelve `null` cuando no hay nada mejor que el
 * crudo: quien llama conserva el original en vez de recibir una copia.
 */
export function etiquetaDeValor(columna: string, valor: string): string | null {
  const bruto = valor.trim();
  if (!bruto) return null;

  if (columna === "exclude_reason") {
    const piezas = bruto.split("|").map((pieza) => pieza.trim()).filter(Boolean);
    if (!piezas.length) return null;
    const traducidas = piezas.map((pieza) => MOTIVOS[pieza] ?? humanizarClave(pieza) ?? pieza);
    // Con varios motivos el separador es un punto medio: el `|` del motor se
    // lee como parte del código, no como «y además».
    return traducidas.join(" · ");
  }

  const tabla = POR_COLUMNA[columna];
  const directa = tabla?.[bruto.toLowerCase()];
  if (directa) return directa;

  return humanizarClave(bruto);
}
