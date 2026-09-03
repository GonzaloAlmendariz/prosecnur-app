/**
 * Cuántos aplicadores hacen falta a la vez, y cuándo.
 *
 * El curso-horario NO es un instante sino un RANGO —«MAR 14:00-16:00»—, y esa
 * distinción cambia la respuesta: sobre el plan de HSVG 2026, contar por hora de
 * inicio daba un pico de 8 aulas simultáneas; contar el rango real da 19. El
 * número que dimensiona el equipo es el segundo.
 *
 * La ocupación de un aplicador no es la sesión entera: aplica una ventana
 * (`duracionMin`) dentro de la clase. Por eso hay dos curvas distintas:
 * `aulas` es cuántas clases están en curso, `firmes`+`plausibles` cuántas
 * personas están ocupadas.
 *
 * Y hay DOS ESTADOS que no se pueden mezclar en un solo número:
 *
 * - **Firme.** El aula ya se agendó: hay `scheduled_time` y, si el docente lo
 *   acordó, `scheduled_moment`. Ocupa una ventana concreta y se cuenta como un
 *   hecho.
 * - **Plausible.** El aula no se agendó todavía. Lo único que se sabe es el
 *   rango de la clase, y la aplicación puede caer en CUALQUIER punto de él: no
 *   es un instante sino una banda que cubre la clase entera. Aquí no hay
 *   momento que valga —cada docente decidirá el suyo al agendar— así que
 *   suponer que todas entran al inicio, o todas al final, inventa una
 *   coincidencia que no existe. La banda es la clase completa y punto.
 *
 * Por eso la malla devuelve las dos capas por separado y la vista las muestra
 * distinto: «5 confirmados, hasta 7 posibles» dice la verdad; «12» no.
 *
 * ## Los dos ejes
 *
 * El mismo plan admite DOS lecturas, y confundirlas infla el pico:
 *
 * - **`semana`** — seis filas, lunes a sábado. Es el PATRÓN: cada aula cae en el
 *   día de su horario recurrente. Correcto mientras casi nada está agendado,
 *   que es cuando la pregunta es «¿de qué tamaño tiene que ser el equipo?».
 * - **`calendario`** — una fila por FECHA concreta. Las agendadas tienen
 *   `scheduled_date` y el operativo se reparte en varias semanas: sobre el eje
 *   semanal, dos aulas confirmadas para el mismo día de la semana en semanas
 *   distintas caen en la misma celda y suman un pico que nunca ocurre. En 2025
 *   el campo duró varias semanas, así que esto no es un caso de borde.
 *
 * Las que aún no tienen fecha **no se reparten por el calendario**: pintarlas en
 * cada fecha cuyo día de semana coincide multiplicaría una visita por el número
 * de semanas —el mismo error que este eje existe para corregir, al revés— y
 * elegirle una fecha cualquiera sería inventarla. Van a un carril propio, «por
 * agendar», con una fila por día de la semana y su banda de siempre.
 */
import type { MonitoreoAulasFranjas, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { etiquetaDeFecha, fechaIsoReal } from "./agendaPorDia";
import { minutosDeHora } from "./mapaDeHoras";

export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
export type Dia = (typeof DIAS)[number];

const ABREV: Record<string, number> = {
  LUN: 0, MAR: 1, MIE: 2, MIÉ: 2, JUE: 3, VIE: 4, SAB: 5, SÁB: 5,
};

export type Sesion = {
  dia: number;
  desde: number;
  hasta: number;
  salon: string;
  aula: string;
  curso: string;
  facultad: string;
  elegibles: number;
  /** El código operativo («CH 12»), o el identificador del aula si no hay. */
  codigo: string;
  docente: string;
  /** La hora pactada tal como está escrita en el libro («6:45 pm»), o "". */
  horaTexto: string;
};

/**
 * Quién ocupa una celda de la malla: el detalle detrás del número (dictado en
 * vivo 2026-09-02, «cada 30 mins con hover»). `confirmada` distingue el hecho
 * —cita con hora— del techo —banda de la clase—, la misma frontera que las
 * dos capas de color.
 *
 * La cita confirmada viaja con sus tres señas (dictado, mirando el detalle:
 * «no me muestras ni la fecha exacta ni la hora en la que se acordó ir ni qué
 * etapa de la clase es»): la FECHA exacta —clave en el patrón semanal, donde
 * la fila «sábado» agrega varios sábados—, la HORA pactada tal como se
 * escribió, y el MOMENTO de la clase si se acordó. Lo que no se acordó va
 * vacío: no se inventa.
 */
export type OcupanteDeCelda = {
  codigo: string;
  docente: string;
  lugar: string;
  /** La facultad del curso-horario (dictado 2026-09-02: «decir la facultad también»). */
  facultad: string;
  confirmada: boolean;
  /** `YYYY-MM-DD` agendado, o "". */
  fecha: string;
  /** La hora pactada, textual («6:45 pm»); "" en lo no confirmado. */
  hora: string;
  /** El momento acordado de la clase, o "" si no se declaró. */
  momento: "" | MomentoDeClase;
};

/** `"MAR 14:00-16:00 · MIE 10:00-12:00"` → una entrada por bloque. */
export function leerSesiones(texto: string | undefined | null): Array<{ dia: number; desde: number; hasta: number }> {
  if (!texto) return [];
  return texto
    .split(/[·|]|<br\s*\/?>/i)
    .map((trozo) => trozo.trim())
    .flatMap((trozo) => {
      const m = /^([A-ZÁÉÍÓÚ]{3})\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i.exec(trozo);
      if (!m) return [];
      const dia = ABREV[m[1].toUpperCase()];
      if (dia === undefined) return [];
      const desde = Number(m[2]) * 60 + Number(m[3]);
      const hasta = Number(m[4]) * 60 + Number(m[5]);
      if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return [];
      return [{ dia, desde, hasta }];
    });
}

/** Una fila por sesión visitable. Solo titulares: los reemplazos no se agendan. */
export function sesionesDelPlan(plan: readonly MonitoreoAulasPlanRow[]): Sesion[] {
  const out: Sesion[] = [];
  for (const fila of plan) {
    if (fila.sample_role && fila.sample_role !== "titular") continue;
    const bloques = leerSesiones(fila.sesiones_dia_hora);
    for (const b of bloques) {
      out.push({
        ...b,
        salon: (fila.venue ?? "").trim(),
        aula: fila.classroom_id,
        curso: fila.course_name,
        facultad: fila.faculty,
        elegibles: Number(fila.eligible_n ?? 0),
        codigo: String(fila.operational_code ?? "").trim() || fila.classroom_id,
        docente: String(fila.teacher ?? "").trim(),
        horaTexto: String(fila.scheduled_time ?? "").trim(),
      });
    }
  }
  return out;
}

/** Qué eje ordena las filas de la malla. Ver el bloque «Los dos ejes» de arriba. */
export type EjeDeCarga = "semana" | "calendario";

/** Una fila de la malla. En `semana` son los seis días; en `calendario`, fechas. */
export type FilaDeCarga = {
  clave: string;
  etiqueta: string;
  /** Índice en `DIAS` (0 = lunes). `-1` si la fecha cae en domingo. */
  dia: number;
  /** `YYYY-MM-DD`. Sólo en el eje calendario. */
  fecha?: string;
  /** El carril de las que todavía no tienen fecha. */
  porAgendar?: boolean;
};

export type Malla = {
  /** Con qué eje se calculó. La vista y el Excel tienen que decir el mismo. */
  eje: EjeDeCarga;
  franjas: number[];
  /** Las filas de la malla, en orden. `firmes[i]` es la fila `filas[i]`. */
  filas: FilaDeCarga[];
  /** Clases en curso, sin importar si están agendadas. */
  aulas: number[][];
  /** Aplicadores ocupados por aulas YA agendadas. Es un hecho. */
  firmes: number[][];
  /** Aulas que PODRÍAN caer en esa franja porque su clase la cubre. Es un techo. */
  plausibles: number[][];
  /**
   * El detalle detrás de `firmes + plausibles`, celda a celda: qué
   * cursos-horario ocupan la franja, con docente, lugar y estado. Se anota en
   * la MISMA pasada que las matrices — dos implementaciones del marcado
   * divergirían en la primera regla nueva.
   */
  quienes: OcupanteDeCelda[][][];
  /**
   * El momento de mas carga. En el calendario se calcula SOLO sobre las fechas
   * —ver `calcularCarga`—, porque el carril no es un dia sino un patron.
   */
  pico: { firmes: number; plausibles: number; dia: number; fila: FilaDeCarga; franja: number; aulas: number } | null;
  /** El pico del carril de «por agendar». `null` fuera del eje calendario. */
  picoPorAgendar: { firmes: number; plausibles: number; dia: number; fila: FilaDeCarga; franja: number; aulas: number } | null;
  sinHorario: number;
  agendadas: number;
  porAgendar: number;
  /**
   * Agendadas con hora pero SIN fecha. No caben en el calendario y no se
   * cuelan en el carril de «por agendar» —ya tienen hora, llamarlas plausibles
   * sería mentir—, así que quedan fuera de la malla y la vista las declara.
   * Descartarlas en silencio sería el defecto.
   */
  agendadasSinFecha: number;
  /** Cuántas fechas distintas tiene el operativo agendado. */
  fechas: number;
};

/**
 * `duracionMin` sólo afecta a las aulas YA agendadas: es cuánto ocupa el
 * aplicador dentro de la clase. Las que faltan agendar no tienen momento —lo
 * decide cada docente— y ocupan su rango entero.
 */
export type OpcionesDeCarga = {
  duracionMin: number;
  pasoMin?: number;
  eje?: EjeDeCarga;
  /** Las ventanas confirmadas del MOTOR: la única fuente de posición horaria. */
  ventanas?: ReadonlyMap<string, VentanaDelMotor>;
};

/** La cita confirmada tal como la publicó el motor: fecha ISO y minuto real. */
export type VentanaDelMotor = { fecha: string; inicioMin: number };

/**
 * Las ventanas confirmadas del bloque `franjas` del dashboard, por código
 * operativo. El motor (B11) ya parseó el AM/PM y normalizó la fecha; la malla
 * POSICIONA desde aquí y jamás desde `scheduled_time` crudo — el bug del
 * 2026-09-02: «8:00pm» re-parseado en el cliente caía a las 08:00 y el pico
 * quedaba mal contado.
 */
export function ventanasDelMotor(
  franjas: MonitoreoAulasFranjas | null | undefined,
): Map<string, VentanaDelMotor> {
  const out = new Map<string, VentanaDelMotor>();
  for (const dia of franjas?.dias ?? []) {
    const fecha = typeof dia?.fecha === "string" ? dia.fecha : "";
    for (const v of dia?.ventanas ?? []) {
      if (!v || v.confirmada !== true) continue;
      const codigo = typeof v.codigo === "string" ? v.codigo.trim() : "";
      const inicioMin = minutosDeHora(typeof v.inicio === "string" ? v.inicio : "");
      if (!codigo || inicioMin === null || out.has(codigo)) continue;
      out.set(codigo, { fecha, inicioMin });
    }
  }
  return out;
}
export type MomentoDeClase = "inicio" | "intermedio" | "final";

const MOMENTOS: Record<string, MomentoDeClase> = {
  inicio: "inicio", intermedio: "intermedio", medio: "intermedio", final: "final", cierre: "final",
};

/**
 * `"08:30"` → minutos. Devuelve null si no es una hora de 24 horas EXACTA.
 *
 * Estricta a propósito (bug medido 2026-09-02): la versión sin ancla final
 * leía «8:00pm» como las 08:00 —doce horas de error— y la malla pintaba a las
 * 8 AM una cita acordada a las 8 PM, con el pico mal contado. El AM/PM lo
 * parsea el MOTOR (B11) y esta vista consume sus ventanas ya normalizadas
 * (`ventanasDelMotor`): re-parsear aquí es tener dos dueños de la misma hora.
 * Un texto con sufijo que no llegó con ventana del motor no se posiciona: cae
 * a la banda plausible en vez de a una adivinanza.
 */
export function leerHora(texto: unknown): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(texto ?? ""));
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(min) && min >= 0 && min < 24 * 60 ? min : null;
}

/** `"2026-09-15"` → la misma cadena; cualquier otra cosa → `""`. */
export function leerFecha(valor: unknown): string {
  const t = String(valor ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

/**
 * Índice en `DIAS` (0 = lunes) de una fecha ISO; `-1` si es domingo, si no
 * parsea o si ese día no existe.
 *
 * La comprobación de que la fecha es REAL la hace `fechaIsoReal`, el mismo dueño
 * que rotula las fechas —una sola definición de «esto es una fecha»—. Aquí
 * importa el doble: con un `2026-09-31`, `Date.UTC` lo corría al 1 de octubre y
 * este índice devolvía JUEVES, así que `bloqueDeFecha` elegía el bloque de clase
 * del jueves para un curso que no se dicta ese día y la ventana firme se pintaba
 * en la franja equivocada.
 */
export function diaDeFecha(iso: string): number {
  const partes = fechaIsoReal(iso);
  if (!partes) return -1;
  const dow = partes.fecha.getUTCDay();
  return dow === 0 ? -1 : dow - 1;
}

/** Dónde empieza la ventana de aplicación dentro de una sesión. */
function inicioDeVentana(desde: number, hasta: number, dur: number, momento: MomentoDeClase): number {
  if (momento === "final") return Math.max(desde, hasta - dur);
  if (momento === "intermedio") return Math.max(desde, Math.round((desde + hasta - dur) / 2));
  return desde;
}

type Bloque = { dia: number; desde: number; hasta: number };

type AulaDeCarga = {
  aula: string;
  /** Todas las sesiones del curso, para saber cuál se aplica en una fecha dada. */
  bloques: Bloque[];
  /** La sesión preliminar: la primera de la semana. */
  primera: Bloque;
  hora: number | null;
  momento: MomentoDeClase | null;
  fecha: string;
  codigo: string;
  docente: string;
  salon: string;
  facultad: string;
  /**
   * El LUGAR DE APLICACIÓN confirmado por el equipo («A206», dictado
   * 2026-09-02). Cuando existe manda sobre `salon`, que es donde se DICTA el
   * curso según el catálogo — no siempre donde se acordó aplicar. "" si el
   * libro no lo trae.
   */
  lugarConfirmado: string;
  horaTexto: string;
};

/**
 * Cada aula cuenta en su PRIMERA sesión: es el bloque preliminar, el que se
 * ofrece al agendar. Las demás sesiones son margen de reprogramación y contarlas
 * también inflaría la carga con visitas que no van a ocurrir.
 */
/**
 * ¿Hay al menos un curso-horario con sesión reconocible?
 *
 * Lo pregunta el panel para elegir entre la malla y su aviso, y **también quien
 * lo envuelve**, para no darle el alto de la pantalla a un párrafo de tres
 * líneas: el stack de Agenda reparte con `minmax(0, 1fr)` —regla que existe para
 * que la tabla de «Aulas agendadas» no se quede en 88 px— y en la pestaña de
 * carga esa fila es este panel. Medido el 2026-08-29: un aviso de 60 px dentro
 * de un marco de ~1.000, con 940 de vacío sin dueño.
 *
 * Vive aquí y no en el componente porque es una propiedad del PLAN, y así los
 * dos consumidores preguntan lo mismo en vez de calcularlo cada uno. No depende
 * del eje ni de la duración: `conHorario` era `titulares.length − sinHorario`,
 * que es exactamente cuántas unidades quedaron.
 */
export function hayHorarioDeCurso(plan: readonly MonitoreoAulasPlanRow[]): boolean {
  return aulasDelPlan(plan).unidades.length > 0;
}

function aulasDelPlan(plan: readonly MonitoreoAulasPlanRow[]): { unidades: AulaDeCarga[]; sinHorario: number } {
  const titulares = plan.filter((f) => !f.sample_role || f.sample_role === "titular");
  const primeras = new Map<string, AulaDeCarga>();
  for (const fila of titulares) {
    const hora = leerHora(fila.scheduled_time);
    const suyo = MOMENTOS[String(fila.scheduled_moment ?? "").trim().toLowerCase()] ?? null;
    const fecha = leerFecha(fila.scheduled_date);
    const bloques = leerSesiones(fila.sesiones_dia_hora);
    const lugarConfirmado = String(fila.scheduled_venue ?? "").trim();
    for (const s of sesionesDelPlan([fila])) {
      const previa = primeras.get(s.aula);
      if (!previa || s.dia < previa.primera.dia || (s.dia === previa.primera.dia && s.desde < previa.primera.desde)) {
        primeras.set(s.aula, {
          aula: s.aula,
          bloques,
          primera: { dia: s.dia, desde: s.desde, hasta: s.hasta },
          hora,
          momento: suyo,
          fecha,
          codigo: s.codigo,
          docente: s.docente,
          salon: s.salon,
          facultad: s.facultad,
          lugarConfirmado,
          horaTexto: s.horaTexto,
        });
      }
    }
  }
  return { unidades: [...primeras.values()], sinHorario: titulares.length - primeras.size };
}

/**
 * En el calendario manda el bloque del día en que REALMENTE se aplica, no el
 * primero del curso: un curso que se dicta martes y jueves, agendado un jueves,
 * ocupa la franja del jueves. En la malla semanal se sigue usando la primera
 * sesión, que es la que se ofrece al agendar.
 */
function bloqueDeFecha(u: AulaDeCarga, fecha: string): Bloque {
  const d = diaDeFecha(fecha);
  return u.bloques.find((b) => b.dia === d) ?? u.primera;
}

function filasDeCalendario(unidades: readonly AulaDeCarga[]): FilaDeCarga[] {
  const fechas = [...new Set(unidades.filter((u) => u.hora !== null && u.fecha).map((u) => u.fecha))].sort();
  const filas: FilaDeCarga[] = fechas.map((f) => ({
    clave: f,
    etiqueta: etiquetaDeFecha(f),
    dia: diaDeFecha(f),
    fecha: f,
  }));
  // El carril de las que todavía no tienen fecha, al final y con una fila por
  // día de la semana: es el patrón semanal de lo que falta, sin fingir que ya
  // ocupa un día del calendario.
  const dias = [...new Set(unidades.filter((u) => u.hora === null).map((u) => u.primera.dia))].sort((a, b) => a - b);
  for (const d of dias) {
    filas.push({ clave: `por-agendar:${d}`, etiqueta: DIAS[d] ?? "sin día", dia: d, porAgendar: true });
  }
  return filas;
}

/**
 * El eje horario de la malla: franjas de 30 minutos, de 07:00 a 22:00.
 *
 * Único dueño del eje. Lo usan la malla de DEMANDA (`calcularCarga`) y la de
 * OFERTA (`mallaDeOferta`), y por eso vive exportado: si cada una generara el
 * suyo, la lectura conjunta —comparar demanda y oferta de un vistazo— se
 * rompería en la primera divergencia.
 */
export function franjasDeMalla(pasoMin = 30): number[] {
  const franjas: number[] = [];
  for (let m = 7 * 60; m < 22 * 60; m += pasoMin) franjas.push(m);
  return franjas;
}

/**
 * El piso de ancho de la malla, en píxeles, según cuántas columnas vivas tiene.
 *
 * El `min-width` FIJO de la hoja (960px) estaba calibrado para las columnas de
 * la demanda sola; con el eje compartido demanda+oferta las columnas crecieron
 * y a 1024 de ancho los rótulos de hora se recortaban (medido 2026-09-02: 80
 * `th` con overflow-x en el gate). 36px es lo que pide el rótulo «07:00» con
 * aire; 158 = 112 de la columna de día + 46 del total. El scroll horizontal lo
 * sigue teniendo `.aulas-carga-malla-scroll` (C4), nunca la página.
 */
export function anchoMinimoDeMalla(columnas: number): number {
  return 158 + columnas * 36;
}

/**
 * Código operativo → lugar de la cita: el LUGAR DE APLICACIÓN confirmado del
 * libro cuando existe, el salón del catálogo si no, y el identificador como
 * último recurso — la MISMA regla que el detalle de la malla (`anotar`), por
 * el mismo dueño (`aulasDelPlan`). Lo consume la tabla de Asignación, cuyo
 * bloque `reparto` viaja sin lugares.
 */
export function lugaresDelPlan(plan: readonly MonitoreoAulasPlanRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of aulasDelPlan(plan).unidades) {
    if (!out.has(u.codigo)) out.set(u.codigo, u.lugarConfirmado || u.salon || u.aula);
  }
  return out;
}

export function calcularCarga(
  plan: readonly MonitoreoAulasPlanRow[],
  { duracionMin, pasoMin = 30, eje = "semana", ventanas }: OpcionesDeCarga,
): Malla {
  const { unidades, sinHorario } = aulasDelPlan(plan);
  // La posición horaria del MOTOR manda sobre el texto del libro: donde hay
  // ventana confirmada, la hora (y la fecha, que llega ya normalizada de
  // dd/mm a ISO) se toman de ahí. Ver `ventanasDelMotor`.
  if (ventanas) {
    for (const u of unidades) {
      const v = ventanas.get(u.codigo);
      if (v) {
        u.hora = v.inicioMin;
        if (v.fecha) u.fecha = v.fecha;
      }
    }
  }

  const franjas = franjasDeMalla(pasoMin);

  const filas: FilaDeCarga[] =
    eje === "calendario"
      ? filasDeCalendario(unidades)
      : DIAS.map((d, i) => ({ clave: d, etiqueta: d, dia: i }));
  const indice = new Map(filas.map((f, i) => [f.clave, i]));

  const vacia = () => filas.map(() => franjas.map(() => 0));
  const aulas = vacia();
  const firmes = vacia();
  const plausibles = vacia();
  const quienes: OcupanteDeCelda[][][] = filas.map(() => franjas.map(() => []));

  const marcar = (matriz: number[][], i: number, desde: number, hasta: number) => {
    franjas.forEach((f, j) => {
      if (desde <= f && hasta > f) matriz[i][j] += 1;
    });
  };
  // El detalle sigue EXACTAMENTE al número: se anota con la misma regla de
  // solape que `marcar`, en las mismas llamadas.
  const anotar = (i: number, desde: number, hasta: number, u: AulaDeCarga, confirmada: boolean) => {
    franjas.forEach((f, j) => {
      if (desde <= f && hasta > f) {
        quienes[i][j].push({
          codigo: u.codigo,
          docente: u.docente,
          facultad: u.facultad,
          // El lugar CONFIRMADO por el equipo manda (dictado 2026-09-02:
          // «LUGAR DE APLICACIÓN» nutre a la app); el salón del catálogo es
          // el fallback — dice dónde se dicta, no dónde se acordó aplicar.
          lugar: u.lugarConfirmado || u.salon || u.aula,
          confirmada,
          fecha: u.fecha,
          // La hora pactada sólo existe en la cita confirmada: en la banda
          // plausible el texto crudo podría ser un «por confirmar» tecleado, y
          // mostrarlo como hora inventaría un acuerdo.
          hora: confirmada ? u.horaTexto : "",
          momento: confirmada ? (u.momento ?? "") : "",
        });
      }
    });
  };
  const marcarFirme = (i: number, b: Bloque, u: AulaDeCarga) => {
    // Agendada: ocupa la ventana que se acordó y nada más.
    const desde = u.momento ? inicioDeVentana(b.desde, b.hasta, duracionMin, u.momento) : (u.hora as number);
    marcar(firmes, i, desde, desde + duracionMin);
    anotar(i, desde, desde + duracionMin, u, true);
  };
  // Sin agendar: la banda es la CLASE ENTERA. No se aplica ninguna ventana ni
  // ningún momento, porque el momento todavía no existe: lo fija cada docente al
  // confirmar, y hasta entonces cualquier tramo de su clase es igual de posible.
  const marcarPlausible = (i: number, b: Bloque, u: AulaDeCarga) => {
    marcar(plausibles, i, b.desde, b.hasta);
    anotar(i, b.desde, b.hasta, u, false);
  };

  let agendadas = 0;
  let agendadasSinFecha = 0;
  for (const u of unidades) {
    if (u.hora !== null) agendadas += 1;
    if (eje === "calendario") {
      if (u.hora !== null) {
        if (!u.fecha) {
          agendadasSinFecha += 1;
          continue;
        }
        const i = indice.get(u.fecha);
        if (i === undefined) continue;
        const b = bloqueDeFecha(u, u.fecha);
        marcar(aulas, i, b.desde, b.hasta);
        marcarFirme(i, b, u);
      } else {
        const i = indice.get(`por-agendar:${u.primera.dia}`);
        if (i === undefined) continue;
        marcar(aulas, i, u.primera.desde, u.primera.hasta);
        marcarPlausible(i, u.primera, u);
      }
    } else {
      const i = u.primera.dia;
      if (i < 0 || i >= filas.length) continue;
      marcar(aulas, i, u.primera.desde, u.primera.hasta);
      if (u.hora !== null) marcarFirme(i, u.primera, u);
      else marcarPlausible(i, u.primera, u);
    }
  }
  if (eje !== "calendario") {
    agendadasSinFecha = unidades.filter((u) => u.hora !== null && !u.fecha).length;
  }

  const picoDe = (incluir: (f: FilaDeCarga) => boolean): Malla["pico"] => {
    let mejor = -1;
    let out: Malla["pico"] = null;
    filas.forEach((fila, d) => {
      if (!incluir(fila)) return;
      franjas.forEach((f, j) => {
        const total = firmes[d][j] + plausibles[d][j];
        if (total > mejor) {
          mejor = total;
          out = { firmes: firmes[d][j], plausibles: plausibles[d][j], dia: d, fila, franja: f, aulas: aulas[d][j] };
        }
      });
    });
    return mejor > 0 ? out : null;
  };
  // En el calendario el pico son las FECHAS, y el carril se mide aparte.
  //
  // El carril junta en una sola fila «lunes» todos los lunes sin agendar de
  // TODAS las semanas, asi que sus numeros son estructuralmente mayores que los
  // de cualquier fecha concreta y ganarian el pico casi siempre: medido sobre un
  // operativo de 174 aulas en tres semanas, el titular decia «0 confirmados en
  // el pico» con 120 aulas ya confirmadas. Es exactamente el apilamiento de
  // semanas que este eje vino a corregir, colado en el indicador.
  const pico = picoDe((f) => (eje === "calendario" ? !f.porAgendar : true));
  const picoPorAgendar = eje === "calendario" ? picoDe((f) => Boolean(f.porAgendar)) : null;

  return {
    eje,
    franjas,
    filas,
    aulas,
    firmes,
    plausibles,
    quienes,
    pico,
    picoPorAgendar,
    sinHorario,
    agendadas,
    porAgendar: unidades.length - agendadas,
    agendadasSinFecha,
    fechas: new Set(unidades.filter((u) => u.hora !== null && u.fecha).map((u) => u.fecha)).size,
  };
}

/**
 * Con qué lectura abre la vista.
 *
 * Arranca en patrón semanal —mientras casi nada está agendado, el calendario son
 * tres fechas sueltas y el patrón es lo único que dimensiona el equipo— y se
 * inclina al calendario cuando ya hay tantas confirmadas como pendientes. Es
 * sólo con qué ABRE: el usuario cambia de eje cuando quiera.
 */
export function ejeSugerido(plan: readonly MonitoreoAulasPlanRow[]): EjeDeCarga {
  const { unidades } = aulasDelPlan(plan);
  const conFecha = unidades.filter((u) => u.hora !== null && u.fecha).length;
  return unidades.length > 0 && conFecha * 2 >= unidades.length ? "calendario" : "semana";
}

export const comoHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Aulas por salón/pabellón, para repartir el operativo por edificio. */
export function porPabellon(plan: readonly MonitoreoAulasPlanRow[]): Array<{ pabellon: string; aulas: number }> {
  const cuenta = new Map<string, number>();
  const vistas = new Set<string>();
  for (const s of sesionesDelPlan(plan)) {
    if (vistas.has(s.aula)) continue;
    vistas.add(s.aula);
    const p = /^[A-Z]\d{3}$/.test(s.salon) ? s.salon[0] : s.salon ? "Espacios con nombre" : "Sin salón";
    cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  // «Espacios con nombre» y «Sin salón» van al final aunque sean los más
  // numerosos: no son un edificio al que se pueda mandar un equipo, sino una
  // bolsa de laboratorios y talleres sueltos. Encabezar la lista con ellos hace
  // creer que hay un pabellón enorme que no existe.
  const alFinal = (p: string) => (p === "Espacios con nombre" ? 1 : p === "Sin salón" ? 2 : 0);
  return [...cuenta.entries()]
    .map(([pabellon, aulas]) => ({ pabellon, aulas }))
    .sort(
      (a, b) =>
        alFinal(a.pabellon) - alFinal(b.pabellon) ||
        b.aulas - a.aulas ||
        a.pabellon.localeCompare(b.pabellon),
    );
}

/**
 * Todas las citas de una fila de la malla, deduplicadas por código (B37,
 * dictado 2026-09-02: «el calendario se ve mejor»). Un curso ocupa varias
 * franjas de su fila; el parte del día lo quiere UNA vez, y en el orden en
 * que arranca: se conserva la primera aparición, que en `quienes` es la
 * franja más temprana. La usa el detalle cuando el usuario clickea la fecha.
 */
export function citasDeLaFila(malla: Malla, d: number): OcupanteDeCelda[] {
  const vistos = new Set<string>();
  const delDia: OcupanteDeCelda[] = [];
  for (const celda of malla.quienes[d] ?? []) {
    for (const o of celda) {
      if (vistos.has(o.codigo)) continue;
      vistos.add(o.codigo);
      delDia.push(o);
    }
  }
  return delDia;
}
