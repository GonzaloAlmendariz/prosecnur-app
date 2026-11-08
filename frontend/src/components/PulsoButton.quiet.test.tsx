import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { X } from "../vendor/lucide-react";
import { PulsoButton, type PulsoButtonProps } from "./PulsoButton";

const hoja = fs.readFileSync(path.join(__dirname, "kit-boton-quieto.css"), "utf8");
const SEL = ".pulso-button.pulso-button--icon.pulso-button--quiet";

function regla(sufijo: string): string {
  const inicio = hoja.indexOf(`${SEL}${sufijo} {`);
  expect(inicio, `${SEL}${sufijo}`).toBeGreaterThanOrEqual(0);
  return hoja.slice(inicio, hoja.indexOf("}", inicio));
}

describe("PulsoButton tone=quiet", () => {
  it("añade solo la clase pulso-button--quiet y no filtra tone al DOM", () => {
    const html = renderToStaticMarkup(
      <PulsoButton variant="icon" tone="quiet" aria-label="Mover arriba">
        <X aria-hidden="true" />
      </PulsoButton>,
    );
    expect(html).toContain('class="pulso-button pulso-button--icon pulso-button--md pulso-button--quiet"');
    expect(html).not.toMatch(/ tone=/);
  });

  it("convive con intent=remove", () => {
    const html = renderToStaticMarkup(
      <PulsoButton variant="icon" tone="quiet" intent="remove" size="sm" aria-label="Quitar fila">
        <X aria-hidden="true" />
      </PulsoButton>,
    );
    expect(html).toContain('data-intent="remove"');
    expect(html).toContain("pulso-button--sm pulso-button--quiet");
  });

  it("no altera las otras variantes: mismo marcado sin tone", () => {
    const variantes: PulsoButtonProps[] = [
      { variant: "primary", children: "Guardar" },
      { variant: "secondary", size: "sm", children: "Revisar" },
      { variant: "ghost", children: "Ver" },
      { variant: "link", children: "Ninguna" },
      { variant: "danger", children: "Eliminar" },
      { variant: "icon", "aria-label": "Más", children: "+" },
      { variant: "icon", intent: "remove", "aria-label": "Quitar", children: "x" },
    ];
    for (const props of variantes) {
      const html = renderToStaticMarkup(<PulsoButton {...props} />);
      expect(html).not.toContain("pulso-button--quiet");
    }
    expect(renderToStaticMarkup(<PulsoButton variant="icon" aria-label="Más">+</PulsoButton>)).toBe(
      '<button aria-label="Más" type="button" class="pulso-button pulso-button--icon pulso-button--md">+</button>',
    );
  });

  it("tone solo existe en la variante icon", () => {
    // @ts-expect-error tone="quiet" es del botón de ícono.
    const invalido: PulsoButtonProps = { variant: "secondary", tone: "quiet" };
    expect(invalido.variant).toBe("secondary");
  });

  it("geometría: 28 a la vista, 32 al puntero, radio de control, ícono 16/14", () => {
    const base = regla("");
    expect(base).toContain("--pulso-button-height: var(--pulso-control-height-sm);");
    expect(base).toContain("border-radius: var(--pulso-control-radius);");
    expect(base).toContain("box-shadow: none;");
    expect(base).toContain("background: transparent;");
    expect(base).toContain("border: 1px solid transparent;");
    expect(regla("::before")).toContain("var(--pulso-close-hit)");
    // R9-11: el ::before se posiciona desde la caja de relleno; compensa el borde de 1 px para llegar a 32.
    expect(regla("::before")).toContain("inset: calc(min(0px, calc((var(--pulso-button-height) - var(--pulso-close-hit)) / 2)) - 1px);");
    expect(base).toContain("--pulso-quiet-icon: var(--pulso-icon-size-md);");
    expect(regla(".pulso-button--sm")).toContain("var(--pulso-icon-size-sm)");
  });

  it("hover en surface-3 sin sombra; un único anillo de foco; deshabilitado sin opacidad", () => {
    const hover = regla(":hover:not(:disabled)");
    expect(hover).toContain("background: var(--pulso-surface-3);");
    expect(hover).toContain("box-shadow: none;");
    const foco = regla(":focus-visible");
    expect(foco).toContain("outline: var(--mov-foco);");
    expect(foco).toContain("box-shadow: none;");
    const off = regla(":disabled");
    expect(off).toContain("opacity: 1;");
    expect(off).toContain("background: var(--pulso-surface-3);");
    expect(off).toContain("color: var(--pulso-text-faint);");
    expect(off).toContain("border-color: var(--pulso-border);");
  });

  it("sin hex en la hoja", () => {
    expect(hoja.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
