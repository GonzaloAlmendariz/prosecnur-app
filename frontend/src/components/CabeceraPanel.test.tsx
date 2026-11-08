// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../vendor/lucide-react";
import { CabeceraPanel } from "./CabeceraPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hoja = fs.readFileSync(path.join(__dirname, "kit-cabecera-panel.css"), "utf8");
const bloque = (sel: string) => {
  const i = hoja.indexOf(`${sel} {`);
  expect(i, sel).toBeGreaterThanOrEqual(0);
  return hoja.slice(i, hoja.indexOf("}", i));
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CabeceraPanel", () => {
  it("título de una línea con title, X con «Cerrar <titulo>» por defecto", () => {
    const html = renderToStaticMarkup(
      <CabeceraPanel titulo="Propuesta de láminas" tituloId="t1" onCerrar={() => {}} />,
    );
    expect(html).toContain('<h2 id="t1" class="pulso-cabecera-panel__titulo" title="Propuesta de láminas">');
    expect(html).toContain('aria-label="Cerrar Propuesta de láminas"');
    expect(html).toContain("pulso-cerrar");
    expect(html).not.toContain("pulso-cabecera-panel__subtitulo");
    expect(html).not.toContain("pulso-cabecera-panel__icono");
  });

  it("sin onCerrar no hay X; con subtítulo, ícono, acciones y nivel 3", () => {
    const html = renderToStaticMarkup(
      <CabeceraPanel
        titulo="Inspector"
        nivel={3}
        subtitulo="Base: 418 casos"
        icono={<Settings />}
        acciones={<button type="button">Restablecer</button>}
        etiquetaCerrar="Cerrar inspector de lámina"
      />,
    );
    expect(html).not.toContain("pulso-cerrar");
    expect(html).toContain("<h3");
    expect(html).toContain("pulso-cabecera-panel--con-subtitulo");
    expect(html).toContain('<span class="pulso-cabecera-panel__icono" aria-hidden="true">');
    expect(html).toContain('<div class="pulso-cabecera-panel__acciones">');
  });

  it("la X llama a onCerrar; Escape no (lo maneja la superficie)", () => {
    const onCerrar = vi.fn();
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    const root = createRoot(contenedor);
    act(() => root.render(<CabeceraPanel titulo="Avisos" onCerrar={onCerrar} etiquetaCerrar="Cerrar avisos" />));
    const x = contenedor.querySelector<HTMLButtonElement>('button[aria-label="Cerrar avisos"]');
    expect(x).not.toBeNull();
    act(() => {
      contenedor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onCerrar).not.toHaveBeenCalled();
    act(() => x!.click());
    expect(onCerrar).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("geometría: rejilla de cuatro pistas, alto de cabecera, filete y título por rol", () => {
    const raiz = bloque(".pulso-cabecera-panel");
    expect(raiz).toContain("grid-template-columns: auto minmax(0, 1fr) auto auto;");
    expect(raiz).toContain("min-height: var(--pulso-panel-head-h);");
    expect(raiz).toContain("padding-inline: var(--pulso-space-3);");
    expect(raiz).toContain("border-bottom: 1px solid var(--pulso-border);");
    expect(raiz).toContain("grid-template-rows: minmax(var(--pulso-close-size), auto);");
    const titulo = bloque(".pulso-cabecera-panel__titulo");
    expect(titulo).toContain("font-size: var(--pulso-type-title-size);");
    expect(titulo).toContain("font-weight: var(--pulso-type-title-weight);");
    expect(titulo).toContain("text-overflow: ellipsis;");
    expect(titulo).toContain("white-space: nowrap;");
    // La X y las acciones viven en la fila del título.
    expect(bloque(".pulso-cabecera-panel__cerrar")).toContain("grid-row: 1;");
    expect(bloque(".pulso-cabecera-panel__acciones")).toContain("grid-row: 1;");
    expect(hoja.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
