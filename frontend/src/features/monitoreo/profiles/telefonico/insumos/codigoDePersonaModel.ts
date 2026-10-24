/**
 * La pregunta de la encuesta que trae el código de la persona (RMS: la
 * respuesta de Kobo `intro/Intro01`, «Código proGres»). Se elige por fuente de
 * respuestas y se guarda en `declared_person_code_var` (y su etiqueta en
 * `declared_person_code_label`). Las opciones son las columnas que el motor
 * publica por fuente (`source_metadata.variables_by_source`), con etiqueta,
 * ejemplos y cobertura.
 */
import type { MonitoreoSource, MonitoreoSourceVariableStat } from "../../../../../api/client";

export type OpcionDeCodigo = {
  nombre: string;
  etiqueta: string;
  ejemplos: string[];
  conValor: number;
  total: number;
  sugerida: boolean;
};

export type EstadoDelCodigo = {
  opciones: OpcionDeCodigo[];
  /** La pregunta elegida hoy: la declarada o, si no hay, la que el motor marca. */
  actual: string;
  /** Cómo se llegó a `actual`. */
  origen: "declarada" | "detectada" | "sugerida" | "ninguna";
};

const PATRON_DE_CODIGO = /progres|cod[_\s.-]*pulso|c[oó]digo|\bcod\b|id[_\s-]*persona/i;
const INTERNAS = /^(_|\.|meta\/|formhub|__version__|start$|end$|today$|deviceid$)/i;

export function opcionesDeCodigo(stats: readonly MonitoreoSourceVariableStat[] = []): OpcionDeCodigo[] {
  return stats
    .filter((stat) => stat.name && !INTERNAS.test(stat.name))
    .map((stat) => ({
      nombre: stat.name,
      etiqueta: stat.label && stat.label !== stat.name ? stat.label : "",
      ejemplos: (stat.examples ?? []).slice(0, 3),
      conValor: stat.non_empty ?? 0,
      total: stat.total ?? 0,
      sugerida: PATRON_DE_CODIGO.test(stat.name) || PATRON_DE_CODIGO.test(stat.label ?? ""),
    }))
    .sort((a, b) => Number(b.sugerida) - Number(a.sugerida) || b.conValor - a.conValor || a.nombre.localeCompare(b.nombre, "es"));
}

/** La sugerencia por nombre o etiqueta: primero proGres y CodPulso, luego «código». */
export function codigoSugerido(opciones: readonly OpcionDeCodigo[]) {
  const peso = (opcion: OpcionDeCodigo) => {
    const texto = `${opcion.nombre} ${opcion.etiqueta}`;
    if (/progres/i.test(texto)) return 3;
    if (/cod[_\s.-]*pulso/i.test(texto)) return 2;
    return opcion.sugerida ? 1 : 0;
  };
  const mejor = [...opciones].sort((a, b) => peso(b) - peso(a) || b.conValor - a.conValor)[0];
  return mejor && peso(mejor) > 0 ? mejor.nombre : "";
}

export function estadoDelCodigo(fuente: MonitoreoSource, stats: readonly MonitoreoSourceVariableStat[] = []): EstadoDelCodigo {
  const opciones = opcionesDeCodigo(stats);
  const declarada = String(fuente.declared_person_code_var ?? "").trim();
  if (declarada) return { opciones, actual: declarada, origen: "declarada" };
  const marcada = stats.find((stat) => stat.selected)?.name ?? "";
  if (marcada) return { opciones, actual: marcada, origen: "detectada" };
  const sugerida = codigoSugerido(opciones);
  return { opciones, actual: sugerida, origen: sugerida ? "sugerida" : "ninguna" };
}

/** Las fuentes de respuestas donde se declara el código: Kobo y SurveyMonkey. */
export function fuentesDeRespuestas(fuentes: readonly MonitoreoSource[] = []) {
  return fuentes.filter((fuente) => fuente.enabled && (fuente.kind === "kobo" || fuente.kind === "surveymonkey") && fuente.role !== "barrido");
}

export function coberturaDe(opcion: OpcionDeCodigo | undefined) {
  if (!opcion || !opcion.total) return "";
  return `${opcion.conValor.toLocaleString("es-PE")} de ${opcion.total.toLocaleString("es-PE")} respuestas traen un valor`;
}
