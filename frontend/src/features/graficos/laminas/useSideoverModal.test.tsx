// @vitest-environment happy-dom
// C1 de la ronda 4: a 1024 el inspector es un lateral modal con su Escape en captura. Con «Elegir cifra» abierto dentro,
// Escape cierra sólo el combobox y el inspector sigue abierto; un segundo Escape, ya sin la lista, cierra el inspector.
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { escapeDeComboboxAbierto, useSideoverModal } from "./useSideoverModal";

function Lateral({ onCerrado }: { onCerrado: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const retorno = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(true);
  const [lista, setLista] = useState(true);
  useSideoverModal({ activo: abierto, contenedor, retorno, onCerrar: () => { setAbierto(false); onCerrado(); } });
  return (
    <>
      <button ref={retorno} type="button">Ajustes</button>
      {abierto && (
        <div ref={contenedor} role="dialog" aria-label="Inspector">
          <input role="combobox" aria-expanded={lista} aria-label="Buscar cifra"
            onKeyDown={(e) => { if (e.key === "Escape" && lista) { e.preventDefault(); e.stopPropagation(); setLista(false); } }} />
        </div>
      )}
    </>
  );
}

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

const escape = (el: Element) => act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });

describe("useSideoverModal con un combobox abierto dentro", () => {
  it("Escape cierra la lista del combobox y no el inspector; el siguiente cierra el inspector", () => {
    let cerrado = 0;
    act(() => root.render(<Lateral onCerrado={() => { cerrado += 1; }} />));
    const input = host.querySelector("[role='combobox']") as HTMLInputElement;
    input.focus();
    escape(input);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("[role='dialog']")).not.toBeNull();
    expect(cerrado).toBe(0);
    escape(input);
    expect(host.querySelector("[role='dialog']")).toBeNull();
    expect(cerrado).toBe(1);
  });

  it("reconoce el objetivo dentro de un combobox abierto y nada más", () => {
    const abierto = document.createElement("div");
    abierto.setAttribute("role", "combobox");
    abierto.setAttribute("aria-expanded", "true");
    const hijo = document.createElement("span");
    abierto.appendChild(hijo);
    const cerrado = document.createElement("input");
    cerrado.setAttribute("role", "combobox");
    cerrado.setAttribute("aria-expanded", "false");
    expect(escapeDeComboboxAbierto(hijo)).toBe(true);
    expect(escapeDeComboboxAbierto(cerrado)).toBe(false);
    expect(escapeDeComboboxAbierto(null)).toBe(false);
  });
});
