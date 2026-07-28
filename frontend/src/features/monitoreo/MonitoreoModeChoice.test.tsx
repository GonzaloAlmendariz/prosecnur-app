import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MONITOREO_MODOS } from "./core/monitoreoRegistry";
import { MonitoreoModeChoice } from "./MonitoreoModeChoice";

describe("MonitoreoModeChoice", () => {
  it("presenta cada modo activo como una decisión explícita", () => {
    const html = renderToStaticMarkup(
      <MonitoreoModeChoice onChoose={vi.fn()} />,
    );

    const activeModes = MONITOREO_MODOS.filter((mode) => mode.status === "active");
    expect(html.match(/class="mon-mode-choice__option"/g)).toHaveLength(activeModes.length);
    expect(html).toContain("Declara el propósito de Monitoreo");
    expect(html).toContain("Acreditación institucional");
    expect(html).not.toContain("aria-pressed");
  });

  it("bloquea todas las alternativas mientras persiste el modo elegido", () => {
    const html = renderToStaticMarkup(
      <MonitoreoModeChoice
        busyFamily="territorial"
        onChoose={vi.fn()}
      />,
    );

    expect(html.match(/ disabled=""/g)).toHaveLength(
      MONITOREO_MODOS.filter((mode) => mode.status === "active").length,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Guardando…");
  });

  it("mantiene el error de persistencia dentro de la elección", () => {
    const html = renderToStaticMarkup(
      <MonitoreoModeChoice
        error="No se pudo escribir el proyecto."
        onChoose={vi.fn()}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("No se pudo escribir el proyecto.");
  });
});
