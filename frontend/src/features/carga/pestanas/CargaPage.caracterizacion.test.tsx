// @vitest-environment happy-dom
/**
 * Caracterización de CargaPage (etapa P4a del rediseño de Procesamiento).
 *
 * Monta la página real, con sus hijos reales, sobre una sesión simulada y un
 * `fetch` simulado, y compara el marcado de cada pestaña en los dos modos (una
 * base y varias bases) y en sus estados principales contra una huella sha256
 * (caracterizacionDeCarga.huellas.json). Las huellas son el "antes" del refactor
 * que saca cada pestaña a su archivo: deben quedar idénticas. Además del marcado guarda la lista de pedidos al backend, en
 * orden, porque mover un efecto de sitio cambia cuándo se pide algo.
 *
 * Las huellas no se regeneran para arreglar un rojo: si cambian, el refactor
 * cambió algo. Regenerar es explícito: ACTUALIZAR_HUELLAS_CARGA=1.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "../../../api/core";
import type { EstudioBase, EstudioPayload } from "../../../api/estudio";

const sesion = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("../../../lib/SessionContext", () => ({
  useSession: () => sesion.actual,
  useOptionalSession: () => sesion.actual,
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

import CargaPage from "../CargaPage";
import { usePlataformaStore } from "../plataforma/usePlataformaStore";
import { useCargaStore } from "../store";

// ── Sesión ───────────────────────────────────────────────────────────────────

const ESTADO_VACIO: SessionState = {
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

function estado(cambios: Partial<SessionState>): SessionState {
  return { ...ESTADO_VACIO, ...cambios };
}

const UNA_BASE_VACIA = estado({});
const UNA_BASE_COMPLETA = estado({
  xlsform: true,
  data: true,
  instrumento_parsed: true,
  data_previewed: true,
  has_estudio: true,
  n_bases: 1,
  bases_nombres: ["default"],
  active_base: "default",
});

function base(nombre: string, cambios: Partial<EstudioBase> = {}): EstudioBase {
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

function estudio(
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

const BASES_DOS = [base("docentes"), base("estudiantes", { n_filas: 480, n_columnas: 41 })];

const VARIAS_SEPARADAS = {
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

const BASE_INTEGRADA = base("integrada", {
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
const VARIAS_INTEGRADAS = {
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

const VARIAS_SIN_BASES = {
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

type Respuesta = unknown | (() => unknown);
type Ruta = [metodo: string, ruta: string | RegExp, respuesta: Respuesta];

const ESTRUCTURA = {
  secciones: [{ name: "datos", label: "Datos generales", n_preguntas: 2 }],
  preguntas: [
    { name: "edad", label: "Edad", type: "integer", seccion: "datos" },
    { name: "sexo", label: "Sexo", type: "select_one sexo", seccion: "datos" },
  ],
};

const CONEXIONES = {
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

const ENCUESTAS = {
  ok: true,
  surveys: [
    { id: "501", title: "Encuesta a docentes", nickname: "Docentes 2026", response_count: 42, date_modified: "2026-03-04T10:00:00" },
    { id: "502", title: "Encuesta a estudiantes", nickname: "", response_count: 310, date_modified: "2026-03-05T10:00:00" },
  ],
};

/** Una promesa que no resuelve: el pedido queda en vuelo. */
const EN_VUELO = Symbol("en vuelo");

/** El backend responde con error. */
class Fallo {
  constructor(readonly codigo: string, readonly mensaje: string) {}
}

const ACTIVOS_KOBO = {
  ok: true,
  assets: [
    { uid: "aKobo1", name: "Hogares 2026", version_id: "v1", date_modified: "2026-02-01T09:00:00", deployment_active: true },
    { uid: "aKobo2", name: "Piloto de hogares", version_id: "v1", date_modified: null, deployment_active: false },
  ],
};

const MAPA_DE_CODIGOS = {
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

function revision(baseNombre: string | null, conPendientes: boolean) {
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

function resumenRevision(listas: boolean) {
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

const UNIVERSO = {
  ok: true,
  base_nombre: null,
  config: { version: 1, enabled: false, variable: "", real_values: [], test_values: [], missing_policy: "exclude", unassigned_policy: "unclassified" },
  summary: null,
  variable_inventory: [{ variable: "tipo_caso", type: "select_one", n_distinct: 2 }],
  observed_values: [],
};

function rutasDeRevision(conPendientes: boolean): Ruta[] {
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

const SUGERENCIAS = (familia: string, declarada: boolean) => ({
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

function traspaso(instrumento: "local" | "needs_upload", basePrevia: boolean) {
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

function rutasDeMonitoreo(familia: string, instrumento: "local" | "needs_upload", basePrevia = false): Ruta[] {
  return [
    ["GET", "/api/carga/monitoreo-handoff/status", traspaso(instrumento, basePrevia)],
    ["GET", "/api/estudio/processing-suggestions", SUGERENCIAS(familia, familia === "acreditacion")],
  ];
}

const SUBIDA: Ruta[] = [
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

function rutaDe(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

function instalarBackend(propias: Ruta[]) {
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

async function asentar() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  }
}

/** Lo que `refresh()` deja como estado de sesión la próxima vez que se llama. */
let estadosTrasRefrescar: SessionState[] = [];

async function montar(opciones: {
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

function control(selector: string, texto?: string): HTMLElement {
  const candidatos = Array.from(host.querySelectorAll<HTMLElement>(selector));
  const hallado = texto ? candidatos.find((c) => (c.textContent ?? "").includes(texto)) : candidatos[0];
  if (!hallado) throw new Error(`No hay control ${selector}${texto ? ` con "${texto}"` : ""}`);
  return hallado;
}

async function pulsar(selector: string, texto?: string) {
  const el = control(selector, texto);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await asentar();
}

async function elegirArchivo(selector: string, nombre: string) {
  const input = control(selector) as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], nombre)] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await asentar();
}

/** Marcado sin ids generados y con una etiqueta por línea, para que el diff se lea. */
function marcado(): string {
  return host.innerHTML
    .replace(/(:r[0-9a-z]+:|\u00abr[0-9a-z]+\u00bb|_r_[0-9a-z]+_)/g, ":id:")
    .replace(/></g, ">\n<");
}

function volcado(): string {
  return `<!-- pedidos al backend, en orden -->\n${pedidos.map((p) => `<!-- ${p} -->`).join("\n")}\n${marcado()}\n`;
}

// ── Huellas ──────────────────────────────────────────────────────────────────

type Huella = { marcado: string; pedidos: string };

const ARCHIVO_HUELLAS = path.join(__dirname, "caracterizacionDeCarga.huellas.json");
const ACTUALIZAR = process.env.ACTUALIZAR_HUELLAS_CARGA === "1";
const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

function leerHuellas(): Record<string, Huella> {
  return fs.existsSync(ARCHIVO_HUELLAS) ? JSON.parse(fs.readFileSync(ARCHIVO_HUELLAS, "utf8")) : {};
}

const esperadas = leerHuellas();
const nuevas: Record<string, Huella> = {};

/** Compara el escenario con su huella. Al fallar deja el marcado actual en el temporal del sistema. */
function fijar(nombre: string) {
  const actual: Huella = { marcado: sha256(marcado()), pedidos: sha256(pedidos.join("\n")) };
  if (ACTUALIZAR) {
    nuevas[nombre] = actual;
    return;
  }
  const esperada = esperadas[nombre];
  if (esperada && esperada.marcado === actual.marcado && esperada.pedidos === actual.pedidos) return;
  const dir = path.join(os.tmpdir(), "caracterizacion-de-carga");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `${nombre}.html`);
  fs.writeFileSync(archivo, volcado());
  const que = !esperada
    ? "no tiene huella guardada"
    : [esperada.marcado !== actual.marcado ? "cambió el marcado" : "", esperada.pedidos !== actual.pedidos ? "cambió la lista de pedidos al backend" : ""]
        .filter(Boolean).join(" y ");
  throw new Error(
    `Escenario "${nombre}": ${que}. Marcado actual (con los pedidos al inicio) en ${archivo}. ` +
    "Si el cambio es deliberado, regenera con ACTUALIZAR_HUELLAS_CARGA=1.",
  );
}

afterAll(() => {
  if (!ACTUALIZAR) return;
  const todas = { ...leerHuellas(), ...nuevas };
  const ordenadas = Object.fromEntries(Object.keys(todas).sort().map((k) => [k, todas[k]]));
  fs.writeFileSync(ARCHIVO_HUELLAS, `${JSON.stringify(ordenadas, null, 2)}\n`);
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

const PESTANAS = ["plan", "fuentes", "revision", "estructura", "datos", "equivalencias"] as const;

describe("CargaPage, una base", () => {
  it.each(PESTANAS)("sin archivos: %s", async (pestana) => {
    await montar({ estado: UNA_BASE_VACIA, pestana });
    fijar(`una-base_sin-archivos_${pestana}`);
  });

  it.each(PESTANAS)("con formulario y datos: %s", async (pestana) => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana });
    fijar(`una-base_con-insumos_${pestana}`);
  });
});

describe("CargaPage, varias bases", () => {
  it.each(PESTANAS)("bases separadas: %s", async (pestana) => {
    await montar({ ...VARIAS_SEPARADAS, pestana });
    fijar(`varias_separadas_${pestana}`);
  });

  it.each(PESTANAS)("formulario compartido: %s", async (pestana) => {
    await montar({ ...VARIAS_INTEGRADAS, pestana });
    fijar(`varias_integradas_${pestana}`);
  });

  it.each(PESTANAS)("sin bases todavía: %s", async (pestana) => {
    await montar({ ...VARIAS_SIN_BASES, pestana });
    fijar(`varias_sin-bases_${pestana}`);
  });
});

const ORIGEN = "button.pulso-carga-origin-tab";
const ARCHIVO_FORMULARIO = '.pulso-upload-card input[type="file"][accept=".xlsx,.xls"]';
const ARCHIVO_RESPUESTAS = '.pulso-upload-card input[type="file"]:not([accept=".xlsx,.xls"])';

describe("CargaPage, una base: Fuentes por origen y en curso", () => {
  it("Plataforma, antes de leer el catálogo", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_fuentes_plataforma");
  });

  it("Plataforma, catálogo de SurveyMonkey leído", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    fijar("una-base_fuentes_plataforma-catalogo-sm");
  });

  it("Plataforma, catálogo de KoboToolbox leído y segundo proyecto elegido", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar(".pulso-platform-provider-tabs button", "KoboToolbox");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-row", "Piloto de hogares");
    fijar("una-base_fuentes_plataforma-catalogo-kobo");
  });

  it("Plataforma, importando la encuesta elegida", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("una-base_fuentes_plataforma-importando");
  });

  it("Plataforma sin conexiones", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: [["GET", "/api/connections", { ok: true, connections: [] }]] });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_fuentes_plataforma-sin-conexion");
  });

  it("Monitoreo, antes de revisar", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Monitoreo");
    fijar("una-base_fuentes_monitoreo");
  });

  it("Monitoreo telefónico: trabajo de campo con formulario pendiente de subir", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: rutasDeMonitoreo("telefonico", "needs_upload") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-telefonico-sin-formulario");
  });

  it("Monitoreo territorial: trabajo de campo listo que reemplaza la base actual", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "fuentes", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-territorial-listo");
  });

  it("Monitoreo territorial: trayendo el trabajo de campo", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "fuentes", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    await pulsar("button.pulso-carga-handoff-primary");
    fijar("una-base_fuentes_monitoreo-territorial-trayendo");
  });

  it("Monitoreo de acreditación: asignaciones y creación conjunta", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-acreditacion");
  });

  it("subiendo el formulario", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_fuentes_subiendo-formulario");
  });

  it("formulario subido, respuestas en espera", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "fuentes",
      rutas: SUBIDA,
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true })],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_fuentes_formulario-subido");
  });

  it("formulario y respuestas subidos, con mapeo de códigos por confirmar", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "fuentes",
      rutas: [...SUBIDA, ...rutasDeRevision(true)],
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true }), UNA_BASE_COMPLETA],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_fuentes_respuestas-subidas");
  });

  it("respuestas elegidas sin formulario: aviso de orden", async () => {
    await montar({ estado: estado({ data: true }), pestana: "fuentes" });
    // La tarjeta de respuestas está deshabilitada; se fuerza el cambio para ver el aviso.
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_fuentes_respuestas-sin-formulario");
  });

  it("con varias bases declaradas en Plan y sin estudio todavía", async () => {
    useCargaStore.getState().setTopologyIntent("separate");
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    fijar("una-base_fuentes_plan-de-varias-bases");
  });

  it("con varias bases declaradas en Plan: Plan", async () => {
    useCargaStore.getState().setTopologyIntent("integrated");
    await montar({ estado: UNA_BASE_VACIA, pestana: "plan" });
    fijar("una-base_plan_plan-de-varias-bases");
  });
});

describe("CargaPage, una base: Revisión leída", () => {
  it("sin pendientes: ofrece continuar", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(false) });
    fijar("una-base_revision_lista");
  });

  it("con mapeo y variables extra pendientes", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    fijar("una-base_revision_con-pendientes");
  });

  it("con pendientes: diálogo de mapeo abierto", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    await pulsar("button.pulso-carga-review-mapping-button");
    fijar("una-base_revision_dialogo-de-mapeo");
  });

  it("con pendientes: diálogo de variables extra abierto", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    await pulsar("button.pulso-recon-panel-button");
    fijar("una-base_revision_dialogo-de-extras");
  });
});

describe("CargaPage, varias bases: Fuentes por origen y en curso", () => {
  it.each(["Plataforma", "Monitoreo"])("formulario compartido, origen %s", async (origen) => {
    await montar({ ...VARIAS_INTEGRADAS, pestana: "fuentes" });
    await pulsar(ORIGEN, origen);
    fijar(`varias_integradas_fuentes_${origen.toLowerCase()}`);
  });

  it("formulario compartido, Monitoreo de acreditación revisado", async () => {
    await montar({ ...VARIAS_INTEGRADAS, pestana: "fuentes", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("varias_integradas_fuentes_monitoreo-acreditacion");
  });

  it.each([
    ["SurveyMonkey", "surveymonkey"],
    ["KoboToolbox", "kobo"],
    ["Archivos", "archivos"],
    ["Archivo .sav", "sav"],
    ["Monitoreo", "monitoreo"],
  ])("bases separadas, Agregar base desde %s", async (rotulo, clave) => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "fuentes" });
    await pulsar("button.pulso-button--primary", "Agregar base");
    await pulsar("button.pulso-bde-origen-opcion", rotulo);
    fijar(`varias_separadas_fuentes_agregar-${clave}`);
  });

  it("bases separadas, importando una encuesta como base nueva", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "fuentes" });
    await pulsar("button.pulso-button--primary", "Agregar base");
    await pulsar("button.pulso-bde-origen-opcion", "SurveyMonkey");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("varias_separadas_fuentes_importando");
  });

  it("hermanas independientes", async () => {
    const bases = BASES_DOS.map((b) => ({ ...b, processing_mode: "independent_siblings", source_kind: "surveymonkey", survey_id: `9${b.n_filas}` }));
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "independent_siblings",
        estudio_topology_declared: "independent",
        n_bases: 2,
        bases_nombres: ["docentes", "estudiantes"],
        active_base: "docentes",
      }),
      estudio: estudio(bases, { processing_mode: "independent_siblings", topology_declared: "independent" }),
      pestana: "fuentes",
    });
    fijar("varias_independientes_fuentes");
  });
});

describe("CargaPage, varias bases: Revisión leída y Datos", () => {
  it("todas las bases listas: ofrece continuar", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "revision", rutas: rutasDeRevision(false) });
    fijar("varias_separadas_revision_lista");
  });

  it("con mapeo y variables extra pendientes en la base revisada", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "revision", rutas: rutasDeRevision(true) });
    fijar("varias_separadas_revision_con-pendientes");
  });

  it("Datos con una base hija de un grupo repetido y una base sin respuestas", async () => {
    const bases = [
      base("hogares"),
      base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares", repeat_group: "miembros", n_filas: 900 }),
      base("pendiente", { data_file_id: "", n_filas: null, n_columnas: null }),
    ];
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "multibase",
        estudio_topology_declared: "separate",
        n_bases: 3,
        bases_nombres: bases.map((b) => b.nombre),
        active_base: "pendiente",
      }),
      estudio: estudio(bases, { active_base: "pendiente" }),
      pestana: "datos",
    });
    fijar("varias_separadas_datos_base-sin-respuestas");
  });

  it("Datos con dos bases cargadas: selector de base y hoja", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "datos" });
    fijar("varias_separadas_datos_con-selector");
  });

  it("una sola base declarada como separada: Datos sin selector", async () => {
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "multibase",
        estudio_topology_declared: "separate",
        n_bases: 1,
        bases_nombres: ["docentes"],
        active_base: "docentes",
      }),
      estudio: estudio([base("docentes")]),
      pestana: "datos",
    });
    fijar("varias_una-sola_datos");
  });
});

describe("CargaPage, mientras se hidrata", () => {
  it.each(["plan", "fuentes"])("sin estado de sesión: %s", async (pestana) => {
    await montar({ estado: null, pestana });
    fijar(`hidratando_sin-sesion_${pestana}`);
  });

  it("la sesión falló", async () => {
    await montar({ estado: null, pestana: "plan", errorSesion: "No se pudo leer la sesión" });
    fijar("hidratando_error-de-sesion");
  });

  it.each(["plan", "revision"])("varias bases, estudio en vuelo: %s", async (pestana) => {
    await montar({ estado: VARIAS_SEPARADAS.estado, estudio: EN_VUELO, pestana });
    fijar(`hidratando_estudio-en-vuelo_${pestana}`);
  });

  it("varias bases, la lectura del estudio falló", async () => {
    await montar({ estado: VARIAS_SEPARADAS.estado, estudio: new Fallo("E_PRUEBA", "No se pudo leer el estudio"), pestana: "fuentes" });
    fijar("hidratando_error-de-estudio");
  });
});

describe("CargaPage, navegación entre pestañas", () => {
  it("una base: recorre las pestañas desde el riel sin remontar la página", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "fuentes", rutas: rutasDeRevision(false) });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("#carga-workspace-tab-revision");
    await pulsar("#carga-workspace-tab-fuentes");
    // El origen elegido vive en la página: debe seguir en Plataforma al volver.
    fijar("navegacion_una-base_ida-y-vuelta");
  });

  it("varias bases: recorre las pestañas desde el riel", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "plan", rutas: rutasDeRevision(false) });
    await pulsar("#carga-workspace-tab-revision");
    await pulsar("#carga-workspace-tab-datos");
    await pulsar("#carga-workspace-tab-estructura");
    fijar("navegacion_varias_recorrido");
  });
});
