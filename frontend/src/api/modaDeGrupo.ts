// modaDeGrupo.ts: lo que "Valor distinto del más frecuente en su grupo" agrega al
// conteo previo (`api/R/reglas_custom_moda_grupo.R`). Todo es lectura: nada
// guarda. Una cifra ausente queda `null`, nunca 0.

import { enteroONulo, escalar, numeroONulo, registro, texto } from "./normalizarR";

function textoONulo(value: unknown): string | null {
  const v = escalar(value);
  if (v === "NA") return null;
  const t = texto(v);
  return t ? t : null;
}

export type EstadoDeModa = "ok" | "marca" | "grupo_chico" | "empate" | "sin_apoyo" | "sin_datos";

const ESTADOS: readonly EstadoDeModa[] = ["ok", "marca", "grupo_chico", "empate", "sin_apoyo", "sin_datos"];

/**
 * Lo que mide el motor en una encuesta: su estado y, si está marcada, la causa
 * con el valor más frecuente de su grupo y cuánto pesa ("41 de 45 encuestas").
 */
export type ResumenDeModa = {
  estado: EstadoDeModa;
  causa: string | null;
  moda: string | null;
  nModa: number | null;
  nGrupo: number | null;
};

/**
 * Cómo se leyó la regla sobre las filas que evalúa la auditoría (`nFilas`, sin
 * el filtro). Las encuestas por estado suman `nFilas`; los grupos, `nGrupos`.
 */
export type LecturaDeModa = {
  nFilas: number | null;
  nOk: number | null;
  nMarcadas: number | null;
  nGrupoChico: number | null;
  nEmpate: number | null;
  nSinApoyo: number | null;
  nSinDatos: number | null;
  nGrupos: number | null;
  nGruposEvaluables: number | null;
  nGruposChicos: number | null;
  nGruposEmpate: number | null;
  nGruposSinApoyo: number | null;
  apoyoMin: number | null;
  nMin: number | null;
};

export function normalizarResumenDeModa(value: unknown): ResumenDeModa | null {
  if (value === null || value === undefined) return null;
  const r = registro(value);
  const estado = texto(r.estado);
  if (!(ESTADOS as readonly string[]).includes(estado)) return null;
  return {
    estado: estado as EstadoDeModa,
    causa: textoONulo(r.causa),
    moda: textoONulo(r.moda),
    nModa: enteroONulo(r.n_moda),
    nGrupo: enteroONulo(r.n_grupo),
  };
}

export function normalizarLecturaDeModa(value: unknown): LecturaDeModa | null {
  if (value === null || value === undefined) return null;
  const r = registro(value);
  if (!("n_filas" in r)) return null;
  return {
    nFilas: enteroONulo(r.n_filas),
    nOk: enteroONulo(r.n_ok),
    nMarcadas: enteroONulo(r.n_marcadas),
    nGrupoChico: enteroONulo(r.n_grupo_chico),
    nEmpate: enteroONulo(r.n_empate),
    nSinApoyo: enteroONulo(r.n_sin_apoyo),
    nSinDatos: enteroONulo(r.n_sin_datos),
    nGrupos: enteroONulo(r.n_grupos),
    nGruposEvaluables: enteroONulo(r.n_grupos_evaluables),
    nGruposChicos: enteroONulo(r.n_grupos_chicos),
    nGruposEmpate: enteroONulo(r.n_grupos_empate),
    nGruposSinApoyo: enteroONulo(r.n_grupos_sin_apoyo),
    apoyoMin: numeroONulo(r.apoyo_min),
    nMin: enteroONulo(r.n_min),
  };
}
