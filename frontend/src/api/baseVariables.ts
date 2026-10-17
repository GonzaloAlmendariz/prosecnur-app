// baseVariables.ts — cada base declara sus variables propias (ADR 0106).
//
// Las columnas que la data trae y el instrumento no declara se pueden
// incorporar como preguntas; una base puede calcular variables a partir de
// otras suyas (`alguna`, `recodificar`), y se puede marcar «ya viene
// codificada» para que Codificación no la vuelva a codificar.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio (patrón de `cargaFuentes.ts`).

import { apiFetch, handle, headers } from "./core";
import { booleano, codigo, enteroONulo, escalar, lista, registro, texto } from "./normalizarR";

export const TIPOS_COLUMNA = ["select_one", "integer", "decimal", "text", "date", "datetime"] as const;
export type TipoColumna = (typeof TIPOS_COLUMNA)[number];

export type ReglaCalculada = "alguna" | "recodificar" | "formula";

export type OpcionBase = { codigo: string; etiqueta: string };

/** Columna de la data que el instrumento no declara. */
export type ColumnaPropia = {
  name: string;
  label: string;
  tipo: TipoColumna;
  opciones: OpcionBase[];
  n_validos: number;
  declarada: boolean;
};

export type VariableCalculada = {
  nombre: string;
  etiqueta: string;
  regla: ReglaCalculada;
  variables: string[];
  codigos: string[];
  /** `código de origen -> código de la escala`; sólo en `recodificar`. */
  mapa: Record<string, string>;
  escala: OpcionBase[];
  /** Sólo en `formula`: la expresión, p. ej. «2026 - P8». */
  expresion?: string;
  /** Sólo en `formula`: variables cuyos 80–99 cuentan como sin dato. */
  especiales_na?: string[];
  /** Clave del segmento de cruce que la materializa (ADR 0107): se edita en Segmentos, no aquí. */
  segmento?: string;
};

export type AvisoBaseVariables = { codigo: "no_declarada" | "codificacion_aplicada" | "otro"; mensaje: string };

export type BaseVariables = {
  base: string;
  ya_codificada: boolean;
  extras: ColumnaPropia[];
  calculadas: VariableCalculada[];
  retiradas: string[];
  retiradas_pendientes: string[];
  /** Sólo la declaración los trae. */
  avisos: AvisoBaseVariables[];
};

export type ResumenCalculada = {
  por_codigo: { codigo: string; etiqueta: string; n: number }[];
  n_sin_dato: number;
  n_total: number;
  /** Sólo en `formula` (un número, no una escala). */
  numerico?: { n_validos: number; minimo: number | null; maximo: number | null } | null;
};

export type CalculadaGuardada = {
  base: string;
  calculada: VariableCalculada;
  resumen: ResumenCalculada;
  calculadas: VariableCalculada[];
};

export type ColumnaADeclarar = { name: string; label: string; tipo: TipoColumna; opciones?: OpcionBase[] };

export type CalculadaADeclarar = {
  nombre: string;
  etiqueta: string;
  regla: ReglaCalculada;
  variables: string[];
  codigos?: string[];
  mapa?: Record<string, string>;
  escala?: OpcionBase[];
  expresion?: string;
};

// ---------------------------------------------------------------------------
// Normalizador defensivo
// ---------------------------------------------------------------------------

/** Un vector de textos que R puede mandar como escalar, lista o `{}`. */
function textos(value: unknown): string[] {
  const crudo = Array.isArray(value) ? value : value == null || typeof value === "object" ? [] : [value];
  const vistos = new Set<string>();
  for (const item of crudo) {
    const t = codigo(item);
    if (t) vistos.add(t);
  }
  return [...vistos];
}

function entero(value: unknown): number {
  return enteroONulo(value) ?? 0;
}

function tipoColumna(value: unknown): TipoColumna {
  const t = texto(value);
  return (TIPOS_COLUMNA as readonly string[]).includes(t) ? (t as TipoColumna) : "text";
}

function regla(value: unknown): ReglaCalculada {
  const t = texto(value);
  return t === "recodificar" || t === "formula" ? t : "alguna";
}

function numeroONulo(value: unknown): number | null {
  const v = escalar(value);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Opciones sin código fuera; un código repetido cuenta una vez. */
export function normalizarOpciones(raw: unknown): OpcionBase[] {
  const vistos = new Set<string>();
  const out: OpcionBase[] = [];
  for (const fila of lista(raw)) {
    const c = codigo(fila.codigo);
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    out.push({ codigo: c, etiqueta: texto(fila.etiqueta) });
  }
  return out;
}

function normalizarMapa(raw: unknown): Record<string, string> {
  const r = registro(escalar(raw));
  const out: Record<string, string> = {};
  for (const [origen, destino] of Object.entries(r)) {
    const d = codigo(destino);
    if (origen.trim() && d) out[origen.trim()] = d;
  }
  return out;
}

export function normalizarCalculada(raw: unknown): VariableCalculada | null {
  const r = registro(escalar(raw));
  const nombre = texto(r.nombre);
  if (!nombre) return null;
  const reglaLeida = regla(r.regla);
  const escala = normalizarOpciones(r.escala);
  return {
    nombre,
    etiqueta: texto(r.etiqueta) || nombre,
    regla: reglaLeida,
    variables: textos(r.variables),
    codigos: textos(r.codigos),
    mapa: normalizarMapa(r.mapa),
    // La escala de `alguna` por defecto es 1 Sí / 0 No (backend).
    escala: escala.length || reglaLeida !== "alguna"
      ? escala
      : [{ codigo: "1", etiqueta: "Sí" }, { codigo: "0", etiqueta: "No" }],
    expresion: reglaLeida === "formula" ? texto(r.expresion) : "",
    especiales_na: reglaLeida === "formula" ? textos(r.especiales_na) : [],
    segmento: texto(r.segmento) || undefined,
  };
}

function normalizarCalculadas(raw: unknown): VariableCalculada[] {
  const vistos = new Set<string>();
  return lista(raw)
    .map(normalizarCalculada)
    .filter((c): c is VariableCalculada => {
      if (!c || vistos.has(c.nombre)) return false;
      vistos.add(c.nombre);
      return true;
    });
}

function normalizarColumna(raw: Record<string, unknown>): ColumnaPropia | null {
  const name = texto(raw.name);
  if (!name) return null;
  return {
    name,
    label: texto(raw.label) || name,
    tipo: tipoColumna(raw.tipo),
    opciones: normalizarOpciones(raw.opciones),
    n_validos: entero(raw.n_validos),
    declarada: booleano(raw.declarada),
  };
}

function normalizarAviso(raw: Record<string, unknown>): AvisoBaseVariables | null {
  const mensaje = texto(raw.mensaje);
  if (!mensaje) return null;
  const c = texto(raw.codigo);
  return { codigo: c === "no_declarada" || c === "codificacion_aplicada" ? c : "otro", mensaje };
}

export function normalizeBaseVariables(raw: unknown): BaseVariables {
  const root = registro(raw);
  const vistos = new Set<string>();
  const extras = lista(root.extras)
    .map(normalizarColumna)
    .filter((c): c is ColumnaPropia => {
      if (!c || vistos.has(c.name)) return false;
      vistos.add(c.name);
      return true;
    });
  return {
    base: texto(root.base),
    ya_codificada: booleano(root.ya_codificada),
    extras,
    calculadas: normalizarCalculadas(root.calculadas),
    retiradas: textos(root.retiradas),
    retiradas_pendientes: textos(root.retiradas_pendientes),
    avisos: lista(root.avisos)
      .map(normalizarAviso)
      .filter((a): a is AvisoBaseVariables => a !== null),
  };
}

export function normalizarResumenCalculada(raw: unknown): ResumenCalculada {
  const r = registro(escalar(raw));
  return {
    por_codigo: lista(r.por_codigo)
      .map((f) => ({ codigo: codigo(f.codigo), etiqueta: texto(f.etiqueta), n: entero(f.n) }))
      .filter((f) => f.codigo !== ""),
    n_sin_dato: entero(r.n_sin_dato),
    n_total: entero(r.n_total),
    numerico: r.n_validos === undefined
      ? null
      : { n_validos: entero(r.n_validos), minimo: numeroONulo(r.minimo), maximo: numeroONulo(r.maximo) },
  };
}

export function normalizeCalculadaGuardada(raw: unknown, pedida: CalculadaADeclarar): CalculadaGuardada {
  const root = registro(raw);
  const calculadas = normalizarCalculadas(root.calculadas);
  const calculada = normalizarCalculada(root.calculada)
    ?? calculadas.find((c) => c.nombre === pedida.nombre)
    ?? normalizarCalculada(pedida);
  if (!calculada) throw new Error("El servidor no devolvió la variable calculada.");
  return {
    base: texto(root.base),
    calculada,
    resumen: normalizarResumenCalculada(root.resumen),
    calculadas,
  };
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

function cuerpoJson(method: "POST", body: unknown): RequestInit {
  return { method, headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) };
}

export async function getBaseVariables(base: string): Promise<BaseVariables> {
  const qs = new URLSearchParams({ base }).toString();
  const raw = await handle<unknown>(await apiFetch(`/api/carga/base-variables?${qs}`, { headers: headers() }));
  return normalizeBaseVariables(raw);
}

export async function declararColumnasBase(
  base: string,
  declarar: readonly ColumnaADeclarar[],
  quitar: readonly string[] = [],
): Promise<BaseVariables> {
  const body: { base: string; declarar: ColumnaADeclarar[]; quitar?: string[] } = {
    base,
    declarar: declarar.map((d) => (d.tipo === "select_one" ? { ...d } : { name: d.name, label: d.label, tipo: d.tipo })),
  };
  if (quitar.length) body.quitar = [...quitar];
  const raw = await handle<unknown>(await apiFetch("/api/carga/base-variables/declarar", cuerpoJson("POST", body)));
  return normalizeBaseVariables(raw);
}

export async function guardarCalculadaBase(base: string, calculada: CalculadaADeclarar): Promise<CalculadaGuardada> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/base-variables/calculada", cuerpoJson("POST", { base, ...calculada })),
  );
  return normalizeCalculadaGuardada(raw, calculada);
}

export async function quitarCalculadaBase(base: string, nombre: string): Promise<VariableCalculada[]> {
  const qs = new URLSearchParams({ base, nombre }).toString();
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/base-variables/calculada?${qs}`, { method: "DELETE", headers: headers() }),
  );
  return normalizarCalculadas(registro(raw).calculadas);
}

export async function marcarBaseCodificada(base: string, yaCodificada: boolean): Promise<boolean> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/base-variables/codificada", cuerpoJson("POST", { base, ya_codificada: yaCodificada })),
  );
  return booleano(registro(raw).ya_codificada);
}
