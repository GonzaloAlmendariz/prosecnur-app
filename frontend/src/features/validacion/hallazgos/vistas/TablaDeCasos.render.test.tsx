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

  test("una batería de 14 preguntas va en una fila de respuestas por caso, en código corto y con su etiqueta en el título", () => {
    // Ítem 33 del checklist de Validación (QA2, 2026-11-12).
    const items = Array.from({ length: 14 }, (_, i) => ({ clave: `p29_${i + 1}`, rotulo: `Ítem ${i + 1}`, tipo: "pregunta" as const, numerica: false }));
    const valores = Object.fromEntries(items.map((c) => [c.clave, "Fuertemente en desacuerdo (1)"]));
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[...items, { clave: "bateria:patron", rotulo: "En la batería", tipo: "falla", numerica: false }]}
          filas={[{ id: "c1", clave: "c1", valores: { ...valores, "bateria:patron": "respondió lo mismo" }, contexto: null, esperado: null }]}
          marcados={new Set()}
          onMarcar={() => undefined}
          onMarcarTodos={() => undefined}
          onAbrirCaso={() => undefined}
          tono="revisar"
          marcable
        />,
      );
    });
    const cabeceras = [...host.querySelectorAll('[role="columnheader"]')].map((c) => c.textContent);
    expect(cabeceras).toEqual(["Marca", "Caso", "En la batería", "Respuestas de p29_1 a p29_14"]);
    const fila = host.querySelectorAll('[role="row"]')[1];
    expect(fila.querySelectorAll('[role="cell"]')).toHaveLength(cabeceras.length);
    const respuestas = [...fila.querySelectorAll(".pulso-hz-respuestas-fila > li")];
    expect(respuestas).toHaveLength(14);
    expect(respuestas[0].textContent).toBe("p29_1: 1");
    expect(respuestas[0].getAttribute("title")).toBe("p29_1 Ítem 1: Fuertemente en desacuerdo (1)");
  });

  test("lo leído de una fecha va en una línea con el motivo debajo", () => {
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[{ clave: "fechas:lectura", rotulo: "Leído", tipo: "falla", numerica: false }]}
          filas={[{
            id: "c1",
            clave: "c1",
            valores: { "fechas:lectura": "registró \"08.11.2026\" (08/11/2026) en fecha, posterior al cierre del operativo (31/10/2026)" },
            contexto: null,
            esperado: { anomalia_tipo: null, subtipo: "fechas", sujeto: null, hecho: "registró \"08.11.2026\" (08/11/2026) en fecha", choque: "posterior al cierre del operativo (31/10/2026)", accion: null, texto: null },
          }]}
          marcados={new Set()}
          onMarcar={() => undefined}
          onMarcarTodos={() => undefined}
          onAbrirCaso={() => undefined}
          tono="revisar"
          marcable
        />,
      );
    });
    expect(host.querySelector(".pulso-hz-falla--linea")?.textContent).toBe("08.11.2026 → 08/11/2026");
    expect(host.querySelector(".pulso-hz-falla-motivo")?.textContent).toBe("posterior al cierre del operativo (31/10/2026)");
  });
});
