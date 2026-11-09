import type { MonitoreoAulasDashboard, MonitoreoAulasRolYEstado } from "../../../../../api/monitoreo";
import { facultadEnPalabras } from "../../../../../lib/nombresDeFacultad";
import { coberturaPorAula } from "../coberturaPorAula";
import { delMapaPorFacultad } from "../delMapaPorFacultad";
import { estadoPorRol, sinColocar } from "../estadoPorRol";
import { fmt } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";
import { ptsDeBanda, senalesPorAula, tasaEnPct, type AulaMedida } from "../senalesPorAula";
import { claveDeGrupo, type Vacio } from "./porFacultadModelo";

/**
 * Avance › Cursos-horario (ficha A3 de `docs/qa/revamp-monitoreo/aulas.md`),
 * listo para pintar. ¿Cómo rindió cada curso-horario aplicado?
 *
 * - «Cada curso-horario contra su tasa prevista»: el bloque `dos_tasas` del
 *   motor (`monitoreo_aulas_dos_tasas()`), sólo los APLICADOS —los que el motor
 *   contrasta—, ordenados primero lo señalado bajo lo previsto, por encuestas perdidas. La lectura es la
 *   `senal` del motor con nombre en castellano: aquí no se recalcula ninguna
 *   tasa ni ninguna banda (la proyección la hace `senalesPorAula`).
 * - «Titulares»: `course_status_rol_y_estado`, con el reparto que ya nombra
 *   `estadoPorRol`, y las reservas y extras usados.
 * - «Cobertura de lo esperado»: `course_status_cobertura`, los tramos del motor
 *   con su etiqueta.
 *
 * Con el foco en una facultad (`foco=facultad:X`) las tres piezas hablan sólo
 * de ella: la tabla filtra sus filas y los dos bloques de la derecha piden el
 * reparto de esa facultad al motor (`*_por_facultad`), que se calcula sobre el
 * plan entero y no sobre el recorte de 500 filas.
 *
 * Un dato que no llega se dice con su causa, nunca como un 0 que parezca medido.
 */

export const MARCA_CURSOS_HORARIO_AULAS = readinessDeAulas("avance", "cursos");

export type TonoDeLectura = "ok" | "aviso" | "riesgo" | "neutro" | "info";

export type FilaDeCursoHorario = {
  clave: string;
  codigo: string;
  facultad: string;
  elegibles: string;
  efectivas: string;
  /** El parte de campo respaldó la cifra porque la plataforma no trae nada. */
  delParte: boolean;
  prevista: string;
  observada: string;
  /** Ancho de la barra observada, 0–100 (lo que pase de 100 se recorta). */
  relleno: number;
  /** Posición de la marca de la prevista, 0–100; `null` sin prevista. */
  marca: number | null;
  /** La observada pasa de 100 %: la barra se recorta y la cifra lo dice. */
  desborda: boolean;
  lectura: string;
  tono: TonoDeLectura;
  /** Por qué esa lectura: el margen que armó el motor o por qué no lo armó. */
  porQue: string;
  /** Texto para lector de pantalla de la barra. */
  aria: string;
};

export type TablaDeCursos =
  | { tipo: "filas"; sub: string; filas: FilaDeCursoHorario[]; pie: string | null }
  | { tipo: "vacio"; vacio: Vacio };

export type CifraDeTitulares = {
  clave: "aplicado" | "agendado" | "vencido" | "sin_agendar" | "rechazado" | "reemplazado";
  rotulo: string;
  /** La cifra, o «—» cuando el motor no la publica. */
  valor: string;
  aulas: number;
  titulo: string;
};

export type Titulares =
  | {
    tipo: "reparto";
    sub: string;
    total: number;
    cifras: CifraDeTitulares[];
    /** Lo que el reparto no coloca (versión distinta del motor), dicho. */
    sinClasificar: number;
    reservas: { rotulo: string; valor: string; titulo: string };
    extras: { rotulo: string; valor: string; titulo: string };
  }
  | { tipo: "vacio"; vacio: Vacio };

export type TramoDeCoberturaA3 = {
  clave: string;
  etiqueta: string;
  aulas: number;
  /** Ancho de la barra contra el tramo mayor, 0–100. */
  relleno: number;
  tono: "ok" | "medio" | "aviso";
};

export type Cobertura =
  | { tipo: "tramos"; sub: string; tramos: TramoDeCoberturaA3[] }
  | { tipo: "vacio"; vacio: Vacio };

export type ModeloCursosHorario = {
  estado: "sin-tablero" | "listo";
  /** Facultad en foco, ya en palabras; vacío sin foco. */
  enFoco: string;
  tabla: TablaDeCursos;
  titulares: Titulares;
  cobertura: Cobertura;
};

// ---------------------------------------------------------------------------
// La tabla

/**
 * Las señales del motor que se contrastan (el aula aplicada). `pendiente` y
 * `retirada` no entran: la prevista es condicional a aplicarse (B1).
 */
const LECTURAS: Record<string, { lectura: string; tono: TonoDeLectura }> = {
  bajo: { lectura: "Por debajo de lo previsto", tono: "aviso" },
  conforme: { lectura: "Dentro de lo previsto", tono: "ok" },
  sobre: { lectura: "Por encima de lo previsto", tono: "info" },
  descuadre: { lectura: "No cuadra", tono: "riesgo" },
  sin_banda: { lectura: "Pocos elegibles para juzgar", tono: "neutro" },
  sin_previsto: { lectura: "Sin tasa prevista", tono: "neutro" },
  sin_datos: { lectura: "Sin efectivas todavía", tono: "neutro" },
};

const FUERA_DE_LA_TABLA = new Set(["pendiente", "retirada"]);

const POR_QUE: Record<string, string> = {
  sin_banda: "Con tan pocos elegibles el margen sería tan ancho que cualquier cifra saldría dentro; la tasa se enseña sin juzgarla.",
  sin_previsto: "El diseño no publicó una tasa prevista para este curso-horario.",
  sin_datos: "Ni la plataforma ni el parte de campo traen efectivas todavía.",
  descuadre: "Hay más efectivas que elegibles: algún número está mal (atribución, aforo o plataforma).",
};

const pct100 = (tasa: number | null) =>
  tasa == null || !Number.isFinite(tasa) ? null : Math.max(0, tasa * 100);

function porQueDe(a: AulaMedida): string {
  const fijo = POR_QUE[a.senal];
  if (fijo) return fijo;
  const banda = ptsDeBanda(a.banda);
  if (a.senal in LECTURAS) {
    return banda
      ? `Margen de ${banda} alrededor de la prevista, armado con sus elegibles.`
      : "Lectura del motor contra la tasa prevista.";
  }
  return `Señal que esta pantalla no reconoce: "${a.senal || "vacía"}".`;
}

function filaDe(a: AulaMedida): FilaDeCursoHorario {
  const conocida = LECTURAS[a.senal];
  const observada = pct100(a.tasaObservada);
  const prevista = pct100(a.tasaPrevista);
  const lectura = conocida?.lectura ?? (a.senal || "Sin lectura");
  return {
    clave: a.clave,
    codigo: a.codigo,
    facultad: facultadEnPalabras(a.facultad) || "Sin facultad",
    elegibles: a.elegibles == null ? "—" : fmt(a.elegibles),
    efectivas: a.efectivas == null ? "—" : fmt(a.efectivas),
    delParte: a.numerador === "parte" && a.efectivas != null,
    prevista: tasaEnPct(a.tasaPrevista),
    observada: tasaEnPct(a.tasaObservada),
    relleno: observada == null ? 0 : Math.min(100, observada),
    marca: prevista == null ? null : Math.min(100, prevista),
    desborda: observada != null && observada > 100,
    lectura,
    tono: conocida?.tono ?? "neutro",
    porQue: porQueDe(a),
    aria: `Observada ${tasaEnPct(a.tasaObservada)}, prevista ${tasaEnPct(a.tasaPrevista)}`,
  };
}

/**
 * Cuántas encuestas se perdieron contra lo previsto: elegibles × (prevista −
 * observada). Es lo que pesa para operar: un aula de 5 elegibles a −35 puntos
 * pierde menos que una de 80 a −20 (revisor-metodológico, 2026-10-31). Sin las
 * dos tasas o sin elegibles no tiene posición.
 */
const perdidas = (a: AulaMedida): number | null =>
  a.tasaObservada != null && a.tasaPrevista != null && a.elegibles != null
    ? a.elegibles * (a.tasaPrevista - a.tasaObservada)
    : null;

/** El orden de la señal del motor: primero lo que se aleja con evidencia. */
const RANGO_SENAL: Record<string, number> = { bajo: 0, descuadre: 1, sobre: 2, conforme: 3, sin_banda: 4 };

/**
 * Primero por la señal del motor (bajo lo previsto con evidencia, luego el
 * resto) y dentro de cada señal por encuestas perdidas, de más a menos. Los que
 * no tienen las dos tasas van al final, en el orden del plan. `sort` es estable.
 */
export function ordenarPorDesvio(aulas: readonly AulaMedida[]): AulaMedida[] {
  return aulas
    .map((a, i) => ({ a, i, p: perdidas(a), r: RANGO_SENAL[a.senal] ?? 5 }))
    .sort((x, y) => {
      if (x.p == null && y.p == null) return x.i - y.i;
      if (x.p == null) return 1;
      if (y.p == null) return -1;
      return x.r - y.r || y.p - x.p || x.i - y.i;
    })
    .map((x) => x.a);
}

const mismaFacultad = (a: string, b: string) => claveDeGrupo(a) === claveDeGrupo(b);

function tablaDe(dashboard: MonitoreoAulasDashboard, foco: string): TablaDeCursos {
  const res = senalesPorAula(dashboard.dos_tasas);
  if (res.estado === "sin_bloque") {
    return {
      tipo: "vacio",
      vacio: {
        clase: "desconexion",
        causa: "Este tablero se calculó con una versión anterior, que no publica la tasa de cada curso-horario. Actualiza para recalcularlo.",
      },
    };
  }
  if (res.estado === "sin_cursos") {
    return {
      tipo: "vacio",
      vacio: { clase: "legitimo", causa: "El plan todavía no trae cursos-horario que medir." },
    };
  }
  const todas = [
    ...res.senalados, ...res.conformes, ...res.descuadres,
    ...res.sinMedir.flatMap((g) => g.aulas), ...res.pendientes, ...res.retiradas, ...res.desconocidos,
  ];
  const delFoco = foco ? todas.filter((a) => mismaFacultad(a.facultad, foco)) : todas;
  const aplicadas = delFoco.filter((a) => !FUERA_DE_LA_TABLA.has(a.senal));
  const pendientes = delFoco.filter((a) => a.senal === "pendiente").length;
  const retiradas = delFoco.filter((a) => a.senal === "retirada").length;
  const donde = foco ? ` de ${facultadEnPalabras(foco)}` : "";

  if (!aplicadas.length) {
    if (foco && !delFoco.length) {
      return {
        tipo: "vacio",
        vacio: { clase: "legitimo", causa: `El sorteo no dejó cursos-horario en ${facultadEnPalabras(foco)}.` },
      };
    }
    const espera = pendientes > 0
      ? `: ${fmt(pendientes)} ${pendientes === 1 ? "espera" : "esperan"} su aplicación`
      : "";
    return {
      tipo: "vacio",
      vacio: {
        clase: "legitimo",
        causa: `Todavía no se ha aplicado ningún curso-horario${donde}${espera}. La tasa prevista sólo se contrasta en los aplicados.`,
      },
    };
  }

  const fuera = [
    pendientes > 0 ? `${fmt(pendientes)} sin aplicar todavía` : "",
    retiradas > 0
      ? `${fmt(retiradas)} que ya no se aplicarán por esta vía (reemplazados, cancelados, sin acceso o con rechazo)`
      : "",
  ].filter(Boolean);
  return {
    tipo: "filas",
    sub: `${fmt(aplicadas.length)} ${aplicadas.length === 1 ? "aplicado" : "aplicados"}${donde}, primero lo señalado bajo lo previsto, por encuestas perdidas`,
    filas: ordenarPorDesvio(aplicadas).map(filaDe),
    pie: fuera.length ? `No entran ${fuera.join(" y ")}: la tasa prevista sólo se contrasta en los aplicados.` : null,
  };
}

// ---------------------------------------------------------------------------
// Titulares

function bloqueDeRol(dashboard: MonitoreoAulasDashboard, foco: string): MonitoreoAulasRolYEstado | null {
  return foco
    ? delMapaPorFacultad(dashboard.course_status_rol_y_estado_por_facultad, foco)
    : dashboard.course_status_rol_y_estado ?? null;
}

function usadosDe(usados: number, total: number, que: "reservas" | "extras") {
  const rotulo = que === "reservas"
    ? `Reservas usadas de ${fmt(total)}`
    : `Extras usados de ${fmt(total)}`;
  if (total <= 0) {
    return {
      rotulo: que === "reservas" ? "Reservas usadas" : "Extras usados",
      valor: "—",
      titulo: que === "reservas"
        ? "El sorteo no dejó reservas de cadena aquí."
        : "El sorteo no dejó banco de extras aquí.",
    };
  }
  return {
    rotulo,
    valor: fmt(usados),
    titulo: que === "reservas"
      ? "Reservas de cadena que ya entraron a cubrir a su titular."
      : "Aulas del banco de extras que se llamaron para cerrar una cuota.",
  };
}

function titularesDe(dashboard: MonitoreoAulasDashboard, foco: string): Titulares {
  const grupos = estadoPorRol(dashboard, foco || undefined);
  if (!grupos) {
    return {
      tipo: "vacio",
      vacio: foco
        ? { clase: "legitimo", causa: `El sorteo no dejó cursos-horario en ${facultadEnPalabras(foco)}.` }
        : {
          clase: "desconexion",
          causa: "Este tablero se calculó con una versión anterior, que todavía no reparte los cursos-horario por rol. Actualiza para recalcularlo.",
        },
    };
  }
  const titulares = grupos.find((g) => g.clave === "titulares");
  const reemplazos = grupos.find((g) => g.clave === "reemplazos");
  const banco = grupos.find((g) => g.clave === "banco");
  const aulasDe = (...claves: string[]) =>
    (titulares?.tramos ?? []).filter((t) => claves.includes(t.clave)).reduce((s, t) => s + t.aulas, 0);
  const t = bloqueDeRol(dashboard, foco)?.titulares ?? {};
  const vencidoPublicado = typeof t.agendado_vencido === "number" && Number.isFinite(t.agendado_vencido);
  const sinAgenda = typeof t.aplicado_sin_agenda === "number" ? t.aplicado_sin_agenda : null;

  const aplicados = aulasDe("aplicado", "aplicado_sin_agenda");
  const cifras: CifraDeTitulares[] = [
    {
      clave: "aplicado", rotulo: "Aplicados", aulas: aplicados, valor: fmt(aplicados),
      titulo: sinAgenda && sinAgenda > 0
        ? `Ya se visitaron; ${fmt(sinAgenda)} sin fecha en el libro.`
        : "Ya se visitaron; al curso-horario se va una sola vez.",
    },
    {
      // 2g: las citas que pasaron después de la última descarga siguen aquí,
      // sin juzgar, para que las cifras sumen el total.
      clave: "agendado", rotulo: "Agendados", aulas: aulasDe("agendado", "agendado_tras_corte"),
      valor: fmt(aulasDe("agendado", "agendado_tras_corte")),
      titulo: aulasDe("agendado_tras_corte") > 0
        ? `Tienen fecha y todavía no se han visitado; ${fmt(aulasDe("agendado_tras_corte"))} con la fecha pasada después de la última sincronización: trae respuestas para saber si se aplicaron.`
        : "Tienen fecha por delante y todavía no se han visitado.",
    },
    vencidoPublicado
      ? {
        clave: "vencido", rotulo: "Vencidos", aulas: aulasDe("agendado_vencido"), valor: fmt(aulasDe("agendado_vencido")),
        titulo: "Su fecha ya pasó y no llegó ninguna respuesta hasta la última sincronización.",
      }
      : {
        clave: "vencido", rotulo: "Vencidos", aulas: 0, valor: "—",
        titulo: "El plan no trae la fecha agendada, así que no se puede saber qué cita ya pasó.",
      },
    {
      clave: "sin_agendar", rotulo: "Sin cita", aulas: aulasDe("sin_agendar"), valor: fmt(aulasDe("sin_agendar")),
      titulo: "Todavía no tienen fecha: hay que llamar al docente.",
    },
    {
      clave: "rechazado", rotulo: "Rechazo", aulas: aulasDe("rechazado"), valor: fmt(aulasDe("rechazado")),
      titulo: "El docente dijo que no; pasa a su reemplazo de cadena.",
    },
    {
      clave: "reemplazado", rotulo: "Reemplazados", aulas: aulasDe("reemplazado"), valor: fmt(aulasDe("reemplazado")),
      titulo: "Cayeron y su reserva tomó el relevo.",
    },
  ];
  const total = titulares?.total ?? 0;
  const reservaUsada = (reemplazos?.tramos ?? [])
    .filter((x) => x.clave === "utilizado" || x.clave === "utilizado_sin_agenda")
    .reduce((s, x) => s + x.aulas, 0);
  const extraUsado = (banco?.tramos ?? []).find((x) => x.clave === "utilizado")?.aulas ?? 0;
  return {
    tipo: "reparto",
    sub: foco ? `${fmt(total)} del sorteo en ${facultadEnPalabras(foco)}` : `${fmt(total)} del sorteo`,
    total,
    cifras,
    sinClasificar: titulares ? sinColocar(titulares) : 0,
    reservas: usadosDe(reservaUsada, reemplazos?.total ?? 0, "reservas"),
    extras: usadosDe(extraUsado, banco?.total ?? 0, "extras"),
  };
}

// ---------------------------------------------------------------------------
// Cobertura de lo esperado

/** De lo que llegó a lo que no llegó: el orden en que se lee la ficha. */
const ORDEN_DE_COBERTURA = ["pleno", "satisfactorio", "parcial", "insuficiente", "critico", "nulo"];

const TONO_DE_COBERTURA: Record<string, TramoDeCoberturaA3["tono"]> = {
  pleno: "ok",
  satisfactorio: "ok",
  parcial: "medio",
  insuficiente: "aviso",
  critico: "aviso",
  nulo: "aviso",
};

type TramoCrudo = { clave?: unknown; aulas?: unknown; etiqueta?: unknown };

function coberturaDe(dashboard: MonitoreoAulasDashboard, foco: string): Cobertura {
  const deLaFacultad = foco
    ? delMapaPorFacultad(dashboard.course_status_cobertura_por_facultad, foco)
    : null;
  const crudo: unknown = foco ? deLaFacultad?.cobertura : dashboard.course_status_cobertura;
  if (!Array.isArray(crudo)) {
    return {
      tipo: "vacio",
      vacio: foco && !deLaFacultad
        ? { clase: "legitimo", causa: `El sorteo no dejó cursos-horario con meta en ${facultadEnPalabras(foco)}.` }
        : {
          clase: "desconexion",
          causa: "Este tablero se calculó con una versión anterior, que no reparte la cobertura de cada curso-horario. Actualiza para recalcularlo.",
        },
    };
  }
  // Las etiquetas son las del motor; el respaldo local es la misma redacción
  // (`coberturaPorAula`), por si un payload viejo no la trae.
  const respaldo = new Map(coberturaPorAula([]).tramos.map((t) => [t.clave, t.etiqueta]));
  const porClave = new Map<string, { aulas: number; etiqueta: string }>();
  for (const item of crudo as TramoCrudo[]) {
    const clave = typeof item?.clave === "string" ? item.clave : "";
    if (!clave) continue;
    const aulas = Number(item.aulas);
    const etiqueta = typeof item.etiqueta === "string" && item.etiqueta.trim() ? item.etiqueta.trim() : "";
    porClave.set(clave, { aulas: Number.isFinite(aulas) && aulas > 0 ? Math.round(aulas) : 0, etiqueta });
  }
  // Las claves que esta pantalla no conoce se enseñan al final con su nombre:
  // una lista cerrada que se traga lo que no reconoce es el defecto más caro.
  const claves = [...ORDEN_DE_COBERTURA, ...[...porClave.keys()].filter((k) => !ORDEN_DE_COBERTURA.includes(k))];
  const base = claves.map((clave) => {
    const dato = porClave.get(clave);
    return {
      clave,
      etiqueta: dato?.etiqueta || respaldo.get(clave) || clave,
      aulas: dato?.aulas ?? 0,
      tono: TONO_DE_COBERTURA[clave] ?? ("aviso" as const),
    };
  });
  const total = base.reduce((s, t) => s + t.aulas, 0);
  if (total === 0) {
    const sinAplicar = foco ? Number(deLaFacultad?.sin_aplicar) : Number(dashboard.course_status_sin_aplicar);
    const espera = Number.isFinite(sinAplicar) && sinAplicar > 0
      ? `: ${fmt(sinAplicar)} ${sinAplicar === 1 ? "espera" : "esperan"} su aplicación`
      : "";
    return {
      tipo: "vacio",
      vacio: {
        clase: "legitimo",
        causa: `Todavía no se ha aplicado ningún curso-horario con meta${foco ? ` en ${facultadEnPalabras(foco)}` : ""}${espera}.`,
      },
    };
  }
  const mayor = Math.max(...base.map((t) => t.aulas));
  return {
    tipo: "tramos",
    sub: `${fmt(total)} cursos-horario aplicados con meta`,
    tramos: base.map((t) => ({ ...t, relleno: mayor > 0 ? Math.round((1000 * t.aulas) / mayor) / 10 : 0 })),
  };
}

// ---------------------------------------------------------------------------

/**
 * El modelo de la pestaña. `foco` es el valor de `foco=facultad:X`; otro tipo
 * de foco (nivel, sexo) no filtra cursos-horario y llega vacío.
 */
export function construirCursosHorario(
  dashboard: MonitoreoAulasDashboard | null,
  foco = "",
): ModeloCursosHorario {
  const enFoco = foco.trim();
  if (!dashboard) {
    const vacio: Vacio = { clase: "desconexion", causa: "Sin tablero." };
    return {
      estado: "sin-tablero",
      enFoco: "",
      tabla: { tipo: "vacio", vacio },
      titulares: { tipo: "vacio", vacio },
      cobertura: { tipo: "vacio", vacio },
    };
  }
  return {
    estado: "listo",
    enFoco: enFoco ? facultadEnPalabras(enFoco) : "",
    tabla: tablaDe(dashboard, enFoco),
    titulares: titularesDe(dashboard, enFoco),
    cobertura: coberturaDe(dashboard, enFoco),
  };
}

/**
 * La marca de readiness: `false` sólo mientras carga, la dirección cuando pintó
 * y `vacio:<motivo>` en un terminal sin contenido, para no colgar la captura
 * (readinessAnidada).
 */
export function readinessDeCursosHorario(modelo: ModeloCursosHorario | null, cargando: boolean): string {
  if (cargando || !modelo) return "false";
  if (modelo.estado === "listo") return MARCA_CURSOS_HORARIO_AULAS;
  return `vacio:${modelo.estado}`;
}
