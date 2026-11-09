// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RitmoVista } from "./Ritmo";

const actores = [
  { Actor: "Estudiantes", "Última efectiva": "2026-05-29" },
  { Actor: "Docentes", "Última efectiva": "2026-05-26" },
];
const diarioPorPublico = [
  { Actor: "Estudiantes", Fecha: "2026-05-25", Efectivas: 10 },
  { Actor: "Estudiantes", Fecha: "2026-05-29", Efectivas: 4 },
  { Actor: "Docentes", Fecha: "2026-05-26", Efectivas: 3 },
];

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
});

function boton(texto: string): HTMLButtonElement {
  const encontrado = [...host.querySelectorAll<HTMLButtonElement>(".acr-ri-filtro button")].find((b) => b.textContent?.startsWith(texto));
  if (!encontrado) throw new Error(`No hay botón "${texto}" en la botonera`);
  return encontrado;
}

describe("Avance › Ritmo, un público a la vez", () => {
  it("un clic en la botonera aísla al público; otro clic vuelve a Todos", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/monitoreo?seccion=avance&pestana=ritmo"]}><RitmoVista actores={actores} diarioGeneral={[]} diarioPorPublico={diarioPorPublico} fuentes={[]} fases={[]} onDeclararFases={() => {}} /></MemoryRouter>));
    expect(boton("Todos").getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("por público");

    act(() => boton("Docentes").click());
    expect(boton("Docentes").getAttribute("aria-pressed")).toBe("true");
    expect(boton("Todos").getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector("h3")?.textContent).toContain("Docentes");

    act(() => boton("Docentes").click());
    expect(boton("Todos").getAttribute("aria-pressed")).toBe("true");
  });

  it("el público elegido sigue elegido al pasar a Diario y acumulado", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/monitoreo?seccion=avance&pestana=ritmo"]}><RitmoVista actores={actores} diarioGeneral={[]} diarioPorPublico={diarioPorPublico} fuentes={[]} fases={[]} onDeclararFases={() => {}} /></MemoryRouter>));
    act(() => boton("Estudiantes").click());
    const acumulado = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Diario y acumulado");
    act(() => acumulado?.click());
    expect(boton("Estudiantes").getAttribute("aria-pressed")).toBe("true");
    // El acumulado es el del público: 14 efectivas, no las 17 del estudio.
    expect(host.textContent).toContain("Acumulado 14");
  });
});
