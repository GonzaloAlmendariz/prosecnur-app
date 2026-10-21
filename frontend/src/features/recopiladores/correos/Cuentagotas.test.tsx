import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Cuentagotas, cuentagotasDisponible, normalizarHex, tomarColor, type ConstructorDelCuentagotas } from "./Cuentagotas";

function cuentagotasFalso(abrir: () => Promise<{ sRGBHex: string }>): ConstructorDelCuentagotas {
  return class {
    open() {
      return abrir();
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cuentagotas", () => {
  it("sin EyeDropper no se renderiza", () => {
    vi.stubGlobal("window", {});
    expect(cuentagotasDisponible()).toBeNull();
    expect(renderToStaticMarkup(<Cuentagotas nombre="el acento" onChange={() => undefined} />)).toBe("");
  });

  it("con EyeDropper se renderiza con nombre accesible y tooltip", () => {
    vi.stubGlobal("window", { EyeDropper: cuentagotasFalso(async () => ({ sRGBHex: "#000000" })) });
    const html = renderToStaticMarkup(<Cuentagotas nombre="el acento" onChange={() => undefined} />);
    expect(html).toContain('aria-label="Tomar el color de la pantalla para el acento"');
    expect(html).toContain('title="Tomar el color de la pantalla"');
  });

  it("con un EyeDropper falso entrega el color normalizado al onChange", async () => {
    const onChange = vi.fn();
    await tomarColor(cuentagotasFalso(async () => ({ sRGBHex: "#0B1F54" })), onChange);
    await tomarColor(cuentagotasFalso(async () => ({ sRGBHex: "rgb(255, 204, 0)" })), onChange);
    expect(onChange.mock.calls).toEqual([["#0b1f54"], ["#ffcc00"]]);
  });

  it("AbortError (Esc) no llama onChange", async () => {
    const onChange = vi.fn();
    const abort = new Error("cancelado");
    abort.name = "AbortError";
    await expect(tomarColor(cuentagotasFalso(async () => Promise.reject(abort)), onChange)).resolves.toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("normaliza a #rrggbb en minúsculas y descarta lo que no es color", () => {
    expect(normalizarHex(" #ABC ")).toBe("#aabbcc");
    expect(normalizarHex("rgba(1, 2, 3, 1)")).toBe("#010203");
    expect(normalizarHex("rojo")).toBeNull();
  });
});
