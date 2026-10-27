// mailContactos.ts — los contactos de una campaña de correo (ADR 0112 §2 y §4).
//
// Contrato, todo bajo /api/recopiladores/:
//   GET mail-contacts                 lista paginada en el backend, con resumen
//       ?campaign_id=&q=&estado=efectivo|sin_correo|correo_invalido|repetido|todos
//       &filtros=<JSON {col:[valores]}>&respondio=si|no|todos&page=&per_page=
//   GET mail-contacts/perfil          tablero por variables de control
//       ?campaign_id=&filtros=<JSON>&cruce=a,b
//   PUT mail-contacts/control         {campaign_id, variables:[keys]} → {control}
//   PUT mail-contacts/enlace          {campaign_id, url, variable} → {generados, conservados, total, campo, variable}
//
// Vive aparte de `materialMail.ts` porque es un dominio propio: la lista ya no
// es un insumo del correo sino una entidad que se mira por perfil.
//
// Los normalizadores son defensivos porque R serializa un vector de largo uno
// como escalar, una lista vacía con nombres como `{}` y un `NA` como `null`:
// un campo que falta se lee como ausente («sin dato»), nunca como cero.
//
// **Privacidad.** Las filas traen correos: este módulo no los guarda en ningún
// almacenamiento del navegador; viven en memoria mientras la vista existe.

import { apiFetch, handle, headers } from "./core";

export const ESTADOS_DE_CONTACTO = ["efectivo", "sin_correo", "correo_invalido", "repetido"] as const;
export type EstadoDeContacto = (typeof ESTADOS_DE_CONTACTO)[number];
export type FiltroDeEstado = EstadoDeContacto | "todos";
export type FiltroDeRespuesta = "si" | "no" | "todos";

/** `{columna: [valores]}`: las categorías elegidas en el tablero. */
export type FiltrosDeContactos = Readonly<Record<string, readonly string[]>>;

export type ColumnaDeContactos = {
  key: string;
  label: string;
  /** La columna del enlace personal: ya tiene su celda («Enlace: Sí»), no se repite cruda. */
  es_enlace?: boolean;
};

export type FilaDeContacto = {
  fila: number;
  email: string;
  nombre: string;
  /** `null` si el backend manda un estado que este cliente no conoce. */
  estado: EstadoDeContacto | null;
  tiene_enlace: boolean;
  /** `null`: todavía no se leyó quién respondió. */
  respondio: boolean | null;
  valores: Readonly<Record<string, string | null>>;
};

export type ResumenDeContactos = {
  importados: number;
  efectivos: number;
  sin_correo: number;
  correo_invalido: number;
  repetidos: number;
  con_enlace: number;
  /** `null`: todavía no se leyó quién respondió. */
  respondieron: number | null;
  leido_en: string | null;
  /** El enlace del recopilador guardado en la campaña; `null` si aún no se generaron enlaces. */
  enlace_url: string | null;
  /** La variable de SurveyMonkey con que se generaron los enlaces; `null` si aún no. */
  enlace_variable: string | null;
};

export type PaginaDeContactos = {
  /** `false`: la campaña todavía no tiene lista (llega vacía y sin error). */
  cargados: boolean;
  total: number;
  page: number;
  per_page: number;
  columnas: ColumnaDeContactos[];
  rows: FilaDeContacto[];
  resumen: ResumenDeContactos;
};

export type TipoDeCandidata = "categorica" | "muchas";

export type CandidataDeControl = {
  key: string;
  label: string;
  distintos: number;
  tipo: TipoDeCandidata;
};

export type CategoriaDelPerfil = {
  valor: string;
  n: number;
  /** Escala 0–100 tal como llega; la vista recalcula con `n` y la base (`modeloContactos`). */
  pct: number | null;
  respondieron: number | null;
  /** Escala 0–100. */
  tasa: number | null;
  con_enlace: number | null;
  /** «Otros»: el resto de una variable con muchos valores. No es un valor de la lista: no filtra. */
  otros: boolean;
};

export type VariableDelPerfil = {
  key: string;
  label: string;
  categorias: CategoriaDelPerfil[];
  sin_dato: { n: number; pct: number | null; respondieron: number | null; tasa: number | null };
};

export type CruceDelPerfil = {
  a: string;
  b: string;
  /** Rótulos legibles de `a` y `b` (si no llegan, la vista usa los del perfil). */
  a_label?: string;
  b_label?: string;
  /** «Sin dato» rotula el `null` que el backend pone al final. */
  filas: string[];
  columnas: string[];
  /** `celdas[i][j]`: fila `i` de `a`, columna `j` de `b`. */
  celdas: number[][];
};

export type PerfilDeContactos = {
  cargados: boolean;
  /** Efectivos del corte (con los filtros aplicados). */
  base: number;
  control: string[];
  candidatas: CandidataDeControl[];
  variables: VariableDelPerfil[];
  cruce: CruceDelPerfil | null;
  respuestas_leidas: boolean;
  /** El enlace del recopilador guardado; `null` si aún no se generaron enlaces. */
  enlace_url: string | null;
  /** La variable de SurveyMonkey con que se generaron los enlaces; `null` si aún no. */
  enlace_variable: string | null;
};

export type EnlacesGenerados = {
  generados: number;
  conservados: number;
  total: number;
  campo: string;
  /** El enlace del recopilador tal como quedó guardado. */
  url: string;
  /** La variable de SurveyMonkey que lleva el token (`t` por defecto). */
  variable: string;
  /** Advertencia del backend (p. ej. el enlace no es de SurveyMonkey); se muestra tal cual. */
  aviso: string | null;
  /** Dónde quedó mapeado el campo en la plantilla. */
  mapeado: string[];
};

// ---- Lectores defensivos ------------------------------------------------------

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** R manda `["x"]` por `"x"`: un vector de largo uno se lee como su valor. */
function escalar(valor: unknown): unknown {
  return Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
}

function texto(valor: unknown): string {
  const v = escalar(valor);
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "";
}

function textoONulo(valor: unknown): string | null {
  const v = escalar(valor);
  if (v === null || v === undefined) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  const t = texto(v);
  return t === "" && typeof v !== "string" ? null : t;
}

function numeroONulo(valor: unknown): number | null {
  const v = escalar(valor);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function entero(valor: unknown, porDefecto = 0): number {
  const n = numeroONulo(valor);
  return n === null ? porDefecto : Math.max(0, Math.round(n));
}

function enteroONulo(valor: unknown): number | null {
  const n = numeroONulo(valor);
  return n === null ? null : Math.max(0, Math.round(n));
}

function booleanoONulo(valor: unknown): boolean | null {
  const v = escalar(valor);
  if (typeof v === "boolean") return v;
  if (v === "si" || v === "TRUE" || v === "true" || v === 1) return true;
  if (v === "no" || v === "FALSE" || v === "false" || v === 0) return false;
  return null;
}

/** Una lista; un escalar suelto es una lista de uno y `{}` es vacía. */
function lista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  if (valor === null || valor === undefined) return [];
  if (esRegistro(valor) && Object.keys(valor).length === 0) return [];
  return [valor];
}

function textos(valor: unknown): string[] {
  return lista(valor).map(texto).filter((t) => t !== "");
}

function estadoDe(valor: unknown): EstadoDeContacto | null {
  const t = texto(valor).trim().toLowerCase();
  return (ESTADOS_DE_CONTACTO as readonly string[]).includes(t) ? (t as EstadoDeContacto) : null;
}

// ---- Normalizadores -----------------------------------------------------------

function normalizarColumna(valor: unknown): ColumnaDeContactos | null {
  if (typeof valor === "string") return valor ? { key: valor, label: valor } : null;
  if (!esRegistro(valor)) return null;
  const key = texto(valor.key).trim();
  if (!key) return null;
  const columna: ColumnaDeContactos = { key, label: texto(valor.label).trim() || key };
  if (booleanoONulo(valor.es_enlace) === true) columna.es_enlace = true;
  return columna;
}

function normalizarValores(valor: unknown): Record<string, string | null> {
  if (!esRegistro(valor)) return {};
  const out: Record<string, string | null> = {};
  for (const [clave, crudo] of Object.entries(valor)) out[clave] = textoONulo(crudo);
  return out;
}

function normalizarFila(valor: unknown, posicion: number): FilaDeContacto | null {
  if (!esRegistro(valor)) return null;
  return {
    fila: entero(valor.fila, posicion + 1),
    email: texto(valor.email),
    nombre: texto(valor.nombre),
    estado: estadoDe(valor.estado),
    tiene_enlace: booleanoONulo(valor.tiene_enlace) === true,
    respondio: booleanoONulo(valor.respondio),
    valores: normalizarValores(valor.valores),
  };
}

export function normalizarResumenDeContactos(valor: unknown): ResumenDeContactos {
  const r = esRegistro(valor) ? valor : {};
  return {
    importados: entero(r.importados),
    efectivos: entero(r.efectivos),
    sin_correo: entero(r.sin_correo),
    correo_invalido: entero(r.correo_invalido),
    repetidos: entero(r.repetidos),
    con_enlace: entero(r.con_enlace),
    respondieron: enteroONulo(r.respondieron),
    leido_en: textoONulo(r.leido_en),
    enlace_url: textoONulo(r.enlace_url)?.trim() || null,
    enlace_variable: textoONulo(r.enlace_variable)?.trim() || null,
  };
}

function unicasPorClave<T extends { key: string }>(items: (T | null)[]): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item || vistos.has(item.key)) continue;
    vistos.add(item.key);
    out.push(item);
  }
  return out;
}

export function normalizarPaginaDeContactos(valor: unknown): PaginaDeContactos {
  const r = esRegistro(valor) ? valor : {};
  const rows = lista(r.rows)
    .map((fila, i) => normalizarFila(fila, i))
    .filter((fila): fila is FilaDeContacto => fila !== null);
  const perPage = entero(r.per_page, 50) || 50;
  return {
    cargados: booleanoONulo(r.cargados) ?? (rows.length > 0 || entero(esRegistro(r.resumen) ? r.resumen.importados : 0) > 0),
    total: entero(r.total, rows.length),
    page: Math.max(1, entero(r.page, 1)),
    per_page: perPage,
    columnas: unicasPorClave(lista(r.columnas).map(normalizarColumna)),
    rows,
    resumen: normalizarResumenDeContactos(r.resumen),
  };
}

function normalizarCandidata(valor: unknown): CandidataDeControl | null {
  const columna = normalizarColumna(valor);
  if (!columna) return null;
  const r = esRegistro(valor) ? valor : {};
  return {
    ...columna,
    distintos: entero(r.distintos),
    tipo: texto(r.tipo) === "muchas" ? "muchas" : "categorica",
  };
}

function normalizarCategoria(valor: unknown): CategoriaDelPerfil | null {
  if (!esRegistro(valor)) return null;
  const etiqueta = textoONulo(valor.valor);
  if (etiqueta === null) return null;
  return {
    valor: etiqueta,
    n: entero(valor.n),
    pct: numeroONulo(valor.pct),
    respondieron: enteroONulo(valor.respondieron),
    tasa: numeroONulo(valor.tasa),
    con_enlace: enteroONulo(valor.con_enlace),
    otros: booleanoONulo(valor.otros) === true,
  };
}

function normalizarVariable(valor: unknown): VariableDelPerfil | null {
  const columna = normalizarColumna(valor);
  if (!columna) return null;
  const r = esRegistro(valor) ? valor : {};
  const sinDato = esRegistro(r.sin_dato) ? r.sin_dato : {};
  return {
    ...columna,
    categorias: lista(r.categorias)
      .map(normalizarCategoria)
      .filter((c): c is CategoriaDelPerfil => c !== null),
    sin_dato: {
      n: entero(sinDato.n),
      pct: numeroONulo(sinDato.pct),
      respondieron: enteroONulo(sinDato.respondieron),
      tasa: numeroONulo(sinDato.tasa),
    },
  };
}

/**
 * Las celdas del cruce. R manda la matriz como lista de filas; una fila de una
 * sola columna puede llegar como escalar. Se recorta o completa con ceros al
 * tamaño que declaran `filas` y `columnas`, que son las que se pintan.
 */
function normalizarCeldas(valor: unknown, filas: number, columnas: number): number[][] {
  const crudas = lista(valor);
  return Array.from({ length: filas }, (_, i) => {
    const fila = lista(crudas[i]);
    return Array.from({ length: columnas }, (_, j) => entero(fila[j]));
  });
}

/** Un `null` (o vacío) en filas/columnas del cruce es «Sin dato», nunca un rótulo vacío. */
export const SIN_DATO = "Sin dato";
function rotuloDelCruce(valor: unknown): string {
  const t = textoONulo(valor);
  return t === null || t.trim() === "" ? SIN_DATO : t;
}

function normalizarCruce(valor: unknown): CruceDelPerfil | null {
  if (!esRegistro(valor)) return null;
  const a = texto(valor.a).trim();
  const b = texto(valor.b).trim();
  if (!a || !b) return null;
  const filas = lista(valor.filas).map(rotuloDelCruce);
  const columnas = lista(valor.columnas).map(rotuloDelCruce);
  const cruce: CruceDelPerfil = { a, b, filas, columnas, celdas: normalizarCeldas(valor.celdas, filas.length, columnas.length) };
  const aLabel = texto(valor.a_label).trim();
  const bLabel = texto(valor.b_label).trim();
  if (aLabel) cruce.a_label = aLabel;
  if (bLabel) cruce.b_label = bLabel;
  return cruce;
}

export function normalizarPerfilDeContactos(valor: unknown): PerfilDeContactos {
  const r = esRegistro(valor) ? valor : {};
  return {
    cargados: booleanoONulo(r.cargados) ?? true,
    base: entero(r.base),
    control: [...new Set(textos(r.control))],
    candidatas: unicasPorClave(lista(r.candidatas).map(normalizarCandidata)),
    variables: unicasPorClave(lista(r.variables).map(normalizarVariable)),
    cruce: normalizarCruce(r.cruce),
    respuestas_leidas: booleanoONulo(r.respuestas_leidas) === true,
    enlace_url: textoONulo(r.enlace_url)?.trim() || null,
    enlace_variable: textoONulo(r.enlace_variable)?.trim() || null,
  };
}

export function normalizarControl(valor: unknown): string[] {
  const r = esRegistro(valor) ? valor : {};
  return [...new Set(textos(r.control))];
}

export function normalizarEnlacesGenerados(valor: unknown): EnlacesGenerados {
  const r = esRegistro(valor) ? valor : {};
  const generados = entero(r.generados);
  const conservados = entero(r.conservados);
  return {
    generados,
    conservados,
    total: entero(r.total, generados + conservados),
    campo: texto(r.campo) || "enlace_encuesta",
    url: texto(r.url),
    variable: texto(r.variable).trim() || "t",
    aviso: textoONulo(r.aviso)?.trim() || null,
    mapeado: textos(r.mapeado),
  };
}

// ---- Consultas ------------------------------------------------------------------

export type ConsultaDeContactos = {
  campaignId: string;
  q?: string;
  estado?: FiltroDeEstado;
  respondio?: FiltroDeRespuesta;
  filtros?: FiltrosDeContactos;
  page?: number;
  perPage?: number;
};

export type ConsultaDelPerfil = {
  campaignId: string;
  filtros?: FiltrosDeContactos;
  cruce?: readonly [string, string] | null;
};

/** `filtros` como JSON estable, sin columnas vacías; `null` si no filtra nada. */
export function filtrosComoJson(filtros: FiltrosDeContactos | undefined): string | null {
  if (!filtros) return null;
  const limpios: Record<string, string[]> = {};
  for (const clave of Object.keys(filtros).sort()) {
    const valores = [...new Set(filtros[clave] ?? [])];
    if (valores.length) limpios[clave] = valores;
  }
  return Object.keys(limpios).length ? JSON.stringify(limpios) : null;
}

export function queryDeContactos(c: ConsultaDeContactos): string {
  const p = new URLSearchParams();
  p.set("campaign_id", c.campaignId);
  const q = (c.q ?? "").trim();
  if (q) p.set("q", q);
  p.set("estado", c.estado ?? "todos");
  const filtros = filtrosComoJson(c.filtros);
  if (filtros) p.set("filtros", filtros);
  p.set("respondio", c.respondio ?? "todos");
  p.set("page", String(Math.max(1, Math.round(c.page ?? 1))));
  p.set("per_page", String(Math.max(1, Math.round(c.perPage ?? 50))));
  return p.toString();
}

export function queryDelPerfil(c: ConsultaDelPerfil): string {
  const p = new URLSearchParams();
  p.set("campaign_id", c.campaignId);
  const filtros = filtrosComoJson(c.filtros);
  if (filtros) p.set("filtros", filtros);
  if (c.cruce && c.cruce[0] && c.cruce[1] && c.cruce[0] !== c.cruce[1]) p.set("cruce", `${c.cruce[0]},${c.cruce[1]}`);
  return p.toString();
}

const BASE = "/api/recopiladores/mail-contacts";

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  };
}

export async function apiMailContactos(consulta: ConsultaDeContactos): Promise<PaginaDeContactos> {
  const res = await apiFetch(`${BASE}?${queryDeContactos(consulta)}`, { headers: headers() });
  return normalizarPaginaDeContactos(await handle<unknown>(res));
}

export async function apiMailContactosPerfil(consulta: ConsultaDelPerfil): Promise<PerfilDeContactos> {
  const res = await apiFetch(`${BASE}/perfil?${queryDelPerfil(consulta)}`, { headers: headers() });
  return normalizarPerfilDeContactos(await handle<unknown>(res));
}

export async function apiMailContactosControl(campaignId: string, variables: readonly string[]): Promise<string[]> {
  const res = await apiFetch(`${BASE}/control`, json("PUT", { campaign_id: campaignId, variables: [...variables] }));
  return normalizarControl(await handle<unknown>(res));
}

export async function apiMailContactosEnlace(campaignId: string, url: string, variable: string): Promise<EnlacesGenerados> {
  const res = await apiFetch(`${BASE}/enlace`, json("PUT", { campaign_id: campaignId, url, variable }));
  return normalizarEnlacesGenerados(await handle<unknown>(res));
}
