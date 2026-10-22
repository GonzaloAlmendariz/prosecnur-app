// monitoreoCuotas.ts — metas por cuota en Monitoreo › Acreditación › Avance ›
// Cuotas (checklist T2, 2026-10-22).
//
// Una cuota es un público y una variable de su base (dedicación, unidad,
// puesto) con una meta por categoría. El backend cruza cada persona de la base
// con su efectiva por la llave del universo; aquí solo se lee, se propone y se
// guarda la configuración.
//
// Normalizador defensivo: Plumber serializa con auto_unbox (lista de uno como
// objeto suelto, escalar como vector de largo uno, `NULL` como `{}`, `NA` como
// `null`). Una cifra ausente queda `null` («sin dato»), nunca cero.

import { apiFetch, handle, headers } from "./core";
import { booleano, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";

// ---------- Tipos del contrato congelado ----------

export type MonitoreoCuotaEstadoCategoria = "cumplida" | "en_curso" | "sin_avance" | "sin_meta";

export type MonitoreoCuotaVariable = { variable: string; categorias: number | null };

export type MonitoreoCuotaPublico = {
  actor: string;
  universo: number | null;
  efectivas: number | null;
  /** Meta del público (`config$goals`); `null` si el estudio no la declaró. */
  meta: number | null;
  variables: MonitoreoCuotaVariable[];
};

export type MonitoreoCuotaCategoria = {
  categoria: string;
  universo: number | null;
  meta: number | null;
  efectivas: number | null;
  falta: number | null;
  /** efectivas / meta; puede pasar de 1. */
  avance: number | null;
  /** efectivas / universo de la categoría. */
  tasa: number | null;
  estado: MonitoreoCuotaEstadoCategoria;
};

export type MonitoreoCuota = {
  id: string;
  actor: string;
  variable: string;
  /** Proporción 0–1, o `null` si las metas se escribieron a mano. */
  cobertura: number | null;
  universo: number | null;
  /** Suma de las metas por categoría. */
  meta: number | null;
  efectivas: number | null;
  avance: number | null;
  categorias_cumplidas: number | null;
  categorias_total: number | null;
  sin_dato: number | null;
  categorias: MonitoreoCuotaCategoria[];
};

export type MonitoreoCuotasEstado = {
  ok: boolean;
  /** Monitoreo aún no deja el cruce del universo en caché: se vuelve a pedir. */
  preparando: boolean;
  publicos: MonitoreoCuotaPublico[];
  cuotas: MonitoreoCuota[];
  avisos: string[];
};

export type MonitoreoCuotaPropuesta = {
  actor: string;
  variable: string;
  cobertura: number | null;
  categorias: { categoria: string; universo: number | null; meta: number | null }[];
};

export type MonitoreoCuotaEntrada = {
  id?: string;
  actor: string;
  variable: string;
  cobertura?: number | null;
  metas: Record<string, number>;
};

// ---------- Normalizadores ----------

function textos(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(texto).filter(Boolean);
  const uno = texto(value);
  return uno ? [uno] : [];
}

const ESTADOS: readonly MonitoreoCuotaEstadoCategoria[] = ["cumplida", "en_curso", "sin_avance", "sin_meta"];

/**
 * El estado lo publica el motor; si llega uno desconocido se deduce de las
 * cifras con la misma regla del contrato en vez de pintarlo «sin meta».
 */
function estadoCategoria(value: unknown, meta: number | null, efectivas: number | null): MonitoreoCuotaEstadoCategoria {
  const v = texto(value).toLowerCase().replace(/[\s-]+/g, "_");
  if ((ESTADOS as readonly string[]).includes(v)) return v as MonitoreoCuotaEstadoCategoria;
  if (!meta || meta <= 0) return "sin_meta";
  const e = efectivas ?? 0;
  if (e >= meta) return "cumplida";
  return e > 0 ? "en_curso" : "sin_avance";
}

function categoria(r: Record<string, unknown>): MonitoreoCuotaCategoria {
  const meta = numeroONulo(r.meta);
  const efectivas = numeroONulo(r.efectivas);
  return {
    categoria: texto(r.categoria) || "Sin dato",
    universo: numeroONulo(r.universo),
    meta,
    efectivas,
    falta: numeroONulo(r.falta),
    avance: numeroONulo(r.avance),
    tasa: numeroONulo(r.tasa),
    estado: estadoCategoria(r.estado, meta, efectivas),
  };
}

function publico(r: Record<string, unknown>): MonitoreoCuotaPublico {
  return {
    actor: texto(r.actor) || "Sin público",
    universo: numeroONulo(r.universo),
    efectivas: numeroONulo(r.efectivas),
    meta: numeroONulo(r.meta),
    variables: lista(r.variables)
      .map((v) => ({ variable: texto(v.variable), categorias: numeroONulo(v.categorias) }))
      .filter((v) => v.variable),
  };
}

function cuota(r: Record<string, unknown>): MonitoreoCuota {
  return {
    id: texto(r.id),
    actor: texto(r.actor),
    variable: texto(r.variable),
    cobertura: numeroONulo(r.cobertura),
    universo: numeroONulo(r.universo),
    meta: numeroONulo(r.meta),
    efectivas: numeroONulo(r.efectivas),
    avance: numeroONulo(r.avance),
    categorias_cumplidas: numeroONulo(r.categorias_cumplidas),
    categorias_total: numeroONulo(r.categorias_total),
    sin_dato: numeroONulo(r.sin_dato),
    categorias: lista(r.categorias).map(categoria),
  };
}

export function normalizeMonitoreoCuotasEstado(raw: unknown): MonitoreoCuotasEstado {
  const r = registro(raw);
  return {
    ok: r.ok === undefined ? true : booleano(r.ok),
    preparando: booleano(r.preparando),
    publicos: lista(r.publicos).map(publico),
    cuotas: lista(r.cuotas).map(cuota).filter((q) => q.actor && q.variable),
    avisos: textos(r.avisos),
  };
}

export function normalizeMonitoreoCuotaPropuesta(raw: unknown): MonitoreoCuotaPropuesta {
  const r = registro(escalar(raw));
  return {
    actor: texto(r.actor),
    variable: texto(r.variable),
    cobertura: numeroONulo(r.cobertura),
    categorias: lista(r.categorias).map((c) => ({
      categoria: texto(c.categoria) || "Sin dato",
      universo: numeroONulo(c.universo),
      meta: numeroONulo(c.meta),
    })),
  };
}

/**
 * Cuerpo del POST: metas enteras no negativas y la cobertura solo si es una
 * proporción válida. `metas` siempre como objeto, aunque esté vacío, para que
 * R no lo lea como lista sin nombres.
 */
export function cuerpoGuardarCuotas(cuotas: readonly MonitoreoCuotaEntrada[]) {
  return {
    cuotas: cuotas.map((q) => {
      const metas: Record<string, number> = {};
      for (const [cat, n] of Object.entries(q.metas)) {
        metas[cat] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
      }
      const cobertura = q.cobertura != null && q.cobertura > 0 && q.cobertura <= 1 ? q.cobertura : null;
      return {
        ...(q.id ? { id: q.id } : {}),
        actor: q.actor,
        variable: q.variable,
        cobertura,
        metas,
      };
    }),
  };
}

// ---------- Rutas ----------

const BASE = "/api/monitoreo/cuotas";

export async function getMonitoreoCuotas(): Promise<MonitoreoCuotasEstado> {
  return normalizeMonitoreoCuotasEstado(await handle<unknown>(await apiFetch(BASE, { headers: headers() })));
}

export async function postMonitoreoCuotaProponer(input: {
  actor: string;
  variable: string;
  cobertura?: number | null;
}): Promise<MonitoreoCuotaPropuesta> {
  const body: Record<string, unknown> = { actor: input.actor, variable: input.variable };
  if (input.cobertura != null && input.cobertura > 0 && input.cobertura <= 1) body.cobertura = input.cobertura;
  return normalizeMonitoreoCuotaPropuesta(
    await handle<unknown>(await apiFetch(`${BASE}/proponer`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })),
  );
}

/** Reemplaza la configuración entera y devuelve el mismo estado que el GET. */
export async function postMonitoreoCuotas(cuotas: readonly MonitoreoCuotaEntrada[]): Promise<MonitoreoCuotasEstado> {
  return normalizeMonitoreoCuotasEstado(
    await handle<unknown>(await apiFetch(BASE, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpoGuardarCuotas(cuotas)),
    })),
  );
}
