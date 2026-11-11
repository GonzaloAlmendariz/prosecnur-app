// @vitest-environment happy-dom
/**
 * Codificación, Aplicar: los estados de la pantalla (ADR 0142, etapa P3d).
 *
 * El marco no cambia entre cargar, fallar y mostrar (C2): la misma sección y el mismo panel. La marca
 * de lista (`data-audit-ready`) solo aparece con el plan leído. El vacío tiene su texto propio y cada
 * cifra aparece una sola vez: los totales en la franja, lo de cada pregunta en su fila y el desglose
 * por código en el detalle de la pregunta elegida.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanAdaptacion, PlanPregunta } from "../../../api/dashboard";

const espia = vi.hoisted(() => ({ plan: vi.fn() }));

vi.mock("../../../lib/SessionContext", () => ({
  useSession: () => ({ sessionId: "sid-1", refresh: async () => {} }),
}));
vi.mock("../../../api/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/dashboard")>()),
  apiCodifPlanAdaptacion: espia.plan,
}));
vi.mock("../useBaseYaCodificada", () => ({ useBaseYaCodificada: () => false }));
// La prueba del resultado deja un job terminado en el store: su sondeo no sale a la red.
vi.mock("../../../hooks/useJob", () => ({ iniciarJobPoll: () => () => undefined }));

const { AdaptarPane } = await import("../AdaptarPane");
const { claveAplicar, useAplicarAvisosStore } = await import("../aplicarAvisosStore");

function pregunta(parcial: Partial<PlanPregunta> & Pick<PlanPregunta, "parent">): PlanPregunta {
  return {
    parent_label: "", tipo: "select_one", modo_so: "hijo", text_col: "", nueva_variable: `${parcial.parent}_recod`,
    n_grupos: 0, n_codigos_nuevos: 0, n_codigos_reutilizados: 0, n_respuestas_afectadas: 0,
    codigos_nuevos: [], codigos_reutilizados: [], bridge_soportado: true, ...parcial,
  };
}

function plan(preguntas: PlanPregunta[], respuestas_cambiaron = false): PlanAdaptacion {
  // Los totales del motor incluyen las preguntas que quedan fuera: la pantalla no los usa.
  return { ok: true, preguntas, totales: { n_preguntas: 99, n_variables_nuevas: 99, n_codigos_nuevos: 99, n_codigos_reutilizados: 99 }, respuestas_cambiaron };
}

const P9 = pregunta({
  parent: "p9", parent_label: "Ocupación principal", tipo: "text", modo_so: "", n_codigos_nuevos: 2, n_codigos_reutilizados: 1, n_respuestas_afectadas: 52,
  codigos_nuevos: [{ codigo: "08", etiqueta: "Educación superior", n_respuestas: 24 }, { codigo: "12", etiqueta: "Minería", n_respuestas: 19 }],
  codigos_reutilizados: [{ codigo: "96", etiqueta: "Otro", n_respuestas: 9 }],
});
const P3 = pregunta({
  parent: "p3", parent_label: "Otra carrera", tipo: "select_multiple", modo_so: "", nueva_variable: "p3/*_recod", n_codigos_nuevos: 4, n_codigos_reutilizados: 0, n_respuestas_afectadas: 21,
  codigos_nuevos: [
    { codigo: "21", etiqueta: "Diseño", n_respuestas: 14 }, { codigo: "22", etiqueta: "Música", n_respuestas: 7 },
    { codigo: "23", etiqueta: "", n_respuestas: 0 }, { codigo: "24", etiqueta: "Gastronomía", n_respuestas: undefined as unknown as number },
  ],
});
const P66 = pregunta({ parent: "p66", parent_label: "Otro motivo", bridge_soportado: false, n_grupos: 3, n_codigos_nuevos: 50, motivo_codigo: "sin_columna_texto", motivo_omision: 'La columna de texto "p66_otro" no está en la base.' });
const PLAN = plan([P9, P3, P66]);

let host: HTMLDivElement;
let root: Root;
const irACodificar = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.plan.mockReset();
  irACodificar.mockReset();
  useAplicarAvisosStore.getState().reset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

async function montar() {
  await act(async () => {
    root.render(<AdaptarPane base="egresados" onBackToCodificar={irACodificar} onBackToMatrices={() => undefined} />);
  });
}

const boton = (rotulo: string) =>
  Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === rotulo) ?? null;
const veces = (fragmento: string) => (host.textContent ?? "").split(fragmento).length - 1;
const lista = () => host.querySelector('[data-qa-geometry-group="codificacion/aplicar-preguntas"]');
const filas = () => Array.from(lista()?.querySelectorAll<HTMLLIElement>(':scope > li[role="option"]') ?? []);
const elegidas = () => filas().filter((f) => f.getAttribute("aria-selected") === "true").map((f) => f.querySelector(".pulso-ficha-pregunta-codigo")?.textContent);
const panelDePreguntas = () => host.querySelector<HTMLElement>("section.pulso-aplicar-panel--preguntas");
const detalle = () => host.querySelector<HTMLElement>("section.pulso-aplicar-panel--detalle");
const filasDeCodigos = () =>
  Array.from(detalle()?.querySelectorAll<HTMLElement>('[data-qa-geometry-group="codificacion/aplicar-codigos"] > [role="row"]') ?? []);
/** Las celdas de cada fila de la tabla de códigos, en el orden de sus columnas. */
const codigos = () => filasDeCodigos().map((fila) => Array.from(fila.querySelectorAll(':scope > [role="cell"]')).map((c) => c.textContent));
const barras = () => filasDeCodigos().map((fila) => (fila.querySelector<HTMLElement>(".pulso-aplicar-barra > span")?.style.getPropertyValue("--pulso-aplicar-proporcion") ?? null));
const marcoIgual = () => {
  const seccion = host.querySelector("section.pulso-codificacion-adaptar.pulso-aplicar");
  expect(seccion, "la sección de la pantalla").not.toBeNull();
  expect(seccion?.querySelector(":scope > .pulso-aplicar-mesa > section.pulso-panel.pulso-aplicar-panel--preguntas h3")?.textContent).toBe("Preguntas por aplicar");
  return seccion as HTMLElement;
};

describe("AdaptarPane: cargando el plan", () => {
  it("muestra el panel con su carga y todavía no se declara lista", async () => {
    espia.plan.mockImplementation(() => new Promise(() => undefined));
    await montar();
    const seccion = marcoIgual();
    expect(seccion.hasAttribute("data-audit-ready")).toBe(false);
    expect(host.querySelector('.pulso-loading-block[role="status"]')?.textContent).toContain("Cargando las preguntas por aplicar");
    expect(host.querySelector(".pulso-franja-recorrido")).toBeNull();
    expect(detalle()).toBeNull();
    expect(boton("Aplicar a la base")).toBeNull();
  });
});

describe("AdaptarPane: error al leer el plan", () => {
  it('dice qué pasó, la causa y qué no cambió, y "Reintentar" vuelve a leer', async () => {
    espia.plan.mockRejectedValueOnce(new Error("El motor no respondió a tiempo. E_TIMEOUT"));
    await montar();
    const seccion = marcoIgual();
    expect(seccion.hasAttribute("data-audit-ready")).toBe(false);
    const alerta = host.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain("No se pudieron leer las preguntas por aplicar");
    expect(alerta?.textContent).toContain("El motor no respondió a tiempo.");
    expect(alerta?.textContent).toContain("La base y la codificación siguen como estaban.");
    expect(boton("Aplicar a la base")).toBeNull();

    espia.plan.mockResolvedValueOnce(PLAN);
    await act(async () => { boton("Reintentar")?.click(); });
    expect(espia.plan).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(filas()).toHaveLength(2);
  });
});

describe("AdaptarPane: sin nada que aplicar", () => {
  it("el vacío tiene su texto; no hay franja, cifras en cero ni panel de detalle, y las salidas siguen en el pie", async () => {
    espia.plan.mockResolvedValueOnce(plan([]));
    await montar();
    const seccion = marcoIgual();
    expect(seccion.getAttribute("data-audit-ready")).toBe("codificacion-adaptar");
    const vacio = host.querySelector(".pulso-estado-vacio");
    expect(vacio?.textContent).toContain("Ninguna pregunta tiene códigos por aplicar");
    expect(vacio?.textContent).toContain("Los códigos se asignan en Codificar o se importan en Matrices.");
    expect(host.querySelector(".pulso-franja-recorrido")).toBeNull();
    expect(lista()).toBeNull();
    // Sin preguntas no hay detalle, y la mesa no reserva su columna.
    expect(detalle()).toBeNull();
    expect(host.querySelector(".pulso-aplicar-mesa")?.hasAttribute("data-con-detalle")).toBe(false);
    expect(boton("Aplicar a la base")?.disabled).toBe(true);
    expect(host.textContent).toContain("No se escribe nada en la base.");

    // Un solo camino a Codificar: el del pie. El vacío no lo duplica.
    expect(vacio?.querySelector("button")).toBeNull();
    await act(async () => { boton("Volver a Codificar")?.click(); });
    expect(irACodificar).toHaveBeenCalledTimes(1);
  });

  it("con preguntas que solo quedan fuera no hay franja, vacío ni detalle: se ven sus causas y no se puede aplicar", async () => {
    espia.plan.mockResolvedValueOnce(plan([P66]));
    await montar();
    expect(host.querySelector(".pulso-franja-recorrido")).toBeNull();
    expect(host.querySelector(".pulso-estado-vacio")).toBeNull();
    expect(detalle()).toBeNull();
    expect(host.querySelector('[data-testid="codificacion-aplicar-fuera"]')).not.toBeNull();
    expect(host.querySelector(".pulso-aplicar-aviso")).toBeNull();
    expect(boton("Aplicar a la base")?.disabled).toBe(true);
  });

  it("si la base cambió y no hay preguntas aplicables, lo dice el panel: sin franja el aviso no se pierde", async () => {
    espia.plan.mockResolvedValueOnce(plan([P66], true));
    await montar();
    expect(host.querySelector(".pulso-franja-recorrido")).toBeNull();
    expect(panelDePreguntas()?.querySelector(".pulso-aplicar-aviso .pulso-alert")?.textContent).toBe(
      "La base cambió después de la última aplicación: ya no tiene los campos de códigos.",
    );
  });
});

describe("AdaptarPane: con el plan leído", () => {
  it("la franja cuenta solo lo que se aplica y cada cifra aparece una sola vez en la pantalla", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const seccion = marcoIgual();
    expect(seccion.getAttribute("data-audit-ready")).toBe("codificacion-adaptar");
    expect(seccion.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");

    const franja = host.querySelector('.pulso-franja-recorrido[role="group"]');
    expect(franja?.getAttribute("aria-label")).toBe("De la codificación a la base codificada");
    expect(franja?.querySelector('[data-qa-geometry-group="codificacion/aplicar-franja"]')).not.toBeNull();
    // 2 preguntas, 2 + 4 códigos nuevos y 1 + 0 ya existentes: los 50 de p66, que queda fuera, no suman.
    expect([...(franja?.querySelectorAll(".pulso-franja-grupo") ?? [])].map((g) => g.textContent)).toEqual([
      "Codificación2preguntas", "Códigos6nuevos1ya existente",
    ]);
    expect(franja?.querySelector(".pulso-franja-destino")?.textContent).toBe("Base codificada2campos nuevos");
    // Ni los totales del motor (99) ni una cifra de la franja repetida en los paneles.
    // Texto con las celdas separadas: "19" y "96" de filas vecinas no forman un "99".
    expect(host.innerHTML.replace(/<[^>]+>/g, " ")).not.toMatch(/\b99\b/);
    for (const cifra of ["2preguntas", "6nuevos", "1ya existente", "2campos nuevos"]) expect(veces(cifra), cifra).toBe(1);
    const paneles = `${panelDePreguntas()?.textContent ?? ""} ${detalle()?.textContent ?? ""}`;
    expect(paneles).not.toMatch(/\b6 códigos\b|\b2 (?:preguntas|campos)\b/);

    expect(filas()).toHaveLength(2);
    expect(host.querySelector(".pulso-estado-vacio")).toBeNull();
    expect(host.querySelector("details")).toBeNull();
  });

  it("la que no se puede aplicar queda a la vista en el panel de preguntas, con su causa", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const fuera = panelDePreguntas()?.querySelector('[data-testid="codificacion-aplicar-fuera"]');
    expect(fuera?.querySelector("h4")?.textContent).toBe("1 pregunta no se puede aplicar");
    expect(fuera?.textContent).toContain('La columna de texto "p66_otro" no está en la base.');
    expect(lista()?.textContent).not.toContain("p66");
  });

  it("el pie lleva la acción con su efecto, cierra el panel de preguntas y queda fuera de su cuerpo desplazable", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const panel = panelDePreguntas();
    const pie = panel?.querySelector(":scope > .pulso-aplicar-cierre > footer.pulso-pie-efecto");
    expect(panel?.lastElementChild).toBe(pie?.parentElement);
    expect(panel?.querySelector(".pulso-aplicar-cuerpo footer")).toBeNull();
    // La lista y las que no se pueden aplicar van en el cuerpo, que es el que desplaza.
    expect(panel?.querySelector(":scope > .pulso-aplicar-cuerpo > ul.pulso-aplicar-lista")).not.toBeNull();
    expect(panel?.querySelector(':scope > .pulso-aplicar-cuerpo > [data-testid="codificacion-aplicar-fuera"]')).not.toBeNull();
    expect(pie?.querySelector(".pulso-pie-efecto-linea")?.textContent).toBe(
      "Escribe los campos nuevos en la base y genera la base codificada y el formulario codificado.",
    );
    expect([...(pie?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim())).toEqual([
      "Volver a Codificar", "Revisar matrices", "Aplicar a la base",
    ]);
    expect(boton("Aplicar a la base")?.disabled).toBe(false);
  });

  it('"Actualizar" vuelve a leer el plan sin desmontar la lista, y avisa en la franja si la base cambió', async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    expect(host.querySelector(".pulso-franja-aviso")).toBeNull();

    let resolver: (p: PlanAdaptacion) => void = () => {};
    espia.plan.mockImplementationOnce(() => new Promise<PlanAdaptacion>((r) => { resolver = r; }));
    await act(async () => { boton("Actualizar")?.click(); });
    expect(boton("Actualizar")?.disabled).toBe(true);
    expect(filas()).toHaveLength(2);

    await act(async () => { resolver(plan([P9], true)); });
    expect(boton("Actualizar")?.disabled).toBe(false);
    expect(filas()).toHaveLength(1);
    expect(host.querySelector('.pulso-franja-aviso[data-tono="aviso"]')?.textContent).toBe(
      "La base cambió después de la última aplicación: ya no tiene los campos de códigos",
    );
    // Con franja, el aviso va en ella y el panel no lo repite.
    expect(host.querySelector(".pulso-aplicar-aviso")).toBeNull();
  });
});

describe("AdaptarPane: el resultado de una aplicación no mueve el marco", () => {
  it("\"terminó con avisos\" y los archivos van en el panel de preguntas: la franja sigue siendo lo primero de la pantalla", async () => {
    espia.plan.mockResolvedValue(PLAN);
    await montar();
    const seccion = marcoIgual();
    const hijosAntes = Array.from(seccion.children).map((h) => h.className.split(" ")[0]);
    expect(hijosAntes).toEqual(["pulso-franja-recorrido", "pulso-aplicar-mesa"]);

    const clave = claveAplicar("sid-1", "egresados");
    await act(async () => {
      const store = useAplicarAvisosStore.getState();
      store.iniciar(clave);
      store.recibir(clave, {
        ok: true, job_id: "j1", kind: "codificacion.aplicar", avisos_incompletos: [], textos_sin_codigo: [], sin_recodificar: [],
        omitidas: [{ pregunta: "P12", motivo: "sin_variable_madre", mensaje: "La variable madre no está en la base.", variable_nueva: "P12_agrup" }],
      });
      store.terminar(clave, { archivos: [
        { fileId: "f1", nombre: "X_Data_adaptada_10_11_26.xlsx", formato: "xlsx", rotulo: "Base codificada" },
        { fileId: "f2", nombre: "X_Instrumento_adaptado_10_11_26.xlsx", formato: "xlsx", rotulo: "Formulario codificado" },
      ] });
    });
    // Los mismos hijos, en el mismo orden: nada nuevo sobre la franja.
    expect(Array.from(seccion.children).map((h) => h.className.split(" ")[0])).toEqual(hijosAntes);
    const resultado = panelDePreguntas()?.querySelector(".pulso-aplicar-cuerpo > .pulso-aplicar-resultado");
    expect(resultado?.querySelector("h4")?.textContent).toBe("Archivos codificados");
    expect(resultado?.querySelector(".pulso-aplicar-resultado-nota")?.textContent).toBe("Base codificada y formulario codificado");
    expect(resultado?.querySelector('[data-testid="codificacion-adaptar-resumen"]')?.textContent).toContain("La aplicación terminó con 1 aviso.");
    expect(host.querySelectorAll('[data-testid="codificacion-adaptar-resumen"]')).toHaveLength(1);
    // El pie sigue y el botón vuelve a estar disponible.
    expect(boton("Aplicar a la base")?.disabled).toBe(false);
  });
});

describe("AdaptarPane: detalle de la pregunta elegida", () => {
  it("por defecto queda elegida la primera pregunta y el detalle muestra su ficha, su campo y sus códigos", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    expect(elegidas()).toEqual(["p9"]);
    expect(host.querySelector(".pulso-aplicar-mesa")?.hasAttribute("data-con-detalle")).toBe(true);
    const d = detalle();
    expect(d?.querySelector("h3")?.textContent).toBe("Códigos de la pregunta");
    expect(d?.getAttribute("aria-label")).toBe("Códigos de p9");
    // La lista gobierna este panel.
    expect(lista()?.getAttribute("aria-controls")).toBe(d?.id);
    expect(d?.querySelector(".pulso-aplicar-detalle-cab .pulso-ficha-pregunta")?.textContent).toBe("p9Ocupación principal");
    expect(d?.querySelector(".pulso-aplicar-detalle-campo")?.textContent).toBe("Campo nuevop9_recod");
    expect(codigos()).toEqual([
      ["08", "Educación superior", "Nuevo", "24"],
      ["12", "Minería", "Nuevo", "19"],
      ["96", "Otro", "Ya existente", "9"],
    ]);
  });

  it("los códigos van en una tabla con sus cuatro columnas y la cabecera fuera del cuerpo que se mide", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const tabla = detalle()?.querySelector('[role="table"]');
    expect(tabla?.getAttribute("aria-label")).toBe("Códigos de p9");
    expect(tabla?.getAttribute("aria-rowcount")).toBe("4");
    expect(Array.from(tabla?.querySelectorAll('[role="columnheader"]') ?? []).map((c) => c.textContent)).toEqual([
      "Código", "Categoría", "Origen", "Respuestas",
    ]);
    // La cabecera es un grupo aparte del cuerpo: queda fija mientras el cuerpo desplaza.
    const grupos = Array.from(tabla?.querySelectorAll(':scope > [role="rowgroup"]') ?? []);
    expect(grupos.map((g) => g.className)).toEqual(["pulso-aplicar-codigos-cab", "pulso-aplicar-codigos-cuerpo"]);
    expect(filasDeCodigos()).toHaveLength(3);
    for (const fila of filasDeCodigos()) expect(fila.querySelectorAll(':scope > [role="cell"]')).toHaveLength(4);
    // El origen va en su columna, como etiqueta de texto.
    expect(filasDeCodigos().map((f) => f.querySelector(".pulso-aplicar-col-origen > .pulso-aplicar-origen")?.textContent)).toEqual(["Nuevo", "Nuevo", "Ya existente"]);
  });

  it("la barra de respuestas es proporcional al código con más respuestas; con 0 no hay barra y la cifra se lee \"0\"", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    // p9: 24, 19 y 9 respuestas; la mayor llena la barra.
    expect(barras()).toEqual(["1", String(19 / 24), String(9 / 24)]);
    await act(async () => { filas()[1].click(); });
    // p3: 14, 7, 0 y sin conteo. Con 0 la cifra es "0" y no hay barra; sin conteo, ni cifra ni barra.
    expect(barras()).toEqual(["1", "0.5", null, null]);
    expect(codigos().map((c) => c[3])).toEqual(["14", "7", "0", ""]);
    // La barra es decorativa: el dato es la cifra.
    expect(filasDeCodigos().every((f) => f.querySelector(".pulso-aplicar-barra")?.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("nuevo y ya existente se distinguen por texto, no solo por color", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const origenes = filasDeCodigos().map((fila) => [fila.getAttribute("data-origen"), fila.querySelector(".pulso-aplicar-origen")?.textContent]);
    expect(origenes).toEqual([["nuevo", "Nuevo"], ["nuevo", "Nuevo"], ["existente", "Ya existente"]]);
    expect(new Set(origenes.map(([, texto]) => texto)).size).toBe(2);
  });

  it("al elegir otra pregunta con un clic cambia el detalle, y la dirección no cambia", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const antes = window.location.href;
    await act(async () => { filas()[1].click(); });
    expect(elegidas()).toEqual(["p3"]);
    expect(detalle()?.getAttribute("aria-label")).toBe("Códigos de p3");
    expect(detalle()?.querySelector(".pulso-aplicar-detalle-campo")?.textContent).toBe("Campos nuevosp3/*_recod");
    // Sin etiqueta lo dice; sin conteo no inventa un cero.
    expect(codigos()).toEqual([
      ["21", "Diseño", "Nuevo", "14"],
      ["22", "Música", "Nuevo", "7"],
      ["23", "Sin etiqueta", "Nuevo", "0"],
      ["24", "Gastronomía", "Nuevo", ""],
    ]);
    expect(detalle()?.textContent).not.toContain("Educación superior");
    expect(window.location.href).toBe(antes);
  });

  it("con las flechas la selección sigue al foco: abajo, arriba, Fin e Inicio", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const pulsar = async (tecla: string) => {
      const activa = document.activeElement as HTMLElement;
      await act(async () => { activa.dispatchEvent(new KeyboardEvent("keydown", { key: tecla, bubbles: true, cancelable: true })); });
    };
    expect(filas().map((f) => f.tabIndex)).toEqual([0, -1]);
    filas()[0].focus();
    await pulsar("ArrowDown");
    expect(elegidas()).toEqual(["p3"]);
    expect(document.activeElement).toBe(filas()[1]);
    expect(filas().map((f) => f.tabIndex)).toEqual([-1, 0]);
    expect(detalle()?.getAttribute("aria-label")).toBe("Códigos de p3");
    // En el último, abajo no sale de la lista.
    await pulsar("ArrowDown");
    expect(elegidas()).toEqual(["p3"]);
    await pulsar("ArrowUp");
    expect(elegidas()).toEqual(["p9"]);
    expect(document.activeElement).toBe(filas()[0]);
    await pulsar("End");
    expect(elegidas()).toEqual(["p3"]);
    await pulsar("Home");
    expect(elegidas()).toEqual(["p9"]);
    expect(detalle()?.getAttribute("aria-label")).toBe("Códigos de p9");
  });

  it("ningún conteo de la fila se repite en el detalle: el detalle es el desglose por código", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    const fila = filas()[0].textContent ?? "";
    expect(fila).toContain("2 códigos nuevos y 1 ya existente");
    expect(fila).toContain("52 respuestas con código");
    const d = detalle()?.textContent ?? "";
    expect(d).not.toMatch(/códigos nuevos|y 1 ya existente|respuestas con código|\b52\b|\b[23] códigos\b/);
    // Lo que sí trae: las respuestas de cada código, que suman las de la fila.
    expect(codigos().map((c) => c[3])).toEqual(["24", "19", "9"]);
  });

  it("con una sola pregunta aplicable la fila no repite los conteos de códigos de la franja, y el campo sale una vez en la fila y una en el detalle", async () => {
    espia.plan.mockResolvedValueOnce(plan([P3, P66]));
    await montar();
    expect([...(host.querySelectorAll(".pulso-franja-grupo") ?? [])].map((g) => g.textContent)).toEqual(["Codificación1pregunta", "Códigos4nuevos0ya existentes"]);
    const fila = filas()[0].textContent ?? "";
    expect(fila).not.toMatch(/códigos nuevos|ya existente/);
    expect(fila).toContain("21 respuestas con código");
    expect(veces("4 códigos")).toBe(0);
    expect(veces("p3/*_recod")).toBe(2);
    expect(filas()[0].textContent).toContain("p3/*_recod");
    expect(detalle()?.querySelector(".pulso-aplicar-detalle-campo")?.textContent).toContain("p3/*_recod");
  });

  it("si la pregunta elegida desaparece del plan al actualizar, vuelve a elegirse la primera", async () => {
    espia.plan.mockResolvedValueOnce(PLAN);
    await montar();
    await act(async () => { filas()[1].click(); });
    expect(elegidas()).toEqual(["p3"]);
    espia.plan.mockResolvedValueOnce(plan([P9]));
    await act(async () => { boton("Actualizar")?.click(); });
    expect(elegidas()).toEqual(["p9"]);
    expect(detalle()?.getAttribute("aria-label")).toBe("Códigos de p9");
  });

  it("el cuerpo de la tabla de códigos declara C1 y la tabla se puede desplazar con el teclado; sin lista de códigos lo dice", async () => {
    espia.plan.mockResolvedValueOnce(plan([P9, pregunta({ parent: "p7", n_codigos_nuevos: 3 })]));
    await montar();
    const tabla = detalle()?.querySelector(".pulso-aplicar-codigos");
    const cuerpo = tabla?.querySelector(".pulso-aplicar-codigos-cuerpo");
    expect(cuerpo?.getAttribute("data-qa-geometry-group")).toBe("codificacion/aplicar-codigos");
    expect(cuerpo?.getAttribute("data-qa-geometry-contract")).toBe("intrinsic");
    // La tabla es la dueña del scroll y no tiene controles: recibe el foco para desplazarla con el teclado.
    expect(tabla?.getAttribute("tabindex")).toBe("0");

    await act(async () => { filas()[1].click(); });
    expect(detalle()?.querySelector(".pulso-aplicar-codigos")).toBeNull();
    expect(detalle()?.querySelector(".pulso-estado-vacio")?.textContent).toContain("Sin desglose por código");
  });
});
