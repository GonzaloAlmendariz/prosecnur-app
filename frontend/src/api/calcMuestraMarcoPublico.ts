/**
 * Cliente del marco de un público en un estudio por correo o teléfono (barrido, ADR 0143; fases 5 a 7 del rediseño
 * de Cálculo de muestra). Rutas de `router_calc_muestra_marco_publico.R`:
 *
 * - `/leer`: hojas del libro (datos, consulta, notas) y perfil de las columnas con su uso sugerido.
 * - `/invitados`: embudo de quién se invita, regla por regla.
 * - `/cruce`: población por una o dos columnas, con grupos y cuotas.
 * - `/declarar`: guarda el marco del actor con su receta; escribe N y un estrato por segmento.
 *
 * Normalizador defensivo (patrón `normalizeGraficosShareInspect`): jsonlite desempaca arreglos de uno y los NA
 * llegan como `null`. Un payload sin forma reconocible es un error, no un objeto a medias.
 */
import { ApiError, apiFetch, handle, headers } from "./core";
import type { CalcMuestraComponente, CalcMuestraEstudio } from "./calcMuestra";

export type UsoDeColumna = "id" | "correo" | "cuota" | "regla" | "personal" | "no";
export type TipoDeColumna = "codigo" | "correo" | "telefono" | "texto" | "categoria" | "numero" | "vacia";
export type TipoDeHoja = "datos" | "consulta" | "notas" | "vacia";

export type HojaDelMarco = { nombre: string; tipo: TipoDeHoja; filas: number; columnas: number; encabezadoFila: number };
export type ValorDeColumna = { valor: string; n: number };
export type ColumnaDelMarco = {
  nombre: string;
  tipo: TipoDeColumna;
  valores: number;
  vacios: number;
  unico: boolean;
  /** Solo las categorías publican valores: un código, un correo o un nombre nunca. */
  distribucion: ValorDeColumna[];
  otros: number;
  resumen: { min: number; mediana: number; max: number } | null;
  usoSugerido: UsoDeColumna;
};
export type LecturaDelMarco = {
  formato: string;
  separador: string;
  codificacion: string;
  hojas: HojaDelMarco[];
  sugerida: string;
  hoja: string;
  filas: number;
  columnas: ColumnaDelMarco[];
};

export type ReglaDeInvitacion =
  | { tipo: "excluir_valores"; columna: string; valores: string[] }
  | { tipo: "excluir_sin_correo" };
export type PasoDelEmbudo = { tipo: string; etiqueta: string; columna: string; valores: string[]; quitadas: number; quedan: number };
export type EmbudoDeInvitados = { base: number; invitados: number; pasos: PasoDelEmbudo[] };

export type CeldaDeGrupo = { fila: string; columna: string };
export type GrupoDeCeldas = { nombre: string; celdas: CeldaDeGrupo[] };
export type CruceDelMarco = {
  filaVariable: string;
  columnaVariable: string;
  filas: string[];
  columnas: string[];
  /** filas x columnas, en el orden de `filas` y `columnas`. */
  conteos: number[][];
  total: number;
};

export type RecetaDelMarco = {
  columnas: { id: string; correo: string };
  usos: Record<string, UsoDeColumna>;
  reglas: ReglaDeInvitacion[];
  segmento: { nombre: string; fila: string; columna: string; grupos: GrupoDeCeldas[] };
};

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : 0);

const USOS: readonly UsoDeColumna[] = ["id", "correo", "cuota", "regla", "personal", "no"];
const TIPOS: readonly TipoDeColumna[] = ["codigo", "correo", "telefono", "texto", "categoria", "numero", "vacia"];
const TIPOS_HOJA: readonly TipoDeHoja[] = ["datos", "consulta", "notas", "vacia"];
const uno = <T extends string>(v: unknown, opciones: readonly T[], defecto: T): T => (opciones.includes(v as T) ? (v as T) : defecto);

function sinForma(ruta: string): ApiError {
  return new ApiError("E_CALC_MUESTRA_MARCO_RESPUESTA", `La respuesta de ${ruta} no trae la forma esperada. Reintenta; si persiste, reinicia la app.`);
}

export function normalizarLectura(raw: unknown): LecturaDelMarco | null {
  const r = rec(raw);
  const archivo = rec(r?.archivo);
  if (!r || !archivo) return null;
  return {
    formato: texto(archivo.formato),
    separador: texto(archivo.separador),
    codificacion: texto(archivo.codificacion),
    hojas: lista(archivo.hojas).map(rec).filter((h): h is Record<string, unknown> => h != null).map((h) => ({
      nombre: texto(h.nombre),
      tipo: uno(h.tipo, TIPOS_HOJA, "datos"),
      filas: numero(h.filas),
      columnas: numero(h.columnas),
      encabezadoFila: numero(h.encabezado_fila) || 1,
    })),
    sugerida: texto(archivo.sugerida),
    hoja: texto(r.hoja),
    filas: numero(r.filas),
    columnas: lista(r.columnas).map(rec).filter((c): c is Record<string, unknown> => c != null && texto(c.nombre) !== "").map((c) => {
      const resumen = rec(c.resumen);
      return {
        nombre: texto(c.nombre),
        tipo: uno(c.tipo, TIPOS, "texto"),
        valores: numero(c.valores),
        vacios: numero(c.vacios),
        unico: c.unico === true,
        distribucion: lista(c.distribucion).map(rec).filter((d): d is Record<string, unknown> => d != null).map((d) => ({ valor: texto(d.valor), n: numero(d.n) })),
        otros: numero(c.otros),
        resumen: resumen ? { min: numero(resumen.min), mediana: numero(resumen.mediana), max: numero(resumen.max) } : null,
        usoSugerido: uno(c.uso_sugerido, USOS, "no"),
      };
    }),
  };
}

export function normalizarEmbudo(raw: unknown): EmbudoDeInvitados | null {
  const r = rec(raw);
  if (!r || r.base == null) return null;
  return {
    base: numero(r.base),
    invitados: numero(r.invitados),
    pasos: lista(r.pasos).map(rec).filter((p): p is Record<string, unknown> => p != null).map((p) => ({
      tipo: texto(p.tipo),
      etiqueta: texto(p.etiqueta),
      columna: texto(p.columna),
      valores: lista(p.valores).map(texto),
      quitadas: numero(p.quitadas),
      quedan: numero(p.quedan),
    })),
  };
}

export function normalizarCruce(raw: unknown): CruceDelMarco | null {
  const r = rec(raw);
  if (!r) return null;
  const filas = lista(r.filas).map(texto);
  const columnas = lista(r.columnas).map(texto);
  const porFila = new Map(lista(r.conteos).map(rec).filter((x): x is Record<string, unknown> => x != null).map((x) => [texto(x.categoria), lista(x.valores).map(numero)]));
  return {
    filaVariable: texto(r.fila_variable),
    columnaVariable: texto(r.columna_variable),
    filas,
    columnas,
    conteos: filas.map((f) => { const v = porFila.get(f) ?? []; return columnas.map((_, j) => v[j] ?? 0); }),
    total: numero(r.total),
  };
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

async function post(ruta: string, body: unknown): Promise<Record<string, unknown>> {
  const raw = await handle<unknown>(await apiFetch(`/api/calc-muestra/marco-publico/${ruta}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }));
  const r = rec(raw);
  if (!r) throw sinForma(`/marco-publico/${ruta}`);
  return r;
}

export async function apiMarcoPublicoLeer(input: { fileId: string; hoja?: string }): Promise<LecturaDelMarco> {
  const r = await post("leer", { file_id: input.fileId, hoja: input.hoja ?? "" });
  const out = normalizarLectura(r);
  if (!out) throw sinForma("/marco-publico/leer");
  return out;
}

export async function apiMarcoPublicoInvitados(input: { fileId: string; hoja: string; columnaCorreo: string; reglas: ReglaDeInvitacion[] }): Promise<EmbudoDeInvitados> {
  const r = await post("invitados", { file_id: input.fileId, hoja: input.hoja, columna_correo: input.columnaCorreo, reglas: input.reglas });
  const out = normalizarEmbudo(r);
  if (!out) throw sinForma("/marco-publico/invitados");
  return out;
}

export async function apiMarcoPublicoCruce(input: {
  fileId: string; hoja: string; columnaCorreo: string; reglas: ReglaDeInvitacion[]; fila: string; columna: string;
}): Promise<{ invitados: number; cruce: CruceDelMarco }> {
  const r = await post("cruce", {
    file_id: input.fileId, hoja: input.hoja, columna_correo: input.columnaCorreo, reglas: input.reglas, fila: input.fila, columna: input.columna,
  });
  const cruce = normalizarCruce(r.cruce);
  if (!cruce) throw sinForma("/marco-publico/cruce");
  return { invitados: numero(r.invitados), cruce };
}

export async function apiMarcoPublicoDeclarar(input: {
  componenteId: string; fileId: string; hoja: string; receta: RecetaDelMarco;
}): Promise<{ componente: CalcMuestraComponente | null; estudio: CalcMuestraEstudio | null }> {
  const r = await post("declarar", { componente_id: input.componenteId, file_id: input.fileId, hoja: input.hoja, receta: input.receta });
  const comp = rec(r.componente);
  const est = rec(r.estudio);
  return {
    componente: comp && typeof comp.id === "string" ? (comp as unknown as CalcMuestraComponente) : null,
    estudio: est && Array.isArray(est.componentes) ? (est as unknown as CalcMuestraEstudio) : null,
  };
}

// ---------------------------------------------------------------------------
// Cuotas sobre el marco guardado
// ---------------------------------------------------------------------------

export type ModoDeCuota = "celda" | "control" | "minimo";
export type FilaDeCuota = { categoria: string; N: number; n: number; margen: number | null };
export type CeldaChica = { fila: string; columna: string; N: number; n: number };
export type CuotasDelActor = {
  cruce: CruceDelMarco;
  modo: ModoDeCuota;
  meta: number;
  total: number;
  /** Lo que suma el mínimo sobre la meta. */
  extra: number;
  /** filas x columnas en el orden del cruce; `null` en modo control. */
  cuotas: number[][] | null;
  /** Lo esperado por celda (con decimales) en modo control. */
  esperadas: number[][] | null;
  porFila: FilaDeCuota[];
  chicas: CeldaChica[];
  umbral: number;
  celdas: number;
  columnasCuota: string[];
};

function matriz(raw: unknown, filas: readonly string[], ncol: number): number[][] | null {
  if (raw == null) return null;
  const porFila = new Map(lista(raw).map(rec).filter((x): x is Record<string, unknown> => x != null).map((x) => [texto(x.categoria), lista(x.valores).map(numero)]));
  return filas.map((f) => { const v = porFila.get(f) ?? []; return Array.from({ length: ncol }, (_, j) => v[j] ?? 0); });
}

export async function apiMarcoPublicoCuotas(input: {
  componenteId: string; meta: number; modo: ModoDeCuota; minimo?: number; columna: string;
}): Promise<CuotasDelActor> {
  const r = await post("cuotas", {
    componente_id: input.componenteId, meta: input.meta, modo: input.modo, minimo: input.minimo ?? 10, columna: input.columna,
  });
  const cruce = normalizarCruce(r.cruce);
  const cu = rec(r.cuotas);
  if (!cruce || !cu) throw sinForma("/marco-publico/cuotas");
  const modo = uno(cu.modo, ["celda", "control", "minimo"] as const, "celda");
  return {
    cruce,
    modo,
    meta: numero(cu.meta),
    total: numero(cu.total),
    extra: numero(cu.extra),
    cuotas: matriz(cu.cuotas, cruce.filas, cruce.columnas.length),
    esperadas: matriz(cu.esperadas, cruce.filas, cruce.columnas.length),
    porFila: lista(cu.por_fila).map(rec).filter((x): x is Record<string, unknown> => x != null).map((x) => ({
      categoria: texto(x.categoria), N: numero(x.N), n: numero(x.n), margen: x.margen == null ? null : numero(x.margen),
    })),
    chicas: lista(cu.chicas).map(rec).filter((x): x is Record<string, unknown> => x != null).map((x) => ({
      fila: texto(x.fila), columna: texto(x.columna), N: numero(x.N), n: numero(x.n),
    })),
    umbral: numero(cu.umbral) || 10,
    celdas: numero(cu.celdas),
    columnasCuota: lista(r.columnas_cuota).map(texto).filter(Boolean),
  };
}
