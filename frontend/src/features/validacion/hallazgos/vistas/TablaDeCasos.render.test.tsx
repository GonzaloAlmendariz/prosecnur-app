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

  test("fechas: el motivo una vez en el encabezado, la fecha leída (el original solo si difiere) y el N.º de encuesta como caso", () => {
    // Ítem 37 (Gonzalo, 2026-11-12): la columna "Leído" repetía el motivo en las 37 filas y "Fila 40" duplicaba el N.º.
    const fila = (d: string, n: string): FilaDeCaso => ({
      id: `principal::idx::${n}`,
      clave: n,
      valores: { "ctx:numero_encuesta": n, fecha: `${d}.11.2026` },
      contexto: null,
      esperado: { anomalia_tipo: null, subtipo: "fechas", sujeto: null, hecho: `registró "${d}.11.2026" (${d}/11/2026)`, choque: "posterior al cierre del operativo (31/10/2026)", accion: null, texto: null },
    });
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[
            { clave: "ctx:numero_encuesta", rotulo: "N.º de encuesta", tipo: "contexto", numerica: false },
            { clave: "fecha", rotulo: "Fecha de la entrevista", tipo: "pregunta", numerica: false },
            { clave: "fechas:lectura", rotulo: "Leído", tipo: "falla", numerica: false },
          ]}
          filas={[fila("01", "40"), fila("02", "47")]}
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
    expect(cabeceras).toEqual(["Marca", "N.º de encuesta", "Fecha de la entrevistaCierre del operativo: 31.10.2026"]);
    expect([...host.querySelectorAll(".pulso-hz-casoid")].map((b) => b.textContent)).toEqual(["40", "47"]);
    const celda = host.querySelectorAll('[role="row"]')[1].querySelectorAll('[role="cell"]')[2];
    // Fecha leída y texto original coinciden (dd.mm.aaaa): se dice una vez.
    expect(celda.textContent).toBe("01.11.2026");
    expect(celda.querySelector(".pulso-hz-celda-gris")).toBeNull();
    expect(host.textContent).not.toContain("posterior al cierre");
    expect(host.textContent).not.toContain("Fila 40");
  });

  test("una columna igual en todos los casos se dice una vez, encima de la tabla", () => {
    const fila = (n: string): FilaDeCaso => ({ id: n, clave: n, valores: { p8: "Sí", p10: "Vacía", r: n === "a" ? "Ana" : "Luis" }, contexto: null, esperado: null });
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[
            { clave: "r", rotulo: "Recopilador", tipo: "contexto", numerica: false },
            { clave: "p8", rotulo: "¿Trabaja actualmente?", tipo: "pregunta", numerica: false },
            { clave: "p10", rotulo: "Sector", tipo: "falla", numerica: false },
          ]}
          filas={[fila("a"), fila("b")]}
          marcados={new Set()}
          onMarcar={() => undefined}
          onMarcarTodos={() => undefined}
          onAbrirCaso={() => undefined}
          tono="inconsistencia"
          marcable
        />,
      );
    });
    expect(host.querySelector(".pulso-hz-comunes-titulo")?.textContent).toBe("Común a los 2 casos");
    expect([...host.querySelectorAll(".pulso-hz-comunes dt")].map((d) => d.textContent)).toEqual(["¿Trabaja actualmente?", "Sector"]);
    expect([...host.querySelectorAll('[role="columnheader"]')].map((c) => c.textContent)).toEqual(["Marca", "Caso", "Recopilador"]);
  });

  // Ítem 49 (QA30b): las casillas quedaban deshabilitadas con "Dejar como está" sin decir por qué.
  test("sin casos marcables, la tabla dice la causa en una línea y en cada marca", () => {
    const fila = (n: string): FilaDeCaso => ({ id: n, clave: n, valores: { p8: "Sí" }, contexto: null, esperado: null });
    const causa = "\"Dejar como está\" cubre todos los casos. Elige otro tratamiento para marcar algunos.";
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[{ clave: "p8", rotulo: "Pregunta", tipo: "falla", numerica: false }]}
          filas={[fila("a"), fila("b")]}
          marcados={new Set()}
          onMarcar={() => undefined}
          onMarcarTodos={() => undefined}
          onAbrirCaso={() => undefined}
          tono="inconsistencia"
          marcable={false}
          causaNoMarcable={causa}
        />,
      );
    });
    const linea = host.querySelector(".pulso-hz-seleccion-causa");
    expect(linea?.textContent).toBe(causa);
    const marca = host.querySelector<HTMLButtonElement>(".pulso-hz-marca");
    expect(marca?.disabled).toBe(true);
    expect(marca?.getAttribute("aria-describedby")).toBe(linea?.id);
    expect(marca?.title).toBe(causa);
  });

  test("con casos marcables no hay línea de causa", () => {
    const fila = (n: string): FilaDeCaso => ({ id: n, clave: n, valores: { p8: "Sí" }, contexto: null, esperado: null });
    act(() => {
      root.render(
        <TablaDeCasos
          columnas={[{ clave: "p8", rotulo: "Pregunta", tipo: "falla", numerica: false }]}
          filas={[fila("a")]}
          marcados={new Set()}
          onMarcar={() => undefined}
          onMarcarTodos={() => undefined}
          onAbrirCaso={() => undefined}
          tono="inconsistencia"
          marcable
          causaNoMarcable="No debe verse."
        />,
      );
    });
    expect(host.querySelector(".pulso-hz-seleccion-causa")).toBeNull();
  });
});

