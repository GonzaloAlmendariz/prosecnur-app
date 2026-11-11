// @vitest-environment happy-dom
/**
 * El efecto se vuelve a pedir cuando cambia la base sobre la que se pondera
 * aunque la config de ponderación siga igual.
 *
 * Reproducción del QA: con una condición nueva en "Qué casos cuentan", la banda
 * pasaba a "Cuentan 426 de 1,283 casos" y "Tamaño efectivo" seguía diciendo "de
 * 1,283 casos", sin atenuar, hasta tocar una meta.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PonderPreview } from "../../../api/analitica";
import type { PonderacionConfig } from "../store";
import { claveDeLaBase, siguienteVersion } from "./useBaseDelCalculo";

const sesion = { active_base: "hogares", analitica_fuente: "originales" };
const preview = vi.fn<() => Promise<PonderPreview>>();

vi.mock("../../../api/analitica", async (original) => ({
  ...(await original<typeof import("../../../api/analitica")>()),
  apiAnaliticaPonderacionPreview: () => preview(),
  apiAnaliticaVariables: () => Promise.resolve({ ok: true, variables: [{ name: "sexo", label: "Sexo", categorica: true, numerica: false }], grain: null }),
  apiAnaliticaColumnValues: (name: string) => Promise.resolve({ ok: true, column: name, n_total: 0, truncated: false, values: [{ value: "1", label: "1" }, { value: "2", label: "2" }] }),
  apiAnaliticaDataReview: () => Promise.resolve({ ok: true, variables: [] }),
}));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { ...sesion } }) }));
vi.mock("../../project/ProjectModulesContext", () => ({ useProjectModules: () => ({ overview: null }) }));

const POND: PonderacionConfig = { enabled: true, poblacion: "marco", rake: { margins: [{ var: "sexo", targets: { "1": 48, "2": 52 } }] } };
const diag = (n: number) => ({ n, n_eff: Math.round(n * 0.8), deff: 1.25, cv: 0.5, loss_pct: 20, min: 0.4, max: 3, mean: 1, median: 1, ratio_max_min: 7.5 });
const resultado = (n: number): PonderPreview => ({
  ok: true, rake_applied: true, diagnostics: diag(n), warnings: [],
  margins: { sexo: [{ categoria: "1", objetivo: 0.48, muestra: 0.4, ponderado: 0.48 }, { categoria: "2", objetivo: 0.52, muestra: 0.6, ponderado: 0.52 }] },
});

let host: HTMLDivElement;
let root: Root;
let navegar: NavigateFunction;
let repintar: () => void;

function Navegador() {
  navegar = useNavigate();
  return null;
}

const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const ir = async (search: string) => { await act(async () => { navegar({ pathname: "/analitica", search }, { replace: true }); }); };
const efecto = () => host.querySelector<HTMLElement>(".pond-efecto");
const tabla = () => host.querySelector<HTMLElement>(".pond-metas");

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  sesion.active_base = "hogares";
  sesion.analitica_fuente = "originales";
  preview.mockReset().mockResolvedValue(resultado(1283));
  const { useAnaliticaStore } = await import("../store");
  useAnaliticaStore.setState({ config: { ...useAnaliticaStore.getState().config, ponderacion: POND } });
  const { PonderacionPane } = await import("../panes/PonderacionPane");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const arbol = () => (
    <MemoryRouter initialEntries={["/analitica?pestana=ponderacion"]}>
      <Navegador />
      <PonderacionPane />
    </MemoryRouter>
  );
  repintar = () => root.render(arbol());
  await act(async () => { repintar(); });
  await avanzar(600);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("Ponderación: el efecto sigue a la base sobre la que se pondera", () => {
  it("la clave cambia con la base activa, con la fuente y con cada cierre del panel del universo", () => {
    const base = claveDeLaBase("hogares", "originales", 0);
    expect(claveDeLaBase("hogares", "originales", 0)).toBe(base);
    expect(claveDeLaBase("personas", "originales", 0)).not.toBe(base);
    expect(claveDeLaBase("hogares", "adaptados", 0)).not.toBe(base);
    expect(claveDeLaBase("hogares", "originales", 1)).not.toBe(base);
    // Solo el paso de abierto a cerrado cuenta: es cuando el universo pudo cambiar.
    expect(siguienteVersion(3, true, false)).toBe(4);
    expect(siguienteVersion(3, false, true)).toBe(3);
    expect(siguienteVersion(3, false, false)).toBe(3);
    expect(siguienteVersion(3, true, true)).toBe(3);
  });

  it("cambia el universo sin cambiar la ponderación y se pide un cálculo nuevo", async () => {
    expect(preview).toHaveBeenCalledTimes(1);
    expect(efecto()?.textContent).toContain("de 1,283 casos");
    expect(efecto()?.hasAttribute("data-recalculando")).toBe(false);

    // Se abre "Qué casos cuentan": todavía no cambió nada.
    await ir("?pestana=ponderacion&panel=universo");
    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(1);

    // Se cierra con una condición nueva: el motor ya pondera sobre 426 casos.
    preview.mockResolvedValue(resultado(426));
    await ir("?pestana=ponderacion");
    // Mientras llega la respuesta, lo que se ve es del universo anterior y va atenuado.
    expect(efecto()?.hasAttribute("data-recalculando")).toBe(true);
    expect(tabla()?.hasAttribute("data-recalculando")).toBe(true);

    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(2);
    expect(efecto()?.textContent).toContain("de 426 casos");
    expect(efecto()?.textContent).not.toContain("de 1,283 casos");
    expect(efecto()?.hasAttribute("data-recalculando")).toBe(false);
    expect(tabla()?.hasAttribute("data-recalculando")).toBe(false);
  });

  it("la base activa y la fuente también cuentan aunque la config sea la misma", async () => {
    sesion.active_base = "personas";
    await act(async () => { repintar(); });
    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(2);

    sesion.analitica_fuente = "adaptados";
    await act(async () => { repintar(); });
    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(3);
  });

  it("sin ningún cambio no se vuelve a pedir", async () => {
    await act(async () => { repintar(); });
    await avanzar(1200);
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("la respuesta del universo anterior que llega tarde se descarta", async () => {
    let soltar: (p: PonderPreview) => void = () => undefined;
    preview.mockReturnValueOnce(new Promise<PonderPreview>((r) => { soltar = r; }));
    await ir("?pestana=ponderacion&panel=universo");
    await ir("?pestana=ponderacion");
    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(2);

    // Otro cierre antes de que la anterior vuelva: esa respuesta ya no vale.
    preview.mockResolvedValue(resultado(426));
    await ir("?pestana=ponderacion&panel=universo");
    await ir("?pestana=ponderacion");
    await avanzar(600);
    expect(preview).toHaveBeenCalledTimes(3);
    expect(efecto()?.textContent).toContain("de 426 casos");

    await act(async () => { soltar(resultado(999)); });
    await avanzar(50);
    expect(efecto()?.textContent).toContain("de 426 casos");
    expect(efecto()?.textContent).not.toContain("de 999 casos");
  });
});
