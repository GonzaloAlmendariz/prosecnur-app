// @vitest-environment happy-dom
// La propuesta del motor en el editor (H13): con «Los propone el motor» se ve la lista con casillas, se quitan dos y se
// edita a partir de ella en un solo parche; con «Los escribo yo» se trae sin borrar lo escrito sin preguntar.
// happy-dom no mide layout; la geometría se verifica en la captura.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/core";
import type { Slide } from "../../../../api/graficos";
import { normalizarPropuestaResumen } from "../../../../api/graficosPropuesta";

const pedir = vi.fn();
vi.mock("../../../../api/graficosPropuesta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/graficosPropuesta")>()),
  apiGraficosPropuestaResumen: (...a: unknown[]) => pedir(...a),
}));
vi.mock("../../configSnapshot", () => ({ buildGraficosConfigFromStore: () => ({ slides: [] }) }));
// Un estudio de una sola base: la pregunta va sin calificar (la calificación con varias bases se prueba en el modelo).
vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [] }),
}));

const { usePlanStore } = await import("../../store");
const { PropuestaResumen } = await import("./PropuestaResumen");

const PROPUESTA = normalizarPropuestaResumen({
  tipo: "p_slide_hallazgos", modo: "resumen",
  capitulos: [
    { titulo: "Crianza", cifras: [
      { var: "educ_padre", fila: "Posgrado", comparacion: "auto", pregunta: "Nivel educativo del padre", frase: "respondió «Posgrado»",
        cifra: "23%", n: 301, diferencia: "Hombre 32% △ frente al 15% del resto", diferencia_estado: "diferencia" },
      { var: "educ_padre", fila: "Universitaria", comparacion: "auto", pregunta: "Nivel educativo del padre", frase: "respondió «Universitaria»",
        cifra: "40%", n: 301, diferencia: "Sin diferencias por área, nivel ni sexo", diferencia_estado: "sin_diferencias" },
    ] },
    { titulo: "Vida universitaria", cifras: [
      { var: "B3_recod", fila: "Académica", texto: "participa en una agrupación académica", comparacion: "auto", pregunta: "¿Perteneces?",
        frase: "participa en una agrupación académica", cifra: "29%", n: 400, diferencia: "CC. PP. 44% ▲ frente al 17% del resto",
        diferencia_estado: "diferencia" },
      { var: "B17", fila: "Fines de semana", texto: "trabaja solo fines de semana", comparacion: "auto", pregunta: "¿Cuánto trabajas?",
        frase: "trabaja solo fines de semana", cifra: "12%", n: 120, diferencia: "Sin diferencias", diferencia_estado: "sin_diferencias" },
    ] },
  ],
  avisos: ["Hallazgos clave: la cifra de «educ_padre» no tiene texto: se usó «respondió «Posgrado»». Escribe lo que mide."],
});

let host: HTMLDivElement;
let root: Root;
let n = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  pedir.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** El inspector en miniatura: el payload vive aquí y la selección decide si la propuesta se muestra sola. */
function Banco({ inicial, onParche }: { inicial: Slide; onParche: (p: Record<string, unknown>) => void }) {
  const [slide, setSlide] = useState(inicial);
  const payload = slide.payload as Record<string, unknown>;
  return (
    <PropuestaResumen slide={slide} scope="active" automatica={payload.seleccion === "auto"} valor={payload.capitulos}
      onAplicar={(p) => { onParche(p); setSlide((s) => ({ ...s, payload: { ...s.payload, ...p } })); }} />
  );
}

async function montar(payload: Record<string, unknown>, extra: { claves?: string[]; slides?: Slide[] } = {}) {
  n += 1;
  // Cada prueba con su lámina: la propuesta traída se recuerda por lámina y no debe cruzarse entre pruebas.
  const slide: Slide = { id: `h${n}`, tipo: "p_slide_hallazgos", payload: { modo: "resumen", cruces: [`c${n}`], ...payload } };
  usePlanStore.setState({ plan: { slides: [slide, ...(extra.slides ?? [])], ...(extra.claves ? { preguntas_clave: extra.claves } : {}) } });
  const onParche = vi.fn();
  await act(async () => root.render(
    <MemoryRouter initialEntries={["/procesamiento?seccion=graficos&pestana=laminas&panel=inspector"]}>
      <Banco inicial={slide} onParche={onParche} />
    </MemoryRouter>,
  ));
  await act(async () => { await Promise.resolve(); });
  return onParche;
}

// «Queda» es un PulsoSwitch (K1: el kit no tiene casillas).
const casillas = () => [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
const marcada = (c: HTMLButtonElement) => c.getAttribute("aria-checked") === "true";
const boton = (texto: string) => {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.trim() === texto);
  if (!b) throw new Error(`No hay botón «${texto}»`);
  return b;
};

describe("PropuestaResumen", () => {
  it("con «Los propone el motor» muestra la propuesta por capítulo, todo marcado, con avisos", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    await montar({ seleccion: "auto" });
    expect(pedir).toHaveBeenCalledTimes(1);
    const grupos = [...host.querySelectorAll('[role="group"]')];
    expect(grupos.map((g) => document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent)).toEqual(["Crianza", "Vida universitaria"]);
    expect(casillas()).toHaveLength(4);
    expect(casillas().every(marcada)).toBe(true);
    // Cada casilla se nombra con su hallazgo.
    expect(casillas()[0].getAttribute("aria-label")).toBe("Queda: Nivel educativo del padre, 23% respondió «Posgrado»");
    expect(host.textContent).toContain("4 de 4 quedan");
    expect(host.textContent).toContain("Hombre 32% △ frente al 15% del resto");
    expect(host.textContent).toContain("2 hallazgos no tienen texto propio.");
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain("Propuesta lista");
  });

  it("se quitan dos y «Editar a partir de esta propuesta» pasa a manual con lo marcado en un solo parche", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    const onParche = await montar({ seleccion: "auto" });
    act(() => { casillas()[1].click(); });
    act(() => { casillas()[3].click(); });
    expect(host.textContent).toContain("2 de 4 quedan");
    act(() => { boton("Editar a partir de esta propuesta").click(); });
    expect(onParche).toHaveBeenCalledTimes(1);
    expect(onParche.mock.calls[0][0]).toEqual({ seleccion: "manual", capitulos: [
      { titulo: "Crianza", cifras: [{ var: "educ_padre", fila: "Posgrado", texto: "respondió «Posgrado»", comparacion: "auto" }] },
      { titulo: "Vida universitaria", cifras: [{ var: "B3_recod", fila: "Académica", texto: "participa en una agrupación académica", comparacion: "auto" }] },
    ] });
    // Ya en «Los escribo yo»: queda el botón para volver a traerla, con el foco, y el anuncio.
    expect(document.activeElement?.textContent).toContain("Traer la propuesta del motor");
    expect(host.textContent).toContain("En «Los escribo yo» con 2 hallazgos. Ctrl+Z lo deshace.");
  });

  it("si se desmarca todo y se edita, avisa y no cambia nada", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    const onParche = await montar({ seleccion: "auto" });
    for (const c of casillas()) act(() => { c.click(); });
    act(() => { boton("Editar a partir de esta propuesta").click(); });
    expect(onParche).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("No marcaste ningún hallazgo. Marca al menos uno para editarlo.");
  });

  it("con «Los escribo yo» la trae a pedido y pregunta antes de tocar lo escrito", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    const escritos = [{ titulo: "Mío", cifras: [{ var: "P1", fila: "Sí", texto: "dice que sí", comparacion: "ninguna" }] }];
    const onParche = await montar({ seleccion: "manual", capitulos: escritos });
    expect(pedir).not.toHaveBeenCalled();
    await act(async () => { boton("Traer la propuesta del motor").click(); });
    await act(async () => { await Promise.resolve(); });
    expect(pedir).toHaveBeenCalledTimes(1);
    act(() => { boton("Llevar lo marcado al editor").click(); });
    expect(onParche).not.toHaveBeenCalled();
    const pregunta = host.querySelector<HTMLElement>(".pulso-f6-propuesta-confirmar");
    expect(pregunta?.getAttribute("role")).toBe("group");
    expect(pregunta?.textContent).toContain("Ya hay 1 capítulo escrito.");
    expect(document.activeElement).toBe(pregunta);
    act(() => { boton("Agregar al final").click(); });
    const capitulos = onParche.mock.calls[0][0].capitulos as { titulo: string }[];
    expect(capitulos.map((c) => c.titulo)).toEqual(["Mío", "Crianza", "Vida universitaria"]);
  });

  it("un error del motor se dice en lenguaje de analista y se puede reintentar", async () => {
    pedir.mockRejectedValueOnce(new ApiError("E_PROPUESTA_LAMINA_INVALIDA", "La lámina no se pudo leer: x"));
    await montar({ seleccion: "auto" });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("El motor no pudo leer esta lámina. Revisa la pregunta y los cruces.");
    pedir.mockResolvedValue(PROPUESTA);
    await act(async () => { boton("Reintentar").click(); });
    await act(async () => { await Promise.resolve(); });
    expect(casillas()).toHaveLength(4);
  });

  it("mientras carga se anuncia y el bloque no se da por listo", async () => {
    pedir.mockReturnValue(new Promise(() => undefined));
    await montar({ seleccion: "auto" });
    expect(host.textContent).toContain("El motor elige los hallazgos. Puede tardar hasta un minuto.");
    expect(host.querySelector('[data-audit-ready="false"]')).not.toBeNull();
  });

  it("H14: con preguntas clave dice el criterio y marca «Clave» en los hallazgos que vienen de ellas", async () => {
    const conClave = normalizarPropuestaResumen({ tipo: "p_slide_hallazgos", capitulos: [{ titulo: "Crianza", cifras: [
      { var: "educ_padre", fila: "Posgrado", pregunta: "Nivel educativo del padre", cifra: "23%", clave: true, texto: "tiene padre con posgrado" },
      { var: "B17", fila: "Sí", pregunta: "¿Trabajas?", cifra: "12%", texto: "trabaja" },
    ] }] });
    pedir.mockResolvedValue(conClave);
    await montar({ seleccion: "auto" }, { claves: ["educ_padre", "B3"] });
    expect(host.textContent).toContain("Por capítulo: la diferencia más fuerte entre grupos y una cifra de tus preguntas clave.");
    expect(host.textContent).toContain("2 preguntas clave marcadas");
    const marcas = [...host.querySelectorAll(".pulso-f6-propuesta-clave")];
    expect(marcas).toHaveLength(1);
    expect(marcas[0].closest(".pulso-f6-propuesta-elemento")?.textContent).toContain("Nivel educativo del padre");
    expect(casillas()[0].getAttribute("aria-label")).toContain(", pregunta clave");
    expect(casillas()[1].getAttribute("aria-label")).not.toContain("pregunta clave");
    expect(host.querySelector('[data-qa="propuesta-sin-claves"]')).toBeNull();
  });

  it("H14: sin preguntas clave avisa y enlaza a la tarjeta del primer gráfico con pregunta", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    const grafico = { id: "g1", tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_agrupadas", args: { var: "P5" } } } } as unknown as Slide;
    await montar({ seleccion: "auto" }, { slides: [grafico] });
    const aviso = host.querySelector('[data-qa="propuesta-sin-claves"]');
    expect(aviso?.textContent).toContain("Sin preguntas clave, el motor elige por capítulo la diferencia más fuerte y la cifra más lejos del 50 %.");
    const enlace = aviso?.querySelector("a");
    expect(enlace?.textContent).toBe("Marca tus preguntas clave para que la propuesta se base en ellas");
    expect(enlace?.getAttribute("href")).toContain("foco=g1%3Ag1");
    expect(enlace?.getAttribute("href")).toContain("panel=inspector");
    expect(aviso?.textContent).toContain("Se marcan en la tarjeta de cada gráfico, en Datos.");
  });

  it("H14: marcar o quitar una pregunta clave deja la propuesta como desactualizada, con su motivo", async () => {
    pedir.mockResolvedValue(PROPUESTA);
    await montar({ seleccion: "auto" });
    expect(host.textContent).not.toContain("La propuesta puede ser otra.");
    act(() => { usePlanStore.getState().setPreguntasClave(["educ_padre"]); });
    expect(host.textContent).toContain("Cambiaste tus preguntas clave. La propuesta puede ser otra.");
    await act(async () => { boton("Actualizar").click(); });
    await act(async () => { await Promise.resolve(); });
    expect(pedir).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain("La propuesta puede ser otra.");
  });
});
