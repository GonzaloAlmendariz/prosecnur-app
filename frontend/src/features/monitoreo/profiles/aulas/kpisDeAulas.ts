import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../api/monitoreo";
import type { MonitoreoSeccion } from "../../core/monitoreoRegistry";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Link2,
  Link2Off,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  Table2,
  Target,
  Users,
  type LucideIcon,
} from "../../../../vendor/lucide-react";
import { sexSeriesLabel } from "../../../calcMuestra/sexoPalette";
import { pct } from "../../core/formatoComun";

/**
 * `puntajeSobreCien` se retiró con el tile de Representatividad, su único
 * consumidor: una función que nadie llama es deuda, no una capacidad.
 *
 * La lección que fijaban sus tests sigue en pie donde el puntaje vive ahora,
 * que es el control «Representatividad efectiva» del motor: **un puntaje 0-100
 * se escribe «94,8 de 100» y nunca «94,8 %»**, porque el símbolo de porcentaje
 * pide una población de la que esa cifra sea una parte, y aquí es un índice de
 * desvío contra la muestra planificada.
 */
import { summarizeAulasValidation } from "./aulasPresentation";
import { corteDelEstudio } from "./corteDelEstudio";
import { cuotasResumen } from "./cuotasResumen";
import { parteDeCampo } from "./parteDeCampo";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { estadoDeAplicacion } from "./estadoDeAplicacion";
import { agendamiento } from "./agendamiento";
import { historiaDeCadena } from "./historiaDeCadena";

/**
 * La banda de KPIs del perfil de cursos-horario, **una por sección**.
 *
 * Vive fuera de la página por dos razones. La primera: el KPI de cuota y el
 * panel de Avance decían cosas distintas del mismo hecho —«2/12 celdas» arriba,
 * «701 personas por recoger» dos dedos más abajo—; ahora los dos salen de
 * `cuotasResumen()` y no pueden discrepar. La segunda: así se prueba sin montar
 * la página entera.
 *
 * Por qué cambia con la sección. Telefónico y acreditación ya lo hacen
 * (`itemsByView`), y la razón se ve sola: aulas mostraba las mismas seis
 * tarjetas en las cinco secciones, así que en Fuentes —donde todavía no se
 * recogió nada— presidía la pantalla un «Cuota por recoger 701» que no ayuda a
 * ninguna decisión de esa sección, y en Consultas no había ni una cifra de
 * reemplazos. La banda contesta la pregunta de la sección en la que estás.
 *
 * **Toda tarjeta sale de un dato que el motor ya publica.** Ninguna se estima ni
 * se proyecta: si el dato no existe, la tarjeta no está.
 */

export type AulasKpi = {
  label: string;
  value: string;
  tone?: "neutral" | "warn";
  /**
   * De dónde sale la cifra o sobre qué se cuenta. Es el patrón que telefónico y
   * acreditación ya resolvieron: sus tarjetas llevan `hint` —«de la base», «del
   * universo», «pasan filtro»— porque un número sin denominador ni fuente se
   * lee mal. Aquí «Aplicadas 0» junto a «Válidas 3 700» parecía app rota, y en
   * realidad son dos fuentes distintas: una la declara el aplicador, la otra
   * llega de Kobo.
   */
  pista: string;
  /**
   * El ícono de la tarjeta, como en `.mon-clarity-card`. No es adorno: en una
   * banda que cambia por sección es lo que deja reconocer de un vistazo si la
   * cifra habla del plan, de lo recogido, de la cadena o de una alerta, sin
   * releer el rótulo. Siempre por el shim de lucide.
   */
  icono: LucideIcon;
  /** Lectura larga del mismo dato; va al `title`, así que no ocupa alto (C2). */
  detalle?: string;
  /**
   * La pestaña (clave de la MISMA sección) donde vive la lista detrás de la
   * cifra: la tarjeta se vuelve acceso — «Por agendar 144» lleva a la cola.
   * Sin destino, la tarjeta es solo lectura, como siempre.
   */
  destino?: string;
};

export function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

/**
 * Una cuenta de cosas, que no se parte: respuestas, aulas, personas.
 *
 * `fmt()` conserva los decimales que trae el dato, y eso es correcto para una
 * tasa o un porcentaje. Pero la meta de respuestas sale de dividir la cuota
 * entre la tasa de efectividad, así que llega fraccionaria — y en pantalla se
 * leía «576,5 respuestas faltan» y «meta 3.491,4». Media respuesta no existe.
 *
 * Redondea **hacia arriba** y no al más cercano: si faltan 576,5 respuestas,
 * con 576 no se cumple la meta. El techo es el criterio conservador, que es el
 * que corresponde a algo que hay que ALCANZAR. El dato exacto no se toca: esto
 * es presentación, y el motor sigue calculando con la fracción.
 */
/**
 * El porcentaje del perfil de aulas: **un decimal y espacio antes del «%»**.
 *
 * Vive aquí, junto a `fmt` y `fmtCuenta`, porque el perfil entero lo importa de
 * este módulo. Lo escribí dos veces como helper local —`pctTexto` en el embudo y
 * `pctCasa` en el perfil por facultad— antes de darme cuenta de que estaba
 * creando el mismo problema que llevo cerrando: dos sitios formateando lo mismo
 * acaban separándose.
 *
 * No confundir con el `pct()` de `monitoreo/core/formatoComun`, que redondea a
 * entero, pega el símbolo y escribe «S/D»: ése sirve a otros perfiles.
 */
/**
 * Lo que un aula va a APORTAR, en personas enteras y **hacia abajo**.
 *
 * No es `fmtCuenta()`, que redondea hacia arriba: esa es la regla de una META
 * que hay que cumplir. Un aporte esperado es lo contrario —prometer 3 cuando se
 * esperan 2,1 es prometer de más— y la regla ya estaba escrita en
 * `monitoreo_aulas_reserva_dirigida.R`, en el comentario de `.mard_personas()`:
 * «hacia abajo y no al más cercano… `fmtCuenta()` del frontend redondea hacia
 * arriba por el motivo contrario, y las dos reglas son correctas en su sitio».
 *
 * Estaba aplicada al revés en `avanceProyectado`, y se veía: «Lleva 1 de 4:
 * faltan 3 y las aulas que faltan por aplicar aportan 3» junto a un veredicto
 * que decía «falta 1 encuesta». 3 − 3 = 0, no 1. Con el aporte real (2,1) hacia
 * abajo, la resta cuadra.
 */
export function fmtAporte(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  // El epsilon evita que un 3 guardado como 2,9999999 se lea como 2.
  return Math.max(0, Math.floor(n + 1e-9)).toLocaleString("es-PE");
}

export function pctPerfil(n: number) {
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function fmtCuenta(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  // Un negativo se redondea también hacia el entero que lo contiene: −0,4
  // sobrantes son 0, no −1. Y el cero se normaliza: `Math.ceil(0 - 1e-9)` da
  // `-0`, que `Intl` pinta como «-0» y nadie escribe así.
  const entero = n < 0 ? Math.ceil(n) : Math.ceil(n - 1e-9);
  return new Intl.NumberFormat("es-PE").format(entero === 0 ? 0 : entero);
}

/**
 * Sólo la fecha del sello ISO del tablero; la hora no decide nada.
 *
 * **Un `YYYY-MM-DD` pelado NO pasa por `new Date()`.** La especificación lo
 * parsea como medianoche UTC, y `toLocaleDateString` lo devuelve al huso del
 * lector: en Lima —UTC−5— `2026-09-05` sale como **4/9/2026**. El día del corte
 * del estudio es justo un `YYYY-MM-DD` sin hora, así que se formatea a mano
 * desde sus tres números. Con hora sí se deja a `Date`, que es lo que quiere el
 * sello del tablero.
 */
function fecha(iso: unknown) {
  const texto = typeof iso === "string" ? iso.trim() : "";
  if (!texto) return "";
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (soloDia) return `${Number(soloDia[3])}/${Number(soloDia[2])}/${soloDia[1]}`;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? texto.slice(0, 10) : d.toLocaleDateString("es-PE");
}

/**
 * La tarjeta de cuota, en personas y compartida por dos secciones.
 *
 * En personas porque es la unidad del operativo: doce celdas pueden estar a una
 * respuesta o a doscientas y el contador de celdas se ve igual.
 */
function cuotaKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  // `quotas_sex_faculty` viaja en TODOS los scopes —comprobado pidiendo
  // `report_scope=source`, que devuelve las 12 celdas—, así que la tarjeta no se
  // vacía en las secciones que piden ese scope.
  const cuota = cuotasResumen((dashboard?.quotas_sex_faculty ?? []) as MonitoreoRow[]).general;
  // Lo que falta, por sexo. Se agrega desde las celdas —facultad x sexo— porque
  // pasarse en una facultad no cubre lo que falta en otra, igual que en el total.
  const faltanPorSexo = new Map<string, number>();
  for (const fila of (dashboard?.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>) {
    const sexo = String(fila.sex ?? "").trim() || "Sin dato";
    const falta = Math.max(0, Number(fila.target ?? 0) - Number(fila.observed ?? 0));
    if (!falta) continue;
    faltanPorSexo.set(sexo, (faltanPorSexo.get(sexo) ?? 0) + falta);
  }
  const porSexo = [...faltanPorSexo.entries()]
    .map(([sexo, faltan]) => ({ etiqueta: sexSeriesLabel(sexo), faltan }))
    .sort((a, b) => b.faltan - a.faltan);
  return {
    label: "Cuota por recoger",
    icono: Users,
    value: cuota.celdas ? fmt(cuota.faltan) : "S/D",
    // El desglose por sexo en la pista: «3 743» no dice a quién hay que buscar.
    pista: cuota.celdas
      ? (porSexo.length
          ? porSexo.map((x) => `${fmt(x.faltan)} ${x.etiqueta.toLowerCase()}`).join(" · ")
          : "personas de sexo por facultad")
      : "el plan no declara cuotas",
    tone: cuota.faltan ? "warn" : "neutral",
    // La última frase contesta la resta que no cuadra: 4 376 − 3 700 son 676 y
    // la tarjeta dice 701. No es un error —lo que falta se suma celda a celda,
    // porque pasarse en una facultad no cubre lo que falta en otra— pero sin
    // decirlo el lector encuentra la diferencia y desconfía de las dos cifras.
    // Y nombra su unidad: «Cumplimiento en respuestas», tres centímetros más
    // abajo, cuenta lo MISMO por otro camino —metas por curso-horario— y a 0,4
    // de distancia el redondeo separa las dos cifras en uno. Decir de dónde
    // sale cada una es lo que impide leer esa diferencia como un error.
    detalle: cuota.celdas
      ? `${fmt(cuota.logrado)} de ${fmt(cuota.meta)} personas · ${fmt(cuota.celdasCumplidas)} de ${fmt(cuota.celdas)} grupos de facultad y sexo · lo que falta se suma grupo a grupo`
      : "el plan no declara cuotas de sexo por facultad",
  };
}

/**
 * La fecha dentro de un `sel_aulas_AAAAMMDDHHMMSS_hash`.
 *
 * Un id de corrida no le dice nada a nadie; la fecha sí, y es lo que convierte
 * «700 cursos-horario» en «700 del sorteo del 22 de agosto».
 */
function fechaDeCorrida(runId: unknown): string {
  const m = /_(\d{4})(\d{2})(\d{2})\d{6}_/.exec(typeof runId === "string" ? runId : "");
  if (!m) return "";
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
}

/** El plan importado: la tarjeta que abre casi todas las secciones. */
function planKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  // **La cifra principal son las visitas, siempre.**
  //
  // Este KPI contaba las 700 unidades del plan —193 titulares y 507 reservas— y
  // se llamaba «Cursos-horario». En Agenda, la misma palabra vale 193. Y en la
  // propia sección de Fuentes convivía con «Cursos-horario del plan: 193» del
  // recorrido: dos cifras casi con el mismo nombre a un dedo de distancia.
  //
  // Ahora enseña los titulares —lo que alguien va a visitar— y las reservas van
  // en la pista, que es donde ya vivía el matiz. Sin titulares declarados se cae
  // al total, que es lo que había antes.
  const titulares = Number(dashboard?.kpis?.aulas_titulares ?? 0);
  const unidades = Number(dashboard?.kpis?.total_aulas ?? 0);
  const total = titulares || unidades;
  const reservas = titulares && unidades > titulares ? unidades - titulares : 0;
  // **De dónde sale la cifra, pegada a la cifra.** Es el patrón que hace legible
  // a Cálculo de cursos-horario: bajo «29,027» dice «base completa» y bajo «190»
  // dice «P1 · Universidad · 8 · marco vigente». Aquí la pista decía sólo QUÉ se
  // cuenta —«titulares y sus reservas encadenadas»—, que resuelve un equívoco de
  // denominador real y hay que conservar, pero no de qué sorteo salen. Con dos
  // corridas en el mismo estudio, esa es justo la pregunta.
  const corrida = fechaDeCorrida(
    (dashboard as { selection_run_id?: unknown } | null)?.selection_run_id
    ?? (dashboard as { config?: { selection_run_id?: unknown } } | null)?.config?.selection_run_id,
  );
  return {
    label: "Cursos-horario",
    icono: CalendarRange,
    value: fmt(total),
    // «reservas del plan» era ambiguo y producia dos cifras sin explicacion en la
    // misma pantalla: este KPI dice 196 y la tarjeta del libro 236. La
    // diferencia son las aulas EXTRA —las que no cuelgan de ningun titular—, que
    // tambien son reservas pero no forman cadena y viven en su propia pestaña.
    // El rotulo dice ahora cual de las dos cuenta.
    pista: [
      reservas ? `+${fmt(reservas)} reservas` : "titulares y sus reservas encadenadas",
      corrida ? `sorteo del ${corrida}` : "",
    ].filter(Boolean).join(" · "),
    tone: total ? "neutral" : "warn",
  };
}

/**
 * Las que el aplicador declaró, que NO son las que recogieron respuestas.
 *
 * Cuenta `operational_status` en «aplicada» o «cerrada», o sea lo que se
 * registró en campo. Con el registro vacío y 3 700 respuestas ya recogidas, un
 * «Aplicadas 0» sin pista se lee como app rota. Es la misma distinción que
 * telefónico resolvió nombrando la fuente en el rótulo: «Declaradas efectivas»
 * (la hoja) frente a «Efectivas Kobo» (la plataforma).
 */
function registroKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  return {
    // **El rótulo dice su unidad.** Decía «Aplicadas» a secas, en una banda
    // donde la tarjeta de al lado —«Válidas 2,668»— cuenta PERSONAS: quien no
    // diseñó el estudio compara 152 con 2.668 sin nada que le avise de que son
    // cursos-horario contra encuestas. Se usa el mismo nombre con que el
    // glosario de columnas traduce este dato (`aulas_aplicadas`), así que la
    // tarjeta y la tabla lo llaman igual.
    label: "Cursos-horario aplicados",
    icono: ClipboardCheck,
    value: fmt(dashboard?.kpis?.aulas_aplicadas),
    // **Y la pista dice las TRES vías, porque desde el 2026-09-07 son tres.**
    // Decía «declarados en el registro de campo» y prometía que la cifra no se
    // derivaba de las respuestas; ese día se derivó, porque con ocho aulas
    // produciendo encuestas la tarjeta enseñaba UNA.
    pista: "registrados, con parte o ya recibiendo respuestas",
    detalle: "Cuenta el curso-horario que alguien registró en esta app, el que su parte declara aplicado y el que ya recibe respuestas por la plataforma. Basta con uno: el parte llega al cerrar la aplicación y a veces tarda, pero las respuestas llegan solas.",
  };
}

/**
 * **¿Vamos a llegar?** — la única pregunta del tablero que no tenía cifra.
 *
 * La banda de Avance dice «llegaron a su meta: 0», «cuota por recoger: 1 558» y
 * «brechas: 168»: tres formas de decir que se va atrás, y ninguna dice si con lo
 * que hay agendado se llega. Ese número existe desde que la pirámide predice
 * —`proyeccionPorAgenda` decide celda a celda si la agenda comprometida cubre su
 * cuota— pero vivía sólo en el detalle, a dos pestañas de distancia.
 *
 * El denominador son las celdas sexo × facultad, que es por lo que se aprueba o
 * no el estudio. Un `0 de 40` es una alarma; un `0` a secas no dice nada.
 *
 * `tone` en `warn` cuando no cierran todas: es la cifra que decide si hay que
 * salir a pedir aulas, y neutra se lee como un dato más de contexto.
 */
function cierreKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  const proyeccion = proyeccionPorAgenda(
    (dashboard?.agenda ?? []) as MonitoreoRow[],
    parteDeCampo(
      (dashboard?.partes_campo ?? []) as MonitoreoRow[],
      (dashboard?.agenda ?? []) as MonitoreoRow[],
    ).filas as MonitoreoRow[],
    (dashboard?.quotas_sex_faculty ?? []) as MonitoreoRow[],
  );
  const celdas = proyeccion.flatMap((f) => f.cuotas);
  // Sólo las celdas que declaran objetivo entran en la cuenta. Sin este filtro,
  // una celda con meta 0 da `faltan === 0` y por tanto `alcanza === true`: el
  // KPI contaba la ausencia de objetivo como un cierre logrado. En el estudio
  // real, sus «10 cierran» eran exactamente las 10 celdas sin cuota, con cero
  // aulas agendadas y cero aplicadas.
  const evaluables = celdas.filter((c) => c.meta > 0);
  const sinObjetivo = celdas.length - evaluables.length;
  const cierran = evaluables.filter((c) => c.alcanza).length;
  const pistaSinObjetivo = sinObjetivo ? ` · ${fmt(sinObjetivo)} sin objetivo declarado` : "";
  return {
    label: "Cierran con lo agendado",
    icono: CalendarRange,
    value: evaluables.length ? fmt(cierran) : "S/D",
    pista: evaluables.length
      ? `de ${fmt(evaluables.length)} grupos de facultad y sexo con meta${pistaSinObjetivo}`
      : "el estudio no declara cuotas por sexo y facultad",
    tone: evaluables.length && cierran < evaluables.length ? "warn" : "neutral",
    detalle: evaluables.length
      ? "Cuenta los grupos que llegarían a su cuota con los cursos-horario YA agendados, no al ritmo observado: la agenda son aulas con fecha, no una proyección. Los grupos que no declaran cuota quedan fuera de la cuenta, porque no hay meta que cerrar. Los que no cierran se ven uno a uno en Cuotas."
      : undefined,
  };
}

function brechasKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  const brechas = Number(dashboard?.kpis?.brechas ?? 0);
  // Nunca un agregado sin su desglose. «168» no dice dónde hay que ir; «168 en
  // 20 facultades · la mayor, Educación con 232» sí. La facultad sale de
  // `course_status`, que ya viaja con ella.
  const porFacultad = new Map<string, number>();
  for (const fila of (dashboard?.course_status ?? []) as Array<Record<string, unknown>>) {
    const b = Number(fila.brecha ?? 0);
    if (!Number.isFinite(b) || b <= 0) continue;
    const f = String(fila.faculty ?? "").trim() || "Sin facultad";
    porFacultad.set(f, (porFacultad.get(f) ?? 0) + b);
  }
  const mayor = [...porFacultad.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    // **«Brechas» no decía brecha de qué**, y la tarjeta de al lado —«Cuota por
    // recoger 170»— también cuenta lo que falta, pero en PERSONAS. Las dos
    // cifras se leían como dos cuentas del mismo hueco cuando son dos ejes: 170
    // son alumnos que faltan para la cuota del estudio; 98, cursos-horario que
    // no llegaron a su propia meta (`sum(tracked_df$brecha > 0)`,
    // `monitoreo_aulas_universitarias.R:2342`).
    //
    // Con el nombre completo queda además a la vista que es el complemento de
    // «Llegaron a su meta», que es la tarjeta vecina por el otro lado.
    label: "Cursos-horario bajo su meta",
    icono: AlertCircle,
    value: fmt(brechas),
    pista: porFacultad.size
      ? `en ${fmt(porFacultad.size)} ${porFacultad.size === 1 ? "facultad" : "facultades"}`
      // No es «ninguno»: el desglose sale de `course_status`, que puede llegar
      // recortado. Se dice que falta el reparto, no que no haya brechas.
      : "sin el desglose por facultad",
    detalle: mayor
      // Sin jerga: «course_status» es el nombre interno del payload y no le
      // dice nada a quien lee el tooltip — la idea es que la lista de
      // cursos-horario puede llegar recortada por tamaño (el tope declarado
      // del estado) y por eso el reparto es orden de magnitud.
      ? `La mayor es ${mayor[0]}, con ${fmt(mayor[1])} respuestas por recoger. La lista de `
        + `cursos-horario puede llegar recortada por tamaño, así que el reparto por facultad se lee como orden de magnitud.`
      : undefined,
    tone: brechas ? "warn" : "neutral",
  };
}

function validasKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  // El desglose honesto de esta tarjeta es decir que NO se puede desglosar: si
  // ninguna respuesta se ata a un curso-horario, no hay facultad ni sexo que
  // repartir. Callarlo la deja igual que si el reparto existiera, y repartirla
  // por la meta sería inventarlo.
  const validas = Number(dashboard?.kpis?.respuestas_validas ?? 0);
  const atribuidas = ((dashboard?.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>)
    .reduce((n, f) => n + Number(f.observed ?? 0), 0);
  // **El caso intermedio, que era el real y no se decía.**
  //
  // La rama de arriba sólo miraba el todo-o-nada. En este corte hay 2 220
  // válidas y 2 185 atribuidas a una celda sexo × facultad: **35 encuestas
  // hechas que no cuentan para ninguna cuota**, en un operativo donde faltan
  // 1 558 y el banco entero no alcanza. La cifra estaba calculada dos líneas
  // más arriba y sólo se usaba para el caso extremo.
  //
  // No es un tope: se comprobó que ninguna de las 40 celdas supera su meta, así
  // que `observed` no está recortado y la diferencia es real.
  const fuera = Math.max(0, validas - atribuidas);
  return {
    label: "Efectivas",
    icono: CheckCircle2,
    value: fmt(dashboard?.kpis?.respuestas_validas),
    // **Dice CELDA y no curso-horario, porque es lo que mide.**
    //
    // `atribuidas` sale de `quotas_sex_faculty`: es la atribucion a una celda
    // SEXO × FACULTAD, que necesita el sexo de cada respuesta. La atribucion al
    // curso-horario es otra —va por el enlace del recopilador— y puede estar
    // funcionando cuando esta falla.
    //
    // Visto en un simulacro: la tarjeta decia «ninguna atribuida a un
    // curso-horario» mientras dos paneles mas abajo se contaban 1 471
    // respuestas cubriendo la meta de sus aulas y 20 aulas en meta. Las dos
    // cifras eran correctas y el rotulo era el que mentia: faltaba el sexo, no
    // el aula, y mandaba a revisar el enlace en vez del mapeo de la variable.
    pista: validas > 0 && atribuidas === 0
      ? "de la plataforma · ninguna cae en un grupo de facultad y sexo"
      : fuera > 0
        ? `${fmt(fuera)} no entran en ningún grupo con cuota`
        : "respuestas de la plataforma que pasan los filtros",
    detalle: validas > 0 && atribuidas === 0
      ? "Sin el sexo de cada respuesta no se pueden repartir por grupo, así que no cuentan para ninguna cuota. La atribución al curso-horario es otra cosa y puede estar bien: mírala en «Llegaron a su meta»."
      : fuera > 0
        ? `${fmt(atribuidas)} de ${fmt(validas)} caen en un grupo de facultad y sexo. Las otras ${fmt(fuera)} están hechas y no cuentan para ninguna cuota: si el control «Respuestas válidas sin curso-horario» está en verde, lo que les falta es el sexo.`
        : undefined,
  };
}

/**
 * Las tarjetas de cada sección.
 *
 * El color semántico (`warn`) se reserva para lo que pide una decisión —brechas,
 * cuota con déficit, alertas, cadenas abiertas—; el resto queda neutral para no
 * meter ruido en conteos que aún están en 0.
 */
export function aulasKpis(
  dashboard: MonitoreoAulasDashboard | null,
  seccion: MonitoreoSeccion,
  /**
   * La pestaña activa. La banda contesta la pregunta de la sección **y de la
   * pestaña**: dos pestañas de la misma sección pueden ser dos trabajos, y
   * presidirlas con las mismas tres cifras convierte a una de las dos en
   * decorado. Opcional: sin ella, la banda se comporta como antes.
   */
  pestana = "",
): AulasKpi[] {
  const kpis = dashboard?.kpis;

  if (seccion === "fuentes") {
    // De dónde viene todo: el plan, lo que se leyó y cuándo se calculó. Es la
    // misma tríada que telefónico pone en su sección de fuentes.
    // **El corte del estudio NO es `generated_at`.**
    //
    // `corteDelEstudio.ts` existe exactamente por esto y su cabecera lo explica:
    // ese sello dice cuándo se CALCULÓ el tablero —el reloj de la máquina que lo
    // abrió— y sobre un estudio reabierto o simulado dice cualquier cosa. El
    // módulo ya resolvía el «hoy» del estudio como el último día con parte de
    // campo, y esta tarjeta, que es la que publica la palabra «Corte» en la
    // banda, seguía leyendo el sello.
    //
    // Medido el 2026-08-29 sobre `aulas_con_respuestas.pulso`: la tarjeta decía
    // **29/8/2026** con partes del 1/9 al 5/9 y con Salidas diciendo «corte
    // 05/09/26». Dos capas, dos lecturas de la misma regla — que es la frase que
    // el propio `corteDelEstudio` usa para describir el defecto hermano.
    //
    // Cuando no hay ni un parte no hay reloj de campo: el módulo devuelve el
    // sello y lo declara con `esDelCampo: false`, y aquí se dice en la pista en
    // vez de afirmar un corte que nadie midió.
    const corte = corteDelEstudio(
      (dashboard?.partes_campo ?? []) as MonitoreoRow[],
      dashboard?.generated_at,
    );
    const sello = fecha(corte.dia);
    return [
      planKpi(dashboard),
      {
        label: "Respuestas leídas",
        icono: Table2,
        value: fmt(kpis?.respuestas_total),
        pista: "filas que llegaron de la plataforma",
      },
      {
        // La tarjeta se llama «Corte» y decía «Listo»: prometia una fecha y
        // entregaba un estado, con la fecha escondida en la pista. El corte ES
        // la fecha —todo el atraso del operativo se mide contra ella—, así que
        // va en el valor.
        label: "Corte",
        icono: RefreshCw,
        value: sello || "Pendiente",
        pista: !sello ? "todavía sin tablero generado"
          : corte.esDelCampo ? "último día con parte; todo el atraso se mide contra él"
            : "sello del tablero: todavía no hay ningún parte de campo con el que fijar el corte",
        tone: sello ? "neutral" : "warn",
      },
    ];
  }

  if (seccion === "modelo") {
    // **«Agenda» es otro trabajo que «Registro».** Agendar es llamar al docente
    // y cerrar una cita; registrar es anotar lo que pasó en el aula. La banda
    // de la sección hablaba de aulas APLICADAS en las dos, así que quien está
    // agendando presidía su pantalla con el avance de otro.
    if (pestana === "agenda") {
      const ag = agendamiento((dashboard?.agenda ?? []) as Array<Record<string, unknown>>);
      const tiles: AulasKpi[] = [
        {
          label: "Agendados",
          icono: CalendarCheck,
          value: fmt(ag.agendadas),
          // Con su denominador: «160» y «160 de 186» dicen lo mismo del
          // numerador y cosas distintas del trabajo que queda.
          pista: `de ${fmt(ag.enJuego)} que se van a visitar`,
        },
        {
          label: "Por agendar",
          icono: CalendarClock,
          value: fmt(ag.porAgendar),
          pista: "sin fecha cerrada todavía",
          tone: ag.porAgendar ? "warn" : "neutral",
          // La lista de a quién llamar vive en Contacto: la cifra es la puerta.
          destino: "contacto",
        },
      ];
      // **Un aula aplicada sin fecha agendada es un descuadre, no un estado.**
      //
      // Si no se agenda un aula no se aplica, asi que esta combinacion sólo
      // puede venir de un error de transcripcion en el Excel: falta la fecha en
      // la agenda, o el parte se anoto en la fila equivocada. El tile aparece
      // sólo cuando las hay —un «0 descuadres» permanente entrena a no mirarlo—
      // y en tono de alerta, porque pide una correccion.
      /**
       * **Fecha prevista no es cita cerrada, y este panel promete lo segundo.**
       *
       * Arriba está escrito que «agendar es llamar al docente y cerrar una
       * cita», y «Agendadas» se cuenta por tener `scheduled_date`. Esa columna
       * llega **pre-rellenada con la fecha prevista de cada curso-horario**: las
       * 1.173 reservas dormidas la traen sin que nadie las haya agendado, y
       * 1.137 de ellas con fecha distinta de la de su titular —la de su propio
       * curso—.
       *
       * Contar por fecha sigue siendo correcto para «cuántas se pueden visitar»,
       * que es lo que mide `agendamiento`. Lo que faltaba es no dejar que «Por
       * agendar 0» esconda a nueve filas cuyos DOS estados se contradicen: el de
       * muestra dice «sin contactar» y el operativo dice «agendada». La primera
       * versión de este tile decía «sin contacto logrado», que elegía uno de los
       * dos como verdadero sin poder probarlo.
       *
       * Mismo patrón que el descuadre de abajo: sólo aparece cuando las hay.
       */
      if (ag.estadosEnDesacuerdo > 0) {
        tiles.push({
          label: "Estados que se contradicen",
          icono: CalendarClock,
          value: fmt(ag.estadosEnDesacuerdo),
          // **Manda el operativo, y eso se dice.** Gonzalo, 2026-08-31: «se
          // supone que en las aulas titulares se agendan a primer momento antes
          // del campo». La agenda es previa por diseño, así que la fecha es el
          // dato bueno y el de muestra es el que hay que corregir. Decir sólo
          // «se contradicen» deja al lector eligiendo, y ya no hay nada que
          // elegir.
          pista: "tienen fecha y el estado de muestra dice «sin contactar»: manda la fecha, hay que corregir la muestra",
          // **Cuánto depende de la contradicción, no sólo cuántas hay.** El
          // conteo solo deja al lector sin saber si son nueve casos sueltos o
          // media proyección. Medido el 2026-08-30: esas 9 aportan 168 de las
          // 373,5 efectivas del aporte pendiente.
          detalle: ag.esperadasEnDesacuerdo > 0
            ? `De ellas se esperan ${fmt(ag.esperadasEnDesacuerdo)} encuestas, así que la proyección de cierre se apoya en filas cuyos dos estados no coinciden. Cuál manda —lo agendado o lo contactado— decide si esas encuestas cuentan.`
            : undefined,
          tone: "warn",
        });
      }
      if (ag.aplicadasSinAgenda > 0) {
        tiles.push({
          label: "Aplicados sin agenda",
          icono: CalendarClock,
          value: fmt(ag.aplicadasSinAgenda),
          pista: "tienen parte y no tienen fecha agendada",
          detalle: "No debería ocurrir: sin agendar no se aplica. Revisa la fecha en la hoja de agenda o si el parte se anotó en la fila que no era.",
          tone: "warn",
        });
      }
      // La insistencia sólo cuando hay gestiones registradas: sin ellas el tile
      // diría «0 cuestan más de una gestión», que se lee como que todas salen a
      // la primera cuando lo que pasa es que nadie anotó.
      if (ag.intentosMedianos !== null) {
        tiles.push({
          label: "Cuestan más de una",
          icono: PhoneCall,
          value: fmt(ag.conInsistencia),
          pista: `gestiones; la mediana es ${fmt(ag.intentosMedianos)}`,
          destino: "contacto",
        });
      }
      // **La insistencia describía; ahora también avisa.**
      //
      // «12 cuestan más de una gestión» no dice qué hacer. Medido sobre el campo
      // de 2025 (170 titulares): las que se cerraron en una o dos gestiones se
      // cayeron el 17-19 %, y de la TERCERA en adelante el 36-38 %. O sea que a
      // partir de la tercera llamada el aula tiene el doble de probabilidad de
      // no sostenerse, y eso se sabe ANTES de que se caiga — que es cuando
      // todavía sirve para activar una reserva.
      if (ag.enUmbralDeRiesgo > 0) {
        tiles.push({
          label: "Van por la tercera",
          icono: PhoneCall,
          value: fmt(ag.enUmbralDeRiesgo),
          pista: "gestiones y siguen sin fecha",
          destino: "contacto",
          detalle: "En el campo de 2025, un curso-horario que llegaba a la tercera gestión se caía el doble de veces que una cerrada en una o dos (36 % contra 18 %). Conviene mirar su reserva antes de que se caiga.",
          tone: "warn",
        });
      }
      // Sin medio de contacto no es «difícil»: es que no hay por dónde llamar.
      // En 2025 fueron 14 de 170 y se cayeron LAS CATORCE.
      if (ag.sinMedioDeContacto > 0) {
        tiles.push({
          label: "Sin medio de contacto",
          icono: PhoneCall,
          value: fmt(ag.sinMedioDeContacto),
          // El rótulo decía «sin medio de contacto» y la cuenta exige ADEMÁS
          // que sigan sin fecha: una ya agendada no necesita que la llamen. Sin
          // decirlo, 33 sin medio conviven con un contador en 0.
          pista: "ni teléfono ni correo anotado, entre las que aún hay que agendar",
          detalle: "En 2025 los 14 cursos-horario sin medio de contacto anotado se cayeron todos. No es que sean difíciles: es que no hay por dónde llamarlos.",
          tone: "warn",
          destino: "contacto",
        });
      }
      return tiles;
    }
    // La sección de la agenda y el registro: cuántas hay, cuántas se
    // registraron y cuántas no han recibido ni una respuesta.
    const estado = estadoDeAplicacion((dashboard?.course_status ?? []) as MonitoreoAulasPlanRow[]);
    const deTramo = (clave: string) =>
      estado.estados.find((e) => e.clave === clave)?.aulas ?? 0;
    const sinFecha = deTramo("pendiente");
    const agendadasConFecha = deTramo("lista");
    // **El tramo «lista» NO quiere decir «tiene cita».** Medido el 2026-08-30
    // sobre el estudio de 174 titulares: los 22 de este sello son **13
    // `agendada` + 9 `sin_contactar`**, y la pista decía «agendados, todavía
    // sin salir a campo» sobre los 22. Los 9 son justo los que la cola de
    // contacto de Modelo publica como «siguen sin cita · el que más lleva va
    // por 5 intentos», a dos bloques de distancia.
    //
    // Es la advertencia que este mismo comentario ya traía —«llamar agendado a
    // lo que no tiene fecha invierte la decisión: una agendada se espera, una
    // sin fecha hay que salir a agendarla»— con el eje equivocado: se miró
    // `application_state`, que agrupa las dos, en vez de `sample_status`, que
    // las separa.
    const enLista = ((dashboard?.course_status ?? []) as MonitoreoAulasPlanRow[])
      .filter((f) => String(f.application_state ?? "").trim() === "lista");
    //
    // **Sólo se separa si TODAS declaran su estado.** Asumir «sin cita» donde
    // no hay `sample_status` es el mismo error al revés: se estaría afirmando
    // que nadie contactó a filas que no dicen nada.
    const declaran = enLista.filter((f) => String(f.sample_status ?? "").trim() !== "");
    //
    // **Cuando los dos estados se contradicen, manda el OPERATIVO.**
    //
    // Gonzalo, 2026-08-31: «se supone que en las aulas titulares se agendan a
    // primer momento antes del campo». La agenda es previa al campo por diseño,
    // así que un titular con fecha no puede estar sin contactar: lo que está
    // desactualizado es `sample_status`, y las nueve filas lo confirman por su
    // cuenta —llevan de tres a cinco gestiones anotadas—.
    //
    // Antes se miraba sólo la muestra y esas nueve salían como «sin contactar
    // todavía», que manda a llamar a docentes que ya dieron hora.
    const conAgenda = (f: MonitoreoAulasPlanRow) => {
      const op = String(f.operational_status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      return op === "agendada" || op === "aplicada" || op === "cerrada";
    };
    const conCita = declaran.filter((f) => {
      const s = String(f.sample_status ?? "").trim().toLowerCase();
      return s.startsWith("agendada") || s.startsWith("reagendada") || conAgenda(f);
    }).length;
    // Las que tienen cita en el operativo y la muestra aún no lo dice: es un
    // dato que hay que corregir, y se declara en vez de esconderse detrás del
    // recuento ya arreglado.
    const muestraDesfasada = declaran.filter((f) => {
      const s = String(f.sample_status ?? "").trim().toLowerCase();
      return !s.startsWith("agendada") && !s.startsWith("reagendada") && conAgenda(f);
    }).length;
    const sinCita = declaran.length === enLista.length ? declaran.length - conCita : 0;
    return [
      planKpi(dashboard),
      registroKpi(dashboard),
      {
        // **La pista nombraba sólo la mitad, y era la que valía cero.**
        //
        // `sinSalirACampo` suma los tramos `pendiente` («Sin agendar») y `lista`
        // («Agendada»), como dice su propio comentario en `estadoDeAplicacion`.
        // La pista decía «agendadas que aún no salen a campo» sobre 145 aulas
        // de las que —medido el 2026-08-29— **ninguna estaba agendada**: el
        // Status de aplicación de esa misma sesión daba «Agendada 0», y el panel
        // de abajo, «145 sin fecha, al final de su facultad». Llamar agendado a
        // lo que no tiene fecha invierte la decisión: una agendada se espera, una
        // sin fecha hay que salir a agendarla.
        //
        // Se declara el reparto, que además es lo que decide.
        label: "Sin empezar",
        icono: AlertCircle,
        value: fmt(estado.sinSalirACampo),
        pista: !agendadasConFecha ? "todavía sin fecha: hay que agendarlas"
          : sinFecha ? `${fmt(sinFecha)} sin fecha · ${fmt(agendadasConFecha)} agendadas`
            : sinCita ? `${fmt(conCita)} con cita · ${fmt(sinCita)} sin contactar todavía`
              : muestraDesfasada
                ? `${fmt(conCita)} con cita · ${fmt(muestraDesfasada)} sin actualizar en la muestra`
                : "agendados, todavía sin salir a campo",
        tone: estado.sinSalirACampo ? "warn" : "neutral",
      },
    ];
  }

  if (seccion === "calidad") {
    // **«Base de control» no lleva banda.**
    //
    // Esa pestaña ya abre con su propio encabezado de cifras —la matriz de los
    // cuatro casos y el titular de efectivas—, que dicen lo que ahí se viene a
    // saber. Encima llevaba tres tiles de la OTRA pestaña: controles, alertas y
    // representatividad, que son calidad del dato y no veredicto de aula. Tres
    // estratos de cabecera, 111 px de banda, y el usuario leyéndolos como
    // repetición. Gonzalo: «hay KPIs arriba y abajo, repitiéndose».
    // El mismo argumento vale para las otras dos pestañas que abren con su
    // propia cifra: «Registro de campo» encabeza con «196 cursos-horario · 152
    // con parte en el libro» y «Respuestas abiertas» con el estado de su
    // pregunta. En las dos, Controles y Alertas son el resumen de la pestaña
    // VECINA —lo que el motor deriva del corte—, no de lo que ahí se hace, y
    // ocupaban 90 px de los 600 de alto en portátil.
    if (pestana === "base" || pestana === "registro" || pestana === "abiertas") return [];

    const controles = (dashboard?.validation ?? []) as Array<Record<string, unknown>>;
    const alertas = summarizeAulasValidation(controles);
    return [
      {
        label: "Controles",
        icono: ClipboardCheck,
        // El tile ensena las EVALUADAS, no las declaradas, para que su cifra y la
        // de Alertas compartan denominador. La diferencia con la lista de abajo
        // —que sigue mostrando las once— la explica la propia pista; callarla
        // dejaria dos fuentes del mismo hecho discrepando sin que nadie lo diga.
        value: fmt(alertas.evaluados),
        // **Con su sustantivo, que si no parece una discordancia.** La otra rama
        // dice «reglas evaluadas» y el femenino es correcto —son REGLAS—, pero
        // esta lo elidía y quedaba «CONTROLES · 11 · evaluadas», con el rótulo en
        // masculino justo encima. Visto a ojo en la captura de
        // `calidad/controles` a 1024 el 2026-08-30: parece un error de género y
        // no lo es, que es la peor clase de duda porque lleva a «arreglar» lo
        // que está bien.
        pista: alertas.sinComprobar
          ? `reglas evaluadas · ${alertas.sinComprobar} sin comprobar`
          : "reglas evaluadas sobre este corte",
      },
      {
        label: "Alertas",
        icono: ShieldAlert,
        value: fmt(alertas.count),
        pista: "controles que no pasan",
        tone: alertas.count ? "warn" : "neutral",
      },
      // **El tile de Representatividad se retiró.**
      //
      // Decía «95 de 100» a dos centímetros del control «Representatividad
      // efectiva · Puntaje 94,8 de 100», en la misma pantalla: la misma cifra
      // dos veces con distinta precisión. Se queda la que contesta —el control
      // trae el desvío en puntos y la escala— y se retira la que sólo la
      // repetía, que es la regla de la casa cuando dos superficies dicen lo
      // mismo. El puntaje no se pierde: vive en su control, con su explicación.
    ];
  }

  if (seccion === "consultas") {
    // Las tres preguntas del cierre: cuánta reserva se gastó, cuántas cadenas
    // siguen abiertas y cuántos cursos-horario quedan por debajo de su meta.
    const cadenas = historiaDeCadena((dashboard?.agenda ?? []) as MonitoreoAulasPlanRow[]);
    return [
      {
        // Sale de `historiaDeCadena()`, la misma función que cuenta la historia
        // debajo. El KPI `reemplazos_usados` del motor NO sirve aquí: cuenta
        // reservas cuyo estado operativo ya no es «planificada», o sea depende
        // del registro de campo, y con el registro vacío decía «0» mientras el
        // panel de al lado decía «3 cerraron con un reemplazo». Es la misma
        // contradicción que tenía la cuota, y se cierra igual.
        label: "Cerraron con reemplazo",
        icono: Link2,
        value: fmt(cadenas.cerraronEnReemplazo),
        pista: "la reserva alcanzó la meta del titular",
        destino: "reemplazos",
        },
      {
        label: "Cadenas sin cerrar",
        icono: Link2Off,
        value: fmt(cadenas.abiertas),
        // **La pista dice por qué está abierta, y son dos motivos distintos.**
        // «Ningún eslabón llegó a su meta» acusa de haber fallado; sobre un
        // operativo recién empezado —193 abiertas y 183 sin una sola respuesta—
        // eso convierte trabajo pendiente en fracaso. Cuando todas están sin
        // estrenar se dice eso, y cuando es mezcla se declara el reparto.
        pista: cadenas.sinRespuestaAlguna >= cadenas.abiertas
          ? "todavía sin una sola respuesta"
          : cadenas.sinRespuestaAlguna > 0
            ? `${fmt(cadenas.sinRespuestaAlguna)} sin una sola respuesta · el resto no llegó a su meta`
            : "ningún eslabón llegó a su meta",
        tone: cadenas.abiertas ? "warn" : "neutral",
        detalle: `${fmt(cadenas.cerraronEnTitular)} cerraron con el titular · ${fmt(cadenas.cerraronEnReemplazo)} con un reemplazo · ${fmt(cadenas.sinReserva)} sin reserva asignada`,
        destino: "reemplazos",
        },
      brechasKpi(dashboard),
    ];
  }

  // Avance: cuánto se recogió, cuántos cursos-horario llegaron a su meta y qué
  // falta —en personas y en cursos-horario—.
  // **La cifra sale del motor, no del estado operativo.**
  //
  // Este KPI decia «Cumplen 216 · de 267 cursos-horario con meta» mientras el
  // grafico de cobertura, dos paneles mas abajo y en la misma pantalla, dejaba
  // «Meta cumplida» en CERO. Las dos eran «correctas» bajo definiciones
  // distintas de la misma palabra: el KPI contaba el estado operativo
  // `cerrando`, que el motor define como
  // `operational_status in (aplicada, cerrada) OR validas >= meta` —un OR, asi
  // que basta con haber salido a campo—, y el grafico contaba las que de verdad
  // alcanzaron su `expected_valid`.
  //
  // Un rotulo que promete meta tiene que entregar meta. `course_status_cobertura`
  // ya publica esa cuenta, calculada en el motor sobre TODAS las filas y con el
  // filtro de validez aplicado, asi que se lee de ahi en vez de recomponerla.
  const cobertura = (dashboard?.course_status_cobertura ?? []) as Array<{ clave?: unknown; aulas?: unknown }>;
  // La clave es `pleno` desde el recorte de tramos: `cumplida` significaba DOS
  // cosas —este tramo del aula y el estado de la celda facultad x sexo— y por
  // eso se separaron. Si el motor deja de publicarla, esto da 0 y el rotulo
  // miente en silencio; el test de kpis fija el 7 del fixture para que ese caso
  // falle en vez de pasar desapercibido.
  const cumplen = Number(cobertura.find((c) => c.clave === "pleno")?.aulas ?? 0) || 0;
  // El denominador tambien sale del motor: son las filas con meta, o sea el
  // total menos las que no la declaran. Contarlo sobre `course_status` lo dejaba
  // a merced del recorte a 500 filas.
  const totalDelMotor = Number(dashboard?.course_status_total ?? 0) || 0;
  const sinMeta = Number(dashboard?.course_status_sin_meta ?? 0) || 0;
  // El banco tampoco entra: el motor lo saco del reparto de cobertura por el
  // mismo motivo por el que ya no entraba en `brechas`, asi que el denominador
  // de esta cifra tiene que seguirlo o diria «0 de 267» sobre un reparto de 194.
  const banco = Number(dashboard?.course_status_banco ?? 0) || 0;
  // **El denominador lo publica el motor.** Restarlo aqui obligaba a conocer
  // TODAS las poblaciones que no entran y a acertar con todas: faltaban las
  // reservas de cadena dormidas, que no son banco, y el KPI decia «de 360»
  // sobre un plan de 30 slots con 330 reservas detras — 12 veces el
  // denominador real, en la misma pantalla donde la agenda decia «de 30 que se
  // van a visitar». La resta queda de respaldo para un payload viejo.
  const conMetaDelMotor = Number(dashboard?.course_status_con_meta ?? NaN);
  const conMeta = Number.isFinite(conMetaDelMotor)
    ? conMetaDelMotor
    : Math.max(0, totalDelMotor - sinMeta - banco);
  return [
    // **Las aulas aplicadas van PRIMERO, y antes no estaban.**
    //
    // La banda de Avance abria con «Válidas», que cuenta respuestas de la
    // plataforma. Medido el 2026-08-24 simulando cinco dias de campo —10 aulas
    // aplicadas, 213 efectivas registradas a mano, ninguna respuesta de Kobo
    // todavia—: los cinco KPIs salian en 0 o S/D y la pantalla que se llama
    // «Avance», subtitulada «Cursos-horario **aplicados**, cuotas y brechas»,
    // no enseñaba los aplicados en ninguna parte.
    //
    // El KPI ya existia —`registroKpi`, con su pista «declaradas en el registro
    // de campo»— y se usaba en otra banda. Aqui faltaba, que es donde primero se
    // mira si el operativo arranco.
    //
    // Va primero porque es lo que ocurre ANTES: se aplica el aula, luego llegan
    // las respuestas. La banda cuenta el recorrido en su orden.
    registroKpi(dashboard),
    validasKpi(dashboard),
    {
      label: "Llegaron a su meta",
      icono: Target,
      value: fmt(cumplen),
      // Un conteo sin su denominador no se puede leer: «0» y «0 de 196» dicen lo
      // mismo del numerador y cosas distintas del estudio.
      //
      // Y el denominador son **los que tienen meta declarada**: medido sobre el
      // corte, 234 de las 236 filas de `course_status` la traen —las dos que no,
      // que el propio perfil ya declara en Cuotas—. Con `estado.total` esas dos
      // entraban en el denominador, y «llegar a su meta» no significa nada para
      // una fila que no tiene ninguna.
      //
      // La diferencia es de dos filas, no de cuarenta: la primera version de este
      // comentario decia que los 40 extras no tenian meta y ESO ERA FALSO. La
      // cifra se midio despues de escribirlo.
      pista: conMeta
        ? `de ${fmt(conMeta)} cursos-horario con meta`
        : "cursos-horario que llegaron a su meta",
    },
    cierreKpi(dashboard),
    cuotaKpi(dashboard),
    brechasKpi(dashboard),
  ];
}
