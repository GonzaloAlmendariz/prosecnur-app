// @vitest-environment happy-dom
/**
 * La vista de tabla de Codificar, con el teclado de verdad: se escribe en el campo de la fila activa, la
 * lista se filtra, Enter asigna y baja. La mesa de prueba guarda los grupos como lo hace
 * `RespuestasCodificador`: con `asignarCodigo` y `quitarCodigo`, y con el mismo `permiteVarios`.
 */
import { act, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import { asignarCodigo, quitarCodigo } from "./asignacionCodigos";
import { TablaCodificar } from "./TablaCodificar";
import { plegar } from "./tablaCodificarModelo";
import { useVistaCodificar } from "./vistaCodificarStore";

const respuesta = (texto: string, frecuencia: number, variantes = 1): RespuestaUnica => ({
  texto_normalizado: plegar(texto),
  texto,
  variantes,
  frecuencia,
  uuids: [],
});

const RESPUESTAS = [
  respuesta("Que atiendan más rápido", 5),
  respuesta("Menos colas en ventanilla", 3, 3),
  respuesta("Que amplíen el horario", 2),
  respuesta("Atención los sábados", 1),
];

const GRUPOS: Grupo[] = [
  { id: "g1", codigo: "1", etiqueta: "Trato del personal", respuestas: ["que atiendan mas rapido"], origen: "nuevo" },
  { id: "g2", codigo: "2", etiqueta: "Tiempos de espera", respuestas: [], origen: "nuevo" },
  { id: "g3", codigo: "3", etiqueta: "Horarios de atención", respuestas: [], origen: "nuevo" },
];

type AlCodificar = (clave: string, valor: string) => void;
type Espia = {
  grupos: Grupo[];
  asignar: Mock<AlCodificar>;
  quitar: Mock<AlCodificar>;
  crear: Mock<AlCodificar>;
};

function Mesa({ permiteVarios, respuestas, espia }: { permiteVarios: boolean; respuestas: RespuestaUnica[]; espia: Espia }) {
  const [grupos, setGrupos] = useState<Grupo[]>(GRUPOS);
  const [busqueda, setBusqueda] = useState("");
  espia.grupos = grupos;
  const tramos = useMemo(
    () => ({
      conContenido: respuestas.filter((r) => r.texto.toLowerCase().includes(busqueda.trim().toLowerCase())),
      noRespuestas: [],
    }),
    [respuestas, busqueda],
  );
  return (
    <TablaCodificar
      pregunta="p21"
      respuestas={respuestas}
      tramos={tramos}
      grupos={grupos}
      busqueda={busqueda}
      onBuscar={setBusqueda}
      permiteVarios={permiteVarios}
      onAsignar={(clave, grupoId) => {
        espia.asignar(clave, grupoId);
        setGrupos((gs) => asignarCodigo(gs, clave, grupoId, permiteVarios));
      }}
      onQuitar={(clave, grupoId) => {
        espia.quitar(clave, grupoId);
        setGrupos((gs) => quitarCodigo(gs, clave, grupoId));
      }}
      onCrear={(clave, nombre) => {
        espia.crear(clave, nombre);
        const nuevo: Grupo = { id: "nuevo", codigo: "4", etiqueta: nombre, respuestas: [], origen: "nuevo" };
        setGrupos((gs) => asignarCodigo([...gs, nuevo], clave, nuevo.id, permiteVarios));
      }}
    />
  );
}

let host: HTMLDivElement;
let root: Root;
let espia: Espia;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useVistaCodificar.setState({ vista: "tarjetas", orden: "frecuencia" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia = { grupos: [], asignar: vi.fn<AlCodificar>(), quitar: vi.fn<AlCodificar>(), crear: vi.fn<AlCodificar>() };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function montar(permiteVarios: boolean, respuestas: RespuestaUnica[] = RESPUESTAS) {
  act(() => root.render(<Mesa permiteVarios={permiteVarios} respuestas={respuestas} espia={espia} />));
}

const filas = () => Array.from(host.querySelectorAll<HTMLElement>(".pulso-ct-fila"));
const filaDe = (texto: string) => {
  const fila = filas().find((f) => f.querySelector(".pulso-ct-texto")?.textContent === texto);
  if (!fila) throw new Error(`sin fila "${texto}"`);
  return fila;
};
const filaActiva = () => host.querySelector<HTMLElement>(".pulso-ct-fila[data-activa]");
const textoActivo = () => filaActiva()?.querySelector(".pulso-ct-texto")?.textContent;
const campo = () => {
  const input = host.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (!input) throw new Error("sin campo");
  return input;
};
const lista = () => document.body.querySelector<HTMLElement>('[role="listbox"]');
const opciones = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).map((o) => o.textContent ?? "");
const codigosDe = (texto: string) => Array.from(filaDe(texto).querySelectorAll(".pulso-ct-insignia .pulso-ct-rotulo")).map((r) => r.getAttribute("title"));
const gruposDe = (clave: string) => espia.grupos.filter((g) => g.respuestas.includes(clave)).map((g) => g.id);

function escribir(valor: string) {
  const input = campo();
  const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    fijar?.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function tecla(key: string, extra: KeyboardEventInit = {}) {
  const evento = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
  act(() => {
    campo().dispatchEvent(evento);
  });
  return evento;
}

describe("TablaCodificar: lo que pinta", () => {
  test("una fila por texto distinto, con Respuesta, Veces y Código", () => {
    montar(false);
    const tabla = host.querySelector('[role="table"]');
    expect(tabla?.getAttribute("aria-label")).toBe("Respuestas de p21 y sus códigos");
    expect(Array.from(host.querySelectorAll('[role="columnheader"]')).map((c) => c.textContent)).toEqual(["Respuesta", "Veces", "Código"]);
    expect(filas()).toHaveLength(4);
    const colas = filaDe("Menos colas en ventanilla");
    expect(colas.querySelector(".pulso-ct-c-veces")?.textContent).toBe("3");
    expect(colas.querySelector(".pulso-ct-variantes")?.textContent).toBe("3 variantes");
    expect(filaDe("Que amplíen el horario").querySelector(".pulso-ct-variantes")).toBeNull();
  });

  test("un código asignado es una insignia con número, nombre y su botón de quitar; sin código lo dice", () => {
    montar(false);
    expect(codigosDe("Que atiendan más rápido")).toEqual(["1. Trato del personal"]);
    const insignia = filaDe("Que atiendan más rápido").querySelector(".pulso-ct-insignia");
    expect(insignia?.querySelector(".pulso-ct-numero")?.textContent).toBe("1");
    expect(insignia?.querySelector(".pulso-ct-nombre")?.textContent).toBe("Trato del personal");
    expect(insignia?.querySelector("button")?.getAttribute("aria-label")).toBe('Quitar el código 1. Trato del personal de "Que atiendan más rápido"');
    expect(filaDe("Que amplíen el horario").querySelector(".pulso-ct-vacia")?.textContent).toBe("Sin código");
  });

  test("la fila activa de entrada es la primera sin código y solo ella lleva el campo", () => {
    montar(false);
    expect(textoActivo()).toBe("Menos colas en ventanilla");
    expect(host.querySelectorAll('input[role="combobox"]')).toHaveLength(1);
    expect(campo().getAttribute("aria-label")).toBe('Código de "Menos colas en ventanilla"');
    expect(campo().getAttribute("aria-expanded")).toBe("false");
    expect(lista()).toBeNull();
    // Montar la tabla no se lleva el foco.
    expect(document.activeElement).not.toBe(campo());
  });

  test("el orden se elige en la cabecera: por veces de entrada, alfabético al pulsar Respuesta", () => {
    montar(false);
    const cabecera = (rotulo: string) => {
      const celda = Array.from(host.querySelectorAll<HTMLElement>('[role="columnheader"]')).find((c) => c.textContent === rotulo);
      if (!celda) throw new Error(`sin cabecera "${rotulo}"`);
      return celda;
    };
    const orden = () => filas().map((f) => f.querySelector(".pulso-ct-texto")?.textContent);
    expect(cabecera("Veces").getAttribute("aria-sort")).toBe("descending");
    expect(cabecera("Respuesta").getAttribute("aria-sort")).toBeNull();
    expect(orden()[0]).toBe("Que atiendan más rápido");
    act(() => cabecera("Respuesta").querySelector("button")?.click());
    expect(cabecera("Respuesta").getAttribute("aria-sort")).toBe("ascending");
    expect(cabecera("Veces").getAttribute("aria-sort")).toBeNull();
    expect(orden()).toEqual(["Atención los sábados", "Menos colas en ventanilla", "Que amplíen el horario", "Que atiendan más rápido"]);
    // El orden queda en el store de la vista: sigue al cambiar de pregunta.
    expect(useVistaCodificar.getState().orden).toBe("alfabetico");
    act(() => cabecera("Veces").querySelector("button")?.click());
    expect(orden()[0]).toBe("Que atiendan más rápido");
  });

  test("la ayuda de teclas ofrece Mayús y Enter solo si la pregunta admite varios códigos", () => {
    montar(false);
    expect(host.querySelector(".pulso-ct-teclas")?.textContent).not.toContain("Mayús");
    act(() => root.render(<Mesa permiteVarios respuestas={RESPUESTAS} espia={espia} />));
    expect(host.querySelector(".pulso-ct-teclas")?.textContent).toContain("Mayús");
    expect(campo().getAttribute("aria-describedby")).toBe(host.querySelector(".pulso-ct-teclas")?.id);
  });
});

describe("TablaCodificar: escribir y asignar", () => {
  test("al escribir, la lista se filtra y el campo anuncia la opción resaltada", () => {
    montar(false);
    escribir("ti");
    expect(campo().getAttribute("aria-expanded")).toBe("true");
    expect(campo().getAttribute("aria-controls")).toBe(lista()?.id);
    expect(opciones()).toEqual(["2Tiempos de espera0 casos", 'Crear el código "Ti"']);
    const resaltada = document.body.querySelector('[role="option"][aria-selected="true"]');
    expect(resaltada?.textContent).toContain("Tiempos de espera");
    expect(campo().getAttribute("aria-activedescendant")).toBe(resaltada?.id);
  });

  test("Enter asigna el código resaltado y pasa a la siguiente fila sin código, con el foco en su campo", () => {
    montar(false);
    escribir("2");
    const evento = tecla("Enter");
    expect(evento.defaultPrevented).toBe(true);
    expect(espia.asignar).toHaveBeenCalledWith("menos colas en ventanilla", "g2");
    expect(codigosDe("Menos colas en ventanilla")).toEqual(["2. Tiempos de espera"]);
    expect(textoActivo()).toBe("Que amplíen el horario");
    expect(campo().value).toBe("");
    expect(lista()).toBeNull();
    expect(document.activeElement).toBe(campo());
  });

  test("sin varios códigos, Mayús y Enter no asigna nada ni cambia de fila", () => {
    montar(false);
    escribir("2");
    const evento = tecla("Enter", { shiftKey: true });
    expect(evento.defaultPrevented).toBe(false);
    expect(espia.asignar).not.toHaveBeenCalled();
    expect(gruposDe("menos colas en ventanilla")).toEqual([]);
    expect(textoActivo()).toBe("Menos colas en ventanilla");
    expect(lista()).not.toBeNull();
  });

  test("sin varios códigos, un segundo código reemplaza al primero", () => {
    montar(false);
    escribir("2");
    tecla("Enter");
    act(() => filaDe("Menos colas en ventanilla").click());
    expect(campo().getAttribute("placeholder")).toBe("Cambiar el código");
    escribir("3");
    tecla("Enter");
    expect(gruposDe("menos colas en ventanilla")).toEqual(["g3"]);
    expect(codigosDe("Menos colas en ventanilla")).toEqual(["3. Horarios de atención"]);
  });

  test("con varios códigos, Mayús y Enter suma el código y se queda en la fila para el siguiente", () => {
    montar(true);
    escribir("2");
    tecla("Enter", { shiftKey: true });
    expect(textoActivo()).toBe("Menos colas en ventanilla");
    expect(campo().value).toBe("");
    expect(campo().getAttribute("placeholder")).toBe("Sumar otro código");
    escribir("3");
    tecla("Enter", { shiftKey: true });
    expect(gruposDe("menos colas en ventanilla")).toEqual(["g2", "g3"]);
    expect(codigosDe("Menos colas en ventanilla")).toEqual(["2. Tiempos de espera", "3. Horarios de atención"]);
    // El código que la fila ya tiene deja de ofrecerse.
    escribir("t");
    expect(opciones().some((o) => o.includes("Tiempos de espera"))).toBe(false);
  });

  test("las flechas recorren las opciones con la lista abierta", () => {
    montar(false);
    escribir("t");
    const primera = campo().getAttribute("aria-activedescendant");
    tecla("ArrowDown");
    const segunda = campo().getAttribute("aria-activedescendant");
    expect(segunda).not.toBe(primera);
    expect(document.getElementById(segunda ?? "")?.getAttribute("aria-selected")).toBe("true");
    expect(textoActivo()).toBe("Menos colas en ventanilla");
    tecla("Enter");
    // "t" casa con Trato (1) y Tiempos (2) por inicio de nombre; la segunda opción es Tiempos de espera.
    expect(gruposDe("menos colas en ventanilla")).toEqual(["g2"]);
  });

  test("Escape cierra la lista y entonces las flechas cambian de fila", () => {
    montar(false);
    escribir("ti");
    tecla("Escape");
    expect(lista()).toBeNull();
    expect(campo().getAttribute("aria-expanded")).toBe("false");
    expect(campo().value).toBe("ti");
    tecla("ArrowDown");
    expect(textoActivo()).toBe("Que amplíen el horario");
    expect(campo().value).toBe("");
    tecla("ArrowUp");
    tecla("ArrowUp");
    expect(textoActivo()).toBe("Que atiendan más rápido");
    // En la primera fila no hay más arriba.
    tecla("ArrowUp");
    expect(textoActivo()).toBe("Que atiendan más rápido");
    expect(espia.asignar).not.toHaveBeenCalled();
  });

  test("lo que no casa con ningún código lo dice, y Enter no asigna ni baja", () => {
    montar(false);
    escribir("9");
    expect(lista()).toBeNull();
    expect(document.body.querySelector(".pulso-ct-sin-codigos")?.textContent).toBe('Ningún código coincide con "9"');
    expect(campo().getAttribute("aria-controls")).toBeNull();
    tecla("Enter");
    expect(espia.asignar).not.toHaveBeenCalled();
    expect(textoActivo()).toBe("Menos colas en ventanilla");
  });

  test('"Crear el código" pide un código nuevo con el nombre escrito', () => {
    montar(false);
    escribir("limpieza");
    expect(opciones()).toEqual(['Crear el código "Limpieza"']);
    tecla("Enter");
    expect(espia.crear).toHaveBeenCalledWith("menos colas en ventanilla", "Limpieza");
    expect(codigosDe("Menos colas en ventanilla")).toEqual(["4. Limpieza"]);
  });

  test("elegir una opción con el ratón asigna igual que Enter", () => {
    montar(false);
    escribir("3");
    const opcion = document.body.querySelector<HTMLElement>('[role="option"]');
    act(() => opcion?.click());
    expect(gruposDe("menos colas en ventanilla")).toEqual(["g3"]);
    expect(textoActivo()).toBe("Que amplíen el horario");
  });
});

describe("TablaCodificar: quitar y buscar", () => {
  test("el botón de la insignia quita ese código sin cambiar la fila activa", () => {
    montar(false);
    const quitar = filaDe("Que atiendan más rápido").querySelector<HTMLButtonElement>(".pulso-ct-insignia button");
    act(() => quitar?.click());
    expect(espia.quitar).toHaveBeenCalledWith("que atiendan mas rapido", "g1");
    expect(codigosDe("Que atiendan más rápido")).toEqual([]);
    expect(filaDe("Que atiendan más rápido").querySelector(".pulso-ct-vacia")?.textContent).toBe("Sin código");
    expect(textoActivo()).toBe("Menos colas en ventanilla");
  });

  test("solo las insignias de la fila activa quedan en el orden de tabulación", () => {
    montar(false);
    const boton = () => filaDe("Que atiendan más rápido").querySelector<HTMLButtonElement>(".pulso-ct-insignia button");
    expect(boton()?.tabIndex).toBe(-1);
    act(() => filaDe("Que atiendan más rápido").click());
    expect(boton()?.tabIndex).toBe(0);
  });

  test("Retroceso con el campo vacío quita el último código de la fila", () => {
    montar(false);
    act(() => filaDe("Que atiendan más rápido").click());
    tecla("Backspace");
    expect(espia.quitar).toHaveBeenCalledWith("que atiendan mas rapido", "g1");
    expect(gruposDe("que atiendan mas rapido")).toEqual([]);
  });

  test("una búsqueda sin resultados deja el vacío dentro del marco de la tabla", () => {
    montar(false);
    const buscador = host.querySelector<HTMLInputElement>('input[type="search"]');
    const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    act(() => {
      fijar?.call(buscador, "zzz");
      buscador?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector('[role="table"]')).toBeNull();
    expect(host.querySelector(".pulso-ct-marco .pulso-estado-vacio")?.textContent).toContain("No hay respuestas que coincidan");
  });

  test("lo escrito en una fila no pasa a otra cuando la búsqueda la saca de la vista", () => {
    montar(false);
    escribir("ti");
    const buscador = host.querySelector<HTMLInputElement>('input[type="search"]');
    const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    act(() => {
      fijar?.call(buscador, "horario");
      buscador?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(textoActivo()).toBe("Que amplíen el horario");
    expect(campo().value).toBe("");
    expect(lista()).toBeNull();
  });
});

describe("TablaCodificar: muchas filas", () => {
  // happy-dom no calcula el layout: todo mide 0. Con el marco en 0 la lista virtual no pinta filas, y con
  // las filas en 0 cabrían las 300. Se les da el alto de un marco y de una fila reales.
  const original = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "offsetHeight");
  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains("pulso-ct-marco")) return 600;
        return this.classList.contains("pulso-ct-fila") ? 45 : 0;
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", original);
  });

  test("con más de 80 filas solo se pintan las visibles y la tabla declara el total", () => {
    const muchas = Array.from({ length: 300 }, (_, i) => respuesta(`Respuesta ${String(i).padStart(3, "0")}`, 300 - i));
    montar(false, muchas);
    expect(host.querySelector('[role="table"]')?.getAttribute("aria-rowcount")).toBe("301");
    expect(filas().length).toBeGreaterThan(0);
    expect(filas().length).toBeLessThan(80);
    expect(filas()[0].getAttribute("aria-rowindex")).toBe("2");
    // La fila activa (la primera sin código) está entre las pintadas y se puede escribir en ella.
    expect(textoActivo()).toBe("Respuesta 000");
    escribir("2");
    tecla("Enter");
    expect(espia.asignar).toHaveBeenCalledWith("respuesta 000", "g2");
    expect(textoActivo()).toBe("Respuesta 001");
  });

  test("con 80 filas o menos se pintan todas", () => {
    const justas = Array.from({ length: 80 }, (_, i) => respuesta(`Respuesta ${String(i).padStart(3, "0")}`, 80 - i));
    montar(false, justas);
    expect(filas()).toHaveLength(80);
  });
});
