// @vitest-environment happy-dom
// Editar los capítulos del resumen ejecutivo: lo que llega al plan es sólo lo completo, y lo que el editor no maneja
// viaja intacto. happy-dom no mide layout; la geometría se verifica en la captura.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../useCategoriasGrafico", () => ({
  useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
    { codigo: "1", etiqueta: "Público", n: 60, pct: 60, residual: false },
    { codigo: "2", etiqueta: "Privado", n: 40, pct: 40, residual: false },
  ] } }),
}));
vi.mock("../../useVariables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../useVariables")>()),
  useVariables: () => ({ sources: [], multi: false, loading: false, error: "", variables: [] }),
}));

const { CapitulosHallazgos } = await import("./CapitulosHallazgos");

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

const real = [{ titulo: "Información general", cifras: [{ var: "A11_recod", fila: "Privado", texto: "estudió en un colegio privado", comparacion: "auto", sumar_extra: 1 }] }];

function montar(valor: unknown, onCambio: (v: Record<string, unknown>[]) => void, modo = "resumen") {
  act(() => root.render(<CapitulosHallazgos valor={valor} modo={modo} automatica={false} calificar={(r) => r} scope="active" onCambio={onCambio} />));
}

const escribir = (el: HTMLInputElement | HTMLTextAreaElement, texto: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, texto);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const boton = (nombre: string) => [...host.querySelectorAll("button")].find((b) =>
  (b.getAttribute("aria-label") ?? b.querySelector(".pulso-chip-seleccion__texto, .pulso-f6-cat-texto")?.textContent ?? b.textContent ?? "").trim() === nombre)!;

describe("editar capítulos y hallazgos", () => {
  it("cambiar la respuesta y la comparación emite el capítulo con lo que no se edita intacto", () => {
    const onCambio = vi.fn();
    montar(real, onCambio);
    act(() => boton("Público").click());
    expect(onCambio).toHaveBeenLastCalledWith([{ titulo: "Información general", cifras: [
      { var: "A11_recod", fila: "Público", texto: "estudió en un colegio privado", comparacion: "auto", sumar_extra: 1 },
    ] }]);
    act(() => boton("Ninguna").click());
    expect(onCambio.mock.lastCall?.[0][0].cifras[0].comparacion).toBe("ninguna");
  });

  it("un capítulo nuevo no llega al plan hasta tener un hallazgo completo", () => {
    const onCambio = vi.fn();
    montar([], onCambio);
    act(() => boton("Agregar capítulo").click());
    expect(onCambio).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Falta la pregunta, la respuesta y el texto: no sale.");
    const titulo = host.querySelector<HTMLInputElement>('input[aria-label="Título del capítulo 1"]')!;
    act(() => escribir(titulo, "Trabajo"));
    expect(onCambio).not.toHaveBeenCalled();
    expect(host.querySelector("[aria-label='Capítulo \"Trabajo\"']")).not.toBeNull();
  });

  it("subir y bajar capítulos cambia su orden en el plan", () => {
    const onCambio = vi.fn();
    const dos = [real[0], { titulo: "Trabajo", cifras: [{ var: "P5", fila: "Sí", texto: "trabaja", comparacion: "auto" }] }];
    montar(dos, onCambio);
    expect(boton('Subir el capítulo "Información general"').disabled).toBe(true);
    act(() => boton('Subir el capítulo "Trabajo"').click());
    expect(onCambio.mock.lastCall?.[0].map((c: { titulo: string }) => c.titulo)).toEqual(["Trabajo", "Información general"]);
  });
});
