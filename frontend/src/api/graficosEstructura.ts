// Estructura del informe para la pestaña Plantillas de Gráficos (`POST /api/graficos/plan/estructura`,
// `graficos_estructura_informe.R`): secciones en el orden del cuestionario, cada una con sus preguntas, si entran al
// informe, cuántas láminas suman, su tipo y el gráfico con que salen. R manda una lista de un elemento como escalar y una
// lista vacía como `{}`; el normalizador lo deja siempre en arreglos.

import { apiFetch, handle, headers } from "./core";

export type GraficoPorPregunta = "barras" | "barras_ordenadas" | "barras_verticales" | "torta" | "barra_100";

export type PreguntaDelInforme = {
  ref: string;
  etiqueta: string;
  tipo: string;
  laminas: number;
  dentro: boolean;
  grafico: GraficoPorPregunta;
  graficosPosibles: GraficoPorPregunta[];
  /** Pregunta de un grupo repetible: cuenta registros (miembros, servicios), no personas. */
  porRegistro: boolean;
};

export type SeccionDelInforme = {
  titulo: string;
  preguntas: PreguntaDelInforme[];
  /** Las preguntas de cada lámina de la sección: una batería pone varias en una (el total se cuenta por lámina). */
  laminasRefs: string[][];
};

export type EstructuraDelInforme = {
  perfil: string;
  /** Láminas sin pregunta: portada, ficha técnica, índice. */
  laminasFijas: number;
  secciones: SeccionDelInforme[];
  avisos: string[];
};

const GRAFICOS: readonly GraficoPorPregunta[] = ["barras", "barras_ordenadas", "barras_verticales", "torta", "barra_100"];

const arreglo = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null || (typeof v === "object" && !Object.keys(v as object).length) ? [] : [v]);
const registro = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texto = (v: unknown): string => (Array.isArray(v) ? texto(v[0]) : v == null || typeof v === "object" ? "" : String(v));
const numero = (v: unknown): number => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isFinite(n) ? n : 0; };
const logico = (v: unknown): boolean => (Array.isArray(v) ? logico(v[0]) : v === true || v === "TRUE" || v === "true");
const grafico = (v: unknown): GraficoPorPregunta | null => {
  const t = texto(v);
  return (GRAFICOS as readonly string[]).includes(t) ? (t as GraficoPorPregunta) : null;
};

export function normalizarEstructuraDelInforme(raw: unknown): EstructuraDelInforme {
  const r = registro(raw);
  const secciones = arreglo(r.secciones).map((s): SeccionDelInforme => {
    const sec = registro(s);
    const preguntas = arreglo(sec.preguntas).map((q): PreguntaDelInforme | null => {
      const p = registro(q);
      const ref = texto(p.ref);
      if (!ref) return null;
      const posibles = arreglo(p.graficos_posibles).map(grafico).filter((g): g is GraficoPorPregunta => g !== null);
      const opciones = posibles.length ? posibles : (["barras"] as GraficoPorPregunta[]);
      const elegido = grafico(p.grafico);
      return {
        ref,
        etiqueta: texto(p.etiqueta) || ref,
        tipo: texto(p.tipo) || "Opción única",
        laminas: Math.max(1, numero(p.laminas)),
        dentro: logico(p.dentro),
        grafico: elegido && opciones.includes(elegido) ? elegido : opciones[0],
        graficosPosibles: opciones,
        porRegistro: logico(p.por_registro),
      };
    }).filter((q): q is PreguntaDelInforme => q !== null);
    const laminasRefs = arreglo(sec.laminas_refs).map((l) => arreglo(l).map(texto).filter(Boolean)).filter((l) => l.length > 0);
    return { titulo: texto(sec.titulo) || "Sin sección", preguntas, laminasRefs };
  }).filter((s) => s.preguntas.length > 0);
  return {
    perfil: texto(r.perfil),
    laminasFijas: numero(r.laminas_fijas),
    secciones,
    avisos: arreglo(r.avisos).map(texto).filter(Boolean),
  };
}

export async function apiGraficosEstructuraInforme(config: unknown): Promise<EstructuraDelInforme> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/plan/estructura", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
  return normalizarEstructuraDelInforme(raw);
}
