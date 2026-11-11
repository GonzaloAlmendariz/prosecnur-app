// @vitest-environment happy-dom
/**
 * Frecuencias de punta a punta sobre el marcado real y un servicio de vista
 * previa simulado con la forma exacta del contrato (la respuesta real de
 * acnur_acg y sus variantes): la lista de preguntas y la tabla de la elegida,
 * el conmutador de cifras, los estados de la vista previa, cuándo se vuelve a
 * pedir (base, universo y config GUARDADA), lo que cada control escribe en la
 * config y lo que se envía al generar.
 */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrecuenciasPreview, FrecuenciasPreviewEntrada, VariableInstrumento } from "../../../api/analitica";
import { ApiError } from "../../../api/core";
import {
  respuestaDeUna, respuestaDosBases, respuestaReal, respuestaRecortada, respuestaSinPesos, respuestaSinTabla, respuestaVacia,
} from "./ejemploDeVistaPrevia.test-util";

type RespuestaDeVariables = { ok: true; variables: VariableInstrumento[]; grain: null };

const sesion = { active_base: "Monitoreo territorial", analitica_fuente: "adaptados", n_bases: 1 };
const api = {
  variables: vi.fn<() => Promise<RespuestaDeVariables>>(),
  preview: vi.fn<(entrada?: FrecuenciasPreviewEntrada) => Promise<FrecuenciasPreview>>(),
  revision: vi.fn<() => Promise<unknown>>(),
  preparar: vi.fn<() => Promise<unknown>>(),
  frecuencias: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
};
const corrida = { runSync: vi.fn(async (fn: () => Promise<unknown>) => { await fn(); }) };

vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaVariables: () => api.variables(),
  apiAnaliticaFrecuenciasPreview: (entrada?: FrecuenciasPreviewEntrada) => api.preview(entrada),
  apiAnaliticaDataReview: () => api.revision(),
  apiAnaliticaPreparar: () => api.preparar(),
  apiAnaliticaFrecuencias: (...args: unknown[]) => api.frecuencias(...args),
}));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { ...sesion }, refresh: async () => undefined }) }));
vi.mock("../useReporteRun", () => ({
  useReporteRun: () => ({
    generacion: { estado: { fase: "inactiva" }, cerrar: () => undefined },
    busy: false, lastResult: null, perBase: [], runSync: corrida.runSync, runAsync: corrida.runSync,
  }),
}));

const VARIABLES: VariableInstrumento[] = [
  { name: "E1_age", label: "¿Cuál es su edad?", tipo: "integer", list_name: "", categorica: false, numerica: true },
  { name: "M4_employment", label: "¿Cuál describe mejor su situación laboral actual?", tipo: "select_one", list_name: "empleo", categorica: true, numerica: false },
  { name: "D1_information", label: "¿Dónde vio o escuchó esos mensajes?", tipo: "select_multiple", list_name: "medios", categorica: true, numerica: false },
  { name: "q99", label: "Ingresos del hogar", tipo: "select_one", list_name: "ingresos", categorica: true, numerica: false },
  { name: "hijos", label: "Número de hijos", tipo: "integer", list_name: "", categorica: false, numerica: true },
];
const variablesOk = (): Promise<RespuestaDeVariables> => Promise.resolve({ ok: true, variables: VARIABLES, grain: null });
const pendiente = <T,>() => {
  let soltar: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((r) => { soltar = r; });
  return { promesa, soltar: (valor: T) => soltar(valor) };
};

let host: HTMLDivElement;
let root: Root;
let navegar: NavigateFunction;
let busqueda = "";
let repintar: () => void;

function Navegador() {
  navegar = useNavigate();
  busqueda = useLocation().search;
  return null;
}

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const ir = async (search: string) => { await act(async () => { navegar({ pathname: "/analitica", search }, { replace: true }); }); };
const texto = () => host.textContent ?? "";
const hoja = () => host.querySelector<HTMLElement>(".tablas-grupo");
const grupo = (variable: string) => host.querySelector<HTMLElement>(`.tablas-grupo[data-variable="${variable}"]`);
const cabecera = () => host.querySelector<HTMLElement>(".tablas-cabecera")?.textContent ?? "";
const lista = () => Array.from(host.querySelectorAll<HTMLButtonElement>(".tablas-pregunta"));
const enLista = (variable: string) => lista().find((b) => b.querySelector(".tablas-pregunta-codigo")?.textContent === variable);
const elegirEnLista = async (variable: string) => {
  const b = enLista(variable);
  if (!b) throw new Error(`La lista no tiene ${variable}`);
  await act(async () => { b.click(); });
  await esperar();
};
const porcentajes = (variable: string) => Array.from(grupo(variable)?.querySelectorAll<HTMLElement>(".is-porcentaje") ?? []).map((c) => c.textContent);
const boton = (rotulo: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === rotulo || b.getAttribute("aria-label") === rotulo);
const pulsar = async (rotulo: string) => {
  const b = boton(rotulo);
  if (!b) throw new Error(`No hay un botón "${rotulo}"`);
  await act(async () => { b.click(); });
};
const store = async () => (await import("../store")).useAnaliticaStore;
const config = async () => (await store()).getState().config;
/** El autosave terminó de guardar (lo que hace `useAnaliticaAutosave` tras el POST). */
const guardado = async () => { const s = await store(); await act(async () => { s.getState().markClean(); }); await esperar(); };

async function montar(search = "?pestana=frecuencias", { estricto = false } = {}) {
  const { FrecuenciasPane } = await import("../panes/FrecuenciasPane");
  const pantalla = () => (
    <MemoryRouter initialEntries={[`/analitica${search}`]}>
      <Navegador />
      <FrecuenciasPane />
    </MemoryRouter>
  );
  // La app corre en StrictMode (main.tsx): en desarrollo monta cada efecto dos veces.
  const arbol = () => (estricto ? <StrictMode>{pantalla()}</StrictMode> : pantalla());
  repintar = () => root.render(arbol());
  await act(async () => { repintar(); });
  await esperar();
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sesion.active_base = "Monitoreo territorial";
  sesion.analitica_fuente = "adaptados";
  api.variables.mockReset().mockImplementation(variablesOk);
  api.preview.mockReset().mockImplementation(async () => respuestaReal());
  api.revision.mockReset().mockResolvedValue({ ok: true, variables: [] });
  api.frecuencias.mockReset().mockResolvedValue({ ok: true });
  api.preparar.mockReset().mockResolvedValue({ ok: true, fuente: "adaptados", n_filas: 1283, n_columnas: 40 });
  corrida.runSync.mockClear();
  const { useVistaDeTablas, CIFRAS_INICIALES } = await import("./vistaDeTablasStore");
  useVistaDeTablas.setState({ cifras: { ...CIFRAS_INICIALES } });
  const { useAnaliticaStore, DEFAULT_CONFIG } = await import("../store");
  useAnaliticaStore.setState({
    config: { ...DEFAULT_CONFIG, frecuencias: { ...DEFAULT_CONFIG.frecuencias, numericas_override: ["E1_age"] } },
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

describe("Frecuencias: la lista y la tabla de la pregunta elegida", () => {
  it("pide las primeras 50 tablas una vez; la lista las agrupa por sección y se ve una tabla, la primera", async () => {
    await montar();
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenLastCalledWith({ limite: 50 });
    // La vista previa ya no lee la revisión de variables.
    expect(api.revision).not.toHaveBeenCalled();
    expect(lista().map((b) => b.querySelector(".tablas-pregunta-codigo")?.textContent)).toEqual(["E1_age", "M4_employment", "D1_information"]);
    expect(host.querySelector(".tablas-panel--preguntas .tablas-conteo")?.textContent).toBe("3");
    // Una sola tabla a la vista: la de la primera pregunta, marcada en la lista.
    expect(host.querySelectorAll(".tablas-grupo")).toHaveLength(1);
    expect(grupo("E1_age")?.querySelectorAll("dt")).toHaveLength(8);
    expect(grupo("E1_age")?.textContent).toContain("Mediana (Percentil 50)46");
    expect(enLista("E1_age")?.getAttribute("aria-current")).toBe("true");
    expect(texto()).not.toContain("Se ven");
    expect(boton("Generar Excel")?.disabled).toBe(false);
  });

  it("elegir en la lista escribe el foco, cambia la tabla y no vuelve a pedir: única y múltiple tal como llegan", async () => {
    await montar();
    await elegirEnLista("M4_employment");
    expect(new URLSearchParams(busqueda).get("foco")).toBe("M4_employment");
    expect(enLista("M4_employment")?.getAttribute("aria-current")).toBe("true");
    expect(enLista("E1_age")?.hasAttribute("aria-current")).toBe(false);
    expect(host.querySelectorAll(".tablas-grupo")).toHaveLength(1);
    expect(porcentajes("M4_employment")).toEqual(["43.50", "27.30", "5.52", "18.80", "0.34", "4.55", "100.00"]);
    expect(grupo("M4_employment")?.textContent).toContain("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(grupo("M4_employment")?.textContent).toContain("Fuente: Pulso PUCP.");
    await elegirEnLista("D1_information");
    expect(porcentajes("D1_information")).toEqual(["65.32", "30.28", "4.13", "11.89", "7.18", "6.97", "18.16", "9.57", "5.59", "100.00"]);
    expect(grupo("D1_information")?.textContent).toContain("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("el buscador filtra por pregunta o código y las flechas recorren la lista", async () => {
    await montar();
    const buscador = host.querySelector<HTMLInputElement>('input[aria-label="Buscar pregunta o código"]');
    expect(buscador).not.toBeNull();
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      set?.call(buscador, "situación laboral");
      buscador?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(lista().map((b) => b.querySelector(".tablas-pregunta-codigo")?.textContent)).toEqual(["M4_employment"]);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      set?.call(buscador, "");
      buscador?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const [primera, segunda] = lista();
    primera.focus();
    await act(async () => { primera.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(document.activeElement).toBe(segunda);
    await act(async () => { segunda.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })); });
    expect(document.activeElement).toBe(primera);
  });

  it("el conmutador muestra casos, porcentaje o los dos sin volver a pedir", async () => {
    await montar("?pestana=frecuencias&foco=M4_employment");
    const { useVistaDeTablas } = await import("./vistaDeTablasStore");
    await act(async () => { useVistaDeTablas.setState({ cifras: { frecuencias: "ambos", cruces: "porcentaje" } }); });
    const cifras = () => Array.from(grupo("M4_employment")?.querySelectorAll<HTMLElement>(".tablas-cifra") ?? []).map((c) => c.textContent);
    expect(cifras()).toContain("558");
    expect(cifras()).toContain("43.50");
    await pulsar("N ponderado");
    expect(cifras()).toContain("558");
    expect(cifras()).not.toContain("43.50");
    await pulsar("Porcentaje");
    expect(cifras()).not.toContain("558");
    expect(porcentajes("M4_employment")).toEqual(["43.50", "27.30", "5.52", "18.80", "0.34", "4.55", "100.00"]);
    await pulsar("Ambos");
    expect(cifras()).toContain("558");
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("ponderada: la columna dice N ponderado, la base va en casos y la cabecera dice Ponderada y la base", async () => {
    await montar("?pestana=frecuencias&foco=M4_employment");
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).toContain("N ponderado");
    expect(texto()).not.toContain("casos ponderados");
    expect(cabecera()).toContain("Ponderada");
    expect(cabecera()).toContain("base codificada");
    expect(texto()).not.toMatch(/[«»]/);
    expect(texto()).not.toContain("adaptados");
    await elegirEnLista("E1_age");
    expect(grupo("E1_age")?.textContent).toContain("de 1,283 casos (100.0 %)");
    // Lo ponderado son los estadísticos; la base no se llama ponderada.
    expect(grupo("E1_age")?.textContent).not.toMatch(/casos ponderados|base ponderada/);
  });

  it("sin ponderar: casos sin más, y la fila sin código muestra solo su etiqueta", async () => {
    api.preview.mockImplementation(async () => respuestaSinPesos());
    await montar("?pestana=frecuencias&foco=M4_employment");
    expect(grupo("M4_employment")?.textContent).toContain("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).not.toContain("ponderado");
    expect(cabecera()).toContain("Sin ponderar");
    const filas = Array.from(grupo("M4_employment")?.querySelectorAll<HTMLElement>(".tablas-fila") ?? []);
    const sinCodigo = filas.find((f) => f.textContent?.includes("No trabaja actualmente, pero está buscando trabajo"));
    expect(sinCodigo?.querySelector(".tablas-categoria")?.hasAttribute("title")).toBe(false);
    expect(sinCodigo?.hasAttribute("data-categoria")).toBe(false);
    await elegirEnLista("D1_information");
    expect(grupo("D1_information")?.textContent).toContain("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
  });

  it("la cabecera cuenta las tablas del servicio, no las variables del formulario; con dos bases dice que son de esta base", async () => {
    await montar();
    expect(cabecera()).toContain("preguntas en el archivo26");
    expect(cabecera()).toContain("con resumen numérico1");
    expect(cabecera()).not.toContain("analizables");
    act(() => root.unmount());
    root = createRoot(host);
    api.preview.mockImplementation(async () => respuestaDosBases());
    await montar();
    expect(cabecera()).toContain("preguntas de esta base26");
  });

  it("recortada: la lista suma las preguntas del formulario que la hoja no trae, y elegir una la pide aparte", async () => {
    api.preview.mockImplementation(async (entrada) => (entrada?.variables ? respuestaDeUna("q99", "Ingresos del hogar") : respuestaRecortada(3, 120)));
    await montar();
    expect(texto()).not.toContain("Se ven 3 de 120 tablas.");
    expect(texto()).toContain("Más preguntas del formulario");
    expect(enLista("q99")?.textContent).toContain("Ingresos del hogar");
    await elegirEnLista("q99");
    expect(api.preview).toHaveBeenCalledWith({ variables: ["q99"], limite: 1 });
    expect(grupo("q99")).not.toBeNull();
    expect(enLista("q99")?.getAttribute("aria-current")).toBe("true");
  });

  it("la pregunta de la dirección que la hoja no trae se pide aparte y es la que se ve", async () => {
    api.preview.mockImplementation(async (entrada) => (entrada?.variables ? respuestaDeUna("q99", "Ingresos del hogar") : respuestaRecortada(3, 120)));
    await montar("?pestana=frecuencias&foco=q99");
    await esperar();
    expect(api.preview).toHaveBeenCalledWith({ variables: ["q99"], limite: 1 });
    expect(host.querySelectorAll(".tablas-grupo")).toHaveLength(1);
    expect(grupo("q99")?.textContent).toContain("Ingresos del hogar");
    expect(texto()).not.toContain("Pregunta elegida");
  });

  it("la pregunta de la dirección que está en la hoja no se pide otra vez", async () => {
    await montar("?pestana=frecuencias&foco=D1_information");
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(grupo("D1_information")).not.toBeNull();
    expect(enLista("D1_information")?.getAttribute("aria-current")).toBe("true");
  });

  it("el foco que pierde su tabla por un ajuste se suelta sin aviso ni pedido aparte", async () => {
    await montar("?pestana=frecuencias&foco=E1_age");
    expect(grupo("E1_age")).not.toBeNull();
    // Se quita E1_age de las numéricas: la hoja guardada ya no la trae.
    const sinEdad = respuestaReal();
    sinEdad.tablas = sinEdad.tablas.filter((t) => t.variable !== "E1_age");
    sinEdad.total_variables = 26;
    api.preview.mockImplementation(async (entrada) => (entrada?.variables ? respuestaSinTabla("E1_age", "fuera_del_archivo") : sinEdad));
    await pulsar("Quitar ¿Cuál es su edad?");
    await guardado();
    await esperar();
    expect(new URLSearchParams(busqueda).has("foco")).toBe(false);
    expect(texto()).not.toContain("está en la base y no entra al archivo");
    expect(api.preview.mock.calls.some(([e]) => Boolean(e?.variables))).toBe(false);
    // Se ve la primera que queda.
    expect(grupo("M4_employment")).not.toBeNull();
  });

  it("con la hoja recortada, el foco que pierde su tabla se suelta tras pedirla aparte, sin aviso", async () => {
    api.preview.mockImplementation(async () => respuestaRecortada(3, 120));
    await montar("?pestana=frecuencias&foco=E1_age");
    const sinEdad = respuestaRecortada(3, 120);
    sinEdad.tablas = sinEdad.tablas.filter((t) => t.variable !== "E1_age");
    api.preview.mockImplementation(async (entrada) => (entrada?.variables ? respuestaSinTabla("E1_age", "fuera_del_archivo") : sinEdad));
    await pulsar("Quitar ¿Cuál es su edad?");
    await guardado();
    await esperar();
    expect(new URLSearchParams(busqueda).has("foco")).toBe(false);
    expect(texto()).not.toContain("está en la base y no entra al archivo");
  });

  it("una pregunta pedida sin tabla dice por qué, con su pregunta, en el lugar de la tabla", async () => {
    api.preview.mockImplementation(async (entrada) => (entrada?.variables ? respuestaSinTabla("hijos", "excluida") : respuestaReal()));
    await montar("?pestana=frecuencias&foco=hijos");
    await esperar();
    expect(host.querySelector(".tablas-panel--tabla")?.textContent).toContain("Sin tabla en el archivo");
    expect(texto()).toContain('"Número de hijos" está excluida del análisis.');
    expect(texto()).not.toContain("1 variable pedida no tiene tabla");
  });
});

describe("Frecuencias: estados de la vista previa", () => {
  it("mientras se lee no afirma cifras ni deja generar, y su marca de readiness queda en falso", async () => {
    api.preview.mockImplementation(() => new Promise(() => undefined));
    await montar();
    const tabla = host.querySelector(".tablas-panel--tabla");
    expect(tabla?.querySelector('[data-audit-ready="false"] [role="status"]')?.textContent).toContain("Leyendo las tablas del archivo");
    expect(host.querySelector('.tablas-panel--preguntas [data-audit-ready="false"]')).not.toBeNull();
    expect(cabecera()).not.toMatch(/preguntas en el archivo\d/);
    expect(cabecera()).toContain("preguntas en el archivoLeyendo");
    expect(hoja()).toBeNull();
    expect(boton("Generar Excel")?.disabled).toBe(true);
    // El motivo se lee en el panel Archivo y el botón lo nombra.
    const motivo = host.querySelector(".tablas-panel--archivo .tablas-archivo-motivo");
    expect(motivo?.textContent).toBe("Leyendo las tablas del archivo");
    expect(boton("Generar Excel")?.getAttribute("aria-describedby")).toBe(motivo?.id);
  });

  it("si falla dice la causa sin el código, Reintentar vuelve a pedir y el archivo se puede generar", async () => {
    api.preview.mockImplementationOnce(() => Promise.reject(new ApiError("E_INTERNAL", "Tiempo de espera agotado.")));
    await montar();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("No se pudo leer la vista previa");
    expect(texto()).toContain("Tiempo de espera agotado.");
    expect(texto()).not.toContain("E_INTERNAL");
    expect(cabecera()).toContain("Sin leer");
    expect(boton("Generar Excel")?.disabled).toBe(false);
    // Sin lista que mostrar, la lista no queda leyendo para siempre ni dice que el archivo no tiene preguntas.
    expect(host.querySelector('.tablas-panel--preguntas [data-audit-ready="false"]')).toBeNull();
    expect(host.querySelector(".tablas-panel--preguntas")?.textContent).toContain("No se pudo leer la vista previa.");
    expect(texto()).not.toContain("Sin preguntas en el archivo");

    await pulsar("Reintentar");
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(lista()).toHaveLength(3);
  });

  it("sin base preparada (409) lo dice con su texto y no deja generar", async () => {
    api.preview.mockImplementation(() => Promise.reject(new ApiError(
      "E_NO_RP_DATA", "El estudio no tiene base analítica preparada. Reingresa a Analítica para preparar la fuente activa.",
    )));
    await montar();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Sin base preparada");
    // La pantalla escribe su propia causa, una vez; el mensaje del servidor no se pinta.
    expect(texto().match(/no tiene la base lista para tabular/g)).toHaveLength(1);
    expect(texto()).not.toContain("Reingresa a Analítica");
    expect(texto()).not.toContain("E_NO_RP_DATA");
    expect(texto()).toContain("Falta preparar la base.");
    expect(boton("Generar Excel")?.disabled).toBe(true);
    expect(boton("Preparar la base")?.className).toContain("primary");
  });

  it("Preparar la base llama a la preparación de Analítica y vuelve a pedir la vista previa", async () => {
    api.preview.mockImplementationOnce(() => Promise.reject(new ApiError("E_NO_RP_DATA", "Sin base.")));
    await montar();
    await pulsar("Preparar la base");
    await esperar();
    expect(api.preparar).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelectorAll(".tablas-grupo")).toHaveLength(1);
  });

  it("si preparar la base falla, dice por qué en lugar de la causa genérica", async () => {
    api.preview.mockImplementation(() => Promise.reject(new ApiError("E_NO_RP_DATA", "Sin base.")));
    api.preparar.mockRejectedValueOnce(new ApiError("E_CARGA_SIN_DATOS", "No hay datos cargados en Carga."));
    await montar();
    await pulsar("Preparar la base");
    await esperar();
    expect(texto()).toContain("No se pudo preparar la base: No hay datos cargados en Carga.");
    expect(texto()).not.toContain("no tiene la base lista para tabular");
    expect(texto()).not.toContain("E_CARGA_SIN_DATOS");
  });

  it("sin tablas en el archivo lo dice con la causa del servicio, en la tabla y en el panel Archivo", async () => {
    api.preview.mockImplementation(async () => respuestaVacia());
    await montar();
    expect(texto()).toContain("Sin tablas en el archivo");
    expect(texto().match(/ninguna variable de las secciones configuradas está en esta base/g)).toHaveLength(2);
    expect(host.querySelector(".tablas-panel--archivo")?.textContent).toContain("ninguna variable de las secciones configuradas");
    expect(boton("Generar Excel")?.disabled).toBe(true);
    expect(hoja()).toBeNull();
    expect(texto()).toContain("Sin preguntas en el archivo");
  });

  it("con todas las secciones ocultas la causa es esa", async () => {
    api.preview.mockImplementation(async () => respuestaVacia());
    const s = await store();
    s.setState({ config: { ...s.getState().config, secciones: [{ id: "s1", nombre: "Datos", variables: ["M4_employment"], oculto: true, orden: 0 }] } });
    await montar();
    expect(texto()).toContain("Todas las secciones están ocultas");
  });
});

describe("Frecuencias: se vuelve a pedir cuando cambia lo que cambia el archivo", () => {
  it("un ajuste espera al autosave: atenuada mientras tanto y pedida después de guardar", async () => {
    await montar("?pestana=frecuencias&foco=M4_employment");
    expect(api.preview).toHaveBeenCalledTimes(1);

    await pulsar("Mayor a menor");
    expect((await config()).frecuencias.orden).toBe("desc");
    // El cambio todavía no está guardado: no se pide, lo que se ve es de antes.
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(true);
    expect(hoja()?.getAttribute("aria-busy")).toBe("true");

    const nueva = respuestaReal();
    nueva.tablas[1].filas.reverse();
    api.preview.mockImplementation(async () => nueva);
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(false);
    expect(porcentajes("M4_employment")).toEqual(["4.55", "0.34", "18.80", "5.52", "27.30", "43.50", "100.00"]);
  });

  it("con ajustes sin guardar, Generar espera al guardado", async () => {
    await montar();
    expect(boton("Generar Excel")?.disabled).toBe(false);
    await pulsar("Mayor a menor");
    expect(boton("Generar Excel")?.disabled).toBe(true);
    expect(texto()).toContain("Guardando los ajustes");
    await guardado();
    expect(boton("Generar Excel")?.disabled).toBe(false);
    expect(texto()).not.toContain("Guardando los ajustes");
  });

  it("si el guardado falla, la vista previa lo dice una vez, deja de atenuarse y Reintentar vuelve a guardar", async () => {
    await montar();
    await pulsar("Mayor a menor");
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(true);
    const s = await store();
    await act(async () => { s.getState().setErrorGuardado("Sin conexión con el backend."); });
    expect(texto().match(/No se pudieron guardar los ajustes\. La vista previa muestra los anteriores\./g)).toHaveLength(1);
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(false);
    expect(boton("Generar Excel")?.disabled).toBe(true);
    expect(texto()).toContain("Ajustes sin guardar");
    const reintentos = s.getState().reintentosGuardado;
    const reintentar = Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-alert button")).find((b) => b.textContent?.includes("Reintentar"));
    await act(async () => { reintentar?.click(); });
    expect(s.getState().reintentosGuardado).toBe(reintentos + 1);
    expect(s.getState().errorGuardado).toBeNull();
    expect(texto()).not.toContain("No se pudieron guardar los ajustes");
  });

  it("los interruptores, las numéricas y las notas también releen al guardarse", async () => {
    await montar();
    await pulsar("Todas las opciones");
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(2);
    await pulsar("Número de hijos");
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(3);
    const s = await store();
    await act(async () => { s.getState().setNotas({ fuente: "Encuesta 2026" }); });
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(true);
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(4);
  });

  it("al cerrar el universo de análisis se relee y lo anterior se atenúa", async () => {
    await montar("?pestana=frecuencias&foco=M4_employment");
    await ir("?pestana=frecuencias&foco=M4_employment&panel=universo");
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(1);

    const llega = pendiente<FrecuenciasPreview>();
    api.preview.mockImplementationOnce(() => llega.promesa);
    await ir("?pestana=frecuencias&foco=M4_employment");
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(true);
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).toContain("N ponderado");

    await act(async () => { llega.soltar(respuestaSinPesos()); });
    expect(hoja()?.hasAttribute("data-releyendo")).toBe(false);
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).not.toContain("N ponderado");
  });

  it("al cambiar la base activa o la fuente se relee", async () => {
    await montar();
    sesion.active_base = "Otra base";
    await act(async () => { repintar(); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(2);
    sesion.analitica_fuente = "originales";
    await act(async () => { repintar(); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(3);
  });

  it("un pedido por cambio, también en StrictMode como la app", async () => {
    await montar("?pestana=frecuencias", { estricto: true });
    expect(api.preview).toHaveBeenCalledTimes(1);
    await pulsar("Mayor a menor");
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(2);
    await pulsar("Todas las opciones");
    await guardado();
    expect(api.preview).toHaveBeenCalledTimes(3);
    // Al cerrar el universo, uno.
    await ir("?pestana=frecuencias&panel=universo");
    await ir("?pestana=frecuencias");
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(4);
  });

  it("una rehidratación con la misma config no vuelve a pedir", async () => {
    await montar();
    const s = await store();
    const remota = JSON.parse(JSON.stringify(s.getState().config));
    await act(async () => { s.getState().hydrate(remota); });
    await esperar();
    const antes = api.preview.mock.calls.length;
    // La misma config remota otra vez: objeto nuevo, contenido igual.
    await act(async () => { s.getState().hydrate(JSON.parse(JSON.stringify(remota))); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(antes);
  });

  it("sin ningún cambio no se vuelve a pedir", async () => {
    await montar();
    await act(async () => { repintar(); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(1);
  });

  it("la respuesta de una lectura anterior que llega tarde se descarta", async () => {
    await montar("?pestana=frecuencias&foco=M4_employment");
    const vieja = pendiente<FrecuenciasPreview>();
    api.preview.mockImplementationOnce(() => vieja.promesa);
    sesion.active_base = "Otra base";
    await act(async () => { repintar(); });
    await esperar();

    api.preview.mockImplementation(async () => respuestaSinPesos());
    sesion.active_base = "Tercera base";
    await act(async () => { repintar(); });
    await esperar();
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).not.toContain("N ponderado");

    const tarde = respuestaReal();
    tarde.tablas[1].base = { n: 999, de: 999, denominador: "respondieron" };
    await act(async () => { vieja.soltar(tarde); });
    await esperar();
    expect(host.querySelector(".tablas-hoja-cabecera")?.textContent).not.toContain("N ponderado");
    expect(grupo("M4_employment")?.textContent).not.toContain("999");
  });

  it("antes de hidratar la config no se pide nada", async () => {
    const s = await store();
    s.setState({ hydrated: false });
    await montar();
    expect(api.preview).not.toHaveBeenCalled();
    expect(texto()).toContain("Leyendo las tablas del archivo");
    await act(async () => { s.setState({ hydrated: true }); });
    await esperar();
    expect(api.preview).toHaveBeenCalledTimes(1);
  });
});

describe("Frecuencias: lo que cada control escribe y lo que se envía", () => {
  it("Generar Excel, en la cabecera, envía el pedido sin cuerpo: la config viaja por el autosave", async () => {
    await montar();
    expect(host.querySelector(".tablas-cabecera")?.contains(boton("Generar Excel") ?? null)).toBe(true);
    await pulsar("Generar Excel");
    expect(corrida.runSync).toHaveBeenCalledTimes(1);
    expect(api.frecuencias).toHaveBeenCalledTimes(1);
    expect(api.frecuencias.mock.calls[0]).toEqual([]);
  });

  it("el panel Archivo nombra el Excel y su estado antes de generar", async () => {
    await montar();
    const archivo = host.querySelector(".tablas-panel--archivo")?.textContent ?? "";
    expect(archivo).toContain("Archivo");
    expect(archivo).toContain("Frecuencias");
    expect(archivo).toContain("Por generar");
  });

  it("el orden es un grupo de opciones del kit", async () => {
    await montar();
    const ajustes = host.querySelector<HTMLElement>(".tablas-panel--ajustes");
    const grupoDeOrden = ajustes?.querySelector('[role="radiogroup"]');
    expect(document.getElementById(grupoDeOrden?.getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Orden de las respuestas");
    expect(Array.from(ajustes?.querySelectorAll('[role="radio"]') ?? []).map((r) => r.textContent)).toEqual(["Formulario", "Mayor a menor", "Menor a mayor"]);
    await pulsar("Menor a mayor");
    expect((await config()).frecuencias.orden).toBe("asc");
    expect(boton("Menor a mayor")?.getAttribute("aria-checked")).toBe("true");
  });

  it("los dos interruptores escriben su ajuste", async () => {
    await montar();
    const interruptores = Array.from(host.querySelectorAll<HTMLElement>('[role="switch"]'));
    expect(interruptores.map((i) => i.getAttribute("aria-label"))).toEqual(["Todas las opciones", "Nombres de sección"]);
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    await pulsar("Todas las opciones");
    expect((await config()).frecuencias.mostrar_todo).toBe(false);
    await pulsar("Nombres de sección");
    expect((await config()).frecuencias.incluir_secciones).toBe(false);
  });

  it("agregar y quitar una numérica escribe la lista de esta pestaña; los ajustes se ordenan como el prototipo", async () => {
    await montar();
    const titulos = Array.from(host.querySelectorAll(".tablas-panel--ajustes .tablas-seccion-titulo")).map((t) => t.textContent);
    expect(titulos).toEqual(["Orden de las respuestas", "Con resumen numérico", "Notas al pie"]);
    await pulsar("Número de hijos");
    expect((await config()).frecuencias.numericas_override).toEqual(["E1_age", "hijos"]);
    await pulsar("Quitar ¿Cuál es su edad?");
    expect((await config()).frecuencias.numericas_override).toEqual(["hijos"]);
    expect((await config()).numericas).toEqual([]);
    expect(boton("Añadir variable numérica")).toBeDefined();
  });

  it("las notas al pie van abiertas, sin plegable y con rótulos en castellano normal", async () => {
    await montar();
    const ajustes = host.querySelector<HTMLElement>(".tablas-panel--ajustes");
    expect(ajustes?.querySelector("[aria-expanded]")).toBeNull();
    expect(ajustes?.querySelector(".analitica-notas-pie .pulso-section-eyebrow, .analitica-notas-pie--abierta .pulso-section-eyebrow")).toBeNull();
    expect(Array.from(ajustes?.querySelectorAll(".analitica-notas-pie-rotulo") ?? []).map((r) => r.textContent))
      .toEqual(["Fuente", "Base por defecto", "Base por pregunta"]);
  });

  it("el pie de la lista solo aparece con algo oculto o excluido, y lleva a donde se decide", async () => {
    await montar();
    expect(host.querySelector(".tablas-preguntas-pie")).toBeNull();
    act(() => root.unmount());
    root = createRoot(host);
    const s = await store();
    s.setState({ config: { ...s.getState().config, variables_excluidas: ["E2_sex", "M3_edu"] } });
    await montar();
    const pie = host.querySelector(".tablas-preguntas-pie");
    const enlaces = Array.from(pie?.querySelectorAll("a") ?? []).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(enlaces[0][0]).toBe("Secciones del formulario");
    expect(enlaces[0][1]).toContain("pestana=datos");
    expect(enlaces[1][0]).toBe("2 variables excluidas");
    expect(enlaces[1][1]).toContain("panel=excluidas");
  });
});
