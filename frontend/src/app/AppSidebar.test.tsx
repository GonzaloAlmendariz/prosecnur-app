import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  PROSECNUR_GLOBAL_NAV_ITEMS,
  PROSECNUR_PRIMARY_ACTIVE_MODULES,
} from "../lib/modules";
import { AppSidebar, ModuleSwitcherGrid } from "./AppSidebar";
import { ModuleManagerGrid } from "./ModuleManagerDialog";

const modules = PROSECNUR_PRIMARY_ACTIVE_MODULES;
const processing = modules.find((module) => module.slug === "procesamiento")!;
const addedSlugs = modules.map((module) => module.slug);

function renderWithRouter(node: ReactNode) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/carga?shell=v3"]}>{node}</MemoryRouter>,
  );
}

describe("AppSidebar v3 foundation", () => {
  it("renders a full-height source list shell with accessible collapse controls", () => {
    const html = renderWithRouter(
      <AppSidebar
        modules={modules}
        activeModule={processing}
        addedSlugs={addedSlugs}
        globalItems={PROSECNUR_GLOBAL_NAV_ITEMS}
        collapsed={false}
        onCollapsedChange={() => undefined}
        onManageModules={() => undefined}
        getHref={(href) => `${href}${href.includes("?") ? "&" : "?"}shell=v3`}
      />,
    );

    expect(html).toContain("<aside");
    expect(html).toContain('data-sidebar-state="expanded"');
    expect(html).toContain('data-audit-ready="sidebar-v3-foundation"');
    expect(html).toContain('aria-label="Navegación principal"');
    expect(html).toContain("Procesamiento");
    expect(html).toContain("Módulos del proyecto");
    expect(html).toContain("Enciclopedia");
    expect(html).toContain('aria-label="Contraer sidebar"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('role="tablist"');
  });

  it("shows all eight module identities and marks processing current on /carga", () => {
    const html = renderWithRouter(
      <ModuleSwitcherGrid
        modules={modules}
        activeModule={processing}
        addedSlugs={addedSlugs}
        getHref={(href) => href}
      />,
    );

    expect(modules).toHaveLength(8);
    expect(
      html.match(/class="pulso-sidebar-module-option(?: is-current)?"/g),
    ).toHaveLength(8);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Bitácora");
    expect(html).toContain("Cálculo de muestra");
    expect(html).toContain("Formularios");
    expect(html).toContain("Hojas de ruta");
    expect(html).toContain("Fichas QR");
    expect(html).toContain("Monitoreo");
    expect(html).toContain("Procesamiento");
    expect(html).toContain("Dashboard");
  });

  it("keeps module management in an eight-card grid over the current view", () => {
    const onAddModule = vi.fn();
    const html = renderWithRouter(
      <ModuleManagerGrid
        modules={modules}
        addedSlugs={["procesamiento"]}
        onAddModule={onAddModule}
      />,
    );

    expect(html.match(/pulso-module-manager-card"/g)).toHaveLength(8);
    expect(html).toContain("Agregado");
    expect(html).toContain("Agregar");
  });

  it("freezes the 248/64 anatomy, motion and eight exact module colors", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "sidebar-v3.css"),
      "utf8",
    );
    const theme = fs.readFileSync(
      path.resolve(__dirname, "theme.css"),
      "utf8",
    );

    expect(css).toContain("--pulso-sidebar-expanded-width: 248px");
    expect(css).toContain("--pulso-sidebar-collapsed-width: 64px");
    expect(css).toContain("--pulso-sidebar-header-height: 52px");
    expect(css).toContain("--pulso-sidebar-row-height: 28px");
    expect(css).toContain("--pulso-sidebar-subrow-height: 24px");
    expect(css).toContain("--pulso-sidebar-active-rail: 2px");
    expect(css).toContain("--pulso-sidebar-flyout-width: 240px");
    expect(css).toContain("--pulso-sidebar-motion-duration: 180ms");
    expect(css).toContain("--pulso-sidebar-row-stagger: 60ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);

    const expectedTokens = {
      encyclopedia: "#a16207",
      sample: "#7c3aed",
      editor: "#6d5dfc",
      routes: "#c2410c",
      collectors: "#0891b2",
      monitoring: "#be123c",
      processing: "#0f766e",
      dashboard: "#2563eb",
    } as const;
    for (const [token, color] of Object.entries(expectedTokens)) {
      expect(theme).toContain(`--pulso-module-${token}: ${color};`);
    }
  });
});
