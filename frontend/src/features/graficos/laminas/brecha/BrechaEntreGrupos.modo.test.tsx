// @vitest-environment happy-dom
// Ronda 19 (F2): dentro de «Aperturas por grupo», «Bases distintas» cambia de modo. `aEntreBases` escribe `cruce: null`;
// el store borraba las claves nulas y, sin `cruce`, `esEntreGrupos` volvía a decir «grupos». En el dumbbell ese `null`
// es el que declara «entre bases» (la versión «Contraste de públicos» lo fija así) y el store lo guarda.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [{ name: "docentes", variables: [] }], multi: false, loading: false, error: "", variables: [] }),
}));
vi.mock("../../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../temasEquivalentes/EditorTemasEquivalentes", () => ({ EditorTemasEquivalentes: () => <div data-testid="entre-bases" /> }));
vi.mock("../emparejado/EntradaEmparejado", () => ({ EntradaEmparejado: () => null }));
vi.mock("../gruposPadron/PadronPublicos", () => ({ PadronPublicos: () => null }));
vi.mock("../gruposPadron/GruposPadron", () => ({ GruposPadron: () => null }));
vi.mock("../../VariablePicker", () => ({ default: () => <span data-testid="picker" /> }));

const { usePlanStore } = await import("../../store");
const { BrechaEntreGrupos } = await import("./BrechaEntreGrupos");
const { esEntreGrupos } = await import("./modeloBrechaGrupos");

let host: HTMLDivElement;
let root: Root;

const SLIDE = "s1";
const argsDelPlan = (): Record<string, unknown> => {
  const s = usePlanStore.getState().plan.slides.find((x) => x.id === SLIDE);
  return ((s?.payload as Record<string, { args?: Record<string, unknown> }>)?.grafico?.args) ?? {};
};

function Tarjeta() {
  const args = usePlanStore((s) => (s.plan.slides.find((x) => x.id === SLIDE)?.payload as Record<string, { args?: Record<string, unknown> }>)?.grafico?.args ?? {});
  const actualizar = usePlanStore((s) => s.updateSlotArgs);
  return <BrechaEntreGrupos args={args} onCambio={(p) => actualizar(SLIDE, "grafico", p)} />;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // «Aperturas por grupo»: estilo resumen con cruce y grupos de una base.
  usePlanStore.setState({
    plan: { slides: [{ id: SLIDE, tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_dumbbell", args: {
      estilo: "resumen", cruce: "docentes$ciclo", grupos: ["1", "2"], vars: ["docentes$p7"], corte: "1",
    } } } }] } as never,
    presets: {},
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const opcion = (texto: string) => {
  const b = [...host.querySelectorAll<HTMLElement>('[role="radio"]')].find((x) => x.textContent?.includes(texto));
  if (!b) throw new Error(`no está la opción ${texto}`);
  return b;
};

describe("BrechaEntreGrupos: el modo de comparación", () => {
  it("«Bases distintas» pasa a entre bases y lo guarda; «Grupos de una base» vuelve", () => {
    act(() => root.render(<MemoryRouter><Tarjeta /></MemoryRouter>));
    expect(opcion("Grupos de una base").getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('[data-testid="entre-bases"]')).toBeNull();

    act(() => opcion("Bases distintas").click());
    const args = argsDelPlan();
    expect(args).toHaveProperty("cruce", null);
    expect(args).not.toHaveProperty("grupos");
    expect(esEntreGrupos(args)).toBe(false);
    expect(opcion("Bases distintas").getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('[data-testid="entre-bases"]')).not.toBeNull();

    act(() => opcion("Grupos de una base").click());
    expect(argsDelPlan().cruce).toBe("");
    expect(opcion("Grupos de una base").getAttribute("aria-checked")).toBe("true");
  });

  it("en otro graficador un `null` sigue borrando la clave", () => {
    usePlanStore.setState({
      plan: { slides: [{ id: SLIDE, tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_agrupadas", args: { cruce: "x" } } } }] } as never,
    });
    act(() => usePlanStore.getState().updateSlotArgs(SLIDE, "grafico", { cruce: null }));
    expect(argsDelPlan()).not.toHaveProperty("cruce");
  });
});
