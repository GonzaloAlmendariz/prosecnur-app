/**
 * La ficha de UN curso-horario, buscada por su código.
 *
 * Gonzalo la pidió el 2026-09-09: «una pestaña que nos permita consultar por CH
 * o R, es decir por códigos, el estado de un curso-horario: si está aplicado, si
 * no, la efectividad que obtuvo, la planificada, los elegibles esperados, los
 * elegibles obtenidos, etc».
 *
 * **La base es `agenda` y no `course_status`.** `course_status` llega topeado a
 * 500 filas de las 1 392 del plan, así que dos de cada tres códigos no estarían;
 * en una pantalla cuya única función es encontrar UN código, no hallarlo se lee
 * como «no existe». Comprobado campo por campo sobre CH 43: donde las dos
 * fuentes coinciden dan lo mismo (elegibles 50, esperadas 23,7, válidas 16,
 * brecha 8), así que `agenda` no pierde nada y cubre el plan entero.
 *
 * **`tasa_efectividad_aula` es la PREVISTA, pese al nombre.** Vale 0,473 para
 * CH 43, que es exactamente su `tasa_prevista` en `dos_tasas`. La OBTENIDA no
 * viaja: se calcula, `respuestas_validas / eligible_n`. Confundirlas haría que
 * la ficha publicara la tasa del diseño como si fuera un resultado del campo,
 * que es el defecto que ya hubo que reparar en la columna «Prevista de su
 * facultad».
 *
 * **El estado se deriva de la EVIDENCIA, no de `operational_status`.** Ese campo
 * dice «planificada» en las 174 filas del plan mientras hay cursos-horario
 * aplicados, y ya obligó a reparar `dos_tasas` (`531369a2`). `application_status`
 * tampoco sirve solo: marca 7 aplicadas cuando el operativo lleva 9, porque sólo
 * cuenta las que tienen parte de campo.
 */

import { fmt } from "./kpisDeAulas";

export type EstadoDeCursoHorario =
  | "aplicado" | "agendado" | "sin_agendar" | "retirado";

export type FichaDeCursoHorario = {
  codigo: string;
  /** «Titular», «Reserva de cadena», «Reserva adicional». */
  rol: string;
  estado: EstadoDeCursoHorario;
  /** El literal del plan, para no esconder lo que dice la fuente. */
  estadoOperativo: string;
  facultad: string;
  curso: string;
  seccion: string;
  docente: string;
  responsable: string;
  local: string;
  fecha: string;
  hora: string;
  /** A quién reemplaza y en qué orden de la cadena. */
  reemplazaA: string;
  ordenEnLaCadena: number | null;
  /** Aforo del plan: los alumnos que el curso-horario puede aportar. */
  elegibles: number | null;
  /** Los que de verdad estaban en el aula, del parte de campo. */
  asistentes: number | null;
  /** Lo que el diseño pedía de este curso-horario. */
  efectivasEsperadas: number | null;
  /** Lo que llegó a la plataforma y pasó los filtros. */
  efectivasObtenidas: number | null;
  /** Lo que anotó el parte de campo, que puede no coincidir. */
  efectivasDelParte: number | null;
  /** La del diseño, en tanto por uno. */
  efectividadPrevista: number | null;
  /** Calculada: efectivas de plataforma sobre elegibles. `null` si no aplica. */
  efectividadObtenida: number | null;
  /** La prevista de su facultad, para situar la del curso-horario. */
  efectividadDeSuFacultad: number | null;
  brecha: number | null;
  /** El veredicto de la banda, cuando el motor lo trazó. */
  senal: string | null;
  enlace: string;
};

function texto(x: unknown): string {
  return typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim();
}

function numeroONulo(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * «ch43», «CH 43», «ch-43» y «43» tienen que encontrar CH 43.
 *
 * Los códigos se teclean como se recuerdan, no como los escribe el plan. Sin
 * normalizar, la pantalla diría «no existe» a un código que sí existe, que es el
 * peor fallo posible en un buscador.
 */
export function claveDeBusqueda(valor: unknown): string {
  return texto(valor).toUpperCase().replace(/[\s._-]+/g, "");
}

/** Los tres roles del plan, dichos en palabras. */
export function rolEnPalabras(valor: unknown): string {
  const rol = texto(valor);
  if (!rol || rol === "titular") return "Titular";
  if (rol === "chain_reserve") return "Reserva de cadena";
  if (rol === "extra_reserve_pool") return "Reserva adicional";
  return rol;
}

const ESTADOS_MUERTOS = new Set(["reemplazada", "cancelada", "sin_acceso", "rechazo"]);

export function fichaDeCursoHorario(
  fila: Record<string, unknown>,
  parte?: Record<string, unknown>,
  banda?: Record<string, unknown>,
): FichaDeCursoHorario {
  const elegibles = numeroONulo(fila.eligible_n);
  const validas = numeroONulo(fila.respuestas_validas);
  const delParte = numeroONulo(parte?.effective_surveys);

  // La MISMA regla que `dos_tasas` usa para decidir si un curso-horario se
  // aplicó de hecho: la plataforma primero, el parte como respaldo.
  const aplicado = (validas ?? 0) > 0 || (delParte ?? 0) > 0;
  const estadoOperativo = texto(fila.operational_status) || texto(fila.sample_status);
  const muerto = ESTADOS_MUERTOS.has(estadoOperativo) || ESTADOS_MUERTOS.has(texto(fila.sample_status));
  const fecha = texto(fila.scheduled_date) || texto(fila.fecha);

  const estado: EstadoDeCursoHorario = aplicado
    ? "aplicado"
    // Un retirado que YA aplicó sigue contando lo que trajo: se mira después.
    : muerto ? "retirado" : fecha ? "agendado" : "sin_agendar";

  return {
    codigo: texto(fila.operational_code),
    rol: rolEnPalabras(fila.sample_role),
    estado,
    estadoOperativo: estadoOperativo || "sin declarar",
    facultad: texto(fila.faculty),
    curso: texto(fila.course_name),
    seccion: texto(fila.section),
    docente: texto(fila.teacher),
    responsable: texto(parte?.applied_by) || texto(fila.responsible),
    local: texto(parte?.actual_room) || texto(fila.scheduled_venue) || texto(fila.venue),
    fecha,
    hora: texto(fila.scheduled_time),
    reemplazaA: texto(fila.replacement_for) || texto(fila.titular_operational_code),
    ordenEnLaCadena: numeroONulo(fila.replacement_order),
    elegibles,
    asistentes: numeroONulo(parte?.observed_students),
    efectivasEsperadas: numeroONulo(fila.expected_valid),
    efectivasObtenidas: validas,
    efectivasDelParte: delParte,
    // Se LEE, no se calcula: es la tasa con la que el diseño dimensionó.
    efectividadPrevista: numeroONulo(fila.tasa_efectividad_aula),
    // Se CALCULA, y sólo si aplicó y hay aforo: sin eso sería un cero que
    // parece un resultado del campo cuando el campo no ha pasado por ahí.
    efectividadObtenida:
      aplicado && elegibles && elegibles > 0 && validas != null ? validas / elegibles : null,
    efectividadDeSuFacultad: numeroONulo(fila.tasa_facultad),
    brecha: numeroONulo(fila.brecha),
    senal: banda ? texto(banda.senal) || null : null,
    enlace: texto(fila.link),
  };
}

/**
 * Busca por código sobre el plan entero.
 *
 * Devuelve TODAS las coincidencias, no la primera: quien teclea «R 1» quiere ver
 * la cadena de reservas de ese titular, y quedarse con una escondería el resto.
 */
export function buscarCursosHorario(
  agenda: ReadonlyArray<Record<string, unknown>>,
  consulta: string,
  tope = 25,
): Array<Record<string, unknown>> {
  const clave = claveDeBusqueda(consulta);
  if (!clave) return [];
  const exactas: Array<Record<string, unknown>> = [];
  const parciales: Array<Record<string, unknown>> = [];
  for (const fila of agenda) {
    const codigo = claveDeBusqueda(fila.operational_code);
    if (!codigo) continue;
    // La exacta primero: tecleando «CH 4» completo se quiere CH 4, no CH 40.
    if (codigo === clave) exactas.push(fila);
    else if (codigo.includes(clave)) parciales.push(fila);
  }
  return [...exactas, ...parciales].slice(0, Math.max(1, tope));
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/**
 * «martes 8 de setiembre» desde un `YYYY-MM-DD`.
 *
 * **Sin pasar por `new Date(texto)`**: la especificación parsea un `YYYY-MM-DD`
 * pelado como medianoche UTC y `toLocaleDateString` lo devuelve al huso del
 * lector, así que en Lima —UTC−5— el 2026-09-05 sale como 4/9. El perfil ya
 * tropezó con eso y lo dejó escrito en `kpisDeAulas.ts:167`. Aquí se arma con
 * `Date.UTC` sólo para saber el día de la semana, que es lo único que no se
 * puede leer de los tres números.
 */
export function fechaEnPalabras(iso: unknown): string {
  const t = typeof iso === "string" ? iso.trim() : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return t;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  const nombreMes = MESES[mes - 1];
  if (!nombreMes || Number.isNaN(d.getTime())) return t;
  // `fmt` también para el día del mes: el guard `cifrasConFormato` pide que
  // TODA cifra visible pase por el formateador del perfil, y tiene razón como
  // regla —no hay excepciones «pequeñas», sólo cifras que un día crecen—.
  return `${DIAS[d.getUTCDay()]} ${fmt(dia)} de ${nombreMes}`;
}

/**
 * La frase que contesta «¿y para cuándo?».
 *
 * Gonzalo, viendo la ficha: «si está agendada para cuándo? no se explica eso».
 * La ficha enseñaba el chip AGENDADO y, tres centímetros más allá y sin rótulo,
 * un `2026-09-08` crudo y un `6:45 pm`: los datos estaban y la frase no. Un
 * estado sin su fecha obliga a buscar, y una fecha ISO sin su día de la semana
 * no dice si eso ya pasó.
 */
export function cuandoEnPalabras(
  estado: EstadoDeCursoHorario, fecha: unknown, hora: unknown,
): string {
  const dia = fechaEnPalabras(fecha);
  const h = typeof hora === "string" ? hora.trim() : "";
  const cuando = dia ? `${dia}${h ? `, ${h}` : ""}` : "";
  if (estado === "aplicado") return cuando ? `Se aplicó el ${cuando}` : "Aplicado, sin fecha registrada";
  if (estado === "agendado") return cuando ? `Agendado para el ${cuando}` : "Agendado, sin fecha registrada";
  if (estado === "retirado") return cuando ? `Retirado del plan · tenía fecha el ${cuando}` : "Retirado del plan";
  return "Todavía sin fecha en la agenda";
}
