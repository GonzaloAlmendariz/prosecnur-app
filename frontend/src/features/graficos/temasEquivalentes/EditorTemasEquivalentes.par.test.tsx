// @vitest-environment happy-dom
// El par del contraste entre públicos se guarda en el payload (`bases`, graficos_dumbbell_auto.R): antes era un estado
// local del editor que no persistía y que ni el emparejado ni el conteo de la regla veían (prueba con Arte, tres públicos).
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../useVariables")>()),
  useVariables: () => ({
    sources: [{ name: "docentes", variables: [] }, { name: "estudiantes", variables: [] }, { name: "administrativos", variables: [] }],
    variables: [],
  }),
}));

vi.mock("./useEquivalenciasDeTemas", async () => {
  const { SIN_MATRIZ } = await import("../multiapiladas/sugerenciasMatriz");
  return { useEquivalenciasDeTemas: () => ({ matriz: SIN_MATRIZ, bases: [], periodos: [] }) };
});

import { EditorTemasEquivalentes } from "./EditorTemasEquivalentes";

let host: HTMLDivElement;
let root: Root;
const patches: Record<string, unknown>[] = [];

function Tarjeta({ inicial }: { inicial: Record<string, unknown> }) {
  const [args, setArgs] = useState<Record<string, unknown>>(inicial);
  return <EditorTemasEquivalentes tipo="brecha" args={args} onCambio={(p) => { patches.push(p); setArgs((a) => ({ ...a, ...p })); }} />;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  patches.length = 0;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const selects = () => [...host.querySelectorAll<HTMLSelectElement>(".pulso-teq-bases select")];
const elegir = (sel: HTMLSelectElement | undefined, valor: string) => {
  expect(sel).toBeTruthy();
  act(() => {
    if (!sel) return;
    sel.value = valor;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

describe("Públicos que se comparan", () => {
  it("en el resumen, lee el par de `bases` y lo escribe en el payload al cambiarlo", () => {
    act(() => root.render(<Tarjeta inicial={{ estilo: "resumen", bases: ["docentes", "estudiantes"] }} />));
    const grupo = host.querySelector(".pulso-teq-bases");
    const rotulo = grupo && host.querySelector(`#${CSS.escape(grupo.getAttribute("aria-labelledby") ?? "")}`);
    expect(rotulo?.textContent).toContain("Públicos que se comparan");
    expect(rotulo?.querySelector("button[aria-label]")).toBeTruthy();
    expect(selects().map((s) => s.value)).toEqual(["docentes", "estudiantes", ""]);
    // Sin temas y con el par elegido, el motor empareja las comunes: no pide temas.
    expect(host.textContent).not.toContain("Agrega al menos un tema.");

    elegir(selects()[1], "administrativos");
    expect(patches.at(-1)).toEqual({ bases: ["docentes", "administrativos"] });
    expect(selects().map((s) => s.value)).toEqual(["docentes", "administrativos", ""]);

    // Elegir como primero el que era el segundo los intercambia.
    elegir(selects()[0], "administrativos");
    expect(patches.at(-1)).toEqual({ bases: ["administrativos", "docentes"] });
  });

  it("con tres públicos y nada elegido, ofrece tres casillas vacías y pide elegir (no decide por el analista)", () => {
    act(() => root.render(<Tarjeta inicial={{ estilo: "resumen" }} />));
    expect(selects().map((s) => s.value)).toEqual(["", "", ""]);
    expect(host.textContent).toContain("Elige de dos a cuatro públicos que se comparan.");
    expect([...selects()[2]!.options].map((o) => o.text)[0]).toBe("Tercer público (opcional)…");
  });

  it("el analista puede elegir un par o los tres", () => {
    act(() => root.render(<Tarjeta inicial={{ estilo: "resumen" }} />));
    elegir(selects()[0], "docentes");
    elegir(selects()[1], "estudiantes");
    expect(patches.at(-1)).toEqual({ bases: ["docentes", "estudiantes"] });
    expect(host.textContent).not.toContain("Elige de dos a cuatro");
    elegir(selects()[2], "administrativos");
    expect(patches.at(-1)).toEqual({ bases: ["docentes", "estudiantes", "administrativos"] });
    expect(selects().map((s) => s.value)).toEqual(["docentes", "estudiantes", "administrativos"]);
    expect(host.textContent).not.toContain("Elige de dos a cuatro");
    // Vaciar la tercera vuelve al par.
    elegir(selects()[2], "");
    expect(patches.at(-1)).toEqual({ bases: ["docentes", "estudiantes"] });
  });

  it("en el recetario la tercera base elegida se conserva aunque las preguntas aún no la tengan", () => {
    act(() => root.render(<Tarjeta inicial={{ vars: { t1: ["docentes$p1", "estudiantes$p1"] } }} />));
    expect(selects().map((s) => s.value)).toEqual(["docentes", "estudiantes", ""]);
    elegir(selects()[2], "administrativos");
    expect(selects().map((s) => s.value)).toEqual(["docentes", "estudiantes", "administrativos"]);
    expect(host.textContent).toContain("falta la pregunta de Administrativos");
  });

  it("en el recetario no escribe `bases` (sin preguntas implicaría una regla que ese estilo rechaza)", () => {
    act(() => root.render(<Tarjeta inicial={{}} />));
    elegir(selects()[0], "docentes");
    expect(patches).toEqual([]);
    expect(selects()[0]?.value).toBe("docentes");
  });
});
