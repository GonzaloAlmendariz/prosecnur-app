// @vitest-environment happy-dom
// Hallazgo 12 (auditoría de Arte): el título se edita sobre el lienzo con un clic; Enter guarda, Escape cancela, y el
// campo nace con lo escrito o vacío con el marcador «Título», nunca con un título sugerido.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TituloEnLienzo } from "./TituloEnLienzo";

let host: HTMLDivElement;
let root: Root;
let guardados: string[] = [];

function Lienzo({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const [editando, setEditando] = useState(false);
  return (
    <TituloEnLienzo
      valor={valor}
      editando={editando}
      onEditar={() => setEditando(true)}
      onGuardar={(t) => { guardados.push(t); setValor(t); setEditando(false); }}
      onCancelar={() => setEditando(false)}
      variante="maqueta"
      mostrado={valor || <span className="is-vacio">Título</span>}
    />
  );
}

const campo = () => host.querySelector<HTMLInputElement>("input");
const boton = () => host.querySelector<HTMLButtonElement>("button");
const tecla = (key: string, extra: KeyboardEventInit = {}) =>
  act(() => { campo()!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra })); });
const escribir = (texto: string) => act(() => {
  const input = campo()!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, texto);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

beforeEach(() => {
  guardados = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("título en el lienzo", () => {
  it("un clic lo vuelve un campo vacío con el marcador «Título», enfocado", () => {
    act(() => root.render(<Lienzo inicial="" />));
    expect(boton()!.textContent).toBe("Título");
    expect(boton()!.getAttribute("aria-label")).toBe("Escribir el título");
    act(() => boton()!.click());
    expect(campo()!.value).toBe("");
    expect(campo()!.placeholder).toBe("Título");
    expect(document.activeElement).toBe(campo());
  });

  it("Enter guarda lo escrito y vuelve al título", () => {
    act(() => root.render(<Lienzo inicial="" />));
    act(() => boton()!.click());
    escribir("Satisfacción con el curso");
    tecla("Enter");
    expect(guardados).toEqual(["Satisfacción con el curso"]);
    expect(campo()).toBeNull();
    expect(boton()!.textContent).toBe("Satisfacción con el curso");
  });

  it("⌘↵ también guarda y no se consume: el atajo «Siguiente sin título» lo oye después", () => {
    act(() => root.render(<Lienzo inicial="A" />));
    act(() => boton()!.click());
    const ev = new KeyboardEvent("keydown", { key: "Enter", metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { campo()!.dispatchEvent(ev); });
    expect(guardados).toEqual(["A"]);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("Escape cancela: no guarda y conserva el título anterior", () => {
    act(() => root.render(<Lienzo inicial="Género" />));
    act(() => boton()!.click());
    expect(campo()!.value).toBe("Género");
    escribir("Otro");
    tecla("Escape");
    expect(guardados).toEqual([]);
    expect(campo()).toBeNull();
    expect(boton()!.textContent).toBe("Género");
  });
});
