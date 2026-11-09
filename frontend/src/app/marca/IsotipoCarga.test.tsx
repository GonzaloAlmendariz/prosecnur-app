// @vitest-environment happy-dom
/**
 * R11-1: el isotipo de carga anima sin estado de React. Con un `setState` por requestAnimationFrame, cada cuadro
 * encolaba una actualización Default que interrumpía el reintento de Suspense y «Vista general» nunca montaba con
 * el movimiento activado (marca-en-false a los 180 s). Aquí se simulan los cuadros a mano.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Profiler, Suspense, act, lazy } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CargaDeModulo } from "../../components/CargaDeModulo";
import { IsotipoCarga } from "./IsotipoCarga";
import { IsotipoTrenza } from "./IsotipoTrenza";
import { marcadoTrenza } from "./trenzaMarcado";

let host: HTMLDivElement;
let root: Root;
let colaRaf: Map<number, FrameRequestCallback>;
let reloj = 0;

function cuadros(n: number) {
  for (let i = 0; i < n; i++) {
    reloj += 16;
    const cola = [...colaRaf.entries()];
    colaRaf.clear();
    for (const [, cb] of cola) cb(reloj);
  }
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  colaRaf = new Map();
  reloj = 0;
  let siguiente = 1;
  vi.spyOn(performance, "now").mockImplementation(() => reloj);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { const n = siguiente++; colaRaf.set(n, cb); return n; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((n) => { colaRaf.delete(n); });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe("IsotipoCarga anima sin pasar por React (R11-1)", () => {
  it("los cuadros cambian el svg y React no vuelve a renderizar", () => {
    const commits: string[] = [];
    act(() => {
      root.render(
        <Profiler id="isotipo" onRender={(_id, fase) => commits.push(fase)}>
          <IsotipoCarga />
        </Profiler>,
      );
    });
    expect(commits).toEqual(["mount"]);
    const svg = host.querySelector("svg.pulso-isotipo");
    expect(svg).not.toBeNull();
    const antes = svg?.innerHTML;
    act(() => cuadros(30));
    expect(svg?.innerHTML).not.toBe(antes);
    expect(commits).toEqual(["mount"]);
  });

  it("un módulo perezoso detrás de CargaDeModulo monta aunque los cuadros sigan corriendo", async () => {
    let resolver: (m: { default: () => JSX.Element }) => void = () => undefined;
    const promesa = new Promise<{ default: () => JSX.Element }>((r) => { resolver = r; });
    function Pesado() {
      // un hijo cuyo render no cabe en un cuadro
      const filas = Array.from({ length: 2000 }, (_, i) => <li key={i}>{i}</li>);
      return <ul data-pesado="si">{filas}</ul>;
    }
    const Perezoso = lazy(() => promesa);
    act(() => {
      root.render(
        <Suspense fallback={<CargaDeModulo label="Cargando la vista general…" />}>
          <Perezoso />
        </Suspense>,
      );
    });
    expect(host.textContent).toContain("Cargando la vista general…");
    act(() => cuadros(5));
    await act(async () => {
      resolver({ default: Pesado });
      await promesa;
      cuadros(5);
    });
    expect(host.querySelector('[data-pesado="si"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Cargando la vista general…");
  });

  it("firma se asienta en la pose quieta y deja de pedir cuadros", () => {
    act(() => root.render(<IsotipoCarga modo="firma" />));
    const svg = host.querySelector("svg.pulso-isotipo");
    const quieto = svg?.innerHTML;
    act(() => cuadros(5));
    expect(svg?.innerHTML).not.toBe(quieto);
    act(() => cuadros(200));
    expect(colaRaf.size).toBe(0);
    expect(svg?.innerHTML).toBe(quieto);
  });

  it("guard: el isotipo de carga no guarda estado de React", () => {
    const fuente = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "IsotipoCarga.tsx"), "utf8");
    expect(fuente).not.toMatch(/\buseState\b|\buseReducer\b|\bsetT\(/);
  });
});

describe("marcadoTrenza dibuja lo mismo que IsotipoTrenza", () => {
  it("en la pose quieta y en una pose en movimiento", () => {
    const normalizar = (html: string) => html.replace(/trz[a-zA-Z0-9_-]*?-/g, "ID-").replace(/\s+/g, " ");
    for (const pose of [{}, { m: 0.6, om: 1.2, pasos: 150, paradas: 7 }]) {
      const jsx = renderToStaticMarkup(<IsotipoTrenza {...pose} />);
      const interior = jsx.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      expect(normalizar(marcadoTrenza("trzX", pose))).toBe(normalizar(interior));
    }
  });
});
