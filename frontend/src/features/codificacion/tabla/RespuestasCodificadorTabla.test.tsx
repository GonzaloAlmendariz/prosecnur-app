// @vitest-environment happy-dom
/**
 * La vista de tabla montada dentro de `RespuestasCodificador`, que es quien decide si una respuesta admite
 * varios códigos y quien guarda. Estas pruebas fijan el cableado: la vista por defecto, que la elección se
 * recuerde al cambiar de pregunta, que la tabla use la misma regla de varios códigos que las tarjetas y
 * que lo asignado en la tabla llegue al guardado de siempre.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Grupo, RespuestasResponse } from "../../../api/codificacion";
import { useVistaCodificar } from "./vistaCodificarStore";
import { useFiltroRespuestas } from "../codificar/filtroRespuestasStore";
import type { MarcoDeCodificar } from "../codificar/marcoDeCodificar";

const api = vi.hoisted(() => ({ respuestas: vi.fn(), grupos: vi.fn() }));
vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiCodifRespuestas: api.respuestas,
  apiCodifGrupos: api.grupos,
}));

const { RespuestasCodificador } = await import("../RespuestasCodificador");

/** El marco de la pestaña reducido a lo que la mesa le pasa: sus acciones (con el conmutador) y sus columnas. */
const marco: MarcoDeCodificar = ({ acciones, columnas }) => (
  <div>
    <div className="prueba-acciones">{acciones}</div>
    {columnas}
  </div>
);

function carga(tipo: string, otros: RespuestasResponse["sm_otros"]): RespuestasResponse {
  return {
    ok: true,
    parent: "p3",
    col_efectiva: "p3_otro",
    tipo,
    modo_so: "",
    respuestas: [
      { texto_normalizado: "menos colas", texto: "Menos colas", variantes: 1, frecuencia: 3, uuids: [] },
      { texto_normalizado: "mejor trato", texto: "Mejor trato", variantes: 1, frecuencia: 2, uuids: [] },
    ],
    grupos: [],
    opciones_existentes: [
      { codigo: "1", etiqueta: "Trato del personal" },
      { codigo: "2", etiqueta: "Tiempos de espera" },
    ],
    sm_otros: otros,
  };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  useVistaCodificar.setState(useVistaCodificar.getInitialState());
  useFiltroRespuestas.setState({ filtro: "todas" });
  api.respuestas.mockReset();
  api.grupos.mockReset().mockResolvedValue({ ok: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

async function montar(tipo: string, otros: RespuestasResponse["sm_otros"] = null, parent = "p3") {
  api.respuestas.mockResolvedValue(carga(tipo, otros));
  await act(async () => {
    root.render(<RespuestasCodificador key={parent} parent={parent} marco={marco} cabeceraDePregunta={() => null} />);
  });
}

const radio = (rotulo: string) => {
  const boton = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((r) => r.textContent === rotulo);
  if (!boton) throw new Error(`sin opción "${rotulo}"`);
  return boton;
};
const tabla = () => host.querySelector('[role="table"]');
const campo = () => {
  const input = host.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (!input) throw new Error("sin campo");
  return input;
};

function escribir(valor: string) {
  const input = campo();
  const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    fijar?.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function tecla(key: string, extra: KeyboardEventInit = {}) {
  act(() => {
    campo().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }));
  });
}

/** Lo que se mandó a guardar la última vez: código de cada grupo con sus respuestas. */
async function guardado(): Promise<Record<string, string[]>> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  const llamadas = api.grupos.mock.calls;
  const grupos = llamadas[llamadas.length - 1]?.[1] as Grupo[] | undefined;
  return Object.fromEntries((grupos ?? []).map((g) => [g.codigo, g.respuestas]));
}

describe("RespuestasCodificador: conmutador de vista", () => {
  test("arranca en tarjetas: la lista de siempre, sin tabla", async () => {
    await montar("select_one");
    expect(radio("Tarjetas").getAttribute("aria-checked")).toBe("true");
    expect(tabla()).toBeNull();
    expect(host.querySelectorAll(".pulso-cv2-resp-row")).toHaveLength(2);
    expect(host.querySelector('[role="region"][aria-label="Códigos"]')).not.toBeNull();
    expect(host.querySelector("[data-audit-ready]")?.getAttribute("data-audit-ready")).toBe("codificacion-codificar");
  });

  test("Tabla cambia la lista por la tabla y deja el libro de códigos a la derecha", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    expect(radio("Tabla").getAttribute("aria-checked")).toBe("true");
    expect(tabla()).not.toBeNull();
    expect(host.querySelectorAll(".pulso-cv2-resp-row")).toHaveLength(0);
    expect(host.querySelector('[role="region"][aria-label="Libro de códigos"]')).not.toBeNull();
    expect(host.querySelectorAll(".pulso-ct-libro-fila")).toHaveLength(2);
    expect(host.querySelector("[data-audit-ready]")?.getAttribute("data-audit-ready")).toBe("codificacion-codificar");
  });

  test("la vista elegida sigue al pasar a otra pregunta", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    await montar("select_one", null, "p9");
    expect(api.respuestas).toHaveBeenLastCalledWith("p9");
    expect(tabla()).not.toBeNull();
    act(() => radio("Tarjetas").click());
    expect(tabla()).toBeNull();
  });

  test("la búsqueda se conserva al cambiar de vista", async () => {
    await montar("select_one");
    const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const buscador = host.querySelector<HTMLInputElement>('input[type="search"]');
    act(() => {
      fijar?.call(buscador, "trato");
      buscador?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelectorAll(".pulso-cv2-resp-row")).toHaveLength(1);
    act(() => radio("Tabla").click());
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("trato");
    expect(host.querySelectorAll(".pulso-ct-fila")).toHaveLength(1);
  });
});

describe("RespuestasCodificador: codificar en la tabla", () => {
  test("lo asignado con Enter llega al guardado de siempre", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    escribir("2");
    tecla("Enter");
    expect(await guardado()).toEqual({ "1": [], "2": ["menos colas"] });
    expect(api.grupos.mock.calls[0][0]).toBe("p3");
  });

  test("en una pregunta de opción única, Mayús y Enter no suma un segundo código y Enter lo reemplaza", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    expect(host.querySelector(".pulso-ct-teclas")?.textContent).not.toContain("Mayús");
    escribir("2");
    tecla("Enter", { shiftKey: true });
    expect(host.querySelectorAll(".pulso-ct-insignia")).toHaveLength(0);
    tecla("Enter");
    act(() => host.querySelectorAll<HTMLElement>(".pulso-ct-fila")[0].click());
    escribir("1");
    tecla("Enter");
    expect(await guardado()).toEqual({ "1": ["menos colas"], "2": [] });
  });

  test("una múltiple sin la opción Otros tampoco admite varios códigos", async () => {
    await montar("select_multiple", null);
    act(() => radio("Tabla").click());
    expect(host.querySelector(".pulso-ct-teclas")?.textContent).not.toContain("Mayús");
    escribir("2");
    tecla("Enter", { shiftKey: true });
    expect(host.querySelectorAll(".pulso-ct-insignia")).toHaveLength(0);
  });

  test("en una múltiple con Otros, Mayús y Enter suma códigos a la misma respuesta", async () => {
    await montar("select_multiple", { dummy_col: "p3_otro", n_otros_marcados: 5 });
    act(() => radio("Tabla").click());
    expect(host.querySelector(".pulso-ct-teclas")?.textContent).toContain("Mayús");
    escribir("2");
    tecla("Enter", { shiftKey: true });
    escribir("1");
    tecla("Enter", { shiftKey: true });
    expect(await guardado()).toEqual({ "1": ["menos colas"], "2": ["menos colas"] });
  });

  test("quitar una insignia saca la respuesta de ese grupo en el guardado", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    escribir("2");
    tecla("Enter");
    const quitar = host.querySelector<HTMLButtonElement>(".pulso-ct-insignia button");
    act(() => quitar?.click());
    expect(await guardado()).toEqual({ "1": [], "2": [] });
  });

  test("crear un código desde la tabla agrega el grupo con el siguiente número y la respuesta dentro", async () => {
    await montar("select_one");
    act(() => radio("Tabla").click());
    escribir("limpieza");
    tecla("Enter");
    expect(await guardado()).toEqual({ "1": [], "2": [], "3": ["menos colas"] });
    const nuevo = (api.grupos.mock.calls[0][1] as Grupo[]).find((g) => g.codigo === "3");
    expect(nuevo).toMatchObject({ etiqueta: "Limpieza", origen: "nuevo" });
  });
});

describe("RespuestasCodificador: la tabla como el prototipo", () => {
  const conParecidas = (): RespuestasResponse => ({
    ...carga("select_one", null),
    respuestas: [
      { texto_normalizado: "iglesia catolica", texto: "Iglesia catolica", variantes: 1, frecuencia: 4, uuids: [] },
      { texto_normalizado: "mercado", texto: "Mercado", variantes: 1, frecuencia: 3, uuids: [] },
      { texto_normalizado: "iglesia catolicas", texto: "Iglesia catolicas", variantes: 1, frecuencia: 1, uuids: [] },
    ],
  });

  test("cada fila tiene su casilla y la cabecera la de elegir todas; elegir abre la barra de selección", async () => {
    api.respuestas.mockResolvedValue(conParecidas());
    await act(async () => {
      root.render(<RespuestasCodificador parent="p3" marco={marco} cabeceraDePregunta={() => null} />);
    });
    act(() => radio("Tabla").click());
    const casillas = Array.from(host.querySelectorAll<HTMLButtonElement>(".pulso-ct-fila .pulso-ct-casilla"));
    expect(casillas).toHaveLength(3);
    expect(host.querySelector('.pulso-ct-cab-fila .pulso-ct-casilla')?.getAttribute("aria-label")).toBe("Elegir todas las respuestas a la vista");
    act(() => casillas[0].click());
    act(() => casillas[1].click());
    expect(host.querySelectorAll(".pulso-ct-fila[data-elegida]")).toHaveLength(2);
    expect(host.querySelector('[role="toolbar"][aria-label="Respuestas seleccionadas"]')).not.toBeNull();
  });

  test("Agrupar parecidas junta las variantes de escritura en una fila y lo asignado llega a todas", async () => {
    api.respuestas.mockResolvedValue(conParecidas());
    await act(async () => {
      root.render(<RespuestasCodificador parent="p3" marco={marco} cabeceraDePregunta={() => null} />);
    });
    act(() => radio("Tabla").click());
    act(() => host.querySelector<HTMLButtonElement>('button[role="switch"][aria-label="Agrupar parecidas"]')?.click());
    const textos = Array.from(host.querySelectorAll(".pulso-ct-fila .pulso-ct-texto")).map((e) => e.textContent);
    expect(textos).toEqual(["Iglesia catolica", "Mercado"]);
    expect(host.querySelector(".pulso-ct-miembros")?.textContent).toBe("Iglesia catolicas");
    escribir("2");
    tecla("Enter");
    expect(await guardado()).toEqual({ "1": [], "2": ["iglesia catolica", "iglesia catolicas"] });
  });
});
