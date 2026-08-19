import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../api/monitoreo";
import type { MonitoreoSeccion } from "../../core/monitoreoRegistry";
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Link2,
  Link2Off,
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
 * Un puntaje 0-100 se escribe «93 de 100», nunca «93 %».
 *
 * El símbolo de porcentaje pide una población de la que ese 93 sea una parte, y
 * aquí no la hay: es un índice de desvío contra la muestra planificada.
 */
function puntajeSobreCien(value: unknown) {
  const n = value == null || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? `${Math.round(n)} de 100` : "S/D";
}
import { summarizeAulasValidation } from "./aulasPresentation";
import { cuotasResumen } from "./cuotasResumen";
import { estadoDeAplicacion } from "./estadoDeAplicacion";
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
};

export function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

/** Sólo la fecha del sello ISO del tablero; la hora no decide nada. */
function fecha(iso: unknown) {
  const texto = typeof iso === "string" ? iso.trim() : "";
  if (!texto) return "";
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
    detalle: cuota.celdas
      ? `${fmt(cuota.logrado)} de ${fmt(cuota.meta)} personas · ${fmt(cuota.celdasCumplidas)} de ${fmt(cuota.celdas)} celdas cumplidas · lo que falta se suma celda a celda`
      : "el plan no declara cuotas de sexo por facultad",
  };
}

/** El plan importado: la tarjeta que abre casi todas las secciones. */
function planKpi(dashboard: MonitoreoAulasDashboard | null): AulasKpi {
  const total = Number(dashboard?.kpis?.total_aulas ?? 0);
  return {
    label: "Cursos-horario",
    icono: CalendarRange,
    value: fmt(total),
    // «reservas del plan» era ambiguo y producia dos cifras sin explicacion en la
    // misma pantalla: este KPI dice 196 y la tarjeta del libro 236. La
    // diferencia son las aulas EXTRA —las que no cuelgan de ningun titular—, que
    // tambien son reservas pero no forman cadena y viven en su propia pestaña.
    // El rotulo dice ahora cual de las dos cuenta.
    pista: "titulares y sus reservas encadenadas",
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
    label: "Aplicadas",
    icono: ClipboardCheck,
    value: fmt(dashboard?.kpis?.aulas_aplicadas),
    pista: "declaradas en el registro de campo",
    detalle: "Las declara el aplicador al registrar la aplicación; no se derivan de las respuestas recibidas.",
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
    label: "Brechas",
    icono: AlertCircle,
    value: fmt(brechas),
    pista: porFacultad.size
      ? `cursos-horario en ${fmt(porFacultad.size)} ${porFacultad.size === 1 ? "facultad" : "facultades"}`
      : "cursos-horario por debajo de su meta",
    detalle: mayor
      ? `La mayor es ${mayor[0]}, con ${fmt(mayor[1])} respuestas por recoger. El corte de `
        + `\`course_status\` puede venir recortado, así que el reparto por facultad se lee como orden de magnitud.`
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
  return {
    label: "Válidas",
    icono: CheckCircle2,
    value: fmt(dashboard?.kpis?.respuestas_validas),
    pista: validas > 0 && atribuidas === 0
      ? "de Kobo · ninguna atribuida a un curso-horario"
      : "respuestas de Kobo que pasan el filtro",
    detalle: validas > 0 && atribuidas === 0
      ? "Sin atribución no se pueden repartir por facultad ni por sexo, así que no cuentan para ninguna cuota."
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
): AulasKpi[] {
  const kpis = dashboard?.kpis;

  if (seccion === "fuentes") {
    // De dónde viene todo: el plan, lo que se leyó y cuándo se calculó. Es la
    // misma tríada que telefónico pone en su sección de fuentes.
    const sello = fecha(dashboard?.generated_at);
    return [
      planKpi(dashboard),
      {
        label: "Respuestas leídas",
        icono: Table2,
        value: fmt(kpis?.respuestas_total),
        pista: "filas que llegaron de la plataforma",
      },
      {
        label: "Corte",
        icono: RefreshCw,
        value: sello ? "Listo" : "Pendiente",
        pista: sello || "todavía sin tablero generado",
        tone: sello ? "neutral" : "warn",
      },
    ];
  }

  if (seccion === "modelo") {
    // La sección de la agenda y el registro: cuántas hay, cuántas se
    // registraron y cuántas no han recibido ni una respuesta.
    const estado = estadoDeAplicacion((dashboard?.course_status ?? []) as MonitoreoAulasPlanRow[]);
    return [
      planKpi(dashboard),
      registroKpi(dashboard),
      {
        label: "Sin empezar",
        icono: AlertCircle,
        value: fmt(estado.sinSalirACampo),
        pista: "agendadas que aún no salen a campo",
        tone: estado.sinSalirACampo ? "warn" : "neutral",
      },
    ];
  }

  if (seccion === "calidad") {
    const controles = (dashboard?.validation ?? []) as Array<Record<string, unknown>>;
    const alertas = summarizeAulasValidation(controles);
    return [
      { label: "Controles", icono: ClipboardCheck, value: fmt(controles.length), pista: "reglas evaluadas sobre este corte" },
      {
        label: "Alertas",
        icono: ShieldAlert,
        value: fmt(alertas.count),
        pista: "controles que no pasan",
        tone: alertas.count ? "warn" : "neutral",
      },
      {
        // Un PUNTAJE, no un porcentaje. El backend lo llama
        // `representativity_effective_score` y el control lo enseña como
        // «Puntaje 93.1 de 100»; el tile lo pintaba «93 %» con la pista «la
        // muestra efectiva contra la planificada», que se lee como «se consiguió
        // el 93 % de lo planificado». No es eso: mide cuánto se DESVÍA la
        // muestra efectiva de la planificada —0.3 pp de media en este corte—.
        // Con las 3 700 respuestas sin colgar de ninguna aula del plan y CUMPLEN
        // en 0, un «93 %» ahí es tranquilizador y falso.
        label: "Representatividad",
        icono: Target,
        value: puntajeSobreCien(kpis?.representativity_effective_score),
        pista: "puntaje: 100 es idéntica a la planificada",
        detalle: "Mide cuánto se desvía la muestra efectiva de la planificada: 100 es idéntica y 0 es un desvío medio de 5 puntos o más. No es la parte de la muestra que se consiguió.",
      },
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
      },
      {
        label: "Cadenas sin cerrar",
        icono: Link2Off,
        value: fmt(cadenas.abiertas),
        pista: "ningún eslabón llegó a su meta",
        tone: cadenas.abiertas ? "warn" : "neutral",
        detalle: `${fmt(cadenas.cerraronEnTitular)} cerraron con el titular · ${fmt(cadenas.cerraronEnReemplazo)} con un reemplazo · ${fmt(cadenas.sinReserva)} sin reserva asignada`,
      },
      brechasKpi(dashboard),
    ];
  }

  // Avance: cuánto se recogió, cuántos cursos-horario llegaron a su meta y qué
  // falta —en personas y en cursos-horario—.
  const estado = estadoDeAplicacion((dashboard?.course_status ?? []) as MonitoreoAulasPlanRow[]);
  const cumplen = estado.estados.find((e) => e.clave === "cerrando")?.aulas ?? 0;
  return [
    validasKpi(dashboard),
    {
      label: "Cumplen",
      icono: Target,
      value: fmt(cumplen),
      // Un conteo sin su denominador no se puede leer: «0» y «0 de 196» dicen lo
      // mismo del numerador y cosas distintas del estudio.
      pista: estado.total
        ? `de ${fmt(estado.total)} cursos-horario del plan`
        : "cursos-horario que llegaron a su meta",
    },
    cuotaKpi(dashboard),
    brechasKpi(dashboard),
  ];
}
