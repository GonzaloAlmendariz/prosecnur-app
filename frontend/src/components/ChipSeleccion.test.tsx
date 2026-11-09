// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChipSeleccion } from "./ChipSeleccion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hoja = fs.readFileSync(path.join(__dirname, "kit-chip-seleccion.css"), "utf8");
const bloque = (sel: string) => {
  const i = hoja.indexOf(`${sel} {`);
  expect(i, sel).toBeGreaterThanOrEqual(0);
  return hoja.slice(i, hoja.indexOf("}", i));
};

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  document.body.innerHTML = "";
});

function montar(nodo: ReactNode) {
  const contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  act(() => root!.render(nodo));
  return contenedor;
}

describe("ChipSeleccion", () => {
  it("es un conmutador con aria-pressed y title; sin X por defecto", () => {
    const html = renderToStaticMarkup(
      <ChipSeleccion etiqueta="No sabe" activo={false} onAlternar={() => {}} data-categoria="ns" />,
    );
    expect(html).toContain('class="pulso-chip-seleccion"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('title="No sabe"');
    expect(html).toContain('data-categoria="ns"');
    expect(html).not.toContain("pulso-chip-seleccion__quitar");
  });

  it("activo pinta is-activo y aria-pressed=true", () => {
    const html = renderToStaticMarkup(<ChipSeleccion etiqueta="Sí" activo onAlternar={() => {}} />);
    expect(html).toContain('class="pulso-chip-seleccion is-activo"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("alterna con el estado siguiente y la X quita sin alternar (botones hermanos)", () => {
    const onAlternar = vi.fn();
    const onQuitar = vi.fn();
    const c = montar(<ChipSeleccion etiqueta="Rechaza" activo onAlternar={onAlternar} onQuitar={onQuitar} />);
    const botones = c.querySelectorAll("button");
    expect(botones).toHaveLength(2);
    expect(botones[0].contains(botones[1])).toBe(false);
    const x = c.querySelector<HTMLButtonElement>('button[aria-label="Quitar Rechaza"]');
    expect(x?.className).toContain("pulso-button--quiet");
    expect(x?.getAttribute("data-intent")).toBe("remove");
    act(() => botones[0].click());
    expect(onAlternar).toHaveBeenCalledWith(false);
    act(() => x!.click());
    expect(onQuitar).toHaveBeenCalledTimes(1);
    expect(onAlternar).toHaveBeenCalledTimes(1);
  });

  it("deshabilitado desactiva los dos botones", () => {
    const c = montar(
      <ChipSeleccion etiqueta="Otro" activo={false} disabled onAlternar={() => {}} onQuitar={() => {}} etiquetaQuitar="Quitar categoría Otro" />,
    );
    expect(c.querySelector(".pulso-chip-seleccion")?.className).toContain("is-deshabilitado");
    const botones = [...c.querySelectorAll("button")];
    expect(botones.every((b) => b.disabled)).toBe(true);
    expect(botones[1].getAttribute("aria-label")).toBe("Quitar categoría Otro");
  });

  it("geometría: 28 de alto, radio de chip, tinte del módulo en activo, deshabilitado sin opacidad", () => {
    const raiz = bloque(".pulso-chip-seleccion");
    expect(raiz).toContain("--pulso-chip-sel-alto: var(--pulso-control-height-sm);");
    expect(raiz).toContain("height: var(--pulso-chip-sel-alto);");
    expect(raiz).toContain("border-radius: var(--pulso-radius-chip);");
    const activo = bloque(".pulso-chip-seleccion.is-activo");
    expect(activo).toContain("var(--module-accent-border");
    expect(activo).toContain("var(--module-accent-soft");
    const off = bloque(".pulso-chip-seleccion.is-deshabilitado");
    expect(off).toContain("background: var(--pulso-surface-3);");
    expect(off).toContain("color: var(--pulso-text-faint);");
    expect(off).toContain("border-color: var(--pulso-border);");
    expect(bloque(".pulso-chip-seleccion .pulso-chip-seleccion__alternar:disabled")).toContain("opacity: 1;");
    expect(bloque(".pulso-chip-seleccion .pulso-chip-seleccion__alternar:focus-visible")).toContain("outline: var(--mov-foco);");
    expect(bloque(".pulso-button.pulso-button--icon.pulso-button--quiet.pulso-chip-seleccion__quitar")).toContain(
      "--pulso-quiet-icon: var(--pulso-icon-size-sm);",
    );
    expect(hoja.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("W3: la cola lleva la cifra (con espacio en el nombre) y su tono de «anterior»", () => {
    const html = renderToStaticMarkup(
      <ChipSeleccion etiqueta="Sí" activo={false} onAlternar={() => {}} cifra="62%" cifraAnterior cifraQa="cifra-ficha" />,
    );
    expect(html).toMatch(/<span class="pulso-chip-seleccion__texto">Sí<\/span> <span class="pulso-chip-seleccion__cifra is-anterior" data-qa="cifra-ficha">62%<\/span>/);
    expect(bloque(".pulso-chip-seleccion__cifra.is-anterior")).toContain("opacity: 0.55;");
    expect(renderToStaticMarkup(<ChipSeleccion etiqueta="No" activo={false} onAlternar={() => {}} />)).not.toContain("__cifra");
  });

  it("W3: excluir tacha y apaga sin el acento; residual va discontinuo; envuelve parte línea", () => {
    const html = renderToStaticMarkup(
      <ChipSeleccion etiqueta="No sabe" activo onAlternar={() => {}} excluye residual envuelve />,
    );
    expect(html).toContain("pulso-chip-seleccion--excluye");
    expect(html).toContain("pulso-chip-seleccion--residual");
    expect(html).toContain("pulso-chip-seleccion--envuelve");
    const excluida = bloque(".pulso-chip-seleccion.pulso-chip-seleccion--excluye.is-activo");
    expect(excluida).toContain("background: var(--pulso-surface-3);");
    expect(excluida).not.toMatch(/accent/);
    expect(bloque(".pulso-chip-seleccion.pulso-chip-seleccion--excluye.is-activo .pulso-chip-seleccion__texto")).toContain("text-decoration: line-through;");
    expect(bloque(".pulso-chip-seleccion.pulso-chip-seleccion--residual")).toContain("border-style: dashed;");
    const texto = bloque(".pulso-chip-seleccion.pulso-chip-seleccion--envuelve .pulso-chip-seleccion__texto");
    expect(texto).toContain("white-space: normal;");
    expect(bloque(".pulso-chip-seleccion.pulso-chip-seleccion--envuelve")).toContain("height: auto;");
  });

  it("W3: bloqueado sigue enfocable (aria-disabled, no disabled) y no alterna", () => {
    const onAlternar = vi.fn();
    const c = montar(<ChipSeleccion etiqueta="Callao" activo={false} onAlternar={onAlternar} bloqueado title="Ya suma en «Lima»." />);
    const b = c.querySelector<HTMLButtonElement>("button")!;
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.disabled).toBe(false);
    act(() => b.focus());
    expect(document.activeElement).toBe(b);
    act(() => b.click());
    expect(onAlternar).not.toHaveBeenCalled();
    expect(b.getAttribute("title")).toBe("Ya suma en «Lima».");
  });
});

