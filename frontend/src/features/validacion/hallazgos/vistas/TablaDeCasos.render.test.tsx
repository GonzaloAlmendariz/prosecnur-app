// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { FilaDeCaso } from "../modeloHallazgos";
import { TablaDeCasos } from "./TablaDeCasos";

const fila = (id: string): FilaDeCaso => ({ id, clave: id, valores: { p3: "15" }, contexto: null, esperado: null });

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

function pintar() {
  act(() => {
    root.render(
      <TablaDeCasos
        columnas={[{ clave: "p3", rotulo: "P3", tipo: "falla", numerica: true }]}
        filas={[fila("principal::idx::482"), fila("principal::idx::17")]}
        marcados={new Set()}
        onMarcar={() => undefined}
        onMarcarTodos={() => undefined}
        onAbrirCaso={() => undefined}
        tono="inconsistencia"
        marcable
      />,
    );
  });
}

function escribir(input: HTMLInputElement, texto: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TablaDeCasos", () => {
  test("un caso sin columna de id se nombra por su fila, con el id interno en el título", () => {
    pintar();
    const botones = [...host.querySelectorAll<HTMLButtonElement>(".pulso-hz-casoid")];
    expect(botones.map((b) => b.textContent)).toEqual(["Fila 482", "Fila 17"]);
    expect(botones[0].title).toContain("Identificador interno: principal::idx::482");
  });

  test("la búsqueda encuentra el caso por su rótulo", () => {
    pintar();
    const input = host.querySelector<HTMLInputElement>("input");
    expect(input).not.toBeNull();
    escribir(input as HTMLInputElement, "fila 17");
    expect([...host.querySelectorAll(".pulso-hz-casoid")].map((b) => b.textContent)).toEqual(["Fila 17"]);
  });
});
