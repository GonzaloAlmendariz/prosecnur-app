// cargaOrigenExterno.ts — la base limpiada fuera entra declarada (ADR 0100, P2).
//
// Cuando la depuración se hizo en un script fuera de la app, la base llega ya
// recortada. Este módulo declara de dónde viene: la lista de exclusiones del
// script (`_uuid`, `motivo`, `categoria`), cuántas encuestas recibió y qué
// versión del script la produjo.
//
// La respuesta nunca trae los identificadores de las encuestas excluidas: sólo
// el agregado y el conteo por categoría, igual que el linaje de Limpieza.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio (patrón de `cargaFuentes.ts`).

import { apiFetch, handle, headers } from "./core";
import { apiUpload } from "./estudio";

export type OrigenExternoEstado = "vigente" | "otra_base" | "";

export type OrigenExternoBloque = {
  script: string;
  version: string;
  /** `null` cuando el backend no la manda (no es cero). */
  n_recibidas: number | null;
  /** `true` si no se declaró y el backend la dedujo como entregadas + excluidas. */
  n_recibidas_deducida: boolean;
  n_entregadas: number | null;
  n_excluidas: number;
  data_file_id: string;
  declarado_at: string;
  enabled: boolean;
};

export type OrigenExternoCategoria = { categoria: string; n: number };

export type OrigenExternoResumen = {
  recibidas: number | null;
  excluidas: number;
  entregadas: number | null;
  por_categoria: OrigenExternoCategoria[];
};

export type OrigenExternoAvisoCodigo =
  | "duplicadas"
  | "siguen_en_la_base"
  | "no_cuadra"
  | "sin_motivo"
  | "otro";

export type OrigenExternoAviso = { codigo: OrigenExternoAvisoCodigo; mensaje: string };

export type OrigenExterno = {
  base: string;
  estado: OrigenExternoEstado;
  bloque: OrigenExternoBloque | null;
  resumen: OrigenExternoResumen | null;
  /** Sólo los trae la declaración; la consulta los deja vacíos. */
  avisos: OrigenExternoAviso[];
};

export type DeclararOrigenExternoParams = {
  baseNombre?: string | null;
  fileId: string;
  nRecibidas?: number | null;
  script?: string;
  version?: string;
};

// ---------------------------------------------------------------------------
// Normalizador defensivo
// ---------------------------------------------------------------------------

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// R entrega un escalar como vector de largo uno.
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function texto(value: unknown): string {
  const v = escalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** `NA`, `null` o ausente no son cero: sin el dato, la cifra queda en `null`. */
function enteroONulo(value: unknown): number | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "" || v === "NA") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function entero(value: unknown): number {
  return enteroONulo(value) ?? 0;
}

function booleano(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
}

/** Una lista de largo uno puede llegar desenrollada como un único objeto. */
function lista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value] : [];
}

/** Filas (`[{categoria, n}]`) o columnas (`{categoria: [], n: []}`). */
function filas(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.map(registro);
  const columnas = registro(raw);
  const nombres = Object.keys(columnas);
  if (!nombres.length) return [];
  const columnar = nombres.every((nombre) => Array.isArray(columnas[nombre]));
  if (!columnar) return [columnas];
  const largo = Math.max(...nombres.map((nombre) => (columnas[nombre] as unknown[]).length));
  return Array.from({ length: largo }, (_, index) => {
    const fila: Record<string, unknown> = {};
    for (const nombre of nombres) fila[nombre] = (columnas[nombre] as unknown[])[index];
    return fila;
  });
}

const ESTADOS: readonly OrigenExternoEstado[] = ["vigente", "otra_base", ""];
const CODIGOS_AVISO: readonly OrigenExternoAvisoCodigo[] = [
  "duplicadas",
  "siguen_en_la_base",
  "no_cuadra",
  "sin_motivo",
];

function normalizarBloque(raw: unknown): OrigenExternoBloque | null {
  const r = registro(escalar(raw));
  // R serializa `NULL` como `{}` o `[]`: un bloque sin campos no es declaración.
  if (!Object.keys(r).length) return null;
  const enabled = r.enabled === undefined ? true : booleano(r.enabled);
  if (!enabled) return null;
  return {
    script: texto(r.script),
    version: texto(r.version),
    n_recibidas: enteroONulo(r.n_recibidas),
    n_recibidas_deducida: booleano(r.n_recibidas_deducida),
    n_entregadas: enteroONulo(r.n_entregadas),
    n_excluidas: entero(r.n_excluidas),
    data_file_id: texto(r.data_file_id),
    declarado_at: texto(r.declarado_at),
    enabled,
  };
}

function normalizarResumen(raw: unknown): OrigenExternoResumen | null {
  const r = registro(escalar(raw));
  if (!Object.keys(r).length) return null;
  const porCategoria = filas(r.por_categoria)
    .map((fila) => ({ categoria: texto(fila.categoria) || "Sin categoría", n: entero(fila.n) }))
    .filter((fila) => fila.n > 0);
  return {
    recibidas: enteroONulo(r.recibidas),
    excluidas: entero(r.excluidas),
    entregadas: enteroONulo(r.entregadas),
    por_categoria: porCategoria,
  };
}

function normalizarAviso(raw: Record<string, unknown>): OrigenExternoAviso | null {
  const mensaje = texto(raw.mensaje);
  if (!mensaje) return null;
  const codigoCrudo = texto(raw.codigo);
  const codigo = (CODIGOS_AVISO as readonly string[]).includes(codigoCrudo)
    ? (codigoCrudo as OrigenExternoAvisoCodigo)
    : "otro";
  return { codigo, mensaje };
}

export function normalizeOrigenExterno(raw: unknown): OrigenExterno {
  const root = registro(raw);
  const bloque = normalizarBloque(root.bloque);
  const estadoCrudo = texto(root.estado);
  let estado: OrigenExternoEstado = (ESTADOS as readonly string[]).includes(estadoCrudo)
    ? (estadoCrudo as OrigenExternoEstado)
    : "";
  // Sin bloque no hay declaración que pueda regir, diga lo que diga el estado.
  if (!bloque) estado = "";
  // Un bloque sin estado reconocible se lee como vigente: es lo que el backend
  // devuelve justo después de declarar.
  else if (!estado) estado = "vigente";
  return {
    base: texto(root.base),
    estado,
    bloque,
    resumen: bloque ? normalizarResumen(root.resumen) : null,
    avisos: lista(root.avisos)
      .map((aviso) => normalizarAviso(registro(aviso)))
      .filter((aviso): aviso is OrigenExternoAviso => aviso !== null),
  };
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

export async function getOrigenExterno(baseNombre?: string | null): Promise<OrigenExterno> {
  const base = baseNombre?.trim();
  const qs = base ? `?${new URLSearchParams({ base_nombre: base }).toString()}` : "";
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/origen-externo${qs}`, { headers: headers() }),
  );
  return normalizeOrigenExterno(raw);
}

/**
 * Sube la lista de exclusiones (xlsx o csv). No hay un `UploadKind` propio: se
 * usa el genérico de datos, que el backend lee con el mismo lector de bases.
 */
export async function subirListaExclusiones(file: File): Promise<string> {
  const subido = await apiUpload(file, "data");
  return subido.file_id;
}

export async function declararOrigenExterno(params: DeclararOrigenExternoParams): Promise<OrigenExterno> {
  const body: Record<string, string | number> = { file_id: params.fileId };
  const base = params.baseNombre?.trim();
  if (base) body.base_nombre = base;
  if (params.nRecibidas != null && Number.isFinite(params.nRecibidas)) body.n_recibidas = params.nRecibidas;
  const script = params.script?.trim();
  if (script) body.script = script;
  const version = params.version?.trim();
  if (version) body.version = version;
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/origen-externo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  return normalizeOrigenExterno(raw);
}
