// validacionDetector.ts — el detector de consistencia de Validación (ítem 31):
// `GET /api/validacion/v2/detector-consistencia` (motor
// `api/R/validacion_detector_consistencia.R`). Lectura: no guarda nada.
//
// Cada sugerencia trae su frase, su cifra con la base, la concentración por
// recopilador (si hay uno declarado), los casos y, cuando aplica, la regla con
// que se puede convertir. Una cifra ausente queda `null`, nunca 0.

import type { ReglaSemilla } from "../features/validacion/types";
import { apiFetch, handle, headers } from "./core";
import { enteroONulo, escalar, lista, registro, texto } from "./normalizarR";

export type EstadoDeConcentracion = "sin_rol" | "pocos_casos" | "repartida" | "concentrada";

export type ConcentracionDeSugerencia = {
  estado: EstadoDeConcentracion;
  texto: string;
  recopilador: string | null;
  nCasosRecopilador: number | null;
  nCasos: number | null;
  nEncuestasRecopilador: number | null;
  nEncuestas: number | null;
};

export type CasoDeSugerencia = {
  fila: number | null;
  recopilador: string | null;
  valores: Record<string, string | null>;
};

export type PreguntaDeSugerencia = { variable: string; rotulo: string | null };

export type SugerenciaParaRevisar = {
  id: string;
  familia: "columna" | "combinacion";
  tipo: string;
  titulo: string;
  texto: string;
  variables: PreguntaDeSugerencia[];
  /** Casos que marca; `null` en las que miran columnas sin casos (dato personal). */
  nCasos: number | null;
  /** Sobre qué se cuentan los casos ("casos con dato en la pregunta"). */
  base: string;
  baseN: number | null;
  concentracion: ConcentracionDeSugerencia | null;
  casos: CasoDeSugerencia[];
  regla: ReglaSemilla | null;
};

export type AvisoDelDetector = { codigo: string; texto: string };

export type DetectorDeConsistencia = {
  estado: "listo" | "sin_datos";
  nTotal: number | null;
  recopilador: PreguntaDeSugerencia | null;
  sugerencias: SugerenciaParaRevisar[];
  /** Cuántas pasaron los umbrales; se muestran las más fuertes. */
  nCandidatas: number | null;
  avisos: AvisoDelDetector[];
};

const ESTADOS: readonly EstadoDeConcentracion[] = ["sin_rol", "pocos_casos", "repartida", "concentrada"];

function textoONulo(value: unknown): string | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return null;
  const t = texto(v);
  return t ? t : null;
}

function pregunta(value: unknown): PreguntaDeSugerencia | null {
  const r = registro(value);
  const variable = texto(r.variable);
  return variable ? { variable, rotulo: textoONulo(r.rotulo) } : null;
}

function concentracion(value: unknown): ConcentracionDeSugerencia | null {
  const r = registro(value);
  const estado = texto(r.estado) as EstadoDeConcentracion;
  if (!ESTADOS.includes(estado)) return null;
  return {
    estado,
    texto: texto(r.texto),
    recopilador: textoONulo(r.recopilador),
    nCasosRecopilador: enteroONulo(r.n_casos_recopilador),
    nCasos: enteroONulo(r.n_casos),
    nEncuestasRecopilador: enteroONulo(r.n_encuestas_recopilador),
    nEncuestas: enteroONulo(r.n_encuestas),
  };
}

function caso(value: unknown): CasoDeSugerencia {
  const r = registro(value);
  const valores: Record<string, string | null> = {};
  for (const [clave, v] of Object.entries(registro(r.valores))) valores[clave] = textoONulo(v);
  return { fila: enteroONulo(r.fila), recopilador: textoONulo(r.recopilador), valores };
}

/** La regla viaja tal cual la arma el motor; sin tipo ni variables no se ofrece. */
function regla(value: unknown): ReglaSemilla | null {
  const r = registro(value);
  const tipo = texto(r.tipo);
  const variables = (Array.isArray(r.variables) ? r.variables : [r.variables]).map((v) => texto(v)).filter(Boolean);
  if (!tipo || !variables.length || !Object.keys(registro(r.semilla)).length) return null;
  return { ...(r as unknown as ReglaSemilla), tipo: tipo as ReglaSemilla["tipo"], variables };
}

function sugerencia(value: unknown): SugerenciaParaRevisar | null {
  const r = registro(value);
  const id = texto(r.id);
  const titulo = texto(r.titulo);
  const familia = texto(r.familia);
  if (!id || !titulo || (familia !== "columna" && familia !== "combinacion")) return null;
  const cifra = registro(r.cifra);
  return {
    id,
    familia,
    tipo: texto(r.tipo),
    titulo,
    texto: texto(r.texto),
    variables: lista(r.variables).map(pregunta).filter((p): p is PreguntaDeSugerencia => p !== null),
    nCasos: enteroONulo(cifra.n_casos),
    base: texto(cifra.base),
    baseN: enteroONulo(cifra.base_n),
    concentracion: concentracion(r.concentracion),
    casos: lista(r.casos).map(caso),
    regla: regla(r.regla),
  };
}

export function normalizarDetector(raw: unknown): DetectorDeConsistencia {
  const r = registro(raw);
  return {
    estado: texto(r.estado) === "sin_datos" ? "sin_datos" : "listo",
    nTotal: enteroONulo(r.n_total),
    recopilador: pregunta(r.recopilador),
    sugerencias: lista(r.sugerencias).map(sugerencia).filter((s): s is SugerenciaParaRevisar => s !== null),
    nCandidatas: enteroONulo(r.n_candidatas),
    avisos: lista(r.avisos)
      .map((a) => ({ codigo: texto(a.codigo), texto: texto(a.texto) }))
      .filter((a) => a.texto),
  };
}

export async function pedirDetectorDeConsistencia(baseNombre?: string | null): Promise<DetectorDeConsistencia> {
  const h = headers();
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  const raw = await handle<unknown>(await apiFetch("/api/validacion/v2/detector-consistencia", { headers: h }));
  return normalizarDetector(raw);
}
