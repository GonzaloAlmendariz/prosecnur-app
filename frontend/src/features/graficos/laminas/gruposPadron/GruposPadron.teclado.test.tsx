// @vitest-environment happy-dom
// X5: el orden de la lámina se cambia con efecto inmediato desde el teclado: Alt+Flecha arriba en la fila de un grupo
// incluido lo sube; en un grupo fuera de la lámina no hace nada. Subir en el borde no escribe (aria-disabled).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ fase: "cargando", reintentar: () => undefined }) }));
vi.mock("./useGuardaNoConfiables", () => ({ useGuardaNoConfiables: () => true }));
vi.mock("./usePadronPropuesto", () => ({
  usePadronPropuesto: () => ({ fase: "lista", propuestas: [], reintentar: () => undefined }),
  propuestasDe: () => [],
}));
vi.mock("../../../estudio/usePlannerModos", () => ({ usePlannerModos: () => ({ modos: null, error: null, recargar: async () => undefined }) }));

import { GruposPadron } from "./GruposPadron";

const OPCIONES = [{ codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" }];

describe("GruposPadron con teclado", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  const montar = (onCambio: (p: Record<string, unknown>) => void) => act(() => raiz.render(
    <MemoryRouter>
      <GruposPadron args={{ grupos: ["1", "2"] }} cruce="docentes$dedicacion" opciones={OPCIONES} scope="active" onCambio={onCambio} />
    </MemoryRouter>,
  ));

  const tecla = (el: Element, key: string, altKey: boolean) =>
    act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key, altKey, bubbles: true })); });

  const switchDe = (nombre: string) => [...contenedor.querySelectorAll('[role="switch"]')]
    .find((s) => s.textContent === nombre || s.getAttribute("aria-labelledby")
      ?.split(" ").some((id) => document.getElementById(id)?.textContent === nombre)) as HTMLElement;

  it("Alt+Flecha arriba sube el grupo; sin Alt o fuera de la lámina no escribe", () => {
    const onCambio = vi.fn();
    montar(onCambio);
    tecla(switchDe("TP"), "ArrowUp", true);
    expect(onCambio).toHaveBeenLastCalledWith({ grupos: ["2", "1"] });
    onCambio.mockClear();
    tecla(switchDe("TP"), "ArrowUp", false);
    tecla(switchDe("Contratado"), "ArrowUp", true);
    expect(onCambio).not.toHaveBeenCalled();
  });

  it("Subir en el primer lugar queda aria-disabled y no escribe; Bajar sí", () => {
    const onCambio = vi.fn();
    montar(onCambio);
    const subir = contenedor.querySelector('[aria-label="Subir TC"]') as HTMLButtonElement;
    expect(subir.getAttribute("aria-disabled")).toBe("true");
    act(() => subir.click());
    expect(onCambio).not.toHaveBeenCalled();
    act(() => (contenedor.querySelector('[aria-label="Bajar TC"]') as HTMLButtonElement).click());
    expect(onCambio).toHaveBeenLastCalledWith({ grupos: ["2", "1"] });
  });
});
