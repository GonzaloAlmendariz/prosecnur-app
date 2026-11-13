// @vitest-environment happy-dom
// "Duplicar" en cada regla propia de la lista (ítem 44 del checklist del practicante).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilaRegla } from "./FilaRegla";
import { normalizarCatalogoCompleto } from "./modeloCatalogo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function reglaPropia() {
  const catalogo = normalizarCatalogoCompleto({
    ok: true,
    plan_construido: true,
    reglas: [
      {
        id: "RC_1", id_motor: "RC_1", origen: "propia", familia: "condiciones", familia_nombre: "Condiciones combinadas",
        nombre: "Condiciones combinadas: P8_6 y P16_7", frase: [{ texto: "Se marca." }], clase: "caso_a_revisar",
        tratamiento_previsto: { accion: null, alcance: null }, activa: true, estado_evaluacion: "evaluada", se_puede_desactivar: true,
      },
    ],
    familias: [],
    avisos: [],
  } as never);
  return catalogo.reglas[0];
}

let host: HTMLElement;
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

describe("Duplicar en la fila de una regla propia", () => {
  it("el botón lleva el nombre de la regla y avisa al hacer clic", () => {
    const alDuplicar = vi.fn();
    act(() =>
      root.render(
        <ul>
          <FilaRegla regla={reglaPropia()} elegida={false} conAviso={false} ocupada={false} onElegir={() => undefined} onActivar={() => undefined} onDuplicar={alDuplicar} />
        </ul>,
      ),
    );
    const boton = host.querySelector<HTMLButtonElement>('button[aria-label="Duplicar la regla Condiciones combinadas: P8_6 y P16_7"]');
    expect(boton).not.toBeNull();
    act(() => boton?.click());
    expect(alDuplicar).toHaveBeenCalledTimes(1);
  });

  it("una regla que no se puede duplicar no lo ofrece", () => {
    act(() =>
      root.render(
        <ul>
          <FilaRegla regla={reglaPropia()} elegida={false} conAviso={false} ocupada={false} onElegir={() => undefined} onActivar={() => undefined} />
        </ul>,
      ),
    );
    expect(host.querySelector('button[aria-label^="Duplicar"]')).toBeNull();
  });
});
