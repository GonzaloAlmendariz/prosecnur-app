const FIELD_LABELS: Record<string, string> = {
  // Ciclo de contacto (L31): por que un aula no esta agendada todavia.
  contact_medium: "Medio de contacto",
  contact_date: "Fecha de llamada",
  contact_attempts: "Número de intentos",
  scheduled_date: "Fecha agendada",
  scheduled_day: "Día",
  scheduled_time: "Hora",
  // Parte de campo (L32/L45): lo que el equipo anota en el aula.
  actual_room: "Aula real",
  // `CANTIDAD DE ASISTENTES` en el libro; el registro ya lo dice así.
  observed_students: "Cantidad de asistentes",
  applied_surveys: "Encuestas aplicadas",
  // `CANTIDAD DE EFECTIVAS`: el número que manda en el parte de campo.
  effective_surveys: "Cantidad de efectivas",
  // `CANTIDAD DE RECHAZOS`.
  refusals: "Cantidad de rechazos",
  // Las dos columnas de la resta, que el libro NO trae: las calcula el motor
  // con la identidad asistentes − rechazos − duplicados = efectivas.
  esperado: "Efectivas que implican",
  diferencia: "Diferencia",
  // `DUPLICADOS (YA RESPONDIERON)`, con el paréntesis del propio Excel.
  duplicates: "Duplicados (ya respondieron)",
  application_status: "Estado de aplicación",
  applied_at: "Aplicada el",
  // El parte trae la fecha y la hora SEPARADAS —son dos columnas de su hoja— y
  // ademas `applied_at`, que es la marca compuesta. Sin etiqueta propia,
  // `applied_date` llegaba a la tabla como jerga en cuanto se pidio mostrarla.
  applied_date: "Fecha de aplicación",
  applied_time: "Hora de aplicación",
  applied_by: "Aplicada por",
  field_note: "Nota de campo",
  // Por qué esta fila está en la cadena. Lo compone el motor a partir del campo
  // que corresponde al papel de la fila: la que cae lleva su motivo de
  // reemplazo y la que entra el de activación. Un solo rótulo porque es una
  // sola pregunta.
  motivo: "Motivo",
  // Activación de reemplazos (L5/L49).
  activated_at: "Activada el",
  activation_reason: "Motivo de activación",
  replaced_at: "Reemplazada el",
  // Composición de la muestra: el dato que el libro NO trae (L67).
  sex_top_1: "Sexo mayoritario",
  sex_top_1_n: "Estudiantes del sexo mayoritario",
  sex_top_2: "Sexo minoritario",
  sex_top_2_n: "Estudiantes del sexo minoritario",
  enrolled_total: "Matriculados total DTI",
  size_group: "Tamaño de aula",
  modality: "Modalidad",
  session_type: "Tipo de sesión",
  // «Base de control» (L29): el control de calidad por aula. Ninguno de estos
  // campos tenía rótulo porque ninguno llegaba a una pantalla — se leían del
  // libro y morían en la sesión. Los nombres son los de la hoja, incluidos los
  // dos que el equipo escribe como código: `70T` y `70P` son los umbrales del
  // 70 % contra cada denominador, y así los pide en voz alta.
  room: "Aula",
  sent_total: "Total enviadas",
  sent_vs_total: "vs Total",
  sent_vs_population: "vs Población",
  validator_1: "Validador 1",
  validator_2: "Validador 2",
  validator_3: "Validador 3",
  short_total: "Total cortas",
  short_vs_total: "Cortas vs total",
  long_total: "Total largas",
  long_vs_total: "Largas vs total",
  threshold_total: "70T",
  threshold_population: "70P",
  valid_total: "Válido total",
  valid_population: "Válido población",
  // Las que sustituyeron a `70T`/`70P` en la hoja: el umbral dejo de ser dos
  // banderas de sí/no y pasó a ser lo esperado contra lo obtenido. Los rótulos
  // dicen de dónde sale cada mitad, que es lo que las hace comparables.
  // El rótulo tiene que DECIR algo: el contrato rechaza los que son el nombre
  // del campo con espacios, porque eso no es traducir, es disimular. «Meta de
  // efectivas» dice de dónde sale la cifra; «Efectivas esperadas» sólo repite
  // el identificador en castellano.
  efectivas_esperadas: "Meta de efectivas del aula",
  efectivas_obtenidas: "Efectivas que llegaron",
  efectivas_pct_esperado: "% de efectivas esperado",
  efectivas_pct_obtenido: "% de efectivas logrado",
  efectivas_brecha: "Efectivas: cuánto falta",
  elegibles_esperados: "Elegibles del padrón",
  mujeres_esperadas: "Mujeres que espera el aula",
  hombres_esperados: "Hombres que espera el aula",
  last_response_day: "Último día de respuesta",
  non_respondents: "Asistentes que no respondieron",
  attendance_pct: "% Asistencia",
  // El unico `_pct` del mapa que no llevaba su «%», y ademas pegado a
  // «Faltantes cuota», que si es un conteo: la cabecera «Cuota» se lee como la
  // cuota del curso y lo que hay debajo es la parte de ella que ya se consiguio.
  quota_pct: "% Cuota",
  quota_missing: "Faltantes cuota",
  women_n: "N.º mujeres",
  men_n: "N.º hombres",
  women_pct: "% Mujeres",
  men_pct: "% Hombres",
  schedule_norm: "Norm - horario",
  schedule_range: "Rango - horario",
  // Trazabilidad y diseño muestral.
  collection_unit_id: "ID de unidad de recolección",
  selection_run_id: "Corrida de selección",
  pi_final: "Probabilidad de selección",
  probability_source: "Origen de la probabilidad",
  weight_classroom: "Peso del aula",
  weight_student: "Peso del estudiante",
  nonresponse_policy: "Política de no respuesta",
  representativity_score: "Puntaje de representatividad",
  representativity_distance: "Distancia de representatividad",
  methodological_warning: "Advertencia metodológica",
  teacher_phone: "Teléfono de docente",
  // El Excel llama `CURSO-HORARIO` al CÓDIGO y `SESIONES Y AULA` al texto
  // descriptivo. Yo los tenía cruzados: el código salía como «Código de ficha»
  // —que en realidad es el material QR— y el descriptivo se quedaba con
  // «Curso-horario». Con los nombres del equipo cada columna dice lo suyo.
  operational_code: "Curso-horario",
  titular_operational_code: "Código titular",
  replacement_chain_code: "Cadena de reemplazo",
  operational_sequence: "Secuencia operativa",
  selection_slot_id: "Posición de muestra",
  sample_role: "Rol de muestra",
  // Cuál de los eslabones de la cadena está cubriendo el slot ahora mismo. Es
  // la pregunta con la que se decide a quién visitar —«CH 5 no se pudo, entra
  // R 5.1»— y sin etiqueta llegaba a la pantalla como `en_juego`.
  en_juego: "En juego",
  // `STATUS MUESTRA` en «Aulas Agendadas»: AGENDADA · REAGENDADA · EN RESERVA n
  // · REEMPLAZADA. El rótulo es la columna.
  sample_status: "Status de muestra",
  // La columna que dice qué hacer, no qué pasa. Patrón 7 del catálogo: la tabla
  // de Cálculo termina en «A coordinar» por la misma razón.
  que_toca: "Qué toca",
  // `MUESTRA` es como el Excel rotula la ola (M1, M2). Se usa su palabra
  // aunque «muestra» tambien nombre el diseño: es la que lee el equipo.
  wave: "Muestra",
  replacement_order: "Orden en la cadena",
  orden: "Orden",
  classroom_id: "ID de curso-horario",
  label: "Sesiones y aula",
  course_id: "ID de curso",
  course_name: "Nombre del curso",
  section: "Sección",
  schedule: "Horario",
  teacher: "Nombre de docente",
  teacher_email: "Correo PUCP docente",
  faculty: "Facultad",
  program: "Carrera",
  level: "Nivel del curso",
  stratum: "Estrato",
  eligible_n: "Matriculados población",
  expected_valid: "Válidas esperadas",
  link: "Enlace de la ficha",
  qr: "Código QR",
  word_link: "Ficha Word",
  pdf_link: "Ficha PDF",
  package_label: "Etiqueta de ficha",
  package_status: "Estado de ficha",
  collector_id: "Origen",
  responsible: "Responsable",
  // Se queda: `operational_status` es el estado que deriva el motor —planificada,
  // contactada, en campo…— y no hay columna del Excel que lo nombre. `STATUS
  // MUESTRA` ya está usado por `sample_status`, que es el otro eje (L30).
  operational_status: "Estado operativo",
  replacement_for: "Reemplaza a",
  replacement_reason: "Motivo de reemplazo",
  replacement_note: "Nota de reemplazo",
  equivalence_level: "Nivel de equivalencia",
  chain_score: "Puntaje de cadena",
  chain_depth: "Profundidad de cadena",
  activation_weight_status: "Estado de ponderación",
  analysis_weight_warning: "Advertencia de ponderación",
  updated_at: "Actualizado",
  responses_total: "Respuestas totales",
  // NO se traduce a «efectivas» aunque suene parecido: las válidas las cuenta
  // el sistema sobre lo que llegó de Kobo y las efectivas las cuenta el
  // encuestador en el aula. Que no cuadren es justo lo que detecta el cuadre del
  // parte (L33), así que llamarlas igual borraría la comparación.
  respuestas_validas: "Respuestas válidas",
  filter_passed: "Filtros aprobados",
  filter_rejected: "Filtros rechazados",
  brecha: "Brecha",
  // `STATUS DE APLICACIÓN` en «Aulas Aplicadas (Campo)».
  application_state: "Status de aplicación",
  aulas: "Cursos-horario",
  aulas_aplicadas: "Cursos-horario aplicados",
  avance_aulas_pct: "Avance de cursos-horario",
  avance_respuestas_pct: "Avance de respuestas",
  sex: "Sexo",
  target: "Meta",
  frame_n: "Universo",
  source: "Fuente",
  observed: "Observadas",
  missing: "Faltantes",
  // Entre META, OBSERVADAS y FALTANTES —los tres conteos— un «Avance» a secas
  // se lee como uno más. Lleva su «%» como el resto de columnas de porcentaje.
  progress_pct: "% Avance",
  check: "Control",
  status: "Estado",
  detail: "Detalle",
  campo: "Campo",
  valor: "Valor",
  corrida: "Corrida",
  marco: "Marco",
  anonimas: "Respuestas anónimas",
  generado: "Generado",
};

const CHECK_LABELS: Record<string, string> = {
  anonymous_responses: "Respuestas anónimas",
  // Antes «Identificador estudiantil no requerido», que describía una POLÍTICA
  // del estudio y no lo que la regla mira. El control ahora comprueba lo
  // contrario y serio: si la base arrastra correo, celular, documento o nombre.
  personal_identifiers: "Identificadores personales en la base",
  unmapped_valid_responses: "Respuestas válidas sin curso-horario",
  // `duplicate_collectors` se retiró: en un estudio de aulas el mismo QR lo
  // escanean todos los alumnos, así que el colector se repite por diseño y ese
  // aviso saltaba siempre. Lo anómalo es la misma respuesta dos veces.
  duplicate_responses: "Respuestas repetidas",
  // El Excel no comprueba que asistentes − rechazos − duplicados cuadre con las
  // efectivas; la app sí.
  field_report_reconciliation: "Cuadre del parte de campo",
  // Distinto del de arriba, y por eso el nombre dice ENTRE QUÉ: aquél cuadra la
  // aritmética dentro del parte y éste compara el parte con la Base de control.
  book_sheets_cross_check: "Cuadre entre las dos hojas",
  // El lector no adivina qué es una columna sin nombre —sería peor—, pero sí
  // dice cuántas se quedaron fuera.
  unnamed_control_columns: "Columnas sin nombre en la Base de control",
  // El rotulo nombra la CONSECUENCIA y no el mecanismo: «Estados no
  // reconocidos» obliga a abrir el detalle para saber si eso importa.
  unknown_sample_status: "Aulas contadas como sin contactar sin estarlo",
  effective_representativity: "Representatividad efectiva",
  sex_faculty_quota: "Cuota por sexo y facultad",
  // Qué se está contando como respuesta válida. Se resolvía en silencio, y
  // contar TODO o filtrar por una columna equivocada dan números muy distintos.
  valid_response_criterion: "Criterio de respuesta válida",
};

/**
 * El rótulo de un valor de estado, por su clave.
 *
 * OJO: para las claves de `application_state` hay un SEGUNDO juego de rótulos en
 * `TRAMOS_DE_APLICACION` —`lista` es «Lista» acá y «Agendada» allá, `pendiente`
 * es «Pendiente» y «Sin agendar», `cerrando` «Cierre en curso» y «Cumple»,
 * `en_aplicacion` «En aplicación» y «Aplicada»—. No están alineados a propósito:
 * la franja por día habla de la aplicación y la tabla convive con una columna
 * `sample_status` que ya usa «Agendada», así que unificar los nombres crearía
 * una palabra con dos significados en la MISMA fila. Lo que sí tiene que ser
 * único es el COLOR, y de eso se encarga `colorDeEstado`, que resuelve los dos
 * juegos al mismo tramo.
 */
export const STATUS_LABELS: Record<string, string> = {
  ok: "Correcto",
  review: "Revisar",
  warning: "Advertencia",
  /**
   * **«No se puede comprobar» no es «correcto».**
   *
   * Un control sin los datos para ejecutarse se contaba como `ok`, así que la
   * pantalla decía «6 correctos» donde uno de los seis declaraba en su propio
   * texto que no había podido comprobarse. Es el «verde por AUSENCIA» que el
   * Contrato de Superficie prohíbe, cometido dentro de la lista de validación.
   */
  sin_datos: "Sin comprobar",
  planificada: "Planificada",
  contactada: "Contactada",
  agendada: "Agendada",
  en_campo: "En campo",
  aplicada: "Aplicada",
  parcial: "Parcial",
  sin_acceso: "Sin acceso",
  cancelada: "Cancelada",
  reemplazo_pendiente: "Reemplazo pendiente",
  reemplazada: "Reemplazada",
  cerrada: "Cerrada",
  cerrando: "Cierre en curso",
  en_aplicacion: "En aplicación",
  lista: "Lista",
  pendiente: "Pendiente",
  cumplida: "Cumplida",
  en_riesgo: "En riesgo",
  sin_meta: "Sin meta",
  titular: "Titular",
  chain_reserve: "Reserva encadenada",
  extra_reserve_pool: "Reserva adicional",
  pdf_preparado: "PDF preparado",
  listo_para_pdf: "Listo para PDF",
  pendiente_enlace: "Falta enlace",
  plan_sex_top: "Plan por sexo",
  calc_muestra_faculty_sex: "Cálculo de muestra",
};

function normalizedKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function fallbackLabel(value: string) {
  const label = value.replaceAll("_", " ").trim();
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : value;
}

/**
 * El detalle de un control, con el vocabulario de la casa.
 *
 * Exportado porque la tabla ya no es el único consumidor: los controles de
 * Validación se leen como avisos y necesitan la misma traducción. Pintarlos sin
 * pasar por aquí devolvía «El tablero agrega por aula/collector/link» a la
 * pantalla, que es justo la jerga del motor que este helper existe para tapar.
 */
export function presentDetail(value: unknown) {
  return String(value ?? "")
    .replaceAll("aula/collector/link", "curso-horario, origen y enlace")
    .replaceAll("Score efectivo", "Puntaje efectivo")
    .replace(/\bsexo\s+x\s+facultad\b/gi, "sexo por facultad");
}

/**
 * Por qué cae un aula, en el idioma del equipo.
 *
 * Vivía dentro de `RegistroDeCampo`, que es quien la ofrece en un select, y por
 * eso la tabla de la cadena no la alcanzaba: mostraba `docente_no_autoriza` en
 * crudo. La jerga del motor no viaja a la pantalla, y una lista de vocabulario
 * con dos dueños termina divergiendo —ya pasó con los tramos de aplicación—.
 *
 * Los valores son los de `monitoreo_aulas_motivos_reemplazo()` en R: si el
 * motor añade uno, aquí sale su clave cruda y se ve que falta el rótulo.
 */
/**
 * Los estados operativos de un aula, con su rótulo.
 *
 * El vocabulario es el del motor (`monitoreo_aulas_estados()`), traducido una
 * sola vez. La clave viaja; la etiqueta se queda en la pantalla.
 *
 * Vive acá y no en `RegistroDeCampo`, que era donde estaba: ahí sólo servía al
 * select del registro, y la tabla que pinta esa misma columna no lo alcanzaba.
 */
export const ESTADOS_OPERATIVOS: Array<{ value: string; label: string }> = [
  { value: "planificada", label: "Planificada" },
  { value: "contactada", label: "Contactada" },
  { value: "agendada", label: "Agendada" },
  { value: "en_campo", label: "En campo" },
  { value: "aplicada", label: "Aplicada" },
  { value: "parcial", label: "Parcial" },
  { value: "sin_acceso", label: "Sin acceso" },
  { value: "cancelada", label: "Cancelada" },
  { value: "reemplazo_pendiente", label: "Reemplazo pendiente" },
  { value: "reemplazada", label: "Reemplazada" },
  { value: "cerrada", label: "Cerrada" },
];

export const MOTIVOS_DE_REEMPLAZO: Array<{ value: string; label: string }> = [
  { value: "docente_no_autoriza", label: "El docente no autoriza" },
  { value: "aula_no_existe", label: "El aula no existe" },
  { value: "horario_cambio", label: "Cambió el horario" },
  { value: "virtual_no_presencial", label: "Es virtual, no presencial" },
  { value: "baja_asistencia", label: "Muy baja asistencia" },
  { value: "cruce_logistico", label: "Cruce logístico" },
  { value: "aula_ya_aplicada", label: "El aula ya se aplicó" },
  { value: "incidencia_etica", label: "Incidencia ética" },
  { value: "otro", label: "Otro" },
];

const MOTIVO_LABELS: Record<string, string> = Object.fromEntries(
  MOTIVOS_DE_REEMPLAZO.map((m) => [m.value, m.label]),
);

export function aulasMotivoLabel(motivo: unknown) {
  const key = normalizedKey(motivo);
  if (!key) return "";
  return MOTIVO_LABELS[key] ?? fallbackLabel(String(motivo));
}

export function aulasFieldLabel(field: string) {
  return FIELD_LABELS[field] ?? fallbackLabel(field);
}

export function aulasCheckLabel(check: unknown) {
  const key = normalizedKey(check);
  return CHECK_LABELS[key] ?? fallbackLabel(String(check ?? ""));
}

/**
 * El nombre de un estado.
 *
 * Un estado VACÍO ya no dice «Por revisar». Decía eso, y a dos renglones de
 * distancia el estado `review` de un control dice «Revisar»: la misma palabra
 * para un hallazgo del control y para la ausencia de dato, que son lo contrario
 * uno del otro. Medido sobre el operativo: las 196 aulas mostraban «Estado de
 * ficha: Por revisar» con `package_status` vacío en las 196 —no había ninguna
 * ficha que revisar—.
 *
 * Un guion largo no es un hueco: es la forma en que una tabla dice «aquí no hay
 * dato» sin fingir que lo hay.
 */
export function aulasStatusLabel(status: unknown) {
  const key = normalizedKey(status);
  return STATUS_LABELS[key] ?? (key ? fallbackLabel(String(status)) : "—");
}

/**
 * Compara dos códigos de curso-horario como los lee el ojo.
 *
 * `localeCompare` a secas ordena «CH 10» ANTES que «CH 2», porque compara
 * carácter a carácter, y así se veían las 24 cadenas en pantalla: CH 2, CH 10,
 * CH 11 … CH 24, CH 5, CH 6. Un desorden sin explicación posible para quien lo
 * lee, porque el código lleva un número dentro y se lee como número.
 *
 * `numeric: true` es exactamente esta regla y además resuelve las reservas
 * encadenadas —`R 4.1` antes que `R 4.2`— sin partir la cadena a mano.
 * Cualquier lista del perfil que desempate por código usa ESTE comparador; el
 * motor hace lo mismo en `monitoreo_aulas_orden_codigo()`.
 */
export function comparaCodigos(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

/**
 * Las columnas del libro que son una PROPORCIÓN, y sólo ésas.
 *
 * La lista es cerrada a propósito. Deducir «esto parece un porcentaje» del
 * dato acabaría formateando lo que no lo es: en la Base de control conviven
 * `threshold_total` y `threshold_population` —que son NÚMEROS DE ENCUESTAS,
 * medidos entre 8 y 34— y `valid_total` / `valid_population`, que son
 * veredictos 0/1 y se leerían como «0 %» y «100 %». Sólo entra lo que el Excel
 * declara como razón entre dos cantidades.
 *
 * `attendance_pct` está en las dos hojas —el parte y el control— con el mismo
 * significado, así que una sola entrada cubre las dos tablas.
 */
const COLUMNAS_DE_PORCENTAJE = new Set([
  "sent_vs_total",
  "sent_vs_population",
  "short_vs_total",
  "long_vs_total",
  "attendance_pct",
  "quota_pct",
  "women_pct",
  "men_pct",
  // De la tabla de cuotas, y el motor ya la calcula en 0-100. Entra igual: lo
  // que la lista decide es que la columna ES un porcentaje, no en qué escala
  // viene. Sin ella, «Avance» enseñaba «62.3» a secas.
  "progress_pct",
]);

/**
 * En qué escala viene cada columna de proporción, decidido sobre la COLUMNA
 * ENTERA y no valor a valor.
 *
 * El motor no recalcula lo que el Excel calcula, y el libro real puede traer
 * estas razones en 0-1 o ya en 0-100 —está anotado en `monitoreo_aulas_control.R`
 * que esa escala no se pudo medir sin un libro lleno—. Así que la escala se
 * detecta, pero por columna: una regla por valor rompería justo donde importa,
 * porque una cobertura del 108 % (`sent_vs_population` llega a 1,083 en el
 * fixture) pasaría de `1,083` a «1,1 %» mientras su vecina de 0,98 se pinta
 * «98 %». El corte en 1,5 y no en 1 deja pasar esos excedentes: una columna
 * escrita en 0-100 donde TODAS las aulas estuvieran por debajo del 1,5 % no
 * describe ningún operativo.
 */
export function escalaDeProporciones(
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): Set<string> {
  const enProporcion = new Set<string>();
  for (const columna of COLUMNAS_DE_PORCENTAJE) {
    const valores: number[] = [];
    for (const row of rows) {
      const n = Number(row[columna]);
      if (Number.isFinite(n)) valores.push(Math.abs(n));
    }
    if (!valores.length) continue;
    // La MEDIANA, no el máximo. Con el máximo, una sola fila que se pasa de su
    // meta —23 conseguidas de 21 pedidas, 1.095— no cambiaba nada, pero una que
    // duplicara la cuota tumbaba la columna ENTERA a «0.8 %» en vez de «80 %».
    // Y pasarse de la meta es normal: `% Cuota` es lo conseguido sobre lo que el
    // plan pide, así que puede superar el 100 %.
    //
    // Las dos escalas se separan por el grueso de la columna, no por su tope:
    // una que viene en 0-1 tiene mediana bajo 1, y una que ya viene en 0-100 la
    // tiene en las decenas. La distancia entre las dos es enorme; la del máximo
    // la decidía un solo dato.
    valores.sort((x, y) => x - y);
    const medio = Math.floor(valores.length / 2);
    const mediana = valores.length % 2
      ? valores[medio]
      : (valores[medio - 1] + valores[medio]) / 2;
    if (mediana <= 1.5) enProporcion.add(columna);
  }
  return enProporcion;
}

/**
 * Un porcentaje con su signo. Multiplica sólo si la columna venía en 0-1; la
 * que ya está en 0-100 se queda como está y sólo gana la unidad que le falta.
 */
function comoPorcentaje(value: unknown, hayQueEscalar: boolean) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const escalado = hayQueEscalar ? n * 100 : n;
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(escalado)} %`;
}

function presentValue(field: string, value: unknown, enProporcion?: ReadonlySet<string>) {
  if (value == null) return "";
  if (COLUMNAS_DE_PORCENTAJE.has(field)) return comoPorcentaje(value, Boolean(enProporcion?.has(field)));
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (field === "check") return aulasCheckLabel(value);
  if (field === "detail") return presentDetail(value);
  if (field === "campo") return aulasFieldLabel(String(value));
  // Los tres campos de motivo comparten vocabulario: `motivo` lo compone el
  // motor según el papel de la fila, y los otros dos son de dónde lo saca.
  if (field === "motivo" || field === "replacement_reason" || field === "activation_reason") {
    return aulasMotivoLabel(value);
  }
  if (
    field === "status"
    || field.endsWith("_status")
    || field.endsWith("_state")
    || field === "sample_role"
    || field === "source"
  ) {
    return aulasStatusLabel(value);
  }
  if (field === "link") return String(value).trim() ? "Guardado" : "";
  return value;
}

export function presentAulasRow(
  row: Readonly<Record<string, unknown>>,
  enProporcion?: ReadonlySet<string>,
) {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => [field, presentValue(field, value, enProporcion)]),
  );
}

// Tres cifras, no una: un control que NO SE PUDO EJECUTAR no es una alerta
// —no hay nada que corregir— pero tampoco cuenta como regla evaluada. Con dos
// cifras el mismo control caia en el monton equivocado hiciera lo que hiciera:
// contado como alerta prometia trabajo que no existe, y contado aparte del
// total dejaba el tile diciendo «11 reglas evaluadas» cuando se evaluaron 10.
// El desconocido sigue cayendo en `count`, que es donde tiene que hacer ruido.
export function summarizeAulasValidation(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return { label: "Sin controles disponibles", count: 0, sinComprobar: 0, evaluados: 0 };
  const sinComprobar = rows.filter((row) => normalizedKey(row.status) === "sin_datos").length;
  const evaluados = rows.length - sinComprobar;
  const count = rows.filter((row) => {
    const estado = normalizedKey(row.status);
    return estado !== "ok" && estado !== "sin_datos";
  }).length;
  if (!count) return { label: "Sin alertas", count: 0, sinComprobar, evaluados };
  return { label: `${count} ${count === 1 ? "alerta" : "alertas"}`, count, sinComprobar, evaluados };
}
