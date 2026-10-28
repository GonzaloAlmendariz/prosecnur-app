// @vitest-environment happy-dom
/**
 * L11 — readiness de render, no de montaje: el contenedor de un gráfico dice
 * `data-audit-ready="false"` hasta que Plotly lo dibujó, y un fallo de Plotly
 * es un estado terminal clasificado (`vacio:grafico-con-error`), nunca un
 * `false` que deja colgado al QA.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const plotly = vi.hoisted(() => ({
  react: vi.fn(),
  purge: vi.fn(),
  Plots: { resize: vi.fn() },
}));
vi.mock("plotly.js-dist-min", () => ({ ...plotly, default: plotly }));

import { PlotlyChart } from "./PlotlyChart";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  plotly.react.mockReset();
});

const marca = () => host.querySelector(".dash-plotly-chart")?.getAttribute("data-audit-ready");
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("PlotlyChart publica cuándo terminó de dibujar", () => {
  test("está en false mientras Plotly dibuja y pasa a true al terminar", async () => {
    let terminar: () => void = () => {};
    plotly.react.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    act(() => root.render(<PlotlyChart data={[{ type: "bar", y: [1, 2] }]} />));
    await flush();
    expect(marca()).toBe("false");
    await act(async () => { terminar(); });
    await flush();
    expect(marca()).toBe("true");
  });

  test("si Plotly falla, la marca es terminal y no cuelga el QA", async () => {
    plotly.react.mockImplementation(() => Promise.reject(new Error("sin WebGL")));
    act(() => root.render(<PlotlyChart data={[{ type: "bar", y: [1] }]} />));
    await flush();
    expect(marca()).toBe("vacio:grafico-con-error");
  });
});
