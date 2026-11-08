// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotonCerrar, type BotonCerrarProps } from "./BotonCerrar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hoja = fs.readFileSync(path.join(__dirname, "kit-cerrar.css"), "utf8");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("BotonCerrar", () => {
  it("es un botón quieto con la X del shim y su nombre accesible", () => {
    const html = renderToStaticMarkup(<BotonCerrar aria-label="Cerrar propuesta" onClick={() => {}} />);
    expect(html).toContain('aria-label="Cerrar propuesta"');
    expect(html).toContain('type="button"');
    expect(html).toContain(
      'class="pulso-button pulso-button--icon pulso-button--md pulso-button--quiet pulso-cerrar pulso-cerrar--md"',
    );
    expect(html).toContain("lucide-x");
    expect(html).toContain('aria-hidden="true"');
  });

  it("sm usa la clase de fila densa", () => {
    const html = renderToStaticMarkup(<BotonCerrar size="sm" aria-label="Cerrar aviso" />);
    expect(html).toContain("pulso-button--sm pulso-button--quiet pulso-cerrar pulso-cerrar--sm");
  });

  it("exige «Cerrar …» como nombre accesible en compilación", () => {
    // @ts-expect-error sin aria-label no compila.
    const sinNombre: BotonCerrarProps = {};
    // @ts-expect-error «Cerrar» sin objeto no compila.
    const sinObjeto: BotonCerrarProps = { "aria-label": "Cerrar" };
    // @ts-expect-error un nombre que no empieza por «Cerrar » no compila.
    const otroVerbo: BotonCerrarProps = { "aria-label": "Salir" };
    const titulo: string = "Propuesta";
    const dinamico: BotonCerrarProps = { "aria-label": `Cerrar ${titulo}` };
    expect([sinNombre, sinObjeto, otroVerbo, dinamico]).toHaveLength(4);
  });

  it("dispara onClick y NO maneja Escape (eso es de la superficie)", () => {
    const onClick = vi.fn();
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    const root = createRoot(contenedor);
    act(() => root.render(<BotonCerrar aria-label="Cerrar panel" onClick={onClick} />));
    const boton = contenedor.querySelector("button");
    expect(boton).not.toBeNull();
    act(() => {
      boton!.focus();
      boton!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClick).not.toHaveBeenCalled();
    act(() => boton!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("caja de 28 con ícono 16; sm de 20 con ícono 14; sin sombra ni hex", () => {
    expect(hoja).toMatch(/\.pulso-cerrar \{[^}]*--pulso-button-height: var\(--pulso-close-size\);[^}]*--pulso-quiet-icon: var\(--pulso-icon-size-md\);[^}]*box-shadow: none;/);
    expect(hoja).toMatch(/\.pulso-cerrar--sm \{[^}]*--pulso-quiet-icon: var\(--pulso-icon-size-sm\);/);
    expect(hoja.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
