/**
 * Cliente del perfil descriptivo de una base declarada (Datos › Explorador).
 *
 * G49 · El perfil lo calcula R sobre el ARCHIVO de Fuentes, no sobre el marco:
 * la base real tiene 136.284 filas y contar categorías en el cliente exigiría
 * moverla entera por cada clic. Aquí sólo se acredita la forma de la respuesta.
 *
 * Se normaliza con el mismo criterio que el resto de contratos de la casa: una
 * cifra ilegible descarta su columna en vez de llegar como `NaN` a la pantalla.
 */
import { apiFetch, handle, headers } from "./core";

export const CALC_MUESTRA_EXPLORADOR_BASE_SCHEMA = "calc_muestra_explorador_base_v1" as const;

export type ExploradorBaseCategoria = { clave: string; n: number };

export type ExploradorBaseResumen = {
  min: number;
  max: number;
  media: number;
  p25: number;
  p50: number;
  p75: number;
  bins: Array<{ desde: number; hasta: number; n: number }>;
};

export type ExploradorBaseColumna = {
  columna: string;
  tipo: "numerica" | "categorica";
  conDato: number;
  sinDato: number;
  distintos: number;
  categorias: ExploradorBaseCategoria[];
  otras: {
    n: number;
    categorias: number;
    truncadas: number;
    filas: ExploradorBaseCategoria[];
  } | null;
  resumen: ExploradorBaseResumen | null;
};

export type ExploradorBasePerfil = {
  sheet: string;
  filas: number;
  filasBase: number;
  /** Estudiantes distintos, cuando la hoja trae columna de estudiante. */
  estudiantes: number | null;
  unidad: "filas" | "estudiantes";
  unidadDisponible: boolean;
  columnas: ExploradorBaseColumna[];
};

export type ExploradorBaseFiltro = { columna: string; valores: string[] };

function entero(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numero(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function unwrap(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function lista(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function categorias(value: unknown): ExploradorBaseCategoria[] {
  const out: ExploradorBaseCategoria[] = [];
  for (const item of lista(value)) {
    const row = unwrap(item) as Record<string, unknown> | null;
    if (!row || typeof row !== "object") continue;
    const clave = typeof unwrap(row.clave) === "string" ? String(unwrap(row.clave)).trim() : "";
    const n = entero(unwrap(row.n));
    if (!clave || n === null || n < 0) continue;
    out.push({ clave, n });
  }
  return out;
}

function resumen(value: unknown): ExploradorBaseResumen | null {
  const row = unwrap(value) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  const campos = ["min", "max", "media", "p25", "p50", "p75"] as const;
  const cifras: Record<string, number> = {};
  for (const campo of campos) {
    const n = numero(unwrap(row[campo]));
    if (n === null) return null;
    cifras[campo] = n;
  }
  const bins: ExploradorBaseResumen["bins"] = [];
  for (const item of lista(row.bins)) {
    const bin = unwrap(item) as Record<string, unknown> | null;
    if (!bin || typeof bin !== "object") continue;
    const desde = numero(unwrap(bin.desde));
    const hasta = numero(unwrap(bin.hasta));
    const n = entero(unwrap(bin.n));
    if (desde === null || hasta === null || n === null) continue;
    bins.push({ desde, hasta, n });
  }
  if (!bins.length) return null;
  return { ...(cifras as unknown as Omit<ExploradorBaseResumen, "bins">), bins };
}

export function normalizeExploradorBasePerfil(raw: unknown): ExploradorBasePerfil | null {
  const row = unwrap(raw) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  if (String(unwrap(row.schema) ?? "") !== CALC_MUESTRA_EXPLORADOR_BASE_SCHEMA) return null;
  const filas = entero(unwrap(row.filas));
  const filasBase = entero(unwrap(row.filas_base));
  if (filas === null || filasBase === null) return null;

  const columnas: ExploradorBaseColumna[] = [];
  for (const item of lista(row.columnas)) {
    const col = unwrap(item) as Record<string, unknown> | null;
    if (!col || typeof col !== "object") continue;
    const nombre = typeof unwrap(col.columna) === "string" ? String(unwrap(col.columna)) : "";
    const tipo = String(unwrap(col.tipo) ?? "");
    const conDato = entero(unwrap(col.con_dato));
    const sinDato = entero(unwrap(col.sin_dato));
    const distintos = entero(unwrap(col.distintos));
    if (!nombre || conDato === null || sinDato === null || distintos === null) continue;
    if (tipo !== "numerica" && tipo !== "categorica") continue;
    const otrasRaw = unwrap(col.otras) as Record<string, unknown> | null;
    columnas.push({
      columna: nombre,
      tipo,
      conDato,
      sinDato,
      distintos,
      categorias: categorias(col.categorias),
      otras: otrasRaw && typeof otrasRaw === "object" ? {
        n: entero(unwrap(otrasRaw.n)) ?? 0,
        categorias: entero(unwrap(otrasRaw.categorias)) ?? 0,
        truncadas: entero(unwrap(otrasRaw.truncadas)) ?? 0,
        filas: categorias(otrasRaw.filas),
      } : null,
      resumen: tipo === "numerica" ? resumen(col.resumen) : null,
    });
  }

  return {
    sheet: String(unwrap(row.sheet) ?? ""),
    filas,
    filasBase,
    estudiantes: entero(unwrap(row.estudiantes)),
    unidad: unwrap(row.unidad) === "estudiantes" ? "estudiantes" : "filas",
    unidadDisponible: unwrap(row.unidad_disponible) === true,
    columnas,
  };
}

export async function apiCalcMuestraExplorarBase(
  input: {
    file_id: string;
    sheet?: string;
    filtros?: ExploradorBaseFiltro[];
    unidad?: "filas" | "estudiantes";
    top?: number;
  },
  options: { signal?: AbortSignal } = {},
): Promise<ExploradorBasePerfil> {
  const response = await handle<{ ok: true; perfil: unknown }>(
    await apiFetch("/api/calc-muestra/marco/explorar-base", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
      signal: options.signal,
    }),
  );
  const perfil = normalizeExploradorBasePerfil(response.perfil);
  if (!perfil) {
    throw new Error("El perfil de la base no cumple el contrato vigente.");
  }
  return perfil;
}
