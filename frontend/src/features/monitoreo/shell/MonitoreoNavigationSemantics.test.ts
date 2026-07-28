import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ContactRound, PlugZap } from "../../../vendor/lucide-react";
import { MonitoreoWorkbenchChrome } from "../components/MonitoreoWorkbenchChrome";
import { MonitoreoRailLastUpdate } from "../components/MonitoreoRailLastUpdate";
import { MonitoreoWorkbenchRail } from "../components/MonitoreoWorkbenchRail";
import { MONITOREO_MODOS } from "../core/monitoreoRegistry";
import {
  MonitoreoModuleChrome,
  monitoreoSeccionHref,
} from "./MonitoreoModuleChrome";

const shellDir = path.resolve(__dirname);

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

  test("las pestañas locales de acreditación delegan toda su apariencia al rail canónico", () => {
    const rail = createElement(MonitoreoWorkbenchRail, {
      pestanaActiva: "collectors",
      activeSection: {
        label: "Fuentes",
        desc: "Plataformas y enlaces",
        icon: PlugZap,
      },
      seccionActiva: "fuentes",
      ariaLabel: "Flujos de monitoreo de acreditación",
      className: "is-acreditacion",
      iconOnlyTabs: true,
      localTabs: [{
        key: "collectors",
        label: "Recopiladores",
        detail: "1 enlace · inclusión",
        icon: ContactRound,
      }],
      routeSectionLabel: "Acreditación · sección",
      routeShortLabel: "Acreditación",
      statusItems: [{
        label: "Última actualización",
        value: "23/07/26, 10:20 a. m.",
        ready: true,
      }],
      onCambioPestana: () => undefined,
    });
    const html = renderToStaticMarkup(createElement("div", null,
      rail,
      createElement(MonitoreoWorkbenchChrome, {
        seccionActiva: "fuentes",
        rail: null,
        head: null,
        children: "Panel de fuentes",
        contentRole: "tabpanel",
        contentAriaLabelledBy: "monitoreo-fuentes-tab-collectors",
      }),
    ));

    expect(html).toContain('class="pulso-context-tab-rail is-acreditacion"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="monitoreo-fuentes-tab-collectors"');
    expect(html).toContain('aria-controls="monitoreo-fuentes-panel"');
    expect(html).toContain('id="monitoreo-fuentes-panel" role="tabpanel" aria-labelledby="monitoreo-fuentes-tab-collectors"');
    expect(html).toContain('aria-live="off"');
    expect(html).toContain('data-rail-tooltip="Recopiladores\n1 enlace · inclusión"');
    expect(html).toContain('class="pulso-context-tab-rail-footer"');
    expect(html).toContain('class="mon-rail-sync-date">23/07/26</span>');
    expect(html).toContain('class="mon-rail-sync-time">10:20</span>');
    expect(html).toContain('title="Última actualización: 23/07/26, 10:20 a. m."');
    expect(html).not.toContain("mon-nav-item");
    expect(html).not.toContain("mon-nav-tip");
    expect(html).not.toContain('aria-current=');
  });

  test("acreditación y telefónico enlazan el panel con la pestaña activa", () => {
    const profileFiles = [
      "../profiles/acreditacion/AcreditacionMonitoreoPage.tsx",
      "../profiles/telefonico/TelefonicoMonitoreoPage.tsx",
    ];

    for (const profileFile of profileFiles) {
      const source = fs.readFileSync(path.resolve(shellDir, profileFile), "utf8");
      expect(source).toContain('contentRole="tabpanel"');
      expect(source).toContain('contentAriaLabelledBy={`monitoreo-${seccionActiva}-tab-${pestanaActiva}`}');
    }
  });

  test("la cápsula compacta un corte ISO y distingue la ausencia de actualización", () => {
    const updated = renderToStaticMarkup(createElement(MonitoreoRailLastUpdate, {
      value: "2026-07-09T07:24:00",
    }));
    const empty = renderToStaticMarkup(createElement(MonitoreoRailLastUpdate, {
      value: "Sin actualización",
    }));

    expect(updated).toContain('class="mon-rail-sync-date">09/07/26</span>');
    expect(updated).toContain('class="mon-rail-sync-time">07:24</span>');
    expect(empty).toContain('class="mon-rail-sync-date">Sin act.</span>');
    expect(empty).not.toContain("Sin hora");
  });

  test("el adaptador conserva los dos eventos de sincronización local", () => {
    const source = fs.readFileSync(
      path.resolve(shellDir, "../components/MonitoreoWorkbenchRail.tsx"),
      "utf8",
    );

    expect(source).toContain('new CustomEvent("prosecnur:monitoreo-local-tab"');
    expect(source).toContain('window.addEventListener("prosecnur:monitoreo-local-tab-active"');
    expect(source).toContain('window.removeEventListener("prosecnur:monitoreo-local-tab-active"');
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

  test("el contexto de caminos muestra los hermanos del modo activo", () => {
    const route = MONITOREO_MODOS.find((item) => item.family === "acreditacion");
    expect(route).toBeDefined();

    // `routes={[route]}` reproduce lo que pasa cada perfil: se monta por lazy
    // import y solo se conoce a sí mismo. El contexto de caminos igual debe
    // listar los cuatro, porque los toma del registry y no de ese prop.
    const html = renderToStaticMarkup(createElement(MonitoreoModuleChrome, {
      routes: route ? [route] : [],
      route: route ?? null,
      routeSelected: true,
      seccionActiva: "avance",
      saving: false,
      syncedAt: "",
      sourceTotal: 0,
      activeSources: 0,
      nRows: 0,
      hasSnapshot: false,
    }));

    expect(html).toContain('data-monitoreo-active-family="acreditacion"');
    expect(html).toContain(`data-monitoreo-path-count="${MONITOREO_MODOS.length}"`);

    for (const sibling of MONITOREO_MODOS.filter((item) => item.family !== "acreditacion")) {
      expect(html).toContain(`data-monitoreo-family="${sibling.family}"`);
    }
    // El activo no se repite como hermano.
    expect(html).not.toContain('data-monitoreo-family="acreditacion"');
  });

  test("los caminos hermanos son contexto inerte, no una segunda navegación", () => {
    const route = MONITOREO_MODOS.find((item) => item.family === "territorial");
    const source = fs.readFileSync(path.join(shellDir, "MonitoreoPathContext.tsx"), "utf8");

    // La gramática de layout prohíbe duplicar la navegación de un nivel en otro:
    // el rail de secciones ya es el recorrido del módulo. Los hermanos existen
    // para orientar, no para saltar — si algún día alguien los vuelve enlaces o
    // botones, este test lo frena.
    expect(source).not.toMatch(/<a\b/);
    expect(source).not.toMatch(/<button\b/);
    expect(source).not.toMatch(/onClick=/);
    expect(source).not.toMatch(/href=/);

    const html = renderToStaticMarkup(createElement(MonitoreoModuleChrome, {
      routes: route ? [route] : [],
      route: route ?? null,
      routeSelected: true,
      seccionActiva: "avance",
      saving: false,
      syncedAt: "",
      sourceTotal: 0,
      activeSources: 0,
      nRows: 0,
      hasSnapshot: false,
    }));

    const chip = html.match(/<span[^>]*data-monitoreo-family="acreditacion"[^>]*>/)?.[0];
    expect(chip).toBeDefined();
    expect(chip).toContain("mon-path-chip");
    // Cada hermano explica por qué no es un destino.
    expect(chip).toContain("title=");
  });
});
