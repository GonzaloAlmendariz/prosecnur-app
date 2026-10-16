// segmentos.ts — segmentos de cruce del estudio (ADR 0107).
//
// El estudio declara una vez sus segmentos de cruce (`cruce_<clave>`, con
// etiqueta y escala estándar) y cada base dice de qué variable suya sale cada
// uno y cómo se mapean sus códigos. Este módulo lee ese estado.
//
// Un backend anterior al ADR 0107 no tiene la ruta y responde 404
// (`E_NOT_FOUND`): se lee como «no disponible», no como un error, para que quien
// lo consulte (el recorrido de la serie) no se rompa. El backend también manda
// `disponible: false` cuando el estudio no aplica a equivalencias.
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio.

import { apiFetch, handle, headers } from "./core";
import { booleano, codigo, enteroONulo, escalar, lista, registro, texto } from "./normalizarR";

export type EstadoSegmentoBase = "definido" | "sin_origen" | "incompleto";

export type CategoriaSegmento = { codigo: string; etiqueta: string };

/** De dónde sale el segmento en una base. */
export type SegmentoEnBase = {
  /** Variable de origen en la base; vacía si la base no la tiene. */
  origen: string;
  /**
   * `código de origen -> código de la escala estándar`. El destino `""` es
   * «sin dato» explícito (el código se decidió dejar fuera) y se conserva.
   */
  mapa: Record<string, string>;
  estado: EstadoSegmentoBase;
  /** Códigos del origen que todavía no tienen destino en la escala. */
  n_sin_mapa: number;
  codigos_sin_mapa: string[];
  /** El origen declarado ya no está en la data (con estado `sin_origen`). */
  origen_ausente?: boolean;
};

export type Segmento = {
  clave: string;
  /** Nombre estándar en todas las bases: `cruce_<clave>`. */
  nombre: string;
  etiqueta: string;
  escala: CategoriaSegmento[];
  por_base: Record<string, SegmentoEnBase>;
  /** Fila de la matriz que lo representa (id o índice), si existe. */
  fila_ref: string;
};

export type SegmentosEstado = {
  /** Falso si el estudio no aplica a equivalencias, o si el backend no expone la ruta (404). */
  disponible: boolean;
  bases: string[];
  segmentos: Segmento[];
};

export const SEGMENTOS_NO_DISPONIBLES: SegmentosEstado = { disponible: false, bases: [], segmentos: [] };

// ---------------------------------------------------------------------------
// Normalizador defensivo
// ---------------------------------------------------------------------------

function textos(value: unknown): string[] {
  const crudo = Array.isArray(value) ? value : value == null || typeof value === "object" ? [] : [value];
  const vistos = new Set<string>();
  for (const item of crudo) {
    const t = texto(item);
    if (t) vistos.add(t);
  }
  return [...vistos];
}

function estadoSegmento(value: unknown): EstadoSegmentoBase {
  const t = texto(value);
  // Un estado que esta versión no conoce no se da por definido.
  return t === "definido" || t === "sin_origen" ? t : "incompleto";
}

/** El destino `""` («sin dato» explícito) se conserva; un destino que no es texto ni número, no. */
function normalizarMapa(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [origen, destino] of Object.entries(registro(escalar(raw)))) {
    const o = origen.trim();
    if (!o) continue;
    const v = escalar(destino);
    // Un texto se conserva tal cual, vacío incluido: `""` es «sin dato» explícito.
    if (typeof v === "string") {
      out[o] = v.trim() === "NA" ? "" : v.trim();
      continue;
    }
    const d = codigo(v);
    if (d) out[o] = d;
  }
  return out;
}

function normalizarEscala(raw: unknown): CategoriaSegmento[] {
  const vistos = new Set<string>();
  const out: CategoriaSegmento[] = [];
  for (const fila of lista(raw)) {
    const c = codigo(fila.codigo);
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    out.push({ codigo: c, etiqueta: texto(fila.etiqueta) || c });
  }
  return out;
}

function normalizarPorBase(raw: unknown): Record<string, SegmentoEnBase> {
  const out: Record<string, SegmentoEnBase> = {};
  for (const [base, valor] of Object.entries(registro(raw))) {
    const nombre = base.trim();
    if (!nombre) continue;
    const r = registro(escalar(valor));
    const entrada: SegmentoEnBase = {
      origen: texto(r.origen),
      mapa: normalizarMapa(r.mapa),
      estado: estadoSegmento(r.estado),
      n_sin_mapa: enteroONulo(r.n_sin_mapa) ?? 0,
      codigos_sin_mapa: textos(r.codigos_sin_mapa),
    };
    if (r.origen_ausente !== undefined) entrada.origen_ausente = booleano(r.origen_ausente);
    out[nombre] = entrada;
  }
  return out;
}

export function normalizarSegmento(raw: Record<string, unknown>): Segmento | null {
  const clave = texto(raw.clave);
  if (!clave) return null;
  const nombre = texto(raw.nombre) || `cruce_${clave}`;
  return {
    clave,
    nombre,
    etiqueta: texto(raw.etiqueta) || nombre,
    escala: normalizarEscala(raw.escala),
    por_base: normalizarPorBase(raw.por_base),
    fila_ref: texto(raw.fila_ref),
  };
}

export function normalizarSegmentos(raw: unknown): SegmentosEstado {
  const root = registro(raw);
  const vistos = new Set<string>();
  const segmentos = lista(root.segmentos)
    .map(normalizarSegmento)
    .filter((s): s is Segmento => {
      if (!s || vistos.has(s.clave)) return false;
      vistos.add(s.clave);
      return true;
    });
  // Sin el campo (payload viejo) se asume disponible: hay segmentos que leer.
  const disponible = root.disponible === undefined ? true : booleano(root.disponible);
  return { disponible, bases: textos(root.bases), segmentos };
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

export async function getSegmentos(): Promise<SegmentosEstado> {
  const res = await apiFetch("/api/carga/segmentos", { headers: headers() });
  // La ruta todavía no existe en este backend: sin segmentos, sin error.
  if (res.status === 404) return SEGMENTOS_NO_DISPONIBLES;
  return normalizarSegmentos(await handle<unknown>(res));
}

/** Lo que se declara de un segmento en una base: su origen y el mapa a la escala (`""` = sin dato). */
export type SegmentoEnBaseADeclarar = { origen: string; mapa: Record<string, string> };

export type SegmentoADeclarar = {
  clave: string;
  etiqueta: string;
  escala: CategoriaSegmento[];
  por_base: Record<string, SegmentoEnBaseADeclarar>;
};

/** Crea o reemplaza el segmento por `clave`; devuelve el estado completo. */
export async function guardarSegmento(segmento: SegmentoADeclarar): Promise<SegmentosEstado> {
  const raw = await handle<unknown>(await apiFetch("/api/carga/segmentos", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(segmento),
  }));
  return normalizarSegmentos(raw);
}

/** Quita el segmento, sus variables calculadas y su fila de la matriz. */
export async function quitarSegmento(clave: string): Promise<SegmentosEstado> {
  const qs = new URLSearchParams({ clave }).toString();
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/segmentos?${qs}`, { method: "DELETE", headers: headers() }),
  );
  return normalizarSegmentos(raw);
}
