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

  it("un estado sin onSelect no se ofrece como acción", () => {
    const html = renderToStaticMarkup(<EstadoChip label="sin lote" tone="warn" />);
    expect(html).toContain("disabled");
    expect(html).toContain('data-tone="warn"');
    expect(html).toContain('title="Sin lote"');
  });

  it("la mayúscula inicial respeta el resto del rótulo", () => {
    expect(conMayusculaInicial("entregada a Monitoreo")).toBe("Entregada a Monitoreo");
    expect(conMayusculaInicial("")).toBe("");
    expect(conMayusculaInicial("ñandú")).toBe("Ñandú");
  });
});
