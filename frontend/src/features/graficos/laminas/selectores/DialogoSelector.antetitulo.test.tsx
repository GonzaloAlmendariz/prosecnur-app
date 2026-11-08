// @vitest-environment happy-dom
// R5-11: el antetítulo partido deja fijo el número de la lámina y sólo la frase que lo precede cede con elipsis.
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../useLibraryDialogA11y", () => ({ useLibraryDialogA11y: () => ({}) }));

import { DialogoSelector } from "./DialogoSelector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ""; });

const pintar = (antetitulo: string | { texto: string; fijo: string }) => act(() => root.render(
  <DialogoSelector abierto onCerrar={() => undefined} panelProps={{ "data-pulso-panel": "tipo-lamina" }} auditReady="f6-selector-lamina"
    antetitulo={antetitulo} titulo="¿Qué quieres contar?" descripcion="d" focoInicialRef={createRef<HTMLInputElement>()}
    pregunta={null} galeria={null} detalle={null} />,
));

describe("antetítulo del selector", () => {
  it("partido: la frase cede y «lámina 22» va en su propio tramo fijo, con el texto completo para leer", () => {
    pintar({ texto: "Insertar después de la", fijo: "lámina 22" });
    const ante = document.body.querySelector(".pulso-f6-selector-antetitulo")!;
    expect(ante.classList.contains("is-partido")).toBe(true);
    expect(ante.querySelector(".pulso-f6-selector-antetitulo-cede")?.textContent).toBe("Insertar después de la");
    expect(ante.querySelector(".pulso-f6-selector-antetitulo-fijo")?.textContent).toBe("lámina 22");
    expect(ante.textContent).toBe("Insertar después de la lámina 22");
  });

  it("un texto suelto se pinta como siempre", () => {
    pintar("Lámina 3");
    const ante = document.body.querySelector(".pulso-f6-selector-antetitulo")!;
    expect(ante.classList.contains("is-partido")).toBe(false);
    expect(ante.textContent).toBe("Lámina 3");
  });
});
