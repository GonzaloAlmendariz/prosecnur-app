// @vitest-environment happy-dom
/**
 * La vista de tarjetas de Codificar montada entera (`RespuestasCodificador`) con el guardado simulado:
 * soltar respuestas en un código, el número de un código con varias elegidas, deshacer, el marco que
 * declara su geometría y la marca de readiness. El arrastre se maneja desde los avisos de `DndContext`
 * (inicio y suelta), que son los que la pantalla escucha; en happy-dom no hay geometría para que el
 * sensor de puntero calcule el choque.
 */
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DndContext as DndContextReal, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Grupo, RespuestasResponse } from "../../../api/codificacion";
import { useVistaCodificar } from "../tabla/vistaCodificarStore";
import { useFiltroRespuestas } from "./filtroRespuestasStore";
import type { MarcoDeCodificar } from "./marcoDeCodificar";

const api = vi.hoisted(() => ({ respuestas: vi.fn(), grupos: vi.fn(), sugerencias: vi.fn() }));
vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiCodifRespuestas: api.respuestas,
  apiCodifGrupos: api.grupos,
}));
vi.mock("../../../api/codificacion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/codificacion")>()),
  apiCodifSugerenciasSeccion: api.sugerencias,
}));

type PropsDnd = ComponentProps<typeof DndContextReal>;
const dnd = vi.hoisted(() => ({
  props: null as null | { onDragStart?: (e: never) => void; onDragEnd?: (e: never) => void },
  capa: null as null | { style?: Record<string, unknown> },
}));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@dnd-kit/core")>();
  function DndContext(props: PropsDnd) {
    dnd.props = props as typeof dnd.props;
    return <real.DndContext {...props} />;
  }
  function DragOverlay(props: ComponentProps<typeof real.DragOverlay>) {
    dnd.capa = props as typeof dnd.capa;
    return <real.DragOverlay {...props} />;
  }
  return { ...real, DndContext, DragOverlay };
});

const { RespuestasCodificador } = await import("../RespuestasCodificador");

/** El marco de la pestaña reducido a lo que la mesa le pasa: sus cifras, sus acciones y sus columnas. */
const marco: MarcoDeCodificar = ({ cifras = [], acciones, columnas }) => (
  <div>
    <dl className="prueba-cifras">
      {cifras.map((c) => (
        <div key={c.clave}>{`${c.valor}${c.base ? ` de ${c.base}` : ""} ${c.rotulo}`}</div>
      ))}
    </dl>
    <div className="prueba-acciones">{acciones}</div>
    {columnas}
  </div>
);

function Mesa() {
  return <RespuestasCodificador parent="p3" marco={marco} cabeceraDePregunta={() => <header className="prueba-pregunta">p3</header>} />;
}

const RESPUESTAS = ["menos colas", "mejor trato", "mas sillas", "horario corto"];

function carga(tipo: string, otros: RespuestasResponse["sm_otros"], grupos: Grupo[] = []): RespuestasResponse {
  return {
    ok: true,
    parent: "p3",
    col_efectiva: "p3_otro",
    tipo,
    modo_so: "",
    respuestas: RESPUESTAS.map((clave, i) => ({ texto_normalizado: clave, texto: clave, variantes: i === 0 ? 2 : 1, frecuencia: 4 - i, uuids: [`c${i}`] })),
    grupos,
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
  // Estas pruebas miran todas las respuestas; el filtro de entrada ("Por codificar") tiene la suya.
  useFiltroRespuestas.setState({ filtro: "todas" });
  api.respuestas.mockReset();
  api.grupos.mockReset().mockResolvedValue({ ok: true });
  api.sugerencias.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const SM_CON_OTROS = { dummy_col: "p3/96", n_otros_marcados: 12 };

async function montar(tipo: string, otros: RespuestasResponse["sm_otros"] = null, grupos: Grupo[] = []) {
  api.respuestas.mockResolvedValue(carga(tipo, otros, grupos));
  await act(async () => {
    root.render(<MemoryRouter><Mesa /></MemoryRouter>);
  });
}

/** Los grupos que se mandaron a guardar la última vez, como código → respuestas. */
async function guardado(): Promise<Record<string, string[]>> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  const llamadas = api.grupos.mock.calls;
  const grupos = llamadas[llamadas.length - 1]?.[1] as Grupo[] | undefined;
  return Object.fromEntries((grupos ?? []).map((g) => [g.codigo, g.respuestas]));
}

const boton = (clave: string) => {
  const b = host.querySelector<HTMLButtonElement>(`[data-fila-respuesta="${clave}"]`);
  if (!b) throw new Error(`sin la fila "${clave}"`);
  return b;
};
function clic(clave: string, extra: MouseEventInit = {}) {
  act(() => {
    boton(clave).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...extra }));
  });
}
function teclaEnLista(key: string, code = "", extra: KeyboardEventInit = {}) {
  act(() => {
    boton(RESPUESTAS[0]).dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...extra }));
  });
}
function deshacer() {
  // Fuera de macOS (happy-dom no lo es) el modificador es Ctrl.
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
  });
}
function soltar(levantada: string, zona: string | null) {
  const activo = { id: `respuesta:${levantada}` };
  const inicio: Pick<DragStartEvent, "active"> = { active: activo as DragStartEvent["active"] };
  const fin: Pick<DragEndEvent, "active" | "over"> = { active: activo as DragEndEvent["active"], over: zona ? ({ id: zona } as DragEndEvent["over"]) : null };
  act(() => dnd.props?.onDragStart?.(inicio as never));
  act(() => dnd.props?.onDragEnd?.(fin as never));
}

describe("Codificar en tarjetas: soltar respuestas en un código", () => {
  test("en una pregunta que admite un solo código, soltar mueve la respuesta y no la suma", async () => {
    await montar("select_one");
    soltar("menos colas", "codigo:ex_1");
    soltar("menos colas", "codigo:ex_2");
    expect(await guardado()).toEqual({ "1": [], "2": ["menos colas"] });
  });

  test("en una múltiple con Otros, soltar suma el código a los que ya tenía", async () => {
    await montar("select_multiple", SM_CON_OTROS);
    soltar("menos colas", "codigo:ex_1");
    soltar("menos colas", "codigo:ex_2");
    expect(await guardado()).toEqual({ "1": ["menos colas"], "2": ["menos colas"] });
  });

  test("arrastrar una respuesta elegida lleva a todas las elegidas", async () => {
    await montar("select_one");
    clic("menos colas");
    clic("mas sillas", { shiftKey: true });
    soltar("mejor trato", "codigo:ex_2");
    expect(await guardado()).toEqual({ "1": [], "2": ["menos colas", "mejor trato", "mas sillas"] });
  });

  test("soltar en la tarjeta punteada pide el nombre ahí y crea el código con la respuesta", async () => {
    await montar("select_one");
    soltar("horario corto", "codigo-nuevo");
    const campo = host.querySelector<HTMLInputElement>('input[aria-label="Nombre del código 3"]');
    expect(campo).not.toBeNull();
    const fijar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    act(() => {
      fijar?.call(campo, "Horarios");
      campo?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      campo?.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(await guardado()).toEqual({ "1": [], "2": [], "3": ["horario corto"] });
  });

  test("soltar fuera de un código no cambia nada", async () => {
    await montar("select_one");
    soltar("menos colas", null);
    await guardado();
    expect(api.grupos).not.toHaveBeenCalled();
  });
});

describe("Codificar en tarjetas: teclado y deshacer", () => {
  test("el número de un código asigna a todas las elegidas", async () => {
    await montar("select_one");
    clic("menos colas");
    clic("mejor trato", { shiftKey: true });
    clic("horario corto", { ctrlKey: true });
    teclaEnLista("2", "Digit2");
    expect(await guardado()).toEqual({ "1": [], "2": ["menos colas", "mejor trato", "horario corto"] });
  });

  test("Supr quita el código de las elegidas", async () => {
    await montar("select_one", null, [{ id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["menos colas", "mejor trato"], origen: "existente" }]);
    clic("menos colas");
    teclaEnLista("Delete");
    expect(await guardado()).toEqual({ "1": ["mejor trato"], "2": [] });
  });

  test("deshacer restaura el estado exacto, paso a paso, y lo guarda", async () => {
    await montar("select_multiple", SM_CON_OTROS, [{ id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["mas sillas"], origen: "existente" }]);
    clic("menos colas");
    teclaEnLista("2", "Digit2");
    soltar("mas sillas", "codigo:ex_2");
    expect(await guardado()).toEqual({ "1": ["mas sillas"], "2": ["menos colas", "mas sillas"] });
    deshacer();
    expect(await guardado()).toEqual({ "1": ["mas sillas"], "2": ["menos colas"] });
    deshacer();
    expect(await guardado()).toEqual({ "1": ["mas sillas"], "2": [] });
  });

  test("con la opción Otros, el contador de casos va sobre los que la marcaron", async () => {
    await montar("select_multiple", SM_CON_OTROS, [{ id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["menos colas"], origen: "existente" }]);
    // La barra dibuja las respuestas con código: su cifra va debajo, con su base, junto a la de textos distintos.
    // Una definición en toda la sección: "respuestas" son casos (4 de 10) y "textos distintos" las únicas.
    expect(host.querySelector(".prueba-cifras")?.textContent).toContain("4 de 10 respuestas con código");
    const cifras = host.querySelector(".pulso-cc-cifras")?.textContent ?? "";
    expect(cifras).toContain("4 de 10 respuestas con código");
    expect(cifras).toContain("1 de 4 textos distintos con código");
    expect(cifras).toContain('12 marcaron "Otro"');
  });
});

describe("Codificar en tarjetas: contrato con el QA", () => {
  test("declara la geometría de la lista y de los códigos y marca su readiness", async () => {
    await montar("select_one");
    const raiz = host.querySelector("[data-audit-ready]");
    expect(raiz?.getAttribute("data-audit-ready")).toBe("codificacion-codificar");
    const lista = host.querySelector('[data-qa-geometry-group="codificacion/respuestas"]');
    expect(lista?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    expect(lista?.getAttribute("data-qa-geometry-capacity")).toBe("owned");
    expect(lista?.querySelectorAll("[data-qa-geometry-member]")).toHaveLength(RESPUESTAS.length);
    const codigos = host.querySelector('[data-qa-geometry-group="codificacion/grupos"]');
    expect(codigos?.getAttribute("data-qa-geometry-capacity")).toBe("owned");
    // Dos códigos del formulario y la tarjeta donde se crea uno.
    expect(codigos?.querySelectorAll("li[data-qa-geometry-member]")).toHaveLength(3);
  });

  test("una sola parada de tabulador para la lista", async () => {
    await montar("select_one");
    const tabulables = Array.from(host.querySelectorAll<HTMLElement>("[data-fila-respuesta]")).filter((b) => b.tabIndex === 0);
    expect(tabulables).toHaveLength(1);
  });
});

describe("el contador y la fila que no decía su estado", () => {
  test("en la tabla, la única respuesta sin código es la fila activa y dice Sin código", async () => {
    useVistaCodificar.setState({ vista: "tabla" });
    await montar("select_one", null, [
      { id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["mejor trato", "mas sillas"], origen: "existente" },
      { id: "ex_2", codigo: "2", etiqueta: "Espera", respuestas: ["horario corto"], origen: "existente" },
    ]);
    expect(host.querySelector(".prueba-cifras")?.textContent).toContain("6 de 10 respuestas con código");
    const activa = host.querySelector(".pulso-ct-fila[data-activa]");
    expect(activa?.textContent).toContain("menos colas");
    expect(activa?.querySelector(".pulso-ct-vacia")?.textContent).toBe("Sin código");
  });
});

describe("Codificar en tarjetas: la fila de una respuesta", () => {
  test("la propuesta de módulo va en un segundo renglón bajo el texto, sin quitarle ancho; sin propuesta no hay rótulo", async () => {
    const propuesta = { codigo: "m1", seccion: "s1", etiqueta: "Antes de completar", puntaje: 0.6, palabras: ["colas", "menos"] };
    api.sugerencias.mockResolvedValue({
      variable: "p3_otro",
      base: "",
      requiereConfirmacion: true,
      modulos: [{ codigo: "m1", seccion: "s1", etiqueta: "Antes de completar", nTerminos: 2 }],
      otro: { codigo: "80", etiqueta: "Otro" },
      respuestas: [
        { idCaso: "c0", fila: 1, texto: "menos colas", noRespuesta: false, candidatoOtro: false, propuestas: [propuesta] },
        { idCaso: "c1", fila: 2, texto: "mejor trato", noRespuesta: false, candidatoOtro: true, propuestas: [] },
      ],
      resumen: { escribieron: 4, conContenido: 4, conPropuesta: 1, candidatosOtro: 1, porModulo: { m1: 1 } },
    });
    await montar("text");
    const fila = (clave: string) => boton(clave).closest("li");
    // El botón de la fila lleva solo el texto: ni las variantes ni la propuesta le comparten renglón.
    expect(boton("menos colas").textContent).toBe("menos colas");
    expect(fila("menos colas")?.querySelector(":scope > .pulso-cc-fila-variantes")?.textContent).toBe("2 variantes");
    const sugerencia = fila("menos colas")?.querySelector(":scope > .pulso-cc-fila-sugerencia") ?? null;
    expect(sugerencia).not.toBeNull();
    expect(sugerencia?.querySelector('button[aria-label="Confirmar Antes de completar para esta respuesta"]') ?? null).not.toBeNull();
    // El renglón del texto no la lleva: la celda de los códigos queda para los códigos.
    expect(fila("menos colas")?.querySelector(".pulso-cc-fila-codigos")).toBeNull();
    expect(fila("mejor trato")?.querySelector(".pulso-cc-fila-sugerencia")).toBeNull();
    expect(host.textContent).not.toContain("Sin módulo claro");
  });
});

describe("Codificar en tarjetas: tarjetas de código", () => {
  test("una tarjeta sin respuestas: tesela con el número, nombre, casos, barra en cero y su tecla; sin chip de origen", async () => {
    await montar("select_one");
    const tarjeta = host.querySelector<HTMLElement>('article[aria-label^="Código 1. Trato del personal"]');
    expect(tarjeta).not.toBeNull();
    const cab = tarjeta?.querySelector(".pulso-cc-codigo-cab");
    expect(cab?.querySelector(".pulso-cc-codigo-ficha")?.getAttribute("title")).toBe("Categoría que ya trae la pregunta");
    expect(cab?.querySelector(".pulso-cc-codigo-casos")?.textContent).toBe("0");
    expect(cab?.textContent).not.toContain("Existente");
    expect(tarjeta?.querySelector(".pulso-cc-codigo-tecla")?.textContent).toBe("1");
    // Sin respuestas no hay "Respuestas" ni "Parecidas": solo el orden.
    expect(Array.from(tarjeta?.querySelectorAll(".pulso-cc-codigo-pie button") ?? []).map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Subir el código 1. Trato del personal",
      "Bajar el código 1. Trato del personal",
    ]);
  });

  test("con respuestas, la barra mide los casos del código sobre los casos con texto de la pregunta y los ejemplos van debajo", async () => {
    // Casos con texto: 4 + 3 + 2 + 1 = 10. El código 2 lleva "mejor trato" (3) y "horario corto" (1).
    await montar("select_one", null, [{ id: "ex_2", codigo: "2", etiqueta: "Espera", respuestas: ["mejor trato", "horario corto"], origen: "existente" }]);
    const tarjeta = host.querySelector<HTMLElement>('article[aria-label^="Código 2. Tiempos de espera"]');
    expect(tarjeta?.style.getPropertyValue("--cc-proporcion")).toBe("0.4");
    expect(tarjeta?.getAttribute("aria-label")).toBe("Código 2. Tiempos de espera, 4 casos, 2 respuestas");
    expect(tarjeta?.querySelector(".pulso-cc-codigo-casos")?.textContent).toBe("4");
    expect(tarjeta?.querySelector(".pulso-cc-codigo-ejemplos")?.textContent).toBe("mejor trato, horario corto");
  });

  test("sin códigos, la columna tiene una sola tarjeta punteada, que es el vacío y el destino", async () => {
    api.respuestas.mockResolvedValue({ ...carga("text", null), opciones_existentes: [] });
    api.sugerencias.mockRejectedValue(new Error("sin módulos"));
    await act(async () => {
      root.render(<MemoryRouter><Mesa /></MemoryRouter>);
    });
    const panel = host.querySelector('[role="region"][aria-label="Códigos"]');
    expect(panel?.querySelector(".pulso-estado-vacio")).toBeNull();
    expect(panel?.querySelectorAll(".pulso-cc-nuevo")).toHaveLength(1);
    expect(panel?.querySelector(".pulso-cc-nuevo")?.textContent).toContain("Nuevo código");
    expect(panel?.querySelector(".pulso-cc-nuevo-apoyo")).not.toBeNull();
  });

  test("al arrastrar, la tarjeta dice con su base cuántos casos ya tenían marcada la opción", async () => {
    api.respuestas.mockResolvedValue({
      ...carga("select_multiple", SM_CON_OTROS),
      respuestas: carga("select_multiple", SM_CON_OTROS).respuestas.map((r) =>
        r.texto_normalizado === "menos colas" ? { ...r, ya_marcadas: [{ codigo: "1", n: 3 }] } : r,
      ),
    });
    await act(async () => {
      root.render(<MemoryRouter><Mesa /></MemoryRouter>);
    });
    const activo = { id: "respuesta:menos colas" };
    act(() => dnd.props?.onDragStart?.({ active: activo } as never));
    const tarjeta = host.querySelector('article[aria-label^="Código 1. Trato del personal"]');
    expect(tarjeta?.querySelector(".pulso-cc-codigo-marcada")?.textContent).toBe("3 de 4 casos ya tenían marcada esta opción");
  });
});

describe("Codificar en tarjetas: lo que cuenta la tarjeta de un código", () => {
  test("respuestas y casos cuentan solo los textos que la base trae hoy; los guardados que no trae se dicen aparte", async () => {
    await montar("select_one", null, [
      { id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["menos colas", "texto de una base anterior", "otro que ya no está"], origen: "existente" },
      { id: "g9", codigo: "9", etiqueta: "Trabajo", respuestas: ["trabajo", "en su trabajo"], origen: "nuevo" },
    ]);
    const uno = host.querySelector('article[aria-label^="Código 1. Trato del personal"]');
    expect(uno?.getAttribute("aria-label")).toBe("Código 1. Trato del personal, 4 casos, 1 respuesta");
    expect(uno?.querySelector(".pulso-cc-codigo-fuera")?.textContent).toBe("2 textos guardados no están en la base actual");
    // El caso de acnur_acg: un código con textos guardados que la base ya no trae nunca dice "N respuestas, 0 casos".
    const nueve = host.querySelector('article[aria-label^="Código 9. Trabajo"]');
    expect(nueve?.getAttribute("aria-label")).toBe("Código 9. Trabajo, 0 casos, 0 respuestas");
    expect(nueve?.querySelector(".pulso-cc-codigo-fuera")?.textContent).toBe("2 textos guardados no están en la base actual");
    // Las respuestas del código se ven al pedirlas; las que la base ya no trae se marcan.
    act(() => {
      Array.from(nueve?.querySelectorAll("button") ?? []).find((b) => b.textContent === "Respuestas")?.click();
    });
    expect(nueve?.parentElement?.querySelectorAll("li[data-fuera-de-la-base]")).toHaveLength(2);
  });

  test("con un solo texto guardado que la base no trae, la frase va en singular", async () => {
    await montar("select_one", null, [
      { id: "ex_1", codigo: "1", etiqueta: "Trato", respuestas: ["menos colas", "texto de una base anterior"], origen: "existente" },
    ]);
    const uno = host.querySelector('article[aria-label^="Código 1. Trato del personal"]');
    expect(uno?.querySelector(".pulso-cc-codigo-fuera")?.textContent).toBe("1 texto guardado no está en la base actual");
    act(() => {
      Array.from(uno?.querySelectorAll("button") ?? []).find((b) => b.textContent === "Respuestas")?.click();
    });
    expect(uno?.parentElement?.querySelectorAll("li[data-fuera-de-la-base]")).toHaveLength(1);
  });
});

describe("Codificar en tarjetas: el fantasma del arrastre", () => {
  test("la capa del fantasma mide lo que el fantasma, no lo que la fila arrastrada", async () => {
    await montar("select_one");
    expect(dnd.capa?.style).toMatchObject({ width: "max-content", height: "auto" });
  });
});

describe("Codificar: un código que guarda el texto tal cual (punto 0 de la pasada de fidelidad)", () => {
  test("cuenta como asignado a la respuesta con su misma forma normalizada, como en el motor", async () => {
    // Lo que guardó la matriz: el texto con mayúsculas y tildes. La lista llega con su clave normalizada.
    api.sugerencias.mockRejectedValue(new Error("sin módulos"));
    await montar("text", null, [{ id: "g1", codigo: "101", etiqueta: "Colas", respuestas: ["  Menos   Colas ", "Mejor TRATO"], origen: "nuevo" }]);
    expect(host.querySelector(".prueba-cifras")?.textContent).toContain("7 de 10 respuestas con código");
    const tarjeta = host.querySelector('article[aria-label^="Código 101"]');
    expect(tarjeta?.querySelector(".pulso-cc-codigo-fuera")).toBeNull();
    expect(tarjeta?.getAttribute("aria-label")).toBe("Código 101. Colas, 7 casos, 2 respuestas");
  });
});

describe("Codificar: sugerencias con un marcador del formulario sin reemplazar", () => {
  test("un módulo cuyo rótulo trae ${...} no se ofrece como código", async () => {
    const conMarcador = { codigo: "m2", seccion: "s2", etiqueta: "Recepción en Espacio de Protección de ${sede_ppl}", puntaje: 0.9, palabras: ["edp", "sede"] };
    api.sugerencias.mockResolvedValue({
      variable: "p3_otro",
      base: "",
      requiereConfirmacion: true,
      modulos: [{ codigo: "m2", seccion: "s2", etiqueta: conMarcador.etiqueta, nTerminos: 2 }],
      otro: { codigo: "80", etiqueta: "Otro" },
      respuestas: [{ idCaso: "c0", fila: 1, texto: "menos colas", noRespuesta: false, candidatoOtro: false, propuestas: [conMarcador] }],
      resumen: { escribieron: 4, conContenido: 4, conPropuesta: 1, candidatosOtro: 0, porModulo: { m2: 1 } },
    });
    await montar("text");
    expect(host.textContent).not.toContain("${");
    expect(host.querySelector(".pulso-cc-fila-sugerencia")).toBeNull();
  });
});
