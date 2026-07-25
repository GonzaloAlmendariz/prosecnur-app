import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MONITOREO_MODOS } from "../core/monitoreoRegistry";
import {
  MonitoreoModuleChrome,
  monitoreoSeccionHref,
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
      /<a[\s\S]*?href=\{saving\s*\?\s*undefined\s*:\s*monitoreoSeccionHref\(item\.key\)\}/,
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
      monitoreoSeccionHref(
        "avance",
        "http://localhost/monitoreo?proyecto=auditoria&seccion=fuentes#estado",
      ),
    ).toBe("/monitoreo?proyecto=auditoria&seccion=avance#estado");
  });

  test("migra el `?tab=` legacy a la forma canónica en vez de dejar los dos", () => {
    expect(
      monitoreoSeccionHref("avance", "http://localhost/monitoreo?tab=fuentes"),
    ).toBe("/monitoreo?seccion=avance");
  });

  test("cambiar de sección suelta la pestaña, que pertenecía a la anterior", () => {
    // `?pestana=ump` solo existe en Avance territorial. Arrastrarlo a Fuentes
    // produciría una dirección que nombra una pestaña inexistente.
    expect(
      monitoreoSeccionHref(
        "fuentes",
        "http://localhost/monitoreo?seccion=avance&pestana=ump",
      ),
    ).toBe("/monitoreo?seccion=fuentes");
  });

  test("durante el guardado no deja un href activable por menú contextual", () => {
    const route = MONITOREO_MODOS.find(
      (item) => item.family === "aulas_universitarias",
    );
    expect(route).toBeDefined();

    const html = renderToStaticMarkup(createElement(MonitoreoModuleChrome, {
      routes: MONITOREO_MODOS,
      route: route ?? null,
      routeSelected: true,
      seccionActiva: "avance",
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
