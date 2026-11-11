/**
 * Arnés de la caracterización de Carga (etapa P4b del rediseño de Procesamiento).
 *
 * Monta la página real, con sus hijos reales, sobre una sesión simulada y un
 * `fetch` simulado, y compara cada escenario con su huella sha256: el marcado
 * normalizado y la lista ordenada de pedidos al backend. Cada grupo de pruebas
 * (un archivo por grupo) tiene su JSON en `huellas/<grupo>.json`.
 *
 * Las huellas no se regeneran para arreglar un rojo: si cambian, el cambio
 * alteró algo. Regenerar es explícito (ACTUALIZAR_HUELLAS_CARGA=1) y solo
 * escribe los escenarios visitados en esa corrida.
 *
 * VOLCAR_CARGA=<carpeta> vuelca a esa carpeta, por grupo, el marcado normalizado
 * y los pedidos de todos los escenarios que corran, pasen o no, para comparar
 * con `diff -r antes despues`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "../../../../api/core";
import type { EstudioBase, EstudioPayload } from "../../../../api/estudio";

const sesion = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("../../../../lib/SessionContext", () => ({
  useSession: () => sesion.actual,
  useOptionalSession: () => sesion.actual,
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

import CargaPage from "../../CargaPage";
import { usePlataformaStore } from "../../plataforma/usePlataformaStore";
import { useCargaStore } from "../../store";

// ── Sesión ───────────────────────────────────────────────────────────────────

export const ESTADO_VACIO: SessionState = {
  session_id: "sid-prueba",
  created_at: "2026-01-01T00:00:00Z",
  xlsform: false,
  data: false,
  instrumento_parsed: false,
  data_previewed: false,
  plan_built: false,
  auditoria_run: false,
  codif_familias_generated: false,
  codif_familias_loaded: false,
  codif_plantilla_template: false,
  codif_plantilla_codigos_loaded: false,
  codif_aplicado: false,
  analitica_prep_ok: false,
  analitica_codebook_ok: false,
  analitica_frecuencias_ok: false,
  analitica_cruces_ok: false,
  analitica_spss_ok: false,
  analitica_enumeradores_ok: false,
  analitica_dim_ok: false,
  analitica_multibase_available: false,
  analitica_multibase_ok: false,
  analitica_panel_ok: false,
  analitica_ficha_tecnica_ok: false,
  analitica_fuente: null,
  hojas_ruta_ok: false,
  graficos_ppt_ok: false,
  graficos_word_ok: false,
  estudio_nombre: null,
  has_estudio: false,
  estudio_processing_mode: null,
  estudio_topology_declared: null,
  active_base: null,
  n_bases: 0,
  bases_nombres: [],
};

export function estado(cambios: Partial<SessionState>): SessionState {
  return { ...ESTADO_VACIO, ...cambios };
}

export const UNA_BASE_VACIA = estado({});
export const UNA_BASE_COMPLETA = estado({
  xlsform: true,
  data: true,
  instrumento_parsed: true,
  data_previewed: true,
  has_estudio: true,
  n_bases: 1,
  bases_nombres: ["default"],
  active_base: "default",
});

export function base(nombre: string, cambios: Partial<EstudioBase> = {}): EstudioBase {
  return {
    nombre,
    xlsform_file_id: `xls-${nombre}`,
    xlsform_file_name: `${nombre}.xlsx`,
    data_file_id: `dat-${nombre}`,
    data_file_name: `${nombre}-respuestas.xlsx`,
    data_ext: "xlsx",
    n_filas: 120,
    n_columnas: 34,
    added_at: "2026-01-02T00:00:00Z",
    source_kind: "manual",
    ...cambios,
  };
}

export function estudio(
  bases: EstudioBase[],
  cambios: Partial<EstudioPayload> = {},
): EstudioPayload {
  return {
    nombre: "Estudio de prueba",
    processing_mode: "multibase",
    topology_declared: "separate",
    active_base: bases[0]?.nombre ?? null,
    n_bases: bases.length,
    bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
    max_bases: 12,
    ...cambios,
  };
}

export const BASES_DOS = [base("docentes"), base("estudiantes", { n_filas: 480, n_columnas: 41 })];

export const VARIAS_SEPARADAS = {
  estado: estado({
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 2,
    bases_nombres: ["docentes", "estudiantes"],
    active_base: "docentes",
  }),
  estudio: estudio(BASES_DOS),
};

export const BASE_INTEGRADA = base("integrada", {
  n_filas: 600,
  multi_integrated: {
    version: 1,
    kind: "manual",
    origin_key_name: "publico",
    origins: [
      { id: "o1", source_kind: "manual", key_value: "docentes", label: "Docentes", xlsform_file_id: "xls-o1", data_file_id: "dat-o1", data_file_name: "docentes.xlsx" },
      { id: "o2", source_kind: "manual", key_value: "estudiantes", label: "Estudiantes", xlsform_file_id: "xls-o2", data_file_id: "dat-o2", data_file_name: "estudiantes.xlsx" },
    ],
  },
});

/** Varias entradas integradas en una base: la estrategia NO es "separate", así que Fuentes pinta BasesPanel. */
export const VARIAS_INTEGRADAS = {
  estado: estado({
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "integrated",
    n_bases: 1,
    bases_nombres: ["integrada"],
    active_base: "integrada",
  }),
  estudio: estudio([BASE_INTEGRADA], { topology_declared: "integrated" }),
};

export const VARIAS_SIN_BASES = {
  estado: estado({
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 0,
    bases_nombres: [],
  }),
  estudio: estudio([]),
};

// ── Backend simulado ─────────────────────────────────────────────────────────

export type Respuesta = unknown | (() => unknown);
export type Ruta = [metodo: string, ruta: string | RegExp, respuesta: Respuesta];

export const ESTRUCTURA = {
  secciones: [{ name: "datos", label: "Datos generales", n_preguntas: 2 }],
  preguntas: [
    { name: "edad", label: "Edad", type: "integer", seccion: "datos" },
    { name: "sexo", label: "Sexo", type: "select_one sexo", seccion: "datos" },
  ],
};

export const CONEXIONES = {
  ok: true,
  connections: [
    {
      provider: "surveymonkey",
      has_token: true,
      active_profile_id: "sm-1",
      active_profile_alias: "Principal",
      profiles: [{ id: "sm-1", alias: "Principal", has_token: true, is_default: true }],
    },
    {
      provider: "kobo",
      has_token: true,
      active_profile_id: "kb-1",
      active_profile_alias: "Kobo oficina",
      active_profile_base_url: "https://kf.kobotoolbox.org",
      profiles: [{ id: "kb-1", alias: "Kobo oficina", base_url: "https://kf.kobotoolbox.org", has_token: true, is_default: true }],
    },
  ],
};

export const ENCUESTAS = {
  ok: true,
  surveys: [
    { id: "501", title: "Encuesta a docentes", nickname: "Docentes 2026", response_count: 42, date_modified: "2026-03-04T10:00:00" },
    { id: "502", title: "Encuesta a estudiantes", nickname: "", response_count: 310, date_modified: "2026-03-05T10:00:00" },
  ],
};

/** Una promesa que no resuelve: el pedido queda en vuelo. */
export const EN_VUELO = Symbol("en vuelo");

/** El backend responde con error. */
export class Fallo {
  constructor(readonly codigo: string, readonly mensaje: string) {}
}

export const ACTIVOS_KOBO = {
  ok: true,
  assets: [
    { uid: "aKobo1", name: "Hogares 2026", version_id: "v1", date_modified: "2026-02-01T09:00:00", deployment_active: true },
    { uid: "aKobo2", name: "Piloto de hogares", version_id: "v1", date_modified: null, deployment_active: false },
  ],
};

export const MAPA_DE_CODIGOS = {
  variable: "sexo",
  label: "Sexo",
  type: "select_one",
  list_name: "sexo",
  status: "label_match",
  high_confidence: true,
  requires_confirmation: true,
  mappings: [
    { source_code: "H", source_column: "sexo", source_label: "Hombre", xls_code: "1", xls_label: "Hombre", match: "label" },
    { source_code: "M", source_column: "sexo", source_label: "Mujer", xls_code: "2", xls_label: "Mujer", match: "label" },
  ],
};

export function revision(baseNombre: string | null, conPendientes: boolean) {
  return {
    ok: true,
    base_nombre: baseNombre,
    compatibility: {
      applied: true, ok: true, status: "ok", missing_columns: [], extra_columns: conPendientes ? ["obs_campo"] : [],
      matched_columns: 34, expected_columns: 34, message: "",
    },
    choice_mapping: conPendientes
      ? { status: "pending", pending: true, applied: true, requires_confirmation: true, n_questions: 1, maps: [MAPA_DE_CODIGOS] }
      : { status: "confirmed", pending: false, applied: false, requires_confirmation: false, n_questions: 0, maps: [] },
    reconciliation: conPendientes
      ? {
          extra: [{ name: "obs_campo", fill_pct: 40, n_fill: 48, kind: "con_datos", incluida: false, decision: "pending" }],
          n_extra: 1, n_incluidas: 0, n_excluidas: 0, n_pendientes: 1, reviewed: false,
        }
      : { extra: [], n_extra: 0, n_incluidas: 0, n_excluidas: 0, n_pendientes: 0, reviewed: true },
    ready: !conPendientes,
  };
}

export function resumenRevision(listas: boolean) {
  return {
    bases: [
      { base_nombre: "docentes", ready: listas, blockers: listas ? [] : ["Mapeo de códigos por confirmar"] },
      { base_nombre: "estudiantes", ready: true, blockers: [] },
    ],
    n_bases: 2,
    n_ready: listas ? 2 : 1,
    n_blocked: listas ? 0 : 1,
    all_ready: listas,
  };
}

export const UNIVERSO = {
  ok: true,
  base_nombre: null,
  config: { version: 1, enabled: false, variable: "", real_values: [], test_values: [], missing_policy: "exclude", unassigned_policy: "unclassified" },
  summary: null,
  variable_inventory: [{ variable: "tipo_caso", type: "select_one", n_distinct: 2 }],
  observed_values: [],
};

export function rutasDeRevision(conPendientes: boolean): Ruta[] {
  return [
    ["GET", /^\/api\/carga\/review\?base_nombre=docentes$/, revision("docentes", conPendientes)],
    ["GET", /^\/api\/carga\/review\?base_nombre=estudiantes$/, revision("estudiantes", false)],
    ["GET", /^\/api\/carga\/review\?base_nombre=integrada$/, revision("integrada", conPendientes)],
    ["GET", "/api/carga/review", revision(null, conPendientes)],
    ["GET", "/api/carga/review/summary", resumenRevision(!conPendientes)],
    ["GET", /^\/api\/carga\/universe-filter/, UNIVERSO],
    ["GET", /^\/api\/carga\/origen-externo/, new Fallo("E_PRUEBA", "Sin origen externo en la prueba")],
  ];
}

export const SUGERENCIAS = (familia: string, declarada: boolean) => ({
  ok: true,
  source: "monitoreo",
  accreditation_declared: declarada,
  project_kind: familia,
  profile_family: familia,
  has_suggestions: false,
  message: "",
  summary: { monitoring_sources_count: 1, survey_sources_count: 1, actors_count: 1, surveymonkey_groups: 0, kobo_groups: 1 },
  groups: [],
});

export function traspaso(instrumento: "local" | "needs_upload", basePrevia: boolean) {
  return {
    ok: true,
    detected: true,
    universe: "source",
    counts: { processable: 310, validada: 290, revision: 20, no_defendible: 12, total: 322 },
    source: {
      label: "Encuesta telefónica",
      phase: "field",
      kobo_asset_uid: "aKobo1",
      kind: "kobo",
      source_id: "fuente-1",
      validity: "status_column",
      instrument_source: instrumento,
      instrument_available: instrumento === "local",
      instrument_needs_upload: instrumento === "needs_upload",
    },
    sources: [
      { source_id: "fuente-1", label: "Encuesta telefónica", kind: "kobo", kobo_asset_uid: "aKobo1", validity: "status_column", counts: { processable: 310, total: 322 } },
    ],
    already_promoted: false,
    existing_base: basePrevia
      ? { present: true, nombre: "default", source_kind: "manual", is_territorial: false, n_filas: 322 }
      : { present: false },
    base_nombre_sugerido: "telefonica",
  };
}

export function rutasDeMonitoreo(familia: string, instrumento: "local" | "needs_upload", basePrevia = false): Ruta[] {
  return [
    ["GET", "/api/carga/monitoreo-handoff/status", traspaso(instrumento, basePrevia)],
    ["GET", "/api/estudio/processing-suggestions", SUGERENCIAS(familia, familia === "acreditacion")],
  ];
}

export const SUBIDA: Ruta[] = [
  ["POST", /^\/api\/files\/upload\?kind=xlsform$/, { file_id: "f-xls", kind: "xlsform", original_name: "formulario.xlsx", size: 1, ext: "xlsx" }],
  ["POST", /^\/api\/files\/upload\?kind=/, { file_id: "f-dat", kind: "data", original_name: "respuestas.xlsx", size: 1, ext: "xlsx" }],
  ["POST", "/api/carga/instrumento", {
    ok: true,
    resumen: { n_preguntas: 12, n_calculos: 2, n_secciones: 3, secciones: ["a", "b", "c"], n_listas_opciones: 4 },
  }],
  ["POST", "/api/carga/data", {
    ok: true,
    preview: {
      n_filas: 120,
      n_columnas: 34,
      columnas: [{ nombre: "edad", tipo: "integer", origen: "xlsform" }, { nombre: "sexo", tipo: "character", origen: "xlsform" }],
      normalizacion: {
        applied: true, aliases: 1, select_multiple: 0, dropped_columns: 0,
        alias_columns: { edad: "Edad" },
        choice_code_maps: { applied: true, requires_confirmation: true, n_questions: 1, maps: [MAPA_DE_CODIGOS] },
      },
      preview_filas: [],
    },
  }],
];

let rutas: Ruta[] = [];
let pedidos: string[] = [];

export function rutaDe(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

export function instalarBackend(propias: Ruta[]) {
  rutas = [
    ...propias,
    ["GET", "/api/connections", CONEXIONES],
    ["GET", /^\/api\/carga\/instrumento\/estructura/, ESTRUCTURA],
    ["POST", "/api/surveymonkey/multibase/surveys", ENCUESTAS],
    ["POST", "/api/carga/platform/kobo/assets", ACTIVOS_KOBO],
  ];
  pedidos = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = rutaDe(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const metodo = String(init?.method ?? "GET").toUpperCase();
    const ruta = rutas.find(([m, r]) => m === metodo && (typeof r === "string" ? r === url : r.test(url)));
    pedidos.push(`${metodo} ${url}${ruta ? "" : " (sin doble, queda en vuelo)"}`);
    if (!ruta) return new Promise<Response>(() => {});
    const cuerpo = typeof ruta[2] === "function" ? (ruta[2] as () => unknown)() : ruta[2];
    if (cuerpo === EN_VUELO) return new Promise<Response>(() => {});
    if (cuerpo instanceof Fallo) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: cuerpo.codigo, message: cuerpo.mensaje } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  });
}

// ── Montaje ──────────────────────────────────────────────────────────────────

let host: HTMLDivElement;
let root: Root;

export async function asentar() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  }
}

/** Lo que `refresh()` deja como estado de sesión la próxima vez que se llama. */
let estadosTrasRefrescar: SessionState[] = [];

export async function montar(opciones: {
  estado: SessionState | null;
  pestana?: string;
  rutas?: Ruta[];
  estudio?: EstudioPayload | typeof EN_VUELO | Fallo;
  errorSesion?: string;
  trasRefrescar?: SessionState[];
}) {
  const propias: Ruta[] = [...(opciones.rutas ?? [])];
  if (opciones.estudio !== undefined) propias.push(["GET", "/api/estudio", opciones.estudio]);
  instalarBackend(propias);
  estadosTrasRefrescar = [...(opciones.trasRefrescar ?? [])];
  const refresh = async () => {
    pedidos.push("(la página refresca la sesión)");
    const siguiente = estadosTrasRefrescar.shift();
    if (siguiente) sesion.actual = { ...(sesion.actual as object), state: siguiente };
  };
  sesion.actual = {
    sessionId: "sid-prueba",
    version: "0.0.0",
    state: opciones.estado,
    refresh,
    error: opciones.errorSesion ?? "",
    sessionLost: false,
  };
  const entrada = opciones.pestana ? `/carga?pestana=${opciones.pestana}` : "/carga";
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entrada]}>
        <CargaPage />
      </MemoryRouter>,
    );
  });
  await asentar();
}
export function control(selector: string, texto?: string): HTMLElement {
  const candidatos = Array.from(host.querySelectorAll<HTMLElement>(selector));
  const hallado = texto ? candidatos.find((c) => (c.textContent ?? "").includes(texto)) : candidatos[0];
  if (!hallado) throw new Error(`No hay control ${selector}${texto ? ` con "${texto}"` : ""}`);
  return hallado;
}

export async function pulsar(selector: string, texto?: string) {
  const el = control(selector, texto);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await asentar();
}

export async function elegirArchivo(selector: string, nombre: string) {
  const input = control(selector) as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], nombre)] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await asentar();
}


/** Marcado sin ids generados y con una etiqueta por línea, para que el diff se lea. */
function normalizar(html: string): string {
  return html
    .replace(/(:r[0-9a-z]+:|\u00abr[0-9a-z]+\u00bb|_r_[0-9a-z]+_)/g, ":id:")
    .replace(/></g, ">\n<");
}

export function marcado(): string {
  return normalizar(host.innerHTML);
}

/** Solo el riel de pestañas y la cabecera de la pestaña activa, sin el cuerpo. */
export function mesa(): string {
  return normalizar(
    [".pulso-carga-workspace-navigation", "header.pulso-tab-heading"]
      .map((selector) => host.querySelector(selector)?.outerHTML ?? `<!-- falta ${selector} -->`)
      .join("\n"),
  );
}

function volcado(): string {
  return `<!-- pedidos al backend, en orden -->\n${pedidos.map((p) => `<!-- ${p} -->`).join("\n")}\n${marcado()}\n`;
}

export const ORIGEN = "button.pulso-carga-origin-tab";
export const ARCHIVO_FORMULARIO = '.pulso-upload-card input[type="file"][accept=".xlsx,.xls"]';
export const ARCHIVO_RESPUESTAS = '.pulso-upload-card input[type="file"]:not([accept=".xlsx,.xls"])';

// ── Huellas ──────────────────────────────────────────────────────────────────

/** `pedidos` falta en las huellas que miden solo el riel y la cabecera. */
type Huella = { marcado: string; pedidos?: string };

const ACTUALIZAR = process.env.ACTUALIZAR_HUELLAS_CARGA === "1";
const CARPETA_VOLCADO = process.env.VOLCAR_CARGA ?? "";
const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

let grupo = "";
const declarados = new Set<string>();
const visitados = new Map<string, Huella>();

function archivoHuellas(): string {
  return path.join(__dirname, "huellas", `${grupo}.json`);
}

function leerHuellas(): Record<string, Huella> {
  const archivo = archivoHuellas();
  return fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf8")) : {};
}

/** Declara un escenario del grupo: su nombre es la clave de la huella. */
export function escenario(nombre: string, titulo: string, cuerpo: () => Promise<void>) {
  if (declarados.has(nombre)) throw new Error(`Escenario repetido en el grupo "${grupo}": ${nombre}`);
  declarados.add(nombre);
  it(titulo, cuerpo);
}

function volcar(nombre: string, texto: string, sufijo = "") {
  if (!CARPETA_VOLCADO) return;
  const dir = path.join(CARPETA_VOLCADO, grupo);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${nombre}${sufijo}.html`), texto);
}

function comparar(nombre: string, actual: Huella, texto: string) {
  visitados.set(nombre, actual);
  if (ACTUALIZAR) return;
  const esperada = leerHuellas()[nombre];
  const mismoMarcado = esperada?.marcado === actual.marcado;
  const mismosPedidos = esperada?.pedidos === actual.pedidos;
  if (esperada && mismoMarcado && mismosPedidos) return;
  const dir = path.join(os.tmpdir(), "caracterizacion-de-carga", grupo);
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `${nombre}.html`);
  fs.writeFileSync(archivo, texto);
  const que = !esperada
    ? "no tiene huella guardada"
    : [!mismoMarcado ? "cambió el marcado" : "", !mismosPedidos ? "cambió la lista de pedidos al backend" : ""]
        .filter(Boolean).join(" y ");
  throw new Error(
    `Escenario "${nombre}" (grupo ${grupo}): ${que}. Marcado actual (con los pedidos al inicio) en ${archivo}. ` +
    "Si el cambio es deliberado, regenera con ACTUALIZAR_HUELLAS_CARGA=1.",
  );
}

/** Compara el escenario con su huella: marcado completo y pedidos al backend. */
export function fijar(nombre: string) {
  const texto = volcado();
  volcar(nombre, texto);
  comparar(nombre, { marcado: sha256(marcado()), pedidos: sha256(pedidos.join("\n")) }, texto);
}

/**
 * Huella de un recorrido que mide solo el riel y la cabecera. `pasos` son las
 * lecturas de `mesa()` tomadas tras cada paso del recorrido, en orden.
 */
export function fijarMesa(nombre: string, pasos: readonly string[]) {
  const medido = pasos.map((paso, i) => `<!-- paso ${i + 1} -->\n${paso}`).join("\n");
  volcar(nombre, volcado());
  volcar(nombre, `${medido}\n`, ".mesa");
  comparar(nombre, { marcado: sha256(medido) }, `${medido}\n`);
}

/** Registra los ganchos del grupo. Se llama una vez, al inicio del archivo de prueba. */
export function prepararGrupo(nombre: string) {
  grupo = nombre;

  afterAll(() => {
    if (!ACTUALIZAR) return;
    const guardadas = leerHuellas();
    const resultado: Record<string, Huella> = {};
    for (const clave of [...declarados].sort()) {
      const huella = visitados.get(clave) ?? guardadas[clave];
      if (huella) resultado[clave] = huella;
    }
    fs.mkdirSync(path.dirname(archivoHuellas()), { recursive: true });
    fs.writeFileSync(archivoHuellas(), `${JSON.stringify(resultado, null, 2)}\n`);
  });

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("localStorage", { getItem: () => "sid-prueba", setItem: () => undefined, removeItem: () => undefined });
    useCargaStore.getState().resetForSession();
    usePlataformaStore.setState(usePlataformaStore.getInitialState(), true);
    vi.stubGlobal("confirm", () => true);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("las huellas guardadas corresponden a escenarios que existen", () => {
    if (ACTUALIZAR) return;
    const sobrantes = Object.keys(leerHuellas()).filter((clave) => !declarados.has(clave));
    expect(sobrantes, `huellas sin escenario en ${archivoHuellas()}`).toEqual([]);
  });
}

// ── Matriz de estados por pestaña ────────────────────────────────────────────

/** Los cinco estados de la matriz (una base vacía y completa; varias bases separadas, compartidas y sin bases) de una pestaña. */
export function escenariosDeMatriz(pestana: string) {
  describe("CargaPage, una base", () => {
    escenario(`una-base_sin-archivos_${pestana}`, `sin archivos: ${pestana}`, async () => {
      await montar({ estado: UNA_BASE_VACIA, pestana });
      fijar(`una-base_sin-archivos_${pestana}`);
    });
    escenario(`una-base_con-insumos_${pestana}`, `con formulario y datos: ${pestana}`, async () => {
      await montar({ estado: UNA_BASE_COMPLETA, pestana });
      fijar(`una-base_con-insumos_${pestana}`);
    });
  });

  describe("CargaPage, varias bases", () => {
    escenario(`varias_separadas_${pestana}`, `bases separadas: ${pestana}`, async () => {
      await montar({ ...VARIAS_SEPARADAS, pestana });
      fijar(`varias_separadas_${pestana}`);
    });
    escenario(`varias_integradas_${pestana}`, `formulario compartido: ${pestana}`, async () => {
      await montar({ ...VARIAS_INTEGRADAS, pestana });
      fijar(`varias_integradas_${pestana}`);
    });
    escenario(`varias_sin-bases_${pestana}`, `sin bases todavía: ${pestana}`, async () => {
      await montar({ ...VARIAS_SIN_BASES, pestana });
      fijar(`varias_sin-bases_${pestana}`);
    });
  });
}
