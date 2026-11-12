/**
 * Reglas de fechas y horas: "Fecha fuera del operativo" (`rango_fecha`) y "Dos
 * fechas u horas que deben cuadrar" (`comparar_fechas`). Motor:
 * `api/R/validacion_regla_fechas.R`.
 *
 * Un momento es lo que se lee: una pregunta con la fecha o la hora entera (con
 * su formato, o "auto"), o varias preguntas que la arman (día, mes y año; hora
 * y minutos; hora, minutos y a.m./p.m.). Las listas de formatos y partes son
 * las del motor; el esquema rechaza cualquier otra con `E_REGLA_FECHAS_*`.
 */
import { formatoConteo } from "../../../lib/formatoNumero";
import type { LecturaDeFechas, ResumenDeFechas } from "../../../api/validacionAuditoria";
import { nullableNumber, paramList } from "./modeloRegla";

export type UnidadDeFechas = "fecha" | "hora";
export type PatronDeFechas = "orden" | "duracion";
export type PartesDeMomento = "una" | "dia_mes_anio" | "hora_minutos" | "hora_minutos_ampm";

/** Mismo orden que `.REGLA_FECHAS_FORMATOS_FECHA` del motor. */
export const FORMATOS_DE_FECHA = ["aaaa-mm-dd", "dd/mm/aaaa", "dd.mm.aaaa", "dd-mm-aaaa", "dd/mm/aa", "dd.mm.aa", "dd-mm-aa", "mm/dd/aaaa"] as const;
export const FORMATOS_DE_HORA = ["hh:mm", "hh.mm", "hh:mm a.m./p.m.", "aaaa-mm-dd hh:mm"] as const;

export const PARTES_POR_UNIDAD: Readonly<Record<UnidadDeFechas, readonly PartesDeMomento[]>> = {
  fecha: ["una", "dia_mes_anio"],
  hora: ["una", "hora_minutos", "hora_minutos_ampm"],
};

export const N_PARTES: Readonly<Record<PartesDeMomento, number>> = { una: 1, dia_mes_anio: 3, hora_minutos: 2, hora_minutos_ampm: 3 };

/** El rótulo de cada pregunta de un momento repartido, en su orden. */
export const ROTULOS_DE_PARTES: Readonly<Record<PartesDeMomento, readonly string[]>> = {
  una: ["Pregunta"],
  dia_mes_anio: ["Día", "Mes", "Año"],
  hora_minutos: ["Hora", "Minutos"],
  hora_minutos_ampm: ["Hora", "Minutos", "a.m./p.m."],
};

export const ROTULO_DE_PARTES: Readonly<Record<PartesDeMomento, string>> = {
  una: "Una pregunta",
  dia_mes_anio: "Día, mes y año",
  hora_minutos: "Hora y minutos",
  hora_minutos_ampm: "Hora, minutos y a.m./p.m.",
};

export type Momento = {
  variables: string[];
  partes: PartesDeMomento;
  formato: string;
  am: string[];
  pm: string[];
};

export function unidadDeFechas(valor: unknown): UnidadDeFechas {
  return valor === "hora" ? "hora" : "fecha";
}

export function patronDeFechas(valor: unknown): PatronDeFechas {
  return valor === "duracion" ? "duracion" : "orden";
}

function partesDe(valor: unknown, unidad: UnidadDeFechas): PartesDeMomento {
  return PARTES_POR_UNIDAD[unidad].find((p) => p === valor) ?? "una";
}

function registroDe(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

/** Un momento de `comparar_fechas` (`params.inicio` o `params.fin`). */
export function momentoDe(valor: unknown, unidad: UnidadDeFechas): Momento {
  const r = registroDe(valor);
  const partes = partesDe(r.partes, unidad);
  const variables = Array.isArray(r.variables) ? r.variables.map((v) => (typeof v === "string" ? v : "")) : [];
  while (variables.length < N_PARTES[partes]) variables.push("");
  return {
    variables: variables.slice(0, N_PARTES[partes]),
    partes,
    formato: typeof r.formato === "string" && r.formato ? r.formato : "auto",
    am: paramList(r.am),
    pm: paramList(r.pm),
  };
}

/** El momento de "Fecha fuera del operativo": sus preguntas son las de la regla. */
export function momentoDeRango(params: Record<string, unknown>, variables: readonly string[]): Momento {
  const partes = partesDe(params.partes, "fecha");
  const vars = [...variables];
  while (vars.length < N_PARTES[partes]) vars.push("");
  return { variables: vars.slice(0, N_PARTES[partes]), partes, formato: typeof params.formato === "string" && params.formato ? params.formato : "auto", am: [], pm: [] };
}

function momentoParaGuardar(m: Momento): Record<string, unknown> {
  return {
    variables: m.variables,
    partes: m.partes,
    ...(m.partes === "una" ? { formato: m.formato } : {}),
    ...(m.partes === "hora_minutos_ampm" ? { am: m.am, pm: m.pm } : {}),
  };
}

/** Las preguntas de una regla `comparar_fechas`: las del inicio y luego las del fin, como exige el motor. */
export function variablesDeComparar(params: Record<string, unknown>): string[] {
  const unidad = unidadDeFechas(params.unidad);
  return [...momentoDe(params.inicio, unidad).variables, ...momentoDe(params.fin, unidad).variables];
}

/** Los parámetros de `comparar_fechas` como los espera el motor: solo los del patrón elegido. */
export function paramsDeComparar(params: Record<string, unknown>): Record<string, unknown> {
  const unidad = unidadDeFechas(params.unidad);
  const patron = patronDeFechas(params.patron);
  const minimo = nullableNumber(params.minimo);
  const maximo = nullableNumber(params.maximo);
  return {
    unidad,
    patron,
    inicio: momentoParaGuardar(momentoDe(params.inicio, unidad)),
    fin: momentoParaGuardar(momentoDe(params.fin, unidad)),
    ...(patron === "duracion" && minimo !== null ? { minimo } : {}),
    ...(patron === "duracion" && maximo !== null ? { maximo } : {}),
    marcar_ilegibles: params.marcar_ilegibles !== false,
  };
}

function validarMomento(m: Momento, cual: string): string {
  if (m.variables.some((v) => !v)) return `Elige ${m.partes === "una" ? "la pregunta" : "todas las preguntas"} ${cual}.`;
  const codigos = new Set(m.am);
  if (m.pm.some((c) => codigos.has(c))) return `Un código ${cual} no puede valer a.m. y p.m. a la vez.`;
  return "";
}

/** El primer problema de una regla de fechas, o "" si se puede guardar. Mismos límites que el esquema del motor. */
export function validarFechas(tipo: "rango_fecha" | "comparar_fechas", params: Record<string, unknown>, variables: readonly string[]): string {
  if (tipo === "rango_fecha") {
    const m = momentoDeRango(params, variables);
    return validarMomento(m, "de la fecha");
  }
  const unidad = unidadDeFechas(params.unidad);
  const error = validarMomento(momentoDe(params.inicio, unidad), "del inicio") || validarMomento(momentoDe(params.fin, unidad), "del fin");
  if (error) return error;
  if (patronDeFechas(params.patron) === "duracion") {
    const minimo = nullableNumber(params.minimo);
    const maximo = nullableNumber(params.maximo);
    if (minimo === null && maximo === null) return "Define la duración mínima, la máxima o ambas.";
    if (minimo !== null && maximo !== null && minimo > maximo) return "La duración mínima no puede ser mayor que la máxima.";
  }
  return "";
}

/** "08/10/2026": una fecha del motor ("2026-10-08") como se lee en es-PE. */
export function fechaMostrada(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? "";
}

export function unidadDeDuracion(unidad: UnidadDeFechas, valor: number | null): string {
  const uno = valor !== null && Math.abs(valor) === 1;
  if (unidad === "hora") return uno ? "minuto" : "minutos";
  return uno ? "día" : "días";
}

function leido(lado: ResumenDeFechas["inicio"], unidad: UnidadDeFechas): string {
  if (!lado.texto) return "";
  return unidad === "hora" ? lado.texto : fechaMostrada(lado.texto);
}

/**
 * Lo que se ve de un caso en "Casos que marca hoy": lo leído y por qué marca.
 * Sale de la medida del motor (`fechas` del ejemplo), no se recalcula aquí.
 */
export function textoDeFechas(r: ResumenDeFechas): string {
  const lados = r.fin ? [r.inicio, r.fin] : [r.inicio];
  if (r.motivo === "ilegible") {
    const malo = lados.find((l) => l.estado === "ilegible" || l.estado === "incompleta") ?? r.inicio;
    if (malo.estado === "incompleta") return `Incompleta ("${malo.original ?? ""}")`;
    return `"${malo.original ?? ""}" no se puede leer`;
  }
  const ini = leido(r.inicio, r.unidad);
  const conOriginal = (l: ResumenDeFechas["inicio"], texto: string) =>
    l.original && l.original !== texto ? `"${l.original}" (${texto})` : texto;
  if (r.motivo === "antes") return `${conOriginal(r.inicio, ini)}, antes del inicio`;
  if (r.motivo === "despues") return `${conOriginal(r.inicio, ini)}, después del cierre`;
  const fin = r.fin ? leido(r.fin, r.unidad) : "";
  if (r.motivo === "orden") return `Fin ${fin}, antes del inicio ${ini}`;
  if (r.diferencia === null) return "Sin dato";
  return `${formatoConteo(r.diferencia)} ${unidadDeDuracion(r.unidad, r.diferencia)} (${ini} a ${fin})`;
}

function conteo(n: number, singular: string, plural: string): string {
  return `${formatoConteo(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Cómo se leyó un momento sobre las filas que evalúa la auditoría: "se leyó
 * como dd.mm.aaaa en 995 de 1000 respuestas; 1 no se pudo leer y 4 están
 * vacías". La base son todas las filas evaluadas (`n_filas`), sin el filtro.
 */
export function textoDeLectura(l: LecturaDeFechas): string {
  const formatos = l.formatos.map((f) => (l.formatos.length > 1 ? `${f.formato} (${formatoConteo(f.n)})` : f.formato));
  const como = l.partes === "una"
    ? formatos.length ? `se leyó como ${formatos.join(" y ")}` : "no se leyó ninguna"
    : `se armó con ${ROTULO_DE_PARTES[l.partes as PartesDeMomento]?.toLowerCase() ?? l.partes}`;
  const resto: string[] = [];
  if (l.n_incompletas) resto.push(conteo(l.n_incompletas, "incompleta", "incompletas"));
  if (l.n_ilegibles) resto.push(`${formatoConteo(l.n_ilegibles)} no se ${l.n_ilegibles === 1 ? "pudo" : "pudieron"} leer`);
  if (l.n_vacias) resto.push(conteo(l.n_vacias, "vacía", "vacías"));
  const cola = resto.length > 1 ? `${resto.slice(0, -1).join(", ")} y ${resto[resto.length - 1]}` : resto[0];
  const leidas = l.n_leidas || l.partes !== "una" ? ` en ${formatoConteo(l.n_leidas)} de ${conteo(l.n_filas, "respuesta", "respuestas")}` : "";
  return `${como}${leidas}${cola ? `; ${cola}` : ""}.`;
}
