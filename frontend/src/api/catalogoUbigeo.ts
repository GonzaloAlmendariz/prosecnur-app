// catalogoUbigeo.ts — el catálogo nacional de ubigeos (motor
// `api/R/catalogo_ubigeo.R`, router `api/R/router_catalogo_ubigeo.R`) y lo que
// la regla "Combinación fuera de catálogo" agrega al conteo previo
// (`api/R/reglas_custom_catalogo.R`). Todo es lectura: nada guarda.
//
//   GET /api/catalogos/ubigeo/buscar?q=&nivel=&limite=
//   GET /api/catalogos/ubigeo/cascada?departamento=&provincia=
//   GET /api/validacion/v2/reglas_custom/catalogo/proponer  (X-Base-Nombre)
//
// Una cifra ausente queda `null`, nunca 0.

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";

export type NivelDeCatalogo = "departamento" | "provincia" | "distrito";
export type PapelDeCatalogo = NivelDeCatalogo | "ubigeo";

export const PAPELES_DE_CATALOGO: readonly PapelDeCatalogo[] = ["departamento", "provincia", "distrito", "ubigeo"];

/** Un lugar del catálogo con su ruta completa. Los niveles que no aplican van `null`. */
export type LugarDelCatalogo = {
  nivel: NivelDeCatalogo;
  /** Código del nivel: 2 dígitos el departamento, 4 la provincia, 6 el distrito. */
  codigo: string | null;
  ubigeo: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  /** "Comas (Lima, Lima)". */
  ruta: string;
};

/** Un valor propuesto para un papel, con su origen. Nunca se aplica solo. */
export type CandidatoDeCatalogo = {
  papel: PapelDeCatalogo;
  valor: string;
  /** El lugar completo, para reemplazar todas las columnas de una vez. */
  lugar: Omit<LugarDelCatalogo, "nivel" | "codigo" | "ruta">;
  /** "por el ubigeo 150110", "nombre parecido". */
  causa: string;
};

export type EstadoDeCatalogo = "ok" | "incompleto" | "error" | "no_reconocido" | "omitido" | "sin_datos";

/** Lo que el motor dice de un caso marcado. */
export type ResumenDeCatalogo = {
  estado: EstadoDeCatalogo;
  causa: string | null;
  candidatos: CandidatoDeCatalogo[];
  /** Marcado y sin candidato. */
  aInvestigar: boolean;
  notas: string[];
};

/** Encuestas por estado sobre las filas que evalúa la auditoría (`n_filas`, sin el filtro). */
export type LecturaDeCatalogo = {
  nFilas: number | null;
  nOk: number | null;
  nIncompletas: number | null;
  nError: number | null;
  nNoReconocido: number | null;
  nOmitidas: number | null;
  nSinDatos: number | null;
  nAInvestigar: number | null;
  nUbigeoSinCero: number | null;
  noReconocidos: { papel: PapelDeCatalogo; valor: string; n: number }[];
};

export type PapelesDeCatalogo = Record<PapelDeCatalogo, string | null>;

export type GrupoPropuesto = { papeles: PapelesDeCatalogo; coherencia: number | null };

export type PropuestaDePapeles = {
  estado: "propuesta" | "sin_datos";
  baseNombre: string | null;
  catalogo: string;
  catalogoNombre: string;
  nFilas: number | null;
  /** El mejor grupo; `propuestas[0]` es el mismo. */
  propuesta: PapelesDeCatalogo;
  propuestas: GrupoPropuesto[];
  /** Por columna, la parte (0 a 1) de sus valores no vacíos que casa con cada nivel. */
  columnas: { columna: string; nValores: number | null; parte: Record<PapelDeCatalogo, number | null> }[];
};

function textoONulo(value: unknown): string | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return null;
  const s = texto(v);
  return s ? s : null;
}

function papel(value: unknown): PapelDeCatalogo | null {
  const s = texto(value);
  return (PAPELES_DE_CATALOGO as readonly string[]).includes(s) ? (s as PapelDeCatalogo) : null;
}

function nivel(value: unknown): NivelDeCatalogo | null {
  const p = papel(value);
  return p && p !== "ubigeo" ? p : null;
}

export function normalizarLugar(value: unknown): LugarDelCatalogo | null {
  const r = registro(value);
  const n = nivel(r.nivel);
  if (!n) return null;
  return {
    nivel: n,
    codigo: textoONulo(r.codigo),
    ubigeo: textoONulo(r.ubigeo),
    departamento: textoONulo(r.departamento),
    provincia: textoONulo(r.provincia),
    distrito: textoONulo(r.distrito),
    ruta: texto(r.ruta),
  };
}

function normalizarPapeles(value: unknown): PapelesDeCatalogo {
  const r = registro(value);
  return {
    departamento: textoONulo(r.departamento),
    provincia: textoONulo(r.provincia),
    distrito: textoONulo(r.distrito),
    ubigeo: textoONulo(r.ubigeo),
  };
}

export function normalizarCandidato(value: unknown): CandidatoDeCatalogo | null {
  const r = registro(value);
  const p = papel(r.rol);
  const valor = textoONulo(r.valor);
  if (!p || !valor) return null;
  const e = registro(r.entidad);
  return {
    papel: p,
    valor,
    lugar: {
      ubigeo: textoONulo(e.ubigeo),
      departamento: textoONulo(e.departamento),
      provincia: textoONulo(e.provincia),
      distrito: textoONulo(e.distrito),
    },
    causa: texto(r.causa),
  };
}

const ESTADOS: readonly EstadoDeCatalogo[] = ["ok", "incompleto", "error", "no_reconocido", "omitido", "sin_datos"];

export function normalizarResumenDeCatalogo(value: unknown): ResumenDeCatalogo | null {
  if (value === null || value === undefined) return null;
  const r = registro(value);
  const estado = texto(r.estado);
  if (!(ESTADOS as readonly string[]).includes(estado)) return null;
  return {
    estado: estado as EstadoDeCatalogo,
    causa: textoONulo(r.causa),
    candidatos: lista(r.candidatos).map(normalizarCandidato).filter((c): c is CandidatoDeCatalogo => c !== null),
    aInvestigar: booleano(r.a_investigar),
    notas: (Array.isArray(r.notas) ? r.notas : []).map((n) => texto(n)).filter(Boolean),
  };
}

export function normalizarLecturaDeCatalogo(value: unknown): LecturaDeCatalogo | null {
  if (value === null || value === undefined) return null;
  const r = registro(value);
  if (!("n_filas" in r)) return null;
  return {
    nFilas: enteroONulo(r.n_filas),
    nOk: enteroONulo(r.n_ok),
    nIncompletas: enteroONulo(r.n_incompletas),
    nError: enteroONulo(r.n_error),
    nNoReconocido: enteroONulo(r.n_no_reconocido),
    nOmitidas: enteroONulo(r.n_omitidas),
    nSinDatos: enteroONulo(r.n_sin_datos),
    nAInvestigar: enteroONulo(r.n_a_investigar),
    nUbigeoSinCero: enteroONulo(r.n_ubigeo_sin_cero),
    noReconocidos: lista(r.no_reconocidos)
      .map((x) => {
        const p = papel(x.papel);
        const valor = textoONulo(x.valor);
        const n = enteroONulo(x.n);
        return p && valor && n !== null ? { papel: p, valor, n } : null;
      })
      .filter((x): x is { papel: PapelDeCatalogo; valor: string; n: number } => x !== null),
  };
}

export function normalizarPropuesta(value: unknown): PropuestaDePapeles {
  const r = registro(value);
  return {
    estado: texto(r.estado) === "propuesta" ? "propuesta" : "sin_datos",
    baseNombre: textoONulo(r.base_nombre),
    catalogo: texto(r.catalogo) || "ubigeo_peru",
    catalogoNombre: texto(r.catalogo_nombre),
    nFilas: enteroONulo(r.n_filas),
    propuesta: normalizarPapeles(r.propuesta),
    propuestas: lista(r.propuestas).map((g) => ({ papeles: normalizarPapeles(g.roles), coherencia: numeroONulo(g.coherencia) })),
    columnas: lista(r.columnas).map((c) => {
      const parte = registro(c.parte);
      return {
        columna: texto(c.columna),
        nValores: enteroONulo(c.n_valores),
        parte: {
          departamento: numeroONulo(parte.departamento),
          provincia: numeroONulo(parte.provincia),
          distrito: numeroONulo(parte.distrito),
          ubigeo: numeroONulo(parte.ubigeo),
        },
      };
    }),
  };
}

export async function apiCatalogoUbigeoBuscar(
  q: string,
  opciones: { nivel?: NivelDeCatalogo | "todos"; limite?: number; signal?: AbortSignal } = {},
): Promise<LugarDelCatalogo[]> {
  const params = new URLSearchParams({ q, nivel: opciones.nivel ?? "todos", limite: String(opciones.limite ?? 20) });
  const raw = await handle<unknown>(
    await apiFetch(`/api/catalogos/ubigeo/buscar?${params.toString()}`, { headers: headers(), signal: opciones.signal }),
  );
  return lista(registro(raw).items).map(normalizarLugar).filter((x): x is LugarDelCatalogo => x !== null);
}

export async function apiCatalogoUbigeoCascada(
  departamento?: string | null,
  provincia?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<{ nivel: NivelDeCatalogo; lugares: LugarDelCatalogo[] }> {
  const params = new URLSearchParams();
  if (departamento) params.set("departamento", departamento);
  if (departamento && provincia) params.set("provincia", provincia);
  const raw = registro(
    await handle<unknown>(
      await apiFetch(`/api/catalogos/ubigeo/cascada?${params.toString()}`, { headers: headers(), signal: opciones.signal }),
    ),
  );
  return {
    nivel: nivel(raw.nivel) ?? "departamento",
    lugares: lista(raw.items).map(normalizarLugar).filter((x): x is LugarDelCatalogo => x !== null),
  };
}

export async function apiCatalogoProponerPapeles(
  baseNombre?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<PropuestaDePapeles> {
  const h = headers();
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  const raw = await handle<unknown>(
    await apiFetch("/api/validacion/v2/reglas_custom/catalogo/proponer", { headers: h, signal: opciones.signal }),
  );
  return normalizarPropuesta(raw);
}
