// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../inventarioDeBase", () => ({
  pedirInventario: vi.fn(async () => ({
    secciones: [{ variables: [
      { name: "nro_encuesta", label: "Nro. de encuesta", tipo: "num", n_validos: 10, n_nulos: 0 },
      { name: "digitador", label: "Digitador", tipo: "texto", n_validos: 10, n_nulos: 0 },
    ] }],
  })),
}));

const { FichaDelCaso } = await import("./FichaDelCaso");

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("FichaDelCaso", () => {
  test("ofrece elegir el número de encuesta y el digitador, y quitar uno declarado", async () => {
    const cambios: Array<Record<string, string>> = [];
    await act(async () => {
      root.render(
        <FichaDelCaso baseNombre="principal" numero="nro_encuesta" digitador="" onChange={(c) => cambios.push(c)} />,
      );
    });
    expect(host.querySelector("[aria-label='Número de encuesta']")).not.toBeNull();
    expect(host.querySelector("[aria-label='Digitador']")).not.toBeNull();
    const quitar = host.querySelector<HTMLButtonElement>("button[aria-label='Quitar el número de encuesta']");
    expect(quitar).not.toBeNull();
    expect(host.querySelector("button[aria-label='Quitar el digitador']")).toBeNull();
    act(() => quitar?.click());
    expect(cambios).toEqual([{ survey_number_variable: "" }]);
  });
});
