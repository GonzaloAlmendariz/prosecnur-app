import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { conMayusculaInicial, EstadoChip } from "./EstadoChip";
import { ModuleCommandBar } from "./ModuleCommandBar";

const CHIP = { id: "deployment-status", label: "accesos sin preparar", tone: "neutral" as const, detail: "Lo que lee Monitoreo" };

describe("EstadoChip y el slot de estado de la barra (P6)", () => {
  it("sin slotDeEstado la barra pinta el estado como siempre: compatible con los módulos que no lo adoptan", () => {
    const html = renderToStaticMarkup(
      <ModuleCommandBar modulo="material-campo" ariaLabel="Barra" estado={[CHIP]} />,
    );
    expect(html).toContain('class="pulso-chrome-status-chip"');
    expect(html).toContain(">accesos sin preparar<");
    expect(html).not.toContain("pulso-command-bar-estado");
    expect(html).not.toContain("pulso-estado-chip-punto");
  });

  it("con slotDeEstado el estado va en su grupo, con punto de tono y mayúscula inicial", () => {
    const html = renderToStaticMarkup(
      <ModuleCommandBar modulo="material-campo" ariaLabel="Barra" estado={[CHIP]} slotDeEstado />,
    );
    expect(html).toContain('class="pulso-command-bar-estado"');
    expect(html).toContain("pulso-estado-chip-punto");
    expect(html).toContain("Accesos sin preparar");
    expect(html).not.toContain(">accesos sin preparar<");
    expect(html).toContain('title="Lo que lee Monitoreo"');
  });

  it("un estado sin onSelect no es un control: span de estado, ningún botón", () => {
    // Un <button disabled> no se puede anidar en otro control (chips dentro del botón de una
    // fila) y en Chromium se traga el clic de la fila padre (Monitoreo, 2 nov 2026).
    const html = renderToStaticMarkup(<EstadoChip label="sin lote" tone="warn" />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("disabled");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-tone="warn"');
    expect(html).toContain('title="Sin lote"');
  });

  it("con onSelect sí es un botón", () => {
    const html = renderToStaticMarkup(<EstadoChip label="sin lote" tone="warn" onSelect={() => undefined} />);
    expect(html).toContain("<button");
    expect(html).not.toContain("disabled");
  });

  it("el rótulo va en su propio elemento, para que la geometría mida el texto y no sólo el punto", () => {
    const html = renderToStaticMarkup(<EstadoChip label="sin lote" tone="warn" />);
    expect(html).toContain('<span class="pulso-estado-chip-rotulo">Sin lote</span>');
    // Ningún texto suelto como hijo directo del chip: sólo el punto y el rótulo.
    const interior = html.replace(/^<span[^>]*>/, "").replace(/<\/span>$/, "");
    expect(interior.replace(/<span[^>]*>[^<]*<\/span>/g, "")).toBe("");
  });

  it("la mayúscula inicial respeta el resto del rótulo", () => {
    expect(conMayusculaInicial("entregada a Monitoreo")).toBe("Entregada a Monitoreo");
    expect(conMayusculaInicial("")).toBe("");
    expect(conMayusculaInicial("ñandú")).toBe("Ñandú");
  });
});
