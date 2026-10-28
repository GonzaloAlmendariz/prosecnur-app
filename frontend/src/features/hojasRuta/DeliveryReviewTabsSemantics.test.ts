import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { SeleccionMesa, itemsDelRail } from "./seleccion/SeleccionMesa";
import type { HojasRutaNavigationTab } from "./hojasRutaNavigation";

// Selección usa el rail de pestañas del kit (ContextTabRail) y la cabecera
// única (TabHeading). El contrato que se conserva desde la versión con
// GlidingTabList: cada pestaña controla el panel de la pestaña activa y el
// panel se nombra por su pestaña.

const PESTANAS: HojasRutaNavigationTab[] = [
  { key: "cuotas", label: "Cuotas", count: 13, disabled: false },
  { key: "titulares", label: "Titulares", count: 150, disabled: false },
  { key: "reemplazos", label: "Reemplazos", count: 0, disabled: true, disabledReason: "Sin reemplazos" },
];

const tabId = (key: string) => `hojas-delivery-review-tab-${key}`;

describe("Hojas delivery-review tabs semantics", () => {
  test("links every review tab to the active delivery panel", () => {
    const html = renderToStaticMarkup(
      createElement(SeleccionMesa, {
        pestana: "titulares",
        pestanas: PESTANAS,
        onPestana: vi.fn(),
        panelId: "hojas-delivery-review-panel",
        tabId,
        chips: [],
        salidas: null,
        children: createElement("p", null, "tabla"),
      }),
    );

    for (const tab of PESTANAS) {
      expect(html).toContain(`id="${tabId(tab.key)}"`);
    }
    expect(html.match(/aria-controls="hojas-delivery-review-panel"/g)?.length).toBe(PESTANAS.length);
    expect(html).toMatch(/id="hojas-delivery-review-panel"[^>]*role="tabpanel"|role="tabpanel"[^>]*id="hojas-delivery-review-panel"/);
    expect(html).toContain(`aria-labelledby="${tabId("titulares")}"`);
  });

  test("the rail carries each tab's count and the reason a tab is disabled", () => {
    const items = itemsDelRail(PESTANAS);
    expect(items.map((item) => item.key)).toEqual(["cuotas", "titulares", "reemplazos"]);
    expect(items[1].description).toBe("150 filas");
    expect(items[2]).toMatchObject({ disabled: true, description: "Sin reemplazos" });
  });

  test("the page wires Selección through SeleccionMesa with the canonical ids and handler", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const bloque = source.slice(source.indexOf("<SeleccionMesa"), source.indexOf("</SeleccionMesa>"));
    expect(bloque).toContain("panelId={HOJAS_DELIVERY_REVIEW_PANEL_ID}");
    expect(bloque).toContain("tabId={hojasDeliveryReviewTabId}");
    expect(bloque).toContain("onPestana={selectDeliveryReviewTab}");
    expect(bloque).toContain("pestana={currentDeliveryTab}");
  });
});
