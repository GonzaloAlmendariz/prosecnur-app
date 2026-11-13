/**
 * Arnés de la caracterización de Validación (etapa P6 del rediseño de
 * Procesamiento, rebanada V1).
 *
 * Copia del arnés de Carga (`features/carga/pestanas/caracterizacion/arnes.tsx`),
 * no una importación: cada módulo fija su propia red y puede cambiarla sin
 * tocar la del otro.
 *
 * Monta la página real, con sus hijos reales, sobre una sesión simulada y un
 * `fetch` simulado, y compara cada escenario con su huella: el marcado
 * normalizado (sha256), la lista ordenada de pedidos al backend (sha256) y,
 * en claro, el cuerpo de cada pedido que guarda algo (POST, PUT, PATCH,
 * DELETE). Esa última es la huella de lo que se guarda: la que protege las
 * rebanadas que rediseñan la vista, cuando el marcado cambie a propósito.
 * Cada grupo de pruebas (un archivo por grupo) tiene su JSON en
 * `huellas/<grupo>.json`.
 *
 * Las huellas no se regeneran para arreglar un rojo: si cambian, el cambio
 * alteró algo. Regenerar es explícito (ACTUALIZAR_HUELLAS_VALIDACION=1), solo
 * escribe los escenarios visitados en esa corrida y no corre en CI.
 *
 * VOLCAR_VALIDACION=<carpeta> vuelca a esa carpeta, por grupo, el marcado
 * normalizado, los pedidos y los cuerpos de todos los escenarios que corran,
 * pasen o no, para comparar con `diff -r antes despues`.
 *
 * La huella del marcado incluye la dirección con que termina el escenario y
 * los avisos emergentes que dejó.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { SessionState } from "../../../api/core";
import type { EstudioPayload } from "../../../api/estudio";

const sesion = vi.hoisted(() => ({ actual: null as unknown }));

vi.mock("../../../lib/SessionContext", () => ({
  useSession: () => sesion.actual,
  useOptionalSession: () => sesion.actual,
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

// Plotly no se dibuja en happy-dom: el sustituto deja en el marcado qué se le
// pidió pintar (tipo de trazo y número de series), que es lo que la vista decide.
vi.mock("../../../lib/PlotlyChart", () => ({
  plotlySpecEquals: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  PlotlyChart: ({ data }: { data?: unknown[] }): ReactNode => {
    const trazos = Array.isArray(data) ? data : [];
    const tipos = trazos.map((t) => String((t as { type?: unknown })?.type ?? "")).join(",");
    return <div data-plotly-sustituto={tipos} data-series={trazos.length} />;
  },
}));

import ValidacionPage from "../ValidacionPage";
import { useToasterStore } from "../../../components/toasterStore";
import { useValidacionStore } from "../store";

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

// ── Backend simulado ─────────────────────────────────────────────────────────

export type Respuesta = unknown | ((url: string, cuerpo: string) => unknown);
export type Ruta = [metodo: string, ruta: string | RegExp, respuesta: Respuesta];

/** Una promesa que no resuelve: el pedido queda en vuelo. */
export const EN_VUELO = Symbol("en vuelo");

/** El backend responde con error. */
export class Fallo {
  constructor(readonly codigo: string, readonly mensaje: string, readonly status = 400) {}
}

let rutas: Ruta[] = [];
let pedidos: string[] = [];
let cuerpos: string[] = [];

export function rutaDe(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

function cabecera(init: RequestInit | undefined, nombre: string): string {
  const h = init?.headers;
  if (!h) return "";
  if (h instanceof Headers) return h.get(nombre) ?? "";
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === nombre.toLowerCase())?.[1] ?? "";
  const rec = h as Record<string, string>;
  const clave = Object.keys(rec).find((k) => k.toLowerCase() === nombre.toLowerCase());
  return clave ? rec[clave] : "";
}

function textoDelCuerpo(body: BodyInit | null | undefined): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (body instanceof FormData) {
    return `(formulario: ${Array.from(body.keys()).join(", ")})`;
  }
  return `(${Object.prototype.toString.call(body)})`;
}

export function instalarBackend(propias: Ruta[]) {
  rutas = [...propias];
  pedidos = [];
  cuerpos = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = rutaDe(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const metodo = String(init?.method ?? "GET").toUpperCase();
    const base = cabecera(init, "X-Base-Nombre");
    const cuerpoPedido = textoDelCuerpo(init?.body);
    const ruta = rutas.find(([m, r]) => m === metodo && (typeof r === "string" ? r === url : r.test(url)));
    pedidos.push(`${metodo} ${url}${base ? ` [base=${base}]` : ""}${ruta ? "" : " (sin doble, queda en vuelo)"}`);
    if (metodo !== "GET") cuerpos.push(`${metodo} ${url}${base ? ` [base=${base}]` : ""}\n${cuerpoPedido}`);
    if (!ruta) return new Promise<Response>(() => {});
    const cuerpo = typeof ruta[2] === "function"
      ? (ruta[2] as (url: string, cuerpo: string) => unknown)(url, cuerpoPedido)
      : ruta[2];
    if (cuerpo === EN_VUELO) return new Promise<Response>(() => {});
    if (cuerpo instanceof Fallo) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: cuerpo.codigo, message: cuerpo.mensaje } }), {
          status: cuerpo.status,
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

export async function asentar(vueltas = 8) {
  for (let i = 0; i < vueltas; i += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  }
}

/** La dirección con que termina el escenario (pathname y query). */
let direccion = "";
let montajes = 0;

function EspiaDeDireccion() {
  const location = useLocation();
  direccion = `${location.pathname}${location.search}`;
  return null;
}

/** La dirección actual del escenario. */
export function direccionActual(): string {
  return direccion;
}

/** Los avisos emergentes que dejó el escenario, del más nuevo al más viejo. */
export function avisos(): string[] {
  return useToasterStore.getState().toasts.map((t) => (t.detalle ? `${t.mensaje}. ${t.detalle}` : t.mensaje));
}

/** Los pedidos al backend del escenario, en orden. */
export function pedidosHechos(): readonly string[] {
  return [...pedidos];
}

/** Los cuerpos de los pedidos que guardan algo (todo lo que no es GET), en orden. */
export function cuerposEnviados(): readonly string[] {
  return [...cuerpos];
}

export async function montar(opciones: {
  estado: SessionState | null;
  pestana?: string;
  /** Dirección completa de entrada (gana a `pestana`), p. ej. `/validacion?pestana=instrumento&panel=regla&foco=x`. */
  entrada?: string;
  rutas?: Ruta[];
  estudio?: EstudioPayload | typeof EN_VUELO | Fallo;
}) {
  const propias: Ruta[] = [...(opciones.rutas ?? [])];
  if (opciones.estudio !== undefined) propias.push(["GET", "/api/estudio", opciones.estudio]);
  instalarBackend(propias);
  sesion.actual = {
    sessionId: "sid-prueba",
    version: "0.0.0",
    state: opciones.estado,
    refresh: async () => {
      pedidos.push("(la página refresca la sesión)");
    },
    error: "",
    sessionLost: false,
  };
  const entrada = opciones.entrada ?? (opciones.pestana ? `/validacion?pestana=${opciones.pestana}` : "/validacion");
  montajes += 1;
  await act(async () => {
    root.render(
      // La clave remonta el router si un escenario monta dos veces.
      <MemoryRouter key={montajes} initialEntries={[entrada]}>
        <EspiaDeDireccion />
        <ValidacionPage />
      </MemoryRouter>,
    );
  });
  await asentar();
}

/** Monta un componente suelto (sin la página) dentro de un router. */
export async function montarSuelto(nodo: ReactNode, opciones: { rutas?: Ruta[]; entrada?: string } = {}) {
  instalarBackend(opciones.rutas ?? []);
  montajes += 1;
  await act(async () => {
    root.render(
      <MemoryRouter key={montajes} initialEntries={[opciones.entrada ?? "/validacion"]}>
        <EspiaDeDireccion />
        {nodo}
      </MemoryRouter>,
    );
  });
  await asentar();
}

export function control(selector: string, texto?: string): HTMLElement {
  const candidatos = Array.from(document.body.querySelectorAll<HTMLElement>(selector));
  // El texto exacto gana al que solo lo contiene: "Guardar" es el botón Guardar, no "Guardar como nueva".
  const hallado = texto
    ? candidatos.find((c) => (c.textContent ?? "").trim() === texto) ?? candidatos.find((c) => (c.textContent ?? "").includes(texto))
    : candidatos[0];
  if (!hallado) throw new Error(`No hay control ${selector}${texto ? ` con "${texto}"` : ""}`);
  return hallado;
}

export function hay(selector: string, texto?: string): boolean {
  const candidatos = Array.from(document.body.querySelectorAll<HTMLElement>(selector));
  return texto ? candidatos.some((c) => (c.textContent ?? "").includes(texto)) : candidatos.length > 0;
}

export async function pulsar(selector: string, texto?: string) {
  const el = control(selector, texto);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await asentar();
}

/** Escribe en un campo controlado por React (input o textarea). */
export async function escribir(selector: string, valor: string) {
  const el = control(selector) as HTMLInputElement | HTMLTextAreaElement;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setter?.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await asentar();
}

export async function tecla(selector: string, key: string) {
  const el = control(selector);
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
  await asentar();
}

/** Marcado sin ids generados y con una etiqueta por línea, para que el diff se lea. */
function normalizar(html: string): string {
  return html
    .replace(/(:r[0-9a-z]+:|\u00abr[0-9a-z]+\u00bb|_r_[0-9a-z]+_)/g, ":id:")
    .replace(/></g, ">\n<");
}

/**
 * Todo el documento, para que entren también los paneles que se pintan fuera
 * del anfitrión, salvo el riel de pestañas: es un componente compartido
 * (`components/ContextTabRail`) y lo fija aparte el grupo "navegacion", con
 * `mesa()`. Así un cambio del riel no pone en rojo la huella de cada pestaña.
 */
export function marcado(): string {
  const copia = document.body.cloneNode(true) as HTMLElement;
  for (const riel of Array.from(copia.querySelectorAll(".pulso-context-tab-rail"))) {
    riel.replaceWith(document.createComment(" riel de pestañas: lo fija el grupo navegacion "));
  }
  return normalizar(copia.innerHTML);
}

/**
 * Solo el riel de pestañas y la cabecera de la pestaña activa, sin el cuerpo.
 * Desde la rebanada V0 del plan de fidelidad la cabecera la monta cada pestaña
 * (`pestanas/CabeceraDeTransicion`, clase `pulso-validacion-cabecera`).
 */
export function mesa(): string {
  return normalizar(
    [".pulso-validacion-shell [role=\"tablist\"]", ".pulso-validacion-cabecera"]
      .map((selector) => document.body.querySelector(selector)?.outerHTML ?? `<!-- falta ${selector} -->`)
      .join("\n"),
  );
}

/** Dirección final y avisos: entran a la huella del marcado. */
function encabezado(): string {
  const lineas = [`<!-- dirección: ${direccion} -->`, ...avisos().map((a) => `<!-- aviso: ${a} -->`)];
  return lineas.join("\n");
}

function volcado(): string {
  return [
    "<!-- pedidos al backend, en orden -->",
    ...pedidos.map((p) => `<!-- ${p} -->`),
    "<!-- cuerpos de lo que se guarda, en orden -->",
    ...cuerpos.map((c) => `<!-- ${c.replace(/--/g, "- -")} -->`),
    encabezado(),
    marcado(),
    "",
  ].join("\n");
}

// ── Huellas ──────────────────────────────────────────────────────────────────

/**
 * `pedidos` falta en las huellas que miden solo el riel y la cabecera.
 * `guardado` es el cuerpo, en claro, de cada pedido que no es GET; falta si el
 * escenario no guardó nada.
 */
type Huella = { marcado: string; pedidos?: string; guardado?: string[] };

const ACTUALIZAR = process.env.ACTUALIZAR_HUELLAS_VALIDACION === "1";
const CARPETA_VOLCADO = process.env.VOLCAR_VALIDACION ?? "";
/** Zona en que se tomaron las huellas guardadas. */
const ZONA_DE_LAS_HUELLAS = "America/Lima";
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
  // El primer escenario de cada grupo carga la página entera: con la máquina
  // ocupada pasa de los 5 s por defecto sin que nada esté mal.
  it(titulo, cuerpo, 30_000);
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
  const mismoGuardado = JSON.stringify(esperada?.guardado ?? null) === JSON.stringify(actual.guardado ?? null);
  if (esperada && mismoMarcado && mismosPedidos && mismoGuardado) return;
  const dir = path.join(os.tmpdir(), "caracterizacion-de-validacion", grupo);
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `${nombre}.html`);
  fs.writeFileSync(archivo, texto);
  const que = !esperada
    ? "no tiene huella guardada"
    : [
        !mismoMarcado ? "cambió el marcado" : "",
        !mismosPedidos ? "cambió la lista de pedidos al backend" : "",
        !mismoGuardado ? "cambió lo que se guarda" : "",
      ].filter(Boolean).join(" y ");
  if (!mismoGuardado && esperada) {
    // Lo que se guarda se compara en claro: el error dice qué cuerpo cambió.
    expect(actual.guardado ?? null, `Escenario "${nombre}" (grupo ${grupo}): cambió lo que se guarda`).toEqual(
      esperada.guardado ?? null,
    );
  }
  throw new Error(
    `Escenario "${nombre}" (grupo ${grupo}): ${que}. Marcado actual (con los pedidos al inicio) en ${archivo}. ` +
    "Si el cambio es deliberado, regenera con ACTUALIZAR_HUELLAS_VALIDACION=1.",
  );
}

/** Compara el escenario con su huella: marcado completo, pedidos al backend y lo que se guarda. */
export function fijar(nombre: string) {
  const texto = volcado();
  volcar(nombre, texto);
  const huella: Huella = { marcado: sha256(`${encabezado()}\n${marcado()}`), pedidos: sha256(pedidos.join("\n")) };
  if (cuerpos.length) huella.guardado = [...cuerpos];
  comparar(nombre, huella, texto);
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

/**
 * Huella de lo que se guarda sin pasar por el backend: el valor que un
 * componente entrega a su `onSubmit`, en claro.
 */
export function fijarGuardado(nombre: string, guardado: readonly string[]) {
  const texto = `${guardado.join("\n")}\n<!-- marcado -->\n${marcado()}\n`;
  volcar(nombre, texto);
  comparar(nombre, { marcado: sha256(marcado()), guardado: [...guardado] }, texto);
}

/** Stores de la página y avisos en su estado inicial. */
function reiniciarStores() {
  useToasterStore.getState().limpiar();
  direccion = "";
  useValidacionStore.setState(useValidacionStore.getInitialState(), true);
}

/** Registra los ganchos del grupo. Se llama una vez, al inicio del archivo de prueba. */
export function prepararGrupo(nombre: string) {
  grupo = nombre;

  // La vista pinta horas en la zona de la máquina ("Al día, 4 mar 07:00"): la
  // huella se toma siempre en la misma zona para que el runner de CI (UTC) y
  // una máquina en Lima den el mismo marcado. Node relee process.env.TZ al
  // asignarlo; se devuelve la zona previa para no contagiar a otro archivo
  // que comparta el proceso.
  let zonaPrevia: string | undefined;
  beforeAll(() => {
    zonaPrevia = process.env.TZ;
    process.env.TZ = ZONA_DE_LAS_HUELLAS;
  });
  afterAll(() => {
    if (zonaPrevia === undefined) delete process.env.TZ;
    else process.env.TZ = zonaPrevia;
  });

  afterAll(() => {
    // En CI no se escribe nada: la prueba de abajo ya falla y dice por qué.
    if (!ACTUALIZAR || process.env.CI) return;
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
    reiniciarStores();
    vi.stubGlobal("confirm", () => true);
    // Movimiento reducido: PageFrame no anima el cambio de base (happy-dom
    // rechaza la animación cancelada al desmontar).
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  // Regenerar deja todo en verde por construcción: en CI sería aprobar sin mirar.
  it("ACTUALIZAR_HUELLAS_VALIDACION no corre en CI", () => {
    expect(
      ACTUALIZAR && Boolean(process.env.CI),
      "ACTUALIZAR_HUELLAS_VALIDACION=1 con CI definido: regenerar las huellas en CI las daría por buenas sin compararlas",
    ).toBe(false);
  });

  it("las huellas guardadas corresponden a escenarios que existen", () => {
    if (ACTUALIZAR) return;
    const sobrantes = Object.keys(leerHuellas()).filter((clave) => !declarados.has(clave));
    expect(sobrantes, `huellas sin escenario en ${archivoHuellas()}`).toEqual([]);
  });
}
