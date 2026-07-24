import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MONITOREO_ROUTES } from "../core/monitoreoRegistry";
import {
  MonitoreoModuleChrome,
  monitoreoViewHref,
} from "./MonitoreoModuleChrome";

const shellDir = path.resolve(__dirname);
const componentsDir = path.resolve(shellDir, "../components");

describe("semántica de navegación de Monitoreo", () => {
  test("las secciones con deep-link son enlaces y publican aria-current", () => {
    const source = fs.readFileSync(path.join(shellDir, "MonitoreoModuleChrome.tsx"), "utf8");
    const rail = source.slice(
      source.indexOf("const sectionRail ="),
      source.indexOf("\n\n  return (", source.indexOf("const sectionRail =")),
    );

    expect(rail).toMatch(/<GlidingTabList[\s\S]*?mode="nav"/);
    expect(rail).toMatch(
      /<a[\s\S]*?href=\{saving\s*\?\s*undefined\s*:\s*monitoreoViewHref\(item\.key\)\}/,
    );
    expect(rail).toMatch(/aria-current=\{selected\s*\?\s*"page"\s*:\s*undefined\}/);
    expect(rail).not.toMatch(/role="tablist"/);
    expect(rail).not.toMatch(/role="tab"/);
    expect(rail).not.toMatch(/aria-selected=/);
  });

  test("las pestañas locales conservan semántica tab sin fingir ser enlaces", () => {
    const source = fs.readFileSync(
      path.join(componentsDir, "MonitoreoWorkbenchRail.tsx"),
      "utf8",
    );
    const tabs = source.slice(
      source.indexOf("<GlidingTabList"),
      source.indexOf("</GlidingTabList>"),
    );

    expect(tabs).toMatch(/role="tablist"/);
    expect(tabs).toMatch(/<button[\s\S]*?role="tab"/);
    expect(tabs).toMatch(/aria-selected=\{active\}/);
    expect(tabs).not.toMatch(/aria-current=/);
  });

  test("el href conserva el contexto del proyecto y reemplaza solo la sección", () => {
    expect(
      monitoreoViewHref(
        "avance",
        "http://localhost/monitoreo?proyecto=auditoria&tab=fuentes#estado",
      ),
    ).toBe("/monitoreo?proyecto=auditoria&tab=avance#estado");
  });

  test("durante el guardado no deja un href activable por menú contextual", () => {
    const route = MONITOREO_ROUTES.find(
      (item) => item.family === "aulas_universitarias",
    );
    expect(route).toBeDefined();

    const html = renderToStaticMarkup(createElement(MonitoreoModuleChrome, {
      routes: MONITOREO_ROUTES,
      route: route ?? null,
      routeSelected: true,
      activeView: "avance",
      saving: true,
      syncedAt: "",
      sourceTotal: 0,
      activeSources: 0,
      nRows: 0,
      hasSnapshot: false,
    }));
    const sourceLink = html.match(/<a[^>]*data-view-key="fuentes"[^>]*>/)?.[0];

    expect(sourceLink).toBeDefined();
    expect(sourceLink).not.toContain("href=");
    expect(sourceLink).toContain('aria-disabled="true"');
    expect(sourceLink).toContain('tabindex="-1"');
  });
});
