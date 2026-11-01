// @vitest-environment happy-dom
/**
 * L31 · Home vivo: con el Home a la vista, `pulso:session-changed` recarga el resumen del proyecto (una vez por
 * ráfaga); fuera del Home no.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiProjectOverview: vi.fn(async () => ({
    modules: [],
    added_modules: [],
    maturity: { level: "new", has_any_work: false, readiness_score: 0, ready_count: 0, active_count: 0, warning_count: 0, pending_count: 0, total_count: 0 },
  })),
  apiProjectModulesSet: vi.fn(async () => ({})),
}));
vi.mock("../../api/client", () => api);
vi.mock("../../lib/SessionContext", () => ({ useSession: () => ({ sessionId: "sid-1" }) }));

import { ProjectModulesProvider } from "./ProjectModulesContext";
import { avisarCambioDelEstudio } from "../../lib/avisoDeCambioDelEstudio";

let host: HTMLDivElement;
let root: Root;

function montar(ruta: string) {
  act(() => root.render(<MemoryRouter initialEntries={[ruta]}><ProjectModulesProvider><span /></ProjectModulesProvider></MemoryRouter>));
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.apiProjectOverview.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("Home vivo (L31)", () => {
  test("en el Home, una ráfaga de cambios de sesión recarga una sola vez", async () => {
    montar("/");
    const alMontar = api.apiProjectOverview.mock.calls.length;
    act(() => {
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new Event("pulso:session-changed"));
    });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(api.apiProjectOverview.mock.calls.length).toBe(alMontar + 1);
  });

  test("en el Home, una base que llega por un import en segundo plano recarga sin cambiar de sesión (L31b)", async () => {
    montar("/");
    const alMontar = api.apiProjectOverview.mock.calls.length;
    act(() => { avisarCambioDelEstudio("prueba"); });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(api.apiProjectOverview.mock.calls.length).toBe(alMontar + 1);
  });

  test("fuera del Home, el cambio de sesión no recarga el resumen", async () => {
    montar("/carga");
    const alMontar = api.apiProjectOverview.mock.calls.length;
    act(() => { window.dispatchEvent(new Event("pulso:session-changed")); });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(api.apiProjectOverview.mock.calls.length).toBe(alMontar);
  });
});
