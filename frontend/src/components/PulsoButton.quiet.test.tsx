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

  it("W3: el ícono es quieto POR DEFECTO; las otras variantes no cambian", () => {
    const variantes: PulsoButtonProps[] = [
      { variant: "primary", children: "Guardar" },
      { variant: "secondary", size: "sm", children: "Revisar" },
      { variant: "ghost", children: "Ver" },
      { variant: "link", children: "Ninguna" },
      { variant: "danger", children: "Eliminar" },
    ];
    for (const props of variantes) {
      const html = renderToStaticMarkup(<PulsoButton {...props} />);
      expect(html).not.toContain("pulso-button--quiet");
      expect(html).not.toContain("pulso-button--framed");
    }
    expect(renderToStaticMarkup(<PulsoButton variant="icon" aria-label="Más">+</PulsoButton>)).toBe(
      '<button aria-label="Más" type="button" class="pulso-button pulso-button--icon pulso-button--md pulso-button--quiet">+</button>',
    );
    expect(
      renderToStaticMarkup(<PulsoButton variant="icon" intent="remove" aria-label="Quitar">x</PulsoButton>),
    ).toContain("pulso-button--quiet");
  });

  it("W3: tone=\"framed\" devuelve la caja hairline y no lleva la clase quieta", () => {
    const html = renderToStaticMarkup(
      <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Un paso menos">−</PulsoButton>,
    );
    expect(html).toContain('class="pulso-button pulso-button--icon pulso-button--sm pulso-button--framed"');
    expect(html).not.toContain("pulso-button--quiet");
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

  it("hover en surface-3 sin sombra; un único anillo de foco; deshabilitado sin opacidad ni caja (R11-14a)", () => {
    const hover = regla(":hover:not(:disabled)");
    expect(hover).toContain("background: var(--pulso-surface-3);");
    expect(hover).toContain("box-shadow: none;");
    const foco = regla(":focus-visible");
    expect(foco).toContain("outline: var(--mov-foco);");
    expect(foco).toContain("box-shadow: none;");
    const off = regla(':is(:disabled, [aria-disabled="true"])');
    expect(off).toContain("opacity: 1;");
    expect(off).toContain("background: transparent;");
    expect(off).toContain("color: var(--pulso-text-faint);");
    expect(off).toContain("border-color: transparent;");
  });

  it("sin hex en la hoja", () => {
    expect(hoja.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("W3: el ícono enmarcado es la excepción declarada (barra de comandos, acciones de archivo, paso a paso)", () => {
    const raiz = path.resolve(__dirname, "..");
    const encontrados: string[] = [];
    const visitar = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, e.name);
        if (e.isDirectory()) visitar(completo);
        else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name) && e.name !== "PulsoButton.tsx") {
          const n = (fs.readFileSync(completo, "utf8").match(/tone="framed"/g) ?? []).length;
          if (n > 0) encontrados.push(`${path.relative(raiz, completo).split(path.sep).join("/")}:${n}`);
        }
      }
    };
    visitar(raiz);
    expect(encontrados.sort()).toEqual([
      "components/ChromeOverflowMenu.tsx:1",
      "components/ModuleCommandBar.tsx:1",
      "components/entregables/AccionesArchivo.tsx:4",
      "features/graficos/SuggestedPlanButton.tsx:1",   // el disparador de "Armar desde": enmarcado desde 27fe14459 (2026-11-09)
      "features/hojasRuta/mapa/ajustes/grupos/GrupoRecorrido.tsx:2",
      "features/hojasRuta/mapa/manzanas/MarcoElegiblePanel.tsx:2",
    ]);
  });

  it("W3: pulsado (aria-pressed o popover abierto) = tinte del módulo con su borde; un disclosure no se tiñe", () => {
    const sel = `${SEL}:is([aria-pressed="true"], [aria-expanded="true"][aria-haspopup])`;
    const i = hoja.indexOf(sel);
    expect(i, sel).toBeGreaterThanOrEqual(0);
    const pulsado = hoja.slice(i, hoja.indexOf("}", i));
    expect(pulsado).toContain("border-color: var(--module-accent-border, var(--pulso-primary-border));");
    expect(pulsado).toContain("background: var(--module-accent-soft, var(--pulso-primary-soft));");
    expect(hoja).not.toMatch(/\[aria-expanded="true"\]\)/);
  });
});

