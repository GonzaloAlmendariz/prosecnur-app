// @vitest-environment happy-dom
// H4 (continuación): la pestaña «Lámina» del inspector se pliega como la del gráfico. En «Hallazgos clave» hay cuatro
// secciones (Composición, Textos, Hallazgos, Capítulos y hallazgos): índice pegado, sólo la primera abierta y el
// índice abre y lleva a los capítulos. La maqueta se declara como tal con «Previsualizar» al alcance.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ArgMetadata, Slide } from "../../../../api/graficos";

const ARGS: ArgMetadata[] = [
  { name: "titulo", label: "Título de la lámina", tipo_input: "string", grupo: "textos" },
  { name: "etiqueta", label: "Etiqueta corta", tipo_input: "string", grupo: "textos" },
  { name: "base", label: "Base", tipo_input: "string", grupo: "textos" },
  { name: "modo", label: "Modo", tipo_input: "choice", grupo: "textos", default: "cifras", choices: [
    { value: "cifras", label: "Hasta seis cifras" }, { value: "cifras_con_graficos", label: "Hasta tres cifras con su gráfico" },
    { value: "resumen", label: "Resumen ejecutivo en tabla por capítulo" }, { value: "titulares", label: "Un titular por capítulo" },
  ] },
  { name: "seleccion", label: "Selección de hallazgos", tipo_input: "choice", grupo: "textos", default: "manual",
    depende: { arg: "modo", valores: ["resumen", "titulares"] },
    choices: [{ value: "manual", label: "Los hallazgos escritos en el plan" }, { value: "auto", label: "Propuestos por el motor" }] },
  { name: "max_por_capitulo", label: "Hallazgos por capítulo", tipo_input: "number", grupo: "textos", default: 3, min: 1, max: 3, step: 1,
    depende: { arg: "modo", valores: ["resumen"] } },
  { name: "max_por_lamina", label: "Hallazgos por lámina", tipo_input: "number", grupo: "textos", default: 8, min: 4, max: 8, step: 1,
    depende: { arg: "modo", valores: ["resumen", "titulares"] } },
  { name: "tambien", label: "Mostrar «También»", tipo_input: "bool", grupo: "textos", default: true, depende: { arg: "modo", valores: ["resumen"] } },
  { name: "cruces", label: "Cruces", tipo_input: "variables_list", grupo: "datos", depende: { arg: "modo", valores: ["resumen", "titulares"] } },
  { name: "capitulos", label: "Capítulos y hallazgos", tipo_input: "hallazgos_capitulos", grupo: "datos",
    depende: { arg: "modo", valores: ["resumen", "titulares"] } },
];

vi.mock("../../useGraficosRegistry", () => ({
  useGraficosRegistry: () => ({ slidesById: { p_slide_hallazgos: { args: ARGS } }, graficadoresById: {} }),
}));
vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [{ name: "A11_recod", label: "Tipo de colegio", source: "base" }] }),
}));
vi.mock("../../../../lib/SessionContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/SessionContext")>()),
  useSession: () => ({ state: { active_base: "base" } }),
}));
vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
    { codigo: "1", etiqueta: "Público", n: 60, pct: 60, residual: false },
    { codigo: "2", etiqueta: "Privado", n: 40, pct: 40, residual: false },
  ] } }),
}));

const { InspectorLamina } = await import("../InspectorLamina");
const { construirEstructura } = await import("../modeloEstructura");
const { useLaminasUi } = await import("../laminasStore");
const { AvisoMaqueta } = await import("../maqueta/AvisoMaqueta");

const real = [{ titulo: "Información general", cifras: [{ var: "A11_recod", fila: "Privado", texto: "colegio privado", comparacion: "auto" }] }];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useLaminasUi.setState({ seccionesLamina: {}, seccionRecienteLamina: null, seccionInspector: "contenido" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function pintar(payload: Record<string, unknown>) {
  const slide: Slide = { id: "h1", tipo: "p_slide_hallazgos", payload };
  const lamina = construirEstructura([slide]).laminas[0];
  act(() => root.render(
    <MemoryRouter initialEntries={["/procesamiento?seccion=graficos"]}>
      <InspectorLamina slide={slide} lamina={lamina} ranura={null} onRanura={() => undefined} visor={null} onCerrar={() => undefined}
        onCambiarLamina={() => undefined} onCambiarGrafico={() => undefined} />
    </MemoryRouter>,
  ));
}

const cabeceras = () => [...host.querySelectorAll<HTMLButtonElement>(".pulso-f6-grupo-boton")];

describe("pestaña «Lámina» en secciones plegables", () => {
  test("Hallazgos clave en resumen: cuatro secciones, índice y sólo Composición abierta", () => {
    pintar({ modo: "resumen", seleccion: "manual", capitulos: real });
    expect(cabeceras().map((b) => b.textContent)).toEqual(["Composición", "Textos", "Hallazgos", "Capítulos y hallazgos"]);
    expect(cabeceras().map((b) => b.getAttribute("aria-expanded"))).toEqual(["true", "false", "false", "false"]);
    const indice = host.querySelector("nav[aria-label='Secciones de la lámina']");
    expect([...indice!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Composición", "Textos", "Hallazgos", "Capítulos"]);
    // Cerrada, la sección sigue montada: el capítulo existe, escondido hasta que se busque o se abra.
    const cuerpo = host.querySelector<HTMLElement>("[data-seccion-tarjeta='capitulos'] > .pulso-f6-grupo-cuerpo")!;
    expect(cuerpo.getAttribute("hidden")).toBe("until-found");
    expect(cuerpo.querySelector("input[value='Información general']")).not.toBeNull();
  });

  test("el índice abre los capítulos y lo recuerda", () => {
    pintar({ modo: "resumen", seleccion: "manual", capitulos: real });
    const ir = host.querySelector<HTMLButtonElement>("nav [data-ir='capitulos']")!;
    act(() => ir.click());
    expect(host.querySelector("[data-seccion-tarjeta='capitulos'] .pulso-f6-grupo-boton")!.getAttribute("aria-expanded")).toBe("true");
    expect(useLaminasUi.getState().seccionRecienteLamina).toBe("capitulos");
  });

  test("en modo de cifras no hay capítulos ni índice (tres secciones o más)", () => {
    pintar({ cifras: [{ var: "q1" }] });
    expect(cabeceras().map((b) => b.textContent)).toEqual(["Composición", "Textos", "Hallazgos"]);
    expect(host.querySelector("nav[aria-label='Secciones de la lámina']")).not.toBeNull();
  });

  test("Textos se abre con su cabecera", () => {
    pintar({ modo: "resumen", seleccion: "manual", capitulos: real });
    const textos = cabeceras()[1];
    act(() => textos.click());
    expect(textos.getAttribute("aria-expanded")).toBe("true");
    expect(useLaminasUi.getState().seccionesLamina.textos).toBe(true);
  });
});

describe("AvisoMaqueta", () => {
  test("dice que es la maqueta y su botón pide la vista real", () => {
    const pedir = vi.fn();
    act(() => root.render(<AvisoMaqueta onPrevisualizar={pedir} />));
    expect(host.textContent).toBe("Esta es la maqueta. Previsualizar muestra sus datos.");
    act(() => host.querySelector("button")!.click());
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  test("sin base preparada dice qué falta, sin botón; sin acción no se pinta", () => {
    act(() => root.render(<AvisoMaqueta onPrevisualizar={() => undefined} prepOk={false} />));
    expect(host.querySelector("button")).toBeNull();
    expect(host.textContent).toContain("con la base preparada");
    act(() => root.render(<AvisoMaqueta />));
    expect(host.innerHTML).toBe("");
  });
});
