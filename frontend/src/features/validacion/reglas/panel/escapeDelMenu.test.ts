// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { instalarEscapeDelMenu, MENU_ABIERTO } from "./escapeDelMenu";

function menu(estado: "open" | "closed") {
  const el = document.createElement("div");
  el.className = "pulso-select-content";
  el.dataset.state = estado;
  document.body.appendChild(el);
  return el;
}

function escape(destino: EventTarget = document.body) {
  destino.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

describe("Escape con un desplegable abierto en el panel de regla", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("el Escape es del desplegable: no llega al panel y le avisa que cierre", () => {
    const alPanel = vi.fn();
    const alRedimensionar = vi.fn();
    document.addEventListener("keydown", alPanel, true);
    window.addEventListener("resize", alRedimensionar);
    const quitar = instalarEscapeDelMenu(window);
    menu("open");
    escape();
    quitar();
    document.removeEventListener("keydown", alPanel, true);
    window.removeEventListener("resize", alRedimensionar);
    expect(alPanel).not.toHaveBeenCalled();
    expect(alRedimensionar).toHaveBeenCalledTimes(1);
  });

  it("sin desplegable abierto, el Escape sigue su camino hasta el panel", () => {
    const alPanel = vi.fn();
    document.addEventListener("keydown", alPanel, true);
    const quitar = instalarEscapeDelMenu(window);
    menu("closed");
    escape();
    quitar();
    document.removeEventListener("keydown", alPanel, true);
    expect(alPanel).toHaveBeenCalledTimes(1);
  });

  it("otras teclas no se tocan", () => {
    const alPanel = vi.fn();
    document.addEventListener("keydown", alPanel, true);
    const quitar = instalarEscapeDelMenu(window);
    menu("open");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    quitar();
    document.removeEventListener("keydown", alPanel, true);
    expect(alPanel).toHaveBeenCalledTimes(1);
  });

  it("reconoce el menú que abre el kit", () => {
    expect(MENU_ABIERTO).toContain("pulso-select-content");
  });
});
