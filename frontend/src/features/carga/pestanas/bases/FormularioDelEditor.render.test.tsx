// @vitest-environment happy-dom
// "Usar el formulario del editor" en Carga (ítem 23 del checklist de validación
// del practicante): antes había que exportar el formulario de Formularios y
// volver a subirlo.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FormLibraryEntry } from "../../../../api/xlsformEditor";
import { FormularioDelEditor } from "./FormularioDelEditor";
import { formulariosDelEditor } from "./formularioDelEditorModelo";

const entrada = (id: string, name: string, n: number, active = false, saved_at = 0): FormLibraryEntry =>
  ({ id, name, n_questions: n, active, saved_at, source: null, publication: {} }) as unknown as FormLibraryEntry;

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

describe("formularios del editor que Carga puede usar", () => {
  it("solo los que tienen preguntas, el abierto primero y con el conteo concordado", () => {
    const lista = formulariosDelEditor([
      entrada("a", "Piloto", 0),
      entrada("b", "Encuesta hogares", 187, false, 2),
      entrada("c", "Breve", 1, true, 1),
    ]);
    expect(lista.map((f) => f.id)).toEqual(["c", "b"]);
    expect(lista[0]!.rotulo).toBe("Breve (1 pregunta)");
    expect(lista[1]!.rotulo).toBe("Encuesta hogares (187 preguntas)");
  });

  it("con un formulario lo nombra y al usarlo entrega su id", () => {
    const onUsar = vi.fn();
    const lista = formulariosDelEditor([entrada("b", "Encuesta hogares", 187)]);
    act(() => root.render(<FormularioDelEditor formularios={lista} ocupado={false} onUsar={onUsar} />));
    expect(host.textContent).toContain("Encuesta hogares (187 preguntas)");
    const boton = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Usar el formulario del editor");
    expect(boton).toBeTruthy();
    act(() => boton!.click());
    expect(onUsar).toHaveBeenCalledWith(expect.objectContaining({ id: "b", nombre: "Encuesta hogares" }));
  });

  it("sin formularios en el editor no aparece", () => {
    act(() => root.render(<FormularioDelEditor formularios={[]} ocupado={false} onUsar={() => undefined} />));
    expect(host.innerHTML).toBe("");
  });

  it("mientras otra carga está en curso no se puede usar", () => {
    const lista = formulariosDelEditor([entrada("b", "Encuesta hogares", 187)]);
    act(() => root.render(<FormularioDelEditor formularios={lista} ocupado onUsar={() => undefined} />));
    const boton = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Usar el formulario del editor");
    expect(boton?.disabled).toBe(true);
  });
});
