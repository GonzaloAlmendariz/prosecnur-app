// @vitest-environment happy-dom
// Elegir una plantilla muestra su adelanto y no lee el cuestionario (Gonzalo, 2026-11-12): la lectura pesada
// (POST /api/graficos/plan/estructura) sólo ocurre al pedir las secciones y preguntas, y el plan sugerido sólo al crear.
// Sin leer, no hay cifras en 0: el bloque dice qué se sabe y cómo se elige.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstructuraDelInforme } from "../../../api/graficosEstructura";

const estructura: EstructuraDelInforme = {
  perfil: "",
  laminasFijas: 2,
  avisos: [],
  secciones: [{
    titulo: "Hogar",
    preguntas: [{ ref: "p1", etiqueta: "Tamaño del hogar", tipo: "Opción única", grafico: "barras", graficosPosibles: ["barras"], laminas: 1, dentro: true, porRegistro: false }],
  }],
} as unknown as EstructuraDelInforme;

const api = vi.hoisted(() => ({
  estructura: vi.fn(),
  planSugerido: vi.fn(),
  ppt: vi.fn(),
  ejecutar: vi.fn(),
}));

vi.mock("../../../api/graficosEstructura", () => ({ apiGraficosEstructuraInforme: api.estructura }));
vi.mock("../../../api/client", () => ({ apiGraficosPlanSugerido: api.planSugerido, apiGraficosTemplates: vi.fn() }));
vi.mock("../../../api/graficos", async (original) => ({ ...(await original<object>()), apiGraficosPpt: api.ppt }));
vi.mock("../../../components/entregables/useGeneracion", () => ({
  useGeneracion: () => ({ estado: { fase: "inactiva" }, ejecutar: api.ejecutar, seguirJob: vi.fn(), cerrar: vi.fn() }),
}));
vi.mock("../../../api/planner", () => ({
  apiPlannerEstado: async () => ({ planner: { estudio: { nombre: "Estudio", codigo: "E1", cliente: "Otro" } } }),
}));
vi.mock("../usePptStyleProfiles", () => ({ usePptStyleProfiles: () => ({ profiles: [], loading: false, error: "" }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ registry: null, slidesById: {}, graficadoresById: {} }) }));
vi.mock("../useVariables", () => ({ useVariables: () => ({ variables: [], multi: false, relacionBases: null, sources: [] }) }));
vi.mock("../../../lib/navegacion/useDireccion", () => ({ useSeccion: () => ({ irA: vi.fn() }) }));
vi.mock("../../project/ProjectShell", () => ({ useOptionalProjectShell: () => null }));

const { usePlanStore } = await import("../store");
const { default: PestanaPlantillas } = await import("./PestanaPlantillas");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.estructura.mockReset().mockResolvedValue(estructura);
  api.planSugerido.mockReset().mockResolvedValue({ plan: { slides: [{ id: "n1", tipo: "p_slide_portada", payload: { titulo: "Nuevo" } }] } });
  api.ppt.mockReset().mockResolvedValue({ job_id: "j1" });
  api.ejecutar.mockReset().mockImplementation(async (fn: () => Promise<unknown>) => ({ ok: true, datos: await fn() }));
  usePlanStore.setState({
    scopeRules: { plantilla_elegida: "pulso" },
    plan: { ...usePlanStore.getState().plan, slides: [] },
    aplicarPlanSugerido: vi.fn(),
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function montar() {
  await act(async () => { root.render(<PestanaPlantillas />); });
  await act(async () => { await Promise.resolve(); });
}

const boton = (texto: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === texto);

describe("pestaña Plantillas: adelanto antes de generar", () => {
  it("elegir una plantilla muestra su adelanto sin leer el cuestionario ni crear láminas", async () => {
    await montar();
    await act(async () => { boton("ACNUR general")?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(usePlanStore.getState().scopeRules.plantilla_elegida).toBe("acnur");
    expect(api.estructura).not.toHaveBeenCalled();
    expect(api.planSugerido).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Láminas de ejemplo de ACNUR general"]')).not.toBeNull();
    expect(host.textContent).toContain("¿Crear el informe con esta plantilla?");
  });

  it("sin leer no hay cifras en 0: el bloque dice qué se sabe de la selección", async () => {
    await montar();
    expect(host.querySelector('[data-qa-geometry-group="graficos/plantillas-cifras"]')).toBeNull();
    expect(host.textContent).toContain("Entran todas las preguntas del cuestionario.");
    expect(host.textContent).not.toContain("Fuera del informe");
  });

  it("pedir las secciones y preguntas lee el cuestionario y entonces muestra las cifras", async () => {
    await montar();
    await act(async () => { boton("Elegir secciones y preguntas")?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(api.estructura).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-qa-geometry-group="graficos/plantillas-cifras"]')).not.toBeNull();
    expect(host.textContent).toContain("Hogar1 de 1 pregunta");
  });

  it("confirmar con el botón primario crea las láminas con el plan sugerido", async () => {
    await montar();
    await act(async () => { boton("Crear láminas")?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(api.planSugerido).toHaveBeenCalledTimes(1);
  });
});

describe("pestaña Plantillas: un informe armado no se reemplaza en silencio", () => {
  const armadas = Array.from({ length: 52 }, (_, i) => ({ id: `a${i}`, tipo: "p_slide_1_grafico", payload: { titulo: `Dimensión ${i}` } }));

  beforeEach(() => {
    usePlanStore.setState({ plan: { ...usePlanStore.getState().plan, slides: armadas } as never });
  });

  it("el aviso dice cuántas láminas tiene el informe y ofrece un informe aparte antes que reemplazar", async () => {
    await montar();
    expect(host.textContent).toContain("El proyecto ya tiene un informe de 52 láminas.");
    expect(boton("Crear informe aparte")).toBeDefined();
    expect(boton("Reemplazar las 52 láminas")).toBeDefined();
    expect(boton("Crear láminas")).toBeUndefined();
  });

  it("el informe aparte genera el PowerPoint con la plantilla y deja las láminas del proyecto", async () => {
    await montar();
    await act(async () => { boton("Crear informe aparte")?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(api.planSugerido).toHaveBeenCalledTimes(1);
    expect(api.ppt).toHaveBeenCalledTimes(1);
    const [plan] = api.ppt.mock.calls[0];
    expect(plan.slides).toHaveLength(1);
    expect(plan.slides[0].payload.titulo).toBe("Nuevo");
    expect(usePlanStore.getState().aplicarPlanSugerido).not.toHaveBeenCalled();
    expect(usePlanStore.getState().plan.slides).toHaveLength(52);
  });

  it("reemplazar sigue disponible y aplica el plan de la plantilla", async () => {
    await montar();
    await act(async () => { boton("Reemplazar las 52 láminas")?.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(usePlanStore.getState().aplicarPlanSugerido).toHaveBeenCalledTimes(1);
    expect(api.ppt).not.toHaveBeenCalled();
  });
});
