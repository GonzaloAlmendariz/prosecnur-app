import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Table2, Upload } from "../vendor/lucide-react";
import { ContextTabRail, type ContextTabRailItem } from "./ContextTabRail";

type TestTab = "preparar" | "base";

const ITEMS: readonly ContextTabRailItem<TestTab>[] = [
  {
    key: "preparar",
    label: "Preparar",
    description: "Formulario y respuestas",
    icon: Upload,
  },
  {
    key: "base",
    label: "Ver base",
    description: "Respuestas cargadas",
    icon: Table2,
    disabled: true,
  },
];

describe("ContextTabRail", () => {
  it("emite el contrato ARIA y data-nav sin estados de finalización", () => {
    const html = renderToStaticMarkup(
      <ContextTabRail
        ariaLabel="Pestañas de carga"
        activeKey="preparar"
        items={ITEMS}
        panelId="carga-panel"
        tabId={(key) => `carga-tab-${key}`}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('<aside class="pulso-context-tab-rail" aria-label="Pestañas de carga">');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('id="carga-tab-preparar"');
    expect(html).toContain('aria-controls="carga-panel"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-nav-item=""');
    expect(html).toContain('data-nav-shape="row"');
    expect(html).toContain('data-nav-state="selected"');
    expect(html).toContain('data-rail-tooltip="Preparar\nFormulario y respuestas"');
    expect(html).toContain('id="carga-tab-base"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("is-done");
    expect(html).not.toContain("badge");
  });

  it("mantiene icon-only por defecto y muestra etiquetas solo con opt-in", () => {
    const iconOnlyHtml = renderToStaticMarkup(
      <ContextTabRail
        ariaLabel="Pestañas de carga"
        activeKey="preparar"
        items={ITEMS}
        panelId="carga-panel"
        tabId={(key) => `carga-tab-${key}`}
        onChange={vi.fn()}
      />,
    );
    const labeledHtml = renderToStaticMarkup(
      <ContextTabRail
        ariaLabel="Pestañas de carga"
        activeKey="preparar"
        items={ITEMS}
        panelId="carga-panel"
        tabId={(key) => `carga-tab-${key}`}
        onChange={vi.fn()}
        showLabels
      />,
    );

    expect(iconOnlyHtml).not.toContain("pulso-context-tab-label");
    expect(labeledHtml).toContain('<span class="pulso-context-tab-label">Preparar</span>');
    expect(labeledHtml).toContain('<span class="pulso-context-tab-label">Ver base</span>');
  });

  it("mantiene los destinos densos alcanzables y el track en el ancho canónico", () => {
    const css = fs.readFileSync(path.join(__dirname, "ContextTabRail.css"), "utf8");

    expect(css).toMatch(
      /:root (?:\.pulso-context-tab-layout){4}\s*\{[\s\S]*?grid-template-columns:\s*var\(--pulso-rail-compressed-width\)/,
    );
    expect(css).toMatch(
      /\.pulso-context-tab-list\s*\{[\s\S]*?overflow-y:\s*auto/,
    );
    expect(css).toContain("scrollbar-width: none");
    expect(css).toContain(".pulso-context-tab-list::-webkit-scrollbar");
    expect(css).toContain(".pulso-context-tab-tooltip");
    expect(css).toMatch(
      /\.pulso-context-tab-layout\s*>\s*\.pulso-context-tab-rail\s*\{[\s\S]*?border-right:\s*1px solid var\(--pulso-border\)/,
    );
    const footerCard = css.match(/\.pulso-context-tab-rail-meta\s*>\s*span\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(footerCard).toContain("min-height: calc(var(--pulso-nav-item-height) + 18px)");
    expect(footerCard).toContain("border: 1px solid color-mix(");
    expect(footerCard).toContain("border-radius: var(--pulso-radius-chip)");
    expect(footerCard).toContain("background:");
    expect(css).toMatch(
      /\.pulso-context-tab-rail-meta \.mon-rail-sync-time\s*\{[\s\S]*?display:\s*block/,
    );
    expect(css).toMatch(
      /\.pulso-context-tab-rail-meta \.mon-rail-sync-date\s*\{[\s\S]*?font-size:\s*7px[\s\S]*?white-space:\s*nowrap/,
    );
    expect(css).toMatch(
      /\.pulso-context-tab-item:hover:not\(:active\)\s*\{\s*transform:\s*none;/,
    );
  });
});
