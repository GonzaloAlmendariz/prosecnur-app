// @vitest-environment happy-dom
/**
 * Cruces de punta a punta sobre el marcado real y un servicio de vista previa
 * simulado con las respuestas reales del contrato: la lista de preguntas y la
 * tabla de la elegida con todas las variables de cruce, el conmutador de
 * cifras, los estados de la vista previa, cuándo se vuelve a pedir (config
 * GUARDADA), lo que cada control escribe en la config y lo que se envía al
 * generar.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CrucesPreview, CrucesPreviewEntrada, ValorColumna, VariableInstrumento } from "../../../api/analitica";
import { ApiError } from "../../../api/core";
import { conAviso, respuestaConPesos, respuestaRecortada, respuestaSinPesos, respuestaSinVariablesDeCruce } from "./ejemploDeCruces.test-util";

type RespuestaDeVariables = { ok: true; variables: VariableInstrumento[]; grain: null };

const sesion = { active_base: "Monitoreo territorial", analitica_fuente: "adaptados", n_bases: 1, analitica_dim_ok: false };
const api = {
  variables: vi.fn<() => Promise<RespuestaDeVariables>>(),
  preview: vi.fn<(entrada?: CrucesPreviewEntrada) => Promise<CrucesPreview>>(),
  valores: vi.fn<(nombre: string) => Promise<{ ok: true; values: ValorColumna[] }>>(),
  preparar: vi.fn<() => Promise<unknown>>(),
  cruces: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
};
const corrida = { runAsync: vi.fn(async (fn: () => Promise<unknown>) => { await fn(); }) };

vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaVariables: () => api.variables(),
  apiAnaliticaCrucesPreview: (entrada?: CrucesPreviewEntrada) => api.preview(entrada),
  apiAnaliticaColumnValues: (nombre: string) => api.valores(nombre),
  apiAnaliticaPreparar: () => api.preparar(),
  apiAnaliticaCruces: (...args: unknown[]) => api.cruces(...args),
}));
const regla = { leer: vi.fn<() => Promise<unknown>>() };
const estudio = { leer: vi.fn<() => Promise<unknown>>() };
vi.mock("../../../api/estudio", async (original) => ({
  ...(await original<typeof import("../../../api/estudio")>()),
  apiEstudioGet: () => estudio.leer(),
}));
vi.mock("../../../api/graficosDiferencias", async (original) => ({
  ...(await original<typeof import("../../../api/graficosDiferencias")>()),
  getDiferenciasRegla: () => regla.leer(),
}));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { ...sesion }, refresh: async () => undefined }) }));
vi.mock("../useReporteRun", () => ({
  useReporteRun: () => ({
    generacion: { estado: { fase: "inactiva" }, cerrar: () => undefined },
    busy: false, lastResult: null, perBase: [], runSync: corrida.runAsync, runAsync: corrida.runAsync,
  }),
}));

const VARIABLES: VariableInstrumento[] = [
  { name: "E1_age", label: "¿Cuál es su edad?", tipo: "integer", list_name: "", categorica: false, numerica: true },
  { name: "E2_sex", label: "¿Cuál es su sexo?", tipo: "select_one", list_name: "sexo", categorica: true, numerica: false },
  { name: "M5_district", label: "¿En qué distrito vive actualmente?", tipo: "select_one", list_name: "distrito", categorica: true, numerica: false },
  { name: "D1_information", label: "¿Dónde vio o escuchó esos mensajes?", tipo: "select_multiple", list_name: "medios", categorica: true, numerica: false },
  { name: "E6_impact", label: "Impacto", tipo: "select_one", list_name: "acuerdo", categorica: true, numerica: false },
];
const SEXO: ValorColumna[] = [{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }, { value: "3", label: "Otro" }];

let host: HTMLDivElement;
let root: Root;
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const texto = () => host.textContent ?? "";
const boton = (rotulo: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
  .find((b) => b.textContent?.trim() === rotulo || b.getAttribute("aria-label") === rotulo);
const pulsar = async (rotulo: string) => {
  const b = boton(rotulo);
  if (!b) throw new Error(`No hay un botón "${rotulo}"`);
  await act(async () => { b.click(); });
};
const store = async () => (await import("../store")).useAnaliticaStore;
const config = async () => (await store()).getState().config;
const guardado = async () => { const s = await store(); await act(async () => { s.getState().markClean(); }); await esperar(); };
const tabla = (variable: string) => host.querySelector<HTMLElement>(`.cruces-tabla[data-variable="${variable}"]`);
const cabeceras = (variable: string) => Array.from(tabla(variable)?.querySelectorAll(".cruces-fila--categorias .cruces-columna-etiqueta") ?? []).map((e) => e.textContent);
const cabecera = () => host.querySelector<HTMLElement>(".tablas-cabecera")?.textContent ?? "";
const lista = () => Array.from(host.querySelectorAll<HTMLButtonElement>(".tablas-pregunta"));
const enLista = (variable: string) => lista().find((b) => b.querySelector(".tablas-pregunta-codigo")?.textContent === variable);
/** El chip de una variable de cruce, por su pregunta (va entera en el `title`; a la vista, el nombre corto). */
const chip = (pregunta: string) => Array.from(host.querySelectorAll<HTMLButtonElement>(".cruces-chip-nombre"))
  .find((b) => b.getAttribute("title")?.startsWith(pregunta));
const verCategoriasDe = async (etiqueta: string) => {
  const b = chip(etiqueta);
  if (!b) throw new Error(`No hay un chip "${etiqueta}"`);
  await act(async () => { b.click(); });
  await esperar();
};

/** Abre un select del kit por su nombre y devuelve sus opciones (van en un portal, fuera del cuerpo con scroll). */
async function abrir(nombre: string): Promise<HTMLElement[]> {
  const disparador = host.querySelector<HTMLElement>(`[aria-label="${nombre}"]`);
  if (!disparador) throw new Error(`No hay un selector "${nombre}"`);
  await act(async () => {
    disparador.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
    await new Promise((r) => setTimeout(r, 10));
  });
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
}
async function elegirOpcion(opcion: HTMLElement) {
  await act(async () => {
    opcion.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
    opcion.click();
    await new Promise((r) => setTimeout(r, 10));
  });
}

async function montar(search = "?pestana=cruces") {
  const { CrucesPane } = await import("../panes/CrucesPane");
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/analitica${search}`]}>
        <CrucesPane />
      </MemoryRouter>,
    );
  });
  await esperar();
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sesion.analitica_dim_ok = false;
  api.variables.mockReset().mockResolvedValue({ ok: true, variables: VARIABLES, grain: null });
  api.preview.mockReset().mockImplementation(async () => respuestaSinPesos());
  api.valores.mockReset().mockImplementation(async (nombre) => ({ ok: true, values: nombre === "E2_sex" ? SEXO : [{ value: "smp", label: "San Martín de Porres" }] }));
  api.preparar.mockReset().mockResolvedValue({ ok: true });
  api.cruces.mockReset().mockResolvedValue({ ok: true, job_id: "j1" });
  corrida.runAsync.mockClear();
  const { useVistaDeTablas, CIFRAS_INICIALES } = await import("../tablas/vistaDeTablasStore");
  useVistaDeTablas.setState({ cifras: { ...CIFRAS_INICIALES } });
  estudio.leer.mockReset().mockResolvedValue({ n_bases: 1, bases: {} });
  regla.leer.mockReset().mockResolvedValue({
    regla: { prueba: "z", correccion: "bonferroni_fila", alfa: 0.05, umbral_puntos: 10, base_minima: 30, conglomerado: null, estrato: null },
    propuesta: null, origen: "estudio", columnas: {}, familia: null,
  });
  const { useAnaliticaStore, DEFAULT_CONFIG } = await import("../store");
  useAnaliticaStore.setState({
    config: {
      ...DEFAULT_CONFIG,
      cruces: { ...DEFAULT_CONFIG.cruces, cruces_vars: [{ name: "M5_district" }, { name: "E2_sex", excluidas: ["3"] }] },
    },
    hydrated: true,
    dirty: false,
    errorGuardado: null,
    reintentosGuardado: 0,
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Cruces: la lista y la tabla de la pregunta elegida", () => {
  it("pide las primeras 20 tablas una vez y muestra la primera pregunta con todas las variables de cruce lado a lado", async () => {
    await montar();
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenLastCalledWith({ limite: 20 });
    expect(host.querySelectorAll(".cruces-tabla")).toHaveLength(1);
    expect(enLista("D1_information")?.getAttribute("aria-current")).toBe("true");
    // Las dos variables de cruce en la misma tabla, en el orden del archivo, sin selector de columnas.
    expect(Array.from(tabla("D1_information")?.querySelectorAll(".cruces-variable") ?? []).map((e) => e.textContent)).toEqual([
      "¿En qué distrito vive actualmente?", "¿Cuál es su sexo?",
    ]);
    expect(cabeceras("D1_information")).toEqual([
      "San Martín de Porres", "San Juan de Lurigancho", "Chorrillos", "Los Olivos", "Ate (Vitarte)", "San Juan de Miraflores",
      "Hombre", "Mujer", "Otro",
    ]);
    expect(host.querySelector('[aria-label="Columnas de"]')).toBeNull();
    expect(texto()).not.toContain("Columnas de");
    // La cabecera cuenta las tablas del archivo, numérica incluida.
    expect(cabecera()).toContain("preguntas en el archivo27");
    expect(cabecera()).toContain("variables de cruce2");
  });

  it("elegir otra pregunta en la lista escribe el foco y cambia la tabla sin volver a pedir", async () => {
    await montar();
    const impacto = enLista("E6_impact");
    await act(async () => { impacto?.click(); });
    await esperar();
    expect(tabla("E6_impact")).not.toBeNull();
    expect(tabla("D1_information")).toBeNull();
    expect(enLista("E6_impact")?.getAttribute("aria-current")).toBe("true");
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("el conmutador muestra porcentaje, N o los dos en cada celda sin volver a pedir", async () => {
    await montar();
    const celda = () => (tabla("D1_information")?.querySelector('[data-categoria="1"] [data-columna="smp"]')?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(celda()).toBe("65.83 e");
    await pulsar("Casos");
    expect(celda()).not.toContain("65.83");
    expect(celda()).toMatch(/^\d+$/);
    await pulsar("Ambos");
    expect(celda()).toMatch(/^65\.83 e \d+$/);
    await pulsar("Porcentaje");
    expect(celda()).toBe("65.83 e");
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("con pesos: N ponderado y la base en encuestados; el conmutador no llama casos a una suma de pesos", async () => {
    api.preview.mockImplementation(async () => respuestaConPesos());
    await montar();
    const t = tabla("D1_information");
    expect(t?.querySelector(".cruces-fila--n [role=rowheader]")?.textContent).toBe("N ponderado");
    expect(t?.querySelector(".cruces-fila--base [role=rowheader]")?.textContent).toBe("Base (encuestados)");
    expect(texto()).toContain("Con los pesos llevados a media 1, sin el efecto de diseño de la ponderación: marca más diferencias que una prueba con el tamaño efectivo de muestra");
    expect(Array.from(host.querySelectorAll('.tablas-conmutador [role="radio"]')).map((r) => r.textContent)).toEqual(["Porcentaje", "N ponderado", "Ambos"]);
    expect(cabecera()).toContain("Ponderada");
  });

  it("los avisos del servicio se dicen una vez, con su causa", async () => {
    await montar();
    const avisos = Array.from(host.querySelectorAll(".tablas-avisos > li")).map((li) => li.textContent);
    expect(avisos).toEqual([
      "El archivo trae la tabla de la pregunta numérica \"¿Cuál es su edad?\", que la vista previa no muestra.",
      "Se quitaron 2 casos de toda la base al excluir \"Otro\" en \"¿Cuál es su sexo?\". El Total y las columnas de las demás variables de cruce tampoco los cuentan.",
    ]);
  });

  it("el modo no aplicado lo dice el pie, con el texto del servicio; el modo no está en los ajustes", async () => {
    api.preview.mockImplementation(async () => conAviso(respuestaSinPesos(), { codigo: "modo_configurado_no_aplicado", mensaje: "El archivo sale en modo estándar: la generación no aplica Dimensiones." }));
    await montar();
    expect(Array.from(host.querySelectorAll(".tablas-avisos > li")).map((li) => li.textContent)).toContain("El archivo sale en modo estándar: la generación no aplica Dimensiones.");
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]')).some((b) => b.textContent === "Dimensiones")).toBe(false);
  });

  it("recortada: no dice cuántas se ven; la lista suma las preguntas del formulario que la hoja no trae", async () => {
    api.preview.mockImplementation(async () => respuestaRecortada());
    await montar();
    expect(texto()).not.toContain("Se ven 2 de 26 tablas.");
    expect(texto()).toContain("Más preguntas del formulario");
    expect(enLista("E2_sex")?.textContent).toContain("¿Cuál es su sexo?");
  });
});

describe("Cruces: estados de la vista previa", () => {
  it("mientras se lee no deja generar y su marca de readiness queda en falso", async () => {
    api.preview.mockImplementation(() => new Promise(() => undefined));
    await montar();
    expect(host.querySelector('.tablas-panel--tabla [data-audit-ready="false"]')?.textContent).toContain("Leyendo las tablas cruzadas del archivo");
    expect(boton("Generar Excel")?.disabled).toBe(true);
  });

  it("si falla dice la causa, Reintentar vuelve a pedir y el archivo se puede generar", async () => {
    api.preview.mockImplementationOnce(() => Promise.reject(new ApiError("E_INTERNAL", "Tiempo de espera agotado.")));
    await montar();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("No se pudo leer la vista previa");
    expect(texto()).toContain("Tiempo de espera agotado.");
    expect(boton("Generar Excel")?.disabled).toBe(false);
    await pulsar("Reintentar");
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(tabla("D1_information")).not.toBeNull();
  });

  it("sin base preparada (409): Preparar la base y Generar bloqueado", async () => {
    api.preview.mockImplementationOnce(() => Promise.reject(new ApiError("E_NO_RP_DATA", "Sin base.")));
    await montar();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Sin base preparada");
    expect(texto()).toContain("Falta preparar la base.");
    expect(boton("Generar Excel")?.disabled).toBe(true);
    await pulsar("Preparar la base");
    await esperar();
    expect(api.preparar).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(boton("Generar Excel")?.disabled).toBe(false);
  });

  it("sin variables de cruce: el vacío lo dice y deja elegir una ahí mismo; Generar bloqueado", async () => {
    const s = await store();
    s.setState((e) => ({ config: { ...e.config, cruces: { ...e.config.cruces, cruces_vars: [] } } }));
    api.preview.mockImplementation(async () => respuestaSinVariablesDeCruce());
    await montar();
    const vacio = host.querySelector(".tablas-vista .pulso-estado-vacio");
    expect(vacio?.textContent).toContain("Sin variables de cruce");
    expect(vacio?.textContent).toContain("No hay tablas porque no hay variables de cruce configuradas.");
    expect(vacio?.querySelector(".cruces-vacio-accion")).not.toBeNull();
    expect(texto()).toContain("Agrega al menos una variable a cruzar.");
    expect(boton("Generar Excel")?.disabled).toBe(true);
  });

  it("la vista previa falla: la regla que se ve es la declarada del estudio, rotulada como declarada", async () => {
    api.preview.mockImplementation(() => Promise.reject(new ApiError("E_INTERNAL", "Caído.")));
    await montar();
    await esperar();
    const r = host.querySelector(".cruces-regla");
    // O6: el título no promete que estas tablas la apliquen, aunque sea la propuesta de la app.
    expect(r?.textContent).toContain("Regla del estudio, sin aplicar en estas tablas");
    expect(r?.querySelector(".cruces-regla-titulo")?.textContent).not.toContain("declarada");
    // R4: la misma redacción de la base mínima que la regla aplicada.
    expect(r?.textContent).toContain("30 casos sin ponderar por columna");
    expect(r?.textContent).toContain("Bonferroni dentro de cada fila");
    expect(regla.leer).toHaveBeenCalledTimes(1);
  });

  it("si la regla declarada no se puede leer, lo dice", async () => {
    api.preview.mockImplementation(() => Promise.reject(new ApiError("E_INTERNAL", "Caído.")));
    regla.leer.mockRejectedValue(new ApiError("E_SIG_SIN_CONGLOMERADO", "x"));
    await montar();
    await esperar();
    expect(host.querySelector(".cruces-regla")?.textContent).toContain("La regla pide Rao-Scott y la base no tiene la columna de conglomerado.");
  });

  it("con la regla aplicada de la vista previa no se lee la declarada; va en la sección Significancia", async () => {
    await montar();
    expect(host.querySelector(".cruces-regla")?.textContent).toContain("Regla aplicada");
    expect(host.querySelector(".cruces-regla-titulo")?.textContent).toBe("Regla aplicada");
    expect(host.querySelector(".cruces-regla")?.closest("section")?.querySelector(".tablas-seccion-titulo")?.textContent).toBe("Significancia");
    expect(regla.leer).not.toHaveBeenCalled();
  });

  it("la zona de la tabla declara su geometría también en vacío y en fallo", async () => {
    api.preview.mockImplementation(() => Promise.reject(new ApiError("E_NO_RP_DATA", "Sin base.")));
    await montar();
    expect(host.querySelector('.cruces-vista[data-qa-geometry-group="analitica/cruces-tablas"][data-qa-geometry-contract="intrinsic"]')).not.toBeNull();
  });

  it("Q1: el selector del vacío abre su lista fuera del cuerpo con scroll, con el tipo en castellano, y agrega la variable", async () => {
    const s = await store();
    s.setState((e) => ({ config: { ...e.config, cruces: { ...e.config.cruces, cruces_vars: [] } } }));
    api.preview.mockImplementation(async () => respuestaSinVariablesDeCruce());
    await montar();
    const opciones = await abrir("Elegir variable a cruzar");
    const sexo = opciones.find((o) => o.textContent?.includes("¿Cuál es su sexo?"));
    expect(sexo).toBeDefined();
    expect(sexo?.closest(".tablas-panel-cuerpo")).toBeNull();
    expect(sexo?.textContent).toContain("Selección única");
    expect(opciones.find((o) => o.textContent?.includes("Dónde vio"))?.textContent).toContain("Selección múltiple");
    expect(document.body.textContent).not.toMatch(/SELECT_ONE|select_one/);
    // Las numéricas no son variables de cruce.
    expect(opciones.some((o) => o.textContent?.includes("edad"))).toBe(false);
    if (sexo) await elegirOpcion(sexo);
    expect((await config()).cruces.cruces_vars.map((c) => c.name)).toEqual(["E2_sex"]);
  });

  it("Q1: Añadir, junto a los chips, usa el mismo selector y ofrece solo las que faltan", async () => {
    await montar();
    expect(host.querySelector('.cruces-chips [aria-label="Añadir variable de cruce"]')?.textContent).toContain("Añadir");
    const opciones = await abrir("Añadir variable de cruce");
    expect(opciones.some((o) => o.textContent?.includes("¿Cuál es su sexo?"))).toBe(false);
    const impacto = opciones.find((o) => o.textContent?.includes("Impacto"));
    expect(impacto?.closest(".tablas-panel-cuerpo")).toBeNull();
    if (impacto) await elegirOpcion(impacto);
    expect((await config()).cruces.cruces_vars.map((c) => c.name)).toEqual(["M5_district", "E2_sex", "E6_impact"]);
  });

  it("Q4: sin variables de cruce la cabecera no dice que hay 0 preguntas", async () => {
    const s = await store();
    s.setState((e) => ({ config: { ...e.config, cruces: { ...e.config.cruces, cruces_vars: [] } } }));
    api.preview.mockImplementation(async () => respuestaSinVariablesDeCruce());
    await montar();
    expect(cabecera()).not.toMatch(/preguntas (en el archivo|de esta base)/);
    expect(cabecera()).toContain("variables de cruce0");
  });

  it("Q4: con varias bases la línea del pie nombra la base por su etiqueta", async () => {
    const dos = respuestaSinPesos();
    api.preview.mockImplementation(async () => ({ ...dos, base: { ...dos.base, nombre: "post_distribution_q2", n_bases: 2 } }));
    estudio.leer.mockResolvedValue({ n_bases: 2, bases: { post_distribution_q2: { nombre: "post_distribution_q2", source_alias: "Monitoreo posterior", source_title: null } } });
    await montar();
    await esperar();
    expect(texto()).toContain("Vista previa de la base \"Monitoreo posterior\".");
    expect(texto()).not.toContain("post_distribution_q2");
  });

  it("si el guardado falla: el aviso una vez y Generar espera", async () => {
    await montar();
    const s = await store();
    await act(async () => { s.getState().setCruces({ orden: "desc" }); });
    await act(async () => { s.getState().setErrorGuardado("Sin conexión con el backend."); });
    expect(texto().match(/No se pudieron guardar los ajustes\. La vista previa muestra los anteriores\./g)).toHaveLength(1);
    expect(boton("Generar Excel")?.disabled).toBe(true);
    expect(texto()).toContain("Ajustes sin guardar");
  });
});

describe("Cruces: un pedido por cambio guardado", () => {
  it("un ajuste espera al autosave: atenuada mientras tanto, un pedido después de guardar y Generar espera", async () => {
    await montar();
    expect(api.preview).toHaveBeenCalledTimes(1);
    const s = await store();
    await act(async () => { s.getState().setCruces({ orden: "desc" }); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(host.querySelector(".cruces-hoja")?.hasAttribute("data-releyendo")).toBe(true);
    expect(texto()).toContain("Guardando los ajustes");
    expect(boton("Generar Excel")?.disabled).toBe(true);
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(host.querySelector(".cruces-hoja")?.hasAttribute("data-releyendo")).toBe(false);
  });

  it("sin ningún cambio no se vuelve a pedir", async () => {
    await montar();
    await esperar();
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(1);
  });
});

describe("Cruces: lo que cada control escribe y lo que se envía", () => {
  it("Generar Excel, en la cabecera, envía el pedido sin cuerpo: la config viaja por el autosave", async () => {
    await montar();
    expect(host.querySelector(".tablas-cabecera")?.contains(boton("Generar Excel") ?? null)).toBe(true);
    await pulsar("Generar Excel");
    expect(corrida.runAsync).toHaveBeenCalledTimes(1);
    expect(api.cruces).toHaveBeenCalledTimes(1);
    expect(api.cruces).toHaveBeenCalledWith();
    expect(host.querySelector(".tablas-panel--archivo")?.textContent).toContain("Cruces");
  });

  it("las variables de cruce son chips con su nombre corto y sus columnas en el archivo; la primera muestra sus categorías", async () => {
    await montar();
    await esperar();
    const chips = Array.from(host.querySelectorAll(".cruces-chip")).map((c) => [
      c.querySelector(".cruces-chip-etiqueta")?.textContent, c.querySelector(".cruces-chip-columnas")?.textContent,
    ]);
    // Nombre corto como "Sexo 2" del prototipo; la pregunta entera en el title; nunca el nombre de la columna.
    expect(chips).toEqual([["Distrito vive actualmente", "6"], ["Sexo", "3"]]);
    expect(chip("¿Cuál es su sexo?")?.getAttribute("title")).toMatch(/^¿Cuál es su sexo\? \(E2_sex\)\./);
    expect(host.querySelector(".cruces-chips")?.textContent).not.toMatch(/M5_district|E2_sex/);
    expect(chip("¿En qué distrito vive actualmente?")?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[aria-label="Categorías excluidas de ¿En qué distrito vive actualmente?"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Categorías excluidas de ¿Cuál es su sexo?"]')).toBeNull();
  });

  it("al elegir otro chip, mientras se leen sus categorías no quedan a la vista ni clicables las de la variable anterior", async () => {
    let soltarSexo: () => void = () => undefined;
    api.valores.mockImplementation((nombre) => (nombre === "E2_sex"
      ? new Promise((r) => { soltarSexo = () => r({ ok: true, values: SEXO }); })
      : Promise.resolve({ ok: true, values: [{ value: "smp", label: "San Martín de Porres" }] })));
    await montar();
    await esperar();
    const bloque = () => host.querySelector<HTMLElement>(".cruces-categorias-de");
    expect(bloque()?.textContent).toContain("San Martín de Porres");
    await verCategoriasDe("¿Cuál es su sexo?");
    // El título ya es el de Sexo: debajo no puede haber un distrito que se guarde como exclusión de Sexo.
    expect(bloque()?.textContent).toContain('Categorías de "¿Cuál es su sexo?"');
    expect(bloque()?.textContent).not.toContain("San Martín de Porres");
    expect(bloque()?.querySelectorAll(".cruces-categorias button")).toHaveLength(0);
    expect(bloque()?.querySelector('[data-audit-ready="false"]')?.textContent).toContain("Leyendo las categorías");
    await act(async () => { soltarSexo(); });
    await esperar();
    expect(Array.from(bloque()?.querySelectorAll(".cruces-categorias button") ?? []).map((b) => b.textContent?.trim())).toEqual(["Hombre", "Mujer", "Otro"]);
  });

  it("excluir una categoría escribe su valor en la variable de cruce; volver a pulsar la incluye", async () => {
    await montar();
    await verCategoriasDe("¿Cuál es su sexo?");
    const categoria = (rotulo: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('[aria-label="Categorías excluidas de ¿Cuál es su sexo?"] button'))
      .find((b) => b.textContent?.includes(rotulo));
    expect(categoria("Otro")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => { categoria("Hombre")?.click(); });
    expect((await config()).cruces.cruces_vars.find((c) => c.name === "E2_sex")?.excluidas).toEqual(["3", "1"]);
    await act(async () => { categoria("Otro")?.click(); });
    expect((await config()).cruces.cruces_vars.find((c) => c.name === "E2_sex")?.excluidas).toEqual(["1"]);
  });

  it("quitar todas las exclusiones de una variable, solo cuando tiene alguna", async () => {
    await montar();
    await esperar();
    const quitarTodas = () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).filter((b) => b.textContent?.trim() === "Quitar todas las exclusiones");
    // M5_district no tiene exclusiones; E2_sex sí.
    expect(quitarTodas()).toHaveLength(0);
    await verCategoriasDe("¿Cuál es su sexo?");
    expect(quitarTodas()).toHaveLength(1);
    await act(async () => { quitarTodas()[0].click(); });
    expect((await config()).cruces.cruces_vars.find((c) => c.name === "E2_sex")?.excluidas ?? []).toEqual([]);
    expect(quitarTodas()).toHaveLength(0);
  });

  it("el orden de las variables de cruce se cambia con Alt y las flechas sobre su chip", async () => {
    await montar();
    const distrito = chip("¿En qué distrito vive actualmente?");
    await act(async () => { distrito?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true })); });
    expect((await config()).cruces.cruces_vars.map((c) => c.name)).toEqual(["E2_sex", "M5_district"]);
    // Sin Alt, las flechas no mueven nada.
    const sexo = chip("¿Cuál es su sexo?");
    await act(async () => { sexo?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    expect((await config()).cruces.cruces_vars.map((c) => c.name)).toEqual(["E2_sex", "M5_district"]);
    // Las exclusiones viajan con su variable.
    expect((await config()).cruces.cruces_vars.find((c) => c.name === "E2_sex")?.excluidas).toEqual(["3"]);
  });

  it("el pie de la lista solo aparece si hay variables excluidas, y lleva a su panel", async () => {
    await montar();
    expect(host.querySelector(".tablas-preguntas-pie")).toBeNull();
    const s = await store();
    await act(async () => { s.setState((e) => ({ config: { ...e.config, variables_excluidas: ["E6_impact"] } })); });
    const excluidas = Array.from(host.querySelectorAll(".tablas-preguntas-pie a")).find((a) => a.textContent?.includes("variable excluida"));
    expect(excluidas?.textContent).toBe("1 variable excluida");
    expect(excluidas?.getAttribute("href")).toContain("panel=excluidas");
  });

  it("mientras el formulario no llega, el chip no muestra el nombre de la columna", async () => {
    api.variables.mockImplementation(() => new Promise(() => undefined));
    api.preview.mockImplementation(() => new Promise(() => undefined));
    await montar();
    expect(Array.from(host.querySelectorAll(".cruces-chip-etiqueta")).map((e) => e.textContent)).toEqual(["Leyendo", "Leyendo"]);
    expect(host.querySelector(".cruces-chips")?.textContent).not.toMatch(/M5_district|E2_sex/);
  });

  it("con una variable de cruce la cabecera concuerda: 1 variable de cruce", async () => {
    const una = respuestaSinPesos();
    api.preview.mockImplementation(async () => ({ ...una, cruces: una.cruces.slice(0, 1) }));
    await montar();
    expect(cabecera()).toContain("variable de cruce1");
    expect(cabecera()).not.toContain("variables de cruce");
  });

  it("Q3: los chips de categorías se leen por su etiqueta, emparejada por código con las columnas de la vista previa", async () => {
    api.valores.mockImplementation(async (nombre) => ({
      ok: true,
      values: nombre === "M5_district" ? [{ value: "sjl", label: "" }, { value: "smp", label: "" }, { value: "zz", label: "" }] : SEXO,
    }));
    await montar();
    await esperar();
    const chips = Array.from(host.querySelectorAll<HTMLButtonElement>('[aria-label="Categorías excluidas de ¿En qué distrito vive actualmente?"] button'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual(["San Juan de Lurigancho", "San Martín de Porres", "zz"]);
    expect(chips[0].getAttribute("title")).toBe("Excluir San Juan de Lurigancho (código sjl)");
  });

  it("R2: bajo las categorías se dice que excluir quita casos de todas las tablas", async () => {
    await montar();
    await esperar();
    expect(texto().match(/Excluir una categoría quita sus casos de todas las tablas, también del Total\./g)).toHaveLength(1);
  });

  it("quitar una variable de cruce la saca de la config", async () => {
    await montar();
    await pulsar("Quitar ¿Cuál es su sexo?");
    expect((await config()).cruces.cruces_vars.map((c) => c.name)).toEqual(["M5_district"]);
  });

  it("orden, nombres de sección y letras escriben su ajuste; los ajustes van en el orden del prototipo", async () => {
    await montar();
    const titulos = Array.from(host.querySelectorAll(".tablas-panel--ajustes .tablas-seccion-titulo")).map((t) => t.textContent);
    expect(titulos).toEqual(["Variables de cruce", "Orden de las filas", "Significancia", "Notas al pie"]);
    const mayor = Array.from(host.querySelectorAll<HTMLButtonElement>('.tablas-panel--ajustes [role="radio"]')).find((b) => b.textContent === "Mayor a menor");
    await act(async () => { mayor?.click(); });
    expect((await config()).cruces.orden).toBe("desc");
    const interruptor = (titulo: string) => host.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${titulo}"]`);
    await act(async () => { interruptor("Nombres de sección")?.click(); });
    expect((await config()).cruces.incluir_secciones).toBe(false);
    await act(async () => { interruptor("Letras de diferencias")?.click(); });
    expect((await config()).cruces.show_sig).toBe(false);
    // Sin letras no se muestra la regla.
    expect(texto()).not.toContain("Cambiar la regla del estudio");
  });

  it("el modo guardado en Dimensiones sin dimensiones generadas vuelve a Estándar, como siempre", async () => {
    const s = await store();
    s.setState((e) => ({ config: { ...e.config, cruces: { ...e.config.cruces, modo: "dimensiones" } } }));
    await montar();
    expect((await config()).cruces.modo).toBe("estandar");
    sesion.analitica_dim_ok = true;
    s.setState((e) => ({ config: { ...e.config, cruces: { ...e.config.cruces, modo: "dimensiones" } } }));
    await montar();
    expect((await config()).cruces.modo).toBe("dimensiones");
  });

  it("elegir una pregunta por la dirección muestra su tabla y la marca en la lista", async () => {
    await montar("?pestana=cruces&foco=E6_impact");
    expect(tabla("E6_impact")).not.toBeNull();
    expect(tabla("D1_information")).toBeNull();
    expect(enLista("E6_impact")?.getAttribute("aria-current")).toBe("true");
    expect(enLista("D1_information")?.hasAttribute("aria-current")).toBe(false);
  });
});
