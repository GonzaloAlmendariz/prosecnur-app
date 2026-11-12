// @vitest-environment happy-dom
/**
 * El campo de etiqueta del inspector de Datos (H3 del QA): una etiqueta larga
 * baja de línea en vez de cortarse, y sigue siendo una sola línea de texto:
 * Enter no inserta un salto y un salto pegado se vuelve espacio.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CampoDeEtiqueta } from "./CampoDeEtiqueta";

let host: HTMLDivElement;
let root: Root;
let valores: string[];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  valores = [];
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function montar(value: string) {
  await act(async () => {
    root.render(<CampoDeEtiqueta aria-label="Etiqueta" value={value} invalid={!value} onValor={(v) => valores.push(v)} />);
  });
  return host.querySelector("textarea") as HTMLTextAreaElement;
}

describe("CampoDeEtiqueta", () => {
  it("es un campo de texto de varias líneas con el aspecto del kit", async () => {
    const campo = await montar("Si está de acuerdo en participar en la encuesta");
    expect(campo.tagName).toBe("TEXTAREA");
    expect(campo.getAttribute("rows")).toBe("1");
    expect(campo.className).toContain("pulso-input");
    expect(campo.className).toContain("datos-campo-etiqueta");
    expect(campo.value).toBe("Si está de acuerdo en participar en la encuesta");
  });

  it("Enter no inserta un salto", async () => {
    const campo = await montar("Sexo");
    const evento = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => { campo.dispatchEvent(evento); });
    expect(evento.defaultPrevented).toBe(true);
  });

  it("un salto pegado se vuelve espacio", async () => {
    const campo = await montar("Sexo");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(campo, "Sexo\ndel encuestado");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(valores.at(-1)).toBe("Sexo del encuestado");
  });

  it("marca el vacío como inválido", async () => {
    const campo = await montar("");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
  });
});
