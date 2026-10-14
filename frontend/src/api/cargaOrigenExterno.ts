// cargaOrigenExterno.ts — la base preparada fuera entra declarada (ADR 0100,
// P2 y Enmienda 1 / P2b).
//
// Cuando la base se preparó con un script fuera de la app, puede llegar con
// menos casos, con menos variables que el instrumento, o con ambas cosas. Este
// módulo declara de dónde viene: la lista de casos retirados (`_uuid`,
// `motivo`, `categoria`), cuántas encuestas recibió, qué versión del script la
// produjo y el motivo de cada variable del instrumento que no está en la base.
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
  variables_retiradas: OrigenExternoVariableRetirada[];
  n_variables_retiradas: number;
};

export type OrigenExternoCategoria = { categoria: string; n: number };

/** Por qué una variable del instrumento no viene en la base. */
export type OrigenExternoMotivoVariable = "metadato" | "no_va_al_cliente" | "otra";

export const MOTIVOS_VARIABLE: readonly OrigenExternoMotivoVariable[] = [
  "metadato",
  "no_va_al_cliente",
  "otra",
];

/** Variable del instrumento que no está en la base (la detecta el backend). */
export type OrigenExternoVariableFaltante = {
  variable: string;
  tipo: string;
  /** `metadato` para los tipos de metadato del XLSForm; vacío si no hay sugerencia. */
  motivo_sugerido: "metadato" | "";
};

export type OrigenExternoVariableRetirada = {
  variable: string;
  tipo: string;
  motivo: OrigenExternoMotivoVariable;
};

export type OrigenExternoMotivoConteo = { motivo: OrigenExternoMotivoVariable; n: number };

export type OrigenExternoVariablesResumen = {
  total: number;
  por_motivo: OrigenExternoMotivoConteo[];
};

export type OrigenExternoResumen = {
  recibidas: number | null;
  excluidas: number;
  entregadas: number | null;
  por_categoria: OrigenExternoCategoria[];
  variables_retiradas: OrigenExternoVariablesResumen;
};

export type OrigenExternoAvisoCodigo =
  | "duplicadas"
  | "siguen_en_la_base"
  | "no_cuadra"
  | "sin_motivo"
  | "variable_presente"
  | "motivo_invalido"
  | "otro";

export type OrigenExternoAviso = { codigo: OrigenExternoAvisoCodigo; mensaje: string };

export type OrigenExterno = {
  base: string;
  estado: OrigenExternoEstado;
  bloque: OrigenExternoBloque | null;
  resumen: OrigenExternoResumen | null;
  /** Variables del instrumento que no están en la base; siempre viene. */
  variables_faltantes: OrigenExternoVariableFaltante[];
  /** Sólo los trae la declaración; la consulta los deja vacíos. */
  avisos: OrigenExternoAviso[];
  /** Sólo la declaración: variables que pasaron a Analítica › Variables excluidas. */
  variables_excluidas_agregadas: string[];
};

export type DeclararOrigenExternoParams = {
  baseNombre?: string | null;
  /** Lista de casos retirados ya subida; opcional si se declaran variables. */
  fileId?: string | null;
  nRecibidas?: number | null;
  script?: string;
  version?: string;
  variablesMotivo?: Partial<Record<string, OrigenExternoMotivoVariable>>;
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
  "variable_presente",
  "motivo_invalido",
];

function motivoVariable(value: unknown): OrigenExternoMotivoVariable | "" {
  const v = texto(value);
  return (MOTIVOS_VARIABLE as readonly string[]).includes(v) ? (v as OrigenExternoMotivoVariable) : "";
}

/** Un vector de textos que R puede mandar como escalar o lista. */
function textos(value: unknown): string[] {
  const crudo = Array.isArray(value) ? value : value == null ? [] : [value];
  const vistos = new Set<string>();
  for (const item of crudo) {
    const t = texto(item);
    if (t) vistos.add(t);
  }
  return [...vistos];
}

/** Sin nombre no hay variable; un nombre repetido cuenta una vez. */
function unicasPorVariable<T extends { variable: string }>(items: T[]): T[] {
  const vistos = new Set<string>();
  return items.filter((item) => {
    if (!item.variable || vistos.has(item.variable)) return false;
    vistos.add(item.variable);
    return true;
  });
}

function normalizarFaltantes(raw: unknown): OrigenExternoVariableFaltante[] {
  return unicasPorVariable(
    filas(raw).map((fila) => ({
      variable: texto(fila.variable),
      tipo: texto(fila.tipo),
      motivo_sugerido: motivoVariable(fila.motivo_sugerido) === "metadato" ? ("metadato" as const) : ("" as const),
    })),
  );
}

function normalizarRetiradas(raw: unknown): OrigenExternoVariableRetirada[] {
  return unicasPorVariable(
    filas(raw).map((fila) => ({
      variable: texto(fila.variable),
      tipo: texto(fila.tipo),
      // Un motivo que el front no conoce se lee como «otra», no se pierde.
      motivo: motivoVariable(fila.motivo) || ("otra" as const),
    })),
  );
}

function normalizarResumenVariables(
  raw: unknown,
  retiradas: OrigenExternoVariableRetirada[],
): OrigenExternoVariablesResumen {
  const r = registro(escalar(raw));
  const conteos = new Map<OrigenExternoMotivoVariable, number>();
  for (const fila of filas(r.por_motivo)) {
    const motivo = motivoVariable(fila.motivo) || "otra";
    const n = entero(fila.n);
    if (n > 0) conteos.set(motivo, (conteos.get(motivo) ?? 0) + n);
  }
  // Sin desglose del backend, se cuenta del bloque.
  if (!conteos.size) {
    for (const item of retiradas) conteos.set(item.motivo, (conteos.get(item.motivo) ?? 0) + 1);
  }
  const porMotivo = MOTIVOS_VARIABLE.filter((motivo) => conteos.has(motivo)).map((motivo) => ({
    motivo,
    n: conteos.get(motivo) ?? 0,
  }));
  const sumado = porMotivo.reduce((acc, fila) => acc + fila.n, 0);
  return { total: enteroONulo(r.total) ?? sumado, por_motivo: porMotivo };
}

function normalizarBloque(raw: unknown): OrigenExternoBloque | null {
  const r = registro(escalar(raw));
  // R serializa `NULL` como `{}` o `[]`: un bloque sin campos no es declaración.
  if (!Object.keys(r).length) return null;
  const enabled = r.enabled === undefined ? true : booleano(r.enabled);
  if (!enabled) return null;
  const variablesRetiradas = normalizarRetiradas(r.variables_retiradas);
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
    variables_retiradas: variablesRetiradas,
    n_variables_retiradas: enteroONulo(r.n_variables_retiradas) ?? variablesRetiradas.length,
  };
}

function normalizarResumen(
  raw: unknown,
  bloque: OrigenExternoBloque,
): OrigenExternoResumen | null {
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
    variables_retiradas: normalizarResumenVariables(r.variables_retiradas, bloque.variables_retiradas),
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
    resumen: bloque ? normalizarResumen(root.resumen, bloque) : null,
    variables_faltantes: normalizarFaltantes(root.variables_faltantes),
    avisos: lista(root.avisos)
      .map((aviso) => normalizarAviso(registro(aviso)))
      .filter((aviso): aviso is OrigenExternoAviso => aviso !== null),
    variables_excluidas_agregadas: textos(root.variables_excluidas_agregadas),
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
 * Sube la lista de casos retirados (xlsx o csv). No hay un `UploadKind` propio: se
 * usa el genérico de datos, que el backend lee con el mismo lector de bases.
 */
export async function subirListaExclusiones(file: File): Promise<string> {
  const subido = await apiUpload(file, "data");
  return subido.file_id;
}

export async function declararOrigenExterno(params: DeclararOrigenExternoParams): Promise<OrigenExterno> {
  const body: Record<string, string | number | Record<string, OrigenExternoMotivoVariable>> = {};
  const fileId = params.fileId?.trim();
  if (fileId) body.file_id = fileId;
  const motivos: Record<string, OrigenExternoMotivoVariable> = {};
  for (const [variable, motivo] of Object.entries(params.variablesMotivo ?? {})) {
    if (variable && motivo && (MOTIVOS_VARIABLE as readonly string[]).includes(motivo)) motivos[variable] = motivo;
  }
  if (Object.keys(motivos).length) body.variables_motivo = motivos;
  if (!body.file_id && !body.variables_motivo) {
    throw new Error("Declara la lista de casos retirados o el motivo de alguna variable.");
  }
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
